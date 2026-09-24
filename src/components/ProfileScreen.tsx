"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "firebase/auth";
import { Bell, BellOff, Check, ChevronRight, CreditCard, LogOut, MessageSquare, Palette, Settings, User, X, type LucideIcon } from "lucide-react";
import { PaymentMethodsSection } from "./PaymentMethodsSection";
import { getPaymentMethods } from "@/lib/db";
import type { PaymentMethod } from "@/lib/types";
import { useTheme, useUser } from "./Providers";
import { useToast } from "./ui/Toast";
import { AppHeader, PageShell } from "./ui/AppHeader";
import { Spinner } from "./ui/Spinner";
import { accentColors } from "@/lib/constants";
import { createOrUpdateUser, saveAccentColor } from "@/lib/db";
import { signOut } from "@/lib/auth";
import { initialsOf } from "@/lib/util";

type Section = "home" | "profile" | "notifications" | "appearance" | "payments" | "settings" | "feedback";

export function ProfileScreen() {
  const router = useRouter();
  const user = useUser();
  const toast = useToast();
  const { accent, userName, setAccent, setUserName } = useTheme();

  const [section, setSection] = useState<Section>("home");
  const [nameDraft, setNameDraft] = useState(userName);
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    getPaymentMethods(user.uid).then(setMethods).catch(console.error);
  }, [user.uid]);

  const previewAccent = pending ?? accent;

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    setSection("home");
    try {
      await updateProfile(user, { displayName: trimmed });
      await createOrUpdateUser({ uid: user.uid, displayName: trimmed, email: user.email ?? "", createdAt: "" });
    } catch (e) {
      console.error(e);
      toast("Couldn't save your name.", "error");
    }
  }

  async function saveAccent() {
    if (!pending) return;
    setSaving(true);
    setAccent(pending);
    try {
      await saveAccentColor(user.uid, pending.toUpperCase());
      setSaved(true);
      setPending(null);
    } catch (e) {
      console.error(e);
      toast("Couldn't save your colour.", "error");
    }
    setSaving(false);
  }

  async function doSignOut() {
    await signOut();
    router.push("/");
  }

  function back() {
    if (section === "home") router.push("/");
    else { setSection("home"); setPending(null); }
  }

  const menu: { icon: LucideIcon; label: string; onClick: () => void }[] = [
    { icon: User, label: "Edit Profile", onClick: () => { setNameDraft(userName); setSection("profile"); } },
    { icon: Bell, label: "Notifications", onClick: () => setSection("notifications") },
    { icon: Palette, label: "Appearance", onClick: () => { setPending(null); setSaved(false); setSection("appearance"); } },
    { icon: CreditCard, label: "Payment Methods", onClick: () => setSection("payments") },
    { icon: Settings, label: "Settings", onClick: () => setSection("settings") },
    { icon: MessageSquare, label: "Send Feedback", onClick: () => setSection("feedback") },
    { icon: LogOut, label: "Sign Out", onClick: doSignOut },
  ];

  const Heading = ({ kicker, title }: { kicker: string; title: string }) => (
    <>
      <p className="text-xs text-muted">{kicker}</p>
      <h1 className="mt-1 text-[21px] font-bold">{title}</h1>
    </>
  );

  return (
    <PageShell>
      <AppHeader left={<button onClick={back} aria-label="Close" className="icon-btn"><X size={16} /></button>} />
      <div className="px-4">
        {section === "home" && (
          <div>
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent/40 bg-accent/15 text-[22px] font-extrabold text-accent">{initialsOf(userName)}</span>
              <div>
                <p className="text-lg font-bold">{userName || "Set your name"}</p>
                <p className="text-xs text-muted">{user.email ?? "your profile"}</p>
              </div>
            </div>
            <div className="mt-8 space-y-2">
              {menu.map(({ icon: Icon, label, onClick }) => (
                <button key={label} onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left text-sm transition hover:brightness-125">
                  <Icon size={16} className="text-accent" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight size={15} className="text-dim" />
                </button>
              ))}
            </div>
            <p className="mt-8 text-[11px] text-dim">SplitBudget · v1.0.0</p>
          </div>
        )}

        {section === "profile" && (
          <form onSubmit={(e) => { e.preventDefault(); saveName(); }}>
            <Heading kicker="edit profile" title="Your Profile" />
            <div className="mt-8 flex justify-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent/40 bg-accent/15 text-[28px] font-extrabold text-accent">{initialsOf(nameDraft)}</span>
            </div>
            <label htmlFor="display-name" className="label mt-8 block">Display name</label>
            <input id="display-name" autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Your name" className="mt-2.5 w-full border-b-2 border-line bg-transparent pb-2 text-[22px] font-bold outline-none focus:border-accent" />
            <button type="submit" disabled={!nameDraft.trim()} className="btn-primary mt-8 w-full !py-3.5">Save</button>
          </form>
        )}

        {section === "notifications" && (
          <div>
            <Heading kicker="activity" title="Notifications" />
            <div className="mt-10 text-center">
              <BellOff size={40} className="mx-auto text-dim" />
              <p className="mt-3 text-sm text-muted">No notifications yet</p>
            </div>
          </div>
        )}

        {section === "appearance" && (
          <div>
            <Heading kicker="customise" title="Appearance" />
            <p className="label mt-7">Accent colour</p>
            <div className="mt-3.5 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Accent colour">
              {accentColors.map((c) => {
                const sel = previewAccent.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.name}
                    role="radio"
                    aria-checked={sel}
                    onClick={() => { setPending(c.value); setSaved(false); }}
                    className="flex items-center gap-2.5 rounded-2xl bg-card px-4 py-3 text-[13px]"
                    style={{ boxShadow: sel ? `inset 0 0 0 1.5px ${c.value}` : undefined, color: sel ? "#fff" : "#8e8e93" }}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: c.value }}>
                      {sel && <Check size={11} className="text-white" />}
                    </span>
                    {c.name}
                  </button>
                );
              })}
            </div>

            <p className="label mt-7">Preview</p>
            <div className="mt-3 rounded-2xl bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${previewAccent}29`, color: previewAccent }}>AB</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Japan Trip</p>
                  <p className="text-[11px] text-muted">3 people</p>
                </div>
                <span className="text-sm font-bold" style={{ color: previewAccent }}>¥83,120</span>
              </div>
              <div className="mt-3 rounded-xl py-2 text-center text-[13px] font-bold text-white" style={{ background: previewAccent }}>Add Expense</div>
            </div>

            <button onClick={saveAccent} disabled={saving || saved || !pending} className="btn-primary mt-7 w-full !py-3.5">
              {saving ? <Spinner size={20} className="!border-white !border-t-transparent" /> : saved ? <><Check size={16} /> Saved</> : "Save"}
            </button>
          </div>
        )}

        {section === "payments" && (
          <div>
            <Heading kicker="get paid back" title="Payment Methods" />
            <div className="mt-7">
              <PaymentMethodsSection uid={user.uid} methods={methods} onChange={setMethods} />
            </div>
          </div>
        )}

        {section === "settings" && (
          <div>
            <Heading kicker="preferences" title="Settings" />
            <div className="mt-5 space-y-2">
              {[["Currency", "USD ($)"], ["Date format", "DD/MM/YYYY"], ["Language", "English"], ["Data & Privacy", ""], ["Clear all data", ""]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3.5 text-sm">
                  <span>{k}</span>
                  <span className="flex items-center gap-2 text-[13px] text-muted">{v}<ChevronRight size={14} className="text-dim" /></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === "feedback" && (
          <div>
            <Heading kicker="help us improve" title="Send Feedback" />
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={6}
              aria-label="Feedback"
              placeholder="Tell us what you think, report a bug, or suggest a feature..."
              className="mt-5 w-full rounded-2xl bg-card p-4 text-sm outline-none ring-1 ring-transparent focus:ring-accent/60"
            />
            {feedbackSent ? (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent/10 py-3.5 text-[15px] font-bold text-accent"><Check size={16} /> Thanks for your feedback!</div>
            ) : (
              <button
                disabled={!feedback.trim()}
                onClick={() => { setFeedbackSent(true); setTimeout(() => { setFeedbackSent(false); setFeedback(""); setSection("home"); }, 1500); }}
                className="btn-primary mt-4 w-full !py-3.5"
              >Send</button>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
