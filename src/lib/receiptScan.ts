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

/**
 * Free vision models, tried in order. Free models come and go on OpenRouter — override with
 * OPENROUTER_MODELS (comma-separated). "openrouter/free" is OpenRouter's own router that
 * picks any available free model that accepts images, so it works as a last resort.
 */
export const DEFAULT_MODELS = [
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nex-agi/nex-n2-pro:free",
];

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const FIRST_MODEL_TIMEOUT_MS = 42_000; // reasoning models "think" first and can be slow
const FALLBACK_TIMEOUT_MS = 20_000;
const TOTAL_BUDGET_MS = 57_000; // stay under the route's maxDuration (60s)

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
- The receipt may be in any language (English, Chinese, Malay, ...). Keep merchant and item names exactly as printed; do NOT translate them.
- title: use the merchant/restaurant name from the receipt
- date: use date on receipt if visible, otherwise use ${today}
- items: each food/drink/product line item with its price. Do NOT include tax, service charge, or rounding here.
- charges: ONLY extra lines like tax, service charge, rounding adjustment. Rules per charge:
  - If the receipt shows "Service Tax 10%" or "Service Charge 10%" → type: "service_tax", value: 10.0, isPercentage: true
  - If the receipt shows "SST 6%" or "GST 6%" or "Tax 6%" → type: "tax", value: 6.0, isPercentage: true
  - If the receipt shows "Rounding" or "Rounding Adj" with a small flat amount like 0.01 or -0.02 → type: "rounding", value: 0.01, isPercentage: false
  - CRITICAL: isPercentage must be true ONLY when the charge is expressed as a % rate on the receipt. If the receipt shows the tax as a computed flat amount (e.g. "Service Tax  RM3.50") use isPercentage: false with that exact flat amount.
  - Do NOT guess a percentage if the receipt only shows a flat amount for a charge.
- Lines that are NOT items: subtotal (小计), total (合计 / 总计 / 应付 / 实付), payment method and change (微信 / 支付宝 / 现金 / 找零 / 实收), receipt or table numbers.
- If a line shows quantity × unit price (e.g. "2 x 15.00"), the item amount is the LINE TOTAL (30.00).
- Discounts (折扣 / 优惠 / 满减 / 抵扣) are items with a NEGATIVE amount, e.g. {"title": "Discount", "amount": -5.00, "category": "Food"}.
- Chinese receipts: prices usually already include VAT (增值税 / 税额 / 含税). Do NOT add VAT as a charge when item prices already include it. Only add a charge if the receipt clearly adds it on top of the item total. A service fee (服务费) is a "service_tax" charge. Rounding-off (抹零 / 四舍五入) is a "rounding" charge with a negative flat amount.
- Dates like 2026年3月2日 or 2026/3/2 must be converted to YYYY-MM-DD.
- Ignore currency symbols (¥, RMB, RM, $) in amounts.
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

/** "2026/3/2", "2026.03.02", "2026年3月2日" → "2026-03-02" (null if unparseable) */
export function normalizeDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [m[1], m[2].padStart(2, "0"), m[3].padStart(2, "0")];
  return +mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31 ? `${y}-${mo}-${d}` : null;
}

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

  const date = normalizeDate(data.date) ?? today;
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

/** Best-effort short reason from an OpenRouter error body. */
async function errorDetail(res: Response): Promise<string> {
  const j = await res.json().catch(() => null);
  const msg = j?.error?.message ?? j?.message;
  return `HTTP ${res.status}${typeof msg === "string" ? ` – ${msg.slice(0, 110)}` : ""}`;
}

export async function scanReceipt({ imageDataUrl, apiKey, models = DEFAULT_MODELS, fetchImpl = fetch }: ScanOptions): Promise<ScanResult> {
  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildPrompt(today);
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const problems: string[] = []; // one short reason per failed attempt, shown to the user and logged

  for (const [index, model] of models.entries()) {
    const label = model.split("/").pop() ?? model;
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
      const remaining = deadline - Date.now();
      if (remaining < 3000) {
        problems.push("ran out of time");
        throw new Error(failMessage(problems));
      }
      const timeoutMs = Math.min(remaining - 1000, index === 0 ? FIRST_MODEL_TIMEOUT_MS : FALLBACK_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
        problems.push(`${label}: ${timedOut ? `no answer after ${Math.round(timeoutMs / 1000)}s` : "network error"}`);
        break; // next model
      }

      if (res.status === 429) {
        problems.push(`${label}: rate limited`);
        await sleep((attempt + 1) * 2000);
        continue; // retry the same model
      }
      if (!res.ok) {
        problems.push(`${label}: ${await errorDetail(res)}`);
        if (res.status === 401 || res.status === 403) throw new Error(failMessage(problems)); // key problem — other models won't help
        break; // next model
      }

      try {
        const json = await res.json();
        const message = json?.choices?.[0]?.message;
        const raw: unknown = message?.content ?? message?.text;
        // some providers return content as an array of {type:"text", text} parts
        const content = Array.isArray(raw) ? raw.map((p) => (typeof p?.text === "string" ? p.text : "")).join("") : raw;
        if (typeof content !== "string" || !content.trim()) {
          problems.push(`${label}: empty reply`);
          break;
        }
        return normalizeResult(parseModelJson(content), today);
      } catch {
        problems.push(`${label}: reply wasn't valid JSON`);
        break;
      }
    }
  }
  throw new Error(failMessage(problems));
}

function failMessage(problems: string[]): string {
  console.error("[scan] failed:", problems.join(" | "));
  const authProblem = problems.some((p) => /HTTP 40[13]/.test(p));
  const head = authProblem
    ? "OpenRouter rejected the API key — check OPENROUTER_API_KEY in Vercel."
    : "Couldn't read that receipt.";
  return `${head} (${problems.slice(-3).join("; ")})`;
}
