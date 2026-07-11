import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Graceful init: if NEXT_PUBLIC_FIREBASE_* vars are not set (e.g. during SSR without config),
// we avoid crashing so that public pages still render. Auth/DB features won't work until
// the env vars are added to the Vercel project settings.
// eslint-disable-next-line prefer-const
let app: FirebaseApp, auth: Auth, db: Firestore;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[firebase] Init failed — set NEXT_PUBLIC_FIREBASE_* env vars:', (e as Error).message);
  }
  // Provide stub objects so imports don't crash; actual calls will fail gracefully at the usage site
  app = undefined as unknown as FirebaseApp;
  auth = undefined as unknown as Auth;
  db = undefined as unknown as Firestore;
}

export { app, auth, db };
