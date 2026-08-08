/* The session cookie's name, and nothing else.
 *
 * Its own module because `middleware.ts` needs it and middleware runs on
 * the edge runtime, which has no `node:crypto`. Importing it from
 * `session.ts` pulls the whole hashing module into the edge bundle and
 * every route 500s — including the marketing pages, which is a good
 * reminder that middleware failures are site-wide rather than local.
 */
export const SESSION_COOKIE = "nc_session";
