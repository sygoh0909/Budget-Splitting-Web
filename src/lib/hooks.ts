"use client";

import { useEffect, useState } from "react";
import { watchBook, watchBooks, watchExpenses } from "./db";
import type { Book, Expense } from "./types";

interface Live<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function describe(err: Error): string {
  // Firestore surfaces a missing composite index as failed-precondition with a console link
  console.error(err);
  return err.message || "Something went wrong loading your data.";
}

export function useBooks(userId: string): Live<Book[]> {
  const [state, setState] = useState<Live<Book[]>>({ data: [], loading: true, error: null });
  useEffect(() => {
    setState({ data: [], loading: true, error: null });
    return watchBooks(
      userId,
      (data) => setState({ data, loading: false, error: null }),
      (err) => setState({ data: [], loading: false, error: describe(err) }),
    );
  }, [userId]);
  return state;
}

export function useBook(bookId: string): Live<Book | null> {
  const [state, setState] = useState<Live<Book | null>>({ data: null, loading: true, error: null });
  useEffect(() => {
    setState({ data: null, loading: true, error: null });
    return watchBook(
      bookId,
      (data) => setState({ data, loading: false, error: null }),
      (err) => setState({ data: null, loading: false, error: describe(err) }),
    );
  }, [bookId]);
  return state;
}

export function useExpenses(bookId: string): Live<Expense[]> {
  const [state, setState] = useState<Live<Expense[]>>({ data: [], loading: true, error: null });
  useEffect(() => {
    setState({ data: [], loading: true, error: null });
    return watchExpenses(
      bookId,
      (data) => setState({ data, loading: false, error: null }),
      (err) => setState({ data: [], loading: false, error: describe(err) }),
    );
  }, [bookId]);
  return state;
}
