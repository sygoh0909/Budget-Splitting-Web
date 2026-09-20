"use client";

import { useState } from "react";
import { ChevronDown, Percent, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import type { AdditionalCharge, ChargeType, Expense, ExpenseItem, Person } from "@/lib/types";
import { categories } from "@/lib/constants";
import { generateUuid, money, todayISO } from "@/lib/util";
import { chargesTotal, itemsTotal } from "@/lib/split";
import { Modal } from "./ui/Modal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { useToast } from "./ui/Toast";
import { PeopleSelect } from "./PeopleSelect";

interface ExpenseModalProps {
  /** active members of the book */
  people: Person[];
  /** removed members (kept so old expenses still resolve their names) */
  deletedPeople: Person[];
  currency: string;
  /** pass to edit an existing expense; omit to add a new one */
  initial?: Expense;
  onSave: (expense: Expense) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const newItem = (): ExpenseItem => ({
  id: generateUuid(),
  title: "",
  amount: 0,
  category: categories[0],
  splitWith: [],
});

const cleanNumber = (v: string, allowNegative = false) => {
  const re = allowNegative ? /[^0-9.\-]/g : /[^0-9.]/g;
  return v.replace(re, "");
};

/* ── Charge dialog: pick a type, then enter its value ────────────────────── */

const CHARGE_OPTIONS: { type: ChargeType; label: string }[] = [
  { type: "tax", label: "Tax (SST / GST)" },
  { type: "service_tax", label: "Service Tax" },
  { type: "rounding", label: "Rounding Adjustment" },
];

function ChargeDialog({ currency, onAdd, onClose }: { currency: string; onAdd: (c: AdditionalCharge) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<{ type: ChargeType; label: string } | null>(null);
  const [value, setValue] = useState("");
  const isRounding = picked?.type === "rounding";
  const parsed = parseFloat(value);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked || Number.isNaN(parsed)) return;
    onAdd({ id: generateUuid(), type: picked.type, label: picked.label, value: parsed, isPercentage: !isRounding });
  }

  return (
    <Modal open onClose={onClose} labelledBy="charge-title">
      {!picked ? (
        <div className="p-6">
          <h2 id="charge-title" className="text-[15px] font-bold">Add Additional Charge</h2>
          <div className="mt-4 space-y-2">
            {CHARGE_OPTIONS.map((o) => (
              <button
                key={o.type}
                onClick={() => setPicked(o)}
                className="flex w-full items-center gap-3 rounded-xl bg-card2 px-4 py-3 text-left text-[13px] transition hover:brightness-125"
              >
                {o.type === "rounding" ? <SlidersHorizontal size={16} className="text-accent" /> : <Percent size={16} className="text-accent" />}
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="p-6">
          <h2 id="charge-title" className="text-[15px] font-semibold">{picked.label}</h2>
          <div className="relative mt-4">
            <input
              autoFocus
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(cleanNumber(e.target.value, true))}
              placeholder={isRounding ? "Amount (e.g. 0.02 or -0.01)" : "Percentage (e.g. 6, 10)"}
              aria-label={isRounding ? "Rounding amount" : "Percentage"}
              className="field pr-14"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-accent">
              {isRounding ? currency : "%"}
            </span>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-secondary !py-2" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={Number.isNaN(parsed)} className="rounded-xl px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-40">
              Add
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ChargeRow({ charge, onChange, onRemove, currency }: { charge: AdditionalCharge; onChange: (v: number) => void; onRemove: () => void; currency: string }) {
  const [text, setText] = useState(String(charge.value));
  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-card2 px-3 py-2">
      {charge.isPercentage ? <Percent size={12} className="text-muted" /> : <SlidersHorizontal size={12} className="text-muted" />}
      <span className="min-w-0 flex-1 truncate text-xs">{charge.label}</span>
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const t = cleanNumber(e.target.value, true);
          setText(t);
          const n = parseFloat(t);
          if (!Number.isNaN(n)) onChange(n);
        }}
        aria-label={`${charge.label} value`}
        className="w-16 bg-transparent text-right text-xs font-semibold text-accent outline-none"
      />
      <span className="w-5 text-[11px] text-accent">{charge.isPercentage ? "%" : currency}</span>
      <button onClick={onRemove} aria-label={`Remove ${charge.label}`} className="text-dim transition hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
}

/* ── One line item ───────────────────────────────────────────────────────── */

function ItemRow({
  item, people, deletedPeople, currency, canDelete, onChange, onDelete, index,
}: {
  item: ExpenseItem;
  people: Person[];
  deletedPeople: Person[];
  currency: string;
  canDelete: boolean;
  onChange: (i: ExpenseItem) => void;
  onDelete: () => void;
  index: number;
}) {
  const [amountText, setAmountText] = useState(item.amount > 0 ? String(item.amount) : "");
  const perPerson = item.splitWith.length > 0 && item.amount > 0 ? item.amount / item.splitWith.length : 0;

  return (
    <div className="rounded-2xl bg-card2 p-3">
      <div className="flex items-center gap-2">
        <input
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
          placeholder="Item name..."
          aria-label={`Item ${index + 1} name`}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <span className="text-[13px] text-muted">{currency}</span>
        <input
          inputMode="decimal"
          value={amountText}
          onChange={(e) => {
            const t = cleanNumber(e.target.value);
            setAmountText(t);
            onChange({ ...item, amount: parseFloat(t) || 0 });
          }}
          placeholder="0"
          aria-label={`Item ${index + 1} amount`}
          className="w-[72px] bg-transparent text-right text-sm font-semibold outline-none"
        />
        {canDelete && (
          <button onClick={onDelete} aria-label={`Delete item ${index + 1}`} className="text-dim transition hover:text-danger">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {people.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-dim">Split</span>
          <div className="min-w-0 flex-1">
            <PeopleSelect
              people={people}
              extraPeople={deletedPeople}
              value={item.splitWith}
              onChange={(splitWith) => onChange({ ...item, splitWith })}
              placeholder="Select people"
              ariaLabel={`Who is item ${index + 1} split between`}
            />
          </div>
          {perPerson > 0 && <span className="shrink-0 text-[11px] text-accent">{money(currency, perPerson)} each</span>}
        </div>
      )}
      {people.length > 0 && item.splitWith.length === 0 && (
        <p className="mt-1.5 pl-[52px] text-[10px] text-warn">Select at least one person</p>
      )}
    </div>
  );
}

/* ── The form ────────────────────────────────────────────────────────────── */

export function ExpenseModal({ people, deletedPeople, currency, initial, onSave, onDelete, onClose }: ExpenseModalProps) {
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? people[0]?.id ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [items, setItems] = useState<ExpenseItem[]>(initial ? initial.items.map((i) => ({ ...i, splitWith: [...i.splitWith] })) : [newItem()]);
  const [charges, setCharges] = useState<AdditionalCharge[]>(initial?.additionalCharges ?? []);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const draft: Expense = {
    id: initial?.id ?? "",
    title, date, paidBy,
    items,
    additionalCharges: charges,
    note: null,
    hasReceipt: initial?.hasReceipt ?? false,
  };
  const total = itemsTotal(draft) + chargesTotal(draft);
  const allPeople = [...people, ...deletedPeople];
  const paidByPerson = allPeople.find((p) => p.id === paidBy);
  const paidByIsRemoved = !!paidBy && !people.some((p) => p.id === paidBy);
  const canSave = title.trim() !== "" && items.length > 0 && items.every((i) => i.title.trim() !== "");

  const updateItem = (idx: number, next: ExpenseItem) => setItems((prev) => prev.map((it, i) => (i === idx ? next : it)));

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? generateUuid(),
        title: title.trim(),
        date,
        paidBy,
        items,
        additionalCharges: charges,
        note: note.trim() === "" ? null : note.trim(),
        hasReceipt: initial?.hasReceipt ?? false,
      });
      onClose();
    } catch (err) {
      console.error(err);
      toast("Couldn't save the expense. Please try again.", "error");
      setSaving(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    try {
      await onDelete?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast("Couldn't delete the expense. Please try again.", "error");
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" labelledBy="expense-title">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-card2 px-6 pb-4 pt-5">
        <h2 id="expense-title" className="text-[17px] font-bold">{initial ? "Edit Expense" : "New Expense"}</h2>
        <div className="flex items-center gap-4">
          {initial && onDelete && (
            <button onClick={() => setConfirmDelete(true)} aria-label="Delete expense" className="text-danger transition hover:brightness-125">
              <Trash2 size={20} />
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="text-[#666] transition hover:text-white">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <div>
          <label htmlFor="exp-title" className="label">Title</label>
          <input
            id="exp-title"
            autoFocus={!initial}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dinner at Ichiran"
            className="field mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="exp-date" className="label">Date</label>
            <input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field mt-1.5 !text-[13px]" />
          </div>
          {people.length > 0 && (
            <div>
              <label htmlFor="exp-paidby" className="label">Paid by</label>
              <div className="relative mt-1.5">
                <select
                  id="exp-paidby"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="field w-full appearance-none !pr-9 !text-[13px]"
                >
                  {paidByIsRemoved && <option value={paidBy}>{paidByPerson ? `${paidByPerson.name} (deleted)` : "(deleted)"}</option>}
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Items</span>
            {total > 0 && <span className="text-xs font-bold text-accent">{money(currency, total)} total</span>}
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <ItemRow
                key={item.id}
                index={idx}
                item={item}
                people={people}
                deletedPeople={deletedPeople}
                currency={currency}
                canDelete={items.length > 1}
                onChange={(next) => updateItem(idx, next)}
                onDelete={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
              />
            ))}
          </div>

          <div className="mt-1 flex gap-5">
            <button onClick={() => setItems((prev) => [...prev, newItem()])} className="flex items-center gap-2 py-2 text-[13px] text-accent">
              <Plus size={14} /> Add item
            </button>
            <button onClick={() => setChargeOpen(true)} className="flex items-center gap-1.5 py-2 text-[13px] text-accent">
              <Percent size={14} /> Add charges
            </button>
          </div>

          {charges.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {charges.map((c, idx) => (
                <ChargeRow
                  key={c.id}
                  charge={c}
                  currency={currency}
                  onChange={(value) => setCharges((prev) => prev.map((x, i) => (i === idx ? { ...x, value } : x)))}
                  onRemove={() => setCharges((prev) => prev.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
          )}
        </div>

        {paidByPerson && total > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-card2 px-4 py-2.5 text-[13px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: paidByPerson.color }} />
            <span>
              <span className="font-semibold" style={{ color: paidByPerson.color }}>{paidByPerson.name}</span>
              <span className="text-muted"> paid {money(currency, total)} in total</span>
            </span>
          </div>
        )}

        <div>
          <label htmlFor="exp-note" className="label">Note (optional)</label>
          <input id="exp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note..." className="field mt-1.5 !text-sm" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-3 px-6 pb-6 pt-2">
        <button onClick={onClose} className="btn-secondary flex-1 !py-3.5">Cancel</button>
        <button onClick={handleSave} disabled={!canSave || saving} className="btn-primary flex-1 !rounded-xl !py-3.5">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {chargeOpen && (
        <ChargeDialog
          currency={currency}
          onClose={() => setChargeOpen(false)}
          onAdd={(c) => {
            setCharges((prev) => [...prev, c]);
            setChargeOpen(false);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete expense?"
        message="This expense will be permanently removed."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </Modal>
  );
}
