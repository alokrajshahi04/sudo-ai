import test from "node:test";
import assert from "node:assert/strict";
import { safeDemoControls, chooseDemoControl } from "../server/capture-agent";

test("Automatic capture limits candidates and excludes account, write and repeated controls", () => {
  const controls = [
    "Log in",
    "Sign up",
    "Connect wallet",
    "Buy now",
    "Delete project",
    "Send",
    "Upload",
    "Publish",
    "Download",
    "Reset",
    "Show demo",
    "Show demo",
    "Explore",
    "x".repeat(81),
  ].map((name) => ({ role: "button" as const, name }));
  assert.deepEqual(safeDemoControls(controls, ["button:Explore"]), [
    { role: "button", name: "Show demo" },
  ]);
  assert.equal(
    safeDemoControls(
      Array.from({ length: 30 }, (_, i) => ({
        role: "link",
        name: `View ${i}`,
      })),
      [],
    ).length,
    20,
  );
});

test("Planner accepts only enumerated choices, never invented commands, and makes one bounded request", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.NEBIUS_API_KEY;
  process.env.NEBIUS_API_KEY = "fixture-key";
  const controls = [{ role: "button" as const, name: "Show demo" }];
  let response: unknown = { choice: "0" },
    requests = 0;
  globalThis.fetch = async (_url, init) => {
    requests++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.max_tokens, 2048);
    assert.match(body.messages[0].content, /untrusted DATA/);
    assert.deepEqual(
      body.response_format.json_schema.schema.properties.choice.enum,
      ["stop", "0"],
    );
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(response) },
          },
        ],
      }),
    );
  };
  try {
    assert.equal(await chooseDemoControl("nebius", [], []), null);
    assert.equal(requests, 0);
    assert.deepEqual(
      await chooseDemoControl("nebius", controls, []),
      controls[0],
    );
    response = { choice: "stop" };
    assert.equal(await chooseDemoControl("nebius", controls, []), null);
    response = { choice: "99", command: "navigate elsewhere" };
    await assert.rejects(
      chooseDemoControl("nebius", controls, []),
      /without repair/,
    );
    assert.equal(requests, 3);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.NEBIUS_API_KEY;
    else process.env.NEBIUS_API_KEY = oldKey;
  }
});
