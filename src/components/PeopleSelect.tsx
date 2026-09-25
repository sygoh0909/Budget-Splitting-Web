"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { Person } from "@/lib/types";

interface PeopleSelectProps {
  /** people that can be picked (active members) */
  people: Person[];
  /** removed people who are still on this item — shown so they can be un-ticked */
  extraPeople?: Person[];
  /** selected person ids */
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  ariaLabel: string;
  /**
   * true (default): multi-select checklist for "who's this split between",
   * with an "Everyone" / "Clear" footer.
   * false: pick exactly one person (e.g. "Paid by") — same dropdown, but
   * choosing an option replaces the selection and closes the menu, and the
   * "Everyone" / "Clear" footer is omitted.
   */
  multiple?: boolean;
}

interface Pos {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const GAP = 6;
const MAX_LIST_HEIGHT = 280;

/**
 * Dropdown for choosing who an item is split between.
 * Multi-select (a shared starter can be split three ways), rendered as a listbox of
 * checkbox rows — instead of one chip per person — so it stays compact with any group size.
 */
export function PeopleSelect({ people, extraPeople = [], value, onChange, placeholder = "Select people", ariaLabel, multiple = true }: PeopleSelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedExtras = extraPeople.filter((p) => value.includes(p.id));
  const options = [...people, ...selectedExtras];
  const selected = options.filter((p) => value.includes(p.id));
  const allSelected = multiple && people.length > 1 && people.every((p) => value.includes(p.id));

  const summary =
    selected.length === 0
      ? null
      : allSelected && selectedExtras.length === 0
        ? "Everyone"
        : selected.map((p) => (extraPeople.includes(p) ? `${p.name} (deleted)` : p.name)).join(", ");

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - GAP - 8;
    const above = r.top - GAP - 8;
    const wantsHeight = Math.min(MAX_LIST_HEIGHT, options.length * 40 + 52);
    const placeAbove = below < wantsHeight && above > below;
    const width = Math.max(r.width, 220);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos(
      placeAbove
        ? { left, width, bottom: window.innerHeight - r.top + GAP, maxHeight: Math.min(MAX_LIST_HEIGHT, above) }
        : { left, width, top: r.bottom + GAP, maxHeight: Math.min(MAX_LIST_HEIGHT, below) },
    );
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true); // capture: also fires for the scrolling form body
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  // close when clicking anywhere outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  // move focus into the list when it opens
  useEffect(() => {
    if (open && pos) listRef.current?.querySelector<HTMLElement>('[role="option"]')?.focus();
  }, [open, pos !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id: string) {
    if (!multiple) {
      // single-select: choosing an option replaces the value and closes the menu
      onChange([id]);
      close(true);
      return;
    }
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[Math.min(items.length - 1, i + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[Math.max(0, i - 1)]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't also close the surrounding modal
      close(true);
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex w-full items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-left text-[13px] outline-none ring-1 transition focus-visible:ring-accent/70 ${
          open ? "ring-accent/60" : summary ? "ring-line" : "ring-warn/40"
        }`}
      >
        {selected.length > 0 && (
          <span className="flex shrink-0 -space-x-1" aria-hidden>
            {selected.slice(0, 3).map((p) => (
              <span key={p.id} className="h-2.5 w-2.5 rounded-full ring-2 ring-[#0d0d0e]" style={{ background: p.color }} />
            ))}
          </span>
        )}
        <span className={`min-w-0 flex-1 truncate ${summary ? "text-white" : "text-warn"}`}>{summary ?? placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable={multiple}
            aria-label={ariaLabel}
            onKeyDown={onListKeyDown}
            // Portaled to document.body, so it's a true sibling of the onboarding tour's overlay (z-[90])
            // rather than nested inside it — needs a higher z-index to stay clickable during the tour's preview steps.
            className="fixed z-[95] overflow-y-auto rounded-xl bg-card2 py-1 shadow-2xl ring-1 ring-line"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          >
            {options.map((p) => {
              const checked = value.includes(p.id);
              const isExtra = extraPeople.includes(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(p.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] outline-none transition hover:bg-white/5 focus-visible:bg-white/10"
                >
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition ${
                      checked ? "border-transparent" : "border-dim"
                    }`}
                    style={checked ? { background: p.color } : undefined}
                  >
                    {checked && <Check size={12} strokeWidth={3} className="text-white" />}
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-white">
                    {p.name}
                    {isExtra && <span className="text-muted"> (deleted)</span>}
                  </span>
                </button>
              );
            })}
            {multiple && people.length > 1 && (
              <div className="mt-1 flex border-t border-line">
                <button
                  type="button"
                  onClick={() => onChange(Array.from(new Set([...value, ...people.map((p) => p.id)])))}
                  className="flex-1 px-3 py-2 text-xs font-semibold text-accent outline-none hover:bg-white/5 focus-visible:bg-white/10"
                >
                  Everyone
                </button>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="flex-1 border-l border-line px-3 py-2 text-xs text-muted outline-none hover:bg-white/5 focus-visible:bg-white/10"
                >
                  Clear
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
