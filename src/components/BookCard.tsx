"use client";

import Link from "next/link";
import { Clock, AlertCircle, Pencil, UserPlus } from "lucide-react";
import type { Book } from "@/lib/types";
import { useExpenses } from "@/lib/hooks";
import { computeBalances, expenseTotal, isSettlement, EPS } from "@/lib/split";
import { money, withAlpha, firstLetter } from "@/lib/util";
import { useTheme } from "./Providers";

export function BookCard({ book }: { book: Book }) {
  const { accent } = useTheme();
  const { data: allExpenses } = useExpenses(book.id);

  const expenses = allExpenses.filter((e) => !isSettlement(e));
  const total = expenses.reduce((s, e) => s + expenseTotal(e), 0);
  const unassigned = expenses.filter((e) => e.items.some((i) => i.splitWith.length === 0)).length;
  const balances = computeBalances(book.people, allExpenses);
  const hasUnpaid = book.people.length > 1 && Object.values(balances).some((b) => Math.abs(b) > EPS);
  const pending = book.joinRequests.length;
  const hasAlert = unassigned > 0 || hasUnpaid || pending > 0;

  const shown = book.people.slice(0, 3);

  return (
    <div className="flex overflow-hidden rounded-[14px] bg-card">
      <Link href={`/books/${book.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 transition hover:bg-card2/40">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-white">{book.name}</span>
            {book.type === "personal" && (
              <span className="rounded-full bg-accent/10 px-1.5 py-px text-[9px] font-semibold text-accent">personal</span>
            )}
          </div>
          <div className="mt-1">
            {hasAlert ? (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                {unassigned > 0 && (
                  <span className="flex items-center gap-1 text-warn">
                    <AlertCircle size={10} /> {unassigned} unassigned
                  </span>
                )}
                {hasUnpaid && (
                  <span className="flex items-center gap-1 text-danger">
                    <Clock size={10} /> unpaid
                  </span>
                )}
                {pending > 0 && (
                  <span className="flex items-center gap-1 text-orange-500">
                    <UserPlus size={10} /> {pending} pending
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted">
                {book.people.length} {book.people.length === 1 ? "person" : "people"}
                {total > 0 ? ` · ${money(book.currency, total)}` : ""}
              </span>
            )}
          </div>
        </div>

        {book.type === "shared" && shown.length > 0 && (
          <div className="flex shrink-0 items-center" aria-label={`${book.people.length} members`}>
            {shown.map((p, i) => (
              <span
                key={p.id}
                className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-card text-[9px] font-bold"
                style={{ background: withAlpha(p.color, 0.16), color: p.color, marginLeft: i === 0 ? 0 : -6 }}
              >
                {firstLetter(p.name)}
              </span>
            ))}
            {book.people.length > 3 && (
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-card bg-card2 text-[8px] text-muted"
                style={{ marginLeft: -6 }}
              >
                +{book.people.length - 3}
              </span>
            )}
          </div>
        )}
      </Link>

      <div className="flex items-center border-l border-line px-2">
        <Link
          href={`/books/${book.id}/edit`}
          aria-label={`Edit ${book.name}`}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-card2 text-dim transition hover:text-white"
        >
          <Pencil size={14} />
        </Link>
      </div>
    </div>
  );
}
