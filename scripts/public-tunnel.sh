#!/usr/bin/env bash
# Free public URLs via Cloudflare quick tunnels (laptop must stay online).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CF="$ROOT/bin/cloudflared"
cd "$ROOT"

if [[ ! -x "$CF" ]]; then
  echo "Downloading cloudflared…"
  mkdir -p "$ROOT/bin"
  curl -fsSL -o "$CF" https://github.com/cloudflare/cloudflared/releases/download/2026.7.3/cloudflared-linux-amd64
  chmod +x "$CF"
fi

docker compose up -d

pkill -f "cloudflared tunnel --url http://127.0.0.1:4000" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://127.0.0.1:3000" 2>/dev/null || true
sleep 1

rm -f /tmp/cf-server.log /tmp/cf-web.log
"$CF" tunnel --url http://127.0.0.1:4000 --no-autoupdate > /tmp/cf-server.log 2>&1 &
"$CF" tunnel --url http://127.0.0.1:3000 --no-autoupdate > /tmp/cf-web.log 2>&1 &
sleep 6

API_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-server.log | head -1)
WEB_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-web.log | head -1)
WS_URL="${API_URL/https/wss}/ws"

echo "API: $API_URL"
echo "WEB: $WEB_URL"

cat > docker-compose.override.yml <<EOF
services:
  server:
    environment:
      WEB_ORIGIN: "${WEB_URL}"
  web:
    build:
      args:
        NEXT_PUBLIC_API_URL: "${API_URL}"
        NEXT_PUBLIC_WS_URL: "${WS_URL}"
EOF

docker compose up -d --build web server
echo ""
echo "Public app: $WEB_URL"
echo "(Keep this machine awake; tunnels die when you stop cloudflared / sleep.)"
