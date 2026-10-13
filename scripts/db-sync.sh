#!/usr/bin/env bash
# Copy the app's Postgres data (public schema) between Supabase and the local dev DB.
#
#   scripts/db-sync.sh pull [-y]   Supabase → local dev DB (pokr-dev stack, 127.0.0.1:5433)
#   scripts/db-sync.sh push        local dev DB → Supabase (production; asks for confirmation)
#   scripts/db-sync.sh backup      dump both DBs to data/db-backups/ without changing anything
#
# The target DB is always dumped to data/db-backups/ before it is overwritten.
# Restore a backup with: scripts/db-sync.sh restore <local|supabase> <file.dump>
#
# Supabase URL: $SUPABASE_DATABASE_URL, else SUPABASE_DATABASE_URL / DATABASE_URL from .env.
# The IPv6-only db.<ref>.supabase.co host is rewritten to the IPv4 session pooler using
# SUPABASE_REGION, like packages/db/src/connection.ts does.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
COMPOSE=(docker compose -p pokr-dev -f docker-compose.dev.yml)
LOCAL_URL="${LOCAL_DATABASE_URL:-postgresql://poker:poker@127.0.0.1:5433/poker}"
BACKUP_DIR="$ROOT/data/db-backups"
# Prod server is stopped during a push so it cannot write mid-restore. Empty → skip.
PROD_SERVER_CONTAINER="${PROD_SERVER_CONTAINER-poker-server-1}"
STAMP="$(date +%Y%m%d-%H%M%S)"

die() { echo "error: $*" >&2; exit 1; }
log() { echo "==> $*"; }

env_value() {
  [[ -f .env ]] || return 0
  grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -E "s/^[\"']//; s/[\"']$//"
}

supabase_url() {
  local raw="${SUPABASE_DATABASE_URL:-$(env_value SUPABASE_DATABASE_URL)}"
  raw="${raw:-$(env_value DATABASE_URL)}"
  [[ -n "$raw" ]] || die "no SUPABASE_DATABASE_URL or DATABASE_URL in .env"
  SRC="$raw" REGION="${SUPABASE_REGION:-$(env_value SUPABASE_REGION)}" node -e '
    const u = new URL(process.env.SRC);
    const m = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(u.hostname);
    if (m) {
      const region = (process.env.REGION || "").trim();
      if (!region) { console.error("SUPABASE_REGION is required for the IPv6-only Supabase host"); process.exit(1); }
      const user = decodeURIComponent(u.username || "postgres");
      u.username = encodeURIComponent(user.includes(".") ? user : `postgres.${m[1]}`);
      u.hostname = `aws-0-${region}.pooler.supabase.com`;
      u.port = "5432";
    }
    process.stdout.write(u.toString());'
}

# Run a postgres client tool with the connection URL passed via env (not argv).
pg() {
  local url="$1"; shift
  docker run --rm -i --network host -e PGURL="$url" "$PG_IMAGE" sh -c "$*"
}

dump() {
  local url="$1" out="$2"
  mkdir -p "$BACKUP_DIR"
  pg "$url" 'pg_dump "$PGURL" --format=custom --schema=public --no-owner --no-privileges' >"$out.tmp"
  mv "$out.tmp" "$out"
  log "dumped $(du -h "$out" | cut -f1) → ${out#"$ROOT"/}"
}

# Drop and recreate the dumped tables in the target. The public schema itself is kept
# (Supabase owns it); tables that exist only in the target are left alone.
restore() {
  local url="$1" file="$2"
  [[ -s "$file" ]] || die "dump file missing or empty: $file"
  pg "$url" 'cat >/tmp/db.dump \
    && pg_restore --list /tmp/db.dump | grep -Ev " SCHEMA - public | COMMENT - SCHEMA public " >/tmp/db.list \
    && pg_restore --dbname="$PGURL" --use-list=/tmp/db.list --clean --if-exists \
         --no-owner --no-privileges --single-transaction --exit-on-error /tmp/db.dump' <"$file"
}

table_counts() {
  pg "$1" 'psql "$PGURL" -Atc "select count(*) from information_schema.tables where table_schema = '"'"'public'"'"'"' \
    | sed 's/$/ tables/'
}

ensure_local_db() {
  "${COMPOSE[@]}" up -d postgres >/dev/null 2>&1 || die "could not start the dev Postgres container"
  for _ in $(seq 1 30); do
    pg "$LOCAL_URL" 'pg_isready -d "$PGURL" -q' && return 0
    sleep 1
  done
  die "local dev Postgres is not reachable at 127.0.0.1:5433"
}

