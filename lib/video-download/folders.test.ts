import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listRecentFolders, rememberRecentFolder, validateFolder } from "./folders";

describe("validateFolder", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "video-download-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("accepts a real, writable directory", async () => {
    expect(await validateFolder(tempDir)).toEqual({ ok: true });
  });

  it("rejects a path that does not exist", async () => {
    const result = await validateFolder(path.join(tempDir, "does-not-exist"));
    expect(result.ok).toBe(false);
  });

  it("rejects an empty path", async () => {
    const result = await validateFolder("   ");
    expect(result.ok).toBe(false);
  });

  it("rejects a path that is a file, not a folder", async () => {
    const filePath = path.join(tempDir, "not-a-folder.txt");
    await writeFile(filePath, "hi");
    const result = await validateFolder(filePath);
    expect(result.ok).toBe(false);
  });
});

describe("recent folders", () => {
  let stateDir: string;
  const originalEnv = process.env.VIDEO_DOWNLOADER_STATE_DIR;

  beforeEach(async () => {
    stateDir = await mkdtemp(path.join(os.tmpdir(), "video-download-state-"));
    process.env.VIDEO_DOWNLOADER_STATE_DIR = stateDir;
  });

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true });
    if (originalEnv === undefined) delete process.env.VIDEO_DOWNLOADER_STATE_DIR;
    else process.env.VIDEO_DOWNLOADER_STATE_DIR = originalEnv;
  });

  it("starts empty", async () => {
    expect(await listRecentFolders()).toEqual([]);
  });

  it("remembers a folder and persists it to disk", async () => {
    await rememberRecentFolder("C:\\Users\\User\\Downloads");
    expect(await listRecentFolders()).toEqual(["C:\\Users\\User\\Downloads"]);
  });

  it("moves a re-used folder back to the front instead of duplicating it", async () => {
    await rememberRecentFolder("C:\\A");
    await rememberRecentFolder("C:\\B");
    await rememberRecentFolder("C:\\A");
    expect(await listRecentFolders()).toEqual(["C:\\A", "C:\\B"]);
  });

  it("caps the list at 5, dropping the oldest", async () => {
    for (const folder of ["C:\\1", "C:\\2", "C:\\3", "C:\\4", "C:\\5", "C:\\6"]) {
      await rememberRecentFolder(folder);
    }
    expect(await listRecentFolders()).toEqual(["C:\\6", "C:\\5", "C:\\4", "C:\\3", "C:\\2"]);
  });
});
