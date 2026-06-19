"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client for staff auth (login page). Uses the public anon key
 * and writes the session to cookies that the middleware/server can read. Never
 * use the service-role key here.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
