import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { logout } from "@/lib/auth/actions";
import { CLOSED_STATES } from "@/lib/domain/conversation";
import { listWardsForWali } from "@/lib/repositories/guardianships";
import { listConversationsFor } from "@/lib/repositories/conversations";
import { findUserById } from "@/lib/repositories/users";
import { AuthShell } from "../auth-shell";
import { ApproveForm } from "./approve";

export const metadata: Metadata = { title: "Your wards — NikahCanada" };

const day = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(d) : "";

/* The wali's home.
 *
 * Ordered by what needs him: anything waiting on his approval comes
 * first, because that is the one thing in this product where a person is
 * blocked until he acts, and burying it under a summary is how a woman
 * waits a fortnight for a click.
 */
export default async function WaliPortalPage() {
  const session = await currentUser();
  if (!session) redirect("/login?next=/wali");

  const { user } = session;
  const wards = await listWardsForWali(user.id);
  if (wards.length === 0 && !user.roles.includes("wali")) redirect("/onboarding");

  const conversations = await listConversationsFor(user.id);
  const waiting = conversations.filter((c) => c.state === "awaitingWali");
  const open = conversations.filter((c) => c.state === "open");
  const past = conversations.filter((c) => CLOSED_STATES.has(c.state));

  const names = await Promise.all(
    wards.map(async (w) => ({
      id: w.id,
      first: (await findUserById(w.memberUserId))?.legalName.first ?? "Your ward",
      confirmedAt: w.confirmedAt,
      verification: w.verification.state,
    }))
  );

  return (
    <AuthShell
      title={`Assalamu alaikum, ${user.legalName.first}`}
      blurb={
        waiting.length
          ? `${waiting.length} conversation${waiting.length === 1 ? "" : "s"} waiting on you.`
          : wards.length
            ? "Nothing needs you at the moment."
            : "You are not currently acting as a wali for anyone."
      }
      footer={
        <Link href="/settings" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
          Your account
        </Link>
      }
    >
      {waiting.length ? (
        <section className="mb-7">
          <h2 className="text-[18px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Waiting on you
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {waiting.map((c) => (
              <li key={c.id} className="rounded-md border border-peach/40 bg-soft-peach/60 p-4">
                <p className="text-[18px] leading-[26px] text-black">
                  Somebody has asked to talk, and she has accepted. Nothing has been said yet, and
                  nothing can be until you approve it.
                </p>
                <ApproveForm conversationId={c.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {open.length ? (
        <section className="mb-7">
          <h2 className="text-[18px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Open conversations
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {open.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/conversations/${c.id}`}
                  className="flex items-center justify-between rounded-md border border-soft-green px-3.5 py-3 transition-colors hover:border-accent-deep"
                >
                  <span className="text-[18px] font-semibold text-black">
                    {c.messageCount} message{c.messageCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-[18px] text-text/70">
                    {c.lastMessageAt ? `last ${day(c.lastMessageAt)}` : "nothing said yet"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-[18px] font-semibold uppercase tracking-[0.6px] text-text/70">
          Who you act for
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {names.map((w) => (
            <li key={w.id} className="flex flex-col gap-1 rounded-md border border-soft-green px-3.5 py-3">
              <span className="text-[18px] font-semibold text-black">{w.first}</span>
              <span className="text-[18px] text-text/70">
                Confirmed {day(w.confirmedAt)}
                {w.verification === "verified" ? " · identity verified" : " · awaiting our checks"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {past.length ? (
        <p className="mt-6 text-[18px] text-text/70">
          {past.length} closed conversation{past.length === 1 ? "" : "s"}. Nothing said in them has
          been removed.
        </p>
      ) : null}

      {!waiting.length && !open.length ? (
        <div className="mt-7 rounded-md border border-soft-green bg-mist px-4 py-4 text-[18px] leading-[26px] text-text">
          When she receives an introduction you will see it here at the same moment she does, and
          no conversation opens until you approve it.
        </div>
      ) : null}

      <form action={logout} className="mt-7">
        <button
          type="submit"
          className="h-12 w-full rounded-pill border-2 border-accent-deep text-[18px] font-semibold text-accent-deep"
        >
          Sign out
        </button>
      </form>
    </AuthShell>
  );
}
