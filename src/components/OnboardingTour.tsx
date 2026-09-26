"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useOnboarding } from "./Providers";
import { TOUR_STEPS } from "@/lib/tourSteps";

const POLL_MS = 250;
const GAP = 12;
const MARGIN = 16;
const PAD = 8;

interface CardPos {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

function cardPosFor(rect: DOMRect | null): CardPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(360, vw - MARGIN * 2);
  const centerLeft = rect ? rect.left + rect.width / 2 - width / 2 : (vw - width) / 2;
  const left = Math.min(Math.max(MARGIN, centerLeft), vw - width - MARGIN);

  if (!rect) return { left, width, maxHeight: vh - MARGIN * 2 };

  const below = vh - rect.bottom - GAP - MARGIN;
  const above = rect.top - GAP - MARGIN;
  if (below >= 180 || below >= above) {
    return { left, width, top: rect.bottom + GAP, maxHeight: Math.max(140, below) };
  }
  return { left, width, bottom: vh - rect.top + GAP, maxHeight: Math.max(140, above) };
}

/**
 * First-run walkthrough. Rather than generic slides, each step spotlights the real, live
 * element it's describing (found via `[data-tour="..."]`) wherever it happens to be on
 * screen — the actual "Add Expense" button, the actual "Paid by" field, and so on — and
 * steps marked `advanceOnClick` move forward the moment the person performs the real
 * action, not just when they tap "Next".
 */
export function OnboardingTour() {
  const { dismiss } = useOnboarding();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<CardPos>(() => cardPosFor(null));
  const advancedRef = useRef(false);

  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;
  const first = i === 0;
  const hasTarget = !!step.selector;

  const goNext = useCallback(() => setI((v) => Math.min(TOUR_STEPS.length - 1, v + 1)), []);
  const goBack = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  // "Next" always makes real progress: for steps that need a real action (open the book,
  // tap Add Expense, open Balances), simulate that click on the live element so the actual
  // screen changes even if the person taps "Next" instead of the highlighted element. Some
  // targets (e.g. the book card) carry data-tour on a wrapper div around the real link/button
  // — clicking a parent never triggers a child's handler, so click the innermost one instead.
  const handleNext = useCallback(() => {
    if (step.advanceOnClick && step.selector) {
      const el = document.querySelector<HTMLElement>(step.selector);
      if (el) {
        const clickable = el.querySelector<HTMLElement>("a,button") ?? el;
        clickable.click();
        return; // the click listener below detects this and advances the step itself
      }
    }
    goNext();
  }, [step.advanceOnClick, step.selector, goNext]);

  // Locate this step's real target (if any) and keep tracking it — it may take a moment
  // to mount (e.g. right after navigating to a new page or opening the expense form).
  useEffect(() => {
    advancedRef.current = false;
    let cancelled = false;
    let scrolledIntoView = false;
    let timer: number;

    const tick = () => {
      if (cancelled) return;
      const el = step.selector ? document.querySelector<HTMLElement>(step.selector) : null;
      if (el) {
        if (!scrolledIntoView) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          scrolledIntoView = true;
        }
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
      timer = window.setTimeout(tick, POLL_MS);
    };
    tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [i, step.selector]);

  // Keep the card positioned relative to the (possibly moving/scrolling) target.
  useEffect(() => {
    const update = () => setPos(cardPosFor(rect));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [rect]);

  // Steps that say "do this" advance automatically the moment the real element is clicked.
  useEffect(() => {
    if (!step.advanceOnClick || !step.selector) return;
    const onDocClick = (e: MouseEvent) => {
      if (advancedRef.current) return;
      const el = document.querySelector<HTMLElement>(step.selector!);
      if (el && el.contains(e.target as Node)) {
        advancedRef.current = true;
        // let the real click's own handler (navigation, opening the modal...) run first
        window.setTimeout(goNext, 350);
      }
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [step.advanceOnClick, step.selector, goNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return dismiss();
      // don't hijack arrow keys while the person is editing text (e.g. the Title field) —
      // only treat them as tour navigation when focus isn't in an editable field
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      const editing = tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement as HTMLElement | null)?.isContentEditable;
      if (editing) return;
      if (e.key === "ArrowRight") handleNext();
      else if (e.key === "ArrowLeft") goBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss, handleNext, goBack]);

  const spotlighting = hasTarget && !!rect;
  // Only the bookend (no-target) steps fully block the page; every other step just dims
  // it, so the person can keep freely using the real app while the tour follows along.
  const blocking = !hasTarget;

  return createPortal(
    <div className="fixed inset-0 z-[200]" aria-live="polite">
      {spotlighting && rect ? (
        <div
          className="fixed rounded-2xl ring-2 ring-accent transition-[top,left,width,height] duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.78)",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div className={`fixed inset-0 bg-black/80 ${blocking ? "" : "pointer-events-none"}`} />
      )}

      <div
        role="dialog"
        aria-modal={blocking}
        aria-labelledby="tour-title"
        className="fixed flex flex-col overflow-hidden rounded-2xl bg-card p-5 shadow-2xl ring-1 ring-line"
        style={{
          left: pos.left,
          width: pos.width,
          top: pos.top ?? (pos.bottom === undefined ? "50%" : undefined),
          bottom: pos.bottom,
          transform: pos.top === undefined && pos.bottom === undefined ? "translateY(-50%)" : undefined,
          maxHeight: pos.maxHeight,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            {!hasTarget ? `Step ${i + 1} of ${TOUR_STEPS.length}` : spotlighting ? (step.advanceOnClick ? "Try it" : "Look here") : "One moment…"}
          </span>
          <button onClick={dismiss} aria-label="Skip walkthrough" className="shrink-0 p-0.5 text-dim transition hover:text-white">
            <X size={16} />
          </button>
        </div>

        <h2 id="tour-title" className="mt-1.5 text-[15px] font-bold text-white">{step.title}</h2>
        <p className="mt-1.5 overflow-y-auto text-[13px] leading-relaxed text-muted">{step.body}</p>

        <div className="mt-4 flex items-center gap-1.5" role="tablist" aria-label="Step">
          {TOUR_STEPS.map((_, idx) => (
            <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-accent" : "w-1.5 bg-line"}`} />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {!first ? (
            <button onClick={goBack} aria-label="Previous" className="icon-btn">
              <ChevronLeft size={16} />
            </button>
          ) : (
            <button onClick={dismiss} className="text-[13px] text-muted">Skip</button>
          )}
          <span className="flex-1" />
          <button onClick={() => (last ? dismiss() : handleNext())} className="btn-primary !px-5 !py-2.5 !text-sm">
            {last ? "Get started" : "Next"}
            {!last && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
