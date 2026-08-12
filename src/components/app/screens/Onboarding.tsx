import { AppBar, Btn, Chip, Field, Progress, Segmented } from "@/components/app/kit";
import { HomeBar } from "@/components/app/Phone";
import { Logo } from "@/components/brand/Logo";

/* 1 — Sign up. Gender is asked first because it determines whether a
   wali is required, and that shapes the rest of onboarding. */
export function SignUp() {
  return (
    <div className="flex h-full flex-col px-6 pb-10 pt-4">
      <Logo className="h-5" />

      <h3 className="mt-6 font-playfair text-[28px] font-bold leading-tight text-black">
        Create your account
      </h3>
      <p className="mt-2 text-[13px] leading-[19px] text-text">
        Registration is free. A photograph is not required, and your profile is never public.
      </p>

      <div className="mt-7 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            I am registering as
          </span>
          <Segmented options={["A brother", "A sister"]} active={1} />
          <span className="text-[11px] leading-[15px] text-peach-deep">
            Sisters register a wali in step four. He confirms before your profile goes live.
          </span>
        </div>

        <Field label="Email" value="fatima.a@email.com" />
        <Field label="Password" value="••••••••••" />
      </div>

      <label className="mt-6 flex items-start gap-3">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] bg-peach text-black">
          <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[12px] leading-[17px] text-text">
          I am seeking marriage, and I understand this service is for nikah only.
        </span>
      </label>

      <div className="mt-auto flex flex-col gap-4">
        <Btn>Continue</Btn>
        <p className="text-center text-[12px] text-text">
          Already registered? <span className="font-semibold text-peach-deep">Sign in</span>
        </p>
      </div>

      <HomeBar />
    </div>
  );
}

/* 2 — Profile builder. Shown at the deen step because it is the part
   that distinguishes this from a generic sign-up form. */
export function ProfileDeen() {
  return (
    <div className="flex h-full flex-col pb-10">
      <Progress step={3} total={5} />
      <AppBar title="Your deen" sub="This is the part matches read first. Answer honestly." />

      <div className="flex flex-1 flex-col gap-6 px-6">
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Salah
          </span>
          <Segmented options={["Five daily", "Most", "Learning"]} active={0} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Dress
          </span>
          <div className="flex flex-wrap gap-2">
            <Chip tone="selected">Hijab</Chip>
            <Chip>Niqab</Chip>
            <Chip>Modest, no hijab</Chip>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Madhhab
          </span>
          <div className="flex flex-wrap gap-2">
            <Chip>Hanafi</Chip>
            <Chip tone="selected">Shafi&apos;i</Chip>
            <Chip>Maliki</Chip>
            <Chip>Hanbali</Chip>
            <Chip>Not specified</Chip>
          </div>
        </div>

        <Field label="Qur'an" value="Three juz memorised" />

        <Field
          label="Anything else"
          placeholder="Optional — in your own words"
          hint="Shared with matches, never made public."
        />
      </div>

      <div className="flex gap-3 px-6">
        <Btn variant="ghost" className="w-24">
          Back
        </Btn>
        <Btn className="flex-1">Continue</Btn>
      </div>

      <HomeBar />
    </div>
  );
}

/* 3 — Wali registration. The whole product hinges on this step, so it
   explains itself rather than presenting four bare fields. */
export function WaliSetup() {
  return (
    <div className="flex h-full flex-col pb-10">
      <Progress step={4} total={5} />
      <AppBar title="Register your wali" />

      <div className="flex flex-1 flex-col gap-4 px-6">
        <div className="flex flex-col gap-1.5 rounded-md border border-peach/30 bg-soft-peach/60 p-3.5">
          <span className="text-[13px] font-semibold text-peach-deep">He will be able to:</span>
          <ul className="flex flex-col gap-1.5 text-[12px] leading-[17px] text-black/75">
            <li>· See every connection you send or accept</li>
            <li>· Read every message you exchange</li>
            <li>· Approve or decline before any conversation opens</li>
            <li>· End a conversation at any point</li>
          </ul>
        </div>

        <Field label="Wali's full name" value="Ahmed Al-Rashid" />

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Relationship
          </span>
          <div className="flex flex-wrap gap-2">
            <Chip tone="selected">Father</Chip>
            <Chip>Brother</Chip>
            <Chip>Paternal uncle</Chip>
            <Chip>Appointed</Chip>
          </div>
        </div>

        <Field label="Mobile" value="+1 514 555 0148" />
        <Field
          label="Email"
          value="a.alrashid@email.com"
          hint="He confirms by email before your profile goes live."
        />
      </div>

      <div className="px-6">
        <Btn>Send invitation</Btn>
      </div>

      <HomeBar />
    </div>
  );
}
