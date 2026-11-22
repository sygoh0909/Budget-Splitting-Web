"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Banknote, CalendarDays, Check, FileSpreadsheet, FileText, History, ReceiptText, X } from "lucide-react";
import type { Book, Expense } from "@/lib/types";
import {
  RANGE_PRESETS,
  PDF_MIME,
  XLSX_MIME,
  buildHistoryPdf,
  buildHistoryXlsx,
  computeBalanceHistory,
  downloadFile,
  historyFileName,
  presetRange,
  rangeLabel,
  signedMoney,
  type DateRange,
  type HistoryFormat,
} from "@/lib/history";
import { EPS } from "@/lib/split";
import { money } from "@/lib/util";
import { Avatar } from "./ui/Avatar";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";

interface Props {
  book: Book;
  expenses: Expense[];
  /** the signed-in person: they only ever see balances they are part of */
  userId: string;
  onClose: () => void;
}

const chip = (selected: boolean) =>
  `rounded-[10px] px-3 py-1.5 text-[11px] transition ${selected ? "bg-accent font-bold text-white" : "bg-card2 text-muted hover:brightness-125"}`;

export function BalanceHistoryModal({ book, expenses, userId, onClose }: Props) {
  const toast = useToast();
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [busy, setBusy] = useState<HistoryFormat | null>(null);

  const invalid = !!range.from && !!range.to && range.from > range.to;
  const history = useMemo(() => computeBalanceHistory(expenses, range, userId), [expenses, range, userId]);
  const cur = book.currency;

  const getPerson = (id: string) => book.people.find((p) => p.id === id) ?? book.deletedPeople.find((p) => p.id === id);
  const label = (id: string) => {
    const p = getPerson(id);
    if (!p) return "Unknown";
    return book.people.some((x) => x.id === id) ? p.name : `${p.name} (deleted)`;
  };

  const activePreset = RANGE_PRESETS.find((p) => {
    const r = presetRange(p.id);
    return r.from === range.from && r.to === range.to;
  })?.id;

  const canDownload = !invalid && history.pairs.length > 0;

  async function download(format: HistoryFormat) {
    if (busy) return;
    setBusy(format);
    try {
      const fileName = historyFileName(book, range, format);
      const data = format === "xlsx" ? await buildHistoryXlsx(book, history, userId) : await buildHistoryPdf(book, history, userId);
      downloadFile(fileName, data, format === "xlsx" ? XLSX_MIME : PDF_MIME);
      toast(`Saved ${fileName}`);
    } catch (e) {
      console.error(e);
      toast(`Couldn't create the ${format === "xlsx" ? "Excel" : "PDF"} file. Please try again.`, "error");
    } finally {
      setBusy(null);
    }
  }

  const dateInput = (which: "from" | "to", text: string) => {
    const val = range[which];
    return (
      <label className={`flex flex-1 items-center gap-2 rounded-[10px] px-3 py-2 text-xs ${val ? "border border-accent/30 bg-accent/10 text-accent" : "bg-card2 text-muted"}`}>
        <CalendarDays size={12} />
        <input
          type="date"
          aria-label={`${text} date`}
          value={val}
          onChange={(e) => setRange((r) => ({ ...r, [which]: e.target.value }))}
          className="w-full min-w-0 bg-transparent text-xs outline-none"
        />
      </label>
    );
  };

  return (
    <Modal open onClose={onClose} size="lg" labelledBy="history-title">
      <div className="flex items-center justify-between border-b border-card2 px-6 pb-4 pt-5">
        <h2 id="history-title" className="flex items-center gap-2 text-[17px] font-bold">
          <History size={18} className="text-accent" /> My balance history
        </h2>
        <button onClick={onClose} aria-label="Close" className="text-[#666] transition hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {/* Date filter */}
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-muted">DATE RANGE</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RANGE_PRESETS.map((p) => (
              <button key={p.id} onClick={() => setRange(presetRange(p.id))} className={chip(activePreset === p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {dateInput("from", "From")}
            <ArrowRight size={12} className="shrink-0 text-dim" />
            {dateInput("to", "To")}
          </div>
          {invalid ? (
            <p role="alert" className="mt-2 text-[11px] text-danger">“From” is after “To” — pick an earlier start date.</p>
          ) : (
            <p className="mt-2 text-[11px] text-dim">Showing {rangeLabel(range)}, including debts that are already settled.</p>
          )}
        </div>

        {/* Same "A owes B" cards as the Balances tab, with the transactions below */}
        {!invalid && history.pairs.length === 0 && (
          <div className="py-10 text-center">
            <History size={40} className="mx-auto text-dim" />
            <p className="mt-3 font-semibold">Nothing in this period</p>
            <p className="mt-1 text-[13px] text-muted">Try a wider date range.</p>
          </div>
        )}

        {!invalid &&
          history.pairs.map((p) => {
            const debtor = getPerson(p.debtorId);
            const creditor = getPerson(p.creditorId);
            return (
              <div key={p.pairKey} className="rounded-2xl bg-card2/60 p-3.5 ring-1 ring-line">
                <div className="flex items-center gap-1.5">
                  <Avatar name={debtor?.name ?? "?"} color={debtor?.color ?? "#48484a"} size={26} />
                  <span className="min-w-0 truncate text-[13px] font-semibold">{label(p.debtorId)}</span>
                  <span className="shrink-0 text-[11px] text-muted">owes</span>
                  <Avatar name={creditor?.name ?? "?"} color={creditor?.color ?? "#48484a"} size={26} />
                  <span className="min-w-0 truncate text-[13px] font-semibold">{label(p.creditorId)}</span>
                  <span className="flex-1" />
                  {p.isSettled ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      <Check size={10} /> Settled
                    </span>
                  ) : (
                    <span className="shrink-0 text-[13px] font-bold text-danger">{money(cur, p.closing)}</span>
                  )}
                </div>

                <div className="mt-2.5 space-y-1">
                  {Math.abs(p.opening) > EPS && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <ReceiptText size={10} className="shrink-0 text-dim" />
                      <span className="min-w-0 flex-1 truncate text-muted">Brought forward</span>
                      <span className="text-danger">{signedMoney(cur, p.opening)}</span>
                    </div>
                  )}
                  {p.lines.map((l, i) => (
                    <div key={`${l.expenseId}-${i}`} className="flex items-center gap-1.5 text-[11px]">
                      {l.isSettlement ? <Banknote size={10} className="shrink-0 text-accent" /> : <ReceiptText size={10} className="shrink-0 text-dim" />}
                      <span className="min-w-0 flex-1 truncate text-muted">{l.title}</span>
                      <span className={l.amount < 0 ? "text-accent" : "text-danger"}>{signedMoney(cur, l.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      <div className="flex gap-2 border-t border-card2 p-4">
        <button onClick={() => download("xlsx")} disabled={!canDownload || !!busy} className="btn-secondary flex-1 !py-2.5">
          <FileSpreadsheet size={15} /> {busy === "xlsx" ? "Saving…" : "Download Excel"}
        </button>
        <button onClick={() => download("pdf")} disabled={!canDownload || !!busy} className="btn-primary flex-1 !py-2.5">
          <FileText size={15} /> {busy === "pdf" ? "Saving…" : "Download PDF"}
        </button>
      </div>
    </Modal>
  );
}
