"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current";
import { getSubscription, paypalIsConfigured } from "@/lib/payments/paypal";
import { linkSubscription } from "@/lib/repositories/subscriptions";

/** Ties a subscription the member just approved to their account.
 *
 *  This does **not** grant the membership. The webhook does that, and
 *  only after PayPal has signed for it. All this does is write down
 *  which subscription belongs to whom, so that the renewal payments —
 *  which name the subscription and not the subscriber — can be matched
 *  later even if `custom_id` were ever lost.
 *
 *  So the worst that a lie here can achieve is pointing somebody's own
 *  account at a subscription id. It is still checked against PayPal
 *  first: a member who sends somebody else's subscription id would
 *  otherwise attach themselves to a stranger's payments and collect
 *  their renewals. */
export async function recordSubscription(
  subscriptionId: string
): Promise<{ ok?: true; error?: string }> {
  const session = await currentUser();
  if (!session) return { error: "Please sign in again." };
  if (!paypalIsConfigured()) return { error: "Payments are not switched on." };

  if (!/^I-[A-Z0-9]{6,30}$/.test(subscriptionId)) {
    return { error: "That is not a subscription." };
  }

  try {
    const sub = await getSubscription(subscriptionId);

    /* The subscription must say it belongs to this member. PayPal is
       the authority on that, not the browser that called us. */
    if (sub.custom_id && sub.custom_id !== session.user.id) {
      return { error: "That subscription belongs to another account." };
    }

    await linkSubscription(session.user.id, subscriptionId);
    revalidatePath("/membership");
    return { ok: true };
  } catch {
    /* The payment itself may be perfectly fine — this is our own
       bookkeeping, and the webhook will arrive regardless. Say
       something true rather than implying the money failed. */
    return { error: "We could not confirm that with PayPal just now. Your payment is unaffected." };
  }
}
