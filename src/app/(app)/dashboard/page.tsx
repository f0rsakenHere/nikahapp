import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId, poolCounts } from "@/lib/repositories/profiles";
import { suggestionsFor } from "@/lib/repositories/browse";
import { hasConfirmedWali } from "@/lib/repositories/guardianships";
import { listNotifications } from "@/lib/repositories/notifications";
import {
  balanceFor,
  countPendingInbound,
  ensureMonthlyGrant,
  listRequests,
  readSettings,
} from "@/lib/repositories/connections";
import { listConversationsFor } from "@/lib/repositories/conversations";
import { CLOSED_STATES } from "@/lib/domain/conversation";
import {
  completeness,
  inPool,
  stepsFor,
  submitBlockers,
  type ProfileStatus,
} from "@/lib/domain/profile";
import { isStaffActor } from "@/lib/domain/authorisation";
import {
  BellIcon,
  BrowseIcon,
  ChatIcon,
  CheckIcon,
  ChevronRight,
  ClockIcon,
  HeartIcon,
  ProfileIcon,
  RequestsIcon,
  SentIcon,
  ShieldIcon,
  SparkIcon,
  SparkleIcon,
  WaliIcon,
} from "@/components/app/icons";
import { ProfileCard } from "@/components/app/profile-card";
import { AppFrame } from "../frame";

export const metadata: Metadata = { title: "Your dashboard — NikahCanada" };

/* Where a member lands, and where every tab returns to.
 *
 * Until now the app had no home. Signing in dropped everybody on the
 * profile builder — including someone whose profile had been live for
 * months, on a screen framed without the tab bar, so the pool was
 * reachable only by typing the address. This is the answer to "what is
 * happening with my account", which is a different question from "what
 * do I still have to fill in".
 *
 * It states where the profile stands before it offers anything to do.
 * Most people arriving here are waiting on us — a submitted profile sits
 * with staff until a phone call happens — and a screen that leads with
 * four empty counters reads as a product with nothing in it rather than
 * a queue that has not been reached yet.
 *
 * ── The shape ─────────────────────────────────────────────────────────
 * One banner, then the page gets denser as it goes down: status and the
 * one action at the top, the three counts as a single instrument strip,
 * then people, then what has happened.
 *
 * The counts used to be four detached boxes each holding a lonely zero
 * across the full width of a monitor — a lot of furniture to say nothing
 * is happening. They are one strip now, and the quota moved into the
 * banner beside the status, where it belongs: it is a standing fact
 * about the account, not something that just occurred.
 * ──────────────────────────────────────────────────────────────────────
 */

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(d);

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })
    .format(d);

/* What each status means to the person in it, in their words rather than
   the database's. `pendingCall`, `pendingReview` and `verifying` are
   three stages of one wait and are not worth explaining separately —
   what differs is only which desk it is on. */
const WAITING: ProfileStatus[] = ["pendingCall", "pendingReview", "verifying"];

/* One glyph per kind, so the feed can be skimmed down its left edge.
   The same set the notifications page uses. */
const FEED_ICONS = {
  "request.received": RequestsIcon,
  "request.accepted": CheckIcon,
  "request.declined": RequestsIcon,
  "request.withdrawn": RequestsIcon,
  "wali.confirmed": WaliIcon,
  "conversation.opened": ChatIcon,
  "conversation.message": ChatIcon,
  "conversation.closed": ChatIcon,
  "profile.live": ShieldIcon,
} as const;

/** One cell of the counts strip. */
function Count({
  href,
  label,
  value,
  note,
  Icon,
  loud,
}: {
  href: string;
  label: string;
  value: number;
  note: string;
  Icon: (p: { className?: string }) => ReactNode;
  /** Something is actually waiting on them. */
  loud?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-3.5 px-5 py-4 transition-colors ${
        loud ? "bg-soft-peach/45 hover:bg-soft-peach/70" : "bg-white hover:bg-mist/60"
      }`}
    >
      <span
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[19px] ${
          loud ? "bg-peach text-black" : "bg-mist text-accent-deep"
        }`}
      >
        <Icon />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-baseline gap-2">
          <span className="font-manrope text-[26px] font-bold leading-none text-black">{value}</span>
          {/* Not uppercase, and no tracking. Those made a 12px label read
              as a label; at 18px they make it shout, and "CONVERSATIONS"
              is wider than the cell it sits in on a 390px phone. */}
          <span className="text-[18px] font-semibold text-black">{label}</span>
        </span>
        <span className="mt-1 text-[18px] leading-[26px] text-text/70">{note}</span>
      </span>
    </Link>
  );
}

