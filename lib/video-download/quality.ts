/** A single format entry as yt-dlp's --dump-single-json reports it. Only the
 * fields this module reads are declared; yt-dlp's payload has many more. */
export interface YtDlpFormat {
  format_id: string;
  ext: string;
  vcodec?: string | null;
  acodec?: string | null;
  protocol?: string | null;
  height?: number | null;
  fps?: number | null;
  filesize?: number | null;
  filesize_approx?: number | null;
  abr?: number | null;
}

export type SizeKind = "exact" | "approx" | "unknown";

export interface QualityOption {
  /** yt-dlp format selector for the video-only stream this row represents. */
  videoFormatId: string;
  height: number;
  fps: number | null;
  ext: string;
  bytes: number | null;
  sizeKind: SizeKind;
}

/** Preference order when a height offers more than one codec: broad
 * playability first, then the codecs YouTube reserves for higher heights. */
const VCODEC_PRIORITY = ["avc1", "vp9", "vp09", "av01"];

function vcodecFamily(vcodec: string | null | undefined): string {
  return (vcodec ?? "").split(".")[0] ?? "";
}

function isMuxCandidateVideo(f: YtDlpFormat): boolean {
  return (
    f.vcodec != null &&
    f.vcodec !== "none" &&
    (f.acodec == null || f.acodec === "none") &&
    f.protocol === "https" &&
    typeof f.height === "number"
  );
}

function isMuxCandidateAudio(f: YtDlpFormat): boolean {
  return (f.vcodec == null || f.vcodec === "none") && f.acodec != null && f.acodec !== "none" && f.protocol === "https";
}

function bestAudio(formats: YtDlpFormat[]): YtDlpFormat | null {
  const audios = formats.filter(isMuxCandidateAudio);
  // "-drc" (dynamic range compression) variants duplicate a normal track for
  // constrained playback devices; prefer the normal one when both exist.
  const preferred = audios.filter((f) => !f.format_id.endsWith("-drc"));
  const pool = preferred.length > 0 ? preferred : audios;
  return pool.sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))[0] ?? null;
}

function sizeOf(f: YtDlpFormat): { bytes: number | null; kind: SizeKind } {
  if (typeof f.filesize === "number") return { bytes: f.filesize, kind: "exact" };
  if (typeof f.filesize_approx === "number") return { bytes: f.filesize_approx, kind: "approx" };
  return { bytes: null, kind: "unknown" };
}

/**
 * Selects one muxable quality option per height: the video-only https stream
 * with the most broadly playable codec, paired (for size estimation only)
 * with the best available https audio track. Actual downloads still resolve
 * audio through yt-dlp's own "+bestaudio" selector at download time.
 */
export function selectQualities(formats: YtDlpFormat[]): QualityOption[] {
  const audio = bestAudio(formats);
  const byHeight = new Map<number, YtDlpFormat>();

  for (const f of formats) {
    if (!isMuxCandidateVideo(f)) continue;
    const height = f.height as number;
    const current = byHeight.get(height);
    if (!current) {
      byHeight.set(height, f);
      continue;
    }
    const currentRank = VCODEC_PRIORITY.indexOf(vcodecFamily(current.vcodec));
    const candidateRank = VCODEC_PRIORITY.indexOf(vcodecFamily(f.vcodec));
    if (candidateRank !== -1 && (currentRank === -1 || candidateRank < currentRank)) {
      byHeight.set(height, f);
    }
  }

  return [...byHeight.values()]
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
    .map((video) => {
      const videoSize = sizeOf(video);
      const audioSize = audio ? sizeOf(audio) : { bytes: 0, kind: "exact" as SizeKind };
      const bothKnown = videoSize.bytes != null && audioSize.bytes != null;
      const kind: SizeKind = bothKnown
        ? videoSize.kind === "exact" && audioSize.kind === "exact"
          ? "exact"
          : "approx"
        : "unknown";
      return {
        videoFormatId: video.format_id,
        height: video.height as number,
        fps: video.fps ?? null,
        ext: video.ext,
        bytes: bothKnown ? (videoSize.bytes as number) + (audioSize.bytes as number) : null,
        sizeKind: kind,
      };
    });
}
