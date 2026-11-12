import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'off' },
  webServer: {
    command: `npm run build && npm run preview`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    // The acceptance target: real WebKit, iPhone 15 Pro viewport, touch events
    { name: 'webkit-iphone15pro', use: { ...devices['iPhone 15 Pro'] } },
  ],
});
