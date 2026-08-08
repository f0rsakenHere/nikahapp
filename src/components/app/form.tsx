"use client";

/* Interactive form parts.
 *
 * Separate from `kit.tsx` on purpose. The kit's `Field`, `Segmented` and
 * `Btn` render *pictures* of controls — they take a `value` string and
 * draw it, because they exist to be photographed inside a phone frame on
 * /how-it-works. Those screens have to stay frozen and always perfect
 * (§4.4). These are the real controls, sharing the same visual language.
 */
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

const CONTROL =
  "h-12 w-full rounded-md border border-soft-green bg-white px-3.5 text-[15px] text-black " +
  "outline-none transition-colors placeholder:text-text/45 focus:border-accent-deep";

const LABEL = "text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70";

export function TextField({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  hint,
  error,
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "date";
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const describedBy = [error && `${name}-error`, hint && `${name}-hint`]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`${CONTROL} ${error ? "border-peach-deep" : ""}`}
      />
      {hint ? (
        <span id={`${name}-hint`} className="text-[11px] leading-[15px] text-text/70">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${name}-error`} className="text-[11px] leading-[15px] text-peach-deep">
          {error}
        </span>
      ) : null}
    </label>
  );
}

/** Radio group styled as the kit's segmented control.
 *
 *  Radios rather than a hidden input plus click handlers: this is the
 *  answer that decides whether a wali is required, so it must work with
 *  a keyboard, with a screen reader, and with JavaScript unavailable. */
export function ChoiceField({
  legend,
  name,
  options,
  defaultValue,
  hint,
  error,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={LABEL}>{legend}</legend>
      <div className="mt-2 flex gap-1 rounded-pill bg-soft-green/60 p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex-1 cursor-pointer rounded-pill text-center transition-colors hover:bg-white/60 has-[:checked]:bg-accent has-[:checked]:hover:bg-accent"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              className="peer sr-only"
            />
            <span className="block rounded-pill py-2 text-[13px] font-semibold text-text peer-checked:text-black peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#141212]">
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {/* Neutral, not peach. Peach is the error colour, and a hint set in
          it reads as a complaint about something the reader has not done
          yet — then stacks a second peach line under it when a real
          error appears, and neither one looks like the important one. */}
      {hint ? <span className="text-[11px] leading-[15px] text-text/70">{hint}</span> : null}
      {error ? (
        <span className="text-[11px] leading-[15px] text-peach-deep">{error}</span>
      ) : null}
    </fieldset>
  );
}

export function CheckboxField({
  name,
  children,
  error,
  defaultChecked,
}: {
  name: string;
  children: ReactNode;
  error?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="mt-0.5 h-5 w-5 shrink-0 rounded-[6px] border border-soft-green accent-peach"
        />
        <span className="text-[13px] leading-[19px] text-text">{children}</span>
      </label>
      {error ? (
        <span className="ml-8 text-[11px] leading-[15px] text-peach-deep">{error}</span>
      ) : null}
    </div>
  );
}

/** Disables itself while the action is in flight, so a slow connection
 *  cannot produce two accounts from one impatient person. */
export function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-pill bg-peach text-[14px] font-semibold text-black transition-opacity disabled:opacity-60"
    >
      {pending ? "One moment…" : children}
    </button>
  );
}

export function FormError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-peach/40 bg-soft-peach/60 px-3.5 py-3 text-[13px] leading-[19px] text-peach-deep"
    >
      {children}
    </p>
  );
}
