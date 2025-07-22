# Image size ~ 400MB
FROM node:21-alpine3.18 as builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

COPY . .

RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
    && apk add --no-cache git \
    && pnpm install && cd node_modules/.pnpm/better-sqlite3@12.2.0/node_modules/better-sqlite3 && npm run build-release && cd /app && pnpm run build \
    && apk del .gyp

FROM node:21-alpine3.18 as deploy

WORKDIR /app

ARG PORT
ENV PORT $PORT
EXPOSE $PORT

COPY --from=builder /app/assets ./assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/*.json /app/*-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate 
ENV PNPM_HOME=/usr/local/bin

RUN pnpm install --production \
    && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs \
    && mkdir -p /app/data && chown -R nodejs:nodejs /app/data

COPY --from=builder /app/node_modules/.pnpm/better-sqlite3@12.2.0/node_modules/better-sqlite3/build ./node_modules/.pnpm/better-sqlite3@12.2.0/node_modules/better-sqlite3/build

VOLUME ["/app/data", "/app/bot_sessions"]

USER nodejs

CMD ["npm", "start"]