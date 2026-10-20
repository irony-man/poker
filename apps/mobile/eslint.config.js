const expo = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  ...expo,
  {
    ignores: ['node_modules/**', '.expo/**', 'ios/**', 'android/**', 'design-ref/**'],
  },
]);
