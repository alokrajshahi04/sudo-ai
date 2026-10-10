import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Job } from "../../shared/types";

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
  } = {},
) {
  let job = options.restored ? structuredClone(options.restored) : fixture();
  let created = !!options.restored;
  const calls: string[] = [];
  const controls = {
    failResearch: !!options.failResearch,
    failPosition: !!options.failPosition,
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method === "POST") calls.push(path.split("/").pop()!);
    let data: unknown;
    if (path.endsWith("/capabilities"))
      data = {
        mode: "local",
        models: [
          {
            provider: "google",
            model: "fixture-model",
            configured: options.configured ?? true,
          },
        ],
        narration: false,
        render: false,
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
        job.brief = body.brief;
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
      data = job;
    }
    await route.fulfill({ json: data });
  });
  return { calls, controls, getJob: () => job };
}
async function fillBrief(page: Page, repository: string) {
  const dialog = page.getByRole("dialog", { name: "New launch" });
  await dialog.getByLabel("Public GitHub repository").fill(repository);
  await dialog.getByLabel("Who is it for?").fill("Open-source maintainers");
  await dialog
    .getByLabel("What should this launch achieve?")
    .fill("Find five testers");
  await dialog.getByRole("button", { name: "Create project brief →" }).click();
  await expect(
    page.getByRole("heading", { name: "Who are we launching this for?" }),
  ).toBeVisible();
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
      await expect(page.getByLabel("Who is it for?")).toHaveValue("");
      await expect(
        page.getByLabel("What should this launch achieve?"),
      ).toHaveValue("");
      await page
        .getByRole("button", { name: "Create project brief →" })
        .click();
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
        page.getByText("LinkedIn draft for story 2", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("X draft for story 2", { exact: true }),
      ).toBeVisible();
      expect(backend.calls).toContain("strategy");
      expect(
        await page.locator(".media-addon").getAttribute("open"),
      ).toBeNull();
      await page.screenshot({ path: testInfo.outputPath("04-pack.png") });
      const waiting = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download launch kit ↓" }).click();
      const download = await waiting;
      const kit = await readFile((await download.path())!, "utf8");
      expect(kit).toContain("LinkedIn draft for story 2");
      expect(kit).toContain("- [ ] Review every claim");
      expect(kit).toContain("source-readme: README.md");
      expect(kit).toContain("Model: google / fixture-model");
      await page
        .getByText("Add a demo video or voiceover", { exact: true })
        .click();
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
