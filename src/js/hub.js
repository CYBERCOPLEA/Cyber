/* hub.js – ONE Import / Upload window for the whole tool.
   Step 1: which case – New Case (fill FIR, PS, IO…), Existing Case, or Auto By FIR (CCTNS zips of many FIRs).
   Step 2: add files – files, a folder, zip / rar, drag & drop.
   Step 3: every file is sorted (FIR, CD, CS / CS-PPI / FR, case documents, CDR / IPDR, CAF, NCRP / money trail,
   bank sheets, WhatsApp / Facebook / Instagram / Telegram / Google replies) – check it, then Import All.
   Scanned PDFs and photos are read with the built-in OCR. Everything stays on this computer. */
'use strict';
const Hub = {
  K: {
    fir: ['📄', 'FIR'], cd: ['📒', 'Case Diary (CD)'], cs: ['📗', 'Charge Sheet (CS)'], ppi: ['📘', 'CS-PPI'], fr: ['📕', 'Final Report (FR)'], doc: ['📎', 'Case Document (Letter / Reply / Statement / Photo)'],
    ncrp: ['📋', 'NCRP / Money Trail / Bank Action Sheet'], fin: ['🏦', 'Bank Statement / KYC Sheet (Map Columns)'], social: ['🌐', 'Social Media Sheet (Map Columns)'], tele: ['📞', 'CDR / IPDR / TDR / SMS'], caf: ['🪪', 'CAF (SIM Form)'],
    wa: ['💬', 'WhatsApp Reply'], meta: ['📘', 'Facebook / Instagram Reply'], tg: ['✈️', 'Telegram Reply'], google: ['🔍', 'Google Reply'], skip: ['⏭', 'Skip']
  },
  CCT: ['fir', 'cd', 'cs', 'ppi', 'fr', 'doc'],
  st: null,
  /* opt: { mode: 'new' | 'old' | 'auto', hint: kind, title, files } */
  open(opt = {}) {
    const keep = this.st && this.st.Q.length && !this.st.done && !opt.fresh;
    if (!keep) this.st = { mode: opt.mode || 'old', sel: S.caseId === '__all' ? AllMode.pick() : S.caseId, edit: false, Q: [], hint: opt.hint || '', title: opt.title || '', busy: false, done: false, log: '' };
    else { if (opt.mode) this.st.mode = opt.mode; if (opt.hint) this.st.hint = opt.hint; }
    this.draw(); if (opt.files) this.add(opt.files);
  },
  body() { const b = $('#mdBody'); return b && $('.hub', b) ? b : null; },
  draw() {
    const s = this.st, isNew = s.mode === 'new', isAuto = s.mode === 'auto', b0 = this.body();
    if (b0 && $('.hub-f', b0)) s.form = CaseBox.read($('.hub-f', b0));
    let c = isNew ? { year: String(new Date().getFullYear()), ps: activeCase().ps || '', district: activeCase().district || '', state: activeCase().state || 'UP – Uttar Pradesh', io: activeCase().io || '', io_mobile: activeCase().io_mobile || '', io_posting: activeCase().io_posting || '' } : S.cases.find(x => x.id === s.sel) || activeCase();
    const F = CaseBox.F, open = isNew || s.edit; if (s.form) Object.assign(c = { ...c }, s.form);
    const bits = [c.fir && 'FIR ' + String(c.fir).replace(/^\s*FIR\s*(No\.?)?\s*/i, ''), c.ps && 'PS ' + c.ps, c.district, c.section, c.io && 'IO ' + c.io].filter(Boolean);
    const html = `<div class="hub ti">
      <div class="ti-step"><b>1</b> Which case are these files for?</div>
      <div class="ti-seg hub-seg"><button data-hm="new" class="${isNew ? 'on' : ''}">➕ New Case<small>Fill FIR, Police Station, IO details</small></button><button data-hm="old" class="${s.mode === 'old' ? 'on' : ''}">📁 Existing Case<small>Add the files to a case already made</small></button><button data-hm="auto" class="${isAuto ? 'on' : ''}">🧭 Auto By FIR<small>CCTNS zips / folders of many FIRs – each goes to its own case</small></button></div>
      ${s.mode === 'old' ? `<div class="hub-old"><label class="ti-sel">Choose Case<select id="hbCase">${S.cases.map(x => `<option value="${x.id}"${x.id === s.sel ? ' selected' : ''}>${esc(x.name)}${x.fir && !String(x.name).includes(x.fir) ? ' · ' + esc(x.fir) : ''}</option>`).join('')}</select></label>
        <div class="hub-cd">${bits.length ? '👮 ' + esc(bits.join(' · ')) : '<span class="bad-t">⚠ FIR / PS / IO details not filled</span>'} <button class="btn sm" id="hbEd">${s.edit ? '✖ Cancel Edit' : '✏ Edit Details'}</button></div></div>` : ''}
      ${isAuto ? `<div class="note">The FIR number is read from each zip / folder name (e.g. <span class="mono">FIR-0123-2026-PS-CCPS-GZB-CS-PPI</span>) or from inside the case diary. A case is found by its FIR number, or made new. Other files go into the open case: <b>${esc(activeCase().name || '')}</b>.</div>` : ''}
      ${open ? `<div class="map-grid cb-grid hub-f">${F.map(([f, l, t]) => CaseBox.field(f, l, t, f === 'year' ? CaseBox.yearOf(c) : c[f])).join('')}<label style="grid-column:1/-1">Case Name <span class="small muted">(blank = made from Case Type and FIR)</span><input data-cb="name" value="${esc(s.form ? s.form.name || '' : isNew ? '' : c.name || '')}"></label></div>` : ''}
      <div class="ti-step"><b>2</b> Add the files</div>
      <div class="g-drop hub-drop" id="hbDrop"><div class="g-dl">⬆</div><b>Drop files or a whole folder here</b><span>FIR · Case Diary (CD) · CS / CS-PPI / FR · CCTNS zip · bank / telecom / NIC e-mail replies · statements · NCRP / money trail / bank action sheets · statements & KYC · CDR / IPDR / TDR / SMS · CAF · WhatsApp / Facebook / Instagram / Telegram / Google replies · zip / rar · scanned PDFs & photos (read by OCR)</span>
        <div class="row" style="gap:8px;justify-content:center;margin-top:10px"><button class="btn primary" id="hbF">📄 Choose Files</button><button class="btn" id="hbD">📁 Choose Folder</button></div></div>
      <div class="ti-step"><b>3</b> Check where each file goes, then import ${s.Q.length ? `<span class="badge">${s.Q.length} file(s)</span>` : ''}</div>
      <div id="hbQ">${this.list()}</div>
      <div class="hub-log small" id="hbLog">${s.log}</div>
      <div class="hub-safe small"><svg class="safe-ic" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="#10b981"/><rect x="8.5" y="11" width="7" height="5.5" rx="1" fill="#fff"/><path d="M10 11V9.5a2 2 0 0 1 4 0V11" fill="none" stroke="#fff" stroke-width="1.6"/></svg> <b>Offline</b> · read on this computer, never uploaded.</div>
      <div class="small" id="hbErr" style="color:var(--bad);min-height:1.2em"></div></div>`;
    const btns = [{ label: 'Close', onClick: () => { if (!s.busy) UI.closeModal(); } }];
    if (open) btns.push({ label: isNew ? '💾 Save New Case Only' : '💾 Save Details', onClick: () => this.target(true).then(id => { if (id) { UI.toast('Case saved'); this.st.mode = 'old'; this.st.sel = id; this.st.edit = false; this.st.form = null; this.draw(); } }) });
    btns.push({ label: s.done ? '✔ Done – Open Case Diary' : `▶ Import All${s.Q.length ? ' (' + s.Q.filter(q => q.kind !== 'skip').length + ')' : ''}`, cls: 'primary', onClick: () => s.done ? (UI.closeModal(), go('cctns', 'diary')) : this.run() });
    const m = UI.modal('📥 Import / Upload' + (s.title ? ' – ' + s.title : ''), html, btns);
    this.wire(m);
  },
  list() {
    const s = this.st; if (!s.Q.length) return '<div class="muted small">No file added yet.</div>';
    const cnt = groupBy(s.Q.filter(q => q.kind !== '…'), q => q.kind);
    return `<div class="hub-sum">${[...cnt].map(([k, v]) => `<span class="tf-chip">${(this.K[k] || ['', k])[0]} ${esc((this.K[k] || ['', k])[1].split(' (')[0])} <b>${v.length}</b></span>`).join(' ')}<button class="btn sm" id="hbClr" ${s.busy ? 'disabled' : ''}>🗑 Clear</button></div>
      <div class="hub-tb"><table class="tbl"><thead><tr><th>File</th><th>Size</th><th>Goes To</th><th>Result</th></tr></thead><tbody>${s.Q.map((q, i) => `<tr><td><b>${esc(q.f.name)}</b>${q.path && q.path !== q.f.name ? `<div class="small muted">${esc(q.path)}</div>` : ''}</td><td class="small">${SOP.size(q.f.size)}</td>
      <td>${q.kind === '…' ? '<span class="muted">checking…</span>' : `<select data-hk="${i}" ${s.busy || q.ok ? 'disabled' : ''}>${Object.entries(this.K).map(([k, [ic, l]]) => `<option value="${k}" ${k === q.kind ? 'selected' : ''}>${ic} ${l}</option>`).join('')}</select>`}</td>
      <td class="small">${q.res ? (/^(Error|⚠)/.test(q.res) ? `<b class="bad-t">${esc(q.res)}</b>` : `<span class="good-t">✔ ${esc(q.res)}</span>`) : ''}</td></tr>`).join('')}</tbody></table></div>`;
  },
  redraw() { const b = this.body(); if (!b) return; $('#hbQ', b).innerHTML = this.list(); $('#hbLog', b).innerHTML = this.st.log; this.wireList(b); },
  wire(m) {
    const s = this.st;
    $$('[data-hm]', m).forEach(b => b.onclick = () => { if (s.busy) return; s.mode = b.dataset.hm === 'new' ? 'new' : b.dataset.hm; s.edit = false; s.form = null; this.draw(); });
    const cs = $('#hbCase', m); if (cs) cs.onchange = () => { s.sel = cs.value; s.edit = false; s.form = null; this.draw(); };
    const ed = $('#hbEd', m); if (ed) ed.onclick = () => { s.edit = !s.edit; s.form = null; this.draw(); };
    CaseBox.wire(m); m.addEventListener('input', () => { const e = $('#hbErr', m); if (e) e.textContent = ''; });
    const pick = dir => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.className = 'hidden'; if (dir) { i.webkitdirectory = true; i.setAttribute('directory', ''); } i.onchange = () => { const f = [...i.files]; i.remove(); this.add(f); }; document.body.appendChild(i); i.click(); };
    $('#hbF', m).onclick = e => { e.stopPropagation(); pick(false); }; $('#hbD', m).onclick = e => { e.stopPropagation(); pick(true); };
    const drop = $('#hbDrop', m);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = async e => { e.preventDefault(); drop.classList.remove('over'); const fs = []; const walk = async (en, p) => { if (!en) return; if (en.isFile) { const f = await new Promise(r => en.file(r)); fs.push({ f, path: p + f.name }); } else if (en.isDirectory) { const rd = en.createReader(); let b; do { b = await new Promise(r => rd.readEntries(r)); for (const x of b) await walk(x, p + en.name + '/'); } while (b.length); } };
      const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean); if (items.length) { for (const it of items) await walk(it, ''); this.add(fs); } else this.add([...e.dataTransfer.files]); };
    this.wireList(m);
  },
  wireList(m) {
    const s = this.st;
    $$('[data-hk]', m).forEach(x => x.onchange = () => { const q = s.Q[+x.dataset.hk]; q.kind = x.value; q.user = 1; this.redraw(); });
    const c = $('#hbClr', m); if (c) c.onclick = () => { s.Q = []; s.log = ''; this.draw(); };
  },
  /* files (or {f, path}) → queue; zips opened with their folder path kept */
  async add(files) {
    const s = this.st, E = [];
    for (const x of files) { const f = x.f || x, path = x.path || f.webkitRelativePath || f.name;
      try {
        if (/\.zip$/i.test(f.name)) E.push(...(await CDX.unzip(await f.arrayBuffer(), path.replace(/\.zip$/i, ''))));
        else if (/\.rar$/i.test(f.name) && window.Unrar) E.push(...(await Unrar.extract(await f.arrayBuffer())).map(r => ({ path: path.replace(/\.rar$/i, '') + '/' + r.name, file: new File([r.data], r.name.split(/[\/\\]/).pop()) })));
        else E.push({ path, file: f });
      } catch (e) { UI.toast('Could not open ' + f.name + ': ' + e.message, 6000); } }
    const have = new Set(s.Q.map(q => q.path + '|' + q.f.size));
    for (const e of E) { if (have.has(e.path + '|' + e.file.size) || /(^|\/)(\.|__MACOSX|Thumbs\.db)/i.test(e.path)) continue; s.Q.push({ f: e.file, path: e.path, kind: '…' }); }
    if (s.mode === 'old' && s.Q.some(q => CDX.meta(q.path)) && uniq(s.Q.map(q => (CDX.meta(q.path) || {}).fir).filter(Boolean)).length > 1) s.mode = 'auto';
    this.draw();
    for (const q of s.Q) if (q.kind === '…') { q.kind = await this.detect(q); this.redraw(); }
    this.draw();
  },
  async detect(q) {
    const n = q.f.name, m = CDX.meta(q.path);
    if (/\.(mp4|mp3|wav|avi|mov|exe|dll|bin|iso)$/i.test(n)) return 'skip';
    if (/\.sudcd$/i.test(n)) return 'skip';
    const k = CDX.kind(n, '', m && m.fin);
    if (k.k === 'cd') return 'cd'; if (k.k === 'fin') return k.type === 'FR' ? 'fr' : k.type === 'PPI' ? 'ppi' : 'cs'; if (k.k === 'fir') return 'fir';
    if (/\.(jpe?g|png|webp|bmp|gif)$/i.test(n)) return 'doc';
    let c = 'doc'; try { c = await CCTNS.classify(q.f); } catch (e) { }
    if (c === 'skip') c = 'doc';
    if (/\.(xlsx?|xlsb|ods|csv)$/i.test(n) && /social|profile|platform/i.test(n)) c = 'social';
    if (c === 'doc' && /\.(xlsx?|xlsb|ods|csv)$/i.test(n)) c = this.st.hint && !this.CCT.includes(this.st.hint) ? this.st.hint : 'ncrp';
    if (c === 'doc' && this.st.hint && !this.CCT.includes(this.st.hint) && !/\.(pdf|docx?|jpe?g|png|txt|rtf|odt)$/i.test(n)) c = this.st.hint;
    return c;
  },
  /* make / update the chosen case; returns its id (and opens it) */
  async target(saveOnly) {
    const s = this.st, b = this.body(); if (s.mode === 'auto') return S.caseId;
    if (s.mode === 'new' || s.edit) {
      const o = CaseBox.read($('.hub-f', b)), err = CaseBox.check(o), E = $('#hbErr', b);
      if (err) { E.textContent = err; return null; }
      if (s.mode === 'new' && !o.fir && !o.name && !o.ctype) { E.textContent = 'Type the FIR / Complaint No. (or a case name) for the new case'; const f = $('[data-cb="fir"]', b); if (f) f.focus(); return null; }
      if (s.mode === 'new') { o.name = o.name || CaseBox.autoName(o); const c = { id: uid(), created: new Date().toISOString(), status: 'Under investigation', ...o }; S.cases.push(c); await DB.set('case:' + c.id, emptyCase()); await switchCase(c.id); return c.id; }
      const c = S.cases.find(x => x.id === s.sel); if (!c) return null; const auto = !c.name || c.name === CaseBox.autoName(c) || /^Case \d+$/.test(c.name); Object.assign(c, o); if (!o.name && auto) c.name = CaseBox.autoName(c); await saveMeta(); fillCaseSel();
    }
    if (s.sel !== S.caseId) await switchCase(s.sel); else if (saveOnly) render();
    return s.sel;
  },
  async run() {
    const s = this.st; if (s.busy) return;
    if (!s.Q.length) { const e = $('#hbErr', this.body()); if (e) e.textContent = 'Add files first (step 2).'; return; }
    if (s.Q.some(q => q.kind === '…')) return UI.toast('Still checking the files – one moment');
    const tid = await this.target(); if (!tid) return;
    s.form = null; s.busy = true; s.mode = s.mode === 'new' ? 'old' : s.mode; s.sel = S.caseId; s.edit = false; this.draw();
    const log = t => { s.log = t; const b = this.body(); if (b) $('#hbLog', b).innerHTML = t; };
    const todo = s.Q.filter(q => !q.ok && q.kind !== 'skip');
    if (S.caseId === '__all' && todo.some(q => !this.CCT.includes(q.kind))) { s.busy = false; s.mode = 'old'; s.sel = AllMode.pick(); this.draw(); const e = $('#hbErr', this.body()); if (e) e.textContent = 'Data files (bank, telecom, social, NCRP…) need one case. Choose the case above, then press Import All again.'; return; }
    /* 1 · CCTNS: FIR, CD, CS / PPI / FR, case documents (OCR when scanned) */
    const cc = todo.filter(q => this.CCT.includes(q.kind));
    if (cc.length) {
      const G = new Map(); let i = 0; const t0 = Date.now();
      for (const q of cc) {
        log(`⏳ Reading ${++i} of ${cc.length}: <b>${esc(q.f.name)}</b>${i > 1 ? ` · about ${Math.max(1, Math.round((Date.now() - t0) / (i - 1) * (cc.length - i + 1) / 60000))} min left` : ''}`);
        let t = ''; try { t = await CDX.readFile(q.f, (a, n) => log(`⏳ Reading ${i} of ${cc.length}: <b>${esc(q.f.name)}</b> · page ${a} of ${n}`)); } catch (e) { q.res = 'Error: ' + e.message; }
        let kind = q.kind; if (kind === 'doc' && !q.user && t) { const k2 = CDX.kind(q.f.name, t); kind = k2.k === 'cd' ? 'cd' : k2.k === 'fir' ? 'fir' : k2.k === 'fin' ? (k2.type === 'FR' ? 'fr' : k2.type === 'PPI' ? 'ppi' : 'cs') : 'doc'; q.kind = kind; }
        const kd = kind === 'cd' ? { k: 'cd' } : kind === 'fir' ? { k: 'fir' } : kind === 'cs' ? { k: 'fin', type: 'CS' } : kind === 'ppi' ? { k: 'fin', type: 'PPI' } : kind === 'fr' ? { k: 'fin', type: 'FR' } : { k: 'doc' };
        let m = s.mode === 'auto' ? (CDX.meta(q.path) || (t && CDX.firOf(t) ? (() => { const [no, year] = CDX.firOf(t).split('/'); return { no, year, fir: no + '/' + year, ps: '', dist: '', fin: '' }; })() : null)) : null;
        const key = m ? m.fir : '_'; if (!G.has(key)) G.set(key, { m, items: [] }); const g = G.get(key);
        if (m && !g.m) g.m = m; if (m && m.fin && g.m && !g.m.fin) g.m.fin = m.fin;
        g.items.push({ e: { path: q.path, file: q.f }, t, kd, q });
        q.res = q.res || (t.trim() ? (kind === 'cd' ? 'CD ' + (CDX.cdNo(t, q.f.name).no || '?') : (this.K[kind] || ['', kind])[1].split(' (')[0]) + ' read' : '⚠ no text found');
        this.redraw();
      }
      for (const [k, g] of G) { if (!g.m && k !== '_') continue; const fins = g.items.filter(x => x.kd.k === 'fin'); if (g.m && !g.m.fin && fins.length) g.m.fin = fins[0].kd.type;
        if (k === '_' && S.caseId === '__all') { g.items.forEach(x => { x.q.res = '⚠ FIR No. not found – choose Existing Case and import again'; }); continue; }
        const id = await CDX.apply(g.m ? g : { m: null }, g.items, k === '_' ? S.caseId : null);
        const c = S.cases.find(x => x.id === id); g.items.forEach(x => { if (!/^(Error|⚠)/.test(x.q.res)) x.q.res += ' → ' + (c ? c.name : 'case'); x.q.ok = 1; }); }
      await saveMeta(); fillCaseSel(); CDX._m = null;
    }
    /* 2 · data files: telecom, social replies, CAF, NCRP / trail sheets – same importers as each section */
    const rest = todo.filter(q => !this.CCT.includes(q.kind) && q.kind !== 'fin' && q.kind !== 'social');
    if (rest.length) { log('⏳ Importing data files…'); const Q = rest.map(q => ({ f: q.f, kind: q.kind, q })); try { await CCTNS.run(Q, () => { Q.forEach(x => { if (x.res != null) { x.q.res = x.res; x.q.ok = 1; } }); this.redraw(); }); } catch (e) { rest.forEach(q => { q.res = 'Error: ' + e.message; }); } }
    rest.filter(q => q.kind === 'ncrp' && /^0 rows/.test(q.res || '')).forEach(q => { q.res = '⚠ columns not recognised – choose "Bank Statement / KYC Sheet (Map Columns)" and import again'; q.ok = 0; });
    Analysis.invalidate(); saveCase();
    const fin = todo.filter(q => q.kind === 'fin' || q.kind === 'social');
    s.busy = false; s.done = !fin.length && !s.Q.some(q => !q.ok && q.kind !== 'skip'); log(s.mode === 'auto' ? '✔ Imported – each FIR went into its own case (see the Goes To / Result column). Every section is updated.' : `✔ Imported into <b>${esc(activeCase().name || '')}</b>. Every section is updated.`);
    if (fin.length) { fin.forEach(q => { q.res = 'opened in Map Columns'; q.ok = 1; }); s.done = true; openImport(['txn', 'stmt', 'kyc', 'ncrp', 'social'], () => { Analysis.invalidate(); render(); }, fin.map(q => q.f)); return; }
    this.draw(); render();
  }
};

