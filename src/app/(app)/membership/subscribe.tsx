"use client";

import { useEffect, useRef, useState } from "react";
import { recordSubscription } from "./actions";

/* The PayPal button.
 *
 * PayPal's own script draws it and runs the approval window; nothing
 * here touches a card number, which is the point of using them. What we
 * do is tell PayPal which plan and who it is for, and then hand the
 * subscription id to our server.
 *
 * `custom_id` is the important part. It travels with the subscription
 * and comes back on every webhook about it for the rest of its life,
 * which is how a renewal payment eighteen months from now is matched to
 * a member without depending on a row we wrote today.
 *
 * The server is told as soon as the window closes, but the webhook is
 * what actually grants the membership. That ordering is deliberate:
 * this callback runs in a browser that can be closed, throttled or
 * lying, and the webhook is signed.
 */

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: unknown) => { render: (el: HTMLElement) => Promise<void> };
    };
  }
}

type State = "loading" | "ready" | "approving" | "done" | "failed";

export function Subscribe({
  clientId,
  planId,
  userId,
}: {
  clientId: string;
  planId: string;
  /** Sent to PayPal as `custom_id`. The member's own id, which they
   *  already hold a session for — nothing secret, and nothing another
   *  member could use. */
  userId: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  /* Rendered once. React in development mounts effects twice, and
     PayPal draws a second button inside the same box when it does. */
  const drawn = useRef(false);

  useEffect(() => {
    if (drawn.current) return;

    const src =
      "https://www.paypal.com/sdk/js?" +
      new URLSearchParams({
        "client-id": clientId,
        vault: "true",
        intent: "subscription",
        currency: "CAD",
      });

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const script = existing ?? document.createElement("script");

    const draw = () => {
      if (drawn.current || !box.current || !window.paypal) return;
      drawn.current = true;
      window.paypal
        .Buttons({
          style: { shape: "pill", color: "gold", layout: "vertical", label: "subscribe" },
          createSubscription: (_data: unknown, actions: {
            subscription: { create: (o: unknown) => Promise<string> };
          }) =>
            actions.subscription.create({
              plan_id: planId,
              /* Travels with the subscription and comes back on every
                 webhook about it, including renewal payments years
                 from now, which name the subscription and not the
                 subscriber. */
              custom_id: userId,
            }),
          onApprove: async (data: { subscriptionID?: string }) => {
            setState("approving");
            const id = data.subscriptionID;
            if (!id) {
              setState("failed");
              setError("PayPal did not return a subscription.");
              return;
            }
            const result = await recordSubscription(id);
            if (result.error) {
              /* The money side may well have succeeded — this only
                 failed to write our own row, and the webhook will put
                 it right. Say so rather than implying the payment
                 failed. */
              setState("done");
              setError(result.error);
              return;
            }
            setState("done");
          },
          onError: (e: unknown) => {
            setState("failed");
            setError(e instanceof Error ? e.message : "PayPal could not complete that.");
          },
          onCancel: () => setState("ready"),
        })
        .render(box.current)
        .then(() => setState("ready"))
        .catch(() => {
          setState("failed");
          setError("The PayPal button could not be drawn.");
        });
    };

    if (existing && window.paypal) {
      draw();
      return;
    }
    script.src = src;
    script.async = true;
    script.onload = draw;
    script.onerror = () => {
      setState("failed");
      setError("PayPal's script could not be loaded.");
    };
    if (!existing) document.body.appendChild(script);
  }, [clientId, planId, userId]);

  if (state === "done") {
    return (
      <div className="rounded-md border border-soft-green bg-mist px-4 py-4">
        <p className="text-[18px] leading-[26px] text-black">
          <strong className="font-semibold">Thank you.</strong> Your membership is being confirmed
          with PayPal. It usually takes a few seconds — reload this page and it will say when it
          runs to.
        </p>
        {error ? <p className="mt-2 text-[18px] leading-[26px] text-text/70">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <div ref={box} />
      {state === "loading" ? (
        <p className="text-[18px] leading-[26px] text-text/70">Loading PayPal…</p>
      ) : null}
      {state === "approving" ? (
        <p className="mt-2 text-[18px] leading-[26px] text-text">One moment…</p>
      ) : null}
      {state === "failed" && error ? (
        <p role="alert" className="mt-2 text-[18px] leading-[26px] text-peach-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
