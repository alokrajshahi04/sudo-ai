import express from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type {
  Job,
  Phase,
  Provider,
  Capabilities,
  Evidence,
  ModelProvider,
} from "../shared/types";
import { AppError, safeError, redact } from "./errors";
import { inspect, parseRepo, github } from "./github";
import { fetchPublic, plainText } from "./network";
import { modelConfig, generatePositioning } from "./models";
import { validateRecording, narrate, render, execute } from "./media";

const app = express();
app.disable("x-powered-by");
const port = Number(process.env.PORT || 3001);
const sessions = new Map<string, number>();
const jobs = new Map<string, Job & { owner: string }>();
const media = new Map<
  string,
  { recording?: Buffer; narration?: Buffer; video?: Buffer }
>();
const busy = new Set<string>();
const attempts = new Map<string, { time: number; count: number }>();
let ffmpegAvailable = false;
execute("ffmpeg", ["-version"], 5000)
  .then(() => {
    ffmpegAvailable = true;
  })
  .catch(() => {});
const origins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);
app.use((req, res, next) => {
  const host = req.headers.host || "";
  if (!/^(?:localhost|127\.0\.0\.1):\d+$/.test(host))
    return res
      .status(403)
      .json({
        error: "Local application only. Public hosting is not enabled.",
      });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  if (
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    !origins.has(req.headers.origin || "")
  )
    return res
      .status(403)
      .json({ error: "Mutation requires the local application origin." });
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split(";").map((c) => c.trim().split("=")),
  );
  let session = cookies.sudo_session;
  if (
    !session ||
    !sessions.has(session) ||
    sessions.get(session)! < Date.now()
  ) {
    if (sessions.size >= 100)
      return res.status(429).json({ error: "Local session limit reached." });
    session = randomBytes(32).toString("hex");
    res.cookie("sudo_session", session, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 3_600_000,
      path: "/",
    });
  }
  sessions.set(session, Date.now() + 3_600_000);
  res.locals.owner = session;
  if (req.path.startsWith("/api/") && req.method !== "GET") {
    const previous = attempts.get(session);
    const bucket =
      previous && Date.now() - previous.time < 60_000
        ? previous
        : { time: Date.now(), count: 0 };
    bucket.count++;
    attempts.set(session, bucket);
    if (bucket.count > 30)
      return res
        .status(429)
        .json({ error: "Too many operations. Retry in a minute." });
  }
  next();
});
app.use(express.json({ limit: "16kb" }));
function getJob(id: string, owner: string) {
  const job = jobs.get(id);
  if (!job || job.owner !== owner || Date.parse(job.expiresAt) < Date.now())
    throw new AppError(404, "Launch job not found or expired.");
  return job;
}
function publicJob(job: Job & { owner: string }): Job {
  const { owner, ...data } = job;
  return data;
}
function operation(job: Job, phase: Phase, work: () => Promise<void>) {
  if (busy.has(job.id))
    throw new AppError(409, "This job is already running an operation.");
  if (busy.size >= 3)
    throw new AppError(
      429,
      "Worker limit reached. Retry after another job finishes.",
    );
  busy.add(job.id);
  job.phases[phase] = { state: "running" };
  void work()
    .then(() => {
      job.phases[phase] = { state: "completed" };
    })
    .catch((e) => {
      job.phases[phase] = { state: "failed", error: safeError(e) };
    })
    .finally(() => busy.delete(job.id));
}
function capacity(bytes: Buffer, replaced?: Buffer) {
  const total = [...media.values()].reduce(
    (n, a) =>
      n +
      (a.recording?.length || 0) +
      (a.narration?.length || 0) +
      (a.video?.length || 0),
    0,
  );
  if (total + bytes.length - (replaced?.length || 0) > 200_000_000)
    throw new AppError(429, "Local media capacity reached. Delete an old job.");
}
function clearGenerated(job: Job) {
  job.positioning = undefined;
  job.phases.position = { state: "idle" };
  job.phases.narrate = { state: "idle" };
  job.phases.render = { state: "idle" };
  const assets = media.get(job.id);
  if (assets) {
    delete assets.narration;
    delete assets.video;
  }
  job.artifacts = job.artifacts.filter((a) => a.type === "recording");
}
app.get("/api/capabilities", (_req, res) => {
  const providers: ModelProvider[] = ["google", "nebius", "custom"];
  const capabilities: Capabilities = {
    mode: "local",
    models: providers.map((provider) => {
      const c = modelConfig(provider);
      return {
        provider,
        model: c.model,
        configured: !!(c.key && c.model && c.base),
      };
    }),
    narration: !!(
      process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID
    ),
    render: ffmpegAvailable,
    hostedCredentialEntry: false,
    automatedDeployment: false,
    research:
      "Bounded public GitHub search and supplied public links. Agent-Reach integration pending.",
  };
  res.json(capabilities);
});
app.post("/api/jobs", (req, res) => {
  const input = z
    .object({
      repository: z.string().max(300),
      brief: z.string().min(3).max(1200),
      model: z.enum(["google", "nebius", "custom"]).default("google"),
    })
    .strict()
    .parse(req.body);
  const repo = parseRepo(input.repository);
  if (
    [...jobs.values()].filter((j) => j.owner === res.locals.owner).length >= 5
  )
    throw new AppError(
      429,
      "Five active jobs per session. Delete an old job first.",
    );
  if (jobs.size >= 30)
    throw new AppError(429, "Local job capacity reached. Delete an old job.");
  const job: Job & { owner: string } = {
    id: randomUUID(),
    owner: res.locals.owner,
    repository: repo.canonical,
    name: repo.repo,
    brief: redact(input.brief),
    modelPreference: input.model,
    selectedAngle: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    phases: {
      inspect: { state: "idle" },
      research: { state: "idle" },
      position: { state: "idle" },
      verify: { state: "idle" },
      recording: { state: "idle" },
      narrate: { state: "idle" },
      render: { state: "idle" },
    },
    artifacts: [],
  };
  jobs.set(job.id, job);
  operation(job, "inspect", async () => {
    job.inspection = await inspect(job.repository);
  });
  res.status(202).json(publicJob(job));
});
app.get("/api/jobs", (req, res) =>
  res.json(
    [...jobs.values()]
      .filter((j) => j.owner === res.locals.owner)
      .map(publicJob),
  ),
);
app.get("/api/jobs/:id", (req, res) =>
  res.json(publicJob(getJob(req.params.id, res.locals.owner))),
);
app.delete("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  if (busy.has(job.id))
    throw new AppError(409, "Wait for the running operation before deleting.");
  jobs.delete(job.id);
  media.delete(job.id);
  res.status(204).end();
});
app.post("/api/jobs/:id/inspect", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  operation(job, "inspect", async () => {
    const inspected = await inspect(job.repository);
    if (job.inspection?.revision !== inspected.revision) {
      clearGenerated(job);
      job.deploymentPlan = undefined;
      job.site = undefined;
      job.phases.verify = { state: "idle" };
      job.phases.recording = { state: "idle" };
      job.artifacts = [];
      media.delete(job.id);
    }
    job.inspection = inspected;
  });
  res.status(202).json(publicJob(job));
});
app.post("/api/jobs/:id/research", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = z
    .object({
      query: z.string().min(2).max(120),
      links: z.array(z.string().max(1000)).max(3).default([]),
    })
    .strict()
    .parse(req.body);
  if (!job.inspection) throw new AppError(409, "Complete inspection first.");
  operation(job, "research", async () => {
    const { owner, repo } = parseRepo(job.repository);
    const data = await github(
      `/search/repositories?q=${encodeURIComponent(input.query + " fork:false")}&per_page=4`,
    );
    const now = new Date().toISOString();
    const sources: Evidence[] = (data.items || [])
      .filter(
        (item: any) =>
          item.full_name.toLowerCase() !== `${owner}/${repo}`.toLowerCase(),
      )
      .slice(0, 3)
      .map((item: any, i: number) => ({
        id: `research-${i + 1}`,
        kind: "public_research",
        title: item.full_name,
        url: item.html_url,
        excerpt: redact(item.description || "No description.").slice(0, 1000),
        checkedAt: now,
      }));
    for (const link of input.links) {
      const page = await fetchPublic(link);
      if (page.status < 200 || page.status >= 300)
        throw new AppError(422, "A supplied research page is not reachable.");
      sources.push({
        id: `research-${sources.length + 1}`,
        kind: "public_research",
        title: page.url,
        url: page.url,
        excerpt: redact(plainText(page.text)).slice(0, 4000),
        checkedAt: now,
      });
    }
    job.research = {
      sources,
      query: input.query,
      coverage:
        "GitHub repository search (up to three other repositories), plus supplied public links. Descriptions are not verified competitor features or launch history. Agent-Reach/social search was not run.",
    };
    clearGenerated(job);
  });
  res.status(202).json(publicJob(job));
});
app.post("/api/jobs/:id/position", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = z
    .object({ provider: z.enum(["google", "nebius", "custom"]) })
    .strict()
    .parse(req.body);
  if (!job.inspection)
    throw new AppError(409, "Complete repository inspection first.");
  const c = modelConfig(input.provider);
  if (!c.key || !c.model || !c.base)
    throw new AppError(
      409,
      "Configure the selected model key and ID in the local .env.",
    );
  operation(job, "position", async () => {
    const result = await generatePositioning(job, input.provider);
    clearGenerated(job);
    job.positioning = result;
    job.modelPreference = input.provider;
  });
  res.status(202).json(publicJob(job));
});
app.post("/api/jobs/:id/angle", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  if (busy.has(job.id))
    throw new AppError(409, "Wait for the current operation.");
  const input = z
    .object({ index: z.number().int().min(0).max(1) })
    .strict()
    .parse(req.body);
  if (!job.positioning) throw new AppError(409, "Generate positioning first.");
  if (job.selectedAngle !== input.index) {
    const assets = media.get(job.id);
    if (assets) {
      delete assets.narration;
      delete assets.video;
    }
    job.artifacts = job.artifacts.filter((a) => a.type === "recording");
    job.phases.narrate = { state: "idle" };
    job.phases.render = { state: "idle" };
  }
  job.selectedAngle = input.index;
  res.json(publicJob(job));
});
app.post("/api/jobs/:id/plan", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  if (busy.has(job.id))
    throw new AppError(409, "Wait for the current operation.");
  const input = z
    .object({ provider: z.enum(["vercel", "digitalocean"]) })
    .strict()
    .parse(req.body);
  if (!job.inspection) throw new AppError(409, "Complete inspection first.");
  const inspected = job.inspection;
  job.deploymentPlan = {
    provider: input.provider,
    sourceRevision: inspected.revision,
    supported:
      inspected.profile === "static_vite" && !inspected.blockers.length,
    buildCommand: inspected.buildCommand,
    outputDirectory: inspected.outputDirectory,
    handoffUrl:
      input.provider === "vercel"
        ? `https://vercel.com/new?import-git-url=${encodeURIComponent(job.repository)}`
        : "https://cloud.digitalocean.com/apps/new",
    createdAt: new Date().toISOString(),
    notes: [
      ...inspected.blockers,
      ...inspected.warnings,
      "Import this repository on the provider website. Review the account, source, build/output settings, and SPA routing there. No API deployment was executed.",
      input.provider === "vercel"
        ? "Vercel Hobby is limited to non-commercial personal use. Check eligibility before launch."
        : "Confirm App Platform static-site pricing and your actual credit balance.",
      "This handoff cannot attest the built revision. Source inspection is pinned; imported branches may move.",
    ],
  };
  res.json(publicJob(job));
});
app.post("/api/jobs/:id/verify", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = z
    .object({ url: z.string().max(1000) })
    .strict()
    .parse(req.body);
  operation(job, "verify", async () => {
    job.site = undefined;
    clearGenerated(job);
    const page = await fetchPublic(input.url);
    const title = page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    job.site = {
      url: input.url,
      finalUrl: page.url,
      httpStatus: page.status,
      reachable: page.status >= 200 && page.status < 300,
      title: title ? redact(plainText(title)).slice(0, 200) : null,
      checkedAt: new Date().toISOString(),
      builtRevision: null,
      interaction: "not_checked",
    };
    clearGenerated(job);
    if (!job.site.reachable)
      throw new AppError(
        422,
        `Site returned HTTP ${page.status}; reachability did not pass.`,
      );
  });
  res.status(202).json(publicJob(job));
});
app.post(
  "/api/jobs/:id/recording",
  express.raw({ type: ["video/mp4", "video/webm"], limit: "30mb" }),
  (req, res) => {
    const job = getJob(req.params.id, res.locals.owner);
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      throw new AppError(400, "Upload an MP4 or WebM recording up to 30 MB.");
    if (!ffmpegAvailable)
      throw new AppError(
        409,
        "FFmpeg is required to validate and render recordings.",
      );
    const total = [...media.values()].reduce(
      (n, a) =>
        n +
        (a.recording?.length || 0) +
        (a.narration?.length || 0) +
        (a.video?.length || 0),
      0,
    );
    if (total + req.body.length > 200_000_000)
      throw new AppError(
        429,
        "Local media capacity reached. Delete an old job.",
      );
    const bytes: Buffer = req.body;
    operation(job, "recording", async () => {
      await validateRecording(bytes);
      const assets = media.get(job.id) || {};
      capacity(bytes, assets.recording);
      assets.recording = bytes;
      delete assets.video;
      media.set(job.id, assets);
      job.phases.render = { state: "idle" };
      job.artifacts = job.artifacts.filter(
        (a) => !["recording", "video"].includes(a.type),
      );
      job.artifacts.push({
        type: "recording",
        url: `/api/jobs/${job.id}/assets/recording`,
        provenance:
          "User-supplied recording. Not captured or interaction-verified by Sudo Launch.",
      });
    });
    res.status(202).json(publicJob(job));
  },
);
app.post("/api/jobs/:id/narrate", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = z
    .object({ text: z.string().min(10).max(600), approved: z.literal(true) })
    .strict()
    .parse(req.body);
  if (!job.positioning)
    throw new AppError(
      409,
      "Generate and review a storyboard/narration first.",
    );
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID)
    throw new AppError(409, "Configure ElevenLabs locally before narration.");
  operation(job, "narrate", async () => {
    const audio = await narrate(input.text);
    const assets = media.get(job.id) || {};
    capacity(audio, assets.narration);
    assets.narration = audio;
    delete assets.video;
    media.set(job.id, assets);
    job.phases.render = { state: "idle" };
    job.artifacts = job.artifacts.filter(
      (a) => !["narration", "video"].includes(a.type),
    );
    job.artifacts.push({
      type: "narration",
      url: `/api/jobs/${job.id}/assets/narration`,
      provenance:
        "ElevenLabs speech from user-approved narration. Uses configured voice; no voice cloning.",
    });
  });
  res.status(202).json(publicJob(job));
});
app.post("/api/jobs/:id/render", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = z
    .object({ useNarration: z.boolean() })
    .strict()
    .parse(req.body);
  const assets = media.get(job.id);
  if (!assets?.recording)
    throw new AppError(409, "Upload a real recording first.");
  if (input.useNarration && !assets.narration)
    throw new AppError(
      409,
      "Generate narration first or choose silent rendering.",
    );
  operation(job, "render", async () => {
    const rendered = await render(
      assets.recording!,
      input.useNarration ? assets.narration : undefined,
    );
    capacity(rendered, assets.video);
    assets.video = rendered;
    job.artifacts = job.artifacts.filter((a) => a.type !== "video");
    job.artifacts.push({
      type: "video",
      url: `/api/jobs/${job.id}/assets/video`,
      provenance: `FFmpeg render from user-supplied recording${input.useNarration ? " with ElevenLabs narration" : " without audio"}. No automatic runtime interaction verification.`,
    });
  });
  res.status(202).json(publicJob(job));
});
app.get("/api/jobs/:id/assets/:type", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const type = z
    .enum(["recording", "narration", "video"])
    .parse(req.params.type);
  const bytes = media.get(job.id)?.[type];
  if (!bytes) throw new AppError(404, "Asset not found.");
  res.type(
    type === "narration"
      ? "audio/mpeg"
      : type === "video"
        ? "video/mp4"
        : "application/octet-stream",
  );
  res.setHeader(
    "Content-Disposition",
    `${type === "recording" ? "attachment" : "inline"}; filename="sudo-${type}.${type === "narration" ? "mp3" : type === "video" ? "mp4" : "media"}"`,
  );
  res.send(bytes);
});
app.get("/api/jobs/:id/receipt", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="sudo-launch-receipt.json"',
  );
  res.json({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    job: publicJob(job),
    actualExecution: {
      sourceInspected: !!job.inspection,
      sourceRevision: job.inspection?.revision || null,
      builtRevision: null,
      model: job.positioning
        ? { provider: job.positioning.provider, id: job.positioning.model }
        : null,
      deploymentExecuted: false,
      research: job.research?.coverage || "Not run",
      httpCheck: job.site || null,
      interactionVerified: false,
      automaticCapture: false,
    },
    limitations: [
      "Local in-memory job expires after one hour and is lost on server restart.",
      "Source evidence and HTTP reachability are not proof of product interactions.",
      "Guided deployment cannot establish built revision.",
      "Recordings, if present, are supplied by the user.",
    ],
  });
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);
app.use(
  express.static(join(dirname(fileURLToPath(import.meta.url)), "../dist")),
);
app.get("/{*path}", (_req, res) =>
  res.sendFile(
    join(dirname(fileURLToPath(import.meta.url)), "../dist/index.html"),
  ),
);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res
      .status(
        error instanceof AppError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500,
      )
      .json({
        error:
          error instanceof z.ZodError
            ? "Request does not match the permitted input schema."
            : safeError(error),
      });
  },
);
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs)
    if (Date.parse(job.expiresAt) < now && !busy.has(id)) {
      jobs.delete(id);
      media.delete(id);
    }
  for (const [id, expires] of sessions)
    if (expires < now) {
      sessions.delete(id);
      attempts.delete(id);
    }
}, 60_000).unref();
app.listen(port, "127.0.0.1", () =>
  console.log(`Sudo Launch local API: http://127.0.0.1:${port}`),
);
