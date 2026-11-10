/* cdrplus.js – more CDR reports for tracking the target: home / work / stay, roaming & state periods, IMEI / IMSI / SIM periods,
   phone off / unused gaps, new & missing numbers, last-month view, co-location (two targets on one tower at one time),
   CDR-to-CDR calls and a watchlist. Works for mobile-number CDR and IMEI-based CDR. Everything runs on this computer. */
'use strict';
const CDRX = {
  ms: r => Date.parse(r.ts.replace(' ', 'T')),
  sorted: d => d.slice().sort((a, b) => a.ts.localeCompare(b.ts)),
  loc: r => r.addr || r.cell || '',
  circle: r => String(r.roam || '').toUpperCase(),
  span(h) { const m = Math.round(h * 60), D = Math.floor(m / 1440), H = Math.floor(m / 60) % 24, M = m % 60; return (D ? D + ' D, ' : '') + (D || H ? H + ' H, ' : '') + M + ' M'; },
  /* back-to-back records with the same value → one period */
  runs(v, key) {
    const R = []; let c = null;
    for (const r of v) { const k = key(r); if (!k) continue;
      if (!c || c.key !== k) { c = { key: k, from: r.ts, to: r.ts, n: 0, out: 0, inn: 0, sms: 0, dur: 0, days: new Set(), fl: CDRX.loc(r), ll: '', recs: [] }; R.push(c); }
      c.to = r.ts; c.n++; if (r.dir === 'OUT') c.out++; else if (r.dir === 'IN') c.inn++; else if (/^SMS/.test(r.dir)) c.sms++; c.dur += r.dur || 0; c.days.add(r.ts.slice(0, 10)); c.ll = CDRX.loc(r) || c.ll; c.recs.push(r); }
    R.forEach(x => { x.dayN = x.days.size; delete x.days; }); return R;
  },
  byT: d => groupBy(d, r => r.target),
  opt() { return (S.cdrOpt = S.cdrOpt || { gap: 12, recent: 15, win: 15 }); },
  sel(id, cur, list, unit) { return `<select data-co="${id}">${list.map(v => `<option value="${v}"${+cur === v ? ' selected' : ''}>${v} ${unit}</option>`).join('')}</select>`; },
  bindSel(el, again) { $$('[data-co]', el).forEach(s => s.onchange = () => { this.opt()[s.dataset.co] = +s.value; again(); }); },
  per: x => `${esc(Tel.dd(x.from))} → ${esc(Tel.dd(x.to))}`,
  map: (lat, lon) => lat ? ` <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">map ↗</a>` : '',
  /* tower table rows */
  towers(v) {
    return [...groupBy(v.filter(Tel.tower), Tel.tower)].map(([t, w]) => { const ll = w.find(r => r.lat) || {}; return { t, addr: (w.find(r => r.addr) || {}).addr || '', n: w.length, days: uniq(w.map(Tel.day)).length, lat: ll.lat || '', lon: ll.lon || '', roam: (w.find(r => r.roam) || {}).roam || '', first: w[0].ts, last: w[w.length - 1].ts, recs: w }; }).sort((a, b) => b.n - a.n || b.days - a.days);
  },
  night: r => { const h = Tel.hour(r); return h >= 20 || h < 8; },
  home(v) { const s = this.sorted(v), N = this.towers(s.filter(this.night)), D = this.towers(s.filter(CDRX.day)), A = this.towers(s);
    const fl = this.towers(s.filter((r, i, a) => i === 0 || a[i - 1].ts.slice(0, 10) !== r.ts.slice(0, 10) || i === a.length - 1 || a[i + 1].ts.slice(0, 10) !== r.ts.slice(0, 10)));
    return { home: N[0], work: D.find(x => !N[0] || x.t !== N[0].t) || D[0], max: A[0], dayFirstLast: fl[0], N, D, A };
  }
};

/* ---------- tabs ---------- */
TelUI.TABS.cdr = [['sum', '📊 Overview'], ['con', '👥 Contacts'], ['loc', '🏠 Home, Work & Towers'], ['dev', '📱 IMEI, IMSI & SIM periods'], ['roam', '🌍 Roaming & States'], ['off', '⏸ Off / unused periods'],
  ['new', '🆕 New, missing & last month'], ['meet', '🤝 Co-location'], ['com', '⚑ Common, CDR↔CDR & linked'], ['watch', '👁 Watchlist'], ['time', '🕐 Date & Time'], ['rec', '📋 All records'], ['files', '📁 Files']];

