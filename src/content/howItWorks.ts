/* ============================================================
   HOW IT WORKS — page copy.

   The spine is the six steps published on the live site. Each stage
   below is annotated with numbered callouts that pin to a point on
   the screen (x/y are percentages of the screen area).

   PLACEHOLDER: the $149 shown on the fee screen is invented. The live
   site publishes no amount — replace it in Completion.tsx once you
   have the real figure.
   ============================================================ */

export const intro = {
  eyebrow: "How it works",
  title: "Six steps, and a guardian at every one.",
  body:
    "Nothing here happens quietly. Below is the whole path — from sending us your profile to " +
    "exchanging contact details — with the screens a member and her wali actually see at each stage.",
};

/* The six steps as published on nikahcanada.com. */
export const spine = [
  { n: "01", label: "Registration", note: "Free. No photograph required." },
  { n: "02", label: "Searching for matches", note: "We search; you do not." },
  { n: "03", label: "Profile security check", note: "Identity and references verified." },
  { n: "04", label: "Matchmaking", note: "Introductions, interest, wali approval." },
  { n: "05", label: "Matchmaking fee", note: "Charged once, to both sides." },
  { n: "06", label: "Contact information", note: "Names exchanged last." },
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
    eyebrow: "Steps 01–03",
    title: "Applying, and naming a wali",
    body:
      "Registration is free and asks for no photograph. What it does ask for — before anything " +
      "else — is whether you are a brother or a sister, because that determines whether a guardian " +
      "must be registered before the profile can go live.",
    screens: [
      {
        id: "signup",
        step: "Step 01",
        label: "Creating an account",
        what:
          "The account is created with an email and an intention. Gender is asked first because it " +
          "decides the shape of everything that follows.",
        pins: [
          { n: 1, x: 0, y: 18, text: "No photograph is requested anywhere in sign-up, matching the live service." },
          { n: 2, x: 0, y: 38, text: "Choosing “A sister” adds the wali step to onboarding. For a brother it is skipped." },
          { n: 3, x: 0, y: 74, text: "The marriage-only intention is agreed here, in plain words, not buried in terms." },
        ],
      },
      {
        id: "profile",
        step: "Step 01",
        label: "Building the profile",
        what:
          "Five steps. This is the third — how you practise — which is the section a match reads " +
          "before anything else.",
        pins: [
          { n: 1, x: 0, y: 9, text: "Progress is always visible; the profile can be finished across several sittings." },
          { n: 2, x: 0, y: 28, text: "Salah, dress and madhhab are structured fields, so matching can genuinely use them." },
          { n: 3, x: 0, y: 80, text: "Free text is optional and shared only with a match — never published." },
        ],
      },
      {
        id: "wali",
        step: "Steps 02–03",
        label: "Registering the wali",
        what:
          "Shown to sisters only. His details are taken and he is emailed an invitation. Her profile " +
          "does not enter the search until he confirms.",
        pins: [
          { n: 1, x: 0, y: 22, text: "His four powers are spelled out before a single detail is asked for." },
          { n: 2, x: 0, y: 62, text: "The relationship is recorded, so a match can see who the wali actually is." },
          { n: 3, x: 0, y: 88, text: "He confirms by email. Until then the profile is not searched or referred." },
        ],
      },
    ],
  },
  {
    eyebrow: "Step 04",
    title: "Introductions, not browsing",
    body:
      "This is where the app differs most from what people expect. Nobody searches for anybody. " +
      "Profiles arrive as a small, curated queue, and a photograph exists in the interface only as a " +
      "locked slot until both sides and the guardian have agreed.",
    screens: [
      {
        id: "introductions",
        step: "Step 04",
        label: "Receiving introductions",
        what:
          "The home screen. Matches are sent to you with a monthly allowance, so the pace stays " +
          "deliberate rather than endless.",
        pins: [
          { n: 1, x: 0, y: 10, text: "There is no search bar and no filters. You cannot look for members, and none can look for you." },
          { n: 2, x: 100, y: 21, text: "A visible monthly allowance — a small number of considered referrals, not a feed." },
          { n: 3, x: 0, y: 34, text: "Members appear as initials only. No names and no photographs on this screen." },
        ],
      },
      {
        id: "detail",
        step: "Step 04",
        label: "Reading a profile",
        what:
          "Everything needed to make a decision is present except the photograph — deen, family, " +
          "education, work, and what he is looking for.",
        pins: [
          { n: 1, x: 0, y: 24, text: "The photo slot is visible but locked, with the rule written on it rather than hidden in a policy." },
          { n: 2, x: 0, y: 80, text: "Identity and reference checks are surfaced as a verified badge." },
          { n: 3, x: 100, y: 93, text: "“Express interest” is the only way forward. There is no message button at this stage." },
        ],
      },
      {
        id: "mutual",
        step: "Step 04",
        label: "When interest is mutual",
        what:
          "Both sides have said yes — and the conversation still does not open. It waits on the wali, " +
          "and the screen says so rather than quietly stalling.",
        pins: [
          { n: 1, x: 0, y: 22, text: "Nothing has been shared yet. Names and contact details remain private." },
          { n: 2, x: 0, y: 62, text: "The timeline shows exactly which step is blocked and who is blocking it." },
          { n: 3, x: 0, y: 92, text: "The wali was notified automatically the moment interest became mutual." },
        ],
      },
    ],
  },
  {
    eyebrow: "Step 04",
    title: "Talking, with the wali in the room",
    body:
      "Approval is the gate. Until the guardian grants it there is no thread to open at all. Once he " +
      "does, he is a participant rather than a bystander — with his own account, his own view, and " +
      "the ability to end things at any point.",
    screens: [
      {
        id: "chat",
        step: "Step 04",
        label: "The conversation",
        what:
          "This thread exists only because the wali approved it. Both members see the same banner " +
          "naming him, pinned under the header.",
        pins: [
          { n: 1, x: 0, y: 13, text: "The banner cannot be dismissed or minimised by either side." },
          { n: 2, x: 0, y: 23, text: "A system message records when he approved and joined, with the time." },
          { n: 3, x: 0, y: 95, text: "Messages cannot be edited or deleted once sent, by anyone." },
        ],
      },
      {
        id: "portal",
        step: "For guardians",
        label: "The wali's own account",
        what:
          "He signs in separately. This is his home screen — everything concerning the woman he is " +
          "wali for, in one place.",
        pins: [
          { n: 1, x: 0, y: 28, text: "Introductions wait here for his approval or refusal. Nothing opens without it." },
          { n: 2, x: 100, y: 55, text: "He can open and read any conversation in full, at any time." },
          { n: 3, x: 0, y: 76, text: "Every action is logged with a timestamp — for him, and for us." },
        ],
      },
    ],
  },
  {
    eyebrow: "Steps 05–06",
    title: "The fee, and then the names",
    body:
      "Nothing is charged to register, to be searched for, or to be introduced. The fee falls due " +
      "only when both sides want to proceed — and because both must pay before details move, the " +
      "payment itself is proof the interest is mutual.",
    screens: [
      {
        id: "fee",
        step: "Step 05",
        label: "The matchmaking fee",
        what:
          "Charged once, to each side, at the point where a conversation has become serious. Not " +
          "before.",
        pins: [
          { n: 1, x: 0, y: 32, text: "Registration, searching and referral were all free. This is the only charge." },
          { n: 2, x: 0, y: 63, text: "Both sides must pay. Yours alone changes nothing." },
          { n: 3, x: 0, y: 85, text: "If the other side does not pay, nothing is shared and you are refunded." },
        ],
      },
      {
        id: "contact",
        step: "Step 06",
        label: "Contact details exchanged",
        what:
          "The last thing the platform does. Names and contact details go to both members — and to " +
          "the wali — at the same moment.",
        pins: [
          { n: 1, x: 0, y: 46, text: "Only now does a real name appear. Everything before this was initials." },
          { n: 2, x: 0, y: 63, text: "His wali or reference is included, so both families can speak directly." },
          { n: 3, x: 0, y: 82, text: "Her guardian receives the identical details at the same moment." },
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
    { title: "No browsing", body: "There is no directory, no search and no filters. You cannot look through members." },
    { title: "No swiping", body: "Introductions are read and answered one at a time. There is no stack and no feed." },
    { title: "No private messaging", body: "Every thread includes the guardian. There is no channel that bypasses him." },
    { title: "No public photographs", body: "Pictures are never on a profile. They are exchanged privately, on consent, or not at all." },
    { title: "No open-ended chatting", body: "Conversations move toward a family meeting, or they are closed." },
    { title: "No selling your data", body: "Profiles live in our own database and are never sold, shared or advertised against." },
  ],
};

export const close = {
  title: "That is the whole process.",
  body: "Registration is free and takes about ten minutes. We will speak with you by phone before any matching begins.",
  cta: { label: "Register Now", href: "/#start" },
  note: "Questions from a parent or guardian? Contact us and we will walk through it with you.",
};
