import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { hasConfirmedWali } from "@/lib/repositories/guardianships";
import { listRequests, readSettings } from "@/lib/repositories/connections";
import { listConversationsFor } from "@/lib/repositories/conversations";
import { CLOSED_STATES } from "@/lib/domain/conversation";
import Link from "next/link";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { ObjectId } from "mongodb";
import type { ReactNode } from "react";
import {
  ChatIcon,
  ChevronRight,
  ClockIcon,
  RequestsIcon,
  SentIcon,
  WaliIcon,
} from "@/components/app/icons";
import { AppFrame } from "../frame";
import { AnswerForm } from "./answer";

export const metadata: Metadata = { title: "Requests — NikahCanada" };

/* One heading shape for the three lists, so the page reads as three of
   the same thing rather than three different screens stacked. */
function Section({
  Icon,
  title,
  count,
  blurb,
  children,
}: {
  Icon: (p: { className?: string }) => ReactNode;
  title: string;
  count: number;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-1 flex items-center gap-2.5">
        <Icon className="text-[21px] text-accent-deep" />
        <h2 className="font-manrope text-[22px] font-bold leading-tight text-black">{title}</h2>
        {count > 0 ? (
          <span className="rounded-pill bg-peach px-2.5 py-0.5 text-[18px] font-semibold text-black">
            {count}
          </span>
        ) : null}
      </div>
      <p className="mb-4 text-[18px] leading-[26px] text-text/70">{blurb}</p>
      {children}
    </section>
  );
}

/* Nothing here yet, said with the same weight as something. A flat bar
   with a sentence in it reads as a failed load. */
function Empty({ Icon, line }: { Icon: (p: { className?: string }) => ReactNode; line: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-soft-green bg-mist/40 px-4 py-9 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-[22px] text-accent-deep">
        <Icon />
      </span>
      <p className="text-[18px] leading-[26px] text-text">{line}</p>
    </div>
  );
}

/* Initials, what is being waited on, and when — the same three things in
   the same order on every card. */
function PersonRow({ person, lead, meta }: { person?: Person; lead: string; meta: string }) {
  return (
    /* `min-w-[240px]`: with `flex-1` alone this shrank to ninety pixels
       on a phone so that the buttons could stay on the same line — every
       word wrapped to its own line and the two ran into each other. A
       floor on the person means the controls wrap under them instead,
       which is what the row was meant to do at that width. */
    <div className="flex min-w-[240px] flex-1 items-center gap-3.5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-soft-peach font-manrope text-[18px] font-bold text-peach-deep">
        {person?.initials ?? "—"}
      </span>
      <div className="flex min-w-0 flex-col">
        {/* Not the initials again — they are in the tile beside this, and
            printing them twice tells you nothing the second time. */}
        <span className="font-manrope text-[20px] font-bold leading-tight text-black">
          {person?.label ?? "A member"}
        </span>
        <span className="text-[18px] text-text">{lead}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[18px] text-text/70">
          <ClockIcon className="shrink-0 text-[17px]" />
          {meta}
        </span>
      </div>
    </div>
  );
}

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(d);

type Person = { initials: string; label: string };

/** Who each request is with, in one query.
 *
 *  The same two facts browse shows — initials, and "Sister, 30" — so a
 *  request card and a browse card describe the same person the same way.
 *  Never the name: that is released at step 06, after this. */
