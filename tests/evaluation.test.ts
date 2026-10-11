import test from "node:test";
import assert from "node:assert/strict";
import { validateAnalysis } from "../server/analysis";
import {
  captionCues,
  captionsSrt,
  validateScreenshot,
  validateRecording,
} from "../server/media";
import { captionAss, renderPromo } from "../server/promo";
import { captureSite, captureSchema } from "../server/capture";
import { launchCalendar } from "../server/calendar";
import { publicUrl } from "../server/network";
import { spawnSync } from "node:child_process";
import type { Job, Storyboard } from "../shared/types";

const analysis = {
  summary: "A client prototype",
  suggestedBrief: {
    audience: "Students",
    goal: "Find testers",
    context: "Prototype",
  },
  assumptions: ["Runtime unverified"],
  evidenceIds: ["source-1"],
  findings: [
    {
      title: "Review browser credentials",
      detail: "A privileged key appears to be injected into client code.",
      recommendation: "Verify bundling and move privileged keys server-side.",
      severity: "review",
      evidenceIds: ["source-1"],
      evidenceQuote: "process.env.API_KEY",
    },
  ],
};
test("AI readiness rejects invented quotations and unknown evidence while retaining concrete source findings", () => {
  const result = validateAnalysis(
    analysis,
    new Set(["source-1"]),
    new Map([["source-1", "const key = process.env.API_KEY;"]]),
  );
  assert.equal(result.findings[0].origin, "ai");
  assert.throws(() =>
    validateAnalysis(
      {
        ...analysis,
        findings: [
          {
            ...analysis.findings[0],
            evidenceQuote: "imagined broken function",
          },
        ],
      },
      new Set(["source-1"]),
      new Map([["source-1", "const key = process.env.API_KEY;"]]),
    ),
  );
  assert.throws(() =>
    validateAnalysis(
      {
        ...analysis,
        findings: [{ ...analysis.findings[0], evidenceIds: ["unknown"] }],
      },
      new Set(["source-1"]),
    ),
  );
});
test("Speech captions use provider timings, preserve text and escape subtitle controls", () => {
  const text = "A small project ready for your feedback.";
  const chars = [...text];
  const cues = captionCues({
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.1),
    character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.1),
  });
  assert.equal(cues.map((c) => c.text).join(" "), text);
  assert.match(captionsSrt(cues), /00:00:00,000 -->/);
  assert.ok(
    captionAss(
      [{ start: 0, end: 1, text: "{\\pos(0,0)}hello" }],
      1080,
      1920,
    ).includes("PlayResY: 1920"),
  );
  assert.ok(
    !captionAss(
      [{ start: 0, end: 1, text: "{\\pos(0,0)}hello" }],
      1080,
      1920,
    ).includes("{\\pos"),
  );
  assert.throws(() =>
    captionCues({
      characters: ["a"],
      character_start_times_seconds: [-1],
      character_end_times_seconds: [1],
    }),
  );
});
test("Launch calendar creates real dated reminders with reviewed drafts and no automatic publishing", () => {
  const job = {
    id: "fixture",
    name: "A product\nBEGIN:VEVENT",
    repository: "https://github.com/dev/tool",
    selectedAngle: 0,
    positioning: {
      angles: [
        { title: "A prototype", linkedin: "Reviewed draft", x: "Short draft" },
      ],
    },
  } as Job;
  const calendar = launchCalendar(job, new Date(Date.now() + 86400_000));
  assert.equal((calendar.match(/BEGIN:VEVENT\r\n/g) || []).length, 4);
  assert.match(calendar, /Manual publishing reminder/);
  assert.match(calendar, /Reviewed draft/);
  assert.throws(() => launchCalendar(job, new Date(0)), /future/);
  assert.ok(
    calendar.split("\r\n").every((line) => Buffer.byteLength(line) <= 75),
  );
});
test("Public capture records selected steps, blocks writes, exports valid footage and supports a captioned portrait", async (t) => {
  if (
    !process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    spawnSync("ffmpeg", ["-version"]).status !== 0
  ) {
    t.skip("Chromium/FFmpeg unavailable");
    return;
  }
  assert.throws(() =>
    captureSchema.parse({
      url: "https://demo.example/",
      approved: true,
      steps: Array.from({ length: 6 }, () => ({
        action: "scroll",
        pixels: 100,
      })),
    }),
  );
  let writes = 0;
  const result = await captureSite(
    captureSchema.parse({
      url: "https://demo.example/",
      approved: true,
      format: "portrait",
      steps: [{ action: "click", role: "button", name: "Show demo" }],
    }),
    () => {},
    async (url) => {
      publicUrl(url);
      if (url.endsWith("/write")) writes++;
      return {
        status: 200,
        headers: { "content-type": "text/html" },
        body: Buffer.from(
          `<h1>Project demo</h1><button onclick="document.querySelector('h1').textContent='Real interaction captured';fetch('/write',{method:'POST'});">Show demo</button>`,
        ),
      };
    },
  );
  assert.equal(writes, 0);
  assert.match(result.capture.coverage, /1 network requests blocked/);
  assert.ok(result.capture.steps.includes("Clicked button: Show demo"));
  await validateRecording(result.recording);
  const normalized = await validateScreenshot(result.screenshot);
  assert.equal(normalized.subarray(1, 4).toString(), "PNG");
  const board: Storyboard = {
    duration: 4,
    scenes: [0, 1, 2, 3].map((i) => ({
      label: "DEMO",
      heading: "A useful prototype",
      detail: "Actual captured footage",
      seconds: 1,
    })),
    sourceVisual: { file: "README.md", excerpt: "A prototype" },
    cta: "Try the demo",
    workflow: "Test",
  };
  const cues = [{ start: 0, end: 2, text: "A useful prototype." }];
  const promo = await renderPromo(board, "fixture", {
    format: "portrait",
    recording: result.recording,
    recordingTail: true,
    captionCues: cues,
    captions: Buffer.from(captionsSrt(cues)),
  });
  assert.equal(promo.video.subarray(4, 8).toString(), "ftyp");
  assert.equal(promo.poster.readUInt32BE(16), 1080);
  assert.equal(promo.poster.readUInt32BE(20), 1920);
});

