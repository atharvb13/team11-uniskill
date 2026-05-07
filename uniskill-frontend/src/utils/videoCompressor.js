/**
 * Browser-side video compression using ffmpeg.wasm (single-thread mode).
 * WASM core is loaded from CDN on first use — no extra build configuration needed.
 *
 * Quality settings:
 *   CRF 26  — good quality (lower = better; 18 ≈ lossless, 28 = acceptable)
 *   720p max — keeps file size manageable while staying visually clear
 *   preset veryfast — fast enough for a browser
 *   AAC 128 kbps — standard audio quality
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Singleton — load once, reuse across calls
let _ffmpeg = null;
let _loadPromise = null;

const FFMPEG_CORE_VERSION = "0.12.4";
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

async function getFFmpeg() {
  if (_ffmpeg) return _ffmpeg;

  // Reuse in-flight load
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const ff = new FFmpeg();
    try {
      await ff.load({
        // Single-thread mode — no SharedArrayBuffer / COOP-COEP headers required
        coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      _ffmpeg = ff;
      return ff;
    } catch (err) {
      // Reset so the next call retries the load instead of reusing the failed promise
      _loadPromise = null;
      throw new Error(
        `Failed to load video compressor: ${err?.message || String(err)}. ` +
        `Check your internet connection and try again.`
      );
    }
  })();

  return _loadPromise;
}

/**
 * Compress a video File in the browser.
 *
 * @param {File} file                         — the original video file
 * @param {(pct: number) => void} onProgress  — called with 0–100 during encoding
 * @returns {Promise<File>}                   — compressed MP4 File
 */
export async function compressVideo(file, onProgress) {
  const ff = await getFFmpeg();

  const progressHandler = ({ progress }) => {
    onProgress?.(Math.min(100, Math.round(progress * 100)));
  };
  ff.on("progress", progressHandler);

  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const inputName = `input_${Date.now()}.${ext}`;
  const outputName = `output_${Date.now()}.mp4`;

  try {
    await ff.writeFile(inputName, await fetchFile(file));

    // -crf 26          → good quality (0=lossless, 51=worst; sweet spot is 24–28)
    // scale=-2:min(720,ih) → cap at 720p, never upscale, keep aspect ratio
    // preset veryfast  → reasonable encoding speed in the browser
    // +faststart       → moov atom at front so video plays before fully downloaded
    const exitCode = await ff.exec([
      "-i", inputName,
      "-c:v", "libx264",
      "-crf", "26",
      "-vf", "scale=-2:min(720\\,ih)",
      "-c:a", "aac",
      "-b:a", "128k",
      "-preset", "veryfast",
      "-movflags", "+faststart",
      outputName,
    ]);

    // In @ffmpeg/ffmpeg v0.12 exec() returns the exit code — non-zero means failure
    if (exitCode !== 0) {
      throw new Error(
        `Video compression failed (code ${exitCode}). ` +
        `The format may be unsupported — try converting to MP4 first.`
      );
    }

    const data = await ff.readFile(outputName);
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File(
      [data.buffer],
      `${baseName}_compressed.mp4`,
      { type: "video/mp4" }
    );
  } finally {
    ff.off("progress", progressHandler);
    try { await ff.deleteFile(inputName); } catch { /* ignore */ }
    try { await ff.deleteFile(outputName); } catch { /* ignore */ }
  }
}

/** Returns true for any video/* MIME type */
export function isVideoFile(file) {
  return file?.type?.startsWith("video/");
}
