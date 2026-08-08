/* Human wording for the stored option values.
 *
 * Values are stored as stable identifiers ("fiveDaily") and displayed as
 * sentences ("Five daily prayers"). Keeping the two apart means the copy
 * can be reworded — or translated into fr-CA, which Bill 96 makes a
 * legal requirement rather than a nicety (§10.3) — without a migration
 * over every profile in the database.
 *
 * These become message catalogue keys when next-intl lands. Until then
 * they live here, next to the values they describe.
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
} from "./profile";

type Labels<T extends readonly string[]> = Record<T[number], string>;

export const SALAH_LABELS: Labels<typeof SALAH> = {
  fiveDaily: "Five daily",
  mostPrayers: "Most prayers",
  somePrayers: "Some prayers",
  rarely: "Rarely",
  preferNotToSay: "Prefer not to say",
};

export const MADHHAB_LABELS: Labels<typeof MADHHAB> = {
  hanafi: "Hanafi",
  maliki: "Maliki",
  shafii: "Shafi'i",
  hanbali: "Hanbali",
  none: "No specific madhhab",
  preferNotToSay: "Prefer not to say",
};

export const DRESS_LABELS: Labels<typeof DRESS> = {
  niqab: "Niqab",
  hijab: "Hijab",
  hijabSometimes: "Hijab most of the time",
  noHijab: "I do not wear hijab",
  preferNotToSay: "Prefer not to say",
};

export const BEARD_LABELS: Labels<typeof BEARD> = {
  yes: "Yes",
  trimmed: "Trimmed",
  no: "No",
  preferNotToSay: "Prefer not to say",
};

export const QURAN_LABELS: Labels<typeof QURAN> = {
  hafiz: "Hafiz",
  readsWithTajweed: "Reads with tajweed",
  reads: "Reads",
  learning: "Learning",
  preferNotToSay: "Prefer not to say",
};

export const MARITAL_STATUS_LABELS: Labels<typeof MARITAL_STATUS> = {
  neverMarried: "Never married",
  divorced: "Divorced",
  widowed: "Widowed",
  separated: "Separated",
};

export const CHILDREN_LABELS: Labels<typeof CHILDREN> = {
  none: "No children",
  yesLivingWithMe: "Yes, living with me",
  yesNotLivingWithMe: "Yes, not living with me",
};

export const CITIZENSHIP_LABELS: Labels<typeof CITIZENSHIP> = {
  citizen: "Canadian citizen",
  permanentResident: "Permanent resident",
  workPermit: "Work permit",
  studyPermit: "Study permit",
  refugee: "Refugee or protected person",
  visitor: "Visitor",
  other: "Something else",
};

export const EDUCATION_LABELS: Labels<typeof EDUCATION> = {
  highSchool: "High school",
  collegeDiploma: "College or diploma",
  bachelor: "Bachelor's degree",
  master: "Master's degree",
  doctorate: "Doctorate",
  islamicStudies: "Islamic studies",
  other: "Something else",
};

export const RELOCATE_LABELS: Labels<typeof RELOCATE> = {
  yes: "Yes",
  no: "No",
  maybe: "For the right person",
};

export const PROVINCE_LABELS: Labels<typeof PROVINCES> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
  outsideCanada: "Outside Canada",
};

/** `["fiveDaily", …]` → `[{ value, label }, …]`, in declaration order. */
export function toOptions<T extends readonly string[]>(
  values: T,
  labels: Labels<T>
): { value: T[number]; label: string }[] {
  return values.map((v) => ({ value: v as T[number], label: labels[v as T[number]] }));
}
