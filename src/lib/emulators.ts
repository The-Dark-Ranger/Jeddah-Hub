/* Local test runs (npm run test:e2e) use Firebase's emulators with made-up
 * data instead of the real project. This is never true in a production build:
 * Next.js fixes NODE_ENV to 'production' when building, so the checks using it
 * disappear from what is deployed, whatever the environment says. */
export const USE_EMULATORS =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_USE_EMULATORS === '1';

/** Firestore's REST address (read by the server for public pages and roles). */
export const FIRESTORE_REST = USE_EMULATORS
  ? `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1`
  : 'https://firestore.googleapis.com/v1';
