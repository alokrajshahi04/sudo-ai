export const projectFiles: Record<string, Record<string, string>> = {
  app: {
    "package.json": JSON.stringify({
      dependencies: { react: "19", vite: "6" },
      scripts: { build: "vite build" },
    }),
    "src/App.tsx": "export default function App(){return <div>Hello</div>}",
    "README.md": "A student demo",
  },
  next: {
    "package.json": JSON.stringify({
      dependencies: { next: "15", react: "19" },
      scripts: { build: "next build" },
    }),
    "app/page.tsx":
      "export default function Page(){return <main>Feedback inbox</main>}",
    "README.md": "A Next.js team inbox",
  },
  python: {
    "pyproject.toml":
      '[project]\nname = "release-notes"\n[project.scripts]\nrelease-notes = "cli:main"',
    "cli.py": 'def main():\n    print("Release notes")',
    "README.md": "A Python release notes tool",
  },
  docs: {
    "README.md": "A prototype concept. Planned features are not implemented.",
    "index.html": "<h1>Coming soon</h1>",
  },
  workspace: {
    "package.json": JSON.stringify({ workspaces: ["apps/*"] }),
    "pnpm-workspace.yaml": "packages:\n  - apps/*",
    "README.md": "A workspace with multiple packages",
  },
  library: {
    "package.json": JSON.stringify({ exports: "./index.js" }),
    "README.md": "A small formatting library",
  },
};
