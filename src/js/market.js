// market.js — live board. Market follows the `market` register record ONLY; CA state never touches it.
// The own-token row is the one place CA state matters, and it is fully separate from the trending feed.
import { isStated } from './register.js';
import { tween, reduced } from './motion.js';

const BRAND_LOGO = 'assets/logo-512.png';
const PUMP = 'https://frontend-api.pump.fun/coins/';
const POLL_MS = 60000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch JSON with timeout + exponential backoff (base * 2^n + jitter). */
export async function getJSON(url, { tries = 4, base = 700, timeout = 9000 } = {}) {
  let err;
  for (let n = 0; n < tries; n++) {
    const ac = new AbortController(); const to = setTimeout(() => ac.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ac.signal, headers: { accept: 'application/json' } });
      clearTimeout(to);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) { clearTimeout(to); err = e; if (n < tries - 1) await sleep(base * 2 ** n + Math.random() * 250); }
  }
  throw err;
}

/* ---------- formatting ---------- */
const SUB = '₀₁₂₃₄₅₆₇₈₉';
export function fmtPrice(n) {
  if (!isFinite(n) || n <= 0) return '—';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  const zeros = Math.max(0, Math.floor(-Math.log10(n)));
  const digits = Math.round(n * 10 ** (zeros + 4)).toString().padStart(4, '0').slice(0, 4);
  if (zeros >= 4) return '$0.0' + String(zeros).split('').map((d) => SUB[+d]).join('') + digits;
  return '$0.' + '0'.repeat(zeros) + digits;
}
export function fmtCompact(n) {
  if (!isFinite(n) || n < 0) return '—';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'; return '$' + n.toFixed(0);
}
export const fmtPct = (n) => (!isFinite(n) ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(2) + '%');
const safeImg = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);
const safeLink = (u) => (typeof u === 'string' && /^https:\/\/(www\.)?dexscreener\.com\//.test(u) ? u : null);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- data shaping ---------- */
function pickPair(pairs, addr) {
  const list = (Array.isArray(pairs) ? pairs : pairs?.pairs || []).filter((p) => p && p.chainId === 'solana' && (!addr || p.baseToken?.address === addr));
  list.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
  return list[0] || null;
}
function shape(pair, addr, fallback = {}) {
  return {
    addr,
    symbol: pair?.baseToken?.symbol || fallback.symbol || '?',
    name: pair?.baseToken?.name || fallback.name || '',
    img: safeImg(pair?.info?.imageUrl) || null,
    price: pair ? Number(pair.priceUsd) : NaN,
    chg: pair?.priceChange?.h24 ?? NaN,
    vol: pair?.volume?.h24 ?? NaN,
    liq: pair?.liquidity?.usd ?? NaN,
    url: safeLink(pair?.url),
  };
}

/* ---------- DOM ---------- */
const tileHTML = (r, brand) => {
  const src = brand ? BRAND_LOGO : r.img;
  const letter = esc((r.symbol || '?').trim().charAt(0).toUpperCase() || '?');
  return src ? `<span class="tile${brand ? ' brand' : ''}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-l="${letter}"></span>` : `<span class="tile">${letter}</span>`;
};
function rowHTML(r, rank, { own = false, brand = false } = {}) {
  return `<span class="rk">${rank}</span><div class="tok">${tileHTML(r, brand)}<div class="nm"><span class="sym">${esc(r.symbol)}</span><span class="full">${esc(r.name)}</span></div></div>` +
    `<span class="c price" data-f="price"></span><span class="c chg" data-f="chg"></span><span class="c vol" data-f="vol"><span class="k"></span><b data-v></b></span><span class="c liq" data-f="liq"></span>`;
}
const SKEL = '<span class="rk">·</span><div class="tok"><span class="tile"></span><div class="nm"><span class="sk-b"></span></div></div><span class="c price"><span class="sk-b"></span></span><span class="c chg"><span class="sk-b"></span></span><span class="c vol"><span class="sk-b"></span></span><span class="c liq"><span class="sk-b"></span></span>';

const FIELDS = { price: fmtPrice, chg: fmtPct, vol: fmtCompact, liq: fmtCompact };
function setCell(row, f, val, instant) {
  const el = f === 'vol' ? row.querySelector('[data-f="vol"] [data-v]') : row.querySelector(`[data-f="${f}"]`);
  const host = row.querySelector(`[data-f="${f}"]`);
  const fmt = FIELDS[f]; const prev = host._v;
  if (!isFinite(val)) { el.textContent = '—'; host._v = NaN; host.classList.remove('up', 'dn'); return; }
  if (f === 'chg') host.classList.toggle('up', val > 0), host.classList.toggle('dn', val < 0);
  if (prev === val) return;
  host._v = val;
  const up = isFinite(prev) ? (val > prev ? 'flash-up' : 'flash-dn') : null;
  if (isFinite(prev) && !instant && !reduced()) {
    tween(prev, val, 900, (v) => { el.textContent = fmt(v); });
    host.classList.remove('flash-up', 'flash-dn'); void host.offsetWidth; host.classList.add(up);
  } else el.textContent = fmt(val);
}
function fillRow(row, r, instant) { for (const f of Object.keys(FIELDS)) setCell(row, f, r[f === 'chg' ? 'chg' : f], instant); }
function bindImgFallback(root) {
  root.querySelectorAll('img[data-l]').forEach((img) => {
    if (img.dataset.b) return; img.dataset.b = 1;
    img.addEventListener('error', () => { const t = img.parentElement; t.classList.remove('brand'); t.textContent = img.dataset.l; }, { once: true });
  });
}

/* ---------- controller ---------- */
export function startMarket(reg) {
  const rowsEl = document.querySelector('[data-rows]');
  const note = document.querySelector('[data-board-note]');
  const tickerEl = document.querySelector('[data-ticker]');
  const statuses = [...document.querySelectorAll('[data-status]')];
  const S = { trending: [], lastGoodTrending: null, own: null, lastGoodOwn: null, rows: new Map(), ownRow: null, skeleton: true, timer: 0, busy: false };

  const setStatus = (state, label) => statuses.forEach((s) => { s.dataset.state = state; s.querySelector('b').textContent = label; });
  const setNote = (t) => { note.hidden = !t; note.textContent = t || ''; };

  /* skeletons + own placeholder up front */
  rowsEl.innerHTML = '';
  S.ownRow = document.createElement('li'); rowsEl.append(S.ownRow);
  const mkSkel = () => { for (let i = 0; i < 10; i++) { const li = document.createElement('li'); li.className = 'row sk'; li.innerHTML = SKEL; li.dataset.sk = 1; rowsEl.append(li); } };
  mkSkel();
  tickerEl.innerHTML = '<span>Reading the board <i>≈</i> Reading the board <i>≈</i> Reading the board <i>≈</i> Reading the board <i>≈</i></span><span aria-hidden="true">Reading the board <i>≈</i> Reading the board <i>≈</i> Reading the board <i>≈</i> Reading the board <i>≈</i></span>';

  function paintOwnPlaceholder() {
    const li = S.ownRow; li.className = 'row own placeholder'; li.removeAttribute('tabindex'); li.removeAttribute('role'); li.dataset.addr = '';
    li.innerHTML = rowHTML({ symbol: 'Platecoin', name: 'Awaiting address' }, 1, { own: true, brand: true });
    li.querySelectorAll('.c').forEach((c) => { const v = c.querySelector('[data-v]') || c; v.innerHTML = '<span class="dots" aria-hidden="true">· · · · ·</span>'; });
    li.querySelector('.tile img').dataset.l = 'P'; bindImgFallback(li);
  }
  function paintOwn(o) {
    const li = S.ownRow; const first = !li.dataset.addr;
    const hasData = o && isFinite(o.price);
    if (first) {
      li.className = 'row own' + (hasData && o.url ? ' is-link' : ''); li.dataset.addr = reg.ca.value;
      li.innerHTML = rowHTML(o, 1, { own: true, brand: !o.img });
      bindImgFallback(li);
    } else {
      // logo may upgrade as sources answer: pump.fun -> DexScreener -> brand
      const img = li.querySelector('.tile img'); if (o.img && img && img.getAttribute('src') !== o.img) { li.querySelector('.tile').outerHTML = tileHTML(o, false); bindImgFallback(li); }
    }
    if (o.url) { li.classList.add('is-link'); li.onclick = () => window.open(o.url, '_blank', 'noopener'); li.tabIndex = 0; li.setAttribute('role', 'link'); li.onkeydown = (e) => { if (e.key === 'Enter') li.onclick(); }; }
    li.querySelector('.sym').textContent = o.symbol; li.querySelector('.full').textContent = o.name;
    fillRow(li, o, first);
  }

  function paintTrending(list, instant) {
    if (S.skeleton) {
      rowsEl.querySelectorAll('[data-sk]').forEach((n) => n.remove()); S.skeleton = false;
      S.rows.clear();
    }
    const seen = new Set();
    list.forEach((r, i) => {
      seen.add(r.addr);
      let li = S.rows.get(r.addr);
      if (!li) {
        li = document.createElement('li'); li.className = 'row in'; li.style.setProperty('--i', i); li.dataset.addr = r.addr;
        li.innerHTML = rowHTML(r, i + 2); bindImgFallback(li);
        if (r.url) { li.classList.add('is-link'); li.tabIndex = 0; li.setAttribute('role', 'link'); li.onclick = () => window.open(r.url, '_blank', 'noopener'); li.onkeydown = (e) => { if (e.key === 'Enter') li.onclick(); }; }
        S.rows.set(r.addr, li);
        fillRow(li, r, true);
      } else { li.querySelector('.rk').textContent = i + 2; fillRow(li, r, instant); }
      rowsEl.append(li); // append in order
    });
    for (const [a, li] of S.rows) if (!seen.has(a)) { li.remove(); S.rows.delete(a); }
    rowsEl.prepend(S.ownRow);
  }

  function paintErrorRows() {
    rowsEl.querySelectorAll('[data-sk]').forEach((n) => { n.classList.remove('sk'); n.querySelectorAll('.c').forEach((c) => (c.textContent = '—')); n.querySelector('.nm').innerHTML = '<span class="sym">—</span>'; n.querySelector('.tile').textContent = '—'; });
  }

  function paintTicker(list) {
    if (!list.length) return;
    const item = (r) => `<span class="tk">${tileHTML(r)}<small>${esc(r.symbol)}</small> ${esc(fmtPrice(r.price))} <small class="${r.chg >= 0 ? 'up' : 'dn'}">${esc(fmtPct(r.chg))}</small></span><i>≈</i>`;
    const inner = list.map(item).join('');
    tickerEl.innerHTML = `<span>${inner}</span><span aria-hidden="true">${inner}</span>`; bindImgFallback(tickerEl);
  }

  /* ---- trending feed: ONLY the market record decides ---- */
  async function loadTrending() {
    const base = new URL(reg.market.url).origin;
    const boosts = await getJSON(reg.market.url);
    const sol = (Array.isArray(boosts) ? boosts : []).filter((b) => b && b.chainId === 'solana' && b.tokenAddress);
    const uniq = new Map(); sol.forEach((b) => { const k = b.tokenAddress; if (!uniq.has(k) || (b.totalAmount || 0) > (uniq.get(k).totalAmount || 0)) uniq.set(k, b); });
    const top = [...uniq.values()].sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0)).slice(0, 10);
    const res = await Promise.allSettled(top.map((b) => getJSON(`${base}/tokens/v1/solana/${b.tokenAddress}`, { tries: 3 })));
    const out = [];
    res.forEach((x, i) => { if (x.status !== 'fulfilled') return; const pair = pickPair(x.value, top[i].tokenAddress) || pickPair(x.value, null); if (!pair) return; out.push(shape(pair, top[i].tokenAddress, { symbol: top[i].tokenAddress.slice(0, 4) })); });
    if (!out.length) throw new Error('no pairs');
    return out;
  }

  /* ---- own token: dexscreener + pump.fun in parallel, neither blocks the other ---- */
  async function loadOwn() {
    const ca = reg.ca.value; const base = new URL(reg.market.url).origin;
    const [dex, pump] = await Promise.allSettled([
      getJSON(`${base}/latest/dex/tokens/${ca}`, { tries: 3 }),
      getJSON(PUMP + ca, { tries: 2 }),
    ]);
    const pair = dex.status === 'fulfilled' ? pickPair(dex.value, null) : null; // sort by volume.h24 desc, pairs[0]
    const p = pump.status === 'fulfilled' ? pump.value : null;
    if (!pair && !p) throw new Error('own: both sources failed');
    const o = shape(pair, ca, { symbol: p?.symbol, name: p?.name });
    o.img = safeImg(p?.image_uri) || o.img; // pump.fun image_uri -> DexScreener -> brand (render step) -> letter
    return o;
  }

  async function tick() {
    if (S.busy) return; S.busy = true;
    const jobs = [];
    const marketOn = isStated(reg.market);
    const ownOn = isStated(reg.ca) && !!reg.ca.value;
    if (marketOn) jobs.push(loadTrending().then((v) => ({ k: 't', v }), (e) => ({ k: 't', e })));
    if (ownOn) jobs.push(loadOwn().then((v) => ({ k: 'o', v }), (e) => ({ k: 'o', e })));
    const out = await Promise.all(jobs);
    let tFail = false;
    for (const r of out) {
      if (r.k === 't') { if (r.v) { S.lastGoodTrending = r.v; } else tFail = true; }
      if (r.k === 'o') { if (r.v) S.lastGoodOwn = r.v; else if (!S.lastGoodOwn) S.ownErr = true; }
    }
    if (ownOn && S.lastGoodOwn) paintOwn(S.lastGoodOwn);
    else if (ownOn && S.ownErr && !S.ownRow.dataset.addr) { paintOwn({ symbol: 'Platecoin', name: '', price: NaN, chg: NaN, vol: NaN, liq: NaN, img: null, url: null }); }
    if (marketOn) {
      const own = ownOn ? reg.ca.value : null;
      const feed = S.lastGoodTrending ? S.lastGoodTrending.filter((r) => r.addr !== own) : null; // dedup: own appears once, pinned
      if (feed) { paintTrending(feed, false); paintTicker(S.lastGoodTrending); }
      if (feed && !tFail) { setStatus('live', 'Live'); setNote(''); }
      else if (feed && tFail) { setStatus('error', 'Retrying'); setNote('Source unreachable. Showing the last good reading while it retries.'); }
      else { paintErrorRows(); setStatus('error', 'Source down'); setNote('The market source did not answer. Retrying with backoff.'); }
    } else { paintErrorRows(); setStatus('idle', 'Source not stated'); setNote(''); }
    S.busy = false; schedule();
  }

  function schedule() { clearTimeout(S.timer); if (document.hidden) return; S.timer = setTimeout(tick, POLL_MS); }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(S.timer); setStatus('idle', 'Paused'); }
    else { setStatus('live', 'Live'); tick(); } // fetch immediately on visible
  });

  if (isStated(reg.ca) && reg.ca.value) { /* own row appears after first answer; show brand-logo row meanwhile */ paintOwnPlaceholder(); S.ownRow.querySelector('.full').textContent = 'Reading sources'; }
  else paintOwnPlaceholder();
  setStatus('idle', 'Connecting');
  tick();
}
