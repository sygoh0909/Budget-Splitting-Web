/**
 * Firebase *web* config. These values are public identifiers (they ship to every
 * browser) — access is protected by Firebase Auth + firestore.rules, not by hiding them.
 *
 * Override any of them with NEXT_PUBLIC_FIREBASE_* env vars (see .env.example);
 * the fallbacks below are the web app registered for the original Flutter project.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBvnfmOmxyV4edkHvOFRuiJhps9lzLpSiI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "splitbudget-57983.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "splitbudget-57983",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "splitbudget-57983.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "507082100131",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:507082100131:web:974e83cea8cc7a0b785e16",
};

