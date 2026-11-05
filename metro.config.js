const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('xml')) {
  config.resolver.assetExts.push('xml');
}

// The web app (docs/web.md) has its own node_modules, React included; Metro
// must never resolve into it.
// Anchored to THIS repo's web/: packages ship web/ folders of their own.
const webDir = path
  .join(__dirname, 'web')
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [new RegExp(`^${webDir}/.*`)];

module.exports = config;
