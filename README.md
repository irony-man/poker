# Felt — Texas Hold'em

Private No-Limit Texas Hold'em for casual home games.

## Stack

- **Engine** (`packages/engine`) — pure TypeScript NLHE state machine, CSPRNG shuffle, 7-card evaluator, side pots
- **Protocol** (`packages/protocol`) — Zod WebSocket/REST schemas
- **Server** (`apps/server`) — Express + native `ws`, Redis-optional KV, file/Postgres hand history
- **Web** (`apps/web`) — Next.js 15, React 19, Tailwind, Framer Motion
- **Android** (`apps/android`) — Jetpack Compose client (lobby, online WS table, offline engine)

## Prerequisites

- Node.js 20+ (repo includes `.nvmrc` → 22)

```bash
nvm use
npm install
```

## Develop

```bash
# Terminal 1 — game server (REST + WS on :4000)
npm run dev:server

# Terminal 2 — web UI (:3000)
npm run dev:web
```

Open http://localhost:3000 — sign up or sign in with a username and password, create a table, share the invite code.

### Contests (tournaments)

Lobby **Contests** tab (web) or Contests panel (Android):

1. **Table match** — 2–9 players, fixed stacks, no rebuy; eliminated when chips hit zero; last player wins. Blinds rise on a fixed hand schedule.
2. **Knockout** — 4 / 8 / 16 players, heads-up single elimination. Winners advance through the bracket until a champion.

Create with optional bot fill, share the contest code, or open from the lobby. Contest page shows registration, bracket/standings, and routes you to your assigned table when play starts.

## Tests

```bash
npm test
```

## Deploy (Docker)

No cloud credentials are required for local/LAN deploy:

```bash
docker compose up -d --build
```

- Web UI: http://localhost:3000  
- API / WS: http://localhost:4000 (`/health`, `/ws`)

Stop with `docker compose down`. Hand history persists in the `poker-data` volume.

For a public URL (Vercel/Railway/Fly), you’ll need accounts + `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` pointed at the reachable game server (WSS). Rebuild web after changing those build args.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | Game server port |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS origin |
| `DATABASE_URL` | unset → file stores | **Postgres** for users, sessions, social, hand history |
| `REDIS_URL` | unset | Optional Redis for table snapshots/pubsub |
| `DATA_DIR` | `./data` | File fallback when Postgres is unset; also schema.sql dump |
| `NEXT_PUBLIC_SITE_URL` | `https://pokr.site` | Canonical site URL (metadata, sitemap, OG) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Browser → API |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:4000/ws` | Browser → WebSocket |

### Local Postgres

```bash
# Start Postgres 16 (docker)
npm run db:up

# Copy env if needed (DATABASE_URL already points at local docker)
cp .env.example .env

# Server + web
npm run dev:server
npm run dev:web
```

Default URL: `postgres://poker:poker@127.0.0.1:5432/poker`

With `DATABASE_URL` set the server uses Postgres for accounts, sessions/tickets, friends/groups, and hand history. Without it, those fall back to JSON files under `DATA_DIR`.

## Android

Open `apps/android` in Android Studio (JDK 17, SDK 35). Defaults point at production Render:

```bash
cd apps/android
./gradlew :app:assembleDebug
```

See [apps/android/README.md](apps/android/README.md).

## Architecture notes

- Authoritative server: clients send action intents; hole cards are private per seat.
- Identity: unique username + password (argon2 hash), opaque session Bearer tokens for HTTP, short-lived WS tickets.
- Persistence: Postgres when `DATABASE_URL` is set (users, auth sessions/tickets, social, hand history); otherwise files under `DATA_DIR`.
- Action messages require `handId` + monotonic `actionSeq`.
- Turn timeouts auto-check or auto-fold.
- Contests are orchestrated in-memory by `TournamentManager` on top of cash `Room`s (no rebuy; auto-deal between hands).
- See `apps/server/data/schema.sql` (written on boot) for Postgres DDL.
