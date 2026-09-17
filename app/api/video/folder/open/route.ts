import { NextResponse } from "next/server";
import { openFolder, validateFolder } from "@/lib/video-download";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { folder?: unknown } | null;
  const folder = typeof body?.folder === "string" ? body.folder : "";

  const validation = await validateFolder(folder);
  if (!validation.ok) {
    return NextResponse.json(validation, { status: 400 });
  }

  openFolder(folder);
  return NextResponse.json({ ok: true });
}
