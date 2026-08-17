/* The profile: the five-step builder, and what makes one complete.
 *
 * docs/APP-PLAN.md §5.2. Pure — no database, no clock.
 *
 * ── Why the fields are shaped this way ────────────────────────────────
 * The live registration form collects almost everything as prose. That
 * works for a curated queue, because a matchmaker reads it. It does not
 * work for browsing, which is the model now (§3.1 D1): a filter needs a
 * field, and "aged 40 to 50, must be in canada" sitting in a free-text
 * box is invisible to every query.
 *
 * So each answer here is structured *or* prose, deliberately, and the
 * split is the product decision:
 *
 *   structured  the member filters on it, or is filtered by it
 *   prose       a person reads it — kept, never parsed, never queried
 *
 * ⚠ THE OPTION LISTS NEED THE CLIENT'S CONFIRMATION. They are drawn from
 * ordinary practice and from the two real submissions we have — which is
 * why `citizenship` includes "Refugee", an answer a guessed list would
 * have thrown away. They are not taken from anything NikahCanada has
 * published, because nothing has been.
 *
 * `preferNotToSay` exists on every sensitive field on purpose. A
 * required radio group with no way out is answered dishonestly, and a
 * dishonest answer is worse than a missing one in a matching system.
 * ──────────────────────────────────────────────────────────────────────
 */
import { z } from "zod";

/* ------------------------------------------------------------ options -- */

export const SALAH = ["fiveDaily", "mostPrayers", "somePrayers", "rarely", "preferNotToSay"] as const;
export const MADHHAB = ["hanafi", "maliki", "shafii", "hanbali", "none", "preferNotToSay"] as const;
/* Sisters only. */
export const DRESS = ["niqab", "hijab", "hijabSometimes", "noHijab", "preferNotToSay"] as const;
/* Brothers only. */
export const BEARD = ["yes", "trimmed", "no", "preferNotToSay"] as const;
export const QURAN = ["hafiz", "readsWithTajweed", "reads", "learning", "preferNotToSay"] as const;

export const MARITAL_STATUS = ["neverMarried", "divorced", "widowed", "separated"] as const;
export const CHILDREN = ["none", "yesLivingWithMe", "yesNotLivingWithMe"] as const;

/* "refugee" is here because a real applicant answered it. A list guessed
 * from the usual four would have rejected her registration. */
export const CITIZENSHIP = [
  "citizen",
  "permanentResident",
  "workPermit",
  "studyPermit",
  "refugee",
  "visitor",
  "other",
] as const;

export const EDUCATION = [
  "highSchool",
  "collegeDiploma",
  "bachelor",
  "master",
  "doctorate",
  "islamicStudies",
  "other",
] as const;

export const RELOCATE = ["yes", "no", "maybe"] as const;

/* The service operates across Canada, but one of the two real
 * submissions came from someone living in Saudi Arabia — so "outside
 * Canada" is a real value, not an edge case. */
export const PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
  "outsideCanada",
] as const;

export const PROFILE_STATUSES = [
  "draft",
  "pendingCall",
  "pendingReview",
  "verifying",
  "live",
  "paused",
  "matched",
  "withdrawn",
  "rejected",
] as const;

export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

/* ------------------------------------------------------------- the pool -- */

/** Approved. Staff have run the checks and admitted this profile. */
const APPROVED: readonly ProfileStatus[] = ["live"];

/** Finished and sent in — waiting on that decision, or already past it.
 *
 *  Never `draft`: an unsubmitted profile is somebody's private working
 *  copy, and nobody has agreed to be listed. Never `paused`, `matched`,
 *  `withdrawn` or `rejected` either — each of those is a decision to be
 *  out of the pool, and none of them is undone by this setting. */
const SUBMITTED: readonly ProfileStatus[] = [
  "pendingCall",
  "pendingReview",
  "verifying",
  "live",
];

