import { defineConfig, devices } from '@playwright/test';

// CI runs the production server built in the previous step (`npm start`);
// local runs keep the dev server. PLAYWRIGHT_CHROMIUM_EXECUTABLE lets a machine
// with a pre-installed Chromium (the cloud rig) run without a browser download.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: './e2e',
  // B2a: synthetic fixture accounts for the signed-in specs (skipped without a database).
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.CI ? 'npm start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
