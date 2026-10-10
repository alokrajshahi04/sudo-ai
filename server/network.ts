import { lookup } from "node:dns/promises";
import https from "node:https";
import http from "node:http";
import ipaddr from "ipaddr.js";
import { AppError } from "./errors";

export function publicAddress(address: string): boolean {
  try {
    const ip = ipaddr.process(address);
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export function publicUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, "Enter a valid public HTTPS URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hostname.length > 253
  )
    throw new AppError(
      400,
      "Only public HTTPS URLs on port 443 are supported.",
    );
  if (
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".local")
  )
    throw new AppError(400, "Local and internal addresses are not supported.");
  return url;
}
export async function fetchPublic(
  value: string,
  depth = 0,
): Promise<{ url: string; status: number; text: string }> {
  if (depth > 3) throw new AppError(400, "Too many redirects.");
  const url = publicUrl(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new AppError(
      400,
      "Private and reserved network destinations are blocked.",
    );
  // Pin the validated DNS address into the connection; retain hostname for TLS.
  const target = addresses[0];
  const result = await new Promise<{
    status: number;
    location?: string;
    text: string;
  }>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        family: target.family,
        headers: {
          "User-Agent": "SudoLaunch/0.1",
          Accept: "text/html,text/plain;q=0.9",
        },
        lookup: (_name, _options, callback) =>
          callback(null, target.address, target.family),
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          resolve({ status, location: response.headers.location, text: "" });
          return;
        }
        const contentType = response.headers["content-type"] || "";
        if (!/text\/|application\/json/.test(contentType)) {
          response.destroy();
          resolve({ status, text: "" });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 512_000) {
            response.destroy(
              new AppError(400, "Page exceeds the inspection size limit."),
            );
          } else chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({ status, text: Buffer.concat(chunks).toString("utf8") }),
        );
        response.on("error", reject);
      },
    );
    const timeout = setTimeout(
      () => request.destroy(new AppError(504, "Public URL check timed out.")),
      15_000,
    );
    request.on("close", () => clearTimeout(timeout));
    request.on("error", reject);
    request.end();
  });
  if (result.location)
    return fetchPublic(new URL(result.location, url).href, depth + 1);
  return { url: url.href, status: result.status, text: result.text };
}
export async function readResponse(
  response: Response,
  limit = 1_000_000,
): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit)
        throw new AppError(502, "Provider response exceeds the size limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function plainText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Browser capture loads every resource through this pinned transport. Redirects
// remain visible to Chromium and are validated again on the next intercepted GET.
export async function fetchPublicResource(
  value: string,
  limit = 8_000_000,
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  const url = publicUrl(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new AppError(
      400,
      "Private and reserved capture destinations are blocked.",
    );
  const target = addresses[0];
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        family: target.family,
        headers: {
          "User-Agent": "SudoLaunch-Capture/0.1",
          "Accept-Encoding": "identity",
        },
        lookup: (_name, _options, callback) =>
          callback(null, target.address, target.family),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > limit)
            response.destroy(
              new AppError(400, "Capture resource exceeds its size limit."),
            );
          else chunks.push(chunk);
        });
        response.on("end", () => {
          const headers: Record<string, string> = {};
          for (const [name, value] of Object.entries(response.headers))
            if (
              typeof value === "string" &&
              ![
                "set-cookie",
                "transfer-encoding",
                "connection",
                "content-length",
              ].includes(name)
            )
              headers[name] = value;
          resolve({
            status: response.statusCode || 502,
            headers,
            body: Buffer.concat(chunks),
          });
        });
        response.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => request.destroy(new AppError(504, "Capture resource timed out.")),
      10_000,
    );
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
    request.end();
  });
}
