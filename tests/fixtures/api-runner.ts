import { projectFiles } from "./projects";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Fixture processes must never read or write the developer's persistent launch memory.
if (!process.env.SUDO_DB_PATH) {
  const directory = mkdtempSync(join(tmpdir(), "sudo-api-fixture-"));
  process.env.SUDO_DB_PATH = join(directory, "launch.sqlite");
  process.once("SIGTERM", () => { rmSync(directory, { recursive: true, force: true }); process.exit(0); });
}
const sha = "a".repeat(40);
globalThis.fetch = async (input, init) => {
  const url = String(input);
  let data: unknown;
  if (url.startsWith("https://api.elevenlabs.io/v1/text-to-speech/") && process.env.SUDO_FIXTURE_AUDIO_PATH) {
    const text = String(JSON.parse(String(init?.body)).text), characters = [...text];
    return new Response(JSON.stringify({
      audio_base64: readFileSync(process.env.SUDO_FIXTURE_AUDIO_PATH).toString("base64"),
      normalized_alignment: {
        characters,
        character_start_times_seconds: characters.map((_, i) => i * 0.02),
        character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.02),
      },
    }));
  }
  if (url === "https://github.com/login/oauth/access_token")
    return new Response(
      JSON.stringify({ access_token: "fixture-private-token" }),
    );
  if (url === "https://api.github.com/user")
    return new Response(JSON.stringify({ login: "fixture-user" }));
  if (url.startsWith("https://generativelanguage.googleapis.com/"))
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify(String(init?.body).includes("bounded positioning specialist") ? {
                    angles:[0,1].map(i=>({title:`Prototype story ${i}`,audience:"Students",rationale:"Source-backed prototype",evidenceIds:["source-1"],linkedin:"A prototype seeking feedback.",x:"Try a prototype.",narration:"A prototype seeking useful feedback."})),limitations:["Runtime not verified"],
                  } : {
                    summary: "A source-based prototype",
                    suggestedBrief: {
                      audience: "Student developers",
                      goal: "Find five testers",
                      context: "A prototype, runtime unverified",
                    },
                    assumptions: [
                      "Audience is proposed, not a discovered fact",
                    ],
                    evidenceIds: ["source-1"],
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
  if (!url.startsWith("https://api.github.com/"))
    throw new Error("Unexpected external network request in test");
  const repo = url.match(/\/repos\/[^/]+\/([^/?]+)/)?.[1] || "app";
  const authorized =
    (init?.headers as Record<string, string>)?.Authorization ===
    "Bearer fixture-private-token";
  if (repo === "private" && !authorized)
    return new Response("{}", { status: 404 });
  const files =
    repo === "private"
      ? {
          "README.md": "Private fixture implementation",
          "package.json": projectFiles.app["package.json"],
          "src/App.tsx": "export default function App(){return 'Private'}",
          ".env": "secret=do-not-read",
        }
      : projectFiles[repo] || projectFiles.app;
  if (url.includes("/user/repos?"))
    return new Response(
      JSON.stringify([
        {
          name: "private",
          full_name: "fixture-user/private",
          description: "Private tool",
          private: true,
          fork: false,
          archived: false,
          size: 20,
          pushed_at: new Date().toISOString(),
        },
      ]),
    );
  if (/\/users\/[^/]+\/repos/.test(url))
    data = Object.keys(projectFiles).map((name) => ({
      name,
      full_name: `fixture/${name}`,
      description: `A ${name} project`,
      language: name === "python" ? "Python" : "TypeScript",
      private: false,
      fork: false,
      archived: false,
      size: 20,
      pushed_at: new Date().toISOString(),
      homepage: null,
    }));
  else if (url.includes("/search/repositories")) data = { items: [] };
  else if (url.includes("/commits/")) data = { sha };
  else if (url.includes("/git/trees/"))
    data = {
      tree: Object.keys(files).map((path) => ({
        path,
        type: "blob",
        size: files[path].length,
      })),
      truncated: false,
    };
  else if (url.includes("/contents/")) {
    const name = decodeURIComponent(url.split("/contents/")[1].split("?")[0]);
    data = {
      type: "file",
      encoding: "base64",
      content: Buffer.from(files[name]).toString("base64"),
    };
  } else
    data = {
      private: repo === "private",
      default_branch: "main",
      description: `Fixture ${repo}`,
      homepage: null,
    };
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
await import("../../server/index");
