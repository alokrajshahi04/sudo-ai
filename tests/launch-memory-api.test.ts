import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";

test("mounted launch routes keep reviewed copy consistent across ZIP, carousel, narration edits and SQLite restart", { timeout: 90000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sudo-launch-memory-"));
  const path = join(directory, "launch.sqlite"), audio = join(directory, "narration.mp3"), port = 3312, base = `http://127.0.0.1:${port}`;
  const audioAvailable = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:a", "libmp3lame", audio]).status === 0;
  let child: ChildProcess | undefined;
  async function start() {
    child = spawn(process.execPath, ["--import", "tsx", "tests/fixtures/api-runner.ts"], {
      env: { ...process.env, PORT: String(port), SUDO_DB_PATH: path, GOOGLE_API_KEY: "fixture-google", NEBIUS_API_KEY: "", CUSTOM_MODEL_API_KEY: "", ELEVENLABS_API_KEY: audioAvailable ? "fixture-elevenlabs" : "", ELEVENLABS_VOICE_ID: "fixture-voice", SUDO_FIXTURE_AUDIO_PATH: audioAvailable ? audio : "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Mounted launch fixture startup timed out")), 15000);
      child!.stdout!.on("data", chunk => { if (chunk.toString().includes("Sudo Launch local API")) { clearTimeout(timer); resolve(); } });
      child!.once("exit", () => { clearTimeout(timer); reject(new Error("Mounted launch fixture exited before startup")); });
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
    const setup = await fetch(base + "/api/capabilities"), capabilities = await setup.json();
    t.diagnostic(`Mounted media coverage: aligned narration=${audioAvailable}, five-slide Chromium carousel=${!!capabilities.carousel}`);
    const cookie = setup.headers.getSetCookie().find(c => c.startsWith("sudo_session="))!.split(";")[0];
    const headers = { Cookie: cookie, Origin: base, "Content-Type": "application/json" };
    const post = (url: string, body: unknown) => fetch(base + url, { method: "POST", headers, body: JSON.stringify(body) });
    let response = await post("/api/jobs", { repository: "https://github.com/fixture/app", model: "google", launchMode: "prototype" });
    assert.equal(response.status, 202);
    let job = await response.json();
    const root = "/api/jobs/" + job.id;
    async function poll() {
      for (let i = 0; i < 250; i++) {
        response = await fetch(base + root, { headers: { Cookie: cookie } });
        assert.equal(response.status, 200); job = await response.json();
        if (!Object.values(job.phases).some((p: any) => p.state === "running")) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error("Mounted launch fixture operation timed out");
    }
    await poll();
    assert.equal(job.phases.inspect.state, "completed");
    assert.equal(job.phases.analyze.state, "completed");
    assert.equal((await post(root + "/readiness-review", { acknowledged: true })).status, 200);
    assert.equal((await post(root + "/brief", { audience: "Student developers", goal: "Find five prototype testers", context: "Prototype seeking feedback" })).status, 200);
    assert.equal((await post(root + "/position", { provider: "google" })).status, 202);
    await poll(); assert.equal(job.phases.position.state, "completed");
    const copy = { linkedin: "Reviewed launch: a student prototype seeking five testers.", x: "Try my reviewed student prototype.", instagram: "Five slides introducing my prototype. Please share feedback.", narration: "Meet this reviewed prototype. We are looking for five testers." };
    const revision = { angleIndex: job.selectedAngle, positioningGeneratedAt: job.positioning.generatedAt, expectedUpdatedAt: null };
    response = await post(root + "/drafts", { ...copy, ...revision, reviewed: true });
    assert.equal(response.status, 200); job = await response.json();
    assert.equal(job.drafts.linkedin, copy.linkedin);
    assert.ok(job.drafts.reviewedAt);

    if (audioAvailable) {
      assert.equal((await post(root + "/narrate", { text: copy.narration, approved: true })).status, 202);
      await poll(); assert.equal(job.phases.narrate.state, "completed");
      assert.equal((await fetch(base + root + "/assets/narration", { headers: { Cookie: cookie } })).status, 200);
      assert.equal((await fetch(base + root + "/assets/captions", { headers: { Cookie: cookie } })).status, 200);
    }
    if (capabilities.carousel) {
      assert.equal((await post(root + "/carousel", {})).status, 202);
      await poll(); assert.equal(job.phases.carousel.state, "completed");
      assert.equal(job.carousel.slideCount, 5);
      for (let i = 1; i <= 5; i++) {
        const slide = await fetch(base + root + "/assets/carousel-" + i, { headers: { Cookie: cookie } });
        assert.equal(slide.status, 200); assert.match(slide.headers.get("content-type")!, /image\/png/);
        assert.equal(Buffer.from(await slide.arrayBuffer()).subarray(1, 4).toString(), "PNG");
      }
    }
    const calendarStart = new Date(Date.now() + 86_400_000).toISOString();
    async function kit() {
      const res = await fetch(base + root + "/pack.zip?start=" + encodeURIComponent(calendarStart), { headers: { Cookie: cookie } });
      assert.equal(res.status, 200); assert.match(res.headers.get("content-type")!, /application\/zip/);
      return unzipSync(new Uint8Array(await res.arrayBuffer()));
    }
    let files = await kit();
    for (const [file, text] of Object.entries({ "posts/linkedin.txt": copy.linkedin, "posts/x.txt": copy.x, "instagram/caption.txt": copy.instagram, "posts/narration-script.txt": copy.narration })) assert.equal(strFromU8(files[file]), text);
    assert.match(strFromU8(files["launch-calendar.ics"]), /Reviewed launch: a student prototype/);
    assert.equal(JSON.parse(strFromU8(files["receipt.json"])).job.owner, undefined);
    assert.equal(JSON.parse(strFromU8(files["manifest.json"])).automaticPublication, false);
    if (audioAvailable) { assert.ok(files["media/narration.mp3"]); assert.ok(files["media/captions.srt"]); }
    if (capabilities.carousel) assert.ok(files["instagram/slide-05.png"]);

    const nextCopy = { ...copy, narration: "A revised approved voiceover. Please test this student prototype." };
    response = await post(root + "/drafts", { ...nextCopy, ...revision, expectedUpdatedAt: job.drafts.updatedAt, reviewed: true });
    assert.equal(response.status, 200); job = await response.json();
    for (const type of ["narration", "captions", "video", "poster", "carousel-1"])
      assert.equal((await fetch(base + root + "/assets/" + type, { headers: { Cookie: cookie } })).status, 404, `${type} cannot retain a stale reviewed draft`);
    assert.equal(job.narrationScript, undefined); assert.equal(job.carousel, undefined);
    files = await kit();
    assert.equal(strFromU8(files["posts/narration-script.txt"]), nextCopy.narration);
    assert.equal(files["media/narration.mp3"], undefined); assert.equal(files["instagram/slide-01.png"], undefined);
    const savedDrafts = job.drafts;
    await stop(); await start();
    response = await fetch(base + root, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200); job = await response.json();
    assert.deepEqual(job.drafts, savedDrafts);
    files = await kit();
    assert.equal(strFromU8(files["posts/linkedin.txt"]), nextCopy.linkedin);
    assert.equal(strFromU8(files["posts/narration-script.txt"]), nextCopy.narration);
    assert.equal(files["media/narration.mp3"], undefined, "Narration invalidation survives restart");
    assert.equal((await fetch(base + root + "/pack.zip")).status, 404);
    assert.equal((await fetch(base + root + "/drafts", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ ...nextCopy, ...revision, reviewed: true }) })).status, 404);
    response = await post(root + "/drafts", { ...nextCopy, ...revision, reviewed: true });
    assert.equal(response.status, 409, "Stale edit revision stays rejected after restart");
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
