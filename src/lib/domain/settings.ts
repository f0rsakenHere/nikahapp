/* The knobs the business turns, and what they are set to until someone
 * turns them.
 *
 * §5.11 reserves a `settings` collection for exactly this — "fee amount,
 * allowance limit, SLA targets: configurable, not hard-coded". This is
 * that, plus the seven open questions from §3.1 D1a–D1g.
 *
 * ── Why these are settings and not blockers ───────────────────────────
 * I spent several rounds calling D1a–D1g blocking, and on re-reading
 * them against the schema that was wrong. Where a connection comes from,
 * when it is spent, how many may be pending, how long a request lives,
 * whether the wali approves — every one is a number, a flag, or a branch
 * in the service layer. None of them changes a collection's shape.
 *
 * So they live here with defaults, and the client's answers change a
 * document rather than a migration. Each default is the recommendation
 * that was already put to them, and each one says what it costs to be
 * wrong, because a default nobody argued with is how a guess becomes a
 * decision by accident.
 * ──────────────────────────────────────────────────────────────────────
 */
import { z } from "zod";

export const SettingsSchema = z.object({
  /* ── D1b ────────────────────────────────────────────────────────────
   * When a connection is spent.
   *
   *   onSend     simple, and makes silence feel like theft — the single
   *              biggest churn driver in every paid-connection product
   *   onAccept   sender risk-free, spam free
   *   reserve    held on send, taken on acceptance, returned on decline
   *              or expiry
   *
   * Default `reserve`: it bounds how many requests one person can have
   * in flight without charging them for being ignored. It is also the
   * same authorize/capture shape as the Stripe fee flow, so it reuses
   * a mental model the codebase already has. */
  connectionCharge: z.enum(["onSend", "onAccept", "reserve"]).default("reserve"),

  /* ── D1a ────────────────────────────────────────────────────────────
   * Where connections come from. `grantPerMonth` is what everyone gets
   * for nothing; `purchasable` says whether more can be bought.
   *
   * Three, on the client's instruction. Ten was a number from a
   * conversation and never a decision; three is the decision, and it is
   * a different product. Under `connectionCharge: "reserve"` a member
   * can have three asks in flight and no more, so three people who never
   * answer take the whole month — `requestExpiryDays` is what hands them
   * back, and at 14 days that is half the month gone before the third is
   * returned. Worth watching in the ledger rather than worth softening
   * here.
   *
   * It is a top-up, not a reset: `balanceOf` sums the ledger, so an
   * unspent month rolls into the next one and someone who never asks
   * anybody accrues 36 a year. That was invisible at ten a month and is
   * the whole balance at three.
   *
   * If connections are ever sold, the fee copy on the marketing site is
   * no longer the whole pricing story and needs a second line — flagged
   * in home.ts. */
  grantPerMonth: z.number().int().min(0).max(200).default(3),
  purchasable: z.boolean().default(false),

  /* ── D1c ────────────────────────────────────────────────────────────
   * Whether both genders spend to initiate. Default yes: the client
   * described browsing as symmetric, and an asymmetric cost is a
   * product statement worth making deliberately rather than by
   * omission. */
  bothGendersSpend: z.boolean().default(true),

  /* ── D1d ────────────────────────────────────────────────────────────
   * The inbound cap: how many requests one member may have waiting at
   * once. Past it they stop appearing in browse until they clear some.
   *
   * Null means uncapped, and uncapped is the failure mode this exists
   * to prevent: a per-sender budget limits senders and does nothing for
   * the person being flooded, who is exactly the member you can least
   * afford to lose. It also caps the wali's workload — every acceptance
   * becomes a thread he has to read, and nothing else in the system
   * bounds that. */
  inboundCap: z.number().int().min(1).max(200).nullable().default(10),

  /* ── D1e ────────────────────────────────────────────────────────────
   * How long an unanswered request lives, and whether a decline is
   * disclosed.
   *
   * Expiry is not optional under `reserve`: without it a held
   * connection is held forever. `discloseDecline` defaults false — "no
   * longer available" is kinder than "she said no", and safer, because
   * a specific rejection is what turns a disappointed man into a
   * persistent one. */
  requestExpiryDays: z.number().int().min(1).max(90).default(14),
  discloseDecline: z.boolean().default(false),

  /* Whether a declined pair may try again. Default no: a decline that
   * can be immediately re-sent is not a decline. */
  allowRetryAfterDecline: z.boolean().default(false),

  /* ── D1f ────────────────────────────────────────────────────────────
   * Whether staff approval stands between finishing a profile and using
   * the product.
   *
   * True is the stricter reading and was the default: nobody is seen and
   * nobody sees until a reviewer has run the checks and pressed approve.
   * It is the right setting for a service whose promise is a closed,
   * checked pool — and it costs the member a wait of unknown length that
   * begins the moment they finish, which is exactly when their interest
   * is highest and the screen has least to show them.
   *
   * False, and set false here on the client's instruction: finishing the
   * profile puts you in the pool. Approval still happens, still runs the
   * same checks in the same queue, and still promotes to `live` — it
   * stops being the turnstile and becomes a fact recorded about a member
   * who is already here. `inPool` in profile.ts is where that decision
   * turns into who may be seen.
   *
   * The cost is real and worth writing down: for as long as this is
   * false, the pool contains people nobody has telephoned. Any copy that
   * tells a member otherwise is a claim this setting has made untrue —
   * the screens under `(app)` now ask this before they say it, and the
   * marketing pages have not been reworded. */
  requireVerifiedToBrowse: z.boolean().default(false),

  /* ── D1g ────────────────────────────────────────────────────────────
   * Whether the wali approves before a conversation opens, or only
   * reads it afterwards.
   *
   * Default `approves`, which is the published process and the one the
   * scholars were consulted on. The client described him as reading
   * every message, which is a different product — so this is the single
   * setting most likely to be wrong, and the one that should not be
   * changed without Mufti Faisal al-Mahmudi seeing it (§3.4).
   *
   * `standingApproval` lets an individual wali opt into auto-approving
   * while still reading everything, which keeps his consent explicit
   * without making her wait days for each conversation. */
  waliGate: z.enum(["approves", "observes"]).default("approves"),
  allowStandingApproval: z.boolean().default(true),

  /* D6 — may the wali write in the conversation, or only read?
   *
   * The banner says he "can read every message"; the copy calls him
   * "a participant rather than a bystander". Those are compatible
   * with either answer, which is why §3.2 lists it as needing design.
   * Default read-only: a guardian who can post is a third voice in a
   * conversation between two people, and that is a bigger change to
   * the thing than it sounds. */
  waliCanWrite: z.boolean().default(false),

  /* The account NikahCanada offers as a wali of last resort.
   *
   * A woman with no father, no brother and no uncle who will take this
   * on is otherwise shut out of the product entirely — she cannot go
   * live and no conversation can ever open for her. The classical
   * answer to exactly that situation is the wali al-hakim: the
   * authority, or in practice the local imam, stands in. This is that
   * seat, and it is a real account with the same read access and the
   * same veto as anybody's uncle, because a moderator with less than
   * that would be a fiction.
   *
   * Null until somebody is appointed to it — `scripts/create-moderator-
   * wali.cjs` makes the account and writes the id here. While it is
   * null the option is not offered anywhere, which is the right
   * behaviour: an unstaffed seat is worse than no seat. */
  moderatorWaliUserId: z.string().min(1).nullable().default(null),

  /* §5.11's original examples. The fee is invented and flagged
   * everywhere it appears; it is here so that it is invented in exactly
   * one place. */
  matchmakingFeeCents: z.number().int().min(0).nullable().default(null),
  currency: z.literal("CAD").default("CAD"),
});

