import { describe, expect, it } from "vitest";
import { hasActivePlan, messageAllowance, type PlanSettings } from "./plan";

const NOW = new Date("2026-09-15T12:00:00Z");
const ON: PlanSettings = { planGate: "brother", freeMessagesPerConversation: 3 };
const OFF: PlanSettings = { planGate: "nobody", freeMessagesPerConversation: 3 };
/* What the site actually runs on from 9 Nov 2026: both sides pay, at
   different prices. The "brother" gate above predates sisters having a
   price at all and is kept because the setting still allows it. */
const BOTH: PlanSettings = { planGate: "everybody", freeMessagesPerConversation: 3 };

const brother = (sentSoFar: number, hasPlan = false) =>
  ({ role: "member", gender: "brother", sentSoFar, hasPlan }) as const;
const sister = (sentSoFar: number) =>
  ({ role: "member", gender: "sister", sentSoFar, hasPlan: false }) as const;

describe("messageAllowance", () => {
  it("lets a brother send his first three messages free", () => {
    for (const sent of [0, 1, 2]) {
      const a = messageAllowance(brother(sent), ON);
      expect(a.gated && a.needsPlan).toBe(false);
    }
  });

  it("needs a plan for his fourth", () => {
    expect(messageAllowance(brother(3), ON)).toEqual({
      gated: true,
      free: 3,
      used: 3,
      left: 0,
      needsPlan: true,
    });
  });

  it("counts down what is left", () => {
    expect(messageAllowance(brother(1), ON)).toMatchObject({ left: 2, needsPlan: false });
  });

  it("never charges a sister, however much she writes", () => {
    expect(messageAllowance(sister(500), ON)).toEqual({ gated: false });
  });

  it("lets a brother with a plan keep writing", () => {
    expect(messageAllowance(brother(40, true), ON)).toEqual({ gated: false });
  });

  it("does not charge a wali", () => {
    expect(
      messageAllowance({ role: "wali", gender: "brother", sentSoFar: 9, hasPlan: false }, ON)
    ).toEqual({ gated: false });
  });

  it("does not charge somebody whose gender could not be read", () => {
    expect(
      messageAllowance({ role: "member", gender: null, sentSoFar: 9, hasPlan: false }, ON)
    ).toEqual({ gated: false });
  });

  it("applies to nobody while the paywall is off", () => {
    expect(messageAllowance(brother(99), OFF)).toEqual({ gated: false });
  });

  /* ---- the gate the site is actually running ---------------------- */

  it("gates a sister too under `everybody`", () => {
    for (const sent of [0, 1, 2]) {
      expect(messageAllowance(sister(sent), BOTH)).toMatchObject({ needsPlan: false });
    }
    expect(messageAllowance(sister(3), BOTH)).toEqual({
      gated: true,
      free: 3,
      used: 3,
      left: 0,
      needsPlan: true,
    });
  });

  it("gates a brother the same way under `everybody`", () => {
    expect(messageAllowance(brother(3), BOTH)).toMatchObject({ needsPlan: true });
    expect(messageAllowance(brother(2), BOTH)).toMatchObject({ needsPlan: false });
  });

  it("lets anybody with a membership keep writing under `everybody`", () => {
    expect(messageAllowance(brother(99, true), BOTH)).toEqual({ gated: false });
    expect(
      messageAllowance({ role: "member", gender: "sister", sentSoFar: 99, hasPlan: true }, BOTH)
    ).toEqual({ gated: false });
  });

  /* A wali is not a customer under any setting. He reads his ward's
     conversation, and charging him to do it would be charging a family
     twice for one membership. */
  it("still does not charge a wali under `everybody`", () => {
    expect(
      messageAllowance({ role: "wali", gender: "brother", sentSoFar: 99, hasPlan: false }, BOTH)
    ).toEqual({ gated: false });
  });

  /* Unchanged under the wider gate, and deliberately: refusing somebody
     a message because their profile lookup came back empty is charging
     them for our own missing data. */
  it("does not charge an unreadable gender under `everybody`", () => {
    expect(
      messageAllowance({ role: "member", gender: null, sentSoFar: 99, hasPlan: false }, BOTH)
    ).toEqual({ gated: false });
  });
});

describe("hasActivePlan", () => {
  it("is false with no plan recorded", () => {
    expect(hasActivePlan({}, NOW)).toBe(false);
    expect(hasActivePlan({ planActiveUntil: null }, NOW)).toBe(false);
  });

  it("is true until the plan runs out, and false after", () => {
    expect(hasActivePlan({ planActiveUntil: new Date("2026-10-01") }, NOW)).toBe(true);
    expect(hasActivePlan({ planActiveUntil: new Date("2026-09-01") }, NOW)).toBe(false);
  });
});
