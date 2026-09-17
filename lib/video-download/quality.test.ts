import { describe, expect, it } from "vitest";
import { selectQualities, type YtDlpFormat } from "./quality";
import fixture from "./__fixtures__/youtube-aqz-KE-bpKQ.json";

describe("selectQualities", () => {
  const options = selectQualities(fixture.formats as YtDlpFormat[]);

  it("returns one option per height, sorted from highest to lowest", () => {
    const heights = options.map((o) => o.height);
    expect(heights).toEqual([2160, 1440, 1080, 720, 480, 360, 240, 144]);
  });

  it("prefers the broadly playable codec when a height offers more than one", () => {
    // Real fixture: 1080p has avc1 (299), vp9 (303) and av01 (399) https streams.
    const at1080 = options.find((o) => o.height === 1080);
    expect(at1080?.videoFormatId).toBe("299");
    expect(at1080?.ext).toBe("mp4");
  });

  it("falls back to the only available codec when avc1 is absent", () => {
    // Real fixture: YouTube offers no avc1 above 1080p; 2160p is vp9/av01 only.
    const at2160 = options.find((o) => o.height === 2160);
    expect(at2160?.videoFormatId).toBe("315");
    expect(at2160?.ext).toBe("webm");
  });

  it("reports an exact combined size when both streams have a precise filesize", () => {
    const at1080 = options.find((o) => o.height === 1080)!;
    expect(at1080.sizeKind).toBe("exact");
    // video 257619653 (299) + audio 140 (m4a, 129.481kbps, highest non-drc abr) 10271496
    expect(at1080.bytes).toBe(257619653 + 10271496);
  });

  it("excludes HLS duplicates that carry no size information", () => {
    const at1080Ids = fixture.formats.filter((f) => f.height === 1080).map((f) => f.format_id);
    expect(at1080Ids).toContain("312"); // m3u8 duplicate, must not be selected
    const at1080 = options.find((o) => o.height === 1080)!;
    expect(at1080.videoFormatId).not.toBe("312");
  });
});
