import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { LaunchStore, retentionMilliseconds, sessionOwner, type StoredJob } from "../server/store";
import type { Phase } from "../shared/types";

function fixture(id: string, owner: string, expires: number): StoredJob {
  const phases: Phase[] = ["inspect", "analyze", "music", "research", "position", "verify", "recording", "narrate", "render", "carousel"];
  return {
    id, owner, repository: "https://github.com/fixture/tool", name: "tool", brief: "Find testers", modelPreference: "custom", selectedAngle: 0,
    createdAt: new Date().toISOString(), expiresAt: new Date(expires).toISOString(), artifacts: [],
    phases: Object.fromEntries(phases.map(phase => [phase, { state: "idle" }])) as StoredJob["phases"],
  };
}

test("SQLite close/reopen retains owner-bound edited drafts and exact media, hashes cookie identity and protects the file", () => {
  const directory = mkdtempSync(join(tmpdir(), "sudo-persistence-")), path = join(directory, "launch.sqlite");
  const token = "7".repeat(64), owner = sessionOwner(token), expires = Date.now() + retentionMilliseconds();
  let store: LaunchStore | undefined;
  try {
    store = new LaunchStore(path);
    store.saveSession(owner, expires);
    const job = fixture("durable", owner, expires);
    job.drafts = { linkedin: "My reviewed post", x: "A short post", instagram: "A screenshot story", narration: "My approved script", updatedAt: new Date().toISOString(), reviewedAt: new Date().toISOString(), angleIndex: 0, positioningGeneratedAt: new Date().toISOString() };
    const bytes = Buffer.from([0, 255, 127, 5, 8]);
    store.saveJob(job, { screenshot: bytes, "carousel-1": Buffer.from("first slide") });
    store.close();
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(readFileSync(path).includes(Buffer.from(token)), false, "Raw session cookies do not reach disk");
    store = new LaunchStore(path);
    const restored = store.restore();
    assert.equal(restored.sessions.get(owner), expires);
    assert.deepEqual(restored.jobs.get(job.id)?.drafts, job.drafts);
    assert.equal(restored.jobs.get(job.id)?.owner, owner);
    assert.deepEqual(restored.media.get(job.id)?.screenshot, bytes);
    assert.equal(restored.media.get(job.id)?.["carousel-1"]?.toString(), "first slide");
    const restoredJob = restored.jobs.get(job.id)!;
    store.saveJob(restoredJob, { screenshot: Buffer.from("replacement") });
    store.close(); store = new LaunchStore(path);
    assert.equal(store.restore().media.get(job.id)?.["carousel-1"], undefined, "Invalidated assets are removed durably");
    store.deleteJob(job.id);
    store.close(); store = new LaunchStore(path);
    assert.equal(store.restore().jobs.size, 0);
    const db = new DatabaseSync(path);
    assert.equal(db.prepare("SELECT count(*) AS n FROM assets").get()?.n, 0, "Job deletion cascades to every media blob");
    db.close();
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("restart recovers interrupted paid phases as actionable failures without retrying or losing completed output", () => {
  const store = new LaunchStore(":memory:"), owner = sessionOwner("a".repeat(64)), expires = Date.now() + 86_400_000;
  try {
    store.saveSession(owner, expires);
    const job = fixture("interrupted", owner, expires);
    job.phases.position = { state: "running" };
    job.phases.narrate = { state: "running" };
    job.phases.inspect = { state: "completed" };
    job.progressStep = "Calling paid provider";
    store.saveJob(job, { narration: Buffer.from("last approved audio") });
    const restored = store.restore();
    assert.equal(restored.jobs.get(job.id)?.phases.position.state, "failed");
    assert.match(restored.jobs.get(job.id)!.phases.narrate.error!, /retry explicitly.*not retried/);
    assert.equal(restored.jobs.get(job.id)?.phases.inspect.state, "completed");
    assert.equal(restored.jobs.get(job.id)?.progressStep, undefined);
    assert.equal(restored.media.get(job.id)?.narration?.toString(), "last approved audio");
    assert.equal(store.restore().jobs.get(job.id)?.phases.position.state, "failed", "Recovery itself is durable");
  } finally { store.close(); }
});

test("expired sessions and jobs cascade; owner deletion preserves other owners; retention configuration is bounded", () => {
  const store = new LaunchStore(":memory:"), now = Date.now(), a = sessionOwner("a".repeat(64)), b = sessionOwner("b".repeat(64));
  try {
    store.saveSession(a, now + 100); store.saveSession(b, now + 1000);
    store.saveJob(fixture("private-a", a, now + 1000), { recording: Buffer.from("private media") });
    store.saveJob(fixture("expired-b", b, now + 50), { screenshot: Buffer.from("old screenshot") });
    store.saveJob(fixture("active-b", b, now + 900), { video: Buffer.from("public video") });
    const restored = store.restore(now + 101);
    assert.equal(restored.sessions.has(a), false);
    assert.deepEqual([...restored.jobs.keys()], ["active-b"]);
    assert.deepEqual([...restored.media.keys()], ["active-b"]);
    store.deleteSession(b);
    assert.equal(store.restore(now + 102).jobs.size, 0);
    assert.throws(() => store.saveJob(fixture("orphan", a, now + 1000), { video: Buffer.from("orphan") }), /FOREIGN KEY/);
    assert.equal(retentionMilliseconds("7"), 604800000);
    for (const value of ["-1", "0", "NaN", "366"]) assert.throws(() => retentionMilliseconds(value), /between/);
  } finally { store.close(); }
});
