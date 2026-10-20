const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// SDK 58 auto-detects npm workspaces. Keep the paths explicit so a Metro
// upgrade cannot silently stop watching packages/ or resolving the root
// node_modules, and so scripts/check-metro.mjs can lock the contract.
if (!config.watchFolders.some((folder) => path.resolve(folder) === monorepoRoot)) {
  config.watchFolders.push(monorepoRoot);
}

const modulePaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
for (const modulePath of modulePaths) {
  if (!config.resolver.nodeModulesPaths.some((entry) => path.resolve(entry) === modulePath)) {
    config.resolver.nodeModulesPaths.push(modulePath);
  }
}

// @poker/protocol and @poker/engine publish ESM-only "import" exports.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
