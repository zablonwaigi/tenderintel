#!/usr/bin/env node
/* eslint-disable */
// Apply all SQL files in supabase/migrations to the database in order.
// Usage: SUPABASE_DB_URL=postgres://... node scripts/migrate.js
const fs = require("fs");
const path = require("path");

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

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Connected to database.");

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      console.log(`Applying ${file} ...`);
      await client.query(sql);
      console.log(`  ✓ ${file}`);
    }
    console.log("All migrations applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
