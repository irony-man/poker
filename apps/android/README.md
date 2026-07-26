# Felt Android

Multi-module Jetpack Compose client for Felt poker.

## Features (MVP)

- **Lobby** — host private table, join by invite, launch offline arena
- **Online table** — WebSocket auth/join, seats, actions, chat, emoji, bots
- **Offline table** — Kotlin-ported NLHE engine + bots (no server)

## Open in Android Studio

1. Install Android Studio with SDK 35 and **JDK 17**.
2. **File → Open** → `apps/android` (not the monorepo root).
3. Sync Gradle; accept licenses if prompted.
4. Ensure `local.properties` contains `sdk.dir=…` (Studio usually creates this).
5. Run the **app** configuration (minSdk 26).

## API / WebSocket

| BuildConfig | Default |
|-------------|---------|
| `FELT_API_URL` | `https://felt-server-hgi4.onrender.com` |
| `FELT_WS_URL` | `wss://felt-server-hgi4.onrender.com/ws` |

Override in `app/build.gradle.kts` for local server (`http://10.0.2.2:4000` on emulator).

## Auth (Clerk)

Online host/join requires a Clerk account (same app as the web client). Offline play does not.

1. In the [Clerk Dashboard](https://dashboard.clerk.com), open **Native applications** and enable the **Native API**.
2. The publishable key is baked into `BuildConfig.CLERK_PUBLISHABLE_KEY` (override with `clerk.publishable.key=…` in `local.properties`).
3. The game server must have `CLERK_SECRET_KEY` set so `/api/register` accepts Bearer session JWTs.

## Modules

| Module | Role |
|--------|------|
| `:app` | Hilt app, NavHost |
| `:core:common` | Result / dispatchers |
| `:core:model` | REST + WS DTOs |
| `:core:network` | Retrofit + OkHttp WebSocket |
| `:core:datastore` | Session preferences |
| `:core:designsystem` | FeltTheme, chips, table UI |
| `:core:engine` | Ported NLHE engine |
| `:feature:lobby` | Host / join / offline entry |
| `:feature:table` | Online MVI table |
| `:feature:offline` | Local engine table |

## CLI build

```bash
cd apps/android
export JAVA_HOME=/path/to/jdk-17
./gradlew :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`
