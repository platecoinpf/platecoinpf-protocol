// register.js — every external fact is one record: { state: 'stated'|'absent'|'unconfirmed', ... }
// RULE: an inert record (absent/unconfirmed) MUST NOT carry `value` or `url`.
// RULE: store the URL, derive the handle. No href is ever produced for an unstated record.

export const REGISTER = {
  ca:     { state: 'absent' },
  x:      { state: 'stated', url: 'https://x.com/platecoinpf' },
  github: { state: 'absent' },
  market: { state: 'stated', url: 'https://api.dexscreener.com/token-boosts/top/v1' },
  chain:  { state: 'stated', value: 'Solana mainnet', url: 'https://solana-rpc.publicnode.com' },
};

export const STATES = ['stated', 'absent', 'unconfirmed'];
export const isStated = (rec) => !!rec && rec.state === 'stated';
export const BASE58_ADDR = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

/** Structural validation. Returns an array of problems (empty = clean). */
export function validate(reg) {
  const bad = [];
  for (const [k, r] of Object.entries(reg)) {
    if (!STATES.includes(r.state)) bad.push(`${k}: unknown state "${r.state}"`);
    if (r.state !== 'stated') {
      if ('value' in r) bad.push(`${k}: inert record carries value`);
      if ('url' in r) bad.push(`${k}: inert record carries url`);
    } else if (!('value' in r) && !('url' in r)) bad.push(`${k}: stated record has neither value nor url`);
  }
  if (isStated(reg.ca) && !new RegExp(`^${BASE58_ADDR.source}$`).test(reg.ca.value || '')) bad.push('ca: stated value is not base58-shaped');
  return bad;
}

/** Derive the public handle from a stored URL. */
export function handleOf(rec) {
  if (!isStated(rec) || !rec.url) return null;
  try { const p = new URL(rec.url).pathname.split('/').filter(Boolean); return p.length ? '@' + p[p.length - 1] : null; }
  catch { return null; }
}

const ADDR_G = /0x[0-9a-fA-F]{40}\b|[1-9A-HJ-NP-Za-km-z]{32,44}/g;

/** Every address-shaped string the register legitimately states. */
export function statedAddresses(reg) {
  const out = new Set();
  for (const r of Object.values(reg)) {
    if (!isStated(r)) continue;
    for (const s of [r.value, r.url]) if (s) for (const m of s.match(ADDR_G) || []) out.add(m);
  }
  return out;
}

/**
 * GATE WARNING — never blanket-reject 0x hex. Match every address-shaped string
 * against the stated registry; only strangers are reported. The CA is exempt
 * from the scanner (it is rendered in its own slot).
 */
export function scanAddresses(text, reg) {
  const known = statedAddresses(reg);
  return (text.match(ADDR_G) || []).filter((h) => !known.has(h));
}
