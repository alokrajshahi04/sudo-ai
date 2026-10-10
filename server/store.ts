import { createHash } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ArtifactType, Job } from "../shared/types";

export type StoredJob = Job & { owner: string };
export type JobMedia = Partial<Record<ArtifactType, Buffer>>;
const assetTypes = new Set(["recording", "narration", "music", "video", "poster", "screenshot", "captions", "carousel-1", "carousel-2", "carousel-3", "carousel-4", "carousel-5"]);

export function retentionMilliseconds(value = process.env.SUDO_RETENTION_DAYS) {
  const days = value === undefined || value === "" ? 7 : Number(value);
  if (!Number.isFinite(days) || days < 1 || days > 365)
    throw new Error("SUDO_RETENTION_DAYS must be between 1 and 365.");
  return Math.round(days * 86_400_000);
}

/** Cookie secrets stay in the browser; only this irreversible identifier reaches disk. */
export function sessionOwner(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Local-only durable storage. Provider and GitHub credentials are deliberately absent. */
export class LaunchStore {
  private readonly db: DatabaseSync;
  private readonly savedAssets = new Map<string, JobMedia>();
  constructor(path = process.env.SUDO_DB_PATH || resolve(".local/sudo-launch.sqlite")) {
    if (path !== ":memory:") {
      mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
    }
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
      PRAGMA secure_delete = ON;
      CREATE TABLE IF NOT EXISTS sessions (
        owner TEXT PRIMARY KEY, expires INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL REFERENCES sessions(owner) ON DELETE CASCADE,
        expires INTEGER NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(owner);
      CREATE TABLE IF NOT EXISTS assets (
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        data BLOB NOT NULL,
        PRIMARY KEY(job_id, type)
      );
      PRAGMA user_version = 1;
    `);
  }

  saveSession(owner: string, expires: number) {
    this.db.prepare("INSERT INTO sessions(owner, expires) VALUES (?, ?) ON CONFLICT(owner) DO UPDATE SET expires=excluded.expires").run(owner, expires);
  }

  deleteSession(owner: string) {
    for (const row of this.db.prepare("SELECT id FROM jobs WHERE owner=?").all(owner))
      this.savedAssets.delete(String(row.id));
    this.db.prepare("DELETE FROM sessions WHERE owner=?").run(owner);
  }

  saveJob(job: StoredJob, media?: JobMedia) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("INSERT INTO jobs(id, owner, expires, data) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, expires=excluded.expires, data=excluded.data")
        .run(job.id, job.owner, Date.parse(job.expiresAt), JSON.stringify(job));
      if (media !== undefined) this.writeMedia(job.id, media);
      this.db.exec("COMMIT");
      if (media !== undefined) this.savedAssets.set(job.id, { ...media });
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  saveMedia(jobId: string, media: JobMedia = {}) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.writeMedia(jobId, media);
      this.db.exec("COMMIT");
      this.savedAssets.set(jobId, { ...media });
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private writeMedia(jobId: string, media: JobMedia) {
    const previous = this.savedAssets.get(jobId) || {};
    for (const type of assetTypes) {
      const key = type as keyof JobMedia;
      if (!media[key]) {
        this.db.prepare("DELETE FROM assets WHERE job_id=? AND type=?").run(jobId, type);
      } else if (media[key] !== previous[key]) {
        this.db.prepare("INSERT INTO assets(job_id, type, data) VALUES (?, ?, ?) ON CONFLICT(job_id, type) DO UPDATE SET data=excluded.data").run(jobId, type, media[key]!);
      }
    }
  }

  deleteJob(id: string) {
    this.db.prepare("DELETE FROM jobs WHERE id=?").run(id);
    this.savedAssets.delete(id);
  }

  cleanup(now = Date.now()) {
    for (const row of this.db.prepare("SELECT jobs.id FROM jobs JOIN sessions ON jobs.owner=sessions.owner WHERE jobs.expires<=? OR sessions.expires<=?").all(now, now))
      this.savedAssets.delete(String(row.id));
    this.db.prepare("DELETE FROM jobs WHERE expires<=?").run(now);
    this.db.prepare("DELETE FROM sessions WHERE expires<=?").run(now);
  }

  restore(now = Date.now()) {
    this.cleanup(now);
    const sessions = new Map<string, number>();
    const jobs = new Map<string, StoredJob>();
    const media = new Map<string, JobMedia>();
    for (const row of this.db.prepare("SELECT owner, expires FROM sessions").all())
      sessions.set(String(row.owner), Number(row.expires));
    for (const row of this.db.prepare("SELECT id, owner, data FROM jobs").all()) {
      let job: StoredJob;
      try {
        job = JSON.parse(String(row.data));
        if (job.id !== row.id || job.owner !== row.owner || !job.phases || !sessions.has(job.owner)) throw new Error("Invalid stored job");
      } catch {
        this.deleteJob(String(row.id));
        continue;
      }
      let interrupted = false;
      for (const phase of Object.values(job.phases)) {
        if (phase.state === "running") {
          phase.state = "failed";
          phase.error = "The local server restarted during this operation. Review existing outputs, then retry explicitly; paid calls were not retried.";
          interrupted = true;
        }
      }
      if (interrupted) job.progressStep = undefined;
      job.phases.carousel ??= { state: "idle" };
      jobs.set(job.id, job);
      if (interrupted) this.saveJob(job);
    }
    for (const row of this.db.prepare("SELECT job_id, type, data FROM assets").all()) {
      const id = String(row.job_id), type = String(row.type);
      if (!jobs.has(id) || !assetTypes.has(type)) continue;
      const assets = media.get(id) || {};
      assets[type as keyof JobMedia] = Buffer.from(row.data as Uint8Array);
      media.set(id, assets);
    }
    for (const [id, assets] of media) this.savedAssets.set(id, { ...assets });
    return { sessions, jobs, media };
  }

  close() { this.savedAssets.clear(); this.db.close(); }
}
