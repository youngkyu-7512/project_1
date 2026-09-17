import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // bin/yt-dlp (a committed Linux binary) and ffmpeg-static's bundled binary
  // are invoked at runtime via child_process, not imported/required, so
  // Next.js's automatic file tracing cannot discover them on its own.
  outputFileTracingIncludes: {
    "/api/video/extract": ["./bin/**/*"],
    "/api/video/download": ["./bin/**/*", "./node_modules/ffmpeg-static/**/*"],
  },
  // ffmpeg-static resolves its bundled binary's path via `path.join(__dirname, ...)`.
  // Bundling it (the default) rewrites __dirname to a placeholder that doesn't
  // exist at runtime — confirmed live: yt-dlp reported
  // "ffmpeg-location \ROOT\node_modules\ffmpeg-static does not exist!" and
  // silently produced separate, unmerged video/audio files instead of erroring.
  // Leaving it external makes it a plain Node require(), so __dirname resolves
  // to its real on-disk location.
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
