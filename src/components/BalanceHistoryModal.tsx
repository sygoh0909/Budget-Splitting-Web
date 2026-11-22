"use client";

import { useMemo, useState } from "react";
import { Banknote, Check, FileSpreadsheet, FileText, History, ReceiptText, X } from "lucide-react";
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
  `rounded-lg px-2.5 py-1.5 text-[11px] transition ${selected ? "bg-accent font-bold text-white" : "bg-card2 text-muted hover:brightness-125"}`;

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
      <label className="block min-w-0">
        <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-muted">{text}</span>
        <input
          type="date"
          aria-label={`${text} date`}
          value={val}
          onChange={(e) => setRange((r) => ({ ...r, [which]: e.target.value }))}
          className={`block w-full min-w-0 rounded-lg px-2 py-1 text-xs outline-none ${val ? "border border-accent/30 bg-accent/10 text-accent" : "bg-card2 text-muted"}`}
        />
      </label>
    );
  };

  return (
    <Modal open onClose={onClose} size="sm" labelledBy="history-title">
      <div className="flex max-h-[85dvh] min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-card2 px-4 pb-3 pt-4">
        <h2 id="history-title" className="flex items-center gap-1.5 text-[14px] font-bold">
          <History size={15} className="text-accent" /> My balance history
        </h2>
        <button onClick={onClose} aria-label="Close" className="-m-2 p-2 text-[#666] transition hover:text-white">
          <X size={17} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-4">
        {/* Date filter */}
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-muted">DATE RANGE</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {RANGE_PRESETS.map((p) => (
              <button key={p.id} onClick={() => setRange(presetRange(p.id))} className={chip(activePreset === p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-2">
            {dateInput("from", "From")}
            {dateInput("to", "To")}
          </div>
          {invalid ? (
            <p role="alert" className="mt-1.5 text-[10px] text-danger">“From” is after “To” — pick an earlier start date.</p>
          ) : (
            <p className="mt-1.5 text-[10px] text-dim">Showing {rangeLabel(range)}, including debts that are already settled.</p>
          )}
        </div>

        {/* Same "A owes B" cards as the Balances tab, with the transactions below */}
        {!invalid && history.pairs.length === 0 && (
          <div className="py-6 text-center">
            <History size={30} className="mx-auto text-dim" />
            <p className="mt-2 text-[13px] font-semibold">Nothing in this period</p>
            <p className="mt-0.5 text-[11px] text-muted">Try a wider date range.</p>
          </div>
        )}

        {!invalid &&
          history.pairs.map((p) => {
            const debtor = getPerson(p.debtorId);
            const creditor = getPerson(p.creditorId);
            return (
              <div key={p.pairKey} className="rounded-xl bg-card2/60 p-3 ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <div className="flex min-w-0 flex-auto flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className="flex min-w-0 max-w-full items-center gap-1.5">
                      <Avatar name={debtor?.name ?? "?"} color={debtor?.color ?? "#48484a"} size={22} />
                      <span className="min-w-0 truncate text-xs font-semibold">{label(p.debtorId)}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">owes</span>
                    <span className="flex min-w-0 max-w-full items-center gap-1.5">
                      <Avatar name={creditor?.name ?? "?"} color={creditor?.color ?? "#48484a"} size={22} />
                      <span className="min-w-0 truncate text-xs font-semibold">{label(p.creditorId)}</span>
                    </span>
                  </div>
                  {p.isSettled ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                      <Check size={9} /> Settled
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-bold text-danger">{money(cur, p.closing)}</span>
                  )}
                </div>

                <div className="mt-2 space-y-1">
                  {Math.abs(p.opening) > EPS && (
                    <div className="flex items-start gap-1.5 text-[11px]">
                      <ReceiptText size={10} className="mt-[2px] shrink-0 text-dim" />
                      <span className="min-w-0 flex-1 break-words leading-snug text-muted">Brought forward</span>
                      <span className="shrink-0 whitespace-nowrap pl-2 text-danger">{signedMoney(cur, p.opening)}</span>
                    </div>
                  )}
                  {p.lines.map((l, i) => (
                    <div key={`${l.expenseId}-${i}`} className="flex items-start gap-1.5 text-[11px]">
                      {l.isSettlement ? <Banknote size={10} className="mt-[2px] shrink-0 text-accent" /> : <ReceiptText size={10} className="mt-[2px] shrink-0 text-dim" />}
                      <span className="min-w-0 flex-1 break-words leading-snug text-muted">{l.title}</span>
                      <span className={`shrink-0 whitespace-nowrap pl-2 ${l.amount < 0 ? "text-accent" : "text-danger"}`}>{signedMoney(cur, l.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      <div className="border-t border-card2 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="mb-1.5 text-[9px] font-semibold tracking-widest text-muted sm:hidden">DOWNLOAD</p>
        <div className="flex gap-2">
          <button onClick={() => download("xlsx")} disabled={!canDownload || !!busy} className="btn-secondary min-w-0 flex-1 !gap-1.5 !rounded-xl !px-3 !py-2 !text-[13px]">
            <FileSpreadsheet size={14} className="shrink-0" />
            <span className="truncate">{busy === "xlsx" ? "Saving…" : (<><span className="sm:hidden">Excel</span><span className="hidden sm:inline">Download Excel</span></>)}</span>
          </button>
          <button onClick={() => download("pdf")} disabled={!canDownload || !!busy} className="btn-primary min-w-0 flex-1 !gap-1.5 !rounded-xl !px-3 !py-2 !text-[13px]">
            <FileText size={14} className="shrink-0" />
            <span className="truncate">{busy === "pdf" ? "Saving…" : (<><span className="sm:hidden">PDF</span><span className="hidden sm:inline">Download PDF</span></>)}</span>
          </button>
        </div>
      </div>
      </div>
    </Modal>
  );
}
