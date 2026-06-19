import type { NextRequest } from "next/server";

/**
 * Verify a request carries the correct CRON_SECRET bearer token.
 * Accepts either `Authorization: Bearer <secret>` or `?secret=<secret>`.
 *
 * This is the MACHINE auth path (Coolify cron tasks, internal triggers). Staff
 * access to the dashboard and pipeline UIs goes through Supabase Auth + the
 * middleware (see src/middleware.ts), not this function.
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

/**
 * Header-only CRON_SECRET check for the middleware, which gates /api/pipeline/*
 * by EITHER a valid machine bearer token OR a staff Supabase session. Pure and
 * runtime-agnostic (no NextRequest), so it is unit-testable and Edge-safe.
 */
export function hasCronSecret(authorizationHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorizationHeader) return false;
  return authorizationHeader === `Bearer ${secret}`;
}
