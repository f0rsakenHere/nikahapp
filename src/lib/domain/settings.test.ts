/* The settings the client has actually decided.
 *
 * Every other default in this module is a recommendation waiting to be
 * argued with, and changing one is ordinary work. These two are not:
 * they were answered, and the file they live in is a wall of defaults
 * that all look alike, so an edit to the wrong line reads as a typo
 * nobody notices until a member is holding ten connections or waiting
 * on an approval that was meant to be deferred.
 *
 * These tests exist to fail loudly when that happens. If one of them
 * fails and the change was deliberate, change the number here too — and
 * the sentence above it, so the next reader knows who decided.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, OPEN_DECISIONS, SettingsSchema } from "./settings";

describe("the decided settings", () => {
  it("caps asks at five a week, and charges nothing for them", () => {
    /* The monthly connection allowance is gone: asking is free and what
       is sold is the conversation. Five is a placeholder the client has
       not replaced yet, which is exactly why it is pinned here — a
       placeholder nobody argues with is how a guess becomes a decision
       by accident. */
    expect(DEFAULT_SETTINGS.asksPerWeek).toBe(5);
  });

  it("ships with the paywall off", () => {
    /* `brother` is the decided model, but turning it on before checkout
       exists would lock every conversation with no way to pay. It flips
       when Stripe lands, not before. */
    expect(DEFAULT_SETTINGS.planGate).toBe("nobody");
  });

  it("does not hold a finished profile behind approval", () => {
    /* D1f, decided by the client: finishing puts you in the pool, and
       the checks run behind it rather than in front. */
    expect(DEFAULT_SETTINGS.requireVerifiedToBrowse).toBe(false);
  });

  it("still asks the two questions that are actually open", () => {
    /* The staff console renders OPEN_DECISIONS. D1a, D1b and D1c are
       closed — asking is free, the plan sells the conversation, and the
       brother's plan unlocks it — and their settings no longer exist, so
       the register cannot ask about them even by accident.

       What is left is the number and the switch. Five a week is a
       placeholder, and `planGate` is the lever that starts charging
       people; both belong in front of somebody. */
    const open = OPEN_DECISIONS.map((d) => d.key);
    expect(open).toContain("asksPerWeek");
    expect(open).toContain("planGate");
  });

  it("every open decision names a real setting", () => {
    const keys = Object.keys(SettingsSchema.shape);
    for (const d of OPEN_DECISIONS) expect(keys).toContain(d.key);
  });
});
