/* datafind.js – "Where is my data?": every page shows what the case really holds.
   1. 📦 Data In Every Case – Dashboard / CCTNS card: what each case holds (NCRP, money trail, KYC, social, telecom,
      FIR, CD parts, documents, identifiers read from documents). Click a number to open that case on that page.
   2. 🔎 Found In Your Documents – identifiers read from the FIR / CD / documents (mobile, account, UPI, IFSC, PAN,
      email, IP, IMEI, URL) with ring + bar charts, filters, other cases and Track. Shown on Financial, NCRP,
      Money Trail and Social pages when their own sheets are empty, and always under Analytics. */
'use strict';
const DataFind = {
  TY: { mobile: '📱 Mobile', account: '🏦 Account', upi: '💸 UPI', ifsc: '🏛 IFSC', pan: '🪪 PAN', aadhaar: '🆔 Aadhaar', email: '✉ Email', ip: '🌐 IP', imei: '📟 IMEI', url: '🔗 Link / URL' },
  PAGE: { financial: ['account', 'upi', 'ifsc', 'pan', 'aadhaar', 'mobile', 'email'], ncrp: ['mobile', 'account', 'upi', 'email', 'url'], trail: ['account', 'upi', 'ifsc', 'mobile'], social: ['email', 'mobile', 'url', 'ip', 'imei'] },
  tl(t) { return this.TY[t] || t; },
  /* what one case holds */
  counts(d) {
    d = d || {}; const n = k => (Array.isArray(d[k]) ? d[k].length : 0), cc = d.cctns || {};
    return { ncrp: n('ncrp'), txns: n('txns'), kyc: n('kyc'), social: n('social') + n('google'), tel: n('tel'), caf: n('caf'), fir: cc.fir && String(cc.fir.text || '').trim() ? 1 : 0, cd: (cc.cd || []).length, docs: (cc.docs || []).length, ids: n('idents'), files: n('imports') };
  },
  COLS: [['ncrp', 'NCRP Complaints', 'ncrp'], ['txns', 'Money Trail / Statement Rows', 'trail'], ['kyc', 'KYC / Beneficiary', 'financial'], ['social', 'Social Media', 'social'], ['tel', 'Telecom (CDR / IPDR)', 'tele'], ['caf', 'CAF', 'caf'], ['fir', 'FIR Read', 'cctns'], ['cd', 'CD Parts', 'cctns'], ['docs', 'Documents', 'cctns'], ['ids', 'Identifiers From Documents', 'analytics', 'docs'], ['files', 'Files Imported', 'financial']],
  async all() {
    const out = [];
    for (const c of S.cases) { let d; try { d = c.id === S.caseId ? S.data : await DB.get('case:' + c.id); } catch (e) { d = null; } out.push({ c, n: this.counts(d) }); await new Promise(r => setTimeout(r, 0)); }
    return out;
  },
  /* plain-words reason for empty pages */
  why(R) {
    const tot = k => R.reduce((s, r) => s + (r.n[k] || 0), 0), L = [];
    if (!tot('ncrp') && !tot('txns')) L.push('No NCRP / bank-action (money trail) sheet is imported in any case – that is why Complaints, Money Trail, Amount and Mule Accounts show 0. Open the case, then <b>Financial Trail › Import</b> the NCRP / bank-action Excel.');
    if (!tot('kyc')) L.push('No KYC / beneficiary reply from a bank is imported – Bank & Financial › KYC stays empty until a bank reply (Excel / PDF) is added.');
    if (!tot('social')) L.push('No social-media / Google / WhatsApp reply is imported yet.');
    if (!tot('fir') && !tot('cd')) L.push('No FIR text or case-diary part is read yet – IO › Case Diary › Import / Upload the CCTNS zip, FIR and CD PDFs.');
    const big = R.filter(r => r.n.ids).sort((a, b) => b.n.ids - a.n.ids);
    if (big.length) L.push(`Identifiers read from documents: ${big.map(r => `<b>${esc(AllMode.caseLabel(r.c))}</b> – ${fmtNum(r.n.ids)}`).join(', ')}. These are now shown on every page under <b>🔎 Found In Your Documents</b> and in <b>Analytics › Found In Documents</b>.`);
    return L;
  },
  async check(el) {
    if (!el || !S.cases.length) return;
    let box = $('#dfChk', el); if (!box) { el.insertAdjacentHTML('beforeend', '<div class="card df-chk" id="dfChk"><div class="muted small">Checking the data of every case…</div></div>'); box = $('#dfChk', el); }
    const R = await this.all(); if (!document.body.contains(box)) return;
    const tot = k => R.reduce((s, r) => s + (r.n[k] || 0), 0), why = this.why(R);
    box.innerHTML = `<div class="d2-hd"><h3>📦 Data In Every Case</h3><span class="sub">What each case really holds on this computer. Click a number to open that case on that page. Nothing here is changed or deleted.</span></div>
      ${why.length ? `<div class="df-why"><b>Why some pages show 0:</b><ul>${why.map(w => `<li>${w}</li>`).join('')}</ul></div>` : ''}
      <div class="tbl-wrap"><table class="tbl df-t"><thead><tr><th>Case</th>${this.COLS.map(c => `<th class="num">${esc(c[1])}</th>`).join('')}</tr></thead><tbody>
      ${R.map(r => `<tr><td><b>${esc(AllMode.caseLabel(r.c))}</b></td>${this.COLS.map(c => { const v = r.n[c[0]] || 0, s = c[0] === 'fir' ? (v ? 'Yes' : 'No') : fmtNum(v); return `<td class="num">${v ? `<button class="df-n" data-dfc="${r.c.id}" data-dfp="${c[2]}" data-dfs="${c[3] || ''}" title="Open ${esc(c[1])} of this case">${s}</button>` : `<span class="muted">${s}</span>`}</td>`; }).join('')}</tr>`).join('')}
      <tr class="df-tot"><td><b>All Cases</b></td>${this.COLS.map(c => `<td class="num"><b>${c[0] === 'fir' ? tot('fir') + ' of ' + R.length : fmtNum(tot(c[0]))}</b></td>`).join('')}</tr></tbody></table></div>`;
    $$('[data-dfc]', box).forEach(b => b.onclick = async () => { const id = b.dataset.dfc, p = b.dataset.dfp; if (b.dataset.dfs) S.sub[p] = b.dataset.dfs; if (S.caseId !== id) { S.page = p; await switchCase(id); } else go(p); });
  },
  /* identifiers of the shown data (one case or All Cases), grouped by type + value */
  rows(types) {
    const G = new Map();
    for (const i of S.data.idents || []) {
      if (!i || !i.value || (types && !types.includes(i.type))) continue; if (typeof isSynthetic === 'function' && isSynthetic(String(i.value))) continue;
      const k = i.type + '|' + String(i.value).toLowerCase(); let g = G.get(k);
      if (!g) G.set(k, g = { type: i.type, value: String(i.value), src: new Set(), cases: new Set(), ids: new Set() });
      g.src.add(String(i.source || 'Document').replace(/^(Document|FIR|CS|FR) · /, '')); if (i._case) g.cases.add(i._case); if (i._caseId) g.ids.add(i._caseId);
    }
    return [...G.values()].map(g => ({ type: g.type, value: g.value, n: g.src.size, srcs: [...g.src], src: [...g.src].slice(0, 4).join(' | ') + (g.src.size > 4 ? ' +' + (g.src.size - 4) : ''), cases: [...g.cases], nc: g.cases.size || 1 }));
  },
  _f: {},
  panel(el, types, o = {}) {
    if (!el) return; const all = this.rows(types); if (!all.length && !o.always) return;
    const f = this._f, key = (types || ['*']).join(','); if (f.key !== key) { f.key = key; f.t = ''; f.s = ''; }
    const by = (L, g) => { const m = new Map(); L.forEach(x => g(x).forEach(k => m.set(k, (m.get(k) || 0) + 1))); return [...m].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n); };
    const R = all.filter(x => (!f.t || x.type === f.t) && (!f.s || x.srcs.includes(f.s)));
    const T = by(all, x => [this.tl(x.type)]), Src = by(all.filter(x => !f.t || x.type === f.t), x => x.srcs), multi = all.filter(x => x.n > 1).length, mc = all.filter(x => x.nc > 1).length;
    const id = 'df' + (o.id || 'P'); let box = $('#' + id, el);
    const html = `<div class="d2-hd"><h3>🔎 Found In Your Documents <span class="pill">${fmtNum(all.length)}</span></h3><span class="sub">${esc(o.why || 'Mobiles, accounts, UPI, IFSC, PAN, e-mail, IP, IMEI and links read from the FIR, case diary and documents of ' + (AllMode.on() ? 'all cases' : 'this case') + '. Click a ring part or a file to filter, a row to track it everywhere.')}</span></div>
      ${all.length ? `<div class="df-kp">${[['Identifiers', all.length, ''], ['Types', T.length, ''], ['Files Read', Src.length, ''], ['Seen In 2+ Files', multi, 'Strong leads – the same number in more than one document'], ...(AllMode.on() ? [['In 2+ Cases', mc, 'Common suspects across your cases']] : [])].map(([l, v, t]) => `<div class="df-k" title="${esc(t || l)}"><b>${fmtNum(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>
      <div class="df-ch"><div><h4>By Type</h4>${Trend.ring(T, f.t ? this.tl(f.t) : '', 'data-dft', all.length, 'identifiers')}</div>
      <div><h4>By File / Document ${f.s ? `<button class="btn sm" data-dfx="s">✕ ${esc(f.s.slice(0, 30))}</button>` : ''}</h4><div class="df-bars">${Src.slice(0, 12).map(x => `<button class="df-bar ${f.s === x.k ? 'on' : ''}" data-dfs2="${esc(x.k)}" title="${esc(x.k)} – ${x.n} identifiers"><span>${esc(x.k)}</span><i style="width:${Math.max(3, x.n / Src[0].n * 100)}%"></i><b>${fmtNum(x.n)}</b></button>`).join('')}${Src.length > 12 ? `<div class="small muted">+ ${Src.length - 12} more files</div>` : ''}</div></div></div>
      ${f.t || f.s ? `<div class="row small" style="margin:6px 0">Showing <b>${fmtNum(R.length)}</b> of ${fmtNum(all.length)} ${f.t ? '· ' + esc(this.tl(f.t)) : ''} <button class="btn sm" data-dfx="all">✕ Clear Filter</button></div>` : ''}
      <div class="df-tb"></div>` : `<div class="muted small">Nothing read from documents yet.</div>`}`;
    if (!box) { el.insertAdjacentHTML('beforeend', `<div class="card df-p" id="${id}"></div>`); box = $('#' + id, el); }
    box.innerHTML = html; const again = () => this.panel(el, types, o);
    $$('[data-dft]', box).forEach(b => b.onclick = () => { const t = Object.keys(this.TY).find(k => this.TY[k] === b.dataset.dft) || b.dataset.dft; f.t = f.t === t ? '' : t; again(); });
    $$('[data-dfs2]', box).forEach(b => b.onclick = () => { f.s = f.s === b.dataset.dfs2 ? '' : b.dataset.dfs2; again(); });
    $$('[data-dfx]', box).forEach(b => b.onclick = () => { if (b.dataset.dfx === 'all') { f.t = ''; f.s = ''; } else f.s = ''; again(); });
    const tb = $('.df-tb', box); if (!tb) return;
    Table(tb, { rows: R, pageSize: 50, noNd: true, sortKey: 'n', sortDir: -1, exportName: 'found_in_documents', onRow: r => Dash2.track(r.value), columns: [
      { key: 'type', label: 'Type', render: r => esc(this.tl(r.type)) },
      { key: 'value', label: 'Identifier', render: r => `<b class="mono">${esc(r.value)}</b>` },
      { key: 'n', label: 'Files', num: true, render: r => r.n > 1 ? `<b class="bad-t">${r.n}</b>` : '1' },
      { key: 'src', label: 'Found In', render: r => `<span class="small">${esc(r.src)}</span>` },
      ...(AllMode.on() ? [{ key: 'nc', label: 'Cases', num: true, csv: r => r.cases.join(' | '), render: r => `<span title="${esc(r.cases.join(' | '))}">${r.nc > 1 ? `<b class="bad-t">${r.nc}</b>` : r.nc}</span>` }] : []),
      { key: 'go', label: 'Track', sortVal: () => '', csv: () => '', render: () => '<span class="btn sm">🎯 Track</span>' }] });
  },
  /* page hooks */
  empty(p, d) { return p === 'financial' ? !d.kyc.length && !d.txns.length : p === 'ncrp' ? !d.ncrp.length && !d.txns.length : p === 'trail' ? !d.txns.length : p === 'social' ? !d.social.length && !(d.google || []).length : false; }
};
(() => {
  const or = render;
  render = function () {
    const r = or.apply(this, arguments);
    try {
      const p = S.page, d = S.data || {}, main = $('#main');
      if (d._loading) return r;
      if (DataFind.PAGE[p] && (d.idents || []).length && DataFind.empty(p, d)) DataFind.panel(main, DataFind.PAGE[p], { id: 'Pg', why: `This page has no ${p === 'social' ? 'social-media reply' : p === 'financial' ? 'bank / KYC sheet' : 'NCRP / money-trail sheet'} yet, but the documents of ${AllMode.on() ? 'your cases' : 'this case'} name these – track them now, and import the sheet for the full trail.` });
      if (p === 'dashboard' && S.cases.length) DataFind.check(main);
      if (p === 'cctns' && (S.sub.cctns || 'diary') === 'diary' && AllMode.on()) { const c = $('.card', main); if (c) { const w = document.createElement('div'); c.after(w); DataFind.check(w); } }
    } catch (e) { console.warn('datafind', e); }
    return r;
  };
  if (typeof AnaTabs !== 'undefined') AnaTabs.docs = el => DataFind.panel(el, null, { id: 'An', always: true });
})();
