/* Where a signed-out visitor is actually sent.
 *
 * `next start -H 127.0.0.1` binds to loopback, and Next answers with the
 * origin it was bound to rather than the one in the request. Every
 * redirect out of middleware went to `https://localhost:3000/login` —
 * the visitor's own device. On a laptop that is a dead link; on Chrome
 * for Android it is a permission prompt asking the visitor to let a
 * matrimonial site reach the other apps on their phone.
 *
 * Nothing in the browser checkers caught it, because a browser follows
 * the redirect from the same machine the server runs on and lands
 * happily on localhost. Only the Location header tells the truth.
 *
 *   BASE=https://nikahcanada.ca node scripts/redirect-check.cjs
 */
const { BASE } = require("./lib/base.cjs");

/* Signed-out, these all belong behind the sign-in wall. */
const PROTECTED = ["/dashboard", "/browse", "/onboarding", "/conversations", "/settings"];

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

(async () => {
  const site = new URL(BASE);

  for (const path of PROTECTED) {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const location = res.headers.get("location");

    if (!location) {
      check(`${path} redirects a signed-out visitor`, false, `status ${res.status}`);
      continue;
    }

    const to = new URL(location, BASE);
    check(
      `${path} sends them to this site, not to their own device`,
      to.host === site.host,
      `${to.protocol}//${to.host}`
    );
    check(`${path} keeps the scheme`, to.protocol === site.protocol, to.protocol);
    check(`${path} lands on the sign-in page`, to.pathname === "/login", to.pathname);
    check(
      `${path} carries where they were going`,
      to.searchParams.get("next") === path,
      String(to.searchParams.get("next"))
    );
  }

  console.log(bad ? `\n${bad} redirect check(s) FAILED\n` : `\nevery redirect stays on this site\n`);
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
