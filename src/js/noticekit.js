/* noticekit.js - shared tools for every notice / letter drafter:
   recipient lists that fit the notice (editable), Import Notice Draft, Email via NIC / Gov mail,
   and the office format: Arial Narrow 11 pt, headline and subject in bold. */
// jurisdiction line: "Ghaziabad" → "Police Commissionerate Ghaziabad" (kept as typed if it already says Commissionerate / District)
function juris(d) { d = String(d || 'Ghaziabad').trim(); return /commissionerate|district|कमिश्नरेट|जनपद|जिला/i.test(d) ? d : 'Police Commissionerate ' + d; }
/* Document font – one choice of font type, size and line spacing used by every notice, draft, press note, duty chart and report (screen view, Print / PDF and Word) */
const DocFont = {
  FONTS: [['English', ['Arial Narrow', 'Arial', 'Abadi', 'Times New Roman', 'Bookman Old Style', 'Calibri', 'Cambria', 'Georgia', 'Garamond', 'Century Gothic', 'Verdana', 'Tahoma', 'Courier New']],
    ['हिंदी / Hindi', ['Nirmala UI', 'Utsaah', 'Kokila', 'Mangal', 'Aparajita', 'Sanskrit Text', 'Noto Sans Devanagari']]],
  LANG: { en: ['English', 'Arial Narrow'], hi: ['हिन्दी', 'Nirmala UI'] },
  all() { return this.FONTS.flatMap(([, L]) => L); },
  SIZES: [9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20],
  LH: [['1', 'Single'], ['1.15', '1.15'], ['1.35', 'Normal'], ['1.5', '1.5'], ['2', 'Double']],
  DEF: { f: 'Arial Narrow', s: 11, lh: 1.35, lang: 'en' },
  get() { const o = Object.assign({}, this.DEF, (typeof S !== 'undefined' && S.settings && S.settings.docFont) || {}); o.s = +o.s || 11; o.lh = +o.lh || 1.35; if (o.lang !== 'hi') o.lang = 'en'; return o; },
  css(f) { f = f || this.get().f; return `'${String(f).replace(/'/g, '')}', 'Nirmala UI', Mangal, 'Noto Sans Devanagari', Arial, sans-serif`; },
  apply() { const o = this.get(), r = document.documentElement.style; r.setProperty('--doc-font', this.css(o.f)); r.setProperty('--doc-size', o.s + 'pt'); r.setProperty('--doc-lh', o.lh); },
  async set(k, v) { S.settings.docFont = Object.assign(this.get(), { [k]: k === 'f' || k === 'lang' ? v : +v }); this.apply(); await saveMeta(); $$('.df-bar').forEach(b => this.sync(b)); },
  sync(b) { const o = this.get(); $('.df-f', b).value = o.f; $('.df-s', b).value = String(o.s); $('.df-l', b).value = String(o.lh); $$('[data-lg]', b).forEach(x => x.classList.toggle('on', x.dataset.lg === o.lang)); },
  bar(cls = '') { const o = this.get();
    return `<div class="df-bar ${cls}" title="Font used in notices, drafts, press notes, duty chart and reports – on screen, in Print / PDF and in Word"><span class="df-ic">🔤</span>
      <label title="Language of letter formats and notices – English or Hindi"><span>Language</span><span class="df-lg">${Object.entries(this.LANG).map(([k, [n]]) => `<button type="button" class="btn sm" data-lg="${k}">${n}</button>`).join('')}</span></label>
      <label><span>Font Type</span><select class="df-f">${(o.lang === 'hi' ? this.FONTS.slice().reverse() : this.FONTS).map(([g, L]) => `<optgroup label="${g}">${L.map(f => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('')}</optgroup>`).join('')}${this.FONTS.some(([, L]) => L.includes(o.f)) ? '' : `<option>${esc(o.f)}</option>`}</select></label>
      <label><span>Font Size</span><select class="df-s">${this.SIZES.map(s => `<option value="${s}">${s} pt</option>`).join('')}</select></label>
      <label><span>Spacing</span><select class="df-l">${this.LH.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <button class="btn sm df-r" title="Back to Arial Narrow 11 pt">↺</button><span class="df-pv">Aa अआ 123</span></div>`; },
  // English / Hindi: letter formats switch to that language; the font moves to that language's group if needed
  async setLang(lg) { const o = this.get(); if (o.lang === lg) return; const grp = this.FONTS[lg === 'hi' ? 1 : 0][1];
    S.settings.docFont = Object.assign(o, { lang: lg }, grp.includes(o.f) ? {} : { f: this.LANG[lg][1] }); this.apply(); await saveMeta();
    UI.toast(lg === 'hi' ? 'भाषा: हिन्दी – पत्र प्रारूप हिन्दी में, फ़ॉन्ट ' + S.settings.docFont.f : 'Language: English – letter formats in English, font ' + S.settings.docFont.f);
    const inModal = [...document.querySelectorAll('.df-bar')].some(x => !document.getElementById('main') || !document.getElementById('main').contains(x));
    $$('.df-bar').forEach(x => this.sync(x)); if (!inModal && typeof render === 'function') render(); },
  bind(b) { if (!b) return; this.sync(b); $('.df-f', b).onchange = e => this.set('f', e.target.value); $('.df-s', b).onchange = e => this.set('s', e.target.value); $('.df-l', b).onchange = e => this.set('lh', e.target.value);
    $$('[data-lg]', b).forEach(x => x.onclick = () => this.setLang(x.dataset.lg));
    $('.df-r', b).onclick = async () => { S.settings.docFont = Object.assign({}, this.DEF, { lang: this.get().lang }); this.apply(); await saveMeta(); $$('.df-bar').forEach(x => this.sync(x)); UI.toast('Font reset to Arial Narrow 11 pt'); }; }
};
const NoticeKit = {
  get FONT() { return DocFont.css(); },
  MAIL: 'https://mail.gov.in',
  REC: {
    bank: ['Bank', ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Punjab National Bank', 'Bank of Baroda', 'Kotak Mahindra Bank', 'Canara Bank', 'Union Bank of India', 'Bank of India', 'Indian Bank', 'IndusInd Bank', 'Yes Bank', 'IDFC First Bank', 'AU Small Finance Bank', 'Airtel Payments Bank', 'Paytm Payments Bank', 'Fino Payments Bank', 'India Post Payments Bank']],
    tel: ['Telecom operator', ['Reliance Jio Infocomm Ltd', 'Bharti Airtel Ltd', 'Vodafone Idea Ltd (Vi)', 'Bharat Sanchar Nigam Ltd (BSNL)', 'MTNL']],
    plat: ['Platform', ['Meta Platforms (WhatsApp)', 'Meta Platforms (Facebook / Instagram)', 'Google LLC (Gmail / YouTube)', 'Telegram Messenger', 'X Corp (Twitter)', 'Snapchat', 'ShareChat / Moj', 'Truecaller', 'Microsoft', 'Amazon Web Services', 'GoDaddy', 'Cloudflare']],
    pay: ['Payment / e-commerce company', ['NPCI', 'PhonePe', 'Google Pay', 'Paytm', 'Amazon Pay', 'MobiKwik', 'Razorpay', 'Cashfree', 'PayU', 'Amazon', 'Flipkart', 'WazirX', 'CoinDCX', 'Binance']],
    person: ['Person (accused / witness)', []]
  },
  kindOf(key) {
    const k = String(key || '');
    if (/^(bank_|atm_|lift_lien|unfreeze)/.test(k)) return 'bank';
    if (/^tel/.test(k)) return 'tel';
    if (/^(upi|pg|ecom|crypto)$/.test(k)) return 'pay';
    if (/^(intermediary|takedown|email|domain|preserve)$/.test(k)) return 'plat';
    if (/^(n353|n179|n94)$/.test(k)) return 'person';
    return 'other';
  },
  caseBanks() { try { return uniq(Analysis.accountRows().filter(a => a.layer > 0 && !isSynthetic(a.acc)).map(a => (a.bank || '').split(' / ')[0]).filter(Boolean)).sort(); } catch (e) { return []; } },
  casePlats() { return uniq((S.data.social || []).map(s => s.platform).filter(Boolean)).sort(); },
  // fill a "To / Bank / Platform" select: blank, values from this case, a saved list, and "✏ Edit"
  recipients(sel, kind, caseOpts, keep) {
    if (!sel) return;
    const k = this.REC[kind] ? kind : 'person', [title, defs] = this.REC[k], key = 'rcp-' + k;
    const saved = EditList.items(key, defs), v = keep !== undefined ? keep : sel.value;
    const caseVals = new Set(caseOpts.map(o => o[1]));
    sel.innerHTML = '<option value="">— choose —</option>'
      + (caseOpts.length ? `<optgroup label="In this case">${caseOpts.map(([val, lab]) => `<option value="${esc(val)}">${esc(lab)}</option>`).join('')}</optgroup>` : '')
      + `<optgroup label="${esc(title)} list">${saved.filter(s => !caseVals.has(s)).map(s => `<option value="s:${esc(s)}">${esc(s)}</option>`).join('') || '<option disabled>(empty – use ✏ to add)</option>'}</optgroup>`
      + `<option value="__edit">✏ Edit / reorder ${esc(title.toLowerCase())} list…</option>`;
    sel.value = [...sel.options].some(o => o.value === v) ? v : '';
    sel.dataset.last = sel.value; sel.dataset.kind = k;
    if (!sel._nk) { sel._nk = 1; sel.addEventListener('change', e => {
      if (sel.value !== '__edit') { sel.dataset.last = sel.value; return; }
      e.stopImmediatePropagation(); const last = sel.dataset.last || ''; sel.value = last; const kk = sel.dataset.kind;
      EditList.edit('rcp-' + kk, this.REC[kk][1], this.REC[kk][0] + ' list', () => this.recipients(sel, kk, sel._caseOpts || [], last));
    }, true); }
    sel._caseOpts = caseOpts;
  },
  // value from recipients() → plain name
  nameOf(v) { return String(v || '').replace(/^[a-z]:/, ''); },

  /* ---------- format ---------- */
  bold(l) { const s = l.trim(); if (!s) return false; if (/^\*\*.+\*\*$/.test(s)) return true;
    return /^(subject|sub\.?|विषय|re)\s*[:\-–]/i.test(s) || (s.length > 3 && s.length < 140 && /[A-Z]{3}/.test(s) && s === s.toUpperCase() && !/^[\d(]/.test(s) && !/\d{6,}/.test(s)); },
  lines(text) { // [{t, b, c}] – c = centre (headline at the top)
    let top = true; return String(text || '').replace(/\r/g, '').split('\n').map(l => { const s = l.trim(), b = this.bold(l), t = l.replace(/^\s*\*\*(.+)\*\*\s*$/, '$1');
      const c = top && b && !/^(subject|sub\.?|विषय|re)\s*[:\-–]/i.test(s); if (s && !c) top = false; return { t, b, c }; });
  },
  html(text) { return this.lines(text).map(x => `<div style="${x.b ? 'font-weight:bold;' : ''}${x.c ? 'text-align:center;' : ''}min-height:1.2em;white-space:pre-wrap">${esc(x.t)}</div>`).join(''); },
  page(text, title) { return `<html><head><meta charset="utf-8"><title>${esc(title || 'Notice')}</title><style>@page{size:A4;margin:2cm}body{font-family:${this.FONT};font-size:${DocFont.get().s}pt;line-height:${DocFont.get().lh};color:#000}</style></head><body>${this.html(text)}</body></html>`; },
  print(text) { const w = window.open('', '_blank'); if (!w) return UI.toast('Pop-up blocked. Allow pop-ups for this page.');
    w.document.write(this.page(text).replace('<body>', '<body><div class="np" style="font:13px Arial;margin-bottom:12px"><button onclick="print()">🖨 Print / Save as PDF</button></div><style>@media print{.np{display:none}}</style>')); w.document.close(); },
  doc(name, text) { UI.download(name, this.page(text, name), 'application/msword'); },
  docx(name, text) { Docx.save(name, Docx.letter(text, name)); },
  // headline for drafts that do not have one
  head(text, title) {
    const L = this.lines(text); if (L.some(x => x.c)) return text;
    const c = activeCase(), ps = String(c.ps || '________').replace(/\s*\bP\.?S\.?$/i, '').trim(), d = c.district || 'Ghaziabad';
    return `OFFICE OF THE STATION HOUSE OFFICER\nPOLICE STATION ${ps.toUpperCase()}, ${juris(d).toUpperCase()}${title ? '\n' + title.toUpperCase() : ''}\n\n` + text;
  },

  /* ---------- import a draft ---------- */
  async readDocx(buf) {
    const files = await GReply.unzip(buf), f = files.find(x => /document\.xml$|content\.xml$/.test(x.name)); if (!f) return '';
    const x = await f.text();
    return x.replace(/<w:tab\/>|<text:tab\/>/g, '\t').replace(/<w:br[^>]*\/>|<text:line-break\/>/g, '\n').replace(/<\/w:p>|<\/text:p>|<\/text:h>/g, '\n').replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
  },
  async readAny(f) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext === 'docx' || ext === 'odt') return this.readDocx(await f.arrayBuffer());
    if (ext === 'doc') { const b = new Uint8Array(await f.arrayBuffer()); if (b[0] === 0x50 && b[1] === 0x4b) return this.readDocx(b.buffer);
      const t = new TextDecoder().decode(b); if (/<html|<body/i.test(t)) return GReply.html2text(t);
      const u = new TextDecoder('utf-16le').decode(b.slice(0, b.length - b.length % 2)); const runs = u.match(/[\x20-\x7Eऀ-ॿ₹\r\n\t]{12,}/g) || [];
      return runs.join('\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }
    if (ext === 'rtf') { const t = await f.text(); return t.replace(/\\par[d]?/g, '\n').replace(/\{\\\*[^}]*\}|\\[a-z]+-?\d* ?|[{}]/g, '').replace(/\n{3,}/g, '\n\n').trim(); }
    return (await GReply.read(f)).text || '';
  },
  fillVars(text, o = {}) { let v = {}; try { v = Notices.vars(o.bank || '', o.platform || '', o.ref || '', o.company || ''); } catch (e) { } return String(text).replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ?? m); },
  importDraft(ta, o = {}) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.docx,.doc,.odt,.rtf,.txt,.htm,.html,.pdf';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; let t = '';
      try { t = await this.readAny(f); } catch (e) { }
      if (!t.trim()) return UI.toast('Could not read text from ' + f.name + '. Save it as .docx or .txt and try again.', 6000);
      if (ta.value.trim() && !UI.confirm('Replace the text in the editor with "' + f.name + '"?')) return;
      ta.value = this.fillVars(t, o.vars ? o.vars() : {}); ta.dispatchEvent(new Event('input', { bubbles: true }));
      if (UI.confirm('Draft loaded. Also keep it as ⭐ My template so it can be used in every case?\n\nTip: write {{fir}}, {{ps}}, {{section}}, {{accounts}}, {{mobiles}} in your file where case details should go.')) {
        (S.settings.myTpl || (S.settings.myTpl = [])).push({ id: 'my_' + uid(), name: f.name.replace(/\.[^.]+$/, ''), text: t }); saveMeta(); UI.toast('Saved in ⭐ My templates'); if (o.after) o.after(); }
      else UI.toast('Draft loaded from ' + f.name);
    };
    inp.click();
  },

  /* ---------- email via NIC / Gov mail ---------- */
  email(text, o = {}) {
    if (!String(text).trim()) return UI.toast('Nothing to send yet');
    const subj = (String(text).match(/^\s*(?:subject|sub\.?|विषय)\s*[:\-–]\s*(.+)$/im) || [])[1] || o.subject || 'Notice';
    const copy = () => navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject();
    copy().catch(() => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { } t.remove(); });
    const b = UI.modal('✉ Email this notice', `<div class="nk-mail"><p>The full notice is <b>copied</b>. In the mail, click <b>Compose</b> and press <b>Ctrl + V</b> in the message box.</p>
      <label class="small muted">Subject (copy into the mail)</label><div class="row" style="gap:6px"><input id="nkSub" value="${esc(subj)}" style="flex:1"><button class="btn sm" id="nkSubCp">Copy</button></div>
      <p class="small muted" style="margin-top:10px">To attach it as a file, use <b>⬇ Word</b> first, then attach the downloaded file in the mail.</p>
      <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><a class="btn primary" href="${this.MAIL}" target="_blank" rel="noopener">🏛 Open NIC / Gov mail (mail.gov.in)</a><button class="btn" id="nkCp">📋 Copy notice again</button><a class="btn" id="nkTo" href="#">✉ Other mail app</a></div></div>`,
      [{ label: 'Close', onClick: UI.closeModal }]);
    $('#nkSubCp', b).onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('#nkSub', b).value); UI.toast('Subject copied'); };
    $('#nkCp', b).onclick = () => { copy(); UI.toast('Notice copied'); };
    $('#nkTo', b).href = 'mailto:?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(String(text).slice(0, 1800));
    window.open(this.MAIL, '_blank', 'noopener');
  },

  /* ---------- add the buttons to a drafter ---------- */
  tools(row, ta, o = {}) {
    if (!row || !ta || row.querySelector('.nk-imp')) return;
    ta.classList.add('nk-ta');
    const pv = document.createElement('div'); pv.className = 'nk-pv hidden'; ta.after(pv);
    row.insertAdjacentHTML('afterbegin', `<button class="btn nk-imp" title="Load your own notice draft (Word / text / PDF)">📥 Import Notice Draft</button><button class="btn nk-mail-b" title="Copy the notice and open NIC / Gov e-mail">✉ Email</button><button class="btn nk-pv-b" title="See it as it will print">👁 Formatted view</button>`);
    row.querySelector('.nk-imp').onclick = () => this.importDraft(ta, o);
    row.querySelector('.nk-mail-b').onclick = () => this.email(ta.value, o);
    const pb = row.querySelector('.nk-pv-b'); pb.onclick = () => { const on = pv.classList.toggle('hidden'); ta.classList.toggle('hidden', !on); pb.textContent = on ? '👁 Formatted view' : '✏ Edit text'; if (!on) pv.innerHTML = this.html(ta.value); };
  }
};

/* every notice uses the office format */
Reports.printText = t => NoticeKit.print(t);
Docx.letter = function (text, title) {
  return this.build(NoticeKit.lines(text).map(x => this.p(this.r(x.t, { b: x.b }), { after: 0, align: x.c ? 'center' : undefined })).join(''), { font: DocFont.get().f, size: DocFont.get().s, lh: DocFont.get().lh, title });
};
(() => { // headline on generated drafts
  const of = Notices.fill; Notices.fill = function (key) { const t = of.apply(this, arguments); return (S.settings.myTpl || []).some(m => m.id === key) || !t ? t : NoticeKit.head(t); };
})();
