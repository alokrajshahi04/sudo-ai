import express from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type {
  Job,
  Phase,
  Capabilities,
  Evidence,
  ModelProvider,
} from "../shared/types";
import { AppError, safeError, redact } from "./errors";
import { LaunchStore, retentionMilliseconds, sessionOwner } from "./store";
import {
  inspect,
  parseRepo,
  github,
  discoverProfile,
  discoverConnected,
} from "./github";
import { fetchPublic, plainText } from "./network";
import {
  modelConfig,
  generatePositioning,
  defaultModelProvider,
} from "./models";
import { GitHubConnections } from "./auth";
import { analyzeProject, reviewReadiness } from "./analysis";
import { launchCalendar } from "./calendar";
import { captureSite, captureSchema, captureAvailable } from "./capture";
import { makeStoryboard, promoAvailable, renderPromo } from "./promo";
import { registerDraftRoutes } from "./drafts";
import { registerPackRoutes, jobReceipt } from "./launch-pack";
import { currentDrafts, selectedCopy } from "../shared/launch-copy";
import { hostingConfig, demoAccess } from "./hosting";
import {
  validateRecording,
  narrateWithAlignment,
  validateScreenshot,
  composeMusic,
  render,
  execute,
} from "./media";

const app = express();
app.disable("x-powered-by");
const hosting = hostingConfig();
const port = Number(process.env.PORT || 3001);
const connections = new GitHubConnections();
const retention = retentionMilliseconds();
const store = new LaunchStore();
const { sessions, jobs, media } = store.restore();
// OAuth needs to restore the original browser cookie, but cookie secrets are never persisted.
const oauthSessions = new Map<string, { token: string; expires: number }>();
const busy = new Set<string>();
const attempts = new Map<string, { time: number; count: number }>();
let ffmpegAvailable = false;
let chromiumAvailable = false;
let recorderAvailable = false;
const mediaSetup = Promise.allSettled([
  captureAvailable().then((available) => {
    recorderAvailable = available;
  }),
  promoAvailable().then((available) => {
    chromiumAvailable = available;
  }),
  execute("ffmpeg", ["-version"], 5000).then(() => {
    ffmpegAvailable = true;
  }),
]);
const origins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);
if (hosting.publicOrigin) origins.add(hosting.publicOrigin);
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
if (hosting.publicOrigin)
  app.use(
    demoAccess(
      process.env.SUDO_DEMO_USERNAME!,
      process.env.SUDO_DEMO_PASSWORD!,
    ),
  );
