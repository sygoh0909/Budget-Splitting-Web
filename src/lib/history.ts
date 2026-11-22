import type { Book, Expense } from "./types";
import { EPS, expenseDisplayTitle, isSettlement, itemFraction, itemTotalWithCharges } from "./split";
import { formatDate, money, todayISO } from "./util";

/* ─────────────────────────────────────────────────────────────────────────────
 * Balance history — look back at what people owed (and what has since been settled)
 * over any date range.
 *
 * The live Balances tab only shows what is *still* outstanding, because a settlement
 * retires the debt it paid off. This module replays the expense log up to a chosen end
 * date instead, so a debt that was settled last month is still visible when you look at
 * last month.
 *
 * Sign convention for pair figures: every number is expressed from the point of view of
 * the pair's "debtor", so + means the debtor owes more, − means they owe less.
 * ────────────────────────────────────────────────────────────────────────── */

/** "" means unbounded on that side. Dates are YYYY-MM-DD, compared as strings. */
export interface DateRange {
  from: string;
  to: string;
}

export interface PairLine {
  expenseId: string;
  date: string;
  title: string;
  /** + adds to what the debtor owes, − reduces it (settlements) */
  amount: number;
  isSettlement: boolean;
}

export interface PairHistory {
  pairKey: string;
  debtorId: string;
  creditorId: string;
  /** what the debtor owed before the range started */
  opening: number;
  /** what the debtor owes at the end of the range (0 once settled) */
  closing: number;
  /** expenses and settlements inside the range, oldest first */
  lines: PairLine[];
  isSettled: boolean;
}

export interface BalanceHistory {
  range: DateRange;
  /** only the pairs the chosen person is part of */
  pairs: PairHistory[];
}

/**
 * One person's history: every pair they are in (as debtor or creditor) that had any
 * activity or balance in the range — including pairs that have since been settled.
 */
export function computeBalanceHistory(expenses: Expense[], range: DateRange, personId: string): BalanceHistory {
  const upToEnd = expenses
    .filter((e) => !range.to || e.date <= range.to)
    .sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : Number(isSettlement(a)) - Number(isSettlement(b))));

  interface Acc {
    p: string;
    q: string;
    opening: number;
    lines: PairLine[];
  }
  const accs = new Map<string, Acc>();

  for (const e of upToEnd) {
    const settle = isSettlement(e);
    const owedToPayer = new Map<string, number>();
    for (const item of e.items) {
      if (item.splitWith.length === 0) continue;
      const total = itemTotalWithCharges(e, item.amount);
      for (const pid of item.splitWith) {
        if (pid === e.paidBy) continue;
        owedToPayer.set(pid, (owedToPayer.get(pid) ?? 0) + total * itemFraction(item, pid));
      }
    }
    for (const [pid, amount] of owedToPayer) {
      if (amount <= 0) continue;
      // only the viewer's own pairs
      if (pid !== personId && e.paidBy !== personId) continue;
      const [p, q] = [pid, e.paidBy].sort();
      const key = `${p}_${q}`;
      // + means p owes q. A settlement is an expense in the other direction, so it nets off naturally.
      const signed = (pid === p ? 1 : -1) * amount;
      let acc = accs.get(key);
      if (!acc) accs.set(key, (acc = { p, q, opening: 0, lines: [] }));
      if (range.from && e.date < range.from) acc.opening += signed;
      else acc.lines.push({ expenseId: e.id, date: e.date, title: expenseDisplayTitle(e), amount: signed, isSettlement: settle });
    }
  }

  const pairs: PairHistory[] = [];
  for (const [pairKey, a] of accs) {
    const closingP = a.opening + a.lines.reduce((s, l) => s + l.amount, 0);
    if (a.lines.length === 0 && Math.abs(a.opening) <= EPS && Math.abs(closingP) <= EPS) continue;

    // Debtor = whoever owes at the end; if it all got settled, whoever the period's expenses made the debtor.
    const charged = a.lines.filter((l) => !l.isSettlement).reduce((s, l) => s + l.amount, 0);
    let sign: 1 | -1;
    if (Math.abs(closingP) > EPS) sign = closingP > 0 ? 1 : -1;
    else if (Math.abs(charged) > EPS) sign = charged > 0 ? 1 : -1;
    else sign = a.opening >= 0 ? 1 : -1;

    const settled = Math.abs(closingP) <= EPS;
    pairs.push({
      pairKey,
      debtorId: sign === 1 ? a.p : a.q,
      creditorId: sign === 1 ? a.q : a.p,
      opening: a.opening * sign,
      closing: settled ? 0 : closingP * sign,
      lines: a.lines.map((l) => ({ ...l, amount: l.amount * sign })),
      isSettled: settled,
    });
  }
  // still owing first (largest first), then the settled ones
  pairs.sort((x, y) => Number(x.isSettled) - Number(y.isSettled) || y.closing - x.closing);
  return { range, pairs };
}

/* ── date helpers ─────────────────────────────────────────────────────────── */

function isoOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export type RangePreset = "all" | "thisMonth" | "lastMonth" | "last30";

export const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "last30", label: "Last 30 days" },
];

export function presetRange(preset: RangePreset): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "thisMonth":
      return { from: isoOf(new Date(y, m, 1)), to: todayISO() };
    case "lastMonth":
      return { from: isoOf(new Date(y, m - 1, 1)), to: isoOf(new Date(y, m, 0)) };
    case "last30":
      return { from: isoOf(new Date(y, now.getMonth(), now.getDate() - 29)), to: todayISO() };
    default:
      return { from: "", to: "" };
  }
}

