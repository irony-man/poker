# Standalone load-test service (dashboard + runners). Talks to targets over public HTTP/WS only.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/protocol/package.json ./packages/protocol/
COPY apps/loadtest/package.json ./apps/loadtest/
RUN npm ci -w @poker/protocol -w @poker/loadtest --include-workspace-root=false

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app ./
COPY packages/protocol ./packages/protocol
COPY apps/loadtest ./apps/loadtest
RUN npm run build -w @poker/protocol -w @poker/loadtest \
  && npm prune --omit=dev -w @poker/loadtest --include-workspace-root=false

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV LOADTEST_PORT=4100
ENV REPORTS_DIR=/app/data
RUN mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/loadtest/package.json ./apps/loadtest/package.json
COPY --from=build /app/apps/loadtest/dist ./apps/loadtest/dist
COPY --from=build /app/apps/loadtest/public ./apps/loadtest/public
USER node
EXPOSE 4100
WORKDIR /app/apps/loadtest
CMD ["node", "dist/main.js"]
