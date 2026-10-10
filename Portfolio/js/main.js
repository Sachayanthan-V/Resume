/* Portfolio scroll choreography — GSAP + ScrollTrigger + Lenis (all vendored locally). */
(function () {
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Smooth scroll ---------------- */
  let lenis = null;
  if (!reduceMotion) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -80, duration: 1.4 });
      else target.scrollIntoView();
    });
  });

  /* ---------------- Intro: 6 questions (autoplay, split layout) -> collage -> welcome -> landing ---------------- */
  const pin = document.querySelector('.intro-pin');
  const imagesWrap = document.getElementById('introImages');
  const images = gsap.utils.toArray('.simg');
  const questions = gsap.utils.toArray('.question');
  const qEyebrow = document.querySelector('.q-stage .eyebrow');
  const deco = document.getElementById('introDeco');
  const landingIntro = document.querySelector('.landing-intro');
  const landingMore = document.querySelector('.landing-more');
  const landingActions = document.querySelector('.landing-actions');
  const landingPillars = gsap.utils.toArray('.landing-pillars li');
  const welcomeScribble = document.querySelector('.landing-call .scribble svg');
  const nav = document.getElementById('nav');
  const splitCard = document.getElementById('splitCard');
  const splitImgs = gsap.utils.toArray('.split-img');
  const skipBtn = document.getElementById('skipIntro');
  const isPhone = () => window.innerWidth <= 860;

  // initial states: questions, collage and landing hidden until the timeline brings them in
  gsap.set([images, deco, splitImgs], { autoAlpha: 0 });
  gsap.set(questions, { autoAlpha: 0, y: 30 });
  gsap.set(landingIntro, { autoAlpha: 0, y: 40 });
  gsap.set(landingMore, { autoAlpha: 0 });

  // transform that places collage tile i over a rectangle (pin coordinates)
  function tileOver(i, rx, ry, rw, rh) {
    const el = images[i];
    const left = imagesWrap.offsetLeft + el.offsetLeft, top = imagesWrap.offsetTop + el.offsetTop;
    const w = el.offsetWidth, h = el.offsetHeight;
    return { x: rx + rw / 2 - (left + w / 2), y: ry + rh / 2 - (top + h / 2), scale: Math.max(rw / w, rh / h) };
  }

  function playIntro(instant = false) {
    const STEP = 2.5; // seconds per question -> 15s
    pin.classList.add('mode-auto', 'mode-split');
    // the split question layout must not leak into the landing
    const dropQuestionLayout = () => pin.classList.remove('mode-split');
    const end = () => {
      dropQuestionLayout();
      skipBtn.hidden = true;
      if (lenis) lenis.start();
      document.body.style.overflow = '';
      ScrollTrigger.refresh();
    };
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, onComplete: end });
    skipBtn.hidden = instant;
    skipBtn.onclick = () => { dropQuestionLayout(); tl.progress(1); };

    tl.fromTo(splitCard, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.6 }, 0);
    questions.forEach((q, i) => {
      const s = i * STEP;
      tl.fromTo(q, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.35 }, s)
        .fromTo(splitImgs[i], { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 0.5 }, s);
      if (i < questions.length - 1) tl.to(q, { autoAlpha: 0, y: -30, duration: 0.3, ease: 'power2.in' }, s + STEP - 0.3);
    });
    const t = questions.length * STEP;
    tl.to([questions[questions.length - 1], qEyebrow], { autoAlpha: 0, y: -30, duration: 0.4, ease: 'power2.in' }, t - 0.3)
      .call(dropQuestionLayout, null, t + 0.1);

    // the image card breaks into the six tiles, which fly into the collage
    const from = images.map((_, i) => tileOver(i, splitCard.offsetLeft, splitCard.offsetTop, splitCard.offsetWidth, splitCard.offsetHeight));
    tl.fromTo(images,
      { x: (i) => from[i].x, y: (i) => from[i].y, scale: (i) => from[i].scale, borderRadius: 28, autoAlpha: 0 },
      { x: 0, y: 0, scale: 1, borderRadius: () => (isPhone() ? 14 : 22), autoAlpha: 1, duration: 1.2, stagger: 0.1, ease: 'power3.inOut' },
      t - 0.2)
      .to(splitCard, { autoAlpha: 0, duration: 0.5 }, t);

    // welcome copy, then the 3D tilt, actions, pillars and nav
    const w = t - 0.2;
    tl.to(deco, { autoAlpha: 1, duration: 0.8 }, w + 0.8)
      .to(landingIntro, { autoAlpha: 1, y: 0, duration: 0.7 }, w + 1.1)
      .fromTo(welcomeScribble, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.6, immediateRender: false }, w + 1.6);
    const m = w + 2.4;
    tl.fromTo(imagesWrap,
        { rotationY: 0, rotationX: 0 },
        { rotationY: () => (isPhone() ? 0 : -9), rotationX: () => (isPhone() ? 0 : 3), transformPerspective: 1800, duration: 1.1 }, m)
      // phones: the collage shrinks into the space left under the pillars instead of covering them
      .to(imagesWrap, {
        scale: () => (isPhone() ? 0.76 : 1),
        transformOrigin: () => (isPhone() ? '50% 100%' : '50% 50%'),
        duration: 0.8,
      }, m)
      .set(landingMore, { autoAlpha: 1 }, m + 0.1)
      .fromTo(landingActions, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, immediateRender: false }, m + 0.15)
      .fromTo(landingPillars, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.1, immediateRender: false }, m + 0.35)
      .to(nav, { opacity: 1, y: 0, duration: 0.6 }, m + 0.3)
      .set(nav, { pointerEvents: 'auto' }, m + 0.3);
    if (instant) tl.progress(1); // jump straight to the finished landing
  }

  // Reload behaviour: the intro only plays when the page is at the top. If this tab was reloaded
  // while scrolled down, skip the intro and put the visitor back where they were.
  const SCROLL_KEY = 'sv-scroll-y';
  let savedY = 0;
  try { savedY = +sessionStorage.getItem(SCROLL_KEY) || 0; } catch { /* storage blocked */ }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const loaderDone = window.siteReady || Promise.resolve();
  if (savedY > 10) {
    playIntro(true); // finished landing sits behind the loader; position is restored below
  } else {
    scrollTo(0, 0);
    if (lenis) lenis.stop();
    document.body.style.overflow = 'hidden';
    loaderDone.then(() => playIntro()); // the intro starts only once the loader's ring is complete
  }
  let saveQueued = false;
  const saveScroll = () => { saveQueued = false; try { sessionStorage.setItem(SCROLL_KEY, String(Math.round(scrollY))); } catch { /* not saved */ } };
  addEventListener('scroll', () => { if (!saveQueued) { saveQueued = true; requestAnimationFrame(saveScroll); } }, { passive: true });
  addEventListener('pagehide', saveScroll);

  /* ---------------- Horizontal scroll sections (all screens: pinned, driven by vertical scroll) ---------------- */
  const mm = gsap.matchMedia();
  mm.add('all', () => {
    [['#projects', '#projectsPin', '#projectsTrack'], ['#experience', '#timelinePin', '#timelineTrack']].forEach(([secSel, pinSel, trackSel]) => {
      const section = document.querySelector(secSel);
      const viewport = document.querySelector(pinSel);
      const track = document.querySelector(trackSel);
      const dist = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
      gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => '+=' + dist(),
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
    });
  });

  /* ---------------- Daily rhythm: three illustrative 53-week activity grids ---------------- */
  (function buildRhythm() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - 364 - start.getDay()); // a Sunday, ~1 year back
    const totalDays = Math.round((today - start) / 864e5) + 1;
    // each grid has its own fixed seed (same pattern every visit) and its own rhythm
    const profiles = {
      code: { seed: 20210527, level: (r, weekend) => weekend ? (r < 0.45 ? 0 : r < 0.8 ? 1 : 2) : (r < 0.04 ? 0 : r < 0.2 ? 1 : r < 0.5 ? 2 : r < 0.82 ? 3 : 4) },
      customer: { seed: 19990120, level: (r, weekend) => weekend ? (r < 0.85 ? 0 : 1) : (r < 0.03 ? 0 : r < 0.15 ? 1 : r < 0.45 ? 2 : r < 0.78 ? 3 : 4) },
      ai: { seed: 20240101, level: (r, weekend, t) => { // t: 0 (a year ago) -> 1 (today): adoption grows
        const x = r * (0.55 + t * 0.75) + (weekend ? -0.08 : 0);
        return x < 0.12 ? 0 : x < 0.35 ? 1 : x < 0.6 ? 2 : x < 0.85 ? 3 : 4; } },
    };
    const scrollers = [];
    document.querySelectorAll('.cal-card').forEach((card) => {
      const prof = profiles[card.dataset.kind];
      const grid = card.querySelector('.cal-grid');
      const monthsEl = card.querySelector('.cal-months');
      let seed = prof.seed;
      const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
      const frag = document.createDocumentFragment();
      const months = [];
      for (let i = 0, d = new Date(start); d <= today; i++, d.setDate(d.getDate() + 1)) {
        const dow = d.getDay(), week = Math.floor(i / 7);
        const cell = document.createElement('i');
        cell.className = 'l' + prof.level(rand(), dow === 0 || dow === 6, i / totalDays);
        cell.style.setProperty('--w', week);
        frag.appendChild(cell);
        if (d.getDate() === 1 || i === 0) months.push({ week, label: d.toLocaleString('en', { month: 'short' }) });
      }
      grid.appendChild(frag);
      months.forEach((m, k) => {
        if (k === 0 && months[1] && months[1].week - m.week < 3) return; // avoid a cramped first label
        const el = document.createElement('span'); el.textContent = m.label; el.style.setProperty('--w', m.week); monthsEl.appendChild(el);
      });
      scrollers.push(card.querySelector('.cal-scroll'));
      if (reduceMotion) return;
      // replay every time the grid comes into view, from either direction
      const show = () => grid.classList.add('is-in');
      const hide = () => grid.classList.remove('is-in');
      ScrollTrigger.create({ trigger: grid, start: 'top 85%', end: 'bottom 15%', onEnter: show, onEnterBack: show, onLeave: hide, onLeaveBack: hide });
    });
    const weeks = Math.ceil(totalDays / 7);
    const fit = () => { // stretch cells to fill the card on wide screens (11px minimum, then it scrolls)
      const avail = scrollers[0].clientWidth - 36;
      const cell = Math.max(11, Math.min(22, Math.floor((avail - (weeks - 1) * 3) / weeks)));
      document.getElementById('rhythm').style.setProperty('--cell', cell + 'px');
      scrollers.forEach((sc) => { sc.scrollLeft = sc.scrollWidth; }); // phones: start at the most recent weeks
    };
    fit();
    addEventListener('resize', fit);
  })();

  /* ---------------- Nav: highlight the section you're in ---------------- */
  document.querySelectorAll('.nav-links a').forEach((a) => {
    const section = document.querySelector(a.getAttribute('href'));
    if (!section) return;
    ScrollTrigger.create({
      trigger: section, start: 'top 50%', end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    });
  });

  /* ---------------- Theme switch (dark / light, remembered per visitor) ---------------- */
  const themeToggle = document.getElementById('themeToggle');
  const syncThemeLabel = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };
  syncThemeLabel();
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* not persisted */ }
    syncThemeLabel();
  });

  /* ---------------- Coloured cards: section tint + touch auto-hover ---------------- */
  const TINT_CARDS = '.process-row li, .chip-group, .contact-card, .skill-card';
  const tintCards = [...document.querySelectorAll(TINT_CARDS)];
  const setTint = (section, card) => {
    if (card) {
      section.style.setProperty('--tint', getComputedStyle(card).getPropertyValue('--c').trim());
      section.classList.add('is-tinted');
    } else {
      section.classList.remove('is-tinted');
    }
  };
  tintCards.forEach((card) => {
    const section = card.closest('.section');
    section.classList.add('tintable');
    card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setTint(section, card); });
    card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setTint(section, null); });
  });

  // Touch screens have no hover: the card nearest the middle of the screen plays its hover state
  // (photo/colour/glass + section tint), so the interaction is discoverable while scrolling.
  if (window.matchMedia('(hover: none)').matches) {
    const tintSections = [...new Set(tintCards.map((c) => c.closest('.section')))];
    let queued = false;
    const updateActive = () => {
      queued = false;
      const mid = innerHeight / 2;
      let best = null, bestDist = Infinity;
      tintCards.forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) { bestDist = d; best = c; }
      });
      // stickiness: keep the current card unless another is clearly more centred,
      // so cards sharing a row (tablets) don't flicker between each other
      const current = tintCards.find((c) => c.classList.contains('is-active'));
      if (current && best !== current) {
        const r = current.getBoundingClientRect();
        const curDist = Math.abs(r.top + r.height / 2 - mid);
        if (curDist - bestDist < 24) { best = current; bestDist = curDist; }
      }
      const active = bestDist < innerHeight * 0.22 ? best : null;
      tintCards.forEach((c) => c.classList.toggle('is-active', c === active));
      tintSections.forEach((sec) => setTint(sec, active && active.closest('.section') === sec ? active : null));
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(updateActive); } }, { passive: true });
    updateActive();
  }

  /* ---------------- Certificates: view-only viewer ---------------- */
  const certModal = document.getElementById('certModal');
  const certView = document.getElementById('certView');
  const certTitle = document.getElementById('certTitle');
  let certOpener = null;
  const openCert = (btn) => {
    certOpener = btn;
    certView.style.backgroundImage = `url(${btn.dataset.cert})`;
    certTitle.textContent = btn.querySelector('h3').textContent + ' — ' + btn.querySelector('.cert-body p').textContent;
    certModal.hidden = false;
    if (lenis) lenis.stop();
    document.body.style.overflow = 'hidden';
    certModal.querySelector('.cert-modal-close').focus();
  };
  const closeCert = () => {
    certModal.hidden = true;
    certView.style.backgroundImage = '';
    if (lenis) lenis.start();
    document.body.style.overflow = '';
    if (certOpener) certOpener.focus();
  };
  document.querySelectorAll('button.cert').forEach((btn) => btn.addEventListener('click', () => openCert(btn)));
  certModal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeCert));
  addEventListener('keydown', (e) => {
    if (certModal.hidden) return;
    if (e.key === 'Escape') { closeCert(); return; }
    if (e.key === 'Tab') { e.preventDefault(); certModal.querySelector('.cert-modal-close').focus(); return; } // keep focus inside
    // block save / print / copy shortcuts while a certificate is open
    if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'c'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  // no right-click menu, dragging or copying on certificate cards or the viewer
  ['contextmenu', 'dragstart', 'copy'].forEach((type) => {
    document.addEventListener(type, (e) => {
      if (e.target.closest && e.target.closest('.cert, .cert-modal')) e.preventDefault();
    });
  });

  /* ---------------- Pointer spotlight on cards ---------------- */
  document.querySelectorAll('.card, .build, .cert, .ach-stat').forEach((el) => {
    el.classList.add('spot');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  /* ---------------- Contact options panel (tabs + copy email + booking link) ---------------- */
  const cpTabs = [...document.querySelectorAll('.cp-tab')];
  const selectTab = (tab, focus) => {
    cpTabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  };
  cpTabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); selectTab(cpTabs[(i + d + cpTabs.length) % cpTabs.length], true); }
    });
  });

  const bookBtn = document.getElementById('bookBtn');
  if (bookBtn.dataset.booking) { // real booking link configured
    bookBtn.href = bookBtn.dataset.booking;
    document.getElementById('bookNote').hidden = true;
  }

  const copyBtn = document.getElementById('copyEmail');
  copyBtn.addEventListener('click', async () => {
    const label = copyBtn.querySelector('span');
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.email);
      label.textContent = 'Copied!';
    } catch {
      location.href = 'mailto:' + copyBtn.dataset.email; // clipboard blocked: open the mail app instead
    }
    setTimeout(() => { label.textContent = 'Copy email'; }, 2000);
  });

  /* ---------------- Reveal on scroll ---------------- */
  if (reduceMotion) return;

  // marker highlights sweep in and hand-drawn underlines draw as they come into view (intro ones are timeline-driven)
  document.querySelectorAll('.mark, .scribble').forEach((el) => {
    if (el.closest('.intro')) return;
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('is-in') });
  });

  // numbers count up from 0 each time they scroll into view (data-dec = decimal places), then pop
  document.querySelectorAll('.section .num').forEach((el) => {
    const to = +el.dataset.to, dec = +(el.dataset.dec || 0);
    const box = el.closest('strong');
    const state = { v: 0 };
    const render = () => { el.textContent = state.v.toFixed(dec); };
    render();
    const play = () => {
      gsap.killTweensOf([state, box]);
      state.v = 0;
      gsap.to(state, {
        v: to, duration: 2, ease: 'power3.out', onUpdate: render,
        onComplete: () => gsap.fromTo(box, { scale: 1 }, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.out', transformOrigin: 'left center' }),
      });
    };
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', end: 'bottom 12%',
      onEnter: play, onEnterBack: play,
      onLeaveBack: () => { gsap.killTweensOf(state); state.v = 0; render(); },
    });
  });

  const revealTargets = [
    '.section-head', '.rhythm-head > *', '.cal-card', '.about-copy > *', '.about-visual', '.handnote',
    '.build', '.impact-head > *', '.ach-stat', '.cert',
    '.skills-intro > *', '.chip-group', '.process-row li', '.skill-card',
    '.ws-head > *', '.ws-stat', '.ws-step', '.ws-own',
    '.contact-copy > .eyebrow', '.contact-copy > h2', '.contact-copy > .section-sub', '.contact-card', '.connect-panel',
  ];
  document.querySelectorAll(revealTargets.join(',')).forEach((el) => el.classList.add('reveal'));
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => {
      // these elements have CSS transform transitions for hover; switch them off while GSAP animates,
      // then hand transform back to the stylesheet so the hover lifts keep working
      gsap.set(els, { transition: 'none' });
      gsap.to(els, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08,
        onComplete: () => els.forEach((el) => {
          el.classList.remove('reveal');
          gsap.set(el, { clearProps: 'transform,opacity,transition' });
        }),
      });
    },
  });
})();
