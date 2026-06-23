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
# runtime SUPABASE_DB_URL. This runs inside the new image (which has the new
# migrations), unlike a Coolify pre-deployment command which runs in the OLD
# container. The standalone output does not bundle `pg` (a devDependency not
# imported by the app), so install it here; it is pure JS and adds ~1 MB.
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/supabase ./supabase
RUN npm install pg@8.13.0 --no-save --no-audit --no-fund

EXPOSE 3000

# Apply pending migrations, then start the standalone server.
CMD ["sh", "/app/scripts/docker-entrypoint.sh"]
