import test from "node:test";
import assert from "node:assert/strict";
import { GitHubConnections } from "../server/auth";
import { validateAnalysis, reviewReadiness } from "../server/analysis";
import { inspect } from "../server/github";
import { redact } from "../server/errors";
import { makeStoryboard, sceneSvg, renderPromo } from "../server/promo";
import { projectFiles } from "./fixtures/projects";
import type { Job } from "../shared/types";
import { spawnSync } from "node:child_process";

function sourceInspection() {
  return {
    revision: "a".repeat(40),
    branch: "main",
    profile: "static_vite" as const,
    buildCommand: "npm run build",
    outputDirectory: "dist",
    files: Object.keys(projectFiles.app),
    treePaths: Object.keys(projectFiles.app),
    blockers: [],
    warnings: [],
    homepage: null,
    description: "A tiny student tool",
    evidence: Object.entries(projectFiles.app).map(([title, excerpt], i) => ({
      id: `source-${i + 1}`,
      kind: "source" as const,
      title,
      excerpt,
      url: "https://github.com/fixture/app/blob/main/" + title,
      checkedAt: new Date().toISOString(),
    })),
  };
}
test("analysis rejects invented evidence and action fields; readiness is bounded and portable", () => {
  const result = {
    summary: "A student tool",
    suggestedBrief: {
      audience: "Students",
      goal: "Find testers",
      context: "Prototype",
    },
    assumptions: ["Confirm audience"],
    evidenceIds: ["source-1"],
    findings: [],
  };
  assert.deepEqual(validateAnalysis(result, new Set(["source-1"])), result);
  assert.throws(() =>
    validateAnalysis(
      { ...result, evidenceIds: ["made-up"] },
      new Set(["source-1"]),
    ),
  );
  assert.throws(() =>
    validateAnalysis({ ...result, command: "deploy" }, new Set(["source-1"])),
  );
  for (const [name, files] of Object.entries(projectFiles)) {
    const inspection = {
      ...sourceInspection(),
      files: Object.keys(files),
      treePaths: Object.keys(files),
      evidence: Object.entries(files).map(([title, excerpt], i) => ({
        id: `source-${i + 1}`,
        kind: "source" as const,
        title,
        excerpt,
        url: "https://github.com/fixture/" + name,
        checkedAt: new Date().toISOString(),
      })),
    };
    const review = reviewReadiness(
      "https://github.com/fixture/" + name,
      inspection,
    );
    assert.ok(review.findings.some((f) => f.id === "runtime"));
    assert.ok(review.agentPrompt.includes(inspection.revision));
    assert.ok(review.agentPrompt.includes("Confirm each finding"));
    assert.ok(
      review.findings.every((f) =>
        f.evidenceIds.every((id) =>
          inspection.evidence.some((e) => e.id === id),
        ),
      ),
    );
  }
});
test("redacts AQ and ElevenLabs formats and exact configured secrets", () => {
  assert.ok(!redact("AQ." + "a".repeat(40)).includes("a".repeat(40)));
  assert.ok(!redact("sk_" + "z".repeat(40)).includes("z".repeat(40)));
});
test("OAuth binds state + PKCE + nonce to the original session and never returns tokens", async () => {
  const oldFetch = globalThis.fetch;
  const oldId = process.env.GITHUB_CLIENT_ID,
    oldSecret = process.env.GITHUB_CLIENT_SECRET;
  process.env.GITHUB_CLIENT_ID = "fixture-client";
  process.env.GITHUB_CLIENT_SECRET = "fixture-secret";
  let exchanged = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("access_token")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.client_secret, "fixture-secret");
      assert.ok(body.code_verifier.length >= 43);
      exchanged++;
      return new Response(
        JSON.stringify({ access_token: "private-fixture-token" }),
      );
    }
    assert.equal(String(input), "https://api.github.com/user");
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer private-fixture-token",
    );
    return new Response(JSON.stringify({ login: "fixture-user" }));
  };
  try {
    const auth = new GitHubConnections();
    const started = auth.begin(
      "owner-a",
      "http://localhost:5173/api/auth/github/callback",
    );
    const url = new URL(started.url),
      state = url.searchParams.get("state")!;
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.ok(url.searchParams.get("code_challenge")!.length >= 43);
    await assert.rejects(
      auth.finish(state, "wrong-cookie", "code", () => true),
    );
    await assert.rejects(
      auth.finish(state, started.nonce, "code", () => false),
    );
    assert.equal(exchanged, 0);
    assert.equal(
      await auth.finish(
        state,
        started.nonce,
        "code",
        (owner) => owner === "owner-a",
      ),
      "owner-a",
    );
    assert.deepEqual(auth.status("owner-a"), {
      connected: true,
      login: "fixture-user",
    });
    assert.equal(auth.get("owner-b"), undefined);
    assert.ok(!JSON.stringify(auth.status("owner-a")).includes("token"));
    await assert.rejects(auth.finish(state, started.nonce, "code", () => true));
    auth.disconnect("owner-a");
    assert.equal(auth.get("owner-a"), undefined);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldId === undefined) delete process.env.GITHUB_CLIENT_ID;
    else process.env.GITHUB_CLIENT_ID = oldId;
    if (oldSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
    else process.env.GITHUB_CLIENT_SECRET = oldSecret;
  }
});
test("private source requires consent and an explicit session token; secret files stay excluded", async () => {
  const oldFetch = globalThis.fetch;
  const files = {
    "README.md": "A private tool",
    "src/App.tsx": "export default function App(){return 'hi'}",
    ".env": "SUPER_PRIVATE_SECRET=should-never-read",
    "src/lib/secrets.ts": "also-never-read",
  };
  const reads: string[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer owner-token",
    );
    const url = String(input);
    let data: unknown;
    if (url.includes("/commits/")) data = { sha: "a".repeat(40) };
    else if (url.includes("/git/trees/"))
      data = {
        tree: Object.entries(files).map(([path, content]) => ({
          path,
          size: content.length,
          type: "blob",
        })),
        truncated: false,
      };
    else if (url.includes("/contents/")) {
      const path = url.split("/contents/")[1].split("?")[0];
      reads.push(path);
      data = {
        type: "file",
        encoding: "base64",
        content: Buffer.from(files[path as keyof typeof files]).toString(
          "base64",
        ),
      };
    } else
      data = {
        private: true,
        default_branch: "main",
        description: "Private description",
      };
    return new Response(JSON.stringify(data));
  };
  try {
    await assert.rejects(
      inspect("https://github.com/fixture/private", "owner-token", false),
    );
    assert.equal(reads.length, 0);
    const result = await inspect(
      "https://github.com/fixture/private",
      "owner-token",
      true,
    );
    assert.equal(result.private, true);
    assert.ok(
      !reads.some((path) => path.includes(".env") || path.includes("secrets")),
    );
    assert.ok(!JSON.stringify(result).includes("should-never-read"));
  } finally {
    globalThis.fetch = oldFetch;
  }
});
test("source storyboard escapes hostile markup and renders a real MP4 + poster", async (t) => {
  const inspection = sourceInspection();
  inspection.evidence[0].excerpt = "<script>fetch('https://bad.test')</script>";
  const job = {
    name: "fixture",
    repository: "https://github.com/fixture/app",
    inspection,
    selectedAngle: 0,
    launchBrief: { audience: "Students", goal: "Find testers", context: "" },
    positioning: {
      angles: [
        {
          title: "A small student tool",
          audience: "Students",
          narration: "A tool",
          evidenceIds: ["source-1"],
        },
      ],
    },
  } as unknown as Job;
  const board = makeStoryboard(job);
  assert.equal(
    board.scenes.reduce((n, s) => n + s.seconds, 0),
    25,
  );
  assert.ok(!sceneSvg(board, 2, "<script>evil</script>").includes("<script>"));
  assert.ok(sceneSvg(board, 2, "fixture").includes("NOT A RUNTIME CAPTURE"));
  if (spawnSync("ffmpeg", ["-version"]).status !== 0) {
    t.skip("FFmpeg unavailable");
    return;
  }
  const { promoAvailable } = await import("../server/promo");
  if (!(await promoAvailable())) {
    t.skip("Chromium unavailable; run npm run setup:browser");
    return;
  }
  const result = await renderPromo(
    {
      ...board,
      duration: 4,
      scenes: board.scenes.map((s) => ({ ...s, seconds: 1 })),
    },
    job.name,
    {},
  );
  assert.equal(result.video.subarray(4, 8).toString(), "ftyp");
  assert.equal(result.poster.subarray(1, 4).toString(), "PNG");
  assert.ok(result.video.length > 10_000);
});
