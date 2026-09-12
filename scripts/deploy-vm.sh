#!/usr/bin/env bash
# Production deploy on the Oracle VM (Docker Compose + optional health checks).
# Invoked by GitHub Actions over SSH, or manually: ./scripts/deploy-vm.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "error: .env missing in $ROOT" >&2
  exit 1
fi

# Ensure public URLs are set for Next bake (compose reads .env for build args).
if ! grep -q '^NEXT_PUBLIC_WS_URL=wss://' .env; then
  echo "warning: NEXT_PUBLIC_WS_URL should be wss://pokr.site/ws (rebuild will bake wrong client WS URL)" >&2
fi

echo "==> docker compose up -d --build"
docker compose up -d --build

echo "==> waiting for server health"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4000/health >/dev/null 2>&1; then
    echo "server healthy"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "error: server health check failed" >&2
    docker compose ps
    docker compose logs --tail=80 server
    exit 1
  fi
  sleep 2
done

echo "==> checking web"
code="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)"
echo "web HTTP $code"
if [[ "$code" != "200" && "$code" != "304" ]]; then
  docker compose logs --tail=80 web
  exit 1
fi

docker compose ps
echo "==> deploy ok"
