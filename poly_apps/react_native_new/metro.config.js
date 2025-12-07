const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  watchFolders: [
    path.resolve(__dirname, 'D:/programing/core_node/poly_apps/react_native/src/apps/awy'),
  ],
  resolver: {
    ...defaultConfig.resolver,
    blockList: [
      /.*\/node_modules\/.*\/android\/build\/.*/,
    ],
    alias: {
      '@/common': path.resolve(__dirname, 'src/common'),
      '@/apps': path.resolve(__dirname, 'src/apps'),
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
