import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";

/**
 * Sign the current user out and bounce home. POST-only so it can't be
 * triggered by a stray GET / prefetch. Used by both staff (dashboard) and
 * client (workspace) sign-out.
 */
export async function POST(req: Request) {
  const supabase = createServerAuthClient(true);
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
