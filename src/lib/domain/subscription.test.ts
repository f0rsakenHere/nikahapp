import { describe, expect, it } from "vitest";
import {
  furthest,
  GRACE_DAYS,
  isKnownEvent,
  planChangeFor,
  planIsRight,
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

describe("planIsRight", () => {
  /* The one this exists for. The plan id is chosen in the browser, and
     the two plans are not the same price, so a brother who pays on the
     sisters' plan is a brother paying $9.99 for a $19.99 membership. */
  it("refuses a brother who paid on the sisters' plan", () => {
    const verdict = planIsRight("sister", "brother");
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.because).toContain("sisters' plan");
  });

  /* Refused as well, though nobody is out of pocket but her. It cannot
     happen by accident — the page only ever offers your own plan — so
     it means something went wrong, and silently banking the extra ten
     dollars is not the way to find out what. */
  it("refuses a sister who paid on the brothers' plan", () => {
    expect(planIsRight("brother", "sister").ok).toBe(false);
  });

  it("allows each member their own plan", () => {
    expect(planIsRight("sister", "sister").ok).toBe(true);
    expect(planIsRight("brother", "brother").ok).toBe(true);
  });

  /* A renewal payment names no plan at all, and an unrecognised plan id
     is a configuration gap rather than evidence of anything. Neither is
     a reason to withhold a membership somebody has paid for. */
  it("does not treat an unknown plan as a wrong one", () => {
    expect(planIsRight(null, "sister").ok).toBe(true);
  });

  /* No profile, no gender, no price — so no grant. A wali has no
     profile and buys nothing; anything else here is irregular. */
  it("refuses when there is no profile to price", () => {
    expect(planIsRight("sister", null).ok).toBe(false);
    expect(planIsRight(null, null).ok).toBe(false);
  });
});