/** Which statuses are in the pool: shown to others, allowed to look,
 *  allowed to ask.
 *
 *  D1f, in one place, because it used to be in four. `status: "live"`
 *  was written directly into the browse query, the single-profile
 *  lookup, the ask rules and the pool counts — so turning the setting
 *  off opened the door and left the room empty behind it. The only
 *  members it admitted were the ones who no longer needed admitting.
 *
 *  With approval required, the pool is what staff have approved. With it
 *  deferred, the pool is everyone who has finished and sent their
 *  profile in; approval still happens, still runs the same checks, and
 *  still promotes to `live` — it stops being the turnstile and becomes
 *  a fact recorded about a member who is already here. */
export function poolStatuses(settings: {
  requireVerifiedToBrowse: boolean;
}): readonly ProfileStatus[] {
  return settings.requireVerifiedToBrowse ? APPROVED : SUBMITTED;
}

export function inPool(
  status: string,
  settings: { requireVerifiedToBrowse: boolean }
): boolean {
  return (poolStatuses(settings) as readonly string[]).includes(status);
}

/* -------------------------------------------------------------- schema -- */

const optionalText = (max: number) => z.string().trim().max(max).optional();

/* Every field is optional. A draft is saved after each step and a member
 * can leave halfway through — the mock-up promises "the profile can be
 * finished across several sittings". Completeness is enforced by the
 * step definitions below, not by making the document unsaveable. */
export const ProfileDraftSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  gender: z.enum(["brother", "sister"]),
  status: z.enum(PROFILE_STATUSES),
  /* Where `resume` goes back to.
   *
   * `paused` used to be reachable only from `live`, so coming back could
   * only mean live. Under deferred approval a member is in the pool
   * before anybody has approved them, and resuming had no business
   * granting an approval nobody made — so the status they paused from is
   * kept, and given back. Absent on every profile paused before this
   * existed, which is what the fallback in `nextStatus` is for. */
  pausedFrom: z.enum(PROFILE_STATUSES).optional(),
  initials: z.string().nullable(),

  basics: z
    .object({
      /* Year, never the exact date. §5.1 keeps the full date encrypted on
       * the account; matching only ever needs the year, and a birthday
       * is a surprisingly effective identifier. */
      birthYear: z.number().int().min(1900).max(2100).optional(),
      city: optionalText(80),
      province: z.enum(PROVINCES).optional(),
      country: optionalText(60),
      citizenship: z.enum(CITIZENSHIP).optional(),
      willingToRelocate: z.enum(RELOCATE).optional(),
      heightCm: z.number().int().min(137).max(220).optional(),
    })
    .default({}),

  background: z
    .object({
      /* Free text. Both real submissions answered "Ethnicity" with a
       * country — "Yemen", "Canada" — so a closed list would mostly
       * record that people misread the question. Structuring it is a
       * later decision with real data behind it. */
      ethnicity: optionalText(80),
      languages: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
      maritalStatus: z.enum(MARITAL_STATUS).optional(),
      children: z.enum(CHILDREN).optional(),
      childrenDetail: optionalText(500), // 🔒
    })
    /* The default has to be complete, not `{}`. Zod hands a default
     * value straight back without parsing it, so an outer `.default({})`
     * silently skips every inner default and `languages` arrives as
     * undefined — which only failed to crash `required()` because the
     * check before it short-circuits first. */
    .default({ languages: [] }),

  deen: z
    .object({
      salah: z.enum(SALAH).optional(),
      madhhab: z.enum(MADHHAB).optional(),
      dress: z.enum(DRESS).optional(),
      beard: z.enum(BEARD).optional(),
      quran: z.enum(QURAN).optional(),
      revert: z.boolean().optional(),
    })
    .default({}),

  education: z
    .object({
      level: z.enum(EDUCATION).optional(),
      field: optionalText(120),
    })
    .default({}),

  work: z
    .object({
      occupation: optionalText(120),
      employed: z.boolean().optional(),
    })
    .default({}),

  family: z.object({ detail: optionalText(2000) }).default({}), // 🔒

  /* 🔒 A brother's counterpart to a sister's wali (§2.3). She registers a
   * guardian who vouches for her and stays involved; he names someone
   * who will vouch for him once, whom staff telephone during
   * verification. It is not a symmetric power — it is a symmetric check.
   *
   * §2.4 lists this as missing from the mock-ups: ContactShared reveals
   * "his wali or reference" and no screen ever collected one. */
  reference: z
    .object({
      name: optionalText(120),
      relationship: optionalText(80),
      organisation: optionalText(120),
      phone: optionalText(40),
    })
    .default({}),

  lookingFor: z
    .object({
      ageMin: z.number().int().min(18).max(99).optional(),
      ageMax: z.number().int().min(18).max(99).optional(),
      provinces: z.array(z.enum(PROVINCES)).max(14).default([]),
      maritalStatus: z.array(z.enum(MARITAL_STATUS)).max(4).default([]),
      madhhab: z.array(z.enum(MADHHAB)).max(6).default([]),
      mustBeInCanada: z.boolean().optional(),
      freeText: optionalText(4000), // 🔒
    })
    .default({ provinces: [], maritalStatus: [], madhhab: [] }),

  freeText: z
    .object({ aboutMe: optionalText(4000), anythingElse: optionalText(2000) })
    .default({}), // 🔒

  completeness: z.object({ step: z.number().int(), of: z.number().int(), percent: z.number() }),

  createdAt: z.date(),
  updatedAt: z.date(),
})
  .refine(
    (p) => {
      const { ageMin, ageMax } = p.lookingFor;
      return ageMin === undefined || ageMax === undefined || ageMin <= ageMax;
    },
    { message: "the youngest age cannot be above the oldest", path: ["lookingFor", "ageMin"] }
  );

