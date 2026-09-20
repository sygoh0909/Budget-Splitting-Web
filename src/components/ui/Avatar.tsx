import { firstLetter, withAlpha } from "@/lib/util";

export function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: withAlpha(color, 0.16),
        color,
        fontSize: size * 0.38,
      }}
    >
      {firstLetter(name)}
    </span>
  );
}
