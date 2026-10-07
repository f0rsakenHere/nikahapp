/* ============================================================
   HOW IT WORKS - page copy.

   Rewritten to the product as it actually runs. What stood here
   described a service with six published steps, two of which do not
   exist: a matchmaking fee charged to both sides, and an exchange of
   names and contact details at the end. Neither is built, and the page
   also claimed identity and reference checks nobody performs, a wali
   who approves each match, a referral service, and a five-step profile.

   What is true today, and what this page now says:

     - Registering is free and asks for no photograph.
     - The address is confirmed by email, and a profile cannot be sent
       in until it has been.
     - A brother fills in three steps; a sister four, the fourth being
       her wali, who confirms by email before her profile goes live.
     - Everybody browses, and sending an interest is free, with a cap of
       five a week.
     - When both sides have said yes a conversation opens, and a
       sister's wali receives a copy of it. He does not approve it.

   Money is the one thing this page does not settle: /pricing sells
   connection packages, the code charges a brother from his fourth
   message in a conversation, and the charging is switched off. Until
   those agree, this page points at /pricing rather than describing a
   model of its own.
   ============================================================ */

export const intro = {
  eyebrow: "How it works",
  title: "Three steps, and a wali where one belongs.",
  body:
    "The same three steps the homepage names, in full: what each one asks of you, what happens " +
    "between them, and the screens a member and her wali actually see.",
};

/* The three steps, worded exactly as the homepage words them. Two pages
   describing the same service with different step counts is the kind of
   thing a reader notices and nobody else does. */
export const spine = [
  {
    n: "01",
    label: "Create your profile for free",
    note: "Three steps, four for a sister. Confirm your email and send it in.",
  },
  {
    n: "02",
    label: "Search for a compatible spouse",
    note: "Browse the pool, and narrow it by age and province.",
  },
  {
    n: "03",
    label: "Express interest and connect",
    note: "Free to ask, five a week. When it is mutual, you talk.",
  },
];

export type ScreenSpec = {
  id: string;
  step: string;
  label: string;
  what: string;
  pins: { n: number; x: number; y: number; text: string }[];
};

