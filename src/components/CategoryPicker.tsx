"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { categories, categoryIcons } from "@/lib/constants";
import { Modal } from "./ui/Modal";

interface CategoryPickerProps {
  value: string;
  onChange: (category: string) => void;
  ariaLabel: string;
}

/** Field-style trigger that opens a grid to pick the expense's category (Food, Groceries, Travel...). */
export function CategoryPicker({ value, onChange, ariaLabel }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const Icon = categoryIcons[value] ?? categoryIcons.Misc;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        className="field flex w-full items-center gap-2.5 !text-[13px]"
      >
        <Icon size={16} className="shrink-0 text-accent" />
        <span className="flex-1 truncate text-left text-white">{value}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="category-picker-title">
        <div className="p-5 pb-7">
          <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-line" />
          <h2 id="category-picker-title" className="text-[13px] font-semibold text-white">
            Category
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label={ariaLabel}>
            {categories.map((c) => {
              const CIcon = categoryIcons[c];
              const selected = c === value;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl py-3 text-[11px] outline-none transition focus-visible:ring-1 focus-visible:ring-accent/60 ${
                    selected ? "bg-accent/15 text-accent ring-1 ring-accent/40" : "bg-card2 text-muted hover:brightness-125"
                  }`}
                >
                  <CIcon size={18} />
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
}
