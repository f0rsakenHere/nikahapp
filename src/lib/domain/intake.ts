/* The registration form, as it actually arrives.
 *
 * This models the live nikahcanada.com intake form — not the profile we
 * would design from scratch (§5.2 of docs/APP-PLAN.md is that). The two
 * differ substantially, and the gap is the point: everything §5.2 wants
 * to filter on is either absent from the form or buried in prose.
 *
 * Two real submissions were used to derive this. Both are personal data
 * and neither appears here or in the tests; the fixtures are invented
 * people carrying the same defects.
 *
 * DESIGN: nothing here rejects a submission for being messy. A person
 * filling in a marriage form on a phone is not a validation error, and
 * losing their application because a dropdown defaulted badly would be a
 * business failure, not a data-quality win. So the result carries two
 * separate lists:
 *
 *   errors  — the submission cannot be stored as a profile at all
 *   flags   — stored, but staff must resolve it on the intake call
 *
 * The intake call is a published step ("we will speak with you by phone
 * before any matching begins"), so `flags` has somewhere real to go.
 */
import { z } from "zod";
import { deriveInitials } from "./initials";

/* ---------------------------------------------------------------- raw --- */

/* The form export repeats "Full Name", "Email" and "Phone" — once for the
 * member and once for the wali — with no namespacing, so the two are
 * distinguishable only by position in the export. Any ingest must split
 * on the wali heading before parsing; by the time a submission is a
 * key/value map the member's email and his are indistinguishable. */
export type RawIntake = {
  member: Record<string, string | undefined>;
  wali: Record<string, string | undefined>;
};

/* Values that mean "the user did not answer", including the one the live
 * form submits when a <select> is left on its placeholder. A stored
 * marital status of "Select" is how that reaches the database today. */
const SENTINELS = new Set(["", "select", "choose", "n/a", "na", "none", "-", "--"]);

/** Trims, and maps every not-really-an-answer to undefined. */
export function answered(value: string | undefined | null): string | undefined {
  const v = (value ?? "").trim();
  return v && !SENTINELS.has(v.toLowerCase()) ? v : undefined;
}

/* ---------------------------------------------------------- normalisers -- */

