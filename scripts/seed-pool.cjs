/* A pool to test against: live members, walis, and nothing real.
 *
 * Browse, the request cap, the ledger and the conversation gate cannot
 * be exercised against an empty database, and registering twenty people
 * through the form by hand is an afternoon. This writes them straight
 * in, in the shape the app writes them itself.
 *
 * ── Every person here is invented ────────────────────────────────────
 * No real applicant's details go in this file or in this database
 * outside of registration. The names are common ones, deliberately not
 * matched to anybody, and every address is at `seed.test` — reserved by
 * RFC 2606, so it can never be delivered to and can never collide with
 * a member.
 *
 * Not `@example.invalid`: that suffix belongs to the end-to-end
 * checkers, and `purge-fixtures` deletes it on sight. A seeded pool is
 * meant to survive a checker run, so it uses its own domain and its own
 * removal switch.
 * ─────────────────────────────────────────────────────────────────────
 *
 * Every sister gets a confirmed wali, because a sister without one is
 * deliberately invisible in browse — seeding her without one produces a
 * pool that looks broken.
 *
 *   node scripts/seed-pool.cjs            # report only
 *   node scripts/seed-pool.cjs --apply
 *   node scripts/seed-pool.cjs --remove
 */
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const APPLY = process.argv.includes("--apply");
const REMOVE = process.argv.includes("--remove");

const DOMAIN = "seed.test";
const PASSWORD = "one good passphrase";

const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

/* Spread across provinces, ages, madhhabs and marital status so the
   browse filters have something to actually filter. */
const SISTERS = [
  ["Aisha", "Rahman", 1996, "Montreal", "QC", "hanafi", "fiveDaily", "hijab", "neverMarried", "citizen", "Pharmacist", "bachelor", ["English", "French", "Bengali"]],
  ["Fatima", "Siddiqui", 1993, "Laval", "QC", "hanafi", "fiveDaily", "niqab", "neverMarried", "citizen", "Teacher", "master", ["English", "Urdu"]],
  ["Khadija", "Toure", 1990, "Montreal", "QC", "maliki", "mostPrayers", "hijab", "divorced", "permanentResident", "Nurse", "bachelor", ["French", "English"]],
  ["Maryam", "Chowdhury", 1998, "Brossard", "QC", "hanafi", "fiveDaily", "hijab", "neverMarried", "citizen", "Software developer", "bachelor", ["English", "Bengali"]],
  ["Zainab", "Al-Amin", 1995, "Ottawa", "ON", "shafii", "fiveDaily", "hijab", "neverMarried", "citizen", "Accountant", "bachelor", ["English", "Arabic"]],
  ["Hafsa", "Ibrahim", 1992, "Toronto", "ON", "hanafi", "fiveDaily", "hijabSometimes", "neverMarried", "citizen", "Dental hygienist", "collegeDiploma", ["English", "Somali"]],
  ["Sumayya", "Diallo", 1997, "Montreal", "QC", "maliki", "fiveDaily", "hijab", "neverMarried", "studyPermit", "Graduate student", "master", ["French", "English"]],
  ["Ruqayya", "Haddad", 1989, "Gatineau", "QC", "hanbali", "mostPrayers", "hijab", "widowed", "citizen", "Small business owner", "collegeDiploma", ["Arabic", "French"]],
  ["Amina", "Osman", 1994, "Edmonton", "AB", "shafii", "fiveDaily", "hijab", "neverMarried", "citizen", "Lab technician", "bachelor", ["English", "Somali"]],
  ["Safiyya", "Karim", 1999, "Mississauga", "ON", "hanafi", "fiveDaily", "hijab", "neverMarried", "citizen", "Student", "other", ["English", "Urdu"]],
  ["Nusayba", "Farah", 1991, "Vancouver", "BC", "hanafi", "mostPrayers", "noHijab", "divorced", "citizen", "Project manager", "bachelor", ["English"]],
  ["Layla", "Bensaid", 1996, "Montreal", "QC", "maliki", "fiveDaily", "hijab", "neverMarried", "permanentResident", "Architect", "master", ["French", "Arabic", "English"]],
];

