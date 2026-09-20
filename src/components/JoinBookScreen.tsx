"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useUser } from "./Providers";
import { AppHeader, PageShell } from "./ui/AppHeader";
import { Spinner } from "./ui/Spinner";
import { addJoinRequest, getBookByInviteCode, updateBook } from "@/lib/db";
import { personColors } from "@/lib/constants";
import type { Book } from "@/lib/types";

type Stage = "code" | "name" | "request" | "request_sent";

function ErrorBox({ children, icon = <AlertCircle size={15} /> }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function JoinBookScreen() {
  const router = useRouter();
  const user = useUser();

  const [stage, setStage] = useState<Stage>("code");
  const [code, setCode] = useState("");
  const [myName, setMyName] = useState("");
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function onCodeChange(val: string) {
    // accept a pasted invite link (…/join/ABC123) or a plain code
    const match = val.match(/\/join\/([A-Z0-9]{6})/i);
    if (match) {
      setCode(match[1].toUpperCase());
    } else {
      setCode(val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
    }
    setError("");
  }

  async function handleCodeNext() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return setError("Enter the 6-character code from your invite");

    setBusy(true);
    setError("");
    try {
      const found = await Promise.race([
        getBookByInviteCode(trimmed),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      setBusy(false);
      if (!found) return setError("No book found with that code — check and try again.");
      if (found.people.some((p) => p.id === user.uid)) return setError("You are already a member of this book!");

      const removed = found.deletedPeople.find((p) => p.id === user.uid);
      setBook(found);
      if (removed) {
        // was removed earlier: must ask to rejoin, pre-filling the previous name
        setMyName(removed.name);
        setStage("request");
      } else {
        setStage("name");
      }
    } catch {
      setBusy(false);
      setError("No book found with that code — check and try again.");
    }
  }

  async function handleJoin() {
    if (!book || !myName.trim() || busy) return;
    if (book.people.some((p) => p.id === user.uid)) return router.replace(`/books/${book.id}`);

    setBusy(true);
    setError("");
    try {
      const me = {
        id: user.uid,
        name: myName.trim(),
        color: personColors[book.people.length % personColors.length],
        isPlaceholder: false,
      };
      await updateBook({ ...book, people: [...book.people, me] });
      router.replace(`/books/${book.id}`);
    } catch (err) {
      console.error(err);
      setBusy(false);
      setError("Couldn't join this book. Please try again.");
    }
  }

  async function handleSendRequest() {
    if (!book || !myName.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await addJoinRequest(book.id, user.uid, myName.trim());
      setBusy(false);
      setStage("request_sent");
    } catch {
      setBusy(false);
      setError("Failed to send request. Try again.");
    }
  }

  const peopleWord = (n: number) => (n === 1 ? "person" : "people");

  return (
    <PageShell>
      <AppHeader
        left={
          stage === "name" ? (
            <button onClick={() => setStage("code")} aria-label="Back" className="icon-btn">
              <X size={16} />
            </button>
          ) : (
            <Link href="/" aria-label="Close" className="icon-btn">
              <X size={16} />
            </Link>
          )
        }
      />

      <div className="px-4">
        {stage === "code" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length >= 4 && !busy) handleCodeNext();
            }}
          >
            <p className="text-xs text-muted">join a book</p>
            <h1 className="mt-1 text-[22px] font-bold tracking-tight">Enter your code</h1>

            <input
              autoFocus
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              placeholder="ABC123"
              aria-label="Invite code"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className={`mt-7 w-full border-b-2 bg-transparent pb-2 text-center font-mono text-[38px] font-extrabold tracking-[0.25em] outline-none ${
                error ? "border-danger" : code.length === 6 ? "border-accent" : "border-line focus:border-accent"
              }`}
            />
            <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className={`h-[5px] w-[5px] rounded-full ${i < code.length ? "bg-accent" : "bg-card2"}`} />
              ))}
            </div>
            {error && <p role="alert" className="mt-4 text-center text-xs text-danger">{error}</p>}
            <p className="mt-4 text-center text-xs text-dim">You can also paste a full invite link</p>

            <button type="submit" disabled={code.length < 4 || busy} className="btn-primary mt-7 w-full !py-3.5">
              {busy ? (
                <Spinner size={20} className="!border-white !border-t-transparent" />
              ) : (
                <>
                  Next <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {stage === "name" && book && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin();
            }}
          >
            <p className="text-xs text-muted">joining</p>
            <h1 className="mt-1 text-[22px] font-bold tracking-tight">{book.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {book.people.length} {peopleWord(book.people.length)} already in this book
            </p>

            <p className="label mt-8">Your name</p>
            <input
              autoFocus
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              placeholder="how others will see you"
              aria-label="Your name"
              className="mt-2.5 w-full border-b-2 border-line bg-transparent pb-2 text-2xl font-bold tracking-tight outline-none focus:border-accent"
            />
            {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}
            <button type="submit" disabled={!myName.trim() || busy} className="btn-primary mt-8 w-full !py-3.5">
              {busy ? <Spinner size={20} className="!border-white !border-t-transparent" /> : <>Join Book <ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {stage === "request" && book && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendRequest();
            }}
          >
            <p className="text-xs text-muted">joining</p>
            <h1 className="mt-1 text-[22px] font-bold tracking-tight">{book.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {book.people.length} {peopleWord(book.people.length)} in this book
            </p>

            <div className="mt-8">
              <ErrorBox icon={<Info size={15} />}>You were removed from this book. Send a request to rejoin.</ErrorBox>
            </div>

            <p className="label mt-8">Your name</p>
            <input
              autoFocus
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              placeholder="how you want to be known"
              aria-label="Your name"
              className="mt-2.5 w-full border-b-2 border-line bg-transparent pb-2 text-2xl font-bold tracking-tight outline-none focus:border-accent"
            />
            {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}
            <button type="submit" disabled={!myName.trim() || busy} className="btn-primary mt-8 w-full !py-3.5">
              {busy ? <Spinner size={20} className="!border-white !border-t-transparent" /> : <>Send Request <ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {stage === "request_sent" && book && (
          <div className="flex flex-col items-center pt-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent">
              <CheckCircle2 size={48} />
            </div>
            <h1 className="mt-6 text-[22px] font-bold tracking-tight">Request Sent!</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {book.people.length} member{book.people.length === 1 ? "" : "s"} of {book.name} will review your request.
            </p>
            <Link href="/" className="btn-primary mt-8 w-full !py-3.5">
              Done
            </Link>
          </div>
        )}
      </div>
    </PageShell>
  );
}
