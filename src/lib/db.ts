import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { personColors } from "./constants";
import type {
  AdditionalCharge,
  AppUser,
  Book,
  Expense,
  ExpenseItem,
  JoinRequest,
  PaymentMethod,
  Person,
} from "./types";

const booksRef = () => collection(db, "books");
const usersRef = () => collection(db, "users");
const paymentMethodsRef = () => collection(db, "paymentMethods");
const expensesRef = (bookId: string) => collection(db, "books", bookId, "expenses");

/* ── Serialization ───────────────────────────────────────────────────────── */

const personToMap = (p: Person) => ({
  id: p.id,
  name: p.name,
  color: p.color,
  isPlaceholder: p.isPlaceholder,
});

const joinRequestToMap = (r: JoinRequest) => ({
  userId: r.userId,
  userName: r.userName,
  requestedAt: r.requestedAt,
});

const personFromMap = (p: DocumentData): Person => ({
  id: p.id,
  name: p.name,
  color: p.color,
  isPlaceholder: p.isPlaceholder ?? false,
});

const joinRequestFromMap = (r: DocumentData): JoinRequest => ({
  userId: r.userId,
  userName: r.userName,
  requestedAt: r.requestedAt,
});

function bookFromDoc(snap: DocumentSnapshot): Book {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    name: d.name ?? "",
    destination: d.destination ?? "",
    emoji: d.emoji ?? "",
    currency: d.currency ?? "$",
    type: d.type === "personal" ? "personal" : "shared",
    people: ((d.people as DocumentData[] | undefined) ?? []).map(personFromMap),
    deletedPeople: ((d.deletedPeople as DocumentData[] | undefined) ?? []).map(personFromMap),
    joinRequests: ((d.joinRequests as DocumentData[] | undefined) ?? []).map(joinRequestFromMap),
    createdAt: d.createdAt ?? "",
    inviteCode: d.inviteCode ?? null,
    maxSize: d.maxSize ?? null,
  };
}

function expenseFromDoc(snap: DocumentSnapshot): Expense {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    title: d.title ?? "",
    date: d.date ?? "",
    paidBy: d.paidBy ?? "",
    note: d.note ?? null,
    hasReceipt: d.hasReceipt ?? false,
    items: ((d.items as DocumentData[] | undefined) ?? []).map(
      (i): ExpenseItem => ({
        id: i.id ?? "",
        title: i.title ?? "",
        amount: typeof i.amount === "number" ? i.amount : 0,
        category: i.category ?? "Misc",
        splitWith: Array.isArray(i.splitWith) ? [...i.splitWith] : [],
      }),
    ),
    additionalCharges: ((d.additionalCharges as DocumentData[] | undefined) ?? []).map(
      (c): AdditionalCharge => ({
        id: c.id ?? "",
        type: c.type ?? "tax",
        label: c.label ?? "",
        value: typeof c.value === "number" ? c.value : 0,
        isPercentage: c.isPercentage ?? true,
      }),
    ),
  };
}

const expenseToMap = (e: Expense) => ({
  title: e.title,
  date: e.date,
  paidBy: e.paidBy,
  note: e.note,
  hasReceipt: e.hasReceipt,
  items: e.items.map((i) => ({
    id: i.id,
    title: i.title,
    amount: i.amount,
    category: i.category,
    splitWith: i.splitWith,
  })),
  additionalCharges: e.additionalCharges.map((c) => ({
    id: c.id,
    type: c.type,
    label: c.label,
    value: c.value,
    isPercentage: c.isPercentage,
  })),
});

/* ── Users ───────────────────────────────────────────────────────────────── */

export async function createOrUpdateUser(user: Pick<AppUser, "uid" | "displayName" | "email" | "createdAt"> & { photoUrl?: string | null }) {
  const ref = doc(usersRef(), user.uid);
  const existing = await getDoc(ref);
  const data: Record<string, unknown> = {
    displayName: user.displayName,
    email: user.email,
    photoUrl: user.photoUrl ?? null,
  };
  if (!existing.exists()) data.createdAt = user.createdAt;
  await setDoc(ref, data, { merge: true });
}