const BROTHERS = [
  ["Yusuf", "Rahman", 1992, "Montreal", "QC", "hanafi", "fiveDaily", "yes", "neverMarried", "citizen", "Civil engineer", "bachelor", ["English", "Bengali"]],
  ["Bilal", "Ndiaye", 1990, "Montreal", "QC", "maliki", "fiveDaily", "yes", "neverMarried", "citizen", "Electrician", "collegeDiploma", ["French", "English"]],
  ["Omar", "Sheikh", 1988, "Laval", "QC", "hanafi", "fiveDaily", "trimmed", "divorced", "citizen", "Pharmacist", "master", ["English", "Urdu"]],
  ["Ibrahim", "Cisse", 1995, "Montreal", "QC", "maliki", "mostPrayers", "yes", "neverMarried", "permanentResident", "Truck driver", "highSchool", ["French"]],
  ["Hamza", "Malik", 1993, "Toronto", "ON", "hanafi", "fiveDaily", "yes", "neverMarried", "citizen", "Data analyst", "bachelor", ["English", "Punjabi"]],
  ["Musa", "Abdullahi", 1991, "Ottawa", "ON", "shafii", "fiveDaily", "yes", "neverMarried", "citizen", "Physiotherapist", "master", ["English", "Hausa"]],
  ["Idris", "Hassan", 1986, "Toronto", "ON", "shafii", "mostPrayers", "trimmed", "widowed", "citizen", "Taxi driver", "highSchool", ["English", "Somali"]],
  ["Salman", "Qureshi", 1997, "Mississauga", "ON", "hanafi", "fiveDaily", "yes", "neverMarried", "citizen", "Medical resident", "doctorate", ["English", "Urdu"]],
  ["Adam", "Boulos", 1994, "Montreal", "QC", "hanbali", "fiveDaily", "yes", "neverMarried", "workPermit", "Chef", "collegeDiploma", ["Arabic", "French", "English"]],
  ["Zakariya", "Ali", 1989, "Calgary", "AB", "hanafi", "fiveDaily", "yes", "divorced", "citizen", "Welder", "collegeDiploma", ["English"]],
  ["Tariq", "Mansour", 1996, "Vancouver", "BC", "maliki", "mostPrayers", "trimmed", "neverMarried", "citizen", "Graphic designer", "bachelor", ["English", "Arabic"]],
  ["Suhayb", "Jalloh", 1992, "Winnipeg", "MB", "maliki", "fiveDaily", "yes", "neverMarried", "permanentResident", "Warehouse supervisor", "collegeDiploma", ["English", "French"]],
];

/* The vocabularies the profile schema actually accepts.
 *
 * Copied here rather than imported — this is a .cjs script and the
 * schema is TypeScript — which is exactly why it has to be checked. Seven
 * of the first seeded profiles carried education levels the schema has
 * never had ("college", "trade", "someUniversity"). Browse reads raw
 * documents so it showed them happily; the dashboard parses, so those
 * seven members got a 500 on the one screen every member lands on. A
 * seed that writes documents the application cannot read is worse than
 * no seed at all, so nothing is written now unless every value is one
 * the schema knows.
 *
 * Keep in step with src/lib/domain/profile.ts. */
const VOCAB = {
  education: [
    "highSchool",
    "collegeDiploma",
    "bachelor",
    "master",
    "doctorate",
    "islamicStudies",
    "other",
  ],
  madhhab: ["hanafi", "maliki", "shafii", "hanbali", "none", "preferNotToSay"],
  salah: ["fiveDaily", "mostPrayers", "somePrayers", "rarely", "preferNotToSay"],
  maritalStatus: ["neverMarried", "divorced", "widowed", "separated"],
  citizenship: [
    "citizen", "permanentResident", "workPermit", "studyPermit", "refugee", "visitor", "other",
  ],
  dress: ["niqab", "hijab", "hijabSometimes", "noHijab", "preferNotToSay"],
  beard: ["yes", "trimmed", "no", "preferNotToSay"],
  province: [
    "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
    "outsideCanada",
  ],
};

/** Fails the whole run, loudly, on the first value the app could not
 *  read back. A warning would be filed under "seen it, will fix", and
 *  the bug would still be there in three weeks. */
