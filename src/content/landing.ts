/* ============================================================
   HOMEPAGE COPY — "/"

   Rewritten to the client's own mock-up. Everything here is a claim the
   product actually keeps today; nothing is a member count, a price, a
   testimonial or a promise about what will exist later. If a line here
   stops being true, the line changes — not the product.
   ============================================================ */

export const hero = {
  /* Two voices in one heading: the question the reader arrived with,
     then the answer. Split so the second half can carry the accent. */
  question: { plain: "Serious about", accent: "Nikah?" },
  welcome: "Welcome to NikahCanada.",
  line: "Begin your journey toward completing half of your faith.",
  body:
    "A Muslim marriage platform created for people who are sincerely seeking marriage, " +
    "not casual dating.",
  cta: { label: "Create Your Free Profile", href: "/register" },
  signedIn: { label: "Go to your account", href: "/dashboard" },
};

/* The strip under the hero. Four facts, each one checkable against the
   product: the pool is national, the service is for marriage, a sister's
   wali is part of it, and families are welcome to ask. */
export const marks = [
  { icon: "leaf", label: "Canada wide" },
  { icon: "mosque", label: "Marriage focused" },
  { icon: "people", label: "Wali involved" },
  { icon: "heart", label: "Family oriented" },
] as const;

export const howItWorks = {
  title: "How It Works",
  mobileTitle: "Steps to Connect",
  mobileIntro: "Register for free, search, and connect with Muslims across Canada who are sincerely seeking marriage.",
  steps: [
    {
      n: 1,
      icon: "profile",
      title: "Create Your Profile for Free",
      body:
        "Tell us where you live, something of your background, and how you practise.",
      mobileBody: "Tell us where you live, your background, and how you practise.",
    },
    {
      n: 2,
      icon: "search",
      title: "Search for a Compatible Spouse",
      body: "Browse profiles and find compatible Muslim marriage candidates across Canada.",
      mobileBody: "Browse Muslim marriage profiles based on your preferences.",
    },
    {
      n: 3,
      icon: "connect",
      title: "Express Interest & Connect",
      body:
        "Send your interest. When the interest is mutual, you can begin your conversation.",
      mobileBody: "When the interest is mutual, continue the conversation with serious marriage intentions.",
    },
  ],
} as const;

export const why = {
  title: "Why NikahCanada",
  blurb: "Built for marriage, with the family in the room rather than outside it.",
  points: [
    {
      icon: "shield",
      title: "Designed around Islamic values",
      body: "Developed in consultation with Islamic scholars, and no photograph is required.",
    },
    {
      icon: "people",
      title: "Wali involvement for sisters",
      body: "A sister names her wali. He confirms by email, and he receives a copy of every conversation.",
    },
    {
      icon: "heart",
      title: "Serious marriage intentions only",
      body: "Every member states an intention to marry before they can join. Nobody is here to browse for fun.",
    },
    {
      icon: "leaf",
      title: "Serving Muslims across Canada",
      body: "Based in Montreal, working with members from every province.",
    },
  ],
} as const;

export const faq = {
  title: "Questions people ask",
  items: [
    {
      q: "What does it cost?",
      a: "Creating a profile, browsing the pool and sending interest are free.",
    },
    {
      q: "Who can see my profile?",
      a:
        "Only signed in members of the service. Nothing is published on the open web, nothing is " +
        "indexed by search engines, and nothing is sold.",
    },
    {
      q: "Do I need a photograph?",
      a: "No. Profiles carry your answers, not your photograph.",
    },
    {
      q: "What does a wali do here?",
      a:
        "A sister names her wali when she registers. Her profile goes live once he has confirmed by " +
        "email, and he receives a copy of her conversations. Brothers are not asked for one.",
    },
    {
      q: "How do two people start talking?",
      a:
        "One of them sends an interest, which is free. Nothing opens until the other says yes; when " +
        "both have, a conversation opens between them.",
    },
    {
      q: "Can I stop, or take my profile down?",
      a:
        "Yes, at any time. Pausing hides your profile and keeps your answers; withdrawing closes " +
        "it. Both are in your account settings, and neither needs anybody's permission.",
    },
  ],
} as const;

export const closing = {
  title: "Begin when you are ready.",
  body: "Registration is free and takes about ten minutes. You can finish it across several sittings.",
  cta: { label: "Create your free profile", href: "/register" },
};
