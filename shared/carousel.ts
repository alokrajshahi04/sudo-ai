import type { Job } from "./types";
import { selectedCopy } from "./launch-copy";

/** A change detector, not a security primitive. Shared by preview and export. */
export function carouselFingerprint(job: Job): string {
  const angle = job.positioning?.angles[job.selectedAngle];
  const value = JSON.stringify({
    copy: selectedCopy(job), angle, name: job.name, brief: job.launchBrief,
    revision: job.inspection?.revision, summary: job.analysis?.summary,
    mode: job.launchMode, site: job.site, capture: job.capture,
    screenshot: job.artifacts.find(a => a.type === "screenshot")?.provenance,
  });
  let a = 2166136261, b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return `v1-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

export function carouselIsCurrent(job: Job): boolean {
  return !!job.carousel && job.carousel.copyFingerprint === carouselFingerprint(job);
}
