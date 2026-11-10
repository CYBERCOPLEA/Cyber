/* telscope.js – CDR / IPDR / TDR: choose the Source (case) and what to analyse – all files together (common targets,
   culprits) or one particular number (deep profile) – and a clearer Overview: suspects to act on, targets at a glance,
   and findings grouped as Network / Location / Device / Activity / Links. */
'use strict';
/* ---- scope: when one number is chosen, every tab works on that number's records only ---- */
Tel._sn = '';
{ const _c = Analysis.cached.bind(Analysis);
  Analysis.cached = (k, f) => _c(Tel._sn && S.page === 'tele' && /^tel:/.test(k) ? k + '|#' + S.telKind + ':' + Tel._sn : k, f); }
{ const _of = Tel.of;
  Tel.of = function (k) { const d = _of.call(this, k); const n = Tel._sn; if (!n || S.page !== 'tele' || String(k).toLowerCase() !== S.telKind) return d; return Analysis.cached('tel:' + k.toUpperCase() + ':scoped', () => d.filter(r => r.target === n || r.mac === n)); }; }

const TSC = {
  L: { cdr: ['All CDR files', 'Particular number', 'common targets, links between numbers, culprits'], ipdr: ['All IPDR files', 'Particular number / user', 'common users, shared servers, app calls'], tdr: ['All tower dumps', 'Particular number', 'numbers at many crime spots, meetings'], sms: ['All SMS files', 'Particular number', 'senders and contacts'] },
  user: r => r.target || r.mac || '',
  nums(k) { const sn = Tel._sn; Tel._sn = ''; const d = Tel.of(k); Tel._sn = sn; return [...groupBy(d.filter(this.user), this.user)].map(([n, v]) => [n, v.length]).sort((a, b) => b[1] - a[1]); },
  st() { return (S.telScope = S.telScope || {}); },
  bar(main, k) {
    const st = this.st(), N = this.nums(k), one = !!st[k], L = this.L[k] || this.L.cdr;
    const kinds = $('.tel-kinds', main); if (!kinds) return;
    kinds.insertAdjacentHTML('afterend', `<div class="tsc">
      <label class="tsc-f"><span>📂 Source</span><select id="tscCase" title="Case whose files are analysed">${S.cases.map(c => `<option value="${c.id}"${c.id === S.caseId ? ' selected' : ''}>${esc(c.name)}${c.fir ? ' · ' + esc(c.fir) : ''}</option>`).join('')}</select></label>
      <div class="tsc-f"><span>🔍 Analyse</span><div class="tsc-seg"><button data-sc="all" class="${one ? '' : 'on'}" title="${esc(L[2])}">📚 ${L[0]} <b>${fmtNum(N.length)}</b></button><button data-sc="one" class="${one ? 'on' : ''}">🎯 ${L[1]}</button></div></div>
      ${one ? `<label class="tsc-f tsc-n"><span>📱 Number</span><select id="tscNum">${N.slice(0, 3000).map(([n, c]) => `<option value="${esc(n)}"${n === st[k] ? ' selected' : ''}>${esc(n)}${TSC.op(n) ? ' · ' + TSC.op(n) : ''} · ${fmtNum(c)} records</option>`).join('')}</select></label>` : `<span class="tsc-h">${esc(L[2])}</span>`}
    </div>`);
    $('#tscCase', main).onchange = async e => { await switchCase(e.target.value); S.telScope = {}; render(); };
    $$('[data-sc]', main).forEach(b => b.onclick = () => { st[k] = b.dataset.sc === 'one' ? (N[0] || [''])[0] : ''; if (b.dataset.sc === 'one' && !N.length) UI.toast('Import files first'); S.sub.tele = 'sum'; render(); });
    const ns = $('#tscNum', main); if (ns) ns.onchange = () => { st[k] = ns.value; render(); };
  },
  go(n) { this.st()[S.telKind] = n; S.sub.tele = 'sum'; render(); window.scrollTo && window.scrollTo(0, 0); },
  /* findings grouped in coloured cards; each line can open a tab */
  groups(G) {
    G = G.filter(g => g.items.length); if (!G.length) return '';
    return `<div class="tf-grid">${G.map(g => `<div class="tf-card" style="--tc:${g.c}"><div class="tf-h">${g.i} ${esc(g.t)}</div><ul>${g.items.slice(0, 6).map(x => `<li>${x[0]}${x[1] ? ` <a href="#" class="tf-go" data-tgo="${x[1]}">open →</a>` : ''}</li>`).join('')}</ul></div>`).join('')}</div>`;
  },
  wire(el) { if (el._tw) return; el._tw = 1; el.addEventListener('click', e => { const a = e.target.closest('[data-tsc],[data-tgo]'); if (!a || !el.contains(a)) return; e.preventDefault(); e.stopPropagation(); if (a.dataset.tsc) this.go(a.dataset.tsc); else { S.sub.tele = a.dataset.tgo; render(); } }); },
  chips: R => R.map(r => `<span class="tf-chip ${r[1] || ''}">${esc(r[0])}</span>`).join(' '),
  watch() { return new Set((S.data.cdrWatch || []).map(s => String(s).trim()).filter(Boolean)); },
  boxes(v) {
    const h = CDRX.home(v), box = (lbl, x, col) => x ? `<div class="cx-hw" style="--hc:${col}"><div class="cx-hl">${lbl}</div><b>${esc(x.addr || x.t)}</b><div class="small">${fmtNum(x.n)} records · ${x.days} days${CDRX.map(x.lat, x.lon)}</div><div class="small muted">last ${esc(Tel.dd(x.last).slice(0, 10))}</div></div>` : '';
    return `<div class="cx-hws">${box('🏠 Home (night)', h.home, '#6366f1')}${box('🏢 Work (day)', h.work, '#f59e0b')}${box('📍 Max stay', h.max, '#10b981')}</div>`;
  },
  /* suspects table */
  board(el, rows, title, sub) {
    rows = rows.filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 200);
    const max = Math.max(1, ...rows.map(x => x.score));
    el.insertAdjacentHTML('beforeend', `<div class="card tf-sus"><h3>🎯 ${title}</h3><div class="sub">${sub}</div><div id="tfS"></div></div>`);
    if (!rows.length) { $('#tfS', el).innerHTML = '<div class="muted">Nothing stands out yet. Import more files or add a watchlist.</div>'; return; }
    Table($('#tfS', el), { rows, sortKey: 'score', sortDir: -1, pageSize: 15, exportName: 'suspects', onRow: x => x.target ? this.go(x.n) : x.recs && TelUI.recDrawer(x.n, x.recs), columns: [
      { key: 'score', label: 'Priority', num: true, render: x => `<div class="tf-bar"><i style="width:${Math.round(x.score / max * 100)}%"></i></div><b>${x.score}</b>` },
      { key: 'n', label: 'Number / ID', render: x => `<b class="mono">${esc(x.n)}</b> ${TSC.opb(x.n)} ${x.target ? '<span class="badge">target</span>' : '<span class="badge warn">contact</span>'}` },
      { key: 'why', label: 'Why', csv: x => x.why.map(r => r[0]).join('; '), render: x => this.chips(x.why) },
      { key: 'act', label: '', csv: () => '', render: x => x.target ? `<a href="#" class="btn sm" data-tsc="${esc(x.n)}">Analyse →</a>` : '' }] });
    this.wire(el);
  }
};

