/* ============================================================
   HOMEPAGE COPY  —  "/"

   NikahCanada wording, mapped onto the Bridely template's sections.
   Sourced from nikahcanada.com and kept close to the original where the
   live site states something factual — the Montreal base, the scholar
   consultation, the six steps, the fee model.

   NOTHING HERE IS INVENTED FACT. No member counts, no success rates, no
   testimonials, no prices. The live site publishes none of those and
   fabricating them for a real business would be worse than leaving them
   out. Every open item is marked TODO.

   BROWSE MODEL. This copy previously stated that members cannot look
   through other members — "your profile is not public, and never will
   be", "no public directory". That has been reversed: members browse a
   closed, verified pool and spend a connection to ask to talk. The
   confidentiality claims that survive are narrower and precise — nothing
   is visible outside the service, nothing is indexed, nothing is sold —
   and they are worded to stay true. Anything asserting that members
   cannot search has been removed rather than softened.

   ⚠ This changes a promise published on nikahcanada.com. It needs the
   client's sign-off, and the "no browsing" position reads as a scholarly
   one rather than a marketing one, so it belongs in front of Mufti Faisal
   al-Mahmudi too (APP-PLAN §3.4).

   The template had four slots with no NikahCanada equivalent. Rather
   than invent one, each was repointed at real copy:
     - "Meet our event organizers" (4 named staff)  -> confidentiality
     - "Partners" (8 brand logos)                   -> the five assurances
     - "Marry Jain & Jamie Foster" (a testimonial)  -> the wali's role
     - "Instagram Feed"                             -> a plain gallery
   ============================================================ */

export const ART = "/images/bridely/art";
export const PHOTO = "/images/bridely";

export const brand = {
  name: "NikahCanada",
  tagline: "Muslim Marriage Match & Matrimony Service",
  /* TODO: no logo file has been supplied, so the header and footer set the
     name as a typographic wordmark instead — see primitives/Wordmark.tsx.
     The template's own mark is deliberately not reused: it is another
     company's branding and is licensed as demo content. */
};

export const topBar = {
  note: "Based in Montreal, operating across Canada",
  followLabel: "Follow us on:",
  /* TODO: no social accounts have been supplied, so these point nowhere.
     Give each a real URL or drop `socials` to hide the row entirely. */
  socials: ["facebook", "instagram"] as const,
};

