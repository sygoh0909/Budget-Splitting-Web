import type { LucideIcon } from "lucide-react";
import {
  UtensilsCrossed, ShoppingCart, Car, BedDouble, Compass, ShoppingBag, Ticket, HeartPulse, MoreHorizontal,
  Landmark, Smartphone, QrCode, Wallet,
} from "lucide-react";
import type { PaymentMethodType } from "./types";

export const personColors = [
  "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

// "Groceries" is new; every other name is unchanged so existing saved expenses still match.
export const categories = [
  "Food", "Groceries", "Transport", "Accommodation",
  "Activities", "Shopping", "Tickets", "Health", "Misc",
];

export const categoryIcons: Record<string, LucideIcon> = {
  Food: UtensilsCrossed,
  Groceries: ShoppingCart,
  Transport: Car,
  Accommodation: BedDouble,
  Activities: Compass,
  Shopping: ShoppingBag,
  Tickets: Ticket,
  Health: HeartPulse,
  Misc: MoreHorizontal,
};

export interface CurrencyOption {
  code: string;
  symbol: string;
}

export const currencies: CurrencyOption[] = [
  { code: "USD", symbol: "$" }, { code: "EUR", symbol: "€" }, { code: "GBP", symbol: "£" },
  { code: "MYR", symbol: "RM" }, { code: "SGD", symbol: "S$" }, { code: "JPY", symbol: "¥" },
  { code: "CNY", symbol: "¥" }, { code: "HKD", symbol: "HK$" }, { code: "TWD", symbol: "NT$" },
  { code: "KRW", symbol: "₩" }, { code: "AUD", symbol: "A$" }, { code: "NZD", symbol: "NZ$" },
  { code: "CAD", symbol: "C$" }, { code: "CHF", symbol: "Fr" }, { code: "SEK", symbol: "kr" },
  { code: "NOK", symbol: "kr" }, { code: "DKK", symbol: "kr" }, { code: "THB", symbol: "฿" },
  { code: "IDR", symbol: "Rp" }, { code: "PHP", symbol: "₱" }, { code: "VND", symbol: "₫" },
  { code: "INR", symbol: "₹" }, { code: "BDT", symbol: "৳" }, { code: "PKR", symbol: "₨" },
  { code: "AED", symbol: "د.إ" }, { code: "SAR", symbol: "﷼" }, { code: "TRY", symbol: "₺" },
  { code: "BRL", symbol: "R$" }, { code: "MXN", symbol: "MX$" }, { code: "ZAR", symbol: "R" },
];

export const accentColors = [
  { name: "Purple", value: "#8b5cf6" },
  { name: "Green", value: "#10b981" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Orange", value: "#f97316" },
  { name: "Cyan", value: "#06b6d4" },
];

export const DEFAULT_ACCENT = "#8b5cf6";

export interface PaymentMethodPreset {
  type: PaymentMethodType;
  label: string;
  icon: LucideIcon;
}

/** Presets shown when adding a payment method. "other" always sits last with an editable label. */
export const paymentMethodPresets: PaymentMethodPreset[] = [
  { type: "bank", label: "Bank Transfer", icon: Landmark },
  { type: "tng", label: "Touch 'n Go eWallet", icon: Smartphone },
  { type: "duitnow", label: "DuitNow QR", icon: QrCode },
  { type: "grabpay", label: "GrabPay", icon: Wallet },
  { type: "alipay", label: "Alipay", icon: Smartphone },
  { type: "paynow", label: "PayNow", icon: QrCode },
  { type: "other", label: "Other", icon: Wallet },
];

export const paymentMethodIcon = (type: PaymentMethodType): LucideIcon =>
  paymentMethodPresets.find((p) => p.type === type)?.icon ?? Wallet;
