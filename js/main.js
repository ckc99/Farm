/* Shared by the scroll-driven modules below. This file has no bundler/module
   system, so these live as plain top-level helpers instead of being
   copy-pasted into each IIFE. */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/* Wraps `index + delta` into [0, length) — shared by the gallery and
   product slideshows' prev/next arrows. */
function cycleIndex(index, delta, length) {
  return (index + delta + length) % length;
}

/* Runs `fn` on scroll, throttled to at most once per animation frame. */
function onScrollFrame(fn) {
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        fn();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* Parallax: an element's rotation tracks page scroll. Shared by
   chicken-sketch.png and the "free range chicken" circular text around it,
   which spin at different rates in opposite directions. */
function initRotateOnScroll(selector, { degreesPerPixel, startingAngle = 0, transformPrefix = '' }) {
  const el = document.querySelector(selector);
  if (!el || prefersReducedMotion) return;

  function update() {
    const angle = startingAngle + (window.scrollY * degreesPerPixel);
    el.style.transform = `${transformPrefix}rotate(${angle}deg)`;
  }

  onScrollFrame(update);
  update();
}

initRotateOnScroll('.intro__badge-chicken', {
  degreesPerPixel: 0.08,
  startingAngle: -20,
  transformPrefix: 'translate(-50%, -50%) ',
});
initRotateOnScroll('.intro__badge-text', { degreesPerPixel: -0.15 });

/* Autoplay fallback: iOS Low Power Mode and some Android battery-saver
   modes silently block <video autoplay> outright to save power — the
   poster image just sits there forever with no error a site can recover
   from automatically. The only way around that policy is a real tap, so
   when autoplay fails (or the video stops on its own mid-scroll for the
   same reason) a play button appears over the poster; tapping it retries
   play() from within an actual user gesture, which browsers always honor
   regardless of power-saving settings. */
(function initVideoAutoplayFallback() {
  const video = document.querySelector('.gallery__video');
  const box = document.querySelector('.gallery__video-box');
  const playBtn = document.querySelector('.gallery__video-play');
  if (!video || !box || !playBtn) return;

  const showButton = () => box.classList.add('is-paused');
  const hideButton = () => box.classList.remove('is-paused');

  video.addEventListener('playing', hideButton);
  video.addEventListener('pause', showButton);

  const attempt = video.play();
  if (attempt && typeof attempt.catch === 'function') {
    attempt.catch(showButton);
  }

  playBtn.addEventListener('click', () => {
    video.play().catch(() => {});
  });
})();

/* Video frame morph: chicks.webm starts as a small square block centered
   in the gallery, then as the user scrolls through the stage's extra
   height, it grows (to a modest size, not the full column width) and
   reshapes from a 1:1 square into the video's native 1920:1440 ratio
   while sliding from centered to flush against the right edge of the
   content column. Once it settles at full size, the description
   paragraph to its left fades in. */
(function initVideoFrameMorph() {
  const stage = document.querySelector('.gallery__video-stage');
  const frame = document.querySelector('.gallery__video-frame');
  const main = document.querySelector('.gallery__video-main');
  const box = document.querySelector('.gallery__video-box');
  const caption = document.querySelector('.gallery__video-caption');
  /* Reference elements from the photo slideshow below — the video row is
     inset to land flush with these (photo's left edge, caption's right
     edge) rather than with the slideshow's own flanking arrow buttons, so
     the two rows line up visually. */
  const alignPhoto = document.querySelector('.gallery__slide-photo');
  const alignCaption = document.querySelector('.gallery__slide-caption');
  if (!stage || !main || !box) return;

  const videoRatio = 1920 / 1440;
  const descRevealAt = 0.95;
  const captionGap = 40;
  const narrowQuery = window.matchMedia('(max-width: 700px)');

  /* Re-measured on resize alongside stageWidth — layout-dependent, not
     scroll-dependent. Both stay 0 (no inset) at narrow widths, where the
     video stacks full-width above the caption instead of sitting beside it. */
  let insetLeft = 0;
  let insetRight = 0;
  function measureInset() {
    if (narrowQuery.matches || !alignPhoto || !alignCaption) {
      insetLeft = 0;
      insetRight = 0;
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    insetLeft = Math.max(0, alignPhoto.getBoundingClientRect().left - stageRect.left);
    insetRight = Math.max(0, stageRect.right - alignCaption.getBoundingClientRect().right);
  }

  /* .gallery__video-main is position: absolute, so it never contributes
     to .gallery__video-frame's own (sticky) box height — without this,
     the frame's height comes only from the much-shorter description
     paragraph, so the native CSS sticky release fires late relative to
     the video's own grow animation, leaving it pinned in place over the
     gallery grid until the frame's real box finally scrolls clear. */
  function applyMain(width, height, left, syncCaptionWidth) {
    main.style.width = `${width}px`;
    main.style.left = `${left}px`;
    box.style.height = `${height}px`;
    if (frame) frame.style.minHeight = `${height}px`;
    /* The caption's CSS width is sized independently of the video's actual
       position/inset, which on wide viewports left a wide gap of empty
       space between them — sizing and offsetting it off the video's real
       left edge and the photo-slideshow's inset instead keeps a fixed,
       small gap and a flush left edge regardless of viewport width. Only
       applies in the side-by-side (non-narrow) layout; at narrow widths
       the caption stacks below the video at full width, so the inline
       override is cleared and CSS takes back over. */
    if (caption) {
      if (syncCaptionWidth) {
        caption.style.marginLeft = `${insetLeft}px`;
        caption.style.width = `${Math.max(160, left - captionGap - insetLeft)}px`;
      } else {
        caption.style.marginLeft = '';
        caption.style.width = '';
      }
    }
  }

  if (prefersReducedMotion) {
    measureInset();
    const stageWidth = stage.clientWidth;
    const usableRight = stageWidth - insetRight;
    const w = narrowQuery.matches ? stageWidth : Math.min(480, (usableRight - insetLeft) * 0.4);
    applyMain(w, w / videoRatio, usableRight - w, !narrowQuery.matches);
    if (caption) caption.classList.add('is-visible');
    return;
  }

  /* Re-measured on resize rather than every scroll frame — the stage's own
     size only ever changes on resize, so re-reading it on each scroll tick
     just forces an extra synchronous layout for no reason. */
  let stageWidth = stage.clientWidth;
  let stageHeight = stage.offsetHeight;
  measureInset();

  function update() {
    const rect = stage.getBoundingClientRect();
    const pinRange = stageHeight - window.innerHeight;
    const progress = pinRange > 0
      ? Math.max(0, Math.min(1, -rect.top / pinRange))
      : 0;
    /* Below the 700px breakpoint there's no side-by-side paragraph to
       slide clear of, so the square grows in place instead of sliding
       right: full stage width at the end, centered the whole time. */
    const isNarrow = narrowQuery.matches;
    const usableRight = stageWidth - insetRight;

    const widthMin = Math.min(220, stageWidth * 0.28);
    const widthMax = isNarrow ? stageWidth : Math.min(480, stageWidth * 0.55);
    const width = lerp(widthMin, widthMax, progress);
    const ratio = lerp(1, videoRatio, progress);
    const height = width / ratio;
    const centeredLeft = (stageWidth - width) / 2;
    const rightAlignedLeft = usableRight - width;
    const left = isNarrow ? centeredLeft : lerp(centeredLeft, rightAlignedLeft, progress);

    applyMain(width, height, left, !isNarrow);

    if (caption) caption.classList.toggle('is-visible', progress >= descRevealAt);
  }

  onScrollFrame(update);

  window.addEventListener('resize', () => {
    stageWidth = stage.clientWidth;
    stageHeight = stage.offsetHeight;
    measureInset();
    update();
  });

  update();
})();

/* Photo slideshow: arrows step through a fixed set of farm photos, each
   with its own title/description. Same pattern as initProductSlideshow(),
   just simpler (no whole/cut toggle). */
(function initGallerySlideshow() {
  const photo = document.querySelector('.gallery__slide-photo');
  const img = document.getElementById('gallery-slide-img');
  const title = document.getElementById('gallery-slide-title');
  const desc = document.getElementById('gallery-slide-desc');
  const overlay = document.getElementById('gallery-slide-overlay');
  const overlayDesc = document.getElementById('gallery-slide-overlay-desc');
  const prevBtn = document.querySelector('.gallery__slideshow .arrow-btn--prev');
  const nextBtn = document.querySelector('.gallery__slideshow .arrow-btn--next');
  if (!photo || !img || !title || !desc || !prevBtn || !nextBtn) return;

  const slides = [
    {
      src: 'assets/gallery-1.webp',
      alt: 'Foraging for better nutrition',
      title: '"Foraging for Better Nutrition"',
      desc: 'Our free range chickens have access to the outdoors and hence are able to forage naturally on insects, seeds, and plants. Studies have shown that combined with increased activity, free-range chickens generally have higher levels of omega-3 fatty acids, which helps support heart health, reduce inflammation, and benefit brain function, compared to conventionally raised chickens. Also due to their active movement, free-range chicken breasts generally have significantly less saturated fat and hence are more tender and healthier.',
    },
    {
      src: 'assets/gallery-2.webp',
      alt: 'Slow-grown for premium texture',
      title: '"Slow-Grown for Premium Texture"',
      desc: 'In our farm, we practice a slow-growth system in raising our chickens. All our chickens are raised for more than 80 days! By allowing our chickens to grow naturally according to their biological needs, in contrast to current commercial fast-growing broilers, our chickens have better biological integrity and stronger immune systems. This allows us to refrain from the usage of antibiotics on our chickens. Also, because of this longer growing time, our chickens have finer breast fibers, which results in premium firm and juicy meat!',
    },
    {
      src: 'assets/gallery-3.webp',
      alt: 'Vacuum chicken',
      title: '"Locked-In Freshness"',
      desc: 'Our chickens are handled with vacuum packaging and blast freezing to preserve the premium meat quality. While the vacuum packaging ensures no oxidation degradation, the blast freezing ensures that no freezer burn happens within the meat. Together, they create the perfect combination to preserve the juiciness and tenderness of the meat.',
    },
  ];

  let index = 0;

  function render() {
    const slide = slides[index];
    img.src = slide.src;
    img.alt = slide.alt;
    title.textContent = slide.title;
    desc.textContent = slide.desc;
    if (overlayDesc) overlayDesc.textContent = slide.desc;
    if (overlay) overlay.classList.remove('is-visible');
  }

  prevBtn.addEventListener('click', () => {
    index = cycleIndex(index, -1, slides.length);
    render();
  });

  nextBtn.addEventListener('click', () => {
    index = cycleIndex(index, 1, slides.length);
    render();
  });

  /* Mobile-only tap-to-reveal: the description overlay is display:none on
     desktop (CSS), so this toggle has no visible effect there. */
  if (overlay) {
    photo.addEventListener('click', () => {
      overlay.classList.toggle('is-visible');
    });
  }
})();

/* Wave dividers: the rolling-hills edges at the top and bottom of the
   Promise section shift horizontally as the page scrolls, so the wave
   physically moves while scrolling and freezes the instant scrolling
   stops. Each SVG is drawn at double width with the pattern tiled
   twice, so shifting it by exactly one wrapper-width loops seamlessly.
   Top and bottom drift in opposite directions for a bit of variety. */
(function initWaveDividers() {
  const waves = [
    { wrap: document.querySelector('.promise__divider-wrap--top'), speed: 0.4 },
    { wrap: document.querySelector('.promise__divider-wrap--bottom'), speed: -0.4 },
  ].filter((w) => w.wrap);
  if (!waves.length) return;

  if (prefersReducedMotion) return;

  waves.forEach((w) => {
    w.svg = w.wrap.querySelector('.promise__divider');
    w.period = w.wrap.offsetWidth;
  });

  function loopedOffset(value, period) {
    if (period <= 0) return 0;
    const m = value % period;
    return m < 0 ? m + period : m;
  }

  function update() {
    waves.forEach((w) => {
      const raw = window.scrollY * w.speed;
      const offset = -loopedOffset(raw, w.period);
      w.svg.style.transform = `translateX(${offset}px)`;
    });
  }

  onScrollFrame(update);

  window.addEventListener('resize', () => {
    waves.forEach((w) => { w.period = w.wrap.offsetWidth; });
    update();
  });

  update();
})();

/* Farm: one continuous pinned sequence (CSS position: sticky) — no
   separate "newspaper" section handing off to a separate "farm" section,
   so there's no seam for the two to visibly disagree across. Phases, in
   scroll order:
     1. hold   — the newspaper poster sits still, bright, undarkened.
     2. flight — it hops up and back down (translateY/rotate wobble).
     3. blend  — .farm__stage zooms in while .farm__bg-img (the real
        farm.webp, absolutely positioned over the printed photo's exact
        sub-region — see CSS) fades from 0 to full opacity and the scrim
        fades in alongside it, landing on the exact crop farm.webp's own
        tuned focus point sits at. blendScale is tuned (alongside
        .farm__stage's transform-origin in CSS) so this lines up pixel-for-
        pixel — the illustration dissolves into the real photo instead of
        cutting to it.
     4. settle — the instant the blend finishes, bgImg is moved out of
        .farm__stage (whose transform stops applying to it) and switched
        to a plain full-bleed cover image (.farm__bg-img--settled, CSS) at
        the equivalent scale(1)/42%,27% framing — since that's pixel-
        identical to where the blend just landed, the swap is invisible,
        but it matters because the small absolutely-positioned box above
        doesn't have enough margin to stay full-bleed once the reveal
        stages below zoom/pan further — it would eventually expose blank
        space past its own edge.
     5. reveals — bgImg keeps zooming/panning through one "ramp" per
        .farm__reveal, each holding for a fixed distance once its ramp
        lands, then fading as the next ramp begins — one per photo card,
        with the last one holding until the section finally releases into
        the footer. */
(function initFarmSequence() {
  const section = document.querySelector('.farm');
  const pin = document.querySelector('.farm__pin');
  const stage = document.querySelector('.farm__stage');
  const paperImg = document.querySelector('.farm__paper-img');
  const bgImg = document.querySelector('.farm__bg-img');
  const scrim = document.querySelector('.farm__scrim');
  let reveals = Array.from(document.querySelectorAll('.farm__reveal'));
  if (!section || !pin || !stage || !paperImg || !bgImg || !scrim || !reveals.length) return;

  const blendScale = 3.65; // matches farm.webp's resting crop, see transform-origin comment in CSS

  // one entry per .farm__reveal, in order: what changes during that
  // reveal's ramp, and the value it lands on. Matched to `reveals` by
  // index, so it must have exactly one entry per .farm__reveal in the
  // HTML — if a reveal is added/removed without updating this, extra
  // reveals are dropped (with a warning) rather than crashing the loop.
  const stages = [
    { type: 'zoom', value: 1.25 },
    { type: 'zoom', value: 1.6 },
    { type: 'pan', value: 82 }, // stop zooming, pan the origin toward the right side of the photo
    { type: 'zoom', value: 1 }, // zoom back out to the resting size the blend landed on
  ];

  if (reveals.length > stages.length) {
    console.warn(`initFarmSequence: ${reveals.length} .farm__reveal elements but only ${stages.length} stages defined — add a matching stages entry for each reveal. Extra reveals will never appear.`);
    reveals = reveals.slice(0, stages.length);
  }

  // alternate each card's slide-in/out side so consecutive reveals visibly
  // cross from opposite directions instead of just fading in place.
  reveals.forEach((el, i) => {
    el.classList.add(i % 2 === 0 ? 'farm__reveal--left' : 'farm__reveal--right');
  });

  // Scrolling back up past blendEnd needs to reverse this (not just a
  // one-way switch) — nudging the scrollbar, or scrolling back up to
  // re-read something, is completely normal, and without this bgImg would
  // get stuck full-bleed while the poster is still doing its hold/flight/
  // blend animation above it.
  function settle() {
    pin.insertBefore(bgImg, scrim);
    bgImg.classList.add('farm__bg-img--settled');
  }
  function unsettle() {
    stage.appendChild(bgImg);
    bgImg.classList.remove('farm__bg-img--settled');
  }

  if (prefersReducedMotion) {
    settle();
    paperImg.style.opacity = 0;
    bgImg.style.opacity = 1;
    scrim.style.opacity = 1;
    reveals.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const holdDuration = 1; // fraction of viewport height the poster sits still
  const flightDuration = 1; // fraction of viewport height it hops up and back down
  const blendDuration = 1; // fraction of viewport height the zoom-and-dissolve takes
  const flightHeight = 140; // px, how high it hops at the peak
  const scaleStart = 1; // bgImg's own baseline once settled, matching .farm__bg-img--settled's scale(1) framing
  const originXStart = 42; // matches .farm__bg-img--settled's resting object-position in CSS
  const originY = 27;
  const rampDuration = 0.6; // fraction of viewport height each reveal's ramp takes
  const holdDurationReveal = 1.1; // fraction of viewport height each non-final reveal holds for

  let settled = false;

  function update() {
    const sectionRect = section.getBoundingClientRect();
    const pinRange = sectionRect.height - window.innerHeight;
    if (pinRange <= 0) return;

    const scrolledIntoSection = -sectionRect.top;
    const vh = window.innerHeight;
    const holdEnd = vh * holdDuration;
    const flightEnd = holdEnd + vh * flightDuration;
    const blendEnd = flightEnd + vh * blendDuration;

    const shouldBeSettled = scrolledIntoSection >= blendEnd;
    if (shouldBeSettled !== settled) {
      if (shouldBeSettled) settle(); else unsettle();
      settled = shouldBeSettled;
    }
    // Defaults to -1 (nothing visible) so scrolling back up out of the
    // reveals phase — or sitting in the hold/flight/blend phases above —
    // clears every card; only the reveals branch below overrides it.
    let activeReveal = -1;

    if (scrolledIntoSection < holdEnd) {
      // poster holds still.
      stage.style.transform = 'translateY(0px) rotate(0deg) scale(1)';
    } else if (scrolledIntoSection < flightEnd) {
      const t = (scrolledIntoSection - holdEnd) / (flightEnd - holdEnd);
      const translateY = -Math.sin(t * Math.PI) * flightHeight;
      const rotate = Math.sin(t * Math.PI * 2) * 4;
      stage.style.transform = `translateY(${translateY}px) rotate(${rotate}deg) scale(1)`;
    } else if (scrolledIntoSection < blendEnd) {
      const t = Math.max(0, Math.min(1, (scrolledIntoSection - flightEnd) / (blendEnd - flightEnd)));
      const scale = lerp(1, blendScale, t);
      stage.style.transform = `translateY(0px) rotate(0deg) scale(${scale})`;
      paperImg.style.opacity = lerp(1, 0, t);
      bgImg.style.opacity = lerp(0, 1, t);
      scrim.style.opacity = lerp(0, 0.5, t);
    } else {
      let scale = scaleStart;
      let originX = originXStart;
      let cursor = blendEnd;
      const rampRange = vh * rampDuration;
      const holdRange = vh * holdDurationReveal;

      for (let i = 0; i < reveals.length; i++) {
        const revealStage = stages[i];
        const rampEnd = cursor + rampRange;
        if (scrolledIntoSection < rampEnd) {
          const t = rampRange > 0 ? Math.max(0, Math.min(1, (scrolledIntoSection - cursor) / rampRange)) : 1;
          if (revealStage.type === 'zoom') scale = lerp(scale, revealStage.value, t);
          else originX = lerp(originX, revealStage.value, t);
          break;
        }
        if (revealStage.type === 'zoom') scale = revealStage.value;
        else originX = revealStage.value;

        const isLast = i === reveals.length - 1;
        const holdEndI = isLast ? Infinity : rampEnd + holdRange;
        if (scrolledIntoSection < holdEndI) {
          activeReveal = i;
          break;
        }
        cursor = holdEndI;
      }

      bgImg.style.transform = `scale(${scale})`;
      bgImg.style.transformOrigin = `${originX}% ${originY}%`;
    }

    reveals.forEach((el, i) => el.classList.toggle('is-visible', i === activeReveal));
  }

  onScrollFrame(update);
  window.addEventListener('resize', update);
  update();
})();

/* Promise: kicker, heading and the 3 feature entries fade/slide in the
   first time the section scrolls into view. Plain IntersectionObserver
   reveal. */
(function initPromiseReveal() {
  const kicker = document.querySelector('.promise__kicker');
  const title = document.querySelector('.promise .section-title');
  const features = document.querySelectorAll('.promise__feature');
  const revealables = [kicker, title, ...features].filter(Boolean);
  if (!revealables.length) return;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((observed) => {
    observed.forEach((item) => {
      if (item.isIntersecting) {
        item.target.classList.add('is-visible');
        observer.unobserve(item.target);
      }
    });
  }, { threshold: 0.2 });

  revealables.forEach((el) => observer.observe(el));
})();

/* Product page: arrows step between products, and each product has its own
   Whole/Cut toggle that swaps the photo. Switching product resets the
   toggle back to "whole". */
(function initProductSlideshow() {
  const photo = document.getElementById('product-photo');
  const name = document.getElementById('product-name');
  const enquireLink = document.getElementById('product-enquire');
  const toggleButtons = document.querySelectorAll('.product__toggle-btn');
  const prevBtn = document.querySelector('.product__stage .arrow-btn--prev');
  const nextBtn = document.querySelector('.product__stage .arrow-btn--next');
  if (!photo || !toggleButtons.length || !prevBtn || !nextBtn) return;

  const products = [
    {
      name: 'Free Range Chicken',
      label: 'free-range chicken',
      whole: { src: 'assets/product1.webp', alt: 'Whole free range chicken' },
      cut: { src: 'assets/cut.webp', alt: 'Cut free range chicken' },
    },
    {
      name: 'Capon Chicken',
      label: 'capon chicken',
      whole: { src: 'assets/capon.webp', alt: 'Whole capon chicken' },
      cut: { src: 'assets/capon.webp', alt: 'Cut capon chicken' },
    },
  ];

  let productIndex = 0;
  let cut = 'whole';

  function render() {
    const product = products[productIndex];
    const shot = product[cut];
    photo.src = shot.src;
    photo.alt = shot.alt;
    if (name) name.textContent = product.name;
    if (enquireLink) {
      const cutLabel = cut === 'cut' ? 'pre-cut' : 'whole';
      const message = `Hi, I am interested in ${cutLabel} ${product.label}. https://free-range-farm.com/products.html`;
      enquireLink.href = `https://wa.me/60122295012?text=${encodeURIComponent(message)}`;
    }
    toggleButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.cut === cut));
  }

  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      cut = btn.dataset.cut;
      render();
    });
  });

  prevBtn.addEventListener('click', () => {
    productIndex = cycleIndex(productIndex, -1, products.length);
    cut = 'whole';
    render();
  });

  nextBtn.addEventListener('click', () => {
    productIndex = cycleIndex(productIndex, 1, products.length);
    cut = 'whole';
    render();
  });

  render();
})();

//FAQ
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
