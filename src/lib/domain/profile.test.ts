import { describe, expect, it } from "vitest";
import {
  CITIZENSHIP,
  PROFILE_STATUSES,
  ProfileDraftSchema,
  STEPS,
  completeness,
  inPool,
  poolStatuses,
  stepById,
  stepsFor,
  submitBlockers,
  type ProfileDraft,
} from "./profile";

const NOW = new Date("2026-08-08T00:00:00Z");

function draft(over: Partial<ProfileDraft> = {}): ProfileDraft {
  return ProfileDraftSchema.parse({
    id: "p1",
    userId: "u1",
    gender: "sister",
    status: "draft",
    initials: "F.A",
    completeness: { step: 1, of: 5, percent: 0 },
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  });
}

/** A profile with every required answer filled in. */
function complete(over: Partial<ProfileDraft> = {}): ProfileDraft {
  return draft({
    basics: {
      birthYear: 1995,
      city: "Montreal",
      province: "QC",
      citizenship: "citizen",
    },
    background: {
      maritalStatus: "neverMarried",
      children: "none",
      languages: ["English", "Arabic"],
    },
    education: { level: "bachelor" },
    deen: { salah: "fiveDaily", madhhab: "hanafi", dress: "hijab" },
    lookingFor: { ageMin: 27, ageMax: 38, provinces: ["QC", "ON"] },
    ...over,
  } as Partial<ProfileDraft>);
}

