"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { useUser, useTheme } from "./Providers";
import { useBooks } from "@/lib/hooks";
import { initialsOf } from "@/lib/util";
import { BookCard } from "./BookCard";
import { Modal } from "./ui/Modal";
import { Spinner } from "./ui/Spinner";

export function HomeScreen() {
  const user = useUser();
  const { userName } = useTheme();
  const { data: books, loading, error } = useBooks(user.uid);
  const [addOpen, setAddOpen] = useState(false);

  const personal = books.filter((b) => b.type === "personal");
  const shared = books.filter((b) => b.type === "shared");

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight">SplitBudget</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            aria-label="Profile"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/25 bg-accent/10 text-[10px] font-extrabold text-accent"
          >
            {initialsOf(userName)}
          </Link>
          <button
            onClick={() => setAddOpen(true)}
            aria-label="Create or join a book"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition hover:brightness-110"
          >
            <Plus size={18} />
          </button>
        </div>
      </header>

      <div className="mt-7">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size={28} />
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl bg-danger/10 p-4 text-[13px] text-danger">
            <p className="font-semibold">Couldn&apos;t load your books.</p>
            <p className="mt-1 break-words text-danger/80">{error}</p>
          </div>
        ) : books.length === 0 ? (
          <p className="py-20 text-center text-sm text-dim">No books yet — tap + to create or join one.</p>
        ) : (
          <div className="space-y-2">
            {personal.map((b, idx) => (
              <BookCard key={b.id} book={b} tourId={idx === 0 ? "home-book-card" : undefined} />
            ))}
            {personal.length > 0 && shared.length > 0 && <div className="my-2 h-px bg-line" />}
            {shared.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="p-4 pb-8">
          <div className="mx-auto mb-5 h-1 w-8 rounded-full bg-line" />
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              href="/books/new"
              className="rounded-2xl bg-accent p-4 text-white transition hover:brightness-110"
              onClick={() => setAddOpen(false)}
            >
              <Plus size={18} />
              <div className="mt-3 text-[15px] font-bold">Create</div>
              <div className="text-xs text-white/70">new book</div>
            </Link>
            <Link
              href="/books/join"
              className="rounded-2xl bg-card2 p-4 transition hover:brightness-125"
              onClick={() => setAddOpen(false)}
            >
              <Users size={18} className="text-muted" />
              <div className="mt-3 text-[15px] font-bold text-white">Join</div>
              <div className="text-xs text-muted">with a code</div>
            </Link>
          </div>
        </div>
      </Modal>
    </main>
  );
}
