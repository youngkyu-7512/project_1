import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { put } from "@vercel/blob";

export interface UploadedDownload {
  /** Causes browsers to download the file instead of displaying it inline
   * (per @vercel/blob: distinct from the blob's plain, inline-serving url). */
  downloadUrl: string;
}

/**
 * Uploads a finished video file to Vercel Blob and returns its download URL.
 * The response body limit that blocks streaming the file back through the
 * function itself (docs/decisions/hosting-and-access.md) does not apply
 * here: the browser fetches the bytes directly from Blob storage, never
 * through this app's function.
 */
export async function uploadForDownload(filePath: string, fileName: string): Promise<UploadedDownload> {
  const { size } = await stat(filePath);
  const blob = await put(fileName, createReadStream(filePath), {
    access: "public",
    addRandomSuffix: true,
    multipart: size > 50 * 1024 * 1024,
  });
  return { downloadUrl: blob.downloadUrl };
}
