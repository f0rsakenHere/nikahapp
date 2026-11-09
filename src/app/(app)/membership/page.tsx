import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { findUserById } from "@/lib/repositories/users";
import { readSettings } from "@/lib/repositories/connections";
import { hasActivePlan } from "@/lib/domain/plan";
import { paypalIsConfigured, planIdFor } from "@/lib/payments/paypal";
import { AppFrame } from "../frame";
import { Subscribe } from "./subscribe";

/* Membership.
 *
 * Everything up to the conversation is free, so this page exists for
 * one moment: somebody is talking to a match, has used the free
 * messages, and wants to carry on. It says what it costs, what is
 * already free, and offers the button — and nothing else. A page that
 * sells at somebody in the middle of that conversation would be badly
 * judged.
 */

export const metadata = { title: "Membership" };

const PRICE = { sister: "9.99", brother: "19.99" } as const;

export default async function MembershipPage() {
  const session = await currentUser();
  if (!session) redirect("/login?next=/membership");

  const me = await findProfileByUserId(session.user.id);
  if (!me) redirect(session.user.roles.includes("wali") ? "/wali" : "/register");

  const user = await findUserById(session.user.id);
  const settings = await readSettings();
  const now = new Date();

  const active = user ? hasActivePlan(user, now) : false;
  const until = user?.planActiveUntil ?? null;
  const gender = me.gender as "brother" | "sister";
  const planId = planIdFor(gender);
  const clientId = process.env.PAYPAL_CLIENT_ID ?? null;
  const ready = paypalIsConfigured() && Boolean(planId) && Boolean(clientId);

  /* Charging may be switched off entirely, in which case saying
     "membership required" would be a lie about the product. */
  const gateOn = settings.planGate !== "nobody";

  return (
    <AppFrame active="profile" title="Membership">
      {active && until ? (
        <section className="rounded-md border border-soft-green bg-mist px-4 py-4">
          <p className="text-[18px] leading-[26px] text-black">
            Your membership is active until{" "}
            <strong className="font-semibold">
              {until.toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" })}
            </strong>
            . It renews by itself, and you can stop it any time from your PayPal account — you keep
            the month you have paid for.
          </p>
        </section>
      ) : (
        <>
          <p className="text-[18px] leading-[26px] text-text">
            {gateOn
              ? "Your profile, the pool, asking to talk and answering somebody who asks are free, and stay free. Membership covers the messages, once the first three in a conversation are used."
              : "Membership is not required at the moment — every part of the site is open. You can still subscribe, and your membership will simply be waiting when it is needed."}
          </p>

          <section className="mt-5 rounded-md border border-soft-green bg-white px-4 py-5 shadow-app">
            <p className="font-manrope text-[22px] font-bold text-black">
              ${PRICE[gender]}{" "}
              <span className="text-[18px] font-medium text-text">CAD a month</span>
            </p>
            <p className="mt-1 text-[18px] leading-[26px] text-text">
              {gender === "sister" ? "Membership for sisters." : "Membership for brothers."} Renews
              monthly until you stop it.
            </p>

            <div className="mt-4">
              {ready ? (
                <Subscribe clientId={clientId!} planId={planId!} userId={session.user.id} />
              ) : (
                /* Said plainly rather than shown as a button that fails.
                   This is the state on any deployment without the keys,
                   which includes every developer's laptop. */
                <p className="rounded-md bg-mist px-4 py-3 text-[18px] leading-[26px] text-text">
                  Payments are not switched on yet. Nothing is owed, and nothing on the site is
                  closed to you.
                </p>
              )}
            </div>
          </section>

          <p className="mt-4 text-[18px] leading-[26px] text-text/70">
            Payment is handled by PayPal. We never see your card.
          </p>
        </>
      )}
    </AppFrame>
  );
}
