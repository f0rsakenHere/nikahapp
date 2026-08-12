import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { listNotifications, markAllRead } from "@/lib/repositories/notifications";
import {
  BellIcon,
  ChatIcon,
  CheckIcon,
  ChevronRight,
  RequestsIcon,
  ShieldIcon,
  WaliIcon,
} from "@/components/app/icons";
import { AppFrame } from "../frame";

export const metadata: Metadata = { title: "Notifications — NikahCanada" };

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })
    .format(d);

/* One glyph per kind, so the feed can be skimmed down its left edge. */
const ICONS = {
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

export default async function NotificationsPage() {
  const session = await currentUser();
  if (!session) redirect("/login?next=/notifications");

  const items = await listNotifications(session.user.id);
  /* Read on open, not per item. This is a feed to glance at, not an
     inbox to be managed, and a page of checkboxes would make the reader
     do filing they never asked for. Done after the read so the ones on
     screen still show as new. */
  await markAllRead(session.user.id);

  return (
    <AppFrame active="home" title="Notifications">
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-soft-green bg-mist/40 px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-[26px] text-accent-deep">
            <BellIcon />
          </span>
          <p className="text-[18px] leading-[26px] text-text">
            Nothing yet. You will hear when somebody asks to talk, when a request is answered, and
            when a conversation opens.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const Icon = ICONS[n.kind] ?? BellIcon;
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
      )}
    </AppFrame>
  );
}
