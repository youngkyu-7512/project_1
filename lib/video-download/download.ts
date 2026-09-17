import { spawn } from "node:child_process";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { resolveTools } from "./tools";
import { classifyExtractionFailure } from "./errors";

export interface DownloadParams {
  url: string;
  /** The video-only format id from a QualityOption; audio is resolved by
   * yt-dlp's own "+bestaudio" selector, confirmed working against a real id
   * in docs/decisions/video-extraction.md's evidence trail. */
  videoFormatId: string;
  folder: string;
}

export type DownloadOutcome =
  | { kind: "success"; filePath: string; fileName: string }
  | { kind: "already_exists"; filePath: string; fileName: string }
  | { kind: "missing_tools"; tool: "yt-dlp" | "ffmpeg"; message: string }
  | { kind: "failed"; reason: string };

// Every quality option pairs one video-only stream with one audio-only
// stream (docs/decisions/video-extraction.md: muxed formats are the product
// surface), so a download always has exactly two download stages.
const TOTAL_STAGES = 2;
const PROGRESS_LINE = /^\[download\]\s+([\d.]+)%/;
const STAGE_DONE_LINE = /^\[download\]\s+100%\s+of\s+\S+\s+in\s+/;

/**
 * Runs yt-dlp to fetch and merge one quality option, reporting overall
 * progress (0-100 across both streams) via onProgress. Stage boundaries are
 * detected from yt-dlp's own per-stage completion line rather than a percent
 * threshold, so both a fast/tiny download (whose only stdout for a stage may
 * be that single completion line) and a normal gradual one report correctly.
 */
export async function downloadVideo(
  params: DownloadParams,
  onProgress: (percent: number) => void,
): Promise<DownloadOutcome> {
  const { ytDlp, ffmpeg, ffmpegDir } = resolveTools();
  if (!ytDlp) return { kind: "missing_tools", tool: "yt-dlp", message: "yt-dlp를 찾을 수 없습니다." };
  if (!ffmpeg || !ffmpegDir) return { kind: "missing_tools", tool: "ffmpeg", message: "ffmpeg을 찾을 수 없습니다." };

  const args = [
    "--newline",
    "--progress",
    "--no-playlist",
    // Confirmed live: without this, yt-dlp writes non-ASCII output (a Korean
    // title, for example) in the Windows system codepage (CP949) instead of
    // UTF-8, corrupting the filename this function reads back from stdout
    // ("--print after_move:filepath") — the file on disk is named correctly,
    // but the path/name this function reports is not.
    "--encoding",
    "utf-8",
    "--ffmpeg-location",
    ffmpegDir,
    "--format",
    `${params.videoFormatId}+bestaudio/best`,
    "--paths",
    params.folder,
    "--output",
    "%(title)s [%(id)s].%(ext)s",
    "--print",
    "after_move:filepath",
    params.url,
  ];

  return new Promise((resolve) => {
    const child = spawn(ytDlp, args, { windowsHide: true });

    const stdoutLines: string[] = [];
    let stdoutBuf = "";
    let stderr = "";
    let sawAnyDownloadLine = false;
    let stageIndex = 0;
    let spawnError: NodeJS.ErrnoException | null = null;
    // See extract.ts: a raw chunk boundary can split a multi-byte UTF-8
    // character in a non-ASCII title/filename; StringDecoder holds back an
    // incomplete trailing sequence instead of corrupting it into U+FFFD.
    // This matters here more than most places: the file's real on-disk name
    // is read back through this same stdout ("--print after_move:filepath").
    const stdoutDecoder = new StringDecoder("utf8");
    const stderrDecoder = new StringDecoder("utf8");

    const flushLine = (line: string) => {
      stdoutLines.push(line);
      if (STAGE_DONE_LINE.test(line)) {
        sawAnyDownloadLine = true;
        stageIndex += 1;
        onProgress(Math.min(100, (stageIndex / TOTAL_STAGES) * 100));
        return;
      }
      const m = PROGRESS_LINE.exec(line);
      if (m) {
        sawAnyDownloadLine = true;
        const percent = parseFloat(m[1]);
        onProgress(Math.min(100, ((stageIndex + percent / 100) / TOTAL_STAGES) * 100));
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += stdoutDecoder.write(chunk);
      let idx: number;
      while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
        flushLine(stdoutBuf.slice(0, idx).trimEnd());
        stdoutBuf = stdoutBuf.slice(idx + 1);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += stderrDecoder.write(chunk);
    });
    child.on("error", (err) => {
      spawnError = err as NodeJS.ErrnoException;
    });
    child.on("close", (code) => {
      stdoutBuf += stdoutDecoder.end();
      stderr += stderrDecoder.end();
      if (stdoutBuf.trim()) stdoutLines.push(stdoutBuf.trim());

      if (spawnError) {
        const isMissing = spawnError.code === "ENOENT";
        resolve(
          isMissing
            ? { kind: "missing_tools", tool: "yt-dlp", message: spawnError.message }
            : { kind: "failed", reason: spawnError.message },
        );
        return;
      }

      if (code !== 0) {
        const failure = classifyExtractionFailure(stderr);
        if (failure.kind === "missing_tools" && failure.tool) {
          resolve({ kind: "missing_tools", tool: failure.tool, message: failure.message });
        } else {
          resolve({ kind: "failed", reason: failure.message });
        }
        return;
      }

      const filePath = [...stdoutLines].reverse().find((line) => line.trim().length > 0)?.trim();
      if (!filePath) {
        resolve({ kind: "failed", reason: "저장된 파일 경로를 확인하지 못했습니다." });
        return;
      }

      const fileName = path.basename(filePath);
      resolve(
        sawAnyDownloadLine ? { kind: "success", filePath, fileName } : { kind: "already_exists", filePath, fileName },
      );
    });
  });
}
