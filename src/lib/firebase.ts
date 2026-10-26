/* Firebase client (Auth and Firestore) for the browser, from the public
 * NEXT_PUBLIC_FIREBASE_* settings. */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  browserSessionPersistence, inMemoryPersistence, type Auth,
} from "firebase/auth";
import { initializeFirestore, getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isBrowser = typeof window !== 'undefined';

/** Sign-in that keeps working on every device: it remembers the session in
 *  IndexedDB where it can, and falls back to local, then session storage,
 *  then memory in browsers that block storage (private mode, in-app
 *  browsers such as Instagram or WhatsApp). */
function makeAuth(app: FirebaseApp): Auth {
  if (!isBrowser) return getAuth(app);
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
    });
  } catch {
    return getAuth(app); // already initialised (e.g. after a hot reload)
  }
}

/** Firestore that works on more networks and saves more forgivingly:
 *  - switches to long-polling where a network or proxy blocks Firestore's
 *    streaming connection (otherwise reads hang and buttons seem dead);
 *  - drops `undefined` fields from writes instead of rejecting the whole
 *    save, so one empty optional field can't make a form fail. */
function makeDb(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app); // already initialised
  }
}

// Graceful init: if NEXT_PUBLIC_FIREBASE_* vars are not set (e.g. during SSR without config),
// we avoid crashing so that public pages still render. Auth/DB features won't work until
// the env vars are added to the Vercel project settings.
let app: FirebaseApp, auth: Auth, db: Firestore;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = makeAuth(app);
  db = makeDb(app);
} catch (e) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[firebase] Init failed, set NEXT_PUBLIC_FIREBASE_* env vars:', (e as Error).message);
  }
  // Provide stub objects so imports don't crash; actual calls will fail gracefully at the usage site
  app = undefined as unknown as FirebaseApp;
  auth = undefined as unknown as Auth;
  db = undefined as unknown as Firestore;
}

export { auth, db };
