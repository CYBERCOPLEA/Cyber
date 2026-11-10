/* offx.js - Office drop-down: Search in Local Drive, Good Work, Press Note, Crime Data, Duty Chart, Upload +.
   Office data is the same in every case and stays on this computer (IndexedDB). */
const Off = {
  OFFICE: 'Cyber Crime Police Station, Police Commissionerate Ghaziabad',
  D: {},
  async get(k, def) { if (!(k in this.D)) { try { this.D[k] = (await DB.get('off:' + k)) ?? def; } catch (e) { this.D[k] = def; } } return this.D[k]; },
  async put(k) { await DB.set('off:' + k, this.D[k]); },
  today() { return new Date().toISOString().slice(0, 10); },
  dmy(d) { return d ? String(d).slice(0, 10).split('-').reverse().join('-') : ''; },
  inr(n) { return fmtINR(+n || 0); },
  // a row of the office header (logo + office name) used by press note, duty chart, good work
  async cfg() { return this.get('cfg', { office: this.OFFICE, logo: '' }); },

  /* ================= Upload + (files by section) ================= */
  SEC: ['Good Work', 'Press Note', 'Duty Chart', 'Crime Data', 'Others'],
  async files() { return this.get('files', []); },
  async filesBox(el, section, redraw) {
    const list = await this.files();
    el.innerHTML = `<div class="card of-files"><div class="row" style="gap:8px;flex-wrap:wrap"><h3 class="grow" style="margin:0">📎 ${section ? esc(section) + ' – files' : 'Upload + <span class="badge">' + list.length + ' files</span>'}</h3>
        <label class="small muted">Section</label><select class="of-sec"></select><button class="btn primary of-up">⬆ Upload from PC</button></div>
      <div class="of-drop small muted">…or drop files here (Word, PDF, Excel, photos – anything)</div>
      ${section ? '' : '<div class="row" style="gap:6px;margin:8px 0"><input class="of-q" placeholder="Find file…" style="flex:1"><select class="of-f"><option value="">All sections</option></select></div>'}<div class="of-list"></div></div>`;
    const sel = $('.of-sec', el); EditList.attach(sel, 'off-sec', this.SEC, 'Office sections'); if (section) { if (![...sel.options].some(o => o.value === section)) sel.insertAdjacentHTML('afterbegin', `<option>${esc(section)}</option>`); sel.value = section; }
    if (!section) { const f = $('.of-f', el); f.innerHTML += uniq(list.map(x => x.sec)).map(s => `<option>${esc(s)}</option>`).join(''); }
    const add = async fs => { for (const f of fs) { const id = 'o' + uid(); await DB.set('offf:' + id, f); list.push({ id, name: f.name, size: f.size, sec: sel.value, added: new Date().toISOString() }); } await this.put('files'); UI.toast(fs.length + ' file(s) kept in ' + sel.value); (redraw || (() => this.filesBox(el, section)))(); };
    $('.of-up', el).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.onchange = () => add([...i.files]); i.click(); };
    const dz = $('.of-drop', el); dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); add([...e.dataTransfer.files]); };
    const draw = () => { const q = section ? '' : $('.of-q', el).value.toLowerCase(), fs = section || $('.of-f', el).value;
      const L = list.filter(x => (!fs || x.sec === fs) && (!q || (x.name + ' ' + (x.note || '')).toLowerCase().includes(q))).slice().reverse();
      $('.of-list', el).innerHTML = L.length ? `<table class="tbl fu-t"><thead><tr><th>File</th>${section ? '' : '<th>Section</th>'}<th>Size</th><th>Added</th><th></th></tr></thead><tbody>${L.map(x => `<tr><td><b>${esc(x.name)}</b>${x.note ? `<div class="small muted">${esc(x.note)}</div>` : ''}</td>${section ? '' : `<td><span class="fm-tag">${esc(x.sec)}</span></td>`}<td class="small">${SOP.size(x.size)}</td><td class="small">${this.dmy(x.added)}</td><td class="fu-acts"><button class="btn sm" data-o="${x.id}">Open</button><button class="btn sm" data-r="${x.id}">✏ Rename / move</button><button class="btn sm danger" data-d="${x.id}">🗑</button></td></tr>`).join('')}</tbody></table>` : '<div class="muted small" style="margin-top:6px">No files yet.</div>';
      const get = id => list.find(x => x.id === id);
      $$('[data-o]', el).forEach(b => b.onclick = async () => { const x = get(b.dataset.o), f = await DB.get('offf:' + x.id); if (!f) return UI.toast('File not found'); const u = URL.createObjectURL(f); if (/\.(pdf|png|jpe?g|gif|webp|txt|html?)$/i.test(x.name)) window.open(u, '_blank'); else { const a = document.createElement('a'); a.href = u; a.download = x.name; a.click(); } setTimeout(() => URL.revokeObjectURL(u), 60000); });
      $$('[data-r]', el).forEach(b => b.onclick = () => { const x = get(b.dataset.r), m = UI.modal('✏ File', `<div class="map-grid"><label>Name<input id="ofN" value="${esc(x.name)}"></label><label>Section<select id="ofS"></select></label><label style="grid-column:1/-1">Note<input id="ofT" value="${esc(x.note || '')}"></label></div>`, [{ label: 'Cancel', onClick: UI.closeModal }, { label: 'Save', cls: 'primary', onClick: async () => { x.name = $('#ofN', m).value.trim() || x.name; x.sec = $('#ofS', m).value; x.note = $('#ofT', m).value.trim(); await this.put('files'); UI.closeModal(); draw(); } }]);
        EditList.attach($('#ofS', m), 'off-sec', this.SEC, 'Office sections'); if (![...$('#ofS', m).options].some(o => o.value === x.sec)) $('#ofS', m).insertAdjacentHTML('afterbegin', `<option>${esc(x.sec)}</option>`); $('#ofS', m).value = x.sec; });
      $$('[data-d]', el).forEach(b => b.onclick = async () => { const x = get(b.dataset.d); if (!UI.confirm(`Delete "${x.name}"?`)) return; list.splice(list.indexOf(x), 1); await DB.del('offf:' + x.id); await this.put('files'); draw(); }); };
    if (!section) { $('.of-q', el).oninput = draw; $('.of-f', el).onchange = draw; }
    draw();
  },

  /* ================= Good Work ================= */
  GW_CAT: ['Arrest', 'Refund to victim', 'Debit freeze / hold', 'Recovery / seizure', 'Gang busted', 'SIM / IMEI / account blocked', 'Awareness programme', 'Other'],
  async good(el) {
    const L = await this.get('good', []), st = this._gw || (this._gw = { m: '', q: '', c: '' });
    const months = uniq(L.map(x => (x.date || '').slice(0, 7)).filter(Boolean)).sort().reverse();
    const F = L.filter(x => (!st.m || (x.date || '').startsWith(st.m)) && (!st.c || x.cat === st.c) && (!st.q || JSON.stringify(x).toLowerCase().includes(st.q.toLowerCase())));
    const tot = k => F.reduce((a, x) => a + (+x[k] || 0), 0);
    el.innerHTML = `<div class="card gw-top"><div class="row" style="gap:8px;flex-wrap:wrap"><h3 class="grow" style="margin:0">🏅 Good Work</h3><button class="btn primary" id="gwAdd">➕ New good work</button><button class="btn" id="gwCase">⤵ From the open case</button><button class="btn" id="gwRep">📝 Write-up of shown entries</button></div>
        <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><select id="gwM"><option value="">All months</option>${months.map(m => `<option value="${m}" ${m === st.m ? 'selected' : ''}>${new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>`).join('')}</select><select id="gwC"><option value="">All types</option>${uniq([...this.GW_CAT, ...L.map(x => x.cat)]).map(c => `<option ${c === st.c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><input id="gwQ" placeholder="Search name, FIR, officer…" value="${esc(st.q)}" style="flex:1;min-width:200px"></div></div>
      ${UI.kpis([['Good work entries', fmtNum(F.length)], ['Persons arrested', fmtNum(tot('arrested'))], ['Refunded to victims', this.inr(tot('refunded')), '', 'good'], ['Frozen / on hold', this.inr(tot('frozen'))], ['Items recovered', fmtNum(tot('items'))], ['Victims helped', fmtNum(tot('victims'))]])}
      <div class="grid g2" style="gap:14px"><div class="card"><h3>By type</h3><div id="gwCh1"></div></div><div class="card"><h3>By month</h3><div id="gwCh2"></div></div></div>
      <div class="card"><h3>Entries <span class="badge">${F.length}</span></h3><div id="gwT"></div></div><div id="gwFiles"></div>`;
    $('#gwM', el).onchange = e => { st.m = e.target.value; this.good(el); }; $('#gwC', el).onchange = e => { st.c = e.target.value; this.good(el); };
    $('#gwQ', el).onchange = e => { st.q = e.target.value; this.good(el); };
    const by = (f) => [...groupBy(F, f)].map(([label, l]) => ({ label: label || '—', value: l.length, recs: l })).sort((a, b) => b.value - a.value);
    if (F.length) { Charts.hbar($('#gwCh1', el), by(x => x.cat)); Charts.hbar($('#gwCh2', el), by(x => (x.date || '').slice(0, 7)).sort((a, b) => a.label.localeCompare(b.label))); } else { $('#gwCh1', el).innerHTML = $('#gwCh2', el).innerHTML = '<div class="muted small">No entries yet.</div>'; }
    Table($('#gwT', el), { rows: F, pageSize: 25, exportName: 'good_work', sortKey: 'date', sortDir: -1, onRow: r => this.gwEdit(r, el), columns: [
      { key: 'date', label: 'Date', render: r => this.dmy(r.date) }, { key: 'cat', label: 'Type', render: r => `<span class="fm-tag">${esc(r.cat || '')}</span>` }, { key: 'title', label: 'Good work', render: r => `<b>${esc(r.title || '')}</b>${r.desc ? `<div class="small muted">${esc(r.desc.slice(0, 120))}${r.desc.length > 120 ? '…' : ''}</div>` : ''}` },
      { key: 'fir', label: 'FIR' }, { key: 'arrested', label: 'Arrested', num: true }, { key: 'refunded', label: 'Refunded', num: true, render: r => r.refunded ? this.inr(r.refunded) : '' }, { key: 'frozen', label: 'On hold', num: true, render: r => r.frozen ? this.inr(r.frozen) : '' }, { key: 'team', label: 'Team' }] });
    $('#gwAdd', el).onclick = () => this.gwEdit(null, el);
    $('#gwCase', el).onclick = () => { const c = activeCase(), d = S.data; let acc = []; try { acc = CCTNS.accused().map(a => a.name); } catch (e) { }
      this.gwEdit({ date: this.today(), cat: 'Debit freeze / hold', title: `${c.name || 'Case'} – ${c.fir ? 'FIR ' + c.fir : ''}`, fir: c.fir || '', sections: c.section || '', team: [c.io_rank, c.io].filter(Boolean).join(' '), frozen: sum(d.txns || [], t => +t.hold || 0), victims: uniq((d.ncrp || []).map(n => n.ack_no)).length, accused: acc.join(', '), desc: '' }, el, true); };
    $('#gwRep', el).onclick = async () => { const cf = await this.cfg(); const t = `GOOD WORK REPORT\n${cf.office.toUpperCase()}\n${st.m ? 'Month: ' + new Date(st.m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Date: ' + this.dmy(this.today())}\n\nSubject: Good work done by ${cf.office}\n\nSummary: ${F.length} good work(s) · ${tot('arrested')} arrested · ${this.inr(tot('refunded'))} refunded to victims · ${this.inr(tot('frozen'))} put on hold · ${tot('items')} items recovered.\n\n` + F.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((x, i) => `${i + 1}. ${this.dmy(x.date)} – ${x.title || ''} (${x.cat || ''})${x.fir ? '\n   FIR: ' + x.fir + (x.sections ? ' u/s ' + x.sections : '') : ''}${x.accused ? '\n   Accused: ' + x.accused : ''}${x.arrested ? '\n   Arrested: ' + x.arrested : ''}${x.refunded ? '\n   Refunded: ' + this.inr(x.refunded) : ''}${x.frozen ? '\n   On hold: ' + this.inr(x.frozen) : ''}${x.recovery ? '\n   Recovered: ' + x.recovery : ''}${x.desc ? '\n   ' + x.desc : ''}${x.team ? '\n   Team: ' + x.team : ''}`).join('\n\n');
      this.textDrawer('Good work report', t, 'good_work_report'); };
    this.filesBox($('#gwFiles', el), 'Good Work');
  },
  gwEdit(r, el, isNew) {
    const L = this.D.good, x = r && !isNew ? r : { id: null, ...(r || { date: this.today() }) };
    const f = (k, l, type = 'text', w = '') => `<label ${w}>${l}<input data-g="${k}" type="${type}" value="${esc(x[k] ?? '')}"></label>`;
    const m = UI.modal(x.id ? '✏ Good work' : '➕ New good work', `<div class="map-grid gw-form">${f('date', 'Date', 'date')}<label>Type<select data-g="cat"></select></label>${f('title', 'Good work (headline)', 'text', 'style="grid-column:span 2"')}${f('fir', 'FIR / Case No')}${f('sections', 'Sections')}${f('arrested', 'Persons arrested', 'number')}${f('accused', 'Accused names')}${f('refunded', 'Refunded to victims (₹)', 'number')}${f('frozen', 'Frozen / on hold (₹)', 'number')}${f('items', 'Items recovered (count)', 'number')}${f('recovery', 'Recovered items (mobiles, SIMs, cards…)')}${f('victims', 'Victims helped', 'number')}${f('team', 'Team / officers')}
      <label style="grid-column:1/-1">Details<textarea data-g="desc" style="min-height:120px">${esc(x.desc || '')}</textarea></label></div>`,
      [...(x.id ? [{ label: '🗑 Delete', cls: 'danger', onClick: async () => { if (!UI.confirm('Delete this good work entry?')) return; L.splice(L.indexOf(r), 1); await this.put('good'); UI.closeModal(); this.good(el); } }] : []), { label: 'Cancel', onClick: UI.closeModal }, { label: 'Save', cls: 'primary', onClick: async () => {
        $$('[data-g]', m).forEach(i => x[i.dataset.g] = i.type === 'number' ? (i.value === '' ? '' : +i.value) : i.value.trim()); if (!x.title) return UI.toast('Write the headline first');
        if (!x.id) { x.id = uid() + ''; L.push(x); } else Object.assign(r, x); await this.put('good'); UI.closeModal(); UI.toast('Saved'); this.good(el); } }]);
    EditList.attach($('[data-g="cat"]', m), 'gw-cat', this.GW_CAT, 'Good work types'); if (x.cat) { const s = $('[data-g="cat"]', m); if (![...s.options].some(o => o.value === x.cat)) s.insertAdjacentHTML('afterbegin', `<option>${esc(x.cat)}</option>`); s.value = x.cat; }
  },
  textDrawer(title, text, file) {
    const b = UI.drawer(title, `<textarea id="otx" style="min-height:520px"></textarea><div class="row nt-btns" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button class="btn" id="otP">🖨 Print / PDF</button><button class="btn" id="otW">⬇ Word (.docx)</button><button class="btn" id="otC">Copy</button></div>`);
    $('#drawer').classList.add('dx-wide'); const ta = $('#otx', b); ta.value = text;
    NoticeKit.tools($('.nt-btns', b), ta, {}); $('#otP', b).onclick = () => NoticeKit.print(ta.value); $('#otW', b).onclick = () => NoticeKit.docx(file + '.docx', ta.value); $('#otC', b).onclick = () => { navigator.clipboard && navigator.clipboard.writeText(ta.value); UI.toast('Copied'); };
  },

  /* ================= Press Note ================= */
  async press(el) {
    const L = await this.get('press', []), cf = await this.cfg(), good = await this.get('good', []), U = this._pn || (this._pn = { id: null });
    const cur = L.find(x => x.id === U.id);
    const f = (k, l, v = '', w = '') => `<label ${w}>${l}<input data-p="${k}" value="${esc(v)}"></label>`, ta = (k, l, v = '') => `<label style="grid-column:1/-1">${l}<textarea data-p="${k}" style="min-height:70px">${esc(v)}</textarea></label>`;
    const P = (cur && cur.f) || { from: cf.office, date: this.today(), appeal: 'Citizens are requested not to share OTP, PIN or bank details with anyone, not to click unknown links or install unknown apps (APK), and not to invest on the advice of strangers on WhatsApp / Telegram. In case of any cyber fraud, immediately call the National Cyber Crime Helpline 1930 or report at www.cybercrime.gov.in.' };
    el.innerHTML = `<div class="pn-grid"><div class="card pn-form"><div class="row" style="gap:6px;flex-wrap:wrap"><h3 class="grow" style="margin:0">📰 Press Note</h3><button class="btn sm" id="pnNew">➕ New</button><button class="btn sm" id="pnCase">⤵ From open case</button><select id="pnGood" class="sm"><option value="">⤵ From good work…</option>${good.slice().reverse().map(g => `<option value="${g.id}">${esc(this.dmy(g.date) + ' – ' + (g.title || ''))}</option>`).join('')}</select></div>
        <div class="map-grid" style="margin-top:8px">${f('from', 'From', P.from, 'style="grid-column:1/-1"')}${f('date', 'Date', P.date)}${f('fir', 'FIR / Case No', P.fir)}${f('head', 'Headline', P.head, 'style="grid-column:1/-1"')}${f('sections', 'Sections', P.sections)}${f('amount', 'Amount involved (₹)', P.amount)}
          ${ta('facts', 'Brief facts / modus operandi', P.facts)}${ta('accused', 'Accused arrested (one per line: name, father, address)', P.accused)}${ta('recovery', 'Recovery (mobiles, SIMs, cards, cash…)', P.recovery)}${f('team', 'Team (officers)', P.team, 'style="grid-column:1/-1"')}${ta('appeal', 'Appeal to public', P.appeal)}</div>
        <div class="row" style="margin-top:8px;gap:6px"><button class="btn primary" id="pnMake">✨ Make press note</button></div>
        <h3 style="margin-top:14px">Saved press notes <span class="badge">${L.length}</span></h3><div class="pn-list">${L.slice().reverse().map(x => `<div class="nt-item ${x.id === U.id ? 'on' : ''}" data-pn="${x.id}"><div class="grow"><b>${esc(x.title || 'Press note')}</b><div class="small muted">${this.dmy(x.date)}</div></div><button class="btn sm danger" data-pd="${x.id}">🗑</button></div>`).join('') || '<div class="small muted">None yet.</div>'}</div></div>
      <div class="card pn-ed"><h3>Draft</h3><textarea id="pnOut" style="min-height:560px">${esc(cur ? cur.text : '')}</textarea>
        <div class="row nt-btns" id="pnBtns" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button class="btn primary" id="pnSave">💾 Save</button><button class="btn" id="pnPr">🖨 Print / PDF</button><button class="btn" id="pnWd">⬇ Word (.docx)</button><button class="btn" id="pnCp">Copy</button></div></div></div><div id="pnFiles"></div>`;
    const val = () => { const o = {}; $$('[data-p]', el).forEach(i => o[i.dataset.p] = i.value.trim()); return o; };
    const set = o => $$('[data-p]', el).forEach(i => { if (o[i.dataset.p] !== undefined) i.value = o[i.dataset.p]; });
    const out = $('#pnOut', el);
    const make = () => { const o = val(), acc = o.accused.split('\n').map(s => s.trim()).filter(Boolean);
      out.value = `PRESS NOTE\n${o.from.toUpperCase()}\nDate: ${this.dmy(o.date)}\n\n${(o.head || 'Headline').toUpperCase()}\n\n` +
        `${o.facts || '____________'}${o.fir ? `\n\nIn this matter, ${o.fir}${o.sections ? ' under ' + o.sections : ''} was registered at ${o.from}.` : ''}${o.amount ? ` The amount involved is ${this.inr(o.amount)}.` : ''}` +
        (acc.length ? `\n\nDuring investigation, the following accused ${acc.length > 1 ? 'have' : 'has'} been arrested:\n${acc.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : '') +
        (o.recovery ? `\n\nRecovered from the accused: ${o.recovery}` : '') + (o.team ? `\n\nTeam: ${o.team}` : '') + (o.appeal ? `\n\nAPPEAL TO THE PUBLIC\n${o.appeal}` : '') + `\n\n\nMedia Cell\n${o.from}`; out.dispatchEvent(new Event('input')); };
    $('#pnMake', el).onclick = make;
    $('#pnNew', el).onclick = () => { U.id = null; this.press(el); };
    $('#pnCase', el).onclick = () => { const c = activeCase(), d = S.data; let acc = []; try { acc = CCTNS.accused().map(a => [a.name, a.addr].filter(Boolean).join(', ')); } catch (e) { }
      set({ fir: c.fir ? 'FIR No. ' + c.fir : '', sections: c.section || '', amount: sum(d.ncrp || [], n => +n.amount || 0) || '', accused: acc.join('\n'), team: [c.io_rank, c.io].filter(Boolean).join(' '), head: c.name || '' }); make(); };
    $('#pnGood', el).onchange = e => { const g = good.find(x => x.id === e.target.value); if (!g) return; set({ head: g.title, date: g.date, fir: g.fir ? 'FIR No. ' + g.fir : '', sections: g.sections || '', accused: (g.accused || '').split(/,\s*/).join('\n'), recovery: g.recovery || '', team: g.team || '', facts: g.desc || '', amount: g.refunded || g.frozen || '' }); make(); e.target.value = ''; };
    $('#pnSave', el).onclick = async () => { if (!out.value.trim()) return UI.toast('Make the press note first'); const o = val(); let x = L.find(y => y.id === U.id); if (!x) { x = { id: uid() + '' }; L.push(x); U.id = x.id; } Object.assign(x, { title: o.head || 'Press note', date: o.date, f: o, text: out.value }); await this.put('press'); UI.toast('Press note saved'); this.press(el); };
    $$('[data-pn]', el).forEach(n => n.onclick = e => { if (e.target.closest('button')) return; U.id = n.dataset.pn; this.press(el); });
    $$('[data-pd]', el).forEach(b => b.onclick = async () => { if (!UI.confirm('Delete this press note?')) return; L.splice(L.findIndex(x => x.id === b.dataset.pd), 1); if (U.id === b.dataset.pd) U.id = null; await this.put('press'); this.press(el); });
    $('#pnPr', el).onclick = () => NoticeKit.print(out.value); $('#pnWd', el).onclick = () => NoticeKit.docx('press_note_' + (val().date || '') + '.docx', out.value); $('#pnCp', el).onclick = () => { navigator.clipboard && navigator.clipboard.writeText(out.value); UI.toast('Copied'); };
    NoticeKit.tools($('#pnBtns', el), out, {});
    if (!cur && !out.value) make();
    this.filesBox($('#pnFiles', el), 'Press Note');
  },

  /* ================= Crime Data ================= */
  CT: [['mobile', 'Mobile', '📱'], ['whatsapp', 'WhatsApp', '💬'], ['telegram', 'Telegram', '✈️'], ['email', 'E-mail', '✉️'], ['account', 'Account No', '🏦'], ['ifsc', 'IFSC', '🏛'], ['upi', 'UPI ID', '💸'], ['pan', 'PAN', '🪪'], ['aadhaar', 'Aadhaar', '🆔'], ['apk', 'APK name', '📦'], ['url', 'URL / Website', '🌐'], ['ip', 'IP address', '🖧'], ['imei', 'IMEI', '📟'], ['name', 'Name', '👤'], ['other', 'Other', '•']],
  ct(t) { return this.CT.find(x => x[0] === t) || ['other', t || 'Other', '•']; },
  norm(t, v) { v = String(v || '').trim(); if (['mobile', 'whatsapp'].includes(t)) { const m = N.mobile(v); return m || v; } if (t === 'account') return N.acc(v); if (['email', 'upi', 'url', 'apk', 'telegram'].includes(t)) return v.toLowerCase(); if (['pan', 'ifsc'].includes(t)) return v.toUpperCase(); if (t === 'aadhaar') return v.replace(/\s/g, ''); return v; },
  harvest(d, c) { // one case's data → records
    const out = [], add = (type, value, src, name) => { value = this.norm(type, value); if (!value || value.length < 3 || /^_+$/.test(value)) return; out.push({ type, value, name: name || '', caseId: c.id, case: c.name || '', fir: c.fir || '', source: src, auto: 1 }); };
    const scan = (t, src) => { for (const x of extractIdentifiers(String(t || ''))) add(x.type === 'ip' ? 'ip' : x.type, x.value, src); for (const m of String(t || '').match(/\b[\w.\-]{2,60}\.apk\b/gi) || []) add('apk', m, src); };
    for (const k of d.kyc || []) { add('account', k.acc, 'KYC', k.name); add('ifsc', k.ifsc, 'KYC', k.name); add('mobile', k.mobile, 'KYC', k.name); add('email', k.email, 'KYC', k.name); add('pan', k.pan, 'KYC', k.name); add('aadhaar', k.aadhaar, 'KYC', k.name); add('ip', k.ip, 'KYC', k.name); add('imei', k.device && /^\d{15}$/.test(k.device) ? k.device : '', 'KYC', k.name); add('name', k.name, 'KYC'); }
    for (const s of d.social || []) { const pl = String(s.platform || ''); const t = /whatsapp/i.test(pl) ? 'whatsapp' : /telegram/i.test(pl) ? 'telegram' : '';
      if (t) add(t, t === 'whatsapp' ? s.mobile || s.profile : s.profile || s.mobile, pl, s.name); if (!t || t === 'telegram') add('mobile', s.mobile, pl || 'Social media', s.name);
      add('email', s.email, pl || 'Social media', s.name); add('ip', s.ip, pl || 'Social media', s.name); add('imei', s.imei, pl || 'Social media', s.name); if (/^https?:|www\./i.test(s.profile || '')) add('url', s.profile, pl, s.name); }
    for (const n of d.ncrp || []) { for (const [k, v] of Object.entries(n)) if (/^suspect|^accused|url|website|app/i.test(k)) scan(v, 'NCRP'); }
    try { const keep = S.data; S.data = d; Analysis.invalidate(); for (const a of Analysis.accountRows()) if (a.layer > 0 && !isSynthetic(a.acc)) { add('account', a.acc, 'Money trail · L' + a.layer, a.name); add('ifsc', a.ifsc, 'Money trail', a.name); } S.data = keep; Analysis.invalidate(); } catch (e) { }
    for (const i of d.idents || []) add(i.type === 'ip' ? 'ip' : i.type, i.value, i.source || 'Extracted');
    const cc = d.cctns || {}; if (cc.fir) scan(cc.fir.text, 'FIR'); (cc.cd || []).forEach(x => scan(x.text, 'Case diary')); (cc.docs || []).forEach(x => scan(x.text, x.kind || 'Document'));
    for (const x of (d.drafts || [])) for (const m of String(x.text || '').match(/\b[\w.\-]{2,60}\.apk\b/gi) || []) add('apk', m, 'Notice draft');
    const seen = new Set(); return out.filter(r => { const k = r.type + '|' + r.value + '|' + r.source; if (seen.has(k)) return false; seen.add(k); return true; });
  },
  async rescan(quiet) {
    const R = await this.get('crime', []); const keep = R.filter(r => !r.auto); let n = 0; const all = [];
    for (const c of S.cases) { const d = c.id === S.caseId ? S.data : await DB.get('case:' + c.id); if (!d) continue; const h = this.harvest(d, c); n += h.length; all.push(...h); }
    const t = new Date().toISOString(); all.forEach(r => { r.id = 'a' + uid(); r.added = t; });
    this.D.crime = keep.concat(all); await this.put('crime'); if (!quiet) UI.toast(`${n} identifiers taken from ${S.cases.length} case(s)`); return n;
  },
  async crime(el) {
    let R = await this.get('crime', []); if (!R.length && S.cases.length) { await this.rescan(true); R = this.D.crime; }
    const st = this._cd || (this._cd = { t: '', c: '', q: '', v: 'all' });
    const F = R.filter(r => (!st.t || r.type === st.t) && (!st.c || r.caseId === st.c) && (!st.q || (r.value + ' ' + r.name + ' ' + r.source + ' ' + r.case + ' ' + (r.note || '')).toLowerCase().includes(st.q.toLowerCase())));
    const G = [...groupBy(R, r => r.type + '|' + r.value)].map(([k, l]) => { const [type, value] = k.split('|'); return { type, value, cases: uniq(l.map(x => x.caseId || x.case)), names: uniq(l.map(x => x.name).filter(Boolean)), sources: uniq(l.map(x => x.source)), recs: l }; });
    const common = G.filter(g => g.cases.length >= 2).sort((a, b) => b.cases.length - a.cases.length);
    const cnt = t => uniq(R.filter(r => r.type === t).map(r => r.value)).length;
    el.innerHTML = `<div class="card cd-top"><div class="row" style="gap:8px;flex-wrap:wrap"><h3 class="grow" style="margin:0">🗃 Crime Data – master sheet <span class="badge">${fmtNum(uniq(R.map(r => r.type + r.value)).length)} unique</span></h3>
        <button class="btn primary" id="cdScan" title="Read every case again: FIR, CCTNS case diary, money trail, KYC, NCRP, social media replies, extracted identifiers">🔄 Import from all cases</button><button class="btn" id="cdFile">📥 Import file (Excel / CSV / PDF / Word)</button><button class="btn" id="cdAdd">➕ Add entry</button><button class="btn" id="cdCols">⇆ Columns</button></div>
      <div class="cd-types">${this.CT.map(([k, l, i]) => `<button class="cd-ty ${st.t === k ? 'on' : ''}" data-t="${k}"><span>${i}</span><b>${fmtNum(cnt(k))}</b><small>${l}</small></button>`).join('')}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><div class="seg"><button class="btn sm ${st.v === 'all' ? 'primary' : ''}" data-v="all">All entries</button><button class="btn sm ${st.v === 'common' ? 'primary' : ''}" data-v="common">🔗 Common in 2+ cases <b>${common.length}</b></button><button class="btn sm ${st.v === 'case' ? 'primary' : ''}" data-v="case">📁 Case-wise</button></div>
        <select id="cdC"><option value="">All cases</option>${S.cases.map(c => `<option value="${c.id}" ${c.id === st.c ? 'selected' : ''}>${esc(c.name)}${c.fir ? ' · ' + esc(c.fir) : ''}</option>`).join('')}</select><input id="cdQ" placeholder="Search value, name, source…" value="${esc(st.q)}" style="flex:1;min-width:200px">${st.t ? `<button class="btn sm" id="cdT0">✕ ${esc(this.ct(st.t)[1])}</button>` : ''}</div></div>
      <div class="card"><div id="cdT"></div></div><div id="cdFiles"></div>`;
    const re = () => this.crime(el);
    $$('[data-t]', el).forEach(b => b.onclick = () => { st.t = st.t === b.dataset.t ? '' : b.dataset.t; re(); });
    $$('[data-v]', el).forEach(b => b.onclick = () => { st.v = b.dataset.v; re(); });
    $('#cdC', el).onchange = e => { st.c = e.target.value; re(); }; $('#cdQ', el).onchange = e => { st.q = e.target.value; re(); }; if ($('#cdT0', el)) $('#cdT0', el).onclick = () => { st.t = ''; re(); };
    $('#cdScan', el).onclick = async () => { const b = $('#cdScan', el); b.disabled = true; b.textContent = '⏳ Reading all cases…'; await this.rescan(); re(); };
    $('#cdAdd', el).onclick = () => this.cdEdit(null, re);
    $('#cdFile', el).onclick = () => this.cdImport(re);
    const COLS = [['type', 'Type'], ['value', 'Value'], ['name', 'Name / holder'], ['case', 'Case'], ['fir', 'FIR'], ['source', 'Found in'], ['note', 'Note'], ['added', 'Added'], ['seen', 'Cases']];
    const order = EditList.items('cd-cols', COLS.map(c => c[1]));
    $('#cdCols', el).onclick = () => EditList.edit('cd-cols', COLS.map(c => c[1]), 'Columns (order left → right; delete to hide)', re);
    const seen = new Map(G.map(g => [g.type + '|' + g.value, g.cases.length]));
    const colDef = { type: { key: 'type', label: 'Type', render: r => `${this.ct(r.type)[2]} ${esc(this.ct(r.type)[1])}` }, value: { key: 'value', label: 'Value', render: r => `<b class="mono cd-v" data-tr="${esc(r.value)}" title="Track this everywhere">${esc(r.value)}</b>` }, name: { key: 'name', label: 'Name / holder' }, case: { key: 'case', label: 'Case' }, fir: { key: 'fir', label: 'FIR' }, source: { key: 'source', label: 'Found in' }, note: { key: 'note', label: 'Note' }, added: { key: 'added', label: 'Added', render: r => this.dmy(r.added) + (r.by ? `<div class="small muted">${esc(r.by)}</div>` : '') }, seen: { key: 'seen', label: 'Cases', num: true, sortVal: r => seen.get(r.type + '|' + r.value) || 1, render: r => { const n = seen.get(r.type + '|' + r.value) || 1; return n > 1 ? `<span class="cd-hot">${n} cases</span>` : '1'; } } };
    const lab2key = Object.fromEntries(COLS.map(c => [c[1], c[0]]));
    const bind = () => $$('.cd-v', el).forEach(v => v.onclick = e => { e.stopPropagation(); typeof Dash2 !== 'undefined' && Dash2.track(v.dataset.tr); });
    if (st.v === 'common') {
      const C = common.filter(g => (!st.t || g.type === st.t) && (!st.q || (g.value + ' ' + g.names.join(' ')).toLowerCase().includes(st.q.toLowerCase())) && (!st.c || g.cases.includes(st.c)));
      Table($('#cdT', el), { rows: C, pageSize: 50, exportName: 'crime_data_common', sortKey: 'n', sortDir: -1, after: bind, onRow: g => Records.show(this.ct(g.type)[1] + ' ' + g.value, g.recs.map(r => ({ value: r.value, case: r.case, fir: r.fir, source: r.source, name: r.name }))), columns: [
        { key: 'type', label: 'Type', render: g => `${this.ct(g.type)[2]} ${esc(this.ct(g.type)[1])}` }, { key: 'value', label: 'Value', render: g => `<b class="mono cd-v" data-tr="${esc(g.value)}">${esc(g.value)}</b>` }, { key: 'n', label: 'Cases', num: true, sortVal: g => g.cases.length, render: g => `<span class="cd-hot">${g.cases.length}</span>` },
        { key: 'cs', label: 'Which cases', render: g => esc(uniq(g.recs.map(r => r.case + (r.fir ? ' (' + r.fir + ')' : ''))).join(' · ')) }, { key: 'nm', label: 'Names', render: g => esc(g.names.slice(0, 4).join(', ')) }, { key: 'src', label: 'Found in', render: g => esc(g.sources.slice(0, 5).join(', ')) }] });
    } else if (st.v === 'case') {
      const rows = S.cases.map(c => { const l = R.filter(r => r.caseId === c.id); const u = t => uniq(l.filter(r => r.type === t).map(r => r.value)).length; return { id: c.id, case: c.name, fir: c.fir || '', total: uniq(l.map(r => r.type + r.value)).length, linked: uniq(l.filter(r => (seen.get(r.type + '|' + r.value) || 1) > 1).map(r => r.type + r.value)).length, mobile: u('mobile'), account: u('account'), upi: u('upi'), email: u('email'), pan: u('pan'), aadhaar: u('aadhaar'), url: u('url') + u('apk') }; });
      Table($('#cdT', el), { rows, pageSize: 50, exportName: 'crime_data_by_case', sortKey: 'linked', sortDir: -1, onRow: r => { st.c = r.id; st.v = 'all'; re(); }, columns: [{ key: 'case', label: 'Case', render: r => `<b>${esc(r.case)}</b>` }, { key: 'fir', label: 'FIR' }, { key: 'total', label: 'Identifiers', num: true }, { key: 'linked', label: 'Linked to other cases', num: true, render: r => r.linked ? `<span class="cd-hot">${r.linked}</span>` : '0' }, { key: 'mobile', label: 'Mobiles', num: true }, { key: 'account', label: 'Accounts', num: true }, { key: 'upi', label: 'UPI', num: true }, { key: 'email', label: 'E-mails', num: true }, { key: 'pan', label: 'PAN', num: true }, { key: 'aadhaar', label: 'Aadhaar', num: true }, { key: 'url', label: 'URL / APK', num: true }] });
    } else {
      const cols = order.map(l => colDef[lab2key[l]]).filter(Boolean);
      Table($('#cdT', el), { rows: F, pageSize: 50, exportName: 'crime_data', sortKey: 'seen', sortDir: -1, after: bind, onRow: r => this.cdEdit(r, re), columns: cols });
    }
    this.filesBox($('#cdFiles', el), 'Crime Data');
  },
  cdEdit(r, done) {
    const R = this.D.crime, x = r ? { ...r } : { type: 'mobile', caseId: S.caseId, case: activeCase().name || '', fir: activeCase().fir || '', source: 'Manual entry' };
    const m = UI.modal(r ? '✏ Crime data entry' : '➕ Add crime data', `<div class="map-grid"><label>Type<select id="cxT">${this.CT.map(([k, l]) => `<option value="${k}" ${k === x.type ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Value<input id="cxV" value="${esc(x.value || '')}"></label><label>Name / holder<input id="cxN" value="${esc(x.name || '')}"></label>
      <label>Case<select id="cxC"><option value="">— not linked —</option>${S.cases.map(c => `<option value="${c.id}" ${c.id === x.caseId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><label>Found in / source<input id="cxS" value="${esc(x.source || '')}"></label><label>Note<input id="cxO" value="${esc(x.note || '')}"></label></div>${r && r.auto ? '<div class="small muted" style="margin-top:6px">Taken from the case data. If you edit it, it is kept as your own entry and not replaced by the next import.</div>' : ''}`,
      [...(r ? [{ label: '🗑 Delete', cls: 'danger', onClick: async () => { if (!UI.confirm('Delete this entry?')) return; R.splice(R.indexOf(r), 1); await this.put('crime'); UI.closeModal(); done(); } }] : []), { label: 'Cancel', onClick: UI.closeModal }, { label: 'Save', cls: 'primary', onClick: async () => {
        const t = $('#cxT', m).value, v = this.norm(t, $('#cxV', m).value); if (!v) return UI.toast('Enter the value'); const cid = $('#cxC', m).value, c = S.cases.find(y => y.id === cid) || {};
        Object.assign(x, { type: t, value: v, name: $('#cxN', m).value.trim(), caseId: cid, case: c.name || '', fir: c.fir || '', source: $('#cxS', m).value.trim(), note: $('#cxO', m).value.trim() }); delete x.auto;
        if (r) Object.assign(r, x), delete r.auto; else R.push({ id: 'm' + uid(), added: new Date().toISOString(), ...x }); await this.put('crime'); UI.closeModal(); done(); } }]);
  },
  cdImport(done) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.csv,.xlsx,.xls,.txt,.pdf,.docx,.doc,.json,.htm,.html';
    inp.onchange = async () => { const R = this.D.crime; let n = 0; const HD = { mobile: /mobile|phone|contact/i, whatsapp: /whats ?app/i, telegram: /telegram/i, email: /e-?mail/i, account: /account|a\/c/i, ifsc: /ifsc/i, upi: /upi|vpa/i, pan: /\bpan\b/i, aadhaar: /aadha/i, apk: /apk|app name/i, url: /url|website|link|domain/i, ip: /\bip\b/i, imei: /imei/i, name: /^name$|holder|accused|suspect name/i };
      for (const f of inp.files) { let text = '', rows = []; try { const ext = f.name.split('.').pop().toLowerCase(); if (['docx', 'doc', 'odt'].includes(ext)) text = await NoticeKit.readAny(f); else ({ text, rows } = await GReply.read(f)); } catch (e) { }
        const base = { caseId: '', case: '', fir: '', source: 'File · ' + f.name, added: new Date().toISOString() }, push = (t, v, nm) => { v = this.norm(t, v); if (v && v.length >= 3) { R.push({ id: 'f' + uid(), type: t, value: v, name: nm || '', ...base }); n++; } };
        const hi = (rows || []).findIndex(r => r.filter(c => Object.values(HD).some(rx => rx.test(c))).length >= 2);
        if (hi >= 0) { const head = rows[hi], map = head.map(h => Object.keys(HD).find(k => HD[k].test(h)) || ''), ni = map.indexOf('name');
          for (const r of rows.slice(hi + 1)) map.forEach((k, i) => { if (k && k !== 'name' && r[i]) push(k, r[i], ni >= 0 ? r[ni] : ''); }); }
        else { for (const x of extractIdentifiers(text || '')) push(x.type, x.value); for (const m of String(text).match(/\b[\w.\-]{2,60}\.apk\b/gi) || []) push('apk', m); } }
      await this.put('crime'); UI.toast(n + ' entries imported'); done(); };
    inp.click();
  },

  /* ================= Duty Chart ================= */
  RANKS: ['Inspector', 'Sub-Inspector', 'Head Constable', 'Constable', 'Computer Operator'],
  async duty(el) {
    const cf = await this.cfg(), staff = await this.get('staff', []), charts = await this.get('duty', []), U = this._dc || (this._dc = { id: null });
    const ranks = EditList.items('dc-rank', this.RANKS), rk = r => { const i = ranks.indexOf(r); return i < 0 ? 99 : i; };
    let C = charts.find(x => x.id === U.id); if (!C) C = U.draft || (U.draft = { id: null, date: this.today(), title: 'DUTY CHART', order: '', rows: [] });
    el.innerHTML = `<div class="dc-grid"><div class="card dc-side"><h3>🏢 Office header</h3><div class="row" style="gap:10px;align-items:center"><div class="dc-logo">${cf.logo ? `<img src="${cf.logo}" alt="logo">` : '<span class="muted small">No logo</span>'}</div><div class="grow"><button class="btn sm" id="dcLogo">🖼 Upload logo</button>${cf.logo ? ' <button class="btn sm danger" id="dcLogoX">Remove</button>' : ''}</div></div>
        <label class="small muted" style="display:block;margin-top:8px">Office name</label><input id="dcOff" value="${esc(cf.office)}" style="width:100%">
        <h3 style="margin-top:16px">👮 Staff <span class="badge">${staff.length}</span></h3><div class="small muted">Kept for every chart. Click a name to edit.</div><div id="dcStaff"></div>
        <div class="row" style="gap:6px;margin-top:6px"><button class="btn sm primary" id="dcSAdd">➕ Add staff</button><button class="btn sm" id="dcRanks">✏ Ranks</button></div>
        <h3 style="margin-top:16px">📅 Saved charts <span class="badge">${charts.length}</span></h3><div class="dc-saved">${charts.slice().sort((a, b) => b.date.localeCompare(a.date)).map(x => `<div class="nt-item ${x.id === U.id ? 'on' : ''}" data-dc="${x.id}"><div class="grow"><b>${this.dmy(x.date)}</b> <span class="small muted">${x.rows.length} rows</span></div><button class="btn sm" data-dup="${x.id}" title="Copy to a new date">⧉</button><button class="btn sm danger" data-dd="${x.id}">🗑</button></div>`).join('') || '<div class="small muted">None yet.</div>'}</div></div>
      <div class="card dc-main"><div class="row" style="gap:8px;flex-wrap:wrap"><label>Date</label><input type="date" id="dcDate" value="${esc(C.date)}"><label>Title</label><input id="dcTitle" value="${esc(C.title || 'DUTY CHART')}" style="width:200px"><label>Order No.</label><input id="dcOrd" value="${esc(C.order || '')}" style="width:140px"><span style="flex:1"></span><button class="btn" id="dcFill">⤵ Fill all staff</button><button class="btn" id="dcRow">➕ Row</button></div>
        <div class="dc-sheet"><div class="dc-head">${cf.logo ? `<img src="${cf.logo}">` : ''}<div><b>${esc(cf.office.toUpperCase())}</b><div>${esc((C.title || 'DUTY CHART').toUpperCase())} – ${esc(new Date(C.date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }))}</div>${C.order ? `<div class="small">Order No. ${esc(C.order)}</div>` : ''}</div></div>
        <table class="tbl dc-t"><thead><tr><th>#</th><th>Rank</th><th>Name</th><th>Mobile</th><th>Duty / assignment</th><th>Shift / time</th><th>Place</th><th>Remarks</th><th></th></tr></thead><tbody>${C.rows.map((r, i) => `<tr data-i="${i}"><td>${i + 1}</td>${['rank', 'name', 'mobile', 'duty', 'shift', 'place', 'remarks'].map(k => `<td><input data-k="${k}" value="${esc(r[k] || '')}" ${k === 'rank' ? 'list="dcRk"' : ''}></td>`).join('')}<td class="dc-ra"><button class="btn sm" data-u="${i}" ${i ? '' : 'disabled'}>▲</button><button class="btn sm" data-n="${i}" ${i < C.rows.length - 1 ? '' : 'disabled'}>▼</button><button class="btn sm danger" data-x="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="9" class="muted small">Add staff on the left, then press ⤵ Fill all staff, or add rows.</td></tr>'}</tbody></table><datalist id="dcRk">${ranks.map(r => `<option value="${esc(r)}">`).join('')}</datalist>
        ${C.rows.length ? `<div class="small muted" style="margin-top:6px">${ranks.map(r => { const n = C.rows.filter(x => x.rank === r).length; return n ? `${esc(r)}: <b>${n}</b>` : ''; }).filter(Boolean).join(' · ')} · Total <b>${C.rows.length}</b></div>` : ''}</div>
        <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn primary" id="dcSave">💾 Save chart</button><button class="btn" id="dcPrint">🖨 Print / PDF</button><button class="btn" id="dcWord">⬇ Word</button><button class="btn" id="dcNew">➕ New chart</button></div></div></div><div id="dcFiles"></div>`;
    const re = () => this.duty(el), take = () => { C.date = $('#dcDate', el).value || C.date; C.title = $('#dcTitle', el).value; C.order = $('#dcOrd', el).value; $$('.dc-t tbody tr[data-i]', el).forEach(tr => { const r = C.rows[+tr.dataset.i]; $$('[data-k]', tr).forEach(i => r[i.dataset.k] = i.value.trim()); }); };
    const SS = staff.slice().sort((a, b) => rk(a.rank) - rk(b.rank)); $('#dcStaff', el).innerHTML = SS.map((x, i) => `<div class="dc-st" data-st="${i}"><span class="fm-tag">${esc(x.rank)}</span><b>${esc(x.name)}</b><span class="small muted">${esc(x.mobile || '')}</span></div>`).join('') || '<div class="small muted">No staff yet.</div>';
    $$('[data-st]', el).forEach(n => n.onclick = () => this.staffEdit(SS[+n.dataset.st], re));
    $('#dcSAdd', el).onclick = () => this.staffEdit(null, re); $('#dcRanks', el).onclick = () => EditList.edit('dc-rank', this.RANKS, 'Ranks (order used in the chart)', re);
    $('#dcLogo', el).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { const r = new FileReader(); r.onload = async () => { cf.logo = r.result; await this.put('cfg'); re(); }; r.readAsDataURL(i.files[0]); }; i.click(); };
    if ($('#dcLogoX', el)) $('#dcLogoX', el).onclick = async () => { cf.logo = ''; await this.put('cfg'); re(); };
    $('#dcOff', el).onchange = async e => { cf.office = e.target.value.trim() || this.OFFICE; await this.put('cfg'); take(); re(); };
    ['dcDate', 'dcTitle', 'dcOrd'].forEach(id => $('#' + id, el).onchange = () => { take(); re(); });
    $('#dcFill', el).onclick = () => { take(); const have = new Set(C.rows.map(r => r.name)); staff.slice().sort((a, b) => rk(a.rank) - rk(b.rank)).forEach(s => { if (!have.has(s.name)) C.rows.push({ rank: s.rank, name: s.name, mobile: s.mobile, duty: s.duty || '', shift: '', place: '', remarks: '' }); }); re(); };
    $('#dcRow', el).onclick = () => { take(); C.rows.push({}); re(); };
    $$('[data-u]', el).forEach(b => b.onclick = () => { take(); const i = +b.dataset.u; [C.rows[i - 1], C.rows[i]] = [C.rows[i], C.rows[i - 1]]; re(); });
    $$('[data-n]', el).forEach(b => b.onclick = () => { take(); const i = +b.dataset.n; [C.rows[i + 1], C.rows[i]] = [C.rows[i], C.rows[i + 1]]; re(); });
    $$('[data-x]', el).forEach(b => b.onclick = () => { take(); C.rows.splice(+b.dataset.x, 1); re(); });
    $('#dcSave', el).onclick = async () => { take(); if (!C.id) { C.id = uid() + ''; charts.push(C); U.id = C.id; U.draft = null; } await this.put('duty'); UI.toast('Duty chart saved'); re(); };
    $('#dcNew', el).onclick = () => { U.id = null; U.draft = null; re(); };
    $$('[data-dc]', el).forEach(n => n.onclick = e => { if (e.target.closest('button')) return; U.id = n.dataset.dc; re(); });
    $$('[data-dup]', el).forEach(b => b.onclick = () => { const s = charts.find(x => x.id === b.dataset.dup); U.id = null; U.draft = { id: null, date: this.today(), title: s.title, order: '', rows: s.rows.map(r => ({ ...r })) }; re(); });
    $$('[data-dd]', el).forEach(b => b.onclick = async () => { if (!UI.confirm('Delete this duty chart?')) return; charts.splice(charts.findIndex(x => x.id === b.dataset.dd), 1); if (U.id === b.dataset.dd) U.id = null; await this.put('duty'); re(); });
    const html = () => { take(); return `<html><head><meta charset="utf-8"><title>Duty chart ${this.dmy(C.date)}</title><style>@page{size:A4;margin:1.4cm}body{font-family:'Arial Narrow',Arial,sans-serif;font-size:11pt;color:#000}.h{display:flex;align-items:center;gap:14px;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px}.h img{height:70px}.h b{font-size:15pt}.h div{text-align:center;flex:1}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:4px 6px;text-align:left;vertical-align:top}th{background:#e5e7eb}.s{margin-top:40px;text-align:right}</style></head><body>
      <div class="h">${cf.logo ? `<img src="${cf.logo}">` : ''}<div><b>${esc(cf.office.toUpperCase())}</b><br><b>${esc((C.title || 'DUTY CHART').toUpperCase())}</b><br>Date: ${esc(new Date(C.date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }))}${C.order ? '<br>Order No. ' + esc(C.order) : ''}</div>${cf.logo ? '<span style="width:70px"></span>' : ''}</div>
      <table><tr><th>S.No.</th><th>Rank</th><th>Name</th><th>Mobile</th><th>Duty / assignment</th><th>Shift / time</th><th>Place</th><th>Remarks</th></tr>${C.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.rank || '')}</td><td><b>${esc(r.name || '')}</b></td><td>${esc(r.mobile || '')}</td><td>${esc(r.duty || '')}</td><td>${esc(r.shift || '')}</td><td>${esc(r.place || '')}</td><td>${esc(r.remarks || '')}</td></tr>`).join('')}</table>
      <div class="s"><b>Station House Officer</b><br>${esc(cf.office)}</div></body></html>`; };
    $('#dcPrint', el).onclick = () => { const w = window.open('', '_blank'); if (!w) return UI.toast('Pop-up blocked'); w.document.write(html().replace('<body>', '<body><button onclick="print()" class="np" style="margin-bottom:10px">🖨 Print / Save as PDF</button><style>@media print{.np{display:none}}</style>')); w.document.close(); };
    $('#dcWord', el).onclick = () => UI.download('duty_chart_' + C.date + '.doc', html(), 'application/msword');
    this.filesBox($('#dcFiles', el), 'Duty Chart');
  },
  staffEdit(s, done) {
    const L = this.D.staff, x = s ? { ...s } : { rank: 'Constable' };
    const m = UI.modal(s ? '✏ Staff' : '➕ Add staff', `<div class="map-grid"><label>Rank<select id="sfR"></select></label><label>Name<input id="sfN" value="${esc(x.name || '')}"></label><label>Mobile<input id="sfM" value="${esc(x.mobile || '')}"></label><label>PNO / Belt No.<input id="sfP" value="${esc(x.pno || '')}"></label><label style="grid-column:1/-1">Usual duty<input id="sfD" value="${esc(x.duty || '')}"></label></div>`,
      [...(s ? [{ label: '🗑 Delete', cls: 'danger', onClick: async () => { if (!UI.confirm('Remove ' + s.name + ' from staff?')) return; L.splice(L.indexOf(s), 1); await this.put('staff'); UI.closeModal(); done(); } }] : []), { label: 'Cancel', onClick: UI.closeModal }, { label: 'Save', cls: 'primary', onClick: async () => {
        const n = $('#sfN', m).value.trim(); if (!n) return UI.toast('Enter the name'); Object.assign(x, { rank: $('#sfR', m).value, name: n, mobile: $('#sfM', m).value.trim(), pno: $('#sfP', m).value.trim(), duty: $('#sfD', m).value.trim() });
        if (s) Object.assign(s, x); else L.push({ id: uid() + '', ...x }); await this.put('staff'); UI.closeModal(); done(); } }]);
    EditList.attach($('#sfR', m), 'dc-rank', this.RANKS, 'Ranks'); const r = $('#sfR', m); if (![...r.options].some(o => o.value === x.rank)) r.insertAdjacentHTML('afterbegin', `<option>${esc(x.rank)}</option>`); r.value = x.rank;
  }
};

PAGE_META.offx = { group: 'Office', title: 'Office Work', desc: 'Good work, press notes, crime data of all cases, duty chart and office files – the same in every case, kept on this computer.', order: ['good', 'press', 'crime', 'duty', 'files'], names: { good: '🏅 Good Work', press: '📰 Press Note', crime: '🗃 Crime Data', duty: '📅 Duty Chart', files: '⬆ Upload +' } };
Pages.offx = main => { const { cur, body } = tabs(main, 'offx', [['good', '🏅 Good Work'], ['press', '📰 Press Note'], ['crime', '🗃 Crime Data'], ['duty', '📅 Duty Chart'], ['files', '⬆ Upload +']], 'Office Work');
  ({ good: () => Off.good(body), press: () => Off.press(body), crime: () => Off.crime(body), duty: () => Off.duty(body), files: () => Off.filesBox(body, null) }[cur] || (() => Off.good(body)))(); };

/* sidebar: OFFICE drop-down (Search in Local Drive moves inside it) */
(() => {
  const nav = $('#sidebar'), ls = nav && $('.nav-item[data-page="lsearch"]', nav); if (!ls) return;
  const SUB = [['lsearch', '', 'Search in Local Drive', '#6366f1'], ['offx', 'good', 'Good Work', '#eab308'], ['offx', 'press', 'Press Note', '#ec4899'], ['offx', 'crime', 'Crime Data', '#ef4444'], ['offx', 'duty', 'Duty Chart', '#22c55e'], ['offx', 'files', 'Upload +', '#06b6d4']];
  ls.insertAdjacentHTML('beforebegin', `<div class="nav-item offx-item" title="Office work: local search, good work, press note, crime data, duty chart, files" style="--c:#14b8a6"><span class="nib">🏢</span><span>Office Work</span><span class="nav-chev">▾</span></div><div class="nav-subs offx-subs">${SUB.map(([p, s, l, c], i) => `<div class="nav-sub" data-ox="${p}|${s}" style="--pc:${c}"><i></i><span>${i + 1}. ${l}</span></div>`).join('')}</div>`);
  ls.style.display = 'none';
  const it = $('.offx-item', nav), subs = $('.offx-subs', nav), setOpen = on => { S.oxOpen = on; subs.classList.toggle('open', on); it.classList.toggle('open', on); };
  setOpen(false);
  it.addEventListener('click', e => { e.stopImmediatePropagation(); setOpen(!S.oxOpen); }, true);
  $$('[data-ox]', subs).forEach(n => n.onclick = () => { const [p, s] = n.dataset.ox.split('|'); go(p, s || undefined); });
  const or = render; render = function () { const r = or.apply(this, arguments);
    $$('[data-ox]', subs).forEach(n => { const [p, s] = n.dataset.ox.split('|'); n.classList.toggle('active', S.page === p && (!s || (S.sub.offx || 'good') === s)); });
    const on = S.page === 'offx' || S.page === 'lsearch'; it.classList.toggle('active', on); if (on && !S.oxOpen) setOpen(true); return r; };
})();
