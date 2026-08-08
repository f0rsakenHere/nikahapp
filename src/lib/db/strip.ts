/* Removing `undefined` before anything is written.
 *
 * The driver's default is to store `undefined` as `null`. Every optional
 * field in every Zod schema then rejects that document on the way back
 * out — so a write succeeds, and the failure surfaces on a later read,
 * in a different screen, as a validation error about a field nobody
 * touched. It has now cost two debugging sessions.
 *
 * `ignoreUndefined: true` is set on the client and does the same job,
 * but it is a connection option: it depends on the client having been
 * built with it, and the client is cached on `globalThis` across
 * hot reloads, so a stale one silently reinstates the old behaviour.
 * This does not depend on any of that.
 *
 * Every repository runs its writes through here.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((v) => v !== undefined).map(stripUndefined) as unknown as T;
  }

  /* Dates, ObjectIds and anything else with its own prototype are values,
   * not shapes to walk into. */
  if (
    value === null ||
    typeof value !== "object" ||
    value instanceof Date ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return value;
  }

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[key] = stripUndefined(v);
  }
  return out as T;
}
