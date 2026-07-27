module.exports = {
  preset: '@react-native/jest-preset',
  // Untranspiled ESM packages that must go through babel in the jest host.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-safe-area-context|react-native-screens)/)',
  ],
};
