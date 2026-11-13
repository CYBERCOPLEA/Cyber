/* bulk.js – feeding the tool in bulk, one place each:
   1. Letter Register: fetches letters already in the tool (notice drafts, CCTNS notices, 35(3) notices) and imports old letters
      (Word / PDF / text / scans) into an existing or new case through the ONE Import window.
   2. Nodal / Escrow master list: accounts or names found during investigation – added once, matched in every case, Target and trail.
   3. EO: import existing enquiries from Excel / CSV / Word table, columns matched, checked and previewed before saving. */
'use strict';

/* ---------- 1. Letter Register: fetch from the whole tool + import old letters ---------- */
Object.assign(Letters, {
  async put(o) { // a letter with its own date (old letter / fetched)
    const text = String(o.text || '').trim(); if (text.length < 20) return null;
    const L = await this.list(), h = this.H(text); if (L.some(x => x.h === h)) return null;
    const P = this.parse(text), c = o.caseId && S.cases.find(x => x.id === o.caseId);
    let at = o.at; if (!at && P.ldate) { const t = Trend.ts(P.ldate); if (t) at = new Date(t + 10 * 36e5).toISOString(); }
    const x = { id: uid(), h, at: at || new Date().toISOString(), how: [o.how || 'import'], role: o.role || 'IO', page: o.page || 'import', title: String(o.title || '').replace(/\.(docx?|pdf|odt|rtf|txt|jpe?g|png)$/i, ''),
      caseId: c ? c.id : '', case: c ? (AllMode.caseLabel ? AllMode.caseLabel(c) : c.name) : (o.caseTxt || ''), fir: P.fir || (c && c.fir) || '', to: o.to || P.to, subject: o.subject || P.subject || o.title || 'Letter', ref: P.ref, ldate: P.ldate, by: o.by || '', text: text.slice(0, 60000), src: o.src || '' };
    L.push(x); return x;
  },
  /* letters already made in the tool before the register existed */
  async harvest() {
    let n = 0; const one = async (c, d) => {
      for (const x of d.drafts || []) if (await this.put({ text: x.text, at: x.updated || x.created, caseId: c.id, title: x.name, how: 'draft', src: 'Notice Draft' })) n++;
      for (const x of ((d.cctns || {}).notices || [])) if (await this.put({ text: x.text, at: x.when, caseId: c.id, title: x.name, to: x.to, how: 'draft', src: 'CCTNS Notice' })) n++; };
    for (const c of S.cases) { try { const d = c.id === S.caseId && S.data && !isScope(S.caseId) ? S.data : await DB.get('case:' + c.id); if (d) await one(c, d); } catch (e) { } await new Promise(r => setTimeout(r, 0)); }
    try { for (const a of await Off.get('accused', [])) for (const [k, t] of Object.entries(a.notice || {})) if (await this.put({ text: t, at: a.noticeDate ? a.noticeDate + 'T10:00' : a.at, caseId: a.caseId, title: (/c/.test(k) ? 'Compliance Report 35(3) – ' : 'Notice 35(3) BNSS – ') + a.name, how: 'draft', src: 'Arrest / Notice 35(3)' })) n++; } catch (e) { }
    if (n) await Off.put('letters'); S.settings.lrHarv = 2; saveMeta(); return n;
  },
  importOld() { Hub.open({ hint: 'letter', title: 'Old Letters → Letter Register', fresh: true, mode: 'old' }); }
});
{ const pg = Letters.page.bind(Letters);
  Letters.page = async function (el) {
    if (S.settings.lrHarv !== 2) { el.innerHTML = '<div class="card muted">Fetching letters from the whole tool…</div>'; await this.harvest(); }
    await pg(el);
    const add = $('#lrAdd', el); if (add) { add.insertAdjacentHTML('beforebegin', `<button class="btn primary" id="lrImp" title="Old letters (Word / PDF / scan / text) – choose the case or make a new one, then drop the files">📥 Import Old Letters</button><button class="btn" id="lrFetch" title="Read every case, notice draft, CCTNS notice and 35(3) notice again">🔄 Fetch From Whole Tool</button>`);
      $('#lrImp', el).onclick = () => this.importOld(); $('#lrFetch', el).onclick = async () => { const n = await this.harvest(); UI.toast(n ? n + ' letter(s) added from the tool' : 'No new letter found in the tool'); this.page(el); }; }
    /* analysis: month-wise and to whom */
    const st = this.st(), L = this.base(await this.list(), st), body = $('#lrBody', el); if (!body || !L.length) return;
    const ms = [...Array(12)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11 + i); return d.toISOString().slice(0, 7); });
    const mn = ms.map(m => ({ k: m, l: new Date(m + '-01T12:00').toLocaleDateString('en-IN', { month: 'short' }), n: L.filter(x => String(x.at).slice(0, 7) === m).length })), mx = Math.max(1, ...mn.map(x => x.n));
    const to = new Map(); L.forEach(x => { const k = (x.to || '—').split(',')[0].trim().slice(0, 60) || '—'; to.set(k, (to.get(k) || 0) + 1); }); const TT = [...to].sort((a, b) => b[1] - a[1]).slice(0, 10), tmx = Math.max(1, ...TT.map(x => x[1]));
    body.insertAdjacentHTML('beforebegin', `<div class="grid g2"><div class="card"><h3>📆 Letters Month-Wise <span class="small muted">last 12 months – click a month</span></h3><div class="tr-cols">${mn.map(x => `<button class="tr-col" data-lm="${x.k}"><span class="tr-cb"><i style="height:${x.n / mx * 100}%"></i></span><b>${x.n || ''}</b><small>${x.l}</small></button>`).join('')}</div></div>
      <div class="card"><h3>📮 Sent To / For <span class="small muted">top 10 – click to see those letters</span></h3><div class="jm-bars">${TT.map(([k, n]) => `<button class="jm-bar" data-lto="${esc(k)}"><span class="jm-bn">${esc(k)}</span><span class="jm-bt" style="width:${n / tmx * 100}%"><i class="u" style="flex:1"></i></span><b>${n}</b></button>`).join('')}</div></div></div>`);
    $$('[data-lm]', el).forEach(b => { const R = L.filter(x => String(x.at).slice(0, 7) === b.dataset.lm); b.onmouseenter = () => this.tip(b, R); b.onmouseleave = () => this.tip(null);
      b.onclick = () => { const [y, m] = b.dataset.lm.split('-'); st.from = b.dataset.lm + '-01'; st.to = b.dataset.lm + '-' + String(new Date(+y, +m, 0).getDate()).padStart(2, '0'); st.view = 'list'; this.tip(null); this.page(el); }; });
    $$('[data-lto]', el).forEach(b => { const R = L.filter(x => ((x.to || '—').split(',')[0].trim().slice(0, 60) || '—') === b.dataset.lto); b.onmouseenter = () => this.tip(b, R); b.onmouseleave = () => this.tip(null);
      b.onclick = () => { st.q = b.dataset.lto === '—' ? '' : b.dataset.lto; st.view = 'list'; this.tip(null); this.page(el); }; });
  };
  const tp = Letters.tip.bind(Letters); Letters.tip = function (b, R) { if (b && !b.querySelector('small')) { const s = document.createElement('small'); s.className = 'hidden'; s.textContent = b.textContent.trim().slice(0, 60); b.appendChild(s); } return tp(b, R); };
}
/* the ONE import window learns "Old Letter" */
Hub.K.letter = ['📒', 'Old Letter → Letter Register'];
{ const dt = Hub.detect.bind(Hub); Hub.detect = async function (q) { if (this.st.hint === 'letter' && /\.(pdf|docx?|odt|rtf|txt|html?|jpe?g|png|webp|bmp)$/i.test(q.f.name)) return 'letter'; return dt(q); };
  const rn = Hub.run.bind(Hub); Hub.run = async function () {
    const s = this.st, L = (s.Q || []).filter(q => q.kind === 'letter' && !q.ok);
    if (L.length && !s.busy) {
      const tid = await this.target(); if (!tid) return; let n = 0;
      for (const q of L) { let t = ''; try { t = await CDX.readFile(q.f, () => null); } catch (e) { q.res = 'Error: ' + e.message; continue; }
        const x = await Letters.put({ text: t, caseId: isScope(S.caseId) ? '' : S.caseId, title: q.f.name, at: Letters.parse(t).ldate ? '' : (q.f.lastModified ? new Date(q.f.lastModified).toISOString() : ''), how: 'import', role: Letters.st().role || 'IO', src: 'Imported' });
        q.ok = 1; q.res = x ? '📒 In Letter Register' + (x.subject ? ' – ' + x.subject.slice(0, 50) : '') : (t.trim() ? 'Already in the register' : '⚠ no text found'); if (x) n++; this.redraw(); }
      await Off.put('letters'); if (!s.Q.some(q => !q.ok && q.kind !== 'skip')) { s.done = true; s.log = `✔ ${n} old letter(s) added to the Letter Register.`; this.draw(); if (S.page === 'letters') render(); return; }
    }
    return rn();
  }; }

