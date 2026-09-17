# DownloadResult's folder_invalid branch can never render

**Symptom**: `app/page.tsx`'s `DownloadResult` component computes a failure `reason` with a case for `outcome.kind === "folder_invalid"`, but that case can never execute.

**Observed evidence**: `handleStartDownload` in `app/page.tsx` intercepts `outcome.kind === "folder_invalid"` and returns early (`setFolderError(outcome.reason); setStage("ready"); return;`) before ever calling `setDownloadOutcome` or `setStage("done")`. `DownloadResult` only renders when `stage === "done"` with a non-null `downloadOutcome`, so its `folder_invalid` branch is unreachable dead code.

**Suspected cause**: `DownloadResult`'s local `reason` ternary was written to exhaustively cover every member of the wire-level `DownloadOutcome` union (which includes `folder_invalid` and `bad_request` because the API route can emit them), without accounting for the fact that the parent component already handles `folder_invalid` before it can reach this component.

**What was tried**: nothing; this is purely a maintenance/readability issue, not a behavior bug — folder errors are shown correctly via the step-3 `folderError` alert instead.

**Proposed next step**: narrow the type `DownloadResult` accepts to exclude `folder_invalid` (and `bad_request`, which is also intercepted before reaching this component in practice), so the compiler flags the branch as unreachable instead of a future edit silently keeping dead code.
