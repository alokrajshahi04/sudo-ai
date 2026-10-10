import type { Express } from "express";
import { z } from "zod";
import type { Job } from "../shared/types";
import { copyLimits, currentDrafts, generatedCopy, selectedCopy } from "../shared/launch-copy";
import { AppError, redact } from "./errors";

const revision = {
  angleIndex: z.number().int().min(0).max(1),
  positioningGeneratedAt: z.string().datetime(),
  expectedUpdatedAt: z.string().datetime().nullable(),
};
export const draftSchema = z.object({
  ...revision,
  linkedin: z.string().trim().min(1).max(copyLimits.linkedin),
  x: z.string().trim().min(1).max(copyLimits.x),
  instagram: z.string().trim().min(1).max(copyLimits.instagram),
  narration: z.string().trim().min(10).max(copyLimits.narration),
  reviewed: z.literal(true),
}).strict();
const revertSchema = z.object(revision).strict();
interface Hooks {
  getJob: (id: string, owner: string) => Job;
  saveJob: (job: Job) => void | Promise<void>;
  isBusy?: (id: string) => boolean;
  onNarrationChanged?: (job: Job) => void;
  onDraftsChanged?: (job: Job) => void;
}

function assertEditable(job: Job, input: z.infer<typeof revertSchema>, hooks: Hooks) {
  if (hooks.isBusy?.(job.id) || Object.values(job.phases).some(p => p.state === "running"))
    throw new AppError(409, "Wait for the current operation before editing drafts.");
  if (!job.positioning?.angles[job.selectedAngle])
    throw new AppError(409, "Generate and choose a launch story first.");
  if (input.angleIndex !== job.selectedAngle || input.positioningGeneratedAt !== job.positioning.generatedAt)
    throw new AppError(409, "The launch story changed. Reload its drafts before saving.");
  if (input.expectedUpdatedAt !== (currentDrafts(job)?.updatedAt || null))
    throw new AppError(409, "These drafts were saved elsewhere. Reload before replacing those edits.");
}

/** Mount after owner-session and JSON middleware; getJob enforces session ownership. */
export function registerDraftRoutes(app: Express, hooks: Hooks) {
  app.post("/api/jobs/:id/drafts", async (req, res) => {
    const job = hooks.getJob(req.params.id, res.locals.owner);
    const input = draftSchema.parse(req.body);
    assertEditable(job, input, hooks);
    const before = selectedCopy(job);
    const now = new Date(Math.max(Date.now(), Date.parse(currentDrafts(job)?.updatedAt || "1970-01-01") + 1)).toISOString();
    job.drafts = {
      linkedin: redact(input.linkedin), x: redact(input.x),
      instagram: redact(input.instagram), narration: redact(input.narration),
      angleIndex: job.selectedAngle, positioningGeneratedAt: job.positioning!.generatedAt,
      updatedAt: now, reviewedAt: now,
    };
    if (before.narration !== job.drafts.narration) hooks.onNarrationChanged?.(job);
    hooks.onDraftsChanged?.(job);
    await hooks.saveJob(job);
    const { owner: _owner, ...publicJob } = job as Job & { owner?: string };
    res.json(publicJob);
  });
  app.post("/api/jobs/:id/drafts/revert", async (req, res) => {
    const job = hooks.getJob(req.params.id, res.locals.owner);
    const input = revertSchema.parse(req.body);
    assertEditable(job, input, hooks);
    const changed = selectedCopy(job).narration !== generatedCopy(job).narration;
    job.drafts = undefined;
    if (changed) hooks.onNarrationChanged?.(job);
    hooks.onDraftsChanged?.(job);
    await hooks.saveJob(job);
    const { owner: _owner, ...publicJob } = job as Job & { owner?: string };
    res.json(publicJob);
  });
}