/* Home / Work / Max stay at the top of the towers tab, plus night & day max-stay tables */
const _cdrLoc = TelUI.cdr_loc;
TelUI.cdr_loc = function (el, d) {
  _cdrLoc.call(this, el, d);
  const box = (lbl, x, note, col) => x ? `<div class="cx-hw" style="--hc:${col}"><div class="cx-hl">${lbl}</div><b>${esc(x.addr || x.t)}</b><div class="small muted mono">${esc(x.t)}</div><div class="small">${fmtNum(x.n)} records · ${x.days} days${CDRX.map(x.lat, x.lon)}</div><div class="small muted">${esc(Tel.dd(x.first).slice(0, 10))} → ${esc(Tel.dd(x.last).slice(0, 10))} · ${note}</div></div>` : '';
  const H = [...CDRX.byT(d)].filter(([t]) => t).map(([t, v]) => [t, CDRX.home(v)]);
  el.insertAdjacentHTML('afterbegin', `<div class="card"><h3>Home, work and most-stay location</h3><div class="sub">Home = tower used most at night (${TSC.win('n')}). Work = tower used most in the day (${TSC.win('d')}).${TSC.eh()} Max stay = tower with the most records. Raid / verification starts here.</div>
    ${H.map(([t, h]) => `<div class="small" style="margin:8px 0 4px"><b class="mono">${esc(t)}</b></div><div class="cx-hws">${box('🏠 Home (night)', h.home, 'night', '#6366f1')}${box('🏢 Work (day)', h.work, 'day', '#f59e0b')}${box('📍 Max stay', h.max, 'all hours', '#10b981')}${box('🌅 Day first / last call', h.dayFirstLast, 'where the day starts & ends', '#ec4899')}</div>`).join('')}</div>
    <div class="grid g2"><div class="card"><h3>🌙 Night max stay (${TSC.win('n')})${TSC.eh()}</h3><div id="cxN"></div></div><div class="card"><h3>☀ Day max stay (${TSC.win('d')})${TSC.eh()}</h3><div id="cxD"></div></div></div>`);
  const all = CDRX.sorted(d), cols = [{ key: 't', label: 'Tower', render: x => `<span class="small">${esc(x.addr || x.t)}</span>${CDRX.map(x.lat, x.lon)}<div class="muted small mono">${esc(x.t)}</div>` }, TSC.fcol(), { key: 'n', label: 'Records', num: true }, { key: 'days', label: 'Days', num: true }, { key: 'last', label: 'Last seen', render: x => esc(Tel.dd(x.last).slice(0, 10)) }];
  Table($('#cxN', el), { rows: CDRX.towers(all.filter(CDRX.night)), sortKey: 'n', sortDir: -1, pageSize: 8, exportName: 'night_max_stay', onRow: x => this.recDrawer('Night · ' + (x.addr || x.t), x.recs), columns: cols });
  Table($('#cxD', el), { rows: CDRX.towers(all.filter(CDRX.day)), sortKey: 'n', sortDir: -1, pageSize: 8, exportName: 'day_max_stay', onRow: x => this.recDrawer('Day · ' + (x.addr || x.t), x.recs), columns: cols });
};

/* IMEI / IMSI periods, and for IMEI-based CDR the numbers (SIMs) used in each handset */
const _cdrDev = TelUI.cdr_dev;
TelUI.cdr_dev = function (el, d) {
  _cdrDev.call(this, el, d);
  const IP = [], MP = [], SP = [];
  for (const [t, v] of CDRX.byT(d)) { const s = CDRX.sorted(v); CDRX.runs(s, r => r.imei).forEach(x => IP.push(Object.assign(x, { target: t, make: Tel.make ? Tel.make(x.key) : '' }))); CDRX.runs(s, r => r.imsi).forEach(x => MP.push(Object.assign(x, { target: t }))); }
  for (const [i, v] of groupBy(d.filter(r => r.imei), r => r.imei)) { if (uniq(v.map(r => r.target)).length < 2 && !v.some(r => r.byImei)) continue; CDRX.runs(CDRX.sorted(v), r => r.target).forEach(x => SP.push(Object.assign(x, { imei: i }))); }
  el.insertAdjacentHTML('afterbegin', `${SP.length ? `<div class="card cx-hot"><h3>Numbers (SIMs) used in each handset – IMEI based</h3><div class="sub">When each SIM was in the handset. A new SIM in the same handset = the same person with a new number: get CAF / KYC of every number below.</div><div id="cxS"></div></div>` : ''}
    <div class="card"><h3>IMEI periods – which handset, when</h3><div class="sub">Each row is one stretch of time the number was used in that handset. Many rows = handset changed back and forth.</div><div id="cxI"></div></div>
    <div class="card"><h3>IMSI periods – which SIM card, when</h3><div class="sub">A new IMSI on the same number = SIM swapped / re-issued (ask the operator for the SIM swap date and the documents).</div><div id="cxM"></div></div>`);
  const pc = [{ key: 'from', label: 'Period', render: x => CDRX.per(x) }, { key: 'n', label: 'Records', num: true }, { key: 'dayN', label: 'Days', num: true }, { key: 'out', label: 'Out', num: true }, { key: 'inn', label: 'In', num: true }, { key: 'sms', label: 'SMS', num: true }, { key: 'dur', label: 'Talk', num: true, render: x => Tel.hms(x.dur) }, { key: 'fl', label: 'First location', render: x => `<span class="small">${esc(x.fl)}</span>` }, { key: 'll', label: 'Last location', render: x => `<span class="small">${esc(x.ll)}</span>` }];
  if (SP.length) Table($('#cxS', el), { rows: SP, sortKey: 'from', exportName: 'imei_sim_periods', onRow: x => this.recDrawer(x.imei + ' · ' + x.key, x.recs), columns: [{ key: 'imei', label: 'IMEI', render: x => `<span class="mono">${esc(x.imei)}</span>` }, { key: 'key', label: 'Number (SIM)', render: x => `<b class="mono">${esc(x.key)}</b> ${Tel.isMob(x.key) ? Tel.alsoB('mobile', x.key) : ''}` }, ...pc] });
  Table($('#cxI', el), { rows: IP, sortKey: 'from', exportName: 'imei_periods', onRow: x => this.recDrawer(x.target + ' · IMEI ' + x.key, x.recs), columns: [{ key: 'target', label: 'Number' }, { key: 'key', label: 'IMEI', render: x => `<b class="mono">${esc(x.key)}</b> ${Tel.alsoB('imei', x.key)}` }, ...pc] });
  Table($('#cxM', el), { rows: MP, sortKey: 'from', exportName: 'imsi_periods', onRow: x => this.recDrawer(x.target + ' · IMSI ' + x.key, x.recs), columns: [{ key: 'target', label: 'Number' }, { key: 'key', label: 'IMSI', render: x => `<span class="mono">${esc(x.key)}</span>` }, ...pc] });
};

