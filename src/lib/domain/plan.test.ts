import { describe, expect, it } from "vitest";
import { hasActivePlan, messageAllowance, type PlanSettings } from "./plan";

const NOW = new Date("2026-09-15T12:00:00Z");
const ON: PlanSettings = { planGate: "brother", freeMessagesPerConversation: 3 };
const OFF: PlanSettings = { planGate: "nobody", freeMessagesPerConversation: 3 };

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
