import { access, constants, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const MAX_RECENT = 5;
// Overridable so tests exercise the real filesystem without touching the
// actual user's home directory.
const stateDir = () => process.env.VIDEO_DOWNLOADER_STATE_DIR ?? path.join(os.homedir(), ".video-downloader");
const stateFile = () => path.join(stateDir(), "recent-folders.json");

export function defaultDownloadFolder(): string {
  return path.join(os.homedir(), "Downloads");
}

export type FolderValidation = { ok: true } | { ok: false; reason: string };

/** A folder is usable only when it already exists and is writable; this tool
 * never creates the destination folder itself (spec: 존재하지 않거나 쓸 수
 * 없는 경로이면 다운로드를 시작하기 전에 안내하고, 시작하지 않습니다). */
export async function validateFolder(folderPath: string): Promise<FolderValidation> {
  const trimmed = folderPath.trim();
  if (!trimmed) return { ok: false, reason: "폴더 경로를 입력하세요." };
  try {
    const info = await stat(trimmed);
    if (!info.isDirectory()) return { ok: false, reason: "폴더를 찾을 수 없거나 쓸 수 없습니다." };
    await access(trimmed, constants.W_OK);
    return { ok: true };
  } catch {
    return { ok: false, reason: "폴더를 찾을 수 없거나 쓸 수 없습니다." };
  }
}

export async function listRecentFolders(): Promise<string[]> {
  try {
    const raw = await readFile(stateFile(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

/** Records a folder as most-recently-used, capped at 5 entries (spec
 * assumption), moving it to the front when it was already present. */
export async function rememberRecentFolder(folderPath: string): Promise<string[]> {
  const current = await listRecentFolders();
  const next = [folderPath, ...current.filter((p) => p !== folderPath)].slice(0, MAX_RECENT);
  await mkdir(stateDir(), { recursive: true });
  await writeFile(stateFile(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

/** Opens the folder in Windows Explorer. Fire-and-forget: explorer.exe's own
 * exit code is not a reliable success signal, and the spec only requires the
 * action to exist, not to be confirmed. spawn (no shell) avoids passing the
 * user-supplied path through a shell that could reinterpret it.
 *
 * windowsHide must NOT be set here: it maps to SW_HIDE in the process's
 * startup info, and confirmed live (via Shell.Application's window list) that
 * explorer.exe honors it by creating the folder window with Visible=False —
 * the window exists but nothing appears on screen. */
export function openFolder(folderPath: string): void {
  const child = spawn("explorer.exe", [folderPath], { detached: true });
  // explorer.exe's own exit code is unreliable, but an unhandled 'error'
  // (e.g. spawn ENOENT) would otherwise throw uncaught and can crash the
  // server; a no-op listener keeps this action best-effort as intended.
  child.on("error", () => {});
  child.unref();
}
