import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { hostingConfig } from "../server/hosting";

test("Hosted demos require HTTPS; public access is explicit and password access remains available", () => {
  assert.deepEqual(hostingConfig({}), {
    publicOrigin: null,
    bind: "127.0.0.1",
    secureCookies: false,
    accessRequired: false,
  });
  const credentials = {
    SUDO_DEMO_USERNAME: "judge",
    SUDO_DEMO_PASSWORD: "fixture-password-at-least-sixteen",
  };
  for (const origin of [
    "http://demo.example",
    "https://demo.example/path",
    "https://demo.example?key=bad",
    "https://user:pass@demo.example",
  ]) {
    assert.throws(() =>
      hostingConfig({ ...credentials, SUDO_PUBLIC_ORIGIN: origin }),
    );
  }
  assert.throws(() =>
    hostingConfig({ SUDO_PUBLIC_ORIGIN: "https://demo.example" }),
  );
  assert.deepEqual(
    hostingConfig({
      ...credentials,
      RENDER_EXTERNAL_URL: "https://demo.example",
    }),
    {
      publicOrigin: "https://demo.example",
      bind: "0.0.0.0",
      secureCookies: true,
      accessRequired: true,
    },
  );
  assert.deepEqual(hostingConfig({SUDO_PUBLIC_ORIGIN: "https://demo.example", SUDO_DEMO_ACCESS: "public"}), {
    publicOrigin: "https://demo.example", bind: "0.0.0.0", secureCookies: true, accessRequired: false,
  });
  assert.throws(() => hostingConfig({SUDO_PUBLIC_ORIGIN: "https://demo.example", SUDO_DEMO_ACCESS: "unknown"}));
});

for (const access of ["password", "public"]) {
  test(`${access} hosted access preserves secure session isolation and rejects foreign origins`, async () => {
    const port = access === "password" ? 3368 : 3369,
      origin = "https://sudo-fixture.example",
      base = `http://127.0.0.1:${port}`;
    const password = "fixture-password-at-least-sixteen";
    const proc = spawn(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/api-runner.ts"],
      {
        env: {
          ...process.env,
          PORT: String(port),
          SUDO_PUBLIC_ORIGIN: origin,
          SUDO_DEMO_ACCESS: access,
          SUDO_DEMO_USERNAME: "judge",
          SUDO_DEMO_PASSWORD: password,
          SUDO_DB_PATH: "",
          GOOGLE_API_KEY: "",
          NEBIUS_API_KEY: "",
          CUSTOM_MODEL_API_KEY: "",
          ELEVENLABS_API_KEY: "",
          GITHUB_TOKEN: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Hosted fixture startup timed out")),
          20000,
        );
        proc.stdout.on("data", (chunk) => {
          if (chunk.toString().includes("Sudo Launch demo:")) {
            clearTimeout(timer);
            resolve();
          }
        });
        proc.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Hosted fixture exited ${code}`));
        });
      });
      assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), {
        status: "ok",
      });
      if (access === "password") for (const path of [
        "/",
        "/api/capabilities",
        "/api/jobs/unknown/assets/video",
      ]) {
        const response = await fetch(base + path);
        assert.equal(response.status, 401);
        assert.match(response.headers.get("www-authenticate")!, /Basic/);
        assert.equal(response.headers.get("set-cookie"), null);
      }
      const headers = {
        ...(access === "password" ? {Authorization: `Basic ${Buffer.from(`judge:${password}`).toString("base64")}`} : {}),
        Origin: origin,
        "Content-Type": "application/json",
      };
      if (access === "password") assert.equal(
        (
          await fetch(`${base}/api/capabilities`, {
            headers: { ...headers, Authorization: "Basic wrong" },
          })
        ).status,
        401,
      );
      const setup = await fetch(`${base}/api/capabilities`, { headers });
      assert.equal(setup.status, 200);
      assert.match(setup.headers.get("set-cookie")!, /Secure/);
      assert.match(setup.headers.get("set-cookie")!, /HttpOnly/);
      const capabilities = await setup.json();
      assert.equal(capabilities.mode, "hosted-demo");
      assert.equal(capabilities.hostedCredentialEntry, false);
      assert.equal(JSON.stringify(capabilities).includes(password), false);
      if (access === "public") {
        const root = await fetch(base + "/");
        assert.equal(root.status, 200);
        assert.equal(root.headers.get("www-authenticate"), null);
        const cookie = setup.headers.get("set-cookie")!.split(";")[0];
        const otherSetup = await fetch(base + "/api/capabilities", {headers});
        const otherCookie = otherSetup.headers.get("set-cookie")!.split(";")[0];
        assert.notEqual(cookie, otherCookie);
        const created = await fetch(base + "/api/jobs", {method: "POST", headers: {...headers, Cookie: cookie}, body: JSON.stringify({repository: "https://github.com/fixture/app"})});
        assert.equal(created.status, 202);
        const job = await created.json();
        assert.equal((await fetch(base + `/api/jobs/${job.id}`, {headers: {...headers, Cookie: cookie}})).status, 200);
        assert.equal((await fetch(base + `/api/jobs/${job.id}`, {headers: {...headers, Cookie: otherCookie}})).status, 404);
        assert.equal((await fetch(base + `/api/jobs/${job.id}/assets/video`, {headers: {...headers, Cookie: otherCookie}})).status, 404);
        assert.deepEqual(await (await fetch(base + "/api/jobs", {headers: {...headers, Cookie: otherCookie}})).json(), []);
      }
      assert.equal(
        (
          await fetch(`${base}/api/jobs`, {
            method: "POST",
            headers: { ...headers, Origin: "https://attacker.example" },
            body: "{}",
          })
        ).status,
        403,
      );
      const spoofedHostStatus = await new Promise<number | undefined>((resolve, reject) => {
        const req = request(`${base}/api/capabilities`, {headers: {...headers, Host: "attacker.example"}}, response => {response.resume(); resolve(response.statusCode);});
        req.on("error", reject); req.end();
      });
      assert.equal(spoofedHostStatus, 403);
      assert.equal(
        (await fetch(`${base}/api/jobs`, { method: "POST", headers, body: "{}" }))
          .status,
        400,
      );
    } finally {
      proc.kill("SIGTERM");
    }
  });
}
