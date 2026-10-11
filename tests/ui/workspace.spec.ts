import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Job, ModelProvider } from "../../shared/types";

function fixture(
  name = "community-tool",
  profile: NonNullable<Job["inspection"]>["profile"] = "documentation",
): Job {
  return {
    id: "ui-fixture",
    name,
    repository: "https://github.com/developer/" + name,
    brief: "Audience: Open-source maintainers\nLaunch goal: Find five testers",
    launchBrief: {
      audience: "Open-source maintainers",
      goal: "Find five testers",
      context: "",
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    phases: Object.fromEntries(
      [
        "inspect",
        "analyze",
        "music",
        "research",
        "position",
        "verify",
        "recording",
        "narrate",
        "render",
      ].map((phase) => [
        phase,
        { state: phase === "inspect" ? "completed" : "idle" },
      ]),
    ) as Job["phases"],
    selectedAngle: 0,
    modelPreference: "google",
    artifacts: [],
    inspection: {
      revision: "a".repeat(40),
      branch: "main",
      profile,
      buildCommand: null,
      outputDirectory: null,
      files: ["README.md"],
      blockers: [],
      warnings: ["README claims need review."],
      homepage: null,
      description: "A project for coordinating community work.",
      evidence: [
        {
          id: "source-readme",
          kind: "source",
          title: "README.md",
          url: "https://github.com/developer/" + name + "/blob/main/README.md",
          excerpt: "Documented project capabilities.",
          checkedAt: new Date().toISOString(),
        },
      ],
    },
  };
}
function positioning(): Job["positioning"] {
  return {
    provider: "google",
    model: "fixture-model",
    generatedAt: new Date().toISOString(),
    limitations: ["Review README claims before posting."],
    angles: [0, 1].map((i) => ({
      title: i
        ? "Make community work easier to join"
        : "Bring community work together",
      audience: "Open-source maintainers",
      rationale: i
        ? "Help new contributors find their next task."
        : "Coordinate community work from one place.",
      evidenceIds: ["source-readme"],
      linkedin: "LinkedIn draft for story " + (i + 1),
      x: "X draft for story " + (i + 1),
      narration: "A narrated community workflow for story " + (i + 1),
    })),
  };
}
async function mockApi(
  page: Page,
  options: {
    configured?: boolean;
    restored?: Job;
    failResearch?: boolean;
    failPosition?: boolean;
    showWelcome?: boolean;
    media?: boolean;
    apiOffline?: boolean;
    defaultProvider?: ModelProvider;
  } = {},
) {
  if (!options.showWelcome)
    await page.addInitScript(() =>
      localStorage.setItem("sudo-welcome-v1", "seen"),
    );
  let job = options.restored ? structuredClone(options.restored) : fixture();
  let created = !!options.restored;
  const calls: string[] = [];
  const controls = {
    failResearch: !!options.failResearch,
    failPosition: !!options.failPosition,
    apiOffline: !!options.apiOffline,
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method === "POST") calls.push(path.split("/").pop()!);
    let data: unknown;
    if (
      controls.apiOffline &&
      (path.endsWith("/capabilities") || path.endsWith("/discover"))
    ) {
      await route.fulfill({
        status: 503,
        json: {
          error: "Local API is unavailable. Start npm run dev and retry.",
        },
      });
      return;
    }
    if (path.endsWith("/capabilities"))
      data = {
        mode: "local",
        defaultModelProvider: options.defaultProvider,
        models: [
          {
            provider: "google",
            model: "fixture-model",
            configured: options.configured ?? true,
          },
          {
            provider: "nebius",
            model: "zai-org/GLM-5.3-Flash",
            configured: options.configured ?? true,
          },
        ],
        githubAuth: {
          configured: false,
          connected: false,
          localTokenAvailable: false,
        },
        narration: !!options.media,
        render: !!options.media,
        promo: !!options.media,
        capture: !!options.media,
        music: !!options.media,
        hostedCredentialEntry: false,
        research: "public",
      };
    else if (path.endsWith("/discover"))
      data = {
        username: "developer",
        checkedAt: new Date().toISOString(),
        coverage: "Public metadata only.",
        projects: [
          {
            name: "community-tool",
            repository: fixture().repository,
            description: "A project for coordinating community work.",
            language: "TypeScript",
            homepage: null,
            updatedAt: new Date().toISOString(),
            score: 2,
            reasons: ["Description available"],
          },
          {
            name: "release-cli",
            repository: fixture("release-cli").repository,
            description: "A Python release tool.",
            language: "Python",
            homepage: null,
            updatedAt: new Date().toISOString(),
            score: 1,
            reasons: ["Recently updated"],
          },
        ],
      };
    else if (path.endsWith("/jobs")) {
      if (method === "POST") {
        const body = route.request().postDataJSON();
        const name = body.repository.split("/").pop();
        job = fixture(
          name,
          name === "release-cli" ? "python_cli" : "documentation",
        );
        job.launchBrief = body.launchBrief;
        job.modelPreference = body.model ?? "google";
        if (body.demoUrl)
          job.site = {
            url: body.demoUrl,
            finalUrl: body.demoUrl,
            httpStatus: 200,
            reachable: true,
            title: "Fixture",
            checkedAt: new Date().toISOString(),
            builtRevision: null,
            interaction: "not_checked",
          };
        job.brief = body.brief || "";
        if (options.configured ?? true) {
          job.analysis = {
            summary:
              "A community coordination project described by its source.",
            suggestedBrief: {
              audience: "Open-source maintainers",
              goal: "Find five testers",
              context: "",
            },
            assumptions: ["Audience and goal are suggestions; confirm them."],
            evidenceIds: ["source-readme"],
            provider: "google",
            model: "fixture-model",
            generatedAt: new Date().toISOString(),
          };
          job.phases.analyze = { state: "completed" };
        }
        job.repoFirst = true;
        created = true;
        data = job;
      } else data = created ? [job] : [];
    } else if (method === "POST" && path.endsWith("/brief")) {
      const input = route.request().postDataJSON();
      if (JSON.stringify(input) !== JSON.stringify(job.launchBrief)) {
        job.positioning = undefined;
        job.launchStrategy = undefined;
      }
      job.launchBrief = input;
      job.brief =
        "Audience: " + input.audience + "\nLaunch goal: " + input.goal;
      data = job;
    } else if (method === "POST" && path.endsWith("/inspect")) {
      job.inspection = fixture(job.name).inspection;
      job.phases.inspect = { state: "completed" };
      data = job;
    } else if (method === "POST" && path.endsWith("/research")) {
      job.phases.research = { state: "running" };
      job.positioning = undefined;
      job.launchStrategy = undefined;
      data = job;
    } else if (method === "POST" && path.endsWith("/position")) {
      job.phases.position = { state: "running" };
      data = job;
    } else if (method === "POST" && path.endsWith("/angle")) {
      job.selectedAngle = route.request().postDataJSON().index;
      job.launchStrategy = undefined;
      data = job;
    } else if (method === "POST" && path.endsWith("/storyboard")) {
      job.storyboard = {
        duration: 25,
        scenes: [
          {
            label: "THE HOOK",
            heading: "Bring community work together",
            detail: "For maintainers",
            seconds: 3,
          },
          {
            label: "MEET THE PROJECT",
            heading: job.name,
            detail: "A source-based project",
            seconds: 5,
          },
          {
            label: "FROM THE SOURCE",
            heading: "README.md",
            detail: "Actual source excerpt",
            seconds: 12,
          },
          {
            label: "YOUR NEXT STEP",
            heading: "Find five testers",
            detail: job.repository,
            seconds: 5,
          },
        ],
        sourceVisual: {
          file: "README.md",
          excerpt: "Documented project capabilities.",
        },
        cta: job.repository,
        workflow: "Brag-inspired",
      };
      data = job;
    } else if (method === "POST" && path.endsWith("/readiness-review")) {
      job.readinessReviewedAt = new Date().toISOString();
      data = job;
    } else if (method === "POST" && path.endsWith("/launch-mode")) {
      job.launchMode = route.request().postDataJSON().mode;
      data = job;
    } else if (method === "POST" && path.endsWith("/verify")) {
      const url = route.request().postDataJSON().url;
      job.site = {
        url,
        finalUrl: url,
        httpStatus: 200,
        reachable: true,
        title: "Fixture demo",
        checkedAt: new Date().toISOString(),
        builtRevision: null,
        interaction: "not_checked",
      };
      data = job;
    } else if (method === "POST" && path.endsWith("/capture")) {
      const body = route.request().postDataJSON();
      job.capture = {
        url: body.url,
        capturedAt: new Date().toISOString(),
        steps: ["Opened the public page"],
        format: body.format,
        coverage: "Fixture capture for UI behavior only.",
      };
      job.artifacts = [
        {
          type: "recording",
          url: "/fixture-video.webm",
          provenance: "UI fixture",
        },
        {
          type: "screenshot",
          url: "/fixture-image.png",
          provenance: "UI fixture",
        },
      ];
      data = job;
    } else if (method === "POST" && path.endsWith("/promo")) {
      job.phases.render = { state: "running" };
      data = job;
    } else if (method === "POST" && path.endsWith("/music")) {
      job.phases.music = {
        state: "failed",
        error: "Music access is unavailable for this key.",
      };
      data = job;
    } else if (method === "POST" && path.endsWith("/strategy")) {
      job.launchStrategy = {
        launchType: "showcase",
        angleTitle: job.positioning?.angles[job.selectedAngle].title || null,
        createdAt: new Date().toISOString(),
        checklist: ["Review every claim", "Share your demo"],
        channels: [
          {
            name: "LinkedIn",
            purpose: "Tell the project story",
            timing: "Launch day",
          },
        ],
      };
      data = job;
    } else {
      if (job.phases.research.state === "running") {
        job.phases.research = controls.failResearch
          ? {
              state: "failed",
              error: "A supplied research page is not reachable.",
            }
          : { state: "completed" };
        if (!controls.failResearch)
          job.research = {
            query: job.name,
            sources: [],
            coverage: "No matches found in bounded research.",
          };
      }
      if (job.phases.position.state === "running") {
        job.phases.position = controls.failPosition
          ? {
              state: "failed",
              error: "The model returned unsupported evidence.",
            }
          : { state: "completed" };
        if (!controls.failPosition) job.positioning = positioning();
      }
      if (job.phases.render.state === "running") {
        job.phases.render = { state: "completed" };
        job.artifacts = [
          {
            type: "video",
            url: "/fixture-video.mp4",
            provenance: "Fixture source-card render; no runtime verification.",
          },
          {
            type: "poster",
            url: "/fixture-poster.png",
            provenance: "Fixture poster.",
          },
        ];
      }
      data = job;
    }
    await route.fulfill({ json: data });
  });
  return { calls, controls, getJob: () => job };
}
async function fillBrief(page: Page, repository: string) {
  const dialog = page.getByRole("dialog", { name: "New launch" });
  await dialog
    .getByLabel("GitHub repository", { exact: true })
    .fill(repository);
  await dialog.getByRole("button", { name: "Read my project →" }).click();
  await expect(
    page.getByRole("heading", { name: "Let’s understand your project." }),
  ).toBeVisible();
  // Editable confirmation remains available even when no model is configured.
  await page.getByLabel("Who is it for?").fill("Open-source maintainers");
  await page
    .getByLabel("What should this launch achieve?")
    .fill("Find five testers");
}
async function assertWorkspaceFits(page: Page) {
  const layout = await page.evaluate(() => {
    const pane = document
      .querySelector(".stage-content")!
      .getBoundingClientRect();
    return {
      horizontal: document.documentElement.scrollWidth > innerWidth,
      vertical: document.documentElement.scrollHeight > innerHeight,
      contentHeight: pane.height,
      commandVisible: !!document.querySelector(".command-popup"),
    };
  });
  expect(layout.horizontal).toBe(false);
  expect(layout.vertical).toBe(false);
  expect(layout.contentHeight).toBeGreaterThan(430);
  expect(layout.commandVisible).toBe(false);
}

