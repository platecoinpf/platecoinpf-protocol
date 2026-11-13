// gates.mjs — mutation harness. Every anchor is state-independent: it reads each record's CURRENT state at
// runtime and flips it, so the harness is valid whichever way the register is set today.
import { REGISTER, validate, isStated, scanAddresses } from '../src/js/register.js';
import { caSlotHTML, socialHTML, buyHTML } from '../src/js/views.js';

const SAMPLE = { ca: { value: 'So11111111111111111111111111111111111111112' }, x: { url: 'https://x.com/example' }, github: { url: 'https://github.com/example/repo' }, market: { url: 'https://api.dexscreener.com/token-boosts/top/v1' }, chain: { value: 'Solana mainnet', url: 'https://solana-rpc.publicnode.com' } };
let pass = 0, fail = 0; const t = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };
const clone = (o) => JSON.parse(JSON.stringify(o));
const flip = (reg, k) => { const r = clone(reg); r[k] = isStated(r[k]) ? { state: 'absent' } : { state: 'stated', ...SAMPLE[k] }; return r; };

for (const k of Object.keys(REGISTER)) {
  const cur = isStated(REGISTER[k]) ? 'stated' : 'inert';
  const m = flip(REGISTER, k);
  t(`${k}: flipping ${cur} -> ${isStated(m[k]) ? 'stated' : 'inert'} keeps register valid`, validate(m).length === 0);
  // poison: an inert record that smuggles value/url must be caught, whatever the current state
  const p = clone(REGISTER); p[k] = { state: 'absent', value: 'x', url: 'https://x.test' };
  t(`${k}: inert record carrying value+url is rejected`, validate(p).length >= 2);
}

// Views follow the register, in whichever direction it currently points.
{ const m = flip(REGISTER, 'ca'); const on = isStated(m.ca);
  t('ca slot: live button iff stated', /data-ca-copy/.test(caSlotHTML(m.ca)) === on);
  t('ca slot: inert has no address', on || !/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(caSlotHTML(m.ca).replace(/<[^>]+>/g, ' ')));
  t('buy link: href iff stated', /href=/.test(buyHTML(m.ca)) === on); }
for (const k of ['x', 'github']) { const m = flip(REGISTER, k); const on = isStated(m[k]); const html = socialHTML(m);
  const el = new RegExp(`<(a|span) class="soc[^>]*data-soc="${k}"[^>]*>`).exec(html)?.[0] || '';
  t(`${k} icon: always rendered, href iff stated`, !!el && /href=/.test(el) === on); }

// Gate warning: stated 0x passes, strangers flagged, base58 stranger flagged, CA exempt via registry.
{ const reg = flip(REGISTER, 'ca'); const addr = reg.ca.value || SAMPLE.ca.value; const zero = '0x' + '1f'.repeat(20);
  t('scanner: stated address passes when registered', !isStated(reg.ca) || scanAddresses(`see ${addr}`, reg).length === 0);
  t('scanner: unregistered 0x flagged, not blanket-rejected', scanAddresses(`pay ${zero}`, reg).length === 1 && scanAddresses('plain words only', reg).length === 0);
  t('scanner: unregistered base58 flagged', scanAddresses(`mint ${SAMPLE.ca.value}`, { ...clone(REGISTER), ca: { state: 'absent' } }).length === 1); }

console.log(`\nmutation harness: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
