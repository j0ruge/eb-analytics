const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Remove .wasm from sourceExts if present
config.resolver.sourceExts = config.resolver.sourceExts.filter(
  ext => ext !== 'wasm'
);

// Add .wasm to assetExts for proper handling
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

module.exports = config;
