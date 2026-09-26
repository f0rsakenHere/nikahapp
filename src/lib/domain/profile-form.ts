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
  HEIGHT_OPTIONS,
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

/* `basics.birthYear` is not here on purpose. It is set from the date of
   birth given at sign-up (see `createMemberAccount`) and never asked
   for again: a second question about the same fact is one the person
   has already answered, and two answers that can disagree. It is still
   part of the profile — browse filters and the admin table read it —
   just not something this form collects. */
export const STEP_FIELDS: Record<Exclude<StepId, "guardian">, FieldSpec[]> = {
  basics: [
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
      /* Still a number, and still stored in centimetres — the options
         only change how it is asked. A number field carrying a fixed
         list renders as a dropdown; see `SpecField`. */
      path: "basics.heightCm",
      kind: "number",
      label: "Height",
      min: 137,
      max: 220,
      options: HEIGHT_OPTIONS,
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
