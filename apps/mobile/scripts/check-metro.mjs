import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const monorepoRoot = path.resolve(projectRoot, '../..');
const require = createRequire(import.meta.url);
const config = require(path.join(projectRoot, 'metro.config.js'));

const watchFolders = (config.watchFolders ?? []).map((folder) => path.resolve(folder));
const modulePaths = (config.resolver?.nodeModulesPaths ?? []).map((folder) => path.resolve(folder));

const expectedWatch = monorepoRoot;
const expectedModules = [
  path.join(projectRoot, 'node_modules'),
  path.join(monorepoRoot, 'node_modules'),
];

const missingWatch = watchFolders.includes(expectedWatch) ? [] : [expectedWatch];
const missingModules = expectedModules.filter((entry) => !modulePaths.includes(entry));

if (missingWatch.length > 0 || missingModules.length > 0 || !config.resolver?.unstable_enablePackageExports) {
  console.error(
    JSON.stringify(
      {
        missingWatch,
        missingModules,
        packageExports: config.resolver?.unstable_enablePackageExports ?? false,
        watchFolders,
        modulePaths,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log('metro monorepo paths ok');
