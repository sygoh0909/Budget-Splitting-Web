"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, QrCode, ReceiptText } from "lucide-react";
import type { Book, Expense, Person } from "@/lib/types";
import { computeBalances, computeGrossCredit, computeOwedToPerson, computePairwiseDebts, EPS } from "@/lib/split";
import { getPaymentMethods } from "@/lib/db";
import type { PaymentMethod } from "@/lib/types";
import { PaymentQrModal } from "./PaymentQrModal";
import { money, withAlpha } from "@/lib/util";
import { Avatar } from "./ui/Avatar";

interface Props {
  book: Book;
  expenses: Expense[];
  userId: string;
  onSettle: (fromId: string, toId: string, amount: number, titles: string[]) => Promise<void>;
  onClaim: (p: Person) => void;
}

function SectionHeader({ label, count, expanded, onToggle }: { label: string; count: number; expanded: boolean; onToggle?: () => void }) {
  return (
    <button onClick={onToggle} disabled={!onToggle} className="flex w-full items-center gap-1.5 text-left">
      <span className="text-[11px] tracking-wider text-dim">{label}</span>
      <span className="rounded-full bg-card2 px-1.5 py-px text-[10px] text-muted">{count}</span>
      <span className="flex-1" />
      {onToggle && (expanded ? <ChevronUp size={16} className="text-dim" /> : <ChevronDown size={16} className="text-dim" />)}
    </button>
  );
}

