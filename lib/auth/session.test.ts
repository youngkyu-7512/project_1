import { describe, expect, it, vi } from "vitest";
import { createSessionToken, isValidSessionToken, passwordMatches, SESSION_MAX_AGE_SECONDS } from "./session";

describe("passwordMatches", () => {
  it("accepts the exact expected password", () => {
    expect(passwordMatches("hunter2", "hunter2")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(passwordMatches("wrong", "hunter2")).toBe(false);
  });

  it("rejects when either side is empty", () => {
    expect(passwordMatches("", "hunter2")).toBe(false);
    expect(passwordMatches("hunter2", "")).toBe(false);
  });
});

describe("session tokens", () => {
  const secret = "test-secret";

  it("accepts a token it just issued", () => {
    const token = createSessionToken(secret);
    expect(isValidSessionToken(token, secret)).toBe(true);
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken("other-secret");
    expect(isValidSessionToken(token, secret)).toBe(false);
  });

  it("rejects a tampered issuedAt", () => {
    const token = createSessionToken(secret);
    const [, signature] = token.split(".");
    const tampered = `${Date.now() + 1_000_000}.${signature}`;
    expect(isValidSessionToken(tampered, secret)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(isValidSessionToken(undefined, secret)).toBe(false);
    expect(isValidSessionToken("", secret)).toBe(false);
    expect(isValidSessionToken("no-dot-here", secret)).toBe(false);
  });

  it("rejects a token older than the session lifetime", () => {
    const realNow = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(realNow - (SESSION_MAX_AGE_SECONDS * 1000 + 1));
    const token = createSessionToken(secret);
    vi.spyOn(Date, "now").mockReturnValue(realNow);
    expect(isValidSessionToken(token, secret)).toBe(false);
    vi.restoreAllMocks();
  });
});
