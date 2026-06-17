import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * This bypasses RLS and must ONLY ever be used in server contexts
 * (API routes, server components, pipeline scripts). Never expose
 * the returned client or its key to the browser.
 */
let cached: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
  }

  cached = createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      // Next.js patches the global fetch and caches GET requests (including
      // PostgREST SELECTs) by default. That makes the service client read
      // stale data — e.g. the document-download batch replaying an already
      // drained "pending" list. Force every request to bypass that cache.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });

  return cached;
}

/**
 * Read-only anon client for server components that only need public data.
 */
export function createAnonServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
    );
  }

  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const STORAGE_BUCKET = "tender-documents";