function assertVocabulary(people) {
  const wrong = [];
  for (const p of people) {
    for (const [field, key] of [
      ["education", "education"],
      ["madhhab", "madhhab"],
      ["salah", "salah"],
      ["maritalStatus", "maritalStatus"],
      ["citizenship", "citizenship"],
      ["province", "province"],
      /* `look` is her dress or his beard — one column, two vocabularies. */
      [p.gender === "sister" ? "dress" : "beard", "look"],
    ]) {
      const value = p[key];
      if (value && !VOCAB[field].includes(value)) {
        wrong.push(`${p.email}: ${field} = "${value}" (allowed: ${VOCAB[field].join(", ")})`);
      }
    }
  }
  if (wrong.length) {
    console.error(`
FAIL  ${wrong.length} seeded value(s) the profile schema will reject:
`);
    for (const line of wrong) console.error(`  ${line}`);
    console.error("");
    process.exit(1);
  }
}

const slug = (first, last) => `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");

function personFrom(row, gender) {
  const [first, last, birthYear, city, province, madhhab, salah, look, maritalStatus, citizenship, occupation, education, languages] = row;
  return {
    first,
    last,
    gender,
    email: `${slug(first, last)}@${DOMAIN}`,
    birthYear,
    city,
    province,
    madhhab,
    salah,
    look,
    maritalStatus,
    citizenship,
    occupation,
    education,
    languages,
  };
}

const PEOPLE = [
  ...SISTERS.map((r) => personFrom(r, "sister")),
  ...BROTHERS.map((r) => personFrom(r, "brother")),
];

/* Before anything is connected to, let alone written. */
assertVocabulary(PEOPLE);

const ABOUT = (p) =>
  `I was born in ${p.birthYear} and live in ${p.city}. I work as a ${p.occupation.toLowerCase()}. ` +
  `I am looking for someone serious about their deen and about marriage, and I would like our families involved from the start. ` +
  `This paragraph is seeded test copy, not a real person's words.`;

function userDoc(p, passwordHash, now, roles = ["member"]) {
  return {
    _id: new ObjectId(),
    email: p.email,
    emailVerifiedAt: now,
    passwordHash,
    roles,
    status: "active",
    locale: "en-CA",
    legalName: { first: p.first, last: p.last },
    phone: null,
    dateOfBirth: new Date(Date.UTC(p.birthYear, 4, 12)),
    mfa: { enabled: false, secret: null },
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    tokenVersion: 0,
    closedAt: null,
    closureReason: null,
  };
}