for (const name of ["community-tool", "release-cli"]) {
  test(
    name + ": profile to reviewed launch kit without commands",
    async ({ page }, testInfo) => {
      const backend = await mockApi(page);
      await page.goto("/");
      await page.getByRole("button", { name: "Find my projects ↗" }).click();
      await page.getByLabel("GitHub username").fill("developer");
      await page
        .getByRole("button", { name: "Find projects →", exact: true })
        .click();
      const candidate = page
        .locator(".project-candidate")
        .filter({ has: page.getByRole("heading", { name, exact: true }) });
      await candidate
        .getByRole("button", { name: "Prepare this project’s launch →" })
        .click();
      await expect(
        page
          .getByRole("dialog", { name: "New launch" })
          .getByLabel("GitHub repository", { exact: true }),
      ).toHaveValue(fixture(name).repository);
      expect(backend.calls).not.toContain("jobs");
      await fillBrief(page, fixture(name).repository);
      await assertWorkspaceFits(page);
      await expect(
        page.getByRole("button", { name: "Continue to launch stories →" }),
      ).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath("01-brief.png") });
      await page
        .getByRole("button", { name: "Continue to launch stories →" })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Choose how to introduce your project.",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Generate two launch stories →" }),
      ).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath("02-before-generation.png"),
      });
      await page
        .getByRole("button", { name: "Generate two launch stories →" })
        .click();
      await expect(
        page.getByRole("group", { name: "Launch story choices" }),
      ).toBeVisible();
      expect(backend.calls.indexOf("research")).toBeLessThan(
        backend.calls.indexOf("position"),
      );
      await page.getByRole("button", { name: /STORY 02/ }).click();
      await expect(
        page.getByRole("button", { name: /STORY 02/ }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByRole("button", {
          name: "Use this story & prepare my pack →",
        }),
      ).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath("03-stories.png") });
      await page
        .getByRole("button", { name: "Use this story & prepare my pack →" })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Review it. Make it yours. Launch.",
        }),
      ).toBeVisible();
      await expect(
        page.getByLabel("LinkedIn post", { exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("X post", { exact: true })).toBeVisible();
      expect(backend.calls).toContain("strategy");
      expect(
        await page.locator(".media-addon").getAttribute("open"),
      ).toBeNull();
      await page.screenshot({ path: testInfo.outputPath("04-pack.png") });
      const waiting = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download text draft ↓" }).click();
      const download = await waiting;
      const kit = await readFile((await download.path())!, "utf8");
      expect(kit).toContain("LinkedIn draft for story 2");
      expect(kit).toContain("- [ ] Review every claim");
      expect(kit).toContain("source-readme: README.md");
      expect(kit).toContain("Model: google / fixture-model");
      await page.getByText("Create a launch video", { exact: true }).click();
      await expect(page.getByLabel("Upload recording")).toBeVisible();
      await assertWorkspaceFits(page);
    },
  );
}
test("missing model gives an actionable setup state; commands remain optional", async ({
  page,
}, testInfo) => {
  const backend = await mockApi(page, { configured: false });
  await page.goto("/");
  await page
    .getByRole("button", { name: "or start with a repository →" })
    .click();
  await fillBrief(page, fixture().repository);
  await page
    .getByRole("button", { name: "Continue to launch stories →" })
    .click();
  await expect(
    page.getByRole("button", { name: "Generate two launch stories →" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open model setup →" }),
  ).toBeInViewport();
  await expect(
    page.getByText("Connect a model to generate stories.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open model setup →" }).click();
  await expect(
    page.getByRole("dialog", { name: "Model preferences" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(backend.calls).not.toContain("position");
  await page.screenshot({
    path: testInfo.outputPath("model-setup-needed.png"),
  });
  await page.getByRole("button", { name: /Commands/ }).click();
  const command = page.getByRole("combobox", { name: "Launch command" });
  await command.fill("/status");
  await command.press("Enter");
  await expect(command).toHaveCount(0);
  await page.getByRole("button", { name: /Commands/ }).click();
  await page.getByRole("combobox", { name: "Launch command" }).press("Escape");
  await expect(
    page.getByRole("combobox", { name: "Launch command" }),
  ).toHaveCount(0);
});

test("research failure stops generation and can be retried", async ({
  page,
}, testInfo) => {
  const backend = await mockApi(page, {
    restored: fixture(),
    failResearch: true,
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continue to launch stories →" })
    .click();
  await page
    .getByRole("button", { name: "Generate two launch stories →" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "A supplied research page is not reachable.",
  );
  expect(backend.calls).not.toContain("position");
  await page.screenshot({ path: testInfo.outputPath("research-error.png") });
  backend.controls.failResearch = false;
  await page
    .getByRole("button", { name: "Generate two launch stories →" })
    .click();
  await expect(
    page.getByRole("group", { name: "Launch story choices" }),
  ).toBeVisible();
});

test("legacy incomplete briefs require a real audience and goal; corrected work can resume", async ({
  page,
}) => {
  const legacy = fixture();
  legacy.launchBrief = undefined;
  legacy.brief = "Product context: A project idea\nAudience and launch goal: ";
  const backend = await mockApi(page, { restored: legacy });
  await page.goto("/");
  await expect(
    page
      .getByRole("navigation", { name: "Launch progress" })
      .getByRole("button", { name: /Launch story/ }),
  ).toBeDisabled();
  await expect(page.getByLabel("Who is it for?")).toHaveValue("");
  await page.getByLabel("Who is it for?").fill("First-time contributors");
  await page
    .getByLabel("What should this launch achieve?")
    .fill("Get feedback on onboarding");
  await page
    .getByRole("button", { name: "Continue to launch stories →" })
    .click();
  expect(backend.getJob().launchBrief?.audience).toBe(
    "First-time contributors",
  );
  await page.getByRole("button", { name: "Sudo Launch home" }).click();
  await page
    .getByRole("button", { name: /community-tool.*Continue your brief/ })
    .click();
  await expect(page.getByLabel("Who is it for?")).toHaveValue(
    "First-time contributors",
  );
});

test("optional research can be skipped; model failure stays actionable", async ({
  page,
}) => {
  const backend = await mockApi(page, {
    restored: fixture(),
    failPosition: true,
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continue to launch stories →" })
    .click();
  await page.getByText("Research settings", { exact: false }).first().click();
  await page.getByLabel("Research related projects before writing").uncheck();
  await page
    .getByRole("button", { name: "Generate two launch stories →" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "The model returned unsupported evidence.",
  );
  expect(backend.calls).not.toContain("research");
  await expect(
    page.getByRole("group", { name: "Launch story choices" }),
  ).toHaveCount(0);
  backend.controls.failPosition = false;
  await page
    .getByRole("button", { name: "Generate two launch stories →" })
    .click();
  await expect(
    page.getByRole("group", { name: "Launch story choices" }),
  ).toBeVisible();
  expect(backend.calls.filter((name) => name === "position")).toHaveLength(2);
});

test("source failure explains the blocked action and retries without model spending", async ({
  page,
}) => {
  const failed = fixture();
  failed.inspection = undefined;
  failed.phases.inspect = {
    state: "failed",
    error: "Repository source is unavailable.",
  };
  const backend = await mockApi(page, { restored: failed });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Repository source is unavailable.",
  );
  await expect(
    page.getByRole("button", { name: "Continue to launch stories →" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry reading the repository →" })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue to launch stories →" }),
  ).toBeEnabled();
  expect(backend.calls).not.toContain("position");
  const audience = page.getByLabel("Who is it for?");
  await audience.focus();
  await audience.press("Control+k");
  await expect(
    page.getByRole("combobox", { name: "Launch command" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Launch command" }).press("Escape");
  await expect(
    page.getByRole("combobox", { name: "Launch command" }),
  ).toHaveCount(0);
});

test("configured default applies to old jobs and explicit model choice survives reload", async ({
  page,
}) => {
  await mockApi(page, { restored: fixture(), defaultProvider: "nebius" });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const select = page
    .getByRole("dialog", { name: "Model preferences" })
    .getByLabel("Model provider");
  await expect(select).toHaveValue("nebius");
  await expect(select).toContainText("zai-org/GLM-5.3-Flash");
  await select.selectOption("google");
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(select).toHaveValue("google");
  await select.selectOption("nebius");
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(select).toHaveValue("nebius");
});

test("first-visit guide explains the product and slash shortcut, then stays dismissed", async ({
  page,
}, testInfo) => {
  await mockApi(page, { showWelcome: true });
  await page.goto("/");
  const welcome = page.getByRole("dialog", { name: "Welcome to Sudo Launch" });
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText("reads your GitHub project");
  await expect(welcome).toContainText("open commands");
  await page.screenshot({ path: testInfo.outputPath("welcome.png") });
  await welcome.getByRole("button", { name: "Explore first →" }).click();
  await page.reload();
  await expect(welcome).not.toBeVisible();
  await page.keyboard.press("/");
  await expect(
    page.getByRole("combobox", { name: "Launch command" }),
  ).toBeVisible();
});
test("repo-first model suggestions are editable and require owner confirmation", async ({
  page,
}) => {
  const backend = await mockApi(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "or start with a repository →" })
    .click();
  const dialog = page.getByRole("dialog", { name: "New launch" });
  await expect(dialog.getByLabel("Who is it for?")).toHaveCount(0);
  await dialog
    .getByLabel("GitHub repository", { exact: true })
    .fill(fixture().repository);
  await dialog.getByRole("button", { name: "Read my project →" }).click();
  await expect(page.getByLabel("Who is it for?")).toHaveValue(
    "Open-source maintainers",
  );
  expect(backend.getJob().launchBrief).toBeUndefined();
  await expect(
    page.getByRole("navigation").getByRole("button", { name: /Launch story/ }),
  ).toBeDisabled();
  await page.getByLabel("Who is it for?").fill("New contributors");
  await page
    .getByRole("button", { name: "Continue to launch stories →" })
    .click();
  expect(backend.getJob().launchBrief?.audience).toBe("New contributors");
});
test("promo storyboard gates rendering; music failure preserves the text pack", async ({
  page,
}, testInfo) => {
  const job = fixture();
  job.positioning = positioning();
  job.launchStrategy = {
    launchType: "showcase",
    angleTitle: "Bring community work together",
    checklist: [],
    channels: [],
    createdAt: new Date().toISOString(),
  };
  const backend = await mockApi(page, { restored: job, media: true });
  await page.route("**/fixture-video.mp4", (route) => route.abort());
  await page.goto("/");
  await page.getByText("Create a launch video", { exact: true }).click();
  await page.getByText("Review & render", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Render launch promo →" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Prepare video storyboard →" })
    .click();
  await expect(page.getByLabel("Video storyboard")).toBeVisible();
  await page.getByText("Voice & captions", { exact: true }).click();
  await page.getByText("Optional background music", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Generate music bed →" }),
  ).toBeDisabled();
  await page
    .getByText(
      "I approve sending this prompt to ElevenLabs and using my music quota.",
      { exact: true },
    )
    .click();
  await page.getByRole("button", { name: "Generate music bed →" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Music access is unavailable",
  );
  await expect(page.getByLabel("LinkedIn post", { exact: true })).toBeVisible();
  await page.getByText("Review & render", { exact: true }).click();
  await page.getByRole("button", { name: "Render launch promo →" }).click();
  await expect(
    page.getByRole("link", { name: "Download video ↓" }),
  ).toBeVisible();
  expect(backend.calls).toContain("promo");
  await page.screenshot({ path: testInfo.outputPath("promo-studio.png") });
});

test("API outage is explained in discovery and recovers without reloading or GitHub sign-in", async ({
  page,
}, testInfo) => {
  const backend = await mockApi(page, { apiOffline: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Find my projects ↗" }).click();
  await expect(page.locator(".api-connection-warning")).toContainText(
    "does not need GitHub sign-in",
  );
  await page.getByLabel("GitHub username").fill("developer");
  const discover = page.getByRole("button", {
    name: "Find projects →",
    exact: true,
  });
  await expect(discover).toBeEnabled();
  await discover.click();
  await expect(page.getByRole("alert")).toContainText(
    "Local API is unavailable",
  );
  await page.screenshot({
    path: testInfo.outputPath("api-offline-discovery.png"),
  });
  backend.controls.apiOffline = false;
  await page.getByRole("button", { name: "Retry API connection" }).click();
  await expect(page.locator(".api-connection-warning")).toHaveCount(0);
  await expect(page.getByLabel("GitHub username")).toHaveValue("developer");
  await discover.click();
  await expect(
    page.getByRole("heading", { name: "community-tool", exact: true }),
  ).toBeVisible();
});

test("readiness panel is absent and web projects generate stories without a review or demo gate", async ({
  page,
}, testInfo) => {
  const job = fixture("web-product", "static_vite");
  job.launchMode = "live";
  job.readiness = {
    coverage: "Legacy source review",
    agentPrompt: "Legacy prompt",
    findings: [
      {
        id: "ai-1",
        origin: "ai",
        severity: "review",
        title: "Review browser credentials",
        detail: "Old finding",
        files: ["src/App.tsx"],
        evidenceIds: ["source-readme"],
      },
    ],
  };
  const backend = await mockApi(page, { restored: job });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Check project readiness →" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Review browser credentials", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Continue to launch stories →" })
    .click();
  await page.getByText("Research settings", { exact: false }).first().click();
  await page.getByLabel("Research related projects before writing").uncheck();
  await page
    .getByRole("button", { name: "Generate two launch stories →" })
    .click();
  await expect(
    page.getByRole("button", { name: /Bring community work together/ }),
  ).toBeVisible();
  expect(backend.calls).toContain("position");
  expect(backend.calls).not.toContain("readiness-review");
  expect(backend.calls).not.toContain("verify");
  await page.screenshot({
    path: testInfo.outputPath("no-readiness-panel.png"),
  });
});
test("deployed capture requires reviewed steps and keeps footage visible before rendering", async ({
  page,
}, testInfo) => {
  const job = fixture();
  job.positioning = positioning();
  job.launchStrategy = {
    launchType: "showcase",
    angleTitle: job.positioning!.angles[0].title,
    createdAt: new Date().toISOString(),
    checklist: [],
    channels: [],
  };
  const backend = await mockApi(page, { restored: job, media: true });
  await page.goto("/");
  await page.getByText("Create a launch video", { exact: true }).click();
  await page.getByText("Review & render", { exact: true }).click();
  await expect(page.getByLabel("Video format", { exact: true })).toHaveValue(
    "portrait",
  );
  await page.getByText("Product visuals", { exact: true }).click();
  await page.getByText("Record from a deployed URL", { exact: true }).click();
  await page
    .getByLabel("Public demo URL", { exact: true })
    .fill("https://demo.example");
  await page.getByLabel("Buttons to click", { exact: false }).fill("Show demo");
  const recordButton = page.getByRole("button", {
    name: "Record deployed demo →",
  });
  await expect(recordButton).toBeDisabled();
  await page
    .getByLabel(
      "I reviewed these steps and approve recording this public demo.",
    )
    .check();
  await recordButton.click();
  await expect(
    page.getByText("✓ Real footage captured", { exact: true }),
  ).toBeVisible();
  expect(backend.calls).toContain("capture");
  await expect(
    page.getByLabel("Use my recording in the middle scene"),
  ).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("capture-flow.png") });
});

test("repository demo offers consented automatic recording without exact-step setup", async ({
  page,
}) => {
  const job = fixture();
  job.inspection!.homepage = "https://demo.example/";
  job.positioning = positioning();
  const backend = await mockApi(page, { restored: job, media: true });
  await page.goto("/");
  await page.getByRole("button", {name: "3 Launch pack"}).click();
  await page.getByText("Create a launch video", { exact: true }).click();
  const button = page.getByRole("button", {
    name: "Auto-record product demo →",
  });
  await expect(button).toBeDisabled();
  await page
    .getByLabel(
      "I approve public browser recording and model usage for the capture plan.",
    )
    .check();
  await expect(button).toBeEnabled();
  await button.click();
  await expect(
    page.getByText("✓ Real footage captured", { exact: true }),
  ).toBeVisible();
  expect(backend.calls).toContain("capture");
  await expect(
    page.getByLabel("Buttons to click", { exact: false }),
  ).not.toBeVisible();
});
