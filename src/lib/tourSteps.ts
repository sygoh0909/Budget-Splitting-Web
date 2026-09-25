export interface TourStep {
  id: string;
  /** CSS selector for the real, live element this step points at. Omit for a centered, non-anchored step (welcome / done). */
  selector?: string;
  title: string;
  body: string;
  /** If true, clicking the real target advances the tour (the step is "do this", not just "look at this"). */
  advanceOnClick?: boolean;
}

/**
 * The first-run walkthrough. Every step (other than the welcome/closing bookends) is
 * anchored to a real element in the live app via a `data-tour="<id>"` attribute, so the
 * tour spotlights the actual button/field the person will use — not a mockup of it.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to SplitBudget",
    body: "We've already set up a personal book for you. Let's walk through exactly how the app works, on the real thing.",
  },
  {
    id: "home-book-card",
    selector: '[data-tour="home-book-card"]',
    title: "Your personal book",
    body: "This was created for you automatically — anything you add here is tracked just for you. Tap it to open it.",
    advanceOnClick: true,
  },
  {
    id: "add-expense-btn",
    selector: '[data-tour="add-expense-btn"]',
    title: "Add an expense",
    body: "Tap “Add Expense” to open the form and log your first one.",
    advanceOnClick: true,
  },
  {
    id: "expense-title-field",
    selector: '[data-tour="expense-title-field"]',
    title: "Give it a title",
    body: "A short name, like “Groceries” or “Dinner at Ichiran”.",
  },
  {
    id: "expense-paidby-field",
    selector: '[data-tour="expense-paidby-field"]',
    title: "Choose who paid",
    body: "If you're splitting costs with others, this is how SplitBudget knows who to credit when it works out the balances.",
  },
  {
    id: "expense-category-field",
    selector: '[data-tour="expense-category-field"]',
    title: "Give it a category",
    body: "Food, Groceries, Transport, and more — pick one so it's easy to spot in the list later.",
  },
  {
    id: "expense-item-split-field",
    selector: '[data-tour="expense-item-split-field"]',
    title: "Split each item",
    body: "For every item, tick who it should be split between — or choose “Everyone”. Mix and match per item, e.g. one person's solo coffee vs. a shared meal.",
  },
  {
    id: "expense-save-btn",
    selector: '[data-tour="expense-save-btn"]',
    title: "Save it",
    body: "Tap Save to log it — or close the form for now and just keep exploring. Nothing here is saved until you do.",
  },
  {
    id: "tab-balances",
    selector: '[data-tour="tab-balances"]',
    title: "Balances, done automatically",
    body: "This tab nets everything out and shows exactly who owes whom — nobody has to do the maths by hand.",
    advanceOnClick: true,
  },
  {
    id: "done",
    title: "You're all set",
    body: "One more tip: add a bank or e-wallet QR code under Profile → Payment Methods, so people who owe you can pay you straight from the app.",
  },
];
