# Social sharing image

Created with the built-in image generation tool, using the existing marketing logo and mosque artwork as visual references.

Final website image: `public/images/social-share-v1.jpg` (1200 × 630, JPEG). Original generated artwork: `public/images/social-share-source.png`.

The image was resized and encoded as JPEG with Sharp. No visual elements or text were changed after generation. The versioned URL helps distinguish this image from older preview artwork.

Root metadata supplies Open Graph and Twitter large image cards. Pricing and How It Works preserve their own titles, descriptions, and page URLs. Absolute URLs use `APP_ORIGIN`, falling back to `https://nikahcanada.ca`. The public image is accessible without a session.

These changes must be deployed to the public site before public sharing previews can use them. Existing messages can retain a cached preview.

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
