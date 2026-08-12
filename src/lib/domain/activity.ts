/* Who is around, and who has just arrived.
 *
 * A closed pool of a few dozen people has a problem an open one does
 * not: every screen looks the same on Tuesday as it did on Monday, and a
 * member cannot tell whether they are looking at a live service or an
 * archive. Nothing here adds people — it says something true about the
 * ones already there.
 *
 * ── Coarse on purpose ─────────────────────────────────────────────────
 * "Active today", not "active 14 minutes ago". A precise last-seen time
 * is a surveillance signal: it tells you when somebody sleeps, when they
 * are at work, and — read across two profiles — whether they are talking
 * to each other. Bands wide enough to be useless for that are still
 * enough to answer the only question anybody is really asking, which is
 * "if I write to this person, will they see it?".
 *
 * Nothing here is shown about somebody who is not in the pool, and the
 * bands are always the reader's inference about presence, never a claim
 * about what the other person was doing.
 * ──────────────────────────────────────────────────────────────────────
 *
 * Pure. No I/O and no clock — `now` is always passed in.
 */

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** How recently somebody was here, in bands. `null` means "long enough
 *  ago that saying so would be discouraging rather than informative". */
export type ActivityBand = "today" | "week" | "month" | null;

export const ACTIVITY_LABELS: Record<Exclude<ActivityBand, null>, string> = {
  today: "Active today",
  week: "Active this week",
  month: "Active this month",
};

export function activityBand(lastActiveAt: Date | null | undefined, now: Date): ActivityBand {
  if (!lastActiveAt) return null;
  const since = now.getTime() - lastActiveAt.getTime();
  /* A timestamp in the future is a clock disagreeing with ours, not a
     visit that has not happened yet. Reading it as "here now" is the
     harmless interpretation; the alternative is a member who looks
     absent because their phone is two minutes fast. */
  if (since < DAY) return "today";
  if (since < 7 * DAY) return "week";
  if (since < 30 * DAY) return "month";
  return null;
}

/** New enough to the pool to be worth pointing out.
 *
 *  Seven days rather than "since you last visited": a member who checks
 *  twice a day would otherwise see nothing marked new, and one who
 *  returns after a month would see everybody marked new. The window is
 *  the same for everybody, which also means it can be counted once for
 *  the whole pool rather than per reader. */
export const NEW_DAYS = 7;

export function isNewToPool(liveAt: Date | null | undefined, now: Date): boolean {
  if (!liveAt) return false;
  const since = now.getTime() - liveAt.getTime();
  return since >= 0 ? since < NEW_DAYS * DAY : true;
}

/** How often presence is written down.
 *
 *  Once an hour per member. The band is a day wide at its narrowest, so
 *  a finer record would buy nothing a reader can see, and this is a
 *  write on a page render — the interval is the difference between one
 *  update an hour and one per navigation. */
export const TOUCH_EVERY = HOUR;

/** Is this record stale enough to be worth rewriting? */
export function shouldTouch(lastActiveAt: Date | null | undefined, now: Date): boolean {
  if (!lastActiveAt) return true;
  return now.getTime() - lastActiveAt.getTime() >= TOUCH_EVERY;
}
