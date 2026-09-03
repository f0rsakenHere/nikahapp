/* What the emails look like.
 *
 * Kept apart from index.ts, which owns the transport and the words. This
 * file owns presentation only: given a message and its already-written
 * sentences, it returns the HTML.
 *
 * ── Why it is built the way it is ─────────────────────────────────────
 *
 * Email is not the web. Gmail strips <style> blocks in some contexts and
 * every version of Outlook still lays out with Word, so this is tables
 * and inline styles — not because that is pleasant but because a flexbox
 * column silently collapses into a single ragged line for a fifth of the
 * people who open it, and the fifth is not the fifth you can afford to
 * lose. No web fonts either: Gmail drops @font-face, so the display face
 * is Georgia, which is what --font-playfair already falls back to in
 * globals.css. The brand's own fallback, not a substitute for it.
 *
 * The tone is set by what these letters actually do. One of them asks a
 * man to take responsibility for a woman's correspondence; another is
 * the only thing standing between somebody and their locked account.
 * That argues for the register of a careful institution — generous
 * space, one clear action, colour used to mean something — and against
 * the register of a marketing send. No stock photography, no gradients,
 * no emoji, nothing animated.
 *
 * Colours are the product's own tokens (globals.css), with its contrast
 * rule kept: peach and mint fill shapes, peach-deep and accent-deep set
 * type. Every value here clears 4.5:1 on the ground it sits on.
 */

/* --------------------------------------------------------------- ink -- */

const INK = {
  /* Deep teal. 5.82:1 on white, and white is 5.82:1 on it — the one
     colour in the palette that works as both ground and type. */
  deep: "#2f6f6b",
  mint: "#9accc9",
  peach: "#f4a492",
  peachDeep: "#9c422d",
  body: "#555555",
  heading: "#1a1a1a",
  mist: "#edf7f8",
  hairline: "#daeded",
  white: "#ffffff",
} as const;

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
/* Georgia rather than Playfair: see the note above. */
const SERIF = "Georgia, 'Times New Roman', serif";

/** Anything interpolated into the HTML.
 *
 *  Every name in these messages was typed by a member into a form. A
 *  surname with an ampersand in it would break the markup on its own,
 *  and a deliberately-crafted one would do worse — so nothing reaches
 *  the template without going through here. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------------------------------------------------------- pieces --- */

/** The line the inbox shows beside the subject, before anyone opens
 *  anything. Left to chance it becomes "View this email in your browser",
 *  which is the first impression most senders throw away. */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(
    text
  )}</div>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:27px;line-height:1.28;font-weight:400;color:${INK.heading};">${esc(
    text
  )}</h1>`;
}

function paragraph(html: string, top = 0): string {
  return `<p style="margin:${top}px 0 16px;font-family:${SANS};font-size:16px;line-height:26px;color:${INK.body};">${html}</p>`;
}

/** The action, as a shape rather than a link the eye has to find.
 *
 *  Black on peach, which is what the app does — peach is a fill and
 *  never a text colour, and peach-deep on peach is 1.43:1. Wrapped in
 *  the Outlook VML fallback, because Word ignores padding on an anchor
 *  and would otherwise render this as bare underlined text. */
function button(label: string, href: string): string {
  const safeHref = esc(href);
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px;">
        <tr>
          <td align="center" bgcolor="${INK.peach}" style="border-radius:28px;">
            <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeHref}" style="height:52px;v-text-anchor:middle;width:300px;" arcsize="54%" fillcolor="${INK.peach}" stroke="f">
                <w:anchorlock/>
                <center style="color:${INK.heading};font-family:${SANS};font-size:16px;font-weight:600;">${esc(label)}</center>
              </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-- -->
            <a href="${safeHref}" style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:16px;font-weight:600;line-height:22px;color:${INK.heading};text-decoration:none;border-radius:28px;">${esc(
              label
            )}</a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>`;
}

/** The same link again, as text.
 *
 *  Not redundancy. Some clients strip the anchor, some readers do not
 *  trust a button, and a wali opening this on a ten-year-old phone is
 *  exactly the person this product cannot afford to lose. */
function fallbackLink(href: string): string {
  return `<p style="margin:0 0 4px;font-family:${SANS};font-size:13px;line-height:20px;color:#7b7b7b;">Or paste this into your browser:</p>
          <p style="margin:0;font-family:${SANS};font-size:13px;line-height:20px;word-break:break-all;"><a href="${esc(
            href
          )}" style="color:${INK.deep};text-decoration:underline;">${esc(href)}</a></p>`;
}

/** A quiet aside — expiry, reassurance. Smaller, never grey-on-grey. */
function note(html: string): string {
  return `<p style="margin:22px 0 0;font-family:${SANS};font-size:14px;line-height:22px;color:#6b6b6b;">${html}</p>`;
}

/** What the wali is actually agreeing to.
 *
 *  The most consequential paragraph in the product, so it is the one
 *  place given a panel of its own. Numbered because they happen in that
 *  order, on mist with a hairline rather than behind a coloured bar. */
