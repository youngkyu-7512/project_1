import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import VideoDownloader from "@/app/video-downloader";

test("초기 화면은 제목과 주소 입력, 비활성화된 화질 불러오기 버튼을 보여준다", () => {
  render(<VideoDownloader />);

  expect(screen.getByRole("heading", { level: 1, name: "동영상 다운로더" })).toBeInTheDocument();
  expect(screen.getByPlaceholderText("https://www.youtube.com/watch?v=...")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /화질 불러오기/ })).toBeDisabled();
});

test("지원하는 사이트 버튼이 있다", () => {
  render(<VideoDownloader />);
  expect(screen.getByRole("button", { name: /지원하는 사이트/ })).toBeInTheDocument();
});
