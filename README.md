# NikahCanada

Marketing site and app interface mock-ups for **NikahCanada**, a Muslim marriage
match and matrimony service based in Montreal, operating across Canada.

Built with Next.js 15 (App Router), React 19 and Tailwind v4. The design is
adapted from the licensed **Bridely** wedding template, which sits unmodified in
`bridely-wedding-event-management-html-template-.../` as the reference to measure
against.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests for src/lib
npm run typecheck
npm run build
```

> **Do not run `npm run build` while the dev server is up.** They share `.next`
> and clobber each other; afterwards dev serves 404s for every chunk including
> `layout.css`, and the page renders completely unstyled. Stop the server,
> `rm -rf .next`, then restart. The Playwright checkers now detect this state and
> say so rather than reporting phantom layout bugs — see `scripts/lib/styled.cjs`.

## Routes

| Route | What |
| --- | --- |
| `/` | Landing page — banner, why register, six steps, fee, scholars, confidentiality, the wali's role, contact form, closing gallery |
| `/how-it-works` | The full six-step process, annotated against ten app screens |

Both routes compose the same header, footer and watercolour banner ground, and
the app screens inside the device frames draw on the same palette and faces.

The product itself — member app, wali portal and staff console, on MongoDB — is
not built yet. The build plan is [`docs/APP-PLAN.md`](docs/APP-PLAN.md); its §3
lists the decisions that block it.

## Where things live

| Path | What |
| --- | --- |
| `src/app/(marketing)/` | The public site. Route groups do not appear in the URL — `(marketing)/page.tsx` still serves `/`. |
| `src/app/(app)/` | The member app and wali portal. Auth-gated, `noindex`. Empty until Phase 2. |
| `src/app/(admin)/` | The staff console. Separate group so it can be split into its own deployment later. Empty until Phase 4. |
| `src/lib/db/` | The MongoDB connection and the collection names. Server-only. |
| `src/lib/domain/` | Pure product logic — no DOM, no database, no network. Unit-tested with Vitest. |
| `src/content/home.ts` | **All homepage copy**, plus nav, footer and the shared `brand`. Components hold no hard-coded text. |
| `src/content/howItWorks.ts` | How It Works copy plus the numbered callout positions. |
| `src/app/globals.css` | Design tokens, the motion block and the layout utilities. |
| `src/components/bridely/` | One file per page section, with shared pieces in `primitives/`. |
| `src/components/app/` | Phone frame, UI kit, and the ten app screens. The kit is the design system the product will grow from; the screens stay as marketing artefacts. |
| `public/images/bridely/` | Template art and photography + `CREDITS.md`. |

## Database

MongoDB Atlas, native driver, no ODM — the reasoning is in
[`docs/APP-PLAN.md`](docs/APP-PLAN.md) §4.2.

```bash
cp .env.example .env.local     # fill in MONGODB_URI
npm run db:ping                # connect, write, transact
```

`db:ping` deliberately proves more than a ping. An Atlas user scoped to `read`
connects perfectly happily and then fails on the first insert, and a standalone
deployment accepts writes and then refuses transactions — which §5.12 makes
mandatory for contact release and fee capture. So it checks all three, and on
failure it names the likely cause (IP allowlist, placeholder left in the URI,
un-encoded password, missing privilege) instead of printing a driver stack trace.

`src/lib/db/client.ts` is the only place a `MongoClient` is constructed. It caches
the connection promise on `globalThis`, because Next re-evaluates modules on every
edit in dev and on every cold start in serverless, and a module-level client leaks
a connection pool each time. Collection names live in `collections.ts` and are
never written as string literals elsewhere — a typo there is not an error, it is a
silently empty collection.

The connection sets Stable API v1 but **not** `strict`, unlike the snippet Atlas
copies out. Strict mode rejects `$search` and `createSearchIndexes`, which the
plan needs for matchmaker candidate search.

## Design

Light, floral and airy. Mint (`#9ACCC9`) carries structure — the top strip, the
nav's active link, hairlines, selected states — and peach (`#F4A492`) is reserved
for the one action being asked for on any given screen. Playfair Display sets
display type, Jost sets everything else.

**Both brand colours are tints, not text colours.** Mint is 1.77:1 on white and
1.77:1 under white; peach is 1.99:1 either way. So a label is never set in mint
or peach, and never reversed out of one:

| Situation | Use | Ratio |
| --- | --- | --- |
| Text or an icon on a mint or peach **fill** | near-black | 10.5:1 / 9.4:1 |
| Mint **type or hairline** on white | `--color-accent-deep` `#2F6F6B` | 5.8:1 |
| Peach **type or icon** on white or a peach tint | `--color-peach-deep` `#9C422D` | 6.5:1 |

The fills themselves never change, so the design reads the same — only the
foreground does. `node scripts/contrast.cjs` checks it.