export function rangeLabel(r: DateRange): string {
  if (r.from && r.to) return `${formatDate(r.from)} – ${formatDate(r.to)}`;
  if (r.from) return `From ${formatDate(r.from)}`;
  if (r.to) return `Up to ${formatDate(r.to)}`;
  return "All time";
}

/** money with a sign, and no "-0.00" */
export function signedMoney(currency: string, n: number): string {
  if (Math.abs(n) < 0.005) return money(currency, 0);
  return n < 0 ? `-${money(currency, -n)}` : money(currency, n);
}

/* ── downloads ────────────────────────────────────────────────────────────── */
// exceljs / jspdf are heavy, so they're loaded on demand (only when someone taps download).

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "book";
}

export type HistoryFormat = "xlsx" | "pdf";

export function historyFileName(book: Book, range: DateRange, ext: HistoryFormat): string {
  const span = range.from || range.to ? `${range.from || "start"}_to_${range.to || "now"}` : "all-time";
  return `${slug(book.name)}-balances-${span}.${ext}`;
}

function nameLookup(book: Book) {
  const all = [...book.people, ...book.deletedPeople];
  return (id: string) => all.find((p) => p.id === id)?.name ?? "Unknown";
}

/** YYYY-MM-DD → a Date Excel will store as a real date (UTC avoids off-by-one from timezones) */
function excelDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** An .xlsx workbook: one row per transaction, grouped under each "A owes B". */
export async function buildHistoryXlsx(book: Book, h: BalanceHistory, personId: string): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const nameOf = nameLookup(book);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Balance history");
  ws.columns = [{ width: 30 }, { width: 13 }, { width: 46 }, { width: 14 }];

  const info: [string, string][] = [
    ["Book", book.name],
    ["For", nameOf(personId)],
    ["Period", rangeLabel(h.range)],
    ["Currency", book.currency],
  ];
  for (const [k, v] of info) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  }
  ws.addRow([]);

  const head = ws.addRow(["Who owes whom", "Date", "Description", `Amount (${book.currency})`]);
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D4AFF" } };
  });
  head.getCell(4).alignment = { horizontal: "right" };

  const AMOUNT_FMT = "#,##0.00;[Red]-#,##0.00";
  const addLine = (who: string, date: string | null, desc: string, amount: number, bold = false) => {
    const r = ws.addRow([who, date ? excelDate(date) : "", desc, Math.abs(amount) < 0.005 ? 0 : Math.round(amount * 100) / 100]);
    r.getCell(2).numFmt = "dd/mm/yyyy";
    r.getCell(2).alignment = { horizontal: "left" };
    r.getCell(4).numFmt = AMOUNT_FMT;
    if (bold) {
      r.font = { bold: true };
      r.eachCell((c) => (c.border = { top: { style: "thin", color: { argb: "FF999999" } } }));
    }
  };

  for (const p of h.pairs) {
    const who = `${nameOf(p.debtorId)} owes ${nameOf(p.creditorId)}`;
    if (Math.abs(p.opening) > EPS) addLine(who, null, "Brought forward", p.opening);
    for (const l of p.lines) addLine(who, l.date, l.title, l.amount);
    addLine(who, null, p.isSettled ? "Balance at end (settled)" : "Balance at end", p.closing, true);
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** The built-in PDF fonts only cover Latin text, so swap anything else for "?" rather than print garbage. */
function pdfSafe(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

/** A real PDF file (no print dialog). */
export async function buildHistoryPdf(book: Book, h: BalanceHistory, personId: string): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const nameOf = nameLookup(book);
  const cur = book.currency;
  const t = pdfSafe;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(t(`${book.name} - ${nameOf(personId)}'s balance history`), margin, 48);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100);
  doc.text(t(`${rangeLabel(h.range)}  |  generated ${formatDate(todayISO())}  |  amounts in ${cur}`), margin, 64);
  doc.setTextColor(0);

  let y = 92;
  if (h.pairs.length === 0) {
    doc.setFontSize(11).text("Nothing in this period.", margin, y);
  }

  for (const p of h.pairs) {
    const body: any[][] = [];
    if (Math.abs(p.opening) > EPS) body.push(["", "Brought forward", signedMoney(cur, p.opening)]);
    for (const l of p.lines) body.push([formatDate(l.date), t(l.title), signedMoney(cur, l.amount)]);
    const bold = { fontStyle: "bold" as const };
    body.push([
      { content: "", styles: bold },
      { content: p.isSettled ? "Balance at end - settled" : "Balance at end", styles: bold },
      { content: signedMoney(cur, p.closing), styles: bold },
    ]);

    // keep the heading with at least its first couple of rows
    if (y > pageH - 130) {
      doc.addPage();
      y = 48;
    }
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text(t(`${nameOf(p.debtorId)} owes ${nameOf(p.creditorId)}`), margin, y);

    autoTable(doc, {
      startY: y + 8,
      margin: { left: margin, right: margin, bottom: 40 },
      head: [["Date", "Description", "Amount"]],
      body,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }, lineColor: [225, 225, 225], lineWidth: { bottom: 0.5 } },
      headStyles: { fontSize: 8, textColor: 110, fontStyle: "bold", lineColor: [150, 150, 150] },
      columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 90, halign: "right" } },
      didParseCell: (d) => {
        if (d.section === "head" && d.column.index === 2) d.cell.styles.halign = "right";
      },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y + 40) + 26;
  }

  return doc.output("arraybuffer");
}

/** Save a file straight to the device (browser download / "Save to Files" on phones). */
export function downloadFile(fileName: string, data: ArrayBuffer, mime: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const PDF_MIME = "application/pdf";