/* roaming periods and contacts by state (circle of the other number) */
TelUI.cdr_roam = function (el, d) {
  const RP = []; for (const [t, v] of CDRX.byT(d)) CDRX.runs(CDRX.sorted(v), CDRX.circle).forEach(x => RP.push(Object.assign(x, { target: t })));
  const op = r => String(r.bop || ''), circ = r => { const s = op(r).split(/--|-\s|,/); return (s[1] || '').trim().toUpperCase() || (/^[A-Z ]+$/.test(op(r)) ? '' : ''); };
  const calls = d.filter(r => r.other && !/[A-Z]/.test(r.other));
  const ST = [...groupBy(calls.filter(circ), circ)].map(([c, v]) => ({ c, n: v.length, out: v.filter(r => r.dir === 'OUT').length, inn: v.filter(r => r.dir === 'IN').length, sms: v.filter(r => /^SMS/.test(r.dir)).length, dur: sum(v, r => r.dur || 0), nums: uniq(v.map(r => r.other)).length, recs: v })).sort((a, b) => b.n - a.n);
  const OP = [...groupBy(calls.filter(op), r => op(r).split(/--/)[0].trim().toUpperCase())].map(([o, v]) => ({ label: o || '—', value: v.length })).sort((a, b) => b.value - a.value);
  const SS = [...groupBy(RP, x => x.key)].map(([c, v]) => ({ c, times: v.length, n: sum(v, x => x.n), days: uniq(v.flatMap(x => x.recs.map(Tel.day))).length, first: v[0].from, last: v[v.length - 1].to, recs: v.flatMap(x => x.recs) })).sort((a, b) => b.n - a.n);
  el.innerHTML = UI.kpis([['States / circles visited', fmtNum(SS.length), SS.slice(0, 3).map(x => x.c).join(', '), 'c2'], ['Trips (roaming periods)', fmtNum(RP.length), '', 'c5'], ['Contact states', fmtNum(ST.length), ST[0] ? 'most: ' + ST[0].c : 'needs B-party operator column', 'c1'], ['Contact operators', fmtNum(OP.length), OP[0] ? 'most: ' + OP[0].label : '', 'c3']])
    + `<div class="card"><h3>Where the phone was – state / circle periods</h3><div class="sub">Each row = one stay in a state, in time order. Short trips to another state just before / after the crime date are worth checking.</div><div id="cxR"></div></div>
    <div class="grid g2"><div class="card"><h3>Time in each state</h3><div id="cxRS"></div></div><div class="card"><h3>Contacts by operator</h3><div id="cxOP"></div></div></div>
    <div class="card"><h3>Contacts by state (other number's circle)</h3><div class="sub">Where the people he talks to are registered. Taken from the B-party operator column (e.g. "JIO--Delhi").</div><div id="cxST"></div></div>`;
  Table($('#cxR', el), { rows: RP, sortKey: 'from', exportName: 'roaming_periods', onRow: x => this.recDrawer(x.target + ' · ' + x.key, x.recs), columns: [{ key: 'target', label: 'Number' }, { key: 'key', label: 'State / circle', render: x => `<b>${esc(x.key)}</b>` }, { key: 'from', label: 'Period', render: x => CDRX.per(x) }, { key: 'n', label: 'Records', num: true }, { key: 'dayN', label: 'Days', num: true }, { key: 'out', label: 'Out', num: true }, { key: 'inn', label: 'In', num: true }, { key: 'sms', label: 'SMS', num: true }, { key: 'fl', label: 'First location', render: x => `<span class="small">${esc(x.fl)}</span>` }, { key: 'll', label: 'Last location', render: x => `<span class="small">${esc(x.ll)}</span>` }] });
  Charts.hbar($('#cxRS', el), SS.map(x => ({ label: x.c, value: x.n, sub: `${x.days} days · ${x.times} stay(s) · ${Tel.dd(x.first).slice(0, 10)} → ${Tel.dd(x.last).slice(0, 10)}`, x })), { onClick: o => this.recDrawer(o.x.c, o.x.recs) });
  if (OP.length) Charts.donut($('#cxOP', el), OP.slice(0, 8)); else $('#cxOP', el).innerHTML = '<div class="muted">No B-party operator column in these CDRs.</div>';
  if (ST.length) Table($('#cxST', el), { rows: ST, sortKey: 'n', sortDir: -1, exportName: 'contact_states', onRow: x => this.recDrawer('Contacts in ' + x.c, x.recs), columns: [{ key: 'c', label: 'State / circle', render: x => `<b>${esc(x.c)}</b>` }, { key: 'nums', label: 'Numbers', num: true }, { key: 'n', label: 'Total', num: true }, { key: 'out', label: 'Out', num: true }, { key: 'inn', label: 'In', num: true }, { key: 'sms', label: 'SMS', num: true }, { key: 'dur', label: 'Talk', num: true, render: x => Tel.hms(x.dur) }] });
  else $('#cxST', el).innerHTML = '<div class="muted">No B-party operator / circle column in these CDRs.</div>';
};

