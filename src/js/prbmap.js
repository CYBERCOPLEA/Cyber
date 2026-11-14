/* prbmap.js – Pratibimb › 🗺 Full Map: every suspect / target location of all Pratibimb sheets in a fresh full tab,
   with choose / filter (sheet, date, day / night, hours, weekday, operator, home circle, roaming, gang, matched case,
   area, complaints, search). Fully offline: no map tiles are fetched, the page is built on this computer and opened
   as a local tab (Vijay 14-11: "suspect all location should open in a new fresh full tab … map with filter"). */
'use strict';
const PRBMap = {
  async rows() {
    const D = await PRB.data(), V = await PRB.ix(), G = PRB.gangs(D), M = await PRB.meta(), gOf = new Map(); G.forEach((g, i) => g.R.forEach(r => gOf.set(r.id, i)));
    const K = {}; PRB.K.forEach(([k, ic, l, c]) => { K[k] = { ic, l, c }; });
    return D.filter(r => r.lat != null && Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180).map(r => { const h = PRB.hits(r, V), t = PRB.tsp(r), n = PRB.nr(r), gi = gOf.has(r.id) ? gOf.get(r.id) : -1;
      return { id: r.id, k: r.k, mobile: r.mobile || '', imei: r.imei || '', acc: r.acc || '', name: r.name || '', bank: r.bank || '', ifsc: r.ifsc || '', branch: r.branch || '', atm: r.atm || '', pos: r.pos || '', amt: r.amt || 0,
        lat: r.lat, lng: r.lng, t: r.time || 0, total: r.total || 0, acks: (r.acks || []).slice(0, 5), area: PRB.area(r), near: n ? n.n + ' (~' + n.km.toFixed(1) + ' km)' : '', district: r.district || '', state: r.state || '',
        addr: r.addr && !/^https?:/i.test(r.addr) ? r.addr.slice(0, 120) : '', op: t.op || '', circle: t.circle || '', roam: PRB.roam(r) ? 1 : 0, gang: gi + 1, gcat: gi >= 0 ? PRB.gl(G[gi], M).cat : '', cases: h.map(x => x.l) }; });
  },
  async open() {
    UI.toast('🗺 Building the full map on this computer…');
    let R = []; try { R = await this.rows(); } catch (e) { UI.toast('Could not read Pratibimb rows: ' + e.message, 5000); return; }
    if (!R.length) { UI.toast('No Pratibimb row with Lat / Long yet – import a Pratibimb sheet first', 5000); return; }
    const K = {}; PRB.K.forEach(([k, ic, l, c]) => { K[k] = { ic, l, c }; });
    const ref = typeof Geo !== 'undefined' ? Geo.P.map(p => [p.n, p.lat, p.lng]) : [];
    const html = this.html(R, K, ref), url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    let w = null; try { w = window.open(url, '_blank'); } catch (e) { }
    if (!w) this.overlay(html);
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  },
  /* when a new tab is not allowed (some desktop setups): the same map full-screen inside the tool */
  overlay(html) {
    let o = $('#pmOv'); if (o) o.remove(); o = document.createElement('div'); o.id = 'pmOv';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0b1220';
    o.innerHTML = '<button id="pmOvX" style="position:absolute;top:8px;right:12px;z-index:2;padding:6px 14px;border-radius:8px;border:0;background:#dc2626;color:#fff;font-weight:700;cursor:pointer">✖ Close Map</button><iframe style="border:0;width:100%;height:100%"></iframe>';
    document.body.appendChild(o); $('iframe', o).srcdoc = html; $('#pmOvX').onclick = () => o.remove();
  },
  html(R, K, ref) {
    const J = s => JSON.stringify(s).replace(/</g, '\\u003c');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>🗺 SudarshanAshtra – Suspect Locations Full Map</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;font:13px/1.35 system-ui,Segoe UI,Arial,sans-serif;background:#0b1220;color:#e2e8f0;height:100vh;display:flex;flex-direction:column;overflow:hidden}
header{display:flex;align-items:center;gap:12px;padding:8px 14px;background:#111a2e;border-bottom:1px solid #1e2a44}header h1{font-size:16px;margin:0}header .s{color:#94a3b8;font-size:12px}
.wrap{flex:1;display:flex;min-height:0}aside{width:300px;overflow:auto;padding:10px 12px;background:#0f172a;border-right:1px solid #1e2a44}aside h4{margin:12px 0 5px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8}
.ck{display:flex;flex-wrap:wrap;gap:4px}.ck label{display:flex;align-items:center;gap:4px;padding:3px 7px;border:1px solid #24324f;border-radius:14px;cursor:pointer;font-size:12px;background:#111c33}.ck label i{width:9px;height:9px;border-radius:50%;display:inline-block}
input[type=text],input[type=date],input[type=number],select{width:100%;padding:5px 7px;border-radius:7px;border:1px solid #24324f;background:#111c33;color:#e2e8f0;font:inherit}.two{display:flex;gap:6px}
.btn{padding:5px 10px;border-radius:7px;border:1px solid #2b3a5c;background:#1b2a4a;color:#e2e8f0;cursor:pointer;font:inherit}.btn.p{background:#2563eb;border-color:#2563eb}
main{flex:1;position:relative;min-width:0}canvas{width:100%;height:100%;display:block;cursor:grab}canvas.drag{cursor:grabbing}
#list{width:360px;overflow:auto;background:#0f172a;border-left:1px solid #1e2a44}#list .it{padding:7px 10px;border-bottom:1px solid #1a2540;cursor:pointer}#list .it:hover,#list .it.on{background:#16233f}
.mono{font-family:Consolas,monospace}.mut{color:#94a3b8;font-size:11.5px}.tag{display:inline-block;padding:0 6px;border-radius:9px;font-size:11px;margin-right:3px;border:1px solid}
#tip{position:fixed;pointer-events:none;background:#020617ee;border:1px solid #334155;border-radius:8px;padding:7px 9px;max-width:380px;display:none;z-index:5;font-size:12px}
#kp{display:flex;gap:6px;flex-wrap:wrap}#kp b{font-size:15px}#kp div{background:#111c33;border:1px solid #24324f;border-radius:8px;padding:3px 9px}
.leg{position:absolute;left:10px;bottom:10px;background:#020617cc;border:1px solid #1e2a44;border-radius:8px;padding:6px 9px;font-size:11.5px}.zm{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:4px}
</style></head><body>
<header><h1>🗺 Suspect Locations – Full Map</h1><span class="s">Pratibimb sheets · offline map (no map tiles, nothing leaves this computer) · scroll = zoom · drag = move · hover / click a point</span><span style="flex:1"></span><div id="kp"></div></header>
<div class="wrap"><aside>
<h4>Search</h4><input type="text" id="q" placeholder="Mobile, IMEI, account, name, area…">
<h4>Sheet</h4><div class="ck" id="fk"></div>
<h4>Date</h4><div class="two"><input type="date" id="d1"><input type="date" id="d2"></div>
<h4>Time Of Day</h4><select id="tod"><option value="">All</option><option value="day">Day (6 am – 6 pm)</option><option value="night">Night (6 pm – 6 am)</option><option value="late">Late Night (11 pm – 5 am)</option></select>
<h4>Weekday</h4><div class="ck" id="fw"></div>
<h4>Operator</h4><select id="op"></select>
<h4>Home Circle Of The SIM</h4><select id="ci"></select>
<h4>Area</h4><select id="ar"></select>
<h4>Matched Case / Target</h4><select id="cs"></select>
<h4>Gang / Group</h4><select id="gg"></select>
<h4>Only</h4><div class="ck"><label><input type="checkbox" id="oR"> 🛰 Roaming</label><label><input type="checkbox" id="oG"> 👥 In A Gang</label><label><input type="checkbox" id="oH"> 🎯 In Your Cases</label></div>
<h4>Min. Complaints</h4><input type="number" id="mc" min="0" value="0">
<h4>Show</h4><div class="ck"><label><input type="checkbox" id="sHeat"> 🔥 Hotspot Circles</label><label><input type="checkbox" id="sRef" checked> 🏙 Locality Names</label><label><input type="checkbox" id="sLine"> 🔗 Join Same Mobile / IMEI</label></div>
<div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn" id="rs">↺ Reset</button><button class="btn" id="fit">⤢ Fit All</button><button class="btn p" id="csv">⬇ CSV (Shown)</button></div>
</aside>
<main><canvas id="cv"></canvas><div class="zm"><button class="btn" id="zi">＋</button><button class="btn" id="zo">－</button></div><div class="leg" id="leg"></div></main>
<div id="list"></div></div><div id="tip"></div>
<script>
const R = ${J(R)}, K = ${J(K)}, REF = ${J(ref)};
const $ = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), tc = s => String(s || '').toLowerCase().replace(/\\b[a-z]/g, c => c.toUpperCase());
const DW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], uniq = a => [...new Set(a.filter(Boolean))].sort();
const ymd = t => { const d = new Date(t), q = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + q(d.getMonth() + 1) + '-' + q(d.getDate()); };
const opt = (el, L, all) => { $(el).innerHTML = '<option value="">' + all + '</option>' + L.map(x => '<option value="' + esc(x[0]) + '">' + esc(x[1]) + '</option>').join(''); };
const cnt = f => { const m = new Map(); R.forEach(r => [].concat(f(r)).filter(Boolean).forEach(v => m.set(v, (m.get(v) || 0) + 1))); return [...m].sort((a, b) => b[1] - a[1]); };
$('#fk').innerHTML = Object.entries(K).filter(([k]) => R.some(r => r.k === k)).map(([k, x]) => '<label><input type="checkbox" data-k="' + k + '" checked><i style="background:' + x.c + '"></i>' + x.ic + ' ' + esc(x.l) + ' (' + R.filter(r => r.k === k).length + ')</label>').join('');
$('#fw').innerHTML = DW.map((d, i) => '<label><input type="checkbox" data-w="' + i + '">' + d + '</label>').join('');
opt('#op', cnt(r => r.op || 'Not Known').map(([k, n]) => [k, k + ' (' + n + ')']), 'All Operators');
opt('#ci', cnt(r => r.circle || 'Not Known').map(([k, n]) => [k, tc(k) + ' (' + n + ')']), 'All Circles');
opt('#ar', cnt(r => r.area).map(([k, n]) => [k, k + ' (' + n + ')']), 'All Areas');
opt('#cs', cnt(r => r.cases).map(([k, n]) => [k, k + ' (' + n + ')']), 'All / None');
opt('#gg', cnt(r => r.gang ? 'G' + r.gang + ' · ' + r.gcat : '').map(([k, n]) => [k, k + ' (' + n + ')']), 'All');
$('#leg').innerHTML = Object.entries(K).filter(([k]) => R.some(r => r.k === k)).map(([k, x]) => '<span style="margin-right:9px"><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + x.c + '"></i> ' + esc(x.l) + '</span>').join('') + '<br><span style="color:#c084fc">◯ purple ring = roaming</span> · <span style="color:#2dd4bf">◯ teal ring = gang</span> · <span style="color:#f87171">◯ red ring = in your cases</span> · bigger = more complaints';
let F = [];
function pass(r) {
  const q = $('#q').value.trim().toLowerCase(); if (q && ![r.mobile, r.imei, r.acc, r.name, r.area, r.addr, r.district, r.bank, r.ifsc, r.atm, r.pos, r.op, r.circle, ...r.cases, ...r.acks].join(' ').toLowerCase().includes(q)) return false;
  if (!document.querySelector('#fk [data-k="' + r.k + '"]').checked) return false;
  const d1 = $('#d1').value, d2 = $('#d2').value, tod = $('#tod').value, W = [...document.querySelectorAll('#fw input:checked')].map(x => +x.dataset.w);
  if (d1 || d2 || tod || W.length) { if (!r.t) return false; const d = new Date(r.t), h = d.getHours() + d.getMinutes() / 60, y = ymd(r.t);
    if (d1 && y < d1) return false; if (d2 && y > d2) return false; if (W.length && !W.includes(d.getDay())) return false;
    if (tod === 'day' && !(h >= 6 && h < 18)) return false; if (tod === 'night' && h >= 6 && h < 18) return false; if (tod === 'late' && !(h >= 23 || h < 5)) return false; }
  const op = $('#op').value, ci = $('#ci').value, ar = $('#ar').value, cs = $('#cs').value, gg = $('#gg').value;
  if (op && (r.op || 'Not Known') !== op) return false; if (ci && (r.circle || 'Not Known') !== ci) return false; if (ar && r.area !== ar) return false; if (cs && !r.cases.includes(cs)) return false; if (gg && (r.gang ? 'G' + r.gang + ' · ' + r.gcat : '') !== gg) return false;
  if ($('#oR').checked && !r.roam) return false; if ($('#oG').checked && !r.gang) return false; if ($('#oH').checked && !r.cases.length) return false; if ((+$('#mc').value || 0) > r.total) return false;
  return true;
}
/* view: lat / long → screen */
const cv = $('#cv'), cx = cv.getContext('2d'); let W = 0, H = 0, V = { lat: 28.6, lng: 77.3, s: 2000 }, sel = null, hov = null;
const cosl = () => Math.cos(V.lat * Math.PI / 180), P = (lat, lng) => [W / 2 + (lng - V.lng) * V.s * cosl(), H / 2 - (lat - V.lat) * V.s];
function size() { const r = cv.getBoundingClientRect(), dp = devicePixelRatio || 1; W = r.width; H = r.height; cv.width = W * dp; cv.height = H * dp; cx.setTransform(dp, 0, 0, dp, 0, 0); draw(); }
function fit(L) { L = L && L.length ? L : R; const la = L.map(r => r.lat), lo = L.map(r => r.lng), y0 = Math.min(...la), y1 = Math.max(...la), x0 = Math.min(...lo), x1 = Math.max(...lo);
  V.lat = (y0 + y1) / 2; V.lng = (x0 + x1) / 2; V.s = Math.min((W - 140) / Math.max((x1 - x0) * cosl(), 0.004), (H - 160) / Math.max(y1 - y0, 0.004)); V.lat -= 20 / V.s; draw(); }
const rad = r => 4 + Math.min(9, Math.sqrt(r.total || 0) * 2);
function draw() {
  cx.clearRect(0, 0, W, H); cx.fillStyle = '#0b1220'; cx.fillRect(0, 0, W, H);
  /* grid every ~ nice km */ const kmPx = V.s / 111, step = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].find(k => k * kmPx > 90) || 1000, dl = step / 111;
  cx.strokeStyle = '#16213a'; cx.lineWidth = 1; const [ax, ay] = P(Math.floor((V.lat - H / 2 / V.s) / dl) * dl, Math.floor((V.lng - W / 2 / V.s / cosl()) / (dl / cosl())) * (dl / cosl()));
  for (let x = ax; x < W; x += dl / cosl() * V.s * cosl()) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); } for (let y = ay; y > 0; y -= dl * V.s) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
  cx.fillStyle = '#94a3b8'; cx.font = '11px system-ui'; cx.fillRect(W - 20 - step * kmPx, H - 18, step * kmPx, 3); cx.fillText(step + ' km', W - 20 - step * kmPx, H - 24);
  if ($('#sRef').checked) { cx.font = '11px system-ui'; const used = []; for (const [n, la, lo] of REF) { const [x, y] = P(la, lo); if (x < -50 || y < -20 || x > W + 50 || y > H + 20) continue; cx.fillStyle = '#475569'; cx.beginPath(); cx.arc(x, y, 2.5, 0, 7); cx.fill(); if (used.some(([a, b]) => Math.abs(a - x) < 90 && Math.abs(b - y) < 14)) continue; used.push([x, y]); cx.fillStyle = '#64748b'; cx.fillText(n, x + 5, y + 4); } }
  if ($('#sHeat').checked) { const m = new Map(); F.forEach(r => { const k = r.lat.toFixed(2) + ',' + r.lng.toFixed(2); const o = m.get(k) || { n: 0, la: 0, lo: 0 }; o.n++; o.la += r.lat; o.lo += r.lng; m.set(k, o); });
    for (const o of m.values()) { const [x, y] = P(o.la / o.n, o.lo / o.n), rr = Math.max(14, Math.sqrt(o.n) * 14); const g = cx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, 'rgba(239,68,68,.45)'); g.addColorStop(1, 'rgba(239,68,68,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, rr, 0, 7); cx.fill(); if (o.n > 1) { cx.fillStyle = '#fecaca'; cx.font = 'bold 11px system-ui'; cx.fillText(o.n, x + rr * .5, y - rr * .5); } } }
  if ($('#sLine').checked) { const g = new Map(); F.forEach(r => [r.mobile && 'm' + r.mobile, r.imei && 'i' + r.imei.slice(0, 14)].filter(Boolean).forEach(k => { const a = g.get(k) || []; a.push(r); g.set(k, a); }));
    cx.strokeStyle = 'rgba(250,204,21,.55)'; cx.lineWidth = 1.5; for (const a of g.values()) if (a.length > 1) { a.sort((x, y) => x.t - y.t); cx.beginPath(); a.forEach((r, i) => { const [x, y] = P(r.lat, r.lng); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.stroke(); } }
  for (const r of F) { const [x, y] = P(r.lat, r.lng); if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue; const rr = rad(r);
    cx.globalAlpha = .85; cx.fillStyle = (K[r.k] || {}).c || '#38bdf8'; cx.beginPath(); cx.arc(x, y, rr, 0, 7); cx.fill(); cx.globalAlpha = 1;
    let ring = rr + 2; const rg = c => { cx.strokeStyle = c; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, ring, 0, 7); cx.stroke(); ring += 3; };
    if (r.cases.length) rg('#f87171'); if (r.gang) rg('#2dd4bf'); if (r.roam) rg('#c084fc'); if (r === sel || r === hov) rg('#fff'); }
}
const at = (mx, my) => { let b = null, bd = 1e9; for (const r of F) { const [x, y] = P(r.lat, r.lng), d = Math.hypot(x - mx, y - my); if (d < rad(r) + 5 && d < bd) { bd = d; b = r; } } return b; };
const same = r => F.filter(x => Math.abs(x.lat - r.lat) < 1e-4 && Math.abs(x.lng - r.lng) < 1e-4);
const line = r => [r.mobile && '📱 ' + r.mobile, r.imei && '📟 ' + r.imei, r.acc && '🏦 ' + r.acc, r.atm && '🏧 ' + r.atm, r.branch && '🏛 ' + r.branch, r.pos && '📶 ' + r.pos].filter(Boolean).join(' · ');
const when = t => t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const card = r => '<div><b>' + (K[r.k] || {}).ic + ' ' + esc(line(r) || 'Point') + '</b></div><div>' + esc(r.near ? 'Near ' + r.near : r.area) + (r.district ? ' · ' + esc(tc(r.district)) : '') + '</div>' + (r.addr ? '<div class="mut">' + esc(r.addr) + '</div>' : '')
  + '<div class="mut">' + [when(r.t), r.total ? r.total + ' complaint(s)' : '', r.op, r.circle && 'SIM circle ' + tc(r.circle)].filter(Boolean).map(esc).join(' · ') + '</div>'
  + '<div>' + (r.roam ? '<span class="tag" style="color:#c084fc">🛰 Roaming</span>' : '') + (r.gang ? '<span class="tag" style="color:#2dd4bf">👥 G' + r.gang + ' ' + esc(r.gcat) + '</span>' : '') + r.cases.map(c => '<span class="tag" style="color:#f87171">' + esc(c) + '</span>').join('') + '</div>'
  + '<div class="mono mut">' + r.lat.toFixed(5) + ', ' + r.lng.toFixed(5) + '</div>';
function list() { const L = F.slice().sort((a, b) => (b.total - a.total) || (b.t - a.t)).slice(0, 600);
  $('#list').innerHTML = '<div style="padding:8px 10px" class="mut">' + F.length + ' location(s) shown' + (F.length > 600 ? ' – first 600 listed' : '') + ' · click to go to it</div>' + L.map(r => '<div class="it' + (r === sel ? ' on' : '') + '" data-id="' + esc(r.id) + '">' + card(r) + (r === sel ? '<div style="margin-top:4px"><a href="https://www.google.com/maps?q=' + r.lat + ',' + r.lng + '" target="_blank" rel="noopener" style="color:#60a5fa">Open this point in Google Maps ↗</a></div>' : '') + '</div>').join('');
  document.querySelectorAll('#list .it').forEach(e => e.onclick = ev => { if (ev.target.tagName === 'A') return; const r = R.find(x => x.id === e.dataset.id); sel = r; V.lat = r.lat; V.lng = r.lng; V.s = Math.max(V.s, 40000); draw(); list(); }); }
function kp() { const n = k => F.filter(k).length; $('#kp').innerHTML = [['📍', F.length, 'Shown'], ['📱', new Set(F.map(r => r.mobile).filter(Boolean)).size, 'Mobiles'], ['🛰', n(r => r.roam), 'Roaming'], ['👥', n(r => r.gang), 'In Gangs'], ['🎯', n(r => r.cases.length), 'In Cases']].map(([i, v, t]) => '<div>' + i + ' <b>' + v + '</b> <span class="mut">' + t + '</span></div>').join(''); }
function apply(keep) { F = R.filter(pass); if (sel && !F.includes(sel)) sel = null; kp(); list(); if (!keep) fit(F); else draw(); }
document.querySelectorAll('aside input, aside select').forEach(e => e.addEventListener(e.type === 'text' ? 'input' : 'change', () => apply(['sHeat', 'sRef', 'sLine'].includes(e.id))));
$('#rs').onclick = () => { document.querySelectorAll('aside input[type=text],aside input[type=date]').forEach(e => e.value = ''); document.querySelectorAll('aside select').forEach(e => e.value = ''); document.querySelectorAll('#fk input').forEach(e => e.checked = true); document.querySelectorAll('#fw input,#oR,#oG,#oH').forEach(e => e.checked = false); $('#mc').value = 0; apply(); };
$('#fit').onclick = () => fit(F); $('#zi').onclick = () => { V.s *= 1.6; draw(); }; $('#zo').onclick = () => { V.s /= 1.6; draw(); };
$('#csv').onclick = () => { const c = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', H2 = ['Sheet', 'Mobile', 'IMEI', 'Account', 'Lat', 'Long', 'Near', 'District', 'Time', 'Complaints', 'Operator', 'Home Circle', 'Roaming', 'Gang', 'In Cases'];
  const t = [H2.join(',')].concat(F.map(r => [(K[r.k] || {}).l, r.mobile, r.imei, r.acc, r.lat, r.lng, r.near || r.area, r.district, when(r.t), r.total, r.op, r.circle, r.roam ? 'Yes' : '', r.gang ? 'G' + r.gang + ' ' + r.gcat : '', r.cases.join('; ')].map(c).join(','))).join('\\r\\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\\ufeff' + t], { type: 'text/csv' })); a.download = 'suspect_locations_map.csv'; a.click(); };
let dr = null; cv.onmousedown = e => { dr = { x: e.clientX, y: e.clientY, lat: V.lat, lng: V.lng, m: 0 }; cv.classList.add('drag'); };
addEventListener('mouseup', e => { if (dr && dr.m < 4) { const b = cv.getBoundingClientRect(), r = at(e.clientX - b.left, e.clientY - b.top); if (r) { sel = r; list(); draw(); const el = document.querySelector('#list .it.on'); el && el.scrollIntoView({ block: 'center' }); } } dr = null; cv.classList.remove('drag'); });
addEventListener('mousemove', e => { const tip = $('#tip'); if (dr) { dr.m = Math.max(dr.m, Math.hypot(e.clientX - dr.x, e.clientY - dr.y)); V.lat = dr.lat + (e.clientY - dr.y) / V.s; V.lng = dr.lng - (e.clientX - dr.x) / V.s / cosl(); draw(); tip.style.display = 'none'; return; }
  const b = cv.getBoundingClientRect(); if (e.target !== cv) { tip.style.display = 'none'; return; } const r = at(e.clientX - b.left, e.clientY - b.top); if (r !== hov) { hov = r; draw(); }
  if (!r) { tip.style.display = 'none'; return; } const S2 = same(r); tip.innerHTML = card(r) + (S2.length > 1 ? '<div class="mut">+ ' + (S2.length - 1) + ' more at this spot: ' + esc(S2.filter(x => x !== r).slice(0, 4).map(line).join(' | ')) + '</div>' : '') + '<div class="mut">Click for details · Google Maps link</div>';
  tip.style.display = 'block'; tip.style.left = Math.min(innerWidth - 390, e.clientX + 14) + 'px'; tip.style.top = Math.min(innerHeight - tip.offsetHeight - 8, e.clientY + 14) + 'px'; });
cv.addEventListener('wheel', e => { e.preventDefault(); const b = cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top, la = V.lat - (my - H / 2) / V.s, lo = V.lng + (mx - W / 2) / V.s / cosl(), f = e.deltaY < 0 ? 1.25 : 0.8; V.s *= f; V.lat = la + (my - H / 2) / V.s; V.lng = lo - (mx - W / 2) / V.s / cosl(); draw(); }, { passive: false });
addEventListener('resize', size); F = R.slice(); size(); apply();
</script></body></html>`;
  }
};
