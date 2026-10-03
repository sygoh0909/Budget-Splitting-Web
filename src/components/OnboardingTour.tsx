"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { useOnboarding } from "./Providers";
import { TOUR_STEPS } from "@/lib/tourSteps";

const POLL_MS = 200;
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

function cardPosFor(rect: DOMRect | null, pinTop: boolean): CardPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(360, vw - MARGIN * 2);
  const centerLeft = rect ? rect.left + rect.width / 2 - width / 2 : (vw - width) / 2;
  const left = Math.min(Math.max(MARGIN, centerLeft), vw - width - MARGIN);

  // Steps that open their own picker/modal (Paid by, Category, Split) pin the card to the
  // top of the screen instead of hugging the target — the picker itself usually opens right
  // where the target is (or as a centered/bottom sheet), so anchoring near it risks the two
  // overlapping.
  if (pinTop) return { left, width, top: MARGIN, maxHeight: Math.min(260, vh - MARGIN * 2) };

  if (!rect) return { left, width, maxHeight: vh - MARGIN * 2 };

  const below = vh - rect.bottom - GAP - MARGIN;
  const above = rect.top - GAP - MARGIN;
  if (below >= 180 || below >= above) {
    return { left, width, top: rect.bottom + GAP, maxHeight: Math.max(140, below) };
  }
  return { left, width, bottom: vh - rect.top + GAP, maxHeight: Math.max(140, above) };
}

/**
 * First-run walkthrough. Each step spotlights the real, live element it's describing (found
 * via `[data-tour="..."]`) and, for anything actionable, is gated on actually doing it:
 *  - "click" + autoAdvance steps (open the book, tap Add Expense, hit Save, open Balances)
 *    hide the Next button entirely — the only way through is the real click, detected live.
 *  - "click" steps without autoAdvance (Paid by / Category / Split) unlock Next once the
 *    trigger's been clicked, and don't dim the screen so any picker that opens stays usable.
 *  - "type" steps (the title fields) unlock Next once real text has been typed.
 * "Back" also restores the app to match the previous step — closing the expense form and/or
 * navigating back a page — instead of just rewinding the hint while the screen stays put.
 */
export function OnboardingTour() {
  const { dismiss } = useOnboarding();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [satisfied, setSatisfied] = useState(false);
  const clickSeenRef = useRef(false);

  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;
  const first = i === 0;
  const hasTarget = !!step.selector;
  // dropdown-style steps: don't darken the screen, since a picker may open elsewhere/on top
  const suppressDim = step.gate === "click" && step.autoAdvance === false;
  const [pos, setPos] = useState<CardPos>(() => cardPosFor(null, false));

  const goNext = useCallback(() => setI((v) => Math.min(TOUR_STEPS.length - 1, v + 1)), []);

  const goBack = useCallback(() => {
    const prevIdx = Math.max(0, i - 1);
    const prev = TOUR_STEPS[prevIdx];
    // restore the app to match the step we're returning to, instead of leaving the screen
    // exactly as it is and just rewinding the hint on top of it
    if (step.modalOpen && !prev.modalOpen) {
      document.querySelector<HTMLElement>('[data-tour="expense-modal-close"]')?.click();
    }
    if (step.route === "book" && prev.route === "home") {
      router.back();
    }
    setI(prevIdx);
  }, [i, step.modalOpen, step.route, router]);

  // Locate this step's real target (if any) and keep tracking it — it may take a moment to
  // mount (e.g. right after navigating to a new page or opening the expense form). Also polls
  // the "satisfied" condition for gated steps (typed text present / a click already seen).
  useEffect(() => {
    clickSeenRef.current = false;
    setSatisfied(false);
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
        if (step.gate === "type") {
          const value = (el as HTMLInputElement).value ?? "";
          setSatisfied(value.trim() !== "");
        } else if (step.gate === "click") {
          setSatisfied(clickSeenRef.current);
        }
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
  }, [i, step.selector, step.gate]);

  // Keep the card positioned relative to the (possibly moving/scrolling) target.
  useEffect(() => {
    const update = () => setPos(cardPosFor(rect, suppressDim));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [rect, suppressDim]);

  // A real click on the target: for autoAdvance steps this jumps straight to the next step;
  // for the rest it just unlocks "Next" so the person can keep browsing the picker first.
  useEffect(() => {
    if (step.gate !== "click" || !step.selector) return;
    const onDocClick = (e: MouseEvent) => {
      if (clickSeenRef.current) return;
      const el = document.querySelector<HTMLElement>(step.selector!);
      if (el && el.contains(e.target as Node)) {
        clickSeenRef.current = true;
        setSatisfied(true);
        if (step.autoAdvance) window.setTimeout(goNext, 350);
      }
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [step.gate, step.autoAdvance, step.selector, goNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return dismiss();
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      const editing = tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement as HTMLElement | null)?.isContentEditable;
      if (editing) return;
      if (e.key === "ArrowLeft") goBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss, goBack]);

  const spotlighting = hasTarget && !!rect;
  // Only the bookend (no-target) steps fully block the page; every gated step just dims it
  // (or not at all, for dropdown steps) so the person can keep using the real app.
  const blocking = !hasTarget;
  // A step only ever shows "Next" when it's not gated, or once its gate is satisfied — a
  // gated step with autoAdvance never shows it at all, since the click itself is the only way through.
  const targetMissing = hasTarget && !rect;
  const showNext = !step.gate || targetMissing || (satisfied && !(step.gate === "click" && step.autoAdvance));

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[200]" aria-live="polite">
      {spotlighting && rect ? (
        <div
          className="fixed rounded-2xl ring-2 ring-accent transition-[top,left,width,height] duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: suppressDim ? undefined : "0 0 0 9999px rgba(0,0,0,0.78)",
            pointerEvents: "none",
          }}
        />
      ) : (
        !suppressDim && <div className={`fixed inset-0 bg-black/80 ${blocking ? "pointer-events-auto" : "pointer-events-none"}`} />
      )}

      <div
        role="dialog"
        aria-modal={blocking}
        aria-labelledby="tour-title"
        className="pointer-events-auto fixed flex flex-col overflow-hidden rounded-2xl bg-card p-5 shadow-2xl ring-1 ring-line"
        style={{
          left: pos.left,
          width: pos.width,
          top: pos.top,
          bottom: pos.bottom,
          maxHeight: pos.maxHeight,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            {!hasTarget
              ? `Step ${i + 1} of ${TOUR_STEPS.length}`
              : step.gate === "type"
                ? satisfied ? "Nice — keep going" : "Type here"
                : step.gate === "click"
                  ? satisfied ? "Got it" : "Tap it"
                  : "Look here"}
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
          {!first && (
            <button onClick={goBack} aria-label="Previous" className="icon-btn">
              <ChevronLeft size={16} />
            </button>
          )}
          <button onClick={dismiss} className="text-[13px] text-muted">Skip</button>
          <span className="flex-1" />
          {showNext && (
            <button onClick={() => (last ? dismiss() : goNext())} className="btn-primary !px-5 !py-2.5 !text-sm">
              {last ? "Get started" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
