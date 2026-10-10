import { projectFiles } from "./projects";
const sha = "a".repeat(40);
globalThis.fetch = async (input, init) => {
  const url = String(input);
  let data: unknown;
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
                  text: JSON.stringify({
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
