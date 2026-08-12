"use client";

/* Keeps a half-filled form across a refresh.
 *
 * Registration asks for a name, a date of birth, an email and two
 * agreements before the server has anything to hold on to, and the
 * profile steps ask for several paragraphs. A reload — a stray Ctrl-R,
 * a back button, a phone waking a tab up — emptied all of it, and
 * someone made to type their answers a second time often does not.
 *
 * Where it goes: sessionStorage, not localStorage. That survives a
 * refresh, the back button and a tab restore, and dies when the tab
 * closes. It is the shortest lifetime that solves the problem, and the
 * registration form holds a legal name and a date of birth on what may
 * well be a shared family computer.
 *
 * What it never holds: passwords, hidden fields, file inputs. Anything
 * in web storage is plain text that any script on the page can read,
 * and not retyping a password is not worth that.
 */

import { useCallback, useEffect, useRef } from "react";

type Saved = { t: number; f: Record<string, string[]> };

const key = (name: string) => `nc.draft.${name}`;

/* A draft is a convenience for the person who is still on the page. One
 * left behind for half a day is stale, and stale answers restored under
 * someone who does not remember typing them are worse than blank ones. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

const SKIP = new Set(["password", "hidden", "file", "submit", "button", "reset", "image"]);

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function controls(form: HTMLFormElement): Control[] {
  return Array.from(form.elements).filter((el): el is Control => {
    if (
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLTextAreaElement) &&
      !(el instanceof HTMLSelectElement)
    ) {
      return false;
    }
    if (!el.name || el.disabled) return false;
    return !(el instanceof HTMLInputElement && SKIP.has(el.type));
  });
}

function read(form: HTMLFormElement): Record<string, string[]> {
  const f: Record<string, string[]> = {};
  for (const el of controls(form)) {
    /* Recorded even when nothing is ticked, so that clearing a box is
       itself remembered rather than read back as "no answer yet". */
    const into = (f[el.name] ??= []);

    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      if (el.checked) into.push(el.value);
    } else if (el instanceof HTMLSelectElement && el.multiple) {
      for (const o of Array.from(el.selectedOptions)) into.push(o.value);
    } else {
      into.push(el.value);
    }
  }
  return f;
}

function apply(form: HTMLFormElement, f: Record<string, string[]>) {
  for (const el of controls(form)) {
    const saved = f[el.name];
    if (!saved) continue;

    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      el.checked = saved.includes(el.value);
    } else if (el instanceof HTMLSelectElement && el.multiple) {
      for (const o of Array.from(el.options)) o.selected = saved.includes(o.value);
    } else if (saved[0] !== undefined) {
      el.value = saved[0];
    }
  }
}

/** Drop inside a `<form>`. `name` scopes the draft — include the user id
 *  on anything behind sign-in, so two people sharing a browser tab never
 *  meet each other's answers. */
export function FormDraft({ name }: { name: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const form = useRef<HTMLFormElement | null>(null);
  /* Set when the form is sent, cleared the moment anyone touches a field
     again. See the note on the unmount effect below. */
  const sent = useRef(false);

  const save = useCallback(() => {
    if (!form.current) return;
    const body: Saved = { t: Date.now(), f: read(form.current) };
    /* Private browsing and a full quota both throw here. Losing the
       draft is the outcome we already had; it must not take the form
       down with it. */
    try {
      sessionStorage.setItem(key(name), JSON.stringify(body));
    } catch {}
  }, [name]);

  const restore = useCallback((el: HTMLFormElement) => {
    try {
      const raw = sessionStorage.getItem(key(name));
      const saved: Saved | null = raw ? JSON.parse(raw) : null;
      if (saved && Date.now() - saved.t < MAX_AGE_MS) apply(el, saved.f);
      else if (saved) sessionStorage.removeItem(key(name));
    } catch {
      /* Corrupt or unreadable. Leave the form as the server rendered it. */
    }
  }, [name]);

  /* Restore, then follow. Restoring has to wait for the effect rather
     than happening in render: the server has no sessionStorage, so a
     value put in during render is a value React finds missing when it
     hydrates. */
  useEffect(() => {
    const el = anchor.current?.closest("form");
    if (!el) return;
    form.current = el;
    restore(el);

    /* React empties an uncontrolled form after every action, including
       one the server rejected. Most fields land back on what the server
       echoed, because React writes that into the defaults — but a
       `<select>` does not: its default is fixed at mount, so a reset
       sends it back to "Choose…" and the person is told to check a
       month they can no longer see. The draft is the better authority
       anyway. It holds what they typed rather than what survived the
       round trip, so put all of it back.
       The event fires before the clearing, hence the deferral. */
    const reset = () => {
      setTimeout(() => restore(el), 0);
    };
    el.addEventListener("reset", reset);

    /* `input` covers typing, `change` covers the boxes and pickers that
       do not fire it in every browser. */
    const edited = () => {
      sent.current = false;
      save();
    };
    const submitted = () => {
      sent.current = true;
    };
    el.addEventListener("input", edited);
    el.addEventListener("change", edited);
    el.addEventListener("submit", submitted);
    return () => {
      el.removeEventListener("reset", reset);
      el.removeEventListener("input", edited);
      el.removeEventListener("change", edited);
      el.removeEventListener("submit", submitted);
    };
  }, [name, save, restore]);

  /* Nothing here watches the submission itself, and that is deliberate.
     An earlier version refreshed the draft when `useFormStatus`'s
     `pending` went false — to pick up the values a rejected submission
     re-renders — and on Next 15.5 / React 19 that reliably stopped the
     *next* submission's redirect from ever happening: the account was
     created and the browser stayed on the form. It bought nothing
     either, since the draft already holds everything the server echoes
     back. Bisected against `scripts/draft-check.cjs`; leave it out.

     Nobody tells a form that it worked: success navigates away, failure
     re-renders in place, and by the time this unmounts the pending flag
     has already gone. What separates the two is what happened last — a
     send with no editing after it, which is how a form that was accepted
     leaves the screen. Anything else (following a link, going back) has
     an untouched draft behind it and leaves it alone.
     Note that a refresh does not run this: the browser discards the page
     without React getting a say, which is exactly what we want. */
  useEffect(
    () => () => {
      if (!sent.current) return;
      try {
        sessionStorage.removeItem(key(name));
      } catch {}
    },
    [name]
  );

  return <span ref={anchor} hidden />;
}
