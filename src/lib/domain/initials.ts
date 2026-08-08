/* ------------------------------------------------------------------
   Initials — the only identity a member has before step 06.

   Every screen before contact exchange shows a member as "F.A" or
   "Y.K": no name, no photograph. This derives that string from the
   legal name held on the user record, and it is the one piece of a
   member's real identity that is allowed to leak early — so it must be
   exactly two letters, and it must be right for every script the
   service takes registrations in.

   Pure. No I/O. See docs/APP-PLAN.md §4.3, §5.2.
   ------------------------------------------------------------------ */

export type LegalName = {
  first: string;
  /* Absent for a mononym, which is normal in several of the communities
     this service takes registrations from. Not an error. */
  last?: string;
};

/* Grapheme granularity, not code points and definitely not `str[0]`.
   A name like "Ålöf" written with a combining ring (U+030A) is two code
   points; taking the first would render "A" and silently drop the mark,
   which is someone's name spelled wrong on every screen they appear on. */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/* The first grapheme that actually contains a letter. Skips the leading
   punctuation that real names carry — the apostrophe in "'Abdullah", a
   stray hyphen, a quotation mark pasted in from a document. */
function firstLetter(value: string): string | null {
  for (const { segment } of GRAPHEMES.segment(value)) {
    if (/\p{L}/u.test(segment)) {
      /* toUpperCase, not toLocaleUpperCase: the result is stored and
         compared, so it must not depend on the server's locale. The
         Turkish dotless-i mapping would make "i" render differently
         between two machines running the same code. */
      return segment.toUpperCase();
    }
  }
  return null;
}

/**
 * Derives the display initials for a member.
 *
 * Note on display width: a grapheme is not always one code point, and in
 * Indic scripts it is usually not one *character* either — a Bengali
 * given name initials to a full akshara such as "ফা", because the
 * consonant and its vowel sign are one written unit. The `Initials`
 * component must therefore size text to fit rather than assume two
 * characters. In practice `legalName` comes from government ID, which in
 * Canada is Latin script, so this is an edge case rather than the norm —
 * but it is a real one and it must not render as overflow.
 *
 * Returns `null` when no letter can be found in the given name — the
 * caller should treat that as a validation failure rather than storing
 * an empty string. A profile with no derivable initials must not go
 * live, because there would be nothing to show a match.
 */
export function deriveInitials(name: LegalName): string | null {
  const first = firstLetter(name.first ?? "");
  if (!first) return null;

  const last = firstLetter(name.last ?? "");
  return last ? `${first}.${last}` : first;
}