test("Automatic capture uses permitted demo controls and preserves footage when AI becomes unavailable", async (t) => {
  if (!process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    t.skip("Chromium unavailable");
    return;
  }
  const previousFetch = globalThis.fetch,
    previousKey = process.env.NEBIUS_API_KEY;
  process.env.NEBIUS_API_KEY = "fixture-key";
  let choices = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const data = JSON.parse(
      body.messages[1].content.split("UNTRUSTED_DATA_JSON:\n")[1],
    );
    assert.deepEqual(
      data.controls.map((c: any) => c.name),
      choices ? ["Explore"] : ["Show demo", "Explore"],
    );
    if (choices++) return new Response("Unavailable", { status: 503 });
    return new Response(
      JSON.stringify({
        choices: [
          { finish_reason: "stop", message: { content: '{"choice":"0"}' } },
        ],
      }),
    );
  };
  try {
    const result = await captureSite(
      captureSchema.parse({
        url: "https://demo.example/",
        approved: true,
        automatic: true,
        steps: [],
      }),
      () => {},
      async () => ({
        status: 200,
        headers: { "content-type": "text/html" },
        body: Buffer.from(
          `<h1>Demo</h1><button onclick="document.querySelector('h1').textContent='Product in action'">Show demo</button><button>Explore</button><button>Delete</button><form><button>Preview form</button></form><a href="https://external.example/">External</a><button style="display:none">Hidden</button>`,
        ),
      }),
      "nebius",
    );
    assert.equal(choices, 2);
    assert.ok(result.capture.steps.includes("Automated button: Show demo"));
    assert.ok(
      result.capture.steps.some((step) =>
        step.includes("AI planning unavailable"),
      ),
    );
    assert.equal(result.screenshot.subarray(1, 4).toString(), "PNG");
    assert.ok(result.recording.length > 1000);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.NEBIUS_API_KEY;
    else process.env.NEBIUS_API_KEY = previousKey;
  }
});
