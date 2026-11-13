// motion.js — spring physics (damped harmonic solver), reveals, parallax, scroll scenes.
export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** Damped spring: x'' = -k(x - target) - c x'. Semi-implicit Euler, fixed 1/120 s sub-steps. */
export function spring(from, to, { k = 170, c = 22, onUpdate, onDone, delay = 0 }) {
  let x = from, v = 0, last = 0, raf = 0, dead = false;
  const step = (t) => {
    if (dead) return;
    if (!last) last = t;
    let dt = Math.min(0.05, (t - last) / 1000); last = t;
    while (dt > 0) { const h = Math.min(dt, 1 / 120); v += (-k * (x - to) - c * v) * h; x += v * h; dt -= h; }
    onUpdate(x);
    if (Math.abs(x - to) < 0.0005 && Math.abs(v) < 0.0005) { onUpdate(to); onDone && onDone(); return; }
    raf = requestAnimationFrame(step);
  };
  const start = setTimeout(() => { raf = requestAnimationFrame(step); }, delay);
  return () => { dead = true; clearTimeout(start); cancelAnimationFrame(raf); };
}

/** Eased number tween used for count-ups (expo-out, 1.2 s like the reference's long ease). */
export function tween(from, to, ms, onUpdate) {
  if (reduced()) { onUpdate(to); return () => {}; }
  let raf = 0, t0 = 0, dead = false;
  const f = (t) => { if (dead) return; if (!t0) t0 = t; const p = clamp((t - t0) / ms); const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); onUpdate(from + (to - from) * e); if (p < 1) raf = requestAnimationFrame(f); };
  raf = requestAnimationFrame(f);
  return () => { dead = true; cancelAnimationFrame(raf); };
}

export function initProgress() {
  const bar = document.querySelector('.progress span');
  const upd = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? clamp(scrollY / h) : 0})`; };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
}

/** Scroll-reveal with spring physics. Children of [data-stagger] are staggered; single elements spring alone. */
export function initReveal() {
  const els = [...document.querySelectorAll('[data-reveal], .h-card, .phase')];
  const R = reduced();
  const show = (el, delay) => {
    if (R) { el.style.opacity = 1; el.style.transform = 'none'; return; }
    spring(0, 1, { delay, onUpdate: (p) => { el.style.opacity = clamp(p * 1.4); el.style.transform = `translate3d(0, ${(1 - p) * 44}px, 0) scale(${0.97 + 0.03 * p})`; }, onDone: () => { el.style.transform = 'none'; } });
  };
  const io = new IntersectionObserver((ents) => {
    const vis = ents.filter((e) => e.isIntersecting);
    vis.forEach((e, i) => {
      const el = e.target; io.unobserve(el);
      if (el.classList.contains('phase')) el.classList.add('lit');
      show(el, i * 80);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach((el) => { if (el.closest('.how-track')) { show(el, 0); return; } io.observe(el); });
  // underline waves on headings
  const hio = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove('waved-pending'); hio.unobserve(e.target); } }), { threshold: 0.4 });
  document.querySelectorAll('h2').forEach((h) => { if (h.querySelector('em')) { h.classList.add('waved-pending'); hio.observe(h); } });
}

/** Hero: 3 title lines rise with springs, then the wave underline. */
export function initHeroIntro() {
  const lines = document.querySelectorAll('.hero-title .line-in');
  const title = document.querySelector('.hero-title');
  title.classList.add('waved-pending');
  lines.forEach((l, i) => {
    if (reduced()) { l.style.transform = 'none'; return; }
    spring(110, 0, { k: 120, c: 16, delay: 150 + i * 120, onUpdate: (y) => { l.style.transform = `translateY(${y}%)`; } });
  });
  setTimeout(() => title.classList.remove('waved-pending'), reduced() ? 0 : 900);
}

/** Parallax: pointer + scroll feed one rAF loop that writes depth-scaled transforms. */
export function initParallax() {
  if (reduced()) return;
  const layers = [...document.querySelectorAll('[data-depth]')];
  const tilt = document.querySelector('[data-tilt]');
  const mark = document.querySelector('.board-mark');
  let tx = 0, ty = 0, cx = 0, cy = 0;
  addEventListener('pointermove', (e) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  const loop = () => {
    cx += (tx - cx) * 0.07; cy += (ty - cy) * 0.07;
    const sy = scrollY;
    if (sy < innerHeight * 1.3) layers.forEach((l) => {
      const d = parseFloat(l.dataset.depth);
      l.style.transform = `translate3d(${(-cx * 34 * d).toFixed(2)}px, ${(-cy * 26 * d - sy * 0.12 * d).toFixed(2)}px, 0)`;
    });
    if (tilt) tilt.style.transform = `rotateY(${(cx * 26).toFixed(2)}deg) rotateX(${(-cy * 22).toFixed(2)}deg)`;
    if (mark) { const r = mark.parentElement.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) mark.style.transform = `translate3d(0, ${((r.top - innerHeight / 2) * -0.08).toFixed(1)}px, 0) rotate(${(r.top * 0.02).toFixed(2)}deg)`; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export function initSpotlight() {
  addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-spot], .row');
    if (!t) return; const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', `${e.clientX - r.left}px`); t.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

export function initBannerTilt() {
  const c = document.querySelector('[data-tilt-card]'); if (!c || reduced()) return;
  c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; c.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`; });
  c.addEventListener('pointerleave', () => { c.style.transform = ''; });
}

