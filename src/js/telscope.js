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
      ${one ? `<label class="tsc-f tsc-n"><span>📱 Number</span><select id="tscNum">${N.slice(0, 3000).map(([n, c]) => `<option value="${esc(n)}"${n === st[k] ? ' selected' : ''}>${esc(n)} · ${fmtNum(c)} records</option>`).join('')}</select></label>` : `<span class="tsc-h">${esc(L[2])}</span>`}
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
      { key: 'n', label: 'Number / ID', render: x => `<b class="mono">${esc(x.n)}</b> ${x.target ? '<span class="badge">target</span>' : '<span class="badge warn">contact</span>'}` },
      { key: 'why', label: 'Why', csv: x => x.why.map(r => r[0]).join('; '), render: x => this.chips(x.why) },
      { key: 'act', label: '', csv: () => '', render: x => x.target ? `<a href="#" class="btn sm" data-tsc="${esc(x.n)}">Analyse →</a>` : '' }] });
    this.wire(el);
  }
};

/* ---- page: add the bar under the CDR / IPDR / TDR / SMS buttons ---- */
{ const _page = TelUI.page;
  TelUI.page = function (main) {
    const k = TK[S.telKind] ? S.telKind : 'cdr', st = TSC.st();
    if (st._case !== S.caseId) { S.telScope = { _case: S.caseId }; }
    Tel._sn = TSC.st()[k] || '';
    if (Tel._sn && !TSC.nums(k).some(x => x[0] === Tel._sn)) Tel._sn = TSC.st()[k] = '';
    _page.call(this, main);
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
  el.insertAdjacentHTML('beforeend', TSC.groups([
    { i: '👥', t: 'Network – who is connected', c: '#3b82f6', items: [common.length ? [`<b>${fmtNum(common.length)}</b> numbers talk to 2 or more targets – likely handlers / same gang. Top: ${common.sort((a, b) => b[1].length - a[1].length).slice(0, 3).map(([o, v]) => `<b>${esc(o)}</b> (${v.length})`).join(', ')}`, 'com'] : null, x2x.length ? [`<b>${fmtNum(uniq(x2x.map(r => [r.target, r.other].sort().join())).length)}</b> pairs of targets called each other directly`, 'com'] : null, (() => { const C = CDRX.common(d), c = t => C.filter(x => x.type === t).length, parts = [['imei', 'IMEI'], ['imsi', 'IMSI'], ['cell', 'cell IDs'], ['ll', 'places'], ['sms', 'SMS senders']].filter(([t]) => c(t)).map(([t, l]) => `<b>${c(t)}</b> ${l}`); return parts.length ? [`Shared between targets: ${parts.join(', ')}`, 'com'] : null; })()].filter(Boolean) },
    { i: '🔗', t: 'Links to this case', c: '#ef4444', items: [linked.length ? [`<b>${fmtNum(linked.length)}</b> contacts also appear in bank / KYC / NCRP / social data`, 'com'] : null, W.size ? [`Watchlist: <b>${fmtNum(d.filter(r => W.has(r.other) || W.has(r.target) || W.has(r.imei)).length)}</b> matching records`, 'watch'] : ['Add suspect numbers / IMEIs to the watchlist to check them in every CDR', 'watch']].filter(Boolean) },
    { i: '📱', t: 'Devices', c: '#a855f7', items: [sharedIm.length ? [`<b>${fmtNum(sharedIm.length)}</b> handsets used with 2+ target numbers – same person, many SIMs`, 'dev'] : null, TT.filter(x => x.im > 1).length ? [`<b>${TT.filter(x => x.im > 1).length}</b> targets changed handset`, 'dev'] : null].filter(Boolean) },
    { i: '⏱', t: 'Activity', c: '#f59e0b', items: [G.length ? [`<b>${G.length}</b> periods of 24 h+ with the phone off / unused (${uniq(G.map(x => x.target)).length} targets)`, 'off'] : null, [`Night calls (11 pm – 5 am): <b>${fmtNum(d.filter(r => (r.dir === 'IN' || r.dir === 'OUT') && Tel.night(r)).length)}</b>`, 'time']].filter(Boolean) },
    { i: '📍', t: 'Location', c: '#10b981', items: [[`Home / work tower worked out for <b>${TT.filter(x => x.home).length}</b> targets`, 'loc'], [`<b>${uniq(d.map(CDRX.circle).filter(Boolean)).length}</b> states / circles seen`, 'roam']] }
  ]));
  TSC.board(el, [...TT, ...CC], 'Suspects to act on', 'Ranked by links: in other case data, watchlist, talking to many targets, many handsets, phone-off periods, night calls. Click a target to analyse it alone; click a contact for its calls.');
  el.insertAdjacentHTML('beforeend', `<div class="card"><h3>📋 Targets at a glance</h3><div class="sub">One row per CDR. Press <b>Analyse →</b> to open the full profile of that number.</div><div id="tfT"></div></div>
    <div class="grid g2"><div class="card"><h3>Top contacts</h3><div id="cs1"></div></div><div class="card"><h3>Hour of day</h3><div id="cs4"></div></div></div>`);
  Table($('#tfT', el), { rows: TT, sortKey: 'why', sortDir: -1, pageSize: 15, exportName: 'targets', onRow: x => TSC.go(x.n), columns: [{ key: 'n', label: 'Target', render: x => `<b class="mono">${esc(x.n)}</b>` }, { key: 'rN', label: 'Records', num: true }, { key: 'c', label: 'Contacts', num: true }, { key: 'im', label: 'Handsets', num: true }, { key: 'st', label: 'States', num: true }, { key: 'home', label: 'Home (night)', render: x => `<span class="small">${esc(x.home)}</span>` }, { key: 'why', label: 'Flags', csv: x => x.why.map(r => r[0]).join('; '), sortVal: x => x.score, render: x => TSC.chips(x.why) }, { key: 'act', label: '', csv: () => '', render: x => `<a href="#" class="btn sm" data-tsc="${esc(x.n)}">Analyse →</a>` }] });
  const top = P.slice().sort((a, b) => b.n - a.n);
  Charts.hbar($('#cs1', el), top.slice(0, 15).map(p => ({ label: p.other, value: p.n, sub: `${p.target} · ${p.out} out · ${p.inn} in · ${Tel.hms(p.dur)}${Tel.also('mobile', p.other) ? ' · ⚑ ' + Tel.also('mobile', p.other) : ''}`, p })), { onClick: x => this.recDrawer(x.p.target + ' ↔ ' + x.p.other, x.p.recs) });
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
  el.innerHTML = `<div class="card tf-prof"><div class="tf-ph"><div><div class="muted small">${kind} profile</div><div class="tf-num mono">${esc(n)}</div><div class="small muted">${esc(Tel.dd(first))} → ${esc(Tel.dd(lastR.ts || ''))}</div></div><div class="tf-pf">${TSC.chips(flags) || '<span class="tf-chip">no red flags yet</span>'}</div>
    <div class="tf-last"><div class="muted small">Last seen</div><b>${esc(CDRX.loc(lastR) || '—')}</b><div class="small">${esc(Tel.dd(lastR.ts || ''))}${lastR.imei ? ' · IMEI ' + esc(lastR.imei) : ''}</div></div></div>${TSC.boxes(v)}</div>` + UI.kpis(kp);
  const g = [];
  if (k === 'ipdr') {
    const A = [...groupBy(v.filter(IPX.app), IPX.app)].sort((a, b) => b[1].length - a[1].length);
    g.push({ i: '📲', t: 'Apps used', c: '#3b82f6', items: A.slice(0, 6).map(([a, w]) => [`<b>${esc(a)}</b> – ${fmtNum(w.length)} sessions, ${Tel.bytes(Tel.vol(w))}`, 'dst']) });
    const vp = v.filter(IPX.vpn); if (vp.length) g.push({ i: '🛡', t: 'Hiding / remote access', c: '#ef4444', items: [[`<b>${fmtNum(vp.length)}</b> VPN / proxy / remote sessions: ${uniq(vp.map(IPX.app)).slice(0, 4).map(esc).join(', ')}`, 'vpn']] });
    g.push({ i: '📝', t: 'For platform notice', c: '#10b981', items: [['Own public IP + port + time list for WhatsApp / Meta / Google', 'req']] });
  } else if (k === 'tdr') {
    const sp = Tel.tdrSpots(), S2 = [...groupBy(v, r => (sp.of.get(r._src) || {}).label || r._src)];
    g.push({ i: '📍', t: 'Present at crime spots', c: '#ef4444', items: S2.map(([s, w]) => [`<b>${esc(s)}</b> – ${w.length} records, ${esc(Tel.dd(w[0].ts).slice(11, 16))} to ${esc(Tel.dd(w[w.length - 1].ts).slice(11, 16))}`, 'spot']) });
  }
  if (C.length) g.push({ i: '👥', t: 'Top contacts', c: '#3b82f6', items: C.slice(0, 6).map(c => [`<b class="mono">${esc(c.o)}</b> – ${c.n} records${c.dur ? ', ' + Tel.hms(c.dur) : ''}${c.night ? ', ' + c.night + ' at night' : ''}${c.a ? ` <span class="tf-chip bad">in ${esc(c.a)}</span>` : ''}${c.w ? ' <span class="tf-chip bad">watchlist</span>' : ''}`, 'con']) });
  const lk = C.filter(c => c.a || c.w); if (lk.length) g.push({ i: '🔗', t: 'Contacts linked to this case', c: '#ef4444', items: lk.slice(0, 6).map(c => [`<b class="mono">${esc(c.o)}</b> ${c.a ? 'in ' + esc(c.a) : 'on watchlist'} – ${c.n} records, last ${esc(Tel.dd(c.last).slice(0, 10))}`, k === 'cdr' ? 'com' : '']) });
  const IP = CDRX.runs(v, r => r.imei); if (im.length) g.push({ i: '📱', t: 'Handsets', c: '#a855f7', items: IP.slice(-6).map(x => [`<span class="mono">${esc(x.key)}</span> ${esc(Tel.dd(x.from).slice(0, 10))} → ${esc(Tel.dd(x.to).slice(0, 10))} (${fmtNum(x.n)})`, 'dev']) });
  const hrs = Array.from({ length: 24 }, (_, h) => v.filter(r => Tel.hour(r) === h).length), pk = hrs.indexOf(Math.max(...hrs)), nt = v.filter(Tel.night).length;
  g.push({ i: '⏱', t: 'Activity', c: '#f59e0b', items: [[`Most active at <b>${pk}:00 – ${pk + 1}:00</b>; ${Math.round(nt / Math.max(1, v.length) * 100)}% of activity at night`, 'time'], ...G.slice(0, 3).map(x => [`Off for <b>${CDRX.span(x.h)}</b> from ${esc(Tel.dd(x.from))}${x.devCh ? ' – <b>handset changed</b>' : ''}${x.moved ? ' – came back at another place' : ''}`, 'off'])] });
  if (st.length) { const RP = CDRX.runs(v, CDRX.circle); g.push({ i: '🌍', t: 'Movement', c: '#10b981', items: RP.slice(-5).map(x => [`<b>${esc(x.key)}</b> ${esc(Tel.dd(x.from).slice(0, 10))} → ${esc(Tel.dd(x.to).slice(0, 10))} (${x.dayN} days)`, k === 'cdr' ? 'roam' : 'loc']) }); }
  el.insertAdjacentHTML('beforeend', TSC.groups(g) + `<div class="grid g2"><div class="card"><h3>${k === 'ipdr' ? 'Apps' : 'Top contacts'}</h3><div id="tfC"></div></div><div class="card"><h3>Hour of day</h3><div id="tfH"></div></div></div>`);
  if (k === 'ipdr') Charts.hbar($('#tfC', el), [...groupBy(v.filter(IPX.app), IPX.app)].map(([a, w]) => ({ label: a, value: w.length, sub: Tel.bytes(Tel.vol(w)), recs: w })).sort((a, b) => b.value - a.value).slice(0, 15), { onClick: x => this.recDrawer(x.label, x.recs) });
  else Charts.hbar($('#tfC', el), C.slice(0, 15).map(c => ({ label: c.o, value: c.n, sub: (c.dur ? Tel.hms(c.dur) : '') + (c.a ? ' · ⚑ ' + c.a : ''), recs: c.recs })), { onClick: x => this.recDrawer(n + ' ↔ ' + x.label, x.recs) });
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
