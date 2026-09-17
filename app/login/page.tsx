"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiDownloadCloudLine, RiErrorWarningLine } from "@remixicon/react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; reason?: string };
      if (data.ok) {
        router.replace("/");
        router.refresh();
      } else {
        setError(data.reason ?? "비밀번호가 틀렸습니다.");
        setPending(false);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RiDownloadCloudLine className="size-6 text-primary" aria-hidden />
            동영상 다운로더
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="password">비밀번호</FieldLabel>
              <Input
                id="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                aria-invalid={!!error}
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <RiErrorWarningLine />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}
            <Button type="submit" disabled={!password || pending} className="w-full">
              {pending ? "확인하는 중" : "들어가기"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