/* ---- page: add the bar under the CDR / IPDR / TDR / SMS buttons ---- */
{ const _page = TelUI.page;
  TelUI.page = function (main) {
    const k = TK[S.telKind] ? S.telKind : 'cdr', st = TSC.st();
    if (st._case !== S.caseId) { S.telScope = { _case: S.caseId }; if (S.telTime) S.telTime.from = S.telTime.to = ''; }
    Tel._sn = TSC.st()[k] || '';
    if (Tel._sn && !TSC.nums(k).some(x => x[0] === Tel._sn)) Tel._sn = TSC.st()[k] = '';
    TSC._r = []; _page.call(this, main);
    try { TSC.bar(main, k); } catch (e) { console.error(e); }
  }; }

/* ================= CDR overview ================= */
TelUI.cdr_sum = function (el, d) { return Tel._sn ? this.prof(el, d, 'cdr') : this.cdrAll(el, d); };
TelUI.cdrAll = function (el, d) {
  const { P, byOther } = this.cdrStats(d), T = uniq(d.map(r => r.target).filter(Boolean)), calls = d.filter(r => r.dir === 'IN' || r.dir === 'OUT'), W = TSC.watch();
  const first = d.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last = d.reduce((a, r) => r.ts > a ? r.ts : a, '');
  const G = CDRX.gaps(d, 24), Tset = new Set(T);
  /* targets at a glance */
  const TT = [...CDRX.byT(d)].filter(([t]) => t).map(([t, v]) => { const h = CDRX.home(v), im = uniq(v.map(r => r.imei).filter(Boolean)), st = uniq(v.map(CDRX.circle).filter(Boolean)), g = G.filter(x => x.target === t), lk = uniq(v.map(r => r.other).filter(o => Tel.isMob(o) && Tel.also('mobile', o)));
    const why = []; if (Tel.also('mobile', t)) why.push(['in ' + Tel.also('mobile', t), 'bad']); if (W.has(t)) why.push(['watchlist', 'bad']); if (lk.length) why.push([lk.length + ' contacts in case data', 'warn']); if (im.length > 1) why.push([im.length + ' handsets', 'warn']); if (g.length) why.push([g.length + ' long off periods', '']); if (st.length > 1) why.push([st.length + ' states', '']);
    const cn = P.filter(p => p.target === t), sh = cn.filter(p => p.tN > 1).length; if (sh) why.push([sh + ' shared contacts', 'warn']);
    return { n: t, target: 1, recs: v, why, score: (Tel.also('mobile', t) ? 5 : 0) + (W.has(t) ? 6 : 0) + Math.min(4, lk.length) + Math.min(3, im.length - 1) + Math.min(2, g.length) + Math.min(4, sh) + (st.length > 2 ? 1 : 0), c: cn.length, rN: v.length, home: h.home ? (h.home.addr || h.home.t) : '', im: im.length, st: st.length }; });
  /* contacts worth chasing */
  const CC = [...byOther].filter(([o]) => Tel.isMob(o) && !Tset.has(o)).map(([o, v]) => { const n = sum(v, p => p.n), nt = sum(v, p => p.night), a = Tel.also('mobile', o), why = [];
    if (v.length > 1) why.push(['talks to ' + v.length + ' targets', 'bad']); if (a) why.push(['in ' + a, 'bad']); if (W.has(o)) why.push(['watchlist', 'bad']); if (nt >= 5) why.push([nt + ' night calls', 'warn']); if (n >= 50) why.push([fmtNum(n) + ' records', '']);
    return { n: o, recs: v.flatMap(p => p.recs), why, score: (v.length > 1 ? 3 * (v.length - 1) + 2 : 0) + (a ? 5 : 0) + (W.has(o) ? 6 : 0) + (nt >= 5 ? 1 : 0) + (nt >= 20 ? 1 : 0) + (n >= 100 ? 1 : 0) }; });
  const x2x = d.filter(r => r.other && Tset.has(r.other) && r.other !== r.target), common = [...byOther].filter(([o, v]) => v.length >= 2 && Tel.isMob(o));
  const linked = [...byOther.keys()].filter(o => Tel.isMob(o) && Tel.also('mobile', o)), sharedIm = [...groupBy(d.filter(r => r.imei), r => r.imei)].filter(([, v]) => uniq(v.map(r => r.target)).length > 1);
  el.innerHTML = UI.kpis([['Target numbers', fmtNum(T.length), uniq(d.map(r => r._src)).length + ' file(s)', 'c5'], ['Records', fmtNum(d.length), Tel.dd(first).slice(0, 10) + ' → ' + Tel.dd(last).slice(0, 10), 'c2'], ['Contacts', fmtNum(byOther.size), fmtNum(common.length) + ' shared by 2+ targets', 'c1'],
    ['Linked to case', fmtNum(linked.length), 'contacts in bank / KYC / NCRP / social', 'c3'], ['Calls out / in', `${fmtNum(calls.filter(r => r.dir === 'OUT').length)} / ${fmtNum(calls.filter(r => r.dir === 'IN').length)}`, 'talk ' + Tel.hms(sum(calls, r => r.dur)), 'c6'], ['Handsets', fmtNum(uniq(d.map(r => r.imei).filter(Boolean)).length), fmtNum(sharedIm.length) + ' shared by 2+ numbers', 'c4']]);
  const OB = n => TSC.opb(n), R1 = v => v.flatMap(p => p.recs), CM = CDRX.common(d), Tn = v => uniq(v.map(p => p.target));
  const comS = common.slice().sort((a, b) => b[1].length - a[1].length || sum(b[1], p => p.n) - sum(a[1], p => p.n));
  const net = [], lnk = [], dev = [], act = [], loc = [];
  if (common.length) net.push({ v: fmtNum(common.length), h: 'numbers talk to <b>2 or more targets</b> – likely handlers / same gang', go: 'com', recs: R1(common.flatMap(x => x[1])), t: 'Common numbers – in touch with 2+ targets' });
  comS.slice(0, 3).forEach(([o, v]) => net.push({ h: `<b class="mono">${esc(o)}</b> ${OB(o)}<div class="small">talks to <b>${v.length}</b> targets · ${fmtNum(sum(v, p => p.n))} records</div><div class="small muted mono">${Tn(v).slice(0, 4).map(esc).join(', ')}</div>`, go: 'com', recs: R1(v), t: o + ' · common contact' }));
  if (x2x.length) net.push({ v: fmtNum(uniq(x2x.map(r => [r.target, r.other].sort().join())).length), h: 'pairs of targets called each other directly', go: 'com', recs: x2x, t: 'Target ↔ target calls' });
  [['imei', 'IMEI (handsets)'], ['imsi', 'IMSI (SIM cards)'], ['cell', 'Cell IDs'], ['ll', 'Lat-Long places'], ['sms', 'SMS senders']].forEach(([t, l]) => { const X = CM.filter(x => x.type === t); if (X.length) net.push({ v: fmtNum(X.length), h: `common <b>${l}</b> between CDRs<div class="small muted mono">${X.slice().sort((a, b) => b.cN - a.cN).slice(0, 2).map(x => esc(x.v)).join(', ')}</div>`, go: 'com', recs: X.flatMap(x => x.recs), t: 'Common ' + l }); });
  if (linked.length) lnk.push({ v: fmtNum(linked.length), h: 'contacts also appear in bank / KYC / NCRP / social data', go: 'com', recs: R1(linked.flatMap(o => byOther.get(o))), t: 'Contacts linked to this case' });
  linked.slice().sort((a, b) => sum(byOther.get(b), p => p.n) - sum(byOther.get(a), p => p.n)).slice(0, 3).forEach(o => { const v = byOther.get(o); lnk.push({ h: `<b class="mono">${esc(o)}</b> ${OB(o)} <span class="tf-chip bad">in ${esc(Tel.also('mobile', o))}</span><div class="small">${fmtNum(sum(v, p => p.n))} records with ${Tn(v).slice(0, 3).map(esc).join(', ')}</div>`, go: 'com', recs: R1(v), t: o + ' · linked to case' }); });
  if (W.size) { const wr = d.filter(r => W.has(r.other) || W.has(r.target) || W.has(r.imei)); lnk.push({ v: fmtNum(wr.length), h: 'records match the <b>watchlist</b>', go: 'watch', recs: wr, t: 'Watchlist matches' }); } else lnk.push({ h: 'Add suspect numbers / IMEIs to the <b>watchlist</b> to check them in every CDR', go: 'watch' });
  if (sharedIm.length) dev.push({ v: fmtNum(sharedIm.length), h: 'handsets used with <b>2+ target numbers</b> – same person, many SIMs', go: 'dev', recs: sharedIm.flatMap(x => x[1]), t: 'Handsets shared by targets' });
  sharedIm.slice().sort((a, b) => b[1].length - a[1].length).slice(0, 2).forEach(([m, v]) => { const t = uniq(v.map(r => r.target)); dev.push({ h: `IMEI <b class="mono">${esc(m)}</b><div class="small">used with <b>${t.length}</b> numbers: <span class="mono">${t.slice(0, 3).map(esc).join(', ')}</span></div>`, go: 'dev', recs: v, t: 'IMEI ' + m }); });
  TT.filter(x => x.im > 1).sort((a, b) => b.im - a.im).slice(0, 3).forEach(x => dev.push({ h: `<b class="mono">${esc(x.n)}</b> ${OB(x.n)}<div class="small">changed handset – <b>${x.im}</b> IMEIs</div>`, go: 'dev', recs: x.recs, t: x.n + ' · handsets' }));
  if (G.length) act.push({ v: fmtNum(G.length), h: `periods of 24 h+ with the phone <b>off / unused</b> (${uniq(G.map(x => x.target)).length} targets)`, go: 'off', recs: G.flatMap(x => x.recs), t: 'Phone off 24 h+' });
  G.slice().sort((a, b) => b.h - a.h).slice(0, 2).forEach(x => act.push({ h: `<b class="mono">${esc(x.target)}</b> ${OB(x.target)} off <b>${CDRX.span(x.h)}</b><div class="small">from ${esc(Tel.dd(x.from))}${x.devCh ? ' · <b>handset changed</b>' : ''}${x.moved ? ' · came back elsewhere' : ''}</div>`, go: 'off', recs: x.recs, t: x.target + ' · off ' + CDRX.span(x.h) }));
  { const nc = d.filter(r => (r.dir === 'IN' || r.dir === 'OUT') && Tel.night(r)); act.push({ v: fmtNum(nc.length), h: 'night calls (' + TSC.win('l') + ')', go: 'time', recs: nc, t: 'Night calls' }); }
  TT.filter(x => x.home).slice().sort((a, b) => b.rN - a.rN).slice(0, 4).forEach(x => { const h = CDRX.home(x.recs).home; loc.push({ h: `<b class="mono">${esc(x.n)}</b> ${OB(x.n)}<div class="small">🏠 ${esc(x.home)}</div>`, go: 'loc', recs: h ? h.recs : x.recs, t: x.n + ' · home (night) tower' }); });
  { const CI = [...groupBy(d.filter(CDRX.circle), CDRX.circle)].sort((a, b) => b[1].length - a[1].length); if (CI.length) loc.push({ v: fmtNum(CI.length), h: `states / circles seen<div class="small muted">${CI.slice(0, 3).map(([c, w]) => esc(c) + ' ' + fmtNum(w.length)).join(' · ')}</div>`, go: 'roam', recs: d.filter(CDRX.circle), t: 'States / circles' }); }
  el.insertAdjacentHTML('beforeend', TSC.groups([
    { i: '👥', t: 'Network – who is connected', c: '#3b82f6', max: 9, items: net },
    { i: '🔗', t: 'Links to this case', c: '#ef4444', items: lnk },
    { i: '📱', t: 'Devices', c: '#a855f7', items: dev },
    { i: '⏱', t: 'Activity', c: '#f59e0b', items: act },
    { i: '📍', t: 'Location', c: '#10b981', items: loc }
  ]));
  TSC.board(el, [...TT, ...CC], 'Suspects to act on', 'Ranked by links: in other case data, watchlist, talking to many targets, many handsets, phone-off periods, night calls. Click a target to analyse it alone; click a contact for its calls.');
  el.insertAdjacentHTML('beforeend', `<div class="card"><h3>📋 Targets at a glance</h3><div class="sub">One row per CDR. Press <b>Analyse →</b> to open the full profile of that number.</div><div id="tfT"></div></div>
    <div class="grid g2"><div class="card"><h3>Top contacts</h3><div id="cs1"></div></div><div class="card"><h3>Hour of day</h3><div id="cs4"></div></div></div>`);
  Table($('#tfT', el), { rows: TT, sortKey: 'why', sortDir: -1, pageSize: 15, exportName: 'targets', onRow: x => TSC.go(x.n), columns: [{ key: 'n', label: 'Target', render: x => `<b class="mono">${esc(x.n)}</b>` }, { key: 'op', label: 'Operator', sortVal: x => TSC.op(x.n), csv: x => TSC.op(x.n), render: x => TSC.opb(x.n) }, { key: 'rN', label: 'Records', num: true }, { key: 'c', label: 'Contacts', num: true }, { key: 'im', label: 'Handsets', num: true }, { key: 'st', label: 'States', num: true }, { key: 'home', label: 'Home (night)', render: x => `<span class="small">${esc(x.home)}</span>` }, { key: 'why', label: 'Flags', csv: x => x.why.map(r => r[0]).join('; '), sortVal: x => x.score, render: x => TSC.chips(x.why) }, { key: 'act', label: '', csv: () => '', render: x => `<a href="#" class="btn sm" data-tsc="${esc(x.n)}">Analyse →</a>` }] });
  const top = P.slice().sort((a, b) => b.n - a.n);
  Charts.hbar($('#cs1', el), top.slice(0, 15).map(p => ({ label: p.other, value: p.n, sub: `${TSC.op(p.other) ? TSC.op(p.other) + ' · ' : ''}${p.target} · ${p.out} out · ${p.inn} in · ${Tel.hms(p.dur)}${Tel.also('mobile', p.other) ? ' · ⚑ ' + Tel.also('mobile', p.other) : ''}`, p })), { onClick: x => this.recDrawer(x.p.target + ' ↔ ' + x.p.other, x.p.recs) });
  Charts.vbar($('#cs4', el), Array.from({ length: 24 }, (_, h) => ({ label: h + ':00', value: d.filter(r => Tel.hour(r) === h).length })));
  TSC.wire(el);
};

