#!/usr/bin/env node
/* eslint-disable */
// Apply pending SQL files in supabase/migrations to the database, in order,
// exactly once each. Tracks applied files in a `schema_migrations` table so it
// is safe to run on every deploy / push.
//
// Usage: SUPABASE_DB_URL=postgres://... node scripts/migrate.js
const fs = require("fs");
const path = require("path");

// Connect with a sensible SSL fallback for self-hosted Postgres. Internal /
// self-hosted databases usually have NO SSL, so try non-SSL first (unless the
// URL explicitly requests SSL via sslmode), then fall back to SSL. A short
// connect timeout makes a bad/unreachable DB fail fast instead of hanging the
// container entrypoint.
async function connectWithFallback(Client, connectionString) {
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
  const wantsSsl = /sslmode=(require|verify-ca|verify-full)/i.test(connectionString);
  const sslAttempts = isLocal
    ? [false]
    : wantsSsl
      ? [{ rejectUnauthorized: false }, false]
      : [false, { rejectUnauthorized: false }];

  let lastErr;
  for (const ssl of sslAttempts) {
    const client = new Client({ connectionString, ssl, connectionTimeoutMillis: 8000 });
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastErr = err;
      try { await client.end(); } catch {}
      console.warn(`  connect attempt (ssl=${ssl ? "on" : "off"}) failed: ${err.message}`);
    }
  }
  throw lastErr;
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("ERROR: SUPABASE_DB_URL environment variable is required.");
    process.exit(1);
  }

  let Client;
  try {
    ({ Client } = require("pg"));
  } catch {
    console.error("ERROR: 'pg' is not installed. Run `npm install` first.");
    process.exit(1);
  }

  const dir = path.join(__dirname, "..", "supabase", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  const client = await connectWithFallback(Client, connectionString);
  console.log("Connected to database.");

  try {
    // Ledger of applied migrations. IF NOT EXISTS keeps this safe on a DB that
    // already had migrations applied manually — those files are idempotent
    // (CREATE/ALTER ... IF NOT EXISTS), so re-applying them once to register
    // them in the ledger is harmless.
    await client.query(
      `create table if not exists public.schema_migrations (
         filename   text primary key,
         applied_at timestamptz not null default now()
       );`
    );

    const { rows } = await client.query("select filename from public.schema_migrations;");
    const applied = new Set(rows.map((r) => r.filename));

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  • ${file} (already applied, skipped)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      console.log(`Applying ${file} ...`);
      // Each migration runs atomically: the file + its ledger insert commit
      // together, or roll back together.
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations(filename) values ($1) on conflict do nothing;",
          [file]
        );
        await client.query("commit");
        appliedCount++;
        console.log(`  ✓ ${file}`);
      } catch (err) {
        await client.query("rollback");
        throw new Error(`${file}: ${err.message}`);
      }
    }

    console.log(
      appliedCount === 0
        ? "Database already up to date — no migrations applied."
        : `Done — applied ${appliedCount} migration(s).`
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
