import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// @react-native/jest-preset hoists to the repo root, while react-native stays
// nested under this app (it cannot share the web workspace's module tree).
// Node only walks up from the preset, so the preset cannot see react-native
// unless this process includes the app's node_modules on NODE_PATH.
const nodePath = [path.join(projectRoot, 'node_modules'), process.env.NODE_PATH]
  .filter(Boolean)
  .join(path.delimiter);

const result = spawnSync('npx', ['jest', ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env, NODE_PATH: nodePath },
});

process.exit(result.status ?? 1);
