import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { createOrUpdateUser, ensurePersonalBook } from "./db";

// Sign-up creates the Firebase user first and fills in the display name / profile
// docs afterwards. The auth listener fires as soon as the user exists, so it has to
// wait for this to finish or it would create the personal book with a blank name.
let signUpInFlight: Promise<unknown> | null = null;
export function waitForSignUp(): Promise<unknown> {
  return signUpInFlight ?? Promise.resolve();
}

export const subscribeAuth = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email: string, password: string, name: string) {
  const run = async () => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
    await createOrUpdateUser({
      uid: user.uid,
      displayName: name,
      email,
      createdAt: new Date().toISOString(),
    });
    await ensurePersonalBook(user.uid, name);
  };
  const p = run();
  signUpInFlight = p.catch(() => undefined);
  try {
    await p;
  } finally {
    signUpInFlight = null;
  }
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

export const signOut = () => fbSignOut(auth);
