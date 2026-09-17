"use client";

import { useState } from "react";
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiCloseLine,
  RiDownloadCloudLine,
  RiErrorWarningLine,
  RiGlobalLine,
  RiLoader4Line,
} from "@remixicon/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FEATURED_SITES, TOTAL_SUPPORTED_SITES } from "@/lib/video-download/sites";
import type { ExtractResult, ExtractedVideo, ExtractionFailure, QualityOption } from "@/lib/video-download";

type DownloadOutcome =
  | { kind: "success"; downloadUrl: string; fileName: string }
  | { kind: "missing_tools"; tool: "yt-dlp" | "ffmpeg"; message: string }
  | { kind: "failed"; reason: string }
  | { kind: "bad_request" }
  | { kind: "unauthorized" };

type Stage = "idle" | "extracting" | "ready" | "downloading" | "done";

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || Number.isNaN(seconds)) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function qualitySizeLabel(q: QualityOption): { primary: string; note?: string } {
  if (q.sizeKind === "unknown" || q.bytes == null) {
    return { primary: "크기 미상", note: "받아야 알 수 있음" };
  }
  if (q.sizeKind === "approx") {
    return { primary: `약 ${formatBytes(q.bytes)}`, note: "근사치" };
  }
  return { primary: formatBytes(q.bytes) };
}

async function streamDownload(
  params: { url: string; videoFormatId: string },
  onProgress: (percent: number) => void,
): Promise<DownloadOutcome> {
  const res = await fetch("/api/video/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const reader = res.body?.getReader();
  if (!reader) return { kind: "failed", reason: "다운로드 응답을 받지 못했습니다." };

  const decoder = new TextDecoder();
  let buf = "";
  let outcome: DownloadOutcome | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as { type: "progress"; percent: number } | { type: "done"; outcome: DownloadOutcome };
      if (msg.type === "progress") onProgress(msg.percent);
      else outcome = msg.outcome;
    }
  }

  return outcome ?? { kind: "failed", reason: "다운로드 응답이 끊어졌습니다." };
}

