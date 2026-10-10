import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("owned jobs, source provenance, origin checks, real media, and truthful receipts", async () => {
  const port = 3301;
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(
    process.execPath,
    ["--import", "tsx", "tests/fixtures/api-runner.ts"],
    {
      env: {
        ...process.env,
        PORT: String(port),
        GOOGLE_API_KEY: "",
        NEBIUS_API_KEY: "",
        CUSTOM_MODEL_API_KEY: "",
        ELEVENLABS_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Test API startup timed out")),
        10_000,
      );
      proc.stdout.on("data", (chunk) => {
        if (chunk.toString().includes("Sudo Launch local API")) {
          clearTimeout(timer);
          resolve();
        }
      });
      proc.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`API exited ${code}`));
      });
    });
    const setup = await fetch(`${base}/api/capabilities`);
    const cookie = setup.headers.get("set-cookie")!.split(";")[0];
    const headers = {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    };
    let response = await fetch(`${base}/api/jobs`, {
      method: "POST",
      headers: { ...headers, Origin: "https://attacker.test" },
      body: "{}",
    });
    assert.equal(response.status, 403);
    response = await fetch(`${base}/api/jobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        repository: "https://github.com/user/app",
        brief: "Students launching their project",
      }),
    });
    assert.equal(response.status, 202);
    let job = await response.json();
    async function poll() {
      for (let i = 0; i < 100; i++) {
        job = await (
          await fetch(`${base}/api/jobs/${job.id}`, {
            headers: { Cookie: cookie },
          })
        ).json();
        if (!Object.values(job.phases).some((s: any) => s.state === "running"))
          return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw Error("Job did not finish");
    }
    await poll();
    assert.equal(job.inspection.revision, "a".repeat(40));
    assert.equal(job.inspection.profile, "static_vite");
    assert.ok(!("owner" in job));
    assert.equal((await fetch(`${base}/api/jobs/${job.id}`)).status, 404);
    assert.equal(
      (await fetch(`${base}/api/jobs/${job.id}/receipt`)).status,
      404,
    );
    response = await fetch(`${base}/api/jobs/${job.id}/position`, {
      method: "POST",
      headers,
      body: JSON.stringify({ provider: "google" }),
    });
    assert.equal(response.status, 409);
    response = await fetch(`${base}/api/jobs/${job.id}/strategy`, {
      method: "POST",
      headers,
      body: "{}",
    });
    job = await response.json();
    assert.equal(job.launchStrategy.channels.length, 3);
    assert.equal(
      (
        await fetch(`${base}/api/jobs/${job.id}/plan`, {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      404,
    );
    const originalJob = job;
    for (const [name, profile] of Object.entries({
      next: "server_web",
      python: "python_cli",
      docs: "documentation",
      workspace: "multi_service",
      library: "library_cli",
    })) {
      response = await fetch(`${base}/api/jobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          repository: `https://github.com/fixture/${name}`,
          brief: "Prepare an evidenced product marketing launch",
        }),
      });
      assert.equal(response.status, 202);
      job = await response.json();
      await poll();
      assert.equal(job.inspection.profile, profile);
      assert.equal(job.inspection.blockers.length, 0);
      response = await fetch(`${base}/api/jobs/${job.id}/strategy`, {
        method: "POST",
        headers,
        body: "{}",
      });
      assert.equal(response.status, 200);
      const strategy = await response.json();
      assert.ok(strategy.launchStrategy.checklist.length);
      assert.ok(
        job.inspection.evidence.some((e: any) => e.title === "README.md"),
      );
      await fetch(`${base}/api/jobs/${job.id}`, { method: "DELETE", headers });
    }
    job = originalJob;
    response = await fetch(`${base}/api/discover`, {
      method: "POST",
      headers,
      body: JSON.stringify({ username: "fixture" }),
    });
    assert.equal(response.status, 200);
    const profile = await response.json();
    assert.equal(profile.projects.length, 6);
    await fetch(`${base}/api/jobs/${job.id}/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: "https://127.0.0.1/" }),
    });
    await poll();
    assert.equal(job.phases.verify.state, "failed");
    assert.equal(job.site, undefined);
    // FFmpeg is optional on other developers' machines; exercise real render when installed.
    const available = spawnSync("ffmpeg", ["-version"]).status === 0;
    if (available) {
      const dir = await mkdtemp(join(tmpdir(), "sudo-test-"));
      try {
        const path = join(dir, "fixture.mp4");
        assert.equal(
          spawnSync("ffmpeg", [
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=320x180:d=3",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            path,
          ]).status,
          0,
        );
        const bytes = await readFile(path);
        response = await fetch(`${base}/api/jobs/${job.id}/recording`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: base,
            "Content-Type": "video/mp4",
          },
          body: bytes,
        });
        assert.equal(response.status, 202);
        await poll();
        assert.equal(job.phases.recording.state, "completed");
        response = await fetch(`${base}/api/jobs/${job.id}/render`, {
          method: "POST",
          headers,
          body: JSON.stringify({ useNarration: false }),
        });
        assert.equal(response.status, 202);
        await poll();
        assert.equal(job.phases.render.state, "completed");
        const artifact = await fetch(
          `${base}/api/jobs/${job.id}/assets/video`,
          { headers: { Cookie: cookie } },
        );
        assert.equal(artifact.status, 200);
        assert.ok((await artifact.arrayBuffer()).byteLength > 1000);
        assert.equal(
          (await fetch(`${base}/api/jobs/${job.id}/assets/video`)).status,
          404,
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
    const receipt = await (
      await fetch(`${base}/api/jobs/${job.id}/receipt`, {
        headers: { Cookie: cookie },
      })
    ).json();
    assert.equal(receipt.actualExecution.model, null);
    assert.equal(receipt.actualExecution.deploymentExecuted, false);
    assert.equal(receipt.actualExecution.interactionVerified, false);
    assert.equal(receipt.actualExecution.builtRevision, null);
    response = await fetch(`${base}/api/jobs/${job.id}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(response.status, 204);
    assert.equal(
      (
        await fetch(`${base}/api/jobs/${job.id}`, {
          headers: { Cookie: cookie },
        })
      ).status,
      404,
    );
  } finally {
    proc.kill("SIGTERM");
  }
});
