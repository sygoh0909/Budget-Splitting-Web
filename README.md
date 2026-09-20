# SplitBudget (web)

Split expenses with friends — create shared books, add expenses, assign each item to the people sharing it,
and see exactly who owes whom. Next.js + Firebase (Auth + Firestore), ready to deploy on Vercel.

This is the web port of the Flutter app. Same Firebase project, same Firestore data model, so existing
accounts and books keep working.

## What changed vs. the Flutter app
- **Website, not an app** — Next.js (App Router) + TypeScript + Tailwind; each screen is a real URL.
- **Receipt scanning / AI removed** — no OpenRouter, no camera button, no API key.
- **Assigning people is a dropdown** — each item has a "Split" dropdown (tick one or more people, or *Everyone*)
  instead of a row of person chips. *Paid by* is a normal select.

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
```

## Deploy to Vercel
1. Push this folder to a Git repo and import it at vercel.com/new (framework is auto-detected as Next.js), or run `npx vercel`.
2. **Firebase Console → Authentication → Settings → Authorized domains → Add** your `*.vercel.app` domain
   (and any custom domain). Needed for password-reset links and to avoid `unauthorized-domain` errors.
3. Deploy the Firestore rules and index (once): `npx firebase-tools deploy --only firestore`
   (`firestore.rules` and `firestore.indexes.json` are included and unchanged from the Flutter project).

No environment variables are required — the Firebase web config is bundled (it's public by design; access is
enforced by Auth + the Firestore rules). To use a different Firebase project, copy `.env.example` to `.env.local`
and set the `NEXT_PUBLIC_FIREBASE_*` values, and mirror them in Vercel's Environment Variables.

## How splitting works
Every expense has line items; each item lists who shares it. Extra charges (tax, service tax, rounding) are
spread over items in proportion to price:

```
chargeForItem = totalCharges × (item.amount / sum of all items)
personPays    = (item.amount + chargeForItem) / number of people on the item
```
Balances are then netted pairwise (A owes B 30, B owes A 10 → A owes B 20). A settlement is stored as an
expense titled `settlement:<from>:<to>`.

## Structure
```
src/app/                 routes: / · /books/new · /books/join · /books/[id] · /books/[id]/edit · /profile
src/components/          screens + PeopleSelect (the dropdown) + ExpenseModal
src/lib/split.ts         balance / settlement maths
src/lib/db.ts, auth.ts   Firestore + Auth (port of the Dart services)
firestore.rules          security rules
```

## Still placeholders (same as the Flutter app)
Notifications, the Settings rows, and Send Feedback on the profile screen are UI only.
