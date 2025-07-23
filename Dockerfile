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
COPY package.json package-lock.json* ./

# Install dependencies (Bun handles native modules much better)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# No build step needed - we'll run TypeScript directly with bun

# Clean up build dependencies
RUN apk del .gyp

FROM oven/bun:1-alpine as deploy

WORKDIR /app

ARG WEB_PORT=3001
ENV WEB_PORT $WEB_PORT
ENV NODE_ENV=production
EXPOSE $WEB_PORT

# Copy source files and dependencies
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle.config.ts ./

# Copy the entire node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Create user and directories for WhatsApp sessions
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs \
    && mkdir -p /app/wordle-tracker-bot_sessions && chown -R nodejs:nodejs /app/wordle-tracker-bot_sessions \
    && chown -R nodejs:nodejs /app

# Volume for WhatsApp session persistence
VOLUME ["/app/wordle-tracker-bot_sessions"]

USER nodejs

# Run TypeScript directly with bun and load env file
CMD ["bun", "--env-file=.env", "src/app.ts"]