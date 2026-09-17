import { NextResponse } from "next/server";
import { validateFolder } from "@/lib/video-download";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { folder?: unknown } | null;
  const folder = typeof body?.folder === "string" ? body.folder : "";
  const result = await validateFolder(folder);
  return NextResponse.json(result);
}
