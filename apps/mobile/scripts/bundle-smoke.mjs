import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = mkdtempSync(path.join(tmpdir(), 'pokr-mobile-bundle-'));

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

let failed = false;
for (const platform of ['ios', 'android']) {
  const output = path.join(outRoot, platform);
  console.log(`exporting ${platform} bundle`);
  // --no-bytecode: the published hermesc binary is linux x64, so an arm64
  // checkout cannot compile Hermes bytecode. The JS bundle is the smoke check.
  const result = spawnSync(
    'npx',
    ['expo', 'export', '--platform', platform, '--output-dir', output, '--no-bytecode'],
    { cwd: projectRoot, stdio: 'inherit', env: process.env },
  );
  if (result.status !== 0) {
    failed = true;
    continue;
  }
  const bundles = walk(output).filter((file) => file.endsWith('.js') || file.endsWith('.hbc'));
  const linked = bundles.some((file) => readFileSync(file, 'utf8').includes('Mobile scaffold'));
  if (!linked) {
    console.error(`${platform} bundle did not include the scaffold screen`);
    failed = true;
  }
}

rmSync(outRoot, { recursive: true, force: true });
if (failed) process.exit(1);
console.log('ios and android bundles exported');