confirm() {
  local prompt="$1" expected="$2" answer
  [[ -t 0 ]] || die "refusing without a terminal; re-run interactively${3:+ or pass -y}"
  read -r -p "$prompt " answer
  [[ "$answer" == "$expected" ]] || die "aborted"
}

cmd_pull() {
  local yes="${1:-}" remote
  remote="$(supabase_url)"
  [[ "$remote" != "$LOCAL_URL" ]] || die "Supabase URL resolves to the local DB"
  [[ "$yes" == "-y" ]] || confirm "Overwrite the LOCAL dev DB with Supabase data? [y/N]" y -y
  ensure_local_db

  dump "$LOCAL_URL" "$BACKUP_DIR/local-$STAMP.dump"
  dump "$remote" "$BACKUP_DIR/supabase-$STAMP.dump"

  log "stopping dev server"
  "${COMPOSE[@]}" stop server >/dev/null 2>&1 || true
  log "restoring into local dev DB"
  restore "$LOCAL_URL" "$BACKUP_DIR/supabase-$STAMP.dump"
  "${COMPOSE[@]}" exec -T redis redis-cli FLUSHALL >/dev/null 2>&1 || true
  log "starting dev stack"
  "${COMPOSE[@]}" up -d >/dev/null 2>&1 || die "dev stack failed to start; check: ${COMPOSE[*]} logs server"
  log "done: local now has $(table_counts "$LOCAL_URL")"
}

cmd_push() {
  local remote
  remote="$(supabase_url)"
  [[ "$remote" != "$LOCAL_URL" ]] || die "Supabase URL resolves to the local DB"
  echo "This REPLACES the production Supabase data with the local dev DB."
  [[ -n "$PROD_SERVER_CONTAINER" ]] && echo "The prod server ($PROD_SERVER_CONTAINER) is stopped while restoring; live tables drop."
  confirm "Type 'push to production' to continue:" "push to production"
  ensure_local_db

  dump "$remote" "$BACKUP_DIR/supabase-$STAMP.dump"
  dump "$LOCAL_URL" "$BACKUP_DIR/local-$STAMP.dump"

  local stopped=""
  if [[ -n "$PROD_SERVER_CONTAINER" ]] && docker ps -q -f "name=^${PROD_SERVER_CONTAINER}$" | grep -q .; then
    log "stopping $PROD_SERVER_CONTAINER"
    docker stop "$PROD_SERVER_CONTAINER" >/dev/null
    stopped=1
  fi
  log "restoring into Supabase"
  if ! restore "$remote" "$BACKUP_DIR/local-$STAMP.dump"; then
    [[ -n "$stopped" ]] && docker start "$PROD_SERVER_CONTAINER" >/dev/null
    die "restore failed; Supabase was rolled back (single transaction). Backup: $BACKUP_DIR/supabase-$STAMP.dump"
  fi
  if [[ -n "$stopped" ]]; then
    log "starting $PROD_SERVER_CONTAINER"
    docker start "$PROD_SERVER_CONTAINER" >/dev/null
  fi
  log "done: Supabase now has $(table_counts "$remote")"
}

cmd_backup() {
  ensure_local_db
  dump "$LOCAL_URL" "$BACKUP_DIR/local-$STAMP.dump"
  dump "$(supabase_url)" "$BACKUP_DIR/supabase-$STAMP.dump"
}

cmd_restore() {
  local target="${1:-}" file="${2:-}"
  case "$target" in
    local)
      ensure_local_db
      confirm "Overwrite the LOCAL dev DB from $file? [y/N]" y
      "${COMPOSE[@]}" stop server >/dev/null 2>&1 || true
      restore "$LOCAL_URL" "$file"
      "${COMPOSE[@]}" up -d >/dev/null 2>&1 || die "dev stack failed to start"
      ;;
    supabase)
      confirm "Type 'push to production' to overwrite Supabase from $file:" "push to production"
      dump "$(supabase_url)" "$BACKUP_DIR/supabase-$STAMP.dump"
      restore "$(supabase_url)" "$file"
      ;;
    *) die "usage: $0 restore <local|supabase> <file.dump>" ;;
  esac
  log "restored ${file#"$ROOT"/} into $target"
}

case "${1:-}" in
  pull) cmd_pull "${2:-}" ;;
  push) cmd_push ;;
  backup) cmd_backup ;;
  restore) cmd_restore "${2:-}" "${3:-}" ;;
  *)
    sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