/* phone switched off / not used */
CDRX.gaps = function (d, hours) {
  const G = [];
  for (const [t, v] of CDRX.byT(d)) { const s = CDRX.sorted(v); for (let i = 1; i < s.length; i++) { const a = s[i - 1], b = s[i], h = (CDRX.ms(b) - CDRX.ms(a)) / 3600e3; if (!(h >= hours)) continue;
    G.push({ target: t, from: a.ts, to: b.ts, h, imeiOff: a.imei, imeiOn: b.imei, imsiOff: a.imsi, imsiOn: b.imsi, locOff: CDRX.loc(a), locOn: CDRX.loc(b), cOff: CDRX.circle(a), cOn: CDRX.circle(b), devCh: a.imei && b.imei && a.imei !== b.imei, simCh: a.imsi && b.imsi && a.imsi !== b.imsi, moved: CDRX.loc(a) && CDRX.loc(b) && CDRX.loc(a) !== CDRX.loc(b), recs: [a, b] }); } }
  return G;
};
TelUI.cdr_off = function (el, d) {
  const o = CDRX.opt(), G = CDRX.gaps(d, o.gap);
  el.innerHTML = UI.kpis([['Off / unused periods', fmtNum(G.length), 'longer than ' + o.gap + ' hours', 'c2'], ['Longest', G.length ? CDRX.span(Math.max(...G.map(x => x.h))) : '—', '', 'c5'], ['Handset changed across gap', fmtNum(G.filter(x => x.devCh).length), '', 'c1'], ['SIM changed across gap', fmtNum(G.filter(x => x.simCh).length), '', 'c3'], ['Came back at another place', fmtNum(G.filter(x => x.moved).length), '', 'c4']])
    + `<div class="card"><h3>Phone off / not used</h3><div class="sub">Gaps with no call, SMS or data. Show gaps longer than ${CDRX.sel('gap', o.gap, [2, 6, 12, 24, 48, 72], 'hours')}. A gap around the crime time, or a gap after which the handset / SIM / place changed, points to a second phone or a hide-out.</div><div id="cxG"></div></div>`;
  CDRX.bindSel(el, () => this.cdr_off(el, d));
  const ch = (a, b, f) => a === b ? `<span class="small">${esc(a)}</span>` : `<span class="small">${esc(a)}</span> → <b class="small" style="color:var(--danger,#ef4444)">${esc(b)}</b>${f ? ' <span class="badge bad">changed</span>' : ''}`;
  Table($('#cxG', el), { rows: G, sortKey: 'h', sortDir: -1, exportName: 'off_periods', onRow: x => this.recDrawer(x.target + ' · off ' + CDRX.span(x.h), x.recs), columns: [{ key: 'target', label: 'Number' }, { key: 'from', label: 'Off from → on at', render: x => CDRX.per(x) }, { key: 'h', label: 'Off for', num: true, render: x => `<b>${CDRX.span(x.h)}</b>`, csv: x => CDRX.span(x.h) },
    { key: 'imeiOff', label: 'IMEI off → on', render: x => ch(x.imeiOff, x.imeiOn, x.devCh), csv: x => x.imeiOff + ' > ' + x.imeiOn }, { key: 'imsiOff', label: 'IMSI off → on', render: x => ch(x.imsiOff, x.imsiOn, x.simCh), csv: x => x.imsiOff + ' > ' + x.imsiOn },
    { key: 'locOff', label: 'Place off → on', render: x => ch(x.locOff, x.locOn, false), csv: x => x.locOff + ' > ' + x.locOn }, { key: 'cOff', label: 'Circle off → on', render: x => ch(x.cOff, x.cOn, false), csv: x => x.cOff + ' > ' + x.cOn }] });
};

