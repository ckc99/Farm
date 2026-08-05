/* Parallax: chicken-sketch.png spins in step with page scroll. */
(function initChickenParallax() {
  const chicken = document.querySelector('.intro__badge-chicken');
  if (!chicken) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const degreesPerPixel = 0.08;
  const startingAngle = -20;
  let ticking = false;

  function update() {
    const angle = startingAngle + (window.scrollY * degreesPerPixel);
    chicken.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
})();

/* Parallax: the "free range chicken" circular text spins opposite
   to chicken-sketch.png. */
(function initBadgeTextParallax() {
  const text = document.querySelector('.intro__badge-text');
  if (!text) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const degreesPerPixel = -0.15;
  
  let ticking = false;

  function update() {
    const angle = window.scrollY * degreesPerPixel;
    text.style.transform = `rotate(${angle}deg)`;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
})();

/* Video frame morph: chicks.mp4 starts as a small square block centered
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
  if (!stage || !main || !box) return;

  const videoRatio = 1920 / 1440;
  const descRevealAt = 0.95;
  const narrowQuery = window.matchMedia('(max-width: 700px)');

  /* .gallery__video-main is position: absolute, so it never contributes
     to .gallery__video-frame's own (sticky) box height — without this,
     the frame's height comes only from the much-shorter description
     paragraph, so the native CSS sticky release fires late relative to
     the video's own grow animation, leaving it pinned in place over the
     gallery grid until the frame's real box finally scrolls clear. */
  function applyMain(width, height, left) {
    main.style.width = `${width}px`;
    main.style.left = `${left}px`;
    box.style.height = `${height}px`;
    if (frame) frame.style.minHeight = `${height}px`;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const stageWidth = stage.clientWidth;
    const w = narrowQuery.matches ? stageWidth : Math.min(480, stageWidth * 0.4);
    applyMain(w, w / videoRatio, stageWidth - w);
    if (caption) caption.classList.add('is-visible');
    return;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  let ticking = false;

  function update() {
    const stageWidth = stage.clientWidth;
    const rect = stage.getBoundingClientRect();
    const pinRange = stage.offsetHeight - window.innerHeight;
    const progress = pinRange > 0
      ? Math.max(0, Math.min(1, -rect.top / pinRange))
      : 0;
    /* Below the 700px breakpoint there's no side-by-side paragraph to
       slide clear of, so the square grows in place instead of sliding
       right: full stage width at the end, centered the whole time. */
    const isNarrow = narrowQuery.matches;

    const widthMin = Math.min(220, stageWidth * 0.28);
    const widthMax = isNarrow ? stageWidth : Math.min(480, stageWidth * 0.55);
    const width = lerp(widthMin, widthMax, progress);
    const ratio = lerp(1, videoRatio, progress);
    const height = width / ratio;
    const centeredLeft = (stageWidth - width) / 2;
    const rightAlignedLeft = stageWidth - width;
    const left = isNarrow ? centeredLeft : lerp(centeredLeft, rightAlignedLeft, progress);

    applyMain(width, height, left);

    if (caption) caption.classList.toggle('is-visible', progress >= descRevealAt);

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', update);

  update();
})();

/* Gallery card slide: .gallery__stage-frame pins in place while the user
   scrolls through .gallery__stage's extra height. Cards share the same
   slot and stack in DOM order, so each card after the first starts
   parked below the frame (translateY(100%)) and, on its turn, slides up
   to translateY(0) — covering the previous card in place, no separate
   curtain needed. Progress is split into a "hold" per card (parked or
   settled, nothing moving) and a "transition" between each consecutive
   pair (the next card sliding up); see CSS media query for the
   narrow-viewport fallback where this doesn't get wired up at all. */
(function initGalleryWipe() {
  const stage = document.querySelector('.gallery__stage');
  const items = document.querySelectorAll('.gallery__item');
  if (!stage || !items.length) return;

  const narrowQuery = window.matchMedia('(max-width: 700px)');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || narrowQuery.matches) {
    items.forEach((item) => { item.style.transform = 'translateY(0)'; });
    return;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  const transitionCount = items.length - 1;
  const transitionWidth = 0.14;
  const holdWidth = (1 - transitionCount * transitionWidth) / items.length;

  /* [start, end] progress window during which card i+1 slides up over
     card i; the gaps between windows are the holds either side of it. */
  const transitions = [];
  let cursor = holdWidth;
  for (let i = 0; i < transitionCount; i++) {
    transitions.push([cursor, cursor + transitionWidth]);
    cursor += transitionWidth + holdWidth;
  }

  let ticking = false;

  function update() {
    const rect = stage.getBoundingClientRect();
    const pinRange = stage.offsetHeight - window.innerHeight;
    const progress = pinRange > 0
      ? Math.max(0, Math.min(1, -rect.top / pinRange))
      : 0;

    items.forEach((item, i) => {
      if (i === 0) {
        item.style.transform = 'translateY(0)';
        return;
      }
      const [start, end] = transitions[i - 1];
      let y;
      if (progress <= start) {
        y = 100;
      } else if (progress >= end) {
        y = 0;
      } else {
        y = lerp(100, 0, (progress - start) / (end - start));
      }
      item.style.transform = `translateY(${y}%)`;
    });

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', update);

  update();
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

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  waves.forEach((w) => {
    w.svg = w.wrap.querySelector('.promise__divider');
  });

  function loopedOffset(value, period) {
    if (period <= 0) return 0;
    const m = value % period;
    return m < 0 ? m + period : m;
  }

  let ticking = false;

  function update() {
    waves.forEach((w) => {
      const period = w.wrap.offsetWidth;
      const raw = window.scrollY * w.speed;
      const offset = -loopedOffset(raw, period);
      w.svg.style.transform = `translateX(${offset}px)`;
    });
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', update);

  update();
})();

/* Pin: "We Promised" stays fixed in the viewport as a sticky background
   (Fullchicken.png) while its section scrolls. The 3 feature cards slide
   in one by one, and with each new one, the background pans and zooms
   to a new focus point on the chicken. Once the last card has passed,
   the pin releases and the background scrolls away naturally as the
   gallery section takes over. */
(function initPromisePin() {
  const section = document.querySelector('.promise');
  const features = document.querySelectorAll('.promise__feature');
  const bgImg = document.querySelector('.promise__bg-img');
  const title = document.querySelector('.promise .section-title');
  const kicker = document.querySelector('.promise__kicker');
  if (!section || !features.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    features.forEach((feature) => feature.classList.add('is-visible'));
    if (title) title.classList.add('is-visible');
    if (kicker) kicker.classList.add('is-visible');
    return;
  }

  const titleThreshold = 0.05;
  const kickerFadeOutStart = 0.18;
  const thresholds = [0.24, 0.42, 0.72];
  const stops = [0, 0.24, 0.38, 0.42, 0.72, 1];

  /* One focus keyframe per label, the resting entry shot at index 0, and a
     final keyframe that zooms back out to that same resting shot as the
     pin's scroll room runs out, so the chicken is back to normal size by
     the time the gallery section takes over. Between label 1 and label 2,
     the camera holds its spot and just zooms in (no pan, so nothing drifts
     upward) until right before label 2, where it jumps straight to the
     breast/leg framing. */
  const focusFrames = [
    { x: 30, y: 50, scale: 0.6 },   // entry: small, sitting on the left
    { x: 30, y: 50, scale: 0.7 },   // "Raised naturally" -> same left spot, grown a bit bigger
    { x: 30, y: 50, scale: 1.0 },   // still zooming in on the same spot, no pan yet
    { x: 36, y: 90, scale: 1.25 },  // "Premium meat quality" -> jump straight to chicken breast & leg
    { x: 35, y: 10, scale: 1.3 },   // "Free of antibiotics..." -> comb & neck feathers together
    { x: 30, y: 50, scale: 0.6 },   // zoom back out to normal before releasing into gallery
  ];

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function focusAt(progress) {
    if (progress >= 1) {
      return focusFrames[focusFrames.length - 1];
    }
    let i = 0;
    while (i < stops.length - 1 && progress >= stops[i + 1]) i++;
    const segStart = stops[i];
    const segEnd = stops[i + 1];
    const t = (progress - segStart) / (segEnd - segStart);
    const a = focusFrames[i];
    const b = focusFrames[i + 1];
    return {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      scale: lerp(a.scale, b.scale, t),
    };
  }

  let ticking = false;

  function update() {
    const rect = section.getBoundingClientRect();
    const scrollable = section.offsetHeight - window.innerHeight;
    const progress = scrollable > 0
      ? Math.min(1, Math.max(0, -rect.top / scrollable))
      : 1;

    features.forEach((feature, i) => {
      feature.classList.toggle('is-visible', progress >= thresholds[i]);
    });

    if (title) {
      title.classList.toggle('is-visible', progress >= titleThreshold);
    }

    if (kicker) {
      kicker.classList.toggle('is-visible', progress >= titleThreshold && progress < kickerFadeOutStart);
    }

    if (bgImg) {
      const frame = focusAt(progress);
      bgImg.style.transformOrigin = `${frame.x}% ${frame.y}%`;
      bgImg.style.transform = `scale(${frame.scale})`;
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', update);

  update();
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