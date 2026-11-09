/* rebuild.js – new tab layout for Complaints (NCRP), Money Trail and Bank & Financial, the
   "Match" view (NCRP trail ↔ bank statement ↔ beneficiary KYC) and the CAF "Data check" tab. */
'use strict';

/* ---------- Match: every account, which sources it is in, its KYC details and what it shares ---------- */
const Match = {
  FIELDS: ['mobile', 'email', 'pan', 'aadhaar'],
  rows() {
    return Analysis.cached('match:rows', () => {
      const { A } = Analysis.fin();
      const inStmt = new Set(), inTrail = new Set(), ncrpAcks = new Set(S.data.ncrp.map(n => n.ack_no).filter(Boolean));
      for (const t of S.data.txns) { const s = t._type === 'stmt' ? inStmt : inTrail; if (t.from_acc) s.add(t.from_acc); if (t.to_acc) s.add(t.to_acc); }
      // which accounts use the same mobile / email / PAN / Aadhaar
      const share = new Map(), put = (f, v, acc) => { if (!v || !acc || isSynthetic(acc)) return; const k = f + ':' + String(v).trim().toLowerCase(); if (!share.has(k)) share.set(k, new Set()); share.get(k).add(acc); };
      for (const k of S.data.kyc) this.FIELDS.forEach(f => put(f, k[f], k.acc));
      for (const t of S.data.txns) this.FIELDS.forEach(f => put(f, t[f], t.to_acc));
      const out = [];
      for (const n of A.values()) {
        if (isSynthetic(n.acc) || n.acc.startsWith('VICTIM:') || n.acc === 'UNIDENTIFIED') continue;
        const pick = f => uniq(n.kyc.map(x => x[f]).filter(Boolean).map(String)).join(' / ');
        const sh = [];
        this.FIELDS.forEach(f => uniq(n.kyc.map(x => x[f]).filter(Boolean)).forEach(v => { const set = share.get(f + ':' + String(v).trim().toLowerCase()); if (set && set.size > 1) sh.push({ f, v, others: [...set].filter(a => a !== n.acc) }); }));
        const acks = [...n.acks];
        out.push({ acc: n.acc, layer: n.layer, name: pick('name') || [...n.names].join(' / '), bank: pick('bank') || [...n.banks].join(' / '), ifsc: pick('ifsc') || [...n.ifscs].join(' / '),
          mobile: pick('mobile'), email: pick('email'), pan: pick('pan'), aadhaar: pick('aadhaar'), state: pick('state'), district: pick('district'), upi: pick('linked'),
          inTrail: inTrail.has(n.acc), inStmt: inStmt.has(n.acc), hasKyc: n.kyc.length > 0, inNcrp: acks.some(a => ncrpAcks.has(a)) || acks.length > 0,
          acks: acks.length, ackList: acks.join(', '), inAmt: n.inAmt, outAmt: n.outAmt, score: n.score, shared: sh, sharedN: sh.reduce((a, s) => a + s.others.length, 0),
          sources: [acks.length > 0, inStmt.has(n.acc), n.kyc.length > 0].filter(Boolean).length });
      }
      return out;
    });
  },
  CF: [['account', 'Account number'], ['ifsc', 'IFSC'], ['bank', 'Bank'], ['state', 'State'], ['district', 'District'], ['mobile', 'Mobile'], ['email', 'Email'], ['name', 'Name'], ['aadhaar', 'Aadhaar'], ['pan', 'PAN'], ['upi', 'UPI ID'], ['address', 'Address'], ['ip', 'IP address'], ['utr', 'UTR / Txn ID']],
  mount(el, page) {
    const R = this.rows(), f = S.matchF || 'all';
    const F = [['all', 'All accounts', () => true], ['three', 'In NCRP + statement + KYC', r => r.sources === 3], ['nokyc', 'KYC missing – ask the bank', r => !r.hasKyc], ['kyc', 'KYC received', r => r.hasKyc],
      ['stmt', 'In bank statements', r => r.inStmt], ['multi', 'In 2+ complaints', r => r.acks >= 2], ['shared', 'Shares mobile / email / PAN / Aadhaar', r => r.sharedN > 0]];
    const cur = F.find(x => x[0] === f) || F[0], rows = R.filter(cur[2]);
    const cc = this.CF.map(([k, l]) => { let n = 0; try { n = Analysis.finCommon(k).filter(g => g.n >= 2 && (g.accs >= 2 || g.acks >= 2)).length; } catch (e) { } return [k, l, n]; });
    el.innerHTML = `<div class="note">Every account from the <b>NCRP / bank action trail</b>, the <b>bank statements</b> and the <b>beneficiary KYC</b> details in one list, so you can see what matches, what is common and what is still missing. Click an account for its full details.</div>
      ${UI.kpis([['Accounts', fmtNum(R.length), 'in trail and statements'], ['In NCRP trail', fmtNum(R.filter(r => r.acks).length), 'linked to a complaint'], ['In statements', fmtNum(R.filter(r => r.inStmt).length), 'bank statement rows'], ['KYC received', fmtNum(R.filter(r => r.hasKyc).length), 'beneficiary details'], ['KYC missing', fmtNum(R.filter(r => !r.hasKyc).length), 'ask the bank'], ['Share details', fmtNum(R.filter(r => r.sharedN).length), 'same mobile / email / PAN / Aadhaar']])}
      <div class="card mt-common"><h3>🔗 Common values across NCRP, statements and KYC</h3><div class="sub">Values found 2 or more times on different accounts or complaints. Click one to open the full list in Common Details.</div>
        <div class="mt-chips">${cc.map(([k, l, n]) => `<button class="mt-chip ${n ? 'on' : ''}" data-cf="${k}"><span>${esc(l)}</span><b>${n}</b></button>`).join('')}</div></div>
      <div class="card"><h3>🧾 Account match – NCRP ↔ Statement ↔ KYC</h3>
        <div class="mt-filters">${F.map(([k, l, fn]) => `<button class="mt-f ${k === cur[0] ? 'on' : ''}" data-mf="${k}">${esc(l)} <b>${R.filter(fn).length}</b></button>`).join('')}</div><div id="mtT"></div></div>`;
    $$('[data-mf]', el).forEach(b => b.onclick = () => { S.matchF = b.dataset.mf; this.mount(el, page); });
    $$('[data-cf]', el).forEach(b => b.onclick = () => { S.finCommonField = b.dataset.cf; S.finCommonMin = 2; go(page, 'common'); });
    const yes = (on, t) => on ? `<span class="mt-y" title="${t}">✓</span>` : `<span class="mt-n" title="Not in ${t}">–</span>`;
    Table($('#mtT', el), { rows, exportName: 'account_match_' + cur[0], sortKey: 'sources', sortDir: -1, pageSize: 50,
      columns: [
        { key: 'acc', label: 'Account', render: r => `<b>${accLink(r.acc)}</b>` }, { key: 'layer', label: 'Layer', num: true, render: r => r.layer ? `<span class="badge">L${r.layer}</span>` : '' },
        { key: 'sources', label: 'NCRP · Stmt · KYC', num: true, render: r => `${yes(r.acks > 0, 'NCRP trail')}${yes(r.inStmt, 'bank statement')}${yes(r.hasKyc, 'KYC')}` },
        { key: 'name', label: 'Holder name' }, { key: 'bank', label: 'Bank' }, { key: 'ifsc', label: 'IFSC', render: r => `<span class="mono">${esc(r.ifsc)}</span>` },
        { key: 'mobile', label: 'Mobile', render: r => `<span class="mono">${esc(r.mobile)}</span>` }, { key: 'email', label: 'Email' }, { key: 'pan', label: 'PAN', render: r => `<span class="mono">${esc(r.pan)}</span>` },
        { key: 'aadhaar', label: 'Aadhaar', render: r => `<span class="mono">${esc(r.aadhaar)}</span>` }, { key: 'state', label: 'State' }, { key: 'district', label: 'District' },
        { key: 'acks', label: 'Complaints', num: true, render: r => r.acks >= 2 ? `<span class="badge bad">${r.acks}</span>` : r.acks || '' },
        { key: 'sharedN', label: 'Shares with', num: true, render: r => r.shared.length ? r.shared.map(s => `<div class="small"><b>${esc(s.f)}</b> ${esc(String(s.v))} → ${s.others.slice(0, 3).map(a => accLink(a)).join(', ')}${s.others.length > 3 ? ' +' + (s.others.length - 3) : ''}</div>`).join('') : '' },
        { key: 'inAmt', label: 'Received', num: true, render: r => fmtINR(r.inAmt) }, { key: 'outAmt', label: 'Sent', num: true, render: r => fmtINR(r.outAmt) },
        { key: 'score', label: 'Risk', num: true, render: r => `<span class="badge ${r.score >= 60 ? 'bad' : r.score >= 30 ? 'warn' : ''}">${r.score}</span>` }
      ], after: bindAccLinks, onRow: r => showAccount(r.acc) });
  }
};

