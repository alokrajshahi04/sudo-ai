import type { Evidence, Job } from "./types";

// Use the same evidence registry for generation, review and export.
export function launchEvidence(job: Job): Evidence[] {
  const evidence = [
    ...(job.inspection?.evidence || []),
    ...(job.research?.sources || []),
  ];
  if (job.site) {
    const site = job.site;
    evidence.push({
      id: "http-site",
      kind: "http",
      title: "Public demo HTTP check",
      url: site.finalUrl,
      checkedAt: site.checkedAt,
      excerpt: `Checked ${site.url} at ${site.checkedAt}. Final URL: ${site.finalUrl}. HTTP ${site.httpStatus}; reachable: ${site.reachable}. Page title: ${site.title || "unavailable"}. HTTP reachability only; product interactions and deployed source revision were not verified.`,
    });
  }
  return evidence;
}
