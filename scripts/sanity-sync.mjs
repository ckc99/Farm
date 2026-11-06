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
  "faqs": *[_type == "faq" && defined(question)] | order(coalesce(sortOrder, 999) asc){question, answer},
  "ourFarm": *[_id == "ourFarmPage"][0]{
    title, intro, differenceTitle, videoUrl, videoSideTitle, galleryTitle,
    differences[]{_key, title, text, "image": image{alt, "url": asset->url, "w": asset->metadata.dimensions.width, "h": asset->metadata.dimensions.height}},
    gallery[]{_key, title, text, "image": image{alt, "url": asset->url, "w": asset->metadata.dimensions.width, "h": asset->metadata.dimensions.height}}
  },
  "docs": *[_type in ["siteSettings", "homePage", "ourFarmPage", "productsPage", "contactPage", "blogPost", "privacyPage", "notFoundPage"] && !(_id in path("drafts.**"))],
  "assets": *[_type in ["sanity.imageAsset", "sanity.fileAsset"]]{_id, url, "w": metadata.dimensions.width, "h": metadata.dimensions.height}
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
  const f = d.ourFarm;
  const pp = (d.docs || []).find((x) => x._id === 'productsPage') || {};
  const orderText = pp.orderButtonText || 'Order on WhatsApp';
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
            <a class="card__btn" href="${esc(waLink(s.whatsappNumber, msg))}" target="_blank" rel="noopener">${esc(orderText)}</a>
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

    // ---------- Our Farm page (left as-is if the Our Farm document is missing) ----------
    'farm-intro': () => f && `
      <h1 class="section-title">${esc(f.title)}</h1>

      <p class="naming__lede">
        ${esc(f.intro)}
      </p>
      `,

    'farm-difference-title': () => f && esc(f.differenceTitle),

    'farm-differences': () => f && '\n' + (f.differences || []).map((r) => `        <article class="steading__row">
          ${r.image?.url ? `<figure class="steading__photo">
            <img src="${esc(imgUrl(r.image))}" alt="${esc(r.image.alt || r.title)}"${r.image.w ? ` width="${r.image.w}" height="${r.image.h}"` : ''} loading="lazy">
          </figure>
          ` : ''}<div class="steading__text">
            <h3 class="steading__title">${esc(r.title)}</h3>
            <p>${esc(r.text)}</p>
          </div>
        </article>`).join('\n\n') + '\n      ',

    'farm-video': () => f && `
        <h2 class="video__side">${esc(f.videoSideTitle)}</h2>
`,

    'farm-video-button': () => f && f.videoUrl && `<button class="video__facade" type="button"
                    data-video-src="${esc(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(f.videoUrl)}&show_text=false&width=560&height=315&t=0`)}"
                    data-video-title="A short video tour of Free Range Farm in Kampar, Perak">
              <img class="video__poster" src="assets/farm-sm.webp" alt="" width="896" height="504" loading="lazy">
              <span class="video__play" aria-hidden="true"></span>
              <span class="video__label">
                Play the farm video
                <span class="video__note">Loads from Facebook, which may set cookies</span>
              </span>
            </button>`,

    'farm-gallery-title': () => f && esc(f.galleryTitle),

    'farm-gallery': () => f && '\n' + (f.gallery || []).map((g, i) => `        <figure class="plate">
          ${g.image?.url ? `<img src="${esc(imgUrl(g.image))}" alt="${esc(g.image.alt || g.title)}"${g.image.w ? ` width="${g.image.w}" height="${g.image.h}"` : ''}${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}>
          ` : ''}<figcaption>
            <h3 class="plate__title">${esc(g.title)}</h3>
            <p class="plate__desc">${esc(g.text)}</p>
          </figcaption>
        </figure>`).join('\n\n') + '\n\n      ',
  };
}

// ---------- chicken-site extras for the generic engine ----------
const LISTS = {};

function siteRenderers(d) {
  const s = d.settings || {};
  return {
    'contact-whatsapp': () => `<a class="contact__link" href="${esc(waLink(s.whatsappNumber))}" target="_blank" rel="noopener">${esc(s.phone)}</a>
                  <span class="contact__sub">WhatsApp &middot; ${esc(s.contactPerson)}</span>`,
    'contact-email': () => `<a class="contact__link" href="mailto:${esc(s.email)}">${esc(s.email)}</a>`,
    'contact-social': () => '\n' +
      (s.instagramUrl ? `                <li><a class="contact__link" href="${esc(s.instagramUrl)}" target="_blank" rel="noopener">Instagram</a></li>\n` : '') +
      (s.facebookUrl ? `                <li><a class="contact__link" href="${esc(s.facebookUrl)}" target="_blank" rel="noopener">Facebook</a></li>\n` : '') +
      '              ',
  };
}

function customPt(d) {
  const s = d.settings || {};
  return {
    // "Contact details" block inside the Privacy Policy text
    contactDetails: () => `<p>
  ${esc(s.companyName)}<br>
  ${esc(s.address || '').replace(/,\s*(\d{5})/, ',<br>\n  $1')}<br>
  WhatsApp: <a href="${esc(waLink(s.whatsappNumber))}" target="_blank" rel="noopener">${esc(s.phone)}</a><br>
  Email: <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>
