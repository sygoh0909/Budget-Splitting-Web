"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Info, Palette, Trash2, X } from "lucide-react";
import { useBook } from "@/lib/hooks";
import { deleteBook, updateBook } from "@/lib/db";
import { currencies, personColors } from "@/lib/constants";
import { copyText, generateUuid, generateInviteCode } from "@/lib/util";
import type { Book, Person } from "@/lib/types";
import { AppHeader, PageShell } from "./ui/AppHeader";
import { Avatar } from "./ui/Avatar";
import { Modal } from "./ui/Modal";
import { FullScreenSpinner } from "./ui/Spinner";
import { useToast } from "./ui/Toast";
import { CurrencyPicker } from "./CurrencyPicker";

function EditForm({ book }: { book: Book }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"info" | "people">("info");
  const [name, setName] = useState(book.name);
  const [currency, setCurrency] = useState((currencies.find((c) => c.symbol === book.currency) ?? currencies[0]).code);
  const [people, setPeople] = useState<Person[]>(book.people);
  const [newPerson, setNewPerson] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [colorFor, setColorFor] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);
  // shown for shared books that somehow have no code yet
  const [fallbackCode] = useState(generateInviteCode);
  const inviteCode = book.inviteCode ?? fallbackCode;

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const symbol = (currencies.find((c) => c.code === currency) ?? currencies[0]).symbol;
      await updateBook({ ...book, name: name.trim(), currency: symbol, people });
      router.push("/");
    } catch (e) {
      console.error(e);
      toast("Couldn't save changes.", "error");
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteBook(book.id);
      router.push("/");
    } catch (e) {
      console.error(e);
      toast("Couldn't delete the book.", "error");
      setBusy(false);
    }
  }

  function addPerson() {
    const t = newPerson.trim();
    if (!t || people.some((p) => p.name.toLowerCase() === t.toLowerCase())) return;
    setPeople([...people, { id: generateUuid(), name: t, color: personColors[people.length % personColors.length], isPlaceholder: true }]);
    setNewPerson("");
  }

  const tabBtn = (t: "info" | "people") => (
    <button onClick={() => setTab(t)} className={`rounded-xl px-4 py-1.5 text-[13px] ${tab === t ? "bg-accent font-bold text-white" : "bg-card text-muted"}`}>{t}</button>
  );

  return (
    <PageShell>
      <AppHeader
        left={<Link href="/" aria-label="Cancel" className="icon-btn"><X size={16} /></Link>}
        right={<button onClick={save} disabled={busy || !name.trim()} aria-label="Save changes" className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"><Check size={18} /></button>}
      />
      <div className="px-4">
        <p className="text-xs text-muted">edit book</p>
        <div className="mt-3 flex gap-1">{tabBtn("info")}{tabBtn("people")}</div>

        <div className="mt-5">
          {tab === "info" ? (
            <div>
              <label htmlFor="book-name" className="label">Book name</label>
              <input id="book-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-2.5 w-full border-b border-line bg-transparent pb-2 text-[21px] font-semibold outline-none focus:border-accent" />

              <p className="label mt-7">Currency</p>
              <div className="mt-2.5"><CurrencyPicker value={currency} onChange={setCurrency} /></div>

              {book.type === "shared" && (
                <>
                  <p className="label mt-7">Invite code</p>
                  <div className="mt-2.5 flex items-center justify-between rounded-2xl bg-card px-5 py-4">
                    <span className="font-mono text-[28px] font-extrabold tracking-[0.15em]">{inviteCode}</span>
                    <button
                      onClick={async () => { await copyText(inviteCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${copied ? "bg-accent/10 text-accent" : "bg-card2 text-muted"}`}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </>
              )}

              {book.type !== "personal" && (
                <button onClick={() => setConfirmDelete(true)} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-danger/10 py-3 text-sm text-danger">
                  <Trash2 size={15} /> Delete Book
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-2.5 rounded-xl border border-accent/15 bg-accent/5 p-3">
                <Info size={14} className="mt-0.5 shrink-0 text-accent" />
                <p className="text-xs text-muted">Add a placeholder person for someone who doesn&apos;t have an account yet. They can claim their spot later.</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addPerson(); }} className="mt-4 flex gap-2">
                <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} placeholder='Name (e.g. "Alex")' aria-label="Placeholder name" className="min-w-0 flex-1 rounded-xl bg-card px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-accent/60" />
                <button type="submit" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">Add</button>
              </form>
              <div className="mt-4 space-y-2">
                {people.length === 0 && <p className="py-10 text-center text-sm text-dim">No people yet — add a placeholder above</p>}
                {people.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
                    <button onClick={() => setColorFor(p)} aria-label={`Change colour for ${p.name}`}><Avatar name={p.name} color={p.color} size={36} /></button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      {p.isPlaceholder && <p className="text-[11px] text-dim">placeholder · no account</p>}
                    </div>
                    <button onClick={() => setColorFor(p)} aria-label={`Pick colour for ${p.name}`} className="p-1.5" style={{ color: p.color }}><Palette size={14} /></button>
                    <button onClick={() => setPeople(people.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`} className="p-1.5 text-dim hover:text-danger"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!colorFor} onClose={() => setColorFor(null)}>
        {colorFor && (
          <div className="p-4 pb-8">
            <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-line" />
            <p className="text-sm font-semibold">Pick colour for {colorFor.name}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {personColors.map((c) => {
                const sel = c === colorFor.color;
                return (
                  <button
                    key={c}
                    aria-label={c}
                    aria-pressed={sel}
                    onClick={() => { setPeople(people.map((p) => (p.id === colorFor.id ? { ...p, color: c } : p))); setColorFor(null); }}
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${sel ? "ring-[3px] ring-white" : ""}`}
                    style={{ background: c }}
                  >
                    {sel && <Check size={18} className="text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <div className="p-6">
          <h2 className="text-sm font-semibold">Delete “{book.name}”?</h2>
          <p className="mt-2 text-xs text-muted">This will permanently remove all expenses and data.</p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 !py-2.5">Cancel</button>
            <button onClick={remove} disabled={busy} className="flex-1 rounded-xl bg-danger py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">Delete</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}

export function EditBookScreen({ bookId }: { bookId: string }) {
  const { data: book, loading } = useBook(bookId);
  const [snapshot, setSnapshot] = useState<Book | null>(null);

  // take one snapshot so live updates don't overwrite what the user is typing
  if (book && !snapshot) setSnapshot(book);

  if (loading) return <FullScreenSpinner />;
  if (!snapshot) {
    return (
      <PageShell>
        <div className="py-20 text-center">
          <p className="font-semibold">Book not found</p>
          <Link href="/" className="btn-primary mt-6 !px-6">Back to books</Link>
        </div>
      </PageShell>
    );
  }
  return <EditForm book={snapshot} />;
}
