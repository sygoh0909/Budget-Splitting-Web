export interface Person {
  id: string;
  name: string;
  /** hex colour, e.g. "#10b981" */
  color: string;
  isPlaceholder: boolean;
}

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  /** person ids sharing this item; empty = not assigned yet */
  splitWith: string[];
}

export type ChargeType = "tax" | "service_tax" | "rounding";

export interface AdditionalCharge {
  id: string;
  type: ChargeType;
  label: string;
  /** percentage for tax / service tax, flat amount for rounding */
  value: number;
  isPercentage: boolean;
}

export interface Expense {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** person id */
  paidBy: string;
  items: ExpenseItem[];
  additionalCharges: AdditionalCharge[];
  note: string | null;
  /** legacy flag from receipt scanning; kept so existing data round-trips */
  hasReceipt: boolean;
}

export type BookType = "personal" | "shared";

export interface JoinRequest {
  userId: string;
  userName: string;
  requestedAt: string;
}

export interface Book {
  id: string;
  name: string;
  destination: string;
  emoji: string;
  /** currency *symbol* (e.g. "RM"), purely a display label */
  currency: string;
  type: BookType;
  people: Person[];
  deletedPeople: Person[];
  joinRequests: JoinRequest[];
  createdAt: string;
  inviteCode: string | null;
  maxSize: number | null;
}

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoUrl: string | null;
  createdAt: string;
  accentColor: string | null;
}
