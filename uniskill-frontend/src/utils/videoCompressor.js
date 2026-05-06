/**
 * Browser-side video compression using ffmpeg.wasm (single-thread mode).
 * WASM core is loaded from CDN on first use — no extra build configuration needed.
 *
 * Quality settings:
 *   CRF 26  — good quality (lower = better; 18 ≈ lossless, 28 = acceptable)
 *   720p max — keeps file size manageable while staying visually clear
 *   preset veryfast — fast encoding; slower presets shrink files more but take much longer
 *   AAC 128 kbps — standard audio quality
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Singleton — load once, reuse across calls
let _ffmpeg = null;
let _loading = false;
let _loadPromise = null;

const FFMPEG_CORE_VERSION = "0.12.4";
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

async function getFFmpeg() {
  if (_ffmpeg) return _ffmpeg;
  if (_loading) return _loadPromise;

  _loading = true;
  _loadPromise = (async () => {
    const ff = new FFmpeg();
    await ff.load({
      // Single-thread mode — no SharedArrayBuffer / COOP-COEP headers required
      coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    _ffmpeg = ff;
    _loading = false;
    return ff;
  })();

  return _loadPromise;
}

/**
 * Compress a video File in the browser.
 *
 * @param {File} file              — the original video file
 * @param {(pct: number) => void} onProgress — called with 0–100 during encoding
 * @returns {Promise<File>}        — compressed MP4 File
 */
export async function compressVideo(file, onProgress) {
  const ff = await getFFmpeg();

  // Wire up progress events
  const progressHandler = ({ progress }) => {
    const pct = Math.min(100, Math.round(progress * 100));
    onProgress?.(pct);
  };
  ff.on("progress", progressHandler);

  const ext = file.name.split(".").pop().toLowerCase() || "mp4";
  const inputName = `input.${ext}`;
  const outputName = "output.mp4";

  try {
    // Write file into ffmpeg's virtual FS
    await ff.writeFile(inputName, await fetchFile(file));

    // Compress:
    //   -crf 26          → high quality (CRF 0=lossless … 51=worst; 24-28 is the sweet spot)
    //   scale=-2:720     → max 720p height, maintain aspect ratio, width divisible by 2
    //   preset veryfast  → fast enough for a browser; still achieves good compression
    //   +faststart       → moov atom at front, starts playing before full download
    await ff.exec([
      "-i", inputName,
      "-c:v", "libx264",
      "-crf", "26",
      "-vf", "scale=-2:'min(720,ih)'",   // never upscale, cap at 720p
      "-c:a", "aac",
      "-b:a", "128k",
      "-preset", "veryfast",
      "-movflags", "+faststart",
      outputName,
    ]);

    const data = await ff.readFile(outputName);

    // Build a new File from the compressed bytes
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const compressed = new File(
      [data.buffer],
      `${baseName}_compressed.mp4`,
      { type: "video/mp4" }
    );

    return compressed;
  } finally {
    // Clean up virtual FS and listeners
    ff.off("progress", progressHandler);
    try { await ff.deleteFile(inputName); } catch { /* ignore */ }
    try { await ff.deleteFile(outputName); } catch { /* ignore */ }
  }
}

/** Returns true for any video/* MIME type */
export function isVideoFile(file) {
  return file?.type?.startsWith("video/");
}
