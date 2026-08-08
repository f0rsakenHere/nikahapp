"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type FormState } from "@/lib/auth/actions";
import {
  CheckboxField,
  ChoiceField,
  FormError,
  SubmitButton,
  TextField,
} from "@/components/app/form";

const EMPTY: FormState = {};

export function RegisterForm() {
  const [state, action] = useActionState(register, EMPTY);
  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormError>{e._form}</FormError>

      {/* First, because it decides whether a wali is required and
          therefore the shape of everything after this screen (§5.2 —
          gender is set here once and is immutable afterwards). */}
      <ChoiceField
        legend="I am registering as"
        name="gender"
        defaultValue={v.gender}
        options={[
          { value: "brother", label: "A brother" },
          { value: "sister", label: "A sister" },
        ]}
        hint="Sisters register a wali during onboarding. He confirms before your profile goes live."
        error={e.gender}
      />

      <div className="flex gap-3">
        <div className="flex-1">
          <TextField
            label="First name"
            name="firstName"
            defaultValue={v.firstName}
            autoComplete="given-name"
            error={e.legalName}
          />
        </div>
        <div className="flex-1">
          <TextField
            label="Last name"
            name="lastName"
            defaultValue={v.lastName}
            autoComplete="family-name"
          />
        </div>
      </div>

      <TextField
        label="Date of birth"
        name="dateOfBirth"
        type="date"
        defaultValue={v.dateOfBirth}
        autoComplete="bday"
        hint="You must be 18 or older. Only your age range is ever shown to anyone."
        error={e.dateOfBirth}
      />

      <TextField
        label="Email"
        name="email"
        type="email"
        defaultValue={v.email}
        autoComplete="email"
        error={e.email}
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters. A short sentence you will remember is stronger than a short word."
        error={e.password}
      />

      <div className="flex flex-col gap-3 border-t border-soft-green pt-5">
        <CheckboxField name="marriageIntention" error={e.acceptedMarriageIntention}>
          I am seeking marriage, and I understand this service is for nikah only.
        </CheckboxField>

        <CheckboxField name="terms" error={e.acceptedTerms}>
          I agree to the{" "}
          <Link href="/legal/privacy" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
            privacy policy
          </Link>{" "}
          and{" "}
          <Link href="/legal/terms" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
            terms
          </Link>
          .
        </CheckboxField>
      </div>

      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