function profileDoc(p, userId, now) {
  return {
    _id: new ObjectId(),
    userId,
    gender: p.gender,
    status: "live",
    liveAt: now,
    submittedAt: now,
    initials: `${p.first[0]}.${p.last[0]}.`,
    completeness: { step: 5, of: 5, percent: 100 },
    basics: {
      birthYear: p.birthYear,
      city: p.city,
      province: p.province,
      citizenship: p.citizenship,
      willingToRelocate: p.province === "QC" ? "maybe" : "yes",
      heightCm: p.gender === "sister" ? 160 + (p.birthYear % 12) : 170 + (p.birthYear % 14),
    },
    background: {
      maritalStatus: p.maritalStatus,
      children: p.maritalStatus === "neverMarried" ? "none" : "yesLivingWithMe",
      languages: p.languages,
      ethnicity: "",
    },
    education: { level: p.education, field: "" },
    work: { occupation: p.occupation },
    deen: {
      salah: p.salah,
      madhhab: p.madhhab,
      quran: "reads",
      ...(p.gender === "sister" ? { dress: p.look } : { beard: p.look }),
    },
    reference: {
      name: "Imam at the local masjid",
      relationship: "Knows the family",
      organisation: "",
      phone: "+15145550100",
    },
    freeText: { aboutMe: ABOUT(p) },
    lookingFor: {
      ageMin: 22,
      ageMax: 45,
      provinces: ["QC", "ON", "AB", "BC", "MB"],
      maritalStatus: [],
      madhhab: [],
      freeText: "",
    },
    createdAt: now,
    updatedAt: now,
  };
}

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const seeded = { $regex: `@${DOMAIN.replace(".", "\\.")}$` };

  if (REMOVE) {
    const users = await db.collection("users").find({ email: seeded }).toArray();
    const ids = users.map((u) => u._id);
    const idStrings = ids.map(String);
    if (!APPLY) {
      console.log(`${users.length} seeded account(s) would be removed  (dry run)`);
      console.log("Re-run with --apply to remove them.");
      return;
    }
    for (const c of ["profiles", "sessions", "connectionLedger", "guardianships"]) {
      await db.collection(c).deleteMany({
        $or: [{ userId: { $in: ids } }, { userId: { $in: idStrings } }, { memberUserId: { $in: idStrings } }, { waliUserId: { $in: idStrings } }],
      });
    }
    await db.collection("connectionRequests").deleteMany({
      $or: [{ fromUserId: { $in: idStrings } }, { toUserId: { $in: idStrings } }],
    });
    await db.collection("users").deleteMany({ _id: { $in: ids } });
    console.log(`removed ${users.length} seeded account(s) and everything hanging off them`);
    return;
  }

  const already = await db.collection("users").countDocuments({ email: seeded });
  if (already) {
    console.log(`${already} seeded account(s) are already here.`);
    console.log("Run with --remove --apply first if you want a clean pool.");
    return;
  }

  console.log(`${PEOPLE.length} members (${SISTERS.length} sisters, ${BROTHERS.length} brothers)`);
  console.log(`${SISTERS.length} walis, one confirmed for each sister`);
  console.log(`password for every account: ${PASSWORD}`);
  if (!APPLY) {
    console.log("\n(dry run) Re-run with --apply to write them.");
    return;
  }

  /* The app's own hashing, not a shortcut — these accounts have to be
     signed in to for any of this to be worth seeding. */
  const argon2 = require("@node-rs/argon2");
  const passwordHash = await argon2.hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const now = new Date();
  const users = [];
  const profiles = [];
  const guardianships = [];

  for (const p of PEOPLE) {
    const u = userDoc(p, passwordHash, now);
    users.push(u);
    profiles.push(profileDoc(p, u._id, now));

    if (p.gender !== "sister") continue;

    /* Her wali is his own account with the `wali` role and no profile,
       exactly as accepting an invitation creates him. */
    const wali = userDoc(
      {
        first: "Abdullah",
        last: p.last,
        email: `wali.${slug(p.first, p.last)}@${DOMAIN}`,
        birthYear: p.birthYear - 28,
      },
      passwordHash,
      now,
      ["wali"]
    );
    wali.dateOfBirth = null;
    users.push(wali);

    /* Every field the schema names, including the ones that are only
       ever null on a confirmed guardianship. They are `nullable`, not
       `optional`, so a document missing them parses nowhere — and it
       fails at the *reader*, which is how a seeded pool ends up looking
       fine in browse (a raw projection) and throwing a 500 on the
       requests page (a parse). */
    guardianships.push({
      _id: new ObjectId(),
      memberUserId: String(u._id),
      memberProfileId: String(profiles[profiles.length - 1]._id),
      waliUserId: String(wali._id),
      invited: {
        name: `${wali.legalName.first} ${wali.legalName.last}`,
        email: wali.email,
        relationship: "father",
        invitedAt: now,
        /* A digest of nothing in particular. The plaintext invitation
           never existed for these — they are seeded already confirmed —
           and the column wants 64 hex characters. */
        tokenHash: require("node:crypto").randomBytes(32).toString("hex"),
        expiresAt: new Date(now.getTime() + 14 * 864e5),
        remindersSent: 0,
      },
      status: "confirmed",
      confirmedAt: now,
      declinedAt: null,
      declineReason: null,
      revokedAt: null,
      revokedBy: null,
      expiredAt: null,
      verification: { state: "verified", verifiedAt: now, method: "seed" },
      replacesGuardianshipId: null,
      replacedByGuardianshipId: null,
    });
  }

  await db.collection("users").insertMany(users);
  await db.collection("profiles").insertMany(profiles);
  await db.collection("guardianships").insertMany(guardianships);

  console.log(`\nwrote ${users.length} accounts, ${profiles.length} live profiles, ${guardianships.length} confirmed guardianships`);
  console.log(`sign in as any of them, e.g. ${PEOPLE[0].email} / ${PASSWORD}`);
})()
  .catch((err) => {
    console.error(`\nFAIL  ${(err && err.message) || err}\n`);
    process.exitCode = 1;
  })
  .finally(() => client.close());
