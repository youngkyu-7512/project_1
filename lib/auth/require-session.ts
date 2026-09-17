import { cookies } from "next/headers";
import { isValidSessionToken, SESSION_COOKIE_NAME } from "./session";

/** Checked by every protected page and API route (app/page.tsx,
 * app/api/video/extract, app/api/video/download). No middleware: with only
 * three protected surfaces, an explicit check at each one is simpler than
 * introducing Edge middleware for this. */
export async function hasValidSession(): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const store = await cookies();
  return isValidSessionToken(store.get(SESSION_COOKIE_NAME)?.value, secret);
}
