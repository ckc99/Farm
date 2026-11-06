# Editing the website with Sanity

Content is edited at **https://free-range-farm.sanity.studio/** (Sanity project `uigdmztc`).
The site itself is still plain HTML on GitHub Pages, so search engines see normal static pages.

## How an edit reaches the site

1. Edit and **Publish** in Sanity Studio.
2. Within about 30 minutes the GitHub Action **Sync content from Sanity** (`.github/workflows/sanity-sync.yml`) picks it up.
   To see it sooner, open the repo's **Actions** tab → *Sync content from Sanity* → **Run workflow**.
3. The action runs `scripts/sanity-sync.mjs`, which rewrites only the parts of the HTML between
   `<!-- cms:… -->` and `<!-- /cms:… -->` markers, then commits. GitHub Pages redeploys in about a minute.

It refuses to change anything if Sanity returns no products or no WhatsApp number.

## What Sanity controls

| In Sanity | On the site |
|---|---|
| Site Settings & Contact | Footer on every page: company name, Mr. Chong, phone/WhatsApp, email, Instagram, Facebook, address. WhatsApp number is also used by every **Order on WhatsApp** button |
| Home Page | Hero title & tagline, "What we sell" text, "We Promise" intro and points, "What is free range chicken?" text |
| Products | Product cards on `products.html` (order, photo, text, key points, optional price, out of stock / hidden) |
| FAQ | FAQ list on `products.html` **and** the FAQ structured data (JSON-LD) Google reads |

Everything else (layout, Our Farm, Contact page body, packing section, blog page, page titles/meta tags) is still edited in the HTML.

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
