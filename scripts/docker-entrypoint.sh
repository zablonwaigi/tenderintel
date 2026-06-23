#!/bin/sh
# Container entrypoint: best-effort DB migration, then start the server.
#
# A migration failure must NEVER take the site down. We log the failure loudly
# and start the server anyway (it serves the existing schema). This is why there
# is deliberately NO `set -e` around the migration — an unreachable DB or a bad
# migration degrades the workspace feature, it does not cause an outage.
if [ -n "$SUPABASE_DB_URL" ]; then
  echo "[entrypoint] Applying database migrations..."
  if node scripts/migrate.js; then
    echo "[entrypoint] Migrations OK."
  else
    echo "[entrypoint] WARNING: migrations failed — starting server anyway (existing schema). See error above."
  fi
else
  echo "[entrypoint] WARNING: SUPABASE_DB_URL not set — skipping migrations."
fi

echo "[entrypoint] Starting server..."
exec node server.js
