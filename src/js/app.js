// app.js — hydrate the pre-rendered page from the register, wire gates, start motion + market.
import { REGISTER, validate, scanAddresses, isStated } from './register.js';
import { startMarket } from './market.js';
import * as M from './motion.js';

const reg = REGISTER;

/* theme-color is read from the token, so no colour literal ships in the HTML */
{ const m = document.createElement('meta'); m.name = 'theme-color'; m.content = getComputedStyle(document.documentElement).getPropertyValue('--red').trim(); document.head.append(m); }

/* header height -> CSS var so hero/pins clear the fixed CA slot at every breakpoint */
const hdr = document.querySelector('[data-hdr]');
const setHdr = () => document.documentElement.style.setProperty('--hdr', hdr.offsetHeight + 'px');
new ResizeObserver(setHdr).observe(hdr); setHdr();

/* GATE 1: structural register validation */
const problems = validate(reg);
if (problems.length) console.warn('[gate] register problems:', problems);

/* GATE 2: address scanner. Strangers only; the CA slot (data-ca-exempt) and stated records are exempt. */
function scanPage() {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('[data-ca-exempt], script, style, svg').forEach((n) => n.remove());
  const strangers = scanAddresses(clone.textContent || '', reg);
  document.documentElement.dataset.gate = strangers.length ? 'warn' : 'ok';
  if (strangers.length) console.warn('[gate] unstated address-shaped strings on page:', strangers);
  return strangers;
}

/* click-to-copy with feedback */
function wireCopy() {
  document.querySelectorAll('[data-ca-copy]').forEach((btn) => {
    if (!isStated(reg.ca) || !reg.ca.value || btn.disabled) return;
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(reg.ca.value); }
      catch { const t = document.createElement('textarea'); t.value = reg.ca.value; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
      const hint = btn.querySelector('[data-ca-hint]'); const label = btn.querySelector('span:last-child');
      btn.classList.add('copied'); if (hint) hint.textContent = 'Copied'; else if (label) label.textContent = 'Copied';
      setTimeout(() => { btn.classList.remove('copied'); if (hint) hint.textContent = 'Click to copy'; else if (label) label.textContent = 'Copy address'; }, 1600);
    });
  });
}

wireCopy();
M.initProgress(); M.initSpotlight(); M.initParallax(); M.initBannerTilt();
M.initWords(); M.initIndex(); M.initHow(); M.initRack(); M.initReveal();
M.initPreloader();
startMarket(reg);
setTimeout(scanPage, 1500);
