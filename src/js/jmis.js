/* jmis.js – JMIS Notice (MHA Samanvaya – Cybercrime Investigation Assistance Request, CIAR), under EO – Enquiry Officer.
   Requests Raised by us and Received from other States / agencies: count bubbles (Total, Completed, Under Processing,
   Pending) with live hover preview, click to list, full date & time of request / last action, time taken, links to cases.
   Office data – the same in every case, kept on this computer. Nothing goes online. */
'use strict';
const JMIS = {
  ST: { Pending: ['⏳', 'Pending', '#f97316'], 'Under Processing': ['⚙', 'Under Processing', '#2563eb'], Completed: ['✅', 'Completed', '#16a34a'] },
  DIR: { raised: ['📤', 'CIAR Request Raised', '#3b82f6', 'By us to other States / Agencies'], received: ['📥', 'CIAR Request Received', '#059669', 'From other States / Agencies to us'] },
  TYPES: ['Notice', 'Information / Data Request', 'Verification', 'Arrest / Search Assistance', 'Account Freeze / Lien', 'Blocking / Takedown', 'Victim / Witness Statement', 'Other'],
  AG: ['State Police', 'Central Agency'],
  STATES: ['Andaman & Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'CBI', 'NIA', 'ED', 'I4C', 'Other Central Agency'],
  OLD: 7,
  stateN(x) { x = String(x || '').trim(); if (!x) return ''; const h = this.STATES.find(s => s.toLowerCase() === x.toLowerCase().replace(/\band\b/g, '&')); return h || (/[a-z]/.test(x) ? x : x.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())); },
  st() { return this._s || (this._s = { dir: '', s: '', from: '', to: '', q: '', state: '', dist: '', sd: 'raised' }); },
  PD: 10, // pending up to 10 days = green, more = red
  pdays(r) { return r.status !== 'Completed' && r.reqAt && !isNaN(new Date(r.reqAt)) ? Math.max(0, Math.floor((Date.now() - new Date(r.reqAt)) / 864e5)) : null; },
  pchip(r) { const d = this.pdays(r); return d == null ? '' : `<span class="jm-pdy ${d > this.PD ? 'r' : 'g'}" title="${d > this.PD ? 'More than' : 'Up to'} ${this.PD} days since the request">⏳ ${d} day${d === 1 ? '' : 's'} pending</span>`; },
  stOf(r) { return (r.dir === 'raised' ? r.tState : r.fState) || '—'; },
  dsOf(r) { return (r.dir === 'raised' ? r.tDist : r.fDist) || '—'; },
  SL: { p10: 'Pending up to 10 days', p10x: 'Pending more than 10 days' },
  cd() { const v = parseInt(localStorage.getItem('sud-jmcd'), 10); return isNaN(v) ? '' : v; }, // your own delay days
  list() { return Off.get('jmis', []); },
  /* ---------- dates ---------- */
  dt(x) { if (!x) return ''; const d = new Date(x); if (isNaN(d)) return String(x); const p = n => String(n).padStart(2, '0'); let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${ap}`; },
  day(x) { if (!x) return ''; const d = new Date(x); return isNaN(d) ? String(x) : String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear(); },
  /* "13/11/2026 07:55:24 AM", "2026-11-13 07:55", Excel serial, Date → 'YYYY-MM-DDTHH:mm' */
  parse(v) {
    if (v == null || v === '') return ''; let d = null;
    if (v instanceof Date) d = v;
    else if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v).trim())) d = new Date(Math.round((+v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4);
    else { const s = String(v).replace(/^\s*(Request|Action)\s*Time\s*:?\s*/i, '').trim(); if (!s) return '';
      let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/);
      if (m) { let h = +(m[4] || 0); if (m[7]) h = h % 12 + (/p/i.test(m[7]) ? 12 : 0); d = new Date(+(m[3].length === 2 ? '20' + m[3] : m[3]), +m[2] - 1, +m[1], h, +(m[5] || 0)); }
      else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/))) d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
      else { d = new Date(s); } }
    if (!d || isNaN(d)) return ''; const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  },
  took(r) { if (!r.reqAt) return null; const a = new Date(r.reqAt), b = r.actAt && r.status !== 'Pending' ? new Date(r.actAt) : new Date(); const ms = b - a; return isNaN(ms) ? null : Math.max(0, ms); },
  dur(ms) { if (ms == null) return ''; const m = Math.round(ms / 6e4), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60; return d ? `${d} d ${h} h` : h ? `${h} h ${mm} min` : `${mm} min`; },
  running(r) { return r.status === 'Pending' || (r.status === 'Under Processing' && !r.actAt); },
  stN(s) { s = String(s || '').toLowerCase(); return /complet|clos|disposed|done|repl/.test(s) ? 'Completed' : /process|progress/.test(s) ? 'Under Processing' : 'Pending'; },
  old(r) { return r.status !== 'Completed' && r.reqAt && (Date.now() - new Date(r.reqAt)) / 864e5 >= this.OLD; },
  /* FIR No/Year → matching case in the tool */
  firKey(s) { const m = String(s || '').match(/(\d{1,5})\s*[\/\-]\s*(\d{4})/); return m ? +m[1] + '/' + m[2] : ''; },
  caseOf(r) { const k = this.firKey(r.fir); if (!k || typeof S === 'undefined' || !S.cases) return null; return S.cases.find(c => this.firKey((c.fir || '') + (/\/\d{4}/.test(c.fir || '') ? '' : '/' + (c.year || ''))) === k) || null; },
  inRange(r, st) { const d = (r.reqAt || '').slice(0, 10); return (!st.from || d >= st.from) && (!st.to || d <= st.to); },
  base(L, st) { const q = (st.q || '').toLowerCase(); return L.filter(r => this.inRange(r, st) && (!st.state || this.stOf(r) === st.state) && (!st.dist || this.dsOf(r) === st.dist) && (!q || [r.reqId, r.type, r.fir, r.status, r.fState, r.fDist, r.fPS, r.tState, r.tDist, r.tPS, r.sp, r.spMail, r.brief, r.det, r.resp].join(' ').toLowerCase().includes(q))); },
  pick(B, dir, s) { return B.filter(r => (!dir || r.dir === dir) && (!s || (s === 'old' ? this.old(r) : s === 'p10' ? r.status === 'Pending' && this.pdays(r) <= this.PD : s === 'p10x' ? r.status === 'Pending' && this.pdays(r) > this.PD : s === 'pcd' ? r.status === 'Pending' && this.pdays(r) > this.cd() : r.status === s))); },

  /* ---------- page ---------- */
  async page(el) {
    this.tip(null); const L = await this.list(), st = this.st(), B = this.base(L, st), META = await Off.get('jmisMeta', {});
    const bub = (dir, s, lbl, c) => { const n = this.pick(B, dir, s).length, on = st.dir === dir && st.s === s; return `<button class="jm-b ${on ? 'on' : ''}" data-jd="${dir}" data-js="${s}" style="--c:${c}"><b>${fmtNum(n)}</b><small>${lbl}</small></button>`; };
    const card = dir => { const [ic, t, c, sub] = this.DIR[dir], P = this.pick(B, dir, ''), avg = P.filter(r => r.status === 'Completed').map(r => this.took(r)).filter(x => x != null);
      return `<div class="jm-card" style="--c:${c}"><div class="jm-ch"><span class="jm-ic">${ic}</span><div><h3>${t}</h3><div class="small">${sub}</div></div></div>
        <div class="jm-bs">${bub(dir, '', 'Total Request', '#6366f1')}${bub(dir, 'Completed', 'Completed Request', '#16a34a')}${bub(dir, 'Under Processing', 'Under Processing Request', '#2563eb')}${bub(dir, 'Pending', 'Pending Request', '#f97316')}${bub(dir, 'old', `Open ${this.OLD}+ Days`, '#dc2626')}</div>
        ${(() => { const PP = this.pick(B, dir, 'Pending'); if (!PP.length) return ''; const g = this.pick(B, dir, 'p10').length, rr = this.pick(B, dir, 'p10x').length, mx = Math.max(...PP.map(r => this.pdays(r) || 0));
          const cd = this.cd(), cn = cd === '' ? 0 : this.pick(B, dir, 'pcd').length; this.SL.pcd = 'Pending more than ' + cd + ' days';
          return `<div class="jm-pd"><span>⏳ Pending Days</span><label class="jm-cdl" title="Type any number of days – see how many requests are pending longer than that"><span>Check Delay</span><input type="number" min="0" max="3650" class="jm-cd" value="${cd}" placeholder="Days" data-nov><span>Days</span></label>${cd === '' ? '' : `<button class="jm-pc c ${st.dir === dir && st.s === 'pcd' ? 'on' : ''}" data-jd="${dir}" data-js="pcd" data-tt="${this.SL.pcd}"><b>${fmtNum(cn)}</b> more than ${cd} days</button>`}<button class="jm-pc g ${st.dir === dir && st.s === 'p10' ? 'on' : ''}" data-jd="${dir}" data-js="p10" data-tt="${this.SL.p10}"><b>${fmtNum(g)}</b> up to ${this.PD} days</button><button class="jm-pc r ${st.dir === dir && st.s === 'p10x' ? 'on' : ''}" data-jd="${dir}" data-js="p10x" data-tt="${this.SL.p10x}"><b>${fmtNum(rr)}</b> more than ${this.PD} days</button><span class="small">Oldest: <b class="${mx > this.PD ? 'jm-red' : 'jm-grn'}">${mx} days</b></span></div>`; })()}
        <div class="jm-cf small">${P.length ? `Done: <b>${P.length ? Math.round(P.filter(r => r.status === 'Completed').length / P.length * 100) : 0}%</b>${avg.length ? ` · Average time to complete: <b>${this.dur(avg.reduce((a, b) => a + b, 0) / avg.length)}</b>` : ''}` : 'No request yet'}</div></div>`; };
    const SD = this.pick(B, st.sd, ''), sdOK = SD.length || !B.length ? st.sd : (st.sd = st.sd === 'raised' ? 'received' : 'raised'), SDR = this.pick(B, sdOK, '');
    const rows = this.pick(B, st.dir, st.s).sort((a, b) => String(b.reqAt).localeCompare(String(a.reqAt)));
    el.innerHTML = `<div class="card jm-top"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
        <label class="small">From Date<input type="date" id="jmF" value="${esc(st.from)}"></label><label class="small">To Date<input type="date" id="jmT" value="${esc(st.to)}"></label>
        <input id="jmQ" class="grow" placeholder="Find Request Id, FIR No., state, district, PS, SP, details…" value="${esc(st.q)}" data-nov>
        <button class="btn" id="jmClr" data-nov>✖ Clear</button><span class="grow"></span>
        ${META.fileDate ? `<span class="jm-fd" title="${esc(META.fileName || '')} – imported ${esc(this.dt(META.at))}">📅 CIAR File Download Date: <b>${esc(this.day(META.fileDate))}</b></span>` : ''}<button class="btn" id="jmImp" data-nov title="Excel / CSV of Request Details downloaded from Samanvaya (CIAR)">📥 Import CIAR Excel</button></div></div>
      <div class="jm-cards">${card('raised')}${card('received')}</div>
      ${B.length ? this.sdCard(SDR, st, sdOK) : ''}
      <div class="card" id="jmList"><h3>📋 Request Details <span class="badge">${fmtNum(rows.length)}</span> <span class="small muted">${st.dir ? this.DIR[st.dir][1] : 'Raised + Received'} › ${st.s === 'old' ? `Open ${this.OLD}+ Days` : this.SL[st.s] || st.s || 'All Status'}${st.state ? ' › ' + esc(st.state) : ''}${st.dist ? ' › ' + esc(st.dist) : ''}</span>${st.dir || st.s || st.state || st.dist ? ' <button class="btn sm" id="jmAll" data-nov>Show All</button>' : ''}</h3><div id="jmTb"></div></div>`;
    Table($('#jmTb', el), { rows, pageSize: 50, exportName: 'jmis_ciar_requests', noNd: true, onRow: r => this.edit(r, el), columns: [
      { key: 'reqId', label: 'Request Id / Type / Execution Date', sortVal: r => r.reqId, csv: r => [r.reqId, r.type, this.day(r.exec)].filter(Boolean).join(' | '), render: r => `<b class="mono">${esc(r.reqId || '—')}</b><div><span class="jm-ty">${esc(r.type || 'Notice')}</span></div>${r.exec ? `<div class="small muted">Executed ${esc(this.day(r.exec))}</div>` : ''}` },
      { key: 'dir', label: 'Raised / Received', render: r => `<span class="jm-dir" style="--c:${this.DIR[r.dir][2]}">${this.DIR[r.dir][0]} ${r.dir === 'raised' ? 'Raised' : 'Received'}</span>` },
      { key: 'fir', label: 'FIR No/Year / Request Status', sortVal: r => r.status, csv: r => [r.fir, r.status].filter(Boolean).join(' | '), render: r => { const c = this.caseOf(r), S0 = this.ST[r.status] || this.ST.Pending; return `${esc(r.fir || '—')}${c ? ` <button class="btn sm" data-jcase="${esc(c.id)}" title="Open this case in the tool">🔗 Case</button>` : ''}<div><span class="jm-s" style="--c:${S0[2]}">${S0[0]} ${S0[1]}</span></div>${this.pchip(r)}`; } },
      { key: 'from', label: 'Requesting State / District / PS', csv: r => [r.agency, r.fState, r.fDist, r.fPS].filter(Boolean).join(', '), render: r => `<b>${esc(r.fState || '')}</b>${r.agency ? ` <span class="small muted">(${esc(r.agency)})</span>` : ''}<div class="small">${esc([r.fDist, r.fPS].filter(Boolean).join(' · '))}</div>` },
      { key: 'sp', label: 'Supervising SP / DCP', csv: r => [r.sp, r.spMail, r.spPh].filter(Boolean).join(', '), render: r => `${esc(r.sp || '')}<div class="small muted">${esc([r.spMail, r.spPh].filter(Boolean).join(' · '))}</div>` },
      { key: 'brief', label: 'Brief of Request', render: r => `<div class="jm-tx">${esc(r.brief || '')}</div>` },
      { key: 'det', label: 'Request Details', render: r => `<div class="jm-tx">${esc(r.det || '')}</div>` },
      { key: 'to', label: 'Request for State / District / PS', csv: r => [r.tState, r.tDist, r.tPS].filter(Boolean).join(', '), render: r => `<b>${esc(r.tState || '')}</b><div class="small">${esc([r.tDist, r.tPS].filter(Boolean).join(' · '))}</div>` },
      { key: 'reqAt', label: 'Date Time of Request / Last Action', sortVal: r => r.reqAt || '', csv: r => 'Request: ' + this.dt(r.reqAt) + (r.actAt ? ' | Action: ' + this.dt(r.actAt) : ''), render: r => `<div class="jm-dt"><span>Request</span><b>${esc(this.dt(r.reqAt) || '—')}</b></div><div class="jm-dt"><span>Action</span><b>${esc(this.dt(r.actAt) || '—')}</b></div>` },
      { key: 'took', label: 'Time Taken on Request', sortVal: r => this.took(r) || 0, csv: r => this.dur(this.took(r)), render: r => { const t = this.took(r); return t == null ? '—' : `<b>${this.dur(t)}</b>${this.running(r) ? '<div class="small muted">still running</div>' : ''}`; } },
      { key: 'resp', label: 'Completed By / Response', csv: r => [r.compBy, r.compMob, r.resp].filter(Boolean).join(' | '), render: r => `${r.compBy ? `<b>${esc(r.compBy)}</b>${r.compMob ? `<div class="small">📞 ${esc(r.compMob)}</div>` : ''}` : ''}${r.endorse ? `<div class="small muted">SP/DCP Endorsed: ${esc(r.endorse)}</div>` : ''}<div class="jm-tx">${esc(r.resp || '')}</div>` },
      { key: 'act', label: 'Status', nosort: true, noexport: true, render: r => `<select class="jm-sel" data-jid="${esc(r.id)}" data-nov>${Object.keys(this.ST).map(k => `<option ${k === r.status ? 'selected' : ''}>${k}</option>`).join('')}</select>` }] });
    /* hover: live preview of the requests behind a bubble */
    $$('.jm-cd', el).forEach(i => { i.onclick = e => e.stopPropagation(); i.onchange = () => { const v = i.value.trim(); if (v === '' || isNaN(+v)) localStorage.removeItem('sud-jmcd'); else localStorage.setItem('sud-jmcd', String(Math.max(0, Math.round(+v)))); if (st.s === 'pcd') st.s = v === '' ? '' : 'pcd'; this.page(el); };
      i.onkeydown = e => { if (e.key === 'Enter') i.blur(); }; });
    $$('.jm-b, .jm-pc', el).forEach(b => { b.onmouseenter = e => this.tip(b, this.pick(B, b.dataset.jd, b.dataset.js)); b.onmouseleave = () => this.tip(null);
      b.onclick = () => { const same = st.dir === b.dataset.jd && st.s === b.dataset.js; Object.assign(st, same ? { dir: '', s: '' } : { dir: b.dataset.jd, s: b.dataset.js }); this.tip(null); this.page(el).then(() => { const x = $('#jmList', el); x && x.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }; });
    const toList = () => { const x = $('#jmList', el); x && x.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $$('[data-jst]', el).forEach(b => { b.onmouseenter = () => this.tip(b, SDR.filter(r => this.stOf(r) === b.dataset.jst), '🗺 ' + b.dataset.jst); b.onmouseleave = () => this.tip(null);
      b.onclick = () => { const on = st.state === b.dataset.jst && !st.dist; Object.assign(st, { state: on ? '' : b.dataset.jst, dist: '', dir: on ? '' : sdOK }); this.tip(null); this.page(el).then(() => on || toList()); }; });
    $$('[data-jds]', el).forEach(b => { const [s0, d0] = b.dataset.jds.split('|'); b.onmouseenter = () => this.tip(b, SDR.filter(r => this.stOf(r) === s0 && this.dsOf(r) === d0), '📍 ' + d0 + ', ' + s0); b.onmouseleave = () => this.tip(null);
      b.onclick = () => { const on = st.dist === d0 && st.state === s0; Object.assign(st, { state: on ? '' : s0, dist: on ? '' : d0, dir: on ? '' : sdOK }); this.tip(null); this.page(el).then(() => on || toList()); }; });
    $$('[data-jsd]', el).forEach(b => b.onclick = () => { st.sd = b.dataset.jsd; Object.assign(st, { state: '', dist: '' }); this.page(el); });
    $$('[data-jcase]', el).forEach(b => b.onclick = e => { e.stopPropagation(); switchCase(b.dataset.jcase); });
    $$('.jm-sel', el).forEach(s => { s.onclick = e => e.stopPropagation(); s.onchange = async () => { const L2 = await this.list(), r = L2.find(x => x.id === s.dataset.jid); if (!r) return; r.status = s.value; if (s.value !== 'Pending' && !r.actAt) r.actAt = this.parse(new Date()); await Off.put('jmis'); UI.toast('Status: ' + s.value); this.page(el); }; });
    $('#jmF', el).onchange = $('#jmT', el).onchange = () => { st.from = $('#jmF', el).value; st.to = $('#jmT', el).value; this.page(el); };
    let qt; $('#jmQ', el).oninput = () => { clearTimeout(qt); qt = setTimeout(() => { st.q = $('#jmQ', el).value; this.page(el).then(() => { const q = $('#jmQ', el); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }); }, 350); };
    $('#jmClr', el).onclick = () => { Object.assign(st, { dir: '', s: '', from: '', to: '', q: '', state: '', dist: '' }); this.page(el); };
    if ($('#jmAll', el)) $('#jmAll', el).onclick = () => { Object.assign(st, { dir: '', s: '', state: '', dist: '' }); this.page(el); };
    $('#jmImp', el).onclick = () => this.importPick(el);
  },
  /* State / District wise: ring of States, bars of Districts (our sent requests by default) */
  sdCard(R, st, dir) {
    const PAL = ['#6366f1', '#f97316', '#16a34a', '#0ea5e9', '#e11d48', '#a855f7', '#eab308', '#14b8a6', '#f43f5e', '#64748b'];
    const cnt = (L, f) => { const m = new Map(); L.forEach(r => { const k = f(r), o = m.get(k) || { t: 0, c: 0, p: 0, u: 0 }; o.t++; o[r.status === 'Completed' ? 'c' : r.status === 'Pending' ? 'p' : 'u']++; m.set(k, o); }); return [...m].sort((a, b) => b[1].t - a[1].t); };
    const SS = cnt(R, r => this.stOf(r)), top = SS.slice(0, 9), rest = SS.slice(9), tot = R.length || 1;
    let a0 = -Math.PI / 2; const C = 90, r1 = 80, r2 = 48;
    const arc = (v, col, key, n) => { const a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, p = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)].map(x => x.toFixed(2)).join(' ');
      const d = v >= tot ? `M ${C - r1} ${C} A ${r1} ${r1} 0 1 1 ${C + r1} ${C} A ${r1} ${r1} 0 1 1 ${C - r1} ${C} M ${C - r2} ${C} A ${r2} ${r2} 0 1 0 ${C + r2} ${C} A ${r2} ${r2} 0 1 0 ${C - r2} ${C} Z` : `M ${p(r1, a0)} A ${r1} ${r1} 0 ${big} 1 ${p(r1, a1)} L ${p(r2, a1)} A ${r2} ${r2} 0 ${big} 0 ${p(r2, a0)} Z`;
      a0 = a1; return `<path d="${d}" fill="${col}" class="jm-arc ${st.state === key ? 'on' : ''}" ${key ? `data-jst="${esc(key)}"` : ''} fill-rule="evenodd"><title>${esc(n)}</title></path>`; };
    const ring = top.map(([k, v], i) => arc(v.t, PAL[i], k, k + ': ' + v.t)).join('') + (rest.length ? arc(rest.reduce((s, [, v]) => s + v.t, 0), '#94a3b8', '', 'Others') : '');
    const DL = cnt(st.state ? R.filter(r => this.stOf(r) === st.state) : R, r => this.stOf(r) + '|' + this.dsOf(r)).slice(0, 15), mx = Math.max(1, ...DL.map(x => x[1].t));
    return `<div class="card jm-sd"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">🗺 State / District wise <span class="small muted">– point at a number for a live view, click for the full list</span></h3>
      <span class="pill-group"><button data-jsd="raised" class="${dir === 'raised' ? 'active' : ''}">📤 Our Notices Sent (Raised)</button><button data-jsd="received" class="${dir === 'received' ? 'active' : ''}">📥 Received</button></span></div>
      <div class="jm-sdg"><div class="jm-ring"><svg viewBox="0 0 180 180" width="190" height="190">${ring}<text x="90" y="86" text-anchor="middle" class="jm-rt">${fmtNum(R.length)}</text><text x="90" y="104" text-anchor="middle" class="jm-rs">${dir === 'raised' ? 'Sent' : 'Received'}</text></svg>
        <div class="jm-lg">${top.map(([k, v], i) => `<button class="jm-li ${st.state === k ? 'on' : ''}" data-jst="${esc(k)}"><i style="background:${PAL[i]}"></i><span>${esc(k)}</span><b>${v.t}</b>${v.p ? `<em>${v.p} pending</em>` : ''}</button>`).join('')}${rest.length ? `<div class="small muted">+ ${rest.length} more states</div>` : ''}</div></div>
        <div class="jm-bars"><div class="small" style="margin-bottom:4px"><b>📍 District wise${st.state ? ' – ' + esc(st.state) : ' (top 15)'}</b> · <span class="jm-k c">Completed</span> <span class="jm-k u">Under Processing</span> <span class="jm-k p">Pending</span></div>
        ${DL.map(([k, v]) => { const [s0, d0] = k.split('|'); return `<button class="jm-bar ${st.dist === d0 && st.state === s0 ? 'on' : ''}" data-jds="${esc(k)}"><span class="jm-bn">${esc(d0)}${st.state ? '' : `<small>${esc(s0)}</small>`}</span><span class="jm-bt" style="width:${v.t / mx * 100}%"><i class="c" style="flex:${v.c}"></i><i class="u" style="flex:${v.u}"></i><i class="p" style="flex:${v.p}"></i></span><b>${v.t}</b></button>`; }).join('') || '<div class="small muted">No district in these requests</div>'}</div></div></div>`;
  },
  tip(b, R, title) {
    let t = $('#jmTip'); if (!b) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement('div'); t.id = 'jmTip'; t.className = 'jm-tip'; document.body.appendChild(t); }
    const L = R.slice().sort((x, y) => String(y.reqAt).localeCompare(String(x.reqAt)));
    t.innerHTML = `<b>${esc(title || b.dataset.tt || (b.querySelector('small') || b).textContent)} · ${R.length}</b>${L.length ? `<table>${L.slice(0, 8).map(r => `<tr><td class="mono">${esc(r.reqId || '—')}</td><td>${esc(r.fir || '')}</td><td>${esc((r.dir === 'raised' ? r.tState : r.fState) || '')}</td><td>${esc(this.dt(r.reqAt))}</td><td style="color:${(this.ST[r.status] || this.ST.Pending)[2]}">${esc(r.status)}</td><td>${this.pdays(r) == null ? '' : `<span class="jm-pdy ${this.pdays(r) > this.PD ? 'r' : 'g'}">${this.pdays(r)} d</span>`}</td></tr>`).join('')}</table>${L.length > 8 ? `<div class="small">+ ${L.length - 8} more – click to see all</div>` : '<div class="small">Click to see the full list</div>'}` : '<div class="small">Nothing here</div>'}`;
    const r = b.getBoundingClientRect(); t.style.left = Math.max(8, Math.min(innerWidth - 520, r.left)) + 'px'; t.style.top = (r.bottom + 6) + 'px';
  },
  /* ---------- add / edit (fields as in the CIAR form) ---------- */
  async edit(r, el) {
    const L = await this.list(), isNew = !r; r = r ? { ...r } : { id: uid(), dir: 'raised', type: 'Notice', status: 'Pending', agency: 'State Police', fState: 'Uttar Pradesh', reqAt: this.parse(new Date()) };
    const dl = id => `<datalist id="${id}">${this.STATES.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
    const f = (k, l, t = 'text', x = '') => `<label>${l}<input id="jm_${k}" type="${t}" value="${esc(r[k] || '')}" ${x} data-nov></label>`;
    const sel = (k, l, O) => `<label>${l}<select id="jm_${k}" data-nov>${O.map(o => Array.isArray(o) ? o : [o, o]).map(([v, t]) => `<option value="${esc(v)}" ${v === r[k] ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    const ta = (k, l) => `<label class="jm-w">${l}<textarea id="jm_${k}" rows="3" data-nov>${esc(r[k] || '')}</textarea></label>`;
    const m = UI.modal((isNew ? '➕ Add' : '✏ Edit') + ' JMIS Notice / CIAR Request', `${dl('jmSt')}
      <div class="jm-sec">Request</div><div class="map-grid">${sel('dir', 'Raised / Received', [['raised', '📤 Raised by us'], ['received', '📥 Received from others']])}${f('reqId', 'Request Id')}${sel('type', 'Type of Request', [...new Set([...this.TYPES, r.type].filter(Boolean))])}${sel('status', 'Request Status', Object.keys(this.ST))}${f('fir', 'FIR No/Year or Req No', 'text', 'placeholder="e.g. 0167/2026"')}${f('exec', 'Execution Date', 'date')}${f('reqAt', 'Date &amp; Time of Request', 'datetime-local')}${f('actAt', 'Date &amp; Time of Last Action', 'datetime-local')}</div>
      <div class="jm-sec">Requesting (From)</div><div class="map-grid">${sel('agency', 'Request For Police / Central Agency', this.AG)}${f('fState', 'Requesting State / Central Agency', 'text', 'list="jmSt"')}${f('fDist', 'Requesting District')}${f('fPS', 'Requesting PS')}</div>
      <div class="jm-sec">Request For (To)</div><div class="map-grid">${f('tState', 'Request for State / UT', 'text', 'list="jmSt"')}${f('tDist', 'Request for District')}${f('tPS', 'Request for PS')}</div>
      <div class="jm-sec">Supervising SP / DCP</div><div class="map-grid">${f('sp', 'Name of Supervising SP / DCP')}${f('spMail', 'Official Email Id', 'email')}${f('spPh', 'Contact / Landline No.')}</div>
      <div class="jm-sec">Details</div><div class="map-grid">${ta('brief', 'Gist of FIR / Brief of Request')}${ta('det', 'Investigation Cooperation Request Details')}${ta('resp', 'Response / Remarks')}</div><div class="err" id="jmErr"></div>`,
      [...(isNew ? [] : [{ label: '🗑 Delete', cls: 'danger', onClick: async () => { if (!UI.confirm('Delete this request?')) return; L.splice(L.findIndex(x => x.id === r.id), 1); await Off.put('jmis'); UI.closeModal(); this.page(el); } }]),
        { label: 'Cancel', onClick: UI.closeModal }, { label: '💾 Save', cls: 'primary', onClick: async () => {
          for (const k of ['dir', 'reqId', 'type', 'status', 'fir', 'exec', 'reqAt', 'actAt', 'agency', 'fState', 'fDist', 'fPS', 'tState', 'tDist', 'tPS', 'sp', 'spMail', 'spPh', 'brief', 'det', 'resp']) r[k] = $('#jm_' + k, m).value.trim();
          const e = $('#jmErr', m);
          if (!r.reqAt) return e.textContent = 'Enter the Date & Time of Request';
          if (r.actAt && r.actAt < r.reqAt) return e.textContent = 'Last Action cannot be before the Request time';
          if (!r.brief && !r.det) return e.textContent = 'Enter the Gist / Brief or the Request Details';
          if (r.fir && !/^\s*\d{1,5}\s*\/\s*(19|20)\d\d\s*$/.test(r.fir) && !/req/i.test(r.fir) && !/^\d{6,}$/.test(r.fir)) return e.textContent = 'FIR No/Year like 0167/2026 (4-digit year)';
          if (r.reqId && L.some(x => x.id !== r.id && x.dir === r.dir && x.reqId === r.reqId)) return e.textContent = 'This Request Id is already in the list';
          r.fState = this.stateN(r.fState); r.tState = this.stateN(r.tState); r.at = new Date().toISOString(); const i = L.findIndex(x => x.id === r.id); i >= 0 ? (L[i] = r) : L.push(r); await Off.put('jmis'); UI.closeModal(); UI.toast('Saved – ' + (r.reqId || r.fir || 'request')); this.page(el); } }]);
  },
  /* ---------- import Samanvaya "Request Details" Excel / CSV ---------- */
  importPick(el) {
    const m = UI.modal('📥 Import CIAR Excel (Samanvaya)', `<p class="small">Download the CIAR Excel from Samanvaya (Excel icon) and pick it here. A sheet named <b>Request Sent</b> is taken as Raised and <b>Request Received</b> as Received; otherwise the choice below is used. Rows are matched by Request Id – old rows are updated, new rows are added. The file is read on this computer only.</p>
      <div class="map-grid"><label>These requests are<select id="jmD" data-nov><option value="raised">📤 Raised by us</option><option value="received">📥 Received from others</option></select></label><label>File (Excel / CSV)<input type="file" id="jmFile" accept=".xlsx,.xls,.csv,.ods"></label></div><div id="jmMsg" class="small"></div>`,
      [{ label: 'Close', onClick: UI.closeModal }, { label: '📥 Import', cls: 'primary', onClick: async () => { const f = $('#jmFile', m).files[0]; if (!f) return $('#jmMsg', m).textContent = 'Pick the Excel / CSV file first'; try { const n = await this.importFile(f, $('#jmD', m).value); UI.closeModal(); UI.toast(`📥 ${n.add} added · ${n.upd} updated`, 5000); this.page(el); } catch (e) { $('#jmMsg', m).textContent = '❌ ' + e.message; } } }]);
  },
  COLS: [['reqId', /request\s*id|req\.?\s*id/i], ['type', /type/i], ['exec', /execution/i], ['fir', /fir/i], ['status', /status/i], ['fState', /requesting\s*state|central\s*agency/i], ['fDist', /requesting\s*district/i], ['fPS', /requesting\s*ps/i],
    ['sp', /supervis|sp\s*\/?\s*dcp\s*name/i], ['spMail', /e-?mail/i], ['spPh', /contact|landline|phone/i], ['brief', /brief|gist/i], ['det', /request\s*details|cooperation/i], ['tState', /request\s*for\s*state/i], ['tDist', /request\s*for\s*district/i], ['tPS', /request\s*for\s*ps/i],
    ['reqAt', /request\s*time|date\s*time\s*of\s*request|request\s*date/i], ['actAt', /action\s*time|last\s*action/i], ['resp', /response|remark/i]],
  /* exact column names of the Samanvaya "CIAR Request" Excel download */
  SAM: { 'request id': 'reqId', 'request type': 'type', 'execution date': 'exec', 'state': 'fState', 'district': 'fDist', 'police station': 'fPS', 'fir no': 'fir', 'gist of fir': 'brief', 'request detail': 'det',
    'request for state': 'tState', 'request for district': 'tDist', 'requested for ps': 'tPS', 'request for ps': 'tPS', 'supervising sp/dcp name': 'sp', 'official no': 'spPh', 'official mail': 'spMail', 'endrosing by sp/dcp': 'endorse', 'endorsing by sp/dcp': 'endorse',
    'rinserted_on': 'reqAt', 'rcomp_of': 'compBy', 'rcomp_mob': 'compMob', 'ract_tak': 'actCode', 'rtimetaken': 'tookD', 'rtimetaken2': 'tookTxt', 'request status': 'status', 'status': 'status' },
  async importFile(f, dir0) {
    const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), { type: 'string', raw: true }) : XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: false });
    const L = await this.list(), idx = new Map(L.filter(x => x.reqId).map(x => [x.dir + '|' + x.reqId, x])); let add = 0, upd = 0, sheets = 0;
    for (const sn of wb.SheetNames) {
      const A = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true });
      const hi = A.findIndex(r => r.filter(c => /request|fir|status|state/i.test(String(c))).length >= 3); if (hi < 0) continue; sheets++;
      const dir = /sent|raised/i.test(sn) ? 'raised' : /receiv/i.test(sn) ? 'received' : dir0;
      const H = A[hi].map(h => String(h).trim()), map = {};
      H.forEach((h, i) => { const k = this.SAM[h.toLowerCase().replace(/\s+/g, ' ')]; if (k && !(k in map)) map[k] = i; });
      H.forEach((h, i) => { if (Object.values(map).includes(i)) return; const hit = this.COLS.find(([k, re]) => re.test(h) && !(k in map) && !(k === 'type' && /request\s*id/i.test(h) && !/type/i.test(h))); if (hit) map[hit[0]] = i; });
      for (const row of A.slice(hi + 1)) { if (!row.some(c => String(c).trim())) continue;
        const g = k => map[k] != null ? row[map[k]] : '', t = k => String(g(k) == null ? '' : g(k)).replace(/\s*View\s*Contact\s*/i, '').trim();
        const r = { dir, reqId: t('reqId'), type: t('type') || 'Notice', exec: this.parse(g('exec')).slice(0, 10), fir: t('fir'), agency: /cbi|nia|\bed\b|i4c|central/i.test(t('fState')) ? 'Central Agency' : 'State Police' };
        for (const k of ['fState', 'fDist', 'fPS', 'tState', 'tDist', 'tPS', 'sp', 'spMail', 'spPh', 'brief', 'det', 'resp', 'compBy', 'compMob', 'actCode', 'tookTxt']) r[k] = t(k);
        if (map.endorse != null) r.endorse = /true|yes|1/i.test(t('endorse')) ? 'Yes' : 'No';
        /* "Request Time : … Action Time : …" in one cell (screen copy) */
        const both = t('reqAt').match(/Request\s*Time\s*:?\s*(.*?)\s*(?:Action\s*Time\s*:?\s*(.*))?$/i);
        r.reqAt = this.parse(both ? both[1] : g('reqAt')); r.actAt = this.parse(both && both[2] ? both[2] : g('actAt'));
        const td = g('tookD'), tdN = typeof td === 'number' ? td : /^\d+(\.\d+)?$/.test(String(td).trim()) ? +td : null;
        if (!r.actAt && r.reqAt && tdN != null) r.actAt = this.parse(new Date(new Date(r.reqAt).getTime() + tdN * 864e5));
        if (/\s(PENDING|COMPLETED|UNDER PROCESSING)\s*$/i.test(r.fir)) { if (map.status == null) r.status = this.stN(r.fir); r.fir = r.fir.replace(/\s(PENDING|COMPLETED|UNDER PROCESSING)\s*$/i, ''); }
        /* status: from a status column, else from the Samanvaya fields – completed by an officer = Completed, some action time = Under Processing, nothing yet = Pending */
        if (map.status != null && t('status')) r.status = this.stN(t('status')); else if (!r.status) r.status = r.compBy || r.actCode ? 'Completed' : (tdN != null || r.actAt) ? 'Under Processing' : 'Pending';
        if (!r.reqId && !r.fir && !r.brief) continue; r.fState = this.stateN(r.fState); r.tState = this.stateN(r.tState);
        const o = r.reqId && idx.get(dir + '|' + r.reqId);
        if (o) { Object.keys(r).forEach(k => { if (r[k] !== '' && r[k] != null) o[k] = r[k]; }); o.at = new Date().toISOString(); upd++; }
        else { const x = Object.assign({ id: uid(), at: new Date().toISOString() }, r); L.push(x); if (r.reqId) idx.set(dir + '|' + r.reqId, x); add++; } }
    }
    if (!sheets) throw new Error('Could not find the Request Details header row in this file');
    if (!add && !upd) throw new Error('No request rows found under the header');
    await Off.put('jmis');
    const fm = String(f.name || '').match(/(\d{1,2})[_\-.](\d{1,2})[_\-.]((?:19|20)\d\d)/), M = await Off.get('jmisMeta', {}), p = n => String(n).padStart(2, '0');
    M.fileDate = fm ? `${fm[3]}-${p(fm[2])}-${p(fm[1])}` : f.lastModified ? new Date(f.lastModified).toISOString().slice(0, 10) : ''; M.fileName = f.name || ''; M.at = this.parse(new Date()); Off.D.jmisMeta = M; await Off.put('jmisMeta');
    return { add, upd };
  }
};

PAGE_META.jmis = { group: 'Investigation', title: 'JMIS Notice', desc: 'MHA Samanvaya CIAR requests – Raised by us and Received from other States / agencies: counts, live preview, full date & time of request and last action, time taken, and the matching case.', order: ['jmis'], names: { jmis: '📨 JMIS Notice (CIAR)' } };
Pages.jmis = main => { const { body } = tabs(main, 'jmis', [['jmis', '📨 JMIS Notice (CIAR)']], 'JMIS Notice'); JMIS.page(body); };
addEventListener('scroll', () => JMIS.tip(null), true);
