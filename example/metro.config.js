const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// The package under development is symlinked from ../ (node_modules/
// react-native-background-geolocation -> ../..): watch the parent so its src/
// edits hot-reload, and pin react/react-native to the example's node_modules so
// parent files resolve them (the parent has no node_modules of its own).
const root = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  watchFolders: [root],
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    assetExts: defaultConfig.resolver.assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
    extraNodeModules: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
