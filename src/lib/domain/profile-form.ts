/* What each step of the builder asks, as plain data.
 *
 * A description rather than five hand-written forms: the same spec
 * drives the rendering, the parsing of the submitted FormData and the
 * "required" marks, so those three cannot drift apart. It is also plain
 * data with no functions in it, which is what lets it cross the
 * server/client boundary untouched.
 */
import {
  BEARD,
  CHILDREN,
  CITIZENSHIP,
  DRESS,
  EDUCATION,
  MADHHAB,
  MARITAL_STATUS,
  PROVINCES,
  QURAN,
  RELOCATE,
  SALAH,
  type StepId,
} from "./profile";
import {
  BEARD_LABELS,
  CHILDREN_LABELS,
  CITIZENSHIP_LABELS,
  DRESS_LABELS,
  EDUCATION_LABELS,
  MADHHAB_LABELS,
  MARITAL_STATUS_LABELS,
  PROVINCE_LABELS,
  QURAN_LABELS,
  RELOCATE_LABELS,
  SALAH_LABELS,
  toOptions,
} from "./profile-labels";

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "radio"
  | "select"
  | "multiselect"
  /** Comma-separated free text stored as an array — languages. */
  | "list";

export type FieldSpec = {
  /** `section.key`, matching the profile document. */
  path: string;
  kind: FieldKind;
  label: string;
  hint?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  placeholder?: string;
  /** Shown only to this gender. */
  only?: "brother" | "sister";
};

const YEAR_NOW = 2026; // replaced by a passed-in clock when the builder needs one

export const STEP_FIELDS: Record<Exclude<StepId, "guardian">, FieldSpec[]> = {
  basics: [
    {
      path: "basics.birthYear",
      kind: "number",
      label: "Year of birth",
      required: true,
      min: YEAR_NOW - 100,
      max: YEAR_NOW - 18,
      hint: "Only the year is stored here. Nobody is ever shown your exact date of birth.",
    },
    { path: "basics.city", kind: "text", label: "City", required: true, placeholder: "Montreal" },
    {
      path: "basics.province",
      kind: "select",
      label: "Province",
      required: true,
      options: toOptions(PROVINCES, PROVINCE_LABELS),
      hint: "Choose “Outside Canada” if you live elsewhere. Members abroad are welcome.",
    },
    {
      path: "basics.citizenship",
      kind: "radio",
      label: "Your status in Canada",
      required: true,
      options: toOptions(CITIZENSHIP, CITIZENSHIP_LABELS),
    },
    {
      path: "basics.willingToRelocate",
      kind: "radio",
      label: "Would you move for marriage?",
      options: toOptions(RELOCATE, RELOCATE_LABELS),
    },
    {
      path: "basics.heightCm",
      kind: "number",
      label: "Height in centimetres",
      min: 137,
      max: 220,
      hint: "Optional. In centimetres so it is unambiguous — 5'8\" is 173.",
    },
  ],

  background: [
    {
      path: "background.maritalStatus",
      kind: "radio",
      label: "Marital status",
      required: true,
      options: toOptions(MARITAL_STATUS, MARITAL_STATUS_LABELS),
    },
    {
      path: "background.children",
      kind: "radio",
      label: "Children",
      required: true,
      options: toOptions(CHILDREN, CHILDREN_LABELS),
    },
    {
      path: "background.languages",
      kind: "list",
      label: "Languages you speak",
      required: true,
      placeholder: "English, Arabic, Urdu",
      hint: "Separate them with commas.",
    },
    { path: "background.ethnicity", kind: "text", label: "Ethnic background", placeholder: "Optional" },
    {
      path: "education.level",
      kind: "select",
      label: "Education",
      required: true,
      options: toOptions(EDUCATION, EDUCATION_LABELS),
    },
    { path: "education.field", kind: "text", label: "Field of study", placeholder: "Optional" },
    { path: "work.occupation", kind: "text", label: "Work", placeholder: "Optional" },
  ],

  deen: [
    {
      path: "deen.salah",
      kind: "radio",
      label: "Salah",
      required: true,
      options: toOptions(SALAH, SALAH_LABELS),
    },
    {
      path: "deen.madhhab",
      kind: "radio",
      label: "Madhhab",
      required: true,
      options: toOptions(MADHHAB, MADHHAB_LABELS),
    },
    {
      path: "deen.dress",
      kind: "radio",
      label: "Dress",
      required: true,
      only: "sister",
      options: toOptions(DRESS, DRESS_LABELS),
    },
    {
      path: "deen.beard",
      kind: "radio",
      label: "Beard",
      required: true,
      only: "brother",
      options: toOptions(BEARD, BEARD_LABELS),
    },
    { path: "deen.quran", kind: "radio", label: "Qur'an", options: toOptions(QURAN, QURAN_LABELS) },
    {
      path: "freeText.aboutMe",
      kind: "textarea",
      label: "About you",
      max: 4000,
      hint: "In your own words. This is what a match reads first — take your time with it.",
    },
  ],

  reference: [
    {
      path: "reference.name",
      kind: "text",
      label: "Their full name",
      required: true,
      placeholder: "Imam Suleiman Diallo",
    },
    {
      path: "reference.relationship",
      kind: "text",
      label: "How they know you",
      required: true,
      placeholder: "The imam of my masjid",
      hint: "Someone who knows you well enough to speak for your character — an imam, an employer, a long-standing friend of the family.",
    },
    {
      path: "reference.organisation",
      kind: "text",
      label: "Where, if it is a place",
      placeholder: "Optional",
    },
    {
      path: "reference.phone",
      kind: "text",
      label: "Their phone number",
      required: true,
      hint: "We telephone them once, before your profile goes live. We do not say what you told us about yourself.",
    },
  ],

  lookingFor: [
    {
      path: "lookingFor.ageMin",
      kind: "number",
      label: "Youngest age you would consider",
      required: true,
      min: 18,
      max: 99,
    },
    {
      path: "lookingFor.ageMax",
      kind: "number",
      label: "Oldest age you would consider",
      required: true,
      min: 18,
      max: 99,
    },
    {
      path: "lookingFor.provinces",
      kind: "multiselect",
      label: "Where they can live",
      required: true,
      options: toOptions(PROVINCES, PROVINCE_LABELS),
    },
    {
      path: "lookingFor.maritalStatus",
      kind: "multiselect",
      label: "Marital status you would consider",
      options: toOptions(MARITAL_STATUS, MARITAL_STATUS_LABELS),
      hint: "Leave all unticked if you have no preference.",
    },
    {
      path: "lookingFor.madhhab",
      kind: "multiselect",
      label: "Madhhab you would consider",
      options: toOptions(MADHHAB, MADHHAB_LABELS),
      hint: "Leave all unticked if you have no preference.",
    },
    {
      path: "lookingFor.freeText",
      kind: "textarea",
      label: "Anything else that matters to you",
      max: 4000,
      hint: "Read by our team and by a match — not used to filter.",
    },
  ],
};

