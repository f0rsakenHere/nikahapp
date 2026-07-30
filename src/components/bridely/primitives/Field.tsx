import type { ReactNode } from "react";

/* Form controls, at the template's measured values: 60px tall, 24px radius,
   1px mint hairline, a soft #dae0e5 glow, and 43px of left padding.

   The template put the icon at left:35px, but measured from the form-group
   — 15px outside the input — so it landed 20px inside the field. Copying
   the 35px literally onto the input pushes the icon under the placeholder,
   so the offset is 20px here. */
const SHARED =
  "w-full rounded-[24px] border border-accent bg-white " +
  "shadow-[0_6px_38px_0_#dae0e5] font-jost text-[14px] font-light " +
  "text-black placeholder:text-form-text " +
  "outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-peach";

const CONTROL = `h-[60px] ${SHARED}`;

export function Field({
  icon,
  ...props
}: { icon?: ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {icon ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[16px] text-accent"
        >
          {icon}
        </span>
      ) : null}
      <input
        {...props}
        className={`${CONTROL} ${icon ? "px-[43px]" : "px-5"}`}
      />
    </div>
  );
}

export function SelectField({
  icon,
  placeholder,
  options,
  name,
}: {
  icon?: ReactNode;
  placeholder: string;
  options: string[];
  name: string;
}) {
  return (
    <div className="relative">
      {icon ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[16px] text-accent"
        >
          {icon}
        </span>
      ) : null}
      <select
        name={name}
        defaultValue=""
        aria-label={placeholder.trim()}
        className={`${CONTROL} appearance-none ${icon ? "px-[43px]" : "px-5"} text-form-text`}
      >
        <option value="">{placeholder}</option>
        {options.map((o, i) => (
          <option key={`${o}-${i}`} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-[28px] top-1/2 -translate-y-1/2 text-[10px] text-accent"
      >
        ▼
      </span>
    </div>
  );
}

/* Multi-line, for the contact message. Same skin as the single-line
   controls; the radius softens because a 24px pill on a tall box reads
   as a mistake. */
export function TextArea({
  icon,
  ...props
}: { icon?: ReactNode } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="relative">
      {icon ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-5 top-[22px] text-[16px] text-accent"
        >
          {icon}
        </span>
      ) : null}
      <textarea
        {...props}
        rows={4}
        className={`${SHARED} resize-y rounded-[20px] py-4 ${icon ? "px-[43px]" : "px-5"}`}
      />
    </div>
  );
}
