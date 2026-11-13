/* eo.js – Enquiry Officer (EO): enquiries on FIR / NCRP (without FIR) / complaints, their status
   (FIR lodged, closed, pending), an at-a-glance ring and an enquiry report (HTML / PDF / Word / Excel / Image)
   with the office header, logo, EO name and font controls. Office data – the same in every case, kept on this computer. */
'use strict';
const EO = {
  TYPES: { FIR: ['📁', 'FIR', '#0891b2'], NCRP: ['🧾', 'NCRP (Without FIR)', '#d97706'], COMP: ['📝', 'Complaint (COMP)', '#7c3aed'] },
  ST: { Pending: ['⏳', 'Pending', '#f97316'], FIR: ['📁', 'FIR Lodged', '#2563eb'], Close: ['✅', 'Closed', '#16a34a'] },
  HI: 499000,
  st() { return this._s || (this._s = { f: '', t: '', q: '' }); },
  list() { return Off.get('eo', []); },
  cfg() { return Off.get('eocfg', { eo: '', desig: '', mobile: '', title: 'Enquiry Report' }); },
  days(r) { if (!r.recv) return ''; const b = r.status === 'Pending' ? today() : (r.sent || today()); return Math.max(0, Math.round((new Date(b) - new Date(r.recv)) / 864e5)); },
  dmy: d => d ? String(d).slice(0, 10).split('-').reverse().join('-') : '',
  inr: n => +n ? fmtINR(+n) : '',
  caseNo: r => [r.no, r.year].filter(Boolean).join('/'),
  firTxt(r) { const f = r.fir || {}; return [f.no && 'FIR ' + f.no, f.ps && 'PS ' + f.ps, f.district, f.date && this.dmy(f.date), f.io && 'IO ' + f.io].filter(Boolean).join(' · '); },
  stTxt(r) { return r.status === 'FIR' ? 'FIR Lodged' + (this.firTxt(r) ? ' – ' + this.firTxt(r) : '') : r.status === 'Close' ? 'Closed' : 'Pending'; },
  match(r, f) { return !f || (f === 'old' ? r.status === 'Pending' && this.days(r) >= 30 : f === 'hi' ? +r.amount > this.HI : f === 'all' ? true : r.status === f); },

  async page(el) {
    this.tip(null);
    const L = await this.list(), C = await this.cfg(), st = this.st(), q = st.q.toLowerCase();
    const rows = L.filter(r => this.match(r, st.f) && (!st.t || r.type === st.t) && (!q || [r.sr, r.no, r.year, r.victim, r.mobile, r.brief, r.notes, this.firTxt(r)].join(' ').toLowerCase().includes(q)));
    const n = k => L.filter(r => this.match(r, k)).length, amt = L.reduce((s, r) => s + (+r.amount || 0), 0);
    const kp = [['all', '🗂', 'All Enquiries', L.length, '#6366f1'], ['Pending', '⏳', 'Pending', n('Pending'), '#f97316'], ['old', '🔴', 'Pending 30+ Days', n('old'), '#dc2626'], ['FIR', '📁', 'FIR Lodged', n('FIR'), '#2563eb'], ['Close', '✅', 'Closed', n('Close'), '#16a34a'], ['hi', '💰', 'Above ₹4,99,000', n('hi'), '#be123c']];
    // ring: status share
    const R = 52, CIR = 2 * Math.PI * R; let off = 0;
    const segs = ['Pending', 'FIR', 'Close'].map(k => { const v = n(k), len = L.length ? v / L.length * CIR : 0, s = `<circle class="eo-seg" data-eof="${k}" r="${R}" cx="70" cy="70" fill="none" stroke="${this.ST[k][2]}" stroke-width="20" stroke-dasharray="${len} ${CIR - len}" stroke-dashoffset="${-off}"/>`; off += len; return v ? s : ''; }).join('');
    const tmax = Math.max(1, ...Object.keys(this.TYPES).map(t => L.filter(r => r.type === t).length));
    el.innerHTML = `<div class="card eo-hero"><div class="eo-ringbox"><svg viewBox="0 0 140 140" class="eo-ring"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--border)" stroke-width="20"/><g transform="rotate(-90 70 70)">${segs}</g><text x="70" y="68" text-anchor="middle" class="eo-rn">${fmtNum(L.length)}</text><text x="70" y="86" text-anchor="middle" class="eo-rl">Enquiries</text></svg>
        <div class="eo-leg">${['Pending', 'FIR', 'Close'].map(k => `<button data-eof="${k}" style="--c:${this.ST[k][2]}"><i></i>${this.ST[k][1]} <b>${n(k)}</b><small>${L.length ? Math.round(n(k) / L.length * 100) : 0}%</small></button>`).join('')}</div></div>
      <div class="eo-mid"><div class="ag-k eo-k">${kp.map(([k, i, t, v, c]) => `<button class="ag-kb ${(st.f || 'all') === k ? 'on' : ''}" data-eof="${k}" style="--c:${c}"><span>${i}</span><b>${fmtNum(v)}</b><small>${t}</small></button>`).join('')}</div>
        <div class="eo-types">${Object.entries(this.TYPES).map(([k, [i, t, c]]) => { const v = L.filter(r => r.type === k).length; return `<button class="eo-tb ${st.t === k ? 'on' : ''}" data-eot="${k}" style="--c:${c}"><span>${i} ${t}</span><span class="eo-bar"><i style="width:${v / tmax * 100}%"></i></span><b>${v}</b></button>`; }).join('')}<div class="small muted">Total fraud amount: <b>${fmtINR(amt)}</b> · Click any ring part, box or bar to filter the list.</div></div></div></div>
      <div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">🕵 Enquiries <span class="badge">${fmtNum(rows.length)}</span>${st.f || st.t ? ' <button class="btn sm" id="eoClr">✖ Clear Filter</button>' : ''}</h3>
        <span class="eo-who" id="eoWho" title="Enquiry Officer – shown on the report">👮 EO: <b>${esc(C.eo || 'Set Name')}</b>${C.desig ? ' · ' + esc(C.desig) : ''} ✏</span>
        <input id="eoQ" placeholder="Find No., victim, mobile, FIR, PS…" value="${esc(st.q)}" style="max-width:260px"><button class="btn primary" id="eoAdd">➕ Add Enquiry</button><button class="btn" id="eoRep">📄 Enquiry Report</button></div>
        <div id="eoT" style="margin-top:10px"></div></div>`;
    Table($('#eoT', el), { rows, pageSize: 25, sortKey: 'sr', sortDir: -1, exportName: 'enquiries', onRow: r => this.edit(r, el), columns: [
      { key: 'sr', label: 'SR', num: true, sortVal: r => +r.sr || 0 },
      { key: 'type', label: 'Type', render: r => { const t = this.TYPES[r.type] || this.TYPES.COMP; return `<span class="eo-ty" style="--c:${t[2]}">${t[0]} ${esc(r.type === 'NCRP' ? 'NCRP' : r.type || 'COMP')}</span>`; } },
      { key: 'no', label: 'Case / Complaint No.', render: r => `<b>${esc(this.caseNo(r))}</b>`, csv: r => this.caseNo(r) },
      { key: 'victim', label: 'Victim', render: r => `<b>${esc(r.victim || '')}</b>${r.mobile ? `<div class="small muted">📞 ${esc(r.mobile)}</div>` : ''}` },
      { key: 'amount', label: 'Fraud Amount', num: true, sortVal: r => +r.amount || 0, render: r => +r.amount ? `<b class="${+r.amount > this.HI ? 'eo-hi' : ''}">${fmtINR(+r.amount)}</b>` : '' },
      { key: 'brief', label: 'Short Details', render: r => `<span class="small">${esc(String(r.brief || '').slice(0, 140))}</span>` },
      { key: 'recv', label: 'Received', render: r => esc(this.dmy(r.recv)) },
      { key: 'sent', label: 'Report Sent / Closed', render: r => esc(this.dmy(r.sent)) },
      { key: 'days', label: 'Days', num: true, sortVal: r => this.days(r) === '' ? -1 : this.days(r), render: r => { const d = this.days(r); return d === '' ? '' : `<b class="${r.status === 'Pending' && d >= 30 ? 'bad-t' : ''}">${d}</b>`; } },
      { key: 'status', label: 'Status', csv: r => this.stTxt(r), render: r => { const s = this.ST[r.status] || this.ST.Pending; return `<span class="eo-st" style="--c:${s[2]}">${s[0]} ${s[1]}</span>${r.status === 'FIR' && this.firTxt(r) ? `<div class="small muted">${esc(this.firTxt(r))}</div>` : ''}`; } },
      { key: 'notes', label: 'Closing Notes', render: r => `<span class="small">${esc(String(r.notes || '').slice(0, 120))}</span>` },
      { key: 'act', label: 'Edit / Remove', nosort: true, noexport: true, render: r => `<span class="eo-act"><button class="btn sm" data-eoe="${esc(r.id)}" title="Edit this enquiry">✏️</button><button class="btn sm danger" data-eod="${esc(r.id)}" title="Remove this enquiry">🗑</button></span>` }] });
    $('#eoT', el).addEventListener('click', async e => { const b = e.target.closest('[data-eoe],[data-eod]'); if (!b) return; e.stopPropagation(); e.preventDefault();
      const all = await this.list(), r = all.find(y => y.id === (b.dataset.eoe || b.dataset.eod)); if (!r) return;
      if (b.dataset.eoe) return this.edit(r, el);
      if (!UI.confirm(`Remove enquiry SR ${r.sr || ''} – ${this.caseNo(r)}${r.victim ? ' – ' + r.victim : ''}?`)) return;
      all.splice(all.indexOf(r), 1); await Off.put('eo'); UI.toast('🗑 Enquiry removed'); this.page(el); }, true);
    const re = () => this.page(el);
    $$('[data-eof]', el).forEach(b => { b.onclick = () => { st.f = b.dataset.eof === 'all' ? '' : b.dataset.eof; re(); };
      b.onmouseenter = () => this.tip(b, L.filter(r => this.match(r, b.dataset.eof === 'all' ? '' : b.dataset.eof))); b.onmouseleave = () => this.tip(null); });
    $$('[data-eot]', el).forEach(b => { b.onclick = () => { st.t = st.t === b.dataset.eot ? '' : b.dataset.eot; re(); };
      b.onmouseenter = () => this.tip(b, L.filter(r => r.type === b.dataset.eot)); b.onmouseleave = () => this.tip(null); });
    if ($('#eoClr', el)) $('#eoClr', el).onclick = () => { st.f = ''; st.t = ''; re(); };
    const qi = $('#eoQ', el); qi.oninput = () => { st.q = qi.value; clearTimeout(this._qt); this._qt = setTimeout(async () => { const p = qi.selectionStart; await re(); const n2 = $('#eoQ', el); if (n2) { n2.focus(); n2.setSelectionRange(p, p); } }, 250); };
    $('#eoAdd', el).onclick = () => this.edit(null, el);
    $('#eoRep', el).onclick = () => this.report(rows, el);
    $('#eoWho', el).onclick = () => this.who(el);
  },
  tip(el, list) {
    let t = $('#agTip'); if (!el) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement('div'); t.id = 'agTip'; t.className = 'ag-tip'; document.body.appendChild(t); }
    t.innerHTML = `<b>${list.length} enquir${list.length === 1 ? 'y' : 'ies'}</b>${list.slice(0, 8).map(r => `<div>${(this.ST[r.status] || this.ST.Pending)[0]} ${esc(r.type || '')} ${esc(this.caseNo(r))} · ${esc(r.victim || '')}${+r.amount ? ` · <span class="${+r.amount > this.HI ? 'eo-hi' : ''}">${fmtINR(+r.amount)}</span>` : ''}${r.status === 'Pending' && this.days(r) !== '' ? ` <i>${this.days(r)} d</i>` : ''}</div>`).join('')}${list.length > 8 ? `<div class="muted">+ ${list.length - 8} more – click</div>` : ''}`;
    const r = el.getBoundingClientRect(); t.style.left = Math.min(innerWidth - 440, Math.max(8, r.left)) + 'px'; t.style.top = (r.bottom + 6 + 240 > innerHeight ? Math.max(8, r.top - 6 - t.offsetHeight) : r.bottom + 6) + 'px';
  },
  async who(el) {
    const C = await this.cfg();
    const m = UI.modal('👮 Enquiry Officer', `<div class="map-grid"><label>EO Name<input id="ewN" value="${esc(C.eo || '')}"></label><label>Designation<input id="ewD" value="${esc(C.desig || '')}" placeholder="Sub-Inspector / Inspector…"></label><label>Mobile<input id="ewM" value="${esc(C.mobile || '')}"></label></div>`,
      [{ label: 'Cancel', onClick: UI.closeModal }, { label: 'Save', cls: 'primary', onClick: async () => { Object.assign(C, { eo: $('#ewN', m).value.trim(), desig: $('#ewD', m).value.trim(), mobile: $('#ewM', m).value.trim() }); await Off.put('eocfg'); UI.closeModal(); this.page(el); } }]);
  },
  async edit(r, el) {
    const L = await this.list(), x = r ? JSON.parse(JSON.stringify(r)) : { sr: String(Math.max(0, ...L.map(y => +y.sr || 0)) + 1), type: 'NCRP', year: String(new Date().getFullYear()), recv: today(), status: 'Pending', fir: {} };
    x.fir = x.fir || {};
    const f = (id, lbl, v, t = 'text', ex = '') => `<label>${lbl}<input id="${id}" type="${t}" value="${esc(v || '')}" ${ex}></label>`;
    const m = UI.modal(r ? '🕵 Enquiry ' + (r.sr ? 'SR ' + r.sr : '') : '➕ Add Enquiry', `<div class="map-grid eo-form">
      ${f('eSr', 'SR No.', x.sr)}<label>Type<select id="eTy">${Object.entries(this.TYPES).map(([k, v]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></label>
      ${f('eNo', 'Case / Complaint No.', x.no, 'text', 'placeholder="FIR No. / NCRP Ack No. / Complaint No."')}${f('eYr', 'Year', x.year)}
      ${f('eVi', 'Victim Name', x.victim)}${f('eMo', 'Victim Mobile', x.mobile, 'tel')}
      <label>Fraud Amount (₹)<input id="eAm" type="number" min="0" value="${esc(x.amount || '')}"><small id="eAmW" class="eo-hi" style="display:none">Above ₹4,99,000</small></label>${f('eRc', 'Complaint Received Date', x.recv, 'date')}
      <label class="eo-wide">Short Details<textarea id="eBr" rows="3">${esc(x.brief || '')}</textarea></label>
      <label>Status<select id="eSt">${Object.entries(this.ST).map(([k, v]) => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></label>${f('eSe', 'Report Sent / Close Date', x.sent, 'date')}
      <div class="eo-wide eo-firbox" id="eFir"><b>📁 FIR Lodged – Details</b><div class="map-grid">${f('eFn', 'FIR No.', x.fir.no)}${f('eFp', 'Police Station', x.fir.ps)}${f('eFd', 'District', x.fir.district)}${f('eFt', 'FIR Date', x.fir.date, 'date')}${f('eFi', 'IO Name', x.fir.io)}</div></div>
      <label class="eo-wide">Closing Notes<textarea id="eNt" rows="3">${esc(x.notes || '')}</textarea></label></div>`,
      [...(r ? [{ label: '🗑 Delete', cls: 'danger', onClick: async () => { if (!UI.confirm('Delete this enquiry?')) return; L.splice(L.findIndex(y => y.id === r.id), 1); await Off.put('eo'); UI.closeModal(); this.page(el); } }, { label: '📄 Report', onClick: () => { UI.closeModal(); this.report([r], el, r); } }] : []),
        { label: 'Cancel', onClick: UI.closeModal }, { label: 'Save', cls: 'primary', onClick: async () => {
          const v = id => $('#' + id, m).value.trim();
          Object.assign(x, { sr: v('eSr'), type: v('eTy'), no: v('eNo'), year: v('eYr'), victim: v('eVi'), mobile: v('eMo'), amount: v('eAm'), recv: v('eRc'), brief: v('eBr'), status: v('eSt'), sent: v('eSe'), notes: v('eNt'),
            fir: { no: v('eFn'), ps: v('eFp'), district: v('eFd'), date: v('eFt'), io: v('eFi') } });
          if (!x.no && !x.victim) return UI.toast('Enter the case / complaint no. or the victim name');
          if (r) Object.assign(L.find(y => y.id === r.id) || {}, x); else L.push({ id: uid() + '', ...x });
          await Off.put('eo'); UI.closeModal(); UI.toast('Enquiry saved'); this.page(el); } }]);
    const sync = () => { $('#eFir', m).style.display = $('#eSt', m).value === 'FIR' ? '' : 'none'; $('#eAmW', m).style.display = +$('#eAm', m).value > this.HI ? '' : 'none'; $('#eAm', m).classList.toggle('eo-hiin', +$('#eAm', m).value > this.HI); };
    $('#eSt', m).onchange = sync; $('#eAm', m).oninput = sync; sync();
  },

  /* ---------- enquiry report ---------- */
  html(rows, one, C, cf) {
    const D = DocFont.get(), off = cf.office || Off.OFFICE, tot = rows.reduce((s, r) => s + (+r.amount || 0), 0), c = k => rows.filter(r => r.status === k).length;
    const sig = `<div class="sig"><b>(${esc(C.eo || '____________')})</b><br>${esc(C.desig || 'Enquiry Officer')}<br>${esc(off)}${C.mobile ? '<br>Mobile: ' + esc(C.mobile) : ''}</div>`;
    let body;
    if (one) {
      const r = one, kv = [['SR No.', r.sr], ['Type', (this.TYPES[r.type] || this.TYPES.COMP)[1]], ['Case / Complaint No.', this.caseNo(r)], ['Victim', r.victim], ['Victim Mobile', r.mobile], ['Fraud Amount', this.inr(r.amount)], ['Complaint Received', this.dmy(r.recv)], ['Report Sent / Closed', this.dmy(r.sent)], ['Status', this.stTxt(r)]].filter(x => x[1]);
      body = `<p><b>Subject:</b> Enquiry report on ${esc((this.TYPES[r.type] || this.TYPES.COMP)[1])} ${esc(this.caseNo(r))}${r.victim ? ' of ' + esc(r.victim) : ''}.</p>
        <table class="kv">${kv.map(([k, v]) => `<tr><th>${k}</th><td class="${k === 'Fraud Amount' && +r.amount > this.HI ? 'hi' : ''}">${esc(v)}</td></tr>`).join('')}</table>
        ${r.brief ? `<h4>Brief Facts</h4><p>${esc(r.brief).replace(/\n/g, '<br>')}</p>` : ''}${r.notes ? `<h4>Enquiry Findings / Closing Notes</h4><p>${esc(r.notes).replace(/\n/g, '<br>')}</p>` : ''}
        <p>${r.status === 'FIR' ? `On enquiry, the complaint was found to disclose a cognizable offence and an FIR has been lodged${this.firTxt(r) ? ' (' + esc(this.firTxt(r)) + ')' : ''}.` : r.status === 'Close' ? 'On enquiry, the matter is closed as stated above.' : 'The enquiry is still in progress.'} Submitted for kind information and necessary action.</p>`;
    } else body = `<p class="sum">Total: <b>${rows.length}</b> · Pending: <b>${c('Pending')}</b> · FIR Lodged: <b>${c('FIR')}</b> · Closed: <b>${c('Close')}</b> · Total Fraud Amount: <b>${fmtINR(tot)}</b></p>
      <table><thead><tr><th>SR</th><th>Type</th><th>Case / Complaint No.</th><th>Victim / Mobile</th><th>Fraud Amount</th><th>Short Details</th><th>Received</th><th>Sent / Closed</th><th>Status</th><th>Closing Notes</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.sr || '')}</td><td>${esc(r.type || '')}</td><td>${esc(this.caseNo(r))}</td><td>${esc(r.victim || '')}${r.mobile ? '<br>' + esc(r.mobile) : ''}</td><td class="${+r.amount > this.HI ? 'hi' : ''}">${esc(this.inr(r.amount))}</td><td>${esc(r.brief || '')}</td><td>${esc(this.dmy(r.recv))}</td><td>${esc(this.dmy(r.sent))}</td><td>${esc(this.stTxt(r))}</td><td>${esc(r.notes || '')}</td></tr>`).join('')}</tbody></table>`;
    const css = `.eor{font-family:${DocFont.css()};font-size:${D.s}pt;line-height:${D.lh};color:#000;background:#fff}.eor table{border-collapse:collapse;width:100%;margin:8px 0}.eor th,.eor td{border:1px solid #000;padding:4px 6px;vertical-align:top;text-align:left;font-size:.92em}.eor th{background:#e8edf7}.eor .kv th{width:32%}.eor .hi{color:#c00000;font-weight:700}.eor h2{text-align:center;margin:6px 0 10px;text-decoration:underline;font-size:1.3em}.eor h4{margin:12px 0 4px}.eor .meta{display:flex;justify-content:space-between;margin-bottom:8px}.eor .sig{margin-top:36px;margin-left:auto;width:max-content;text-align:center}.eor .sum{margin:6px 0}`;
    return { css, inner: `<div class="eor">${Off.headHtml(cf)}<h2>${esc(C.title || 'Enquiry Report')}</h2><div class="meta"><span>Enquiry Officer: <b>${esc([C.eo, C.desig].filter(Boolean).join(', ') || '____________')}</b></span><span>Date: <b>${this.dmy(today())}</b></span></div>${body}${sig}</div>` };
  },
  async report(rows, el, one) {
    const C = await this.cfg(), cf = await Off.cfg(), L = await this.list();
    const m = UI.modal('📄 Enquiry Report', `<div class="map-grid"><label>Report For<select id="erS"><option value="v">Shown in the list (${rows.length})</option><option value="a">All enquiries (${L.length})</option><option value="p">Pending only (${L.filter(r => r.status === 'Pending').length})</option><option value="c" ${one ? 'selected' : ''}>Particular Case</option></select></label>
      <label id="erCw" class="${one ? '' : 'hidden'}">Choose Case<select id="erC">${L.length ? L.map(r => `<option value="${esc(r.id)}" ${one && one.id === r.id ? 'selected' : ''}>SR ${esc(r.sr || '')} · ${esc(this.caseNo(r))}${r.victim ? ' · ' + esc(r.victim) : ''}</option>`).join('') : '<option value="">No enquiry yet</option>'}</select></label>
      <label>Report Title<input id="erT" value="${esc(C.title || 'Enquiry Report')}"></label><label>EO Name<input id="erN" value="${esc(C.eo || '')}"></label><label>Designation<input id="erD" value="${esc(C.desig || '')}"></label></div>
      <div id="erF"></div><details class="eo-hd"><summary>🖼 Header & Logo</summary><div id="erH"></div></details>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin:8px 0"><button class="btn" data-er="html">🌐 HTML</button><button class="btn" data-er="pdf">🖨 PDF / Print</button><button class="btn" data-er="word">📘 Word</button><button class="btn" data-er="xlsx">📗 Excel</button><button class="btn" data-er="img">🖼 Image</button><button class="btn" id="erEd" data-nov title="Edit the whole report – header, title, table, signature">✏ Edit</button></div>
      <div id="erTb" class="er-tb hidden"></div>
      <div class="eo-sheet" id="erV"></div>`, [{ label: 'Close', onClick: UI.closeModal }]);
    $('#erF', m).innerHTML = DocFont.bar(); DocFont.bind($('.df-bar', m));
    const pick = () => { const s = $('#erS', m).value; if (s === 'c') { const o = L.find(r => r.id === $('#erC', m).value); return o ? [[o], o] : [[], null]; } return s === 'v' ? [rows, null] : s === 'a' ? [L, null] : [L.filter(r => r.status === 'Pending'), null]; };
    const take = async () => { const t = $('#erT', m).value.trim(), nm = $('#erN', m).value.trim(), dg = $('#erD', m).value.trim(); if (t !== C.title || nm !== C.eo || dg !== C.desig) { Object.assign(C, { title: t, eo: nm, desig: dg }); await Off.put('eocfg'); } };
    let edited = false;
    const build = () => { const [R, o] = pick(), b = Object.assign(this.html(R, o, C, cf), { R, o }); const v = $('#erV .eor', m); if (edited && v) { const c = v.cloneNode(true); c.removeAttribute('contenteditable'); b.inner = c.outerHTML; } return b; };
    const draw = () => { if (edited && !UI.confirm('Your edits in the report will be replaced by the fresh report. Continue?')) return; edited = false; const b = build(); $('#erV', m).innerHTML = `<style>${b.css}</style>${b.inner}`; edMode(false); };
    const edMode = on => { const v = $('#erV .eor', m), tb = $('#erTb', m), eb = $('#erEd', m); if (!v) return; v.contentEditable = on ? 'true' : 'false'; v.classList.toggle('er-editing', on); tb.classList.toggle('hidden', !on); eb.classList.toggle('primary', on); eb.textContent = on ? '✔ Done Editing' : '✏ Edit'; if (on) v.focus(); };
    this.editBar($('#erTb', m), () => $('#erV .eor', m), () => { edited = true; }, () => { edited = false; draw(); });
    $('#erEd', m).onclick = () => { const v = $('#erV .eor', m); edMode(!(v && v.isContentEditable)); };
    $('#erV', m).addEventListener('input', () => { edited = true; });
    $('#erS', m).addEventListener('change', () => $('#erCw', m).classList.toggle('hidden', $('#erS', m).value !== 'c'));
    $('#erC', m).onchange = draw;
    Off.headEditor($('#erH', m), cf, draw);
    ['erS', 'erT', 'erN', 'erD'].forEach(id => $('#' + id, m).addEventListener('input', () => { take(); draw(); }));
    $('#erS', m).onchange = draw; $$('.df-bar select', m).forEach(s => s.addEventListener('change', () => setTimeout(draw, 50)));
    draw();
    const fn = () => { const [, o] = pick(); return 'enquiry_report' + (o ? '_' + String(this.caseNo(o) || o.sr).replace(/[^\w-]+/g, '_') : '') + '_' + today(); };
    const doc = b => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(C.title || 'Enquiry Report')}</title><style>@page{size:A4 ${b.o ? 'portrait' : 'landscape'};margin:1.3cm}body{margin:0;background:#fff}${b.css}</style></head><body>${b.inner}</body></html>`;
    $$('[data-er]', m).forEach(btn => btn.onclick = async () => { await take(); const b = build(), k = btn.dataset.er;
      if (!b.R.length) return UI.toast('No enquiry to report');
      if (typeof Letters !== 'undefined') Letters.log({ role: 'EO', how: k === 'pdf' ? 'print' : k, title: fn(), html: doc(b), caseTxt: b.R.length === 1 ? 'Enquiry ' + this.caseNo(b.R[0]) : b.R.length + ' Enquiries (EO Report)', subject: 'Enquiry Report – ' + (b.R.length === 1 ? 'SR ' + (b.R[0].sr || '') + ' · ' + this.caseNo(b.R[0]) : b.R.length + ' enquiries') });
      if (k === 'html') UI.download(fn() + '.html', doc(b), 'text/html');
      else if (k === 'word') UI.download(fn() + '.doc', doc(b).replace('<html>', '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">'), 'application/msword');
      else if (k === 'pdf') { const w = window.open('', '_blank'); if (!w) return UI.toast('Pop-up blocked – allow pop-ups to print'); w.document.write(doc(b).replace('<body>', '<body><button onclick="print()" class="np" style="margin:10px">🖨 Print / Save as PDF</button><style>@media print{.np{display:none}}</style>')); w.document.close(); setTimeout(() => { try { w.print(); } catch (e) { } }, 400); }
      else if (k === 'xlsx') { const ws = XLSX.utils.json_to_sheet(b.R.map(r => ({ 'SR': r.sr, 'Type': (this.TYPES[r.type] || this.TYPES.COMP)[1], 'Case / Complaint No.': this.caseNo(r), 'Victim': r.victim, 'Victim Mobile': r.mobile, 'Fraud Amount': +r.amount || '', 'Short Details': r.brief, 'Complaint Received': this.dmy(r.recv), 'Report Sent / Closed': this.dmy(r.sent), 'Days': this.days(r), 'Status': this.stTxt(r), 'Closing Notes': r.notes, 'Enquiry Officer': [C.eo, C.desig].filter(Boolean).join(', ') })));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Enquiries'); XLSX.writeFile(wb, fn() + '.xlsx'); }
      else if (k === 'img') { btn.disabled = true; try { await this.png(b, fn() + '.png'); } catch (e) { UI.toast('Could not make the image: ' + e.message); } btn.disabled = false; }
      UI.toast('Report ready'); });
  },
  editBar(tb, root, changed, reset) { DocEdit.bar(tb, { root, changed, reset }); },
  async png(b, name) {
    const W = b.o ? 900 : 1300, box = document.createElement('div');
    box.style.cssText = `position:fixed;left:-99999px;top:0;width:${W}px;padding:36px;background:#fff;box-sizing:border-box`; box.innerHTML = `<style>${b.css}</style>${b.inner}`; document.body.appendChild(box);
    const H = box.scrollHeight; box.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml'); box.style.position = 'static'; box.style.left = '0';
    const xml = new XMLSerializer().serializeToString(box); box.remove();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${xml}</foreignObject></svg>`;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('draw failed')); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const c = document.createElement('canvas'), sc = 2; c.width = W * sc; c.height = H * sc; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.scale(sc, sc); x.drawImage(img, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png')); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
};

/* Office Work: EO tab right after Crime Data, and in the sidebar drop-down */
(() => {
  /* EO is its own page in Investigation, right below IO – Investigation Officer (sidebar item added in io.js) */
  PAGE_META.eo = { group: 'Investigation', title: 'EO – Enquiry Officer', desc: 'Enquiries marked to the Enquiry Officer (EO): complaint / NCRP details, enquiry report and status – kept on this computer.', order: ['eo'], names: { eo: '🕵 Enquiry Officer (EO)' } };
  Pages.eo = main => { const { body } = tabs(main, 'eo', [['eo', '🕵 Enquiry Officer (EO)']], 'EO – Enquiry Officer'); EO.page(body); };
  /* old links to Office Work › EO open the new page */
  const og = go; go = function (page, sub) { if (page === 'offx' && sub === 'eo') return og('eo'); return og.apply(this, arguments); };
})();
