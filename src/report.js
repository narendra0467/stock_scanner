// report.js — rich, printable HTML report with inline-SVG visualizations
// (score donut, category bars, per-metric graded "bullet" bars, risk panel)
// plus a Save-as-PDF button. No external libs — works offline and prints clean.

import { pct, mult, money, price, numf, metricValue } from './format.js';
import { GLOSSARY, GLOSSARY_GROUPS } from './glossary.js';

const TIER_COLOR = {
  strong: '#16a34a',
  good: '#4d9e5f',
  neutral: '#d99e00',
  weak: '#e07a18',
  poor: '#dc2626',
  na: '#6b7280',
};
const STATUS_COLOR = { BEAT: '#16a34a', OK: '#d99e00', MISS: '#dc2626', 'N/A': '#9ca3af' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// education helpers
function info(key) {
  return GLOSSARY[key] ? `<button class="info-btn no-print" type="button" aria-label="What is this?">i</button>` : '';
}
function explain(key) {
  const g = GLOSSARY[key];
  return g ? `<div class="explain"><b>${esc(g.short)}</b> ${esc(g.body)}</div>` : '';
}

// ---- SVG score donut ----
function donut(score, color, size = 132) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const pctv = score === null ? 0 : clamp01(score / 100);
  const dash = `${(pctv * c).toFixed(1)} ${c.toFixed(1)}`;
  const cx = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="score ${score}">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#eceff3" stroke-width="11"/>
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="11"
      stroke-linecap="round" stroke-dasharray="${dash}" transform="rotate(-90 ${cx} ${cx})"/>
    <text x="50%" y="49%" text-anchor="middle" dominant-baseline="middle"
      font-size="${size * 0.3}" font-weight="800" fill="${color}">${score ?? '—'}</text>
    <text x="50%" y="68%" text-anchor="middle" font-size="11" fill="#9aa0ab">/ 100</text>
  </svg>`;
}

// ---- horizontal category bar (0..100) ----
function catBar(label, score, color) {
  const w = score === null ? 0 : clamp01(score / 100) * 100;
  return `<div class="catbar">
    <div class="catbar-top"><span>${esc(label)}</span><b>${score ?? '—'}</b></div>
    <div class="track"><div class="fill" style="width:${w}%;background:${color}"></div></div>
  </div>`;
}

// ---- per-metric graded "bullet" bar (fill = grade 0..1, colored by status) ----
function metricRow(m) {
  const s = m.score === null ? 0 : clamp01(m.score) * 100;
  const col = STATUS_COLOR[m.status];
  return `<div class="metric">
    <div class="m-label">${esc(m.label)}${info(m.key)}</div>
    <div class="m-val">${esc(metricValue(m))}</div>
    <div class="m-bar"><div class="m-track"><div class="m-fill" style="width:${s}%;background:${col}"></div></div></div>
    <div class="m-ideal">${esc(m.idealText)}</div>
    <div class="m-status" style="color:${col}">${m.status}</div>
  </div>
  ${explain(m.key)}`;
}

function categoryBlock(title, weight, cat, color, catKey) {
  return `<div class="cat">
    <div class="cat-head">
      <h3>${esc(title)} <span class="weight">${Math.round(weight * 100)}%</span>${info(catKey)}</h3>
      <div class="cat-score" style="color:${color}">${cat.score ?? '—'}<span>/100 · ${cat.beats}/${cat.total} strong</span></div>
    </div>
    ${explain(catKey)}
    <div class="metrics">
      <div class="metric head">
        <div class="m-label">Metric</div><div class="m-val">Value</div>
        <div class="m-bar">Grade (vs sector)</div><div class="m-ideal">Ideal</div><div class="m-status">●</div>
      </div>
      ${cat.metrics.map(metricRow).join('')}
    </div>
  </div>`;
}

function riskPanel(risk) {
  if (!risk || risk.score === null) return '';
  const color = risk.score >= 70 ? '#16a34a' : risk.score >= 45 ? '#d99e00' : '#dc2626';
  const rows = risk.parts
    .map((p) => {
      const col = p.score >= 0.7 ? '#16a34a' : p.score >= 0.4 ? '#d99e00' : '#dc2626';
      return `<div class="metric">
        <div class="m-label">${esc(p.label)}${info(p.key)}</div>
        <div class="m-val">${esc(p.value)}</div>
        <div class="m-bar"><div class="m-track"><div class="m-fill" style="width:${clamp01(p.score) * 100}%;background:${col}"></div></div></div>
        <div class="m-ideal"></div><div class="m-status" style="color:${col}">${p.score >= 0.7 ? 'OK' : p.score >= 0.4 ? 'WATCH' : 'RISK'}</div>
      </div>
      ${explain(p.key)}`;
    })
    .join('');
  return `<div class="cat">
    <div class="cat-head"><h3>Risk &amp; Balance Sheet${info('risk')}</h3>
      <div class="cat-score" style="color:${color}">${risk.score}<span>/100 safety</span></div></div>
    ${explain('risk')}
    <div class="metrics">${rows}</div>
    ${risk.flags.length ? `<ul class="flags">${risk.flags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function list(items, cls = '') {
  return `<ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

// full glossary as a collapsible section (always available, even in pro mode)
function renderGlossary() {
  const groups = GLOSSARY_GROUPS.map((grp) => {
    const items = grp.keys
      .filter((k) => GLOSSARY[k])
      .map((k) => `<div class="gl-item"><div class="gl-term">${esc(GLOSSARY[k].short)}</div><div class="gl-def">${esc(GLOSSARY[k].body)}</div></div>`)
      .join('');
    return `<div class="gl-group"><h4>${esc(grp.title)}</h4>${items}</div>`;
  }).join('');
  return `<details class="glossary">
    <summary>📖 Glossary — what every term means (plain English)</summary>
    ${groups}
  </details>`;
}

export function renderHtml(f, scored, narrative, generatedAt) {
  const v = scored.verdict;
  const color = TIER_COLOR[v.tier] || '#444';
  const cur = f.currency;
  const c = scored.categories;

  const snapshot = [
    ['Last price', price(f.price, cur)],
    ['Market cap', money(f.marketCap, cur)],
    ['Sector', f.sector || '—'],
    ['Industry', f.industry || '—'],
    ['Exchange', f.exchange || '—'],
    ['Beta', f.beta !== null ? numf(f.beta) : '—'],
    ['ROIC', pct(f.roic)],
    ['FCF yield', pct(f.fcfYield)],
    ['Net debt / EBITDA', f.netDebtToEbitda !== null ? mult(f.netDebtToEbitda) : '—'],
    ['Dividend yield', pct(f.divYield)],
    ['Analyst rating', f.recKey ? f.recKey.replace(/_/g, ' ') : '—'],
    ['Mean target', price(f.targetMean, cur)],
  ];

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(f.symbol)} — Fundamental Report</title>
<style>
  :root { --ink:#15181d; --muted:#6b7280; --line:#e7e9ee; --bg:#fff; --soft:#f6f7f9; }
  * { box-sizing:border-box; }
  html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:var(--ink);
         margin:0; padding:26px 18px 60px; line-height:1.5; min-height:100vh; position:relative;
         background:
           radial-gradient(1100px 520px at 8% -8%, rgba(139,92,246,.18), transparent 55%),
           radial-gradient(950px 480px at 108% 4%, rgba(236,72,153,.14), transparent 52%),
           radial-gradient(800px 700px at 50% 120%, rgba(251,146,60,.13), transparent 60%),
           linear-gradient(180deg, #f1eefb 0%, #f6f4fc 40%, #f0eef8 100%); }
  /* faint chart-line watermark across the whole page */
  body::before { content:''; position:fixed; inset:0; z-index:0; pointer-events:none; opacity:.55;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='300'><polyline points='0,260 120,230 240,250 360,180 480,205 600,120 720,150 840,80 960,110 1080,40 1200,70' fill='none' stroke='%238b5cf6' stroke-width='3' stroke-opacity='0.12'/><polyline points='0,280 120,270 240,275 360,255 480,262 600,240 720,250 840,225 960,235 1080,210 1200,225' fill='none' stroke='%23ec4899' stroke-width='3' stroke-opacity='0.09'/></svg>");
    background-repeat:no-repeat; background-position:center 70%; background-size:140% auto; }
  .sheet { position:relative; z-index:1; max-width:920px; margin:0 auto; background:#fff;
           border-radius:18px; box-shadow:0 18px 50px rgba(23,42,80,.12), 0 2px 8px rgba(23,42,80,.06);
           padding:34px 32px 56px; overflow:hidden; }
  .sheet::before { content:''; position:absolute; top:0; left:0; right:0; height:6px;
                   background:linear-gradient(90deg, #8b5cf6 0%, #ec4899 55%, #fb923c 100%); }
  .pdfbtn { position:fixed; top:16px; right:18px; z-index:10; background:${color}; color:#fff; border:0; padding:10px 16px;
            border-radius:10px; font-weight:700; font-size:13px; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,.2); }
  header { display:flex; justify-content:space-between; align-items:flex-end; gap:16px;
           border-bottom:3px solid var(--ink); padding-bottom:14px; margin-bottom:14px; }
  h1 { margin:0 0 3px; font-size:25px; }
  h1 .sym { color:var(--muted); font-weight:500; }
  h2 { font-size:17px; margin:30px 0 12px; border-bottom:1px solid var(--line); padding-bottom:6px; }
  h3 { font-size:15px; margin:0; }
  .sub { color:var(--muted); font-size:12.5px; }

  /* hero scorecard */
  .hero { display:flex; gap:22px; align-items:center; padding:18px 20px; border:1px solid var(--line);
          border-radius:14px; background:linear-gradient(180deg,var(--soft),#fff); margin-bottom:8px; }
  .hero .right { flex:1; }
  .verdict-badge { display:inline-block; padding:5px 14px; border-radius:20px; color:#fff; font-weight:800;
                   font-size:14px; background:${color}; letter-spacing:.3px; }
  .grouptag { font-size:11px; color:var(--muted); margin-left:8px; }
  .catbars { display:grid; grid-template-columns:1fr 1fr; gap:10px 22px; margin-top:14px; }
  .catbar-top { display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:3px; }
  .track { height:9px; background:#eceff3; border-radius:6px; overflow:hidden; }
  .fill { height:100%; border-radius:6px; }

  table.snap { width:100%; border-collapse:collapse; font-size:13px; }
  .snap td { padding:6px 10px; border-bottom:1px solid var(--line); }
  .snapgrid { display:grid; grid-template-columns:1fr 1fr; gap:0 28px; }
  .snap td:first-child { color:var(--muted); width:55%; }

  /* metric bullet rows */
  .cat { margin:8px 0 16px; }
  .cat-head { display:flex; justify-content:space-between; align-items:baseline; margin:14px 0 8px; }
  .weight { color:var(--muted); font-weight:400; font-size:12px; }
  .cat-score { font-weight:800; font-size:15px; }
  .cat-score span { color:var(--muted); font-weight:400; font-size:11.5px; }
  .metric { display:grid; grid-template-columns:148px 64px 1fr 70px 46px; align-items:center; gap:10px;
            padding:5px 0; border-bottom:1px solid #f1f2f5; font-size:13px; }
  .metric.head { color:var(--muted); font-size:10.5px; text-transform:uppercase; letter-spacing:.5px; border-bottom:1.5px solid var(--line); }
  .m-val { font-variant-numeric:tabular-nums; font-weight:700; text-align:right; }
  .m-track { height:8px; background:#eceff3; border-radius:6px; overflow:hidden; }
  .m-fill { height:100%; border-radius:6px; }
  .m-ideal { color:var(--muted); font-size:12px; }
  .m-status { font-weight:800; text-align:right; font-size:11.5px; }
  ul.flags { margin:8px 0 0; padding-left:18px; color:#b4541a; font-size:12.5px; }

  /* ---- education layer ---- */
  .info-btn { display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px;
              margin-left:6px; border:0; border-radius:50%; background:#e3e9f3; color:#5b6472;
              font-size:10px; font-weight:800; font-style:italic; font-family:Georgia,serif;
              cursor:pointer; vertical-align:middle; line-height:1; padding:0; }
  .info-btn:hover { background:#4f8cff; color:#fff; }
  .info-btn.active { background:#4f8cff; color:#fff; }
  /* explanation drops down smoothly; hidden by default (clean pro view) */
  .explain { max-height:0; overflow:hidden; opacity:0; background:#f2f7ff; border-left:3px solid #9bbcff;
             color:#3a4250; border-radius:0 7px 7px 0; font-size:12.5px; line-height:1.55;
             margin:0; padding:0 13px; transition:max-height .25s ease, opacity .2s ease, padding .25s ease, margin .25s ease; }
  .explain b { color:#1f2937; }
  .explain.open, body.learn .explain { max-height:340px; opacity:1; padding:9px 13px; margin:3px 0 10px; }
  .learnbar { display:flex; align-items:center; gap:10px; margin:0 0 16px; font-size:12px; color:var(--muted); }
  .learn-toggle { display:inline-flex; align-items:center; gap:7px; cursor:pointer; font-weight:600; color:#5b6472;
                  padding:4px 10px 4px 5px; border:1px solid var(--line); border-radius:20px; background:#fbfcfe; }
  .learn-toggle:hover { border-color:#9bbcff; color:#1d4ed8; }
  .switch { width:32px; height:18px; border-radius:20px; background:#cdd5e1; position:relative; transition:.15s; flex:none; }
  .switch::after { content:''; position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%;
                   background:#fff; transition:.15s; box-shadow:0 1px 2px rgba(0,0,0,.25); }
  body.learn .switch { background:#2563eb; } body.learn .switch::after { left:16px; }
  .glossary { margin-top:30px; border:1px solid var(--line); border-radius:10px; padding:4px 16px; background:#fbfcfe; }
  .glossary > summary { cursor:pointer; font-weight:700; padding:10px 0; font-size:14px; }
  .gl-group { margin:10px 0 16px; } .gl-group h4 { margin:14px 0 8px; font-size:13px; color:#1d4ed8; }
  .gl-item { padding:7px 0; border-bottom:1px solid #eef0f4; }
  .gl-term { font-weight:700; font-size:13px; } .gl-def { font-size:12.5px; color:#4b5563; margin-top:2px; }

  .cols { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  ul { margin:6px 0; padding-left:18px; } li { margin:5px 0; }
  ul.bull li::marker { color:#16a34a; } ul.bear li::marker { color:#dc2626; }
  .para { background:var(--soft); border-left:4px solid ${color}; padding:13px 16px; border-radius:0 8px 8px 0; }
  .disclaimer { margin-top:38px; padding:14px 16px; border:1px dashed #c4c7cd; border-radius:8px;
                font-size:11.5px; color:var(--muted); background:#fcfcfd; }
  footer { margin-top:22px; font-size:11px; color:#9aa0ab; text-align:center; }
  @media (max-width:640px){ .catbars,.snapgrid,.cols{grid-template-columns:1fr;} .metric{grid-template-columns:120px 56px 1fr 40px;} .m-ideal{display:none;} }
  @media print {
    body{ padding:0; background:#fff !important; } body::before{ display:none; }
    .sheet{ box-shadow:none; border-radius:0; max-width:none; padding:0; } .sheet::before{ display:none; }
    .pdfbtn,.learnbar{ display:none; }
    .hero,.para{ background:#fff !important; } a{ color:inherit; text-decoration:none; }
    .no-print{ display:none !important; }
    .glossary{ break-inside:avoid; } .glossary[open] summary{ list-style:none; }
  }
</style>
</head><body>

<button class="pdfbtn" onclick="window.print()">⬇ Save as PDF</button>

<div class="sheet">

<header>
  <div>
    <h1>${esc(f.name)} <span class="sym">(${esc(f.symbol)})</span></h1>
    <div class="sub">Fundamental research report · ${esc(generatedAt)} · data via Yahoo Finance</div>
  </div>
</header>

<div class="learnbar">
  <label class="learn-toggle"><span class="switch"></span><span id="learnLabel">Explain terms</span></label>
  <span class="sub">New to this? Click any <b>ⓘ</b> to see what a metric means — or flip this on to explain everything.</span>
</div>

<div class="hero">
  ${donut(scored.overall, color)}
  <div class="right">
    <span class="verdict-badge">${esc(v.label)}</span>
    <span class="grouptag">scored vs <b>${esc(scored.group)}</b>-sector norms</span>
    <div class="catbars">
      ${catBar('Valuation', c.valuation.score, TIER_COLOR.neutral)}
      ${catBar('Financial Health', c.health.score, TIER_COLOR.good)}
      ${catBar('Growth', c.growth.score, '#3b82f6')}
      ${catBar('Risk (safety)', scored.risk.score, scored.risk.score >= 60 ? TIER_COLOR.good : TIER_COLOR.weak)}
    </div>
  </div>
</div>
${scored.riskCapped ? `<p class="sub">⚠ Headline score capped due to balance-sheet fragility (see Risk panel).</p>` : ''}
${explain('overall')}
${explain('beatmiss')}

<h2>Snapshot</h2>
<div class="snapgrid">
  <table class="snap"><tbody>${snapshot.slice(0, 6).map(([k, val]) => `<tr><td>${esc(k)}</td><td>${esc(val)}</td></tr>`).join('')}</tbody></table>
  <table class="snap"><tbody>${snapshot.slice(6).map(([k, val]) => `<tr><td>${esc(k)}</td><td>${esc(val)}</td></tr>`).join('')}</tbody></table>
</div>

<h2>Business</h2>
<p>${esc(narrative.businessModel)}</p>

<h2>Scorecard</h2>
${categoryBlock('Valuation', scored.weights.valuation, c.valuation, TIER_COLOR.neutral, 'valuation')}
${categoryBlock('Financial Health & Quality', scored.weights.health, c.health, TIER_COLOR.good, 'health')}
${categoryBlock('Growth', scored.weights.growth, c.growth, '#3b82f6', 'growth')}
${riskPanel(scored.risk)}

<h2>Bull vs Bear</h2>
<div class="cols">
  <div><h3 style="color:#16a34a">Bull case</h3>${list(narrative.bull, 'bull')}</div>
  <div><h3 style="color:#dc2626">Bear case</h3>${list(narrative.bear, 'bear')}</div>
</div>

${narrative.catalysts.length ? `<h2>Catalysts &amp; Asymmetry</h2>${list(narrative.catalysts)}` : ''}
${narrative.asymmetry ? `<p class="sub">${esc(narrative.asymmetry)}</p>` : ''}

<h2>Verdict</h2>
<p class="para">${esc(narrative.verdict)}</p>

${renderGlossary()}

<div class="disclaimer">
  <strong>Educational / informational only — not financial advice.</strong>
  Generated automatically from publicly available data (Yahoo Finance — unofficial, may be delayed,
  incomplete, or inaccurate) using a fixed, generic rule-based methodology with sector-relative thresholds.
  Not a recommendation to buy, sell, or hold any security. Some figures (e.g. ROIC) are approximations
  derived from reported fields. Do your own research and consult a licensed professional before investing.
  For personal, non-commercial use.
</div>

<footer>Generated by stock-scanner · sector-relative rule-based methodology</footer>

</div><!-- /sheet -->

<script>
(function(){
  var body = document.body, label = document.getElementById('learnLabel');
  // tell the dashboard (if we're embedded) to resize the iframe after content changes
  function notify(){ try { if(window.parent && window.parent!==window)
    window.parent.postMessage({type:'ss-resize', height: document.documentElement.scrollHeight}, '*'); } catch(e){} }
  function afterAnim(){ setTimeout(notify, 300); }
  // clean pro view by default; only "explain everything" if the reader opted in before
  try { if (localStorage.getItem('ss_learn') === 'on') body.classList.add('learn'); } catch(e){}
  function sync(){ if(label) label.textContent = body.classList.contains('learn') ? 'Explaining all' : 'Explain terms'; }
  sync();
  var tog = document.querySelector('.learn-toggle');
  if (tog) tog.addEventListener('click', function(){
    body.classList.toggle('learn');
    try { localStorage.setItem('ss_learn', body.classList.contains('learn') ? 'on' : 'off'); } catch(e){}
    sync(); afterAnim();
  });
  // per-item ⓘ buttons: drop down just that one explanation (independent of beginner mode)
  document.querySelectorAll('.info-btn').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation(); e.preventDefault();
      var host = btn.closest('.metric') || btn.closest('.cat-head');
      var ex = host && host.nextElementSibling;
      if (ex && ex.classList && ex.classList.contains('explain')) {
        var open = ex.classList.toggle('open');
        btn.classList.toggle('active', open);
        afterAnim();
      }
    });
  });
  var gl = document.querySelector('details.glossary');
  if (gl) gl.addEventListener('toggle', notify);
})();
</script>

</body></html>`;
}

// ---------- compact console summary ----------
export function renderText(f, scored, narrative) {
  const v = scored.verdict;
  const c = scored.categories;
  const L = [];
  L.push('');
  L.push(`  ${f.name} (${f.symbol})  ·  ${price(f.price, f.currency)}  ·  ${money(f.marketCap, f.currency)}`);
  L.push(`  ${f.sector || '—'}${f.industry ? ' / ' + f.industry : ''}   [${scored.group} sector model]`);
  L.push('  ' + '-'.repeat(58));
  L.push(`  SCORE ${scored.overall ?? '—'}/100  →  ${v.label}${scored.riskCapped ? '  (risk-capped)' : ''}`);
  L.push(
    `  Valuation ${c.valuation.score ?? '—'}   Health ${c.health.score ?? '—'}   ` +
      `Growth ${c.growth.score ?? '—'}   Risk ${scored.risk.score ?? '—'}`
  );
  L.push('  ' + '-'.repeat(58));
  const all = [...c.valuation.metrics, ...c.health.metrics, ...c.growth.metrics];
  for (const m of all) {
    if (m.status === 'N/A') continue;
    const flag = m.status === 'BEAT' ? '✓' : m.status === 'OK' ? '~' : '✗';
    L.push(`    ${flag} ${m.label.padEnd(24)} ${metricValue(m).padStart(9)}   (ideal ${m.idealText})`);
  }
  if (scored.risk.flags.length) {
    L.push('  ' + '-'.repeat(58));
    L.push('  Risk flags:');
    for (const fl of scored.risk.flags) L.push(`    ! ${fl}`);
  }
  L.push('  ' + '-'.repeat(58));
  L.push(
    `  Analyst: ${f.recKey ? f.recKey.replace(/_/g, ' ') : '—'}` +
      (f.upside !== null ? `  ·  ${pct(f.upside)} to mean target` : '')
  );
  L.push('');
  return L.join('\n');
}
