import { currencies } from "@/lib/constants";

export function CurrencyPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Currency">
      {currencies.map((c) => {
        const selected = value === c.code;
        return (
          <button
            key={c.code}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(c.code)}
            className={`rounded-xl px-3 py-2 text-[13px] transition ${
              selected ? "bg-accent font-bold text-white" : "bg-card text-muted hover:brightness-125"
            }`}
          >
            {c.symbol} {c.code}
          </button>
        );
      })}
    </div>
  );
}
