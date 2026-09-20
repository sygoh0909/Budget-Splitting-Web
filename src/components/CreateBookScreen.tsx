"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, X } from "lucide-react";
import { useTheme, useUser } from "./Providers";
import { useToast } from "./ui/Toast";
import { AppHeader, PageShell } from "./ui/AppHeader";
import { CurrencyPicker } from "./CurrencyPicker";
import { currencies, personColors } from "@/lib/constants";
import { createBook } from "@/lib/db";
import { copyText, generateInviteCode, generateUuid } from "@/lib/util";
import type { Book } from "@/lib/types";

export function CreateBookScreen() {
  const router = useRouter();
  const user = useUser();
  const { userName } = useTheme();
  const toast = useToast();

  const [stage, setStage] = useState<"form" | "invite">("form");
  const [bookName, setBookName] = useState("");
  const [myName, setMyName] = useState(userName || user.displayName || "");
  const [currency, setCurrency] = useState("USD");
  const [created, setCreated] = useState<Book | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const symbol = (currencies.find((c) => c.code === currency) ?? currencies[0]).symbol;
  const canCreate = bookName.trim() !== "" && myName.trim() !== "";

  function handleCreate() {
    if (!canCreate) return;
    // the invite code is generated up-front so it can be shown before the book is saved
    setCreated({
      id: generateUuid(),
      name: bookName.trim(),
      destination: "",
      emoji: "",
      currency: symbol,
      type: "shared",
      // the creator's person id is the auth uid, so rules can match membership
      people: [{ id: user.uid, name: myName.trim(), color: personColors[0], isPlaceholder: false }],
      deletedPeople: [],
      joinRequests: [],
      createdAt: new Date().toISOString(),
      inviteCode: generateInviteCode(),
      maxSize: null,
    });
    setStage("invite");
  }

  async function openBook() {
    if (!created || saving) return;
    setSaving(true);
    try {
      await createBook(created);
      router.replace(`/books/${created.id}`);
    } catch (err) {
      console.error(err);
      toast("Couldn't create the book. Please try again.", "error");
      setSaving(false);
    }
  }

  async function copyCode() {
    if (!created?.inviteCode) return;
    await copyText(created.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (stage === "invite" && created) {
    return (
      <PageShell>
        <AppHeader
          right={
            <button onClick={openBook} disabled={saving} aria-label="Open book" className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50">
              <Check size={18} />
            </button>
          }
        />
        <div className="px-4">
          <p className="text-xs text-muted">book created</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight">{created.name}</h1>

          <p className="label mt-7">Invite code</p>
          <div className="mt-2.5 flex items-center justify-between rounded-2xl bg-card px-5 py-4">
            <span className="font-mono text-[32px] font-extrabold tracking-[0.15em]">{created.inviteCode}</span>
            <button
              onClick={copyCode}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                copied ? "bg-accent/10 text-accent" : "bg-card2 text-muted"
              }`}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-2xl bg-card px-4 py-3 text-xs">
            <span className="text-muted">Currency</span>
            <span className="font-semibold">{created.currency}</span>
          </div>

          <button onClick={openBook} disabled={saving} className="btn-primary mt-6 w-full !py-3.5">
            {saving ? "Creating…" : "Open Book"}
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AppHeader
        left={
          <Link href="/" aria-label="Cancel" className="icon-btn">
            <X size={16} />
          </Link>
        }
        right={
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            aria-label="Create book"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition disabled:opacity-25"
          >
            <Check size={18} />
          </button>
        }
      />
      <form
        className="px-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate();
        }}
      >
        <p className="text-xs text-muted">create a book</p>
        <input
          autoFocus
          value={bookName}
          onChange={(e) => setBookName(e.target.value)}
          placeholder="book name"
          aria-label="Book name"
          className="mt-1.5 w-full border-b border-line bg-transparent pb-2 text-[26px] font-bold tracking-tight outline-none focus:border-accent"
        />

        <p className="label mt-6">Your name</p>
        <input
          value={myName}
          onChange={(e) => setMyName(e.target.value)}
          placeholder="how others will see you"
          aria-label="Your name"
          className="mt-2.5 w-full border-b border-line bg-transparent pb-2 text-lg font-semibold outline-none focus:border-accent"
        />

        <p className="label mt-8">Currency</p>
        <div className="mt-2.5">
          <CurrencyPicker value={currency} onChange={setCurrency} />
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </PageShell>
  );
}