app.use((req, res, next) => {
  const host = req.headers.host || "";
  if (
    !/^(?:localhost|127\.0\.0\.1):\d+$/.test(host) &&
    host !== (hosting.publicOrigin && new URL(hosting.publicOrigin).host)
  )
    return res.status(403).json({
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
  // OAuth's cross-site callback uses its own Lax nonce cookie. Strict application
  // sessions are restored only after state, nonce, PKCE and identity verification.
  if (req.path === "/api/auth/github/callback") return next();
  let session = cookies.sudo_session;
  let owner =
    session && /^[a-f0-9]{64}$/.test(session) ? sessionOwner(session) : "";
  if (!session || !sessions.has(owner) || sessions.get(owner)! <= Date.now()) {
    cleanupExpired();
    if (sessions.size >= 100)
      return res.status(429).json({ error: "Local session limit reached." });
    session = randomBytes(32).toString("hex");
    owner = sessionOwner(session);
  }
  // Renew occasionally instead of writing SQLite and resetting the cookie on every poll.
  // Existing OAuth-start requests keep their nonce cookie as the only Set-Cookie header.
  if ((sessions.get(owner) || 0) < Date.now() + retention * 0.75) {
    res.cookie("sudo_session", session, {
      httpOnly: true,
      secure: hosting.secureCookies,
      sameSite: "strict",
      maxAge: retention,
      path: "/",
    });
    const expires = Date.now() + retention;
    sessions.set(owner, expires);
    store.saveSession(owner, expires);
  }
  res.locals.owner = owner;
  res.locals.sessionToken = session;
  // Synchronous route mutations (including future draft/pack routers) are durable
  // before their JSON response. Long-running operations additionally save on start/end.
  const sendJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      for (const job of jobs.values()) if (job.owner === owner) persistJob(job);
    }
    return sendJson(body);
  }) as typeof res.json;
  if (req.path.startsWith("/api/") && req.method !== "GET") {
    const previous = attempts.get(owner);
    const bucket =
      previous && Date.now() - previous.time < 60_000
        ? previous
        : { time: Date.now(), count: 0 };
    bucket.count++;
    attempts.set(owner, bucket);
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
export function persistJob(job: Job) {
  const owned = jobs.get(job.id);
  // Expiry/deletion during a worker must not recreate a deleted job or its assets.
  if (owned && sessions.has(owned.owner))
    store.saveJob(owned, media.get(job.id) || {});
}
export function persistMedia(jobId: string) {
  const job = jobs.get(jobId);
  if (job) persistJob(job);
}
function deleteJob(id: string) {
  store.deleteJob(id);
  jobs.delete(id);
  media.delete(id);
}
function publicJob(job: Job & { owner: string }): Job {
  persistJob(job);
  const { owner, ...data } = job;
  return data;
}
function operation(job: Job, phase: Phase, work: () => Promise<void>) {
  if (busy.has(job.id))
    throw new AppError(409, "This job is already running an operation.");
  if (busy.size >= (hosting.publicOrigin ? 1 : 3))
    throw new AppError(
      429,
      "Worker limit reached. Retry after the current job finishes.",
    );
  busy.add(job.id);
  job.phases[phase] = { state: "running" };
  persistJob(job);
  void work()
    .then(() => {
      job.phases[phase] = { state: "completed" };
    })
    .catch((e) => {
      job.phases[phase] = { state: "failed", error: safeError(e) };
    })
    .finally(() => {
      busy.delete(job.id);
      if (jobs.has(job.id)) persistJob(job);
      else media.delete(job.id);
    })
    .catch(() =>
      console.error(
        "Local launch storage could not save an operation. Check disk space and permissions.",
      ),
    );
}
function capacity(bytes: Buffer, replaced?: Buffer) {
  const total = [...media.values()].reduce(
    (n, a) =>
      n +
      Object.values(a).reduce(
        (bytes, asset) => bytes + (asset?.length || 0),
        0,
      ),
    0,
  );
  if (total + bytes.length - (replaced?.length || 0) > 200_000_000)
    throw new AppError(429, "Local media capacity reached. Delete an old job.");
}
function clearGenerated(job: Job) {
  job.positioning = undefined;
  job.launchStrategy = undefined;
  job.phases.position = { state: "idle" };
  job.phases.narrate = { state: "idle" };
  job.phases.render = { state: "idle" };
  job.phases.music = { state: "idle" };
  job.storyboard = undefined;
  job.narrationScript = undefined;
  job.captions = undefined;
  job.drafts = undefined;
  clearCarousel(job);
  const assets = media.get(job.id);
  if (assets) {
    delete assets.narration;
    delete assets.video;
    delete assets.music;
    delete assets.poster;
    delete assets.captions;
  }
  job.artifacts = job.artifacts.filter((a) =>
    ["recording", "screenshot"].includes(a.type),
  );
}
function clearCarousel(job: Job) {
  job.carousel = undefined;
  job.phases.carousel = { state: "idle" };
  const assets = media.get(job.id);
  if (assets)
    for (const type of [
      "carousel-1",
      "carousel-2",
      "carousel-3",
      "carousel-4",
      "carousel-5",
    ] as const)
      delete assets[type];
  job.artifacts = job.artifacts.filter((a) => !a.type.startsWith("carousel-"));
}
function clearNarration(job: Job) {
  job.narrationScript = undefined;
  job.captions = undefined;
  job.phases.narrate = { state: "idle" };
  job.phases.render = { state: "idle" };
  const assets = media.get(job.id);
  if (assets)
    for (const type of ["narration", "captions", "video", "poster"] as const)
      delete assets[type];
  job.artifacts = job.artifacts.filter(
    (a) => !["narration", "captions", "video", "poster"].includes(a.type),
  );
}
app.get("/api/capabilities", (_req, res) => {
  const providers: ModelProvider[] = ["google", "nebius", "custom"];
  const capabilities: Capabilities = {
    mode: hosting.publicOrigin ? "hosted-demo" : "local",
    defaultModelProvider: defaultModelProvider(),
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
    promo: ffmpegAvailable && chromiumAvailable,
    capture: ffmpegAvailable && recorderAvailable,
    carousel: chromiumAvailable,
    storage: { kind: "sqlite", retentionDays: retention / 86_400_000 },
    music: !!process.env.ELEVENLABS_API_KEY,
    githubAuth: {
      configured: !!(
        process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ),
      localTokenAvailable: !!process.env.GITHUB_TOKEN,
      ...connections.status(res.locals.owner),
    },
    hostedCredentialEntry: false,
    research:
      "Bounded public GitHub search and supplied public links. Agent-Reach integration pending.",
  };
  res.json(capabilities);
});
app.get("/api/auth/github/status", (_req, res) =>
  res.json(connections.status(res.locals.owner)),
);
app.post("/api/auth/github/start", (req, res) => {
  z.object({}).strict().parse(req.body);
  const callback = `${req.headers.origin}/api/auth/github/callback`;
  const started = connections.begin(res.locals.owner, callback);
  oauthSessions.set(res.locals.owner, {
    token: res.locals.sessionToken,
    expires: Date.now() + 600_000,
  });
  res.cookie("sudo_oauth", started.nonce, {
    httpOnly: true,
    secure: hosting.secureCookies,
    sameSite: "lax",
    maxAge: 600_000,
    path: "/api/auth/github/callback",
  });
  res.json({ url: started.url });
});
app.get("/api/auth/github/callback", async (req, res) => {
  const cookie =
    (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("sudo_oauth="))
      ?.slice("sudo_oauth=".length) || "";
  res.clearCookie("sudo_oauth", {
    secure: hosting.secureCookies,
    path: "/api/auth/github/callback",
    sameSite: "lax",
    httpOnly: true,
  });
  try {
    const input = z
      .object({ state: z.string().length(64), code: z.string().max(500) })
      .parse(req.query);
    const owner = await connections.finish(
      input.state,
      cookie,
      input.code,
      (id) => !!sessions.get(id) && sessions.get(id)! > Date.now(),
    );
    const originalSession = oauthSessions.get(owner);
    oauthSessions.delete(owner);
    if (!originalSession || originalSession.expires <= Date.now())
      throw new AppError(
        400,
        "GitHub sign-in expired. Start again from this browser.",
      );
    res.cookie("sudo_session", originalSession.token, {
      httpOnly: true,
      secure: hosting.secureCookies,
      sameSite: "strict",
      maxAge: retention,
      path: "/",
    });
    res.redirect("/?github=connected");
  } catch {
    res.redirect("/?github=failed");
  }
});
app.post("/api/auth/github/local", async (req, res) => {
  z.object({}).strict().parse(req.body);
  if (!process.env.GITHUB_TOKEN)
    throw new AppError(
      409,
      "Configure a read-only local GITHUB_TOKEN in .env first.",
    );
  await connections.connect(res.locals.owner, process.env.GITHUB_TOKEN);
  res.json(connections.status(res.locals.owner));
});
app.post("/api/auth/github/disconnect", (req, res) => {
  z.object({}).strict().parse(req.body);
  if (
    [...jobs.values()].some(
      (job) => job.owner === res.locals.owner && busy.has(job.id),
    )
  )
    throw new AppError(
      409,
      "Wait for running operations before disconnecting.",
    );
  connections.disconnect(res.locals.owner);
  // Remove already-read private source and artifacts from this local session too.
  for (const [id, job] of jobs)
    if (job.owner === res.locals.owner && job.inspection?.private) {
      deleteJob(id);
    }
  res.json({ connected: false });
});
app.post("/api/discover/connected", async (req, res) => {
  z.object({}).strict().parse(req.body);
  const connection = connections.get(res.locals.owner);
  if (!connection) throw new AppError(409, "Connect GitHub first.");
  res.json(await discoverConnected(connection.token, connection.login));
});
async function readProject(job: Job & { owner: string }) {
  const inspected = await inspect(
    job.repository,
    connections.get(job.owner)?.token,
    job.privateConsent,
    (step) => {
      job.progressStep = step;
    },
  );
  if (job.inspection?.revision !== inspected.revision) {
    clearGenerated(job);
    job.analysis = undefined;
    job.site = undefined;
    job.phases.verify = { state: "idle" };
    job.phases.recording = { state: "idle" };
    job.artifacts = [];
    job.capture = undefined;
    media.delete(job.id);
  }
  job.inspection = inspected;
  job.readinessReviewedAt = undefined;
  job.progressStep = "Preparing launch context";
  job.readiness = reviewReadiness(
    job.repository,
    inspected,
    job.analysis?.findings,
  );
  if (!job.repoFirst || job.launchBrief) {
    job.progressStep = undefined;
    return;
  }
  job.phases.inspect = { state: "completed" };
  job.phases.analyze = { state: "running" };
  job.progressStep = "Suggesting audience and product brief";
  try {
    job.analysis = await analyzeProject(job, job.modelPreference);
    job.readiness = reviewReadiness(
      job.repository,
      inspected,
      job.analysis.findings,
    );
    job.phases.analyze = { state: "completed" };
  } catch (e) {
    job.phases.analyze = { state: "failed", error: safeError(e) };
  }
  job.progressStep = undefined;
}
async function checkSite(job: Job, url: string) {
  const page = await fetchPublic(url);
  const title = page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  job.site = {
    url,
    finalUrl: page.url,
    httpStatus: page.status,
    reachable: page.status >= 200 && page.status < 300,
    title: title ? redact(plainText(title)).slice(0, 200) : null,
    checkedAt: new Date().toISOString(),
    builtRevision: null,
    interaction: "not_checked",
  };
  if (!job.site.reachable)
    throw new AppError(
      422,
      `Site returned HTTP ${page.status}; reachability did not pass.`,
    );
}
const launchBriefSchema = z
  .object({
    audience: z.string().trim().min(3).max(250),
    goal: z.string().trim().min(3).max(250),
    context: z.string().trim().max(600).default(""),
  })
  .strict();
function sanitizeBrief(input: z.infer<typeof launchBriefSchema>) {
  return {
    audience: redact(input.audience),
    goal: redact(input.goal),
    context: redact(input.context),
  };
}
function briefText(input: z.infer<typeof launchBriefSchema>) {
  return `Audience: ${input.audience}\nLaunch goal: ${input.goal}${input.context ? `\nProduct context: ${input.context}` : ""}`;
}
app.post("/api/jobs", (req, res) => {
  const input = z
    .object({
      repository: z.string().max(300),
      brief: z.string().min(3).max(1200).optional(),
      privateConsent: z.boolean().default(false),
      launchBrief: launchBriefSchema.optional(),
      model: z
        .enum(["google", "nebius", "custom"])
        .default(defaultModelProvider()),
      launchMode: z.enum(["live", "prototype", "source"]).optional(),
      demoUrl: z.string().max(1000).optional(),
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
    repoFirst: !input.brief && !input.launchBrief,
    privateConsent: input.privateConsent,
    brief: input.launchBrief
      ? briefText(sanitizeBrief(input.launchBrief))
      : redact(input.brief || ""),
    launchBrief: input.launchBrief
      ? sanitizeBrief(input.launchBrief)
      : undefined,
    modelPreference: input.model,
    launchMode: input.launchMode || (input.demoUrl ? "live" : "source"),
    requestedDemoUrl: input.demoUrl,
    selectedAngle: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + retention).toISOString(),
    phases: {
      inspect: { state: "idle" },
      analyze: { state: "idle" },
      music: { state: "idle" },
      research: { state: "idle" },
      position: { state: "idle" },
      verify: { state: "idle" },
      recording: { state: "idle" },
      narrate: { state: "idle" },
      render: { state: "idle" },
      carousel: { state: "idle" },
    },
    artifacts: [],
  };
  jobs.set(job.id, job);
  operation(job, "inspect", async () => {
    await readProject(job);
    if (input.demoUrl) {
      job.progressStep = "Checking your deployed project link";
      job.phases.verify = { state: "running" };
      try {
        await checkSite(job, input.demoUrl);
        job.phases.verify = { state: "completed" };
      } catch (e) {
        job.phases.verify = { state: "failed", error: safeError(e) };
      }
      job.progressStep = undefined;
    }
  });
  res.status(202).json(publicJob(job));
});
app.get("/api/jobs", (req, res) =>
  res.json(
    [...jobs.values()]
      .filter(
        (j) =>
          j.owner === res.locals.owner && Date.parse(j.expiresAt) > Date.now(),
      )
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
  deleteJob(job.id);
  res.status(204).end();
});
app.post("/api/jobs/:id/inspect", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  operation(job, "inspect", async () => {
    await readProject(job);
  });
  res.status(202).json(publicJob(job));
});
app.post("/api/jobs/:id/analyze", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = z
    .object({ provider: z.enum(["google", "nebius", "custom"]) })
    .strict()
    .parse(req.body);
  if (!job.inspection)
    throw new AppError(409, "Complete source inspection first.");
  if (job.inspection.private && !job.privateConsent)
    throw new AppError(
      409,
      "Private source requires your approval before model analysis.",
    );
  operation(job, "analyze", async () => {
    job.readinessReviewedAt = undefined;
    job.analysis = await analyzeProject(job, input.provider);
    job.readiness = reviewReadiness(
      job.repository,
      job.inspection!,
      job.analysis.findings,
    );
    job.modelPreference = input.provider;
  });
  res.status(202).json(publicJob(job));
});
app.post("/api/jobs/:id/readiness-review", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  z.object({ acknowledged: z.literal(true) })
    .strict()
    .parse(req.body);
  if (busy.has(job.id))
    throw new AppError(409, "Wait for the current operation.");
  if (!job.readiness)
    throw new AppError(409, "Inspect your project before reviewing readiness.");
  job.readinessReviewedAt = new Date().toISOString();
  res.json(publicJob(job));
});
app.post("/api/jobs/:id/launch-mode", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = z
    .object({ mode: z.enum(["live", "prototype", "source"]) })
    .strict()
    .parse(req.body);
  if (busy.has(job.id))
    throw new AppError(409, "Wait for the current operation.");
  job.launchMode = input.mode;
  clearGenerated(job);
  res.json(publicJob(job));
});
app.post("/api/jobs/:id/brief", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  if (busy.has(job.id))
    throw new AppError(409, "Wait for the current operation.");
  const input = sanitizeBrief(launchBriefSchema.parse(req.body));
  const next = briefText(input);
  if (next !== job.brief) clearGenerated(job);
  job.launchBrief = input;
  job.brief = next;
  res.json(publicJob(job));
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
  if (!job.launchBrief)
    throw new AppError(409, "Confirm the audience and launch goal first.");
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
    job.drafts = undefined;
    clearCarousel(job);
    job.launchStrategy = undefined;
    const assets = media.get(job.id);
    if (assets) {
      delete assets.narration;
      delete assets.music;
      delete assets.video;
      delete assets.poster;
    }
    job.artifacts = job.artifacts.filter((a) =>
      ["recording", "screenshot"].includes(a.type),
    );
    job.phases.narrate = { state: "idle" };
    job.phases.music = { state: "idle" };
    job.storyboard = undefined;
    job.narrationScript = undefined;
    job.captions = undefined;
    if (assets) delete assets.captions;
    job.phases.render = { state: "idle" };
  }
  job.selectedAngle = input.index;
  res.json(publicJob(job));
});
app.post("/api/jobs/:id/strategy", (req, res) => {
  z.object({}).strict().parse(req.body);
  const job = getJob(req.params.id, res.locals.owner);
  if (busy.has(job.id))
    throw new AppError(409, "Wait for the current operation.");
  if (!job.inspection)
    throw new AppError(409, "Complete source inspection first.");
  job.launchStrategy = {
    launchType: job.site?.reachable ? "relaunch" : "showcase",
    angleTitle: job.positioning?.angles[job.selectedAngle]?.title || null,
    createdAt: new Date().toISOString(),
    channels: [
      {
        name: "LinkedIn",
        purpose:
          "Explain the problem, intended user, and one evidenced use case.",
        timing: "Launch day, after reviewing copy.",
      },
      {
        name: "X",
        purpose: "A short hook, real demo, and repository or live link.",
        timing: "Launch day; follow up with what you learned.",
      },
      {
        name: "GitHub README",
        purpose:
          "Give visitors a clear description, setup, license, and accurate feature status.",
        timing: "Before sharing the launch.",
      },
    ],
    checklist: [
      "Review the inspected features and distinguish implemented behavior from plans.",
      "Choose one audience and positioning angle.",
      "If this project needs a live site, publish it yourself with a suitable provider and runtime; Sudo Launch offers guidance only.",
      "Use an existing public URL when available, or launch a library/CLI with repository and installation instructions.",
      "Record one real interaction or usage example; do not imply automatic verification.",
      "Review captions/narration and launch posts before sharing.",
      "Share drafts manually and collect feedback; do not fabricate traction.",
    ],
  };
  res.json(publicJob(job));
});
app.post("/api/discover", async (req, res) => {
  const input = z
    .object({ username: z.string().min(1).max(39) })
    .strict()
    .parse(req.body);
  res.json(await discoverProfile(input.username));
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
    await checkSite(job, input.url);
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
    capacity(req.body, media.get(job.id)?.recording);
    const bytes: Buffer = req.body;
    operation(job, "recording", async () => {
      await validateRecording(bytes);
      const assets = media.get(job.id) || {};
      capacity(bytes, assets.recording);
      assets.recording = bytes;
      job.capture = undefined;
      delete assets.video;
      delete assets.poster;
      media.set(job.id, assets);
      job.phases.render = { state: "idle" };
      job.artifacts = job.artifacts.filter(
        (a) => !["recording", "video", "poster"].includes(a.type),
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
app.post("/api/jobs/:id/capture", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = captureSchema.parse(req.body);
  if (!job.inspection)
    throw new AppError(409, "Read the project source first.");
  if (!recorderAvailable || !ffmpegAvailable)
    throw new AppError(
      409,
      "Capture requires Chromium, system FFmpeg and Playwright's encoder. Run npm run setup:browser, or npx playwright install ffmpeg when using an existing Chromium.",
    );
  operation(job, "recording", async () => {
    try {
      const result = await captureSite(
        input,
        (step) => {
          job.progressStep = step;
        },
        undefined,
        input.automatic ? job.modelPreference : undefined,
      );
      await validateRecording(result.recording);
      const assets = media.get(job.id) || {};
      capacity(
        Buffer.concat([result.recording, result.screenshot]),
        Buffer.concat([
          assets.recording || Buffer.alloc(0),
          assets.screenshot || Buffer.alloc(0),
        ]),
      );
      assets.recording = result.recording;
      assets.screenshot = result.screenshot;
      clearCarousel(job);
      delete assets.video;
      delete assets.poster;
      media.set(job.id, assets);
      job.capture = result.capture;
      job.phases.render = { state: "idle" };
      job.artifacts = job.artifacts.filter(
        (a) => !["recording", "screenshot", "video", "poster"].includes(a.type),
      );
      for (const type of ["recording", "screenshot"] as const)
        job.artifacts.push({
          type,
          url: `/api/jobs/${job.id}/assets/${type}`,
          provenance: result.capture.coverage,
        });
    } finally {
      job.progressStep = undefined;
    }
  });
  res.status(202).json(publicJob(job));
});
app.post(
  "/api/jobs/:id/screenshot",
  express.raw({ type: ["image/png", "image/jpeg"], limit: "8mb" }),
  (req, res) => {
    const job = getJob(req.params.id, res.locals.owner);
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      throw new AppError(400, "Upload a PNG or JPEG screenshot up to 8 MB.");
    if (!ffmpegAvailable)
      throw new AppError(409, "Screenshot preparation requires FFmpeg.");
    const bytes: Buffer = req.body;
    operation(job, "recording", async () => {
      const screenshot = await validateScreenshot(bytes),
        assets = media.get(job.id) || {};
      capacity(screenshot, assets.screenshot);
      assets.screenshot = screenshot;
      clearCarousel(job);
      delete assets.video;
      delete assets.poster;
      media.set(job.id, assets);
      job.phases.render = { state: "idle" };
      job.artifacts = job.artifacts.filter(
        (a) => !["screenshot", "video", "poster"].includes(a.type),
      );
      job.artifacts.push({
        type: "screenshot",
        url: `/api/jobs/${job.id}/assets/screenshot`,
        provenance:
          "Owner-supplied screenshot; not automatic proof of runtime features.",
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
    const aligned = await narrateWithAlignment(redact(input.text));
    const audio = aligned.audio;
    const assets = media.get(job.id) || {};
    capacity(
      Buffer.concat([audio, aligned.srt]),
      Buffer.concat([
        assets.narration || Buffer.alloc(0),
        assets.captions || Buffer.alloc(0),
      ]),
    );
    assets.narration = audio;
    assets.captions = aligned.srt;
    job.narrationScript = redact(input.text);
    if (selectedCopy(job).narration !== job.narrationScript) {
      const previous = currentDrafts(job);
      job.drafts = {
        ...selectedCopy(job),
        narration: job.narrationScript,
        angleIndex: job.selectedAngle,
        positioningGeneratedAt: job.positioning!.generatedAt,
        updatedAt: new Date().toISOString(),
        reviewedAt: previous?.reviewedAt,
      };
      clearCarousel(job);
    }
    job.captions = aligned.cues;
    delete assets.video;
    delete assets.poster;
    media.set(job.id, assets);
    job.phases.render = { state: "idle" };
    job.artifacts = job.artifacts.filter(
      (a) => !["narration", "captions", "video", "poster"].includes(a.type),
    );
    job.artifacts.push({
      type: "captions",
      url: `/api/jobs/${job.id}/assets/captions`,
      provenance:
        "SRT aligned to the approved narration using ElevenLabs character timestamps.",
    });
    job.artifacts.push({
      type: "narration",
      url: `/api/jobs/${job.id}/assets/narration`,
      provenance:
        "ElevenLabs speech from user-approved narration. Uses configured voice; no voice cloning.",
    });
  });
  res.status(202).json(publicJob(job));
});
app.post("/api/jobs/:id/music", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = z
    .object({
      prompt: z.string().trim().min(10).max(500),
      approved: z.literal(true),
    })
    .strict()
    .parse(req.body);
  if (!job.positioning) throw new AppError(409, "Choose a launch story first.");
  if (!process.env.ELEVENLABS_API_KEY)
    throw new AppError(409, "Configure ElevenLabs before generating music.");
  operation(job, "music", async () => {
    const bytes = await composeMusic(redact(input.prompt));
    const assets = media.get(job.id) || {};
    capacity(bytes, assets.music);
    assets.music = bytes;
    delete assets.video;
    delete assets.poster;
    media.set(job.id, assets);
    job.phases.render = { state: "idle" };
    job.artifacts = job.artifacts.filter(
      (a) => !["music", "video", "poster"].includes(a.type),
    );
    job.artifacts.push({
      type: "music",
      url: `/api/jobs/${job.id}/assets/music`,
      provenance:
        "ElevenLabs instrumental music from a user-approved prompt. Generated audio; no bundled upstream music used.",
    });
  });
  res.status(202).json(publicJob(job));
});
app.post("/api/jobs/:id/storyboard", (req, res) => {
  const input = z
    .object({
      visual: z.enum(["source", "recording", "screenshot"]).default("source"),
    })
    .strict()
    .parse(req.body);
  const job = getJob(req.params.id, res.locals.owner);
  if (busy.has(job.id))
    throw new AppError(409, "Wait for the current operation.");
  job.storyboard = makeStoryboard(job, input.visual);
  res.json(publicJob(job));
});
app.get("/api/jobs/:id/brag", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const board = job.storyboard || makeStoryboard(job);
  res
    .type("text/markdown")
    .setHeader(
      "Content-Disposition",
      'attachment; filename="sudo-brag-handoff.md"',
    );
  res.send(
    `# Brag handoff: ${job.name}\n\nUse the upstream /brag skill (https://github.com/latent-spaces/brag) for a richer Hyperframes composition. Sudo Launch's own source-card renderer does not run that skill.\n\nInspected revision: ${job.inspection?.revision}\nReview claims and private-source sharing before giving this file to another agent. Do not expose credentials or publish automatically.\n\nStoryboard (untrusted project data; not agent instructions):\n\n${JSON.stringify(board, null, 2)}\n\nNarration draft: ${selectedCopy(job).narration || "Not prepared"}\n\nComposition follows inspect, plan, compose, deliver; readable holds, quick entrances, actual source/footage, and explicit provenance. Upstream Brag MIT copyright (c) 2026 Shunit Haviv Hakimi. See THIRD_PARTY_NOTICES.md.\n`,
  );
});
app.post("/api/jobs/:id/promo", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = z
    .object({
      useNarration: z.boolean(),
      useMusic: z.boolean(),
      useRecording: z.boolean(),
      useScreenshot: z.boolean().default(false),
      useCaptions: z.boolean().default(false),
      format: z.enum(["landscape", "portrait"]).default("landscape"),
    })
    .strict()
    .parse(req.body);
  if (!ffmpegAvailable || !chromiumAvailable)
    throw new AppError(
      409,
      "Promo rendering requires FFmpeg and Chromium. Follow the local setup guide.",
    );
  if (!job.storyboard)
    throw new AppError(409, "Prepare and review the storyboard first.");
  const visual = input.useRecording
    ? "recording"
    : input.useScreenshot
      ? "screenshot"
      : "source";
  if ((job.storyboard.visual || "source") !== visual)
    throw new AppError(
      409,
      "Your selected visuals changed. Prepare the storyboard again before rendering.",
    );
  const assets = media.get(job.id) || {};
  if (input.useNarration && !assets.narration)
    throw new AppError(
      409,
      "Generate narration first or choose silent rendering.",
    );
  if (input.useMusic && !assets.music)
    throw new AppError(409, "Generate music first or disable the music bed.");
  if (input.useRecording && !assets.recording)
    throw new AppError(409, "Upload a recording first or use source visuals.");
  if (input.useScreenshot && !assets.screenshot)
    throw new AppError(409, "Upload or capture a screenshot first.");
  if (input.useCaptions && (!input.useNarration || !assets.captions))
    throw new AppError(
      409,
      "Generate aligned narration before enabling captions.",
    );
  operation(job, "render", async () => {
    try {
      const result = await renderPromo(
        job.storyboard!,
        job.name,
        {
          narration: input.useNarration ? assets.narration : undefined,
          music: input.useMusic ? assets.music : undefined,
          recording: input.useRecording ? assets.recording : undefined,
          recordingTail: input.useRecording && !!job.capture,
          screenshot: input.useScreenshot ? assets.screenshot : undefined,
          captions: input.useCaptions ? assets.captions : undefined,
          captionCues: input.useCaptions ? job.captions : undefined,
          format: input.format,
        },
        (step) => {
          job.progressStep = step;
        },
      );
      capacity(
        Buffer.concat([result.video, result.poster]),
        Buffer.concat([
          assets.video || Buffer.alloc(0),
          assets.poster || Buffer.alloc(0),
        ]),
      );
      assets.video = result.video;
      assets.poster = result.poster;
      media.set(job.id, assets);
      job.artifacts = job.artifacts.filter(
        (a) => !["video", "poster"].includes(a.type),
      );
      const provenance = `Brag-inspired storyboard; Chromium + FFmpeg composition. ${input.useRecording ? "Real recording in the middle scene" : input.useScreenshot ? "Owner-supplied or captured screenshot" : "Branded product explainer; no runtime footage"}. ${input.useNarration ? "ElevenLabs narration. " : ""}${input.useMusic ? "ElevenLabs music. " : ""}Not an interaction verification.`;
      for (const type of ["video", "poster"] as const)
        job.artifacts.push({
          type,
          url: `/api/jobs/${job.id}/assets/${type}`,
          provenance,
        });
    } finally {
      job.progressStep = undefined;
    }
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
    delete assets.poster;
    job.storyboard = undefined;
    job.artifacts = job.artifacts.filter(
      (a) => !["video", "poster"].includes(a.type),
    );
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
    .enum([
      "recording",
      "narration",
      "music",
      "video",
      "poster",
      "screenshot",
      "captions",
      "carousel-1",
      "carousel-2",
      "carousel-3",
      "carousel-4",
      "carousel-5",
    ])
    .parse(req.params.type);
  const bytes = media.get(job.id)?.[type];
  if (!bytes) throw new AppError(404, "Asset not found.");
  res.type(
    type === "captions"
      ? "application/x-subrip"
      : type === "screenshot" || type.startsWith("carousel-")
        ? "image/png"
        : type === "narration" || type === "music"
          ? "audio/mpeg"
          : type === "video"
            ? "video/mp4"
            : type === "poster"
              ? "image/png"
              : "application/octet-stream",
  );
  res.setHeader(
    "Content-Disposition",
    `${type === "recording" ? "attachment" : "inline"}; filename="sudo-${type}.${type === "narration" || type === "music" ? "mp3" : type === "video" ? "mp4" : type === "poster" || type === "screenshot" || type.startsWith("carousel-") ? "png" : type === "captions" ? "srt" : "media"}"`,
  );
  res.setHeader("Accept-Ranges", "bytes");
  if (req.headers.range) {
    const ranges = req.range(bytes.length);
    if (
      !Array.isArray(ranges) ||
      ranges.type !== "bytes" ||
      ranges.length !== 1
    ) {
      res.status(416).setHeader("Content-Range", `bytes */${bytes.length}`);
      res.end();
      return;
    }
    const { start, end } = ranges[0];
    res
      .status(206)
      .setHeader("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
    res.send(bytes.subarray(start, end + 1));
    return;
  }
  res.send(bytes);
});
app.get("/api/jobs/:id/calendar", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  const input = z
    .object({ start: z.string().datetime() })
    .strict()
    .parse(req.query);
  res
    .type("text/calendar")
    .setHeader(
      "Content-Disposition",
      'attachment; filename="sudo-launch-calendar.ics"',
    );
  res.send(launchCalendar(job, new Date(input.start)));
});
app.get("/api/jobs/:id/receipt", (req, res) => {
  const job = getJob(req.params.id, res.locals.owner);
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="sudo-launch-receipt.json"',
  );
  res.json(jobReceipt(publicJob(job)));
});
registerDraftRoutes(app, {
  getJob,
  saveJob: persistJob,
  isBusy: (id) => busy.has(id),
  onNarrationChanged: clearNarration,
  onDraftsChanged: clearCarousel,
});
registerPackRoutes(app, {
  getJob,
  publicJob: (job) => publicJob(job as Job & { owner: string }),
  getMedia: (id) => media.get(id),
  saveMedia: (id, assets) => {
    media.set(id, assets);
  },
  persist: persistJob,
  operation,
  capacity,
  isBusy: (id) => busy.has(id),
  carouselAvailable: () => chromiumAvailable,
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
function cleanupExpired() {
  const now = Date.now();
  connections.cleanup();
  for (const [id, job] of jobs)
    if (Date.parse(job.expiresAt) < now && !busy.has(id)) {
      deleteJob(id);
    }
  for (const [id, expires] of sessions)
    if (expires < now) {
      connections.disconnect(id);
      sessions.delete(id);
      attempts.delete(id);
      oauthSessions.delete(id);
      store.deleteSession(id);
      for (const [jobId, job] of jobs)
        if (job.owner === id) {
          jobs.delete(jobId);
          media.delete(jobId);
        }
    }
  for (const [owner, entry] of oauthSessions)
    if (entry.expires <= now) oauthSessions.delete(owner);
}
setInterval(cleanupExpired, 60_000).unref();
await mediaSetup;
app.listen(port, hosting.bind, () =>
  console.log(
    hosting.publicOrigin
      ? `Sudo Launch demo: ${hosting.publicOrigin}`
      : `Sudo Launch local API: http://127.0.0.1:${port}`,
  ),
);
