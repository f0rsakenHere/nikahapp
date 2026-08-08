import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

/* The edge guard for everything behind a sign-in.
 *
 * ── What this is NOT ──────────────────────────────────────────────────
 * This is not authorisation, and it does not prove a session is valid.
 * Middleware runs on the edge runtime, which has no database, so all it
 * can see is whether a cookie is *present* — not whether it names a live
 * session, an unsuspended account, or the right person.
 *
 * The real check is `currentUser()`, which reads the session and the
 * user on every request. Pages and server actions must still call it.
 * This exists to stop a signed-out visitor loading a member screen at
 * all, and to make forgetting the page-level check fail closed.
 * ──────────────────────────────────────────────────────────────────────
 *
 * Default deny. A new route under `(app)` or `(admin)` is protected the
 * moment it exists, without anyone remembering to add it here — which is
 * the opposite of the usual list-the-protected-paths arrangement, where
 * the route someone forgets is the one that leaks.
 */

/** Everything a signed-out visitor may reach. Exact matches, or prefixes
 *  where a trailing path is part of the same public document. */
const PUBLIC_EXACT = new Set([
  "/",
  "/how-it-works",
  "/register",
  "/login",
  /* All three are reached by someone who cannot sign in — that is the
   * entire point of them — and the last two arrive from a link in an
   * email, opened in whichever browser the mail client hands it to. */
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  /* The invitation link. He has no account until he accepts it, so
   * requiring a session here would make it impossible to use. */
  "/wali/invite",
  /* The second-factor challenge. There *is* a cookie by this point, so
   * the guard would pass anyway — but listing it makes the intent
   * explicit rather than incidental. `currentUser()` is what actually
   * keeps a half-authenticated session out of everything else. */
  "/mfa",
]);
const PUBLIC_PREFIXES = ["/legal/"];

function isPublic(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (PUBLIC_EXACT.has(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL("/login", request.url);
  /* Carry where they were going, so signing in resumes it rather than
   * dropping them on a dashboard and making them navigate again. The
   * value is a path from this request, never a caller-supplied URL — an
   * open redirect on a sign-in page is how phishing gets its polish. */
  if (pathname !== "/") login.searchParams.set("next", pathname + search);

  return NextResponse.redirect(login);
}

export const config = {
  /* Everything except Next's own assets, the image optimiser, and files
   * with an extension (favicon, robots.txt, the banner artwork). */
  matcher: ["/((?!_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
