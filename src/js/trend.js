/* trend.js – Analytics › Trending Crime: crime trends across ALL cases, NCRP complaints and EO enquiries.
   Fraud type (APK, phone hacking, call forwarding, investment…), district / commissionerate, zone, police station,
   identifier, incident & reporting date, reporting delay to the second, IO / EO. Read on this computer only. */
'use strict';
const Trend = {
  TYPES: [
    ['APK / Malicious App', '📲', /\bapk\b|malicious app|remote (access|app)|any ?desk|team ?viewer|quick ?support|screen ?shar|rust ?desk|mirror app/i],
    ['Call Forwarding', '📞', /call ?forward|\*\*?21\*|\*401\*|divert(ed)? call|ussd code/i],
    ['Phone Hacking / SIM Swap', '🔓', /hack|sim ?swap|e-?sim|duplicate sim|account take ?over|whatsapp (account )?(hack|compromis)/i],
    ['Digital Arrest / Impersonation', '🚔', /digital arrest|cbi|customs|narcotic|\bned\b|enforcement directorate|\bed officer|police officer|fedex|courier|parcel|trai|money laundering/i],
    ['Investment / Trading', '📈', /invest|trading|stock|share market|\bipo\b|crypto|forex|bitcoin|usdt/i],
    ['Part-Time Job / Task', '💼', /part.?time|task|work from home|youtube like|hotel rating|prepaid task|job fraud|job offer/i],
    ['Sextortion', '🎥', /sextortion|nude|obscene|video call (blackmail|record)/i],
    ['Loan App', '💸', /loan app|instant loan|loan fraud|loan harass/i],
    ['KYC / Bank Impersonation', '🏦', /\bkyc\b|customer care|bank (official|executive)|card block|account block|electricity bill|reward points|credit card limit/i],
    ['UPI / OTP Fraud', '🔢', /\botp\b|\bupi\b|qr code|collect request|debit card|credit card|card fraud|internet banking|net banking/i],
    ['Lottery / Gift / Prize', '🎁', /lottery|gift|prize|kbc|lucky draw/i],
    ['E-Commerce / Online Shopping', '🛒', /e-?commerce|online shop|olx|quikr|delivery|refund|army (officer|man)|seller|buyer/i],
    ['Matrimonial / Romance', '💔', /matrimon|romance|dating|marriage|friendship/i],
    ['Social Media / Fake Profile', '👤', /fake (profile|id|account)|impersonat|social media|facebook|instagram|morph/i]
  ],
  OTHER: ['Other / Not Clear', '❓'],
  type(t) { t = String(t || ''); for (const [n, , rx] of this.TYPES) if (rx.test(t)) return n; return this.OTHER[0]; },
  icon(n) { const x = this.TYPES.find(t => t[0] === n); return x ? x[1] : this.OTHER[1]; },
  ts(s) { s = String(s || '').trim(); if (!s) return 0; let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
    if (m) { let h = +(m[4] || 0); if (m[7]) h = h % 12 + (/pm/i.test(m[7]) ? 12 : 0); const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1], h, +(m[5] || 0), +(m[6] || 0)).getTime() || 0; }
    m = s.match(/^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?/); if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime() || 0; return 0; },
  dur(sec) { if (sec == null || sec === '' || isNaN(sec)) return ''; sec = Math.round(sec); const neg = sec < 0; sec = Math.abs(sec); const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (neg ? '-' : '') + (d ? d + 'd ' : '') + String(h).padStart(2, '0') + 'h ' + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's'; },
  fdt(t) { if (!t) return ''; const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}` + (d.getHours() || d.getMinutes() || d.getSeconds() ? ` ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : ''); },
  /* one case → its records (NCRP complaints; a case with no NCRP rows counts once from its own details) */
  one(c, d) {
    const io = [c.io_rank, c.io].filter(Boolean).join(' '), base = { caseId: c.id, case: AllMode && AllMode.caseLabel ? AllMode.caseLabel(c) : c.name, fir: c.fir || '', io, zone: c.zone || '' };
    const out = (d.ncrp || []).map(n => { const inc = this.ts(n.incident_date || n.incident_datetime || n.date_of_incident || n.incident), rep = this.ts(n.reported_date || n.complaint_date || n.reporting_date || n.date);
      const ids = [['Mobile', n.suspect_mobile], ['Account', n.suspect_acc], ['UPI', n.suspect_upi], ['URL / App', n.suspect_url], ['Email', n.suspect_email]].flatMap(([t, v]) => String(v || '').split(/[,;\/|\s]+/).filter(x => x.length > 3).map(x => ({ t, v: x })));
      return { ...base, src: 'NCRP', ack: n.ack_no || '', type: this.type([n.category, n.sub_category, n.remarks, n.suspect_url].join(' ')), cat: [n.category, n.sub_category].filter(Boolean).join(' › '), state: n.state || '', district: n.district || c.district || '', ps: n.ps || c.ps || '', zone: n.zone || base.zone, inc, rep, amount: +n.amount || 0, ids }; });
    if (out.length) return out;
    let fd = 0, txt = [c.name, c.section, c.ctype].join(' '); try { const r = CDX.analyse(d, c); fd = this.ts(r.fir.date); txt += ' ' + (r.fir.brief || '').slice(0, 3000); } catch (e) { }
    return [{ ...base, src: 'Case', ack: c.ack || '', type: this.type(txt), cat: c.ctype || '', state: c.state || '', district: c.district || '', ps: c.ps || '', inc: 0, rep: fd || this.ts(c.firDate), amount: 0, ids: [] }];
  },
  async collect(force) {
    if (this._d && !force && Date.now() - this._t < 60000) return this._d;
    const R = [];
    for (const c of S.cases) {
      R.push(...(c.id === S.caseId && S.data && !isScope(S.caseId) ? this.one(c, S.data) : await Vault.sum(c.id, 'trd', 'v1|' + JSON.stringify(c), async () => { const d = await DB.get('case:' + c.id); return d ? this.one(c, Object.assign(emptyCase(), d)) : []; })));
      await new Promise(r => setTimeout(r, 0));
    }
    try { const C = await EO.cfg(); for (const e of await EO.list()) R.push({ src: 'EO', caseId: '', case: [e.type, EO.caseNo(e)].filter(Boolean).join(' '), ack: e.type === 'NCRP' ? e.no : '', fir: e.fir && e.fir.no || '', type: this.type(e.brief + ' ' + (e.notes || '')), cat: (EO.TYPES[e.type] || [])[1] || '', state: '', district: (e.fir && e.fir.district) || '', ps: (e.fir && e.fir.ps) || '', zone: '', inc: 0, rep: this.ts(e.recv), amount: +e.amount || 0, ids: [], io: e.fir && e.fir.io || '', eo: [C.eo, C.desig].filter(Boolean).join(', ') }); } catch (e) { }
    this._t = Date.now(); return (this._d = R);
  },
  DIMS: [['type', '🧩 Fraud Type'], ['district', '🏙 District / Commissionerate'], ['zone', '🗺 Zone'], ['ps', '🚓 Police Station'], ['ident', '🔎 Identifier'], ['month', '📅 Month (Reporting)'], ['io', '👮 IO / EO'], ['cat', '🗂 NCRP Category']],
  key(r, k) { return k === 'month' ? (r.rep ? new Date(r.rep).toISOString().slice(0, 7) : '') : k === 'io' ? [r.io, r.eo].filter(Boolean).join(' / ') : r[k] || ''; },
  st() { return this._s || (this._s = { dim: 'type', src: '', type: '', f: null, from: '', to: '' }); },

  async page(main) {
    main.innerHTML = `<div class="page-head"><div class="ph-text"><div class="crumb">Analysis <span>›</span> Trending Crime</div><h2>📊 Trending Crime</h2><div class="ph-desc">Crime trends across all cases, NCRP complaints and EO enquiries – fraud type, district, zone, police station, identifier, incident / reporting date with delay, IO / EO.</div></div></div><div id="trB"><div class="card muted">Reading all cases…</div></div>`;
    const A = await this.collect(); if (S.page !== 'trend') return; this.draw($('#trB', main), A);
  },
  draw(el, A) {
    Target.tip(null);
    const st = this.st(), from = st.from ? new Date(st.from).getTime() : 0, to = st.to ? new Date(st.to).getTime() + 864e5 : 0;
    const base = A.filter(r => (!st.src || r.src === st.src) && (!from || r.rep >= from) && (!to || (r.rep && r.rep < to)));
    const F = base.filter(r => (!st.type || r.type === st.type) && (!st.f || (st.f.k === 'ident' ? r.ids.some(i => i.v === st.f.v) : this.key(r, st.f.k) === st.f.v)));
    const now = Date.now(), D30 = 30 * 864e5, amt = F.reduce((s, r) => s + r.amount, 0), dl = F.filter(r => r.inc && r.rep && r.rep >= r.inc).map(r => (r.rep - r.inc) / 1000);
    // per fraud type: count, amount, last 30 days vs the 30 before, last 6 months
    const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d.toISOString().slice(0, 7); });
    const T = [...groupBy(base, r => r.type)].map(([t, l]) => { const a = l.filter(r => r.rep > now - D30).length, b = l.filter(r => r.rep <= now - D30 && r.rep > now - 2 * D30).length;
      return { t, n: l.length, amt: l.reduce((s, r) => s + r.amount, 0), a, b, ch: b ? Math.round((a - b) / b * 100) : a ? 100 : 0, m: months.map(m => l.filter(r => r.rep && new Date(r.rep).toISOString().slice(0, 7) === m).length), top: [...groupBy(l, r => r.ps || r.district || '—')].sort((x, y) => y[1].length - x[1].length).slice(0, 3).map(([k, v]) => k + ' (' + v.length + ')') }; }).sort((x, y) => y.n - x.n);
    const rise = T.filter(t => t.a >= 2).sort((x, y) => y.ch - x.ch)[0];
    const spark = m => { const mx = Math.max(1, ...m); return `<svg viewBox="0 0 60 18" class="tr-sp"><polyline fill="none" stroke="currentColor" stroke-width="1.6" points="${m.map((v, i) => `${i * 12},${17 - v / mx * 15}`).join(' ')}"/></svg>`; };
    el.innerHTML = `${UI.kpis([['Records', fmtNum(F.length), `${S.cases.length} case(s) · NCRP · EO`, 'c2'], ['Amount', fmtINR(amt), 'fraud amount reported', 'c4'], ['Top Fraud Type', T[0] ? this.icon(T[0].t) + ' ' + T[0].t : '—', T[0] ? T[0].n + ' records' : '', 'c5'], ['Rising Fast', rise ? this.icon(rise.t) + ' ' + rise.t : '—', rise ? `${rise.a} in last 30 days · ${rise.ch >= 0 ? '▲' : '▼'} ${Math.abs(rise.ch)}%` : 'not enough dated records', 'c1'], ['Avg Reporting Delay', dl.length ? this.dur(dl.reduce((s, x) => s + x, 0) / dl.length) : '—', dl.length ? `incident → reporting · ${dl.length} records` : 'needs incident & reporting dates', 'c3'], ['Districts / PS', fmtNum(uniq(F.map(r => r.district).filter(Boolean)).length) + ' / ' + fmtNum(uniq(F.map(r => r.ps).filter(Boolean)).length), '', 'c6']])}
      <div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">🔥 Fraud Type Trend <span class="small muted">last 30 days vs the 30 before · 6-month line</span></h3>
        <div class="seg">${[['', 'All Sources'], ['NCRP', '🧾 NCRP'], ['Case', '📁 Cases'], ['EO', '🕵 EO']].map(([k, l]) => `<button class="btn sm ${st.src === k ? 'primary' : ''}" data-tsrc="${k}">${l}</button>`).join('')}</div>
        <label class="small">From <input type="date" id="trFrom" value="${st.from}"></label><label class="small">To <input type="date" id="trTo" value="${st.to}"></label>${st.type || st.f || st.from || st.to || st.src ? '<button class="btn sm" id="trClr">✖ Clear</button>' : ''}</div>
        <div class="tr-cards">${T.map(t => `<button class="tr-card ${st.type === t.t ? 'on' : ''} ${t.ch > 0 ? 'up' : t.ch < 0 ? 'down' : ''}" data-tty="${esc(t.t)}"><div class="tr-h"><span>${this.icon(t.t)}</span><b>${esc(t.t)}</b></div><div class="tr-n"><b>${fmtNum(t.n)}</b>${spark(t.m)}</div><div class="small">${t.amt ? fmtINR(t.amt) + ' · ' : ''}<span class="tr-ch">${t.ch > 0 ? '▲' : t.ch < 0 ? '▼' : '•'} ${Math.abs(t.ch)}%</span> <span class="muted">(${t.a} vs ${t.b})</span></div></button>`).join('') || '<div class="muted">No records yet – import NCRP complaints or add cases / EO enquiries.</div>'}</div></div>
      <div class="grid g2"><div class="card"><div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">Smart Overview</h3><select id="trDim">${this.DIMS.map(([k, l]) => `<option value="${k}" ${st.dim === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="small muted" style="margin:4px 0 6px">Hover for numbers · click a bar to filter everything below.</div><div id="trBar"></div></div>
        <div class="card"><h3>📅 Month-Wise (Reporting Date)${st.type ? ' – ' + esc(st.type) : ''}</h3><div id="trLine"></div><h3 style="margin-top:12px">⏱ Reporting Delay</h3><div id="trDl"></div></div></div>
      <div class="card"><div class="row" style="gap:8px;align-items:center"><h3 class="grow" style="margin:0">📋 Records <span class="badge">${fmtNum(F.length)}</span>${st.f ? ` <span class="chip">${esc((this.DIMS.find(d => d[0] === st.f.k) || [])[1] || '')}: ${esc(st.f.v)}</span>` : ''}${st.type ? ` <span class="chip">${esc(st.type)}</span>` : ''}</h3></div><div id="trT" style="margin-top:8px"></div></div>`;
    // overview bars
    const bars = st.dim === 'ident' ? [...groupBy(F.flatMap(r => r.ids.map(i => ({ ...i, r }))), i => i.t + ': ' + i.v)].map(([k, l]) => ({ label: k, value: uniq(l.map(x => x.r.ack || x.r.caseId)).length, sub: 'records with this ' + l[0].t, k: 'ident', v: l[0].v })).filter(x => x.value >= 1)
      : [...groupBy(F, r => this.key(r, st.dim) || '—')].map(([k, l]) => ({ label: st.dim === 'type' ? this.icon(k) + ' ' + k : k, value: l.length, sub: fmtINR(l.reduce((s, r) => s + r.amount, 0)) + ' · ' + uniq(l.map(r => r.ps).filter(Boolean)).slice(0, 3).join(', '), k: st.dim, v: k }));
    bars.sort((a, b) => st.dim === 'month' ? String(b.v).localeCompare(a.v) : b.value - a.value);
    Charts.hbar($('#trBar', el), bars, { max: 15, fmt: v => fmtNum(v) + ' records', onClick: d => { if (d.v === '—') return; if (st.dim === 'type') st.type = st.type === d.v ? '' : d.v; else st.f = st.f && st.f.v === d.v ? null : { k: d.k, v: d.v }; this.draw(el, A); } });
    const mm = [...groupBy(F.filter(r => r.rep), r => new Date(r.rep).toISOString().slice(0, 7))].sort((a, b) => a[0].localeCompare(b[0])).map(([k, l]) => ({ label: k, value: l.length }));
    Charts.line($('#trLine', el), mm, { fmt: v => fmtNum(v) + ' records' });
    const bk = [['Same Day (< 24h)', 0, 1], ['1–3 Days', 1, 3], ['4–7 Days', 3, 7], ['8–30 Days', 7, 30], ['30+ Days', 30, 1e9]].map(([l, a, b]) => ({ label: l, value: dl.filter(x => x / 86400 >= a && x / 86400 < b).length }));
    Charts.vbar($('#trDl', el), dl.length ? bk : [], { fmt: v => fmtNum(v) + ' records' });
    Table($('#trT', el), { rows: F, pageSize: 25, sortKey: 'rep', sortDir: -1, exportName: 'trending_crime', noNd: true, onRow: r => { if (r.caseId && r.caseId !== S.caseId) switchCase(r.caseId); }, columns: [
      { key: 'src', label: 'Source' }, { key: 'case', label: 'Case / Ack', render: r => `<b>${esc(r.case || '')}</b>${r.ack ? `<div class="small muted mono">${esc(r.ack)}</div>` : ''}`, csv: r => [r.case, r.ack].filter(Boolean).join(' · ') },
      { key: 'type', label: 'Fraud Type', render: r => `${this.icon(r.type)} ${esc(r.type)}${r.cat ? `<div class="small muted">${esc(r.cat)}</div>` : ''}` },
      { key: 'district', label: 'District' }, { key: 'zone', label: 'Zone' }, { key: 'ps', label: 'PS' },
      { key: 'inc', label: 'Incident', sortVal: r => r.inc || 0, render: r => esc(this.fdt(r.inc)), csv: r => this.fdt(r.inc) }, { key: 'rep', label: 'Reporting', sortVal: r => r.rep || 0, render: r => esc(this.fdt(r.rep)), csv: r => this.fdt(r.rep) },
      { key: 'delay', label: 'Delay', sortVal: r => r.inc && r.rep ? r.rep - r.inc : -1, render: r => r.inc && r.rep ? `<span class="mono small">${this.dur((r.rep - r.inc) / 1000)}</span>` : '', csv: r => r.inc && r.rep ? this.dur((r.rep - r.inc) / 1000) : '' },
      { key: 'amount', label: 'Amount', num: true, render: r => r.amount ? fmtINR(r.amount) : '' },
      { key: 'ids', label: 'Identifiers', sortVal: r => r.ids.length, render: r => `<span class="small">${esc(r.ids.slice(0, 3).map(i => i.v).join(', '))}${r.ids.length > 3 ? ' +' + (r.ids.length - 3) : ''}</span>`, csv: r => r.ids.map(i => i.t + ': ' + i.v).join('; ') },
      { key: 'io', label: 'IO / EO', render: r => esc([r.io, r.eo && 'EO ' + r.eo].filter(Boolean).join(' · ')), csv: r => [r.io, r.eo].filter(Boolean).join(' / ') }] });
    const re = () => this.draw(el, A);
    $$('[data-tsrc]', el).forEach(b => b.onclick = () => { st.src = b.dataset.tsrc; re(); });
    $$('[data-tty]', el).forEach(b => { b.onclick = () => { st.type = st.type === b.dataset.tty ? '' : b.dataset.tty; re(); };
      const t = T.find(x => x.t === b.dataset.tty); b.title = `${t.t}: ${t.n} records${t.amt ? ' · ' + fmtINR(t.amt) : ''}\nLast 30 days ${t.a} · before that ${t.b}\nMonths ${months.map((m, i) => m.slice(5) + ':' + t.m[i]).join('  ')}\nTop: ${t.top.join(', ')}`; });
    $('#trDim', el).onchange = e => { st.dim = e.target.value; st.f = null; re(); };
    $('#trFrom', el).onchange = e => { st.from = e.target.value; re(); }; $('#trTo', el).onchange = e => { st.to = e.target.value; re(); };
    if ($('#trClr', el)) $('#trClr', el).onclick = () => { Object.assign(st, { src: '', type: '', f: null, from: '', to: '' }); re(); };
  }
};
Pages.trend = main => Trend.page(main);
