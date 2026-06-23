FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies. Uses the lockfile when present (npm ci), otherwise
# falls back to npm install so the image builds with package.json alone.
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

# Build the app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget curl
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy the standalone server output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# DB migration tooling. Migrations run automatically at container START via the
# entrypoint (scripts/docker-entrypoint.sh), BEFORE the server boots, using the
# runtime SUPABASE_DB_URL. The standalone output ships a special, traced
# node_modules layout, so installing `pg` into it is unreliable. Instead install
# the driver in an ISOLATED dir (/migrate) and expose it to migrate.js via
# NODE_PATH (set in the entrypoint). The final node -e check FAILS THE BUILD if
# pg can't be resolved, so a missing driver can never reach production silently.
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/supabase ./supabase
RUN mkdir -p /migrate && cd /migrate \
 && npm init -y >/dev/null 2>&1 \
 && npm install pg@8.13.0 --no-audit --no-fund \
 && node -e "require('pg'); console.log('pg resolved OK')"

EXPOSE 3000

# Apply pending migrations, then start the standalone server.
CMD ["sh", "/app/scripts/docker-entrypoint.sh"]
