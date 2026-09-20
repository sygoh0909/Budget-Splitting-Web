"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, Eye, EyeOff, Lock, Mail, Receipt, User } from "lucide-react";
import { resetPassword, signInWithEmail, signUpWithEmail } from "@/lib/auth";
import { useTheme } from "./Providers";
import { useToast } from "./ui/Toast";
import { Spinner } from "./ui/Spinner";

function parseError(err: unknown): string {
  const raw = err instanceof Error ? `${(err as { code?: string }).code ?? ""} ${err.message}` : String(err);
  if (raw.includes("user-not-found")) return "No account found with this email";
  if (raw.includes("wrong-password") || raw.includes("invalid-credential")) return "Incorrect email or password";
  if (raw.includes("email-already-in-use")) return "Email already registered — try logging in";
  if (raw.includes("weak-password")) return "Password must be at least 6 characters";
  if (raw.includes("invalid-email")) return "Invalid email address";
  if (raw.includes("network-request-failed")) return "No internet connection";
  if (raw.includes("too-many-requests")) return "Too many attempts. Try again later";
  if (raw.includes("operation-not-allowed") || raw.includes("CONFIGURATION_NOT_FOUND"))
    return "Auth not configured. Enable Email/Password in the Firebase Console";
  if (raw.includes("unauthorized-domain") || raw.includes("requests-from-referer"))
    return "This domain isn't authorised in Firebase. Add it under Authentication → Settings → Authorized domains";
  return "Something went wrong. Please try again.";
}

function Field({ icon, suffix, ...props }: { icon: ReactNode; suffix?: ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">{icon}</span>
      <input
        {...props}
        className="w-full rounded-[14px] bg-card py-4 pl-11 pr-11 text-[15px] text-white outline-none ring-1 ring-transparent transition focus:ring-accent"
      />
      {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2">{suffix}</span>}
    </div>
  );
}

export function LoginScreen() {
  const { setUserName } = useTheme();
  const toast = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    const pw = password.trim();
    if (!em || !pw) return setError("Please fill in all fields");
    if (isSignUp && !name.trim()) return setError("Please enter your name");

    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await signUpWithEmail(em, pw, name.trim());
        setUserName(name.trim());
      } else {
        await signInWithEmail(em, pw);
      }
    } catch (err) {
      setError(parseError(err));
      setLoading(false);
    }
  }

  async function onForgot() {
    const em = email.trim();
    if (!em) return setError("Enter your email first");
    try {
      await resetPassword(em);
      setError(null);
      toast("Password reset email sent");
    } catch (err) {
      setError(parseError(err));
    }
  }

  function toggleMode() {
    setIsSignUp((v) => !v);
    setError(null);
    setEmail("");
    setPassword("");
    setName("");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-8 py-10">
      <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10 text-accent">
        <Receipt size={32} />
      </div>
      <h1 className="mt-5 text-center text-[28px] font-extrabold tracking-tight">SplitBudget</h1>
      <p className="mt-1.5 text-center text-sm text-muted">Split expenses with friends</p>

      <h2 className="mb-6 mt-10 text-xl font-bold">{isSignUp ? "Create Account" : "Welcome Back"}</h2>

      <form onSubmit={submit} className="space-y-3" noValidate>
        {isSignUp && (
          <Field
            icon={<User size={18} />}
            placeholder="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            aria-label="Display name"
          />
        )}
        <Field
          icon={<Mail size={18} />}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          aria-label="Email"
        />
        <Field
          icon={<Lock size={18} />}
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          aria-label="Password"
          suffix={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          }
        />

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!isSignUp && (
          <div className="text-right">
            <button type="button" onClick={onForgot} className="text-[13px] text-accent">
              Forgot password?
            </button>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary mt-3 w-full !rounded-2xl !py-4 !text-base">
          {loading ? <Spinner size={20} className="!border-white !border-t-transparent" /> : isSignUp ? "Sign Up" : "Log In"}
        </button>
      </form>

      <p className="mt-5 text-center text-[13px] text-muted">
        {isSignUp ? "Already have an account? " : "Don't have an account? "}
        <button onClick={toggleMode} className="font-bold text-accent">
          {isSignUp ? "Log In" : "Sign Up"}
        </button>
      </p>
    </main>
  );
}