/** The one action the screen is actually recommending. */
function Next({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-pill bg-peach px-4 py-2.5 text-[18px] font-semibold text-black transition-opacity hover:opacity-90"
    >
      {children}
      <ChevronRight className="text-[18px]" />
    </Link>
  );
}

/** Beside the recommendation, never instead of it. */
function Secondary({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-pill border border-soft-green bg-white px-4 py-2.5 text-[18px] font-semibold text-accent-deep transition-colors hover:border-accent-deep hover:bg-mist/60"
    >
      {children}
    </Link>
  );
}

/** A quiet heading with a way out to the whole of the thing. */
function SectionHead({
  Icon,
  title,
  blurb,
  href,
  more,
}: {
  Icon: (p: { className?: string }) => ReactNode;
  title: string;
  blurb?: string;
  href?: string;
  more?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <h2 className="flex items-center gap-2.5 font-manrope text-[22px] font-bold leading-tight text-black">
          <Icon className="text-[21px] text-accent-deep" />
          {title}
        </h2>
        {blurb ? <p className="mt-1 text-[18px] leading-[26px] text-text/70">{blurb}</p> : null}
      </div>
      {href && more ? (
        <Link
          href={href}
          /* The negative margin keeps it where it looked right while
             giving it a 42px box to be tapped in. */
          className="-my-2 inline-flex items-center gap-1 py-2 text-[18px] font-semibold text-accent-deep underline-offset-2 hover:underline"
        >
          {more}
          <ChevronRight className="text-[18px]" />
        </Link>
      ) : null}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await currentUser();
  if (!session) redirect("/login?next=/dashboard");

  const { user } = session;
  const me = await findProfileByUserId(user.id);
  /* Nobody without a profile belongs on this screen, and there are two
     legitimate ways to be in that position. Staff have accounts and no
     profile — their home is the console. A wali has no profile of his
     own and no pool to browse; his portal is the whole of his account.
     Anything else is an account whose profile never got created, and
     registration is the only place that can make one. */
  if (!me) {
    if (isStaffActor(user.roles)) redirect("/admin");
    redirect(user.roles.includes("wali") ? "/wali" : "/register");
  }

  const { submitted } = await searchParams;
  const settings = await readSettings();
  const now = new Date();
  await ensureMonthlyGrant(user.id, settings, now);

  const ctx = { hasConfirmedWali: await hasConfirmedWali(user.id) };
  const progress = completeness(me, ctx);
  const blockers = submitBlockers(me, ctx);
  const nextStep = stepsFor(me.gender).find((s) => blockers.some((b) => b.step === s.id));

  const [waiting, sent, conversations, balance, suggestions, feed, pool] = await Promise.all([
    countPendingInbound(user.id),
    listRequests(user.id, "out"),
    listConversationsFor(user.id),
    balanceFor(user.id),
    /* Only for somebody who can actually act on them. Ranking a pool a
       member is not yet allowed to see would be showing them a door and
       the key at the same time. Four rather than three: the grid is
       two-up on a laptop and four-up on a wide monitor, and both fill
       without leaving one card stranded on a row of its own. */
    inPool(me.status, settings)
      ? suggestionsFor({ userId: user.id, gender: me.gender }, settings, 4)
      : Promise.resolve([]),
    /* Read, not marked read — the bell is the thing that clears, and a
       glance at the dashboard is not an acknowledgement. */
    listNotifications(user.id, 4),
    poolCounts(now, settings),
  ]);
  const open = conversations.filter((c) => !CLOSED_STATES.has(c.state));
  const pendingSent = sent.filter((r) => r.state === "pending");

  const isDraft = me.status === "draft";
  const isWaiting = WAITING.includes(me.status);
  const canBrowse = inPool(me.status, settings);
  /* Both are offered one now; only hers is required. His card is a
     quiet suggestion, hers is a blocker, and the copy below says which
     is which rather than showing one alarm to two different people. */
  const needsWali = !ctx.hasConfirmedWali;
  const waliRequired = me.gender === "sister";
  /* Required, and no longer something she can get to in her own time. */
  const urgent = waliRequired && !isDraft;
  const moderatorAvailable = Boolean(settings.moderatorWaliUserId);

  /* The one thing worth saying about the pool that is not already a
     button. Under the actions rather than in the rail beside them: as a
     second paragraph over there it left this side of the banner ending a
     hundred pixels short, and it is reassurance, not an instruction.
     Defined once because two states now show it — a member who has sent
     their profile in can browse, and so can one who is live.
     "Every one checked" is only said where it is true. Under deferred
     approval the checks run behind the pool rather than in front of it,
     and a count is a poor place to imply otherwise. */
  const poolLine = canBrowse ? (
    <p className="mt-5 flex items-start gap-2 text-[18px] leading-[26px] text-text/70">
      <ShieldIcon className="mt-0.5 shrink-0 text-[19px] text-accent-deep" />
      <span>
        {/* Counted at render, never configured and never rounded up. The
            whole promise of a small pool is that the number is real. */}
        <strong className="font-semibold text-black">{pool.total}</strong> in the pool
        {settings.requireVerifiedToBrowse ? ", every one checked by our team" : ""}.{" "}
        {pool.newThisWeek ? (
          <Link
            href="/browse?new=1"
            className="font-semibold text-accent-deep underline-offset-2 hover:underline"
          >
            {pool.newThisWeek} joined this week
          </Link>
        ) : (
          "Nobody new this week."
        )}
      </span>
    </p>
  ) : null;

  return (
    <AppFrame
      active="home"
      width="wide"
      title={`Assalamu alaikum, ${user.legalName.first}`}
      aside={
        <span className="inline-flex items-center gap-2 rounded-pill border border-soft-green bg-white px-3.5 py-1.5 text-[18px] font-semibold text-text">
          <ShieldIcon className="text-[18px] text-accent-deep" />
          {me.status === "live"
            ? "Profile live"
            : isDraft
              ? "Profile in progress"
              : canBrowse
                ? "In the pool"
                : "In review"}
        </span>
      }
    >
      {submitted ? (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-accent-deep/30 bg-accent/12 px-4 py-4">
          <ShieldIcon className="mt-0.5 shrink-0 text-[20px] text-accent-deep" />
          <div>
            <p className="text-[18px] font-semibold text-black">Thank you — we have it.</p>
            <p className="mt-1 text-[18px] leading-[26px] text-text">
              Nothing else is needed from you today.
            </p>
          </div>
        </div>
      ) : null}

      {/* ---- the wali ---------------------------------------------------
          Across the top rather than down a third of the page. It is the
          piece of this product nothing else works without — her profile
          does not go live and no conversation opens until a guardian
          exists — and as a narrow column its four lines wrapped into a
          tower taller than the status card beside it.

          Two tempers, and the alarm is the narrower of them. Peach is
          the colour this app uses for "something is wrong", and it is
          earned only once naming him is the thing standing between her
          and going live — she has sent the profile in, or it is already
          out there. While it is still hers to finish, and for a brother
          it is optional throughout, this is the mint accent: present,
          not alarmed. A warning shown on day one about a step nobody has
          reached is how a warning colour stops meaning anything. */}
      {needsWali ? (
        <div
          className={`mb-5 flex flex-col gap-4 rounded-lg border-2 p-5 lg:flex-row lg:items-center ${
            urgent ? "border-peach bg-soft-peach/50" : "border-accent bg-accent/12"
          }`}
        >
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[24px] ${
              urgent ? "bg-peach text-black" : "bg-accent text-black"
            }`}
          >
            <WaliIcon />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-manrope text-[20px] font-bold leading-tight text-black">
              {urgent ? "Your wali has not confirmed" : "Name your wali"}
            </p>
            <p className="mt-1.5 max-w-[75ch] text-[18px] leading-[26px] text-text">
              {waliRequired
                ? settings.waliGate === "approves"
                  ? "Your profile cannot go live, and no conversation can open, until he confirms."
                  : "He reads your conversations once they open."
                : "Optional for you. If you would like a father or an elder brother overseeing your side, name him."}
              {moderatorAvailable
                ? " If there is nobody you can ask, a NikahCanada moderator can act as your wali."
                : ""}
            </p>
          </div>

          <Link
            href="/onboarding/guardian"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill px-4 py-2.5 text-[18px] font-semibold text-black transition-opacity hover:opacity-90 ${
              urgent ? "bg-peach" : "bg-accent"
            }`}
          >
            {urgent ? "Invite him or send a reminder" : "Name your wali"}
            <ChevronRight className="text-[18px]" />
          </Link>
        </div>
      ) : null}

      {/* ---- where the profile stands, and what the account holds ------
          One banner split by a rule rather than two cards side by side.
          The old right-hand card held two sentences about the pool in a
          third of a monitor's width; the rule does the same separating
          for none of the space. */}
      <section className="overflow-hidden rounded-lg border border-soft-green bg-white">
        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1 p-5 lg:p-7">
            <p className="flex items-center gap-2 text-[18px] font-semibold uppercase tracking-[0.6px] text-text/70">
              <ProfileIcon className="text-[18px]" />
              Your profile
            </p>

            {isDraft ? (
              <>
                <p className="mt-3 font-manrope text-[26px] font-bold leading-tight text-black">
                  {blockers.length ? "Not finished yet" : "Ready to send"}
                </p>
                <div className="mt-4 flex max-w-[520px] items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft-green">
                    <div
                      className="h-full rounded-full bg-peach transition-[width]"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <span className="text-[18px] font-semibold text-peach-deep">
                    {progress.percent}%
                  </span>
                </div>
                <p className="mt-3 max-w-[62ch] text-[18px] leading-[26px] text-text">
                  Everything you have filled in is saved. You can leave and come back.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <Next href={nextStep ? `/onboarding/${nextStep.id}` : "/onboarding"}>
                    {nextStep ? `Continue — ${nextStep.title}` : "Send it to us"}
                  </Next>
                  <Secondary href="/onboarding">All your answers</Secondary>
                </div>
              </>
            ) : isWaiting ? (
              /* Sent in, and waiting on the review — which under deferred
                 approval is no longer waiting on anything before they can
                 use the product. Both readings of this state are here
                 because both are true at different settings, and the one
                 thing neither may do is promise a telephone call as a
                 precondition when it is not one. */
              <>
                <p className="mt-3 flex items-center gap-2.5 font-manrope text-[26px] font-bold leading-tight text-black">
                  <ClockIcon className="text-[24px] text-accent-deep" />
                  {canBrowse ? "In the pool" : "With our team"}
                </p>
                <p className="mt-3 max-w-[62ch] text-[18px] leading-[26px] text-text">
                  {canBrowse
                    ? "Your profile is in, and you can see everybody else who is. Our team reads every profile and telephones — that happens alongside you now rather than before you."
                    : "Someone will read your profile and telephone you before any matching begins. We check identity and speak to your reference or your wali first. You can still change your answers."}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  {canBrowse ? (
                    <>
                      <Next href="/browse">Browse the pool</Next>
                      <Secondary href="/browse?saved=1">
                        <HeartIcon className="text-[18px]" />
                        Saved
                      </Secondary>
                      <Secondary href="/onboarding">Your answers</Secondary>
                    </>
                  ) : (
                    <>
                      <Next href="/onboarding">Your answers</Next>
                      <Secondary href="/settings">Your account</Secondary>
                    </>
                  )}
                </div>
                {poolLine}
              </>

            ) : (
              <>
                {/* live, paused, matched, withdrawn, rejected — each says
                    what it means for browsing rather than showing a status
                    word nobody outside this codebase would recognise. */}
                <p className="mt-3 flex items-center gap-2.5 font-manrope text-[26px] font-bold leading-tight text-black">
                  {me.status === "live" ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-accent-deep" aria-hidden />
                  ) : null}
                  {me.status === "live"
                    ? "Live"
                    : me.status === "paused"
                      ? "Paused by you"
                      : me.status === "matched"
                        ? "Matched"
                        : me.status === "withdrawn"
                          ? "Withdrawn"
                          : "Not accepted"}
                </p>
                <p className="mt-3 max-w-[62ch] text-[18px] leading-[26px] text-text">
                  {me.status === "live"
                    ? "You are in the pool, and you can see everybody else in it."
                    : me.status === "paused"
                      ? "Nobody can see you and you cannot send requests. Unpause whenever you are ready."
                      : me.status === "matched"
                        ? "Your profile is out of the pool while this is going on."
                        : me.status === "withdrawn"
                          ? "Your profile is out of the pool."
                          : "Our team will have been in touch about this."}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <Next href={me.status === "live" ? "/browse" : "/settings"}>
                    {me.status === "live" ? "Browse the pool" : "Your account"}
                  </Next>
                  {me.status === "live" ? (
                    <>
                      <Secondary href="/browse?saved=1">
                        <HeartIcon className="text-[18px]" />
                        Saved
                      </Secondary>
                      <Secondary href="/onboarding">Your answers</Secondary>
                    </>
                  ) : null}
                </div>
                {poolLine}
              </>
            )}
          </div>

          {/* The standing facts about the account: how many requests are
              left, and what the pool is. Neither is news, so neither is
              in the strip below. */}
          <div className="shrink-0 border-t border-soft-green bg-mist/40 p-5 lg:w-[320px] lg:border-l lg:border-t-0 lg:p-7">
            {canBrowse ? (
              <>
                <p className="flex items-center gap-2 text-[18px] font-semibold uppercase tracking-[0.6px] text-text/70">
                  <SparkIcon className="text-[18px]" />
                  Requests left
                </p>
                <p className="mt-2 font-manrope text-[38px] font-bold leading-none text-peach-deep">
                  {balance}
                </p>
                <p className="mt-2 text-[18px] leading-[26px] text-text">
                  Renews monthly · {day(now)}
                </p>
                {/* The three charging rules differ in when the connection
                    leaves the account, and a member who is deciding
                    whether to spend one deserves the right sentence
                    rather than the average of the three. */}
                <p className="mt-4 border-t border-soft-green pt-4 text-[18px] leading-[26px] text-text/70">
                  {settings.connectionCharge === "onAccept"
                    ? "One is spent when somebody accepts. Asking costs nothing until then."
                    : settings.connectionCharge === "reserve"
                      ? "One is held when you ask, and returned if they decline."
                      : "One is spent when you ask somebody to talk."}
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-[18px] font-semibold uppercase tracking-[0.6px] text-text/70">
                  <BrowseIcon className="text-[18px]" />
                  The pool
                </p>
                <p className="mt-2 text-[18px] leading-[26px] text-text">
                  {settings.requireVerifiedToBrowse
                    ? "Browsing opens once your own profile is live. Everyone in it has been checked, which is only true if it is also true of you."
                    : "Browsing opens once you have finished your profile and sent it in. Everyone you would see has done the same."}
                </p>
              </>
            )}
          </div>
        </div>

        {/* What the wait is for, across the banner rather than down a
            third of one. Every line is the published process. */}
        {!canBrowse ? (
          <ol className="grid grid-cols-1 gap-4 border-t border-soft-green px-5 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-7">
            {[
              "You finish your profile and send it to us.",
              "We read it, and telephone you.",
              "We speak to your reference, or to your wali.",
              "Your profile goes live, and the pool opens.",
            ].map((step, i) => {
              const here = (isDraft && i === 0) || (isWaiting && i === 1);
              return (
                <li key={step} className="flex items-start gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold ${
                      here ? "bg-peach text-black" : "bg-mist text-text/70"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`text-[18px] leading-[26px] ${here ? "text-black" : "text-text/70"}`}
                  >
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      {/* ---- what is moving --------------------------------------------
          One instrument strip, divided by its own background showing
          through a one-pixel gap — which holds however many columns the
          breakpoint gives it, where four bordered boxes did not. */}
      <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-soft-green bg-soft-green sm:grid-cols-3">
        <Count
          href="/requests"
          label="Waiting on you"
          value={waiting}
          loud={waiting > 0}
          Icon={RequestsIcon}
          note={waiting ? "They asked. Answer when you are ready." : "Nobody is waiting."}
        />
        <Count
          href="/conversations"
          label="Conversations"
          value={open.length}
          Icon={ChatIcon}
          note={open.length ? "Open threads." : "None open yet."}
        />
        <Count
          href="/requests"
          label="You asked"
          value={pendingSent.length}
          Icon={SentIcon}
          note={pendingSent.length ? "Still unanswered." : "You have asked nobody."}
        />
      </div>

      {/* ---- who to look at -------------------------------------------- */}
      {suggestions.length ? (
        <section className="mt-8">
          <SectionHead
            Icon={SparkleIcon}
            title="Suggested for you"
            blurb="From what you said you were looking for. Every one says why."
            href="/browse"
            more="See everyone"
          />
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {suggestions.map(({ card, reasons }) => (
              <li key={card.profileId} className="h-full">
                <ProfileCard card={card} reasons={reasons} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- what has happened ------------------------------------------
          Everything in this product happens on somebody else's screen —
          a wali confirms in his own portal, a request is answered
          elsewhere. Without this the dashboard could only ever show the
          state, never the events that got it there. */}
      {feed.length ? (
        <section className="mt-8">
          <SectionHead Icon={BellIcon} title="Latest" href="/notifications" more="All notifications" />
          <ul className="mt-4 grid grid-cols-1 gap-2 xl:grid-cols-2">
            {feed.map((n) => {
              const Icon = FEED_ICONS[n.kind] ?? BellIcon;
              const isNew = n.readAt === null;
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    className={`flex items-center gap-3.5 rounded-xl border px-4 py-3.5 transition-colors ${
                      isNew
                        ? "border-accent bg-accent/12 hover:border-accent-deep"
                        : "border-soft-green bg-white hover:border-accent-deep"
                    }`}
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px] ${
                        isNew ? "bg-white text-accent-deep" : "bg-mist text-text"
                      }`}
                    >
                      <Icon />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[18px] leading-[26px] text-black">{n.body}</span>
                      <span className="text-[18px] text-text/70">{when(n.createdAt)}</span>
                    </span>
                    <ChevronRight className="shrink-0 text-[20px] text-text/50" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </AppFrame>
  );
}
