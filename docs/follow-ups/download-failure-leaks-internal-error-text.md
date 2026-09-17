# Download failure reason can leak internal configuration details to the user

**Symptom**: When a download fails for an internal/configuration reason (not the user's fault), the exact exception message — including environment variable names — is shown verbatim in the app's "사유" (reason) field.

**Observed evidence**: With `BLOB_READ_WRITE_TOKEN` unset, `@vercel/blob`'s `put()` throws `Vercel Blob: No blob credentials found. Pass a 'token' option, set 'BLOB_READ_WRITE_TOKEN', or use 'oidcToken' (or 'VERCEL_OIDC_TOKEN') with 'storeId' or 'BLOB_STORE_ID'.`. `lib/video-download/download.ts`'s catch block around `uploadForDownload` (`return { kind: "failed", reason: err instanceof Error ? err.message : ... }`) forwards this string unchanged, and `app/video-downloader.tsx`'s `DownloadResult` renders it directly to the logged-in user.

**Suspected cause**: the catch block was written to surface *some* reason rather than swallow the error silently, without distinguishing "the user's request was fine but our server/config is broken" from ordinary download failures (blocked, tool missing, etc.) that are already safe to show verbatim.

**What was tried**: nothing yet. At this app's current scale (a small, known, trusted user group per `docs/decisions/hosting-and-access.md`), this is a minor information-disclosure concern rather than a severe one, so it was left as-is rather than fixed inline.

**Proposed next step**: classify errors thrown by `uploadForDownload` (and other server-side-only failure modes) separately from user-facing ones, and replace their message with a generic "서버에 문제가 발생했습니다. 운영자에게 알려주세요." while still logging the real exception server-side (e.g. `console.error`) for the operator to see.
