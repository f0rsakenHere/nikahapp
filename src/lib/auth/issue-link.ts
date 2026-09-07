/* Issuing a one-time link, and the address it is built from.
 *
 * Not a "use server" module, deliberately. This used to live inside
 * account-actions.ts, where every export becomes a callable endpoint —
 * so a helper that mints a credential and emails it could not be shared
 * with the registration flow without also publishing it as an HTTP
 * route anybody could POST to. Here it is an ordinary function that
 * server actions import.
 */
import { headers } from "next/headers";
import { mayRevealLinks, send } from "@/lib/notifications";
import { insertToken, tokenQuotaExceeded } from "@/lib/repositories/tokens";
import { buildToken, type TokenPurpose } from "./tokens";

/** Where the app is reachable, for building links into it.
 *
 *  `APP_ORIGIN` wins because a link is built once and clicked later,
 *  possibly from another device: it has to be the public address, not
 *  whatever `Host` the request happened to carry. The header is the
 *  fallback for development, where nothing is configured. */
export async function origin(): Promise<string> {
  const configured = process.env.APP_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Mints a single-use token, emails the link, and returns it only where
 *  showing it on screen is safe.
 *
 *  Returns `undefined` when the quota is exceeded rather than throwing
 *  or reporting it. Someone hammering "send it again" learns nothing
 *  either way, and the caller says "check your email" regardless — the
 *  same sentence whether or not the address exists (§7.1). */
export async function issueLink(
  purpose: TokenPurpose,
  user: { id: string; email: string; legalName: { first: string } },
  path: string,
  now: Date
): Promise<string | undefined> {
  if (await tokenQuotaExceeded(user.id, purpose, now)) return undefined;

  const { token, record } = buildToken({ purpose, userId: user.id, email: user.email }, now);
  await insertToken(record);

  const link = `${await origin()}${path}?token=${token}`;
  await send({
    to: user.email,
    kind: purpose === "verifyEmail" ? "verifyEmail" : "resetPassword",
    name: user.legalName.first,
    link,
  });

  return mayRevealLinks() ? link : undefined;
}
