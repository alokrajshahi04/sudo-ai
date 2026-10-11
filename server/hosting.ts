import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export function hostingConfig(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.SUDO_PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL;
  if (!raw)
    return {
      publicOrigin: null,
      bind: "127.0.0.1",
      secureCookies: false,
      accessRequired: false,
    };
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("SUDO_PUBLIC_ORIGIN must be a single HTTPS origin.");
  const accessMode = env.SUDO_DEMO_ACCESS || "password";
  if (accessMode !== "public" && accessMode !== "password")
    throw new Error("SUDO_DEMO_ACCESS must be public or password.");
  if (
    accessMode === "password" &&
    (!env.SUDO_DEMO_USERNAME ||
      !env.SUDO_DEMO_PASSWORD ||
      env.SUDO_DEMO_PASSWORD.length < 16)
  )
    throw new Error(
      "Hosted demos require SUDO_DEMO_USERNAME and a SUDO_DEMO_PASSWORD of at least 16 characters.",
    );
  return {
    publicOrigin: url.origin,
    bind: "0.0.0.0",
    secureCookies: true,
    accessRequired: accessMode === "password",
  };
}

export function demoAccess(username: string, password: string): RequestHandler {
  const expected = createHash("sha256")
    .update(`${username}:${password}`)
    .digest();
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const supplied = header.startsWith("Basic ")
      ? Buffer.from(header.slice(6), "base64").toString()
      : "";
    if (
      timingSafeEqual(expected, createHash("sha256").update(supplied).digest())
    )
      return next();
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="Sudo Launch demo", charset="UTF-8"',
    );
    res.setHeader("Cache-Control", "no-store");
    res
      .status(401)
      .send("This demo requires the access credentials supplied by its owner.");
  };
}
