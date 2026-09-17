export interface SupportedSite {
  name: string;
  /** false marks a site whose downloads can fail even when the address is
   * valid, per spec: 성공이 보장되지 않는 사이트는 목록에서 구별되어 보인다. */
  reliable: boolean;
}

// yt-dlp --list-extractors, counted in this environment during shaping
// (docs/decisions/video-extraction.md). Re-measure before trusting this
// number again; it changes with every yt-dlp release.
export const TOTAL_SUPPORTED_SITES = 1752;

export const FEATURED_SITES: SupportedSite[] = [
  { name: "YouTube", reliable: false },
  { name: "Vimeo", reliable: true },
  { name: "X (Twitter)", reliable: true },
  { name: "Instagram", reliable: true },
  { name: "Facebook", reliable: true },
  { name: "TikTok", reliable: true },
  { name: "Twitch", reliable: true },
  { name: "Dailymotion", reliable: true },
  { name: "네이버 TV", reliable: true },
  { name: "카카오 TV", reliable: true },
  { name: "SoundCloud", reliable: true },
  { name: "Reddit", reliable: true },
  { name: "BiliBili", reliable: true },
];
