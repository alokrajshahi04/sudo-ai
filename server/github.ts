import { AppError, redact } from "./errors";
import { readResponse } from "./network";
import type {
  Inspection,
  Evidence,
  ProjectCandidate,
  ProfileDiscovery,
} from "../shared/types";
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
      "Use a GitHub repository URL without a branch or query.",
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
export async function github(path: string, token?: string): Promise<any> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "SudoLaunch/0.1",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok)
    throw new AppError(
      response.status === 404 ? 404 : 502,
      response.status === 404
        ? "Repository or source not found, or your connection lacks access."
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
  let pkg: any = {};
  const blockers: string[] = [];
  const warnings: string[] = [
    "Source inspection does not execute code or verify runtime behavior.",
  ];
  try {
    pkg = JSON.parse(files["package.json"] || "{}");
  } catch {
    warnings.push(
      "Root package.json could not be parsed. Marketing claims must use the other available evidence.",
    );
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const build =
    typeof pkg.scripts?.build === "string" ? pkg.scripts.build : null;
  const vite = !!deps.vite && !!deps.react;
  const python =
    (files["pyproject.toml"] || "") + "\n" + (files["requirements.txt"] || "");
  const readme = Object.entries(files).find(([name]) =>
    /^readme\.(md|rst|txt)$/i.test(name),
  )?.[1];
  let profile: Inspection["profile"] = "unknown";
  if (
    pkg.workspaces ||
    files["pnpm-workspace.yaml"] ||
    files["docker-compose.yml"] ||
    files["compose.yaml"]
  )
    profile = "multi_service";
  else if (
    deps.next ||
    deps.express ||
    deps.fastify ||
    /fastapi|django|flask/i.test(python)
  )
    profile = "server_web";
  else if (vite) profile = "static_vite";
  else if (files["pyproject.toml"] || files["requirements.txt"])
    profile = "python_cli";
  else if (pkg.bin || pkg.exports || files["Cargo.toml"] || files["go.mod"])
    profile = "library_cli";
  else if (readme && !files["package.json"]) profile = "documentation";
  if (profile === "unknown")
    warnings.push(
      "Project type is uncertain from inspected files. Ask the owner rather than assuming implementation or launch readiness.",
    );
  if (!readme)
    warnings.push(
      "No root README was inspected. Supply a product brief to explain the intended user and supported behavior.",
    );
  if (/coming soon|planned|todo|roadmap/i.test(readme || ""))
    warnings.push(
      "README includes planning language. Separate proposed features from implemented capabilities.",
    );
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
    warnings.push(
      "Dynamic Vite output directory needs developer review if the owner publishes the app.",
    );
  if (/--outDir\b|--config\b|--mode\b/.test(build || ""))
    warnings.push(
      "Build script overrides require developer review before the owner publishes the app.",
    );
  if (
    outputDirectory?.startsWith("/") ||
    outputDirectory?.split("/").includes("..")
  )
    warnings.push(
      "Output directory requires developer review; Sudo Launch does not execute builds.",
    );
  return {
    profile,
    buildCommand: build ? "npm run build" : null,
    outputDirectory,
    blockers,
    warnings,
  };
}
export async function inspect(
  repository: string,
  token?: string,
  privateConsent = false,
  progress: (step: string) => void = () => {},
): Promise<Inspection> {
  const { owner, repo, canonical } = parseRepo(repository);
  const root = `/repos/${owner}/${repo}`;
  progress("Reading repository metadata");
  const meta = await github(root, token);
  if (meta.private && (!token || !privateConsent))
    throw new AppError(
      409,
      "Connect GitHub and approve private-source analysis before reading this private repository.",
    );
  progress("Pinning source revision");
  const commit = await github(
    `${root}/commits/${encodeURIComponent(meta.default_branch)}`,
    token,
  );
  const revision = commit.sha as string;
  progress("Reading the file tree");
  const tree = await github(`${root}/git/trees/${revision}?recursive=1`, token);
  if (tree.truncated)
    throw new AppError(
      422,
      "Repository tree is too large for bounded inspection.",
    );
  const entries = (
    tree.tree as { path: string; type: string; size: number }[]
  ).filter(
    (f) =>
      f.type === "blob" &&
      f.size <= 70_000 &&
      !/(?:^|\/)(?:\.env|credentials|secrets)(?:[./]|$)/i.test(f.path),
  );
  const preferred = [
    "README.md",
    "readme.md",
    "README.rst",
    "README.txt",
    "LICENSE",
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "Cargo.toml",
    "go.mod",
    "pnpm-workspace.yaml",
    "docker-compose.yml",
    "compose.yaml",
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mts",
    "App.tsx",
    "src/App.tsx",
    "src/App.jsx",
    "app/page.tsx",
    "src/app/page.tsx",
    "pages/index.tsx",
    "src/pages/index.tsx",
    "main.py",
    "app/main.py",
    "src/main.py",
    "cli.py",
    "src/main.rs",
    "main.go",
    "index.html",
  ];
  const names = preferred.filter((name) =>
    entries.some((f) => f.path === name),
  );
  const extras = entries
    .filter((f) =>
      /^(?:src\/)?(?:services|lib)\/[^/]+\.(?:ts|js|py)$/.test(f.path),
    )
    .slice(0, 2)
    .map((f) => f.path);
  const files: Record<string, string> = {};
  for (const name of [...names, ...extras].slice(0, 12)) {
    progress(`Reading ${name}`);
    const data = await github(
      `${root}/contents/${name.split("/").map(encodeURIComponent).join("/")}?ref=${revision}`,
      token,
    );
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
    private: !!meta.private,
    treePaths: entries
      .map((f) => f.path)
      .filter(
        (path) =>
          !/(?:^|\/)(?:\.env|node_modules|\.git|credentials|secrets)(?:[./]|$)/i.test(
            path,
          ),
      )
      .slice(0, 3000),
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

export function rankProjects(
  items: any[],
  includePrivate = false,
): ProjectCandidate[] {
  return items
    .filter(
      (item) =>
        (includePrivate || !item.private) &&
        !item.fork &&
        !item.archived &&
        item.size > 0,
    )
    .map((item) => {
      const description = redact(String(item.description || "")).slice(0, 600);
      const homepage =
        typeof item.homepage === "string" && /^https:\/\//.test(item.homepage)
          ? item.homepage
          : null;
      const reasons: string[] = [];
      let score = 0;
      if (description) {
        score += 3;
        reasons.push("Product description available");
      }
      if (homepage) {
        score += 2;
        reasons.push("Listed homepage — not verified");
      }
      if (item.language) {
        score += 1;
        reasons.push("Source language detected");
      }
      if (Date.now() - Date.parse(item.pushed_at) < 90 * 86400_000) {
        score += 2;
        reasons.push("Updated in the last 90 days");
      }
      return {
        private: !!item.private,
        name: item.name,
        repository: `https://github.com/${item.full_name}`,
        description,
        language: item.language || null,
        homepage,
        updatedAt: item.pushed_at,
        score,
        reasons,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
}
export async function discoverProfile(
  username: string,
): Promise<ProfileDiscovery> {
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username))
    throw new AppError(400, "Enter a GitHub username, not a profile URL.");
  const items = await github(
    `/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&per_page=100`,
  );
  if (!Array.isArray(items))
    throw new AppError(
      502,
      "GitHub profile discovery returned an unexpected response.",
    );
  return {
    username,
    projects: rankProjects(items).slice(0, 30),
    checkedAt: new Date().toISOString(),
    coverage:
      "Up to 100 recently pushed public owned repositories; up to 30 non-fork, non-archived, non-empty projects shown. Ranking is metadata-based, not a judgment of product quality, readiness, or originality.",
  };
}

export async function discoverConnected(
  token: string,
  login: string,
): Promise<ProfileDiscovery> {
  const items = await github(
    "/user/repos?type=all&sort=pushed&per_page=100",
    token,
  );
  if (!Array.isArray(items))
    throw new AppError(502, "GitHub returned an unexpected repository list.");
  return {
    username: login,
    projects: rankProjects(items, true).slice(0, 30),
    checkedAt: new Date().toISOString(),
    coverage:
      "Up to 100 recently pushed repositories accessible to your connection, including private projects; up to 30 non-fork, non-archived, non-empty projects shown. Source is read only after you choose a project and approve private analysis.",
  };
}
