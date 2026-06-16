import { NextRequest } from "next/server";

/**
 * Verify a request carries the correct CRON_SECRET bearer token.
 * Accepts either `Authorization: Bearer <secret>` or `?secret=<secret>`.
 */
export function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${secret}`) return true;

  const qs = req.nextUrl.searchParams.get("secret");
  if (qs && qs === secret) return true;

  return false;
}