/* ================= one number: full profile (CDR / IPDR / TDR / SMS) ================= */
TelUI.prof = function (el, d, k) {
  const n = Tel._sn, v = CDRX.sorted(d), W = TSC.watch(), first = v[0] ? v[0].ts : '', lastR = v[v.length - 1] || {};
  const im = uniq(v.map(r => r.imei).filter(Boolean)), ims = uniq(v.map(r => r.imsi).filter(Boolean)), st = uniq(v.map(CDRX.circle).filter(Boolean)), G = CDRX.gaps(v, 12).sort((a, b) => b.h - a.h);
  const also = Tel.also('mobile', n), flags = []; if (also) flags.push(['in ' + also, 'bad']); if (W.has(n)) flags.push(['watchlist', 'bad']); if (im.length > 1) flags.push([im.length + ' handsets', 'warn']); if (ims.length > 1) flags.push([ims.length + ' SIM cards', 'warn']); if (G.length && G[0].h >= 24) flags.push(['off up to ' + CDRX.span(G[0].h), '']);
  const C = [...groupBy(v.filter(r => r.other && !/[A-Z]/.test(r.other)), r => r.other)].map(([o, w]) => ({ o, n: w.length, dur: sum(w, r => r.dur || 0), night: w.filter(Tel.night).length, last: w[w.length - 1].ts, a: Tel.also('mobile', o), w: W.has(o), recs: w })).sort((a, b) => b.n - a.n);
  const kind = { cdr: 'CDR', ipdr: 'IPDR', tdr: 'Tower dump', sms: 'SMS' }[k];
  const kp = k === 'ipdr' ? [['Sessions', fmtNum(v.length), '', 'c2'], ['Public IPs', fmtNum(uniq(v.map(r => r.xip).filter(Boolean)).length), '', 'c5'], ['Apps', fmtNum(uniq(v.map(IPX.app).filter(Boolean)).length), '', 'c1'], ['VPN / remote', fmtNum(v.filter(IPX.vpn).length), 'sessions', 'c3'], ['Data used', Tel.bytes(Tel.vol(v)), '', 'c6'], ['Handsets', fmtNum(im.length), '', 'c4']]
    : [['Records', fmtNum(v.length), '', 'c2'], ['Contacts', fmtNum(C.length), fmtNum(C.filter(c => c.a).length) + ' in case data', 'c1'], ['Calls out / in', `${fmtNum(v.filter(r => r.dir === 'OUT').length)} / ${fmtNum(v.filter(r => r.dir === 'IN').length)}`, 'talk ' + Tel.hms(sum(v.filter(r => r.dir === 'IN' || r.dir === 'OUT'), r => r.dur)), 'c6'], ['SMS', fmtNum(v.filter(r => /^SMS/.test(r.dir)).length), '', 'c3'], ['Handsets / SIMs', `${im.length} / ${ims.length}`, '', 'c4'], ['States', fmtNum(st.length), st.slice(0, 3).join(', '), 'c5']];
  el.innerHTML = `<div class="card tf-prof"><div class="tf-ph"><div><div class="muted small">${kind} profile</div><div class="tf-num mono">${esc(n)} ${TSC.opb(n, 1)}</div><div class="small muted">${esc(Tel.dd(first))} → ${esc(Tel.dd(lastR.ts || ''))}</div></div><div class="tf-pf">${TSC.chips(flags) || '<span class="tf-chip">no red flags yet</span>'}</div>
    <div class="tf-last"><div class="muted small">Last seen</div><b>${esc(CDRX.loc(lastR) || '—')}</b><div class="small">${esc(Tel.dd(lastR.ts || ''))}${lastR.imei ? ' · IMEI ' + esc(lastR.imei) : ''}</div></div></div>${TSC.boxes(v)}</div>` + UI.kpis(kp);
  const g = [], OB = n => TSC.opb(n);
  if (k === 'ipdr') {
    const A = [...groupBy(v.filter(IPX.app), IPX.app)].sort((a, b) => b[1].length - a[1].length);
    g.push({ i: '📲', t: 'Apps used', c: '#3b82f6', items: A.slice(0, 6).map(([a, w]) => ({ h: `<b>${esc(a)}</b><div class="small">${fmtNum(w.length)} sessions · ${Tel.bytes(Tel.vol(w))}</div>`, go: 'dst', recs: w, t: n + ' · ' + a })) });
    const vp = v.filter(IPX.vpn); if (vp.length) g.push({ i: '🛡', t: 'Hiding / remote access', c: '#ef4444', items: [{ v: fmtNum(vp.length), h: `VPN / proxy / remote sessions<div class="small">${uniq(vp.map(IPX.app)).slice(0, 4).map(esc).join(', ')}</div>`, go: 'vpn', recs: vp, t: n + ' · VPN / remote' }] });
    g.push({ i: '📝', t: 'For platform notice', c: '#10b981', items: [{ h: 'Own public IP + port + time list for WhatsApp / Meta / Google', go: 'req' }] });
  } else if (k === 'tdr') {
    const sp = Tel.tdrSpots(), S2 = [...groupBy(v, r => (sp.of.get(r._src) || {}).label || r._src)];
    g.push({ i: '📍', t: 'Present at crime spots', c: '#ef4444', items: S2.map(([s, w]) => ({ h: `<b>${esc(s)}</b><div class="small">${w.length} records · ${esc(Tel.dd(w[0].ts).slice(11, 16))} to ${esc(Tel.dd(w[w.length - 1].ts).slice(11, 16))}</div>`, go: 'spot', recs: w, t: n + ' at ' + s })) });
  }
  if (C.length) g.push({ i: '👥', t: 'Top contacts', c: '#3b82f6', items: C.slice(0, 6).map(c => ({ h: `<b class="mono">${esc(c.o)}</b> ${OB(c.o)}<div class="small">${c.n} records${c.dur ? ' · ' + Tel.hms(c.dur) : ''}${c.night ? ' · ' + c.night + ' at night' : ''}</div>${c.a ? `<span class="tf-chip bad">in ${esc(c.a)}</span> ` : ''}${c.w ? '<span class="tf-chip bad">watchlist</span>' : ''}`, go: 'con', recs: c.recs, t: n + ' ↔ ' + c.o })) });
  const lk = C.filter(c => c.a || c.w); if (lk.length) g.push({ i: '🔗', t: 'Contacts linked to this case', c: '#ef4444', items: lk.slice(0, 6).map(c => ({ h: `<b class="mono">${esc(c.o)}</b> ${OB(c.o)}<div class="small">${c.a ? 'in ' + esc(c.a) : 'on watchlist'} · ${c.n} records · last ${esc(Tel.dd(c.last).slice(0, 10))}</div>`, go: k === 'cdr' ? 'com' : '', recs: c.recs, t: n + ' ↔ ' + c.o })) });
  const IP = CDRX.runs(v, r => r.imei), SP = CDRX.runs(v, r => r.imsi);
  if (im.length || ims.length) g.push({ i: '📱', t: 'Handsets & SIM cards', c: '#a855f7', items: [...IP.slice(-4).map(x => ({ h: `📱 IMEI <b class="mono">${esc(x.key)}</b><div class="small">${esc(Tel.dd(x.from).slice(0, 10))} → ${esc(Tel.dd(x.to).slice(0, 10))} · ${x.dayN} days</div>`, go: 'dev', recs: x.recs, t: n + ' · IMEI ' + x.key })),
    ...(ims.length > 1 || !im.length ? SP.slice(-3).map(x => ({ h: `💳 IMSI <b class="mono">${esc(x.key)}</b>${TSC.mncOp(x.key) ? ` <span class="opb" style="--oc:${TSC.OPC[TSC.mncOp(x.key)]}">${TSC.mncOp(x.key)}</span>` : ''}<div class="small">${esc(Tel.dd(x.from).slice(0, 10))} → ${esc(Tel.dd(x.to).slice(0, 10))}</div>`, go: 'dev', recs: x.recs, t: n + ' · IMSI ' + x.key })) : [])] });
  const hrs = Array.from({ length: 24 }, (_, h) => v.filter(r => Tel.hour(r) === h).length), pk = hrs.indexOf(Math.max(...hrs)), NT = v.filter(Tel.night);
  g.push({ i: '⏱', t: 'Activity', c: '#f59e0b', items: [{ v: pk + ':00', h: `most active hour (${pk}:00 – ${pk + 1}:00)`, go: 'time', recs: v.filter(r => Tel.hour(r) === pk), t: n + ' · busiest hour ' + pk + ':00' }, { v: Math.round(NT.length / Math.max(1, v.length) * 100) + '%', h: 'of activity at night (' + TSC.win('l') + ')', go: 'time', recs: NT, t: n + ' · night activity' },
    ...G.slice(0, 3).map(x => ({ h: `Off for <b>${CDRX.span(x.h)}</b><div class="small">from ${esc(Tel.dd(x.from))}${x.devCh ? ' · <b>handset changed</b>' : ''}${x.moved ? ' · came back elsewhere' : ''}</div>`, go: 'off', recs: x.recs, t: n + ' · off ' + CDRX.span(x.h) }))] });
  if (st.length) { const RP = CDRX.runs(v, CDRX.circle); g.push({ i: '🌍', t: 'Movement', c: '#10b981', items: RP.slice(-5).map(x => ({ h: `<b>${esc(x.key)}</b><div class="small">${esc(Tel.dd(x.from).slice(0, 10))} → ${esc(Tel.dd(x.to).slice(0, 10))} · ${x.dayN} days</div><div class="small muted">${esc(x.fl || '')}</div>`, go: k === 'cdr' ? 'roam' : 'loc', recs: x.recs, t: n + ' in ' + x.key })) }); }
  el.insertAdjacentHTML('beforeend', TSC.groups(g) + `<div class="grid g2"><div class="card"><h3>${k === 'ipdr' ? 'Apps' : 'Top contacts'}</h3><div id="tfC"></div></div><div class="card"><h3>Hour of day</h3><div id="tfH"></div></div></div>`);
  if (k === 'ipdr') Charts.hbar($('#tfC', el), [...groupBy(v.filter(IPX.app), IPX.app)].map(([a, w]) => ({ label: a, value: w.length, sub: Tel.bytes(Tel.vol(w)), recs: w })).sort((a, b) => b.value - a.value).slice(0, 15), { onClick: x => this.recDrawer(x.label, x.recs) });
  else Charts.hbar($('#tfC', el), C.slice(0, 15).map(c => ({ label: c.o, value: c.n, sub: (TSC.op(c.o) ? TSC.op(c.o) + ' · ' : '') + (c.dur ? Tel.hms(c.dur) : '') + (c.a ? ' · ⚑ ' + c.a : ''), recs: c.recs })), { onClick: x => this.recDrawer(n + ' ↔ ' + x.label, x.recs) });
  Charts.vbar($('#tfH', el), hrs.map((x, h) => ({ label: h + ':00', value: x })));
  TSC.wire(el);
};