/* new / missing numbers and the last-month picture */
TelUI.cdr_new = function (el, d) {
  const o = CDRX.opt(), N = o.recent, rows = [], R = [];
  let recentD = [];
  for (const [t, v] of CDRX.byT(d)) {
    const s = CDRX.sorted(v); if (!s.length) continue; const end = CDRX.ms(s[s.length - 1]), cut = end - N * 864e5;
    const before = groupBy(s.filter(r => r.other && CDRX.ms(r) < cut), r => r.other), after = groupBy(s.filter(r => r.other && CDRX.ms(r) >= cut), r => r.other);
    for (const [n, w] of after) if (!before.has(n)) rows.push({ target: t, other: n, kind: 'New', n: w.length, first: w[0].ts, last: w[w.length - 1].ts, recs: w });
    for (const [n, w] of before) if (!after.has(n) && w.length >= 2) rows.push({ target: t, other: n, kind: 'Missing', n: w.length, first: w[0].ts, last: w[w.length - 1].ts, recs: w });
    recentD = recentD.concat(s.filter(r => CDRX.ms(r) >= cut)); R.push({ t, from: new Date(cut).toISOString().slice(0, 10), to: s[s.length - 1].ts.slice(0, 10) });
  }
  const nw = rows.filter(x => x.kind === 'New'), ms = rows.filter(x => x.kind === 'Missing'), mob = x => Tel.isMob(x.other);
  el.innerHTML = UI.kpis([['New numbers', fmtNum(nw.filter(mob).length), 'first seen in the last ' + N + ' days', 'c2'], ['Missing numbers', fmtNum(ms.filter(mob).length), 'talked earlier, silent in last ' + N + ' days', 'c1'], ['Records in last ' + N + ' days', fmtNum(recentD.length), R.map(x => Tel.dd(x.from) + ' → ' + Tel.dd(x.to)).slice(0, 1).join(''), 'c5'], ['Towers in last ' + N + ' days', fmtNum(uniq(recentD.map(Tel.tower).filter(Boolean)).length), '', 'c3']])
    + `<div class="card"><h3>New and missing numbers</h3><div class="sub">Compare the last ${CDRX.sel('recent', N, [7, 15, 30, 45, 60, 90], 'days')} of each CDR with the time before. <b>New</b> = a fresh contact (new handler / new victim); <b>Missing</b> = an old contact who went silent (warned, arrested or switched number).</div>
      <div class="row" style="margin:6px 0"><label class="small"><input type="checkbox" id="cxMob" checked> Mobile numbers only (hide SMS headers)</label></div><div id="cxNM"></div></div>
    <div class="grid g2"><div class="card"><h3>Last ${N} days – top contacts</h3><div id="cxL1"></div></div><div class="card"><h3>Last ${N} days – top towers (latest hide-out)</h3><div id="cxL2"></div></div></div>`;
  CDRX.bindSel(el, () => this.cdr_new(el, d));
  const draw = () => { const only = $('#cxMob', el).checked; Table($('#cxNM', el), { rows: rows.filter(x => !only || mob(x)), sortKey: 'kind', exportName: 'new_missing_numbers', onRow: x => this.recDrawer(x.target + ' ↔ ' + x.other, x.recs), columns: [{ key: 'kind', label: 'Status', render: x => `<span class="badge ${x.kind === 'New' ? 'warn' : 'bad'}">${x.kind}</span>` }, { key: 'target', label: 'Target' }, { key: 'other', label: 'Number', render: x => `<b class="mono">${esc(x.other)}</b> ${mob(x) ? Tel.alsoB('mobile', x.other) : ''}` }, { key: 'n', label: 'Records', num: true }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] }); };
  $('#cxMob', el).onchange = draw; draw();
  const tc = [...groupBy(recentD.filter(r => r.other && !/[A-Z]/.test(r.other)), r => r.other)].map(([k, v]) => ({ label: k, value: v.length, sub: Tel.hms(sum(v, r => r.dur || 0)) + (Tel.also('mobile', k) ? ' · ⚑ ' + Tel.also('mobile', k) : ''), recs: v })).sort((a, b) => b.value - a.value).slice(0, 15);
  Charts.hbar($('#cxL1', el), tc, { onClick: x => this.recDrawer(x.label, x.recs) });
  Charts.hbar($('#cxL2', el), CDRX.towers(CDRX.sorted(recentD)).slice(0, 12).map(x => ({ label: x.addr || x.t, value: x.n, sub: x.days + ' days · last ' + Tel.dd(x.last).slice(0, 10), recs: x.recs })), { onClick: x => this.recDrawer(x.label, x.recs) });
};

/* co-location: two targets on the same tower within N minutes */
TelUI.cdr_meet = function (el, d) {
  const o = CDRX.opt(), W = o.win * 60e3, T = uniq(d.map(r => r.target)).filter(Boolean);
  if (T.length < 2) { el.innerHTML = `<div class="card"><h3>Co-location timing match</h3><div class="muted">Load CDRs of two or more numbers (or IMEIs). This tab then shows when they were on the same tower at the same time – i.e. they met or travelled together.</div></div>`; return; }
  const M = [];
  for (const [tw, v] of groupBy(d.filter(Tel.tower), Tel.tower)) {
    if (uniq(v.map(r => r.target)).length < 2) continue; const s = CDRX.sorted(v).map(r => [CDRX.ms(r), r]);
    for (let i = 0; i < s.length && M.length < 5000; i++) for (let j = i + 1; j < s.length && s[j][0] - s[i][0] <= W; j++) { const a = s[i][1], b = s[j][1]; if (a.target === b.target) continue; const [x, y] = a.target < b.target ? [a, b] : [b, a]; M.push({ pair: x.target + ' + ' + y.target, tw, addr: a.addr || b.addr || '', ta: x.ts, tb: y.ts, gap: Math.round(Math.abs(s[j][0] - s[i][0]) / 60e3), day: a.ts.slice(0, 10), lat: a.lat || b.lat, lon: a.lon || b.lon, recs: [x, y] }); }
  }
  const P = [...groupBy(M, m => m.pair)].map(([p, v]) => ({ p, n: v.length, days: uniq(v.map(m => m.day)).length, towers: uniq(v.map(m => m.tw)).length, first: v.reduce((a, m) => !a || m.ta < a ? m.ta : a, ''), last: v.reduce((a, m) => m.ta > a ? m.ta : a, ''), recs: v.flatMap(m => m.recs) })).sort((a, b) => b.days - a.days || b.n - a.n);
  el.innerHTML = UI.kpis([['Targets compared', fmtNum(T.length), '', 'c2'], ['Pairs seen together', fmtNum(P.length), '', 'c5'], ['Meetings', fmtNum(M.length), 'same tower within ' + o.win + ' min', 'c1'], ['Days together', fmtNum(uniq(M.map(m => m.day)).length), '', 'c3']])
    + `<div class="card"><h3>Who was with whom</h3><div class="sub">Same tower within ${CDRX.sel('win', o.win, [5, 10, 15, 30, 60, 120], 'minutes')}. Many days together = same gang / same house.</div><div id="cxP"></div></div><div class="card"><h3>Each meeting</h3><div id="cxMe"></div></div>`;
  CDRX.bindSel(el, () => this.cdr_meet(el, d));
  Table($('#cxP', el), { rows: P, sortKey: 'days', sortDir: -1, exportName: 'colocation_pairs', onRow: x => this.recDrawer(x.p, x.recs), columns: [{ key: 'p', label: 'Pair', render: x => `<b class="mono">${esc(x.p)}</b>` }, { key: 'n', label: 'Meetings', num: true }, { key: 'days', label: 'Days', num: true }, { key: 'towers', label: 'Places', num: true }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] });
  Table($('#cxMe', el), { rows: M, sortKey: 'ta', exportName: 'colocation_meetings', pageSize: 50, onRow: x => this.recDrawer(x.pair, x.recs), columns: [{ key: 'pair', label: 'Pair', render: x => `<span class="mono">${esc(x.pair)}</span>` }, { key: 'ta', label: 'Time A', render: x => esc(Tel.dd(x.ta)) }, { key: 'tb', label: 'Time B', render: x => esc(Tel.dd(x.tb)) }, { key: 'gap', label: 'Gap (min)', num: true }, { key: 'addr', label: 'Tower', render: x => `<span class="small">${esc(x.addr || x.tw)}</span>${CDRX.map(x.lat, x.lon)}` }] });
};

