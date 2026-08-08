import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

/* Placeholders for the privacy policy and the terms.
 *
 * These exist because the sign-up form asks people to agree to both, and
 * a consent checkbox pointing at a 404 is not consent — it is a legal
 * problem, not a broken link. Quebec's Law 25 requires a published
 * policy naming a privacy officer, the purposes, the retention periods
 * and the transfer disclosures (APP-PLAN §10.2), and none of that has
 * been drafted or reviewed.
 *
 * So these pages say the one thing that is true — that the document is
 * not published yet — and give a way to ask. Nothing is invented here:
 * writing a plausible-looking policy for a real business handling
 * identity documents and immigration status would be worse than an
 * empty page, because people would rely on it.
 *
 * ⚠ LAUNCH BLOCKER. Both documents need counsel before the first real
 * registration. See docs/APP-PLAN.md §13.
 */

const DOCS = {
  privacy: {
    title: "Privacy Policy",
    lead: "How we collect, use, store and delete your information.",
  },
  terms: {
    title: "Terms and Conditions",
    lead: "The terms you agree to when you register with NikahCanada.",
  },
} as const;

type Doc = keyof typeof DOCS;

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const entry = DOCS[doc as Doc];
  return entry
    ? { title: `${entry.title} — NikahCanada`, robots: { index: false, follow: false } }
    : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = DOCS[doc as Doc];
  if (!entry) notFound();

  return (
    <main className="flex min-h-dvh flex-col items-center bg-mist px-5 py-16">
      <div className="w-full max-w-[640px] rounded-lg border border-soft-green bg-white p-6 sm:p-10">
        <h1 className="font-playfair text-[32px] font-bold leading-tight text-black">
          {entry.title}
        </h1>
        <p className="mt-2 text-[14px] leading-[22px] text-text">{entry.lead}</p>

        <div className="mt-8 rounded-md border border-peach/40 bg-soft-peach/60 px-4 py-4">
          <p className="text-[14px] font-semibold text-peach-deep">
            This document has not been published yet.
          </p>
          <p className="mt-2 text-[13px] leading-[20px] text-text">
            We would rather show you nothing than show you something we have not had reviewed.
            If you want to know how your information is handled before you register, ask us and
            we will tell you plainly.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/#contact"
            className="inline-flex h-12 items-center rounded-pill bg-peach px-6 text-[14px] font-semibold text-black"
          >
            Ask us
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center rounded-pill border-2 border-accent-deep px-6 text-[14px] font-semibold text-accent-deep"
          >
            Back to the site
          </Link>
        </div>
      </div>
    </main>
  );
}
