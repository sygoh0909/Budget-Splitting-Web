"use client";

import { useEffect, useState } from "react";
import {
  BookOpen, Camera, ChevronLeft, ChevronRight, ListChecks, QrCode, Scale, Tags, X,
} from "lucide-react";
import { useOnboarding } from "./Providers";

interface Slide {
  icon: typeof BookOpen;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: BookOpen,
    title: "Welcome to SplitBudget",
    body: "Create a book for a trip or a shared budget, or join one with a 6-character invite code from a friend. Here's a quick look at how it all works.",
  },
  {
    icon: ListChecks,
    title: "Add an expense",
    body: "Add each item with its price, choose who paid, and use the dropdown under each item to pick who's sharing it — tick a few people, or choose \"Everyone\".",
  },
  {
    icon: Tags,
    title: "Give it a category",
    body: "Pick a category for the expense — Food, Groceries, Transport and more — so it's easy to spot at a glance in the list.",
  },
  {
    icon: Camera,
    title: "Or just scan the receipt",
    body: "Tap the camera button to scan a receipt photo. It reads the items and any tax or service charge for you — just check it over and assign who shares what.",
  },
  {
    icon: Scale,
    title: "Balances, done automatically",
    body: "The Balances tab nets everything out and shows exactly who owes whom, so nobody has to do the maths by hand.",
  },
  {
    icon: QrCode,
    title: "Settle up with a QR code",
    body: "If someone you owe has added a bank or e-wallet QR code in their profile, tap the QR icon next to the debt to pay them directly. Add your own under Profile → Payment Methods, so others can pay you the same way.",
  },
];

export function OnboardingTour() {
  const { dismiss } = useOnboarding();
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      else if (e.key === "ArrowRight") setI((v) => Math.min(SLIDES.length - 1, v + 1));
      else if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [dismiss]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-line">
        <div className="flex justify-end p-3">
          <button onClick={dismiss} aria-label="Skip walkthrough" className="p-1 text-dim transition hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="px-7 pb-2 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
            <slide.icon size={28} />
          </div>
          <h2 id="onboarding-title" className="mt-5 text-lg font-bold text-white">
            {slide.title}
          </h2>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{slide.body}</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5" role="tablist" aria-label="Slide">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              role="tab"
              aria-selected={idx === i}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-accent" : "w-1.5 bg-line"}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 p-6 pt-7">
          {i > 0 ? (
            <button onClick={() => setI((v) => v - 1)} aria-label="Previous" className="icon-btn">
              <ChevronLeft size={16} />
            </button>
          ) : (
            <button onClick={dismiss} className="text-[13px] text-muted">
              Skip
            </button>
          )}
          <span className="flex-1" />
          <button onClick={() => (last ? dismiss() : setI((v) => v + 1))} className="btn-primary !px-6 !py-2.5 !text-sm">
            {last ? "Get started" : "Next"}
            {!last && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
