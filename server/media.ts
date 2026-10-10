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
export async function narrate(text: string): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice)
    throw new AppError(
      409,
      "Set ElevenLabs API key and voice ID in the local .env.",
    );
  if (!/^[\w-]+$/.test(voice))
    throw new AppError(400, "Invalid configured voice ID.");
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
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
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 5_000_000)
    throw new AppError(502, "Narration exceeds the asset limit.");
  return Buffer.from(bytes);
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