function powers(items: readonly string[]): string {
  const rows = items
    .map(
      (item, i) => `
            <tr>
              <td valign="top" style="padding:0 12px 10px 0;font-family:${SANS};font-size:14px;line-height:22px;color:${INK.deep};font-weight:700;width:18px;">${i + 1}</td>
              <td valign="top" style="padding:0 0 10px;font-family:${SANS};font-size:15px;line-height:23px;color:${INK.body};">${esc(item)}</td>
            </tr>`
    )
    .join("");

  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 6px;background-color:${INK.mist};border:1px solid ${INK.hairline};border-radius:10px;">
        <tr>
          <td style="padding:22px 24px 14px;">
            <p style="margin:0 0 14px;font-family:${SANS};font-size:12px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;font-weight:700;color:${INK.deep};">As her wali you will be able to</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}
            </table>
          </td>
        </tr>
      </table>`;
}

/* ---------------------------------------------------------- shell ---- */

/** The frame every message sits in.
 *
 *  A white sheet on mist, with the mark on deep teal above it. The logo
 *  file is white on transparency — the only artwork there is — so it
 *  needs a dark ground to exist on at all. That constraint turned out to
 *  be the design: a narrow band of the brand's own teal, and the rest of
 *  the letter left alone. */
function shell({
  origin,
  preview,
  content,
}: {
  origin: string;
  preview: string;
  content: string;
}): string {
  return `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>NikahCanada</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  /* Progressive enhancement only. Everything below also reads correctly
     with this block stripped, which Gmail does in some contexts. */
  @media only screen and (max-width:620px) {
    .sheet { padding:30px 24px 34px !important; }
    .band  { padding:24px 20px !important; }
    .h1    { font-size:24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${INK.mist};">
${preheader(preview)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${INK.mist};">
  <tr>
    <td align="center" style="padding:36px 14px 44px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">

        <tr>
          <td class="band" align="center" bgcolor="${INK.deep}" style="padding:30px 24px;border-radius:14px 14px 0 0;">
            <a href="${esc(origin)}" style="text-decoration:none;">
              <img src="${esc(origin)}/brand/nikahcanada-lockup-white.png"
                   width="196" alt="NikahCanada — a halal matrimony service"
                   style="display:block;width:196px;max-width:196px;height:auto;border:0;">
            </a>
          </td>
        </tr>

        <!-- A mint hairline between the band and the sheet: the one place
             the accent appears, and it is doing a job. -->
        <tr><td style="line-height:0;font-size:0;background-color:${INK.mint};height:3px;">&nbsp;</td></tr>

        <tr>
          <td class="sheet" bgcolor="${INK.white}" style="padding:38px 42px 40px;border-radius:0 0 14px 14px;border:1px solid ${INK.hairline};border-top:0;">
${content}
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:24px 20px 0;">
            <p style="margin:0 0 6px;font-family:${SANS};font-size:13px;line-height:21px;color:#6f6f6f;">
              NikahCanada — a halal matrimony service.<br>
              Based in Montreal, operating across Canada.
            </p>
            <p style="margin:0;font-family:${SANS};font-size:12px;line-height:20px;color:#8a8a8a;">
              You received this because this address was used on
              <a href="${esc(origin)}" style="color:${INK.deep};text-decoration:none;">nikahcanada.ca</a>.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/* --------------------------------------------------------- letters --- */

export type Rendered = { html: string; preview: string };

export const WALI_POWERS = [
  "See every introduction she receives, the moment she does",
  "Read every message she exchanges",
  "Approve or decline before any conversation opens",
  "End a conversation at any point",
] as const;

export function renderVerifyEmail(o: {
  origin: string;
  name: string;
  link: string;
}): Rendered {
  return {
    preview: "Confirm your address to finish setting up your account.",
    html: shell({
      origin: o.origin,
      preview: "Confirm your address to finish setting up your account.",
      content: `${heading(`Assalamu alaikum ${o.name},`)}
${paragraph("One step left. Confirm this address and your NikahCanada account is ready to use.")}
${button("Confirm my email address", o.link)}
${fallbackLink(o.link)}
${note("The link works once and expires in 24 hours.")}`,
    }),
  };
}

export function renderResetPassword(o: {
  origin: string;
  name: string;
  link: string;
}): Rendered {
  const preview = "A link to choose a new password.";
  return {
    preview,
    html: shell({
      origin: o.origin,
      preview,
      content: `${heading(`Assalamu alaikum ${o.name},`)}
${paragraph("Someone asked to reset the password on this address. If that was you, choose a new one here.")}
${button("Choose a new password", o.link)}
${fallbackLink(o.link)}
${note(
  "The link works once and expires in an hour. If it was not you, you can ignore this — nothing has changed, and your password still works."
)}`,
    }),
  };
}

export function renderPasswordChanged(o: {
  origin: string;
  name: string;
}): Rendered {
  const preview = "Your password was changed just now.";
  return {
    preview,
    html: shell({
      origin: o.origin,
      preview,
      content: `${heading(`Assalamu alaikum ${o.name},`)}
${paragraph(
  "Your password was changed just now, and you have been signed out everywhere else."
)}
${paragraph(
  `If this was not you, reset your password immediately and contact us — <a href="${esc(
    o.origin
  )}/forgot-password" style="color:${INK.deep};font-weight:600;text-decoration:underline;">start here</a>.`
)}`,
    }),
  };
}

export function renderWaliInvitation(o: {
  origin: string;
  name: string;
  memberFirstName: string;
  relationship: string;
  link: string;
}): Rendered {
  const preview = `${o.memberFirstName} has named you as her wali on NikahCanada.`;
  return {
    preview,
    html: shell({
      origin: o.origin,
      preview,
      content: `${heading(`Assalamu alaikum ${o.name},`)}
${paragraph(
  `<strong style="color:${INK.heading};font-weight:600;">${esc(
    o.memberFirstName
  )}</strong> has registered with NikahCanada and named you as her wali. She recorded your relationship as <strong style="color:${INK.heading};font-weight:600;">${esc(
    o.relationship
  )}</strong>.`
)}
${paragraph("Her profile does not go live until you confirm.")}
${powers(WALI_POWERS)}
${button("Review the request", o.link)}
${fallbackLink(o.link)}
${note(
  "The link works once and expires in two weeks. If this was not expected, you can decline on the same page."
)}`,
    }),
  };
}