function LineRow({ title, amount, currency, negative, small }: { title: string; amount: number; currency: string; negative?: boolean; small?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${small ? "text-[10px]" : "text-[11px]"}`}>
      <ReceiptText size={10} className="shrink-0 text-dim" />
      <span className="min-w-0 flex-1 truncate text-muted">{title}</span>
      <span className="text-danger">{negative ? "-" : ""}{money(currency, amount)}</span>
    </div>
  );
}

export function BalancesTab({ book, expenses, userId, onSettle, onClaim }: Props) {
  const [owesOpen, setOwesOpen] = useState(true);
  const [owedOpen, setOwedOpen] = useState(true);
  const [settledOpen, setSettledOpen] = useState(true);
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<{ creditorId: string; creditorName: string; amount: number } | null>(null);
  const [methodsCache, setMethodsCache] = useState<Record<string, PaymentMethod[]>>({});

  function openPay(creditorId: string, creditorName: string, amount: number) {
    setPayFor({ creditorId, creditorName, amount });
    if (!(creditorId in methodsCache)) {
      getPaymentMethods(creditorId)
        .then((ms) => setMethodsCache((prev) => ({ ...prev, [creditorId]: ms })))
        .catch(() => setMethodsCache((prev) => ({ ...prev, [creditorId]: [] })));
    }
  }

  const balances = computeBalances(book.people, expenses);
  const getPerson = (id: string) => book.people.find((p) => p.id === id) ?? book.deletedPeople.find((p) => p.id === id);
  const isDeleted = (id: string) => book.deletedPeople.some((p) => p.id === id);

  // active people win over deleted ones (rejoin case)
  const seen = new Set<string>();
  const allPeople: Person[] = [];
  for (const p of [...book.people, ...book.deletedPeople]) if (!seen.has(p.id)) { seen.add(p.id); allPeople.push(p); }

  const gross = computeGrossCredit(expenses);
  const isOwed = allPeople.filter((p) => (gross[p.id] ?? 0) > EPS && (balances[p.id] ?? 0) > EPS);
  const involved = new Set<string>();
  for (const e of expenses) { involved.add(e.paidBy); e.items.forEach((i) => i.splitWith.forEach((id) => involved.add(id))); }
  const settled = allPeople.filter((p) => involved.has(p.id) && Math.abs(balances[p.id] ?? 0) <= EPS && !isDeleted(p.id));
  const debts = computePairwiseDebts(expenses).filter((d) => getPerson(d.debtorId) && getPerson(d.creditorId));

  if (book.people.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">Add people to see balances</p>;
  }

  function BalanceCard(person: Person) {
    const bal = balances[person.id] ?? 0;
    const pos = bal > EPS;
    const neg = bal < -EPS;
    const me = userId === person.id;
    const deleted = isDeleted(person.id);
    const open = expandedPerson === person.id;
    const debtors = computeOwedToPerson(person.id, expenses);
    const displayTotal = debtors.reduce((s, d) => s + d.net, 0);
    const header = pos ? (displayTotal > EPS ? displayTotal : bal) : bal;

    return (
      <div
        className="rounded-2xl bg-card p-3.5"
        style={me ? { boxShadow: `inset 0 0 0 1px ${withAlpha(person.color, 0.3)}` } : undefined}
      >
        <div className="flex items-center gap-2">
          <button onClick={() => setExpandedPerson(open ? null : person.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <Avatar name={person.name} color={person.color} size={28} />
            <span className="truncate text-[13px] font-semibold">{deleted ? `${person.name} (deleted)` : person.name}</span>
            {me && <span className="text-[10px]" style={{ color: person.color }}>you</span>}
            <span className="flex-1" />
            <span className={`text-[13px] font-bold ${pos ? "text-accent" : neg ? "text-danger" : "text-dim"}`}>
              {pos ? "+" : ""}{money(book.currency, Math.abs(header))}
            </span>
            {open ? <ChevronUp size={15} className="text-dim" /> : <ChevronDown size={15} className="text-dim" />}
          </button>
          {deleted && person.isPlaceholder && (
            <button onClick={() => onClaim(person)} className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">claim</button>
          )}
        </div>
        {open && debtors.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {debtors.map((d) => {
              const debtor = getPerson(d.debtorId);
              const name = debtor ? (isDeleted(d.debtorId) ? `${debtor.name} (deleted)` : debtor.name) : "(deleted)";
              return (
                <div key={d.debtorId}>
                  <p className="text-[11px] text-dim">{name} owes from:</p>
                  <div className="mt-1 space-y-0.5 pl-2">
                    {d.receipts.map((r) => <LineRow key={r.expenseId} title={r.title} amount={r.amount} currency={book.currency} small />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader label="OWES" count={debts.length} expanded={owesOpen} onToggle={debts.length ? () => setOwesOpen((v) => !v) : undefined} />
        <div className="mt-2 space-y-2">
          {debts.length === 0 && <p className="py-2 text-[13px] text-muted">All settled up!</p>}
          {owesOpen && debts.map((d) => {
            const debtor = getPerson(d.debtorId)!;
            const creditor = getPerson(d.creditorId)!;
            const open = expandedPair === d.pairKey;
            const debtorIn = book.people.find((p) => p.id === d.debtorId) ?? debtor;
            const creditorIn = book.people.find((p) => p.id === d.creditorId) ?? creditor;
            const canSettle = userId === d.debtorId || debtorIn.isPlaceholder || creditorIn.isPlaceholder;
            return (
              <div key={d.pairKey} className="rounded-2xl bg-card p-3.5">
                {/* Mobile (<640px): names get their own full-width row so they're never squeezed to 1-2 chars */}
                <div className="sm:hidden">
                  <button onClick={() => setExpandedPair(open ? null : d.pairKey)} aria-expanded={open} className="flex w-full items-center gap-1.5 text-left">
                    <span className="flex min-w-0 shrink items-center gap-1.5">
                      <Avatar name={debtor.name} color={debtor.color} size={26} />
                      <span className="truncate text-[13px] font-semibold leading-none">{debtor.name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] leading-none text-muted">owes</span>
                    <span className="flex min-w-0 shrink items-center gap-1.5">
                      <Avatar name={creditor.name} color={creditor.color} size={26} />
                      <span className="truncate text-[13px] font-semibold leading-none">{creditor.name}</span>
                    </span>
                    <span className="flex-1" />
                    {open ? <ChevronUp size={15} className="shrink-0 text-dim" /> : <ChevronDown size={15} className="shrink-0 text-dim" />}
                  </button>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[13px] font-bold text-danger">{money(book.currency, d.net)}</span>
                    <span className="flex-1" />
                    {!creditorIn.isPlaceholder && (
                      <button
                        onClick={() => openPay(d.creditorId, creditor.name, d.net)}
                        aria-label={`Pay ${creditor.name}`}
                        title={`Pay ${creditor.name}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card2 text-accent transition hover:brightness-125"
                      >
                        <QrCode size={13} />
                      </button>
                    )}
                    {canSettle && (
                      <button
                        disabled={settling === d.pairKey}
                        onClick={async () => {
                          setSettling(d.pairKey);
                          try { await onSettle(d.debtorId, d.creditorId, d.net, d.debtorLines.map((l) => l.title)); }
                          finally { setSettling(null); }
                        }}
                        aria-label={`Mark ${debtor.name}'s payment to ${creditor.name} as settled`}
                        title="Mark as settled"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/15 text-accent disabled:opacity-40"
                      >
                        <Check size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop (≥640px): original single-row layout, plenty of width for names already */}
                <div className="hidden items-center gap-2 sm:flex">
                  <button onClick={() => setExpandedPair(open ? null : d.pairKey)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                    <Avatar name={debtor.name} color={debtor.color} size={28} />
                    <span className="truncate text-[13px] font-semibold leading-none">{debtor.name}</span>
                    <span className="px-1 text-xs leading-none text-muted">owes</span>
                    <Avatar name={creditor.name} color={creditor.color} size={28} />
                    <span className="truncate text-[13px] font-semibold leading-none">{creditor.name}</span>
                  </button>
                  {!creditorIn.isPlaceholder && (
                    <button
                      onClick={() => openPay(d.creditorId, creditor.name, d.net)}
                      aria-label={`Pay ${creditor.name}`}
                      title={`Pay ${creditor.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-card2 text-accent transition hover:brightness-125"
                    >
                      <QrCode size={13} />
                    </button>
                  )}
                  {canSettle && (
                    <button
                      disabled={settling === d.pairKey}
                      onClick={async () => {
                        setSettling(d.pairKey);
                        try { await onSettle(d.debtorId, d.creditorId, d.net, d.debtorLines.map((l) => l.title)); }
                        finally { setSettling(null); }
                      }}
                      aria-label={`Mark ${debtor.name}'s payment to ${creditor.name} as settled`}
                      title="Mark as settled"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-accent/15 text-accent disabled:opacity-40"
                    >
                      <Check size={13} />
                    </button>
                  )}
                  <span className="text-[13px] font-bold text-danger">{money(book.currency, d.net)}</span>
                  <button onClick={() => setExpandedPair(open ? null : d.pairKey)} aria-label="Toggle details" className="text-dim">
                    {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>

                {open && (
                  <div className="mt-2.5 space-y-1">
                    {d.debtorLines.length > 0 && (
                      <>
                        <p className="text-[11px] text-dim">{debtor.name} owes from:</p>
                        {d.debtorLines.map((l) => <LineRow key={l.expenseId} title={l.title} amount={l.amount} currency={book.currency} />)}
                      </>
                    )}
                    {d.creditorLines.length > 0 && (
                      <>
                        <p className="pt-1.5 text-[11px] text-dim">Less — {creditor.name} owes {debtor.name} for:</p>
                        {d.creditorLines.map((l) => <LineRow key={l.expenseId} title={l.title} amount={l.amount} currency={book.currency} negative />)}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {payFor && (
        <PaymentQrModal
          payeeName={payFor.creditorName}
          amount={payFor.amount}
          currency={book.currency}
          methods={methodsCache[payFor.creditorId]}
          onClose={() => setPayFor(null)}
        />
      )}

      {isOwed.length > 0 && (
        <div>
          <SectionHeader label="IS OWED" count={isOwed.length} expanded={owedOpen} onToggle={() => setOwedOpen((v) => !v)} />
          {owedOpen && <div className="mt-2 space-y-2">{isOwed.map((p) => <div key={p.id}>{BalanceCard(p)}</div>)}</div>}
        </div>
      )}

      {settled.length > 0 && (
        <div>
          <SectionHeader label="SETTLED" count={settled.length} expanded={settledOpen} onToggle={() => setSettledOpen((v) => !v)} />
          {settledOpen && <div className="mt-2 space-y-2">{settled.map((p) => <div key={p.id}>{BalanceCard(p)}</div>)}</div>}
        </div>
      )}

      {expenses.length === 0 && <p className="py-10 text-center text-[13px] text-muted">No expenses yet.</p>}
    </div>
  );
}
