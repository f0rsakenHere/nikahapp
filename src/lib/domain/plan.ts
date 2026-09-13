/* The paywall on talking.
 *
 * Sending interest is free for everybody and sisters never pay. Once two
 * people have both said yes, a brother may send a few messages in that
 * conversation for free; after that, sending another needs a plan.
 *
 * The rule lives here, pure, so that the send action and the screen ask
 * the same question and cannot disagree about the answer — a composer
 * that shows "1 free message left" above a button the server refuses is
 * worse than no counter at all.
 *
 * Pure: no clock, no I/O. `now` and the counts are passed in.
 */

export type PlanSettings = {
  planGate: "brother" | "everybody" | "nobody";
  freeMessagesPerConversation: number;
};

/** Whether this account is paid up at `now`. A plan ends by itself: an
 *  expiry in the past is simply no plan. */
export function hasActivePlan(
  user: { planActiveUntil?: Date | null },
  now: Date
): boolean {
  return Boolean(user.planActiveUntil && user.planActiveUntil > now);
}

export type MessageAllowance =
  /* The paywall does not apply to this person at all. */
  | { gated: false }
  /* It applies. `left` counts down to zero; at zero, `needsPlan`. */
  | { gated: true; free: number; used: number; left: number; needsPlan: boolean };

/** How much this person may still say in this conversation before a plan
 *  is needed.
 *
 *  `sentSoFar` is the number of messages *they* have already sent in
 *  *this* conversation — never the other person's, and never another
 *  conversation's. The next message is free while `sentSoFar` is below
 *  the allowance, so with an allowance of three the fourth is the first
 *  that needs a plan. */
export function messageAllowance(
  who: {
    role: "member" | "wali";
    gender: "brother" | "sister" | null;
    sentSoFar: number;
    hasPlan: boolean;
  },
  settings: PlanSettings
): MessageAllowance {
  if (settings.planGate === "nobody") return { gated: false };

  /* A wali does not pay to read his ward's conversations, and by default
     cannot write in them anyway. */
  if (who.role !== "member") return { gated: false };

  /* Sisters never pay. An unknown gender is treated the same way rather
     than charged: refusing someone a message because a profile lookup
     came back empty would be charging for our own missing data. */
  if (settings.planGate === "brother" && who.gender !== "brother") return { gated: false };

  if (who.hasPlan) return { gated: false };

  const free = Math.max(0, settings.freeMessagesPerConversation);
  const used = Math.max(0, who.sentSoFar);
  const left = Math.max(0, free - used);
  return { gated: true, free, used, left, needsPlan: left === 0 };
}

/** The one sentence the browsing screens say about paying, or null when
 *  there is nothing true to say.
 *
 *  Null while the paywall is off — telling somebody they will need a plan
 *  when nothing will ever ask them for one is a promise the product does
 *  not keep. Null for a sister under `brother`, because it does not apply
 *  to her. */
export function planNote(
  gender: "brother" | "sister" | null,
  settings: PlanSettings
): string | null {
  if (settings.planGate === "nobody") return null;
  if (settings.planGate === "brother" && gender !== "brother") return null;
  const n = settings.freeMessagesPerConversation;
  return `Once you are talking, your first ${n} message${n === 1 ? " is" : "s are"} free; after that you need a plan to keep writing.`;
}
