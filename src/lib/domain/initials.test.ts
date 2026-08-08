import { describe, expect, it } from "vitest";
import { deriveInitials } from "@/lib/domain/initials";

describe("deriveInitials", () => {
  it("matches the format the app screens render", () => {
    // the four members shown in src/components/app/screens/
    expect(deriveInitials({ first: "Fatima", last: "Al-Rashid" })).toBe("F.A");
    expect(deriveInitials({ first: "Yusuf", last: "Karim" })).toBe("Y.K");
    expect(deriveInitials({ first: "Ibrahim", last: "Mahmood" })).toBe("I.M");
    expect(deriveInitials({ first: "Aisha", last: "Siddiqui" })).toBe("A.S");
  });

  it("upper-cases whatever it is given", () => {
    expect(deriveInitials({ first: "fatima", last: "al-rashid" })).toBe("F.A");
    expect(deriveInitials({ first: "fAtImA", last: "kARIM" })).toBe("F.K");
  });

  it("ignores surrounding whitespace", () => {
    expect(deriveInitials({ first: "  Fatima  ", last: "\tKarim\n" })).toBe("F.K");
  });

  describe("mononyms", () => {
    it("returns a single letter when there is no family name", () => {
      expect(deriveInitials({ first: "Suharto" })).toBe("S");
    });

    it("treats an empty or blank family name the same way", () => {
      expect(deriveInitials({ first: "Suharto", last: "" })).toBe("S");
      expect(deriveInitials({ first: "Suharto", last: "   " })).toBe("S");
    });
  });

  describe("leading punctuation", () => {
    it("skips to the first actual letter", () => {
      expect(deriveInitials({ first: "'Abdullah", last: "Karim" })).toBe("A.K");
      expect(deriveInitials({ first: "Fatima", last: "-Rashid" })).toBe("F.R");
      expect(deriveInitials({ first: '"Yusuf', last: "Karim" })).toBe("Y.K");
    });

    it("keeps the particle's letter when the name genuinely starts with one", () => {
      // "Al-Rashid" initials to A, not R — this is what the mock-ups show
      expect(deriveInitials({ first: "Fatima", last: "Al-Rashid" })).toBe("F.A");
      expect(deriveInitials({ first: "Fatima", last: "bint Ahmad" })).toBe("F.B");
    });
  });

  describe("non-Latin scripts", () => {
    it("handles Arabic", () => {
      expect(deriveInitials({ first: "فاطمة", last: "الراشد" })).toBe("ف.ا");
    });

    /* Bengali writes a syllable as an akshara: the consonant plus its
       dependent vowel sign is one grapheme cluster and one written unit.
       So "ফাতিমা" (Fa-ti-ma) initials to "ফা" — the whole syllable "Fa",
       not the bare consonant "ফ", which on its own is a different letter.
       That is why this is more than one code point wide, and it is
       correct. See the note in initials.ts about display width. */
    it("keeps a dependent vowel sign attached, giving a full akshara", () => {
      expect(deriveInitials({ first: "ফাতিমা", last: "করিম" })).toBe("ফা.ক");
    });

    it("handles Cyrillic, including its casing", () => {
      expect(deriveInitials({ first: "фатима", last: "карим" })).toBe("Ф.К");
    });
  });

  describe("combining marks", () => {
    /* This is the case that a naive `name.first[0]` gets wrong: the ring
       is a separate code point, so indexing returns a bare "A" and the
       member's initial is silently misspelled. */
    it("keeps a decomposed diacritic attached to its base letter", () => {
      const decomposed = "Ålof"; // Ålof, ring written separately
      expect(decomposed[0]).toBe("A"); // what the naive version would give
      expect(deriveInitials({ first: decomposed, last: "Karim" })).toBe("Å.K");
    });

    it("handles a precomposed diacritic identically in output length", () => {
      expect(deriveInitials({ first: "Ålof", last: "Karim" })).toBe("Å.K");
    });

    it("upper-cases a lowercase accented letter", () => {
      expect(deriveInitials({ first: "élise", last: "tremblay" })).toBe("É.T");
    });
  });

  describe("unusable input returns null rather than an empty string", () => {
    it("rejects an empty given name", () => {
      expect(deriveInitials({ first: "" })).toBeNull();
      expect(deriveInitials({ first: "   " })).toBeNull();
    });

    it("rejects a given name with no letters in it", () => {
      expect(deriveInitials({ first: "---" })).toBeNull();
      expect(deriveInitials({ first: "123" })).toBeNull();
      expect(deriveInitials({ first: "!@#$" })).toBeNull();
    });

    it("rejects an unusable given name even when the family name is fine", () => {
      expect(deriveInitials({ first: "  ", last: "Karim" })).toBeNull();
    });

    it("falls back to a single letter when only the family name is unusable", () => {
      expect(deriveInitials({ first: "Fatima", last: "---" })).toBe("F");
    });
  });
});
