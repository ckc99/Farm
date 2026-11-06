#!/usr/bin/env node
/*
  Sanity → static HTML sync for free-range-farm.com
  ------------------------------------------------------------------
  The site stays plain static HTML (good for SEO and GitHub Pages).
  This script pulls the published content from Sanity and rewrites only the
  parts of each page that sit between marker comments, e.g.

      <!-- cms:products -->  ...generated...  <!-- /cms:products -->

  Anything outside the markers is never touched. Run by
  .github/workflows/sanity-sync.yml whenever content is published in Sanity.

  Local use:
      node scripts/sanity-sync.mjs                 # fetch from Sanity
      node scripts/sanity-sync.mjs --data file.json  # use saved JSON (testing)
*/
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'uigdmztc';
const DATASET = 'production';
const API_VERSION = '2026-11-06';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://free-range-farm.com';

const QUERY = `{
  "settings": *[_id == "siteSettings"][0]{
    companyName, contactPerson, phone, whatsappNumber, email, address, instagramUrl, facebookUrl
  },
  "home": *[_id == "homePage"][0]{
    heroTitle, heroTagline, spotlightTitle, spotlightPoints, promiseIntro,
    promises[]{_key, title, text}, explainerTitle, explainerText
  },
  "products": *[_type == "product" && availability != "hidden" && defined(slug.current)]
    | order(coalesce(sortOrder, 999) asc, name asc){
      name, eyebrow, "slug": slug.current, description, features, price, availability, whatsappText,
      "image": image{alt, "url": asset->url, "w": asset->metadata.dimensions.width, "h": asset->metadata.dimensions.height}
    },
  "faqs": *[_type == "faq" && defined(question)] | order(coalesce(sortOrder, 999) asc){question, answer}
}`;

// ---------- helpers ----------
const esc = (s = '') =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const imgUrl = (img) => `${img.url}?w=1200&fit=max&auto=format`;
const waLink = (number, text) =>
  `https://wa.me/${encodeURIComponent(number)}${text ? `?text=${encodeURIComponent(text).replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%2F/g, '/').replace(/'/g, '%27')}` : ''}`;
const PROMISE_ICONS = ['icon-nature.webp', 'icon-drumstick.webp', 'icon-leaf.webp'];

async function loadData() {
  const i = process.argv.indexOf('--data');
  if (i > -1) return JSON.parse(await readFile(process.argv[i + 1], 'utf8'));
  const url = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}` +
    `?query=${encodeURIComponent(QUERY)}&perspective=published`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sanity request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).result;
}

// ---------- renderers (one per marker name) ----------
function renderers(d) {
  const s = d.settings;
  const h = d.home || {};
  return {
    'hero': () => `
      <h1 class="intro__title">${esc(h.heroTitle)}</h1>
      <p class="intro__tagline">
        ${esc(h.heroTagline)}
      </p>
      `,

    'offer': () => `
        <h2 class="offer__title">${esc(h.spotlightTitle)}</h2>
        <p class="offer__text">
          ${(h.spotlightPoints || []).map(esc).join(' · ')}
        </p>
        `,

    'promise-intro': () => `
        <p class="promise__text">
          ${esc(h.promiseIntro)}
        </p>
        `,

    'promises': () => '\n' + (h.promises || []).map((p, i) => `        <li class="promise__item">
          <span class="promise__marker"><img src="assets/${PROMISE_ICONS[Math.min(i, PROMISE_ICONS.length - 1)]}" alt="" aria-hidden="true"></span>
          <div class="promise__item-body">
            <p class="promise__item-text">${esc(p.title)}</p>
            <p class="promise__item-desc">${esc(p.text)}</p>
          </div>
        </li>`).join('\n') + '\n        ',

    'primer': () => `
      <p class="primer__text" data-reveal>
        ${esc(h.explainerText)}
      </p>

      <h2 class="primer__heading" data-reveal>${esc(h.explainerTitle)}</h2>
      `,

    'products': () => '\n' + d.products.map((p) => {
      const meta = [...(p.price ? [p.price] : []), ...(p.availability === 'outOfStock' ? ['Out of stock'] : []), ...(p.features || [])];
      const msg = `${p.whatsappText || `Hi, I would like to order ${p.name}.`} ${SITE_URL}/products.html`;
      const img = p.image?.url
        ? `<img src="${esc(imgUrl(p.image))}" alt="${esc(p.image.alt || p.name)}"${p.image.w ? ` width="${p.image.w}" height="${p.image.h}"` : ''} loading="lazy">`
        : `<img src="assets/brownlogo.png" alt="" aria-hidden="true" loading="lazy">`;
      return `
        <article class="card" id="${esc(p.slug)}">
          <div class="card__media">
            ${img}
          </div>
          <div class="card__body">
            ${p.eyebrow ? `<p class="card__eyebrow">${esc(p.eyebrow)}</p>\n            ` : ''}<h2 class="card__name">${esc(p.name)}</h2>
            <p class="card__desc">
              ${esc(p.description)}
            </p>
            <ul class="card__meta">
${meta.map((m) => `              <li>${esc(m)}</li>`).join('\n')}
            </ul>
            <a class="card__btn" href="${esc(waLink(s.whatsappNumber, msg))}" target="_blank" rel="noopener">Order on WhatsApp</a>
          </div>
        </article>
`;
    }).join('') + '\n      ',

    'faq': () => '\n' + d.faqs.map((f, i) => `        <div class="faq__item">
          <button class="faq__toggle" type="button" aria-expanded="false" aria-controls="faq-answer-${i + 1}">
            <span class="faq__question">${esc(f.question)}</span>
            <span class="faq__icon" aria-hidden="true">+</span>
          </button>
          <div class="faq__answer" id="faq-answer-${i + 1}">
            <div class="faq__answer-inner">
              <p>${esc(f.answer)}</p>
            </div>
          </div>
        </div>`).join('\n') + '\n\n      ',

    'faq-jsonld': () => `
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: d.faqs.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
}, null, 2).replace(/</g, '\\u003c')}
</script>
`,

    'footer-company': () => esc(s.companyName).replace(/ (Sdn\.? ?Bhd\.?)$/i, '<br>$1'),

    'footer-contact': (opts) => {
      const assets = opts.includes('abs') ? '/assets/' : 'assets/';
      return `
        <p class="footer__contact">
          <span class="footer__contact-name">${esc(s.contactPerson)}</span>
          <span class="footer__contact-row">
            <img class="footer__whatsapp-icon" src="${assets}w-icon.webp" alt="" aria-hidden="true">
            <a href="${esc(waLink(s.whatsappNumber))}" target="_blank" rel="noopener">${esc(s.phone)}</a>
          </span>
          <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>
        </p>

        <p class="footer__label footer__label--follow">Follow</p>
        <ul class="footer__social">
