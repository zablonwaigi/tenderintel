import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";

/**
 * Sign the current staff user out and bounce to /login. POST-only so it can't be
 * triggered by a stray GET / prefetch.
 */
export async function POST(req: Request) {
  const supabase = createServerAuthClient(true);
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