export default function VideoDownloader() {
  const [sitesOpen, setSitesOpen] = useState(false);

  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [extractFailure, setExtractFailure] = useState<ExtractionFailure | null>(null);
  const [video, setVideo] = useState<ExtractedVideo | null>(null);
  // "" (never null/undefined) so RadioGroup stays controlled from its first
  // render — switching from an undefined initial value to a defined one
  // triggers Base UI's uncontrolled-to-controlled warning.
  const [selectedQualityId, setSelectedQualityId] = useState("");

  const [progress, setProgress] = useState(0);
  const [downloadOutcome, setDownloadOutcome] = useState<DownloadOutcome | null>(null);

  const resetAll = () => {
    setUrl("");
    setStage("idle");
    setExtractFailure(null);
    setVideo(null);
    setSelectedQualityId("");
    setProgress(0);
    setDownloadOutcome(null);
  };

  const handleFetchQuality = async () => {
    if (!url.trim() || stage === "extracting" || stage === "downloading") return;
    setStage("extracting");
    setExtractFailure(null);
    setVideo(null);
    setSelectedQualityId("");
    try {
      const res = await fetch("/api/video/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as ExtractResult;
      if (data.ok) {
        setVideo(data.video);
        setStage("ready");
      } else {
        setExtractFailure(data.failure);
        setStage("idle");
      }
    } catch {
      setExtractFailure({ kind: "other", message: "네트워크 오류가 발생했습니다." });
      setStage("idle");
    }
  };

  const handleStartDownload = async () => {
    if (!video || selectedQualityId === "" || stage === "downloading") return;
    setStage("downloading");
    setProgress(0);
    setDownloadOutcome(null);

    const outcome = await streamDownload({ url, videoFormatId: selectedQualityId }, setProgress);

    setDownloadOutcome(outcome);
    setStage("done");
  };

  const durationLabel = video ? formatDuration(video.durationSeconds) : null;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 py-10 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-4 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <RiDownloadCloudLine className="size-7 text-primary" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">동영상 다운로더</h1>
          </div>
          <Button variant="outline" onClick={() => setSitesOpen(true)}>
            <RiGlobalLine />
            지원하는 사이트
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          동영상이 있는 웹 페이지 주소를 붙여넣으면, 받을 화질을 고르고 파일로 받습니다.
        </p>

        {/* 1. 주소 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StepBadge n={1} />
              동영상 주소
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setExtractFailure(null);
                    setStage("idle");
                    setVideo(null);
                    setSelectedQualityId("");
                  }}
                  disabled={stage === "downloading"}
                  placeholder="https://www.youtube.com/watch?v=..."
                  aria-label="동영상 주소"
                  className="pr-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleFetchQuality();
                  }}
                />
                {url && (
                  <button
                    type="button"
                    aria-label="주소 지우기"
                    onClick={resetAll}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <RiCloseLine className="size-4" />
                  </button>
                )}
              </div>
              <Button
                onClick={() => void handleFetchQuality()}
                disabled={!url.trim() || stage === "extracting" || stage === "downloading"}
              >
                {stage === "extracting" ? <RiLoader4Line className="animate-spin" /> : null}
                화질 불러오기
              </Button>
            </div>

            {extractFailure && (
              <Alert className="mt-3">
                <RiErrorWarningLine />
                <AlertTitle>{extractFailureTitle(extractFailure)}</AlertTitle>
                <AlertDescription>{extractFailureMessage(extractFailure)}</AlertDescription>
                {(extractFailure.kind === "blocked" || extractFailure.kind === "missing_tools") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-fit"
                    onClick={() => void handleFetchQuality()}
                  >
                    다시 시도
                  </Button>
                )}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 2. 화질 */}
        {(stage === "extracting" || (video && (stage === "ready" || stage === "downloading"))) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StepBadge n={2} />
                화질 선택
              </CardTitle>
            </CardHeader>
            <CardContent className="gap-4">
              {stage === "extracting" && (
                <div className="flex flex-col gap-4">
                  <div className="flex gap-3.5">
                    <Skeleton className="aspect-video w-40 flex-none" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-2/5" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                  </div>
                </div>
              )}

              {video && (
                <>
                  <Item>
                    <ItemMedia variant="image" className="relative aspect-video size-auto w-40 overflow-hidden rounded-md bg-muted">
                      {video.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- thumbnail domains span arbitrary supported sites, cannot be allowlisted for next/image
                        <img src={video.thumbnailUrl} alt="동영상 스냅샷" className="size-full object-cover" />
                      ) : (
                        <div className="size-full bg-muted" />
                      )}
                      {durationLabel && (
                        <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white">
                          {durationLabel}
                        </span>
                      )}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="line-clamp-2 h-auto whitespace-normal">{video.title}</ItemTitle>
                      <ItemDescription className="font-mono">{video.id}</ItemDescription>
                    </ItemContent>
                  </Item>

                  {video.formatsIncomplete && (
                    <Alert>
                      <RiErrorWarningLine />
                      <AlertTitle>받을 수 있는 화질이 다 보이지 않을 수 있습니다</AlertTitle>
                      <AlertDescription>
                        이 PC에 자바스크립트 런타임이 없어 일부 고화질이 목록에서 빠졌습니다. 아래 화질은 그대로 받을 수
                        있습니다.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Field>
                    <FieldLabel>받을 화질</FieldLabel>
                    <RadioGroup
                      value={selectedQualityId}
                      onValueChange={(v) => setSelectedQualityId(v as string)}
                      disabled={stage === "downloading"}
                    >
                      {video.qualities.map((q) => {
                        const size = qualitySizeLabel(q);
                        return (
                          <FieldLabel key={q.videoFormatId} className="flex-row items-center">
                            <RadioGroupItem value={q.videoFormatId} />
                            <div className="flex flex-1 items-center justify-between gap-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="flex items-center gap-1.5 text-sm font-medium">
                                  {q.height}p{q.fps ? ` · ${q.fps}fps` : ""}
                                  <Badge variant="outline">{q.ext}</Badge>
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                <span
                                  className={cn(
                                    "font-mono text-sm font-medium",
                                    q.sizeKind === "unknown" && "font-normal text-muted-foreground",
                                  )}
                                >
                                  {size.primary}
                                </span>
                                {size.note && <span className="text-[11px] text-muted-foreground">{size.note}</span>}
                              </div>
                            </div>
                          </FieldLabel>
                        );
                      })}
                    </RadioGroup>
                    <FieldDescription>모든 항목은 영상과 소리가 합쳐진 파일 하나로 저장됩니다.</FieldDescription>
                  </Field>

                  {stage === "ready" && (
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={selectedQualityId === ""}
                      onClick={() => void handleStartDownload()}
                    >
                      다운로드 시작
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* 3. 진행 */}
        {stage === "downloading" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StepBadge n={3} />
                받는 중
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono font-medium text-foreground">
                  {video?.qualities.find((q) => q.videoFormatId === selectedQualityId)?.height}p
                </span>{" "}
                받고 합치는 중입니다. 끝나면 바로 다운로드로 이어집니다.
              </p>
              <Progress value={progress}>
                <ProgressTrack>
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
              <div className="flex justify-between font-mono text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{Math.round(progress)}%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 결과 */}
        {stage === "done" && downloadOutcome && (
          <Card>
            <CardContent>
              <DownloadResult outcome={downloadOutcome} onReset={resetAll} onRetry={() => void handleStartDownload()} />
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={sitesOpen} onOpenChange={setSitesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>지원하는 사이트</DialogTitle>
            <DialogDescription>
              자주 쓰는 곳은 아래와 같고, 전체로는 {TOTAL_SUPPORTED_SITES.toLocaleString("ko-KR")}곳을 다룹니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2">
            {FEATURED_SITES.map((site) => (
              <div
                key={site.name}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-center text-[13px]",
                  !site.reliable && "border-dashed text-muted-foreground",
                )}
                title={!site.reliable ? "사이트 쪽 차단으로 실패할 수 있습니다" : undefined}
              >
                {!site.reliable && <RiErrorWarningLine className="size-3.5 shrink-0" />}
                {site.name}
              </div>
            ))}
          </div>

          <Alert>
            <RiErrorWarningLine />
            <AlertTitle>점선으로 표시한 곳은 실패할 수 있습니다</AlertTitle>
            <AlertDescription>
              유튜브는 자동 다운로드를 막는 검사가 자주 바뀌어, 같은 영상이라도 어떤 날은 되고 어떤 날은 막힙니다. 목록에
              있다고 항상 받을 수 있다는 뜻은 아닙니다.
            </AlertDescription>
          </Alert>

          <p className="text-sm text-muted-foreground">
            목록에 없는 사이트도 주소를 넣고 <b className="text-foreground">화질 불러오기</b>를 눌러 시도할 수 있습니다.
            로그인이 필요한 비공개 영상과 재생목록·채널 주소는 받을 수 없습니다.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex size-5 flex-none items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
      {n}
    </span>
  );
}

function extractFailureTitle(failure: ExtractionFailure): string {
  switch (failure.kind) {
    case "unsupported_url":
      return "이 주소에서는 동영상을 찾지 못했습니다";
    case "blocked":
      return "사이트가 자동 요청을 막았습니다";
    case "missing_tools":
      return "서버에 필요한 프로그램을 찾을 수 없습니다";
    default:
      return "추출하지 못했습니다";
  }
}

function extractFailureMessage(failure: ExtractionFailure): string {
  switch (failure.kind) {
    case "unsupported_url":
      return "재생목록이나 채널 주소이거나, 지원하지 않는 사이트일 수 있습니다. 동영상 하나를 가리키는 주소인지 확인한 뒤 다시 시도하세요.";
    case "blocked":
      return "주소는 정상이지만 사이트가 지금 이 요청을 사람이 아닌 것으로 보고 차단했습니다. 잠시 뒤에 다시 시도하세요. 계속 막히면 이 영상은 받을 수 없습니다.";
    case "missing_tools":
      return "일시적인 서버 문제입니다. 잠시 후 다시 시도하거나 운영자에게 알려주세요.";
    default:
      return failure.message;
  }
}

function DownloadResult({
  outcome,
  onReset,
  onRetry,
}: {
  outcome: DownloadOutcome;
  onReset: () => void;
  onRetry: () => void;
}) {
  if (outcome.kind === "success") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 flex-none items-center justify-center rounded-full bg-primary/15 text-primary">
            <RiCheckboxCircleLine className="size-[18px]" />
          </span>
          <div>
            <div className="text-[15px] font-semibold">받을 준비가 됐습니다</div>
            <div className="text-sm text-muted-foreground break-all">{outcome.fileName}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<a href={outcome.downloadUrl} />}>
            <RiDownloadCloudLine />
            다운로드
          </Button>
          <Button variant="ghost" onClick={onReset}>
            새 주소 입력
          </Button>
        </div>
      </div>
    );
  }

  if (outcome.kind === "unauthorized") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 flex-none items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <RiCloseCircleLine className="size-[18px]" />
          </span>
          <div className="text-[15px] font-semibold">로그인이 만료되었습니다</div>
        </div>
        <Button render={<a href="/login" />}>다시 로그인</Button>
      </div>
    );
  }

  const reason =
    outcome.kind === "failed"
      ? outcome.reason
      : outcome.kind === "missing_tools"
        ? "서버에 필요한 프로그램을 찾을 수 없습니다. 운영자에게 알려주세요."
        : "요청이 올바르지 않습니다.";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 flex-none items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <RiCloseCircleLine className="size-[18px]" />
        </span>
        <div>
          <div className="text-[15px] font-semibold">다운로드하지 못했습니다</div>
        </div>
      </div>
      <div className="grid gap-2 rounded-md border bg-muted p-3">
        <div className="grid grid-cols-[62px_1fr] items-baseline gap-3">
          <span className="text-xs text-muted-foreground">사유</span>
          <span className="font-mono text-[13px] break-all">{reason}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetry}>다시 시도</Button>
        <Button variant="ghost" onClick={onReset}>
          새 주소 입력
        </Button>
      </div>
    </div>
  );
}
