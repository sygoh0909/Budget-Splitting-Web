/**
 * Receipt parsing via OpenRouter's free vision models.
 * Port of the Flutter app's receipt_scan_service.dart — same models, same prompt,
 * same retry-on-429 and fall-back-to-next-model behaviour.
 *
 * SERVER ONLY: this uses the OpenRouter API key. It's imported by app/api/scan/route.ts
 * and must never be imported from a client component.
 */
import { categories } from "./constants";

export interface ScannedItem {
  title: string;
  amount: number;
  category: string;
}

export interface ScannedCharge {
  type: "tax" | "service_tax" | "rounding";
  label: string;
  value: number;
  isPercentage: boolean;
}

export interface ScanResult {
  title: string;
  date: string;
  items: ScannedItem[];
  charges: ScannedCharge[];
}

/** Free models come and go on OpenRouter — override with OPENROUTER_MODELS (comma-separated). */
export const DEFAULT_MODELS = [
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nex-agi/nex-n2-pro:free",
];

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const PER_CALL_TIMEOUT_MS = 25_000;
const TOTAL_BUDGET_MS = 55_000; // stay under the route's maxDuration (60s)

function buildPrompt(today: string): string {
  return `
You are a receipt parser. Extract data from this receipt image and return ONLY valid JSON, no markdown, no explanation.

Return this exact JSON structure:
{
  "title": "merchant name or short description",
  "date": "YYYY-MM-DD",
  "items": [
    {"title": "item name", "amount": 0.00, "category": "Food"}
  ],
  "charges": [
    {"type": "service_tax", "label": "Service Tax", "value": 10.0, "isPercentage": true}
  ]
}

Rules:
- title: use the merchant/restaurant name from the receipt
- date: use date on receipt if visible, otherwise use ${today}
- items: each food/drink/product line item with its price. Do NOT include tax, service charge, or rounding here.
- charges: ONLY extra lines like tax, service charge, rounding adjustment. Rules per charge:
  - If the receipt shows "Service Tax 10%" or "Service Charge 10%" → type: "service_tax", value: 10.0, isPercentage: true
  - If the receipt shows "SST 6%" or "GST 6%" or "Tax 6%" → type: "tax", value: 6.0, isPercentage: true
  - If the receipt shows "Rounding" or "Rounding Adj" with a small flat amount like 0.01 or -0.02 → type: "rounding", value: 0.01, isPercentage: false
  - CRITICAL: isPercentage must be true ONLY when the charge is expressed as a % rate on the receipt. If the receipt shows the tax as a computed flat amount (e.g. "Service Tax  RM3.50") use isPercentage: false with that exact flat amount.
  - Do NOT guess a percentage if the receipt only shows a flat amount for a charge.
- category must be one of: ${categories.join(", ")}
- If no charges found, use empty array []
- amounts must be numbers, not strings
`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse a model reply that may be wrapped in ```json fences or surrounded by chatter. */
export function parseModelJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function normalizeResult(data: Record<string, unknown>, today: string): ScanResult {
  const rawItems = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];
  const items: ScannedItem[] = rawItems.map((i) => ({
    title: String(i.title ?? "Item"),
    amount: num(i.amount),
    category: categories.includes(String(i.category)) ? String(i.category) : categories[0],
  }));

  const rawCharges = Array.isArray(data.charges) ? (data.charges as Record<string, unknown>[]) : [];
  const charges: ScannedCharge[] = rawCharges.map((c) => {
    const type = c.type === "service_tax" || c.type === "rounding" ? c.type : "tax";
    return {
      type,
      label: String(c.label ?? (type === "rounding" ? "Rounding Adjustment" : "Tax")),
      value: num(c.value),
      isPercentage: typeof c.isPercentage === "boolean" ? c.isPercentage : type !== "rounding",
    };
  });

  const date = typeof data.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : today;
  return {
    title: String(data.title ?? "Receipt"),
    date,
    items: items.length ? items : [{ title: "Item", amount: 0, category: categories[0] }],
    charges,
  };
}

interface ScanOptions {
  /** data:image/jpeg;base64,… */
  imageDataUrl: string;
  apiKey: string;
  models?: string[];
  /** injectable for tests */
  fetchImpl?: typeof fetch;
}

export async function scanReceipt({ imageDataUrl, apiKey, models = DEFAULT_MODELS, fetchImpl = fetch }: ScanOptions): Promise<ScanResult> {
  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildPrompt(today);
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError = "No model available";

  for (const model of models) {
    const body = JSON.stringify({
      model,
      provider: { allow_fallbacks: false },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      if (Date.now() > deadline) throw new Error(`Scan timed out. ${lastError}`);
      let res: Response;
      try {
        res = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body,
          signal: AbortSignal.timeout(PER_CALL_TIMEOUT_MS),
        });
      } catch (err) {
        lastError = `${model}: ${err instanceof Error ? err.message : "request failed"}`;
        break; // network error / timeout → next model
      }

      if (res.status === 429) {
        lastError = `${model}: rate limited`;
        await sleep((attempt + 1) * 2000);
        continue; // retry the same model
      }
      if (!res.ok) {
        lastError = `${model}: HTTP ${res.status}`;
        break; // next model
      }

      try {
        const json = await res.json();
        const message = json?.choices?.[0]?.message;
        const content: unknown = message?.content ?? message?.text;
        if (typeof content !== "string" || !content.trim()) {
          lastError = `${model}: empty response`;
          break;
        }
        return normalizeResult(parseModelJson(content), today);
      } catch {
        lastError = `${model}: unreadable response`;
        break;
      }
    }
  }
  throw new Error(`Couldn't read that receipt (${lastError}). Try a clearer photo or enter it manually.`);
}
