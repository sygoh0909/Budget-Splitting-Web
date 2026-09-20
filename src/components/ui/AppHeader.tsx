import type { ReactNode } from "react";

/** The "SplitBudget" bar used across the sub-screens: [left] title [right] */
export function AppHeader({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-5 pt-4">
      <div className="flex w-9 justify-start">{left}</div>
      <span className="text-[19px] font-extrabold tracking-tight text-white">SplitBudget</span>
      <div className="flex w-9 justify-end">{right}</div>
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto min-h-screen w-full max-w-xl pb-16">{children}</main>;
}
