import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSessionToken, passwordMatches, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  const expected = process.env.ACCESS_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!expected || !secret) {
    return NextResponse.json({ ok: false, reason: "서버에 로그인이 설정되지 않았습니다." }, { status: 500 });
  }

  if (!passwordMatches(password, expected)) {
    return NextResponse.json({ ok: false, reason: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
