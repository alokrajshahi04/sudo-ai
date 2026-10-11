import { chromium } from "playwright";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Job, Storyboard } from "../shared/types";
import { AppError, redact } from "./errors";
import { execute } from "./media";

// Brag's inspect → plan → compose → deliver structure and readable scene pacing
// are adapted here. This renderer uses product explainers, Chromium and FFmpeg;
// it does not execute repository code or the upstream Hyperframes agent skill.
export function makeStoryboard(
  job: Job,
  visual: "source" | "recording" | "screenshot" = "source",
): Storyboard {
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
  const cta = job.site?.reachable
    ? job.site.finalUrl
    : job.inspection.private
      ? "Ask the creator for access"
      : job.repository;
  return {
    duration: 25,
    visual,
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
        label: visual === "source" ? "THE VALUE" : "SEE THE PRODUCT",
        heading:
          visual === "source"
            ? shortCopy(angle.rationale || summary, 9)
            : visual === "recording"
              ? "Your product in action"
              : "A look at your product",
        detail:
          visual === "source"
            ? "Product explainer · review the supported features"
            : visual === "recording" && job.capture
              ? "Real public-page capture · reviewed steps only"
              : "Owner-supplied visual · claims still need review",
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
      "Brag-inspired inspect → plan → compose → deliver. Chromium + FFmpeg composition using product explainers, uploaded visuals or approved public-page capture. Captures cover only reviewed steps, not full product verification. Upstream: https://github.com/latent-spaces/brag (MIT).",
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#0c0d0c"/><g stroke="#1b211e">${Array.from({ length: 21 }, (_, i) => `<path d="M${i * 64} 0V720"/>`).join("")}${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${i * 64}H1280"/>`).join("")}</g><g font-family="monospace">${text("sudo.launch / " + name.slice(0, 60), 64, 58, 18, "#a5aba4")}${text(scene.label, 64, 140, 16, "#fa563f")}${title.map((line, i) => text(line, 64, 235 + i * 66, 50)).join("")}${details.map((line, i) => text(line, 64, 450 + i * 32, 22, "#a5aba4")).join("")}${index === 2 ? text("PRODUCT EXPLAINER / NOT A RUNTIME CAPTURE", 64, 602, 18, "#a5aba4") : ""}<path d="M64 650H1216" stroke="#364138"/>${text("PROJECT PROMO / REVIEWED DRAFT", 64, 686, 14, "#838e84")}${text(`${String(index + 1).padStart(2, "0")} / 04`, 1110, 686, 14, "#a2e8b4")}</g></svg>`;
}
export function captionAss(
  cues: { start: number; end: number; text: string }[],
  width: number,
  height: number,
) {
  const stamp = (seconds: number) => {
    const centiseconds = Math.round(seconds * 100);
    return `${Math.floor(centiseconds / 360000)}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, "0")}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
  };
  const portrait = height > width;
  return (
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,${portrait ? 46 : 32},&H00FFFFFF,&H00FFFFFF,&H00101010,&H90101010,-1,0,0,0,100,100,0,0,1,3,0,2,${portrait ? 100 : 60},${portrait ? 100 : 60},${portrait ? 290 : 55},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` +
    cues
      .map(
        (c) =>
          `Dialogue: 0,${stamp(c.start)},${stamp(c.end)},Default,,0,0,0,,${c.text.replace(/[{}\\\r\n]/g, " ")}`,
      )
      .join("\n") +
    "\n"
  );
}
export function portraitSceneSvg(
  board: Storyboard,
  index: number,
  name: string,
) {
  const scene = board.scenes[index];
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = "#ecebe6",
  ) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${xml(value)}</text>`;
  const heading = lines(scene.heading, 20, 5),
    detail = lines(scene.detail, 36, 5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#0c0d0c"/><path d="M80 292H1000" stroke="#303730"/><g font-family="DejaVu Sans Mono, monospace"><rect x="80" y="120" width="14" height="54" fill="#e62f24"/>${text("sudo.launch_", 120, 163, 36)}${text(name.slice(0, 35), 80, 246, 28, "#91988f")}${text(`0${index + 1} / ${scene.label}`, 80, 385, 30, "#d4b68b")}${heading.map((l, i) => text(l, 80, 550 + i * 96, 72)).join("")}${detail.map((l, i) => text(l, 80, 1120 + i * 54, 40, "#bfc5bb")).join("")}${index === 2 ? text("PRODUCT EXPLAINER · NOT RUNTIME FOOTAGE", 80, 1720, 20, "#d4b68b") : ""}<path d="M80 1770H1000" stroke="#303730"/>${text(index === 3 ? "Explore. Try it. Share feedback." : "Built by a developer. Ready for your feedback.", 80, 1820, 22, "#91988f")}</g></svg>`;
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
  assets: {
    narration?: Buffer;
    music?: Buffer;
    recording?: Buffer;
    recordingTail?: boolean;
    screenshot?: Buffer;
    captions?: Buffer;
    captionCues?: { start: number; end: number; text: string }[];
    format?: "landscape" | "portrait";
  },
  progress: (step: string) => void = () => {},
) {
  const dir = await mkdtemp(join(tmpdir(), "sudo-promo-"));
  let browser;
  const portrait = assets.format === "portrait";
  const width = portrait ? 1080 : 1280,
    height = portrait ? 1920 : 720;
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
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    await page.route("**/*", (route) => route.abort());
    // Escape all source strings in SVG; disable scripts and every network request.
    const poster = join(dir, "scene-1.png");
    const clips: string[] = [];
    if (assets.recording)
      await writeFile(join(dir, "recording.media"), assets.recording);
    let recordingStart = 0;
    if (assets.recording && assets.recordingTail) {
      const info = JSON.parse(
        await execute("ffprobe", [
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-format_whitelist",
          "mov,matroska,webm",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          join(dir, "recording.media"),
        ]),
      );
      const duration = Number(info.format?.duration);
      if (Number.isFinite(duration))
        recordingStart = Math.max(0, duration - board.scenes[2].seconds);
    }
    if (assets.screenshot)
      await writeFile(join(dir, "screenshot.png"), assets.screenshot);
    // Finish Chromium composition before starting FFmpeg to reduce peak memory.
    for (let i = 0; i < board.scenes.length; i++) {
      progress(`Designing scene ${i + 1} of ${board.scenes.length}`);
      const image = join(dir, `scene-${i}.png`);
      await page.setContent(
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}</style>${portrait ? portraitSceneSvg(board, i, name) : sceneSvg(board, i, name)}`,
      );
      await page.screenshot({ path: image });
    }
    await browser.close();
    browser = undefined;
    for (let i = 0; i < board.scenes.length; i++) {
      progress(`Encoding scene ${i + 1} of ${board.scenes.length}`);
      const image = join(dir, `scene-${i}.png`);
      const seconds = board.scenes[i].seconds;
      const clip = join(dir, `clip-${i}.mp4`);
      const footage = i === 2 && !!assets.recording;
      const shot = i === 2 && !footage && !!assets.screenshot;
      const input = footage
        ? [
            "-stream_loop",
            "-1",
            "-protocol_whitelist",
            "file,pipe",
            "-format_whitelist",
            "mov,matroska,webm",
            "-ss",
            String(recordingStart),
            "-i",
            join(dir, "recording.media"),
          ]
        : [
            "-loop",
            "1",
            "-framerate",
            "24",
            "-i",
            shot ? join(dir, "screenshot.png") : image,
          ];
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
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0c0d0c,setsar=1,fps=24,fade=t=in:d=0.2,fade=t=out:st=${seconds - 0.2}:d=0.2`,
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
    const composition = join(dir, "composition.mp4");
    let visual = silent;
    if (assets.captions) {
      if (!assets.captionCues?.length)
        throw new AppError(
          422,
          "Aligned caption timings are missing. Regenerate narration.",
        );
      await writeFile(
        join(dir, "captions.ass"),
        captionAss(assets.captionCues, width, height),
      );
      progress("Adding captions aligned to your narration");
      await execute("ffmpeg", [
        "-y",
        "-v",
        "error",
        "-i",
        silent,
        "-vf",
        `ass=${join(dir, "captions.ass")}`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-threads",
        "2",
        "-an",
        composition,
      ]);
      visual = composition;
    }
    const output = join(dir, "promo.mp4");
    progress("Mixing audio and exporting MP4");
    const args = ["-y", "-v", "error", "-i", visual];
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
