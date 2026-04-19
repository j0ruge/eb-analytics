const expoConfig = require('eslint-config-expo/flat/default.js');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'android/**',
      'ios/**',
      'server/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'scripts/**/*.js',
      'babel.config.js',
      'metro.config.js',
      'eslint.config.js',
      'app.config.js',
      'jest.config.js',
      'playwright.config.ts',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/no-unescaped-entities': 'off',
    },
  },
  // Dev/seed utility and DB boot/migrations — progress logging is
  // explicitly required by CLAUDE.md §6 ("Log migration progress with
  // console.log").
  {
    files: [
      'src/services/seedService.ts',
      'src/db/client.ts',
      'src/db/migrations.ts',
    ],
    rules: { 'no-console': 'off' },
  },
  // Jest tests: jest.mock() hoists above imports, tests frequently use
  // require() to re-import mocked modules, and mock typing often leaks `any`.
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'import/first': 'off',
    },
  },
];
