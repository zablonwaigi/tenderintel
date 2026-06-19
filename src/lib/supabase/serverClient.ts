import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Cookie-backed Supabase client for Server Components and Route Handlers that
 * need the CURRENT STAFF SESSION (auth.getUser, signOut). Uses the anon key and
 * the request cookies — distinct from createServiceClient() in ./server, which
 * uses the service-role key and bypasses RLS for pipeline work.
 *
 * Pass `writable: true` from a Route Handler / Server Action so session-cookie
 * refreshes can be written back; Server Components cannot set cookies, so the
 * default no-op write keeps Next.js from throwing.
 */
export function createServerAuthClient(writable = false) {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          if (!writable) return;
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a context where cookies are read-only — ignore.
          }
        },
      },
    },
  );
}
