import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LABELS,
  DAY,
  HOUR,
  activityBand,
  isNewToPool,
  shouldTouch,
} from "./activity";

const NOW = new Date("2026-08-11T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("activityBand", () => {
  it("says nothing about somebody who has never been recorded", () => {
    expect(activityBand(null, NOW)).toBe(null);
    expect(activityBand(undefined, NOW)).toBe(null);
  });

  it("bands by day, week and month", () => {
    expect(activityBand(ago(2 * HOUR), NOW)).toBe("today");
    expect(activityBand(ago(3 * DAY), NOW)).toBe("week");
    expect(activityBand(ago(20 * DAY), NOW)).toBe("month");
  });

  it("says so when somebody has been gone a long time", () => {
    /* It used to fall silent, on the grounds that "active 4 months ago"
       discourages contact. A tester read the silence as the service
       hiding it, and he is the one spending one of five asks a week:
       "some people don't really like wasting their time." */
    expect(activityBand(ago(120 * DAY), NOW)).toBe("quiet");
  });

  it("says nothing at all only when nobody has ever visited", () => {
    expect(activityBand(null, NOW)).toBe(null);
    expect(activityBand(undefined, NOW)).toBe(null);
  });

  it("puts each boundary in the wider band, not the narrower one", () => {
    expect(activityBand(ago(DAY - 1), NOW)).toBe("today");
    expect(activityBand(ago(DAY), NOW)).toBe("week");
    expect(activityBand(ago(7 * DAY - 1), NOW)).toBe("week");
    expect(activityBand(ago(7 * DAY), NOW)).toBe("month");
    expect(activityBand(ago(30 * DAY), NOW)).toBe("quiet");
  });

  it("reads a clock that runs fast as here now", () => {
    expect(activityBand(new Date(NOW.getTime() + 5 * 60_000), NOW)).toBe("today");
  });

  it("has a label for every band it can return", () => {
    for (const band of ["today", "week", "month"] as const) {
      expect(ACTIVITY_LABELS[band]).toMatch(/^Active /);
    }
    {
      /* The quiet one deliberately does not start with "Active". */
      expect(ACTIVITY_LABELS.quiet).toMatch(/last month/);
    }
  });
});

describe("isNewToPool", () => {
  it("is false for somebody who was never let in", () => {
    expect(isNewToPool(null, NOW)).toBe(false);
  });

  it("covers the last seven days and no more", () => {
    expect(isNewToPool(ago(6 * DAY), NOW)).toBe(true);
    expect(isNewToPool(ago(7 * DAY - 1), NOW)).toBe(true);
    expect(isNewToPool(ago(7 * DAY), NOW)).toBe(false);
    expect(isNewToPool(ago(60 * DAY), NOW)).toBe(false);
  });
});

describe("shouldTouch", () => {
  it("always writes the first one", () => {
    expect(shouldTouch(null, NOW)).toBe(true);
  });

  it("holds off for an hour", () => {
    expect(shouldTouch(ago(59 * 60_000), NOW)).toBe(false);
    expect(shouldTouch(ago(HOUR), NOW)).toBe(true);
  });

  it("does not write for a record from the future", () => {
    /* Otherwise two servers a minute apart would write on every render
       between them, which is the one thing the interval exists to
       prevent. */
    expect(shouldTouch(new Date(NOW.getTime() + 60_000), NOW)).toBe(false);
  });
});
