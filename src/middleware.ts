import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { hasCronSecret } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * Phase 0 security middleware (tasks 0.1 + 0.4, decisions RB2/RB3):
 *
 *   /dashboard/*        → require a staff Supabase session, else redirect /login
 *   /api/pipeline/*     → require a staff session OR a CRON_SECRET bearer, else 401
 *   /api/tenders/*      → public, but per-IP rate limited
 *
 * Cron endpoints (/api/cron/*) are intentionally NOT matched here — they keep
 * their own CRON_SECRET check in the route handler (machine callers).
 */

// Public read API: generous but bounded, to stop bulk scraping / exfiltration.
const PUBLIC_API_LIMIT = 60; // requests
const PUBLIC_API_WINDOW_MS = 60_000; // per minute per IP

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Resolve the current staff user from the request cookies, returning a response
 * whose cookies carry any refreshed session tokens (standard @supabase/ssr
 * middleware pattern).
 */
async function resolveUser(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { res, user };
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Public read API — rate limit, no auth.
  if (pathname.startsWith("/api/tenders")) {
    const rl = checkRateLimit(
      `tenders:${clientIp(req)}`,
      PUBLIC_API_LIMIT,
      PUBLIC_API_WINDOW_MS,
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }
    return NextResponse.next();
  }

  // 2. Pipeline endpoints — machine bearer OR staff session.
  if (pathname.startsWith("/api/pipeline")) {
    if (hasCronSecret(req.headers.get("authorization"))) {
      return NextResponse.next();
    }
    const { res, user } = await resolveUser(req);
    return user ? res : unauthorized();
  }

  // 3. Client workspace — any authenticated user, else send to /signup.
  if (pathname.startsWith("/workspace")) {
    const { res, user } = await resolveUser(req);
    if (user) return res;
    const url = req.nextUrl.clone();
    url.pathname = "/signup";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 4. Dashboard pages — staff session, else redirect to /login.
  if (pathname.startsWith("/dashboard")) {
    const { res, user } = await resolveUser(req);
    if (user) return res;
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/workspace/:path*",
    "/api/pipeline/:path*",
    "/api/tenders/:path*",
  ],
};