/* ================= IPDR overview ================= */
{ const _s = TelUI.ipdr_sum;
  TelUI.ipdr_sum = function (el, d) {
    if (Tel._sn) return this.prof(el, d, 'ipdr');
    _s.call(this, el, d);
    const W = TSC.watch(), U = [...groupBy(d.filter(IPX.user), IPX.user)].map(([n, v]) => { const vp = v.filter(IPX.vpn).length, a = Tel.also('mobile', n), fc = uniq(v.map(r => r.dcty).filter(c => c && !/^india$/i.test(c))), ips = uniq(v.map(r => r.qip || r.xip).filter(Boolean)), why = [];
      if (a) why.push(['in ' + a, 'bad']); if (W.has(n)) why.push(['watchlist', 'bad']); if (vp) why.push([vp + ' VPN / remote', 'bad']); if (ips.length > 1) why.push(['on ' + ips.length + ' IPs', 'warn']); if (fc.length) why.push(['servers in ' + fc.slice(0, 2).join(', '), 'warn']);
      return { n, target: 1, recs: v, why, score: (a ? 5 : 0) + (W.has(n) ? 6 : 0) + (vp ? 3 : 0) + Math.min(3, ips.length - 1) + (fc.length ? 1 : 0) }; });
    const box = document.createElement('div'); TSC.board(box, U, 'Users to act on', 'Ranked by: in other case data, watchlist, VPN / remote apps, seen on several of the asked IPs, foreign servers. Click to analyse one user.');
    const k1 = $('.kpis', el); (k1 ? k1 : el.firstChild) ? (k1 || el.firstChild).after(box) : el.prepend(box); TSC.wire(box);
  }; }

