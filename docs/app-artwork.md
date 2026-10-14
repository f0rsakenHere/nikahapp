# App artwork

Created with the built-in image generation tool for the existing NikahCanada mint-and-peach botanical style.

## Assets

| Asset | Used in |
| --- | --- |
| `public/images/app/discover.webp` | Dashboard (desktop) and empty browse/saved/new lists |
| `public/images/app/conversations.webp` | Conversation empty states on desktop and phone |
| `public/images/app/review.webp` | Dashboard before browsing (desktop) and empty staff review queue |
| `public/images/app/profile.webp` | Profile overview and registration header |
| `public/images/app/requests.webp` | Empty inbound requests and valid wali invitation header |
| `public/images/app/privacy.webp` | Sign-in, account, and wali portal headers |
| `public/images/app/notifications.webp` | Empty notifications feed |

All seven are 512 × 512 WebP files with alpha transparency. Original 1280 × 1280 PNGs are preserved alongside them as `*-source.png`. WebPs are exported at quality 88 with alpha quality 100.

`src/components/app/illustration.tsx` provides the reusable `AppIllustration` component. It uses Next Image, reserves a square layout slot, and renders decorative artwork with empty alt text. Adjacent copy explains each state. Standard illustrations display at 160px; compact illustrations display at 112px; small header illustrations display at 64px. Auth header artwork is hidden below 360px to give long titles room.

## Generation prompts

### discover

Use case: stylized-concept. Asset type: individual decorative empty-state illustration for NikahCanada, a Muslim marriage web app. Create polished hand-painted editorial artwork with delicate watercolor textures within the objects, softly rounded forms, restrained shadows, and clean readable silhouettes. Palette must match the site: mint #9ACCC9, deep teal #2F6F6B, peach #F4A492, blush #FAD2C9, ivory accents. Single cohesive centered composition, square format, objects comfortably within the central 80 percent. Real transparent background with alpha, no opaque ground, no checkerboard. Sophisticated welcoming wedding stationery aesthetic, airy and uncluttered, looks beautiful at 160 pixels wide. No text, letters, numbers, brands, logo, watermark, people or faces. Subject: two overlapping ivory profile cards with rounded corners, each with a small simple abstract teal botanical medallion and two short mint decorative rules, never a portrait. A mint magnifying glass rests across their lower-right edges, with a small peach heart near its lens. A single delicate sprig of mint foliage and blush blossoms grows gently beside the cards. The illustration conveys thoughtfully discovering a compatible partner.

### conversations

Use case: stylized-concept. Asset type: individual decorative empty-state illustration for NikahCanada, a Muslim marriage web app. Create polished hand-painted editorial artwork with delicate watercolor textures within the objects, softly rounded forms, restrained shadows, and clean readable silhouettes. Palette must match the site: mint #9ACCC9, deep teal #2F6F6B, peach #F4A492, blush #FAD2C9, ivory accents. Single cohesive centered composition, square format, objects comfortably within the central 80 percent. Real transparent background with alpha, no opaque ground, no checkerboard. Sophisticated welcoming wedding stationery aesthetic, airy and uncluttered, looks beautiful at 160 pixels wide. No text, letters, numbers, brands, logo, watermark, people or faces. Subject: two rounded speech bubbles, one soft mint with a deep teal edge and one ivory with a delicate peach edge, gently overlapping. A small peach heart floats between them. A delicate mint olive sprig and two tiny blush blossoms nestle beneath the bubbles. The illustration conveys warm, respectful conversations. No ellipsis, typography or written messages in the bubbles.

### review

Use case: stylized-concept. Asset type: individual decorative empty-state illustration for NikahCanada, a Muslim marriage web app. Create polished hand-painted editorial artwork with delicate watercolor textures within the objects, softly rounded forms, restrained shadows, and clean readable silhouettes. Palette must match the site: mint #9ACCC9, deep teal #2F6F6B, peach #F4A492, blush #FAD2C9, ivory accents. Single cohesive centered composition, square format, objects comfortably within the central 80 percent. Real transparent background with alpha, no opaque ground, no checkerboard. Sophisticated welcoming wedding stationery aesthetic, airy and uncluttered, looks beautiful at 160 pixels wide. No text, letters, numbers, brands, logo, watermark, people or faces. Subject: an upright ivory document board with a rounded mint clip and three neat short mint decorative rules, with a prominent small deep teal check mark on a mint shield in front at the lower-right. A delicate branch of mint leaves and blush blossoms curves around the lower-left. The illustration conveys a thoughtful profile review and care for privacy. No padlocks or lettering.

### profile

Style reference: `public/images/app/discover-source.png`.

