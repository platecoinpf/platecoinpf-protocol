// build.mjs — copies src/ -> dist/, pre-renders register-driven slots, then runs the gate suite on BOTH branches
// (CA absent -> dist/, CA stated -> .proof/stated). Exit code 0 only if every gate passes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=');
const rel = (...p) => path.join(ROOT, ...p);

const LOGO_FILES = [ // explicit copy list: the logo MUST land in dist
  ['src/assets/logo-512.png', 'assets/logo-512.png'],
  ['src/assets/mark-512.png', 'assets/mark-512.png'],
  ['src/assets/apple-touch.png', 'assets/apple-touch.png'],
  ['src/assets/favicon.svg', 'assets/favicon.svg'],
  ['brand/LOGO PLATECOIN PNG.png', 'assets/logo-full.png'],
  ['reference/SAMPUL PLATECOIN JPG.jpg.jpeg', 'assets/banner.jpg'],
];

function copyDir(from, to) { fs.mkdirSync(to, { recursive: true }); for (const e of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, e.name), b = path.join(to, e.name); e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b); } }

export async function buildTo(out, ca) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  copyDir(rel('src/css'), path.join(out, 'css'));
  copyDir(rel('src/js'), path.join(out, 'js'));
  for (const [from, to] of LOGO_FILES) {
    const src = rel(from); if (!fs.existsSync(src)) throw new Error(`missing asset: ${from}`);
    fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
    fs.copyFileSync(src, path.join(out, to));
  }
  if (ca) { // proof branch only: state the CA in the DIST copy of the register, never in src/
    const f = path.join(out, 'js/register.js'); let s = fs.readFileSync(f, 'utf8');
    const before = s; s = s.replace(/ca:\s*\{\s*state:\s*'absent'\s*\}/, `ca: { state: 'stated', value: '${ca}' }`);
    if (s === before) throw new Error('could not state CA: register ca record is not absent');
    fs.writeFileSync(f, s);
  }
  const reg = await import(pathToFileURL(path.join(out, 'js/register.js')).href + `?t=${Date.now()}${Math.random()}`);
  const views = await import(pathToFileURL(path.join(out, 'js/views.js')).href + `?t=${Date.now()}${Math.random()}`);
  let html = fs.readFileSync(rel('src/index.html'), 'utf8');
  const R = reg.REGISTER;
  html = html.replace('<!--@ca-slot-->', views.caSlotHTML(R.ca)).replace('<!--@social-->', views.socialHTML(R))
    .replace('<!--@buy-->', views.buyHTML(R.ca)).replace('<!--@ca-card-->', views.caCardHTML(R.ca))
    .replace('<!--@ca-fact-->', views.caFactHTML(R.ca)).replace('<!--@x-join-->', views.xJoinHTML(R.x));
  if (/<!--@|\{\{/.test(html)) throw new Error('unreplaced template marker');
  fs.writeFileSync(path.join(out, 'index.html'), html);
  return { reg, views };
}

/* ---------------- gates ---------------- */
const textOf = (html) => html.replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, o) : o.push(p); } return o; };

