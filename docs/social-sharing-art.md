# Social sharing image

Created with the built-in image generation tool, using the existing marketing logo and mosque artwork as visual references.

Final website image: `public/images/social-share-v1.jpg` (1200 × 630, JPEG). Original generated artwork: `public/images/social-share-source.png`.

The image was resized and encoded as JPEG with Sharp. No visual elements or text were changed after generation. The versioned URL helps distinguish this image from older preview artwork.

Root metadata supplies Open Graph and Twitter large image cards. The main public pages use separate branded images:

- Home: `public/images/social-share-v1.jpg`
- Pricing: `public/images/social-pricing-v1.jpg`
- How It Works: `public/images/social-how-it-works-v3.jpg`

Pricing and How It Works use their own titles, descriptions, images, and page URLs. Registration, sign in, account recovery, invitation, and legal pages retain accurate page titles and descriptions with the home brand image as a fallback. Private member and staff pages redirect anonymous sharing crawlers to sign in; account and legal pages are marked noindex. Tokens from email links never appear in the metadata URL.

Absolute URLs use `APP_ORIGIN`, falling back to `https://nikahcanada.ca`. All three image assets are public 1200 × 630 JPEGs.

The Pricing card and original How It Works card were generated with the built-in image tool and their existing page art as visual references, then resized and JPEG encoded with Sharp. Originals: `public/images/social-pricing-source.png` and `public/images/social-how-it-works-source.png`. The current How It Works card uses the sharper generated Toronto waterfront hero (`public/images/how-canada-hero-v2.webp`) with the existing brand logo and page text composited in Sharp, so its artwork matches the page while preserving legible text.

These changes must be deployed to the public site before public sharing previews can use them. Existing messages can retain a cached preview.

## Pricing card generation prompt

```text
Use case: ads-marketing
Asset type: finished Open Graph social sharing preview card, landscape ratio 1.905:1, intended final export 1200 by 630.
Brand references: image 1 is the existing homepage social card. Preserve its NikahCanada.ca script logo, maple leaf, tagline, premium Lora-like serif typography, dark ink, coral, ivory, sage, soft photographic arch and blossoms. The card should clearly belong to the same family, but have its own page-specific composition. Use exact text only. High contrast and readability at small messaging-app thumbnail size. No people, watermark, buttons, prices, fake UI, dash characters, or extra copy. No invented claims.
Image 2 is the pricing page floral illustration, reference for floral corner detail.
Create a pricing-page card. Warm ivory background with a delicate gold Islamic arch on the right and subtle watercolor pink flowers/olive leaves in the corners. Left 60% mostly quiet ivory.
Top left reproduce the brand logo from image 1, smaller but crisp, including the tagline "MUSLIM MARRIAGE | CANADA WIDE".
Main exact headline on left: "Simple, transparent" dark ink, next line "pricing." coral.
Supporting exact text below: "Free to browse. Connect when interest is mutual."
Tiny footer text exact: "1, 3, or 5 connections". Keep all text clearly visible within safe margins.
```

## Original How It Works card generation prompt

```text
Use case: ads-marketing
Asset type: finished Open Graph social sharing preview card, landscape ratio 1.905:1, intended final export 1200 by 630.
Brand references: image 1 is the existing homepage social card. Preserve its NikahCanada.ca script logo, maple leaf, tagline, premium Lora-like serif typography, dark ink, coral, ivory, sage, soft photographic arch and blossoms. The card should clearly belong to the same family, but have its own page-specific composition. Use exact text only. High contrast and readability at small messaging-app thumbnail size. No people, watermark, buttons, prices, fake UI, dash characters, or extra copy. No invented claims.
Image 2 is the new How It Works hero photograph, reference for the right-side mosque and arch.
Create a How It Works page card. On the right, a luminous white mosque through a warm stone arch with spring blossoms; the left 58% soft ivory negative space. Gentle sage detail around the lower edge.
Top left faithfully reproduce the brand logo from image 1 including tagline "MUSLIM MARRIAGE | CANADA WIDE".
Main exact headline on left: "A thoughtful path" dark ink, next line "to Nikah." coral.
Supporting exact text below: "Create a profile. Find a match. Connect with intention."
Tiny footer text exact: "How NikahCanada works". Keep all text clearly visible within safe margins.
```

## Final generation prompt

```text
Use case: ads-marketing
Asset type: finished Open Graph social sharing card for the NikahCanada.ca Muslim marriage website, landscape 1200:630 aspect ratio (1.905:1).
Input images: Image 1 is the existing brand logo to preserve closely; Image 2 is the existing homepage photograph, a reference for the mosque, blossoms, colors and calm atmosphere.
Create one elegant, premium, polished promotional card. Warm ivory ground, dark ink and muted sage, coral accent. Left 60 percent holds a clean editorial layout with generous consistent spacing; right 40 percent shows a luminous white mosque dome and slender minaret through a softly detailed warm stone Islamic arch, small delicate white and pale pink blossoms in the lower right corner, sky blue, subtle ivory fade into the left. No people.
Place the supplied NikahCanada.ca dark/coral script logo with red maple leaf in the upper left, rendered faithfully with the same text and its small tagline "MUSLIM MARRIAGE | CANADA WIDE".
Main headline, large refined serif, left aligned, dark ink first line and coral second line, exact text:
"Serious about"
"Nikah?"
Below the headline use clean dark sans serif with this exact text on two lines:
"A thoughtful path to marriage."
"Faith, family, and sincere intentions."
Lower left small clean sans serif exact text "Serving Muslims across Canada".
Keep the important typography within 70 pixel side margins, no text on the photo, clear contrast, enough scale to read in a WhatsApp link preview thumbnail. Understated luxury, no busy textures behind text, no gradients on text, no buttons, no prices, no fabricated badges or ratings, no dash characters, no watermark. The card should look like the current website's branding, not a screenshot of a website or a device.
```