const paymentMethodFromMap = (m: DocumentData): PaymentMethod => ({
  id: m.id ?? "",
  type: m.type ?? "other",
  label: m.label ?? "",
  qrImage: m.qrImage ?? "",
  note: m.note ?? null,
});

const paymentMethodToMap = (m: PaymentMethod) => ({
  id: m.id,
  type: m.type,
  label: m.label,
  qrImage: m.qrImage,
  note: m.note,
});

export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(usersRef(), uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid: snap.id,
    displayName: d.displayName ?? "",
    email: d.email ?? "",
    photoUrl: d.photoUrl ?? null,
    createdAt: d.createdAt ?? "",
    accentColor: d.accentColor ?? null,
    onboardingSeen: d.onboardingSeen ?? false,
  };
}

export async function saveAccentColor(uid: string, hexColor: string) {
  await setDoc(doc(usersRef(), uid), { accentColor: hexColor }, { merge: true });
}

/**
 * Payment QR codes live in their own collection (not on the /users doc) so that any signed-in
 * member can read a payee's methods without also being able to read their email — see firestore.rules.
 */
export async function getPaymentMethods(uid: string): Promise<PaymentMethod[]> {
  const snap = await getDoc(doc(paymentMethodsRef(), uid));
  if (!snap.exists()) return [];
  return ((snap.data().methods as DocumentData[] | undefined) ?? []).map(paymentMethodFromMap);
}

export async function savePaymentMethods(uid: string, methods: PaymentMethod[]) {
  await setDoc(doc(paymentMethodsRef(), uid), { methods: methods.map(paymentMethodToMap) }, { merge: true });
}

export async function markOnboardingSeen(uid: string) {
  await setDoc(doc(usersRef(), uid), { onboardingSeen: true }, { merge: true });
}

/* ── Books ───────────────────────────────────────────────────────────────── */

export async function createBook(book: Book) {
  await setDoc(doc(booksRef(), book.id), {
    name: book.name,
    destination: book.destination,
    emoji: book.emoji,
    currency: book.currency,
    type: book.type,
    people: book.people.map(personToMap),
    deletedPeople: book.deletedPeople.map(personToMap),
    joinRequests: book.joinRequests.map(joinRequestToMap),
    memberIds: book.people.map((p) => p.id),
    createdAt: book.createdAt,
    inviteCode: book.inviteCode,
    maxSize: book.maxSize,
  });
}

export async function ensurePersonalBook(userId: string, displayName: string) {
  const id = `${userId}_personal`;
  const existing = await getDoc(doc(booksRef(), id));
  if (existing.exists()) return;
  await createBook({
    id,
    name: "Personal",
    destination: "",
    emoji: "",
    currency: "$",
    type: "personal",
    people: [{ id: userId, name: displayName, color: personColors[0], isPlaceholder: false }],
    deletedPeople: [],
    joinRequests: [],
    createdAt: new Date().toISOString(),
    inviteCode: null,
    maxSize: null,
  });
}

