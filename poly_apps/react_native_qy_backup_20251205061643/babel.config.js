const path = require('path');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      require.resolve('babel-plugin-module-resolver'),
      {
        root: [path.resolve(__dirname)],
        extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.json', '.tsx', '.ts'],
        alias: {
          '@/common': path.resolve(__dirname, 'src/common'),
          '@/apps': path.resolve(__dirname, 'src/apps'),
          '@/qy': path.resolve(__dirname, 'src/apps/qy'),
        },
      },
    ],
  ],
};

