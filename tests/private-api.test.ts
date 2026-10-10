import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

test(
  "OAuth callback preserves the original owner; private jobs and tokens never cross sessions",
  { timeout: 20_000 },
  async () => {
    const base = "http://127.0.0.1:3305";
    const proc = spawn(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/api-runner.ts"],
      {
        env: {
          ...process.env,
          PORT: "3305",
          GOOGLE_API_KEY: "fixture-google",
          GITHUB_CLIENT_ID: "fixture-client",
          GITHUB_CLIENT_SECRET: "fixture-secret",
          GITHUB_TOKEN: "fixture-private-token",
          ELEVENLABS_API_KEY: "",
          NEBIUS_API_KEY: "",
          CUSTOM_MODEL_API_KEY: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("API startup timed out")),
          10000,
        );
        proc.stdout.on("data", (chunk) => {
          if (chunk.toString().includes("Sudo Launch local API")) {
            clearTimeout(timer);
            resolve();
          }
        });
        proc.on("exit", () => {
          clearTimeout(timer);
          reject(Error("API exited"));
        });
      });
      const setup = await fetch(base + "/api/capabilities");
      const cookie = setup.headers.get("set-cookie")!.split(";")[0];
      const otherSetup = await fetch(base + "/api/capabilities");
      const otherCookie = otherSetup.headers.get("set-cookie")!.split(";")[0];
      const post = (path: string, body: object = {}, owner = cookie) =>
        fetch(base + "/api" + path, {
          signal: AbortSignal.timeout(5000),
          method: "POST",
          headers: {
            Cookie: owner,
            Origin: base,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      const get = (path: string, owner = cookie) =>
        fetch(base + "/api" + path, {
          signal: AbortSignal.timeout(5000),
          headers: { Cookie: owner },
        });
      let response = await post("/jobs", {
        repository: "https://github.com/fixture/app",
      });
      assert.equal(response.status, 202);
      const publicJob = await response.json();
      async function poll(id: string) {
        for (let n = 0; n < 100; n++) {
          const job = await (await get("/jobs/" + id)).json();
          if (
            !Object.values(job.phases).some((p: any) => p.state === "running")
          )
            return job;
          await new Promise((r) => setTimeout(r, 50));
        }
        throw Error("Job timed out");
      }
      const analyzed = await poll(publicJob.id);
      assert.equal(analyzed.phases.analyze.state, "completed");
      assert.equal(
        analyzed.launchBrief,
        undefined,
        "Model suggestions do not auto-confirm the owner's intentions",
      );
      assert.ok(analyzed.analysis.suggestedBrief.audience);
      assert.ok(analyzed.readiness.agentPrompt);
      response = await post("/auth/github/start");
      const nonce = response.headers.get("set-cookie")!.split(";")[0];
      assert.ok(response.headers.get("set-cookie")!.includes("SameSite=Lax"));
      const authUrl = new URL((await response.json()).url);
      const state = authUrl.searchParams.get("state")!;
      const callback =
        base +
        "/api/auth/github/callback?" +
        new URLSearchParams({ state, code: "fixture-code" });
      response = await fetch(callback, {
        signal: AbortSignal.timeout(5000),
        redirect: "manual",
        headers: { Cookie: "sudo_oauth=wrong" },
      });
      assert.equal(response.headers.get("location"), "/?github=failed");
      response = await fetch(callback, {
        signal: AbortSignal.timeout(5000),
        redirect: "manual",
        headers: { Cookie: nonce },
      });
      assert.equal(response.headers.get("location"), "/?github=connected");
      assert.ok(
        response.headers.getSetCookie().some((c) => c.startsWith(cookie + ";")),
        "Callback restores original Strict session despite no application cookie on callback",
      );
      assert.equal((await (await get("/jobs")).json())[0].id, publicJob.id);
      assert.equal(
        (await (await get("/auth/github/status", otherCookie)).json())
          .connected,
        false,
      );
      response = await fetch(callback, {
        signal: AbortSignal.timeout(5000),
        redirect: "manual",
        headers: { Cookie: nonce },
      });
      assert.equal(response.headers.get("location"), "/?github=failed");
      response = await post("/discover/connected");
      assert.equal(response.status, 200);
      assert.equal((await response.json()).projects[0].private, true);
      assert.equal(
        (await post("/discover/connected", {}, otherCookie)).status,
        409,
      );
      response = await post("/jobs", {
        repository: "https://github.com/fixture-user/private",
      });
      let privateJob = await response.json();
      privateJob = await poll(privateJob.id);
      assert.equal(privateJob.phases.inspect.state, "failed");
      assert.equal(
        privateJob.inspection,
        undefined,
        "No private source stored without consent",
      );
      response = await post("/jobs", {
        repository: "https://github.com/fixture-user/private",
        privateConsent: true,
      });
      privateJob = await poll((await response.json()).id);
      assert.equal(privateJob.inspection.private, true);
      assert.equal(privateJob.phases.analyze.state, "completed");
      assert.ok(!JSON.stringify(privateJob).includes("do-not-read"));
      assert.ok(!JSON.stringify(privateJob).includes("fixture-private-token"));
      assert.equal(
        (await get("/jobs/" + privateJob.id, otherCookie)).status,
        404,
      );
      assert.equal((await post("/auth/github/disconnect")).status, 200);
      assert.equal((await get("/jobs/" + privateJob.id)).status, 404);
      assert.equal((await get("/jobs/" + publicJob.id)).status, 200);
      assert.equal(
        (await (await get("/auth/github/status")).json()).connected,
        false,
      );
    } finally {
      proc.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          proc.kill("SIGKILL");
          resolve();
        }, 2000);
        proc.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  },
);
