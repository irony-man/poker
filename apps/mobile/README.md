# @poker/mobile

Expo SDK 58 app for iOS and Android (`com.pokr.mobile`). v1 is No-Limit Hold'em plus the shared shell. This package is the scaffold: Expo Router, strict TypeScript, and a direct import of the built `@poker/protocol` and `@poker/engine` packages.

## Metro

`metro.config.js` starts from `expo/metro-config`. SDK 58 already detects an npm workspace. The config still records two paths so they stay tested:

- `watchFolders` includes the repo root, so edits under `packages/` invalidate the bundle.
- `resolver.nodeModulesPaths` lists `apps/mobile/node_modules` and the root `node_modules`.

`resolver.unstable_enablePackageExports` is on. Protocol and engine are consumed from their `dist/` builds (`exports.import` only). `npm run typecheck` and `npm run test` in this package build those two packages first. Do not import `@poker/db` or `apps/server`.

Jest loads `@react-native/jest-preset` from the repo root, while `react-native` stays installed under `apps/mobile/node_modules` so it does not share the web app's module tree. `scripts/jest.mjs` adds that directory to `NODE_PATH` before starting Jest.

## Commands

From the repo root, after `npm ci`:

```bash
npm run dev:mobile
npm run typecheck -w @poker/mobile
npm run test -w @poker/mobile
npm run lint -w @poker/mobile
npm run bundle:smoke -w @poker/mobile
```

`dev:mobile` starts the Expo dev server. A development build (`expo-dev-client`) is required on device because later voice work uses native WebRTC. `bundle:smoke` exports an iOS JavaScript bundle and an Android JavaScript bundle with `--no-bytecode`. The Hermes compiler shipped with the SDK is an x64 Linux binary, so bytecode compilation belongs on the EAS builders, not in this check.

Copy `.env.example` to `.env` for a local server. Unset values use `https://felt-server-hgi4.onrender.com` and `wss://felt-server-hgi4.onrender.com/ws`.

## Not in this package yet

Theme generation, the UI kit, auth, and the Hold'em table follow in later changes. The redesign files (`palette/tokens-modes.json` and the mobile frames) are not in this checkout. Drop them in `apps/mobile/design-ref/` when they are available; that directory is git-ignored.
