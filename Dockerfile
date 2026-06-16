# Build frontend
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Production runtime
FROM oven/bun:1-slim AS runner
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY server/ ./server/
COPY --from=builder /app/dist ./dist/

RUN mkdir -p data

EXPOSE 3001
CMD ["bun", "run", "server/index.ts"]