/* ---------- 2. Nodal / Escrow master list ---------- */
const NodalM = {
  TYPES: ['Nodal A/C', 'Escrow A/C', 'Payment Gateway', 'Wallet / Pool A/C', 'Aggregator / Merchant', 'Crypto Exchange', 'Other'],
  list() { return S.settings.nodalMaster || (S.settings.nodalMaster = []); },
  na(a) { return String(a || '').toUpperCase().replace(/[^0-9A-Z]/g, ''); },
  _ix: null, ix() { if (this._ix) return this._ix; const A = new Map(), K = []; this.list().forEach(x => { if (x.kw) K.push([x.kw.toUpperCase(), x]); else if (x.acc) A.set(this.na(x.acc), x); }); return (this._ix = { A, K }); },
  names: new Map(), // account → names / banks seen (filled by Target, used for keyword match across cases)
  hit(acc, txt) { const { A, K } = this.ix(), a = A.get(this.na(acc)); if (a) return a.type || 'Nodal A/C'; const u = String(txt || this.names.get(String(acc)) || '').toUpperCase(); if (u) for (const [k, x] of K) if (u.includes(k)) return x.type || 'Nodal A/C'; return ''; },
  async changed() { this._ix = null; await saveMeta(); try { Analysis.invalidate(); } catch (e) { } if (typeof Target !== 'undefined') Target._d = null; render(); },
  parseRows(A) { // rows (arrays) → entries
    let hi = A.findIndex(r => r.some(c => /acc|a\/c|account|खाता/i.test(String(c)))), H = hi >= 0 ? A[hi].map(c => String(c).toLowerCase()) : [];
    const ix = re => H.findIndex(h => re.test(h)), cA = hi >= 0 ? ix(/acc|a\/c|account|खाता/) : 0, cN = hi >= 0 ? ix(/name|holder|नाम/) : 1, cB = hi >= 0 ? ix(/bank/) : 2, cI = hi >= 0 ? ix(/ifsc/) : 3, cT = hi >= 0 ? ix(/type|nodal|escrow/) : 4, cK = hi >= 0 ? ix(/keyword|word/) : -1;
    const out = []; for (const r of A.slice(hi + 1)) { const g = i => i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : ''; const acc = g(cA).replace(/\s/g, ''), kw = g(cK);
      if (!/\d{6,}|^[A-Z0-9]{8,}$/i.test(acc) && !kw) continue; const t = g(cT); out.push({ acc: kw ? '' : acc, kw, name: g(cN), bank: g(cB), ifsc: g(cI).toUpperCase(), type: this.TYPES.find(x => t && x.toLowerCase().startsWith(t.toLowerCase().slice(0, 4))) || (t || 'Nodal A/C') }); }
    return out; },
  merge(E) { const L = this.list(); let a = 0, u = 0; for (const e of E) { const o = L.find(x => (e.kw ? x.kw && x.kw.toUpperCase() === e.kw.toUpperCase() : x.acc && this.na(x.acc) === this.na(e.acc))); if (o) { Object.keys(e).forEach(k => { if (e[k]) o[k] = e[k]; }); u++; } else { L.push({ id: uid(), added: new Date().toISOString(), ...e }); a++; } } return { a, u }; },
  seen(x) { const T = (typeof Target !== 'undefined' && Target._d) || []; return T.filter(t => x.kw ? [...t.names, ...t.banks].join(' ').toUpperCase().includes(x.kw.toUpperCase()) : this.na(t.acc) === this.na(x.acc)).reduce((s, t) => s + t.cases.length, 0); },
  open() {
    const L = this.list(), draw = () => {
      const m = UI.modal('🏛️ Nodal / Escrow Accounts – Master List', `<div class="note">Add every nodal / escrow / payment-gateway / wallet pool account you find during investigation – once. Every case, Target, Money Trail and account list then shows it as <b>With Nodal ~ Escrow</b> (ask it for the next beneficiary), so the own / mule accounts stand out. Kept on this computer.</div>
        <div class="map-grid"><label>Account No.<input id="nmA" placeholder="e.g. 50200012345678"></label><label>…or Name Word <span class="small muted">(matches any account whose name has it)</span><input id="nmK" placeholder="e.g. RAZORPAY, CASHFREE, PAYU"></label><label>Name / Holder<input id="nmN"></label><label>Bank<input id="nmB"></label><label>IFSC<input id="nmI"></label><label>Type<select id="nmT">${this.TYPES.map(t => `<option>${t}</option>`).join('')}</select></label></div>
        <div class="row" style="gap:8px;margin:8px 0;flex-wrap:wrap"><button class="btn primary" id="nmAdd">➕ Add</button><button class="btn" id="nmFile">📥 Import Excel / CSV</button><span class="small muted">or paste rows copied from Excel (Account, Name, Bank, IFSC, Type):</span></div>
        <textarea id="nmP" rows="3" placeholder="Paste here – one account per line" style="width:100%"></textarea><div class="row" style="justify-content:flex-end;margin-top:4px"><button class="btn" id="nmPaste">✔ Add Pasted Rows</button></div>
        <h4 style="margin:12px 0 6px">📋 List <span class="badge">${L.length}</span></h4><div id="nmTb"></div>`, [{ label: 'Close', onClick: UI.closeModal }]);
      Table($('#nmTb', m), { rows: L.slice().reverse(), pageSize: 20, exportName: 'nodal_escrow_master', noNd: true, columns: [
        { key: 'acc', label: 'Account / Name Word', csv: x => x.acc || 'word: ' + x.kw, render: x => x.acc ? `<b class="mono">${esc(x.acc)}</b>` : `<span class="tg-sp" style="--c:#7c3aed">word</span> <b>${esc(x.kw)}</b>` },
        { key: 'name', label: 'Name' }, { key: 'bank', label: 'Bank' }, { key: 'ifsc', label: 'IFSC' }, { key: 'type', label: 'Type' },
        { key: 'seen', label: 'In Cases', sortVal: x => this.seen(x), csv: x => this.seen(x), render: x => { const n = this.seen(x); return n ? `<b>${n}</b>` : '<span class="muted">—</span>'; } },
        { key: 'added', label: 'Added', render: x => esc(String(x.added || '').slice(0, 10)) },
        { key: 'del', label: '', nosort: true, noexport: true, render: x => `<button class="btn sm danger" data-nmd="${x.id}">🗑</button>` }] });
      const done = async (r, msg) => { await this.changed(); UI.toast(msg || `${r.a} added · ${r.u} updated`); draw(); };
      $('#nmAdd', m).onclick = () => { const v = k => $('#' + k, m).value.trim(), acc = v('nmA').replace(/\s/g, ''), kw = v('nmK'); if (!acc && !kw) return UI.toast('Type the account no. or a name word');
        if (acc && !/^[0-9A-Z]{6,20}$/i.test(acc)) return UI.toast('Account No. – 6 to 20 letters / digits'); done(this.merge([{ acc: kw ? '' : acc, kw: acc ? '' : kw, name: v('nmN'), bank: v('nmB'), ifsc: v('nmI').toUpperCase(), type: v('nmT') }])); };
      $('#nmPaste', m).onclick = () => { const A = $('#nmP', m).value.split(/\r?\n/).filter(x => x.trim()).map(l => l.split(/\t|,|;/)); const E = this.parseRows(A); if (!E.length) return UI.toast('No account found in the pasted rows'); done(this.merge(E)); };
      $('#nmFile', m).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv,.ods'; i.onchange = async () => { const f = i.files[0]; if (!f) return; try { const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), { type: 'string', raw: true }) : XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }); let E = []; wb.SheetNames.forEach(sn => E = E.concat(this.parseRows(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: false })))); if (!E.length) return UI.toast('No account column found'); done(this.merge(E)); } catch (e) { UI.toast('Could not read: ' + e.message); } }; i.click(); };
      $$('[data-nmd]', m).forEach(b => b.onclick = () => { const i = L.findIndex(x => x.id === b.dataset.nmd); if (i < 0 || !UI.confirm('Remove from the Nodal / Escrow list?')) return; L.splice(i, 1); done({ a: 0, u: 0 }, 'Removed'); });
    }; draw();
  }
};
{ const of0 = Nodal.of.bind(Nodal); Nodal.of = acc => NodalM.hit(acc) || of0(acc);
  const mp = Nodal.map.bind(Nodal); Nodal.map = function () { const M = mp(); if (!NodalM.ix().K.length) return M; return Analysis.cached('nodalkw', () => { const M2 = new Map(M);
    for (const t of S.data.txns || []) if (t.to_acc && !M2.has(t.to_acc)) { const h = NodalM.hit('', [t.to_name, t.to_bank, t.remarks].join(' ')); if (h) M2.set(t.to_acc, h); }
    for (const k of S.data.kyc || []) if (k.acc && !M2.has(k.acc)) { const h = NodalM.hit('', [k.name, k.bank].join(' ')); if (h) M2.set(k.acc, h); } return M2; }); };
  const td = Target.draw.bind(Target); Target.draw = function (el, T, J) { NodalM.names.clear(); T.forEach(t => NodalM.names.set(String(t.acc), [...t.names, ...t.banks].join(' '))); return td(el, T, J); };
  /* a "Nodal / Escrow List" button on every All / Without / With Nodal bar */
  let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; $$('.nd-bar').forEach(b => { if (b.querySelector('.nm-open')) return; const x = document.createElement('button'); x.className = 'btn sm nm-open'; x.type = 'button'; x.title = 'Add nodal / escrow accounts you found – matched in every case'; x.textContent = `🏛️ Nodal / Escrow List (${NodalM.list().length})`; x.onclick = () => NodalM.open(); const h = b.querySelector('.nd-h'); h ? b.insertBefore(x, h) : b.appendChild(x); }); }); }).observe(document.body, { childList: true, subtree: true });
}

