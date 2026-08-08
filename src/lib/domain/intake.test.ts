/* Intake normalisation.
 *
 * The two fixtures below mirror the shape and the *defects* of two real
 * submissions from the live form. Every name, email, phone number and
 * date is invented — real applicant data does not belong in a repository
 * (docs/APP-PLAN.md §10.2, and §4.5: never copy production data
 * downward). What is faithful is the field set, the sentinel values, the
 * empty wali block and the internal contradiction in the height.
 */
import { describe, expect, it } from "vitest";
import {
  FIELDS,
  LOOKING_FOR_HUSBAND,
  LOOKING_FOR_WIFE,
  HIJAB,
  ageOn,
  answered,
  heightsMentionedInProse,
  inferGender,
  normaliseIntake,
  parseDateOfBirth,
  parseHeightToCm,
  splitLegalName,
  type RawIntake,
} from "./intake";

const NOW = new Date("2026-08-08T00:00:00Z");

const EMPTY_WALI = {
  [FIELDS.fullName]: "",
  [FIELDS.email]: "",
  [FIELDS.phone]: "",
  [FIELDS.waliRelationship]: "",
  [FIELDS.waliDelivery]: "",
};

/* Brother abroad. Long biography in the occupation field, a four-part
 * Arabic name, and a height field that contradicts his own prose. */
const BROTHER: RawIntake = {
  member: {
    [FIELDS.fullName]: "Bilal Kareem Yusuf Nasser",
    [FIELDS.email]: "bilal.example@example.com",
    [FIELDS.phone]: "(053) 000-0000",
    [FIELDS.livesIn]: "Abha",
    [FIELDS.ethnicity]: "Yemen",
    [FIELDS.otherEthnicity]: "",
    [FIELDS.languages]: "Arabic and English",
    [FIELDS.dob]: "January 01, 1999",
    [FIELDS.height]: `6'8"`,
    [FIELDS.weight]: "84",
    [FIELDS.health]: "No I don't",
    [FIELDS.citizenship]: "Citizen",
    [FIELDS.maritalStatus]: "Never Married",
    [FIELDS.aboutMe]:
      "I am 187 cm tall and weigh 84 kg. I work in design and printing, a field I " +
      "enjoy because it combines creativity with hands-on work. " +
      "x".repeat(400),
    [LOOKING_FOR_WIFE]: "A Muslim woman who values faith and good character.",
    [FIELDS.heardAbout]: "",
    "Declaration of Islamic faith": "I understand and agree",
    Terms: "I agree",
  },
  wali: { ...EMPTY_WALI },
};

/* Sister in Montreal. Marital status left on the placeholder, and the
 * whole wali block empty — which the live form accepts. */
const SISTER: RawIntake = {
  member: {
    [FIELDS.fullName]: "Aisha Mwangi",
    [FIELDS.email]: "aisha.example@example.com",
    [FIELDS.phone]: "(438) 000-0000",
    [FIELDS.livesIn]: "Montreal,Quebec,Canada",
    [FIELDS.ethnicity]: "Canada",
    [FIELDS.languages]: "English",
    [FIELDS.dob]: "March 02, 1981",
    [FIELDS.height]: `5'0"`,
    [FIELDS.weight]: "56",
    [FIELDS.health]: "No, I don't have any health issues",
    [FIELDS.citizenship]: "Refugee",
    [FIELDS.maritalStatus]: "Select",
    [HIJAB]: "Not Always. But I Try My Best",
    [FIELDS.aboutMe]: "Secondary school, cleaning, learning new things, cooking.",
    [LOOKING_FOR_HUSBAND]: "Mature, honest, caring, aged 40 to 50, must be in Canada.",
    [FIELDS.heardAbout]: "Personal Referral",
    "Declaration of Islamic faith": "I understand and agree",
    Terms: "I agree",
  },
  wali: { ...EMPTY_WALI },
};

describe("answered", () => {
  it("treats an unchanged <select> placeholder as unanswered", () => {
    expect(answered("Select")).toBeUndefined();
    expect(answered("select")).toBeUndefined();
  });

  it("keeps real answers, trimmed", () => {
    expect(answered("  Never Married ")).toBe("Never Married");
  });

  it("treats blank and missing alike", () => {
    expect(answered("")).toBeUndefined();
    expect(answered(undefined)).toBeUndefined();
    expect(answered("   ")).toBeUndefined();
  });

  it("does not swallow an answer that merely contains a sentinel word", () => {
    expect(answered("None of the above")).toBe("None of the above");
  });
});

describe("parseHeightToCm", () => {
  it("parses feet and inches", () => {
    expect(parseHeightToCm(`5'0"`)).toBe(152);
    expect(parseHeightToCm(`6'1"`)).toBe(185);
    expect(parseHeightToCm(`6'8"`)).toBe(203);
  });

  it("accepts a curly apostrophe and a missing inches part", () => {
    expect(parseHeightToCm("5’11”")).toBe(180);
    expect(parseHeightToCm(`6'`)).toBe(183);
  });

  it("accepts centimetres", () => {
    expect(parseHeightToCm("187cm")).toBe(187);
    expect(parseHeightToCm("187 CM")).toBe(187);
  });

  it("rejects nonsense rather than guessing", () => {
    expect(parseHeightToCm("tall")).toBeNull();
    expect(parseHeightToCm(`5'15"`)).toBeNull();
    expect(parseHeightToCm("")).toBeNull();
  });
});

