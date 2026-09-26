import type { Expense, Person } from "./types";

/* ─────────────────────────────────────────────────────────────────────────────
 * Splitting maths — a direct port of the Flutter app's models.dart / balances UI.
 *
 * Each expense has line items; every item lists the people sharing it (splitWith).
 * Additional charges (tax, service tax, rounding) are spread over items in
 * proportion to their price:
 *
 *   chargeForItem = totalCharges × (item.amount / sum of all items)
 *   personPays    = (item.amount + chargeForItem) / number of people on the item
 * ────────────────────────────────────────────────────────────────────────── */

export const EPS = 0.01;

export function itemsTotal(e: Expense): number {
  return e.items.reduce((s, i) => s + i.amount, 0);
}

export function chargesTotal(e: Expense): number {
  const base = itemsTotal(e);
  return e.additionalCharges.reduce(
    (s, c) => s + (c.isPercentage ? (base * c.value) / 100 : c.value),
    0,
  );
}

/** items + charges */
export function expenseTotal(e: Expense): number {
  return itemsTotal(e) + chargesTotal(e);
}

/** an item's price plus its proportional share of the expense's charges */
export function itemTotalWithCharges(e: Expense, itemAmount: number): number {
  const base = itemsTotal(e);
  const charge = base > 0 ? chargesTotal(e) * (itemAmount / base) : 0;
  return itemAmount + charge;
}

export function isSettlement(e: Expense): boolean {
  return e.title.startsWith("settlement:") || e.title.includes("→");
}

export function settlementDisplayTitle(e: Expense): string {
  // new settlements: the item title holds the full description, e.g. "Alice paid Bob for Dinner"
  if (e.title.startsWith("settlement:") && e.items.length > 0) return e.items[0].title;
  // old arrow-style settlements
  return e.title.replace(/→/g, "settled with");
}

export function expenseDisplayTitle(e: Expense): string {
  return isSettlement(e) ? settlementDisplayTitle(e) : e.title;
}

/** Category shown as the expense's icon: whichever item has the largest amount. */
export function dominantCategory(e: Expense): string {
  if (isSettlement(e) || e.items.length === 0) return "Misc";
  let best = e.items[0];
  for (const item of e.items) if (item.amount > best.amount) best = item;
  return best.category;
}

/** net balance per person: positive = is owed, negative = owes */
export function computeBalances(people: Person[], expenses: Expense[]): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const p of people) bal[p.id] = 0;

  for (const exp of expenses) {
    for (const item of exp.items) {
      const n = item.splitWith.length;
      const totalForItem = itemTotalWithCharges(exp, item.amount);

      if (exp.paidBy in bal) bal[exp.paidBy] += totalForItem;
      if (n > 0) {
        for (const pid of item.splitWith) {
          if (pid in bal) bal[pid] -= totalForItem / n;
        }
      }
    }
  }
  return bal;
}

/**
 * Gross credit per person: the sum of shares other people owe the payer.
 * Settlements are paybacks, not real credits, so they're skipped.
 */
export function computeGrossCredit(expenses: Expense[]): Record<string, number> {
  const credit: Record<string, number> = {};
  for (const exp of expenses) {
    if (exp.title.startsWith("settlement:")) continue;
    for (const item of exp.items) {
      const n = item.splitWith.length;
      if (n === 0) continue;
      const share = itemTotalWithCharges(exp, item.amount) / n;
      const others = item.splitWith.filter((pid) => pid !== exp.paidBy).length;
      if (others > 0) credit[exp.paidBy] = (credit[exp.paidBy] ?? 0) + share * others;
    }
  }
  return credit;
}

export interface ReceiptLine {
  expenseId: string;
  title: string;
  amount: number;
}

export interface PairwiseDebt {
  pairKey: string;
  debtorId: string;
  creditorId: string;
  net: number;
  /** what the debtor owes the creditor, per expense */
  debtorLines: ReceiptLine[];
  /** what the creditor owes the debtor, per expense (cancelled against the above) */
  creditorLines: ReceiptLine[];
}

interface DebtEvent {
  expenseId: string;
  title: string;
  amount: number;
  /** +1: canonical-first person owes canonical-second; -1: the reverse */
  dir: 1 | -1;
  isSettlement: boolean;
}

interface LedgerEntry {
  dir: 1 | -1;
  expenseId: string;
  title: string;
  amount: number;
}

/**
 * One entry per pair of people, after settlements retire the specific debts they paid off.
 *
 * A settlement retires the *oldest* outstanding debt(s) between that pair first (FIFO),
 * fully removing anything it pays off in full — so a debt that's already been settled
 * never lingers in the breakdown next to the payment that cancelled it. A genuine crossing
 * debt between two still-open expenses (e.g. "Alice owes Bob for dinner" and "Bob owes
 * Alice for a taxi") is left as two separate lines rather than auto-merged, so the
 * breakdown stays transparent about where the net number comes from — settlements are the
 * only thing that actively retires a line.
 */
