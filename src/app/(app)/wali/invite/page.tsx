import Link from "next/link";
import type { Metadata } from "next";
import { readInvitation } from "@/lib/guardianship/actions";
import { AuthShell } from "../../auth-shell";
import { InvitationForm } from "./form";

export const metadata: Metadata = {
  title: "You have been asked to act as a wali — NikahCanada",
  robots: { index: false, follow: false },
};

const RELATIONSHIP_TO_HER: Record<string, string> = {
  father: "her father",
  grandfather: "her grandfather",
  brother: "her brother",
  uncle: "her uncle",
  sonOfBrother: "her brother's son",
  imam: "the imam of her masjid",
  other: "her wali",
};

/* Public, and deliberately so. He is not a member, has no account, and
 * is very likely an older man opening a link on a phone. Every step
 * between the email and this page is a reason for him not to arrive —
 * and if he does not, her profile never goes live. */
export default async function WaliInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invitation = await readInvitation(token ?? "");

  if (!invitation.ok) {
    const blurb = {
      unknown: "We do not recognise this link. Check that you copied all of it from the email.",
      expired: "This invitation has expired. Ask her to send you another.",
      "already-answered": "This invitation has already been answered.",
    }[invitation.reason];

    return (
      <AuthShell title="That link did not work" blurb={blurb}>
        <Link
          href="/"
          className="grid h-12 place-items-center rounded-pill border-2 border-accent-deep text-[18px] font-semibold text-accent-deep"
        >
          About NikahCanada
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`${invitation.memberFirstName} has named you as her wali`}
      /* Her first name only, until he accepts. If she mistyped his
       * address, a stranger learns that someone called Fatima is seeking
       * marriage — recoverable. Her full name would not be. */
      blurb={`She recorded you as ${RELATIONSHIP_TO_HER[invitation.relationship] ?? "her wali"}. Her profile does not go live until you confirm.`}
    >
      <InvitationForm
        token={token ?? ""}
        waliName={invitation.waliName}
        hasAccount={invitation.hasAccount}
      />
    </AuthShell>
  );
}
