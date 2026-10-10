import { chromium } from "playwright";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Job, Storyboard } from "../shared/types";
import { AppError, redact } from "./errors";
import { execute } from "./media";

// Brag's inspect → plan → compose → deliver structure and readable scene pacing
// are adapted here. This renderer uses bounded source cards, Chromium and FFmpeg;
// it does not execute repository code or the upstream Hyperframes agent skill.
export function makeStoryboard(job: Job): Storyboard {
  const angle = job.positioning?.angles[job.selectedAngle];
  if (!angle || !job.inspection)
    throw new AppError(
      409,
      "Choose a reviewed launch story before making a promo.",
    );
  const source =
    job.inspection.evidence.find(
      (e) =>
        e.kind === "source" && !/^readme|package\.json|LICENSE/i.test(e.title),
    ) || job.inspection.evidence.find((e) => e.kind === "source");
  if (!source)
    throw new AppError(
      409,
      "This promo needs an actual source excerpt. Add a recording or inspect a repository with readable source.",
    );
  const shortCopy = (text: string, words = 20) => {
    const parts = text.trim().split(/\s+/);
    return parts.slice(0, words).join(" ") + (parts.length > words ? "…" : "");
  };
  const summary = (
    job.analysis?.summary ||
    job.inspection.description ||
    "An open-source project, presented from its source."
  ).split(/(?<=[.!?])\s+/)[0];
  const cta = job.inspection.private
    ? "Ask the creator for access"
    : job.repository;
  return {
    duration: 25,
    scenes: [
      {
        label: "THE HOOK",
        heading: angle.title,
        detail: `For ${angle.audience}`,
        seconds: 4,
      },
      {
        label: "MEET THE PROJECT",
        heading: job.name,
        detail: shortCopy(summary),
        seconds: 6,
      },
      {
        label: "FROM THE SOURCE",
        heading: source.title,
        detail: "Actual repository excerpt · runtime not verified",
        seconds: 10,
      },
      {
        label: "YOUR NEXT STEP",
        heading:
          job.launchBrief?.goal || "Explore the project. Share your feedback.",
        detail: cta,
        seconds: 5,
      },
    ],
    sourceVisual: {
      file: source.title,
      excerpt: redact(source.excerpt).slice(0, 1400),
    },
    cta,
    workflow:
      "Brag-inspired inspect → plan → compose → deliver. Source-card promo rendered by Chromium + FFmpeg; optional user-supplied footage. Not an automatic product interaction demo. Upstream: https://github.com/latent-spaces/brag (MIT).",
  };
}
function xml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}
function lines(text: string, width: number, count: number) {
  const result: string[] = [];
  let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    if ((line + word).length > width && line) {
      result.push(line);
      line = "";
    }
    // Break long repository names and URLs rather than allowing off-screen text.
    let rest = word;
    while (rest.length > width) {
      if (line) {
        result.push(line);
        line = "";
      }
      result.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    line += (line ? " " : "") + rest;
  }
  if (line) result.push(line);
  return result
    .slice(0, count)
    .map((value, i) =>
      i === count - 1 && result.length > count
        ? value.slice(0, -1) + "…"
        : value,
    );
}
export function sceneSvg(board: Storyboard, index: number, name: string) {
  const scene = board.scenes[index];
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = "#e8e8e2",
  ) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${xml(value)}</text>`;
  const title = lines(scene.heading, 36, 3);
  const details = lines(scene.detail, 78, 3);
  const source = board.sourceVisual.excerpt
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 8)
    .map((line) => line.slice(0, 95));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#0c0d0c"/><g stroke="#1b211e">${Array.from({ length: 21 }, (_, i) => `<path d="M${i * 64} 0V720"/>`).join("")}${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${i * 64}H1280"/>`).join("")}</g><g font-family="monospace">${text("sudo.launch / " + name.slice(0, 60), 64, 58, 18, "#a5aba4")}${text(scene.label, 64, 140, 16, "#fa563f")}${index === 2 ? `<rect x="64" y="192" width="1152" height="370" rx="8" fill="#141b17" stroke="#35453a"/>${text(board.sourceVisual.file.slice(0, 75), 90, 235, 20, "#a2e8b4")}${source.map((line, i) => text(line, 90, 280 + i * 31, 18, "#c6cec7")).join("")}${text("SOURCE EXCERPT / NOT A RUNTIME CAPTURE", 64, 602, 18, "#a5aba4")}` : `${title.map((line, i) => text(line, 64, 235 + i * 66, 50)).join("")}${details.map((line, i) => text(line, 64, 450 + i * 32, 22, "#a5aba4")).join("")}`}<path d="M64 650H1216" stroke="#364138"/>${text("PROJECT PROMO / REVIEWED DRAFT", 64, 686, 14, "#838e84")}${text(`${String(index + 1).padStart(2, "0")} / 04`, 1110, 686, 14, "#a2e8b4")}</g></svg>`;
}
export async function promoAvailable() {
  try {
    const browser = await chromium.launch({
      headless: true,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_PATH || chromium.executablePath(),
    });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}
export async function renderPromo(
  board: Storyboard,
  name: string,
  assets: { narration?: Buffer; music?: Buffer; recording?: Buffer },
  progress: (step: string) => void = () => {},
) {
  const dir = await mkdtemp(join(tmpdir(), "sudo-promo-"));
  let browser;
  try {
    try {
      browser = await chromium.launch({
        headless: true,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
        executablePath:
          process.env.PLAYWRIGHT_CHROMIUM_PATH || chromium.executablePath(),
      });
    } catch {
      throw new AppError(
        409,
        "Promo rendering requires Chromium. Run npm run setup:browser or set PLAYWRIGHT_CHROMIUM_PATH, then restart.",
      );
    }
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    await page.route("**/*", (route) => route.abort());
    // Escape all source strings in SVG; disable scripts and every network request.
    const poster = join(dir, "scene-1.png");
    const clips: string[] = [];
    if (assets.recording)
      await writeFile(join(dir, "recording.media"), assets.recording);
    for (let i = 0; i < board.scenes.length; i++) {
      progress(`Composing scene ${i + 1} of ${board.scenes.length}`);
      const image = join(dir, `scene-${i}.png`);
      await page.setContent(
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>html,body{margin:0;width:1280px;height:720px;overflow:hidden}</style>${sceneSvg(board, i, name)}`,
      );
      await page.screenshot({ path: image });
      const seconds = board.scenes[i].seconds;
      const clip = join(dir, `clip-${i}.mp4`);
      const footage = i === 2 && !!assets.recording;
      const input = footage
        ? [
            "-stream_loop",
            "-1",
            "-protocol_whitelist",
            "file,pipe",
            "-format_whitelist",
            "mov,matroska,webm",
            "-i",
            join(dir, "recording.media"),
          ]
        : ["-loop", "1", "-framerate", "24", "-i", image];
      await execute(
        "ffmpeg",
        [
          "-y",
          "-v",
          "error",
          ...input,
          "-t",
          String(seconds),
          "-vf",
          `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0c0d0c,setsar=1,fps=24,fade=t=in:d=0.2,fade=t=out:st=${seconds - 0.2}:d=0.2`,
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-threads",
          "2",
          clip,
        ],
        60_000,
      );
      clips.push(clip);
    }
    await browser.close();
    browser = undefined;
    await writeFile(
      join(dir, "clips.txt"),
      clips.map((file) => `file '${file}'`).join("\n"),
    );
    const silent = join(dir, "silent.mp4");
    await execute("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      join(dir, "clips.txt"),
      "-c",
      "copy",
      silent,
    ]);
    const output = join(dir, "promo.mp4");
    progress("Mixing audio and exporting MP4");
    const args = ["-y", "-v", "error", "-i", silent];
    if (assets.narration) {
      await writeFile(join(dir, "voice.mp3"), assets.narration);
      args.push("-i", join(dir, "voice.mp3"));
    }
    if (assets.music) {
      await writeFile(join(dir, "music.mp3"), assets.music);
      args.push("-stream_loop", "-1", "-i", join(dir, "music.mp3"));
    }
    if (assets.narration) {
      const info = JSON.parse(
        await execute("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          join(dir, "voice.mp3"),
        ]),
      );
      if (Number(info.format?.duration) > board.duration)
        throw new AppError(
          422,
          "Narration is longer than the 25-second storyboard. Shorten the script and regenerate narration; silent video is also available.",
        );
    }
    if (assets.narration && assets.music)
      args.push(
        "-filter_complex",
        `[1:a]apad[v];[2:a]volume=0.12,afade=t=out:st=${board.duration - 2}:d=2[m];[v][m]amix=inputs=2:duration=first:normalize=0[a]`,
        "-map",
        "0:v:0",
        "-map",
        "[a]",
        "-c:a",
        "aac",
      );
    else if (assets.narration)
      args.push("-af", "apad", "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac");
    else if (assets.music)
      args.push(
        "-af",
        `volume=0.2,afade=t=out:st=${board.duration - 2}:d=2`,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:a",
        "aac",
      );
    else args.push("-an");
    args.push(
      "-t",
      String(board.duration),
      "-c:v",
      "copy",
      "-movflags",
      "+faststart",
      output,
    );
    await execute("ffmpeg", args);
    const video = await readFile(output);
    if (video.length > 30_000_000)
      throw new AppError(422, "Promo exceeds the output size limit.");
    return { video, poster: await readFile(poster) };
  } finally {
    if (browser) await browser.close();
    await rm(dir, { recursive: true, force: true });
  }
}
