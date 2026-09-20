"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

// Open modals, top-most last. Only the top one reacts to Escape, so closing a
// nested dialog (e.g. the delete confirmation) doesn't also close the form under it.
const stack: string[] = [];

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "sm" = small dialog / bottom sheet, "lg" = tall form (full-screen on phones) */
  size?: "sm" | "lg";
  labelledBy?: string;
}

export function Modal({ open, onClose, children, size = "sm", labelledBy }: ModalProps) {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack[stack.length - 1] === id) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      const i = stack.indexOf(id);
      if (i !== -1) stack.splice(i, 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, id]);

  if (!open) return null;

  const panel =
    size === "lg"
      ? "h-[100dvh] w-full sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-2xl"
      : "w-full max-w-md rounded-t-2xl sm:rounded-2xl";

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-black/70 ${
        size === "lg" ? "items-stretch sm:items-center" : "items-end sm:items-center"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`flex flex-col overflow-hidden bg-card shadow-2xl ring-1 ring-line ${panel}`}
      >
        {children}
      </div>
    </div>
  );
}
