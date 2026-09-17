import { NextResponse } from "next/server";
import { extractVideo } from "@/lib/video-download";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!url) {
    return NextResponse.json(
      { ok: false, failure: { kind: "other", message: "주소를 입력하세요." } },
      { status: 400 },
    );
  }

  const result = await extractVideo(url);
  return NextResponse.json(result);
}
