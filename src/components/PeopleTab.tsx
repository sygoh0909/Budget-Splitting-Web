"use client";

import { useState } from "react";
import { Check, Copy, Info, Trash2, User, UserPlus, Users } from "lucide-react";
import type { Book, Expense, Person } from "@/lib/types";
import { computeBalances, computePersonSummary } from "@/lib/split";
import { copyText, money } from "@/lib/util";
import { Avatar } from "./ui/Avatar";

interface Props {
  book: Book;
  expenses: Expense[];
  onAddPlaceholder: (name: string) => Promise<void>;
  onRemove: (p: Person) => void;
  onClaim: (p: Person) => void;
  onApprove: (userId: string, userName: string) => Promise<void>;
  onDeny: (userId: string) => Promise<void>;
}

export function PeopleTab({ book, expenses, onAddPlaceholder, onRemove, onClaim, onApprove, onDeny }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const balances = computeBalances(book.people, expenses);

  async function add() {
    if (!name.trim()) return;
    await onAddPlaceholder(name);
    setName("");
    setShowAdd(false);
  }

  async function copyCode() {
    await copyText(book.inviteCode ?? book.id.slice(0, 8));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-accent/15 bg-accent/5 p-3">
        <Info size={14} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-xs text-muted">Add a placeholder person for someone who doesn&apos;t have an account yet. They can claim their spot later.</p>
      </div>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setShowAdd(true)} className="btn-primary !rounded-2xl !py-2.5 !text-sm">
          <UserPlus size={16} /> Add Placeholder
        </button>
        {book.type === "shared" && (
          <button onClick={copyCode} className={`flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 text-[13px] ${copied ? "text-accent" : "text-muted"}`}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Invite code"}
          </button>
        )}
      </div>

      {book.joinRequests.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2.5 rounded-xl border border-orange-500/15 bg-orange-500/5 p-3 text-xs font-medium">
            <User size={14} className="text-orange-500" />
            {book.joinRequests.length} rejoin request{book.joinRequests.length === 1 ? "" : "s"}
          </div>
          {book.joinRequests.map((r) => (
            <div key={r.userId} className="flex items-center gap-4 rounded-2xl border border-orange-500/20 bg-card p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-dim text-muted"><User size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.userName}</p>
                <p className="mt-1 text-[11px] text-muted">Requesting to rejoin</p>
              </div>
              <button onClick={() => onDeny(r.userId)} className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger">Deny</button>
              <button onClick={() => onApprove(r.userId, r.userName)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">Approve</button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <form
          onSubmit={(e) => { e.preventDefault(); add(); }}
          className="mb-4 flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Name (e.g. "Alex")'
            aria-label="Placeholder name"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white">Add</button>
          <button type="button" onClick={() => { setShowAdd(false); setName(""); }} className="text-muted" aria-label="Cancel">✕</button>
        </form>
      )}

      {book.people.length === 0 ? (
        <div className="py-16 text-center">
          <Users size={48} className="mx-auto text-dim" />
          <p className="mt-4 font-semibold">No people yet</p>
          <p className="mt-1 text-[13px] text-muted">Add people to split expenses with</p>
        </div>
      ) : (
        <div className="space-y-2">
          {book.people.map((p) => {
            const { paid, shouldPay } = computePersonSummary(p.id, balances[p.id] ?? 0, expenses);
            return (
              <div key={p.id} className="flex items-center gap-4 rounded-2xl bg-card p-4">
                <Avatar name={p.name} color={p.color} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  {p.isPlaceholder && <p className="text-[11px] text-dim">placeholder · no account</p>}
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
                    <span className="text-muted">Paid: <span className="font-medium text-accent">{money(book.currency, paid)}</span></span>
                    <span className="text-muted">Should pay: <span className={`font-medium ${shouldPay > 0.005 ? "text-danger" : "text-white"}`}>{money(book.currency, shouldPay)}</span></span>
                  </div>
                </div>
                {p.isPlaceholder && (
                  <button onClick={() => onClaim(p)} aria-label={`Merge ${p.name} into a member`} title="Merge into a member" className="p-2 text-dim transition hover:text-white">
                    <UserPlus size={15} />
                  </button>
                )}
                <button onClick={() => onRemove(p)} aria-label={`Remove ${p.name}`} className="p-2 text-dim transition hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
