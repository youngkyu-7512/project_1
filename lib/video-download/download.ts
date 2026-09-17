import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { uploadForDownload } from "./blob";
import { classifyExtractionFailure } from "./errors";
import { resolveTools } from "./tools";

export interface DownloadParams {
  url: string;
  /** The video-only format id from a QualityOption; audio is resolved by
   * yt-dlp's own "+bestaudio" selector, confirmed working against a real id
   * in docs/decisions/video-extraction.md's evidence trail. */
  videoFormatId: string;
}

export type DownloadOutcome =
  | { kind: "success"; downloadUrl: string; fileName: string }
  | { kind: "missing_tools"; tool: "yt-dlp" | "ffmpeg"; message: string }
  | { kind: "failed"; reason: string };

// Every quality option pairs one video-only stream with one audio-only
// stream (docs/decisions/video-extraction.md: muxed formats are the product
// surface), so a download always has exactly two download stages.
const TOTAL_STAGES = 2;
const PROGRESS_LINE = /^\[download\]\s+([\d.]+)%/;
const STAGE_DONE_LINE = /^\[download\]\s+100%\s+of\s+\S+\s+in\s+/;

interface YtDlpDownloadRun {
  code: number | null;
  stdoutLines: string[];
  stderr: string;
  sawAnyDownloadLine: boolean;
  spawnError: NodeJS.ErrnoException | null;
}

function runYtDlpDownload(
  ytDlp: string,
  ffmpegDir: string,
  workDir: string,
  params: DownloadParams,
  onProgress: (percent: number) => void,
): Promise<YtDlpDownloadRun> {
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
    workDir,
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
    // A raw Buffer chunk can split a multi-byte UTF-8 character across two
    // "data" events; StringDecoder holds back an incomplete trailing
    // sequence instead of corrupting it into U+FFFD.
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
      resolve({ code, stdoutLines, stderr, sawAnyDownloadLine, spawnError });
    });
  });
}

/**
 * Fetches and merges one quality option, then uploads the result to Vercel
 * Blob and returns its download URL (docs/decisions/hosting-and-access.md:
 * the function's own response is capped at 4.5MB, far below a real video, so
 * the file itself never travels through this function's response).
 */
export async function downloadVideo(
  params: DownloadParams,
  onProgress: (percent: number) => void,
): Promise<DownloadOutcome> {
  const { ytDlp, ffmpeg, ffmpegDir } = resolveTools();
  if (!ytDlp) return { kind: "missing_tools", tool: "yt-dlp", message: "yt-dlp를 찾을 수 없습니다." };
  if (!ffmpeg || !ffmpegDir) return { kind: "missing_tools", tool: "ffmpeg", message: "ffmpeg을 찾을 수 없습니다." };

  const workDir = path.join(os.tmpdir(), `vdl-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  try {
    const { code, stdoutLines, stderr, sawAnyDownloadLine, spawnError } = await runYtDlpDownload(
      ytDlp,
      ffmpegDir,
      workDir,
      params,
      onProgress,
    );

    if (spawnError) {
      const isMissing = spawnError.code === "ENOENT";
      return isMissing
        ? { kind: "missing_tools", tool: "yt-dlp", message: spawnError.message }
        : { kind: "failed", reason: spawnError.message };
    }

    if (code !== 0) {
      const failure = classifyExtractionFailure(stderr);
      return failure.kind === "missing_tools" && failure.tool
        ? { kind: "missing_tools", tool: failure.tool, message: failure.message }
        : { kind: "failed", reason: failure.message };
    }

    if (!sawAnyDownloadLine) {
      return { kind: "failed", reason: "다운로드가 시작되지 않았습니다." };
    }

    const filePath = [...stdoutLines].reverse().find((line) => line.trim().length > 0)?.trim();
    if (!filePath) {
      return { kind: "failed", reason: "저장된 파일 경로를 확인하지 못했습니다." };
    }

    const fileName = path.basename(filePath);
    try {
      const { downloadUrl } = await uploadForDownload(filePath, fileName);
      return { kind: "success", downloadUrl, fileName };
    } catch (err) {
      return { kind: "failed", reason: err instanceof Error ? err.message : "파일을 전달하지 못했습니다." };
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
