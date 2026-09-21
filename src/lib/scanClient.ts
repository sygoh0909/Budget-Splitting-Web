import type { User } from "firebase/auth";
import type { AdditionalCharge, Expense } from "./types";
import type { ScanResult } from "./receiptScan";
import { generateUuid } from "./util";

const MAX_SIDE = 2000; // dense small print (e.g. Chinese receipts) needs resolution
const MAX_DATA_URL_CHARS = 3_400_000; // Vercel rejects request bodies over ~4.5 MB

/** Shrink a photo to a ≤2000px JPEG data URL so it fits Vercel's ~4.5 MB request limit. */
export async function imageToScanDataUrl(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read that image. Try a JPEG or PNG photo.");
  }
  let side = MAX_SIDE;
  let quality = 0.9;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  let out = "";
  // step quality then size down until it fits the upload limit
  for (let i = 0; i < 5; i++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.fillStyle = "#fff"; // PNG transparency → white, JPEG has no alpha
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    out = canvas.toDataURL("image/jpeg", quality);
    if (out.length <= MAX_DATA_URL_CHARS) break;
    quality = Math.max(0.6, quality - 0.1);
    side = Math.round(side * 0.85);
  }
  bitmap.close();
  return out;
}

/** Scan a receipt photo and return a pre-filled (unassigned) expense to review. */
export async function scanReceiptFile(user: User, file: File, paidBy: string): Promise<Expense> {
  const image = await imageToScanDataUrl(file);
  const token = await user.getIdToken();

  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ image }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Scan failed (${res.status})`);

  const result = data as ScanResult;
  return {
    id: generateUuid(),
    title: result.title,
    date: result.date,
    paidBy,
    note: null,
    hasReceipt: true,
    // items come back unassigned — the person picks who shares each one in the dropdown
    items: result.items.map((i) => ({ id: generateUuid(), title: i.title, amount: i.amount, category: i.category, splitWith: [] })),
    additionalCharges: result.charges.map((c): AdditionalCharge => ({ id: generateUuid(), ...c })),
  };
}