async function peopleFor(userIds: string[]): Promise<Map<string, Person>> {
  if (userIds.length === 0) return new Map();
  const year = new Date().getUTCFullYear();
  const docs = await (await getDb())
    .collection(COLLECTIONS.profiles)
    .find(
      { userId: { $in: userIds.map((u) => new ObjectId(u)) } },
      { projection: { userId: 1, initials: 1, gender: 1, "basics.birthYear": 1 } }
    )
    .toArray();
  return new Map(
    docs.map((d) => {
      const age = d.basics?.birthYear ? year - Number(d.basics.birthYear) : null;
      return [
        String(d.userId),
        {
          initials: (d.initials as string) ?? "—",
          label: `${d.gender === "sister" ? "Sister" : "Brother"}${age ? `, ${age}` : ""}`,
        },
      ];
    })
  );
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
  const names = await peopleFor([
    ...waiting.map((r) => r.fromUserId),
    ...sent.map((r) => r.toUserId),
  ]);

  /* Anything accepted has a thread behind it — the point of the whole
     flow, and until it is linked from here it is unreachable. */
  const conversations = await listConversationsFor(session.user.id);
  const live = conversations.filter((c) => !CLOSED_STATES.has(c.state));

  const needsWali =
    me.gender === "sister" &&
    settings.waliGate === "approves" &&
    !(await hasConfirmedWali(session.user.id));

  /* Everything on this screen is a person and a decision, so everything
     wears the same card: who, when, what is being waited on, and the
     controls. The page used to be two headings over a flat bar and a
     sentence pretending to be a button. */
  const inboundCount = waiting.length;

  return (
    <AppFrame
      active="requests"
      width="wide"
      title="Requests"
      aside={
        <span className="flex items-center gap-2 rounded-pill border border-soft-green bg-white px-3.5 py-1.5 text-[18px] font-semibold text-text">
          <ClockIcon className="text-[19px] text-accent-deep" />
          {live.length + inboundCount + sent.length} open
        </span>
      }
    >
      {needsWali && waiting.length > 0 ? (
        <p className="mb-6 flex items-start gap-3 rounded-lg border-2 border-peach bg-soft-peach/60 px-4 py-3.5 text-[18px] leading-[26px] text-text">
          <WaliIcon className="mt-0.5 shrink-0 text-[20px] text-peach-deep" />
          You can read these, but a conversation cannot open until your wali has confirmed.
        </p>
      ) : null}

      {/* Threads have their own tab now. A pointer rather than the list:
          duplicating them here is what made a conversation look like a
          footnote to the request that created it. */}
      {live.length ? (
        <Link
          href="/conversations"
          className="mb-6 flex items-center gap-3 rounded-xl border border-soft-green bg-white px-4 py-3.5 transition-colors hover:border-accent-deep"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mist text-[20px] text-accent-deep">
            <ChatIcon />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[18px] font-semibold text-black">
              {live.length} open conversation{live.length === 1 ? "" : "s"}
            </span>
            <span className="text-[18px] text-text">Read them under Messages.</span>
          </span>
          <ChevronRight className="shrink-0 text-[20px] text-text/50" />
        </Link>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* ---- waiting on you ------------------------------------ */}
        <Section
          Icon={RequestsIcon}
          title="Waiting on you"
          count={waiting.length}
          blurb="They asked. Nothing is shared until you answer."
        >
          {waiting.length === 0 ? (
            <Empty Icon={RequestsIcon} line="Nobody is waiting on an answer." />
          ) : (
            <ul className="flex flex-col gap-3">
              {waiting.map((r) => (
                <li key={r.id} className="rounded-xl border border-soft-green bg-white p-4">
                  {/* One line where there is room for one. Stacked, the
                      controls inherited the card's whole width and two
                      ordinary buttons became a pair of slabs; side by
                      side they are the size of what they say, and the
                      card is the height of a person rather than of a
                      form. It still wraps under 400px or so. */}
                  <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
                    <PersonRow
                      person={names.get(r.fromUserId)}
                      lead="Asked to talk"
                      meta={`${day(r.sentAt)} · expires ${day(r.expiresAt)}`}
                    />
                    <AnswerForm requestId={r.id} side="in" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ---- you asked ----------------------------------------- */}
        <Section
          Icon={SentIcon}
          title="You asked"
          count={sent.length}
          blurb="Waiting on them. Withdrawing returns the connection."
        >
          {sent.length === 0 ? (
            <Empty Icon={SentIcon} line="You have not asked anybody yet." />
          ) : (
            <ul className="flex flex-col gap-3">
              {sent.map((r) => (
                <li key={r.id} className="rounded-xl border border-soft-green bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
                    <PersonRow
                      person={names.get(r.toUserId)}
                      lead="Waiting on them"
                      meta={`sent ${day(r.sentAt)} · expires ${day(r.expiresAt)}`}
                    />
                    {/* No read receipt, on purpose. "Seen and not
                        answered" is the most corrosive signal a product
                        like this can show, and it invites exactly the
                        behaviour the inbound cap exists to prevent. */}
                    <AnswerForm requestId={r.id} side="out" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </AppFrame>
  );
}
