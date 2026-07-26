# Monorepo-aware production image for the game server
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json ./packages/engine/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/db/package.json ./packages/db/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN npm run build -w @poker/engine -w @poker/protocol -w @poker/db -w @poker/server \
  && npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/engine ./packages/engine
COPY --from=build /app/packages/protocol ./packages/protocol
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/apps/server ./apps/server
EXPOSE 4000
WORKDIR /app/apps/server
CMD ["node", "dist/index.js"]
