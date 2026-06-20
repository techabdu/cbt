# ── Stage 1: Install npm dependencies ─────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
# Use ci for reproducible installs; include devDependencies (needed for build)
RUN npm ci

# ── Stage 2: Build Next.js for production ─────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# API base URL is baked into the client bundle at build time.
# Must be reachable from the end-user's browser, not from inside Docker.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── Stage 3: Minimal production runner ────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Only ship what `next start` needs
COPY --from=builder /app/public        ./public
COPY --from=builder /app/.next         ./.next
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/package.json  ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
