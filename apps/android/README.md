# Pokr Android

Multi-module Jetpack Compose client for Pokr poker.

## Open in Android Studio

1. Install Android Studio (Ladybug+ / AGP 8.7).
2. **File → Open** and select this `apps/android` folder (not the monorepo root).
3. Wait for Gradle sync.
4. Create an AVD (API 26+).
5. Optional: add URLs in `local.properties` (see below).
6. Run the **app** configuration (module `pokr-android.app`, minSdk 26).

## Backend URLs

| BuildConfig | Default (production) |
| --- | --- |
| `POKR_API_URL` | `https://felt-server-hgi4.onrender.com` |
| `POKR_WS_URL` | `wss://felt-server-hgi4.onrender.com/ws` |

Override in `local.properties`:

```properties
pokr.api.url=http://10.0.2.2:4000
pokr.ws.url=ws://10.0.2.2:4000/ws

# Physical device on same LAN:
# pokr.api.url=http://192.168.x.x:4000
# pokr.ws.url=ws://192.168.x.x:4000/ws
```

`10.0.2.2` is the emulator alias for the host machine’s localhost.

## Modules

| Module | Role |
| --- | --- |
| `:app` | Application, navigation |
| `:core:common` | Shared utilities |
| `:core:model` | DTOs / domain models |
| `:core:network` | Retrofit + WebSocket |
| `:core:datastore` | Session persistence |
| `:core:designsystem` | PokrTheme, chips, table UI |
| `:core:engine` | Offline NLHE engine bridge |
| `:feature:lobby` | Auth, host/join, contests, friends, profile |
| `:feature:table` | Online table |
| `:feature:offline` | Offline play |
| `:feature:progress` | Hands map |