/* ---------- new tabs on the three investigation pages ---------- */
(() => {
  const N = PAGE_META.ncrp, Fi = PAGE_META.financial;
  N.extra = [['gaming', 'Bulk Split & Gaming'], ['chart', 'Flow Chart / Mind Map / Network']];
  N.order = ['case', 'data', 'summary', 'gaming', 'chart', 'common', 'link'];
  Object.assign(N.names, { gaming: '🎮 Bulk Split & Gaming', chart: '🕸 Flow Chart / Mind Map / Network' });
  Fi.extra = [['gaming', 'Bulk Split & Gaming'], ['match', 'Match']];
  Fi.order = ['data', 'kyc', 'match', 'trail', 'suspects', 'gaming', 'common', 'graph', 'banks'];
  Object.assign(Fi.names, { gaming: '🎮 Bulk Split & Gaming', match: '🔗 Match: Statement ↔ KYC ↔ NCRP', graph: '🕸 Flow Chart / Mind Map / Network', common: 'Common Details' });
  PAGE_META.trail = { group: 'Investigation', title: 'Money Trail', desc: 'Victim → Layer 1 → Layer 2 … from the NCRP / bank action sheet, joined with bank statements and beneficiary KYC.',
    order: ['trail', 'match', 'gaming', 'chart', 'common', 'fast'],
    names: { trail: '₹ Layer Cards', match: '🔗 Match: NCRP ↔ Statement ↔ KYC', gaming: '🎮 Bulk Split & Gaming', chart: '🕸 Flow Chart / Mind Map / Network', common: 'Common Details', fast: '⚡ Fast Movement' } };

  // the flow chart opens on the complaint chosen on the page
  NcrpTabs.gaming = el => AnaTabs.flags(el);
  NcrpTabs.chart = el => { const a = S.ncrpAck; if (a && (!S.graphOpt || S.graphOpt._from !== 'ncrp:' + a)) { S.graphOpt = Object.assign(S.graphOpt || {}, { ack: a, root: '', _from: 'ncrp:' + a }); } FinTabs.graph(el); };
  FinTabs.gaming = el => AnaTabs.flags(el);
  FinTabs.match = el => Match.mount(el, 'financial');

  const TT = {
    match: el => Match.mount(el, 'trail'), gaming: el => AnaTabs.flags(el), common: el => FinTabs.common(el), fast: el => AnaTabs.velocity(el),
    chart: el => { const a = S.trailAck; if (a && a !== '*' && (!S.graphOpt || S.graphOpt._from !== 'trail:' + a)) S.graphOpt = Object.assign(S.graphOpt || {}, { ack: a, root: '', _from: 'trail:' + a }); FinTabs.graph(el); }
  };
  const M = PAGE_META.trail, LIST = M.order.map(k => [k, M.names[k]]);
  const bar = cur => `<div class="tabs">${LIST.map(([k, l]) => `<div class="tab ${k === cur ? 'active' : ''}" data-t="${k}">${esc(l)}</div>`).join('')}</div>`;
  const origTrail = Pages.trail;
  Pages.trail = function (main) {
    const cur = LIST.some(t => t[0] === S.sub.trail) ? S.sub.trail : 'trail';
    if (cur === 'trail') {
      origTrail.apply(this, arguments);
      const head = main.querySelector('.page-title'); if (head) head.insertAdjacentHTML('afterend', bar(cur));
    } else {
      const { body } = tabs(main, 'trail', LIST, 'Money Trail', `<button class="btn primary" id="trImp2">⬆ Import trail / statement / KYC</button>`);
      $('#trImp2').onclick = () => openImport(['txn', 'ncrp', 'stmt', 'kyc'], render);
      const ack = S.trailAck && S.trailAck !== '*' ? S.trailAck : '';
      body.insertAdjacentHTML('beforebegin', `<div class="small muted tr-scope">${ack ? `Complaint <b class="mono">${esc(ack)}</b> is chosen on the Layer Cards tab. ` : ''}These views cover all complaints in this case unless a complaint is chosen inside them.</div>`);
      TT[cur](body);
    }
    $$('.tabs .tab', main).forEach(t => t.onclick = () => { S.sub.trail = t.dataset.t; render(); });
  };
})();