/* CDR ↔ CDR: one target calling another target */
const _cdrCom = TelUI.cdr_com;
TelUI.cdr_com = function (el, d) {
  _cdrCom.call(this, el, d);
  const T = new Set(d.map(r => r.target).filter(Boolean));
  const X = [...groupBy(d.filter(r => r.other && T.has(r.other) && r.other !== r.target), r => [r.target, r.other].sort().join(' ↔ '))].map(([k, v]) => ({ k, n: v.length, calls: v.filter(r => r.dir === 'IN' || r.dir === 'OUT').length, sms: v.filter(r => /^SMS/.test(r.dir)).length, dur: sum(v, r => r.dur || 0), first: v.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last: v.reduce((a, r) => r.ts > a ? r.ts : a, ''), recs: v })).sort((a, b) => b.n - a.n);
  el.insertAdjacentHTML('afterbegin', `<div class="card"><h3>CDR ↔ CDR – targets calling each other</h3><div class="sub">${T.size < 2 ? 'Load CDRs of two or more numbers to see direct contact between them.' : X.length ? 'Direct calls / SMS between the numbers whose CDRs are loaded.' : 'No direct contact between the loaded targets.'}</div><div id="cxX"></div></div>`);
  this.cdrCommon(el, d);
  if (X.length) Table($('#cxX', el), { rows: X, sortKey: 'n', sortDir: -1, exportName: 'cdr_to_cdr', onRow: x => this.recDrawer(x.k, x.recs), columns: [{ key: 'k', label: 'Targets', render: x => `<b class="mono">${esc(x.k)}</b>` }, { key: 'n', label: 'Records', num: true }, { key: 'calls', label: 'Calls', num: true }, { key: 'sms', label: 'SMS', num: true }, { key: 'dur', label: 'Talk', num: true, render: x => Tel.hms(x.dur) }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] });
};

/* watchlist: suspect numbers, IMEIs, IMSIs or cell IDs – saved with the case */
TelUI.cdr_watch = function (el, d) {
  const W = S.data.cdrWatch = S.data.cdrWatch || [];
  const norm = v => { const s = String(v).trim(); return /^[\d\s+()-]+$/.test(s) && s.replace(/\D/g, '').length <= 13 ? TelRead.num(s) : s.toUpperCase(); };
  const hits = W.map(w => { const q = norm(w), u = q.toUpperCase(); const ql = q.toLowerCase(), recs = d.filter(r => r.target === q || r.other === q || r.imei === q || r.imsi === q || r.xip === ql || r.pip === ql || r.dip === ql || r.qip === q || String(r.mac || '').toUpperCase() === u || String(r.cell).toUpperCase() === u || (u.length > 5 && String(r.addr).toUpperCase().includes(u))); const how = uniq(recs.map(r => r.target === q ? 'Target' : r.other === q ? 'Contact' : r.imei === q ? 'IMEI' : r.imsi === q ? 'IMSI' : r.dip === ql ? 'Destination IP' : (r.xip === ql || r.pip === ql || r.qip === q) ? 'Own IP' : String(r.mac || '').toUpperCase() === u ? 'MAC' : 'Tower')); return { w, q, n: recs.length, how: how.join(', '), targets: uniq(recs.map(r => r.target)), first: recs.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last: recs.reduce((a, r) => r.ts > a ? r.ts : a, ''), recs }; });
  el.innerHTML = UI.kpis([['Watchlist items', fmtNum(W.length), 'saved with this case', 'c2'], ['Found in CDR', fmtNum(hits.filter(h => h.n).length), '', 'c1'], ['Records hit', fmtNum(sum(hits, h => h.n)), '', 'c5']])
    + `<div class="card"><h3>Compare with watchlist</h3><div class="sub">Paste suspect mobile numbers, IMEIs, IMSIs, IP addresses, MAC IDs, cell IDs or tower names – one per line. Every loaded CDR / IPDR record is checked: as target, contact, handset, SIM, own IP, destination IP or tower. The list is shared by CDR and IPDR.</div>
      <textarea id="cxW" rows="5" style="width:100%" placeholder="98xxxxxxxx&#10;35xxxxxxxxxxxxx&#10;404-xx-xxxx-xxxxx">${esc(W.join('\n'))}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="cxWs">💾 Save &amp; compare</button><button class="btn" id="cxWc">➕ Add suspects of this case</button><span class="muted small">Suspects = mobiles / IMEIs found in bank, KYC, NCRP, social or CAF data of this case.</span></div><div id="cxWH" style="margin-top:10px"></div></div>`;
  $('#cxWs', el).onclick = () => { S.data.cdrWatch = uniq($('#cxW', el).value.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)); saveCase(); this.cdr_watch(el, d); UI.toast('Watchlist saved'); };
  $('#cxWc', el).onclick = () => { let add = []; try { add = [...Tel.elsewhere().keys()].filter(k => /^(mobile|imei)\|/.test(k)).map(k => k.split('|')[1]); } catch (e) { } const ta = $('#cxW', el); ta.value = uniq([...ta.value.split('\n').map(s => s.trim()).filter(Boolean), ...add]).join('\n'); UI.toast(add.length ? add.length + ' suspect values added – press Save & compare' : 'No suspect numbers in other data of this case'); };
  if (W.length) Table($('#cxWH', el), { rows: hits, sortKey: 'n', sortDir: -1, exportName: 'watchlist_hits', onRow: x => x.n && this.recDrawer('Watchlist · ' + x.w, x.recs), columns: [{ key: 'w', label: 'Watch item', render: x => `<b class="mono">${esc(x.w)}</b>` }, { key: 'n', label: 'Hits', num: true, render: x => x.n ? `<span class="badge bad">${fmtNum(x.n)}</span>` : '<span class="muted">0</span>' }, { key: 'how', label: 'Found as' }, { key: 'targets', label: 'In CDR of', csv: x => x.targets.join(' '), render: x => x.targets.map(esc).join(', ') }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] });
};

