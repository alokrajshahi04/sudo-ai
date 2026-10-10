import type { Job, LaunchDrafts } from "./types";

export type LaunchCopy = Pick<LaunchDrafts, "linkedin" | "x" | "instagram" | "narration">;
export const copyLimits: Record<keyof LaunchCopy, number> = {
  linkedin: 2500,
  x: 280,
  instagram: 2200,
  narration: 600,
};

/** Owner edits apply only to the exact story that was reviewed. */
export function currentDrafts(job: Job): LaunchDrafts | undefined {
  const drafts = job.drafts;
  return drafts && job.positioning && drafts.angleIndex === job.selectedAngle &&
    drafts.positioningGeneratedAt === job.positioning.generatedAt ? drafts : undefined;
}

export function generatedCopy(job: Job): LaunchCopy {
  const angle = job.positioning?.angles[job.selectedAngle];
  if (!angle) return { linkedin: "", x: "", instagram: "", narration: "" };
  const link = job.site?.reachable ? job.site.finalUrl : job.repository;
  const framing = [angle.title, link].filter(Boolean).join("\n\n");
  const bodyBudget = copyLimits.instagram - framing.length - 2;
  const instagram = [angle.title, angle.linkedin.slice(0, Math.max(0, bodyBudget)).trimEnd(), link].filter(Boolean).join("\n\n");
  // This is an adaptation of reviewed model copy, not a new model-generated claim.
  return {
    linkedin: angle.linkedin,
    x: angle.x,
    instagram,
    narration: angle.narration,
  };
}

export function selectedCopy(job: Job): LaunchCopy {
  const drafts = currentDrafts(job);
  return drafts ? {
    linkedin: drafts.linkedin, x: drafts.x,
    instagram: drafts.instagram, narration: drafts.narration,
  } : generatedCopy(job);
}