${s.instagramUrl ? `          <li><a href="${esc(s.instagramUrl)}" target="_blank" rel="noopener">Instagram</a></li>\n` : ''}${s.facebookUrl ? `          <li><a href="${esc(s.facebookUrl)}" target="_blank" rel="noopener">Facebook</a></li>\n` : ''}        </ul>
      `;
    },

    'footer-address': () => esc(s.address),
  };
}

// ---------- sanity checks: never publish an empty or broken site ----------
function validate(d) {
  const problems = [];
  if (!d?.settings) problems.push('Site Settings document is missing');
  else if (!d.settings.whatsappNumber) problems.push('WhatsApp number is empty');
  if (!d?.products?.length) problems.push('no visible products');
  if (!d?.home) problems.push('Home Page document is missing');
  if (problems.length) throw new Error('Refusing to update the site: ' + problems.join('; '));
}

const MARKER = /<!-- cms:([a-z-]+)((?: [a-z]+)*) -->([\s\S]*?)<!-- \/cms:\1 -->/g;

async function main() {
  const data = await loadData();
  validate(data);
  const r = renderers(data);
  const files = (await readdir(ROOT)).filter((f) => f.endsWith('.html'));
  let changed = 0;
  for (const file of files) {
    const p = path.join(ROOT, file);
    const before = await readFile(p, 'utf8');
    const after = before.replace(MARKER, (all, name, opts) => {
      if (!r[name]) throw new Error(`${file}: unknown marker cms:${name}`);
      return `<!-- cms:${name}${opts} -->${r[name](opts.trim().split(' '))}<!-- /cms:${name} -->`;
    });
    if (after !== before) {
      await writeFile(p, after);
      changed++;
      console.log(`updated ${file}`);
    }
  }
  console.log(changed ? `${changed} file(s) updated` : 'no changes');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
