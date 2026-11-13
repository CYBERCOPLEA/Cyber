/* daily.js – Office Work › Daily Crime: everything that came in on one day (today by default) across the whole tool –
   NCRP complaints, FIRs, Master Crime Data entries, EO enquiries, JMIS requests and letters sent – with a 7-day line. */
'use strict';
const Daily = {
  st() { return this._s || (this._s = { d: '', k: '' }); },
  ymd(t) { if (!t) return ''; const d = new Date(t); if (isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; },
  dmy(s) { return s ? s.split('-').reverse().join('-') : ''; },
  hm(t) { const d = new Date(t); if (isNaN(d) || !(d.getHours() || d.getMinutes())) return ''; return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); },
  K: [['ncrp', '🧾', 'NCRP Complaints', '#f97316'], ['fir', '📁', 'FIR / Cases', '#2563eb'], ['crime', '🗃', 'Master Crime Data Entries', '#ef4444'], ['eo', '🕵', 'EO Enquiries', '#0891b2'], ['jmis', '📨', 'JMIS Requests', '#7c3aed'], ['letters', '📒', 'Letters Sent', '#b45309']],
  /* every dated item in the tool → { k, day, t, title, sub, amount } */
  async all(force) {
    if (this._d && !force && Date.now() - this._t < 60000) return this._d;
    const R = [];
    try { for (const r of await Trend.collect(force)) { if (r.src === 'EO') continue; const t = r.rep || r.inc; if (!t) continue;
      R.push({ k: r.src === 'NCRP' ? 'ncrp' : 'fir', t, title: (r.src === 'NCRP' ? 'Ack ' + (r.ack || '') : r.case || '') + (r.fir ? ' · FIR ' + r.fir : ''), sub: [Trend.icon(r.type) + ' ' + r.type, r.district, r.ps].filter(Boolean).join(' · '), amount: r.amount || 0, caseId: r.caseId, case: r.case, type: r.type }); } } catch (e) { }
    try { for (const r of await Off.get('crime', [])) if (r.added && !r.auto) R.push({ k: 'crime', t: new Date(r.added).getTime(), title: (Off.ct(r.type)[2] || '') + ' ' + r.value, sub: [Off.ct(r.type)[1], r.name, r.case, r.source].filter(Boolean).join(' · '), amount: +r.amount || 0 }); } catch (e) { }
    try { for (const e of await EO.list()) { const t = Trend.ts(e.recv); if (t) R.push({ k: 'eo', t, title: 'SR ' + (e.sr || '') + ' · ' + EO.caseNo(e), sub: [e.victim, String(e.brief || '').slice(0, 80), e.status].filter(Boolean).join(' · '), amount: +e.amount || 0 }); } } catch (e) { }
    try { for (const r of await JMIS.list()) { const t = r.reqAt && new Date(r.reqAt).getTime(); if (t) R.push({ k: 'jmis', t, title: (r.reqId || '') + (r.fir ? ' · FIR ' + r.fir : ''), sub: [r.dir === 'raised' ? '📤 Raised to ' + (r.tState || '') : '📥 Received from ' + (r.fState || ''), r.status].filter(Boolean).join(' · '), amount: 0 }); } } catch (e) { }
    try { for (const x of await Letters.list()) R.push({ k: 'letters', t: new Date(x.at).getTime(), title: x.subject || x.title || 'Letter', sub: [x.role, x.case, x.to && '→ ' + x.to].filter(Boolean).join(' · '), amount: 0 }); } catch (e) { }
    R.forEach(r => r.day = this.ymd(r.t)); this._t = Date.now(); return (this._d = R);
  },
  async page(el) {
    const st = this.st(); if (!st.d) st.d = this.ymd(Date.now());
    el.innerHTML = '<div class="card muted">Reading the whole tool…</div>';
    const A = await this.all(), D = A.filter(r => r.day === st.d), L = st.k ? D.filter(r => r.k === st.k) : D;
    const days = [...Array(7)].map((_, i) => { const d = new Date(st.d + 'T12:00'); d.setDate(d.getDate() - 6 + i); return this.ymd(d); });
    const wk = days.map(d => ({ d, n: A.filter(r => r.day === d).length })), mx = Math.max(1, ...wk.map(x => x.n)), amt = D.reduce((s, r) => s + (r.k === 'ncrp' || r.k === 'fir' || r.k === 'eo' ? r.amount : 0), 0);
    const shift = n => { const d = new Date(st.d + 'T12:00'); d.setDate(d.getDate() + n); st.d = this.ymd(d); st.k = ''; this.page(el); };
    el.innerHTML = `<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">📅 Daily Crime – ${esc(this.dmy(st.d))} <span class="small muted">${new Date(st.d + 'T12:00').toLocaleDateString('en-IN', { weekday: 'long' })}</span></h3>
        <button class="btn" id="dyP">◀ Previous Day</button><input type="date" id="dyD" value="${esc(st.d)}"><button class="btn" id="dyN">Next Day ▶</button><button class="btn" id="dyT">Today</button><button class="btn primary" id="dyR" title="Daily crime report of this day – preview, then Print / PDF / Word / Excel">📄 Daily Report</button></div>
      <div class="lr-ks" style="margin-top:12px"><button class="lr-k ${!st.k ? 'on' : ''}" data-dk="" style="--c:#6366f1"><span>📊</span><b>${fmtNum(D.length)}</b><small>All Entries Of The Day</small></button>${this.K.map(([k, ic, l, c]) => `<button class="lr-k ${st.k === k ? 'on' : ''}" data-dk="${k}" style="--c:${c}"><span>${ic}</span><b>${fmtNum(D.filter(r => r.k === k).length)}</b><small>${l}</small></button>`).join('')}<div class="lr-k" style="--c:#16a34a;cursor:default"><span>₹</span><b style="font-size:18px">${fmtINR(amt)}</b><small>Fraud Amount Reported</small></div></div>
      <div class="small" style="margin:12px 0 4px"><b>Last 7 Days</b> – click a day</div><div class="tr-cols dy-wk">${wk.map(x => `<button class="tr-col ${x.d === st.d ? 'on' : ''}" data-dd="${x.d}"><span class="tr-cb"><i style="height:${x.n / mx * 100}%"></i></span><b>${x.n}</b><small>${esc(this.dmy(x.d).slice(0, 5))}</small></button>`).join('')}</div></div>
      <div class="card"><h3>📋 ${st.k ? esc(this.K.find(x => x[0] === st.k)[2]) : 'All Entries'} <span class="badge">${fmtNum(L.length)}</span></h3><div id="dyTb"></div></div>`;
    Table($('#dyTb', el), { rows: L, pageSize: 50, exportName: 'daily_crime_' + st.d, sortKey: 't', sortDir: -1, onRow: r => { if (r.caseId && r.caseId !== S.caseId) switchCase(r.caseId); }, columns: [
      { key: 'k', label: 'Type', csv: r => this.K.find(x => x[0] === r.k)[2], render: r => { const x = this.K.find(y => y[0] === r.k); return `<span class="tg-sp" style="--c:${x[3]}">${x[1]} ${esc(x[2])}</span>`; } },
      { key: 't', label: 'Time', sortVal: r => r.t, csv: r => this.hm(r.t), render: r => esc(this.hm(r.t) || '—') },
      { key: 'title', label: 'Entry', render: r => `<b>${esc(r.title)}</b>` }, { key: 'sub', label: 'Details', render: r => `<span class="small">${esc(r.sub)}</span>` },
      { key: 'amount', label: 'Amount', num: true, render: r => r.amount ? fmtINR(r.amount) : '' }] });
    $$('[data-dk]', el).forEach(b => { b.onclick = () => { st.k = b.dataset.dk; this.page(el); }; b.onmouseenter = () => this.tip(b, b.dataset.dk ? D.filter(r => r.k === b.dataset.dk) : D); b.onmouseleave = () => this.tip(null); });
    $$('[data-dd]', el).forEach(b => { b.onclick = () => { st.d = b.dataset.dd; st.k = ''; this.tip(null); this.page(el); }; b.onmouseenter = () => this.tip(b, A.filter(r => r.day === b.dataset.dd), this.dmy(b.dataset.dd)); b.onmouseleave = () => this.tip(null); });
    $('#dyP', el).onclick = () => shift(-1); $('#dyN', el).onclick = () => shift(1); $('#dyT', el).onclick = () => { st.d = this.ymd(Date.now()); st.k = ''; this.page(el); };
    $('#dyD', el).onchange = e => { if (e.target.value) { st.d = e.target.value; st.k = ''; this.page(el); } };
    $('#dyR', el).onclick = () => this.report(st.d, D, amt);
  },
  tip(b, R, title) {
    let t = $('#dyTip'); if (!b) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement('div'); t.id = 'dyTip'; t.className = 'jm-tip'; document.body.appendChild(t); }
    t.innerHTML = `<b>${esc(title || b.querySelector('small').textContent)} · ${R.length}</b>${R.length ? `<table>${R.slice(0, 8).map(r => `<tr><td>${this.K.find(x => x[0] === r.k)[1]}</td><td>${esc(this.hm(r.t))}</td><td>${esc(r.title.slice(0, 60))}</td><td>${r.amount ? esc(fmtINR(r.amount)) : ''}</td></tr>`).join('')}</table>${R.length > 8 ? `<div class="small">+ ${R.length - 8} more – click to see all</div>` : '<div class="small">Click to see the list</div>'}` : '<div class="small">Nothing on this day</div>'}`;
    const r = b.getBoundingClientRect(); t.style.left = Math.max(8, Math.min(innerWidth - 560, r.left)) + 'px'; t.style.top = (r.bottom + 6) + 'px';
  },
  report(d, D, amt) {
    const sec = this.K.map(([k, ic, l]) => { const L = D.filter(r => r.k === k).sort((a, b) => a.t - b.t); return `<h3>${ic} ${esc(l)} (${L.length})</h3>${L.length ? `<table><tr><th>S.No.</th><th>Time</th><th>Entry</th><th>Details</th><th>Amount</th></tr>${L.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(this.hm(r.t))}</td><td>${esc(r.title)}</td><td>${esc(r.sub)}</td><td>${r.amount ? esc(fmtINR(r.amount)) : ''}</td></tr>`).join('')}</table>` : '<p>Nil</p>'}`; }).join('');
    ExportAll.open('Daily Crime Report – ' + this.dmy(d), `<table><tr>${this.K.map(x => `<th>${esc(x[2])}</th>`).join('')}<th>Fraud Amount</th></tr><tr>${this.K.map(x => `<td><b>${D.filter(r => r.k === x[0]).length}</b></td>`).join('')}<td><b>${esc(fmtINR(amt))}</b></td></tr></table>${sec}`);
  }
};
addEventListener('scroll', () => Daily.tip(null), true);
