import { defineConfig } from '@playwright/test';

/* Browser tests of the site's main functions (npm run test:e2e). They run the
 * real pages and server routes against Firebase's emulators with made-up data
 * (tests/e2e/seed.ts); the real database is never touched and no email is sent.
 * They use Microsoft Edge by default: set PW_CHANNEL=chrome to use Chrome. */

const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/seed.ts',
  // The tests share one database and follow one another's results.
  workers: 1,
  fullyParallel: false,
  // The first visit to each page compiles it, which can take a while.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL ?? 'msedge',
    navigationTimeout: 120_000,
    actionTimeout: 30_000,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/en/privacy-policy`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_USE_EMULATORS: '1',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-jeddah-hub',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-jeddah-hub.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-app',
      NEXT_PUBLIC_RECAPTCHA_SITE_KEY: '',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      // Local settings can't leak into a test run.
      FIREBASE_SERVICE_ACCOUNT: '',
      RESEND_API_KEY: '',
      RECAPTCHA_SECRET_KEY: '',
    },
  },
});
