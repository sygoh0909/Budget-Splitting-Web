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

/** One entry per pair of people after cancelling debts in both directions. */
export function computePairwiseDebts(expenses: Expense[]): PairwiseDebt[] {
  // raw.get(a).get(b) = total a owes b, before cancelling
  const raw = new Map<string, Map<string, number>>();
  // lines.get(a).get(b) = per-expense breakdown of what a owes b
  const lines = new Map<string, Map<string, Map<string, ReceiptLine>>>();

  for (const exp of expenses) {
    const payerId = exp.paidBy;
    for (const item of exp.items) {
      if (item.splitWith.length === 0) continue;
      const share = itemTotalWithCharges(exp, item.amount) / item.splitWith.length;
      for (const pid of item.splitWith) {
        if (pid === payerId) continue;

        if (!raw.has(pid)) raw.set(pid, new Map());
        raw.get(pid)!.set(payerId, (raw.get(pid)!.get(payerId) ?? 0) + share);

        if (!lines.has(pid)) lines.set(pid, new Map());
        if (!lines.get(pid)!.has(payerId)) lines.get(pid)!.set(payerId, new Map());
        const perExpense = lines.get(pid)!.get(payerId)!;
        const prev = perExpense.get(exp.id);
        perExpense.set(exp.id, {
          expenseId: exp.id,
          title: expenseDisplayTitle(exp),
          amount: (prev?.amount ?? 0) + share,
        });
      }
    }
  }

  const out: PairwiseDebt[] = [];
  const visited = new Set<string>();
  const linesFor = (a: string, b: string): ReceiptLine[] =>
    Array.from(lines.get(a)?.get(b)?.values() ?? []);

  for (const [a, owedTo] of raw) {
    for (const b of owedTo.keys()) {
      const key = [a, b].sort();
      const pairKey = `${key[0]}_${key[1]}`;
      if (visited.has(pairKey)) continue;
      visited.add(pairKey);

      const net = (raw.get(a)?.get(b) ?? 0) - (raw.get(b)?.get(a) ?? 0);
      if (Math.abs(net) < EPS) continue;

      const debtorId = net > 0 ? a : b;
      const creditorId = net > 0 ? b : a;
      out.push({
        pairKey,
        debtorId,
        creditorId,
        net: Math.abs(net),
        debtorLines: linesFor(debtorId, creditorId),
        creditorLines: linesFor(creditorId, debtorId),
      });
    }
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
