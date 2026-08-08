#!/usr/bin/env bash
# Start local API (4000) + web (3000). Safe to re-run.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.nvm/versions/node/v22.23.1/bin:${HOME}/.nvm/versions/node/v20.20.2/bin:/usr/local/bin:/usr/bin:$PATH"
cd "$ROOT"

# Prefer nvm node if available (Node 22+ — argon2 prebuild segfaults on Node 20 here)
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use 20 >/dev/null 2>&1 || true
fi

mkdir -p /tmp
LOG_DIR="${TMPDIR:-/tmp}/poker-dev"
mkdir -p "$LOG_DIR"

# Ensure Next can reach the API (Next only loads apps/web/.env*)
WEB_ENV="$ROOT/apps/web/.env.local"
if [ -f "$WEB_ENV" ] && ! grep -q 'NEXT_PUBLIC_API_URL' "$WEB_ENV" 2>/dev/null; then
  {
    echo ''
    echo 'NEXT_PUBLIC_API_URL=http://localhost:4000'
    echo 'NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws'
  } >> "$WEB_ENV"
elif [ ! -f "$WEB_ENV" ]; then
  cat > "$WEB_ENV" <<'EOF'
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
EOF
fi

stop_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  fi
}

stop_port 3000
stop_port 4000

echo "Starting API on :4000 (log: $LOG_DIR/server.log)"
npm run dev:server >"$LOG_DIR/server.log" 2>&1 &
echo $! >"$LOG_DIR/server.pid"

echo "Starting web on :3000 (log: $LOG_DIR/web.log)"
npm run dev:web >"$LOG_DIR/web.log" 2>&1 &
echo $! >"$LOG_DIR/web.pid"

# Wait for ports
for i in $(seq 1 40); do
  if curl -sf -m 1 http://127.0.0.1:3000/ >/dev/null 2>&1 && curl -sf -m 1 http://127.0.0.1:4000/ >/dev/null 2>&1; then
    break
  fi
  # API may not have a / route — accept any listen
  if ss -tln 2>/dev/null | grep -q ':3000' && ss -tln 2>/dev/null | grep -q ':4000'; then
    break
  fi
  sleep 0.5
done

echo
echo "Web:  http://localhost:3000"
echo "API:  http://localhost:4000"
echo "Logs: $LOG_DIR/server.log  $LOG_DIR/web.log"
echo "Stop: kill \$(cat $LOG_DIR/server.pid) \$(cat $LOG_DIR/web.pid)"
tail -n 20 "$LOG_DIR/server.log" || true
tail -n 15 "$LOG_DIR/web.log" || true