/* ---------- every Import / Upload button of the tool opens this one window ---------- */
(() => {
  const MAP = { dImport: {}, btnImpTop: {}, fImp: { hint: 'fin', title: 'Financial' }, trImp: { hint: 'ncrp', title: 'Money Trail' }, trImp2: { hint: 'ncrp', title: 'Money Trail' }, nImp: { hint: 'ncrp', title: 'NCRP' }, anImp: { hint: 'ncrp', title: 'NCRP Data' },
    sImp: { title: 'Social Media' }, wImp: { hint: 'wa', title: 'WhatsApp' }, mImp: { hint: 'meta', title: 'Facebook / Instagram' }, tImp: { hint: 'tg', title: 'Telegram' }, gImp: { hint: 'google', title: 'Google' }, cafImp: { hint: 'caf', title: 'CAF' },
    ccImpX: { title: 'CCTNS' }, cdxImp: { title: 'CCTNS' }, ccUp2: { hint: 'doc', title: 'Case Documents' }, ccUp: { hint: 'doc', title: 'Case Documents' } };
  const top = () => { const nb = $('#btnNewCase'); if (!nb) return; nb.onclick = e => { e.stopImmediatePropagation(); Hub.open({ mode: 'new', fresh: true }); }; nb.textContent = '📥 New Case / Import'; nb.classList.add('hub-top'); nb.title = 'One window: make a new case or choose an existing one, then add any file – FIR, CD, CS / FR, CCTNS zip, money trail, statements, CDR, replies'; };
  const bind = () => { top(); for (const [id, o] of Object.entries(MAP)) $$('#' + id).forEach(b => { if (b.dataset.hub) return; b.dataset.hub = 1; b.onclick = e => { e.preventDefault(); e.stopImmediatePropagation(); Hub.open({ ...o, fresh: !!o.hint }); }; }); };
  /* Crime Data: three import sources → one "📥 Import ▾" menu */
  const crime = () => { const a = $('#cdScan'), f = $('#cdFile'), o = $('#cdFImp'); if (!a || !f || !o || $('#cdImpM')) return;
    [a, f, o].forEach(x => x.classList.add('hidden')); a.insertAdjacentHTML('beforebegin', '<button class="btn primary" id="cdImpM" title="Import from all cases, an Excel / CSV / PDF / Word file, or a sealed offline form file">📥 Import ▾</button>');
    $('#cdImpM').onclick = e => { const old = $('.cdx-menu'); if (old) { old.remove(); return; } const m = document.createElement('div'); m.className = 'cdx-menu';
      m.innerHTML = [[a, '🔄', 'Import From All Cases', 'Read every case again – FIR, case diary, money trail, KYC, NCRP, replies'], [f, '📄', 'Import File', 'Excel / CSV / PDF / Word file'], [o, '🔒', 'Import Offline Form File', 'Sealed .sudcd file sent by a subordinate']].map(([x, i, t, d], k) => `<button data-cm="${k}"><span class="ic">${i}</span><span><b>${t}</b><small>${d}</small></span></button>`).join('');
      document.body.appendChild(m); const r = e.currentTarget.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
      $$('[data-cm]', m).forEach(x => x.onclick = () => { m.remove(); [a, f, o][+x.dataset.cm].click(); }); setTimeout(() => document.addEventListener('mousedown', function cl(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', cl); } })); }; };
  const or = render; render = function () { const r = or.apply(this, arguments); try { bind(); crime(); } catch (e) { } return r; };
  new MutationObserver(() => { if (document.getElementById('cdScan') && !document.getElementById('cdImpM')) crime(); }).observe(document.body, { childList: true, subtree: true });
  bind(); setTimeout(bind, 0); document.addEventListener('DOMContentLoaded', bind);
  // CCTNS: one tab (Case Diary); the old "Upload File +" tab and its sidebar link now open this window
  PAGE_META.cctns.order = ['diary']; PAGE_META.cctns.names = { diary: '📒 Case Diary' }; PAGE_META.cctns.desc = 'Case Diary for all cases – FIR and CD reader, work done and pending, BNSS notices. Import / Upload adds FIR, CD, CS / FR and any file.';
  Pages.cctns = main => { if (S.sub.cctns === 'upload') { S.sub.cctns = 'diary'; setTimeout(() => Hub.open({}), 0); } const { body } = tabs(main, 'cctns', [['diary', '📒 Case Diary']], 'CCTNS'); CCTNS.diary(body); };
  const up = $('.cctns-subs [data-cct="upload"]'); if (up) up.remove();
  CCTNS.upload = el => { el.innerHTML = ''; Hub.open({}); };
})();
