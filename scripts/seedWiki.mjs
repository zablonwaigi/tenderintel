#!/usr/bin/env node
// Seed the wiki_articles table directly via the Supabase service role key.
// Usage: node scripts/seedWiki.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//
// Note: this reads the article definitions from the compiled API instead;
// to avoid duplicating content, prefer calling the protected endpoint:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//        https://your-app/api/admin/seed-wiki
//
// This standalone script posts to that endpoint for convenience.

const url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("ERROR: CRON_SECRET is required to call the seed endpoint.");
  process.exit(1);
}

const res = await fetch(`${url}/api/admin/seed-wiki`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("Seed failed:", res.status, body);
  process.exit(1);
}
console.log("Wiki seeded:", body);
