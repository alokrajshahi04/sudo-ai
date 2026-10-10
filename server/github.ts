import { AppError, redact } from "./errors";
import { readResponse } from "./network";
import type { Inspection, Evidence } from "../shared/types";
export function parseRepo(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, "Use https://github.com/owner/repository.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname)
  )
    throw new AppError(
      400,
      "Use a public GitHub repository URL without a branch or query.",
    );
  const [owner, raw] = url.pathname.slice(1).split("/");
  const repo = raw.replace(/\.git$/, "");
  if (
    !owner ||
    !repo ||
    owner === "." ||
    owner === ".." ||
    repo === "." ||
    repo === ".."
  )
    throw new AppError(400, "Invalid repository path.");
  return { owner, repo, canonical: `https://github.com/${owner}/${repo}` };
}
export async function github(path: string): Promise<any> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "SudoLaunch/0.1",
      ...(process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok)
    throw new AppError(
      response.status === 404 ? 404 : 502,
      response.status === 404
        ? "Public repository or source file not found."
        : response.status === 403 || response.status === 429
          ? "GitHub rate limit or access restriction. Retry later or configure a local GitHub token."
          : "GitHub source request failed.",
    );
  return JSON.parse(await readResponse(response, 3_000_000));
}
export function classify(
  files: Record<string, string>,
): Pick<
  Inspection,
  "profile" | "buildCommand" | "outputDirectory" | "blockers" | "warnings"
> {
  let pkg: any;
  try {
    pkg = JSON.parse(files["package.json"] || "{}");
  } catch {
    throw new AppError(422, "Root package.json is invalid JSON.");
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const build =
    typeof pkg.scripts?.build === "string" ? pkg.scripts.build : null;
  const blockers: string[] = [];
  const warnings: string[] = [
    "Source inspection does not execute a build or verify runtime behavior.",
  ];
  const vite =
    !!deps.vite &&
    !!deps.react &&
    /(?:^|\s|&&)vite\s+build\b/.test(build || "");
  const profile =
    deps.next || deps.express || deps.fastify
      ? "server_web"
      : vite
        ? "static_vite"
        : "unknown";
  if (profile !== "static_vite")
    blockers.push(
      "Automatic static configuration is limited to root React/Vite projects. Use an existing live URL for other profiles.",
    );
  if (!build) blockers.push("No root build script was found.");
  const source = Object.values(files).join("\n");
  if (/VITE_[A-Z_]*(?:KEY|TOKEN|SECRET)/i.test(source))
    warnings.push(
      "A browser-public VITE variable appears to contain a credential name. Static bundles cannot protect API keys; assess that feature separately.",
    );
  if (/(?:fetch\(|axios\.|supabase|firebase)/i.test(source))
    warnings.push(
      "External-service calls were detected in the inspected files. Confirm backend/configuration availability before claiming the app is complete.",
    );
  const viteConfig =
    Object.entries(files).find(([name]) => /^vite\.config\./.test(name))?.[1] ||
    "";
  const match = viteConfig.match(/outDir\s*:\s*['"]([\w./-]+)['"]/);
  const outputDirectory =
    profile === "static_vite" ? match?.[1] || "dist" : null;
  if (/outDir\s*:/.test(viteConfig) && !match)
    blockers.push("Dynamic Vite output directory needs manual review.");
  if (/--outDir\b|--config\b|--mode\b/.test(build || ""))
    blockers.push(
      "Build script overrides require manual review before generating a static deployment plan.",
    );
  if (
    outputDirectory?.startsWith("/") ||
    outputDirectory?.split("/").includes("..")
  )
    blockers.push("Unsafe or unsupported output directory.");
  return {
    profile,
    buildCommand: build ? "npm run build" : null,
    outputDirectory,
    blockers,
    warnings,
  };
}
export async function inspect(repository: string): Promise<Inspection> {
  const { owner, repo, canonical } = parseRepo(repository);
  const root = `/repos/${owner}/${repo}`;
  const meta = await github(root);
  if (meta.private)
    throw new AppError(400, "Only public repositories are supported.");
  const commit = await github(
    `${root}/commits/${encodeURIComponent(meta.default_branch)}`,
  );
  const revision = commit.sha as string;
  const tree = await github(`${root}/git/trees/${revision}?recursive=1`);
  if (tree.truncated)
    throw new AppError(
      422,
      "Repository tree is too large for bounded inspection.",
    );
  const entries = (
    tree.tree as { path: string; type: string; size: number }[]
  ).filter((f) => f.type === "blob" && f.size <= 70_000);
  const preferred = [
    "package.json",
    "README.md",
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mts",
    "App.tsx",
    "src/App.tsx",
    "src/App.jsx",
    "src/main.tsx",
    "src/main.jsx",
    "index.html",
  ];
  const names = preferred.filter((name) =>
    entries.some((f) => f.path === name),
  );
  const services = entries
    .filter((f) =>
      /^(?:src\/)?(?:services|lib)\/[^/]+\.(?:ts|js)$/.test(f.path),
    )
    .slice(0, 2)
    .map((f) => f.path);
  const files: Record<string, string> = {};
  for (const name of [...names, ...services].slice(0, 10)) {
    const data = await github(`${root}/contents/${name}?ref=${revision}`);
    if (data.type === "file" && data.encoding === "base64")
      files[name] = redact(
        Buffer.from(data.content, "base64").toString("utf8"),
      ).slice(0, 16_000);
  }
  const now = new Date().toISOString();
  const evidence: Evidence[] = Object.entries(files).map(
    ([file, content], i) => ({
      id: `source-${i + 1}`,
      kind: "source",
      title: file,
      url: `${canonical}/blob/${revision}/${file}`,
      excerpt: content,
      checkedAt: now,
    }),
  );
  evidence.unshift({
    id: "repo-metadata",
    kind: "repository_metadata",
    title: "GitHub repository metadata",
    url: canonical,
    excerpt: redact(
      String(meta.description || "No description supplied."),
    ).slice(0, 1000),
    checkedAt: now,
  });
  return {
    revision,
    branch: meta.default_branch,
    ...classify(files),
    files: Object.keys(files),
    homepage:
      typeof meta.homepage === "string" && /^https:\/\//.test(meta.homepage)
        ? meta.homepage
        : null,
    description: redact(meta.description || ""),
    evidence,
  };
}
