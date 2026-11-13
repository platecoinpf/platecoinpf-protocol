// views.js — pure string renderers shared by the build (pre-render) and the browser (hydrate).
import { isStated, handleOf } from './register.js';

export const X_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
export const GH_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** One icon-only social control. Stated -> <a href>. Otherwise inert <span>, no href. */
function icon(rec, svg, name) {
  if (isStated(rec) && rec.url) {
    const h = handleOf(rec);
    return `<a class="soc" href="${esc(rec.url)}" target="_blank" rel="noopener noreferrer" aria-label="${name}${h ? ' ' + esc(h) : ''}" data-soc="${name.toLowerCase()}">${svg}</a>`;
  }
  return `<span class="soc is-inert" role="img" aria-disabled="true" aria-label="${name} (not available yet)" data-soc="${name.toLowerCase()}">${svg}</span>`;
}
export const socialHTML = (reg) => icon(reg.x, X_SVG, 'X') + icon(reg.github, GH_SVG, 'GitHub');

/** The CA slot: full address, never shortened. Inert until stated. */
export function caSlotHTML(rec) {
  if (isStated(rec) && rec.value) {
    return `<button type="button" class="ca-slot is-live" data-ca-copy data-ca-exempt aria-label="Copy contract address">` +
      `<span class="ca-tag">CA</span><span class="ca-addr">${esc(rec.value)}</span>` +
      `<span class="ca-hint" data-ca-hint aria-live="polite">Click to copy</span></button>`;
  }
  return `<div class="ca-slot is-inert" data-ca-exempt role="note" aria-label="Contract address not stated yet">` +
    `<span class="ca-tag">CA</span><span class="ca-addr">Not stated yet</span><span class="ca-hint">Inert until stated</span></div>`;
}

export function caCardHTML(rec) {
  if (isStated(rec) && rec.value) {
    return `<p class="ca-value is-address" data-ca-exempt>${esc(rec.value)}</p>` +
      `<div class="ca-actions"><button class="btn btn-primary" type="button" data-ca-copy><span>Copy address</span></button></div>`;
  }
  return `<p class="ca-value">AWAITING ADDRESS</p><div class="ca-actions"><button class="btn btn-primary is-inert" type="button" disabled aria-disabled="true"><span>Copy address</span></button></div>`;
}

export function buyHTML(rec) {
  if (isStated(rec) && rec.value) {
    return `<a class="btn btn-primary" href="https://pump.fun/coin/${esc(rec.value)}" target="_blank" rel="noopener noreferrer"><span>Buy Platecoin</span></a>`;
  }
  return `<span class="btn btn-primary is-inert" role="button" aria-disabled="true"><span>Buy Platecoin</span><i>Soon</i></span>`;
}

export function xJoinHTML(rec) {
  if (isStated(rec) && rec.url) return `<a class="btn btn-primary" href="${esc(rec.url)}" target="_blank" rel="noopener noreferrer"><span>Find us on X</span></a>`;
  return `<span class="btn btn-primary is-inert" role="button" aria-disabled="true"><span>Find us on X</span><i>Soon</i></span>`;
}

export function caFactHTML(rec) {
  return isStated(rec) && rec.value ? 'Stated above' : 'Not stated yet';
}
