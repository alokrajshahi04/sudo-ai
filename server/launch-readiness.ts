import type { Job } from "../shared/types";
import { AppError } from "./errors";

export function needsDeployedDemo(job: Job) {
  return (
    job.launchMode !== "prototype" &&
    ["static_vite", "server_web", "multi_service"].includes(
      job.inspection?.profile || "",
    )
  );
}
export function requireLaunchReadiness(job: Job) {
  if (!job.readinessReviewedAt)
    throw new AppError(
      409,
      "Check project readiness and acknowledge the findings before generating launch stories.",
    );
  if (needsDeployedDemo(job) && !job.site?.reachable)
    throw new AppError(
      409,
      "Deploy this web project first, add its public HTTPS demo URL, and check the link. Or explicitly choose a prototype launch without claiming a live product.",
    );
}
