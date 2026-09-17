// ffmpeg-static exports a single absolute path string (or null when the
// current platform/arch has no bundled binary) via CommonJS; it ships no
// type declarations of its own.
declare module "ffmpeg-static" {
  const ffmpegPath: string | null;
  export default ffmpegPath;
}
