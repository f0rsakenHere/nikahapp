import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { ChatIcon } from "@/components/app/icons";
import { AppFrame } from "../frame";
import { ThreadList, threadsFor } from "./thread-list";

export const metadata: Metadata = { title: "Conversations — NikahCanada" };

/* The tab with nothing selected.
 *
 * On a phone this is the whole screen — the list, and you tap through to
 * a thread. On a desktop the list is the middle pane and this fills the
 * third with an instruction rather than leaving it blank, because an
 * empty half-screen reads as something that failed to load.
 */
export default async function ConversationsPage() {
  const session = await currentUser();
  if (!session) redirect("/login?next=/conversations");

  const threads = await threadsFor(session.user.id);

  return (
    <AppFrame
      active="messages"
      width="wide"
      title="Conversations"
      list={<ThreadList threads={threads} />}
      phone="list"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-soft-green bg-mist/40 px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-[26px] text-accent-deep">
          <ChatIcon />
        </span>
        <p className="text-[18px] leading-[26px] text-text">
          {threads.length
            ? "Pick a conversation to read it."
            : "Nothing here yet. A conversation opens when a request is accepted and the wali approves it."}
        </p>
      </div>
    </AppFrame>
  );
}
