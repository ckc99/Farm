# Editing the website with Sanity

All text, photos and SEO tags are edited at **https://free-range-farm.sanity.studio/** (Sanity project `uigdmztc`).
The site itself stays plain HTML on GitHub Pages, so Google sees normal static pages.

## How an edit reaches the site

1. Edit and **Publish** in Sanity Studio.
2. Within about 30 minutes the GitHub Action **Sync content from Sanity** (`.github/workflows/sanity-sync.yml`) picks it up.
   To see it sooner: repo **Actions** tab → *Sync content from Sanity* → **Run workflow**.
3. `scripts/sanity-sync.mjs` rewrites only the parts of the HTML between `<!-- cms:… -->` and `<!-- /cms:… -->`
   markers, commits, and GitHub Pages redeploys in about a minute.

It refuses to change anything if Sanity returns no products or no WhatsApp number, and a field left empty
never blanks the page (the old content stays).

## Where to edit what

| In the Studio | Controls |
|---|---|
| **Site Settings & Contact** | Company, Mr. Chong, phone, WhatsApp number, email, address, Instagram, Facebook — used in every footer, the Contact page, the Privacy Policy, every WhatsApp button and the business details Google reads. Also the share image and the footer copyright line |
| **Home Page** | Hero photo, label, title, tagline · "Learn more about our farm" banner · "What we sell" photo, text and link · We Promise label, picture, heading, intro and points · free range explainer and link · SEO |
| **Our Farm Page** | Heading, intro, wide egg photo · "How they are kept" rows (title, text, photo) · Facebook video link · gallery photos and text · all small labels · SEO |
| **Products Page** | Labels and heading · "How It Reaches You" (3 points) · FAQ heading · product button text · SEO |
| **Product** | Each product card (photo, name, text, key points, price, out of stock / hidden, order) |
| **FAQ** | FAQ on the Products page, also sent to Google |
| **Contact Page** | Heading, farm location, labels, message, photo · SEO (phone/email/social come from Site Settings) |
| **Blog: Ayam Kampung article** | `blog1.html` — title, intro, full article text (headings, lists, bold, links), SEO |
| **Privacy Policy Page** | Heading, "Last updated", full policy text; the "Contact details" block is filled from Site Settings |
| **404 Page** | Label, heading, text, SEO |

**Every page has an "SEO — Google & sharing" box**: page title, meta description, and the title/description
shown when the link is shared on Facebook or WhatsApp.

Text tips: press Enter for a new line · `**bold**` · `[link text](page.html)`. In longer texts, leave an empty line to start a new paragraph.

Still edited in the HTML: page layout and design, the menu/footer link names, icons, and the cookie banner text.

**Don't delete or rename the `<!-- cms:… -->` comments** — the sync uses them to know what to replace.

## Optional: instant updates with a webhook

Not needed — the 30-minute check already works. Add this only if you want changes live within a minute.

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate.
   Repository access: only `ckc99/Farm`. Permissions: **Contents: Read and write**. Copy the token.
2. https://www.sanity.io/manage → project **Free Range Farm (Chicken)** → API → Webhooks → Create:
   - URL: `https://api.github.com/repos/ckc99/Farm/dispatches`
   - Dataset: `production`, Trigger on: Create, Update, Delete
   - Filter: `!(_id in path("drafts.**"))`
   - Projection: `{"event_type": "sanity-publish"}`
   - HTTP method: POST
   - HTTP headers: `Authorization: Bearer <your token>` and `Accept: application/vnd.github+json`

Note: GitHub pauses scheduled actions in a repo with no commits for 60 days. If that happens, the Actions tab shows a banner — click **Enable workflow**.

## Testing locally

```bash
node scripts/sanity-sync.mjs            # pulls live content and rewrites the HTML
git diff                                # see what changed
```
