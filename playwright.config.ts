import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8082',
    headless: true,
  },
  webServer: {
    command: 'npx expo start --web --port 8082',
    url: 'http://localhost:8082',
    timeout: 60_000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
