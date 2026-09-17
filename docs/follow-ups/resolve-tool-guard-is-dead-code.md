# resolveTool never returns null, so its "missing tool" guards never fire

**Symptom**: `lib/video-download/download.ts`'s `if (!ytDlp) ...` / `if (!ffmpeg || !ffmpegDir) ...` and `lib/video-download/extract.ts`'s `if (!ytDlp) ...` guards are dead code.

**Observed evidence**: `lib/video-download/tools.ts`'s `resolveTool` always ends with `return candidates[candidates.length - 1] ?? null`, where the last candidate is the bare executable name (e.g. `"yt-dlp.exe"`). That is always a defined, non-empty string, so `resolveTool` can never actually return `null`, even when the tool is absent from both the winget links directory and `PATH`.

**Suspected cause**: the function was written to look up a known install path first and "fall back to letting the OS resolve it via PATH," but the fallback value itself is truthy, so the `string | null` return type is misleading — there is no code path that produces `null`.

**What was tried**: nothing; the guards are harmless because the actual "tool missing" detection still works via a different path — `download.ts`/`extract.ts` both catch the child process's `ENOENT` spawn error and classify it as `missing_tools` (verified at runtime for both functions). The dead guards do not currently cause incorrect behavior, only misleading code.

**Proposed next step**: either make `resolveTool` genuinely return `null` when neither the winget path nor a `PATH` lookup (e.g. via a real `where`/`which` check) finds the executable, or delete the now-redundant `if (!ytDlp)` / `if (!ffmpeg)` guards in `download.ts` and `extract.ts` and rely solely on the ENOENT path, documenting that choice.
