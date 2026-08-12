"use client";

import { useState } from "react";
import Image from "next/image";
import { ART, contact } from "@/content/home";
import { Lead, SectionHeading } from "./primitives/Type";
import { PillButton } from "./primitives/PillButton";
import { Reveal } from "./primitives/Reveal";
import { Twinkle } from "./primitives/Twinkle";
import { Envelope, MapPin, PhoneVolume, User } from "./primitives/Icons";
import { Field, SelectField, TextArea } from "./primitives/Field";
import { RuledPaper } from "./primitives/Decor";

/* Contact us — the page's only form, and no longer where registration
   happens: every "Register Now" now goes to /register, which is the real
   thing. This is for people who want to ask something first, so
   Registration stays in the subject select but the form is general.

   The template posted to a contact-form.php. There is no endpoint here
   yet, so this validates natively, acknowledges locally and sends
   nothing — wire `onSubmit` to a real handler before this goes live.
   ⚠ Until then this form silently drops what people write in it.

   A picture is deliberately not asked for: the live site is explicit that
   one is not required at registration. */
export function ContactForm() {
  const [sent, setSent] = useState(false);
  const f = contact.fields;

  return (
    <section
      id="contact"
      className="relative overflow-hidden bg-mist py-20 sm:py-28 xl:pb-[296px] xl:pt-[160px]"
    >
      <Twinkle
        src={`${ART}/categories-img1.png`}
        width={139}
        height={100}
        className="pointer-events-none absolute right-[50px] top-[110px] z-[1] hidden xl:block"
      />

      <div className="shell-b">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-[30px]">
          <Image
            src={contact.image.src}
            alt={contact.image.alt}
            width={contact.image.w}
            height={contact.image.h}
            sizes="(max-width: 1023px) 100vw, 540px"
            className="h-auto w-full rounded-bl-[50px] rounded-tr-[100px] object-cover"
          />

          <Reveal className="relative text-center">
            <RuledPaper />
            <Image
              src={`${ART}/categories-logo-img.png`}
              alt=""
              width={150}
              height={94}
              aria-hidden
              className="mx-auto mb-6 h-auto w-[110px] xl:mb-[27px] xl:w-[150px]"
            />
            <SectionHeading className="mb-5 xl:mb-[23px]">{contact.title}</SectionHeading>
            <Lead className="mb-7 px-2 xl:mb-[35px] xl:px-5">{contact.body}</Lead>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
              className="text-left"
            >
              <div className="grid gap-[33px_30px] sm:grid-cols-2">
                <Field icon={<User />} type="text" name="name" placeholder={f.name} required />
                <Field icon={<Envelope />} type="email" name="email" placeholder={f.email} required />
                <Field icon={<PhoneVolume />} type="tel" name="phone" placeholder={f.phone} required />
                <Field icon={<MapPin />} type="text" name="city" placeholder={f.city} required />
              </div>

              <div className="mt-[33px]">
                <SelectField
                  name="subject"
                  placeholder={f.subject}
                  options={contact.subjectOptions}
                />
              </div>

              <div className="mt-[33px]">
                <TextArea name="message" placeholder={f.message} aria-label={f.message} />
              </div>

              <div className="mt-[31px] text-center">
                <PillButton type="submit" variant="submit">
                  {contact.submit}
                </PillButton>
                <p
                  role="status"
                  className={
                    "mt-4 font-jost text-[15px] text-text transition-opacity " +
                    (sent ? "opacity-100" : "opacity-0")
                  }
                >
                  {contact.sentNote}
                </p>
              </div>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
