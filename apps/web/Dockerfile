# Next.js web — NEXT_PUBLIC_* baked in at build time (browser → host ports)
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
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
COPY --from=deps /app ./
COPY packages/engine ./packages/engine
COPY packages/protocol ./packages/protocol
COPY apps/web ./apps/web
# Minimal stubs so workspace graph resolves
RUN mkdir -p packages/db/src apps/server/src \
  && echo 'export {};' > packages/db/src/index.ts \
  && echo 'export {};' > apps/server/src/index.ts \
  && printf '{"compilerOptions":{"outDir":"dist","rootDir":"src","module":"NodeNext","moduleResolution":"NodeNext","target":"ES2022","skipLibCheck":true},"include":["src"]}' > packages/db/tsconfig.json \
  && cp packages/db/tsconfig.json apps/server/tsconfig.json
RUN npm run build -w @poker/engine -w @poker/protocol && npm run build -w @poker/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/engine ./packages/engine
COPY --from=build /app/packages/protocol ./packages/protocol
COPY --from=build /app/apps/web ./apps/web
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
