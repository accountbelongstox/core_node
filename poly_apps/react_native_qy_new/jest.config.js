module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-native-community|@react-native-async-storage|nativewind|react-native-reanimated|react-native-linear-gradient|react-native-worklets)/|\\.pnpm/)',
  ],
};
