# Multi-stage build with Bun for better native module handling
FROM oven/bun:1-alpine as builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
    && apk add --no-cache git

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies (Bun handles native modules much better)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Clean up build dependencies
RUN apk del .gyp

FROM oven/bun:1-alpine as deploy

WORKDIR /app

ARG PORT
ENV PORT $PORT
EXPOSE $PORT

# Copy built application
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/package.json ./

# Copy the entire node_modules from builder (no native binaries needed with Bun SQLite)
COPY --from=builder /app/node_modules ./node_modules

# Create user and directories
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs \
    && mkdir -p /app/data && chown -R nodejs:nodejs /app/data \
    && mkdir -p /app/bot_sessions && chown -R nodejs:nodejs /app/bot_sessions \
    && chown -R nodejs:nodejs /app

VOLUME ["/app/data", "/app/bot_sessions"]

USER nodejs

# Use Bun to run the application (with built-in SQLite support)
CMD ["bun", "run", "start"]