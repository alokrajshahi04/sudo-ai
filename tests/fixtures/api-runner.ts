// Isolated test server: replace external GitHub access before importing the app.
const sha = "a".repeat(40);
const files: Record<string, string> = {
  "package.json": JSON.stringify({
    dependencies: { react: "19", vite: "6" },
    scripts: { build: "vite build" },
  }),
  "src/App.tsx": "export default function App(){return <div>Hello</div>}",
  "README.md": "A student demo",
};
globalThis.fetch = async (input) => {
  const url = String(input);
  let data: unknown;
  if (!url.startsWith("https://api.github.com/"))
    throw new Error("Unexpected external network request in test");
  if (url.includes("/search/repositories")) data = { items: [] };
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
    const name = url.split("/contents/")[1].split("?")[0];
    data = {
      type: "file",
      encoding: "base64",
      content: Buffer.from(files[name]).toString("base64"),
    };
  } else
    data = {
      private: false,
      default_branch: "main",
      description: "Fixture app",
      homepage: null,
    };
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
await import("../../server/index");

export {};
