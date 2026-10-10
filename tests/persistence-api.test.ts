import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("same browser resumes jobs and media after an API restart; other owners and deleted jobs cannot resume them", { timeout: 45000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "sudo-api-restart-"));
  const path = join(directory, "memory.sqlite"), port = 3310, base = `http://127.0.0.1:${port}`;
  let child: ChildProcess | undefined;
  async function start() {
    child = spawn(process.execPath, ["--import", "tsx", "tests/fixtures/api-runner.ts"], {
      env: { ...process.env, PORT: String(port), SUDO_DB_PATH: path, SUDO_RETENTION_DAYS: "7", GOOGLE_API_KEY: "", NEBIUS_API_KEY: "", CUSTOM_MODEL_API_KEY: "", ELEVENLABS_API_KEY: "", GITHUB_TOKEN: "fixture-private-token", GITHUB_CLIENT_SECRET: "fixture-oauth-secret" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Restart fixture did not start")), 15000);
      child!.stdout!.on("data", chunk => { if (chunk.toString().includes("Sudo Launch local API")) { clearTimeout(timer); resolve(); } });
      child!.once("exit", () => { clearTimeout(timer); reject(new Error("Restart fixture exited before startup")); });
    });
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const active = child;
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => { active.kill("SIGKILL"); resolve(); }, 3000);
      active.once("exit", () => { clearTimeout(timer); resolve(); });
      active.kill("SIGTERM");
    });
    child = undefined;
  }
  try {
    await start();
    const setup = await fetch(base + "/api/capabilities");
    const cookie = setup.headers.getSetCookie().find(c => c.startsWith("sudo_session="))!.split(";")[0];
    assert.match(setup.headers.getSetCookie()[0], /Max-Age=604800/);
    const headers = { Cookie: cookie, Origin: base, "Content-Type": "application/json" };
    const post = (url: string, body: unknown) => fetch(base + url, { method: "POST", headers, body: JSON.stringify(body) });
    let job = await (await post("/api/jobs", { repository: "https://github.com/fixture/app", launchBrief: { audience: "Students", goal: "Find testers", context: "A prototype" }, launchMode: "prototype" })).json();
    const root = "/api/jobs/" + job.id;
    async function poll() {
      for (let i = 0; i < 100; i++) {
        job = await (await fetch(base + root, { headers: { Cookie: cookie } })).json();
        if (!Object.values(job.phases).some((phase: any) => phase.state === "running")) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error("Restart fixture operation timed out");
    }
    await poll();
    assert.equal((await post(root + "/readiness-review", { acknowledged: true })).status, 200);
    assert.equal((await post("/api/auth/github/local", {})).status, 200);
    const privateJob = await (await post("/api/jobs", { repository: "https://github.com/fixture-user/private", privateConsent: true, launchBrief: { audience: "Students", goal: "Find testers", context: "Private prototype" } })).json();
    for (let i = 0; i < 100; i++) {
      const status = await (await fetch(base + "/api/jobs/" + privateJob.id, { headers: { Cookie: cookie } })).json();
      if (status.phases.inspect.state !== "running") { assert.equal(status.inspection.private, true); break; }
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.notEqual(i, 99, "Private inspection completed before restart");
    }
    let screenshot: Buffer | undefined;
    if (spawnSync("ffmpeg", ["-version"]).status === 0) {
      const bytes = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=160x120", "-frames:v", "1", "-threads", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"]).stdout;
      assert.equal((await fetch(base + root + "/screenshot", { method: "POST", headers: { Cookie: cookie, Origin: base, "Content-Type": "image/png" }, body: bytes })).status, 202);
      await poll(); assert.equal(job.phases.recording.state, "completed");
      screenshot = Buffer.from(await (await fetch(base + root + "/assets/screenshot", { headers: { Cookie: cookie } })).arrayBuffer());
    }
    await stop();
    const databaseBytes = await readFile(path);
    assert.equal(databaseBytes.includes(Buffer.from(cookie.split("=")[1])), false);
    assert.equal(databaseBytes.includes(Buffer.from("fixture-private-token")), false, "GitHub credentials remain in process memory");
    assert.equal(databaseBytes.includes(Buffer.from("fixture-oauth-secret")), false, "OAuth secrets remain environment-only");
    await start();
    const restored = await fetch(base + root, { headers: { Cookie: cookie } });
    assert.equal(restored.status, 200);
    job = await restored.json();
    assert.equal(job.name, "app");
    assert.ok(job.readinessReviewedAt);
    assert.equal(job.phases.inspect.state, "completed");
    assert.equal(restored.headers.getSetCookie().some(c => c.startsWith("sudo_session=")), false, "A valid durable cookie does not create a new owner");
    assert.equal((await fetch(base + root)).status, 404);
    assert.equal((await (await fetch(base + "/api/jobs")).json()).length, 0);
    assert.equal((await (await fetch(base + "/api/auth/github/status", { headers: { Cookie: cookie } })).json()).connected, false, "OAuth/provider authorization is not silently restored from SQLite");
    assert.equal((await fetch(base + "/api/jobs/" + privateJob.id)).status, 404);
    assert.equal((await post("/api/auth/github/disconnect", {})).status, 200);
    assert.equal((await fetch(base + "/api/jobs/" + privateJob.id, { headers: { Cookie: cookie } })).status, 404);
    assert.equal((await fetch(base + root, { headers: { Cookie: cookie } })).status, 200, "Disconnect only removes previously read private source jobs");
    if (screenshot) {
      assert.deepEqual(Buffer.from(await (await fetch(base + root + "/assets/screenshot", { headers: { Cookie: cookie } })).arrayBuffer()), screenshot);
      assert.equal((await fetch(base + root + "/assets/screenshot")).status, 404);
    }
    assert.equal((await fetch(base + root, { method: "DELETE", headers })).status, 204);
    await stop(); await start();
    assert.equal((await fetch(base + "/api/jobs/" + privateJob.id, { headers: { Cookie: cookie } })).status, 404, "Private-source disconnect deletion survives restart");
    assert.equal((await fetch(base + root, { headers: { Cookie: cookie } })).status, 404);
    assert.equal((await fetch(base + root + "/assets/screenshot", { headers: { Cookie: cookie } })).status, 404);
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
