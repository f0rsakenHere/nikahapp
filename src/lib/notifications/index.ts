/* Sending mail.
 *
 * Resend when `EMAIL_PROVIDER_API_KEY` is set; otherwise the message is
 * printed to the server log so the whole verification, reset and
 * wali-invitation flow can be walked locally without an account. The
 * checkers depend on that second path — they read the link off the page
 * via `mayRevealLinks()` — so it is a supported mode, not a leftover.
 *
 * Plain `fetch` rather than the SDK. It is one POST to one endpoint, and
 * a dependency that ships an HTTP client, a retry policy and a React
 * renderer to do it is a poor trade in a codebase that has neither an
 * ODM nor a component library.
 *
 * Two rules the transport keeps:
 *
 *   1. The caller never learns whether delivery succeeded in a way it
 *      can show a user. "We sent you a link" must be said identically
 *      whether or not the address exists (§7.1) — so this returns void
 *      and throws only on a programming error, never on a bounce.
 *
 *   2. Message bodies carry a live credential. They must never be
 *      logged in production, and the link must not appear in Sentry.
 */

import {
  renderPasswordChanged,
  renderResetPassword,
  renderVerifyEmail,
  renderWaliInvitation,
  type Rendered,
} from "./template";

export type Message =
  | { to: string; kind: "verifyEmail"; name: string; link: string }
  | { to: string; kind: "resetPassword"; name: string; link: string }
  | { to: string; kind: "passwordChanged"; name: string }
  | {
      to: string;
      kind: "waliInvitation";
      /** His name, as she typed it. */
      name: string;
      /** Hers — first name only. If she mistypes his address, a stranger
       *  learns that someone with this first name is seeking marriage,
       *  which is recoverable. Her full name would not be. */
      memberFirstName: string;
      relationship: string;
      link: string;
    };

const SUBJECTS: Record<Message["kind"], string> = {
  verifyEmail: "Confirm your email address",
  resetPassword: "Reset your NikahCanada password",
  passwordChanged: "Your NikahCanada password was changed",
  waliInvitation: "You have been asked to act as a wali",
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

    case "waliInvitation":
      return [
        `Assalamu alaikum ${message.name},`,
        "",
        `${message.memberFirstName} has registered with NikahCanada and named you as her`,
        `wali. She recorded your relationship as: ${message.relationship}.`,
        "",
        "Her profile does not go live until you confirm. As her wali you will be",
        "able to see every introduction she receives, read every message she",
        "exchanges, approve or decline before any conversation opens, and end one",
        "at any point.",
        "",
        message.link,
        "",
        "The link works once and expires in two weeks. If this was not expected,",
        "you can decline on the same page.",
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

/** The same message, dressed.
 *
 *  Sent alongside `body()` rather than instead of it: a multipart message
 *  lets the client choose, and the text part is what a screen reader, a
 *  plain-text client and a spam filter all read. An HTML-only send is
 *  both less accessible and more likely to be scored as junk.
 *
 *  The origin is where the logo is fetched from and where the footer
 *  links, so it must be the address a recipient can actually reach. That
 *  is the same value the links themselves are built from. */
function html(message: Message): Rendered {
  const origin = (process.env.APP_ORIGIN ?? "https://nikahcanada.ca").replace(/\/$/, "");

  switch (message.kind) {
    case "verifyEmail":
      return renderVerifyEmail({ origin, name: message.name, link: message.link });
    case "resetPassword":
      return renderResetPassword({ origin, name: message.name, link: message.link });
    case "passwordChanged":
      return renderPasswordChanged({ origin, name: message.name });
    case "waliInvitation":
      return renderWaliInvitation({
        origin,
        name: message.name,
        memberFirstName: message.memberFirstName,
        relationship: message.relationship,
        link: message.link,
      });
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

/* Who it comes from. A verified Resend domain is required — an
 * unverified one is refused with a 403, which is the expected state
 * until the DNS records are in. */
function from(): string {
  return process.env.EMAIL_FROM ?? "NikahCanada <noreply@nikahcanada.ca>";
}

/** Hands one message to Resend.
 *
 *  Never throws. §7.1 requires "we sent you a link" to read identically
 *  whether or not the address exists, so a caller that could distinguish
 *  a delivered message from a rejected one would be a way to enumerate
 *  members. Failures are logged for us and invisible to them.
 *
 *  What is logged is the kind, the status and Resend's own message —
 *  never the body, because every body carries a live credential. */
async function viaResend(message: Message): Promise<void> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EMAIL_PROVIDER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from(),
        to: [message.to],
        subject: SUBJECTS[message.kind],
        text: body(message),
        html: html(message).html,
      }),
      /* A provider that hangs must not hang a server action with a
         member waiting on it. */
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        `[email] ${message.kind} rejected by Resend: ${response.status} ${detail.slice(0, 300)}`
      );
    }
  } catch (err) {
    console.error(
      `[email] ${message.kind} could not be sent: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function send(message: Message): Promise<void> {
  if (emailIsConfigured()) {
    await viaResend(message);
    return;
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