export type ProfileDraft = z.infer<typeof ProfileDraftSchema>;

/* --------------------------------------------------------------- steps -- */

export type StepId =
  | "basics"
  | "background"
  | "deen"
  /** Sisters only. */
  | "guardian"
  /** Brothers only — the same slot in the flow. */
  | "reference"
  | "lookingFor";

/** What a step needs that is not on the profile document.
 *
 *  Only the wali step uses it, and only because whether it is finished
 *  depends on another person having replied to an email. */
export type StepContext = { hasConfirmedWali: boolean };

export const NO_WALI: StepContext = { hasConfirmedWali: false };

export type Step = {
  id: StepId;
  n: number;
  title: string;
  /** Shown under the heading, in the same plain voice as the site. */
  blurb: string;
  /** Answered before the profile can be submitted for review. Anything
   *  not listed is genuinely optional and must never block progress. */
  required: (p: ProfileDraft, ctx: StepContext) => boolean;
};

/* Five, matching the mock-ups: the deen screen shows "step 3 of 5" and
 * the wali screen "step 4 of 5". */
export const STEPS: readonly Step[] = [
  {
    id: "basics",
    n: 1,
    title: "About you",
    blurb: "Where you live, and how you came to be there.",
    required: (p) =>
      p.basics.birthYear !== undefined &&
      !!p.basics.city &&
      p.basics.province !== undefined &&
      p.basics.citizenship !== undefined,
  },
  {
    id: "background",
    n: 2,
    title: "Your background",
    blurb: "Family situation, languages, education and work.",
    required: (p) =>
      p.background.maritalStatus !== undefined &&
      p.background.children !== undefined &&
      p.background.languages.length > 0 &&
      p.education.level !== undefined,
  },
  {
    id: "deen",
    n: 3,
    title: "How you practise",
    blurb: "The section a match reads before anything else.",
    required: (p) =>
      p.deen.salah !== undefined &&
      p.deen.madhhab !== undefined &&
      /* Gendered: a sister is asked about hijab, a brother about his
       * beard. Neither question is asked of the other. */
      (p.gender === "sister" ? p.deen.dress !== undefined : p.deen.beard !== undefined),
  },
  {
    id: "guardian",
    n: 4,
    title: "Your wali",
    blurb: "He confirms by email before your profile goes live.",
    /* Not satisfiable from the profile alone — it depends on a confirmed
     * guardianship, which lives in another collection and needs another
     * person to act. So it is answered from context.
     *
     * With no context it reports unfinished, which is the safe default:
     * a screen that cannot see the guardianship should say "waiting on
     * your wali", not claim she is done. */
    required: (_p, ctx) => ctx.hasConfirmedWali,
  },
  {
    id: "reference",
    n: 4,
    title: "Your reference",
    blurb: "Someone who can vouch for you. We telephone them before your profile goes live.",
    required: (p) =>
      !!p.reference.name && !!p.reference.relationship && !!p.reference.phone,
  },
  {
    id: "lookingFor",
    n: 5,
    title: "What you are looking for",
    blurb: "Used to decide who you see, and who sees you.",
    required: (p) =>
      p.lookingFor.ageMin !== undefined &&
      p.lookingFor.ageMax !== undefined &&
      p.lookingFor.provinces.length > 0,
  },
] as const;

