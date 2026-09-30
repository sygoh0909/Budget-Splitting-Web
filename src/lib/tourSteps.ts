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
    body: "Open this and tick who it should be split between — or choose “Everyone”. Mix and match per item, e.g. one person's solo coffee vs. a shared meal.",
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
    id: "done",
    title: "You're all set",
    body: "One more tip: add a bank or e-wallet QR code under Profile → Payment Methods, so people who owe you can pay you straight from the app.",
  },
];
