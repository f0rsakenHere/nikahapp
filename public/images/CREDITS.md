# Image credits

All photography is from Wikimedia Commons. Titles and licences are as recorded
at download time. **CC BY and CC BY-SA require attribution** — before launch,
either surface these credits on the site or replace the files with licensed
stock.

| File | Used for | Source | Licence |
| --- | --- | --- | --- |
| `hero-mosque.jpg` | Home hero, arch image | **Supplied by the client** | **⚠️ unverified — see below** |
| `hero-bg.jpg` | Home hero, background | Blue-domed mosque, by **Youssef Swelim** on Unsplash ([HPkhJmnBJos](https://unsplash.com/photos/HPkhJmnBJos)) | Unsplash Licence |
| `hiw-bg.jpg` | How It Works, background | White domed mosque, by **Leon Macapagal** on Unsplash ([ViBR4NrdgYA](https://unsplash.com/photos/ViBR4NrdgYA)) | Unsplash Licence |
| `scholars-mosque.jpg` | Scholars section | Sheikh Zayed Grand Mosque, by **Hameed Ullah** on Unsplash ([eeI0al-Qx8k](https://unsplash.com/photos/eeI0al-Qx8k)) | Unsplash Licence |
| `hero-carving.jpg` | Unused alternate | Arabic words carved into the Qutb Minar, Delhi | Public domain |
| `hero-alhambra.jpg` | Unused alternate | Stuccos and mosaics, Cuarto Dorado, Alhambra, Granada | CC0 |

The Unsplash Licence permits commercial use with no permission or attribution
required. Crediting Hameed Ullah is not obligatory but is good practice.

## ⚠️ `hero-mosque.jpg`

This was supplied directly rather than sourced from Commons, so its provenance
and licence are unknown to this repo. **Before launch, confirm you own it or
hold a commercial licence.** If it came from a stock or wallpaper site, check
the terms — many free-to-download images are not free to use commercially.

The two Commons alternates above are public domain / CC0 and can be swapped in
with one line in `src/content/site.ts` if the licence does not hold up.

## Selection rules

Every image is architecture, carving, tilework or manuscript — **no faces
anywhere**, which is deliberate for this audience. A shared warm duotone
(`photo-warm` in `globals.css`) makes images from different sources read as one
set.

Candidates that were rejected: mosque interiors containing crowds (faces),
saturated stained glass (fought the green-and-brass palette), and museum object
shots on flat white backgrounds (no tonal relationship to the page).
