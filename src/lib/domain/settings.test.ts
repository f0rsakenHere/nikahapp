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
  it("gives three connections a month", () => {
    /* D1a, decided by the client. Was ten, which was never more than a
       number from a conversation. */
    expect(DEFAULT_SETTINGS.grantPerMonth).toBe(3);
  });

  it("does not hold a finished profile behind approval", () => {
    /* D1f, decided by the client: finishing puts you in the pool, and
       the checks run behind it rather than in front. */
    expect(DEFAULT_SETTINGS.requireVerifiedToBrowse).toBe(false);
  });

  it("no longer asks the client how many connections to give", () => {
    /* The staff console renders OPEN_DECISIONS. Half of D1a is settled,
       so what is asked there is the half that is not: whether more can
       be bought. Asking somebody a question they have already answered
       is how a decision gets re-opened by accident.

       requireVerifiedToBrowse is deliberately NOT asserted here. It is
       decided too, but its entry earns its place: the risk it names —
       that the pipeline becomes decorative — is live for as long as the
       setting is false, and staff should keep reading it. */
    expect(OPEN_DECISIONS.map((d) => d.key)).not.toContain("grantPerMonth");
  });

  it("every open decision names a real setting", () => {
    const keys = Object.keys(SettingsSchema.shape);
    for (const d of OPEN_DECISIONS) expect(keys).toContain(d.key);
  });
});