/* more lines in Key findings */
const _cdrFind = TelUI.cdrFindings;
TelUI.cdrFindings = function (d, ...a) {
  const f = _cdrFind.call(this, d, ...a), b = s => `<b>${esc(s)}</b>`;
  try {
    for (const [t, v] of CDRX.byT(d)) { if (!t) continue; const h = CDRX.home(v);
      if (h.home && h.work && h.home.t !== h.work.t) f.push(`${b(t)}: home (night) ${b(h.home.addr || h.home.t)}, work (day) ${b(h.work.addr || h.work.t)} – see Home, Work & Towers.`);
      const st = uniq(v.map(CDRX.circle).filter(Boolean)); if (st.length > 1) f.push(`${b(t)} moved through ${b(st.length + ' states / circles')} – see Roaming & States.`); }
    const G = CDRX.gaps(d, 24); if (G.length) f.push(`${b(G.length + ' period(s)')} of more than 24 hours with the phone off / unused${G.some(x => x.devCh || x.simCh) ? ', ' + b(G.filter(x => x.devCh || x.simCh).length + ' with handset / SIM changed') : ''} – see Off / unused periods.`);
    if ((S.data.cdrWatch || []).length) { const W = new Set(S.data.cdrWatch.map(String)); const n = d.filter(r => W.has(r.other) || W.has(r.target) || W.has(r.imei)).length; if (n) f.push(`${b(n + ' record(s)')} match your watchlist – see Watchlist.`); }
  } catch (e) { console.error(e); }
  return f;
};