/* ---------- 3. EO: import existing enquiries (Excel / CSV / Word table) ---------- */
Object.assign(EO, {
  IMPF: [['sr', 'SR No.', /^(s\.?\s*no|sr|sl|क्र)/i], ['type', 'Type', /type|प्रकार|category/i], ['no', 'Complaint / Ack / Case No.', /ack|complaint\s*no|case\s*no|शिकायत\s*सं|application\s*no|appl|^no\.?$/i], ['year', 'Year', /year|वर्ष/i],
    ['victim', 'Victim / Applicant', /victim|complainant|applicant|पीड़ित|आवेदक|शिकायतकर्ता|^name/i], ['mobile', 'Victim Mobile', /mobile|phone|contact|मोबाइल/i], ['amount', 'Fraud Amount', /amount|राशि|₹|rs\.?$/i],
    ['recv', 'Received Date', /receiv|प्राप्त|complaint\s*date|date\s*of\s*complaint|^date$|दिनांक/i], ['brief', 'Short Details', /brief|detail|fact|subject|nature|विवरण|विषय|घटना/i], ['status', 'Status', /status|स्थिति|result/i],
    ['sent', 'Report Sent / Closed Date', /sent|close|disposal|निस्तारण|report\s*date/i], ['notes', 'Closing Notes', /remark|note|finding|टिप्पणी|action/i], ['firno', 'FIR No.', /fir/i], ['ps', 'Police Station', /police\s*station|^ps$|थाना/i], ['io', 'IO Name', /^io|investigat|विवेचक/i]],
  async rowsOf(f) {
    if (/\.(xlsx?|xlsb|ods|csv)$/i.test(f.name)) { const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), { type: 'string', raw: true }) : XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true });
      let best = []; wb.SheetNames.forEach(sn => { const A = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: false, dateNF: 'dd/mm/yyyy' }); if (A.length > best.length) best = A; }); return best; }
    if (/\.(docx|odt)$/i.test(f.name)) { const files = await GReply.unzip(await f.arrayBuffer()), d = files.find(x => /document\.xml$|content\.xml$/.test(x.name)); if (!d) return [];
      const x = await d.text(), un = s => s.replace(/<w:tab\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
      let best = []; (x.match(/<w:tbl>[\s\S]*?<\/w:tbl>|<table:table [\s\S]*?<\/table:table>/g) || []).forEach(t => { const R = (t.match(/<w:tr[ >][\s\S]*?<\/w:tr>|<table:table-row[\s\S]*?<\/table:table-row>/g) || []).map(r => (r.match(/<w:tc>[\s\S]*?<\/w:tc>|<table:table-cell[\s\S]*?<\/table:table-cell>/g) || []).map(un)); if (R.length > best.length) best = R; });
      if (best.length) return best; return (await NoticeKit.readAny(f)).split('\n').filter(l => l.includes('\t')).map(l => l.split('\t')); }
    return (await NoticeKit.readAny(f)).split('\n').filter(l => /\t|\|/.test(l)).map(l => l.split(/\t|\|/));
  },
  mapOf(H) { const M = {}; H.forEach((h, i) => { h = String(h).trim(); if (!h) return; const hit = this.IMPF.find(([k, , re]) => !(k in M) && re.test(h)); if (hit) M[hit[0]] = i; }); return M; },
  rowTo(r, M) {
    const g = k => M[k] != null ? String(r[M[k]] == null ? '' : r[M[k]]).trim() : '', d = v => { const t = Trend.ts(v); return t ? new Date(t + 6 * 36e5).toISOString().slice(0, 10) : ''; };
    const no = g('no').replace(/\s+/g, ''), ty = g('type'), st = g('status'), err = [];
    const x = { sr: g('sr'), type: /fir/i.test(ty) ? 'FIR' : /ncrp|1930|ack/i.test(ty) || /^\d{14}$/.test(no) ? 'NCRP' : /comp|appl|शिकायत|प्रार्थना/i.test(ty) ? 'COMP' : (g('firno') ? 'FIR' : 'COMP'), no, year: (g('year').match(/(19|20)\d\d/) || [String(new Date().getFullYear())])[0],
      victim: g('victim'), mobile: g('mobile').replace(/\D/g, '').slice(-10), amount: String(+g('amount').replace(/[^\d.]/g, '') || ''), recv: d(g('recv')), brief: g('brief'), notes: g('notes'), sent: d(g('sent')),
      status: /fir/i.test(st) || g('firno') ? 'FIR' : /close|dispos|निस्तार|बंद|समाप्त|file/i.test(st) ? 'Close' : 'Pending', fir: { no: g('firno'), ps: g('ps'), io: g('io') } };
    if (!x.no && !x.victim) err.push('no Complaint No. or Victim');
    if (g('mobile') && !/^[6-9]\d{9}$/.test(x.mobile)) err.push('mobile not 10 digits');
    if (g('recv') && !x.recv) err.push('received date not read');
    if (g('amount') && !x.amount) err.push('amount not a number');
    return { x, err };
  },
  importPick(el) {
    const m = UI.modal('📥 Import Existing Enquiries (Excel / CSV / Word)', `<p class="small">Pick the enquiry register you already keep – Excel / CSV, or a Word file with a table. Columns are matched by their heading (you can change it), every row is checked, and nothing is saved until you press Import. Rows with the same Type + Complaint No. + Year update the old entry.</p>
      <label>File<input type="file" id="eiF" accept=".xlsx,.xls,.csv,.ods,.docx,.odt,.txt"></label><div id="eiP" style="margin-top:10px"></div>`,
      [{ label: 'Close', onClick: UI.closeModal }, { label: '📥 Import', cls: 'primary', onClick: () => this._imp && this._imp() }]);
    $('#eiF', m).onchange = async () => { const f = $('#eiF', m).files[0]; if (!f) return; const P = $('#eiP', m); P.innerHTML = '<div class="muted">Reading…</div>';
      let A = []; try { A = await this.rowsOf(f); } catch (e) { P.innerHTML = '❌ ' + esc(e.message); return; }
      const hi = A.findIndex(r => Object.keys(this.mapOf(r)).length >= 3); if (hi < 0) { P.innerHTML = '❌ Could not find a heading row (Complaint No., Victim, Mobile, Date…) in this file.'; return; }
      const H = A[hi].map(h => String(h).trim()), data = A.slice(hi + 1).filter(r => r.some(c => String(c).trim())); let M = this.mapOf(H);
      const show = () => { const R = data.map(r => this.rowTo(r, M)), bad = R.filter(r => r.err.length).length;
        P.innerHTML = `<div class="ei-map">${H.map((h, i) => `<label><span>${esc(h || 'Column ' + (i + 1))}</span><select data-ei="${i}"><option value="">— skip —</option>${this.IMPF.map(([k, l]) => `<option value="${k}" ${M[k] === i ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}</div>
          <div class="small" style="margin:8px 0"><b>${R.length}</b> rows · <span class="${bad ? 'bad-t' : ''}">${bad} with a problem</span> (still imported – fix later in the list)</div>
          <div class="tbl-wrap" style="max-height:300px"><table class="tbl"><thead><tr><th>#</th><th>Type</th><th>No. / Year</th><th>Victim</th><th>Mobile</th><th>Amount</th><th>Received</th><th>Status</th><th>Check</th></tr></thead><tbody>${R.slice(0, 200).map(({ x, err }, i) => `<tr><td>${i + 1}</td><td>${x.type}</td><td>${esc(x.no)}/${x.year}</td><td>${esc(x.victim)}</td><td>${esc(x.mobile)}</td><td>${x.amount ? fmtINR(+x.amount) : ''}</td><td>${esc(this.dmy(x.recv))}</td><td>${x.status}</td><td>${err.length ? `<span class="bad-t">⚠ ${esc(err.join(', '))}</span>` : '✔'}</td></tr>`).join('')}</tbody></table></div>`;
        $$('[data-ei]', P).forEach(s => s.onchange = () => { const i = +s.dataset.ei; Object.keys(M).forEach(k => { if (M[k] === i) delete M[k]; }); if (s.value) M[s.value] = i; show(); });
        this._imp = async () => { const L = await this.list(); let a = 0, u = 0, sr = Math.max(0, ...L.map(y => +y.sr || 0));
          for (const { x } of R) { const o = x.no && L.find(y => y.type === x.type && String(y.no) === x.no && String(y.year) === x.year);
            if (o) { Object.keys(x).forEach(k => { if (k === 'fir') { o.fir = o.fir || {}; Object.keys(x.fir).forEach(j => { if (x.fir[j]) o.fir[j] = x.fir[j]; }); } else if (x[k]) o[k] = x[k]; }); u++; }
            else { L.push({ id: uid(), ...x, sr: x.sr || String(++sr), at: new Date().toISOString() }); a++; } }
          await Off.put('eo'); UI.closeModal(); UI.toast(`📥 ${a} enquiries added · ${u} updated`, 5000); this.page(el); }; };
      show(); };
  }
});
{ const pg = EO.page.bind(EO); EO.page = async function (el) { const r = await pg(el); const a = $('#eoAdd', el); if (a && !$('#eoImp', el)) { a.insertAdjacentHTML('afterend', '<button class="btn" id="eoImp" title="Your existing enquiry register – Excel / CSV / Word table">📥 Import Enquiries</button>'); $('#eoImp', el).onclick = () => this.importPick(el); } return r; }; }
