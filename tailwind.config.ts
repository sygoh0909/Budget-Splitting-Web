import type { Config } from "tailwindcss";

// Palette ported 1:1 from the Flutter AppThemeData.
// `accent` is driven by a CSS variable so the user's chosen accent colour can be
// swapped at runtime, and still supports opacity modifiers (e.g. bg-accent/15).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#000000",
        card: "#1c1c1e",
        card2: "#2c2c2e",
        line: "#38383a",
        muted: "#8e8e93",
        dim: "#48484a",
        warn: "#f59e0b",
        danger: "#ef4444",
        accent: "rgb(var(--accent) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