export type Settings = z.infer<typeof SettingsSchema>;

/** The defaults, as a value. Every one of these is a recommendation
 *  waiting on an answer, not a decision that has been taken. */
export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

/** Which settings are still awaiting the client, and what it costs to
 *  have each one wrong. Rendered in the staff console so the list is
 *  somewhere people look, rather than in a document nobody opens. */
export const OPEN_DECISIONS: { key: keyof Settings; question: string; risk: string }[] = [
  {
    /* Half of D1a is answered: three a month, decided by the client.
       What is left is whether more can be bought, which is the half
       that touches the published pricing. */
    key: "purchasable",
    question: "D1a — may a member buy more than the three connections a month they are given?",
    risk: "If they are sold, the published pricing copy is incomplete.",
  },
  {
    key: "connectionCharge",
    question: "D1b — is a connection spent on sending, on acceptance, or reserved?",
    risk: "Charging on send makes silence feel like theft, which is the main churn driver.",
  },
  {
    key: "bothGendersSpend",
    question: "D1c — do both genders spend to initiate?",
    risk: "An asymmetric cost is a product statement; making it by omission is the bad way.",
  },
  {
    key: "inboundCap",
    question: "D1d — how many pending requests may one member hold?",
    risk: "Uncapped, popular members are flooded and leave, and walis inherit every thread.",
  },
  {
    key: "requestExpiryDays",
    question: "D1e — how long does an unanswered request live?",
    risk: "Too long and a reserved connection is held indefinitely.",
  },
  {
    key: "requireVerifiedToBrowse",
    question: "D1f — may an unverified member browse, or be browsed?",
    risk: "Allowing it makes the whole verification pipeline decorative.",
  },
  {
    key: "waliGate",
    question: "D1g — does the wali approve before a conversation opens, or only read it?",
    risk: "This is the published process and the scholars' position. Needs their review to change.",
  },
];
