import test from "node:test";
import assert from "node:assert/strict";
import {
  generateJson,
  generatePositioning,
  modelConfig,
  validatePositioning,
} from "../server/models";
import { validateAnalysis } from "../server/analysis";
import { launchEvidence } from "../shared/evidence";
import type { Job } from "../shared/types";

const analysis = {
  findings: [],
  summary: "A source-based student prototype",
  suggestedBrief: {
    audience: "Students",
    goal: "Find testers",
    context: "Runtime unverified",
  },
  assumptions: ["Confirm the proposed audience"],
  evidenceIds: ["source-1"],
};
const positioning = {
  angles: [0, 1].map((i) => ({
    title: `Story ${i}`,
    audience: "Students",
    rationale: "Supported by source",
    evidenceIds: ["source-1"],
    linkedin: "A student prototype seeking feedback.",
    x: "Try a student prototype.",
    narration:
      "A source-based prototype, with runtime behavior still to verify.",
  })),
  limitations: ["Runtime not verified"],
};
const ids = new Set(["source-1"]);
const completion = (value: unknown, finish_reason = "stop") =>
  new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason,
          message: {
            content: JSON.stringify(value),
            reasoning_content: "PRIVATE_REASONING",
          },
        },
      ],
      usage: {
        prompt_tokens: 300,
        completion_tokens: 1200,
        completion_tokens_details: { reasoning_tokens: 800 },
      },
    }),
  );

async function harness(run: (logs: string[]) => Promise<void>) {
  const oldFetch = globalThis.fetch,
    oldLog = console.info;
  const names = [
    "NEBIUS_API_KEY",
    "NEBIUS_MODEL",
    "NEBIUS_BASE_URL",
    "GOOGLE_API_KEY",
  ];
  const original = names.map((n) => process.env[n]);
  process.env.NEBIUS_API_KEY = "fixture-nebius-secret-do-not-log";
  process.env.GOOGLE_API_KEY = "fixture-google-secret-do-not-log";
  delete process.env.NEBIUS_MODEL;
  delete process.env.NEBIUS_BASE_URL;
  const logs: string[] = [];
  console.info = (...args) => {
    logs.push(args.join(" "));
  };
  try {
    await run(logs);
  } finally {
    globalThis.fetch = oldFetch;
    console.info = oldLog;
    names.forEach((n, i) => {
      if (original[i] === undefined) delete process.env[n];
      else process.env[n] = original[i];
    });
  }
}

test("Nebius uses the regional GLM endpoint for analysis and stories; diagnostics exclude data and keys", async () =>
  harness(async (logs) => {
    let requests = 0;
    globalThis.fetch = async (url, init) => {
      assert.equal(
        String(url),
        "https://api.tokenfactory.us-north1.nebius.com/v1/chat/completions",
      );
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer fixture-nebius-secret-do-not-log",
      );
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "zai-org/GLM-5.3-Flash");
      assert.equal(body.messages[0].role, "system");
      assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(body.reasoning_effort, "low");
      assert.equal(body.max_tokens, 8192);
      return completion(requests++ ? positioning : analysis);
    };
    assert.deepEqual(
      await generateJson(
        "nebius",
        "Schema",
        { source: "PRIVATE_SOURCE" },
        (v) => validateAnalysis(v, ids),
        "analysis",
      ),
      analysis,
    );
    assert.deepEqual(
      await generateJson(
        "nebius",
        "Schema",
        { source: "PRIVATE_SOURCE" },
        (v) => validatePositioning(v, ids),
        "positioning",
      ),
      positioning,
    );
    assert.equal(requests, 2);
    assert.ok(
      logs.every(
        (l) =>
          !/PRIVATE_SOURCE|PRIVATE_REASONING|fixture-nebius-secret|student prototype/.test(
            l,
          ),
      ),
    );
    const record = JSON.parse(logs[1].slice("[model] ".length));
    assert.equal(record.task, "positioning");
    assert.equal(record.outcome, "success");
    assert.equal(record.reasoningTokens, 800);
  }));

