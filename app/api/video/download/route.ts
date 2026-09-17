import { hasValidSession } from "@/lib/auth/require-session";
import { downloadVideo, type DownloadOutcome } from "@/lib/video-download";

type DownloadApiOutcome = DownloadOutcome | { kind: "bad_request" } | { kind: "unauthorized" };

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const line = (payload: unknown) => encoder.encode(JSON.stringify(payload) + "\n");

  if (!(await hasValidSession())) {
    return new Response(line({ type: "done", outcome: { kind: "unauthorized" } }), {
      status: 401,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }

  const body = (await request.json().catch(() => null)) as { url?: unknown; videoFormatId?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  const videoFormatId = typeof body?.videoFormatId === "string" ? body.videoFormatId : "";

  const stream = new ReadableStream({
    async start(controller) {
      const finish = (outcome: DownloadApiOutcome) => {
        controller.enqueue(line({ type: "done", outcome }));
        controller.close();
      };

      if (!url || !videoFormatId) {
        finish({ kind: "bad_request" });
        return;
      }

      const outcome = await downloadVideo({ url, videoFormatId }, (percent) => {
        controller.enqueue(line({ type: "progress", percent }));
      });

      finish(outcome);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
