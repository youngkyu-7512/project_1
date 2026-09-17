import { existsSync } from "fs";
import path from "path";

export type ToolName = "yt-dlp" | "ffmpeg";

/**
 * winget places its executable aliases here regardless of the package's own
 * install location; PATH is not reliably updated in the same session that
 * installed the tool (confirmed in docs/decisions/video-extraction.md).
 */
function wingetLinksDir(): string {
  const localAppData = process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Local");
  return path.join(localAppData, "Microsoft", "WinGet", "Links");
}

function candidatePaths(tool: ToolName): string[] {
  const exe = `${tool}.exe`;
  return [path.join(wingetLinksDir(), exe), exe];
}

/** Resolves a tool to an invocable path, or null when it cannot be found. */
export function resolveTool(tool: ToolName): string | null {
  const candidates = candidatePaths(tool);
  const known = candidates.find((candidate) => path.isAbsolute(candidate) && existsSync(candidate));
  if (known) return known;
  // Last candidate is the bare executable name; let the OS resolve it via PATH.
  return candidates[candidates.length - 1] ?? null;
}

export interface ToolAvailability {
  ytDlp: string | null;
  ffmpeg: string | null;
  ffmpegDir: string | null;
}

export function resolveTools(): ToolAvailability {
  const ytDlp = resolveTool("yt-dlp");
  const ffmpeg = resolveTool("ffmpeg");
  return {
    ytDlp,
    ffmpeg,
    ffmpegDir: ffmpeg ? path.dirname(ffmpeg) : null,
  };
}
