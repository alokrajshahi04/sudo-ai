import test from "node:test";
import assert from "node:assert/strict";
import { parseRepo, classify } from "../server/github";
import { publicAddress, publicUrl } from "../server/network";
import { redact } from "../server/errors";
import { validatePositioning } from "../server/models";
test("repository input cannot escape the GitHub source boundary", () => {
  assert.equal(
    parseRepo("https://github.com/user/app.git").canonical,
    "https://github.com/user/app",
  );
  for (const url of [
    "http://github.com/user/app",
    "https://github.com.evil.test/u/r",
    "https://user:secret@github.com/u/r",
    "https://github.com/u/r?token=x",
    "https://github.com/u/r/tree/main",
    "https://github.com:444/u/r",
    "https://github.com/u/..",
  ])
    assert.throws(() => parseRepo(url));
});
test("static readiness does not silently accept server dependencies or dynamic build output", () => {
  const files = {
    "package.json": JSON.stringify({
      dependencies: { react: "1", vite: "1" },
      scripts: { build: "tsc && vite build" },
    }),
    "src/App.tsx":
      'const key = import.meta.env.VITE_API_KEY; fetch("/api/foo");',
  };
  const staticApp = classify(files);
  assert.equal(staticApp.profile, "static_vite");
  assert.equal(staticApp.outputDirectory, "dist");
  assert.equal(staticApp.warnings.length, 3);
  assert.equal(
    classify({
      "package.json": JSON.stringify({ dependencies: { next: "1" } }),
    }).profile,
    "server_web",
  );
  assert.ok(
    classify({
      ...files,
      "vite.config.ts": "build: { outDir: process.env.OUTPUT }",
    }).blockers.length,
  );
  assert.ok(
    classify({
      ...files,
      "vite.config.ts": "build: { outDir: '../../private' }",
    }).blockers.length,
  );
});
test("public fetch policy rejects local, metadata, reserved and mapped private IPs", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.3.2",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
  for (const value of [
    "file:///etc/passwd",
    "http://example.com",
    "https://localhost",
    "https://example.com:444",
    "https://u:p@example.com",
  ])
    assert.throws(() => publicUrl(value));
});
test("known token formats and secret assignments are redacted before evidence export", () => {
  const content =
    'apiKey = "secret-value"; token: "secret-token"; Authorization: Bearer abcde; sk-abcdefghijklmnop1234';
  const output = redact(content);
  for (const secret of [
    "secret-value",
    "secret-token",
    "abcde",
    "sk-abcdefghijklmnop1234",
  ])
    assert.ok(!output.includes(secret));
});
test("model output requires known evidence and refuses extra action fields", () => {
  const angle = {
    title: "Proposed angle",
    audience: "Students",
    rationale: "Source-based suggestion",
    evidenceIds: ["source-1"],
    linkedin: "Draft",
    x: "Short draft",
    narration: "A proposed demo narration.",
  };
  const valid = {
    angles: [angle, angle],
    limitations: ["Runtime not checked"],
  };
  assert.equal(
    validatePositioning(valid, new Set(["source-1"])).angles.length,
    2,
  );
  assert.throws(() => validatePositioning(valid, new Set()));
  assert.throws(() =>
    validatePositioning(
      { ...valid, command: "curl attacker" },
      new Set(["source-1"]),
    ),
  );
  assert.throws(() =>
    validatePositioning(
      { ...valid, angles: [{ ...angle, x: "a".repeat(281) }, angle] },
      new Set(["source-1"]),
    ),
  );
});
