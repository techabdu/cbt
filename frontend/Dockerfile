# Local Next.js container (used by Docker Compose).
FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Build the app. NEXT_PUBLIC_* values are inlined at build time, so the API URL
# the browser will call must be provided here. The CBT frontend expects the
# /api suffix on this value (see src/lib/api.ts). Defaults to the Compose-mapped
# backend on the host.
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
