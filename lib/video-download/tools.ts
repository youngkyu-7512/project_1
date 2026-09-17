import { existsSync } from "fs";
import path from "path";
import ffmpegStaticPath from "ffmpeg-static";

/**
 * winget places its executable aliases here regardless of the package's own
 * install location; PATH is not reliably updated in the same session that
 * installed the tool (confirmed in docs/decisions/video-extraction.md). Only
 * relevant when developing locally on Windows.
 */
function wingetLinksDir(): string {
  const localAppData = process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Local");
  return path.join(localAppData, "Microsoft", "WinGet", "Links");
}

/**
 * Resolves yt-dlp for the current platform. Production runs on Vercel's
 * managed Linux, which has no package manager step to pre-install yt-dlp on,
 * so a static Linux binary is committed at bin/yt-dlp and bundled into the
 * function output via next.config.ts's outputFileTracingIncludes. Local
 * Windows development keeps using the winget-installed copy.
 */
function resolveYtDlp(): string | null {
  if (process.platform === "win32") {
    const wingetPath = path.join(wingetLinksDir(), "yt-dlp.exe");
    if (existsSync(wingetPath)) return wingetPath;
    return "yt-dlp.exe";
  }
  const bundled = path.join(process.cwd(), "bin", "yt-dlp");
  if (existsSync(bundled)) return bundled;
  return "yt-dlp";
}

export interface ToolAvailability {
  ytDlp: string | null;
  ffmpeg: string | null;
  ffmpegDir: string | null;
}

export function resolveTools(): ToolAvailability {
  const ytDlp = resolveYtDlp();
  // ffmpeg-static resolves to a real binary matching whatever platform it
  // was installed on (ffmpeg.exe here in local Windows dev, a static Linux
  // binary once installed during Vercel's build), so no platform branching
  // is needed for ffmpeg itself.
  const ffmpeg = ffmpegStaticPath;
  return {
    ytDlp,
    ffmpeg,
    ffmpegDir: ffmpeg ? path.dirname(ffmpeg) : null,
  };
}
