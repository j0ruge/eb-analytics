import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/helpers/setup.ts'],
    pool: 'forks',
    // All integration tests hit a single shared Postgres; running them in
    // parallel would race on TRUNCATE.
    fileParallelism: false,
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
  },
});