/* ================= TDR overview ================= */
{ const _s = TelUI.tdr_sum;
  TelUI.tdr_sum = function (el, d0) {
    if (Tel._sn) return this.prof(el, d0, 'tdr');
    _s.call(this, el, d0);
    try { const { L, I } = this.tdrStats(d0), W = TSC.watch(), share = new Set(I.filter(x => x.sims.length > 1).flatMap(x => x.sims));
      const R = L.map(x => { const a = Tel.isMob(x.n) && Tel.also('mobile', x.n), why = []; if (x.sN >= 2) why.push([x.sN + ' crime spots', 'bad']); if (a) why.push(['in ' + a, 'bad']); if (W.has(x.n)) why.push(['watchlist', 'bad']); if (x.foreign) why.push(['foreign SIM', 'warn']); if (share.has(x.n)) why.push(['handset shared with another SIM', 'warn']);
        return { n: x.n, target: 1, recs: x.recs, why, score: (x.sN >= 2 ? 4 * (x.sN - 1) : 0) + (a ? 5 : 0) + (W.has(x.n) ? 6 : 0) + (x.foreign ? 1 : 0) + (share.has(x.n) ? 2 : 0) }; });
      const box = document.createElement('div'); TSC.board(box, R, 'Numbers to act on', 'Ranked by: present at several crime spots, in other case data, watchlist, foreign SIM, handset shared with another SIM. Click to see that number alone.');
      const k1 = $('.kpis', el); if (k1) k1.after(box); else el.prepend(box); TSC.wire(box);
    } catch (e) { console.error(e); }
  }; }

