/* Read once at the top rather than inside the IIFE below, so anything added
   later shares the same answer. */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Smooth scrolling (Lenis, loaded via <script> before this file). It eases
   toward the target scroll position via real window.scrollTo() calls each
   frame, so scroll position stays readable to anything that needs it.
   Skipped for prefers-reduced-motion. */
(function initSmoothScroll() {
  if (prefersReducedMotion || typeof Lenis === 'undefined') return;
  const lenis = new Lenis();

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // In-page anchor links (nav, footer) ease via Lenis instead of snapping
  // instantly, so they match the feel of wheel-scrolling.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      lenis.scrollTo(target);
    });
  });
})();

(function initFaqAccordion() {
  const toggles = document.querySelectorAll('.faq__toggle');

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';

      toggles.forEach((other) => other.setAttribute('aria-expanded', 'false'));
      toggle.setAttribute('aria-expanded', String(!expanded));
    });
  });
})();


/* Fades [data-reveal] elements up as they come into view — the three lines
   of the primer, staggered. The hidden state is applied HERE rather than in
   the stylesheet on purpose: if this file fails to load or is blocked, the
   content stays visible instead of being stranded at opacity: 0 with
   nothing left to reveal it.
   Bails out entirely under prefers-reduced-motion, which leaves the markup
   untouched and the section plainly visible. unobserve() after the first
   pass so it reveals once and does not replay on every scroll back up. */
(function initReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;
  if (prefersReducedMotion || !('IntersectionObserver' in window)) return;

  targets.forEach((el, i) => {
    el.classList.add('is-revealing');
    el.style.transitionDelay = `${i * 90}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('is-revealing');
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    },
    // -12% bottom margin so it fires once the element is properly in view
    // rather than the instant its first pixel clears the fold.
    { threshold: 0.15, rootMargin: '0px 0px -12% 0px' }
  );

  targets.forEach((el) => observer.observe(el));
})();


/* ---------------------------------------------------------------------------
   Cookie consent
   ---------------------------------------------------------------------------
   Google Analytics is no longer in the page head. It loads from here, and only
   after someone accepts — so a visitor who declines, or who never answers, has
   no analytics cookies set at all. A banner that merely announces cookies that
   were already written is worse than none, because it documents the problem
   instead of fixing it.

   Accept and Decline are the same size and weight on purpose: a decline that is
   harder to find than an accept is not a free choice.

   The choice lives in localStorage, not a cookie, so storing the answer does
   not itself require consent. Every access is wrapped — Safari private mode
   throws on localStorage rather than returning null, and an exception here
   would take the rest of this file down with it.
--------------------------------------------------------------------------- */
const GA_ID = 'G-S15Q10S40B';
const CONSENT_KEY = 'frf-consent';

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch (e) {
    return null;
  }
}

function writeConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch (e) {
    /* Private mode, or storage disabled. The choice holds for this page view
       and the banner returns next time — annoying, but it never silently
       treats a decline as an accept. */
  }
}

function loadAnalytics() {
  if (window.__frfAnalyticsLoaded) return;
  window.__frfAnalyticsLoaded = true;

  const tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(tag);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);
}

/* Declining after having accepted has to clear what was already set, or the
   decline only stops future visits. Expiring on both the host and the dotted
   parent domain because gtag writes to the registrable domain, and the exact
   one differs between a custom domain and github.io. */
function clearAnalyticsCookies() {
  const host = location.hostname;
  const domains = ['', host, '.' + host, '.' + host.split('.').slice(-2).join('.')];
  document.cookie.split(';').forEach((entry) => {
    const name = entry.split('=')[0].trim();
    if (!/^(_ga|_gid|_gat)/.test(name)) return;
    domains.forEach((domain) => {
      document.cookie =
        name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' +
        (domain ? '; domain=' + domain : '');
    });
  });
}

(function initConsent() {
  /* Injected rather than written into all seven pages, so the wording and the
     markup live in one place. Nothing is lost without script: with no script
     there is no analytics either, so there is nothing to consent to. */
  function buildBanner() {
    const banner = document.createElement('div');
    banner.className = 'consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'consent-title');
    banner.setAttribute('aria-modal', 'false');
    banner.innerHTML =
      '<div class="consent__inner">' +
        '<div class="consent__copy">' +
          '<p class="consent__title" id="consent-title">Cookies</p>' +
          '<p class="consent__text">We would like to use Google Analytics to see which pages ' +
          'people read, which sets cookies on your device. It loads only if you agree. ' +
          'Read our <a href="privacy.html">privacy policy</a>.</p>' +
        '</div>' +
        '<div class="consent__actions">' +
          '<button class="consent__btn" type="button" data-consent="denied">Decline</button>' +
          '<button class="consent__btn" type="button" data-consent="granted">Accept</button>' +
        '</div>' +
      '</div>';

    banner.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-consent]');
      if (!btn) return;
      const choice = btn.getAttribute('data-consent');
      writeConsent(choice);
      banner.remove();
      if (choice === 'granted') {
        loadAnalytics();
      } else {
        clearAnalyticsCookies();
      }
    });

    /* First child of <body>, not last: it is fixed to the bottom of the screen
       either way, but this puts it near the start of the tab order instead of
       behind every link on the page. */
    document.body.insertBefore(banner, document.body.firstChild);
    return banner;
  }

  /* Without this a decision is final and invisible — there would be no way to
     turn analytics back off. Injected into each footer's Explore list. */
  function addFooterControl() {
    const list = document.querySelector('.footer__col ul');
    if (!list) return;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = 'Cookie settings';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (!document.querySelector('.consent')) buildBanner();
    });
    item.appendChild(link);
    list.appendChild(item);
  }

  if (readConsent() === 'granted') loadAnalytics();
  if (readConsent() === null) buildBanner();
  addFooterControl();
})();

/* ---------------------------------------------------------------------------
   Facebook video, click to load
   ---------------------------------------------------------------------------
   The embed used to be an <iframe> in the markup, so Facebook set cookies for
   everyone who opened the page — including people who never pressed play, and
   if they were signed in, Meta could tie the visit to their account. Now the
   page ships a still image and the iframe is created only on a click, which is
   an explicit choice to load it. It also saves every non-viewer the weight of
   Facebook's player.
--------------------------------------------------------------------------- */
(function initVideoFacade() {
  const facade = document.querySelector('[data-video-src]');
  if (!facade) return;

  facade.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = facade.getAttribute('data-video-src');
    frame.title = facade.getAttribute('data-video-title') || 'Video';
    frame.setAttribute('scrolling', 'no');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute(
      'allow',
      'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share'
    );
    facade.replaceWith(frame);
    frame.focus();
  });
})();
