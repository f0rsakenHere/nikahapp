import { describe, expect, it } from "vitest";
import {
  furthest,
  GRACE_DAYS,
  isKnownEvent,
  planChangeFor,
  type SubscriptionEvent,
} from "./subscription";

const NOW = new Date("2026-11-09T12:00:00Z");
const DAY = 86_400_000;

const event = (type: string, nextBillingTime: Date | null = null): SubscriptionEvent => ({
  type,
  subscriptionId: "I-ABC123",
  userId: "u1",
  nextBillingTime,
});

describe("planChangeFor", () => {
  it("extends to the next billing date plus a grace period when a subscription activates", () => {
    const next = new Date("2026-12-09T12:00:00Z");
    const change = planChangeFor(event("BILLING.SUBSCRIPTION.ACTIVATED", next), NOW);
    expect(change.move).toBe("forward");
    if (change.move !== "forward") throw new Error("unreachable");
    expect(change.until.getTime()).toBe(next.getTime() + GRACE_DAYS * DAY);
  });

  it("does the same on each renewal payment", () => {
    const next = new Date("2027-01-09T12:00:00Z");
    const change = planChangeFor(event("PAYMENT.SALE.COMPLETED", next), NOW);
    expect(change.move).toBe("forward");
    if (change.move !== "forward") throw new Error("unreachable");
    expect(change.until.getTime()).toBe(next.getTime() + GRACE_DAYS * DAY);
  });

  it("still gives a month when PayPal does not say when it will bill again", () => {
    const change = planChangeFor(event("BILLING.SUBSCRIPTION.ACTIVATED", null), NOW);
    expect(change.move).toBe("forward");
    if (change.move !== "forward") throw new Error("unreachable");
    /* Enough to carry them to the next event, never zero. */
    expect(change.until.getTime()).toBeGreaterThan(NOW.getTime() + 30 * DAY);
  });

  /* The whole point of the design: nothing takes paid time away. */
  for (const type of [
    "BILLING.SUBSCRIPTION.CANCELLED",
    "BILLING.SUBSCRIPTION.SUSPENDED",
    "BILLING.SUBSCRIPTION.EXPIRED",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  ]) {
    it(`leaves the paid-through date alone on ${type}`, () => {
      expect(planChangeFor(event(type), NOW).move).toBe("none");
    });
  }

  it("cancelling says why, so the log explains itself", () => {
    const change = planChangeFor(event("BILLING.SUBSCRIPTION.CANCELLED"), NOW);
    if (change.move !== "none") throw new Error("unreachable");
    expect(change.because).toMatch(/paid period still stands/);
  });

  it("ignores anything it does not know, rather than guessing", () => {
    const change = planChangeFor(event("CHECKOUT.ORDER.APPROVED"), NOW);
    expect(change.move).toBe("none");
    if (change.move !== "none") throw new Error("unreachable");
    expect(change.because).toMatch(/unhandled/);
  });
});

describe("furthest", () => {
  const a = new Date("2026-12-01T00:00:00Z");
  const b = new Date("2027-01-01T00:00:00Z");

  it("takes the later of the two", () => {
    expect(furthest(a, b)).toEqual(b);
    expect(furthest(b, a)).toEqual(b);
  });

  it("accepts the candidate when there is nothing stored", () => {
    expect(furthest(null, a)).toEqual(a);
    expect(furthest(undefined, a)).toEqual(a);
  });

  /* A webhook delivered twice, or an activation and its first payment
     arriving together, must not shorten anybody's membership. */
  it("never moves a date backwards on a repeated event", () => {
    expect(furthest(b, a)).toEqual(b);
  });
});

describe("isKnownEvent", () => {
  it("recognises the subscription lifecycle", () => {
    expect(isKnownEvent("BILLING.SUBSCRIPTION.ACTIVATED")).toBe(true);
    expect(isKnownEvent("PAYMENT.SALE.COMPLETED")).toBe(true);
    expect(isKnownEvent("BILLING.SUBSCRIPTION.CANCELLED")).toBe(true);
  });

  it("does not recognise everything PayPal might send", () => {
    expect(isKnownEvent("CHECKOUT.ORDER.APPROVED")).toBe(false);
  });
});
