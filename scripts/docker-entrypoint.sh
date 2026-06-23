#!/bin/sh
# Container entrypoint: apply pending DB migrations, then start the server.
#
# Runs inside the NEW image at startup, before the Next.js server accepts
# traffic. This is the correct place to migrate (Coolify's pre-deployment
# command runs in the OLD container, which lacks this image's new migrations
# and tooling). A failed migration exits non-zero so the container never
# becomes healthy and Coolify keeps the previous version serving.
set -e

if [ -n "$SUPABASE_DB_URL" ]; then
  echo "[entrypoint] Applying database migrations..."
  node scripts/migrate.js
else
  echo "[entrypoint] WARNING: SUPABASE_DB_URL not set — skipping migrations."
fi

echo "[entrypoint] Starting server..."
exec node server.js
