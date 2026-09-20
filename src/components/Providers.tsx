"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { DEFAULT_ACCENT } from "@/lib/constants";
import { hexToRgbTriplet } from "@/lib/util";
import { auth } from "@/lib/firebase";
import { subscribeAuth, waitForSignUp } from "@/lib/auth";
import { createOrUpdateUser, ensurePersonalBook, getUser } from "@/lib/db";
import { ToastProvider } from "./ui/Toast";
import { FullScreenSpinner } from "./ui/Spinner";
import { LoginScreen } from "./LoginScreen";

/* ── Theme (accent colour + display name) ────────────────────────────────── */

interface ThemeState {
  accent: string;
  userName: string;
  setAccent: (hex: string) => void;
  setUserName: (name: string) => void;
}

const ThemeContext = createContext<ThemeState>({
  accent: DEFAULT_ACCENT,
  userName: "",
  setAccent: () => {},
  setUserName: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const ACCENT_CACHE_KEY = "splitbudget.accent";

function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);
  const [userName, setUserName] = useState("");

  // apply instantly from the last-used colour, so there's no purple flash on reload
  useEffect(() => {
    try {
      const cached = localStorage.getItem(ACCENT_CACHE_KEY);
      if (cached) setAccentState(cached);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", hexToRgbTriplet(accent));
  }, [accent]);

  const setAccent = useCallback((hex: string) => {
    setAccentState(hex);
    try {
      localStorage.setItem(ACCENT_CACHE_KEY, hex);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo(() => ({ accent, userName, setAccent, setUserName }), [accent, userName, setAccent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/* ── Auth ────────────────────────────────────────────────────────────────── */

interface AuthState {
  user: User | null;
  /** auth has resolved and the user's profile / personal book have been ensured */
  ready: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, ready: false });

/** The signed-in user. Only call inside <AuthGate> (i.e. any page). */
export function useUser(): User {
  const { user } = useContext(AuthContext);
  if (!user) throw new Error("useUser called without a signed-in user");
  return user;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const { setAccent, setUserName } = useTheme();
  const [state, setState] = useState<AuthState>({ user: null, ready: false });

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = subscribeAuth(async (fbUser) => {
      if (!fbUser) {
        setUserName("");
        if (!cancelled) setState({ user: null, ready: true });
        return;
      }

      if (!cancelled) setState({ user: fbUser, ready: false });
      try {
        await waitForSignUp();
        try {
          await fbUser.reload();
        } catch {
          /* offline / token issue — carry on with the cached profile */
        }
        const current = auth.currentUser ?? fbUser;
        const name = current.displayName || "Me";

        await createOrUpdateUser({
          uid: current.uid,
          displayName: name,
          email: current.email ?? "",
          createdAt: new Date().toISOString(),
        });
        await ensurePersonalBook(current.uid, name);

        const profile = await getUser(current.uid);
        setUserName(profile?.displayName || current.displayName || "");
        if (profile?.accentColor) setAccent(profile.accentColor);
      } catch (err) {
        // Don't leave the user on an infinite spinner if Firestore rejects us
        console.error("Failed to initialise user profile", err);
      }
      if (!cancelled) setState({ user: auth.currentUser ?? fbUser, ready: true });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setAccent, setUserName]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/** Shows a spinner while auth resolves, the login screen when signed out, else the app. */
function AuthGate({ children }: { children: ReactNode }) {
  const { user, ready } = useContext(AuthContext);
  if (!ready) return <FullScreenSpinner />;
  if (!user) return <LoginScreen />;
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