export async function gateSuite(out, label, expectCA) {
  const { reg } = await buildTo(out, expectCA);
  const R = reg.REGISTER; const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  const results = []; const g = (name, ok, info = '') => results.push({ name: `[${label}] ${name}`, ok: !!ok, info });
  const files = walk(out).filter((f) => /\.(html|css|js)$/.test(f)); const tokensF = path.join(out, 'css', 'tokens.css');

  g('register structurally valid', reg.validate(R).length === 0, reg.validate(R).join('; '));
  g('inert records carry no value/url', Object.values(R).every((r) => r.state === 'stated' || (!('value' in r) && !('url' in r))));
  g(`branch is ${expectCA ? 'CA stated' : 'CA absent'}`, reg.isStated(R.ca) === !!expectCA);

  // CA slot branch proof
  const slot = /<div class="ca-wrap"[\s\S]*?<\/div>\s*(?=<div class="social")/.exec(html)?.[0] || '';
  if (expectCA) {
    g('CA slot: full address, live button', slot.includes(`>${R.ca.value}<`) && slot.includes('data-ca-copy') && slot.includes('is-live'));
    g('CA slot: address never shortened (no ellipsis)', !/\.{3}|…/.test(slot));
    g('buy link derived from CA', html.includes(`https://pump.fun/coin/${R.ca.value}`));
  } else {
    g('CA slot inert: no button, no value', !slot.includes('data-ca-copy') && slot.includes('is-inert') && !/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(textOf(slot)));
    g('no pump.fun href while CA absent', !html.includes('pump.fun/coin'));
    g('copy button disabled while CA absent', /<button class="btn btn-primary is-inert"[^>]*disabled/.test(html));
  }

  // social
  const xA = /<a class="soc"[^>]*data-soc="x"/.test(html), ghA = /<a class="soc"[^>]*data-soc="github"/.test(html);
  g('X icon present; href matches register', R.x.state === 'stated' ? html.includes(`href="${R.x.url}"`) && xA : !xA);
  g('GitHub icon present and inert (no href)', R.github.state === 'stated' ? ghA : (!ghA && /<span class="soc is-inert"[^>]*data-soc="github"/.test(html)));
  g('both social icons present, icon-only', (html.match(/class="soc[ "]/g) || []).length === 2 && !/<(a|span) class="soc[^>]*>[^<]*[A-Za-z]/.test(html.replace(/<svg[\s\S]*?<\/svg>/g, '')));
  g('no href for any unstated record', Object.entries({ github: R.github, ca: R.ca }).every(([k, r]) => r.state === 'stated' || !html.includes(k === 'github' ? 'github.com' : 'pump.fun/coin')));

  // address scanner (CA exempt; stated registry matched, 0x not blanket-rejected)
  const visible = textOf(html.replace(/<[^>]*data-ca-exempt[^>]*>[\s\S]*?<\/(button|div|p)>/g, ' '));
  const strangers = reg.scanAddresses(visible, R);
  g('address scanner: no unstated address-shaped strings', strangers.length === 0, strangers.join(','));
  g('scanner never blanket-rejects 0x hex (stated 0x passes, stranger 0x flagged)', (() => { const a = '0x' + 'ab'.repeat(20), b = '0x' + 'cd'.repeat(20); const fake = { z: { state: 'stated', value: a } }; return reg.scanAddresses(a, fake).length === 0 && reg.scanAddresses(b, fake).length === 1; })());

  // palette rule
  const hexHits = files.filter((f) => f !== tokensF).flatMap((f) => (fs.readFileSync(f, 'utf8').match(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(/g) || []).map((m) => `${path.basename(f)}:${m}`));
  g('colour literals live in tokens.css only', hexHits.length === 0, hexHits.slice(0, 5).join(' '));
  const favicon = fs.readFileSync(path.join(out, 'assets/favicon.svg'), 'utf8');
  g('favicon: SVG 32x32 with sampled-palette provenance comment', /viewBox="0 0 32 32"/.test(favicon) && /width="32" height="32"/.test(favicon) && /<!--[\s\S]*#E92C26[\s\S]*-->/.test(favicon));

  // no dates
  const vis = textOf(html);
  const jsAll = files.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const dateRe = /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}\b|\b\d{1,2}:\d{2}\b|as of|checked|last updated|\bago\b/i;
  g('no dates/timestamps/clock strings in visible page', !dateRe.test(vis), (dateRe.exec(vis) || [''])[0]);
  g('no Date API in shipped js', !/new Date|Date\.now|toLocale(Date|Time)String|Intl\.DateTimeFormat/.test(jsAll));

  // logo in dist + path
  const logoOk = fs.existsSync(path.join(out, 'assets/logo-512.png')) && fs.readFileSync(path.join(out, 'assets/logo-512.png')).subarray(1, 4).toString() === 'PNG';
  g('logo file copied into output (valid PNG)', logoOk);
  g('index.html references logo with correct relative path', /src="assets\/logo-512\.png"/.test(html) && !/src="\/assets\/logo/.test(html));
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+?)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|\/\/|mailto:)/.test(u));
  const missing = refs.filter((u) => !fs.existsSync(path.join(out, u.split('?')[0])));
  g('every relative src/href resolves inside output', missing.length === 0, missing.join(','));

  // css rules
  const css = fs.readFileSync(path.join(out, 'css/main.css'), 'utf8');
  g('no ch units', !/\d(ch)\b/.test(css));
  g('reduced-motion fallback present', /prefers-reduced-motion:\s*reduce/.test(css));
  g('own-row accent border + ownPulse + reduced-motion none', /\.row\.own\s*\{[^}]*border-left:\s*2px solid var\(--color-accent\)/.test(css) && /@keyframes ownPulse/.test(css) && /prefers-reduced-motion[\s\S]*\.row\.own\s*\{\s*animation:\s*none/.test(css));
  g('tap targets: social >=44px, buttons >=44px', /\.soc\s*\{[^}]*width:\s*44px;\s*height:\s*44px/.test(css) && /\.btn\s*\{[^}]*min-height:\s*48px/.test(css));
  const mk = fs.readFileSync(path.join(out, 'js/market.js'), 'utf8');
  g('market trending never reads CA state', (() => { const m = /async function loadTrending\(\)[\s\S]*?\n  \}\n/.exec(mk); return !!m && !/reg\.ca|isStated\(reg\.ca/.test(m[0]); })());
  g('pump.fun fetched in parallel with DexScreener (allSettled)', /Promise\.allSettled\(\[\s*getJSON\(`\$\{base\}\/latest\/dex\/tokens\/\$\{ca\}`[\s\S]*getJSON\(PUMP \+ ca/.test(mk));
  g('poll 60s, hidden-pause, immediate on visible', /POLL_MS = 60000/.test(mk) && /document\.hidden/.test(mk) && /visibilitychange/.test(mk));

  // hygiene
  const bad = [];
  for (const f of walk(ROOT)) { const r = path.relative(ROOT, f).replace(/\\/g, '/'); if (/^(node_modules|\.git|brand|reference)\//.test(r) || r.startsWith('scripts/')) continue; if (/(^|\/)(CLAUDE\.md|\.claude)(\/|$)/i.test(r)) bad.push(r); else if (/\.(md|html|css|js|json|mjs|svg)$|^LICENSE$/.test(r) && /co-authored-by|generated (with|by) claude|anthropic|\bclaude\b/i.test(fs.readFileSync(f, 'utf8'))) bad.push(r); }
  g('repo hygiene: no CLAUDE.md, .claude/, AI attribution', bad.length === 0, bad.join(','));
  g('output has index.html', fs.existsSync(path.join(out, 'index.html')));
  return results;
}

async function main() {
  const out = arg('out'), ca = arg('ca');
  if (out) { await buildTo(rel(out), ca || undefined); console.log(`built ${out}${ca ? ' (CA stated)' : ''}`); return; }
  const PROOF_CA = 'So11111111111111111111111111111111111111112'; // test-only, written to .proof/ never src/
  const a = await gateSuite(rel('dist'), 'absent', undefined);
  const s = await gateSuite(rel('.proof/stated'), 'stated', PROOF_CA);
  await buildTo(rel('dist'), undefined); // leave dist/ as the real (CA absent) build
  const all = [...a, ...s]; let fail = 0;
  for (const r of all) { if (!r.ok) fail++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.info}`); }
  console.log(`\ngates: ${all.length - fail}/${all.length} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch((e) => { console.error(e); process.exit(1); });
