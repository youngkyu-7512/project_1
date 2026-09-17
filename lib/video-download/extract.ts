import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { resolveTools } from "./tools";
import { selectQualities, type QualityOption, type YtDlpFormat } from "./quality";
import {
  classifyExtractionFailure,
  hasIncompleteFormatsWarning,
  isPlaylistOrChannelResult,
  type ExtractionFailure,
} from "./errors";

export interface ExtractedVideo {
  id: string;
  title: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  qualities: QualityOption[];
  formatsIncomplete: boolean;
}

export type ExtractResult = { ok: true; video: ExtractedVideo } | { ok: false; failure: ExtractionFailure };

interface YtDlpRun {
  code: number | null;
  stdout: string;
  stderr: string;
  spawnError: NodeJS.ErrnoException | null;
}

function runYtDlpJson(ytDlpPath: string, url: string): Promise<YtDlpRun> {
  return new Promise((resolve) => {
    // --no-playlist keeps a video URL inside a playlist scoped to that one
    // video; a pure playlist/channel URL still resolves (see errors.ts
    // isPlaylistOrChannelResult) rather than erroring, so that case is
    // classified from the JSON shape, not from a spawn failure here.
    // --encoding utf-8: confirmed live that without it, yt-dlp writes
    // non-ASCII text (e.g. a Korean title) in the Windows system codepage
    // (CP949), which corrupts into U+FFFD when read back as UTF-8.
    const child = spawn(ytDlpPath, ["--dump-single-json", "--no-playlist", "--encoding", "utf-8", url], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let spawnError: NodeJS.ErrnoException | null = null;
    // A raw Buffer chunk can split a multi-byte UTF-8 character (titles with
    // Korean or other non-ASCII text) across two "data" events; chunk.toString()
    // on each half independently corrupts it into U+FFFD. StringDecoder holds
    // back an incomplete trailing sequence until the rest arrives.
    const stdoutDecoder = new StringDecoder("utf8");
    const stderrDecoder = new StringDecoder("utf8");

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += stdoutDecoder.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += stderrDecoder.write(chunk);
    });
    child.on("error", (err) => {
      spawnError = err as NodeJS.ErrnoException;
    });
    child.on("close", (code) => {
      stdout += stdoutDecoder.end();
      stderr += stderrDecoder.end();
      resolve({ code, stdout, stderr, spawnError });
    });
  });
}

export async function extractVideo(url: string): Promise<ExtractResult> {
  const { ytDlp } = resolveTools();
  if (!ytDlp) {
    return { ok: false, failure: { kind: "missing_tools", tool: "yt-dlp", message: "yt-dlp를 찾을 수 없습니다." } };
  }

  const { code, stdout, stderr, spawnError } = await runYtDlpJson(ytDlp, url);

  if (spawnError) {
    const kind = spawnError.code === "ENOENT" ? "missing_tools" : "other";
    return { ok: false, failure: { kind, tool: kind === "missing_tools" ? "yt-dlp" : undefined, message: spawnError.message } };
  }

  if (code !== 0) {
    return { ok: false, failure: classifyExtractionFailure(stderr) };
  }

  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    return { ok: false, failure: { kind: "other", message: "추출 결과를 해석하지 못했습니다." } };
  }

  if (isPlaylistOrChannelResult(json)) {
    return { ok: false, failure: { kind: "unsupported_url", message: "재생목록 또는 채널 주소입니다." } };
  }

  const record = json as {
    id: string;
    title: string;
    duration?: number | null;
    thumbnail?: string | null;
    formats?: YtDlpFormat[];
  };
  const qualities = selectQualities(record.formats ?? []);

  if (qualities.length === 0) {
    return { ok: false, failure: { kind: "other", message: "받을 수 있는 화질을 찾지 못했습니다." } };
  }

  return {
    ok: true,
    video: {
      id: record.id,
      title: record.title,
      durationSeconds: record.duration ?? null,
      thumbnailUrl: record.thumbnail ?? null,
      qualities,
      formatsIncomplete: hasIncompleteFormatsWarning(stderr),
    },
  };
}
