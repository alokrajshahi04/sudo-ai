import { chromium } from "playwright";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { fetchPublicResource, publicUrl } from "./network";
import { AppError } from "./errors";

export const captureSchema = z
  .object({
    url: z.string().max(1000),
    approved: z.literal(true),
    format: z.enum(["landscape", "portrait"]).default("portrait"),
    steps: z
      .array(
        z.discriminatedUnion("action", [
          z
            .object({
              action: z.literal("scroll"),
              pixels: z.number().int().min(100).max(1200),
            })
            .strict(),
          z
            .object({
              action: z.literal("click"),
              role: z.enum(["button", "link"]),
              name: z.string().trim().min(1).max(80),
            })
            .strict(),
        ]),
      )
      .max(5)
      .default([{ action: "scroll", pixels: 500 }]),
  })
  .strict();
export type CaptureInput = z.infer<typeof captureSchema>;
export async function captureAvailable() {
  const directory = await mkdtemp(join(tmpdir(), "sudo-capture-check-"));
  let browser;
  try {
    browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH || chromium.executablePath(),handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false});
    const context = await browser.newContext({recordVideo:{dir:directory,size:{width:320,height:180}},viewport:{width:320,height:180}});
    const page = await context.newPage();
    await page.setContent("<p>Capture encoder check</p>");
    await page.waitForTimeout(50);
    await context.close();
    return true;
  } catch { return false; }
  finally {await browser?.close();await rm(directory,{recursive:true,force:true});}
}
export async function captureSite(
  input: CaptureInput,
  progress: (step: string) => void = () => {},
  transport = fetchPublicResource,
) {
  publicUrl(input.url);
  const directory = await mkdtemp(join(tmpdir(), "sudo-capture-"));
  let browser;
  try {
    progress("Opening a fresh browser for your public demo");
    browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_PATH || chromium.executablePath(),
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      args: ["--disable-background-networking", "--disable-component-update"],
    });
    const viewport =
      input.format === "portrait"
        ? { width: 720, height: 1280 }
        : { width: 1280, height: 720 };
    const context = await browser.newContext({
      viewport,
      recordVideo: { dir: directory, size: viewport },
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    let requests = 0,
      total = 0,
      blocked = 0,
      consoleErrors = 0;
    await context.routeWebSocket("**/*", (ws) => {
      blocked++;
      ws.close();
    });
    await context.route("**/*", async (route) => {
      try {
        if (route.request().method() !== "GET" || ++requests > 200)
          throw new Error("Request blocked");
        const resource = await transport(route.request().url());
        total += resource.body.length;
        if (total > 50_000_000) throw new Error("Capture data budget reached");
        await route.fulfill({
          status: resource.status,
          headers: resource.headers,
          body: resource.body,
        });
      } catch {
        blocked++;
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    page.on("pageerror", () => consoleErrors++);
    page.on("popup", (popup) => void popup.close());
    const response = await page
      .goto(input.url, { waitUntil: "domcontentloaded", timeout: 20_000 })
      .catch(() => null);
    if (!response || response.status() >= 400)
      throw new AppError(
        422,
        "The deployed page could not be captured. Check its public URL and availability.",
      );
    await page.waitForTimeout(2000);
    const steps: string[] = ["Opened the public page"];
    for (const [index, step] of input.steps.entries()) {
      progress(`Recording capture step ${index + 1} of ${input.steps.length}`);
      if (step.action === "scroll") {
        await page.evaluate(
          (pixels) => window.scrollBy({ top: pixels, behavior: "smooth" }),
          step.pixels,
        );
        steps.push(`Scrolled ${step.pixels}px`);
      } else {
        const target = page.getByRole(step.role, {
          name: step.name,
          exact: true,
        });
        if ((await target.count()) !== 1)
          throw new AppError(
            422,
            `Capture step ${index + 1} needs one visible ${step.role} with the exact label “${step.name}”. Update the steps and retry.`,
          );
        await target.click({ timeout: 3000 }).catch(() => {
          throw new AppError(
            422,
            `Capture step ${index + 1} could not click the selected control.`,
          );
        });
        steps.push(`Clicked ${step.role}: ${step.name}`);
      }
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(5500);
    const screenshot = await page.screenshot({ type: "png" });
    const finalUrl = publicUrl(page.url()).href;
    const video = page.video()!;
    await context.close();
    const recording = await readFile(await video.path());
    if (recording.length > 30_000_000)
      throw new AppError(
        422,
        "Capture exceeds 30 MB. Use fewer steps or upload a shorter recording.",
      );
    return {
      recording,
      screenshot,
      capture: {
        url: finalUrl,
        capturedAt: new Date().toISOString(),
        steps,
        format: input.format,
        coverage: `Recorded only the listed public-page steps. ${consoleErrors} browser errors; ${blocked} network requests blocked. No login, forms, private network, sockets or non-GET requests. This is footage, not full product certification.`,
      },
    };
  } finally {
    await browser?.close();
    await rm(directory, { recursive: true, force: true });
  }
}