/* ===== Telecom operator of a number (Airtel / Jio / Vi / BSNL / MTNL) and finding tiles with live popup ===== */
TSC.OPC = { Airtel: '#e11d48', Jio: '#1d4ed8', Vi: '#d97706', BSNL: '#0e7490', MTNL: '#7c3aed', Reliance: '#475569', Tata: '#0f766e' };
TSC.MNC = (() => { const m = {}, add = (op, s) => s.split(' ').forEach(x => { const r = x.split('-'); if (r.length === 1) m[x] = op; else for (let i = +r[0]; i <= +r[1]; i++) m[String(i)] = op; });
  add('Airtel', '40402 40403 40410 40416 40431 40440 40445 40449 40470 40490 40492-40498 40551-40556');
  add('Vi', '40401 40404 40405 40407 40411-40415 40419 40420 40422 40424 40427 40430 40443 40444 40446 40456 40460 40478 40482 40484 40486-40489 40566 40567 40570 405750-405756 405799 405845 405846 405848-405850 405852 405853');
  add('BSNL', '40434 40438 40451 40453-40455 40457-40459 40462 40464 40466 40471-40477 40479-40481');
  add('MTNL', '40468 40469'); add('Jio', '405840 405854-405874'); return m; })();
TSC.opName = function (s) { s = String(s || '').toUpperCase(); if (!s) return '';
  return /AIRTEL|BHARTI/.test(s) ? 'Airtel' : /JIO|RJIL/.test(s) ? 'Jio' : /VODA|IDEA|VIINDIA|(^|[^A-Z])VIL?([^A-Z]|$)/.test(s) ? 'Vi' : /BSNL|CELLONE/.test(s) ? 'BSNL' : /MTNL|DOLPHIN/.test(s) ? 'MTNL' : /RELIANCE|RCOM/.test(s) ? 'Reliance' : /TATA|DOCOMO/.test(s) ? 'Tata' : ''; };
