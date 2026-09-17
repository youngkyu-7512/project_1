import { downloadVideo, rememberRecentFolder, validateFolder, type DownloadOutcome } from "@/lib/video-download";

type DownloadApiOutcome = DownloadOutcome | { kind: "folder_invalid"; reason: string } | { kind: "bad_request" };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { url?: unknown; videoFormatId?: unknown; folder?: unknown }
    | null;
  const url = typeof body?.url === "string" ? body.url : "";
  const videoFormatId = typeof body?.videoFormatId === "string" ? body.videoFormatId : "";
  const folder = typeof body?.folder === "string" ? body.folder : "";

  const encoder = new TextEncoder();
  const line = (payload: unknown) => encoder.encode(JSON.stringify(payload) + "\n");

  const stream = new ReadableStream({
    async start(controller) {
      const finish = (outcome: DownloadApiOutcome) => {
        controller.enqueue(line({ type: "done", outcome }));
        controller.close();
      };

      if (!url || !videoFormatId || !folder) {
        finish({ kind: "bad_request" });
        return;
      }

      const folderCheck = await validateFolder(folder);
      if (!folderCheck.ok) {
        finish({ kind: "folder_invalid", reason: folderCheck.reason });
        return;
      }

      const outcome = await downloadVideo({ url, videoFormatId, folder }, (percent) => {
        controller.enqueue(line({ type: "progress", percent }));
      });

      if (outcome.kind === "success" || outcome.kind === "already_exists") {
        await rememberRecentFolder(folder);
      }
      finish(outcome);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
