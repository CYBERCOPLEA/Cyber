/* io.js – (1) Investigation › "IO – Investigation Officer" drop-down: CCTNS Case Diary + Case File & Notices items in one place.
   (2) Action › "Arrest / Notice 35(3)": Smart Overview, Accused / Criminal Details table, Notice 35(3) BNSS, Criminal Dossier
       (photo, font type / size, bold / italic / underline, align, edit, print / PDF, Word, HTML). Data stays on this computer (Off 'accused'). */
'use strict';
const Arrest = {
  ST: { wanted: ['⏳', 'Wanted / Under Trace', '#f59e0b'], notice: ['📨', 'Notice 35(3) Served', '#3b82f6'], appeared: ['🙋', 'Appeared / Joined Investigation', '#06b6d4'], arrested: ['⛓', 'Arrested', '#dc2626'], bail: ['⚖', 'On Bail', '#8b5cf6'], abscond: ['🏃', 'Absconding', '#ea580c'], released: ['✅', 'Released / Discharged', '#16a34a'] },
  REL: ['S/O', 'D/O', 'W/O', 'C/O'],
  /* [key, label, type, extra] – type: t text, a textarea, d date, s select, n number */
  G: [
    ['👤 Identity', [['name', 'Name of Accused *', 't'], ['alias', 'Alias / Other Name', 't'], ['rel', 'Relation', 's', ['S/O', 'D/O', 'W/O', 'C/O']], ['relName', 'Father / Husband / Guardian Name', 't'], ['gender', 'Gender', 's', ['', 'Male', 'Female', 'Other']], ['dob', 'Date of Birth', 'd'], ['age', 'Age (Years)', 'n'], ['occupation', 'Occupation', 't']]],
    ['🏠 Address', [['permAddr', 'Permanent Address', 'a'], ['presAddr', 'Present Address', 'a'], ['state', 'State', 't'], ['district', 'District', 't'], ['aps', 'Police Station (Address Area)', 't']]],
    ['📇 Mobile / Email / Aadhaar / PAN / CKYC', [['mobile', 'Mobile', 't', 'tel'], ['mobile2', 'Other Mobile', 't', 'tel'], ['email', 'Email', 't', 'email'], ['aadhaar', 'Aadhaar No.', 't', 'aadhaar'], ['pan', 'PAN', 't', 'pan'], ['ckyc', 'CKYC No.', 't', 'ckyc'], ['otherId', 'Other ID (Passport / DL / Voter ID)', 't'], ['social', 'Social Media / UPI / Bank A/c', 'a']]],
    ['👪 Family Details', [['family', 'Father, Mother, Spouse, Children, Brothers / Sisters (with mobile)', 'a']]],
    ['🧍 Identification Details', [['height', 'Height', 't'], ['complexion', 'Complexion / Build', 't'], ['marks', 'Identification Marks', 'a'], ['habits', 'Habits / Languages / Other', 't']]],
    ['📜 Criminal History', [['history', 'Earlier Cases (FIR No. / Year / PS / Sections / Result)', 'a'], ['jail', 'Earlier Went to Jail?', 's', ['', 'No', 'Yes']], ['jailDetails', 'Jail Details (Jail Name, From – To, Case)', 'a']]],
    ['⚖ Advocate Details', [['advName', 'Advocate Name', 't'], ['advMobile', 'Advocate Mobile', 't', 'tel'], ['advEnrol', 'Bar Enrolment No.', 't'], ['advAddr', 'Advocate Address / Court', 't']]],
    ['📁 Case, Arrest & Notice', [['caseId', 'Case', 's'], ['fir', 'FIR No. (if case not in tool)', 't'], ['year', 'Year', 't'], ['sections', 'Sections of Law', 't'], ['role', 'Role in Crime (Mule / Caller / Kingpin…)', 't'], ['status', 'Status', 's'], ['noticeDate', 'Notice 35(3) Served On', 'd'], ['appearDate', 'Appeared On', 'd'], ['arrestDate', 'Arrested On', 'd'], ['arrestPlace', 'Place of Arrest', 't'], ['bail', 'Bail (Court, Date, Conditions)', 't'], ['notes', 'Other Details / Remarks', 'a']]]
  ],
  RC: ['💵 Cash (₹)', '🚗 Vehicle (Type / Reg. No.)', '📱 Mobile Phone (Make / Model / IMEI)', '📶 Mobile No. / SIM', '✉ Email ID', '🪪 Aadhaar Card', '💳 PAN Card', '🏦 Bank Passbook / Cheque Book / ATM Card', '💻 Laptop / Computer / Hard Disk', '📄 Other Case Related Documents'],
  async cats() { const c = await Off.get('recCats', []); return [...this.RC, ...c.filter(x => !this.RC.includes(x))]; },
  recTxt(r) { return (r.recovery || []).filter(x => x.cat || x.det).map(x => [x.cat, x.det, x.qty, x.on && 'on ' + this.dmy(x.on), x.memo].filter(Boolean).join(' – ')); },
  async list() { return Off.get('accused', []); },
  st(k) { return this.ST[k] || this.ST.wanted; },
  badge(k) { const s = this.st(k); return `<span class="ar-st" style="--c:${s[2]}">${s[0]} ${esc(s[1])}</span>`; },
  caseOf(r) { return S.cases.find(c => c.id === r.caseId) || null; },
  firTxt(r) { const c = this.caseOf(r); return c ? (c.fir ? 'FIR ' + c.fir + (c.year ? '/' + c.year : '') + (c.ps ? ' · PS ' + c.ps : '') : c.name) : r.fir ? 'FIR ' + r.fir + (r.year ? '/' + r.year : '') : ''; },
  relTxt(r) { return r.relName ? (r.rel || 'S/O') + ' ' + r.relName : ''; },
  ids(r) { return [['📱', r.mobile], ['📱', r.mobile2], ['✉', r.email], ['🪪 Aadhaar', r.aadhaar], ['PAN', r.pan], ['CKYC', r.ckyc], ['ID', r.otherId]].filter(x => x[1]); },
  dmy(d) { return d ? String(d).split('-').reverse().join('-') : ''; },
  hay(r) { return [r.name, r.alias, r.relName, r.state, r.district, r.mobile, r.mobile2, r.email, r.aadhaar, r.pan, r.ckyc, r.permAddr, r.presAddr, r.otherId, this.firTxt(r), r.sections, r.role].join(' ').toLowerCase(); },
  filt(L, st) {
    const q = String(st.q || '').toLowerCase().trim();
    return L.filter(r => (!st.s || r.status === st.s) && (!q || q.split(/\s+/).every(w => this.hay(r).includes(w))) &&
      (!st.k || (st.k === 'photo' ? !!r.photo : st.k === 'nophoto' ? !r.photo : st.k === 'hist' ? !!String(r.history || '').trim() : st.k === 'jail' ? r.jail === 'Yes' : st.k === 'pend' ? r.status === 'notice' && !r.appearDate : true)) &&
      (!st.st || (r.state || '—') === st.st) && (!st.di || (r.district || '—') === st.di) && (!st.c || (r.caseId || r.fir || '—') === st.c));
  },
  stOf() { return this._st || (this._st = { q: '', s: '', k: '', st: '', di: '', c: '' }); },
  done(r) { const F = ['name', 'relName', 'permAddr', 'mobile', 'aadhaar', 'pan', 'photo', 'family', 'marks', 'history', 'advName']; return Math.round(100 * F.filter(k => String(r[k] || '').trim()).length / F.length); },
  thumb(r, sz = 34) { return r.photo ? `<img class="ar-ph" src="${r.photo}" style="width:${sz}px;height:${sz}px">` : `<span class="ar-ph none" style="width:${sz}px;height:${sz}px">${esc((r.name || '?').slice(0, 1).toUpperCase())}</span>`; },
  /* ---------- common search bar (name, father name, state, district, mobile, email, Aadhaar, PAN, photo) ---------- */
  bar(st) {
    const chip = (k, l) => `<button class="ar-chip ${st.k === k ? 'on' : ''}" data-ak="${k}">${l}</button>`;
    return `<div class="ar-bar"><input id="arQ" type="search" data-nov placeholder="🔎 Search name, father name, state, district, mobile, email, Aadhaar, PAN, FIR…" value="${esc(st.q)}">
      <select id="arS" data-nov><option value="">All Status</option>${Object.entries(this.ST).map(([k, v]) => `<option value="${k}" ${st.s === k ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select>
      ${chip('photo', '🖼 With Photo')}${chip('nophoto', '🚫 Without Photo')}${chip('hist', '📜 Criminal History')}${chip('jail', '🔒 Been to Jail')}${chip('pend', '⏰ Notice Served, Not Appeared')}
      ${st.q || st.s || st.k || st.st || st.di || st.c ? '<button class="btn sm" id="arClr">✖ Clear</button>' : ''}<span class="spacer"></span><button class="btn primary" id="arAdd">➕ Add Accused</button></div>`;
  },
  bindBar(el, redraw) {
    const st = this.stOf();
    $('#arQ', el).oninput = e => { st.q = e.target.value; clearTimeout(this._qt); this._qt = setTimeout(() => { redraw(); const i = $('#arQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
    $('#arS', el).onchange = e => { st.s = e.target.value; redraw(); };
    $$('[data-ak]', el).forEach(b => b.onclick = () => { st.k = st.k === b.dataset.ak ? '' : b.dataset.ak; redraw(); });
    if ($('#arClr', el)) $('#arClr', el).onclick = () => { Object.assign(st, { q: '', s: '', k: '', st: '', di: '', c: '' }); redraw(); };
    $('#arAdd', el).onclick = () => this.edit(null, redraw);
  },
  /* ---------- Smart Overview ---------- */
  async over(el) {
    const L = await this.list(), st = this.stOf(), R = this.filt(L, st), redraw = () => this.over(el);
    const by = f => { const m = new Map(); R.forEach(r => { const k = f(r) || '—'; m.set(k, (m.get(k) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 10); };
    const bars = (id, title, rows, key, lab) => { const mx = Math.max(1, ...rows.map(x => x[1])); return `<div class="card ar-bars"><h4>${title}</h4>${rows.length ? rows.map(([k, n]) => `<div class="ar-brow" data-bk="${id}" data-bv="${esc(k)}" title="Click to see these accused"><span>${esc(lab ? lab(k) : k)}</span><i style="width:${(n / mx) * 100}%"></i><b>${n}</b></div>`).join('') : '<div class="small muted">Nothing yet</div>'}</div>`; };
    const cnt = k => R.filter(r => r.status === k).length, pend = R.filter(r => r.status === 'notice' && !r.appearDate && r.noticeDate && (Date.now() - new Date(r.noticeDate)) > 7 * 864e5);
    const K = [['👥', 'All Accused', R.length, '#6366f1', '', ''], ...Object.entries(this.ST).map(([k, v]) => [v[0], v[1], cnt(k), v[2], 's', k]), ['📜', 'With Criminal History', R.filter(r => String(r.history || '').trim()).length, '#7c3aed', 'k', 'hist'], ['🔒', 'Been to Jail Before', R.filter(r => r.jail === 'Yes').length, '#be123c', 'k', 'jail'], ['🖼', 'Photo Added', R.filter(r => r.photo).length, '#0d9488', 'k', 'photo']];
    el.innerHTML = this.bar(st) + `<div class="ar-kpis">${K.map(([i, t, n, c, f, v]) => `<button class="ar-k ${(f === 's' && st.s === v) || (f === 'k' && st.k === v) ? 'on' : ''}" data-kf="${f}" data-kv="${v}" style="--c:${c}"><span>${i}</span><b>${fmtNum(n)}</b><small>${esc(t)}</small></button>`).join('')}</div>
      ${pend.length ? `<div class="note warn" style="margin:10px 0">⏰ <b>${pend.length}</b> accused got Notice 35(3) more than 7 days ago and have not appeared: ${pend.slice(0, 6).map(r => `<a href="#" data-ar="${r.id}">${esc(r.name)}</a>`).join(', ')}${pend.length > 6 ? '…' : ''} – consider Sec 35(6) BNSS action.</div>` : ''}
      <div class="ar-grid">${bars('s', '📊 By Status', by(r => r.status || 'wanted'), 's', k => this.st(k)[0] + ' ' + this.st(k)[1])}${bars('st', '🗺 By State', by(r => r.state), 'st')}${bars('di', '📍 By District', by(r => r.district), 'di')}${bars('c', '📁 By Case', by(r => r.caseId || r.fir), 'c', k => { const c = S.cases.find(x => x.id === k); return c ? c.name : k === '—' ? 'Not linked' : 'FIR ' + k; })}</div>
      <div class="card"><h4>🧑‍⚖️ Accused ${st.q || st.s || st.k ? '(filtered)' : '– latest'} <span class="badge">${R.length}</span></h4>${R.length ? `<div class="ar-cards">${R.slice().sort((a, b) => String(b.upd || '').localeCompare(String(a.upd || ''))).slice(0, 24).map(r => `<div class="ar-card" data-ar="${r.id}">${this.thumb(r, 58)}<div><b>${esc(r.name || '—')}</b><div class="small muted">${esc(this.relTxt(r))}</div>${this.badge(r.status)}<div class="small">${esc([r.mobile, r.district, r.state].filter(Boolean).join(' · '))}</div><div class="small muted">${esc(this.firTxt(r))}</div><div class="ar-done"><i style="width:${this.done(r)}%"></i></div></div><div class="ar-cb"><button class="btn sm" data-ad="${r.id}" title="Criminal Dossier">📘</button><button class="btn sm" data-an="${r.id}" title="Notice 35(3)">📨</button></div></div>`).join('')}</div>` : UI.empty('No accused yet. Press <b>➕ Add Accused</b> to start.')}</div>`;
    this.bindBar(el, redraw);
    $$('[data-kf]', el).forEach(b => b.onclick = () => { const f = b.dataset.kf, v = b.dataset.kv; if (!f) { Object.assign(st, { s: '', k: '' }); } else if (f === 's') st.s = st.s === v ? '' : v; else st.k = st.k === v ? '' : v; redraw(); });
    $$('[data-bk]', el).forEach(b => b.onclick = () => { const k = b.dataset.bk, v = b.dataset.bv; st[k] = st[k] === v ? '' : v; S.sub.arrest = 'list'; render(); });
    this.cardBind(el, redraw, L);
  },
  cardBind(el, redraw, L) {
    $$('[data-ar]', el).forEach(c => c.onclick = e => { if (e.target.closest('button')) return; e.preventDefault(); const r = L.find(x => x.id === c.dataset.ar); if (r) this.edit(r, redraw); });
    $$('[data-ad]', el).forEach(b => b.onclick = () => { S.sub.arrest = 'dossier'; this._pick = b.dataset.ad; render(); });
    $$('[data-an]', el).forEach(b => b.onclick = () => { S.sub.arrest = 'notice'; this._pick = b.dataset.an; render(); });
  },
  /* ---------- Accused / Criminal Details table ---------- */
  async table(el) {
    const L = await this.list(), st = this.stOf(), R = this.filt(L, st), redraw = () => this.table(el);
    const sm = s => esc(String(s || '')).replace(/\n/g, '<br>');
    el.innerHTML = this.bar(st) + `${st.st || st.di || st.c ? `<div class="small" style="margin:6px 0">Filter: ${[st.st && 'State ' + st.st, st.di && 'District ' + st.di, st.c && 'Case ' + ((S.cases.find(x => x.id === st.c) || {}).name || st.c)].filter(Boolean).map(esc).join(' · ')}</div>` : ''}<div id="arT" class="ar-tbl"></div>`;
    this.bindBar(el, redraw);
    Table($('#arT', el), { rows: R, pageSize: 25, exportName: 'accused_criminal_details', sortKey: 'sr', noNd: 1, onRow: r => this.edit(r, redraw), columns: [
      { key: 'sr', label: 'Serial', num: true, sortVal: r => +r.sr || 0 },
      { key: 'photo', label: 'Photo', nosort: true, noexport: true, render: r => this.thumb(r, 44) },
      { key: 'name', label: 'Name of Accused', render: r => `<b>${esc(r.name)}</b>${r.alias ? `<div class="small muted">@ ${esc(r.alias)}</div>` : ''}<div class="small">${[r.gender, r.age && r.age + ' yrs'].filter(Boolean).join(' · ')}</div>` },
      { key: 'relName', label: 'C/O, S/O, D/O, W/O', render: r => esc(this.relTxt(r)), csv: r => this.relTxt(r) },
      { key: 'permAddr', label: 'Permanent Address', render: r => `<div class="ar-cl">${sm(r.permAddr)}</div>` },
      { key: 'presAddr', label: 'Present Address', render: r => `<div class="ar-cl">${sm(r.presAddr)}</div><div class="small muted">${esc([r.district, r.state].filter(Boolean).join(', '))}</div>` },
      { key: 'ids', label: 'Mobile / Email / Aadhaar / PAN / CKYC', sortVal: r => r.mobile || '', csv: r => this.ids(r).map(x => x.join(' ')).join('; '), render: r => this.ids(r).map(([i, v]) => `<div class="mono small ar-id" data-trk="${esc(v)}" title="Track this everywhere">${i} ${esc(v)}</div>`).join('') },
      { key: 'family', label: 'Family Details', render: r => `<div class="ar-cl">${sm(r.family)}</div>` },
      { key: 'marks', label: 'Identification Details', csv: r => [r.height, r.complexion, r.marks].filter(Boolean).join('; '), render: r => `<div class="ar-cl">${sm([r.height && 'Height ' + r.height, r.complexion, r.marks].filter(Boolean).join('\n'))}</div>` },
      { key: 'history', label: 'Criminal History', render: r => `<div class="ar-cl">${sm(r.history) || '<span class="muted">—</span>'}</div>` },
      { key: 'jail', label: 'Went to Jail Before', csv: r => [r.jail, r.jailDetails].filter(Boolean).join(' – '), render: r => r.jail === 'Yes' ? `<b class="bad-t">🔒 Yes</b><div class="ar-cl small">${sm(r.jailDetails)}</div>` : r.jail === 'No' ? 'No' : '<span class="muted">—</span>' },
      { key: 'recovery', label: 'Recovery', sortVal: r => (r.recovery || []).length, csv: r => this.recTxt(r).join('; '), render: r => this.recTxt(r).map(t => `<div class="small">• ${esc(t)}</div>`).join('') || '<span class="muted">—</span>' },
      { key: 'advName', label: 'Advocate Details', csv: r => [r.advName, r.advMobile, r.advEnrol, r.advAddr].filter(Boolean).join(', '), render: r => r.advName ? `<b>${esc(r.advName)}</b><div class="small">${esc([r.advMobile, r.advEnrol].filter(Boolean).join(' · '))}</div><div class="small muted">${esc(r.advAddr || '')}</div>` : '<span class="muted">—</span>' },
      { key: 'case', label: 'Case / FIR', sortVal: r => this.firTxt(r), csv: r => this.firTxt(r), render: r => `${esc(this.firTxt(r))}<div class="small muted">${esc(r.sections || '')}</div>` },
      { key: 'status', label: 'Status', sortVal: r => r.status, csv: r => this.st(r.status)[1], render: r => `${this.badge(r.status)}<div class="small muted">${[r.noticeDate && 'Notice ' + this.dmy(r.noticeDate), r.arrestDate && 'Arrest ' + this.dmy(r.arrestDate)].filter(Boolean).join(' · ')}</div>` },
      { key: 'act', label: 'Actions', nosort: true, noexport: true, render: r => `<div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-ad="${r.id}" title="Criminal Dossier">📘</button><button class="btn sm" data-an="${r.id}" title="Notice 35(3) BNSS">📨</button></div>` }],
      after: c => { this.cardBind(c, redraw, L); $$('[data-trk]', c).forEach(x => x.onclick = e => { e.stopPropagation(); typeof Dash2 !== 'undefined' && Dash2.track(x.dataset.trk.replace(/^\S+\s/, '')); }); } });
  },
  /* ---------- add / edit ---------- */
  photoPick(cb) { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = () => { const x = f.files[0]; if (!x) return; const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { const m = 480, k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.85)); }; im.onerror = () => UI.toast('This file is not a picture'); im.src = rd.result; }; rd.readAsDataURL(x); }; f.click(); },
  async edit(r, done) {
    const L = await this.list(), x = r ? JSON.parse(JSON.stringify(r)) : { sr: String(Math.max(0, ...L.map(y => +y.sr || 0)) + 1), rel: 'S/O', status: 'wanted', caseId: isScope(S.caseId) ? '' : S.caseId || '' };
    const fld = ([k, l, t, ex]) => {
      if (k === 'caseId') return `<label>${l}<select id="ar_caseId"><option value="">— not in tool —</option>${S.cases.map(c => `<option value="${c.id}" ${c.id === x.caseId ? 'selected' : ''}>${esc(c.name)}${c.fir ? ' · FIR ' + esc(c.fir) : ''}</option>`).join('')}</select></label>`;
      if (k === 'status') return `<label>${l}<select id="ar_status">${Object.entries(this.ST).map(([s, v]) => `<option value="${s}" ${x.status === s ? 'selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></label>`;
      if (t === 's') return `<label>${l}<select id="ar_${k}">${ex.map(o => `<option ${o === (x[k] || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
      if (t === 'a') return `<label class="ar-w">${l}<textarea id="ar_${k}" rows="2">${esc(x[k] || '')}</textarea></label>`;
      const vk = { aadhaar: 'aadhaar', pan: 'pan', ckyc: 'ckyc', email: 'email' }[ex] || '';
      return `<label>${l}<input id="ar_${k}" type="${t === 'd' ? 'date' : t === 'n' ? 'number' : ex === 'tel' ? 'tel' : 'text'}" value="${esc(x[k] || '')}" ${vk ? `data-vk="${vk}"` : ''} ${t === 'n' ? 'min="0" max="120"' : ''}></label>`;
    };
    const m = UI.modal(r ? '✏ ' + (r.name || 'Accused') : '➕ Add Accused', `<div class="ar-form"><div class="ar-phbox"><div id="arPh">${this.thumb(x, 120)}</div><button class="btn sm" id="arPhB" type="button">📷 ${x.photo ? 'Change' : 'Add'} Photo</button>${x.photo ? '<button class="btn sm" id="arPhX" type="button">🗑 Remove</button>' : ''}<label class="small">Serial<input id="ar_sr" value="${esc(x.sr || '')}" style="width:80px" data-nov></label></div>
      <div class="ar-groups">${this.G.map(([g, F]) => `<details class="ar-g" ${/Identity|Address|Mobile|Case/.test(g) ? 'open' : ''}><summary>${g}</summary><div class="map-grid">${F.map(fld).join('')}${g.includes('Address') ? '<label class="small ar-w" style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" id="arSame" style="width:auto"> Present address same as permanent</label>' : ''}</div></details>`).join('')}<details class="ar-g" open><summary>💰 Recovery / Seizure</summary><div id="arRec"></div><div class="row" style="gap:6px;margin-top:6px"><button type="button" class="btn sm" id="arRecAdd">➕ Add Recovery</button><button type="button" class="btn sm" id="arCatAdd">➕ Add Category</button></div></details></div></div><div class="err" id="arErr"></div>`,
      [...(r ? [{ label: '🗑 Delete', cls: 'danger', onClick: async () => { if (!UI.confirm(`Delete ${r.name}? This cannot be undone.`)) return; L.splice(L.findIndex(y => y.id === r.id), 1); await Off.put('accused'); UI.closeModal(); done && done(); } }, { label: '📘 Dossier', onClick: () => { UI.closeModal(); S.sub.arrest = 'dossier'; this._pick = r.id; go('arrest', 'dossier'); } }] : []),
        { label: 'Cancel', onClick: UI.closeModal }, { label: '💾 Save', cls: 'primary', onClick: async () => {
          const v = k => { const e = $('#ar_' + k, m); return e ? e.value.trim() : ''; };
          this.G.forEach(([, F]) => F.forEach(([k]) => { x[k] = v(k); })); x.sr = v('sr');
          if (!x.name) { $('#arErr', m).textContent = 'Enter the name of the accused'; return; }
          if (x.pan) x.pan = x.pan.toUpperCase(); x.recovery = (x.recovery || []).filter(o => o.cat && (o.det || o.qty || o.memo || o.on)); x.dz = { f: (x.dz || {}).f, s: (x.dz || {}).s, auto: new Date().toISOString() };
          x.upd = new Date().toISOString(); if (r) Object.assign(L.find(y => y.id === r.id) || {}, x); else L.push(Object.assign({ id: 'A' + uid(), added: x.upd }, x));
          await Off.put('accused'); await this.caseFlags(x); UI.closeModal(); UI.toast('Saved – ' + x.name + ' · Criminal Dossier made'); done && done(); } }]);
    x.recovery = (x.recovery || []).slice(); let CATS = await this.cats();
    const rec = () => { const b = $('#arRec', m); b.innerHTML = x.recovery.length ? `<table class="ar-rt"><tr><th>Category</th><th>Details (model, number, amount…)</th><th>Quantity / Value</th><th>Recovered On</th><th>Place / Seizure Memo No.</th><th></th></tr>${x.recovery.map((o, i) => `<tr><td><select data-ri="${i}" data-rk="cat" data-nov>${(CATS.includes(o.cat) || !o.cat ? CATS : [o.cat, ...CATS]).map(c => `<option ${c === o.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td><td><input data-ri="${i}" data-rk="det" value="${esc(o.det || '')}" data-nov></td><td><input data-ri="${i}" data-rk="qty" value="${esc(o.qty || '')}" style="width:110px" data-nov></td><td><input type="date" data-ri="${i}" data-rk="on" value="${esc(o.on || '')}"></td><td><input data-ri="${i}" data-rk="memo" value="${esc(o.memo || '')}" data-nov></td><td><button type="button" class="btn sm" data-rx="${i}" title="Remove">✕</button></td></tr>`).join('')}</table>` : '<div class="small muted">No recovery yet – press ➕ Add Recovery.</div>';
      $$('[data-rk]', b).forEach(e => e.oninput = e.onchange = () => { x.recovery[+e.dataset.ri][e.dataset.rk] = e.value; });
      $$('[data-rx]', b).forEach(e => e.onclick = () => { x.recovery.splice(+e.dataset.rx, 1); rec(); }); };
    rec();
    $('#arRecAdd', m).onclick = () => { x.recovery.push({ cat: CATS[0], det: '', qty: '', on: today(), memo: '' }); rec(); };
    $('#arCatAdd', m).onclick = async () => { const n = (prompt('New recovery category (e.g. Gold Ornaments, Cheque, Crypto Wallet):') || '').trim().slice(0, 60); if (!n) return; const c = await Off.get('recCats', []); if (!CATS.includes(n)) { c.push(n); await Off.put('recCats'); CATS = await this.cats(); } x.recovery.push({ cat: n, det: '', qty: '', on: today(), memo: '' }); rec(); UI.toast('Category added: ' + n); };
    const ph = () => { $('#arPh', m).innerHTML = this.thumb(x, 120); };
    $('#arPhB', m).onclick = () => this.photoPick(d => { x.photo = d; ph(); });
    if ($('#arPhX', m)) $('#arPhX', m).onclick = () => { delete x.photo; ph(); };
    $('#arSame', m).onchange = e => { if (e.target.checked) $('#ar_presAddr', m).value = $('#ar_permAddr', m).value; };
    const jl = () => { const d = $('#ar_jailDetails', m).closest('label'); d.style.display = $('#ar_jail', m).value === 'Yes' ? '' : 'none'; }; $('#ar_jail', m).onchange = jl; jl();
  },
  /* the linked case's CCTNS checklist: arrest / appearance and 35(3) notices */
  async caseFlags(x) {
    const c = this.caseOf(x); if (!c) return; const L = (await this.list()).filter(r => r.caseId === c.id); c.flags = c.flags || {};
    const ar = L.find(r => r.arrestDate || r.appearDate); if (ar && !c.flags.arrest) c.flags.arrest = this.dmy(ar.arrestDate || ar.appearDate);
    if (L.length && L.every(r => r.noticeDate || ['arrested', 'appeared', 'bail', 'released'].includes(r.status))) c.flags.n353 = 1;
    await saveMeta();
  },
  /* ---------- pick an accused (Notice / Dossier tabs) ---------- */
  picker(L, cur) { return `<select id="arPick" data-nov><option value="">— choose the accused —</option>${L.map(r => `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${esc((r.sr ? r.sr + '. ' : '') + r.name + (r.relName ? ' ' + this.relTxt(r) : '') + (this.firTxt(r) ? ' · ' + this.firTxt(r) : ''))}</option>`).join('')}</select>`; },
  vars(r) {
    const c = this.caseOf(r), v = Formats.vars({ person: { name: r.name + (r.alias ? ' @ ' + r.alias : ''), father: r.relName, address: r.presAddr || r.permAddr, mobile: [r.mobile, r.email].filter(Boolean).join(' / ') } });
    if (c && c.id !== S.caseId) Object.assign(v, { fir: c.fir ? `FIR No. ${c.fir}${c.year ? '/' + c.year : ''}` : c.name, ps: c.ps || v.ps, section: c.section || r.sections || v.section });
    if (!c && r.fir) Object.assign(v, { fir: `FIR No. ${r.fir}${r.year ? '/' + r.year : ''}`, section: r.sections || v.section });
    if (r.sections && (!c || !c.section)) v.section = r.sections;
    return v;
  },
  fill(id, r) { const f = Formats.find(id); if (!f) return ''; const v = this.vars(r); return NoticeKit.head(String(f.it.text).replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ?? '________')).replace(/S\/o /, (r.rel || 'S/O').replace('O', 'o') + ' '); },
  async notice(el) {
    const L = await this.list(), cur = this._pick && L.some(r => r.id === this._pick) ? this._pick : (L[0] || {}).id; this._pick = cur;
    const r = L.find(x => x.id === cur), kind = this._nk || 'f_m_353';
    el.innerHTML = `<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><b>📨 Notice under Sec 35(3) BNSS</b>${this.picker(L, cur)}<select id="arNk" data-nov><option value="f_m_353" ${kind === 'f_m_353' ? 'selected' : ''}>Notice of Appearance – Sec 35(3)</option><option value="f_m_353c" ${kind === 'f_m_353c' ? 'selected' : ''}>Compliance / Service Report</option></select><span class="spacer"></span>${r ? `<button class="btn" id="arNe">✏ Accused Details</button>` : ''}<button class="btn primary" id="arAdd2">➕ Add Accused</button></div>
      ${r ? `<div class="row" style="gap:10px;align-items:center;margin-top:10px">${this.thumb(r, 52)}<div><b>${esc(r.name)}</b> ${this.badge(r.status)}<div class="small muted">${esc([this.relTxt(r), r.mobile, this.firTxt(r)].filter(Boolean).join(' · '))}</div></div></div>
      <textarea id="arNt" rows="22" class="ar-nt" style="font-family:var(--doc-font);font-size:var(--doc-size);line-height:var(--doc-lh)">${esc(r.notice && r.notice[kind] || this.fill(kind, r))}</textarea>
      <div class="row ar-nbtn" style="gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn" id="arNr">↺ Fresh From Format</button><button class="btn" id="arNs">💾 Save Text</button><button class="btn" id="arNp">🖨 Print / PDF</button><button class="btn" id="arNw">📄 Word</button><span class="spacer"></span>${kind === 'f_m_353' ? `<label class="small">Served On <input type="date" id="arNd" value="${esc(r.noticeDate || today())}" data-nov></label><button class="btn primary" id="arNm">✅ Mark Notice Served</button>` : ''}</div>` : `<div class="muted" style="margin-top:12px">Add the accused first (➕ Add Accused), then the notice is filled in from the details.</div>`}</div>`;
    const redraw = () => this.notice(el);
    if ($('#arPick', el)) $('#arPick', el).onchange = e => { this._pick = e.target.value; redraw(); };
    $('#arNk', el).onchange = e => { this._nk = e.target.value; redraw(); };
    $('#arAdd2', el).onclick = () => this.edit(null, redraw);
    if (!r) return;
    const ta = $('#arNt', el);
    NoticeKit.tools($('.ar-nbtn', el), ta, {});
    $('#arNe', el).onclick = () => this.edit(r, redraw);
    $('#arNr', el).onclick = () => { ta.value = this.fill(kind, r); };
    $('#arNs', el).onclick = async () => { r.notice = r.notice || {}; r.notice[kind] = ta.value; await Off.put('accused'); UI.toast('Notice text saved'); };
    $('#arNp', el).onclick = () => NoticeKit.print(ta.value);
    $('#arNw', el).onclick = () => NoticeKit.docx('Notice_35_3_' + (r.name || 'accused').replace(/[^\w]+/g, '_'), ta.value);
    if ($('#arNm', el)) $('#arNm', el).onclick = async () => { r.noticeDate = $('#arNd', el).value || today(); if (['wanted', 'abscond'].includes(r.status) || !r.status) r.status = 'notice'; r.upd = new Date().toISOString(); r.notice = r.notice || {}; r.notice[kind] = ta.value; await Off.put('accused'); await this.caseFlags(r); UI.toast('✅ Notice 35(3) marked served on ' + this.dmy(r.noticeDate)); redraw(); };
  },
  /* ---------- Criminal Dossier ---------- */
  FONTS: ['Arial', 'Arial Narrow', 'Times New Roman', 'Calibri', 'Cambria', 'Georgia', 'Verdana', 'Tahoma', 'Bookman Old Style', 'Garamond', 'Century Gothic', 'Courier New', 'Mangal', 'Nirmala UI', 'Kokila', 'Aparajita', 'Utsaah', 'Noto Sans Devanagari'],
  async dossierHtml(r) {
    const cf = await Off.cfg(), row = (l, v) => v ? `<tr><th>${esc(l)}</th><td>${esc(String(v)).replace(/\n/g, '<br>')}</td></tr>` : '', sec = (t, rows) => rows.replace(/\s/g, '') ? `<h3>${t}</h3><table class="dz-t">${rows}</table>` : '';
    const c = this.caseOf(r);
    return `${Off.headHtml(cf)}<h2 class="dz-title">CRIMINAL DOSSIER<br><span>अपराधी डोजियर</span></h2>
      <table class="dz-top"><tr><td><table class="dz-t">${row('Serial No.', r.sr)}${row('Name of Accused', r.name)}${row('Alias', r.alias)}${row(r.rel || 'S/O', r.relName)}${row('Gender / Age', [r.gender, r.age && r.age + ' years', r.dob && 'DOB ' + this.dmy(r.dob)].filter(Boolean).join(' · '))}${row('Occupation', r.occupation)}${row('Status', this.st(r.status)[1])}</table></td>
      <td class="dz-phc"><div class="dz-ph">${r.photo ? `<img src="${r.photo}">` : '<span>Affix<br>Photograph</span>'}</div></td></tr></table>
      ${sec('1. Address', row('Permanent Address', r.permAddr) + row('Present Address', r.presAddr) + row('District / State', [r.district, r.state].filter(Boolean).join(', ')) + row('Police Station (Address Area)', r.aps))}
      ${sec('2. Mobile / Email / Identity Documents', row('Mobile', [r.mobile, r.mobile2].filter(Boolean).join(', ')) + row('Email', r.email) + row('Aadhaar No.', r.aadhaar) + row('PAN', r.pan) + row('CKYC No.', r.ckyc) + row('Other ID', r.otherId) + row('Social Media / UPI / Bank A/c', r.social))}
      ${sec('3. Family Details', row('Family', r.family))}
      ${sec('4. Identification Details', row('Height', r.height) + row('Complexion / Build', r.complexion) + row('Identification Marks', r.marks) + row('Habits / Languages / Other', r.habits))}
      ${sec('5. Present Case', row('Case', c ? c.name : '') + row('FIR', this.firTxt(r)) + row('Sections of Law', r.sections || (c && c.section)) + row('Role in Crime', r.role) + row('Notice 35(3) Served On', this.dmy(r.noticeDate)) + row('Appeared On', this.dmy(r.appearDate)) + row('Arrested On / Place', [this.dmy(r.arrestDate), r.arrestPlace].filter(Boolean).join(' · ')) + row('Bail', r.bail))}
      ${sec('6. Criminal History', row('Earlier Cases', r.history || 'Nil') + row('Earlier Went to Jail', r.jail) + row('Jail Details', r.jail === 'Yes' ? r.jailDetails : ''))}
      ${sec('7. Advocate Details', row('Advocate', r.advName) + row('Mobile', r.advMobile) + row('Bar Enrolment No.', r.advEnrol) + row('Address / Court', r.advAddr))}
      ${(r.recovery || []).length ? `<h3>8. Recovery / Seizure</h3><table class="dz-t dz-r"><tr><th>S. No.</th><th>Category</th><th>Details</th><th>Quantity / Value</th><th>Recovered On</th><th>Place / Seizure Memo No.</th></tr>${r.recovery.map((o, i) => `<tr><td>${i + 1}</td><td>${esc(String(o.cat || '').replace(/^[^\p{L}\p{N}]+\s/u, ''))}</td><td>${esc(o.det || '')}</td><td>${esc(o.qty || '')}</td><td>${esc(this.dmy(o.on))}</td><td>${esc(o.memo || '')}</td></tr>`).join('')}</table>` : sec('8. Recovery / Seizure', row('Recovery', 'Nil'))}
      ${sec('9. Other Details / Remarks', row('Remarks', r.notes))}
      <div class="dz-sign"><div>Date: ${new Date().toLocaleDateString('en-IN')}</div><div>(Signature)<br>${esc(Formats.vars({}).io || 'Investigating Officer')}<br>${esc(Formats.vars({}).io_rank || '')}</div></div>`;
  },
  CSS: `.dz{font-family:var(--dzf,'Arial');font-size:var(--dzs,11pt);color:#111;background:#fff;line-height:1.35}.dz h2.dz-title{text-align:center;margin:8px 0 10px;font-size:1.45em;letter-spacing:1px;text-decoration:underline}.dz h2.dz-title span{font-size:.75em;letter-spacing:0;text-decoration:none}
    .dz h3::before,.dz h2::before{content:none!important;display:none!important}.dz h2,.dz h3,.dz th,.dz td{color:#111!important}.dz h3{font-size:1.08em;margin:12px 0 4px;background:#e2e8f0;padding:3px 6px;border-left:4px solid #1e3a8a}.dz table{border-collapse:collapse;width:100%}.dz .dz-t th,.dz .dz-t td{border:1px solid #64748b;padding:4px 7px;vertical-align:top;text-align:left}.dz .dz-r th{width:auto!important}.dz .dz-t th{width:34%;background:#f8fafc;font-weight:600}
    .dz .dz-top>tbody>tr>td{vertical-align:top;border:0;padding:0}.dz .dz-phc{width:150px;padding-left:10px!important}.dz .dz-ph{width:140px;height:170px;border:1.5px solid #334155;display:flex;align-items:center;justify-content:center;overflow:hidden;text-align:center;color:#64748b;font-size:.85em}.dz .dz-ph img{width:100%;height:100%;object-fit:cover}
    .dz .dz-sign{display:flex;justify-content:space-between;margin-top:34px;text-align:right}.dz .dz-sign div:first-child{text-align:left}`,
  async dossier(el) {
    const L = await this.list(), cur = this._pick && L.some(r => r.id === this._pick) ? this._pick : (L[0] || {}).id; this._pick = cur;
    const r = L.find(x => x.id === cur), D = r && r.dz || {}, f = D.f || 'Arial', s = D.s || 11;
    el.innerHTML = `<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><b>📘 Criminal Dossier</b>${this.picker(L, cur)}<span class="spacer"></span>${r ? '<button class="btn" id="dzEd">✏ Accused Details</button>' : ''}<button class="btn primary" id="arAdd3">➕ Add Accused</button></div>
      ${r ? `<div class="dz-tb"><label>Font Type<select id="dzF" data-nov>${this.FONTS.map(x => `<option ${x === f ? 'selected' : ''} style="font-family:'${x}'">${x}</option>`).join('')}</select></label><label>Font Size<select id="dzS" data-nov>${[9, 10, 10.5, 11, 12, 13, 14, 16].map(x => `<option value="${x}" ${+x === +s ? 'selected' : ''}>${x} pt</option>`).join('')}</select></label>
        <span class="dz-grp"><button class="btn sm" data-cmd="bold" title="Bold"><b>B</b></button><button class="btn sm" data-cmd="italic" title="Italic"><i>I</i></button><button class="btn sm" data-cmd="underline" title="Underline"><u>U</u></button><button class="btn sm" data-cmd="justifyLeft" title="Left">⬅</button><button class="btn sm" data-cmd="justifyCenter" title="Centre">↔</button><button class="btn sm" data-cmd="justifyRight" title="Right">➡</button><button class="btn sm" data-cmd="increaseFontSize" title="Bigger selected text">A+</button><button class="btn sm" data-cmd="decreaseFontSize" title="Smaller selected text">A−</button><button class="btn sm" data-cmd="undo" title="Undo">↶</button></span>
        <button class="btn sm" id="dzPh">📷 ${r.photo ? 'Change' : 'Insert'} Photo</button><button class="btn sm" id="dzRe" title="Build again from the accused details (your edits are replaced)">↺ Fresh From Details</button><button class="btn sm" id="dzSv">💾 Save Edits</button><button class="btn sm primary" id="dzPr">🖨 Print / PDF</button><button class="btn sm" id="dzW">📄 Word</button><button class="btn sm" id="dzH">🌐 HTML</button><button class="btn sm" id="dzAll" title="Every accused, one dossier per page">🖨 Print All Dossiers (${L.length})</button></div>
        <div class="small muted">Click anywhere in the dossier to type or change text. ${D.html ? '✏ Your saved edits are shown.' : ''}</div><div class="dz-wrap"><div class="dz" id="dzDoc" contenteditable="true" spellcheck="false" style="--dzf:'${f}';--dzs:${s}pt"></div></div>` : '<div class="muted" style="margin-top:12px">Add the accused first (➕ Add Accused); the dossier is made from the details, with the photo.</div>'}</div>`;
    const redraw = () => this.dossier(el);
    if ($('#arPick', el)) $('#arPick', el).onchange = e => { this._pick = e.target.value; redraw(); };
    $('#arAdd3', el).onclick = () => this.edit(null, redraw);
    if (!r) return;
    const doc = $('#dzDoc', el); doc.innerHTML = D.html || await this.dossierHtml(r);
    if (!$('#dzCss')) document.head.insertAdjacentHTML('beforeend', `<style id="dzCss">${this.CSS}</style>`);
    $('#dzEd', el).onclick = () => this.edit(r, redraw);
    $('#dzF', el).onchange = e => doc.style.setProperty('--dzf', `'${e.target.value}'`);
    $('#dzS', el).onchange = e => doc.style.setProperty('--dzs', e.target.value + 'pt');
    $$('[data-cmd]', el).forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { doc.focus(); document.execCommand(b.dataset.cmd, false, null); }; });
    const save = async quiet => { r.dz = { html: doc.innerHTML, f: $('#dzF', el).value, s: +$('#dzS', el).value }; await Off.put('accused'); if (!quiet) UI.toast('💾 Dossier saved'); };
    $('#dzSv', el).onclick = () => save();
    $('#dzRe', el).onclick = async () => { if (D.html && !UI.confirm('Build the dossier again from the accused details? Your typed edits will be replaced.')) return; doc.innerHTML = await this.dossierHtml(r); r.dz = { f: $('#dzF', el).value, s: +$('#dzS', el).value }; await Off.put('accused'); };
    $('#dzPh', el).onclick = () => this.photoPick(async d => { r.photo = d; const ph = $('.dz-ph', doc); if (ph) ph.innerHTML = `<img src="${d}">`; await Off.put('accused'); UI.toast('Photo added'); });
    const page = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Criminal Dossier – ${esc(r.name)}</title><style>@page{size:A4;margin:1.6cm}body{margin:0}${this.CSS}</style></head><body><div class="dz" style="--dzf:'${$('#dzF', el).value}';--dzs:${$('#dzS', el).value}pt;font-family:'${$('#dzF', el).value}',Arial;font-size:${$('#dzS', el).value}pt">${doc.innerHTML}</div></body></html>`;
    const nm = 'Criminal_Dossier_' + (r.name || 'accused').replace(/[^\w]+/g, '_');
    $('#dzPr', el).onclick = () => { const w = window.open('', '_blank'); if (!w) return UI.toast('Pop-up blocked. Allow pop-ups for this page.'); w.document.write(page()); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400); };
    $('#dzW', el).onclick = () => UI.download(nm + '.doc', page().replace(/<style>/, '<style>.dz .dz-ph{width:140px;height:170px}'), 'application/msword');
    $('#dzH', el).onclick = () => UI.download(nm + '.html', page(), 'text/html');
    $('#dzAll', el).onclick = async () => { const w = window.open('', '_blank'); if (!w) return UI.toast('Pop-up blocked. Allow pop-ups for this page.'); const parts = []; for (const a of L) parts.push(`<div class="dz" style="--dzf:'${(a.dz && a.dz.f) || 'Arial'}';--dzs:${(a.dz && a.dz.s) || 11}pt;font-family:'${(a.dz && a.dz.f) || 'Arial'}',Arial;font-size:${(a.dz && a.dz.s) || 11}pt;page-break-after:always">${a.dz && a.dz.html || await this.dossierHtml(a)}</div>`);
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Criminal Dossiers (${L.length})</title><style>@page{size:A4;margin:1.6cm}body{margin:0}${this.CSS}</style></head><body>${parts.join('')}</body></html>`); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 500); };
  }
};
PAGE_META.arrest = { group: 'Action', title: 'Arrest / Notice 35(3)', desc: 'Accused and criminal details for every case: Smart Overview, full details table, Notice u/s 35(3) BNSS and a printable Criminal Dossier with photo.', order: ['over', 'list', 'notice', 'dossier'], names: { over: '📊 Smart Overview', list: '🧑‍⚖️ Accused / Criminal Details', notice: '📨 Notice 35(3) BNSS', dossier: '📘 Criminal Dossier' } };
Pages.arrest = main => { const { cur, body } = tabs(main, 'arrest', Object.entries(PAGE_META.arrest.names), '⛓ Arrest / Notice 35(3)'); if (cur !== 'notice') { const db = $('.tabs + .df-bar', main); if (db) db.remove(); } ({ over: () => Arrest.over(body), list: () => Arrest.table(body), notice: () => Arrest.notice(body), dossier: () => Arrest.dossier(body) })[cur](); };
if (PAGE_META.others) PAGE_META.others.group = 'Investigation';
if (PAGE_META.cctns) PAGE_META.cctns.group = 'Investigation';

/* ---------- sidebar ---------- */
(() => {
  const nav = $('#sidebar'); if (!nav) return;
  const mk = (cls, ico, label, tip, c) => `<div class="nav-item ${cls}" title="${esc(tip)}" style="--c:${c}"><span class="nib">${ico}</span><span>${esc(label)}</span><span class="nav-chev">▾</span></div><div class="nav-subs ${cls.replace('-item', '-subs')}"></div>`;
  const drop = (it, subs, key, isOn) => {
    const setOpen = on => { S[key] = on; subs.classList.toggle('open', on); it.classList.toggle('open', on); }; setOpen(false);
    it.addEventListener('click', e => { e.stopImmediatePropagation(); setOpen(!S[key]); }, true);
    const or = render; render = function () { const r = or.apply(this, arguments); const on = isOn(); it.classList.toggle('active', on); if (on && !S[key]) setOpen(true); return r; };
  };
  /* 1. IO – Investigation Officer = CCTNS + Case File & Notices */
  const cct = $('.cctns-item', nav), ccs = $('.cctns-subs', nav), cf = $('.nav-item[data-page="others"]', nav), cfs = $('.cf-subs', nav);
  const anchor = cct || $('.lea-subs', nav);
  if (anchor) {
    (cct || anchor).insertAdjacentHTML(cct ? 'beforebegin' : 'afterend', mk('io-item', '👮', 'IO – Investigation Officer', 'IO – Investigation Officer: CCTNS Case Diary, Case File & Drafts, Notice Format, Memo, Upload Formats +', '#0ea5e9'));
    const io = $('.io-item', nav), ios = $('.io-subs', nav);
    NavCustom.busy = true;
    try { [...(ccs ? ccs.children : []), ...(cfs ? cfs.children : [])].filter(n => n.classList.contains('nav-sub') && !n.matches('.nc-edit, .nc-x, .sop-upl')).forEach(n => { if (n.dataset.cct === 'diary') { const sp = n.querySelector('span'); if (sp) sp.textContent = 'Case Diary (CCTNS)'; } ios.appendChild(n); });
      [...ios.children].forEach((n, i) => { const sp = n.querySelector('span'); if (!sp) return; sp.textContent = sp.textContent.replace(/^\s*\d+\.\s*/, ''); delete n.dataset.ncOrig; delete n.dataset.ncI; });
      [cct, ccs, cf, cfs].forEach(x => x && x.remove()); } finally { NavCustom.busy = false; }
    drop(io, ios, 'ioOpen', () => ['cctns', 'others', 'formats'].includes(S.page));
    ios.insertAdjacentHTML('afterend', `<div class="nav-item" data-page="eo" title="EO – Enquiry Officer: enquiries, enquiry report and status" style="--c:#0891b2"><span class="nib">🕵</span><span>EO – Enquiry Officer</span></div>`);
    const eo = $('.nav-item[data-page="eo"]', nav); eo.onclick = () => go('eo');
    const or = render; render = function () { const r = or.apply(this, arguments);
      $$('[data-cct]', ios).forEach(n => n.classList.toggle('active', S.page === 'cctns' && (S.sub.cctns || 'diary') === n.dataset.cct));
      $$('[data-cf]', ios).forEach(n => { const [p, s] = n.dataset.cf.split('|'); n.classList.toggle('active', S.page === p && (!s || (S.sub.formats || 'notice') === s)); }); return r; };
  }
  /* 2. Action › Arrest / Notice 35(3) */
  const grp = $$('.nav-group', nav).find(g => /^action$/i.test(g.textContent.trim()));
  if (grp) {
    grp.insertAdjacentHTML('afterend', mk('arrest-item', '⛓️', 'Arrest / Notice 35(3)', 'Arrest / Notice 35(3) BNSS – Smart Overview, accused & criminal details, notice, Criminal Dossier with photo', '#dc2626'));
    const it = $('.arrest-item', nav), subs = $('.arrest-subs', nav);
    subs.innerHTML = Object.entries(PAGE_META.arrest.names).map(([k, l], i) => `<div class="nav-sub" data-arr="${k}" style="--pc:${['#6366f1', '#dc2626', '#3b82f6', '#0f766e'][i]}"><i></i><span>${esc(l.replace(/^\S+\s/, ''))}</span></div>`).join('');
    $$('[data-arr]', subs).forEach(n => n.onclick = () => go('arrest', n.dataset.arr));
    drop(it, subs, 'arOpen', () => S.page === 'arrest');
    const or = render; render = function () { const r = or.apply(this, arguments); $$('[data-arr]', subs).forEach(n => n.classList.toggle('active', S.page === 'arrest' && (S.sub.arrest || 'over') === n.dataset.arr)); return r; };
  }
})();