describe("ProfileDraftSchema", () => {
  it("accepts an empty draft — nothing is required to start", () => {
    expect(draft().basics).toEqual({});
  });

  /* Regression. An outer `.default({})` on these objects gave back the
     literal `{}` without running the inner defaults, so the arrays came
     out undefined and `required()` was one short-circuit away from
     throwing on `.length`. */
  it("gives the array fields real defaults when the whole section is absent", () => {
    const empty = draft();
    expect(empty.background.languages).toEqual([]);
    expect(empty.lookingFor.provinces).toEqual([]);
    expect(empty.lookingFor.maritalStatus).toEqual([]);
    expect(empty.lookingFor.madhhab).toEqual([]);
  });

  it("does not throw when asked for progress on a completely empty draft", () => {
    expect(() => submitBlockers(draft(), { hasConfirmedWali: false })).not.toThrow();
    expect(() => completeness(draft())).not.toThrow();
  });

  it("keeps a citizenship status a guessed list would have rejected", () => {
    expect(CITIZENSHIP).toContain("refugee");
    expect(draft({ basics: { citizenship: "refugee" } } as Partial<ProfileDraft>).basics.citizenship).toBe(
      "refugee"
    );
  });

  it("offers a way out of every sensitive question", () => {
    /* A required radio group with no escape gets answered dishonestly,
       and a dishonest answer is worse than a missing one here. */
    for (const field of ["salah", "madhhab", "dress", "beard", "quran"] as const) {
      const parsed = ProfileDraftSchema.safeParse({
        ...draft(),
        deen: { [field]: "preferNotToSay" },
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("refuses an age range that runs backwards", () => {
    const bad = ProfileDraftSchema.safeParse({
      ...draft(),
      lookingFor: { ageMin: 40, ageMax: 30, provinces: [], maritalStatus: [], madhhab: [] },
    });
    expect(bad.success).toBe(false);
    expect(!bad.success && bad.error.issues[0].message).toMatch(/youngest/);
  });

  it("allows a range with only one end set, mid-draft", () => {
    const partial = ProfileDraftSchema.safeParse({
      ...draft(),
      lookingFor: { ageMin: 40, provinces: [], maritalStatus: [], madhhab: [] },
    });
    expect(partial.success).toBe(true);
  });

  it("stores a birth year, never an exact date", () => {
    expect(Object.keys(ProfileDraftSchema.parse(draft()).basics)).not.toContain("dateOfBirth");
  });

  it("knows about every profile status in the plan", () => {
    expect(PROFILE_STATUSES).toContain("pendingReview");
    expect(PROFILE_STATUSES).toContain("withdrawn");
  });

  it("caps free text rather than accepting a novel", () => {
    const tooLong = ProfileDraftSchema.safeParse({
      ...draft(),
      freeText: { aboutMe: "x".repeat(4001) },
    });
    expect(tooLong.success).toBe(false);
  });

  it("accepts the ~1,800 character biography a real applicant wrote", () => {
    const ok = ProfileDraftSchema.safeParse({
      ...draft(),
      freeText: { aboutMe: "x".repeat(1800) },
    });
    expect(ok.success).toBe(true);
  });
});

describe("stepsFor", () => {
  it("shows a sister all five steps", () => {
    expect(stepsFor("sister").map((s) => s.id)).toEqual([
      "basics",
      "background",
      "deen",
      "guardian",
      "lookingFor",
    ]);
  });

  it("shows a brother the reference step where she has her wali", () => {
    expect(stepsFor("brother").map((s) => s.id)).toEqual([
      "basics",
      "background",
      "deen",
      "reference",
      "lookingFor",
    ]);
  });

  it("never shows a sister the reference step — her wali vouches for her", () => {
    expect(stepsFor("sister").map((s) => s.id)).not.toContain("reference");
  });

  it("never shows a brother the wali step — the wali is her guardian", () => {
    /* It used to be there, optional and uncounted. An optional step that
       invites a man by email and tells him he may approve and read is a
       wali system whatever the label says, and nothing downstream ever
       gave him a seat. */
    expect(stepsFor("brother").map((s) => s.id)).not.toContain("guardian");
  });

  it("finishes a brother at 100% without anybody being asked to confirm", () => {
    const full = draft({
      gender: "brother",
      basics: { birthYear: 1995, city: "Montreal", province: "QC", citizenship: "citizen" },
      background: { maritalStatus: "neverMarried", children: "none", languages: ["English"] },
      education: { level: "bachelor" },
      deen: { salah: "fiveDaily", madhhab: "hanafi", beard: "yes" },
      reference: { name: "Imam", relationship: "Imam", phone: "+15145550100" },
      lookingFor: { ageMin: 25, ageMax: 40, provinces: ["QC"], maritalStatus: [], madhhab: [] },
    } as Partial<ProfileDraft>);

    expect(completeness(full, { hasConfirmedWali: false }).percent).toBe(100);
    expect(submitBlockers(full, { hasConfirmedWali: false })).toEqual([]);
  });

  it("matches the mock-ups: deen is step 3 of 5, the wali step 4", () => {
    expect(stepById("deen")?.n).toBe(3);
    expect(stepById("guardian")?.n).toBe(4);
  });

  it("keeps six definitions for five visible steps — slot 4 has two forms", () => {
    expect(STEPS).toHaveLength(6);
    expect(stepById("guardian")?.n).toBe(4);
    expect(stepById("reference")?.n).toBe(4);
  });
});

describe("completeness", () => {
  it("starts at nothing", () => {
    expect(completeness(draft())).toEqual({ step: 1, of: 5, percent: 0 });
  });

  it("counts a brother out of five, like a sister", () => {
    expect(completeness(draft({ gender: "brother" })).of).toBe(5);
  });

  it("resumes at the first unfinished step, not the furthest reached", () => {
    /* Someone who skipped step 2 and finished step 3 goes back to 2. */
    const skipped = complete({
      background: { maritalStatus: undefined, children: undefined, languages: [] },
    } as Partial<ProfileDraft>);
    expect(completeness(skipped).step).toBe(2);
  });

  it("holds a fully-answered sister at 80% until her wali confirms", () => {
    /* The honest number. Her profile cannot go live yet, and showing
       100% next to "waiting on your wali" is the kind of contradiction
       that makes people distrust the whole screen. */
    const c = completeness(complete());
    expect(c.percent).toBe(80);
    expect(c.step).toBe(4); // resume lands on the wali step
  });

  it("holds a brother at 80% until he names a reference", () => {
    const brother = complete({ gender: "brother", deen: { salah: "fiveDaily", madhhab: "hanafi", beard: "yes" } } as Partial<ProfileDraft>);
    expect(completeness(brother).percent).toBe(80);
    expect(completeness(brother).step).toBe(4);
  });

  it("reaches 100% for a brother once he has", () => {
    const brother = complete({
      gender: "brother",
      deen: { salah: "fiveDaily", madhhab: "hanafi", beard: "yes" },
      reference: { name: "Imam Suleiman", relationship: "My imam", phone: "5140000000" },
    } as Partial<ProfileDraft>);
    expect(completeness(brother)).toEqual({ step: 5, of: 5, percent: 100 });
  });
});

describe("the deen step is gendered", () => {
  it("asks a sister about hijab, and will not accept a beard instead", () => {
    const sister = complete({ deen: { salah: "fiveDaily", madhhab: "hanafi", beard: "yes" } } as Partial<ProfileDraft>);
    expect(submitBlockers(sister, { hasConfirmedWali: true })).toContainEqual({
      step: "deen",
      reason: "incomplete",
    });
  });

  it("asks a brother about his beard, and will not accept hijab instead", () => {
    const brother = complete({
      gender: "brother",
      deen: { salah: "fiveDaily", madhhab: "hanafi", dress: "hijab" },
    } as Partial<ProfileDraft>);
    expect(submitBlockers(brother, { hasConfirmedWali: false })).toContainEqual({
      step: "deen",
      reason: "incomplete",
    });
  });
});

describe("submitBlockers", () => {
  it("passes a complete sister with a confirmed wali", () => {
    expect(submitBlockers(complete(), { hasConfirmedWali: true })).toEqual([]);
  });

  it("blocks a complete sister whose wali has not confirmed", () => {
    expect(submitBlockers(complete(), { hasConfirmedWali: false })).toEqual([
      { step: "guardian", reason: "wali-not-confirmed" },
    ]);
  });

  it("never asks a brother for a wali, but does ask for a reference", () => {
    const noReference = complete({
      gender: "brother",
      deen: { salah: "fiveDaily", madhhab: "hanafi", beard: "trimmed" },
    } as Partial<ProfileDraft>);
    expect(submitBlockers(noReference, { hasConfirmedWali: false })).toEqual([
      { step: "reference", reason: "incomplete" },
    ]);

    const withReference = complete({
      gender: "brother",
      deen: { salah: "fiveDaily", madhhab: "hanafi", beard: "trimmed" },
      reference: { name: "Imam Suleiman", relationship: "My imam", phone: "5140000000" },
    } as Partial<ProfileDraft>);
    expect(submitBlockers(withReference, { hasConfirmedWali: false })).toEqual([]);
  });

  it("reports every unfinished step at once, not one at a time", () => {
    const blockers = submitBlockers(draft(), { hasConfirmedWali: false });
    expect(blockers.map((b) => b.step)).toEqual([
      "basics",
      "background",
      "deen",
      "lookingFor",
      "guardian",
    ]);
  });

  it("does not block on a field that is genuinely optional", () => {
    /* Height, ethnicity, quran, family detail and the free text are all
       unset in `complete()` and must not stand in anyone's way. */
    expect(submitBlockers(complete(), { hasConfirmedWali: true })).toEqual([]);
  });
});

describe("completeness with the guardianship in view", () => {
  it("holds a sister at 80% while nobody has confirmed", () => {
    expect(completeness(complete(), { hasConfirmedWali: false }).percent).toBe(80);
  });

  it("reaches 100% once her wali has", () => {
    expect(completeness(complete(), { hasConfirmedWali: true })).toEqual({
      step: 5,
      of: 5,
      percent: 100,
    });
  });

  /* The safe default: a screen that cannot see the guardianship must
     not claim she is finished. */
  it("assumes no wali when it is not told", () => {
    expect(completeness(complete()).percent).toBe(80);
  });
});

/* ------------------------------------------------------------ the pool -- */

describe("who is in the pool", () => {
  const gated = { requireVerifiedToBrowse: true };
  const open = { requireVerifiedToBrowse: false };

  it("is only the approved while approval is the gate", () => {
    expect(poolStatuses(gated)).toEqual(["live"]);
    expect(inPool("live", gated)).toBe(true);
    for (const status of ["draft", "pendingCall", "pendingReview", "verifying"]) {
      expect(inPool(status, gated)).toBe(false);
    }
  });

  it("adds everyone who has finished and sent it in once approval is deferred", () => {
    for (const status of ["pendingCall", "pendingReview", "verifying", "live"]) {
      expect(inPool(status, open)).toBe(true);
    }
  });

  /* Deferring approval is a decision about the queue, not about consent
     or about anybody's choice to be out. A draft has never been offered
     to anyone, and the last four are all somebody having left. */
  it("never includes a draft, or anyone who is out by their own or our decision", () => {
    for (const settings of [gated, open]) {
      for (const status of ["draft", "paused", "matched", "withdrawn", "rejected"]) {
        expect(inPool(status, settings)).toBe(false);
      }
    }
  });

  /* If a status is added and nobody decides which side of this it falls
     on, it silently falls outside — which is the safe direction, and
     this is here so the omission is at least visible. */
  it("accounts for every status that exists", () => {
    const decided = new Set([...poolStatuses(open), "draft", "paused", "matched", "withdrawn", "rejected"]);
    expect([...PROFILE_STATUSES].filter((s) => !decided.has(s))).toEqual([]);
  });
});
