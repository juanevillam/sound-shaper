// Expo monorepo setup — see https://docs.expo.dev/guides/monorepos/
const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = false;

if (!config.resolver.assetExts.includes('xml')) {
  config.resolver.assetExts.push('xml');
}

module.exports = config;
