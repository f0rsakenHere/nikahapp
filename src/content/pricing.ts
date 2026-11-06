/* What membership costs.
 *
 * Sisters $9.99 a month, brothers $19.99, set by the client on
 * 6 Nov 2026 and replacing the per-connection packages this page used to
 * sell (1 for $29.99, 3 for $69.99, 5 for $99.99). The two models are
 * incompatible, so the old "No monthly subscription" promise went with
 * them — it would now be a lie on the page that exists to be honest.
 *
 * Nothing here is invented. Only the two prices were given, so only the
 * two prices are stated; what is free is taken from what the code
 * actually does, not from what a pricing page usually says.
 */
export const pricing = {
  benefits: [
    "Free to register, and free to browse.",
    "Asking to talk is free, and so is being asked.",
    /* Mirrors `freeMessagesPerConversation`, which defaults to 3 in
       src/lib/domain/settings.ts. Change the setting and this line has
       to change with it. */
    "The first three messages in every conversation are free.",
    "One monthly price. Nothing to pay per connection.",
  ],
  plans: [
    {
      who: "Sisters",
      price: "9.99",
      description: "Unlimited messages in every conversation you are part of.",
    },
    {
      who: "Brothers",
      price: "19.99",
      description: "Unlimited messages in every conversation you are part of.",
    },
  ],
  /* What the money is actually for, as the app enforces it. */
  included: [
    { what: "Register, and complete a profile", cost: "Free" },
    { what: "Browse the pool, and be browsed", cost: "Free" },
    { what: "Ask to talk, and answer someone who asks", cost: "Free" },
    { what: "The first three messages in a conversation", cost: "Free" },
    { what: "Every message after that", cost: "Membership" },
  ],
} as const;
