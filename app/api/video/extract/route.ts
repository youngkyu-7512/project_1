import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth/require-session";
import { extractVideo } from "@/lib/video-download";

export async function POST(request: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ ok: false, failure: { kind: "other", message: "로그인이 필요합니다." } }, { status: 401 });
  }

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