export function fieldsForStep(step: StepId, gender: "brother" | "sister"): FieldSpec[] {
  /* The wali step is not a form — it creates a guardianship and emails
     an invitation, so it has no field specs at all. */
  if (step === "guardian") return [];
  return STEP_FIELDS[step].filter((f) => !f.only || f.only === gender);
}

/* --------------------------------------------------------------- parse -- */

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const [section, key] = path.split(".");
  const bucket = (target[section] ??= {}) as Record<string, unknown>;
  bucket[key] = value;
}

/** Turns one step's FormData into a profile patch, using the same spec
 *  that rendered it. Empty answers become `undefined` rather than empty
 *  strings, so clearing a field actually clears it. */
export function parseStepForm(
  step: StepId,
  gender: "brother" | "sister",
  form: { get(name: string): unknown; getAll(name: string): unknown[] }
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const field of fieldsForStep(step, gender)) {
    if (field.kind === "multiselect") {
      setPath(patch, field.path, form.getAll(field.path).map(String).filter(Boolean));
      continue;
    }

    if (field.kind === "list") {
      const raw = String(form.get(field.path) ?? "");
      setPath(
        patch,
        field.path,
        raw.split(",").map((s) => s.trim()).filter(Boolean)
      );
      continue;
    }

    const raw = String(form.get(field.path) ?? "").trim();
    if (!raw) {
      setPath(patch, field.path, undefined);
      continue;
    }

    if (field.kind === "number") {
      const n = Number(raw);
      setPath(patch, field.path, Number.isFinite(n) ? Math.trunc(n) : undefined);
      continue;
    }

    setPath(patch, field.path, raw);
  }

  return patch;
}