/** `6'8"` → 203 cm. Returns null when the field is unparseable. */
export function parseHeightToCm(raw: string | undefined): number | null {
  const v = answered(raw);
  if (!v) return null;

  const feetInches = v.match(/^(\d{1,2})\s*['’]\s*(\d{1,2})?\s*["”]?$/);
  if (feetInches) {
    const ft = Number(feetInches[1]);
    const inch = Number(feetInches[2] ?? 0);
    if (inch > 11) return null;
    return Math.round((ft * 12 + inch) * 2.54);
  }

  const cm = v.match(/^(\d{2,3})\s*cm$/i);
  if (cm) return Number(cm[1]);

  return null;
}

/* Adults in the pool. Outside this, the number is far more likely to be a
 * typo than a person — 6'8" was entered by someone whose own prose said
 * 187 cm, which is 6'1½". */
const HEIGHT_MIN_CM = 137; // 4'6"
const HEIGHT_MAX_CM = 200; // 6'7"

/** Any three-digit centimetre figure a member mentions in their own prose.
 *  People restate their height in the free-text answer, and when it
 *  disagrees with the height field the field is usually the wrong one. */
export function heightsMentionedInProse(text: string | undefined): number[] {
  const v = answered(text);
  if (!v) return [];
  return [...v.matchAll(/\b(1\d{2})\s*cm\b/gi)].map((m) => Number(m[1]));
}

/** "January 01, 1999" and ISO both parse. Returns null if neither does.
 *
 *  Normalised to UTC midnight of the calendar date the string names. A
 *  bare `new Date("January 01, 1999")` is parsed in the *local* zone, so
 *  east of Greenwich `getUTCDate()` then reports the 31st of December —
 *  which silently breaks both the age calculation and the check for a
 *  1 January placeholder. A birthday is a calendar date, not an instant. */
export function parseDateOfBirth(raw: string | undefined): Date | null {
  const v = answered(raw);
  if (!v) return null;

  const local = new Date(v);
  if (Number.isNaN(local.getTime())) return null;

  const year = local.getFullYear();
  if (year < 1900 || year > 2100) return null;

  return new Date(Date.UTC(year, local.getMonth(), local.getDate()));
}

/** Whole years at `on`. */
export function ageOn(birth: Date, on: Date): number {
  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = on.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

/* The form asks for one "Full Name" rather than parts, so first and last
 * have to be recovered from it — `deriveInitials` needs them, and the
 * initials are the only identity a member sees before contact release.
 *
 * Arabic names defeat any positional rule: "Abdul Salam Mohammed Ahmed
 * Al-Husaisi" has no surname in the European sense, and first-plus-last
 * gives "A.A" where a person would write "A.H". This takes first and last
 * anyway, because it is predictable and wrong in a visible way, and
 * flags it so staff can correct the display name on the intake call. */
export function splitLegalName(full: string | undefined): {
  first?: string;
  middle?: string;
  last?: string;
  parts: number;
} {
  const v = answered(full);
  if (!v) return { parts: 0 };

  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], parts: 1 };
  return {
    first: parts[0],
    middle: parts.length > 2 ? parts.slice(1, -1).join(" ") : undefined,
    last: parts[parts.length - 1],
    parts: parts.length,
  };
}

/* Gender is never asked. It is implied by which conditional questions the
 * form showed: "…Future Wife" to brothers, "…Future Husband" and the
 * hijab question to sisters. Inferring it from the answers is the only
 * option for existing submissions, and it is not something the product
 * should keep doing — §5.2 makes gender immutable and set at signup,
 * because it decides whether a wali is required. */
export const LOOKING_FOR_WIFE = "What Are You Looking For In Your Future Wife ?";
export const LOOKING_FOR_HUSBAND = "What Are You Looking For In Your Future Husband ?";
export const HIJAB = "Do You Wear The Hijab In Your Daily Life ?";

export function inferGender(member: RawIntake["member"]): "brother" | "sister" | null {
  const wife = answered(member[LOOKING_FOR_WIFE]);
  const husband = answered(member[LOOKING_FOR_HUSBAND]);
  const hijab = answered(member[HIJAB]);

  if (wife && !husband) return "brother";
  if ((husband || hijab) && !wife) return "sister";
  return null; // both or neither — a person, not a guess
}

/* -------------------------------------------------------------- schema --- */

/* Free text is capped rather than trimmed silently: one of the two real
 * submissions ran to ~1,800 characters in a field labelled "What Do You
 * Do In Life ?", which is an occupation question being used as a
 * biography. The cap is generous because the long answers are the good
 * ones — they are what a matchmaker actually reads. */
const LONG_TEXT_MAX = 8000;

export const IntakeSchema = z.object({
  gender: z.enum(["brother", "sister"]),

  legalName: z.object({
    full: z.string().min(1),
    first: z.string().optional(),
    middle: z.string().optional(),
    last: z.string().optional(),
  }),
  initials: z.string().nullable(),

  email: z.email(),
  phoneRaw: z.string().min(1),

  /* Free text on purpose. "Abha" and "Montreal,Quebec,Canada" both arrive
   * in this one box, so city/province/country cannot be split reliably.
   * Structuring it is intake-call work, not parser work. */
  livesIn: z.string().min(1),

  dateOfBirth: z.date(),
  age: z.number().int().min(18),

  /* Absolute sanity only. The plausible band is enforced as a *flag*, not
   * a rejection — a mistyped height is a phone call, not grounds for
   * throwing away someone's marriage application. */
  heightCm: z.number().int().min(50).max(280).nullable(),
  weightKg: z.number().int().min(30).max(300).nullable(),

  /* Deliberately not enums. The live form's option lists have not been
   * supplied, and inventing them would silently drop real answers —
   * "Refugee" is a citizenship status that a guessed enum would reject. */
  ethnicity: z.string().optional(),
  otherEthnicity: z.string().optional(),
  languages: z.string().optional(),
  citizenship: z.string().optional(),
  maritalStatus: z.string().optional(),
  hijab: z.string().optional(),
  healthIssues: z.string().max(LONG_TEXT_MAX).optional(),
  heardAbout: z.string().optional(),

  aboutMe: z.string().max(LONG_TEXT_MAX).optional(),
  lookingFor: z.string().max(LONG_TEXT_MAX).optional(),

  wali: z
    .object({
      fullName: z.string().optional(),
      email: z.email().optional(),
      phoneRaw: z.string().optional(),
      relationship: z.string().optional(),
      deliveryPreference: z.string().optional(),
    })
    .optional(),

  declaredFaith: z.boolean(),
  acceptedTerms: z.boolean(),
});

export type Intake = z.infer<typeof IntakeSchema>;

export type IntakeFlag =
  | "gender-not-inferable"
  | "marital-status-unanswered"
  | "height-unparseable"
  | "height-implausible"
  | "height-contradicts-prose"
  | "name-single-part"
  | "name-many-parts"
  | "dob-first-of-january"
  | "sister-without-wali"
  | "wali-partially-supplied"
  | "occupation-is-prose"
  | "heard-about-unanswered";

export type IntakeResult =
  | { ok: true; value: Intake; flags: IntakeFlag[] }
  | { ok: false; errors: string[]; flags: IntakeFlag[] };

/* ----------------------------------------------------------- normalise --- */

export const FIELDS = {
  fullName: "Full Name",
  email: "Email",
  phone: "Phone",
  livesIn: "Where Do You Live ?",
  ethnicity: "Ethnicity",
  otherEthnicity: "Other Ethnicity (If Any)",
  languages: "Which Languages Do You Speak ?",
  dob: "Date Of Birth",
  height: `Height (ft'in")`,
  weight: "Weight (kg)",
  health: "Do You Have Any Serious Health Issue(s) ? If so, please describe briefly.",
  citizenship: "What Is Your Citizenship Status ?",
  maritalStatus: "What Is Your Marital Status?",
  hijab: HIJAB,
  aboutMe: "What Do You Do In Life ?",
  heardAbout: "How Did You Hear About NikahCanada ?",
  waliRelationship: "What Is Your Relationship With Your Wali ?",
  waliDelivery:
    "How Would Your Wali Like To Receive The Match's Profile Information And Picture ?",
} as const;

/** Turns one form submission into a validated profile draft.
 *
 *  `now` is a parameter rather than `new Date()` so age is deterministic
 *  in tests and reproducible in an audit trail. */
export function normaliseIntake(raw: RawIntake, now: Date): IntakeResult {
  const m = raw.member;
  const flags: IntakeFlag[] = [];
  const errors: string[] = [];

  const gender = inferGender(m);
  if (!gender) flags.push("gender-not-inferable");

  const full = answered(m[FIELDS.fullName]);
  const name = splitLegalName(full);
  if (name.parts === 1) flags.push("name-single-part");
  if (name.parts >= 4) flags.push("name-many-parts");

  const dob = parseDateOfBirth(m[FIELDS.dob]);
  if (dob && dob.getUTCMonth() === 0 && dob.getUTCDate() === 1) {
    /* 1 January is what people enter when they do not know the date, and
     * what a date picker lands on. It is a real birthday too, so this can
     * only ever be a flag. */
    flags.push("dob-first-of-january");
  }

  const heightCm = parseHeightToCm(m[FIELDS.height]);
  if (answered(m[FIELDS.height]) && heightCm === null) flags.push("height-unparseable");
  if (heightCm !== null && (heightCm < HEIGHT_MIN_CM || heightCm > HEIGHT_MAX_CM)) {
    flags.push("height-implausible");
  }
  const prose = heightsMentionedInProse(m[FIELDS.aboutMe]);
  if (heightCm !== null && prose.some((p) => Math.abs(p - heightCm) > 5)) {
    flags.push("height-contradicts-prose");
  }

  if (!answered(m[FIELDS.maritalStatus])) flags.push("marital-status-unanswered");
  if (!answered(m[FIELDS.heardAbout])) flags.push("heard-about-unanswered");

  const aboutMe = answered(m[FIELDS.aboutMe]);
  if (aboutMe && aboutMe.length > 400) flags.push("occupation-is-prose");

  /* The wali block. A sister's profile cannot go live without a confirmed
   * wali — that is the central published promise — and the live form
   * accepts the whole block empty, including from sisters. It is a flag
   * rather than an error because rejecting her application outright would
   * be worse than calling her. */
  const w = raw.wali;
  const waliFields = [
    answered(w[FIELDS.fullName]),
    answered(w[FIELDS.email]),
    answered(w[FIELDS.phone]),
    answered(w[FIELDS.waliRelationship]),
  ];
  const waliSupplied = waliFields.filter(Boolean).length;
  if (gender === "sister" && waliSupplied === 0) flags.push("sister-without-wali");
  if (waliSupplied > 0 && waliSupplied < 4) flags.push("wali-partially-supplied");

  const parsed = IntakeSchema.safeParse({
    gender: gender ?? undefined,
    legalName: { full, first: name.first, middle: name.middle, last: name.last },
    initials: deriveInitials({ first: name.first ?? "", last: name.last ?? "" }),
    email: answered(m[FIELDS.email]),
    phoneRaw: answered(m[FIELDS.phone]),
    livesIn: answered(m[FIELDS.livesIn]),
    dateOfBirth: dob ?? undefined,
    age: dob ? ageOn(dob, now) : undefined,
    heightCm,
    weightKg: answered(m[FIELDS.weight]) ? Number(m[FIELDS.weight]) : null,
    ethnicity: answered(m[FIELDS.ethnicity]),
    otherEthnicity: answered(m[FIELDS.otherEthnicity]),
    languages: answered(m[FIELDS.languages]),
    citizenship: answered(m[FIELDS.citizenship]),
    maritalStatus: answered(m[FIELDS.maritalStatus]),
    hijab: answered(m[FIELDS.hijab]),
    healthIssues: answered(m[FIELDS.health]),
    heardAbout: answered(m[FIELDS.heardAbout]),
    aboutMe,
    lookingFor: answered(m[LOOKING_FOR_WIFE]) ?? answered(m[LOOKING_FOR_HUSBAND]),
    wali: waliSupplied
      ? {
          fullName: answered(w[FIELDS.fullName]),
          email: answered(w[FIELDS.email]),
          phoneRaw: answered(w[FIELDS.phone]),
          relationship: answered(w[FIELDS.waliRelationship]),
          deliveryPreference: answered(w[FIELDS.waliDelivery]),
        }
      : undefined,
    declaredFaith: Boolean(answered(m["Declaration of Islamic faith"])),
    acceptedTerms: Boolean(answered(m["Terms"])),
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    return { ok: false, errors, flags };
  }

  return { ok: true, value: parsed.data, flags };
}
