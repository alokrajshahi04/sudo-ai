import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { hostingConfig } from "../server/hosting";

test("Hosted demos require an HTTPS origin and owner-configured access credentials", () => {
  assert.deepEqual(hostingConfig({}), {
    publicOrigin: null,
    bind: "127.0.0.1",
    secureCookies: false,
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
    },
  );
});

test("Public UI, API and media are gated; sessions use Secure cookies and reject foreign origins", async () => {
  const port = 3368,
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
    for (const path of [
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
      Authorization: `Basic ${Buffer.from(`judge:${password}`).toString("base64")}`,
      Origin: origin,
      "Content-Type": "application/json",
    };
    assert.equal(
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
