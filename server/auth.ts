import { createHash, randomBytes } from "node:crypto";
import { AppError } from "./errors";
import { github } from "./github";
import { readResponse } from "./network";

type Connection = { token: string; login: string };
export class GitHubConnections {
  private connections = new Map<string, Connection>();
  private pending = new Map<
    string,
    {
      owner: string;
      nonce: string;
      verifier: string;
      callback: string;
      expires: number;
    }
  >();
  status(owner: string) {
    const connection = this.connections.get(owner);
    return { connected: !!connection, login: connection?.login };
  }
  get(owner: string) {
    return this.connections.get(owner);
  }
  disconnect(owner: string) {
    this.connections.delete(owner);
    for (const [state, entry] of this.pending)
      if (entry.owner === owner) this.pending.delete(state);
  }
  cleanup() {
    for (const [state, entry] of this.pending)
      if (entry.expires < Date.now()) this.pending.delete(state);
  }
  begin(owner: string, callback: string) {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET)
      throw new AppError(
        409,
        "GitHub OAuth setup is pending. Follow todo.md; a configured local read-only token is also supported.",
      );
    this.cleanup();
    // One pending authorization per session prevents unbounded storage and old callback reuse.
    for (const [state, entry] of this.pending)
      if (entry.owner === owner) this.pending.delete(state);
    const state = randomBytes(32).toString("hex");
    const nonce = randomBytes(32).toString("hex");
    const verifier = randomBytes(32).toString("base64url");
    this.pending.set(state, {
      owner,
      nonce,
      verifier,
      callback,
      expires: Date.now() + 600_000,
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: callback,
      scope: "repo",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return { url: url.toString(), nonce };
  }
  async finish(
    state: string,
    nonce: string,
    code: string,
    ownerActive: (owner: string) => boolean,
  ): Promise<string> {
    const entry = this.pending.get(state);
    if (
      !entry ||
      entry.expires < Date.now() ||
      !nonce ||
      nonce !== entry.nonce ||
      !ownerActive(entry.owner)
    )
      throw new AppError(
        400,
        "GitHub sign-in expired or state did not match. Start again from this browser.",
      );
    this.pending.delete(state); // One use, including failed exchanges.
    if (!code || code.length > 500)
      throw new AppError(
        400,
        "GitHub did not supply a valid authorization code.",
      );
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: entry.callback,
          code_verifier: entry.verifier,
        }),
      },
    );
    const data = JSON.parse(await readResponse(response, 20_000));
    if (!response.ok || typeof data.access_token !== "string" || data.error)
      throw new AppError(
        502,
        "GitHub rejected the authorization exchange. Check the OAuth app callback and retry.",
      );
    await this.connect(entry.owner, data.access_token);
    return entry.owner;
  }
  async connect(owner: string, token: string) {
    const user = await github("/user", token);
    if (typeof user.login !== "string")
      throw new AppError(502, "GitHub identity could not be confirmed.");
    this.connections.set(owner, { token, login: user.login });
  }
}