The signature shape is a rectangle with two opposite corners rounded hard and two
left square. It runs from the hero photography down to the initials tile that
stands in for a member's photograph inside the app.

Every token lives in the first `@theme` block of `globals.css`. The second block,
labelled **superseded**, is the original Sakinah system: its palette and type
scale are no longer drawn on by anything rendered, but its radii, shadows and the
`shell` / `arch` layout utilities still are. It is kept so the orphaned landing
components in `src/components/*.tsx` still compile — delete them together.

**Container rule:** horizontal padding goes on the *outer* element with `.shell-b`
nested inside. Putting padding inside the container instead pushes it out of
alignment with the rest of the page — `scripts/align.cjs` guards this.

## Verification

```bash
npm test          # Vitest — src/lib/**/*.test.ts, node environment, no DOM
```

`src/lib/domain` is deliberately free of I/O so it can be tested exhaustively
without a database. Keep it that way: it is where the introduction state machine
and the authorisation rules will live.

### Playwright checks

Start the dev server first. Every checker reads `BASE` (default
`http://127.0.0.1:3000`) — needed when another project already holds port 3000:

```bash
npx next dev -p 3007
BASE=http://127.0.0.1:3007 node scripts/audit.cjs
```

They verify the server is actually *this* project before measuring anything.
Another Next app on the port answers `/` with 200 and `/how-it-works` with 404,
and the geometry scripts then report "NO PHONE FRAMES FOUND", which reads as a
broken selector rather than a wrong server. `scripts/lib/base.cjs` checks
`<html lang="en-CA">` and says so instead.

```bash
node scripts/responsive.cjs   # 12 widths x 2 routes; names the overflowing element
node scripts/links.cjs        # every route + fragment resolves
node scripts/align.cjs        # every .shell-b on a page shares its rails
node scripts/audit.cjs        # console, network, menu, carousel, form, a11y, keyboard, tap targets
node scripts/motion.cjs       # no element is stranded at opacity 0, normal or reduced motion
node scripts/measure.cjs      # nothing in an app screen overflows its phone frame
node scripts/squash.cjs       # nothing in an app screen is silently compressed
node scripts/contrast.cjs     # text contrast vs WCAG 2.2 AA  (see note below)
npm run shot                  # full-page + per-section screenshots
OUT=… ROUTE=… BANDS=name:y:height node scripts/crop.cjs   # full-res crops of a long page
node scripts/to-jpeg.cjs <in> <out.jpg> [quality] [maxWidth]
```

Each exits non-zero on failure **and if it finds nothing to test** — a checker
that silently matches zero elements is worse than no checker. For the same
reason, every geometry checker calls `assertStyled()` first: measuring an
unstyled page does not error, it produces confident nonsense, and in `align.cjs`
it produces a false *pass*.

**`contrast.cjs` currently exits non-zero, and that is accurate rather than
broken.** The app screens pass. The remaining failures are all in components
inherited from the template — `PillButton`, `TopBar`, `Eyebrow`, `Wordmark` —
which set labels in mint or peach, or reverse white out of them, at ratios
between 1.62:1 and 1.99:1 against a 4.5:1 requirement. Fixing them changes how
the homepage looks, so it is a decision, not a defect fix. Until it is taken,
run this one deliberately rather than in CI.

It reports text only. Icons and other non-text UI need 3:1 and are not covered —
those were swept by hand in the app screens.

`measure.cjs` and `squash.cjs` are a pair, and you need both. The app screens
are flex columns inside `overflow-hidden`, so content that does not fit has two
ways to fail: it overflows the frame (which `measure.cjs` sees) or its flex
children compress until something disappears (which they do not, because every
bounding box stays politely inside the frame). `squash.cjs` compares rendered
height against natural height and catches the second.

## Known gaps

- **The matchmaking fee amount is invented.** `$149` on the app's fee screen is a
  placeholder; the live service publishes no figure. Flagged in
  `src/content/howItWorks.ts`.
- **No logo file.** The header, footer and app sign-up screen set the name as a
  typographic wordmark instead. See `primitives/Wordmark.tsx`.
- **No social accounts, phone number or email** have been supplied, so the top
  bar and footer icons point nowhere and the footer's contact block is omitted
  rather than filled with something invented.
- **The contact form has no endpoint.** It acknowledges locally and sends nothing.
- **No registration flow.** Every "Register Now" scrolls to the contact form.
  A real `/register` route is the obvious next piece.
- **Neither legal page exists.** Both footer links point nowhere.
- **App screens are static mock-ups.** No backend; every name, figure and message
  is invented for illustration.
- **Nine orphaned landing components** (`src/components/Hero.tsx`, `Why`, `Steps`,
  `Scholars`, `Safety`, `Fee`, `Faq`, `Cta`, `Trust`, plus `Nav`, `Footer`,
  `ui.tsx` and `content/site.ts`) are left from the pre-rebuild design and are
  imported by no route.
