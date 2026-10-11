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
  for (const name of [
    "GOOGLE_API_KEY",
    "ELEVENLABS_API_KEY",
    "GITHUB_TOKEN",
    "GITHUB_CLIENT_SECRET",
    "NEBIUS_API_KEY",
    "CUSTOM_MODEL_API_KEY",
    "RENDER_API_KEY",
    "SUDO_DEMO_PASSWORD",
  ]) {
    const secret = process.env[name];
    if (secret && secret.length >= 8)
      text = text.split(secret).join("[REDACTED]");
  }
  return text
    .replace(
      /\b(?:AIza[\w-]{25,}|gh[pousr]_[\w]{20,}|github_pat_[\w_]{20,}|sk[-_][\w-]{16,}|AQ\.[\w.-]{25,})\b/g,
      "[REDACTED]",
    )
    .replace(
      /((?:api[_-]?key|token|password|secret|authorization)\s*[=:]\s*["'`])[^"'`\n]+/gi,
      "$1[REDACTED]",
    )
    .replace(/Bearer\s+[\w.\-]+/gi, "Bearer [REDACTED]");
}