Use case: stylized-concept. Asset type: single decorative illustration for the premium NikahCanada Muslim marriage web app. The referenced image is a STYLE REFERENCE ONLY: match its delicate watercolor texture, refined wedding-stationery appearance, mint-teal and peach palette, warm ivory objects, fine botanical stems and subtle dimensional shading. Make one new cohesive square composition, centered comfortably within the central 80% so it reads clearly at 112 pixels wide. Actual transparent alpha background. Quiet, welcoming, elegant and uncluttered. No text, lettering, numbers, brands, logo, watermark, faces or people. No background wash, opaque ground or checkerboard. Subject: a small open ivory journal with two blank gently curved pages, a delicate mint botanical motif on one page, and a slender deep-teal fountain pen resting diagonally along its lower edge. A single airy spring sprig with mint leaves and two peach blossoms sits beside it. Convey thoughtfully telling your own story. The journal must not contain writing or handwriting.

### requests

Style reference: `public/images/app/discover-source.png`.

Use case: stylized-concept. Asset type: single decorative illustration for the premium NikahCanada Muslim marriage web app. The referenced image is a STYLE REFERENCE ONLY: match its delicate watercolor texture, refined wedding-stationery appearance, mint-teal and peach palette, warm ivory objects, fine botanical stems and subtle dimensional shading. Make one new cohesive square composition, centered comfortably within the central 80% so it reads clearly at 112 pixels wide. Actual transparent alpha background. Quiet, welcoming, elegant and uncluttered. No text, lettering, numbers, brands, logo, watermark, faces or people. No background wash, opaque ground or checkerboard. Subject: one ivory correspondence envelope with a softly folded peach flap and a small peach heart seal, with an ivory blank invitation card peeking from the top. A delicate mint branch and two peach blossoms curve around its lower edge. Convey a considered personal invitation. The card and envelope must have no typography or address.

### privacy

Style reference: `public/images/app/discover-source.png`.

Use case: stylized-concept. Asset type: single decorative illustration for the premium NikahCanada Muslim marriage web app. The referenced image is a STYLE REFERENCE ONLY: match its delicate watercolor texture, refined wedding-stationery appearance, mint-teal and peach palette, warm ivory objects, fine botanical stems and subtle dimensional shading. Make one new cohesive square composition, centered comfortably within the central 80% so it reads clearly at 112 pixels wide. Actual transparent alpha background. Quiet, welcoming, elegant and uncluttered. No text, lettering, numbers, brands, logo, watermark, faces or people. No background wash, opaque ground or checkerboard. Subject: a softly rounded mint shield with deep teal border and an elegant small ivory padlock resting in front, framed at its lower-left by a single restrained sprig of mint foliage and peach blossoms. A tiny peach heart adorns the shield. Convey privacy and care. Avoid an aggressive security badge, metallic shine or heavy rendering.

### notifications

Style reference: `public/images/app/discover-source.png`.

Use case: stylized-concept. Asset type: single decorative illustration for the premium NikahCanada Muslim marriage web app. The referenced image is a STYLE REFERENCE ONLY: match its delicate watercolor texture, refined wedding-stationery appearance, mint-teal and peach palette, warm ivory objects, fine botanical stems and subtle dimensional shading. Make one new cohesive square composition, centered comfortably within the central 80% so it reads clearly at 112 pixels wide. Actual transparent alpha background. Quiet, welcoming, elegant and uncluttered. No text, lettering, numbers, brands, logo, watermark, faces or people. No background wash, opaque ground or checkerboard. Subject: a small softly rounded mint-teal notification bell with an ivory clapper and a single small peach circular dot near its upper-right. A delicate mint leafy branch and two peach blossoms nestle around its base. Convey a calm personal update. No extra motion marks or alarm symbols.

## Premium styling

The shared `AppEmptyState` uses a gentle mint-to-white gradient, rounded corners, and the `shadow-app` design token. The same shadow is used on account panels, profile cards, the dashboard status panel, and onboarding steps. The profile overview has a compact illustrated introduction; form headers use smaller artwork. Existing state copy and application rules are preserved.

## Verification

- Project TypeScript check: passed with zero diagnostics.
- All three WebPs are served successfully by the running app, retaining alpha transparency.
- The reusable Next Image component was visually checked in isolated previews at 320px, 390px, and 1440px viewport widths. Images loaded at their intended sizes, with no horizontal overflow.
- Browse, conversations, and staff review routes compile and preserve their unauthenticated sign-in redirects.
- Authenticated live data flows were not exercised; the change is decorative.

### Extended set verification

- TypeScript check and `git diff --check` passed.
- Visual checks cover sign-in, registration, profile overview, requests, and notifications at 320px, 390px, 768px, and 1440px (20 views). No horizontal overflow; artwork loads successfully. Sign-in and registration use the running app. Authenticated screens are rendered from their actual components with in-memory preview data and no database access.
- Screenshots and the isolated render harness are in `.next/qa/premium-artwork/`, excluded from Git.