test("Schema repair includes bounded field errors and never logs arbitrary model properties", async () =>
  harness(async (logs) => {
    let requests = 0;
    const invalid = structuredClone(positioning);
    invalid.angles[0].x = "x".repeat(281);
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      if (requests++) {
        assert.match(
          body.messages[1].content,
          /angles\.0\.x: exceeds maximum 280/,
        );
        return completion(positioning);
      }
      return completion({
        ...invalid,
        PRIVATE_MODEL_PROPERTY: "fixture-nebius-secret-do-not-log",
      });
    };
    await generateJson("nebius", "Schema", {}, (v) =>
      validatePositioning(v, ids),
    );
    assert.equal(requests, 2);
    assert.ok(logs[0].includes("angles.0.x"));
    assert.ok(
      logs.every(
        (l) => !/PRIVATE_MODEL_PROPERTY|fixture-nebius-secret/.test(l),
      ),
    );
  }));

test("Unknown evidence stops after one repair with no provider fallback", async () =>
  harness(async (logs) => {
    let requests = 0;
    globalThis.fetch = async (url) => {
      assert.ok(String(url).includes("us-north1.nebius.com"));
      requests++;
      return completion({
        ...analysis,
        evidenceIds: ["invented-secret-evidence"],
      });
    };
    await assert.rejects(
      generateJson("nebius", "Schema", {}, (v) => validateAnalysis(v, ids)),
      /unknown evidence ID.*No fallback/,
    );
    assert.equal(requests, 2);
    assert.ok(logs.every((l) => !l.includes("invented-secret-evidence")));
  }));

test("Google excludes thought parts and reports token-limit truncation before a bounded repair", async () =>
  harness(async (logs) => {
    let requests = 0;
    globalThis.fetch = async (url, init) => {
      assert.ok(
        String(url).startsWith("https://generativelanguage.googleapis.com/"),
      );
      const body = JSON.parse(String(init?.body));
      assert.equal(
        body.generationConfig.maxOutputTokens,
        requests ? 6144 : 4096,
      );
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: requests++ ? "STOP" : "MAX_TOKENS",
              content: {
                parts: [
                  { thought: true, text: "PRIVATE_REASONING" },
                  { text: JSON.stringify(analysis) },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
        }),
      );
    };
    await generateJson("google", "Schema", {}, (v) => validateAnalysis(v, ids));
    assert.equal(requests, 2);
    assert.match(logs[0], /output token limit/);
    assert.ok(logs.every((l) => !l.includes("PRIVATE_REASONING")));
  }));

test("Provider rejection is reported without logging error bodies or silently switching models", async () =>
  harness(async (logs) => {
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      return new Response("PRIVATE_PROVIDER_ERROR", { status: 401 });
    };
    await assert.rejects(
      generateJson("nebius", "Schema", {}, (v) => validateAnalysis(v, ids)),
      /HTTP 401/,
    );
    assert.equal(requests, 1);
    assert.match(logs[0], /provider_rejected/);
    assert.ok(!logs.join("").includes("PRIVATE_PROVIDER_ERROR"));
    process.env.NEBIUS_BASE_URL = "https://configured.example/v1/";
    assert.equal(modelConfig("nebius").base, "https://configured.example/v1/");
  }));

test("Positioning constrains citations to the shared source and HTTP evidence registry", async () =>
  harness(async () => {
    const job = {
      inspection: { evidence: [{ id: "source-1", excerpt: "public source" }] },
      site: { url: "https://demo.example", finalUrl: "https://demo.example/", httpStatus: 200, reachable: true, title: "Demo", checkedAt: "2026-10-10T01:00:00Z" },
    } as Job;
    const evidence = launchEvidence(job);
    assert.equal(evidence[1].id, "http-site");
    assert.match(evidence[1].excerpt, /interactions.*not verified/);
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const format = body.response_format;
      assert.equal(format.type, "json_schema");
      assert.equal(format.json_schema.strict, true);
      assert.deepEqual(format.json_schema.schema.properties.angles.items.properties.evidenceIds.items.enum, ["source-1", "http-site"]);
      const data = JSON.parse(body.messages[1].content.split("UNTRUSTED_DATA_JSON:\n")[1]);
      assert.deepEqual(data.allowedEvidenceIds, ["source-1", "http-site"]);
      return completion({ ...positioning, angles: positioning.angles.map(a => ({ ...a, evidenceIds: ["http-site"] })) });
    };
    const result = await generatePositioning(job, "nebius");
    assert.equal(result.angles[0].evidenceIds[0], "http-site");
    assert.throws(() => validatePositioning({ ...positioning, angles: positioning.angles.map(a => ({...a, evidenceIds: ["http-imagined"]})) }, new Set(evidence.map(e => e.id))));
  }));
