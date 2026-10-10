import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { ModelProvider } from "../shared/types";
import { redact } from "./errors";

export interface ModelDiagnostic {
  callId: string;
  task: "analysis" | "positioning" | "json";
  provider: ModelProvider;
  model: string;
  attempt: number;
  elapsedMs: number;
  outcome:
    | "success"
    | "validation_failed"
    | "transport_failed"
    | "provider_rejected"
    | "invalid_payload";
  httpStatus?: number;
  finishReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  issues?: string;
}

// Call sites pass only bounded metadata, never headers, prompts or model text.
// Keep two small local files so watcher restarts do not erase failure diagnostics.
export function logModelCall(entry: ModelDiagnostic) {
  const line = redact(
    JSON.stringify({ time: new Date().toISOString(), ...entry }),
  );
  console.info(`[model] ${line}`);
  try {
    const directory = resolve(".local");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const file = resolve(directory, "model-calls.jsonl");
    try {
      if (statSync(file).size > 256_000) renameSync(file, file + ".1");
    } catch {}
    appendFileSync(file, line + "\n", { mode: 0o600 });
  } catch {
    // Diagnostics must not turn a successful model call into a failed job.
  }
}
