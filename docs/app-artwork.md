# App artwork

Created with the built-in image generation tool for the existing NikahCanada mint-and-peach botanical style.

## Assets

| Asset | Used in |
| --- | --- |
| `public/images/app/discover.webp` | Dashboard (desktop) and empty browse/saved/new lists |
| `public/images/app/conversations.webp` | Conversation empty states on desktop and phone |
| `public/images/app/review.webp` | Dashboard before browsing (desktop) and empty staff review queue |

All three are 512 × 512 WebP files with alpha transparency. Original 1280 × 1280 PNGs are preserved alongside them as `*-source.png`. WebPs are exported at quality 88 with alpha quality 100.

`src/components/app/illustration.tsx` provides the reusable `AppIllustration` component. It uses Next Image, reserves a square layout slot, and renders decorative artwork with empty alt text. Adjacent copy explains each state. Standard illustrations display at 160px; compact illustrations display at 112px.

## Generation prompts

### discover

Use case: stylized-concept. Asset type: individual decorative empty-state illustration for NikahCanada, a Muslim marriage web app. Create polished hand-painted editorial artwork with delicate watercolor textures within the objects, softly rounded forms, restrained shadows, and clean readable silhouettes. Palette must match the site: mint #9ACCC9, deep teal #2F6F6B, peach #F4A492, blush #FAD2C9, ivory accents. Single cohesive centered composition, square format, objects comfortably within the central 80 percent. Real transparent background with alpha, no opaque ground, no checkerboard. Sophisticated welcoming wedding stationery aesthetic, airy and uncluttered, looks beautiful at 160 pixels wide. No text, letters, numbers, brands, logo, watermark, people or faces. Subject: two overlapping ivory profile cards with rounded corners, each with a small simple abstract teal botanical medallion and two short mint decorative rules, never a portrait. A mint magnifying glass rests across their lower-right edges, with a small peach heart near its lens. A single delicate sprig of mint foliage and blush blossoms grows gently beside the cards. The illustration conveys thoughtfully discovering a compatible partner.

### conversations

Use case: stylized-concept. Asset type: individual decorative empty-state illustration for NikahCanada, a Muslim marriage web app. Create polished hand-painted editorial artwork with delicate watercolor textures within the objects, softly rounded forms, restrained shadows, and clean readable silhouettes. Palette must match the site: mint #9ACCC9, deep teal #2F6F6B, peach #F4A492, blush #FAD2C9, ivory accents. Single cohesive centered composition, square format, objects comfortably within the central 80 percent. Real transparent background with alpha, no opaque ground, no checkerboard. Sophisticated welcoming wedding stationery aesthetic, airy and uncluttered, looks beautiful at 160 pixels wide. No text, letters, numbers, brands, logo, watermark, people or faces. Subject: two rounded speech bubbles, one soft mint with a deep teal edge and one ivory with a delicate peach edge, gently overlapping. A small peach heart floats between them. A delicate mint olive sprig and two tiny blush blossoms nestle beneath the bubbles. The illustration conveys warm, respectful conversations. No ellipsis, typography or written messages in the bubbles.

### review

Use case: stylized-concept. Asset type: individual decorative empty-state illustration for NikahCanada, a Muslim marriage web app. Create polished hand-painted editorial artwork with delicate watercolor textures within the objects, softly rounded forms, restrained shadows, and clean readable silhouettes. Palette must match the site: mint #9ACCC9, deep teal #2F6F6B, peach #F4A492, blush #FAD2C9, ivory accents. Single cohesive centered composition, square format, objects comfortably within the central 80 percent. Real transparent background with alpha, no opaque ground, no checkerboard. Sophisticated welcoming wedding stationery aesthetic, airy and uncluttered, looks beautiful at 160 pixels wide. No text, letters, numbers, brands, logo, watermark, people or faces. Subject: an upright ivory document board with a rounded mint clip and three neat short mint decorative rules, with a prominent small deep teal check mark on a mint shield in front at the lower-right. A delicate branch of mint leaves and blush blossoms curves around the lower-left. The illustration conveys a thoughtful profile review and care for privacy. No padlocks or lettering.

