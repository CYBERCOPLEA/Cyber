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
    try { this._tg = await Target.collect(force); } catch (e) { this._tg = []; }
    this._t = Date.now(); return (this._d = R);
  },
  /* suspects (targets) behind each record: same identifier, or a target found in the same case */
  link(A) {
    const T = this._tg || [], V = new Map(), C = new Map(), nv = v => { v = String(v || '').toLowerCase().replace(/\s/g, ''); return /^\+?\d{10,13}$/.test(v) ? v.slice(-10) : v; };
    T.forEach(t => { [t.acc, ...t.mobile, ...t.upi, ...t.email].forEach(v => { const k = nv(v); if (k) (V.get(k) || V.set(k, []).get(k)).push(t); }); t.cases.forEach(c => (C.get(c.id) || C.set(c.id, []).get(c.id)).push(t)); });
    A.forEach(r => { const s = new Set(); r.ids.forEach(i => (V.get(nv(i.v)) || []).forEach(t => s.add(t))); if (r.caseId) (C.get(r.caseId) || []).forEach(t => s.add(t)); r.tg = [...s]; });
  },
  DOW: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  PAL: ['#6366f1', '#f97316', '#16a34a', '#0ea5e9', '#e11d48', '#a855f7', '#eab308', '#14b8a6', '#f43f5e', '#64748b'],
  ring(list, sel, attr, center, sub) {
    const tot = list.reduce((s, x) => s + x.n, 0) || 1, top = list.slice(0, 9), rest = list.slice(9), C = 90, r1 = 80, r2 = 48; let a0 = -Math.PI / 2;
    const arc = (v, col, key, n) => { const a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, p = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)].map(x => x.toFixed(2)).join(' ');
      const d = v >= tot ? `M ${C - r1} ${C} A ${r1} ${r1} 0 1 1 ${C + r1} ${C} A ${r1} ${r1} 0 1 1 ${C - r1} ${C} M ${C - r2} ${C} A ${r2} ${r2} 0 1 0 ${C + r2} ${C} A ${r2} ${r2} 0 1 0 ${C - r2} ${C} Z` : `M ${p(r1, a0)} A ${r1} ${r1} 0 ${big} 1 ${p(r1, a1)} L ${p(r2, a1)} A ${r2} ${r2} 0 ${big} 0 ${p(r2, a0)} Z`;
      a0 = a1; return `<path d="${d}" fill="${col}" class="jm-arc ${sel === key ? 'on' : ''}" ${key ? `${attr}="${esc(key)}"` : ''} fill-rule="evenodd"><title>${esc(n)}</title></path>`; };
    return `<div class="jm-ring"><svg viewBox="0 0 180 180" width="180" height="180">${top.map((x, i) => arc(x.n, this.PAL[i], x.k, x.k + ': ' + x.n)).join('')}${rest.length ? arc(rest.reduce((s, x) => s + x.n, 0), '#94a3b8', '', 'Others') : ''}<text x="90" y="86" text-anchor="middle" class="jm-rt">${fmtNum(center)}</text><text x="90" y="104" text-anchor="middle" class="jm-rs">${esc(sub)}</text></svg>
      <div class="jm-lg">${top.map((x, i) => `<button class="jm-li ${sel === x.k ? 'on' : ''}" ${attr}="${esc(x.k)}"><i style="background:${this.PAL[i]}"></i><span>${esc(x.k)}</span><b>${x.n}</b>${x.e ? `<em>${esc(x.e)}</em>` : ''}</button>`).join('')}${rest.length ? `<div class="small muted">+ ${rest.length} more</div>` : ''}</div></div>`;
  },
  cols(list, attr, sel) { const mx = Math.max(1, ...list.map(x => x.n)); return `<div class="tr-cols">${list.map(x => `<button class="tr-col ${String(sel) === String(x.k) ? 'on' : ''}" ${attr}="${x.k}"><span class="tr-cb"><i style="height:${x.n / mx * 100}%"></i></span><b>${x.n || ''}</b><small>${esc(x.l)}</small></button>`).join('')}</div>`; },
  DIMS: [['type', '🧩 Fraud Type'], ['district', '🏙 District / Commissionerate'], ['zone', '🗺 Zone'], ['ps', '🚓 Police Station'], ['ident', '🔎 Identifier'], ['month', '📅 Month (Reporting)'], ['io', '👮 IO / EO'], ['cat', '🗂 NCRP Category']],
  key(r, k) { return k === 'month' ? (r.rep ? new Date(r.rep).toISOString().slice(0, 7) : '') : k === 'io' ? [r.io, r.eo].filter(Boolean).join(' / ') : r[k] || ''; },
  st() { return this._s || (this._s = { dim: 'type', src: '', type: '', f: null, from: '', to: '', db: 'inc', win: '', dow: '', hr: '', sus: null }); },
  dOf(r) { return this.st().db === 'inc' ? r.inc || 0 : r.rep || 0; },

  async page(main) {
    main.innerHTML = `<div class="page-head"><div class="ph-text"><div class="crumb">Analysis <span>›</span> Trending Crime</div><h2>📊 Trending Crime</h2><div class="ph-desc">Crime trends across all cases, NCRP complaints and EO enquiries – fraud type, incident date at a glance (day, hour, last 7 / 30 / 90 days), target / suspect State &amp; District, district, zone, police station, identifier, reporting delay, IO / EO.</div></div></div><div id="trB"><div class="card muted">Reading all cases…</div></div>`;
    const A = await this.collect(); if (S.page !== 'trend') return; this.draw($('#trB', main), A);
  },
  draw(el, A) {
    Target.tip(null); this.tip(null);
    const st = this.st(), from = st.from ? new Date(st.from).getTime() : 0, to = st.to ? new Date(st.to).getTime() + 864e5 : 0, dOf = r => this.dOf(r); this.link(A);
    const base = A.filter(r => (!st.src || r.src === st.src) && (!from || dOf(r) >= from) && (!to || (dOf(r) && dOf(r) < to)));
    const W = { 7: 7, 30: 30, 90: 90, 365: 365 }, hasT = r => { const d = new Date(r.inc); return r.inc && (d.getHours() || d.getMinutes() || d.getSeconds()); };
    const sus = r => !st.sus || r.tg.some(t => t.state.includes(st.sus.s) && (!st.sus.d || t.district.includes(st.sus.d)));
    const G0 = base.filter(r => (!st.type || r.type === st.type) && (!st.f || (st.f.k === 'ident' ? r.ids.some(i => i.v === st.f.v) : this.key(r, st.f.k) === st.f.v)) && sus(r));
    const inc = (r, k) => (k !== 'win' && st.win && !(r.inc && Date.now() - r.inc < W[st.win] * 864e5)) || (k !== 'dow' && st.dow !== '' && !(r.inc && new Date(r.inc).getDay() === +st.dow)) || (k !== 'hr' && st.hr !== '' && !(hasT(r) && new Date(r.inc).getHours() === +st.hr)) ? false : true;
    const F = G0.filter(r => inc(r));
    const GI = k => G0.filter(r => inc(r, k));
    const Iw = GI('win'), Id = GI('dow').filter(r => r.inc), Ih = GI('hr').filter(hasT);
    const winB = [['7', 'Last 7 Days', '#dc2626'], ['30', 'Last 30 Days', '#f97316'], ['90', 'Last 90 Days', '#eab308'], ['365', 'Last 1 Year', '#16a34a']].map(([k, l, c]) => [k, l, c, Iw.filter(r => r.inc && Date.now() - r.inc < W[k] * 864e5)]);
    const dowL = this.DOW.map((l, i) => ({ k: i, l, n: Id.filter(r => new Date(r.inc).getDay() === i).length })), hrL = [...Array(24)].map((_, h) => ({ k: h, l: String(h).padStart(2, '0'), n: Ih.filter(r => new Date(r.inc).getHours() === h).length }));
    const peakD = dowL.slice().sort((a, b) => b.n - a.n)[0], peakH = hrL.slice().sort((a, b) => b.n - a.n)[0];
    // suspects of the records in view (all filters except the suspect place)
    const SR = G0.length && st.sus ? base.filter(r => (!st.type || r.type === st.type) && inc(r)) : F, TS = new Set(); SR.forEach(r => r.tg.forEach(t => TS.add(t))); const TL = [...TS];
    const stC = new Map(); TL.forEach(t => t.state.forEach(s => { const o = stC.get(s) || { k: s, n: 0, t: [] }; o.n++; o.t.push(t); stC.set(s, o); }));
    const SS = [...stC.values()].sort((a, b) => b.n - a.n).map(x => ({ ...x, e: SR.filter(r => r.tg.some(t => x.t.includes(t))).length + ' records' }));
    const dsC = new Map(); TL.filter(t => !st.sus || t.state.includes(st.sus.s)).forEach(t => t.district.forEach(d => { const k = (st.sus ? st.sus.s : (t.state[0] || '—')) + '|' + d, o = dsC.get(k) || { k, n: 0, t: [] }; o.n++; o.t.push(t); dsC.set(k, o); }));
    const DS = [...dsC.values()].sort((a, b) => b.n - a.n).slice(0, 15), dmx = Math.max(1, ...DS.map(x => x.n));
    const now = Date.now(), D30 = 30 * 864e5, amt = F.reduce((s, r) => s + r.amount, 0), dl = F.filter(r => r.inc && r.rep && r.rep >= r.inc).map(r => (r.rep - r.inc) / 1000);
    // per fraud type: count, amount, last 30 days vs the 30 before, last 6 months
    const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d.toISOString().slice(0, 7); });
    const T = [...groupBy(base, r => r.type)].map(([t, l]) => { const a = l.filter(r => r.rep > now - D30).length, b = l.filter(r => r.rep <= now - D30 && r.rep > now - 2 * D30).length;
      return { t, n: l.length, amt: l.reduce((s, r) => s + r.amount, 0), a, b, ch: b ? Math.round((a - b) / b * 100) : a ? 100 : 0, m: months.map(m => l.filter(r => r.rep && new Date(r.rep).toISOString().slice(0, 7) === m).length), top: [...groupBy(l, r => r.ps || r.district || '—')].sort((x, y) => y[1].length - x[1].length).slice(0, 3).map(([k, v]) => k + ' (' + v.length + ')') }; }).sort((x, y) => y.n - x.n);
    const rise = T.filter(t => t.a >= 2).sort((x, y) => y.ch - x.ch)[0];
    const spark = m => { const mx = Math.max(1, ...m); return `<svg viewBox="0 0 60 18" class="tr-sp"><polyline fill="none" stroke="currentColor" stroke-width="1.6" points="${m.map((v, i) => `${i * 12},${17 - v / mx * 15}`).join(' ')}"/></svg>`; };
    this._F = F;
    el.innerHTML = `${UI.kpis([['Records', fmtNum(F.length), `${S.cases.length} case(s) · NCRP · EO`, 'c2'], ['Amount', fmtINR(amt), 'fraud amount reported', 'c4'], ['Top Fraud Type', T[0] ? this.icon(T[0].t) + ' ' + T[0].t : '—', T[0] ? T[0].n + ' records' : '', 'c5'], ['Rising Fast', rise ? this.icon(rise.t) + ' ' + rise.t : '—', rise ? `${rise.a} in last 30 days · ${rise.ch >= 0 ? '▲' : '▼'} ${Math.abs(rise.ch)}%` : 'not enough dated records', 'c1'], ['Avg Reporting Delay', dl.length ? this.dur(dl.reduce((s, x) => s + x, 0) / dl.length) : '—', dl.length ? `incident → reporting · ${dl.length} records` : 'needs incident & reporting dates', 'c3'], ['Districts / PS', fmtNum(uniq(F.map(r => r.district).filter(Boolean)).length) + ' / ' + fmtNum(uniq(F.map(r => r.ps).filter(Boolean)).length), '', 'c6']])}
      <div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">🔥 Fraud Type Trend <span class="small muted">last 30 days vs the 30 before · 6-month line</span></h3>
        <div class="seg">${[['', 'All Sources'], ['NCRP', '🧾 NCRP'], ['Case', '📁 Cases'], ['EO', '🕵 EO']].map(([k, l]) => `<button class="btn sm ${st.src === k ? 'primary' : ''}" data-tsrc="${k}">${l}</button>`).join('')}</div>
        <label class="small">From <input type="date" id="trFrom" value="${st.from}"></label><label class="small">To <input type="date" id="trTo" value="${st.to}"></label>${st.type || st.f || st.from || st.to || st.src ? '<button class="btn sm" id="trClr">✖ Clear</button>' : ''}</div>
        <div class="tr-cards">${T.map(t => `<button class="tr-card ${st.type === t.t ? 'on' : ''} ${t.ch > 0 ? 'up' : t.ch < 0 ? 'down' : ''}" data-tty="${esc(t.t)}"><div class="tr-h"><span>${this.icon(t.t)}</span><b>${esc(t.t)}</b></div><div class="tr-n"><b>${fmtNum(t.n)}</b>${spark(t.m)}</div><div class="small">${t.amt ? fmtINR(t.amt) + ' · ' : ''}<span class="tr-ch">${t.ch > 0 ? '▲' : t.ch < 0 ? '▼' : '•'} ${Math.abs(t.ch)}%</span> <span class="muted">(${t.a} vs ${t.b})</span></div></button>`).join('') || '<div class="muted">No records yet – import NCRP complaints or add cases / EO enquiries.</div>'}</div></div>
      <div class="grid g2"><div class="card tr-inc"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">🕒 Incident Date At A Glance</h3><span class="pill-group"><button data-tdb="inc" class="${st.db === 'inc' ? 'active' : ''}">By Incident Date</button><button data-tdb="rep" class="${st.db === 'rep' ? 'active' : ''}">By Reporting Date</button></span>${st.win || st.dow !== '' || st.hr !== '' ? '<button class="btn sm" id="trIncClr">✖ Clear Time Filter</button>' : ''}</div>
          <div class="tr-wins">${winB.map(([k, l, c, L]) => `<button class="tr-win ${st.win === k ? 'on' : ''}" data-twin="${k}" style="--c:${c}"><b>${fmtNum(L.length)}</b><small>${l}</small></button>`).join('')}</div>
          <div class="small" style="margin:8px 0 2px"><b>📆 Day of Week</b> (incident)${peakD && peakD.n ? ` · most on <b>${peakD.l}</b>` : ''}</div>${this.cols(dowL, 'data-tdow', st.dow)}
          <div class="small" style="margin:8px 0 2px"><b>⏰ Hour of Day</b> (incident, where time is known – ${fmtNum(Ih.length)} records)${peakH && peakH.n ? ` · peak <b>${peakH.l}:00–${peakH.l}:59</b>` : ''}</div>${this.cols(hrL, 'data-thr', st.hr)}
          <div class="small muted" style="margin-top:6px">Point at a number for the records, click to filter everything on this page.</div></div>
        <div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">🎯 Target / Suspect State &amp; District</h3>${st.sus ? `<button class="btn sm" id="trSusClr">✖ ${esc(st.sus.s + (st.sus.d ? ' › ' + st.sus.d : ''))}</button>` : ''}</div>
          <div class="small muted" style="margin:2px 0 6px">From Target: KYC / bank replies, accused, JMIS – ${fmtNum(TL.length)} suspect${TL.length === 1 ? '' : 's'} behind these records. Point for the suspects, click to filter.</div>
          ${SS.length ? this.ring(SS, st.sus && st.sus.s, 'data-tss', TL.length, 'Suspects') + `<div class="small" style="margin:10px 0 4px"><b>📍 District wise${st.sus ? ' – ' + esc(st.sus.s) : ' (top 15)'}</b></div><div class="jm-bars">${DS.map(x => { const [s0, d0] = x.k.split('|'); return `<button class="jm-bar ${st.sus && st.sus.d === d0 ? 'on' : ''}" data-tsd="${esc(x.k)}"><span class="jm-bn">${esc(d0)}${st.sus ? '' : `<small>${esc(s0)}</small>`}</span><span class="jm-bt" style="width:${x.n / dmx * 100}%"><i class="p" style="flex:1;background:#e11d48"></i></span><b>${x.n}</b></button>`; }).join('') || '<div class="small muted">No district known for these suspects</div>'}</div>` : '<div class="muted small">No suspect State / District yet – it comes from KYC / bank replies, accused details and JMIS requests (see Analytics › Target).</div>'}</div></div>
      <div class="grid g2"><div class="card"><div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">Smart Overview</h3><select id="trDim">${this.DIMS.map(([k, l]) => `<option value="${k}" ${st.dim === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="small muted" style="margin:4px 0 6px">Hover for numbers · click a bar to filter everything below.</div><div id="trBar"></div></div>
        <div class="card"><h3>📅 Month-Wise (${st.db === 'inc' ? 'Incident' : 'Reporting'} Date)${st.type ? ' – ' + esc(st.type) : ''}</h3><div id="trLine"></div><h3 style="margin-top:12px">⏱ Reporting Delay</h3><div id="trDl"></div></div></div>
      <div class="card"><div class="row" style="gap:8px;align-items:center"><h3 class="grow" style="margin:0">📋 Records <span class="badge">${fmtNum(F.length)}</span>${st.f ? ` <span class="chip">${esc((this.DIMS.find(d => d[0] === st.f.k) || [])[1] || '')}: ${esc(st.f.v)}</span>` : ''}${st.type ? ` <span class="chip">${esc(st.type)}</span>` : ''}</h3></div><div id="trT" style="margin-top:8px"></div></div>`;
    // overview bars
    const bars = st.dim === 'ident' ? [...groupBy(F.flatMap(r => r.ids.map(i => ({ ...i, r }))), i => i.t + ': ' + i.v)].map(([k, l]) => ({ label: k, value: uniq(l.map(x => x.r.ack || x.r.caseId)).length, sub: 'records with this ' + l[0].t, k: 'ident', v: l[0].v })).filter(x => x.value >= 1)
      : [...groupBy(F, r => this.key(r, st.dim) || '—')].map(([k, l]) => ({ label: st.dim === 'type' ? this.icon(k) + ' ' + k : k, value: l.length, sub: fmtINR(l.reduce((s, r) => s + r.amount, 0)) + ' · ' + uniq(l.map(r => r.ps).filter(Boolean)).slice(0, 3).join(', '), k: st.dim, v: k }));
    bars.sort((a, b) => st.dim === 'month' ? String(b.v).localeCompare(a.v) : b.value - a.value);
    Charts.hbar($('#trBar', el), bars, { max: 15, fmt: v => fmtNum(v) + ' records', onClick: d => { if (d.v === '—') return; if (st.dim === 'type') st.type = st.type === d.v ? '' : d.v; else st.f = st.f && st.f.v === d.v ? null : { k: d.k, v: d.v }; this.draw(el, A); } });
    const mm = [...groupBy(F.filter(r => dOf(r)), r => new Date(dOf(r)).toISOString().slice(0, 7))].sort((a, b) => a[0].localeCompare(b[0])).map(([k, l]) => ({ label: k, value: l.length }));
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
      { key: 'tg', label: 'Suspect State / District', sortVal: r => (r.tg[0] && r.tg[0].state[0]) || '', csv: r => uniq(r.tg.flatMap(t => t.state.map((s, i) => s + (t.district[i] ? ' / ' + t.district[i] : '')))).join('; '), render: r => `<span class="small">${esc(uniq(r.tg.flatMap(t => t.state)).slice(0, 2).join(', '))}${r.tg.length ? `<div class="muted">${esc(uniq(r.tg.flatMap(t => t.district)).slice(0, 2).join(', '))}</div>` : ''}</span>` },
      { key: 'ids', label: 'Identifiers', sortVal: r => r.ids.length, render: r => `<span class="small">${esc(r.ids.slice(0, 3).map(i => i.v).join(', '))}${r.ids.length > 3 ? ' +' + (r.ids.length - 3) : ''}</span>`, csv: r => r.ids.map(i => i.t + ': ' + i.v).join('; ') },
      { key: 'io', label: 'IO / EO', render: r => esc([r.io, r.eo && 'EO ' + r.eo].filter(Boolean).join(' · ')), csv: r => [r.io, r.eo].filter(Boolean).join(' / ') }] });
    const re = () => this.draw(el, A);
    $$('[data-tsrc]', el).forEach(b => b.onclick = () => { st.src = b.dataset.tsrc; re(); });
    $$('[data-tty]', el).forEach(b => { b.onclick = () => { st.type = st.type === b.dataset.tty ? '' : b.dataset.tty; re(); };
      const t = T.find(x => x.t === b.dataset.tty); b.title = `${t.t}: ${t.n} records${t.amt ? ' · ' + fmtINR(t.amt) : ''}\nLast 30 days ${t.a} · before that ${t.b}\nMonths ${months.map((m, i) => m.slice(5) + ':' + t.m[i]).join('  ')}\nTop: ${t.top.join(', ')}`; });
    $('#trDim', el).onchange = e => { st.dim = e.target.value; st.f = null; re(); };
    $('#trFrom', el).onchange = e => { st.from = e.target.value; re(); }; $('#trTo', el).onchange = e => { st.to = e.target.value; re(); };
    if ($('#trClr', el)) $('#trClr', el).onclick = () => { Object.assign(st, { src: '', type: '', f: null, from: '', to: '', win: '', dow: '', hr: '', sus: null }); re(); };
    const tipR = (b, L, t) => { b.onmouseenter = () => this.tip(b, L, t); b.onmouseleave = () => this.tip(null); };
    $$('[data-tdb]', el).forEach(b => b.onclick = () => { st.db = b.dataset.tdb; re(); });
    $$('[data-twin]', el).forEach(b => { const w = winB.find(x => x[0] === b.dataset.twin); tipR(b, w[3], '🕒 ' + w[1]); b.onclick = () => { st.win = st.win === b.dataset.twin ? '' : b.dataset.twin; this.tip(null); re(); }; });
    $$('[data-tdow]', el).forEach(b => { const i = +b.dataset.tdow; tipR(b, Id.filter(r => new Date(r.inc).getDay() === i), '📆 ' + this.DOW[i]); b.onclick = () => { st.dow = String(st.dow) === String(i) ? '' : String(i); this.tip(null); re(); }; });
    $$('[data-thr]', el).forEach(b => { const h = +b.dataset.thr; tipR(b, Ih.filter(r => new Date(r.inc).getHours() === h), '⏰ ' + String(h).padStart(2, '0') + ':00–' + String(h).padStart(2, '0') + ':59'); b.onclick = () => { st.hr = String(st.hr) === String(h) ? '' : String(h); this.tip(null); re(); }; });
    if ($('#trIncClr', el)) $('#trIncClr', el).onclick = () => { Object.assign(st, { win: '', dow: '', hr: '' }); re(); };
    $$('[data-tss]', el).forEach(b => { const x = SS.find(y => y.k === b.dataset.tss); if (!x) return; b.onmouseenter = () => Target.tip(b, x.t); b.onmouseleave = () => Target.tip(null); b.onclick = () => { st.sus = st.sus && st.sus.s === x.k && !st.sus.d ? null : { s: x.k }; Target.tip(null); re(); }; });
    $$('[data-tsd]', el).forEach(b => { const x = DS.find(y => y.k === b.dataset.tsd); if (!x) return; const [s0, d0] = x.k.split('|'); b.onmouseenter = () => Target.tip(b, x.t); b.onmouseleave = () => Target.tip(null); b.onclick = () => { st.sus = st.sus && st.sus.d === d0 ? { s: s0 } : { s: s0, d: d0 }; Target.tip(null); re(); }; });
    if ($('#trSusClr', el)) $('#trSusClr', el).onclick = () => { st.sus = null; re(); };
  }
};
Trend.tip = function (b, R, title) {
  let t = $('#trTip'); if (!b) { if (t) t.remove(); return; }
  if (!t) { t = document.createElement('div'); t.id = 'trTip'; t.className = 'jm-tip'; document.body.appendChild(t); }
  const L = R.slice().sort((a, b) => (b.inc || b.rep) - (a.inc || a.rep));
  t.innerHTML = `<b>${esc(title)} · ${R.length} record${R.length === 1 ? '' : 's'}</b>${L.length ? `<table>${L.slice(0, 8).map(r => `<tr><td>${esc(r.case || '')}</td><td>${this.icon(r.type)} ${esc(r.type)}</td><td>${esc(this.fdt(r.inc))}</td><td>${r.amount ? esc(fmtINR(r.amount)) : ''}</td></tr>`).join('')}</table>${L.length > 8 ? `<div class="small">+ ${L.length - 8} more – click to see all</div>` : '<div class="small">Click to filter</div>'}` : '<div class="small">Nothing here</div>'}`;
  const r = b.getBoundingClientRect(); t.style.left = Math.max(8, Math.min(innerWidth - 560, r.left)) + 'px'; t.style.top = (r.bottom + 6) + 'px';
};
addEventListener('scroll', () => Trend.tip(null), true);
Pages.trend = main => Trend.page(main);
