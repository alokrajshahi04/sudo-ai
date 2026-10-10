export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function safeError(e: unknown) {
  return e instanceof AppError
    ? e.message
    : "The operation failed. Check the connection or configuration and retry.";
}
export function redact(text: string) {
  return text
    .replace(
      /\b(?:AIza[\w-]{25,}|gh[pousr]_[\w]{20,}|github_pat_[\w_]{20,}|sk-[\w-]{16,})\b/g,
      "[REDACTED]",
    )
    .replace(
      /((?:api[_-]?key|token|password|secret|authorization)\s*[=:]\s*["'`])[^"'`\n]+/gi,
      "$1[REDACTED]",
    )
    .replace(/Bearer\s+[\w.\-]+/gi, "Bearer [REDACTED]");
}