export const nav = {
  links: [
    { label: "Home", href: "/" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Pricing", href: "/#fee" },
    { label: "Contact Us", href: "/#contact" },
  ],
  dropdown: {
    label: "More",
    items: [
      { label: "The process", href: "/#process" },
      { label: "Confidentiality", href: "/#safety" },
      { label: "Developed with scholars", href: "/#scholars" },
      { label: "For guardians", href: "/#wali" },
    ],
  },
  cta: { label: "Register Now", href: "/#contact" },
};

export const hero = {
  title: "Complete half of",
  titleAccent: "your faith.",
  body:
    "Send us your profile for free and we will help you find a match according to your " +
    "preferences. A personalised matrimonial service based in Montreal, operating across Canada.",
  cta: { label: "Register Now", href: "/#contact" },
  image: { src: `${PHOTO}/hero.jpg`, w: 475, h: 540, alt: "White flowers in a vase" },
};

/* Was "About Bridely / What We do, We do With Passion". */
export const about = {
  eyebrow: "Why register",
  title: "Why send us your profile?",
  body:
    "Finding a suitable match can be stressful, and can span months or years. Register today, " +
    "look through the pool yourself, and we will refer you marriage candidates as well.",
  cta: { label: "How it works", href: "/how-it-works" },
  images: [
    { src: `${PHOTO}/about-1.jpg`, w: 445, h: 354, alt: "White and beige flowers" },
    { src: `${PHOTO}/about-2.jpg`, w: 285, h: 250, alt: "Pink roses and baby's breath" },
    { src: `${PHOTO}/about-3.jpg`, w: 255, h: 95, alt: "White flowers, macro" },
  ],
};

export const video = {
  poster: { src: `${PHOTO}/video.jpg`, w: 1110, h: 500, alt: "A floral archway set for a ceremony" },
  /* TODO: no film exists yet. The play control renders either way because
     it is part of the composition, but it only becomes a working button —
     opening the clip in a lightbox — once this points at a real file or
     URL. Deliberately not pointed at the template's stock demo clip. */
  href: null as string | null,
};

/* Was "Includes Various Product Categories". */
export const categories = {
  title: "Find your match in six simple steps.",
  body:
    "Every stage is handled by a person, and nothing moves forward without your agreement. " +
    "The four below are the shape of it; the full process is on its own page.",
  cta: { label: "See the full process", href: "/how-it-works" },
  cards: [
    { label: "Registration", src: `${PHOTO}/category-1.jpg`, alt: "White petalled centerpiece" },
    { label: "Browse and referral", src: `${PHOTO}/category-2.jpg`, alt: "Outdoor wedding arch" },
    { label: "Matchmaking", src: `${PHOTO}/category-3.jpg`, alt: "Red and white flowers on a wooden table" },
    { label: "Contact shared", src: `${PHOTO}/category-4.jpg`, alt: "Centerpiece in a glass vase" },
  ],
};

/* Was "The Unrivaled Scenery, Unforgettable Wedding Program". */
export const reservation = {
  title: "Free to register. A fee only when it matters.",
  body:
    "There is no cost to send us your profile, and no cost to browse, to be browsed or to be " +
    "referred. The matchmaking fee falls due once both sides have read each other's profile and " +
    "want to proceed.",
  /* TODO: the live site publishes no amount. Add it here when you have it.
     TODO: this section says nothing about what a connection costs, because
     that is undecided. If connections are sold rather than granted, this is
     no longer the whole pricing story and the section needs a second line. */
  note:
    "Because both parties pay before contact details are exchanged, the fee also confirms the " +
    "interest is mutual.",
  cta: { label: "Register Now", href: "/#contact" },
  images: [
    { src: `${PHOTO}/reservation-1.jpg`, w: 635, h: 540, alt: "Flowers hanging from a ceiling" },
    { src: `${PHOTO}/reservation-2.jpg`, w: 445, h: 300, alt: "Vases of assorted flowers" },
    { src: `${PHOTO}/reservation-3.jpg`, w: 445, h: 210, alt: "Aisle flower arrangement" },
  ],
};

/* Was "Let's Plan Your Next Event Together". */
export const eventTogether = {
  title: "In line with the Islamic injunctions.",
  body:
    "Our matchmaking procedure was developed through full consultation with Mufti Faisal " +
    "al-Mahmudi of Darul Iftaa Canada.",
  cta: { label: "How it works", href: "/how-it-works" },
  /* The template's own tile art was a guitar, a dining table, a curtain
     and a gift box. Replaced with drawn line icons — see SafeguardIcons. */
  tiles: [
    { label: "A wali throughout", icon: "wali" as const },
    { label: "No direct contact", icon: "contact" as const },
    { label: "Pictures on consent", icon: "consent" as const },
    { label: "Names shared last", icon: "names" as const },
  ],
};

/* Was "Meet Our Creative Event Organizer" — four named staff with social
   links. NikahCanada publishes no team, so this carries the
   confidentiality measures instead, and the per-card social row is gone. */
export const organizers = {
  title: "Seen by verified members. Never by the public.",
  body: "Each of the following is how the service actually operates, not a policy statement.",
  cta: { label: "Confidentiality in full", href: "/how-it-works" },
  people: [
    { name: "Never on the open web", src: `${PHOTO}/organizer-1.jpg`, alt: "White and pink flowers on a wooden box" },
    { name: "We speak to everyone", src: `${PHOTO}/organizer-2.jpg`, alt: "White and purple flowers in a black vase" },
    { name: "Verified members only", src: `${PHOTO}/organizer-3.jpg`, alt: "White roses" },
    { name: "Nothing is sold", src: `${PHOTO}/organizer-4.jpg`, alt: "White flowers in a vase" },
  ],
};

/* Was a couple's testimonial. Replaced with the wali's role, which is
   published and needs no invented names. */
export const story = {
  title: "A guardian at every step.",
  body:
    "The inclusion of a wali is mandatory for women, from the beginning of the process rather " +
    "than the end of it. Direct contact between candidates is prevented throughout, and every " +
    "exchange passes through us until the final step.",
  cta: { label: "See how it works", href: "/how-it-works" },
  slides: [
    { src: `${PHOTO}/story.jpg`, w: 665, h: 523, alt: "Outdoor ceremony setup with florals" },
    { src: `${PHOTO}/video.jpg`, w: 665, h: 523, alt: "A floral archway set for a ceremony" },
  ],
};

/* Was "Make Reservations" — name, email, guests, date, event.

   This is the page's only form, so it carries both jobs: it is the
   Contact Us section, and it is also where every "Register Now" button
   lands, because on the live site registering IS sending us your profile.
   The subject select opens on Registration for exactly that reason. */
export const contact = {
  eyebrow: "Contact us",
  title: "Contact us.",
  body:
    "Registration is free and a picture is not required — send us your profile and we will " +
    "speak with you by phone before any matching begins. Questions from a parent or wali are " +
    "just as welcome.",
  submit: "Send Message",
  /* TODO: no endpoint yet — the form acknowledges locally and sends
     nothing. This line is placeholder wording, not a commitment. */
  sentNote: "Thank you. We will be in touch shortly.",
  image: { src: `${PHOTO}/form.jpg`, w: 540, h: 631, alt: "A vase of white flowers" },
  fields: {
    name: "Your Name",
    email: "Your Email",
    phone: "Phone Number",
    city: "City",
    subject: " What is this about?",
    message: "Your message",
  },
  /* TODO: confirm these against how enquiries actually reach you. */
  subjectOptions: [
    "Registration",
    "A question about the process",
    "I am a parent or wali",
    "Something else",
  ],
};

/* Was eight partner brand logos. NikahCanada has no partner brands; this
   is the five-point assurance strip from the live site's hero instead. */
export const assurances = [
  "Verified profiles only",
  "Profiles kept confidential and safe",
  "Personalised service to meet your needs",
  "Based in Montreal, operating across Canada",
  "Developed in collaboration with Islamic scholars",
];

/* Was an Instagram feed. No account has been supplied, so the social
   chrome is gone and this is a plain closing band.
   TODO: give us a handle and it can become a real feed. */
export const gallery = {
  title: "A service built around your family.",
  body: "Speak to us with your parents or your wali. We are happy to talk it through with all of you.",
  posts: [
    { src: `${PHOTO}/insta-1.jpg`, alt: "White rose" },
    { src: `${PHOTO}/insta-2.jpg`, alt: "White flowers, macro" },
    { src: `${PHOTO}/insta-3.jpg`, alt: "Pink flowers in a clear glass vase" },
    { src: `${PHOTO}/insta-4.jpg`, alt: "Red flower arrangement on a white table" },
  ],
};

export const footer = {
  planning: "Send us your profile.",
  primary: { label: "Register Now", href: "/#contact" },
  secondary: { label: "How it works", href: "/how-it-works" },
  blurb:
    "A Muslim marriage match and matrimony service. Based in Montreal, operating across Canada, " +
    "developed in collaboration with Islamic scholars.",
  columnTitle: "Service",
  secondColumnTitle: "Register",
  columns: [
    [
      { label: "How It Works", href: "/how-it-works" },
      { label: "The process", href: "/#process" },
      { label: "Pricing", href: "/#fee" },
      { label: "Developed with scholars", href: "/#scholars" },
    ],
    [
      { label: "Registration", href: "/#contact" },
      { label: "For guardians", href: "/#wali" },
      { label: "Confidentiality", href: "/#safety" },
      { label: "Contact Us", href: "/#contact" },
    ],
  ],
  /* TODO: the template shipped a fake phone number and email. Nothing has
     been supplied for NikahCanada, so the contact block is omitted rather
     than filled with something invented. Add real details and it returns. */
  copyright: `NikahCanada © ${new Date().getFullYear()}`,
  legal: ["Privacy Policy", "Terms and Conditions"],
};
