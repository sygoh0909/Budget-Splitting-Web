"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { scanReceiptFile } from "@/lib/scanClient";
import { Spinner } from "./ui/Spinner";
import { useUser } from "./Providers";
import { useToast } from "./ui/Toast";
import { Modal } from "./ui/Modal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Avatar } from "./ui/Avatar";
import { FullScreenSpinner } from "./ui/Spinner";
import { ExpenseModal } from "./ExpenseModal";
import { ExpensesTab } from "./ExpensesTab";
import { PeopleTab } from "./PeopleTab";
import { BalancesTab } from "./BalancesTab";
import { useBook, useExpenses } from "@/lib/hooks";
import { approveJoinRequest, claimPlaceholder, deleteExpense, denyJoinRequest, updateBook, upsertExpense } from "@/lib/db";
import { computeBalances } from "@/lib/split";
import { personColors } from "@/lib/constants";
import { generateUuid, todayISO } from "@/lib/util";
import type { Expense, Person } from "@/lib/types";

const TABS = ["expenses", "people", "balances"] as const;

export function BookDetailScreen({ bookId }: { bookId: string }) {
  const user = useUser();
  const toast = useToast();
  const { data: book, loading: bookLoading, error: bookError } = useBook(bookId);
  const { data: expenses, error: expError } = useExpenses(bookId);

  const [tab, setTab] = useState<(typeof TABS)[number]>("expenses");
  const [expenseForm, setExpenseForm] = useState<{ initial?: Expense; prefill?: Expense } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [claiming, setClaiming] = useState<Person | null>(null);
  const [claimTarget, setClaimTarget] = useState<Person | null>(null);

  if (bookLoading) return <FullScreenSpinner />;

  if (!book || bookError || expError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="font-semibold">{bookError || expError ? "Couldn't open this book" : "Book not found"}</p>
        <p className="mt-2 text-[13px] text-muted">
          {bookError || expError || "It may have been deleted, or you're not a member of it."}
        </p>
        <Link href="/" className="btn-primary mt-6 !px-6">Back to books</Link>
      </main>
    );
  }

  const fail = (err: unknown, msg: string) => {
    console.error(err);
    toast(msg, "error");
  };

  const getPerson = (id: string) => book.people.find((p) => p.id === id) ?? book.deletedPeople.find((p) => p.id === id);

  async function scan(file: File) {
    if (!book || scanning) return;
    setScanning(true);
    try {
      const prefill = await scanReceiptFile(user, file, book.people[0]?.id ?? "");
      setExpenseForm({ prefill });
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : "Failed to scan receipt.", "error");
    } finally {
      setScanning(false);
    }
  }

  async function addPlaceholder(rawName: string) {
    const name = rawName.trim();
    if (!name || !book) return;
    if (book.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) return toast(`${name} is already in this book`, "error");
    const person: Person = { id: generateUuid(), name, color: personColors[book.people.length % personColors.length], isPlaceholder: true };
    try { await updateBook({ ...book, people: [...book.people, person] }); } catch (e) { fail(e, "Couldn't add that person."); }
  }

  function requestRemove(p: Person) {
    if (!book) return;
    const bal = computeBalances(book.people, expenses)[p.id] ?? 0;
    if (Math.abs(bal) > 0.01) return toast(`${p.name} has unsettled payments. Settle up before removing.`, "error");
    setRemoving(p);
  }

  async function confirmRemove() {
    if (!book || !removing) return;
    const p = removing;
    setRemoving(null);
    try {
      await updateBook({ ...book, people: book.people.filter((x) => x.id !== p.id), deletedPeople: [...book.deletedPeople, p] });
    } catch (e) { fail(e, "Couldn't remove that person."); }
  }

  function startClaim(p: Person) {
    if (!book) return;
    if (!book.people.some((x) => !x.isPlaceholder)) return toast("No real members to claim this placeholder.", "error");
    setClaimTarget(null);
    setClaiming(p);
  }

  async function confirmClaim() {
    if (!claiming || !claimTarget) return;
    const [from, to] = [claiming, claimTarget];
    setClaiming(null);
    setClaimTarget(null);
    try {
      await claimPlaceholder(bookId, from.id, to.id);
      toast(`${from.name} merged into ${to.name}`);
    } catch (e) { fail(e, "Couldn't merge those people."); }
  }

  async function settle(fromId: string, toId: string, amount: number, titles: string[]) {
    const from = getPerson(fromId);
    const to = getPerson(toId);
    const forPart = titles.length ? ` for ${titles.join(", ")}` : "";
    try {
      await upsertExpense(bookId, {
        id: generateUuid(),
        title: `settlement:${from?.id}:${to?.id}`,
        date: todayISO(),
        paidBy: fromId,
        items: [{ id: generateUuid(), title: `${from?.name ?? "Unknown"} paid ${to?.name ?? "Unknown"}${forPart}`, amount, category: "Misc", splitWith: [toId] }],
        additionalCharges: [],
        note: null,
        hasReceipt: false,
      });
    } catch (e) { fail(e, "Couldn't record the settlement."); }
  }

  const realMembers = book.people.filter((p) => !p.isPlaceholder && p.id !== claiming?.id);

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl pb-16">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Link href="/" aria-label="Back to books" className="p-1.5 text-muted transition hover:text-white"><ArrowLeft size={20} /></Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">{book.name}</h1>
            {book.destination && <p className="truncate text-[11px] text-muted">{book.destination}</p>}
          </div>
        </div>
        <div role="tablist" className="flex gap-1 px-4 pb-3">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`relative rounded-xl px-4 py-1.5 text-[13px] capitalize transition ${tab === t ? "bg-accent font-bold text-white" : "text-muted hover:text-white"}`}
            >
              {t}
              {t === "people" && book.joinRequests.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                  {book.joinRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4">
        {tab === "expenses" && (
          <ExpensesTab
            book={book}
            expenses={expenses}
            onAdd={() => setExpenseForm({})}
            onScan={scan}
            onEdit={(e) => setExpenseForm({ initial: e })}
            onDelete={async (id) => { try { await deleteExpense(bookId, id); } catch (e) { fail(e, "Couldn't delete the expense."); } }}
          />
        )}
        {tab === "people" && (
          <PeopleTab
            book={book}
            expenses={expenses}
            onAddPlaceholder={addPlaceholder}
            onRemove={requestRemove}
            onClaim={startClaim}
            onApprove={async (uid, name) => {
              try { await approveJoinRequest(bookId, uid, name, personColors[book.people.length % personColors.length]); } catch (e) { fail(e, "Couldn't approve the request."); }
            }}
            onDeny={async (uid) => { try { await denyJoinRequest(bookId, uid); } catch (e) { fail(e, "Couldn't deny the request."); } }}
          />
        )}
        {tab === "balances" && <BalancesTab book={book} expenses={expenses} userId={user.uid} onSettle={settle} onClaim={startClaim} />}
      </div>

      {expenseForm && (
        <ExpenseModal
          key={expenseForm.initial?.id ?? expenseForm.prefill?.id ?? "new"}
          people={book.people}
          deletedPeople={book.deletedPeople}
          currency={book.currency}
          initial={expenseForm.initial}
          prefill={expenseForm.prefill}
          onSave={(e) => upsertExpense(bookId, e)}
          onDelete={expenseForm.initial ? () => deleteExpense(bookId, expenseForm.initial!.id) : undefined}
          onClose={() => setExpenseForm(null)}
        />
      )}

      {scanning && (
        <div role="status" className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-black/75">
          <Spinner size={32} />
          <p className="text-sm">Scanning receipt…</p>
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name ?? ""}?`}
        message="Their name will still appear on past expenses."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />

      {/* Claim placeholder: pick who inherits, then confirm */}
      <Modal open={!!claiming} onClose={() => { setClaiming(null); setClaimTarget(null); }} labelledBy="claim-title">
        {claiming && (
          <div className="p-6">
            <h2 id="claim-title" className="text-base font-semibold">Claim {claiming.name}</h2>
            <p className="mt-2 text-[13px] text-muted">Transfer all expenses to:</p>
            <div className="mt-3 space-y-1">
              {realMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setClaimTarget(m)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition ${claimTarget?.id === m.id ? "bg-accent/15" : "hover:bg-white/5"}`}
                >
                  <Avatar name={m.name} color={m.color} size={32} /> {m.name}
                </button>
              ))}
            </div>
            {claimTarget && (
              <p className="mt-4 rounded-lg bg-danger/10 p-3 text-xs text-muted">
                All expenses from “{claiming.name}” will be transferred to “{claimTarget.name}”. This cannot be undone.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary !py-2" onClick={() => { setClaiming(null); setClaimTarget(null); }}>Cancel</button>
              <button disabled={!claimTarget} onClick={confirmClaim} className="rounded-xl bg-danger/10 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-40">Transfer</button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