export const stages: {
  eyebrow: string;
  title: string;
  body: string;
  screens: ScreenSpec[];
}[] = [
  {
    eyebrow: "Step 01",
    title: "Joining, and naming a wali",
    body:
      "Registering is free and asks for no photograph. What it does ask for, before anything " +
      "else, is whether you are a brother or a sister, because that decides whether a guardian " +
      "is part of what follows. The profile saves as you go, and a link sent to your address has " +
      "to be opened before it can be sent in.",
    screens: [
      {
        id: "signup",
        step: "Step 01",
        label: "Creating an account",
        what:
          "The account is created with an email and an intention. Gender is asked first because it " +
          "decides the shape of everything that follows.",
        pins: [
          { n: 1, x: 0, y: 18, text: "No photograph is requested here or anywhere later." },
          { n: 2, x: 0, y: 38, text: "Choosing “A sister” adds the wali step. A brother has three steps and names nobody." },
          { n: 3, x: 0, y: 74, text: "The marriage-only intention is agreed here, in plain words, not buried in terms." },
        ],
      },
      {
        id: "profile",
        step: "Step 01",
        label: "Building the profile",
        what:
          "Three steps for a brother, four for a sister. This is the third, how you practise, which " +
          "is the section a match reads before anything else.",
        pins: [
          { n: 1, x: 0, y: 9, text: "Progress is always visible, and the profile can be finished across several sittings." },
          { n: 2, x: 0, y: 28, text: "Salah and dress are structured fields, so browsing can genuinely use them." },
          { n: 3, x: 0, y: 80, text: "Free text is optional and shared only inside the service, never published." },
        ],
      },
      {
        id: "wali",
        step: "Step 01",
        label: "Registering the wali",
        what:
          "Shown to sisters only. His details are taken and he is emailed an invitation. Her profile " +
          "does not enter the pool until he confirms.",
        pins: [
          { n: 1, x: 0, y: 22, text: "What he will see and be able to do is spelled out before a single detail is asked for." },
          { n: 2, x: 0, y: 62, text: "The relationship is recorded, so a match can see who the wali actually is." },
          { n: 3, x: 0, y: 88, text: "He confirms by email. Until then she appears to nobody, and cannot ask anybody either." },
        ],
      },
    ],
  },
  {
    eyebrow: "Step 02",
    title: "Browsing, and asking to talk",
    body:
      "Everybody can look through the pool, and be looked through in turn. Sending an interest is " +
      "free; what is deliberately limited is how many people you may approach in a week, so the " +
      "pace stays considered rather than endless. A photograph exists in the interface only as a " +
      "locked slot.",
    screens: [
      {
        id: "browse",
        step: "Step 02",
        label: "Browsing the pool",
        what:
          "The home screen. Looking and asking are both free; what is bounded is how many people you " +
          "may approach in a week.",
        pins: [
          { n: 1, x: 0, y: 10, text: "The pool is closed. Nothing here is visible from outside the service, and nothing is indexed." },
          { n: 2, x: 100, y: 21, text: "What is left this week, always visible. Asking is free; the number of people you approach is what is limited." },
          { n: 3, x: 0, y: 34, text: "Members appear as initials only. No names and no photographs on this screen." },
        ],
      },
      {
        id: "detail",
        step: "Step 02",
        label: "Reading a profile",
        what:
          "Everything needed to make a decision is present except the photograph: deen, family, " +
          "education, work, and what he says about himself.",
        pins: [
          { n: 1, x: 0, y: 24, text: "The photo slot is visible but locked, with the rule written on it rather than hidden in a policy." },
          { n: 2, x: 0, y: 80, text: "Nothing on the card is anything but what the member answered themselves." },
          { n: 3, x: 100, y: 93, text: "“Ask to talk” carries no message. There is nothing to write until the other side has said yes." },
        ],
      },
      {
        id: "mutual",
        step: "Step 03",
        label: "When an interest is accepted",
        what:
          "Both sides have said yes, so the conversation opens. A sister's wali is in it from the " +
          "first message, and the screen says so rather than leaving anybody to guess.",
        pins: [
          { n: 1, x: 0, y: 22, text: "Nothing has been shared yet. Names and contact details stay private." },
          { n: 2, x: 0, y: 62, text: "Her wali is sent a copy. He is not asked to approve the match, and nobody waits on him here." },
          { n: 3, x: 0, y: 92, text: "The conversation opens the moment the second person says yes." },
        ],
      },
    ],
  },
  {
    eyebrow: "Step 03",
    title: "Talking, with the wali in the room",
    body:
      "Her wali confirmed her profile before anybody could see it, so his consent is already given " +
      "and the two of them do not wait again. He receives a copy of everything they say: a " +
      "participant rather than a bystander, with his own account, his own view, and the ability to " +
      "end things at any point.",
    screens: [
      {
        id: "chat",
        step: "Step 03",
        label: "The conversation",
        what:
          "The wali reads every word of this. Both members see the same banner naming him, pinned " +
          "under the header. There is no version of this where he is reading and they do not know.",
        pins: [
          { n: 1, x: 0, y: 13, text: "The banner cannot be dismissed or minimised by either side." },
          { n: 2, x: 0, y: 23, text: "A system message records when he joined the thread, with the time." },
          { n: 3, x: 0, y: 95, text: "Messages cannot be edited or deleted once sent, by anyone." },
        ],
      },
      {
        id: "portal",
        step: "For guardians",
        label: "The wali's own account",
        what:
          "He signs in separately. This is his home screen: everything concerning the woman he is " +
          "wali for, in one place.",
        pins: [
          { n: 1, x: 0, y: 28, text: "Every conversation she is having appears here the moment it opens." },
          { n: 2, x: 100, y: 55, text: "He can open and read any conversation in full, at any time." },
          { n: 3, x: 0, y: 76, text: "Every action is logged with a timestamp, for him and for us." },
        ],
      },
    ],
  },
];

/* A contrast block — what the product deliberately does not do. */
export const never = {
  eyebrow: "By design",
  title: "What this app will never have.",
  body: "Each of these is a decision, not a feature we have yet to build.",
  items: [
    { title: "No public profiles", body: "The pool is closed. Nothing is visible from outside the service, and no profile is indexed or advertised." },
    { title: "No swiping", body: "There is no stack and no endless feed. Interests are capped by the week, so the pace stays deliberate." },
    { title: "No private messaging", body: "A sister's conversations include her wali. There is no channel that bypasses him." },
    { title: "No public photographs", body: "Pictures are never on a profile. They are exchanged privately, on consent, or not at all." },
    { title: "No open-ended chatting", body: "Conversations move toward a family meeting, or they are closed." },
    { title: "No selling your data", body: "Profiles live in our own database and are never sold, shared or advertised against." },
  ],
};

export const close = {
  title: "That is the whole process.",
  body:
    "Registering, browsing and sending an interest are free, and it takes about ten minutes to " +
    "put a profile together. What a connection costs is on the pricing page.",
  cta: { label: "Register now", href: "/register" },
  note: "Parents and walis are welcome to read all of this first — the pricing page is at /pricing.",
};
