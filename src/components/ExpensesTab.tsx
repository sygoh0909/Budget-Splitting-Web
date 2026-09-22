"use client";

import { useRef, useState } from "react";
import { AlertCircle, ArrowRight, Banknote, CalendarDays, Camera, ChevronDown, ChevronUp, FilterX, Plus, Receipt, SlidersHorizontal, Trash2 } from "lucide-react";
import type { Book, Expense } from "@/lib/types";
import { expenseDisplayTitle, expenseTotal, isSettlement } from "@/lib/split";
import { categoryIcons } from "@/lib/constants";
import { formatDate, money, monthName, todayISO, withAlpha, firstLetter } from "@/lib/util";
import { ConfirmDialog } from "./ui/ConfirmDialog";

interface Props {
  book: Book;
  expenses: Expense[];
  onAdd: () => void;
  onScan: (file: File) => void;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => Promise<void>;
}

type FilterType = "all" | "receipts" | "settlements";

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] tracking-wider text-dim">{label}</span>
      <span className="rounded-full bg-card2 px-1.5 py-px text-[10px] text-muted">{count}</span>
    </div>
  );
}

export function ExpensesTab({ book, expenses, onAdd, onScan, onEdit, onDelete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterPeople, setFilterPeople] = useState<string[]>([]);
  const [filterMonth, setFilterMonth] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  const getPerson = (id: string) => book.people.find((p) => p.id === id) ?? book.deletedPeople.find((p) => p.id === id);
  const isDeleted = (id: string) => book.deletedPeople.some((p) => p.id === id);

  const byDate = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  const hasAnyFilter = filterPeople.length > 0 || !!filterMonth || !!dateFrom || !!dateTo || filterType !== "all";
  const activeFilters = (filterPeople.length ? 1 : 0) + (filterMonth ? 1 : 0) + (dateFrom || dateTo ? 1 : 0) + (filterType !== "all" ? 1 : 0);

  function passes(e: Expense) {
    if (filterPeople.length && !filterPeople.includes(e.paidBy) && !e.items.some((i) => i.splitWith.some((p) => filterPeople.includes(p)))) return false;
    if (filterMonth && !e.date.startsWith(filterMonth)) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  }

  const receipts = filterType === "settlements" ? [] : byDate.filter((e) => !isSettlement(e) && passes(e));
  const settlements = filterType === "receipts" ? [] : byDate.filter((e) => isSettlement(e) && passes(e));
  const totalSpend = expenses.filter((e) => !isSettlement(e)).reduce((s, e) => s + expenseTotal(e), 0);
  const allMonths = Array.from(new Set(byDate.map((e) => e.date.slice(0, 7)))).sort((a, b) => b.localeCompare(a));

  const clearFilters = () => {
    setFilterPeople([]); setFilterMonth(""); setDateFrom(""); setDateTo(""); setFilterType("all");
  };

  function renderCard(expense: Expense) {
    const payer = getPerson(expense.paidBy);
    const open = expandedId === expense.id;
    const unassigned = !isSettlement(expense) && expense.items.some((i) => i.splitWith.length === 0);
    return (
      <div className="overflow-hidden rounded-2xl bg-card">
        <button
          onClick={() => setExpandedId(open ? null : expense.id)}
          aria-expanded={open}
          className="flex w-full items-start gap-3 p-3.5 text-left"
        >
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-card2">
            {expense.hasReceipt ? (
              <Receipt size={16} className={unassigned ? "text-warn" : "text-accent"} />
            ) : (
              <Banknote size={16} className="text-muted" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold">{expenseDisplayTitle(expense)}</span>
              <span className="text-sm font-bold text-accent">{money(book.currency, expenseTotal(expense))}</span>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] text-dim">{expense.date}</span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: withAlpha(payer?.color ?? "#48484a", 0.12), color: payer?.color ?? "#48484a" }}
              >
                {!payer ? "(deleted)" : isDeleted(expense.paidBy) ? `${payer.name} (deleted)` : payer.name}
              </span>
              <span className="text-[11px] text-dim">
                {expense.items.length} item{expense.items.length !== 1 ? "s" : ""}
              </span>
              {unassigned && (
                <span className="flex items-center gap-0.5 text-[10px] text-warn">
                  <AlertCircle size={10} /> unassigned
                </span>
              )}
            </span>
          </span>
          {open ? <ChevronUp size={15} className="mt-1 text-dim" /> : <ChevronDown size={15} className="mt-1 text-dim" />}
        </button>

        {open && (
          <div className="border-t border-line p-3.5">
            <div className="space-y-2">
              {expense.items.map((item) => {
                const per = item.splitWith.length > 0 ? item.amount / item.splitWith.length : 0;
                return (
                  <div key={item.id} className="rounded-xl bg-card2 p-2.5">
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                        {(() => { const CIcon = categoryIcons[item.category] ?? categoryIcons.Misc; return <CIcon size={13} className="shrink-0 text-dim" aria-hidden />; })()}
                        <span className="truncate">{item.title}</span>
                      </span>
                      <span className="font-semibold text-[#aaa]">{money(book.currency, item.amount)}</span>
                    </div>
                    {item.splitWith.length > 0 ? (
                      <p className="mt-1 text-[11px] text-muted">
                        {item.splitWith.map((pid, i) => {
                          const p = getPerson(pid);
                          const name = p ? (isDeleted(pid) ? `${p.name} (deleted)` : p.name) : "(deleted)";
                          return (
                            <span key={pid}>
                              {i > 0 && ", "}
                              <span style={{ color: p?.color ?? "#48484a" }}>{name}</span>
                            </span>
                          );
                        })}
                        {per > 0 && <span> · {money(book.currency, per)} each</span>}
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-warn">Not assigned</p>
                    )}
                  </div>
                );
              })}
            </div>
            {expense.note && <p className="mt-2 text-xs italic text-muted">“{expense.note}”</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={() => onEdit(expense)} className="rounded-xl bg-card2 px-3 py-1.5 text-xs">Edit</button>
              <button onClick={() => setToDelete(expense)} className="flex items-center gap-1 rounded-xl bg-danger/10 px-3 py-1.5 text-xs text-danger">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const chip = (selected: boolean) =>
    `rounded-[10px] px-3 py-1.5 text-[11px] transition ${selected ? "bg-accent font-bold text-white" : "bg-card2 text-muted hover:brightness-125"}`;

  return (
    <div>
      <div className="py-2 text-right text-base font-bold text-accent">{money(book.currency, totalSpend)} total</div>

      <div className="flex gap-2">
        <button onClick={onAdd} className="btn-primary flex-1 !rounded-2xl !py-2.5 !text-sm">
          <Plus size={16} /> Add Expense
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          data-testid="receipt-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ""; // allow re-picking the same photo
            if (f) onScan(f);
          }}
        />
        <button onClick={() => fileRef.current?.click()} aria-label="Scan receipt" title="Scan receipt" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-muted transition hover:brightness-125">
          <Camera size={16} />
        </button>
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Filters"
          aria-expanded={showFilters}
          className={`relative flex h-10 w-10 items-center justify-center rounded-2xl ${
            activeFilters > 0 ? "border border-accent/25 bg-accent/10 text-accent" : "bg-card text-muted"
          }`}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {showFilters && (
        <div className="mt-3 rounded-2xl border border-accent/15 bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] font-bold text-accent"><SlidersHorizontal size={14} /> Filters</span>
            {hasAnyFilter && (
              <button onClick={clearFilters} className="rounded-[10px] bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger">Clear all</button>
            )}
          </div>

          <p className="mt-4 text-[10px] font-semibold tracking-widest text-muted">TYPE</p>
          <div className="mt-2 flex gap-1.5">
            {([["all", "All"], ["receipts", "Receipts"], ["settlements", "Settlements"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setFilterType(v)} className={chip(filterType === v)}>{label}</button>
            ))}
          </div>

          <p className="mt-4 text-[10px] font-semibold tracking-widest text-muted">DATE RANGE</p>
          <div className="mt-2 flex items-center gap-2">
            {[["From", dateFrom, setDateFrom], ["To", dateTo, setDateTo]].map(([label, val, set], i) => (
              <div key={label as string} className="flex flex-1 items-center gap-2">
                {i === 1 && <ArrowRight size={12} className="text-dim" />}
                <label className={`flex flex-1 items-center gap-2 rounded-[10px] px-3 py-2 text-xs ${val ? "border border-accent/30 bg-accent/10 text-accent" : "bg-card2 text-muted"}`}>
                  <CalendarDays size={12} />
                  <input
                    type="date"
                    aria-label={`${label as string} date`}
                    max={todayISO()}
                    value={val as string}
                    onChange={(e) => (set as (v: string) => void)(e.target.value)}
                    className="w-full min-w-0 bg-transparent text-xs outline-none"
                  />
                </label>
              </div>
            ))}
          </div>

          {allMonths.length > 1 && (
            <>
              <p className="mt-4 text-[10px] font-semibold tracking-widest text-muted">MONTH</p>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {allMonths.map((m) => {
                  const [y, mo] = m.split("-");
                  const label = monthName(parseInt(mo, 10)) + (y !== String(new Date().getFullYear()) ? ` ${y}` : "");
                  return (
                    <button key={m} onClick={() => setFilterMonth(filterMonth === m ? "" : m)} className={`${chip(filterMonth === m)} shrink-0`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {book.people.length > 1 && (
            <>
              <p className="mt-4 text-[10px] font-semibold tracking-widest text-muted">PERSON</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {book.people.map((p) => {
                  const sel = filterPeople.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setFilterPeople((prev) => (sel ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}
                      aria-pressed={sel}
                      className="flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-xs"
                      style={{
                        background: sel ? withAlpha(p.color, 0.15) : "#2c2c2e",
                        borderColor: sel ? withAlpha(p.color, 0.5) : "transparent",
                        color: sel ? p.color : "#8e8e93",
                      }}
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: withAlpha(p.color, 0.2), color: p.color }}>
                        {firstLetter(p.name)}
                      </span>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {byDate.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt size={48} className="mx-auto text-dim" />
            <p className="mt-4 font-semibold">No expenses yet</p>
            <p className="mt-1 text-[13px] text-muted">Add an expense or scan a receipt</p>
          </div>
        ) : receipts.length === 0 && settlements.length === 0 ? (
          <div className="py-16 text-center">
            <FilterX size={48} className="mx-auto text-dim" />
            <p className="mt-4 font-semibold">No matches</p>
            <p className="mt-1 text-[13px] text-muted">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {receipts.length > 0 && (
              <>
                {filterType === "all" && <SectionHeader label="RECEIPTS" count={receipts.length} />}
                {receipts.map((e) => <div key={e.id}>{renderCard(e)}</div>)}
              </>
            )}
            {settlements.length > 0 && (
              <>
                {filterType === "all" && <div className="pt-2"><SectionHeader label="SETTLEMENTS" count={settlements.length} /></div>}
                {settlements.map((e) => <div key={e.id}>{renderCard(e)}</div>)}
              </>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete expense?"
        message="This expense will be permanently removed."
        confirmLabel="Delete"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const id = toDelete!.id;
          setToDelete(null);
          setExpandedId(null);
          await onDelete(id);
        }}
      />
    </div>
  );
}
