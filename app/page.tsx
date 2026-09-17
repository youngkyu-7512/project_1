import { redirect } from "next/navigation";
import { hasValidSession } from "@/lib/auth/require-session";
import VideoDownloader from "./video-downloader";

export default async function Page() {
  if (!(await hasValidSession())) {
    redirect("/login");
  }
  return <VideoDownloader />;
}
