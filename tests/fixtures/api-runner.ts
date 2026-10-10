import { projectFiles } from "./projects";
const sha = "a".repeat(40);
globalThis.fetch = async (input) => {
  const url = String(input);
  let data: unknown;
  if (!url.startsWith("https://api.github.com/"))
    throw new Error("Unexpected external network request in test");
  const repo = url.match(/\/repos\/[^/]+\/([^/?]+)/)?.[1] || "app";
  const files = projectFiles[repo] || projectFiles.app;
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
      private: false,
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
