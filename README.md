# NikahCanada

Marketing site and app interface mock-ups for **NikahCanada**, a Muslim marriage
match and matrimony service based in Montreal, operating across Canada.

Built with Next.js 15 (App Router), React 19 and Tailwind v4. Original design —
not a template.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Routes

| Route | What |
| --- | --- |
| `/` | Landing page — hero, why register, six steps, scholars, safeguards, pricing, FAQ, CTA |
| `/how-it-works` | The full six-step process, annotated against ten app screens |

## Where things live

| Path | What |
| --- | --- |
| `src/content/site.ts` | **All landing-page copy.** Components hold no hard-coded text. |
| `src/content/howItWorks.ts` | How It Works copy plus the numbered callout positions. |
| `src/app/globals.css` | Design tokens — palette, type scale, radii, the `arch` motif. |
| `src/components/` | One file per landing-page section. |
| `src/components/app/` | Phone frame, UI kit, and the ten app screens. |
| `src/app/icon.svg` | Favicon (the arch-and-star mark). |
| `public/images/` | Photography + `CREDITS.md`. |

## Design

Dark, warm and editorial — closer to a private members' club than an app, which
is the opposite of how this category usually presents. Three decisions carry it:

1. **A serif display face** (Fraunces) against a clean sans (Plus Jakarta Sans).
2. **A dome-arch motif** repeated through image frames, step markers, the logo
   and the closing panel.
3. **Value rhythm** — two dark anchors (hero, scholars) with cream and shell
   alternating between, so the page has depth rather than one flat tone.

Palette is `#10201A` ink, `#FBF7EF` cream, `#B8894A` brass. Every token lives in
the `@theme` block of `globals.css`; nothing is a magic number.

**Container rule:** horizontal padding goes on the *outer* element with `.shell`
nested inside. Putting padding inside the container instead pushes it out of
alignment with the rest of the page — `scripts/align.cjs` guards this.

## Verification scripts

Playwright-based checks. Start the dev server first.

```bash
node scripts/responsive.cjs   # 12 widths x 2 routes; names the overflowing element
node scripts/links.cjs        # every route + fragment resolves
node scripts/align.cjs        # nav and content share the same rails
node scripts/measure.cjs      # all 10 app screens fit their phone frames
npm run shot                  # full-page + per-section screenshots
node scripts/to-jpeg.cjs <in> <out.jpg> [quality] [maxWidth]
```

Each exits non-zero on failure **and if it finds nothing to test** — a checker
that silently matches zero elements is worse than no checker.

## Known gaps

- **The matchmaking fee amount is invented.** `$149` on the app's fee screen is a
  placeholder; the live service publishes no figure. Flagged in
  `src/content/howItWorks.ts`.
- **No Articles page.** The nav and footer link to it; both currently point home.
- **No registration flow.** Every "Register Now" scrolls to the closing CTA.
  A real `/register` route with a form is the obvious next piece.
- **Hero image licence is unverified** — supplied rather than sourced. See
  `public/images/CREDITS.md`. The other images are Unsplash / public domain.
- **App screens are static mock-ups.** No backend; every name, figure and message
  is invented for illustration.
- **The nav is transparent over the hero**, so every new page must open with a
  dark section or the nav becomes invisible.