/* ===== Common across CDRs: target number, B party, IMEI, IMSI, cell ID, lat-long, SMS sender – and which CDRs share it ===== */
CDRX.CT = [['all', 'All common items', '⚑'], ['tgt', 'Target number in other CDR', '🎯'], ['b', 'Common B-party number', '👥'], ['imei', 'Common IMEI', '📱'], ['imsi', 'Common IMSI', '💳'], ['cell', 'Common Cell ID', '📡'], ['ll', 'Common Lat-Long', '📍'], ['sms', 'Common SMS sender', '✉'], ['x', 'Also in IPDR / TDR', '🔗']];
CDRX.common = function (d) {
  return Analysis.cached('tel:cdrcommon', () => {
    const T = new Set(d.map(r => r.target).filter(Boolean)), out = [];
    const add = (type, key, get, label) => {
      const m = new Map();
      for (const r of d) { const v = get(r); if (!v || !r.target) continue; let x = m.get(v); if (!x) m.set(v, x = { type, v, by: new Map(), recs: [] }); x.by.set(r.target, (x.by.get(r.target) || 0) + 1); x.recs.push(r); }
      for (const x of m.values()) if (x.by.size >= 2) { x.n = x.recs.length; x.cdrs = [...x.by.keys()]; x.cN = x.cdrs.length; x.info = label ? label(x) : ''; x.first = x.recs.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''); x.last = x.recs.reduce((a, r) => r.ts > a ? r.ts : a, ''); out.push(x); }
    };
    /* a target number that shows up as B party in other targets' CDR */
    { const m = new Map(); for (const r of d) if (r.other && T.has(r.other) && r.other !== r.target) { let x = m.get(r.other); if (!x) m.set(r.other, x = { type: 'tgt', v: r.other, by: new Map(), recs: [] }); x.by.set(r.target, (x.by.get(r.target) || 0) + 1); x.recs.push(r); }
      for (const x of m.values()) { x.n = x.recs.length; x.cdrs = [...x.by.keys()]; x.cN = x.cdrs.length; x.info = 'own CDR loaded'; x.first = x.recs.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''); x.last = x.recs.reduce((a, r) => r.ts > a ? r.ts : a, ''); out.push(x); } }
    add('b', 'other', r => r.other && !/[A-Z]/.test(r.other) && !T.has(r.other) && r.other.length >= 8 ? r.other : '', x => Tel.also('mobile', x.v) ? 'also in ' + Tel.also('mobile', x.v) : (x.recs.find(r => r.bop) || {}).bop || '');
    add('imei', 'imei', r => r.imei, x => 'TAC ' + x.v.slice(0, 8));
    add('imsi', 'imsi', r => r.imsi, x => 'network ' + x.v.slice(0, 3) + '-' + x.v.slice(3, 5));
    add('cell', 'cell', r => r.cell, x => (x.recs.find(r => r.addr) || {}).addr || '');
    add('ll', 'll', r => r.lat && r.lon ? (+r.lat).toFixed(3) + ', ' + (+r.lon).toFixed(3) : '', x => (x.recs.find(r => r.addr) || {}).addr || '');
    add('sms', 'sms', r => /[A-Z]/.test(r.other || '') ? (Tel.hdrInfo(r.other) || {}).ent || '' : '', x => (Tel.hdrInfo(x.v) || {}).cat || '');
    /* CDR values found in IPDR / TDR of this case */
    const oth = Tel.all().filter(r => r.kind !== 'CDR' && r.kind !== 'SMS'), oi = new Map();
    for (const r of oth) for (const v of [r.target, r.other, r.imei]) if (v) { let s = oi.get(v); if (!s) oi.set(v, s = new Set()); s.add(r.kind); }
    const xm = new Map(); for (const r of d) for (const v of [r.target, r.other, r.imei]) if (v && oi.has(v)) { let x = xm.get(v); if (!x) xm.set(v, x = { type: 'x', v, by: new Map(), recs: [] }); x.by.set(r.target, (x.by.get(r.target) || 0) + 1); x.recs.push(r); }
    for (const x of xm.values()) { x.n = x.recs.length; x.cdrs = [...x.by.keys()]; x.cN = x.cdrs.length; x.info = 'in ' + [...oi.get(x.v)].join(' + '); x.first = x.recs.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''); x.last = x.recs.reduce((a, r) => r.ts > a ? r.ts : a, ''); out.push(x); }
    return out;
  });
};
TelUI.cdrCommon = function (el, d) {
  const all = CDRX.common(d), cur = S.cdrComT || 'all', cnt = t => t === 'all' ? all.filter(x => x.type !== 'x').length : all.filter(x => x.type === t).length, T = uniq(d.map(r => r.target).filter(Boolean));
  const rows = all.filter(x => cur === 'all' ? x.type !== 'x' : x.type === cur), lbl = Object.fromEntries(CDRX.CT.map(c => [c[0], c[1]]));
  el.insertAdjacentHTML('afterbegin', `<div class="card cx-com"><h3>⚑ Common across CDRs – what links the targets</h3><div class="sub">${T.length < 2 ? 'Load the CDRs of two or more numbers: this finds every number, handset, SIM, tower, place and SMS sender they share.' : `Across <b>${T.length}</b> CDRs. Each row shows the shared item and <b>which CDR numbers</b> it appears in, with record counts. Click a row for every record.`}</div>
    <div class="cx-ct">${CDRX.CT.map(([id, l, i]) => `<button class="cx-cb ${id === cur ? 'on' : ''}" data-ct="${id}"><span>${i} ${l}</span><b>${fmtNum(cnt(id))}</b></button>`).join('')}</div><div id="cxCm"></div></div>`);
  $$('[data-ct]', el).forEach(b => b.onclick = () => { S.cdrComT = b.dataset.ct; const c = $('.cx-com', el); c.remove(); this.cdrCommon(el, d); });
  if (!rows.length) { $('#cxCm', el).innerHTML = `<div class="muted">No common ${esc(lbl[cur].replace(/^Common /, '').toLowerCase())} found${T.length < 2 ? ' – only one CDR loaded' : ''}.</div>`; return; }
  Table($('#cxCm', el), { rows, sortKey: 'cN', sortDir: -1, pageSize: 25, exportName: 'cdr_common_' + cur, onRow: x => this.recDrawer(lbl[x.type] + ' · ' + x.v, x.recs), columns: [
    ...(cur === 'all' || cur === 'x' ? [{ key: 'type', label: 'Type', render: x => `<span class="badge">${esc(lbl[x.type].replace(/^Common /, ''))}</span>`, csv: x => lbl[x.type] }] : []),
    { key: 'v', label: 'Common item', render: x => `<b class="mono">${esc(x.v)}</b>${x.type === 'b' || x.type === 'tgt' ? ' ' + Tel.alsoB('mobile', x.v) : x.type === 'imei' ? ' ' + Tel.alsoB('imei', x.v) : ''}${x.type === 'll' ? CDRX.map(...x.v.split(', ')) : ''}` },
    { key: 'info', label: 'Details', render: x => `<span class="small">${esc(x.info)}</span>` },
    { key: 'cN', label: 'CDRs', num: true, render: x => `<span class="badge ${x.cN > 2 ? 'bad' : 'warn'}">${x.cN}</span>` },
    { key: 'cdrs', label: 'Found in CDR of (records)', sortVal: x => x.cN, csv: x => x.cdrs.map(t => t + ' (' + x.by.get(t) + ')').join('; '), render: x => `<span class="mono small">${x.cdrs.slice(0, 8).map(t => `${esc(t)} <span class="muted">(${x.by.get(t)})</span>`).join(', ')}${x.cdrs.length > 8 ? ' …' : ''}</span>` },
    { key: 'n', label: 'Records', num: true }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] });
};