export function watchBooks(
  userId: string,
  onData: (books: Book[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(booksRef(), where("memberIds", "array-contains", userId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => onData(snap.docs.map(bookFromDoc)), onError);
}

export function watchBook(
  bookId: string,
  onData: (book: Book | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(booksRef(), bookId),
    (snap) => onData(snap.exists() ? bookFromDoc(snap) : null),
    onError,
  );
}

export async function getBookByInviteCode(code: string): Promise<Book | null> {
  const normalized = code.trim().toUpperCase();
  // exact match first, then lowercase (old entries), then the raw input
  for (const candidate of [normalized, normalized.toLowerCase(), code.trim()]) {
    const snap = await getDocs(query(booksRef(), where("inviteCode", "==", candidate), limit(1)));
    if (!snap.empty) return bookFromDoc(snap.docs[0]);
  }
  return null;
}

export async function updateBook(book: Book) {
  await updateDoc(doc(booksRef(), book.id), {
    name: book.name,
    destination: book.destination,
    currency: book.currency,
    people: book.people.map(personToMap),
    deletedPeople: book.deletedPeople.map(personToMap),
    joinRequests: book.joinRequests.map(joinRequestToMap),
    memberIds: book.people.map((p) => p.id),
  });
}

export async function addJoinRequest(bookId: string, userId: string, userName: string) {
  const snap = await getDoc(doc(booksRef(), bookId));
  if (!snap.exists()) return;
  const requests = bookFromDoc(snap).joinRequests;
  if (requests.some((r) => r.userId === userId)) return;
  requests.push({ userId, userName, requestedAt: new Date().toISOString() });
  await updateDoc(doc(booksRef(), bookId), {
    joinRequests: requests.map(joinRequestToMap),
    joinRequestUserIds: requests.map((r) => r.userId),
  });
}

export async function approveJoinRequest(bookId: string, userId: string, userName: string, userColor: string) {
  const snap = await getDoc(doc(booksRef(), bookId));
  if (!snap.exists()) return;
  const book = bookFromDoc(snap);

  const people = [...book.people, { id: userId, name: userName, color: userColor, isPlaceholder: false }];
  const deletedPeople = book.deletedPeople.filter((p) => p.id !== userId);
  const requests = book.joinRequests.filter((r) => r.userId !== userId);

  await updateDoc(doc(booksRef(), bookId), {
    people: people.map(personToMap),
    deletedPeople: deletedPeople.map(personToMap),
    joinRequests: requests.map(joinRequestToMap),
    joinRequestUserIds: requests.map((r) => r.userId),
    memberIds: people.map((p) => p.id),
  });
}

export async function denyJoinRequest(bookId: string, userId: string) {
  const snap = await getDoc(doc(booksRef(), bookId));
  if (!snap.exists()) return;
  const requests = bookFromDoc(snap).joinRequests.filter((r) => r.userId !== userId);
  await updateDoc(doc(booksRef(), bookId), {
    joinRequests: requests.map(joinRequestToMap),
    joinRequestUserIds: requests.map((r) => r.userId),
  });
}

/** Merge a placeholder person into a real member: re-point every expense at the claimer. */
export async function claimPlaceholder(bookId: string, placeholderId: string, claimerId: string) {
  const bookSnap = await getDoc(doc(booksRef(), bookId));
  if (!bookSnap.exists()) return;
  const book = bookFromDoc(bookSnap);

  const people = book.people.filter((p) => p.id !== placeholderId);
  const deletedPeople = book.deletedPeople.filter((p) => p.id !== placeholderId);

  await updateDoc(doc(booksRef(), bookId), {
    people: people.map(personToMap),
    deletedPeople: deletedPeople.map(personToMap),
    memberIds: people.map((p) => p.id),
  });

  const expSnap = await getDocs(expensesRef(bookId));
  const batch = writeBatch(db);
  for (const d of expSnap.docs) {
    const data = d.data();
    let changed = false;

    let paidBy: string = data.paidBy ?? "";
    if (paidBy === placeholderId) {
      paidBy = claimerId;
      changed = true;
    }

    const items = ((data.items as DocumentData[] | undefined) ?? []).map((i) => {
      const splitWith: string[] = Array.isArray(i.splitWith) ? [...i.splitWith] : [];
      const idx = splitWith.indexOf(placeholderId);
      if (idx !== -1) {
        if (splitWith.includes(claimerId)) splitWith.splice(idx, 1);
        else splitWith[idx] = claimerId;
        changed = true;
      }
      return { ...i, splitWith };
    });

    if (changed) batch.update(d.ref, { paidBy, items });
  }
  await batch.commit();
}

export async function deleteBook(bookId: string) {
  const expSnap = await getDocs(expensesRef(bookId));
  const batch = writeBatch(db);
  expSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(booksRef(), bookId));
  await batch.commit();
}

/* ── Expenses ────────────────────────────────────────────────────────────── */

export function watchExpenses(
  bookId: string,
  onData: (expenses: Expense[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(expensesRef(bookId), orderBy("date", "desc"));
  return onSnapshot(q, (snap) => onData(snap.docs.map(expenseFromDoc)), onError);
}

export async function upsertExpense(bookId: string, expense: Expense) {
  await setDoc(doc(expensesRef(bookId), expense.id), expenseToMap(expense), { merge: true });
}

export async function deleteExpense(bookId: string, expenseId: string) {
  await deleteDoc(doc(expensesRef(bookId), expenseId));
}
