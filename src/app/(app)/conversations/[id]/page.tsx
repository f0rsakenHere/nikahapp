import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ObjectId } from "mongodb";
import { currentUser } from "@/lib/auth/current";
import { record } from "@/lib/audit";
import { isStaffActor } from "@/lib/domain/authorisation";
import { CLOSED_STATES, canRead, participant } from "@/lib/domain/conversation";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { findConversationById, listMessages } from "@/lib/repositories/conversations";
import { findGuardianshipForWali } from "@/lib/repositories/guardianships";
import { WaliIcon } from "@/components/app/icons";
import { AppFrame } from "../../frame";
import { ThreadList, threadsFor } from "../thread-list";
import { Composer, CloseThread } from "./composer";

export const metadata: Metadata = { title: "Conversation — NikahCanada" };

const time = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(d);

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await currentUser();
  if (!session) redirect(`/login?next=/conversations/${id}`);

  const conversation = await findConversationById(id);
  if (!conversation) notFound();

  const isStaff = isStaffActor(session.user.roles);
  if (!canRead(conversation, { userId: session.user.id, isStaff })) notFound();

  /* §7.7: every staff read of somebody's correspondence is an event.
   * Recorded on the page rather than behind a button, because reading it
   * is the thing being recorded. */
  if (isStaff && !participant(conversation, session.user.id)) {
    await record({
      action: "staff.readConversation",
      subject: { type: "conversation", id },
      actor: { userId: session.user.id, role: session.user.roles[0] },
    });
  }

  const seat = participant(conversation, session.user.id);
  const messages = await listMessages(id);

  /* Initials for everyone in the room, so nothing on this page is a
   * legal name — those move at contact release, not before. */
  const memberIds = conversation.participants
    .filter((p) => p.role === "member")
    .map((p) => new ObjectId(p.userId));
  const profiles = await (await getDb())
    .collection(COLLECTIONS.profiles)
    .find(
      { userId: { $in: memberIds } },
      { projection: { userId: 1, initials: 1, gender: 1, "basics.birthYear": 1 } }
    )
    .toArray();
  const initials = new Map(profiles.map((p) => [String(p.userId), (p.initials as string) ?? "—"]));

  /* "Sister, 30" beside the initials, everywhere a member appears.
   *
   * Initials alone are ambiguous in exactly the place it matters most:
   * a wali named Abdullah Rahman shortens to the same A.R. as a member
   * called Aisha Rahman, and somebody reading their own thread cannot
   * tell which of the two they are talking to. The gendered label
   * separates them for good — the wali is always a man and is always
   * labelled as the wali, so "Sister" can only be the counterpart.
   * Still no real name: that is released at contact release (§5.12),
   * behind the fee, not here. */
  const YEAR = new Date().getUTCFullYear();
  const described = new Map(
    profiles.map((p) => {
      const age = p.basics?.birthYear ? YEAR - Number(p.basics.birthYear) : null;
      return [
        String(p.userId),
        `${p.gender === "sister" ? "Sister" : "Brother"}${age ? `, ${age}` : ""}`,
      ];
    })
  );

  const waliSeat = conversation.participants.find((p) => p.role === "wali");
  /* From his side. Taking "the member" of a conversation and asking who
   * her wali is picks whichever seat comes first — the brother, half the
   * time — and then finds nothing, so the banner named nobody. */
  const guardianship = waliSeat
    ? await findGuardianshipForWali(
        waliSeat.userId,
        conversation.participants.filter((p) => p.role === "member").map((p) => p.userId)
      )
    : null;
  const waliName = guardianship?.invited.name ?? "Her wali";
  /* Whose guardian he is, by initials — the same label the rest of the
     app uses for a member. */
  const waliOf = guardianship ? (initials.get(guardianship.memberUserId) ?? null) : null;

  const closed = CLOSED_STATES.has(conversation.state);

  /* The other threads, beside this one. Staff reading a conversation they
     are not in have no list of their own — they arrived from the console,
     and showing them somebody else's inbox would be a second disclosure
     on top of the one already being recorded. */
  const threads = seat ? await threadsFor(session.user.id) : [];

  const other = conversation.participants.find(
    (p) => p.role === "member" && p.userId !== session.user.id
  );

  return (
    <AppFrame
      active="messages"
      width="wide"
      title={described.get(other?.userId ?? "") ?? "Conversation"}
      list={seat ? <ThreadList threads={threads} activeId={id} /> : undefined}
      phone="content"
    >
      {/* Only on a phone, where the list is a screen you came from rather
          than a pane still on show. */}
      <Link
        href="/conversations"
        className="text-[18px] text-text underline-offset-2 hover:underline lg:hidden"
      >
        ← All conversations
      </Link>

      {/* The banner. It cannot be dismissed or minimised by either side —
          /how-it-works promises exactly that, and a guardian nobody can
          see is not oversight, it is surveillance. */}
      {waliSeat ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-accent-deep/40 bg-accent/12 px-4 py-3">
          <span className="mt-0.5 shrink-0 text-[20px] text-accent-deep">
            <WaliIcon />
          </span>
          <p className="text-[18px] leading-[26px] text-black">
            {/* His role first, and the tie to whose guardian he is. The
                banner used to open with a man's name and never say who
                he was, which reads as a third person in the
                conversation rather than the guardian of one side. */}
            <span className="font-semibold">The wali</span>
            {waliOf ? ` for ${described.get(guardianship?.memberUserId ?? "") ?? waliOf}` : ""},{" "}
            <span className="font-semibold">{waliName}</span>,
            reads every message here and can end the conversation at any point. He is not part of
            the introduction.
          </p>
        </div>
      ) : null}

      {isStaff && !seat ? (
        <p className="mt-3 rounded-md border-2 border-dashed border-peach-deep/50 bg-soft-peach/40 px-3.5 py-2.5 text-[18px] font-semibold text-peach-deep">
          You are reading this as staff. It has been recorded.
        </p>
      ) : null}

      {conversation.state === "awaitingWali" ? (
        <p className="mt-4 rounded-md border border-soft-green bg-mist px-4 py-4 text-[18px] leading-[26px] text-text">
          Nothing can be written yet. The wali, {waliName}, was told the moment this was accepted,
          and the conversation opens when he approves it.
        </p>
      ) : null}

      <ol className="mt-5 flex flex-col gap-3">
        {messages.map((m) => {
          if (m.kind === "system") {
            return (
              <li
                key={m.id}
                className="mx-auto max-w-[300px] rounded-md bg-soft-green/40 px-3 py-2 text-center text-[18px] leading-[26px] text-text"
              >
                {m.body}
              </li>
            );
          }
          const mine = m.fromUserId === session.user.id;
          return (
            <li
              key={m.id}
              className={`max-w-[78%] rounded-lg px-3.5 py-2.5 text-[18px] leading-[26px] ${
                mine ? "self-end bg-soft-peach text-black" : "self-start bg-mist text-black"
              }`}
            >
              {!mine ? (
                /* Both, so a bubble can never be read as the wali's:
                   he never speaks here under initials, and "Sister" or
                   "Brother" is the half that cannot collide. */
                <span className="mb-1 block text-[18px] font-semibold text-text/70">
                  {described.get(m.fromUserId ?? "") ?? "A member"} ·{" "}
                  {initials.get(m.fromUserId ?? "") ?? "—"}
                </span>
              ) : null}
              {m.body}
              <span className="mt-1 block text-[18px] text-text/60">{time(m.sentAt)}</span>
            </li>
          );
        })}
      </ol>

      {messages.length === 0 && conversation.state === "open" ? (
        <p className="mt-5 text-center text-[18px] text-text/70">
          Nothing said yet. Whatever you write here, the wali {waliName} sees.
        </p>
      ) : null}

      {closed ? (
        <p className="mt-6 rounded-md border border-soft-green bg-mist px-4 py-4 text-[18px] leading-[26px] text-text">
          This conversation is closed. Nothing can be added, and nothing already said has been
          removed.
        </p>
      ) : conversation.state === "open" && seat?.canWrite ? (
        <>
          <Composer conversationId={id} />
          <CloseThread conversationId={id} role={seat.role} />
        </>
      ) : conversation.state === "open" && seat ? (
        <>
          <p className="mt-6 rounded-md border border-soft-green bg-mist px-4 py-3 text-[18px] leading-[26px] text-text">
            You read this conversation. You do not write in it.
          </p>
          <CloseThread conversationId={id} role={seat.role} />
        </>
      ) : null}
    </AppFrame>
  );
}
