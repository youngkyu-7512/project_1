export type ExtractionFailureKind = "unsupported_url" | "blocked" | "missing_tools" | "other";

export interface ExtractionFailure {
  kind: ExtractionFailureKind;
  /** Which tool is missing, only set when kind is "missing_tools". */
  tool?: "yt-dlp" | "ffmpeg";
  message: string;
}

const BLOCKED_PATTERNS = [
  /sign in to confirm/i,
  /confirm you.?re not a bot/i,
  /HTTP Error 403/,
  /HTTP Error 429/,
  /Too Many Requests/i,
];

const UNSUPPORTED_PATTERNS = [
  /Unsupported URL/,
  /is not a valid URL/i,
  /No video formats found/i,
  /video is unavailable/i,
  /Video unavailable/i,
];

const FFMPEG_MISSING_PATTERNS = [/ffmpeg (is )?not (installed|found)/i, /ffprobe\/ffmpeg not found/i];

/** Classifies a failed yt-dlp run from its stderr text, so the product can
 * show a distinct message per docs/specs/video-download/spec.md's "실패 원인
 * 구분" instead of one generic error. */
export function classifyExtractionFailure(stderr: string): ExtractionFailure {
  if (FFMPEG_MISSING_PATTERNS.some((p) => p.test(stderr))) {
    return { kind: "missing_tools", tool: "ffmpeg", message: stderr.trim() };
  }
  if (BLOCKED_PATTERNS.some((p) => p.test(stderr))) {
    return { kind: "blocked", message: stderr.trim() };
  }
  if (UNSUPPORTED_PATTERNS.some((p) => p.test(stderr))) {
    return { kind: "unsupported_url", message: stderr.trim() };
  }
  return { kind: "other", message: stderr.trim() };
}

/**
 * True when a successful `--dump-single-json` call resolved to a playlist or
 * channel instead of one video. Confirmed against a real yt-dlp response for
 * a playlist URL run with --no-playlist: the top level still carries no
 * `formats` array and instead exposes `entries` (docs/decisions/video-extraction.md
 * does not cover this case; playlists/channels are out of scope per spec).
 */
export function isPlaylistOrChannelResult(json: unknown): boolean {
  if (typeof json !== "object" || json === null) return false;
  const record = json as Record<string, unknown>;
  return !Array.isArray(record.formats) && Array.isArray(record.entries);
}

/** True when yt-dlp warned that it could not fully resolve formats (observed
 * cause: a missing JS runtime breaks YouTube's n-challenge). The quality list
 * built from a run like this is real but incomplete. */
export function hasIncompleteFormatsWarning(stderr: string): boolean {
  return /n challenge solving failed|some formats may be missing/i.test(stderr);
}
