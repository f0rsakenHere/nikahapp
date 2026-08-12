import { describe, expect, it } from "vitest";
import { bestOf, scoreAgainst, scorePair, type Facts, type Preferences } from "./suggestions";

const NONE: Preferences = { provinces: [], maritalStatus: [], madhhab: [] };

const prefs = (over: Partial<Preferences> = {}): Preferences => ({ ...NONE, ...over });
const facts = (over: Partial<Facts> = {}): Facts => ({ age: 30, ...over });

describe("scoreAgainst", () => {
  it("says nothing about somebody when nothing was asked for", () => {
    expect(scoreAgainst(NONE, facts({ province: "QC" }))).toEqual({ score: 0, reasons: [] });
  });

  it("counts an age range, and names it in the reader's terms", () => {
    const r = scoreAgainst(prefs({ ageMin: 25, ageMax: 35 }), facts({ age: 30 }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.reasons).toContain("in your age range");
  });

  it("treats an open-ended range as a real preference", () => {
    /* "25 and up" is an answer. Somebody of 60 satisfies it. */
    expect(scoreAgainst(prefs({ ageMin: 25 }), facts({ age: 60 })).score).toBeGreaterThan(0);
    expect(scoreAgainst(prefs({ ageMin: 25 }), facts({ age: 19 })).score).toBe(0);
  });

  it("does not credit an age it does not know", () => {
    expect(scoreAgainst(prefs({ ageMin: 25, ageMax: 35 }), facts({ age: null })).score).toBe(0);
  });

  it("never penalises a preference left blank", () => {
    /* Silence means "no preference", so an empty madhhab list must not
       drag anybody down relative to somebody who answered. */
    const answered = scoreAgainst(prefs({ madhhab: ["hanafi"] }), facts({ madhhab: "hanafi" }));
    const blank = scoreAgainst(prefs(), facts({ madhhab: "hanafi" }));
    expect(blank.score).toBe(0);
    expect(answered.score).toBeGreaterThan(blank.score);
  });

  it("uses the labels the rest of the app shows", () => {
    const r = scoreAgainst(prefs({ provinces: ["QC"] }), facts({ province: "QC" }), {
      province: () => "Quebec",
    });
    expect(r.reasons).toContain("Quebec");
    expect(r.reasons).not.toContain("QC");
  });
});

describe("scorePair", () => {
  const meetsHer: Preferences = prefs({ ageMin: 25, ageMax: 40 });
  const him: Facts = facts({ age: 32 });
  const her: Facts = facts({ age: 29 });

  it("ranks a mutual fit above a one-sided one", () => {
    const mutual = scorePair(meetsHer, her, prefs({ ageMin: 28, ageMax: 36 }), him);
    const oneWay = scorePair(meetsHer, her, NONE, him);
    expect(mutual.score).toBeGreaterThan(oneWay.score);
    expect(mutual.reasons).toContain("you fit what they are looking for");
  });

  it("does not claim mutuality from somebody who stated nothing", () => {
    /* Blank preferences match everyone trivially. Calling that "they are
       looking for someone like you" would be the product inventing an
       opinion on their behalf. */
    const r = scorePair(meetsHer, her, NONE, him);
    expect(r.reasons).not.toContain("you fit what they are looking for");
  });

  it("does not claim mutuality when their conditions are not met", () => {
    const r = scorePair(meetsHer, her, prefs({ ageMin: 40, ageMax: 50 }), him);
    expect(r.reasons).not.toContain("you fit what they are looking for");
  });
});

describe("bestOf", () => {
  const s = (score: number) => ({ item: score, suggestion: { score, reasons: ["x"] } });

  it("drops anyone who matched nothing", () => {
    /* A suggestion that cannot say why it was suggested is filler, and
       filler is how a section stops being trusted. */
    expect(bestOf([s(0), s(3)], 5).map((x) => x.item)).toEqual([3]);
  });

  it("returns the strongest first, and no more than asked", () => {
    expect(bestOf([s(2), s(9), s(5)], 2).map((x) => x.item)).toEqual([9, 5]);
  });
});
