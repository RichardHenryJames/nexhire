module.exports = function (api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production';
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Strip all console.log/warn/error in production — 484 statements
      // crossing the JS↔Native bridge is the #1 native perf killer
      ...(isProduction ? ['transform-remove-console'] : []),
      // react-native-reanimated/plugin MUST be listed last
      'react-native-reanimated/plugin',
    ],
  };
};
