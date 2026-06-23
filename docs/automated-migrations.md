# Automated database migrations (migrate-on-start)

Migrations apply **automatically on every deploy** — no more pasting SQL into the
Supabase SQL editor. The container applies pending migrations at startup, **before**
the Next.js server accepts traffic.

## Why migrate-on-start (not Coolify's pre-deployment command)

Coolify's **pre-deployment command runs in the *existing* (old) container**, before
the new version takes over ([docs](https://coolify.io/docs/applications)). That is
the wrong place for us:

- On the **first** deploy the old container predates this tooling — it has no
  `scripts/migrate.js`, no `supabase/`, no `pg` — so the command fails and the
  deploy aborts, and it never recovers (the new image never becomes "existing").
- Even later, the old container only holds the **previous** version's migration
  files, so it could never apply a migration that ships in the *same* deploy.

So instead the migration runs from the **new image at container start** via
`scripts/docker-entrypoint.sh`, which has the new migrations and tooling. A failed
migration exits non-zero, the container never becomes healthy, and Coolify keeps the
previous version serving — the same safety you'd want from a pre-deploy gate.

## How it works

- `scripts/migrate.js` applies every file in `supabase/migrations/` **in filename
  order, exactly once each**, recording applied files in a `schema_migrations`
  ledger table. Re-runs (including every container restart) are no-ops. Each
  migration runs in its own transaction.
- `scripts/docker-entrypoint.sh` runs `node scripts/migrate.js` then
  `exec node server.js`. It is the image's `CMD`.
- The runtime image carries the tooling: `scripts/`, `supabase/migrations/`, and the
  `pg` driver are copied/installed into the runner stage (see `Dockerfile`).
- Credentials never touch GitHub. `SUPABASE_DB_URL` lives only in Coolify.

## Coolify setup

1. **Environment variable** — set `SUPABASE_DB_URL` on the resource, **Available at
   Runtime** (Buildtime not required; mark **Is Literal** so special characters in the
   password aren't interpolated):

   ```
   SUPABASE_DB_URL=postgres://<user>:<pass>@<host>:5432/postgres
   ```

   Prefer the internal Docker-network host if the app and DB share a network.

2. **Pre-deployment command** — leave this **empty**. (If you set it to
   `node scripts/migrate.js` earlier, remove it — it would run in the old container
   and fail the deploy.)

That's it. From now on: **push → Coolify builds → container starts → migrations
apply → server boots.**

## Verifying

Check the new container's startup logs after a deploy:

```
[entrypoint] Applying database migrations...
Applying 20260623000000_smme_workspace.sql ...
  ✓ 20260623000000_smme_workspace.sql
Done — applied 1 migration(s).
[entrypoint] Starting server...
```

Restarts / deploys with no new migrations log:

```
Database already up to date — no migrations applied.
```

Confirm against the DB:

```sql
select filename, applied_at from public.schema_migrations order by filename;
```

## First run on the existing database

The first run sees an empty `schema_migrations` ledger and applies **all** historical
files to register them. This is safe: every migration in this repo is idempotent
(`create ... if not exists`, `add column if not exists`, `drop policy if exists`
before create). The only non-DDL statement — the duplicate-`ocid` cleanup `DELETE` in
`20260616000002_ocds_sync_rewrite.sql` — is a guaranteed 0-row no-op once
`tenders_ocid_unique_idx` exists.

> Optional: to keep the first deploy's logs showing only the new migration, pre-seed
> the ledger once in the Supabase SQL editor:
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
> (Leave out `20260623000000_smme_workspace.sql` so the workspace migration runs on
> the next deploy.)

## Manual fallback

The same script still works by hand from any machine with network access to the DB:

```bash
SUPABASE_DB_URL="postgres://...:5432/postgres" npm run db:migrate
```

## Caveat: multiple replicas

Migrate-on-start runs in every container. With a single instance (the current setup)
that's fine. If you ever scale to multiple replicas, they could race on the first
boot of a new migration; move to a dedicated one-shot migration step at that point.