describe("heightsMentionedInProse", () => {
  it("finds a height a member restates in their own words", () => {
    expect(heightsMentionedInProse("I am 187 cm tall and weigh 84 kg")).toEqual([187]);
  });

  it("ignores weights and other numbers", () => {
    expect(heightsMentionedInProse("I weigh 84 kg and have 6 brothers")).toEqual([]);
  });
});

describe("parseDateOfBirth", () => {
  it("parses the form's long format", () => {
    expect(parseDateOfBirth("January 01, 1999")?.getUTCFullYear()).toBe(1999);
    expect(parseDateOfBirth("March 02, 1981")?.getUTCMonth()).toBe(2);
  });

  it("rejects unparseable input", () => {
    expect(parseDateOfBirth("sometime in the nineties")).toBeNull();
    expect(parseDateOfBirth("")).toBeNull();
  });
});

describe("ageOn", () => {
  it("does not count a birthday that has not happened yet", () => {
    expect(ageOn(new Date("1999-12-31T00:00:00Z"), NOW)).toBe(26);
    expect(ageOn(new Date("1999-01-01T00:00:00Z"), NOW)).toBe(27);
  });

  it("counts the birthday itself", () => {
    expect(ageOn(new Date("2000-08-08T00:00:00Z"), NOW)).toBe(26);
  });
});

describe("splitLegalName", () => {
  it("splits two parts", () => {
    expect(splitLegalName("Aisha Mwangi")).toMatchObject({ first: "Aisha", last: "Mwangi" });
  });

  it("keeps the middle of a long Arabic name and reports the part count", () => {
    expect(splitLegalName("Bilal Kareem Yusuf Nasser")).toEqual({
      first: "Bilal",
      middle: "Kareem Yusuf",
      last: "Nasser",
      parts: 4,
    });
  });

  it("handles a mononym", () => {
    expect(splitLegalName("Sukarno")).toEqual({ first: "Sukarno", parts: 1 });
  });
});

describe("inferGender", () => {
  it("reads a brother from the future-wife question", () => {
    expect(inferGender(BROTHER.member)).toBe("brother");
  });

  it("reads a sister from the future-husband question", () => {
    expect(inferGender(SISTER.member)).toBe("sister");
  });

  it("reads a sister from the hijab question alone", () => {
    expect(inferGender({ [HIJAB]: "Yes" })).toBe("sister");
  });

  it("refuses to guess when neither question was answered", () => {
    expect(inferGender({})).toBeNull();
  });

  it("refuses to guess when both were answered", () => {
    expect(
      inferGender({ [LOOKING_FOR_WIFE]: "…", [LOOKING_FOR_HUSBAND]: "…" })
    ).toBeNull();
  });
});

describe("normaliseIntake — the brother fixture", () => {
  const result = normaliseIntake(BROTHER, NOW);

  it("accepts the submission", () => {
    expect(result.ok).toBe(true);
  });

  it("infers gender from the conditional question", () => {
    expect(result.ok && result.value.gender).toBe("brother");
  });

  it("flags the height field that contradicts his own prose", () => {
    expect(result.flags).toContain("height-contradicts-prose");
    expect(result.flags).toContain("height-implausible");
  });

  it("flags a birthday of 1 January for confirmation on the intake call", () => {
    expect(result.flags).toContain("dob-first-of-january");
  });

  it("flags a four-part name, because first-plus-last will read wrong", () => {
    expect(result.flags).toContain("name-many-parts");
    expect(result.ok && result.value.initials).toBe("B.N");
  });

  it("flags an occupation field being used as a biography", () => {
    expect(result.flags).toContain("occupation-is-prose");
  });

  it("does not flag a missing wali for a brother", () => {
    expect(result.flags).not.toContain("sister-without-wali");
  });
});

describe("normaliseIntake — the sister fixture", () => {
  const result = normaliseIntake(SISTER, NOW);

  it("accepts the submission rather than losing the applicant", () => {
    expect(result.ok).toBe(true);
  });

  it("flags the empty wali block, which the live form allows", () => {
    expect(result.flags).toContain("sister-without-wali");
  });

  it("does not store the placeholder as a marital status", () => {
    expect(result.ok && result.value.maritalStatus).toBeUndefined();
    expect(result.flags).toContain("marital-status-unanswered");
  });

  it("keeps a citizenship status a guessed enum would have rejected", () => {
    expect(result.ok && result.value.citizenship).toBe("Refugee");
  });

  it("keeps the unsplit location verbatim", () => {
    expect(result.ok && result.value.livesIn).toBe("Montreal,Quebec,Canada");
  });

  it("computes age from the date of birth", () => {
    expect(result.ok && result.value.age).toBe(45);
  });
});

describe("normaliseIntake — rejection", () => {
  it("rejects a submission with no usable email", () => {
    const bad: RawIntake = {
      member: { ...BROTHER.member, [FIELDS.email]: "not-an-email" },
      wali: { ...EMPTY_WALI },
    };
    const result = normaliseIntake(bad, NOW);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toMatch(/email/i);
  });

  it("rejects a minor, and says which field", () => {
    const bad: RawIntake = {
      member: { ...BROTHER.member, [FIELDS.dob]: "January 01, 2012" },
      wali: { ...EMPTY_WALI },
    };
    const result = normaliseIntake(bad, NOW);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toMatch(/age/);
  });

  it("still reports flags on a rejected submission", () => {
    const bad: RawIntake = {
      member: { ...SISTER.member, [FIELDS.email]: "" },
      wali: { ...EMPTY_WALI },
    };
    const result = normaliseIntake(bad, NOW);
    expect(result.ok).toBe(false);
    expect(result.flags).toContain("sister-without-wali");
  });
});
