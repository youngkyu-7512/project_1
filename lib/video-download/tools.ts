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

/**
 * ffmpeg-static's own binary download runs as a bun/npm install-time script,
 * which turned out to depend on the install cache actually re-running that
 * script (confirmed broken in production once via a stale Vercel build cache
 * even with the package correctly listed in trustedDependencies — see
 * docs/decisions/hosting-and-access.md). A committed Linux binary at
 * bin/ffmpeg removes that dependency on install-time behavior entirely, the
 * same way bin/yt-dlp does. Local Windows development keeps using
 * ffmpeg-static's own downloaded ffmpeg.exe.
 */
function resolveFfmpeg(): string | null {
  if (process.platform !== "win32") {
    const bundled = path.join(process.cwd(), "bin", "ffmpeg");
    if (existsSync(bundled)) return bundled;
  }
  return ffmpegStaticPath;
}

export interface ToolAvailability {
  ytDlp: string | null;
  ffmpeg: string | null;
  ffmpegDir: string | null;
}

export function resolveTools(): ToolAvailability {
  const ytDlp = resolveYtDlp();
  const ffmpeg = resolveFfmpeg();
  return {
    ytDlp,
    ffmpeg,
    ffmpegDir: ffmpeg ? path.dirname(ffmpeg) : null,
  };
}
