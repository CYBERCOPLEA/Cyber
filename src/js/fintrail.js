/* fintrail.js – ONE Money Trail & Bank page in 6 steps (Vijay, 14-11-2026: "Yes, one page in 6 steps").
   Money Trail and Bank & Financial were two pages with the same tabs (Bulk Split, Flow Chart, Common Details, Match).
   Now: 1 Import Data → 2 NCRP ↔ FIR → 3 Layer-Wise Trail → 4 Match & Common → 5 Suspect Accounts → 6 Chart & Notices.
   Every old link (go('trail'), go('financial', 'kyc') …) still lands on the right step. Complaints (NCRP) stays the per-Ack-No page. */
'use strict';
const FinFlow = {
  STEPS: [
    ['import', 'Import Data', '📥', 'NCRP bank action sheet, bank statements, money trail made in Excel by EO / IO, KYC', [
      ['data', 'All Transactions & Files', el => FinTabs.data(el)], ['kyc', 'KYC / Beneficiary', el => FinTabs.kyc(el)]]],
    ['link', 'NCRP ↔ FIR', '⚖', 'Which NCRP complaints (Ack No) belong to this FIR, and which still need an FIR', [
      ['link', 'Complaint ↔ FIR ↔ Trail', el => FinFlow.link(el)]]],
    ['layers', 'Layer-Wise Trail', '₹', 'Victim → Layer 1 → Layer 2 … and money that moved fast', [
      ['cards', '₹ Layer Cards', el => FinFlow.cards(el)], ['trail', 'Layer Table', el => FinTabs.trail(el)], ['fast', '⚡ Fast Movement', el => AnaTabs.velocity(el)]]],
    ['match', 'Match & Common', '🔗', 'Same account, mobile, PAN, IFSC, UPI or IP across NCRP, statements and KYC', [
      ['match', '🔗 Match: NCRP ↔ Statement ↔ KYC', el => Match.mount(el, 'financial')], ['common', 'Common Details', el => FinTabs.common(el)], ['csus', 'Common Suspects', el => NcrpTabs.common(el)]]],
    ['sus', 'Suspect Accounts', '🎯', 'Mule accounts by risk, bulk split, gaming / short-loan receivers', [
      ['suspects', 'Suspect Accounts', el => FinTabs.suspects(el)], ['gaming', '🎮 Bulk Split & Gaming', el => AnaTabs.flags(el)]]],
    ['act', 'Chart & Notices', '📨', 'Flow chart for the case file, bank-wise list for notices, IFSC lookup', [
      ['graph', '🕸 Flow Chart / Mind Map / Network', el => FinTabs.graph(el)], ['banks', 'Bank-Wise (for Notices)', el => FinTabs.banks(el)], ['ifsc', '🏦 IFSC Lookup', el => FinTabs.ifsc(el)]]]
  ],
  /* old tab names of both pages → step / view */
  OLD: { data: 'data', kyc: 'kyc', match: 'match', trail: 'trail', suspects: 'suspects', gaming: 'gaming', common: 'common', graph: 'graph', chart: 'graph', banks: 'banks', ifsc: 'ifsc', fast: 'fast', cards: 'cards', link: 'link', csus: 'csus' },
  stepOf(v) { return this.STEPS.find(s => s[4].some(x => x[0] === v)) || this.STEPS[0]; },
  count(step) { const d = S.data || {}, n = a => (a || []).length;
    try { switch (step) {
      case 'import': return n(d.txns) + n(d.kyc);
      case 'link': return Trail.complaints().length;
      case 'layers': return Math.max(0, ...Trail.complaints().map(c => c.layers || 0));
      case 'match': return Analysis.finCommon('account').filter(g => g.n >= 2).length;
      case 'sus': return Analysis.accountRows().filter(a => a.layer > 0 && !isSynthetic(a.acc)).length;
      case 'act': return uniq(Analysis.accountRows().filter(a => a.layer > 0 && !isSynthetic(a.acc)).map(a => String(a.bank || '').split(' / ')[0]).filter(Boolean)).length;
    } } catch (e) { } return 0; },
  render(main) {
    const v0 = S.sub.financial; const v = this.OLD[v0] || (this.STEPS.some(s => s[0] === v0) ? this.STEPS.find(s => s[0] === v0)[4][0][0] : 'data');
    const st = this.stepOf(v), view = st[4].some(x => x[0] === v) ? v : st[4][0][0]; S.sub.financial = view;
    main.innerHTML = `<div class="page-head"><div class="ph-text"><div class="crumb">Investigation <span>›</span> Financial Trail <span>›</span> Money Trail &amp; Bank</div><h2>Money Trail &amp; Bank</h2><div class="ph-desc">One page in 6 steps: import the data, link NCRP complaints to the FIR, follow the money layer by layer, match and find what is common, pick the suspect accounts, then chart it and send notices.</div></div>
      <div class="ph-actions"><button class="btn primary" id="fImp">⬆ Import Financial Data</button></div></div>
      <div class="ff-steps">${this.STEPS.map(([k, l, ic, d], i) => { const c = this.count(k); return `<button type="button" class="ff-step${k === st[0] ? ' on' : ''}" data-ffs="${k}" title="${esc(d)}"><span class="ff-n">${i + 1}</span><span class="ff-t"><b>${ic} ${esc(l)}</b><small>${esc(d)}</small></span>${c ? `<span class="ff-c">${fmtNum(c)}</span>` : ''}</button>`; }).join('<span class="ff-ar" aria-hidden="true">›</span>')}</div>
      ${st[4].length > 1 ? `<div class="tabs ff-tabs">${st[4].map(([k, l]) => `<div class="tab ${k === view ? 'active' : ''}" data-t="${k}">${esc(l)}</div>`).join('')}</div>` : ''}
      <div id="tabBody" class="ff-body"></div>`;
    const imp = $('#fImp', main); if (imp) imp.onclick = () => openImport(['txn', 'ncrp', 'stmt', 'kyc'], render);
    $$('[data-ffs]', main).forEach(b => b.onclick = () => { S.sub.financial = this.STEPS.find(s => s[0] === b.dataset.ffs)[4][0][0]; render(); });
    $$('.ff-tabs .tab', main).forEach(t => t.onclick = () => { S.sub.financial = t.dataset.t; render(); });
    const body = $('#tabBody', main);
    try { st[4].find(x => x[0] === view)[2](body); } catch (e) { console.warn('fintrail', e); body.innerHTML = `<div class="card muted">This view could not open: ${esc(e.message)}</div>`; }
  },
  /* Layer Cards (the old Money Trail page) inside step 3 */
  cards(el) { const box = document.createElement('div'); box.className = 'ff-cards'; el.appendChild(box); Trail.render(box); },
  /* Step 2: how this case is registered, and every NCRP complaint linked to it */
  link(el) {
    const c = activeCase() || {}, L = Trail.complaints(), fir = String(c.fir || '').trim(), ackC = String(c.ack || '').trim();
    const total = sum(L, x => x.reported || x.trailAmt || 0), big = !fir && total >= 500000;
    const other = a => (S.cases || []).filter(x => x.id !== S.caseId && String(x.ack || '').split(/[\s,;/]+/).includes(a)).map(x => x.name || x.fir || x.id);
    const path = fir ? (L.length ? 'FIR with NCRP complaints' : 'FIR, no NCRP sheet yet') : (L.length || ackC ? 'NCRP complaint, no FIR yet' : 'No FIR and no NCRP complaint yet');
    el.innerHTML = `<div class="ff-reg card"><div class="ff-reg-h"><b>This case</b><span class="badge ${fir ? 'ok' : big ? 'bad' : 'warn'}">${esc(path)}</span>${big ? '<span class="badge bad">⚖ FIR needed (₹5 lakh +)</span>' : ''}<span class="grow"></span><a href="#" class="db-edit" data-cbedit>✏ Add / change FIR, Ack No</a></div>
        <div class="ff-reg-g"><div><small>FIR No.</small><b>${fir ? esc(fir) : '<span class="muted">not yet</span>'}</b></div><div><small>NCRP Ack No (case)</small><b class="mono">${ackC ? esc(ackC) : '<span class="muted">—</span>'}</b></div><div><small>Complaints in data</small><b>${fmtNum(L.length)}</b></div><div><small>Reported loss</small><b>${fmtINR(total)}</b></div></div>
        <div class="ff-paths"><div><b>FIR first</b> – FIR registered directly; import the NCRP bank action sheet of its Ack No(s) and they link here.</div><div><b>NCRP first, then FIR</b> – complaint came on 1930 / cybercrime.gov.in; after enquiry add the FIR No. with ✏ and the same complaints stay linked.</div><div><b>NCRP, no FIR</b> – keep it as an NCRP case; ₹5 lakh and above is marked "FIR needed".</div></div></div>
      <div class="card"><h3>NCRP Complaints Linked to This Case</h3><div class="sub">Each Acknowledgement No with its trail. "Also in" shows another case that has the same Ack No. Click a row for the full complaint analysis.</div><div id="ffL"></div></div>`;
    const rows = L.map(x => ({ ack: x.ack, victim: x.victim || '', date: x.date || '', reported: x.reported || 0, trail: x.trailAmt || 0, hold: x.hold || 0, txns: x.txns || 0, layers: x.layers || 0, accs: typeof x.accounts === "number" ? x.accounts : (x.accounts && x.accounts.size) || 0, also: other(x.ack).join(', ') }));
    Table($('#ffL', el), { rows, exportName: 'ncrp_fir_link', sortKey: 'reported', sortDir: -1, empty: 'No NCRP complaint in this case yet. Import the NCRP bank action sheet (Acknowledgement No column) with ⬆ Import Financial Data.',
      columns: [{ key: 'ack', label: 'Ack No', render: r => `<b class="mono">${esc(r.ack)}</b>` }, { key: 'victim', label: 'Victim' }, { key: 'date', label: 'Date', fmt: v => String(v || '').slice(0, 10) },
        { key: 'reported', label: 'Reported Loss', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'trail', label: 'Layer 1 Amount', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'hold', label: 'On Hold', num: true, fmt: v => v ? fmtINR(v) : '' },
        { key: 'txns', label: 'Trail Txns', num: true }, { key: 'layers', label: 'Layers', num: true }, { key: 'accs', label: 'Accounts', num: true },
        { key: 'fir', label: 'FIR', render: () => fir ? `<span class="badge ok">${esc(fir)}</span>` : '<span class="badge warn">No FIR</span>' }, { key: 'also', label: 'Also In Case', render: r => r.also ? `<span class="badge info">${esc(r.also)}</span>` : '' }],
      onRow: r => { S.ncrpAck = r.ack; go('ncrp', 'case'); } });
  }
};
Pages.financial = main => FinFlow.render(main);
Pages.trail = main => { const v = S.sub.trail; S.sub.financial = FinFlow.OLD[v] && v !== 'trail' ? FinFlow.OLD[v] : 'cards'; S.page = 'financial'; FinFlow.render(main); };
/* go('trail', …) lands on step 3 of the one page */
(() => { const og = go; go = function (page, sub) { if (page === 'trail') { S.sub.financial = sub && FinFlow.OLD[sub] && sub !== 'trail' ? FinFlow.OLD[sub] : 'cards'; return og('financial'); } if (page === 'financial' && sub) S.sub.financial = FinFlow.OLD[sub] || sub; return og.apply(this, arguments); }; })();
/* Complaints (NCRP): the per-Ack-No page; Bulk Split, Flow Chart, Common Suspects and Complaint ↔ Trail now live in Money Trail & Bank */
(() => {
  const N = PAGE_META.ncrp; N.extra = []; N.order = ['case', 'data', 'summary']; N.only = true;
  if (PAGE_META.financial) Object.assign(PAGE_META.financial, { title: 'Money Trail & Bank' });
  const MOVE = { gaming: 'gaming', chart: 'graph', common: 'csus', link: 'link' };
  const r0 = render; render = function () {
    if (S.page === 'ncrp' && MOVE[S.sub.ncrp]) { S.sub.financial = MOVE[S.sub.ncrp]; S.sub.ncrp = 'case'; S.page = 'financial'; }
    const r = r0.apply(this, arguments);
    if (S.page === 'ncrp') { $$('#main .tabs .tab').forEach(t => { if (MOVE[t.dataset.t]) t.remove(); });
      const tb = $('#main .tabs'); if (tb && !$('.ff-jump', tb)) tb.insertAdjacentHTML('beforeend', `<div class="tab ff-jump" title="Bulk Split, Flow Chart, Common Suspects and Complaint ↔ FIR are in Money Trail & Bank">➜ Money Trail &amp; Bank</div>`), $('.ff-jump', tb).onclick = () => go('financial', 'link'); }
    /* sidebar: Complaints (NCRP) and Money Trail & Bank */
    const t = $('.nav-sub[data-fin="trail"]'); if (t) t.remove();
    const fn = $('.nav-sub[data-fin="financial"]'); if (fn && fn.dataset.ncOrig !== 'Money Trail & Bank') { fn.dataset.ncOrig = 'Money Trail & Bank'; fn.title = 'One page in 6 steps: import, NCRP ↔ FIR, layer trail, match & common, suspect accounts, chart & notices'; const sp = fn.querySelector(':scope > span'); if (sp) sp.textContent = 'Money Trail & Bank'; try { NavCustom.apply(); } catch (e) { } }
    return r; };
})();