export function computePairwiseDebts(expenses: Expense[]): PairwiseDebt[] {
  // Chronological order matters here: a settlement can only retire debts that already
  // existed when it was made. Same-day ties put ordinary expenses before settlements,
  // since you can only settle a debt that already exists.
  const sorted = [...expenses].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return Number(isSettlement(a)) - Number(isSettlement(b));
  });

  // events per pair, in chronological order
  const eventsByPair = new Map<string, { p: string; q: string; events: DebtEvent[] }>();
  for (const exp of sorted) {
    const payerId = exp.paidBy;
    const owedToPayer = new Map<string, number>();
    for (const item of exp.items) {
      if (item.splitWith.length === 0) continue;
      const share = itemTotalWithCharges(exp, item.amount) / item.splitWith.length;
      for (const pid of item.splitWith) {
        if (pid === payerId) continue;
        owedToPayer.set(pid, (owedToPayer.get(pid) ?? 0) + share);
      }
    }
    for (const [pid, amount] of owedToPayer) {
      if (amount <= 0) continue;
      const key = [pid, payerId].sort();
      const pairKey = `${key[0]}_${key[1]}`;
      const dir: 1 | -1 = pid === key[0] ? 1 : -1;
      if (!eventsByPair.has(pairKey)) eventsByPair.set(pairKey, { p: key[0], q: key[1], events: [] });
      eventsByPair.get(pairKey)!.events.push({ expenseId: exp.id, title: expenseDisplayTitle(exp), amount, dir, isSettlement: isSettlement(exp) });
    }
  }

  const out: PairwiseDebt[] = [];
  for (const [pairKey, { p, q, events }] of eventsByPair) {
    const ledger: LedgerEntry[] = [];
    for (const ev of events) {
      if (!ev.isSettlement) {
        // a real expense never retires anything, only settlements do
        ledger.push({ dir: ev.dir, expenseId: ev.expenseId, title: ev.title, amount: ev.amount });
        continue;
      }
      // retire the oldest opposite-direction entries first
      let remaining = ev.amount;
      for (let i = 0; remaining > EPS && i < ledger.length; i++) {
        if (ledger[i].dir === ev.dir) continue;
        const cancel = Math.min(remaining, ledger[i].amount);
        ledger[i].amount -= cancel;
        remaining -= cancel;
      }
      for (let j = ledger.length - 1; j >= 0; j--) if (ledger[j].amount <= EPS) ledger.splice(j, 1);
      // any leftover (e.g. an overpayment) becomes its own entry
      if (remaining > EPS) ledger.push({ dir: ev.dir, expenseId: ev.expenseId, title: ev.title, amount: remaining });
    }

    const net = ledger.reduce((s, l) => s + l.dir * l.amount, 0);
    if (Math.abs(net) < EPS) continue;
    const debtorDir: 1 | -1 = net > 0 ? 1 : -1;
    const toLine = ({ expenseId, title, amount }: LedgerEntry): ReceiptLine => ({ expenseId, title, amount });
    out.push({
      pairKey,
      debtorId: net > 0 ? p : q,
      creditorId: net > 0 ? q : p,
      net: Math.abs(net),
      debtorLines: ledger.filter((l) => l.dir === debtorDir).map(toLine),
      creditorLines: ledger.filter((l) => l.dir === -debtorDir as 1 | -1).map(toLine),
    });
  }
  return out;
}

export interface DebtorBreakdown {
  debtorId: string;
  net: number;
  receipts: ReceiptLine[];
}

/** For the "IS OWED" cards: who owes this person money (after netting) and from which expenses. */
export function computeOwedToPerson(personId: string, expenses: Expense[]): DebtorBreakdown[] {
  const owedToMe = new Map<string, number>();
  const iOweThem = new Map<string, number>();
  const receipts = new Map<string, Map<string, ReceiptLine>>();

  for (const exp of expenses) {
    if (exp.paidBy === personId) {
      for (const item of exp.items) {
        if (item.splitWith.length === 0) continue;
        const share = itemTotalWithCharges(exp, item.amount) / item.splitWith.length;
        for (const pid of item.splitWith) {
          if (pid === personId) continue;
          owedToMe.set(pid, (owedToMe.get(pid) ?? 0) + share);
          if (!receipts.has(pid)) receipts.set(pid, new Map());
          const prev = receipts.get(pid)!.get(exp.id);
          receipts.get(pid)!.set(exp.id, {
            expenseId: exp.id,
            title: expenseDisplayTitle(exp),
            amount: (prev?.amount ?? 0) + share,
          });
        }
      }
    } else {
      for (const item of exp.items) {
        if (!item.splitWith.includes(personId)) continue;
        const share = itemTotalWithCharges(exp, item.amount) / item.splitWith.length;
        iOweThem.set(exp.paidBy, (iOweThem.get(exp.paidBy) ?? 0) + share);
      }
    }
  }

  const out: DebtorBreakdown[] = [];
  for (const [pid, owed] of owedToMe) {
    const net = owed - (iOweThem.get(pid) ?? 0);
    if (net > EPS) {
      out.push({ debtorId: pid, net, receipts: Array.from(receipts.get(pid)?.values() ?? []) });
    }
  }
  return out;
}

/** "Paid" / "Should pay" numbers for the People tab. */
export function computePersonSummary(
  personId: string,
  balance: number,
  expenses: Expense[],
): { paid: number; shouldPay: number } {
  const grossPaid = expenses
    .filter((e) => e.paidBy === personId)
    .reduce((s, e) => s + expenseTotal(e), 0);
  // settlements that others paid back to this person
  const receivedBack = expenses
    .filter((e) => e.title.startsWith("settlement:") && e.items.some((i) => i.splitWith.includes(personId)))
    .reduce((s, e) => s + expenseTotal(e), 0);
  const paid = Math.max(0, grossPaid - receivedBack);
  const shouldPay = balance < -0.005 ? -balance : 0;
  return { paid, shouldPay };
}
