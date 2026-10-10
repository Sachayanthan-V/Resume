/* Loader: scattered particles fly in and form a ring as real resources finish loading.
   Exposes window.siteReady (a Promise) that resolves once the ring is complete and the loader has faded. */
(function () {
  const root = document.getElementById('loader');
  const canvas = document.getElementById('loaderCanvas');
  const pctEl = document.getElementById('ldPct');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.classList.add('is-loading');

  let W, H, dpr, R, cx, cy;
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2; R = Math.min(W, H) * 0.2;
  }
  size(); addEventListener('resize', size);

  const N = 140;
  const colors = ['#6d28d9', '#8b5cf6', '#a855f7', '#c084fc', '#ec4899', '#f472b6'];
  const parts = Array.from({ length: N }, (_, i) => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
    a: (i / N) * Math.PI * 2 - Math.PI / 2, // its slot on the ring (starts at 12 o'clock, goes clockwise)
    r: 1.4 + Math.random() * 2.2,
    c: colors[i % colors.length],
    k: 0, // 0 = drifting, 1 = locked on the ring
  }));

  // ---- progress from real resources ----
  const urls = new Set();
  document.querySelectorAll('img[src]').forEach((im) => urls.add(im.getAttribute('src')));
  document.querySelectorAll('[style*="background-image"]').forEach((el) => {
    const m = el.getAttribute('style').match(/url\(["']?([^"')]+)/); if (m) urls.add(m[1]);
  });
  const total = urls.size + 2; // + fonts + window load
  let done = 0;
  const tick = () => { done++; };
  urls.forEach((u) => { const im = new Image(); im.onload = im.onerror = tick; im.src = u; });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(tick);
  if (document.readyState === 'complete') tick(); else addEventListener('load', tick, { once: true });

  const started = performance.now();
  const MIN = reduce ? 300 : 1600;   // long enough to see the ring form, even from cache
  const MAX = 12000;                 // never hang on a slow/failed resource
  let shown = 0, finished = false, finishAt = 0;
  let resolveReady; window.siteReady = new Promise((r) => { resolveReady = r; });

  function frame(now) {
    const elapsed = now - started;
    const real = Math.min(1, done / total);
    const timeCap = Math.min(1, elapsed / MIN);      // don't outrun the minimum duration
    const target = elapsed > MAX ? 1 : Math.min(real, timeCap);
    shown += (target - shown) * 0.08;
    if (target === 1 && shown > 0.995) shown = 1;
    const pct = Math.round(shown * 100);
    pctEl.textContent = pct;
    root.setAttribute('aria-valuenow', pct);

    ctx.clearRect(0, 0, W, H);
    const locked = Math.floor(shown * N);
    // faint guide ring
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = dark ? 'rgba(168,85,247,.12)' : 'rgba(109,40,217,.10)'; ctx.lineWidth = 1; ctx.stroke();
    // completed arc glow
    if (shown > 0) {
      ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + shown * Math.PI * 2);
      const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      g.addColorStop(0, 'rgba(109,40,217,.55)'); g.addColorStop(1, 'rgba(236,72,153,.55)');
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
    }
    parts.forEach((p, i) => {
      const onRing = i < locked;
      const tx = cx + Math.cos(p.a) * R, ty = cy + Math.sin(p.a) * R;
      if (onRing) {
        p.k = Math.min(1, p.k + 0.06);
        p.x += (tx - p.x) * 0.12; p.y += (ty - p.y) * 0.12;
      } else {
        // drift, gently pulled toward the ring so it feels like they're gathering
        p.x += p.vx; p.y += p.vy;
        p.x += (cx - p.x) * 0.0015; p.y += (cy - p.y) * 0.0015;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.k * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = p.c; ctx.globalAlpha = 0.55 + p.k * 0.45;
      ctx.shadowColor = p.c; ctx.shadowBlur = p.k ? 10 : 4; ctx.fill();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    });

    if (shown === 1 && !finished) { finished = true; finishAt = now; root.classList.add('is-done'); }
    if (finished && now - finishAt > 650) {
      root.classList.add('is-out');
      document.documentElement.classList.remove('is-loading');
      setTimeout(() => { root.remove(); removeEventListener('resize', size); }, 700);
      resolveReady();
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
