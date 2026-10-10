import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppError } from "./errors";
import { readResponse } from "./network";
export function execute(
  command: string,
  args: string[],
  timeout = 120_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new AppError(504, "Media operation exceeded its time limit."));
    }, timeout);
    proc.stdout.on("data", (b) => {
      if (output.length < 100_000) output += b.toString();
    });
    proc.on("error", () => {
      clearTimeout(timer);
      reject(
        new AppError(
          409,
          "Required media executable is unavailable. Install FFmpeg locally.",
        ),
      );
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(output)
        : reject(
            new AppError(
              422,
              "Media could not be decoded or rendered. Use a valid MP4 or WebM recording.",
            ),
          );
    });
  });
}
export async function validateRecording(bytes: Buffer) {
  if (
    bytes.subarray(4, 8).toString() !== "ftyp" &&
    !bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  )
    throw new AppError(422, "Only MP4 and WebM containers are supported.");
  const dir = await mkdtemp(join(tmpdir(), "sudo-recording-"));
  try {
    const file = join(dir, "input.media");
    await writeFile(file, bytes);
    const output = await execute(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        "mov,matroska,webm",
        "-show_entries",
        "stream=codec_type:format=duration",
        "-of",
        "json",
        file,
      ],
      20_000,
    );
    const data = JSON.parse(output);
    const duration = Number(data.format?.duration);
    if (
      !data.streams?.some((s: any) => s.codec_type === "video") ||
      !Number.isFinite(duration) ||
      duration < 3 ||
      duration > 120
    )
      throw new AppError(
        422,
        "Recording must contain video and be between 3 and 120 seconds.",
      );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
export function captionCues(alignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}) {
  const {
    characters,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  } = alignment;
  if (
    !Array.isArray(characters) ||
    characters.length > 2000 ||
    !characters.length ||
    starts?.length !== characters.length ||
    ends?.length !== characters.length
  )
    throw new AppError(502, "ElevenLabs returned invalid caption alignment.");
  if (
    characters.some(
      (c, i) =>
        typeof c !== "string" ||
        !Number.isFinite(starts[i]) ||
        !Number.isFinite(ends[i]) ||
        starts[i] < 0 ||
        ends[i] < starts[i] ||
        ends[i] > 120 ||
        (i > 0 && starts[i] < starts[i - 1]),
    )
  )
    throw new AppError(502, "ElevenLabs returned invalid caption timing.");
  const cues: { start: number; end: number; text: string }[] = [];
  let first = 0,
    text = "";
  for (let i = 0; i < characters.length; i++) {
    text += characters[i];
    const boundary =
      /\s/.test(characters[i]) && text.trim().split(/\s+/).length >= 6;
    if (boundary || i === characters.length - 1) {
      if (text.trim())
        cues.push({ start: starts[first], end: ends[i], text: text.trim() });
      first = i + 1;
      text = "";
    }
  }
  return cues;
}
export function captionsSrt(
  cues: { start: number; end: number; text: string }[],
) {
  const timestamp = (seconds: number) => {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  return cues
    .map(
      (c, i) =>
        `${i + 1}\n${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text.replace(/[\r\n<>]/g, " ")}\n`,
    )
    .join("\n");
}
export async function narrateWithAlignment(text: string) {
  const key = process.env.ELEVENLABS_API_KEY,
    voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice)
    throw new AppError(
      409,
      "Set ElevenLabs API key and voice ID in the local .env.",
    );
  if (!/^[\w-]+$/.test(voice))
    throw new AppError(400, "Invalid configured voice ID.");
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      signal: AbortSignal.timeout(60_000),
      redirect: "error",
    },
  );
  if (!response.ok)
    throw new AppError(
      502,
      `ElevenLabs rejected narration (HTTP ${response.status}). Check voice access and quota.`,
    );
  const data = JSON.parse(await readResponse(response, 8_000_000));
  if (
    typeof data.audio_base64 !== "string" ||
    !/^[A-Za-z0-9+/=]+$/.test(data.audio_base64)
  )
    throw new AppError(502, "ElevenLabs returned invalid audio.");
  const audio = Buffer.from(data.audio_base64, "base64");
  if (audio.length > 5_000_000)
    throw new AppError(502, "Narration exceeds the asset limit.");
  const cues = captionCues(data.normalized_alignment || data.alignment);
  return { audio, cues, srt: Buffer.from(captionsSrt(cues)) };
}
export async function narrate(text: string): Promise<Buffer> {
  return (await narrateWithAlignment(text)).audio;
}
export async function validateScreenshot(bytes: Buffer) {
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!png && !jpeg)
    throw new AppError(422, "Upload a PNG or JPEG screenshot.");
  const dir = await mkdtemp(join(tmpdir(), "sudo-image-"));
  try {
    const path = join(dir, png ? "screenshot.png" : "screenshot.jpg");
    await writeFile(path, bytes);
    const info = JSON.parse(
      await execute(
        "ffprobe",
        [
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-show_entries",
          "stream=width,height,codec_name",
          "-of",
          "json",
          path,
        ],
        15000,
      ),
    );
    const stream = info.streams?.[0];
    if (
      !stream ||
      !["png", "mjpeg"].includes(stream.codec_name) ||
      stream.width < 100 ||
      stream.height < 100 ||
      stream.width * stream.height > 20_000_000
    )
      throw new AppError(
        422,
        "Screenshot must be at least 100×100 and no more than 20 megapixels.",
      );
    const output = join(dir, "normalized.png");
    await execute(
      "ffmpeg",
      [
        "-y",
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        path,
        "-frames:v",
        "1",
        "-vf",
        "scale=1920:1920:force_original_aspect_ratio=decrease",
        "-threads",
        "2",
        output,
      ],
      20000,
    );
    return readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
export async function composeMusic(
  prompt: string,
  duration = 25_000,
): Promise<Buffer> {
  if (!process.env.ELEVENLABS_API_KEY)
    throw new AppError(409, "Configure ElevenLabs before generating music.");
  const response = await fetch(
    "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128",
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        music_length_ms: duration,
        force_instrumental: true,
        model_id: "music_v1",
      }),
    },
  );
  if (!response.ok)
    throw new AppError(
      502,
      `ElevenLabs rejected music generation (HTTP ${response.status}). Check Music API permissions, plan access and quota. Narration and silent rendering remain available.`,
    );
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 8_000_000)
    throw new AppError(502, "Music exceeds the asset limit.");
  return Buffer.from(bytes);
}
export async function render(
  recording: Buffer,
  audio?: Buffer,
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "sudo-render-"));
  try {
    const input = join(dir, "input.media"),
      output = join(dir, "demo.mp4");
    await writeFile(input, recording);
    const args = [
      "-y",
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-format_whitelist",
      "mov,matroska,webm",
      "-i",
      input,
    ];
    if (audio) {
      const voice = join(dir, "voice.mp3");
      await writeFile(voice, audio);
      args.push("-protocol_whitelist", "file,pipe", "-i", voice);
    }
    args.push(
      "-t",
      "30",
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
    );
    if (audio)
      args.push("-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-shortest");
    else args.push("-an");
    args.push("-movflags", "+faststart", output);
    await execute("ffmpeg", args);
    const bytes = await readFile(output);
    if (bytes.length > 30_000_000)
      throw new AppError(422, "Rendered file exceeds the output limit.");
    return bytes;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
