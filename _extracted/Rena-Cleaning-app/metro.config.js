const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Resolve @rena/shared to the local shared directory
config.resolver.extraNodeModules = {
  '@rena/shared': path.resolve(__dirname, 'shared/src'),
};

// Watch the shared directory for changes
config.watchFolders = [path.resolve(__dirname, 'shared')];

module.exports = config;
