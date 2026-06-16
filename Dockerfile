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
RUN apk add --no-cache wget
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy the standalone server output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000


CMD ["node", "server.js"]