</p>`,
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

const MARKER = /<!-- cms:([a-z-]+)((?: [\w.:-]+)*) -->([\s\S]*?)<!-- \/cms:\1(?:\2)? -->/g;

// =====================================================================
// Generic content engine
// Markers look like  <!-- cms:KIND KEY [OPTIONS] --> … <!-- /cms:KIND KEY [OPTIONS] -->
// KEY is "documentId.field.subField" in Sanity, e.g. "aboutPage.story2.title".
//   t       text (Enter = <br>, **bold**, [link](url))   txt   plain text   title  whole <title> tag
//   attr    sets one attribute on the tag inside          img   photo (src/alt/size)
//   imgurl  photo URL in a <meta content="…">              paras paragraphs (blank line = new <p>)
//   pt      rich text (headings, lists, bold, links)       list  repeating items (see LISTS)
//   yt      YouTube video                                  video MP4 video + poster photo
//   wa      WhatsApp button (number from Site Settings)    jsonld  Google structured data
// A missing value never blanks the page: the original HTML is kept.
// =====================================================================
const IMG_MAX_W = 1600;

function indexContent(d) {
  const docs = {}; for (const doc of d.docs || []) docs[doc._id] = doc;
  const assets = {}; for (const a of d.assets || []) assets[a._id] = a;
  return { docs, assets };
}

function getPath(idx, key) {
  const [doc, ...path] = key.split('.');
  let v = idx.docs[doc];
  for (const p of path) { if (v == null) return undefined; v = v[p]; }
  return v;
}

const linkHtml = (href, inner) => /^https?:/.test(href)
  ? `<a href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>`
  : `<a href="${esc(href)}">${inner}</a>`;

// Editor text → HTML: escape, then [text](url), **bold**, new lines.
function inlineFmt(s = '') {
  let out = esc(String(s).trim());
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => linkHtml(url.replace(/&amp;/g, '&'), text));
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return out.replace(/\n/g, '<br>\n');
}

function setAttr(tag, name, value) {
  const v = esc(value);
  const re = new RegExp(`(\\s${name}=")[^"]*(")`);
  if (re.test(tag)) return tag.replace(re, (m, a, b) => a + v + b);
  return tag.replace(/^<([a-zA-Z]+)/, (m, t) => `<${t} ${name}="${v}"`);
}

const assetOf = (idx, img) => (img && img.asset && img.asset._ref ? idx.assets[img.asset._ref] : undefined);
const imgSrc = (a, full) => `${a.url}?${full ? '' : `w=${IMG_MAX_W}&fit=max&`}auto=format`;

function imgAttrs(idx, img) {
  const a = assetOf(idx, img);
  if (!a) return 'src="" alt=""';
  return `src="${esc(imgSrc(a))}" alt="${esc(img.alt || '')}"${a.w ? ` width="${a.w}" height="${a.h}"` : ''}`;
}

function ptSpans(b) {
  const defs = Object.fromEntries((b.markDefs || []).map((m) => [m._key, m]));
  return (b.children || []).map((c) => {
    let t = esc(c.text || '').replace(/\n/g, '<br>\n');
    const marks = c.marks || [];
    if (marks.includes('em')) t = `<em>${t}</em>`;
    if (marks.includes('strong')) t = `<strong>${t}</strong>`;
    for (const m of marks) { const def = defs[m]; if (def && def._type === 'link' && def.href) t = linkHtml(def.href, t); }
    return t;
  }).join('');
}

function ptToHtml(blocks = [], h2cls, ulcls, custom = {}) {
  const out = []; let list = null;
  const flush = () => { if (list) { out.push(`<ul class="${ulcls}">\n${list.join('\n')}\n</ul>`); list = null; } };
  for (const b of blocks) {
    if (b._type !== 'block') { flush(); if (custom[b._type]) out.push(custom[b._type](b)); continue; }
    const inner = ptSpans(b);
    if (b.listItem) { (list = list || []).push(`  <li>${inner}</li>`); continue; }
    flush();
    if (b.style === 'h2' || b.style === 'h3') out.push(`<${b.style} class="${h2cls}">${inner}</${b.style}>`);
    else out.push(`<p>\n  ${inner}\n</p>`);
  }
  flush();
  return '\n' + out.join('\n') + '\n';
}

const ptPlain = (s) => String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\n/g, ' ').trim();