/* ---------- CAF: what was found in each PDF, what is missing, and what was read but not used ---------- */
CafTabs.check = (el, L) => {
  if (!L.length) { el.innerHTML = '<div class="card muted">No CAFs yet. Import CAF PDFs first.</div>'; return; }
  const shown = new Set(['mobile', 'operator', 'name', 'father', 'alt', 'act_date', 'act_time', 'pos_name', 'pos_code', 'pos_ucode', 'pos_mobile', 'pos_agent', 'dob', 'gender', 'aadhaar', 'poi_type', 'poi_no', 'email', 'address', 'pos_address', 'sim', 'imsi', 'caf_no']);
  const keys = uniq([...shown, ...CAF.F.map(f => f[0])]);
  const fr = keys.map(k => { const have = L.filter(c => c[k] != null && String(c[k]).trim() !== ''); return { key: k, label: CAF.label(k), found: have.length, pct: Math.round(have.length / L.length * 100), shown: shown.has(k), missing: L.filter(c => !have.includes(c)).map(c => c.file) }; });
  const per = L.map(c => { const miss = keys.filter(k => c[k] == null || String(c[k]).trim() === ''); const extra = (c.pairs || []).filter(([k]) => !CAF.fieldOf(k)); return { c, file: c.file, mobile: c.mobile || '', readable: c.readable, found: keys.length - miss.length, missN: miss.length, missing: miss.map(k => CAF.label(k)).join(', '), extraN: extra.length, chars: (c.text || '').replace(/\s/g, '').length }; });
  const X = new Map(); L.forEach(c => (c.pairs || []).forEach(([k, v]) => { if (CAF.fieldOf(k)) return; const key = String(k).trim(); let g = X.get(key); if (!g) X.set(key, g = { label: key, cafs: new Set(), ex: v }); g.cafs.add(c.file); }));
  const xr = [...X.values()].map(g => ({ label: g.label, n: g.cafs.size, ex: String(g.ex || '').slice(0, 60), files: [...g.cafs].join(', ') }));
  el.innerHTML = `<div class="note">After every import, check here what was read from each CAF PDF. <b>Missing</b> = the field was not found in that PDF (or the PDF is a scan with no text). <b>Not used</b> = text found in the PDF that the analysis does not use yet. Click a CAF to open its photos, fields and full text and fill in anything missing by hand.</div>
    ${UI.kpis([['CAFs', fmtNum(L.length)], ['Fully read', fmtNum(per.filter(p => p.missN <= 3).length), 'all main fields found'], ['Scanned (no text)', fmtNum(per.filter(p => !p.readable).length), 'fill in by hand'], ['Fields with gaps', fmtNum(fr.filter(f => f.found < L.length).length), 'missing in some CAFs'], ['Text not used', fmtNum(xr.length), 'labels found, not analysed']])}
    <div class="card"><h3>📋 Fields – found in how many CAFs</h3><div id="ckF"></div></div>
    <div class="card"><h3>📄 Each CAF – what is missing</h3><div id="ckP"></div></div>
    <div class="card"><h3>🔎 Found in the PDF but not used in the analysis</h3><div class="sub">Labels read from the PDFs that do not match any CAF field. If one of these matters, open the CAF and copy the value into the right field.</div><div id="ckX"></div></div>`;
  Table($('#ckF', el), { rows: fr, exportName: 'caf_fields_found', sortKey: 'pct', sortDir: 1, pageSize: 40,
    columns: [{ key: 'label', label: 'Field' }, { key: 'found', label: 'Found in', num: true, render: f => `${f.found} of ${L.length}` },
      { key: 'pct', label: 'Found %', num: true, render: f => `<span class="ck-bar"><i style="width:${f.pct}%;background:${f.pct === 100 ? '#10b981' : f.pct >= 50 ? '#eab308' : '#ef4444'}"></i></span> ${f.pct}%` },
      { key: 'shown', label: 'In CAF table', render: f => f.shown ? '✓' : '<span class="muted">not shown</span>' },
      { key: 'missing', label: 'Missing in', render: f => `<span class="small">${esc(f.missing.slice(0, 6).join(', '))}${f.missing.length > 6 ? ' +' + (f.missing.length - 6) + ' more' : ''}</span>` }] });
  Table($('#ckP', el), { rows: per, exportName: 'caf_missing_fields', sortKey: 'found', sortDir: 1, pageSize: 40,
    columns: [{ key: 'file', label: 'CAF file' }, { key: 'mobile', label: 'Mobile', render: p => `<b class="mono">${esc(p.mobile)}</b>` },
      { key: 'readable', label: 'Text', render: p => p.readable ? '✓ text' : '<span class="badge bad">scanned</span>' },
      { key: 'found', label: 'Fields found', num: true, render: p => `${p.found} / ${keys.length}` }, { key: 'missing', label: 'Missing fields', render: p => `<span class="small">${esc(p.missing)}</span>` },
      { key: 'extraN', label: 'Not used', num: true }, { key: 'chars', label: 'Characters read', num: true }],
    onRow: p => CAF.show(p.c) });
  Table($('#ckX', el), { rows: xr, exportName: 'caf_text_not_used', sortKey: 'n', sortDir: -1, pageSize: 30,
    columns: [{ key: 'label', label: 'Label in PDF' }, { key: 'n', label: 'CAFs', num: true }, { key: 'ex', label: 'Example value' }, { key: 'files', label: 'Files', render: x => `<span class="small">${esc(x.files.slice(0, 120))}</span>` }] });
};
(() => {
  PAGE_META.caf.order = ['data', 'check', 'common', 'photo']; PAGE_META.caf.names = Object.assign(PAGE_META.caf.names || {}, { check: '✅ Data Check (found / missing)' }); PAGE_META.caf.extra = [['check', 'Data Check']];
})();