/* One voucher each, and never the other's.
 *
 * A sister names a wali: he confirms by email, holds a veto, and reads
 * her correspondence. A brother names a reference, whom staff telephone
 * once. Asking either of them for both is asking twice.
 *
 * The wali step used to be shown to a brother too — optional, uncounted,
 * on the reasoning that a man who wants his father watching should be
 * able to record it. It is gone. A step that sits in his checklist,
 * offers him a form and writes a guardianship is a wali system whatever
 * the word "optional" above it says, and the wali in this product is the
 * woman's guardian (§5.2). Nothing downstream ever seated his: a
 * conversation carries one guardian's seat and it is hers, go-live has
 * never asked him for one, and the admin screen shows him a reference
 * where it shows her a wali. So what the step collected was an
 * obligation-shaped nothing — a man invited by email, told he could
 * approve and read, who then held no such power. */
const HIDDEN_FROM: Record<"brother" | "sister", StepId> = {
  sister: "reference",
  brother: "guardian",
};

/** The steps this member is actually shown. */
export function stepsFor(gender: "brother" | "sister"): readonly Step[] {
  return STEPS.filter((s) => s.id !== HIDDEN_FROM[gender]);
}

export function stepById(id: string): Step | undefined {
  return STEPS.find((s) => s.id === id);
}

/** Progress across the steps this member sees.
 *
 *  `step` is the first unfinished one — where "resume" should land —
 *  rather than the furthest reached, so a member who skipped step two
 *  and finished step three is sent back to two. */
export function completeness(
  p: ProfileDraft,
  ctx: StepContext = NO_WALI
): { step: number; of: number; percent: number } {
  const steps = stepsFor(p.gender);
  const done = steps.filter((s) => s.required(p, ctx));
  const firstUnfinished = steps.find((s) => !s.required(p, ctx));
  return {
    step: firstUnfinished ? firstUnfinished.n : steps.length,
    of: steps.length,
    percent: Math.round((done.length / steps.length) * 100),
  };
}

export type SubmitBlocked =
  | { step: StepId; reason: "incomplete" }
  | { step: "guardian"; reason: "wali-not-confirmed" };

/** Whether the profile can be sent for review.
 *
 *  Deliberately *not* "can go live" — that is `profileMayGoLive`, which
 *  also wants a verified wali and staff approval. This is the member's
 *  gate: have they finished their part?
 *
 *  `hasConfirmedWali` comes from the guardianship repository, because
 *  this module does no I/O. */
export function submitBlockers(p: ProfileDraft, context: StepContext): SubmitBlocked[] {
  const blockers: SubmitBlocked[] = [];

  for (const step of stepsFor(p.gender)) {
    /* The wali step is reported below, with the reason that is actually
     * true of it. Listing it here as well would tell a sister her
     * guardian step is "incomplete" — which reads as something she
     * forgot to fill in, when what it means is that someone else has
     * not replied to an email yet. The reference step is his to
     * finish, so it is not excluded. */
    if (step.id === "guardian") continue;
    if (!step.required(p, context)) blockers.push({ step: step.id, reason: "incomplete" });
  }

  if (p.gender === "sister" && !context.hasConfirmedWali) {
    blockers.push({ step: "guardian", reason: "wali-not-confirmed" });
  }

  return blockers;
}
