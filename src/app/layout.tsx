import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "SplitBudget",
  description: "Split expenses with friends — track, assign, and settle up.",
  icons: { icon: "/favicon.png", apple: "/icons/Icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg font-sans text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
