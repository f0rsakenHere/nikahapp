/* Sending mail — or, for now, not sending it.
 *
 * ⚠ NOTHING LEAVES THIS MACHINE. The client has not supplied an email
 * account, so the transport prints the message to the server log. That
 * is a deliberate placeholder, not an oversight: it lets the whole
 * verification, reset and wali-invitation flow be built and tested now,
 * and swapping in Postmark or Resend later is one function.
 *
 * Two rules the real transport must keep:
 *
 *   1. The caller never learns whether delivery succeeded in a way it
 *      can show a user. "We sent you a link" must be said identically
 *      whether or not the address exists (§7.1) — so this returns void
 *      and throws only on a programming error, never on a bounce.
 *
 *   2. Message bodies carry a live credential. They must never be
 *      logged in production, and the link must not appear in Sentry.
 */

export type Message =
  | { to: string; kind: "verifyEmail"; name: string; link: string }
  | { to: string; kind: "resetPassword"; name: string; link: string }
  | { to: string; kind: "passwordChanged"; name: string };

const SUBJECTS: Record<Message["kind"], string> = {
  verifyEmail: "Confirm your email address",
  resetPassword: "Reset your NikahCanada password",
  passwordChanged: "Your NikahCanada password was changed",
};

function body(message: Message): string {
  switch (message.kind) {
    case "verifyEmail":
      return [
        `Assalamu alaikum ${message.name},`,
        "",
        "Confirm your email address to finish setting up your NikahCanada account:",
        message.link,
        "",
        "The link works once and expires in 24 hours.",
      ].join("\n");

    case "resetPassword":
      return [
        `Assalamu alaikum ${message.name},`,
        "",
        "Someone asked to reset the password on this address. If it was you:",
        message.link,
        "",
        "The link works once and expires in an hour. If it was not you, you can",
        "ignore this — nothing has changed.",
      ].join("\n");

    case "passwordChanged":
      return [
        `Assalamu alaikum ${message.name},`,
        "",
        "Your password was changed just now, and you have been signed out",
        "everywhere else. If this was not you, reset your password immediately",
        "and contact us.",
      ].join("\n");
  }
}

/** Whether a link may be shown on screen instead of emailed.
 *
 *  Only with no provider configured AND outside production — both, not
 *  either. A verification link on the page is a live credential handed
 *  to whoever is looking at the screen; it is a development affordance
 *  and a production vulnerability, and the difference between the two is
 *  one environment variable. */
export function mayRevealLinks(): boolean {
  return !emailIsConfigured() && process.env.NODE_ENV !== "production";
}

/** True once a real provider is configured. Screens use it to decide
 *  whether to say "check your email" or to show the link on the page. */
export function emailIsConfigured(): boolean {
  return Boolean(process.env.EMAIL_PROVIDER_API_KEY);
}

export async function send(message: Message): Promise<void> {
  if (emailIsConfigured()) {
    /* TODO: Postmark or Resend. Deliverability matters more than price
     * here — the wali invitation is load-bearing (§4.1). */
    throw new Error("EMAIL_PROVIDER_API_KEY is set but no transport is implemented yet");
  }

  console.log(
    [
      "",
      "──────────────── EMAIL (not sent — no provider configured) ────────────────",
      `To:      ${message.to}`,
      `Subject: ${SUBJECTS[message.kind]}`,
      "",
      body(message),
      "───────────────────────────────────────────────────────────────────────────",
      "",
    ].join("\n")
  );
}