/** Manifesto: words ignite as the paragraph crosses the viewport. */
export function initWords() {
  const p = document.querySelector('[data-words]'); if (!p) return;
  const walk = (node, out) => node.childNodes.forEach((n) => {
    if (n.nodeType === 3) { const frag = document.createDocumentFragment(); n.textContent.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) frag.append(w); else { const s = document.createElement('span'); s.className = 'word'; s.textContent = w; frag.append(s); out.push(s); } }); n.replaceWith(frag); }
    else walk(n, out);
  });
  const words = []; walk(p, words);
  const upd = () => {
    const r = p.getBoundingClientRect(); const prog = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35));
    words.forEach((w, i) => { const t = clamp(prog * (words.length + 6) - i, 0, 1); w.style.opacity = reduced() ? 1 : (0.16 + 0.84 * t).toFixed(3); });
  };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
}

/** Plate index: ring fills + counters tick as you scroll through the section. */
export function initIndex() {
  const sec = document.querySelector('.index'); if (!sec) return;
  const items = [...sec.querySelectorAll('.idx')]; const ring = sec.querySelector('[data-ring]'); const now = sec.querySelector('[data-idx-now]');
  let cur = -1;
  const set = (i) => {
    if (i === cur) return; cur = i;
    items.forEach((it, j) => it.classList.toggle('on', j === i));
    now.textContent = String(i + 1).padStart(2, '0');
    const it = items[i], n = it.querySelector('.n'), to = +it.dataset.to, suf = it.dataset.suffix || '';
    tween(0, to, 1200, (v) => { n.textContent = Math.round(v) + suf; });
    ring.style.strokeDashoffset = String(1 - (i + 1) / items.length);
    ring.style.transition = reduced() ? 'none' : 'stroke-dashoffset 1.2s var(--ease-out)';
  };
  const upd = () => { const r = sec.getBoundingClientRect(); const p = clamp((innerHeight * 0.3 - r.top) / (r.height - innerHeight * 0.1)); set(Math.min(items.length - 1, Math.floor(p * items.length))); };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
}

/** How-it-works: sticky pin, vertical scroll drives horizontal travel. */
export function initHow() {
  const sec = document.querySelector('[data-how]'); if (!sec) return;
  const track = sec.querySelector('[data-how-track]'); const flow = sec.querySelector('[data-flow]');
  const size = () => { const dist = Math.max(0, track.scrollWidth - innerWidth); sec.style.height = `${innerHeight + dist}px`; return dist; };
  let dist = size();
  const upd = () => { const r = sec.getBoundingClientRect(); const p = dist ? clamp(-r.top / dist) : 0; track.style.transform = `translate3d(${-p * dist}px,0,0)`; flow.style.transform = `scaleX(${p})`; };
  addEventListener('resize', () => { dist = size(); upd(); });
  addEventListener('load', () => { dist = size(); upd(); });
  addEventListener('scroll', upd, { passive: true }); upd();
}

/** Plate rack: plates fill as scroll progresses; heading swaps. */
export function initRack() {
  const sec = document.querySelector('[data-rack]'); if (!sec) return;
  const svg = sec.querySelector('[data-rack-svg]'); const NS = 'http://www.w3.org/2000/svg';
  let h = '<rect class="shelf" x="60" y="170" width="1080" height="14" rx="7"/><rect class="shelf" x="60" y="330" width="1080" height="14" rx="7"/>';
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) { const cx = 160 + i * 176, cy = row ? 258 : 98; h += `<circle class="pl" cx="${cx}" cy="${cy}" r="62"/><circle class="pw" cx="${cx}" cy="${cy}" r="42"/>`; }
  svg.innerHTML = h;
  const plates = [...svg.querySelectorAll('.pl')]; const heads = [...sec.querySelectorAll('.rk-head')];
  sec.style.height = '420vh';
  const upd = () => {
    const r = sec.getBoundingClientRect(); const p = clamp(-r.top / (r.height - innerHeight));
    const n = Math.round(p * plates.length); plates.forEach((pl, i) => pl.classList.toggle('full', i < n));
    const hi = Math.min(heads.length - 1, Math.floor(p * heads.length)); heads.forEach((x, i) => x.classList.toggle('on', i === hi));
  };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
}

export function initPreloader() {
  const pre = document.querySelector('.preloader');
  const finish = () => { document.body.classList.remove('is-loading'); pre.classList.add('done'); setTimeout(() => pre.classList.add('gone'), 900); initHeroIntro(); };
  if (reduced()) { pre.classList.add('gone'); document.body.classList.remove('is-loading'); initHeroIntro(); return; }
  setTimeout(finish, 1100);
}
