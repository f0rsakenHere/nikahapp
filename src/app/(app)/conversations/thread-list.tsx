import Link from "next/link";
import { ObjectId } from "mongodb";
import { CLOSED_STATES } from "@/lib/domain/conversation";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { listConversationsFor } from "@/lib/repositories/conversations";
import { ChatIcon, ClockIcon } from "@/components/app/icons";

/* The middle pane: every thread this person is in.
 *
 * Its own tab rather than a section of Requests. A request is a decision
 * you make once; a conversation is somewhere you come back to, and the
 * two were sharing a screen only because there was nowhere else to put
 * them. This is the list half of the usual mail-client three panes —
 * navigation, threads, thread — with the selected one held open beside
 * it on a desktop and stacked under it on a phone.
 */

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(d);

export type ThreadSummary = {
  id: string;
  state: string;
  messageCount: number;
  lastMessageAt: Date | null;
  /** The other member — never a name. Contact details move at step 06. */
  initials: string;
  /** "Sister, 30". Initials alone collide with a wali's: Abdullah
   *  Rahman and Aisha Rahman are both A.R. */
  described: string;
  closed: boolean;
};

/** Everything this member's list needs, in two queries rather than one
 *  per row. */
export async function threadsFor(userId: string): Promise<ThreadSummary[]> {
  const conversations = await listConversationsFor(userId);
  if (conversations.length === 0) return [];

  const others = conversations
    .map((c) => c.participants.find((p) => p.role === "member" && p.userId !== userId)?.userId)
    .filter((u): u is string => Boolean(u));

  const year = new Date().getUTCFullYear();
  const profiles = await (await getDb())
    .collection(COLLECTIONS.profiles)
    .find(
      { userId: { $in: [...new Set(others)].map((u) => new ObjectId(u)) } },
      { projection: { userId: 1, initials: 1, gender: 1, "basics.birthYear": 1 } }
    )
    .toArray();
  const initials = new Map(profiles.map((p) => [String(p.userId), (p.initials as string) ?? "—"]));
  const described = new Map(
    profiles.map((p) => {
      const age = p.basics?.birthYear ? year - Number(p.basics.birthYear) : null;
      return [
        String(p.userId),
        `${p.gender === "sister" ? "Sister" : "Brother"}${age ? `, ${age}` : ""}`,
      ];
    })
  );

  return conversations.map((c) => {
    const other = c.participants.find((p) => p.role === "member" && p.userId !== userId);
    return {
      id: c.id,
      state: c.state,
      messageCount: c.messageCount,
      lastMessageAt: c.lastMessageAt,
      initials: initials.get(other?.userId ?? "") ?? "—",
      described: described.get(other?.userId ?? "") ?? "A member",
      closed: CLOSED_STATES.has(c.state),
    };
  });
}

function label(t: ThreadSummary): string {
  if (t.state === "awaitingWali") return "Waiting on the wali";
  if (t.closed) return "Closed";
  return t.messageCount === 0
    ? "Nothing said yet"
    : `${t.messageCount} message${t.messageCount === 1 ? "" : "s"}`;
}

export function ThreadList({
  threads,
  activeId,
}: {
  threads: ThreadSummary[];
  activeId?: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-soft-green px-5 py-4">
        <ChatIcon className="text-[21px] text-accent-deep" />
        <h2 className="font-manrope text-[22px] font-bold leading-tight text-black">
          Conversations
        </h2>
        {threads.length ? (
          <span className="rounded-pill bg-peach px-2.5 py-0.5 text-[18px] font-semibold text-black">
            {threads.length}
          </span>
        ) : null}
      </div>

      {threads.length === 0 ? (
        <p className="px-5 py-8 text-[18px] leading-[26px] text-text">
          No conversations yet. One opens when a request is accepted and the wali approves it.
        </p>
      ) : (
        <ul className="flex flex-col">
          {threads.map((t) => {
            const on = t.id === activeId;
            return (
              <li key={t.id}>
                <Link
                  href={`/conversations/${t.id}`}
                  aria-current={on ? "page" : undefined}
                  /* The selected row is filled rather than outlined: on a
                     list this dense an outline reads as another divider. */
                  className={`flex items-center gap-3.5 border-b border-soft-green px-5 py-4 transition-colors ${
                    on ? "bg-mist" : "hover:bg-mist/50"
                  }`}
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-manrope text-[18px] font-bold ${
                      t.closed
                        ? "bg-soft-green/60 text-text"
                        : "bg-soft-peach text-peach-deep"
                    }`}
                  >
                    {t.initials}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[18px] font-semibold text-black">
                      {t.described}
                    </span>
                    <span className="truncate text-[18px] text-text">{label(t)}</span>
                  </span>
                  {t.lastMessageAt ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-[18px] text-text/60">
                      <ClockIcon className="text-[16px]" />
                      {day(t.lastMessageAt)}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
