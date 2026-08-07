# Free Range Farm

Marketing site for Free Range Farm (Agri Agrobusiness Sdn. Bhd.), a free-range and capon chicken farm based in Ipoh, Perak, Malaysia.

**Live site:** [free-range-farm.com](https://free-range-farm.com/)

## Tech stack

Plain HTML, CSS, and vanilla JavaScript — no framework, no build step, no dependencies. Everything runs directly in the browser from static files.

## Project structure

```
index.html       All page markup, meta tags, and structured data (single-page site)
css/style.css     All styling
js/main.js        Scroll-driven interactions (see Features below)
assets/           Images, video, icons, and favicon
robots.txt        Crawler rules, points to sitemap.xml
sitemap.xml       Sitemap for search engines
CNAME             Custom domain config for GitHub Pages
```

## Features

The page is a single scrolling document with these sections: Intro, We Promise, Gallery, Products, and FAQ.

Notable scroll-driven interactions in `js/main.js`:
- **Chicken parallax** — the intro badge's chicken sketch and circular text rotate opposite each other as the page scrolls.
- **Promise pin** — the "We Promise" section sticks in place while its background image pans/zooms and three feature cards slide in one by one.
- **Video frame morph** — the gallery's chick video grows from a small square into its native aspect ratio and slides into place as the section scrolls.
- **Gallery card slide** — three photo/caption cards stack in the same slot; each new card slides up over the previous one as the user scrolls through the pinned stage.
- **FAQ accordion** — click-to-expand question list.

All scroll effects respect `prefers-reduced-motion` (skipping straight to their end state) and fall back to a simpler static layout below the 700px breakpoint where a pinned scroll stage wouldn't fit.

## SEO

- Descriptive `<title>`, meta description, and `<link rel="canonical">`.
- Open Graph and Twitter Card tags (image: `assets/OGtag.png`, 1200×630).
- JSON-LD structured data: `LocalBusiness` (address/contact) and `FAQPage` (mirrors the visible FAQ content).
- `robots.txt` and `sitemap.xml` at the site root.
- Google Analytics (gtag.js).

## Local development

No build step — just serve the folder and open it in a browser. Opening `index.html` directly (`file://`) mostly works, but running a local static server avoids any path/CORS quirks:

```
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deployment

Hosted on GitHub Pages with a custom domain configured via `CNAME` (`free-range-farm.com`). Pushing to the deployed branch publishes the site directly — there's no build/compile step in between.

## Assets

Images are served as WebP where possible and the gallery video as WebM, both for smaller file sizes than the original JPG/PNG/MP4 sources.
