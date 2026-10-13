export interface TourStep {
  id: string;
  /** CSS selector for the real, live element this step points at. Omit for a centered, non-anchored step (welcome / done). */
  selector?: string;
  title: string;
  body: string;
  /**
   * What the person must actually do before this step can move on — "Next" alone is never
   * enough for a gated step, only real interaction with the live element is:
   *  - "click": a real click/tap on the target.
   *  - "type": real text typed into the target (a text input).
   *  - undefined: no gate — an informational bookend step (welcome/done), Next always works.
   */
  gate?: "click" | "type";
  /**
   * Only meaningful when gate is "click".
   * true: the click *is* the navigation (open the book, tap Add Expense, hit Save, open
   *   Balances) — the tour jumps straight to the next step the instant it happens, and the
   *   "Next" button is hidden entirely so there's no way to skip performing the action.
   * false: the click opens a further picker (Paid by / Category / Split) that may render as
   *   its own overlay — don't dim the screen over it, just unlock "Next" once a click on the
   *   trigger is detected, so the person can freely browse the picker before confirming.
   */
  autoAdvance?: boolean;
  /** Which real screen this step expects to be on, so "Back" can restore it (see OnboardingTour). */
  route?: "home" | "book";
  /** Whether the expense form is expected to be open for this step, so "Back" can close it again. */
  modalOpen?: boolean;
}

/**
 * The first-run walkthrough. Every step (other than the welcome/closing bookends) is
 * anchored to a real element in the live app via a `data-tour="<id>"` attribute and, for
 * anything actionable, gated on actually doing it — typing a real title, opening a real
 * picker, tapping a real button — rather than clicking through generic slides.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to SplitBudget",
    body: "We've already set up a personal book for you. Let's walk through exactly how the app works, on the real thing — try each step for real as we go.",
  },
  {
    id: "home-book-card",
    selector: '[data-tour="home-book-card"]',
    title: "Your personal book",
    body: "This was created for you automatically — anything you add here is tracked just for you. Tap it to open it.",
    gate: "click",
    autoAdvance: true,
    route: "home",
  },
  {
    id: "add-expense-btn",
    selector: '[data-tour="add-expense-btn"]',
    title: "Add an expense",
    body: "Tap “Add Expense” to open the form and log your first one.",
    gate: "click",
    autoAdvance: true,
    route: "book",
    modalOpen: false,
  },
  {
    id: "expense-title-field",
    selector: '[data-tour="expense-title-field"]',
    title: "Give it a title",
    body: "Type a short name for it — anything you like, this is just practice. E.g. “Groceries” or “Dinner at Ichiran”.",
    gate: "type",
    route: "book",
    modalOpen: true,
  },
  {
    id: "expense-paidby-field",
    selector: '[data-tour="expense-paidby-field"]',
    title: "Choose who paid",
    body: "Open this and pick a person. If you're splitting costs with others, this is how SplitBudget knows who to credit when it works out the balances.",
    gate: "click",
    autoAdvance: false,
    route: "book",
    modalOpen: true,
  },
  {
    id: "expense-category-field",
    selector: '[data-tour="expense-category-field"]',
    title: "Give it a category",
    body: "Open this and tap one — Food, Groceries, Transport, and more — so it's easy to spot in the list later.",
    gate: "click",
    autoAdvance: false,
    route: "book",
    modalOpen: true,
  },
  {
    id: "expense-item-title-field",
    selector: '[data-tour="expense-item-title-field"]',
    title: "Name the item",
    body: "Every expense is made of one or more items — type a name for this one, e.g. “Ramen” or “Taxi”.",
    gate: "type",
    route: "book",
    modalOpen: true,
  },
  {
    id: "expense-item-split-field",
    selector: '[data-tour="expense-item-split-field"]',
    title: "Split it",
    body: "Open this and tick who it should be split between — or choose “Everyone”. Mix and match per item, e.g. one person's solo coffee vs. a shared meal. When the book has two or more people, a “By portion” switch appears under it: give each person a number of parts (say 2 and 1, so they pay 2/3 and 1/3) — and 0 means they're not involved.",
    gate: "click",
    autoAdvance: false,
    route: "book",
    modalOpen: true,
  },
  {
    id: "expense-save-btn",
    selector: '[data-tour="expense-save-btn"]',
    title: "Save it",
    body: "Tap Save to log it for real.",
    gate: "click",
    autoAdvance: true,
    route: "book",
    modalOpen: true,
  },
  {
    id: "tab-people",
    selector: '[data-tour="tab-people"]',
    title: "Who's in this book",
    body: "Tap the People tab to see everyone you split costs with.",
    gate: "click",
    autoAdvance: true,
    route: "book",
    modalOpen: false,
  },
  {
    id: "people-actions",
    selector: '[data-tour="people-actions"]',
    title: "Add people",
    body: "Add a placeholder for a friend who doesn't have an account yet — they can claim their spot later. In a shared book, “Invite code” copies the code friends use to join.",
    route: "book",
    modalOpen: false,
  },
  {
    id: "people-first",
    selector: '[data-tour="people-first"]',
    title: "Paid vs. should pay",
    body: "Each person shows what they've paid so far and what they still should pay, based on the items they're split on.",
    route: "book",
    modalOpen: false,
  },
  {
    id: "tab-balances",
    selector: '[data-tour="tab-balances"]',
    title: "Balances, done automatically",
    body: "Tap the Balances tab — it nets everything out and shows exactly who owes whom, no calculator needed.",
    gate: "click",
    autoAdvance: true,
    route: "book",
    modalOpen: false,
  },
  {
    id: "balances-explain",
    title: "Reading the balances",
    body: "Under “Owes”, each row says who owes whom and how much — tap a row to see which expenses it comes from. The check button marks it as settled once it's paid, and settled people move to the “Settled” list. Portion splits are already worked into these numbers.",
    route: "book",
    modalOpen: false,
  },
  {
    id: "payments-qr",
    title: "Pay with a QR code",
    body: "Next to each debt is a small QR button. Tap it to see the other person's payment QR (bank, e-wallet…) and the amount to send. To receive money this way, add your own QR under Profile → Payment Methods: tap Add, pick the type, upload a screenshot of your QR, and optionally add an account or phone number.",
    route: "book",
    modalOpen: false,
  },
  {
    id: "done",
    title: "You're all set",
    body: "You can replay this walkthrough or read any topic again anytime from Profile → Tutorial.",
  },
];
