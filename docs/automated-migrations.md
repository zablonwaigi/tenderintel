# Automated database migrations (Coolify pre-deploy)

Migrations now apply **automatically on every deploy** — no more pasting SQL into
the Supabase SQL editor. A GitHub push triggers a Coolify redeploy, and Coolify
runs the migration **before** the new app version goes live.

## How it works

- `scripts/migrate.js` applies every file in `supabase/migrations/` **in filename
  order, exactly once each**. It records applied files in a `schema_migrations`
  ledger table, so re-runs are no-ops. Each migration runs in its own
  transaction (the SQL + its ledger insert commit or roll back together).
- The runtime Docker image carries the migration tooling: `scripts/`,
  `supabase/migrations/`, and the `pg` driver are copied/installed into the
  runner stage (see `Dockerfile`). This is what lets Coolify run the migration
  inside the freshly-built image.
- Credentials never touch GitHub. `SUPABASE_DB_URL` lives only in Coolify.

## One-time Coolify setup

1. **Environment variable** — in the resource's *Environment Variables*, set:

   ```
   SUPABASE_DB_URL=postgres://<user>:<pass>@<host>:5432/postgres
   ```

   Use the Postgres connection string for your self-hosted Supabase. If the app
   and DB share a Docker network, the internal host (e.g. `supabase-db:5432`) is
   preferable to the public hostname.

2. **Pre-deployment command** — in the resource's *Configuration → Pre-deployment
   Command*, set:

   ```
   node scripts/migrate.js
   ```

   Coolify runs this in a container of the new image (with the env vars above)
   *before* swapping traffic to it. If the migration fails, the deploy aborts and
   the old version keeps running — so a bad migration can't half-deploy.

That's it. From now on: **push → Coolify builds → migrations apply → new version
goes live.**

## Verifying

After a deploy, check the Coolify deployment logs for:

```
Applying 20260623000000_smme_workspace.sql ...
  ✓ 20260623000000_smme_workspace.sql
Done — applied 1 migration(s).
```

Subsequent deploys with no new migrations log:

```
Database already up to date — no migrations applied.
```

You can also confirm against the DB:

```sql
select filename, applied_at from public.schema_migrations order by filename;
```

## First run on the existing database

The first automated run will see `schema_migrations` as empty and attempt to
apply **all** historical migration files to register them. This is safe: every
migration in this repo is idempotent (`create table if not exists`,
`alter table ... add column if not exists`, `drop policy if exists` before
create). They run once to populate the ledger, then never again.

> If you'd rather not re-touch already-applied historical migrations, pre-seed
> the ledger once so only genuinely new files run:
> ```sql
> create table if not exists public.schema_migrations (
>   filename text primary key, applied_at timestamptz not null default now());
> insert into public.schema_migrations (filename)
> select unnest(array[
>   '20260616000000_tenderintel_init.sql',
>   '20260616000001_sync_enhancements.sql',
>   '20260616000002_ocds_sync_rewrite.sql',
>   '20260617000000_add_missing_ai_columns.sql',
>   '20260619000000_phase0_wiki_summary_fix.sql',
>   '20260619000001_phase0_rls_all_tables.sql'
> ]) on conflict do nothing;
> ```
> (Leave out `20260623000000_smme_workspace.sql` so the workspace migration runs
> on the next deploy.)

## Manual fallback

The same script still works by hand from any machine with network access to the
DB and `pg` installed:

```bash
SUPABASE_DB_URL="postgres://...:5432/postgres" npm run db:migrate
```

## Alternative: migrate on container start

If you ever move off Coolify's pre-deploy hook, you can instead run migrations at
container start by wrapping the `CMD` in an entrypoint that runs
`node scripts/migrate.js` then `exec node server.js`. Pre-deploy is preferred
because a failed migration aborts the deploy instead of crash-looping the app.
