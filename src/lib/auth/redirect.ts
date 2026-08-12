/* Where a sign-in is allowed to send someone afterwards.
 *
 * Its own module rather than living in actions.ts, because that file is
 * `"use server"` and every export from one of those must be an async
 * function — a synchronous helper exported alongside the actions fails
 * the build. Keeping it here also means it can be unit-tested without
 * dragging in cookies and the database.
 */

/** Only a path on this site is ever accepted.
 *
 *  `//evil.example` is a protocol-relative URL that browsers resolve to
 *  another origin, and a sign-in page that forwards wherever it is told
 *  is the standard ingredient in a convincing phishing flow: the domain
 *  in the address bar is genuinely yours right up until the redirect. */
export function safeNext(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
