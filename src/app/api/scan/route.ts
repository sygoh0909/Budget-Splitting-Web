import { NextResponse } from "next/server";
import { firebaseConfig } from "@/lib/firebaseConfig";
import { DEFAULT_MODELS, scanReceipt } from "@/lib/receiptScan";

export const runtime = "nodejs";
// free vision models can be slow and get retried; needs the longer limit
export const maxDuration = 60;

const MAX_DATA_URL_CHARS = 4_000_000; // Vercel rejects request bodies over ~4.5 MB

/** Confirm the Firebase ID token is real (no service account needed). */
async function isValidFirebaseUser(idToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.users) && data.users.length > 0;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Receipt scanning isn't set up on this site yet." }, { status: 503 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !(await isValidFirebaseUser(token))) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  let image: unknown;
  try {
    ({ image } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_DATA_URL_CHARS) {
    return NextResponse.json({ error: "Please upload a JPEG, PNG or WebP image under 3 MB." }, { status: 400 });
  }

  const models = process.env.OPENROUTER_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? DEFAULT_MODELS;

  try {
    const result = await scanReceipt({ imageDataUrl: image, apiKey, models });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[scan]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Scan failed." }, { status: 502 });
  }
}
