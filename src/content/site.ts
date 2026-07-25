/* ============================================================
   ALL SITE COPY.

   Sourced from the existing nikahcanada.com copy. Where the live
   site states something factual (Montreal base, the scholar
   consultation, the six steps, the fee model) that wording is kept
   close to the original.

   NOTHING HERE IS INVENTED FACT. There are deliberately no member
   counts, no success statistics, no testimonials and no prices —
   the existing site publishes none of those, and fabricating them
   for a real business would be worse than leaving them out.
   Anything marked TODO needs a real number from you.
   ============================================================ */

export const brand = {
  name: "NikahCanada",
  legalName: "NikahCanada",
  tagline: "Muslim Marriage Match & Matrimony Service",
};

export const nav = {
  links: [
    { label: "Home", href: "/" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Pricing", href: "/#fee" },
    /* TODO: no Articles page exists yet. */
    { label: "Articles", href: "/" },
    { label: "Contact Us", href: "/#contact" },
  ],
  cta: { label: "Registration", href: "/#start" },
};

export const hero = {
  eyebrow: "Muslim Marriage Match & Matrimony Service",
  title: "Complete half of your faith.",
  body:
    "Send us your profile for free and we will help you find a match according to your " +
    "preferences. A personalised matrimonial service based in Montreal, operating across Canada.",
  primary: { label: "Register Now", href: "/#start" },
  secondary: { label: "How It Works", href: "/how-it-works" },
  /* Alternates in public/images: hero-carving.jpg (Qutb Minar carving),
     hero-alhambra.jpg (Alhambra stucco). Swap this one line to try them. */
  image: {
    src: "/images/hero-mosque.jpg",
    alt: "A white-domed mosque with arcaded arches at dusk",
  },
};

/* The five assurances from the live site's hero strip. */
export const trust = {
  points: [
    "Verified profiles only",
    "Profiles kept confidential and safe",
    "Personalised service to meet your needs",
    "Based in Montreal, operating across Canada",
    "Developed in collaboration with Islamic scholars",
  ],
};

export const why = {
  eyebrow: "Why register",
  title: "Why send us your profile?",
  body:
    "Finding a suitable match can be stressful, and can span months or years. " +
    "Register today and we will refer you marriage candidates.",
  pillars: [
    {
      title: "Find the right match",
      body:
        "We offer a personalised service. Tell us how we can help, explain your preferences, " +
        "and connect with us. Our service is designed to introduce you to a successful match — " +
        "someone who likes your information and picture, and whose information and picture you like as well.",
    },
    {
      title: "Confidential and safe",
      body:
        "Your profile information and pictures are stored in our offline database, safe from the " +
        "public. We speak over the phone with everyone before we begin matching them.",
    },
    {
      title: "Developed with scholars",
      body:
        "Our services were developed in collaboration with traditional scholars, so that the " +
        "process stays in line with the Islamic injunctions from beginning to end.",
    },
  ],
};

export const steps = {
  eyebrow: "The process",
  title: "Find your successful match in six simple steps.",
  body: "Every stage is handled by a person, and nothing moves forward without your agreement.",
  items: [
    {
      n: "01",
      title: "Registration",
      body: "Send us your profile. Registration is free, and a picture is not required at this stage.",
    },
    {
      n: "02",
      title: "Searching for suitable matches",
      body: "We search our database for candidates who fit the preferences you have described to us.",
    },
    {
      n: "03",
      title: "Profile security check",
      body: "Profiles are checked before anything is shared, so that only verified candidates are referred.",
    },
    {
      n: "04",
      title: "Matchmaking",
      body: "Profile information is shared first. Pictures are exchanged only once both sides are satisfied with what they have read.",
    },
    {
      n: "05",
      title: "Matchmaking fee",
      body: "The fee falls due only at this point, once there is a genuine mutual interest to act on.",
    },
    {
      n: "06",
      title: "Sharing of contact information",
      body: "Names and contact details are exchanged last, once both parties have paid — which confirms the interest is genuine on both sides.",
    },
  ],
  cta: { label: "See the full process", href: "/how-it-works" },
};

export const scholars = {
  eyebrow: "Developed with scholars",
  title: "In line with the Islamic injunctions.",
  body:
    "Our matchmaking procedure was developed through full consultation with " +
    "Mufti Faisal al-Mahmudi of Darul Iftaa Canada. Our goal is to provide a matchmaking " +
    "experience that stays within the bounds of the Sharia at every stage.",
  measures: [
    "The inclusion of a wali is mandatory for women",
    "Direct contact between candidates is prevented throughout",
    "Pictures are requested only during matchmaking, never at registration",
    "Contact details are shared only at the final step",
  ],
  quote: "Our goal is to provide you with a matchmaking experience in line with the Islamic injunctions.",
  image: {
    src: "/images/scholars-mosque.jpg",
    alt: "The white marble courtyard and domes of the Sheikh Zayed Grand Mosque",
  },
};

export const safety = {
  eyebrow: "Confidential and safe",
  title: "Your profile is not public, and never will be.",
  body: "Each of the following is how the service actually operates, not a policy statement.",
  items: [
    {
      title: "Stored offline",
      body: "Profile information and pictures are held in our offline database, safe from the public. There is no directory to browse and no profile to find.",
    },
    {
      title: "We speak to everyone",
      body: "We speak over the phone with every registrant before we begin matching them. Nobody enters the database unspoken to.",
    },
    {
      title: "Pictures on consent",
      body: "Pictures are not necessary when registering and are only requested during matchmaking — then shared only once both parties are satisfied with each other's profile information.",
    },
    {
      title: "Names shared last",
      body: "Your name and contact information are not shared until both parties have paid the matchmaking fee. This confirms your match is genuinely interested in you.",
    },
    {
      title: "A wali throughout",
      body: "The inclusion of a wali is mandatory for women, from the beginning of the process rather than the end of it.",
    },
    {
      title: "No direct contact",
      body: "Candidates do not contact one another at any point before the final step. Everything passes through us.",
    },
  ],
};

export const fee = {
  eyebrow: "Pricing",
  title: "Free to register. A fee only when it matters.",
  body:
    "There is no cost to send us your profile, and no cost to be searched for or referred. " +
    "The matchmaking fee falls due at step five, once both sides have read each other's profile " +
    "and want to proceed.",
  points: [
    { title: "Registration", body: "Free. Send us your profile and speak with us by phone." },
    { title: "Searching and referral", body: "Free. We search for candidates matching your preferences." },
    {
      title: "Matchmaking fee",
      /* TODO: the live site does not publish an amount on this page. */
      body: "Charged once at step five, to both parties. See the Pricing page for the current amount.",
    },
  ],
  note: "Because both parties pay before contact details are exchanged, the fee also serves as proof that the interest is mutual.",
  cta: { label: "Register Now", href: "/#start" },
};

export const faq = {
  eyebrow: "Questions",
  title: "The things people ask us most.",
  items: [
    {
      q: "Do I need to provide a picture to register?",
      a: "No. Pictures are not necessary when you register, and are only requested during matchmaking. Even then, a picture is shared only once both parties are satisfied with each other's profile information.",
    },
    {
      q: "Who can see my profile?",
      a: "Only us. Your profile information and pictures are stored in our offline database, safe from the public. There is no browsable directory, and profiles are never published.",
    },
    {
      q: "When is my name shared?",
      a: "At the very last step. Your name and contact information are not shared until both parties have paid the matchmaking fee — which confirms that your match is genuinely interested in you.",
    },
    {
      q: "Is a wali required?",
      a: "Yes. The inclusion of a wali is mandatory for women. This is one of several measures put in place so the process stays in line with the Islamic injunctions.",
    },
    {
      q: "Can I contact a candidate directly?",
      a: "No. Direct contact between candidates is prevented throughout the process. Everything passes through us until contact details are exchanged at the final step.",
    },
    {
      q: "Who did you develop the process with?",
      a: "Our matchmaking procedure was developed through full consultation with Mufti Faisal al-Mahmudi of Darul Iftaa Canada, alongside other traditional scholars.",
    },
    {
      q: "Do you operate outside Montreal?",
      a: "Yes. We are based in Montreal and operate across Canada.",
    },
  ],
};

export const cta = {
  title: "Send us your profile.",
  body: "Registration is free, and a picture is not required. We will speak with you before any matching begins.",
  primary: { label: "Register Now", href: "/#start" },
  note: "Questions first? Contact us and we are happy to talk it through with you and your family.",
};

export const footer = {
  blurb:
    "A Muslim marriage match and matrimony service. Based in Montreal, operating across Canada, " +
    "developed in collaboration with Islamic scholars.",
  /* TODO: "Articles" has no page or section behind it yet — it points at the
     home page until one exists. Everything else resolves to real content. */
  columns: [
    {
      title: "Service",
      links: [
        { label: "How It Works", href: "/how-it-works" },
        { label: "Pricing", href: "/#fee" },
        { label: "Articles", href: "/" },
        { label: "Contact Us", href: "/#contact" },
      ],
    },
    {
      title: "Register",
      links: [
        { label: "Registration", href: "/#start" },
        { label: "For guardians", href: "/how-it-works" },
        { label: "Verified profiles", href: "/#safety" },
        { label: "Confidentiality", href: "/#safety" },
      ],
    },
  ],
  legal: ["Privacy Policy", "Terms and Conditions"],
  copyright: `NikahCanada © ${new Date().getFullYear()}`,
};