TSC.mncOp = function (s) { const g = String(s || '').replace(/\D/g, ''); if (!/^40[45]/.test(g)) return ''; return this.MNC[g.slice(0, 6)] || this.MNC[g.slice(0, 5)] || ''; };
TSC.opMap = function () {
  return Analysis.cached('telop:map', () => {
    const M = new Map(), vote = (n, op, w) => { if (!n || !op) return; let x = M.get(n); if (!x) M.set(n, x = {}); x[op] = (x[op] || 0) + w; }, meta = S.data.telMeta || {};
    for (const r of Tel.all()) {
      if (r.target && Tel.isMob(r.target)) { vote(r.target, this.mncOp(r.imsi), 5); if (r.kind !== 'TDR') vote(r.target, this.opName(r._src) || this.opName((meta[r._src] || {}).Operator), 2); if (!r.imsi) vote(r.target, this.mncOp(r.cell), 1); }
      if (r.other && Tel.isMob(r.other) && r.bop) vote(r.other, this.opName(String(r.bop).split(/--|,|\//)[0]) || this.opName(r.bop), 3);
    }
    const O = new Map(); for (const [n, x] of M) { const b = Object.entries(x).sort((a, c) => c[1] - a[1])[0]; if (b) O.set(n, b[0]); } return O;
  });
};
TSC.op = function (n) { return Tel.isMob(String(n || '')) ? this.opMap().get(String(n)) || '' : ''; };
TSC.opb = function (n, big) { const o = TSC.op(n); return o ? `<span class="opb${big ? ' big' : ''}" style="--oc:${TSC.OPC[o] || '#64748b'}" title="Telecom operator (from IMSI / file / B-party operator column; ported numbers show the current operator)">${esc(o)}</span>` : ''; };
/* every mobile number shown with the "also in" badge on the telecom pages gets the operator too */
{ const _b = Tel.alsoB.bind(Tel); Tel.alsoB = (t, v) => _b(t, v) + (t === 'mobile' && S.page === 'tele' ? TSC.opb(v) : ''); }

/* findings: every line is a box – hover for a live popup, click for all records */
TSC._r = [];
TSC.groups = function (G) {
  G = G.filter(g => g.items.length); if (!G.length) return '';
  return `<div class="tf-grid">${G.map(g => `<div class="tf-card" style="--tc:${g.c}"><div class="tf-h">${g.i} ${esc(g.t)}</div><div class="tf-tiles">${g.items.slice(0, g.max || 6).map(x => this.tile(x, g)).join('')}</div></div>`).join('')}</div>`;
};
TSC.tile = function (x, g) {
  if (Array.isArray(x)) x = { h: x[0], go: x[1], recs: x[2], t: x[3] };
  x.gt = g.t; const id = this._r.push(x) - 1, R = x.recs || [];
  return `<div class="tf-tile${x.cls ? ' ' + x.cls : ''}" data-ri="${id}" tabindex="0" role="button">${x.v != null ? `<div class="tf-tv">${x.v}</div>` : ''}<div class="tf-tx">${x.h}</div><div class="tf-tf"><span>${R.length ? '🔍 ' + fmtNum(R.length) + ' records' : ''}</span>${x.go ? `<a href="#" class="tf-go" data-tgo="${x.go}">open tab →</a>` : ''}</div></div>`;
};
TSC.tipOf = function (x) {
  const R = x.recs || []; if (!R.length) return `<b>${esc(x.t || x.gt)}</b><br><i>Click to open the tab</i>`;
  const ts = R.map(r => r.ts).filter(Boolean).sort(), calls = R.filter(r => r.dir === 'IN' || r.dir === 'OUT'), top = (f, k) => [...groupBy(R.filter(f), f)].sort((a, b) => b[1].length - a[1].length).slice(0, k);
  const T = top(r => r.target, 3), O = top(r => r.other, 3), tw = top(Tel.tower, 1)[0], im = uniq(R.map(r => r.imei).filter(Boolean)), op = n => TSC.op(n) ? ' (' + TSC.op(n) + ')' : '';
  return `<b>${esc(x.t || x.gt)}</b><br>${fmtNum(R.length)} records · ${esc(Tel.dd(ts[0] || ''))} → ${esc(Tel.dd(ts[ts.length - 1] || ''))}`
    + (calls.length ? `<br>📞 ${fmtNum(calls.filter(r => r.dir === 'OUT').length)} out / ${fmtNum(calls.filter(r => r.dir === 'IN').length)} in · talk ${Tel.hms(sum(calls, r => r.dur || 0))}` : '')
    + (T.length ? `<br>🎯 ${T.map(([n, w]) => esc(n) + op(n) + ' ×' + w.length).join(', ')}` : '')
    + (O.length ? `<br>👥 ${O.map(([n, w]) => esc(n) + op(n) + ' ×' + w.length).join(', ')}` : '')
    + (tw ? `<br>📡 ${esc((tw[1].find(r => r.addr) || {}).addr || tw[0])}` : '') + (im.length ? `<br>📱 ${esc(im.slice(0, 2).join(', '))}${im.length > 2 ? ' +' + (im.length - 2) : ''}` : '')
    + '<br><i>Click for every record</i>';
};
TSC.wire = function (el) {
  if (el._tw) return; el._tw = 1;
  const hide = e => Charts.tip(e, null);
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-tsc],[data-tgo]');
    if (a && el.contains(a)) { e.preventDefault(); e.stopPropagation(); hide(e); if (a.dataset.tsc) this.go(a.dataset.tsc); else { S.sub.tele = a.dataset.tgo; render(); } return; }
    const t = e.target.closest('[data-ri]'); if (!t || !el.contains(t) || e.target.closest('a[href^="http"]')) return;
    const x = this._r[t.dataset.ri]; if (!x) return; hide(e);
    if (x.recs && x.recs.length) TelUI.recDrawer(x.t || x.gt, x.recs); else if (x.go) { S.sub.tele = x.go; render(); }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-ri]')) e.target.click(); });
  el.addEventListener('mousemove', e => { const t = e.target.closest('[data-ri]'); if (!t) { if (el._tip) { el._tip = 0; hide(e); } return; } const x = this._r[t.dataset.ri]; if (!x) return; el._tip = 1; Charts.tip(e, x.tip || (x.tip = this.tipOf(x))); });
  el.addEventListener('mouseleave', e => { el._tip = 0; hide(e); });
};

/* ===== Editable time: night / day / late-night hours and a date range – used by every CDR / IPDR / TDR tab ===== */
TSC.TD = { nf: 20, nt: 8, df: 8, dt: 20, lf: 23, lt: 5 };
TSC.tm = function () { if (!S.telTime) { let h = {}; try { h = JSON.parse(localStorage.getItem('sa.telTime') || '{}'); } catch (e) { } S.telTime = Object.assign({}, this.TD, h, { from: '', to: '' }); } return S.telTime; };
TSC.saveT = function () { const t = this.tm(); try { localStorage.setItem('sa.telTime', JSON.stringify({ nf: t.nf, nt: t.nt, df: t.df, dt: t.dt, lf: t.lf, lt: t.lt })); } catch (e) { } };
TSC.inH = (h, a, b) => a === b || (a < b ? h >= a && h < b : h >= a || h < b);
TSC.h12 = h => (h % 12 || 12) + (h < 12 ? ' am' : ' pm');
TSC.win = w => { const t = TSC.tm(); return TSC.h12(t[w + 'f']) + ' – ' + TSC.h12(t[w + 't']); };
TSC.sig = () => { const t = TSC.tm(); return [t.nf, t.nt, t.df, t.dt, t.lf, t.lt, t.from, t.to].join(','); };
TSC.eh = () => ' <a href="#" class="tsc-eh" title="Change the hours / dates used here">✎ edit</a>';
CDRX.night = r => TSC.inH(Tel.hour(r), TSC.tm().nf, TSC.tm().nt);
CDRX.day = r => TSC.inH(Tel.hour(r), TSC.tm().df, TSC.tm().dt);
Tel.night = r => TSC.inH(Tel.hour(r), TSC.tm().lf, TSC.tm().lt);
/* cached results depend on the hours and dates */
{ const _c = Analysis.cached; Analysis.cached = (k, f) => _c(S.page === 'tele' && /^tel:/.test(k) ? k + '|@' + TSC.sig() : k, f); }
/* date range: every tab sees only records inside it */
{ const _of = Tel.of; Tel.of = function (k) { const d = _of.call(this, k), t = TSC.tm(); if (S.page !== 'tele' || !(t.from || t.to)) return d;
  return Analysis.cached('tel:' + String(k).toUpperCase() + ':dated', () => d.filter(r => { const x = String(r.ts || '').slice(0, 10); return (!t.from || x >= t.from) && (!t.to || x <= t.to); })); }; }
{ const _bar = TSC.bar; TSC.bar = function (main, k) {
  _bar.call(this, main, k); const b = $('.tsc', main); if (!b) return;
  const t = this.tm(), hs = id => `<select data-tt="${id}">${Array.from({ length: 24 }, (_, h) => `<option value="${h}"${h === t[id] ? ' selected' : ''}>${TSC.h12(h)}</option>`).join('')}</select>`, dated = t.from || t.to;
  b.insertAdjacentHTML('beforeend', `<button class="tsc-tb${dated ? ' on' : ''}" id="tscTime" title="Edit the date range and the night / day hours used by every tab">🕐 ${dated ? esc((t.from ? Tel.dd(t.from) : 'start') + ' → ' + (t.to ? Tel.dd(t.to) : 'end')) : 'All dates'} · 🌙 ${this.win('n')} · ☀ ${this.win('d')} <b>✎</b></button>`);
  b.insertAdjacentHTML('afterend', `<div class="tsc-tp" id="tscTP"${S.telTP ? '' : ' hidden'}>
    <label>📅 From <input type="date" data-tt="from" value="${esc(t.from)}"></label><label>to <input type="date" data-tt="to" value="${esc(t.to)}"></label>
    <label>🌙 Night (home / night stay) ${hs('nf')} to ${hs('nt')}</label><label>☀ Day (work / day stay) ${hs('df')} to ${hs('dt')}</label><label>🌃 Late-night calls ${hs('lf')} to ${hs('lt')}</label>
    <div class="tsc-tbtn"><button class="btn sm primary" id="tscTA">✔ Apply</button><button class="btn sm" id="tscTR">↺ Default</button></div>
    <div class="tsc-h">Applies to every tab: overview, home / work, night &amp; day max stay, towers, off periods, night calls, common items. Hours are remembered on this computer; the date range is for this case.</div></div>`);
  $('#tscTime', main).onclick = () => { S.telTP = !S.telTP; $('#tscTP', main).hidden = !S.telTP; };
  $('#tscTA', main).onclick = () => { $$('#tscTP [data-tt]', main).forEach(i => t[i.dataset.tt] = i.type === 'date' ? i.value : +i.value); if (t.from && t.to && t.from > t.to) [t.from, t.to] = [t.to, t.from]; this.saveT(); render(); UI.toast('Time settings applied'); };
  $('#tscTR', main).onclick = () => { Object.assign(t, this.TD, { from: '', to: '' }); this.saveT(); render(); };
}; }
/* "Found in CDR of" – which numbers used a tower, with counts; click a number for its records on that tower */
TSC.tgs = x => x._tg || (x._tg = [...groupBy(x.recs || [], TSC.user)].filter(([t]) => t).map(([t, w]) => [t, w.length]).sort((a, b) => b[1] - a[1]));
TSC.fcol = function () {
  return { key: 'tg', label: { cdr: 'Found in CDR of', ipdr: 'Found in IPDR of', tdr: 'Numbers seen here' }[S.telKind] || 'Found in', sortVal: x => TSC.tgs(x).length, csv: x => TSC.tgs(x).map(([t, n]) => t + ' (' + n + ')').join('; '),
    render: x => { const g = TSC.tgs(x); return `<div class="tw-ns">${g.length > 1 ? `<span class="tw-c" title="Used by ${g.length} numbers">${g.length} nos.</span>` : ''}${g.slice(0, 5).map(([t, n]) => `<a href="#" class="tw-n" data-ri="${TSC._r.push({ tw: x, n: t }) - 1}" title="Show the ${n} records of ${esc(t)} on this tower">${esc(t)}${TSC.opb(t)}<b>${fmtNum(n)}</b></a>`).join('')}${g.length > 5 ? `<span class="muted small">+${g.length - 5} more</span>` : ''}</div>`; } };
};
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('.tw-n');
  if (a) { e.preventDefault(); e.stopPropagation(); const o = TSC._r[a.dataset.ri]; if (o && o.tw) TelUI.recDrawer(o.n + ' · ' + (o.tw.addr || o.tw.t), (o.tw.recs || []).filter(r => TSC.user(r) === o.n)); return; }
  const h = e.target.closest && e.target.closest('.tsc-eh');
  if (h) { e.preventDefault(); e.stopPropagation(); S.telTP = true; const p = $('#tscTP'); if (p) { p.hidden = false; p.scrollIntoView({ block: 'center', behavior: 'smooth' }); p.classList.add('flash'); setTimeout(() => p.classList.remove('flash'), 1200); } }
}, true);
/* TDR: towers in the dumps and the numbers seen on each */
if (!TelUI.TABS.tdr.some(x => x[0] === 'loc')) TelUI.TABS.tdr.splice(2, 0, ['loc', '📡 Towers & numbers']);
TelUI.tdr_loc = function (el, d) { _cdrLoc.call(this, el, d); };
