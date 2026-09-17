import { describe, expect, it } from "vitest";
import { classifyExtractionFailure, hasIncompleteFormatsWarning, isPlaylistOrChannelResult } from "./errors";

describe("classifyExtractionFailure", () => {
  it("classifies ffmpeg missing (captured real yt-dlp stderr)", () => {
    const stderr =
      "ERROR: You have requested downloading the video partially, but ffmpeg is not installed. Aborting";
    expect(classifyExtractionFailure(stderr)).toEqual({
      kind: "missing_tools",
      tool: "ffmpeg",
      message: stderr,
    });
  });

  it("classifies an unsupported site (captured real yt-dlp stderr for https://example.com)", () => {
    const stderr = "ERROR: Unsupported URL: https://example.com/";
    expect(classifyExtractionFailure(stderr).kind).toBe("unsupported_url");
  });

  it("classifies an unavailable video as unsupported (captured real yt-dlp stderr)", () => {
    const stderr = "ERROR: [youtube] 00000000000: This video is unavailable";
    expect(classifyExtractionFailure(stderr).kind).toBe("unsupported_url");
  });

  it("classifies a bot/rate-limit block", () => {
    const stderr = "ERROR: [youtube] abcdef12345: Sign in to confirm you're not a bot";
    expect(classifyExtractionFailure(stderr).kind).toBe("blocked");
  });

  it("falls back to other for an unrecognized message", () => {
    const stderr = "ERROR: something yt-dlp has never said before";
    expect(classifyExtractionFailure(stderr).kind).toBe("other");
  });
});

describe("isPlaylistOrChannelResult", () => {
  it("recognizes a real playlist JSON shape (captured with --no-playlist on a pure playlist URL)", () => {
    // yt-dlp still resolves a playlist URL successfully; it has no top-level
    // `formats`, only `entries`. Fields trimmed to what the check reads.
    const playlistJson = {
      _type: "playlist",
      id: "PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab",
      title: "Essence of linear algebra",
      playlist_count: 16,
      entries: [{ id: "video1" }, { id: "video2" }],
    };
    expect(isPlaylistOrChannelResult(playlistJson)).toBe(true);
  });

  it("does not flag a normal single-video result", () => {
    expect(isPlaylistOrChannelResult({ id: "aqz-KE-bpKQ", formats: [{ format_id: "1" }] })).toBe(false);
  });
});

describe("hasIncompleteFormatsWarning", () => {
  it("detects the n-challenge warning (captured real yt-dlp stderr)", () => {
    const stderr = "WARNING: [youtube] aqz-KE-bpKQ: n challenge solving failed: Some formats may be missing.";
    expect(hasIncompleteFormatsWarning(stderr)).toBe(true);
  });

  it("is false for unrelated warnings", () => {
    expect(hasIncompleteFormatsWarning("WARNING: unrelated notice")).toBe(false);
  });
});
