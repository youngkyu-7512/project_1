import { NextResponse } from "next/server";
import { defaultDownloadFolder, listRecentFolders } from "@/lib/video-download";

export async function GET() {
  const recentFolders = await listRecentFolders();
  return NextResponse.json({ defaultFolder: defaultDownloadFolder(), recentFolders });
}
