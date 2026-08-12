/* Who to put in front of somebody, and why.
 *
 * The profile builder ends with a whole step — "What you are looking
 * for": an age range, provinces, marital status, madhhab — and until now
 * nothing read a word of it. People answered five questions about what
 * matters to them and the product carried on showing them the pool in
 * the order it went live.
 *
 * ── What this is not ──────────────────────────────────────────────────
 * Not compatibility, and not a percentage. Reducing a person to 73% is
 * both false and unkind, and in a marriage context it invites a
 * precision nobody has. This ranks by *how many of their own stated
 * conditions are met*, and every point it awards can be named in a
 * sentence the reader recognises as their own answer.
 *
 * Silence is never a penalty. A member who left "madhhab you would
 * consider" empty has said "no preference", not "no match" — so an
 * unstated criterion scores zero for everyone and moves nobody up or
 * down.
 *
 * Mutuality is weighted highest deliberately. That somebody fits your
 * conditions is half a fact; that you also fit theirs is the half that
 * decides whether asking is worth one of your connections.
 * ──────────────────────────────────────────────────────────────────────
 *
 * Pure. No I/O, no clock — `age` arrives already computed.
 */

export type Preferences = {
  ageMin?: number;
  ageMax?: number;
  provinces: readonly string[];
  maritalStatus: readonly string[];
  madhhab: readonly string[];
};

/** The facts about one person that preferences are checked against. */
export type Facts = {
  age: number | null;
  province?: string;
  maritalStatus?: string;
  madhhab?: string;
};

export type Suggestion = {
  /** Higher is more of what they asked for. Never shown as a number. */
  score: number;
  /** Their own answers, echoed back — "in your age range", "Hanafi". */
  reasons: string[];
};

const WEIGHT = {
  age: 3,
  province: 3,
  maritalStatus: 2,
  madhhab: 2,
  /* More than any single condition: fitting each other is the thing
     that makes asking worthwhile. */
  mutual: 5,
} as const;

/** Does this person meet the conditions the viewer stated? */
export function scoreAgainst(
  prefs: Preferences,
  facts: Facts,
  labels: {
    province?: (code: string) => string;
    maritalStatus?: (code: string) => string;
    madhhab?: (code: string) => string;
  } = {}
): Suggestion {
  let score = 0;
  const reasons: string[] = [];

  /* An open-ended range still counts: "25 and up" is a stated
     preference, and somebody of 40 satisfies it. */
  if (prefs.ageMin !== undefined || prefs.ageMax !== undefined) {
    const age = facts.age;
    const withinLow = prefs.ageMin === undefined || (age !== null && age >= prefs.ageMin);
    const withinHigh = prefs.ageMax === undefined || (age !== null && age <= prefs.ageMax);
    if (age !== null && withinLow && withinHigh) {
      score += WEIGHT.age;
      reasons.push("in your age range");
    }
  }

  if (prefs.provinces.length && facts.province && prefs.provinces.includes(facts.province)) {
    score += WEIGHT.province;
    reasons.push(labels.province?.(facts.province) ?? facts.province);
  }

  if (
    prefs.maritalStatus.length &&
    facts.maritalStatus &&
    prefs.maritalStatus.includes(facts.maritalStatus)
  ) {
    score += WEIGHT.maritalStatus;
    reasons.push(labels.maritalStatus?.(facts.maritalStatus) ?? facts.maritalStatus);
  }

  if (prefs.madhhab.length && facts.madhhab && prefs.madhhab.includes(facts.madhhab)) {
    score += WEIGHT.madhhab;
    reasons.push(labels.madhhab?.(facts.madhhab) ?? facts.madhhab);
  }

  return { score, reasons };
}

/** Both directions. `theirs` is the candidate's own "looking for". */
export function scorePair(
  mine: Preferences,
  theirFacts: Facts,
  theirs: Preferences,
  myFacts: Facts,
  labels?: Parameters<typeof scoreAgainst>[2]
): Suggestion {
  const forward = scoreAgainst(mine, theirFacts, labels);
  const back = scoreAgainst(theirs, myFacts, labels);

  /* Mutual only when they have actually stated something and you meet
     it. Somebody who left every preference blank matches everyone
     trivially, and calling that "looking for someone like you" would be
     the product putting words in their mouth. */
  const theyAskedForSomething =
    theirs.ageMin !== undefined ||
    theirs.ageMax !== undefined ||
    theirs.provinces.length > 0 ||
    theirs.maritalStatus.length > 0 ||
    theirs.madhhab.length > 0;

  if (theyAskedForSomething && back.score > 0) {
    return {
      score: forward.score + WEIGHT.mutual,
      reasons: [...forward.reasons, "you fit what they are looking for"],
    };
  }
  return forward;
}

/** The best few, strongest first, dropping anyone who matched nothing.
 *
 *  A suggestion that cannot say why it was suggested is not a
 *  suggestion, it is filler — and filler is how people stop trusting the
 *  section entirely. */
export function bestOf<T>(
  scored: readonly { item: T; suggestion: Suggestion }[],
  take: number
): { item: T; suggestion: Suggestion }[] {
  return scored
    .filter((s) => s.suggestion.score > 0)
    .sort((a, b) => b.suggestion.score - a.suggestion.score)
    .slice(0, take);
}
