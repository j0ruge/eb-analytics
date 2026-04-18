import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/helpers/setup.ts'],
    pool: 'forks',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
  },
});