function youTubeId(url = '') {
  const m = String(url).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

function genericRenderers(d, LISTS, CUSTOM_PT) {
  const idx = indexContent(d);
  const s = d.settings || {};
  const val = (key) => getPath(idx, key);
  const has = (v) => v !== undefined && v !== null;

  return {
    t: ([key]) => { const v = val(key); return has(v) ? inlineFmt(v) : null; },
    txt: ([key]) => { const v = val(key); return has(v) ? esc(v) : null; },
    // <title> cannot contain comments (browsers show them), so this marker wraps the whole tag
    title: ([key]) => { const v = val(key); return has(v) ? `<title>${esc(v)}</title>` : null; },
    attr: ([key, name], orig) => { const v = val(key); return has(v) ? setAttr(orig, name, String(v)) : null; },
    img: ([key, full], orig) => {
      const img = val(key); const a = assetOf(idx, img);
      if (!a) return null;
      let tag = setAttr(orig, 'src', imgSrc(a, full === 'full'));
      tag = setAttr(tag, 'alt', img.alt || '');
      if (a.w) { tag = setAttr(tag, 'width', String(a.w)); tag = setAttr(tag, 'height', String(a.h)); }
      return tag;
    },
    imgurl: ([key], orig) => { const a = assetOf(idx, val(key)); return a ? setAttr(orig, 'content', `${a.url}?w=1200&fit=max`) : null; },
    paras: ([key, cls]) => {
      const v = val(key); if (!has(v)) return null;
      return String(v).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
        .map((p) => `<p${cls && cls !== '-' ? ` class="${cls}"` : ''}>${inlineFmt(p)}</p>`).join('\n        ');
    },
    pt: ([key, h2cls, ulcls]) => { const v = val(key); return Array.isArray(v) ? ptToHtml(v, h2cls, ulcls, CUSTOM_PT) : null; },
    list: ([key]) => {
      const items = val(key); const cfg = LISTS[key];
      if (!Array.isArray(items) || !cfg) return null;
      return cfg.lead + items.map((it, i) => cfg.template.replace(/\{\{(\w+)(?:\|(\w+))?\}\}/g, (m, f, mod) => {
        if (f === 'i') return String(i + 1);
        if (mod === 'img') return imgAttrs(idx, it[f]);
        if (mod === 'attr') return esc(ptPlain(it[f]));
        return inlineFmt(it[f]);
      })).join(cfg.sep) + cfg.trail;
    },
    yt: ([key], orig) => { const id = youTubeId(val(key)); return id ? setAttr(orig, 'src', `https://www.youtube.com/embed/${id}`) : null; },
    video: ([key, posterKey], orig) => {
      let tag = orig;
      const f = val(key); const fa = f && f.asset && idx.assets[f.asset._ref];
      if (fa) tag = setAttr(tag, 'src', fa.url);
      const pa = assetOf(idx, val(posterKey));
      if (pa) tag = setAttr(tag, 'poster', imgSrc(pa));
      return tag;
    },
    wa: ([key], orig) => { const v = val(key); return has(v) && s.whatsappNumber ? setAttr(orig, 'href', waLink(s.whatsappNumber, v)) : null; },
    jsonld: ([faqKey], orig) => {
      const m = orig.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (!m) return null;
      let data; try { data = JSON.parse(m[1]); } catch { return null; }
      const faq = faqKey ? val(faqKey) : null;
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (!n || typeof n !== 'object') return;
        if ('telephone' in n && s.whatsappNumber) n.telephone = '+' + s.whatsappNumber;
        if ('email' in n && s.email) n.email = s.email;
        if (Array.isArray(n.sameAs)) n.sameAs = n.sameAs.map((u) =>
          /instagram\.com/.test(u) && s.instagramUrl ? s.instagramUrl : /facebook\.com/.test(u) && s.facebookUrl ? s.facebookUrl : u);
        if (n['@type'] === 'FAQPage' && Array.isArray(faq)) n.mainEntity = faq.map((q) => ({
          '@type': 'Question', name: ptPlain(q.qZh) + ptPlain(q.qEn),
          acceptedAnswer: { '@type': 'Answer', text: ptPlain(q.aZh) + ptPlain(q.aEn) },
        }));
        Object.values(n).forEach(walk);
      };
      walk(data);
      return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')}\n</script>`;
    },
  };
}

async function main() {
  const data = await loadData();
  validate(data);
  const r = { ...genericRenderers(data, LISTS, customPt(data)), ...renderers(data), ...siteRenderers(data) };
  const files = (await readdir(ROOT)).filter((f) => f.endsWith('.html'));
  let changed = 0;
  for (const file of files) {
    const p = path.join(ROOT, file);
    const before = await readFile(p, 'utf8');
    const after = before.replace(MARKER, (all, name, opts, inner) => {
      if (!r[name]) throw new Error(`${file}: unknown marker cms:${name}`);
      const out = r[name](opts.trim().split(' '), inner);
      if (out === undefined || out === null || out === false) return all;
      return `<!-- cms:${name}${opts} -->${out}<!-- /cms:${name}${opts} -->`;
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
