import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { hasConfirmedWali } from "@/lib/repositories/guardianships";
import { listRequests, readSettings } from "@/lib/repositories/connections";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { ObjectId } from "mongodb";
import { AppFrame } from "../frame";
import { AnswerForm } from "./answer";

export const metadata: Metadata = { title: "Requests — NikahCanada" };

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(d);

/** Initials for a list of user ids, in one query. */
async function initialsFor(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const docs = await (await getDb())
    .collection(COLLECTIONS.profiles)
    .find({ userId: { $in: userIds.map((u) => new ObjectId(u)) } }, { projection: { userId: 1, initials: 1 } })
    .toArray();
  return new Map(docs.map((d) => [String(d.userId), (d.initials as string) ?? "—"]));
}

export default async function RequestsPage() {
  const session = await currentUser();
  if (!session) redirect("/login?next=/requests");

  const me = await findProfileByUserId(session.user.id);
  if (!me) redirect(session.user.roles.includes("wali") ? "/wali" : "/register");

  const settings = await readSettings();
  const [inbound, outbound] = await Promise.all([
    listRequests(session.user.id, "in"),
    listRequests(session.user.id, "out"),
  ]);

  const waiting = inbound.filter((r) => r.state === "pending");
  const sent = outbound.filter((r) => r.state === "pending");
  const names = await initialsFor([
    ...waiting.map((r) => r.fromUserId),
    ...sent.map((r) => r.toUserId),
  ]);

  const needsWali =
    me.gender === "sister" &&
    settings.waliGate === "approves" &&
    !(await hasConfirmedWali(session.user.id));

  return (
    <AppFrame active="requests" title="Requests">
      {needsWali && waiting.length > 0 ? (
        <p className="mb-4 rounded-md border border-peach/40 bg-soft-peach/60 px-3.5 py-3 text-[13px] leading-[19px] text-text">
          You can read these, but a conversation cannot open until your wali has confirmed.
        </p>
      ) : null}

      <section>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
          Waiting on you
        </h2>

        {waiting.length === 0 ? (
          <p className="mt-3 rounded-md border border-soft-green bg-mist px-4 py-5 text-center text-[13px] text-text">
            Nobody is waiting on an answer.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {waiting.map((r) => (
              <li key={r.id} className="rounded-md border border-soft-green p-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-semibold text-black">
                    {names.get(r.fromUserId) ?? "—"}
                  </span>
                  <span className="text-[11px] text-text/70">
                    asked {day(r.sentAt)} · expires {day(r.expiresAt)}
                  </span>
                </div>
                <AnswerForm requestId={r.id} side="in" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
          You asked
        </h2>

        {sent.length === 0 ? (
          <p className="mt-3 rounded-md border border-soft-green bg-mist px-4 py-5 text-center text-[13px] text-text">
            You have not asked anybody yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {sent.map((r) => (
              <li key={r.id} className="rounded-md border border-soft-green p-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-semibold text-black">
                    {names.get(r.toUserId) ?? "—"}
                  </span>
                  <span className="text-[11px] text-text/70">
                    sent {day(r.sentAt)} · expires {day(r.expiresAt)}
                  </span>
                </div>
                {/* No read receipt, on purpose. "Seen and not answered"
                    is the most corrosive signal a product like this can
                    show, and it invites exactly the behaviour the
                    inbound cap exists to prevent. */}
                <AnswerForm requestId={r.id} side="out" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppFrame>
  );
}
