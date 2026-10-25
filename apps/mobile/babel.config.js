/**
 * NativeWind: o Babel troca o JSX para entender `className` nos componentes do React Native.
 * O preset do NativeWind também liga o plugin do Reanimated (animações e transições).
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
