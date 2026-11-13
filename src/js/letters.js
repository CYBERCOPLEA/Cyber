/* letters.js – Letter Register for IO / EO: every letter, notice and report made in the tool is kept automatically with date & time,
   case (FIR / application / complaint), subject, letter no. and whom it was sent to – one view per case or for all cases, like the
   office "all letters" Word file. Kept on this computer only. */
'use strict';
const Letters = {
  list() { return Off.get('letters', []); },
  st() { return this._s || (this._s = { role: '', c: '', q: '', from: '', to: '', k: '', view: 'list' }); },
  H(s) { let h = 0; s = String(s || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); },
  txt(html) { const d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<\/(p|div|h\d|tr|li|table|td|th)>|<br\s*\/?>/gi, '$&\n'); d.querySelectorAll('.np,button').forEach(x => x.remove()); d.querySelectorAll('p,div,br,tr,h1,h2,h3,h4,li').forEach(x => x.insertAdjacentText('afterend', '\n')); return d.textContent.replace(/\n{3,}/g, '\n\n').trim(); },
  /* read To / Subject / Letter No / Date out of the letter */
  parse(t) {
    const L = String(t || '').split('\n').map(x => x.replace(/\*\*/g, '').trim()), o = { to: '', subject: '', ref: '', ldate: '', fir: '' };
    const ti = L.findIndex(x => /^(to|सेवा\s*में|प्रति)\s*[,:\-]?\s*$/i.test(x));
    if (ti >= 0) { const a = []; for (let i = ti + 1; i < L.length && a.length < 4; i++) { const x = L[i]; if (!x) { if (a.length) break; continue; } if (/^(subject|sub\.?|विषय|ref|reference|सन्दर्भ|संदर्भ)\b/i.test(x)) break; a.push(x.replace(/[,।]$/, '')); } o.to = a.join(', '); }
    if (!o.to) { const m = L.find(x => /^(to|सेवा\s*में|प्रति)\s*[,:\-]\s*\S/i.test(x)); if (m) o.to = m.replace(/^(to|सेवा\s*में|प्रति)\s*[,:\-]\s*/i, ''); }
    const s = L.find(x => /^(subject|sub\.?|विषय)\s*[:\-–—]/i.test(x)); if (s) o.subject = s.replace(/^(subject|sub\.?|विषय)\s*[:\-–—]\s*/i, '');
    if (!o.subject) { const h = L.find(x => x.length > 8 && x.length < 140 && (/^[A-Z0-9\s\-–()/.,']+$/.test(x) && /[A-Z]{4}/.test(x) || /(notice|report|letter|आख्या|नोटिस|पत्र)/i.test(x))); if (h) o.subject = h; }
    const r = L.map(x => x.match(/(?:ref\.?\s*no\.?|letter\s*no\.?|पत्रांक|पत्र\s*सं(?:ख्या)?\.?)\s*[:\-]?\s*([^\s,;].{0,60})/i)).find(Boolean); if (r) o.ref = r[1].replace(/\s*(date|dated|दिनांक).*$/i, '').trim();
    const d = L.map(x => x.match(/(?:^|\s)(?:date|dated|दिनांक)\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i)).find(Boolean); if (d) o.ldate = d[1];
    const f = String(t).match(/(?:FIR|case\s*crime|मु0?\s*अ0?\s*स0?|मुकदमा\s*अपराध)\s*(?:no\.?|number|संख्या)?\s*[:\-]?\s*(\d{1,5}\s*\/\s*\d{2,4})/i); if (f) o.fir = f[1].replace(/\s/g, '');
    if (o.subject.length > 220) o.subject = o.subject.slice(0, 220) + '…'; if (o.to.length > 220) o.to = o.to.slice(0, 220) + '…';
    return o;
  },
  role() { return /^(eo|jmis)$/.test(S.page) ? 'EO' : 'IO'; },
  KIND: { print: ['🖨', 'Print / PDF'], word: ['📘', 'Word'], email: ['✉️', 'E-mail'], pdf: ['📕', 'PDF'], html: ['🌐', 'HTML'], xlsx: ['📗', 'Excel'], img: ['🖼', 'Image'], draft: ['💾', 'Saved Draft'], manual: ['✍', 'Entered by Hand'] },
  /* called by every letter / notice / report maker */
  async log(o) {
    try {
      const text = o.text != null ? String(o.text) : this.txt(o.html); if (!text.trim() || text.trim().length < 20) return;
      const L = await this.list(), h = this.H(text), now = new Date(), how = o.how || 'print';
      const old = L.find(x => x.h === h && now - new Date(x.at) < 30 * 6e4);
      if (old) { if (!old.how.includes(how)) old.how.push(how); old.last = now.toISOString(); await Off.put('letters'); return old; }
      const P = this.parse(text), c = !isScope(S.caseId) && S.cases.find(x => x.id === S.caseId);
      const x = { id: uid(), h, at: now.toISOString(), how: [how], role: o.role || this.role(), page: S.page, title: String(o.title || '').replace(/\.(docx?|pdf|html?)$/i, '').replace(/_/g, ' ').trim(),
        caseId: o.caseId || (o.caseTxt ? '' : c ? c.id : ''), case: o.caseTxt || (c ? (typeof AllMode !== 'undefined' && AllMode.caseLabel ? AllMode.caseLabel(c) : c.name) : ''), fir: P.fir || (!o.caseTxt && c && c.fir) || '',
        to: o.to || P.to, subject: o.subject || P.subject || String(o.title || '').replace(/[_]/g, ' '), ref: P.ref, ldate: P.ldate, by: this.me(), text: text.slice(0, 60000) };
      L.push(x); await Off.put('letters'); return x;
    } catch (e) { }
  },
  me() { try { return (typeof Users !== 'undefined' && Users.cur && (Users.cur().name || Users.cur().user)) || ''; } catch (e) { return ''; } },
  dt(x) { const d = new Date(x); if (isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${ap}`; },
  day(x) { const d = new Date(x); return isNaN(d) ? '' : d.toISOString().slice(0, 10); },
  base(L, st, skip = '') {
    const q = st.q.toLowerCase(), t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const K = { today: x => new Date(x.at) >= t0, week: x => Date.now() - new Date(x.at) < 7 * 864e5, month: x => Date.now() - new Date(x.at) < 30 * 864e5 };
    return L.filter(x => (skip === 'role' || !st.role || x.role === st.role) && (skip === 'c' || !st.c || (st.c === '_none' ? !x.caseId && !x.case : (x.caseId || x.case) === st.c)) && (skip === 'k' || !st.k || K[st.k](x))
      && (!st.from || this.day(x.at) >= st.from) && (!st.to || this.day(x.at) <= st.to) && (!q || [x.case, x.fir, x.to, x.subject, x.ref, x.title, x.text, x.by].join(' ').toLowerCase().includes(q)));
  },
  async page(el) {
    this.tip(null); const L = (await this.list()).slice().sort((a, b) => String(b.at).localeCompare(String(a.at))), st = this.st(), B = this.base(L, st);
    const BK = this.base(L, st, 'k'), t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const kb = (k, lbl, ic, c, n) => `<button class="lr-k ${st.k === k ? 'on' : ''}" data-lk="${k}" style="--c:${c}"><span>${ic}</span><b>${fmtNum(n)}</b><small>${lbl}</small></button>`;
    const cases = new Map(); this.base(L, st, 'c').forEach(x => { const k = x.caseId || x.case || '_none'; const o = cases.get(k) || { k, name: x.case || 'No Case Linked', fir: x.fir, n: 0, last: x.at }; o.n++; cases.set(k, o); });
    const CS = [...cases.values()].sort((a, b) => b.n - a.n);
    el.innerHTML = `<div class="card"><div class="lr-ks">${kb('', 'All Letters', '📒', '#6366f1', BK.length)}${kb('today', 'Today', '📅', '#16a34a', BK.filter(x => new Date(x.at) >= t0).length)}${kb('week', 'Last 7 Days', '🗓', '#0ea5e9', BK.filter(x => Date.now() - new Date(x.at) < 7 * 864e5).length)}${kb('month', 'Last 30 Days', '📆', '#f97316', BK.filter(x => Date.now() - new Date(x.at) < 30 * 864e5).length)}<button class="lr-k" data-lv="case" style="--c:#be123c"><span>📁</span><b>${fmtNum(CS.length)}</b><small>Cases / Applications</small></button></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:12px">
        <span class="pill-group">${[['', 'IO + EO'], ['IO', '👮 IO'], ['EO', '🕵 EO']].map(([k, l]) => `<button data-lrole="${k}" class="${st.role === k ? 'active' : ''}">${l}</button>`).join('')}</span>
        <label class="small">Case / Application<select id="lrC"><option value="">All Cases (${fmtNum(this.base(L, st, 'c').length)})</option>${CS.map(c => `<option value="${esc(c.k)}" ${st.c === c.k ? 'selected' : ''}>${esc(c.name)} (${c.n})</option>`).join('')}</select></label>
        <label class="small">From<input type="date" id="lrF" value="${esc(st.from)}"></label><label class="small">To<input type="date" id="lrT" value="${esc(st.to)}"></label>
        <input id="lrQ" class="grow" placeholder="Find subject, sent to, letter no., FIR, words in the letter…" value="${esc(st.q)}">
        <button class="btn" id="lrClr">✖ Clear</button></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px"><span class="pill-group"><button data-lv="list" class="${st.view === 'list' ? 'active' : ''}">📋 Letter List</button><button data-lv="case" class="${st.view === 'case' ? 'active' : ''}">📁 Case Wise</button></span><span class="grow"></span>
        <button class="btn primary" id="lrOne" title="All the letters shown, one after another with date, time and sent to – like the office Word file">📄 One View – All Letters (${fmtNum(B.length)})</button><button class="btn" id="lrAdd" title="A letter written outside the tool">✍ Add Old Letter</button></div></div>
      <div class="card" id="lrBody"></div>`;
    const body = $('#lrBody', el);
    if (st.view === 'case') {
      const G = new Map(); B.forEach(x => { const k = x.caseId || x.case || '_none'; (G.get(k) || G.set(k, []).get(k)).push(x); });
      body.innerHTML = `<h3>📁 Case Wise Letters <span class="badge">${G.size}</span></h3>${[...G].sort((a, b) => b[1].length - a[1].length).map(([k, A]) => `<div class="lr-case"><div class="lr-ch" data-lc="${esc(k)}"><b>${esc(A[0].case || 'No Case Linked')}</b>${A[0].fir ? ` <span class="small muted">FIR ${esc(A[0].fir)}</span>` : ''}<span class="grow"></span><span class="badge">${A.length} letter${A.length > 1 ? 's' : ''}</span><span class="small muted">last ${esc(this.dt(A[0].at))}</span><button class="btn sm" data-lone="${esc(k)}">📄 One View</button></div>
        <ol class="lr-ol">${A.slice().reverse().map(x => `<li data-lo="${x.id}"><span class="lr-dt">${esc(this.dt(x.at))}</span> <span class="lr-ro ${x.role}">${x.role}</span> <b>${esc(x.subject || x.title || 'Letter')}</b>${x.to ? ` <span class="small">→ ${esc(x.to)}</span>` : ''}</li>`).join('')}</ol></div>`).join('') || '<div class="muted">No letter yet. Letters, notices and reports you print, save as Word / PDF or e-mail from IO / EO pages come here by themselves.</div>'}`;
      $$('[data-lone]', body).forEach(b => b.onclick = e => { e.stopPropagation(); this.one(B.filter(x => (x.caseId || x.case || '_none') === b.dataset.lone)); });
    } else {
      body.innerHTML = `<h3>📋 Letters Sent <span class="badge">${fmtNum(B.length)}</span></h3><div id="lrTb"></div>`;
      Table($('#lrTb', body), { rows: B, pageSize: 50, exportName: 'letter_register', onRow: x => this.open(x, el), columns: [
        { key: 'n', label: 'S.No.', nosort: true, csv: x => B.length - B.indexOf(x), render: x => `<b>${B.length - B.indexOf(x)}</b>` },
        { key: 'at', label: 'Date & Time', sortVal: x => x.at, csv: x => this.dt(x.at), render: x => `<b>${esc(this.dt(x.at))}</b>${x.ldate ? `<div class="small muted">Letter dated ${esc(x.ldate)}</div>` : ''}` },
        { key: 'role', label: 'By', render: x => `<span class="lr-ro ${x.role}">${x.role}</span>${x.by ? `<div class="small muted">${esc(x.by)}</div>` : ''}` },
        { key: 'case', label: 'Case / FIR / Application', csv: x => [x.case, x.fir && 'FIR ' + x.fir].filter(Boolean).join(' · '), render: x => `${esc(x.case || '—')}${x.fir ? `<div class="small">FIR ${esc(x.fir)}</div>` : ''}` },
        { key: 'subject', label: 'Letter / Subject', render: x => `<b>${esc(x.subject || x.title || 'Letter')}</b>${x.title && x.title !== x.subject ? `<div class="small muted">${esc(x.title)}</div>` : ''}` },
        { key: 'to', label: 'Sent To / For', render: x => `<span class="small">${esc(x.to || '—')}</span>` },
        { key: 'ref', label: 'Letter No.', render: x => `<span class="mono small">${esc(x.ref || '')}</span>` },
        { key: 'how', label: 'Made As', csv: x => x.how.map(k => (this.KIND[k] || [, k])[1]).join(', '), render: x => x.how.map(k => `<span title="${(this.KIND[k] || [, k])[1]}">${(this.KIND[k] || ['•'])[0]}</span>`).join(' ') },
        { key: 'act', label: '', nosort: true, noexport: true, render: x => `<button class="btn sm" data-lo="${x.id}">👁 Open</button>` }] });
    }
    $$('[data-lo]', el).forEach(b => b.onclick = e => { e.stopPropagation(); const x = L.find(y => y.id === b.dataset.lo); x && this.open(x, el); });
    $$('[data-lk]', el).forEach(b => { b.onclick = () => { st.k = st.k === b.dataset.lk && b.dataset.lk ? '' : b.dataset.lk; st.view = 'list'; this.page(el); };
      b.onmouseenter = () => this.tip(b, this.base(L, Object.assign({}, st, { k: b.dataset.lk }))); b.onmouseleave = () => this.tip(null); });
    $$('[data-lv]', el).forEach(b => b.onclick = () => { st.view = b.dataset.lv; this.page(el); });
    $$('[data-lrole]', el).forEach(b => b.onclick = () => { st.role = b.dataset.lrole; this.page(el); });
    $('#lrC', el).onchange = e => { st.c = e.target.value; this.page(el); };
    $('#lrF', el).onchange = $('#lrT', el).onchange = () => { st.from = $('#lrF', el).value; st.to = $('#lrT', el).value; this.page(el); };
    let qt; $('#lrQ', el).oninput = () => { clearTimeout(qt); qt = setTimeout(() => { st.q = $('#lrQ', el).value; this.page(el).then(() => { const q = $('#lrQ', el); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }); }, 350); };
    $('#lrClr', el).onclick = () => { Object.assign(st, { c: '', q: '', from: '', to: '', k: '' }); this.page(el); };
    $('#lrOne', el).onclick = () => this.one(B);
    $('#lrAdd', el).onclick = () => this.edit(null, el);
  },
  tip(b, R) {
    let t = $('#lrTip'); if (!b) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement('div'); t.id = 'lrTip'; t.className = 'jm-tip'; document.body.appendChild(t); }
    t.innerHTML = `<b>${esc(b.querySelector('small').textContent)} · ${R.length}</b>${R.length ? `<table>${R.slice(0, 8).map(x => `<tr><td>${esc(this.dt(x.at))}</td><td>${x.role}</td><td>${esc((x.subject || x.title || '').slice(0, 60))}</td><td>${esc((x.to || '').slice(0, 40))}</td></tr>`).join('')}</table>${R.length > 8 ? `<div class="small">+ ${R.length - 8} more – click to see all</div>` : '<div class="small">Click to see the list</div>'}` : '<div class="small">Nothing here</div>'}`;
    const r = b.getBoundingClientRect(); t.style.left = Math.max(8, Math.min(innerWidth - 560, r.left)) + 'px'; t.style.top = (r.bottom + 6) + 'px';
  },
  head(x, i) { return `<table class="lr-h"><tr><th>${i != null ? 'Letter ' + i : 'Letter'}</th><td><b>${esc(x.subject || x.title || '')}</b></td></tr><tr><th>Date &amp; Time</th><td>${esc(this.dt(x.at))}${x.ldate ? ' · letter dated ' + esc(x.ldate) : ''} · ${x.role}${x.by ? ' · ' + esc(x.by) : ''}</td></tr><tr><th>Case / FIR</th><td>${esc([x.case, x.fir && 'FIR ' + x.fir].filter(Boolean).join(' · ') || '—')}</td></tr><tr><th>Sent To / For</th><td>${esc(x.to || '—')}</td></tr>${x.ref ? `<tr><th>Letter No.</th><td>${esc(x.ref)}</td></tr>` : ''}</table>`; },
  CSS: `.lr-h{border-collapse:collapse;width:100%;margin:0 0 10px;font-family:Arial,sans-serif;font-size:9.5pt}.lr-h th,.lr-h td{border:1px solid #94a3b8;padding:3px 6px;text-align:left;vertical-align:top}.lr-h th{background:#e2e8f0;width:22%}.lr-t{white-space:pre-wrap}.lr-one{page-break-after:always;margin-bottom:26px;padding-bottom:16px;border-bottom:2px dashed #94a3b8}.lr-one:last-child{page-break-after:auto;border:0}`,
  body(x) { return `<div class="lr-t">${typeof NoticeKit !== 'undefined' && NoticeKit.html ? NoticeKit.html(x.text) : esc(x.text)}</div>`; },
  one(R) { if (!R.length) return UI.toast('No letter to show');
    const A = R.slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
    ExportAll.open('Letter Register – ' + (new Set(A.map(x => x.case)).size === 1 ? (A[0].case || 'Letters') : 'All Cases') + ' (' + A.length + ')', `<table class="lr-h"><tr><th>S.No.</th><th>Date &amp; Time</th><th>Case / FIR</th><th>Subject</th><th>Sent To / For</th></tr>${A.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(this.dt(x.at))}</td><td>${esc([x.case, x.fir].filter(Boolean).join(' · '))}</td><td>${esc(x.subject || x.title || '')}</td><td>${esc(x.to || '')}</td></tr>`).join('')}</table><div style="page-break-after:always"></div>` + A.map((x, i) => `<div class="lr-one">${this.head(x, i + 1)}${this.body(x)}</div>`).join(''), { css: this.CSS }); },
  open(x, el) {
    const m = UI.modal('📒 ' + (x.subject || x.title || 'Letter'), `${this.head(x)}<div class="lr-view">${this.body(x)}</div>`,
      [{ label: '🗑 Delete', cls: 'danger', onClick: async () => { if (!UI.confirm('Remove this letter from the register?')) return; const L = await this.list(); L.splice(L.findIndex(y => y.id === x.id), 1); await Off.put('letters'); UI.closeModal(); this.page(el); } },
        { label: '✏ Edit Details', onClick: () => { UI.closeModal(); this.edit(x, el); } },
        { label: '👁 Preview / Print / Word / PDF', cls: 'primary', onClick: () => ExportAll.open(x.subject || x.title || 'Letter', this.body(x), { bare: true, css: this.CSS }) }]);
    m.insertAdjacentHTML('afterbegin', `<style>${this.CSS}.lr-view{background:#fff;color:#000;padding:16px;border-radius:8px;max-height:60vh;overflow:auto;font-family:var(--doc-font);font-size:var(--doc-size);line-height:var(--doc-lh)}</style>`);
  },
  async edit(x, el) {
    const L = await this.list(), isNew = !x; x = x ? { ...x } : { id: uid(), at: new Date().toISOString(), how: ['manual'], role: this.st().role || 'IO', text: '' };
    const loc = new Date(new Date(x.at).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    const m = UI.modal(isNew ? '✍ Add Old Letter' : '✏ Letter Details', `<div class="map-grid"><label>Date &amp; Time Sent<input type="datetime-local" id="lx_at" value="${loc}"></label><label>By<select id="lx_role"><option ${x.role === 'IO' ? 'selected' : ''}>IO</option><option ${x.role === 'EO' ? 'selected' : ''}>EO</option></select></label>
      <label>Case<select id="lx_case"><option value="">— Not in tool / application —</option>${S.cases.map(c => `<option value="${esc(c.id)}" ${x.caseId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><label>FIR / Application No.<input id="lx_fir" value="${esc(x.fir || '')}"></label>
      <label>Subject<input id="lx_subject" value="${esc(x.subject || '')}"></label><label>Sent To / For<input id="lx_to" value="${esc(x.to || '')}"></label><label>Letter No.<input id="lx_ref" value="${esc(x.ref || '')}"></label></div>
      <label class="small" style="display:block;margin-top:8px">Letter Text<textarea id="lx_text" rows="12" style="width:100%">${esc(x.text || '')}</textarea></label><div class="err" id="lxErr"></div>`,
      [{ label: 'Cancel', onClick: UI.closeModal }, { label: '💾 Save', cls: 'primary', onClick: async () => {
        const v = k => $('#lx_' + k, m).value.trim(); if (!v('subject') && !v('text')) return $('#lxErr', m).textContent = 'Enter the subject or the letter text';
        const P = this.parse(v('text')), c = S.cases.find(y => y.id === v('case'));
        Object.assign(x, { at: new Date(v('at')).toISOString(), role: v('role'), caseId: c ? c.id : '', case: c ? c.name : (x.caseId ? '' : x.case || ''), fir: v('fir') || P.fir, subject: v('subject') || P.subject, to: v('to') || P.to, ref: v('ref') || P.ref, text: v('text') || v('subject') });
        x.h = this.H(x.text); const i = L.findIndex(y => y.id === x.id); i >= 0 ? (L[i] = x) : L.push(x); await Off.put('letters'); UI.closeModal(); UI.toast('Letter saved in the register'); this.page(el); } }]);
  }
};
PAGE_META.letters = { group: 'Investigation', title: 'Letter Register', desc: 'Every letter, notice and report you make (print, Word, PDF, e-mail) with date & time, case / FIR / application, subject and whom it was sent to – one view per case or for all cases.', order: ['letters'], names: { letters: '📒 Letter Register' } };
Pages.letters = main => { const { body } = tabs(main, 'letters', [['letters', '📒 Letter Register']], 'Letter Register'); Letters.page(body); };
addEventListener('scroll', () => Letters.tip(null), true);

/* every letter maker writes to the register */
(() => {
  const np = NoticeKit.print.bind(NoticeKit), ne = NoticeKit.email && NoticeKit.email.bind(NoticeKit), dl = Docx.letter.bind(Docx);
  NoticeKit.print = function (text, ...a) { Letters.log({ text, how: 'print' }); return np(text, ...a); };
  if (ne) NoticeKit.email = function (text, ...a) { Letters.log({ text, how: 'email' }); return ne(text, ...a); };
  Docx.letter = function (text, title, ...a) { Letters.log({ text, title, how: 'word' }); return dl(text, title, ...a); };
})();
