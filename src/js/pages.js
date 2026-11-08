/* pages.js - all screens */
'use strict';

const Pages = {};
const ack = r => r.ack_no ? `<span class="badge info">${esc(r.ack_no)}</span>` : '';
const riskBadge = s => s >= 60 ? `<span class="badge bad">High ${s}</span>` : s >= 30 ? `<span class="badge warn">Medium ${s}</span>` : `<span class="badge">${s || 0}</span>`;
const accLink = a => a ? `<a href="#" data-acc="${esc(a)}" class="mono">${esc(accLabel(a))}</a>` : '';
function bindAccLinks(el) { $$('[data-acc]', el).forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); showAccount(a.dataset.acc); }); }

function tabs(main, page, list, title, actions = '') {
  const cur = S.sub[page] && list.some(t => t[0] === S.sub[page]) ? S.sub[page] : list[0][0];
  main.innerHTML = `<div class="page-title"><h2>${title}</h2><span class="spacer"></span>${actions}</div>
    <div class="tabs">${list.map(t => `<div class="tab ${t[0] === cur ? 'active' : ''}" data-t="${t[0]}">${t[1]}</div>`).join('')}</div><div id="tabBody"></div>`;
  $$('.tab', main).forEach(t => t.onclick = () => { S.sub[page] = t.dataset.t; render(); });
  return { cur, body: $('#tabBody', main) };
}

/* ======================= DASHBOARD ======================= */
Pages.dashboard = main => {
  const c = activeCase(), d = S.data;
  const acc = Analysis.accountRows();
  const ncrpAmt = sum(d.ncrp, r => r.amount), trailAmt = sum(d.txns.filter(t => t.layer === 1), t => t.amount) || sum(d.txns.filter(t => t._type === 'trail'), t => t.amount);
  const holdTrail = sum(acc, a => a.hold), holdNcrp = sum(d.ncrp, r => r.hold_amount), hold = Math.max(holdTrail, holdNcrp);
  const maxLayer = Math.max(0, ...acc.map(a => a.layer || 0));
  const high = acc.filter(a => a.score >= 60).length;
  const xl = Analysis.crossLinks().filter(x => x.refs >= 2).length;
  const comps = Trail.complaints(), noTrail = comps.filter(x => !x.txns).length;
  const banksN = uniq(acc.filter(a => a.layer > 0 && !isSynthetic(a.acc)).map(a => a.bank.split(' / ')[0]).filter(Boolean)).length;
  const hasData = d.txns.length || d.ncrp.length || d.social.length;
  const step = (n, done, next, title, text, page, sub) => `<div class="step ${done ? 'done' : next ? 'next' : ''}" data-go="${page}" data-sub="${sub || ''}"><div class="n">${done ? '✓' : n}</div><div><b>${title}</b><span>${text}</span></div></div>`;
  main.innerHTML = `<div class="hero-card"><div class="grow"><h2>${esc(c.name || 'Case')}</h2><div class="sub2">${[c.fir && 'FIR ' + esc(c.fir), c.section && esc(c.section), c.ps && 'PS ' + esc(c.ps), c.io && 'IO ' + esc(c.io)].filter(Boolean).join(' · ') || 'Add FIR, sections and IO in Others → Cases'}</div></div>
      <button class="btn primary" id="dImport">⬆ Import data</button><button class="btn" id="dTrail">₹ Money Trail</button><button class="btn" id="dReport">🖨 Case report</button></div>
    <div class="steps">
      ${step(1, hasData, !hasData, 'Import data', hasData ? `${d.imports.length} files · ${fmtNum(d.txns.length)} transactions` : 'Trail / bank action sheet, statements, KYC', 'financial', 'data')}
      ${step(2, comps.length && !noTrail, hasData, 'Follow the money trail', comps.length ? `${comps.length} complaints${noTrail ? ' · ' + noTrail + ' without trail' : ''}` : 'Victim → Layer 1 → Layer 2 …', 'trail')}
      ${step(3, high > 0, comps.length > 0, 'Identify mule accounts', `${high} high-risk · ${Analysis.finCommon('account').filter(g => g.acks >= 2).length} accounts in 2+ complaints`, 'financial', 'suspects')}
      ${step(4, xl > 0, high > 0, 'Link with social media', `${d.social.length} profiles · ${xl} shared identifiers`, 'analytics', 'cross')}
      ${step(5, d.tasks.some(t => /notice/i.test(t.text)), banksN > 0, 'Send notices', `${banksN} banks to write to`, 'others', 'notices')}
    </div>
    ${UI.kpis([
      ['Complaints (Ack Nos)', fmtNum(comps.length), fmtINR(sum(comps, x => x.amount)) + ' defrauded', 'c2'],
      ['Money in trail (layer 1)', fmtINR(trailAmt), fmtNum(d.txns.length) + ' transactions'],
      ['Amount on hold / lien', fmtINR(hold), holdTrail >= holdNcrp ? 'from bank actions in trail' : 'as per NCRP complaints', 'c3'],
      ['Accounts in trail', fmtNum(acc.filter(a => !isSynthetic(a.acc)).length), 'up to layer ' + maxLayer, 'c6'],
      ['High-risk accounts', fmtNum(high), 'score ≥ 60 (likely mules)', 'c5'],
      ['Cross-linked identifiers', fmtNum(xl), 'found in ≥ 2 sources', 'c4']
    ])}
    ${!hasData ? `<div class="note">This case has no data yet. Click <b>Import data</b> above, or <a href="#" id="dDemo">load demo data</a> to explore with dummy records.</div>` : ''}
    ${comps.length ? `<div class="card"><h3>Complaints</h3><div class="sub">Found from the Acknowledgement No. column of your sheets. Click a complaint to see its layer-wise money trail.</div><div id="dCmp"></div></div>` : ''}
    <div class="grid g2">
      <div class="card"><h3>Money by layer</h3><div class="sub">Total amount received by accounts at each layer</div><div id="chLayer"></div></div>
      <div class="card"><h3>Top receiving banks</h3><div class="sub">Where the money went (send notices to these nodal officers first). Click a bar to filter accounts.</div><div id="chBank"></div></div>
      <div class="card"><h3>Daily transaction amount</h3><div class="sub">From money trail and statements</div><div id="chDay"></div></div>
      <div class="card"><h3>Beneficiary states / districts</h3><div class="sub">From KYC, trail and NCRP records</div><div id="chState"></div></div>
    </div>
    <div class="card"><h3>Top suspect accounts</h3><div class="sub">Ranked by risk score. Click a row for full details.</div><div id="dTop"></div></div>`;
  $('#dImport').onclick = () => openImport(['txn', 'stmt', 'kyc', 'ncrp', 'social'], render);
  $('#dTrail').onclick = () => go('trail');
  $('#dReport').onclick = () => Reports.caseReport();
  main.querySelectorAll('.step').forEach(x => x.onclick = () => go(x.dataset.go, x.dataset.sub || undefined));
  if ($('#dCmp')) Table($('#dCmp'), { rows: comps, pageSize: 10, exportName: 'complaints', sortKey: 'amount', sortDir: -1, columns: [{ key: 'ack', label: 'Ack No', render: r => `<b class="mono">${esc(r.ack)}</b>` }, { key: 'victim', label: 'Victim' }, { key: 'district', label: 'District' }, { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount', num: true, fmt: fmtINR }, { key: 'layers', label: 'Layers', num: true }, { key: 'accounts', label: 'Accounts', num: true }, { key: 'hold', label: 'On hold', num: true, fmt: v => v ? fmtINR(v) : '' }], onRow: r => { S.trailAck = r.ack; go('trail'); } });
  const dm = $('#dDemo'); if (dm) dm.onclick = e => { e.preventDefault(); Demo.load(); };
  const byLayer = groupBy(acc.filter(a => a.layer > 0), a => a.layer);
  Charts.vbar($('#chLayer'), [...byLayer.keys()].sort((a, b) => a - b).map(k => ({ label: 'L' + k, value: sum(byLayer.get(k), a => a.inAmt), sub: byLayer.get(k).length + ' accounts' })), { fmt: fmtINR });
  const banks = groupBy(acc.filter(a => a.layer > 0 && a.bank && !isSynthetic(a.acc)), a => a.bank.split(' / ')[0]);
  Charts.hbar($('#chBank'), [...banks].map(([k, v]) => ({ label: k, value: sum(v, a => a.inAmt), sub: v.length + ' accounts' })).sort((a, b) => b.value - a.value), { fmt: fmtINR, onClick: dd => { S.sub.financial = 'suspects'; S.filterBank = dd.label; go('financial', 'suspects'); } });
  const days = groupBy(d.txns.filter(t => t.date), t => t.date.slice(0, 10));
  Charts.line($('#chDay'), [...days.keys()].sort().map(k => ({ label: k, value: sum(days.get(k), t => t.amount) })), { fmt: fmtINR });
  const st = groupBy([...d.kyc.map(k => k.state), ...d.txns.map(t => t.state), ...d.ncrp.map(n => n.state)].filter(Boolean), x => x);
  Charts.hbar($('#chState'), [...st].map(([k, v]) => ({ label: k, value: v.length })).sort((a, b) => b.value - a.value), { fmt: v => v + ' records' });
  accountTable($('#dTop'), acc.filter(a => a.score > 0).sort((a, b) => b.score - a.score).slice(0, 25), { pageSize: 25 });
};

function accountTable(el, rows, o = {}) {
  Table(el, {
    rows, pageSize: o.pageSize || 100, exportName: 'accounts', sortKey: o.sortKey || 'score', sortDir: -1,
    columns: [
      { key: 'label', label: 'Account / ID', render: r => accLink(r.acc) },
      { key: 'name', label: 'Name' }, { key: 'bank', label: 'Bank' }, { key: 'ifsc', label: 'IFSC' },
      { key: 'layer', label: 'Layer', num: true },
      { key: 'inAmt', label: 'Received', num: true, fmt: fmtINR }, { key: 'outAmt', label: 'Sent out', num: true, fmt: fmtINR },
      { key: 'senders', label: 'Senders', num: true }, { key: 'acks', label: 'Complaints', num: true },
      { key: 'hold', label: 'On hold', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'cashOut', label: 'Cash-out', num: true, fmt: v => v ? fmtINR(v) : '' },
      { key: 'score', label: 'Risk', num: true, render: r => riskBadge(r.score), csv: r => r.score },
      { key: 'flags', label: 'Why flagged', render: r => esc(r.flags.join('; ')), csv: r => r.flags.join('; '), sortVal: r => r.flags.length }
    ],
    onRow: r => showAccount(r.acc), after: bindAccLinks
  });
}

/* ---------- Account detail drawer ---------- */
function showAccount(acc) {
  const { A, inE, outE } = Analysis.fin(); const n = A.get(acc);
  const kyc = S.data.kyc.filter(k => k.acc === acc);
  const xl = Analysis.crossLinks().filter(x => x.value === acc || kyc.some(k => [k.mobile, k.email, k.pan, k.aadhaar].includes(x.value)));
  const body = UI.drawer(accLabel(acc), `
    ${n ? UI.kv({ 'Name(s)': esc([...n.names].join(' / ')), 'Bank': esc([...n.banks].join(' / ')), 'IFSC': esc([...n.ifscs].join(' / ')), 'Layer': n.layer, 'Received': fmtINR(n.inAmt) + ` (${n.inCnt} txns from ${n.senders.size})`, 'Sent out': fmtINR(n.outAmt) + ` (${n.outCnt} txns to ${n.receivers.size})`, 'On hold': n.hold ? fmtINR(n.hold) : '', 'Cash-out': n.cashOut ? fmtINR(n.cashOut) : '', 'First credit': n.firstIn, 'Last debit': n.lastOut, 'Complaints': esc([...n.acks].join(', ')), 'Risk': riskBadge(n.score), 'Flags': esc(n.flags.join('; ')) }) : '<p class="muted">Not found in transactions.</p>'}
    <div class="row" style="margin-bottom:12px">
      <button class="btn sm primary" id="aTrace">Show full trail</button><button class="btn sm" id="aMind">Mind map</button>
      <button class="btn sm" id="aNote">+ Note</button><button class="btn sm" id="aCopy">Copy</button></div>
    ${kyc.length ? '<h4>KYC / beneficiary details</h4>' + kyc.map(k => UI.kv({ Name: esc(k.name), Mobile: esc(k.mobile), Email: esc(k.email), PAN: esc(k.pan), Aadhaar: esc(k.aadhaar), Address: esc(k.address), 'State / District': esc([k.state, k.district].filter(Boolean).join(' / ')), 'Opened': esc(k.open_date), Balance: fmtINR(k.balance), IP: esc(k.ip), Device: esc(k.device), Linked: esc(k.linked), Source: esc(k._src) })).join('') : ''}
    ${xl.length ? '<h4>Also appears in</h4>' + xl.map(x => `<div class="small"><span class="badge">${esc(x.type)}</span> ${esc(x.value)} — ${esc(x.refList)}</div>`).join('') : ''}
    <h4>Incoming (${(inE.get(acc) || []).length})</h4>${edgeList(inE.get(acc) || [], 'from')}
    <h4>Outgoing (${(outE.get(acc) || []).length})</h4>${edgeList(outE.get(acc) || [], 'to')}`);
  bindAccLinks(body);
  $('#aTrace', body).onclick = () => openTrail({ node: acc });
  $('#aMind', body).onclick = () => { UI.closeDrawer(); S.graphOpt = { root: acc, mode: 'mind', depth: 4, dir: 'both' }; go('financial', 'graph'); };
  $('#aNote', body).onclick = () => { const t = prompt('Note for account ' + acc); if (t) { S.data.notes.unshift({ id: uid(), title: 'Account ' + acc, text: t, when: new Date().toISOString(), tag: 'account' }); saveCase(); UI.toast('Note saved'); } };
  $('#aCopy', body).onclick = () => { navigator.clipboard?.writeText($('#drBody').innerText); UI.toast('Copied'); };
}
function edgeList(list, side) {
  if (!list.length) return '<p class="muted small">None</p>';
  return '<div class="tbl-wrap" style="max-height:240px"><table class="tbl"><tr><th>' + (side === 'from' ? 'From' : 'To') + '</th><th class="num">Amount</th><th class="num">Txns</th><th>Dates</th></tr>' +
    list.sort((a, b) => b.amount - a.amount).map(e => `<tr><td>${accLink(e[side])}</td><td class="num">${fmtINR(e.amount)}</td><td class="num">${e.count}</td><td class="small">${esc(uniq(e.txns.map(t => (t.date || '').slice(0, 10))).slice(0, 3).join(', '))}</td></tr>`).join('') + '</table></div>';
}

/* ======================= 1. FINANCIAL ======================= */
Pages.financial = main => {
  const { cur, body } = tabs(main, 'financial', [['data', 'Import & Data'], ['trail', 'Layer-wise Trail'], ['common', 'Commonality'], ['suspects', 'Suspect Accounts'], ['banks', 'Bank-wise'], ['graph', 'Mind Map / Flow Chart'], ['kyc', 'KYC / Beneficiary']], '1 · Financial Analysis',
    `<button class="btn primary" id="fImp">⬆ Import financial data</button>`);
  $('#fImp').onclick = () => openImport(['txn', 'stmt', 'kyc'], render);
  FinTabs[cur](body);
};
const FinTabs = {
  data(el) {
    const d = S.data;
    el.innerHTML = `<div class="note">Import any of: <b>NCRP layer-wise money trail</b> (Excel/CSV from the portal), <b>bank transaction details</b>, <b>bank account statements</b> (CSV/Excel/PDF from any bank) and <b>beneficiary / KYC details</b> sent by banks. Column names are matched automatically; you can correct them before saving. Import as many files as you need – everything is combined.</div>
      <div class="kpis">${[['Transactions', d.txns.length], ['From statements', d.txns.filter(t => t._type === 'stmt').length], ['KYC records', d.kyc.length], ['Files imported', d.imports.filter(i => ['txn', 'stmt', 'kyc'].includes(i.type)).length]].map(k => `<div class="kpi"><div class="label">${k[0]}</div><div class="value">${fmtNum(k[1])}</div></div>`).join('')}</div>
      <div class="card"><h3>Imported files</h3><div id="fFiles"></div></div>
      <div class="card"><div class="row"><h3 class="grow">All transactions</h3><button class="btn sm" id="fAdd">+ Add manually</button></div><div id="fTx"></div></div>`;
    importsTable($('#fFiles', el), ['txn', 'stmt', 'kyc']);
    $('#fAdd', el).onclick = () => manualEntry('txn', 'txns');
    txnTable($('#fTx', el), d.txns);
  },
  trail(el) {
    const acks = uniq(S.data.txns.map(t => t.ack_no)).sort();
    el.innerHTML = `<div class="card"><div class="row"><label>Complaint (Ack No)</label><select id="tAck"><option value="">All complaints</option>${acks.map(a => `<option ${S.trailAck === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
      <span class="muted small">Layer is taken from the file when present; otherwise it is worked out by following money from the first sender.</span></div></div><div id="tBody"></div>`;
    $('#tAck', el).onchange = e => { S.trailAck = e.target.value; FinTabs.trail(el); };
    const { A } = Analysis.fin();
    const tx = S.data.txns.filter(t => !S.trailAck || t.ack_no === S.trailAck);
    const layerOf = t => t.layer || (A.get(t.to_acc) || {}).layer || 0;
    const L = groupBy(tx, layerOf);
    const keys = [...L.keys()].sort((a, b) => a - b);
    $('#tBody', el).innerHTML = keys.map(k => `<div class="card"><h3>Layer ${k} <span class="muted small">· ${L.get(k).length} txns · ${fmtINR(sum(L.get(k), t => t.amount))} · ${uniq(L.get(k).map(t => t.to_acc)).length} receiving accounts</span></h3><div data-l="${k}"></div></div>`).join('') || UI.empty('No transactions yet.');
    keys.forEach(k => txnTable($(`[data-l="${k}"]`, el), L.get(k), 200));
  },
  common(el) {
    const f = S.finCommonField || 'account'; const minN = S.finCommonMin || 2;
    el.innerHTML = `<div class="card"><div class="row">
      <label>Find common</label><select id="cF">${Object.entries(Analysis.FIN_COMMON).map(([k, v]) => `<option value="${k}" ${k === f ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      <label>Appearing at least</label><select id="cN">${[1, 2, 3, 5, 10].map(n => `<option ${n === minN ? 'selected' : ''}>${n}</option>`).join('')}</select><label>times</label>
      <span class="muted small">Looks across all money-trail rows, statements and KYC records in this case.</span></div>
      <div class="row" style="margin-top:10px">${Object.entries(Analysis.FIN_COMMON).map(([k, v]) => { const c = Analysis.finCommon(k).filter(g => g.n >= 2 && (g.accs >= 2 || g.acks >= 2 || k === 'account' || k === 'beneficiary' || k === 'utr')).length; return `<button class="btn sm ${k === f ? 'primary' : ''}" data-cf="${k}">${v.label.split('(')[0]} <span class="badge">${c}</span></button>`; }).join('')}</div></div>
      <div class="card"><h3>Common ${esc(Analysis.FIN_COMMON[f].label)}</h3><div class="sub">"Accounts" = how many different accounts share this value. "Complaints" = how many different NCRP acknowledgements it is linked to. Click a row to see every matching record.</div><div id="cT"></div></div>`;
    $('#cF', el).onchange = e => { S.finCommonField = e.target.value; FinTabs.common(el); };
    $('#cN', el).onchange = e => { S.finCommonMin = +e.target.value; FinTabs.common(el); };
    $$('[data-cf]', el).forEach(b => b.onclick = () => { S.finCommonField = b.dataset.cf; FinTabs.common(el); });
    const rows = Analysis.finCommon(f).filter(g => g.n >= minN);
    Table($('#cT', el), {
      rows, exportName: 'common_' + f, sortKey: 'n', sortDir: -1,
      columns: [
        { key: 'value', label: Analysis.FIN_COMMON[f].label, render: r => ['account', 'beneficiary'].includes(f) ? accLink(r.value) : `<span class="mono">${esc(r.value)}</span>${f === 'ifsc' ? ' <span class="muted small">' + esc(bankFromIfsc(r.value)) + '</span>' : ''}` },
        { key: 'n', label: 'Times found', num: true }, { key: 'accs', label: 'Accounts', num: true }, { key: 'acks', label: 'Complaints', num: true },
        { key: 'amount', label: 'Amount involved', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'roles', label: 'Seen as' }, { key: 'srcs', label: 'Files', num: true },
        { key: 'ackList', label: 'Ack Nos', render: r => esc(r.ackList.slice(0, 120)) }
      ],
      onRow: r => {
        const b = UI.drawer('Records with ' + r.value, `<p class="muted small">${r.n} records · ${r.accs} accounts · ${r.acks} complaints</p><div id="cR"></div>`);
        const tx = r.recs.filter(x => x.kind === 'txn').map(x => x.rec), ky = r.recs.filter(x => x.kind === 'kyc').map(x => x.rec);
        $('#cR', b).innerHTML = (ky.length ? '<h4>KYC</h4>' + ky.map(k => `<div class="list-item"><div class="grow small">${accLink(k.acc)} ${esc(k.name)}<br>${esc([k.mobile, k.email, k.pan, k.bank, k.state, k.district].filter(Boolean).join(' · '))}</div></div>`).join('') : '') +
          (tx.length ? '<h4>Transactions</h4>' + tx.slice(0, 300).map(t => `<div class="list-item"><div class="grow small">${accLink(t.from_acc)} → ${accLink(t.to_acc)} <b>${fmtINR(t.amount)}</b><br>${esc([t.date, t.txn_id, t.mode, t.ack_no, t.to_bank].filter(Boolean).join(' · '))}</div></div>`).join('') : '');
        bindAccLinks(b);
      }, after: bindAccLinks
    });
  },
  suspects(el) {
    let rows = Analysis.accountRows().filter(a => !isSynthetic(a.acc) && a.layer > 0);
    el.innerHTML = `<div class="note">Risk score (0–100) adds up simple warning signs: account in several complaints, many senders, money passed on quickly (≥ 80% sent out, within 24 hours), cash/ATM withdrawal, KYC details (mobile/PAN/email/Aadhaar) shared with other accounts, large receipts. It is a pointer for prioritising, not proof.</div>
      ${S.filterBank ? `<div class="row" style="margin-bottom:10px"><span class="badge info">Bank: ${esc(S.filterBank)}</span><button class="btn sm" id="sClr">Clear filter</button></div>` : ''}<div class="card" id="sT"></div>`;
    if (S.filterBank) { rows = rows.filter(r => r.bank.includes(S.filterBank)); $('#sClr', el).onclick = () => { S.filterBank = null; FinTabs.suspects(el); }; }
    accountTable($('#sT', el), rows);
  },
  banks(el) {
    const acc = Analysis.accountRows().filter(a => !isSynthetic(a.acc) && a.layer > 0);
    const G = groupBy(acc, a => (a.bank.split(' / ')[0] || (a.ifsc ? bankFromIfsc(a.ifsc.slice(0, 11)) : '') || 'Unknown bank'));
    const rows = [...G].map(([bank, list]) => ({ bank, accounts: list.length, inAmt: sum(list, a => a.inAmt), outAmt: sum(list, a => a.outAmt), hold: sum(list, a => a.hold), cash: sum(list, a => a.cashOut), high: list.filter(a => a.score >= 60).length, branches: uniq(list.map(a => a.ifsc)).length, list }));
    el.innerHTML = `<div class="card"><h3>Bank-wise summary</h3><div class="sub">Use this to prepare one notice per bank (Others → Notice Templates). Click a bank to list its accounts.</div><div id="bT"></div></div><div class="card"><h3>IFSC / branch-wise</h3><div id="bI"></div></div>`;
    Table($('#bT', el), { rows, exportName: 'bank_summary', sortKey: 'inAmt', sortDir: -1, columns: [{ key: 'bank', label: 'Bank' }, { key: 'accounts', label: 'Accounts', num: true }, { key: 'branches', label: 'Branches (IFSC)', num: true }, { key: 'inAmt', label: 'Received', num: true, fmt: fmtINR }, { key: 'outAmt', label: 'Sent out', num: true, fmt: fmtINR }, { key: 'hold', label: 'On hold', num: true, fmt: fmtINR }, { key: 'cash', label: 'Cash-out', num: true, fmt: fmtINR }, { key: 'high', label: 'High-risk', num: true }], onRow: r => { S.filterBank = r.bank; go('financial', 'suspects'); } });
    const I = groupBy(acc.filter(a => a.ifsc), a => a.ifsc.split(' / ')[0]);
    Table($('#bI', el), { rows: [...I].map(([ifsc, l]) => ({ ifsc, bank: bankFromIfsc(ifsc) || l[0].bank, accounts: l.length, inAmt: sum(l, a => a.inAmt), list: l.map(a => a.acc).join(', ') })), exportName: 'ifsc_summary', sortKey: 'accounts', sortDir: -1, columns: [{ key: 'ifsc', label: 'IFSC', render: r => `<span class="mono">${esc(r.ifsc)}</span>` }, { key: 'bank', label: 'Bank' }, { key: 'accounts', label: 'Accounts', num: true }, { key: 'inAmt', label: 'Received', num: true, fmt: fmtINR }, { key: 'list', label: 'Accounts list' }] });
  },
  graph(el) {
    const o = S.graphOpt = Object.assign({ mode: 'flow', root: '', depth: 6, dir: 'down', ack: '', min: 0 }, S.graphOpt || {});
    const acks = uniq(S.data.txns.map(t => t.ack_no)).sort();
    el.innerHTML = `<div class="card"><div class="row">
      <span class="pill-group">${[['flow', 'Flow chart (layers)'], ['mind', 'Mind map'], ['net', 'Network']].map(([k, l]) => `<button data-m="${k}" class="${o.mode === k ? 'active' : ''}">${l}</button>`).join('')}</span>
      <label>Complaint</label><select id="gAck"><option value="">All</option>${acks.map(a => `<option ${o.ack === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
      <label>Start from account</label><input id="gRoot" list="gAccs" value="${esc(o.root)}" placeholder="(all)" style="width:190px"><datalist id="gAccs">${[...Analysis.fin().A.keys()].slice(0, 3000).map(a => `<option value="${esc(a)}">`).join('')}</datalist>
      <select id="gDir"><option value="down" ${o.dir === 'down' ? 'selected' : ''}>Money going out ↓</option><option value="up" ${o.dir === 'up' ? 'selected' : ''}>Money coming in ↑</option><option value="both" ${o.dir === 'both' ? 'selected' : ''}>Both</option></select>
      <label>Depth</label><input id="gDepth" type="number" min="1" max="20" value="${o.depth}" style="width:64px">
      <label>Min ₹</label><input id="gMin" type="number" min="0" value="${o.min}" style="width:100px">
      <button class="btn primary sm" id="gGo">Draw</button><span class="spacer"></span>
      <button class="btn sm" id="gSvg">⬇ SVG</button><button class="btn sm" id="gPng">⬇ PNG</button></div></div>
      <div class="graph-box" id="gBox"></div><p class="small muted" id="gInfo"></p>`;
    $$('[data-m]', el).forEach(b => b.onclick = () => { o.mode = b.dataset.m; FinTabs.graph(el); });
    $('#gGo', el).onclick = () => { o.ack = $('#gAck', el).value; o.root = N.acc($('#gRoot', el).value); o.dir = $('#gDir', el).value; o.depth = +$('#gDepth', el).value || 6; o.min = +$('#gMin', el).value || 0; FinTabs.graph(el); };
    const { nodes, edges, note } = finGraphData(o);
    if (!nodes.length) { $('#gBox', el).innerHTML = '<div class="muted" style="padding:40px;text-align:center">No transactions to draw. Import a money trail or statement first.</div>'; return; }
    const g = Graph.mount($('#gBox', el), nodes, edges, { vert: !!o.vert, onOrient: v => { o.vert = v; }, live: edges.length <= 1000, labels: edges.length > 160 ? true : 'full', mode: o.mode, root: o.root || (nodes.find(n => n.kind === 'victim') || nodes[0]).id, onTrail: (hops, api, info) => trailDrawer(hops, api, info), onClear: UI.closeDrawer });
    if (o.focus) { const f = o.focus; delete o.focus; setTimeout(() => f.node ? g.highlightNode(f.node) : g.highlightEdge(f.from, f.to), 50); }
    $('#gInfo', el).textContent = `${nodes.length} accounts, ${edges.length} links. ${note}`;
    $('#gSvg', el).onclick = () => g.download('money_trail_' + o.mode);
    $('#gPng', el).onclick = () => g.download('money_trail_' + o.mode, true);
  },
  kyc(el) {
    el.innerHTML = `<div class="card"><div class="row"><h3 class="grow">Beneficiary / KYC details</h3><button class="btn sm" id="kAdd">+ Add manually</button></div><div class="sub">Account holder details from banks. These are linked to the money trail by account number, and searched for shared mobile / email / PAN / Aadhaar.</div><div id="kT"></div></div>`;
    $('#kAdd', el).onclick = () => manualEntry('kyc', 'kyc');
    Table($('#kT', el), { rows: S.data.kyc, exportName: 'kyc', columns: FIELDS.kyc.map(([k, l]) => ({ key: k, label: l, render: k === 'acc' ? r => accLink(r.acc) : undefined, fmt: k === 'balance' ? fmtINR : undefined, num: k === 'balance' })).concat([{ key: '_src', label: 'File' }]), onRow: r => showAccount(r.acc), after: bindAccLinks });
  }
};

function finGraphData(o) {
  const { A, E } = Analysis.fin();
  let edges = [...E.values()];
  if (o.ack) edges = edges.map(e => { const tx = e.txns.filter(t => t.ack_no === o.ack); return tx.length ? { ...e, txns: tx, amount: sum(tx, t => Math.abs(t.amount || 0)), count: tx.length } : null; }).filter(Boolean);
  if (o.min) edges = edges.filter(e => e.amount >= o.min);
  edges = edges.filter(e => e.to !== 'UNIDENTIFIED' || o.root);
  let keep = null, note = '';
  if (o.root) {
    keep = new Set([o.root]); let frontier = [o.root];
    for (let d = 0; d < o.depth && frontier.length; d++) {
      const nx = [];
      for (const e of edges) {
        if ((o.dir !== 'up') && frontier.includes(e.from) && !keep.has(e.to)) { keep.add(e.to); nx.push(e.to); }
        if ((o.dir !== 'down') && frontier.includes(e.to) && !keep.has(e.from)) { keep.add(e.from); nx.push(e.from); }
      }
      frontier = nx;
    }
    edges = edges.filter(e => keep.has(e.from) && keep.has(e.to));
  }
  const ids = new Set(); edges.forEach(e => { ids.add(e.from); ids.add(e.to); });
  if (o.root && A.has(o.root)) ids.add(o.root);
  let nodes = [...ids].map(id => {
    const n = A.get(id) || { acc: id, names: new Set(), banks: new Set(), inAmt: 0, layer: 0, score: 0, hold: 0 };
    const kind = id.startsWith('VICTIM:') || n.victim || (n.layer === 0 && !id.startsWith('CASH')) ? 'victim' : /^CASH-OUT/.test(id) ? 'cash' : n.hold > 0 ? 'hold' : n.score >= 60 ? 'risk' : 'account';
    return { id, label: id.startsWith('VICTIM:') ? 'Victim ' + id.slice(7) : accLabel(id), sub: [[...n.names][0], [...n.banks][0]].filter(Boolean).join(' · '),
      det: [[...(n.ifscs || [])][0], n.layer ? 'L' + n.layer : '', n.inAmt ? fmtINR(n.inAmt) : n.outAmt ? 'sent ' + fmtINR(n.outAmt) : ''].filter(Boolean).join(' · '), kind, value: Math.max(n.inAmt, n.outAmt || 0), layer: n.layer, title: `${accLabel(id)}\n${[...n.names].join(' / ')}\n${[...n.banks].join(' / ')}\nLayer ${n.layer} · in ${fmtINR(n.inAmt)} · out ${fmtINR(n.outAmt)}${n.score ? '\nRisk ' + n.score : ''}` };
  });
  if (nodes.length > 450) {
    const top = new Set(nodes.sort((a, b) => b.value - a.value).slice(0, 450).map(n => n.id));
    nodes = nodes.filter(n => top.has(n.id)); edges = edges.filter(e => top.has(e.from) && top.has(e.to));
    note = 'Large trail: showing the 450 biggest accounts. Pick a complaint, a start account or a minimum amount to see everything.';
  }
  const lay = new Map(nodes.map(n => [n.id, n.layer || 0]));
  edges = edges.map(e => ({ ...e, tag: [lay.get(e.from) || 0, lay.get(e.to) || 0].map(l => l ? 'L' + l : 'Victim').join('→') }));
  return { nodes, edges, note };
}

/* open the flow chart and highlight the full trail through an account or a transaction */
function openTrail(f) {
  UI.closeDrawer();
  S.graphOpt = { mode: 'flow', root: '', depth: 6, dir: 'down', ack: f.ack || '', min: 0, focus: f.node ? { node: f.node } : { from: f.from, to: f.to } };
  go('financial', 'graph');
}
function trailDrawer(hops, api, info) {
  info = info || {}; const node = info.node || null, E = info.edge;
  const head = info.type === 'upto' ? 'Trail: victim → ' + accLabel(node.id) : info.type === 'edge' ? 'Trail through ' + accLabel(E.from) + ' → ' + accLabel(E.to) : 'Money trail' + (node ? ' through ' + accLabel(node.id) : '');
  const what = info.type === 'upto' ? 'How the money reached this account, step by step from the victim.' : info.type === 'edge' ? `How the money reached this transaction (${fmtINR(E.amount)}${E.tag ? ', ' + E.tag : ''}) and where it went after it, to the last account.` : 'From the victim, through this account, to the last account.';
  const rows = hops.flatMap(h => (h.txns && h.txns.length ? h.txns : [{}]).map(t => ({ step: h.step, from: h.from, to: h.to, amount: t.amount ?? h.amount, date: t.date || '', utr: t.txn_id || '', bank: t.to_bank || '', action: t.action || '' })))
    .sort((a, b) => a.step - b.step || String(a.date).localeCompare(String(b.date)));
  const total = sum(hops.filter(h => h.step === 1), h => h.amount);
  const body = UI.drawer(head, `
    <div class="row" style="margin-bottom:10px;flex-wrap:wrap"><button class="btn sm primary" id="trPlay">▶ Play again</button>${node && info.type === 'upto' ? '<button class="btn sm" id="trOn">Show onward money too</button>' : ''}${node && info.type === 'full' && !node.id.startsWith('VICTIM:') ? '<button class="btn sm" id="trUp">Only up to this account</button>' : ''}<button class="btn sm" id="trClr">Clear highlight</button>${node && !node.id.startsWith('VICTIM:') ? '<button class="btn sm" id="trAcc">Account details</button>' : ''}<button class="btn sm" id="trCsv">⬇ CSV</button></div>
    <p class="small"><b>${esc(what)}</b></p><p class="small muted">${hops.length} links · ${uniq(hops.flatMap(h => [h.from, h.to])).length} accounts · ${Math.max(0, ...hops.map(h => h.step))} steps${total ? ' · first step total ' + fmtINR(total) : ''}. Steps light up one by one on the chart. Click an empty part of the chart to clear.</p>
    <div class="tbl-wrap" style="max-height:none"><table class="tbl"><tr><th>Step</th><th>From → To</th><th class="num">Amount</th><th>Date</th><th>UTR</th></tr>
    ${rows.map(r => `<tr><td class="num">${r.step}</td><td>${accLink(r.from)}<br>→ ${accLink(r.to)}${r.bank ? `<div class="small muted">${esc(r.bank)}${r.action ? ' · ' + esc(r.action) : ''}</div>` : ''}</td><td class="num">${fmtINR(r.amount)}</td><td class="small">${esc(r.date)}</td><td class="small mono">${esc(r.utr)}</td></tr>`).join('')}</table></div>`);
  bindAccLinks(body);
  $('#trPlay', body).onclick = () => api.replay();
  const on = $('#trOn', body); if (on) on.onclick = () => api.highlightNode(node.id);
  const up = $('#trUp', body); if (up) up.onclick = () => api.traceTo(node.id);
  $('#trClr', body).onclick = () => api.clear();
  const ac = $('#trAcc', body); if (ac) ac.onclick = () => showAccount(node.id);
  $('#trCsv', body).onclick = () => UI.download('money_trail_path.csv', UI.toCSV([{ key: 'step', label: 'Step' }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'amount', label: 'Amount' }, { key: 'date', label: 'Date' }, { key: 'utr', label: 'UTR' }, { key: 'bank', label: 'Bank' }, { key: 'action', label: 'Action' }], rows), 'text/csv');
}

function txnTable(el, rows, size = 100) {
  Table(el, {
    rows, pageSize: size, exportName: 'transactions', sortKey: 'date',
    columns: [
      { key: 'ack_no', label: 'Ack No' }, { key: 'layer', label: 'Layer', num: true },
      { key: 'from_acc', label: 'From', render: r => accLink(r.from_acc) + (r.from_name ? `<div class="small muted">${esc(r.from_name)}</div>` : '') },
      { key: 'to_acc', label: 'To', render: r => accLink(r.to_acc) + (r.to_name ? `<div class="small muted">${esc(r.to_name)}</div>` : '') },
      { key: 'to_bank', label: 'To bank' }, { key: 'to_ifsc', label: 'To IFSC' },
      { key: 'amount', label: 'Amount', num: true, fmt: fmtINR }, { key: 'date', label: 'Date' }, { key: 'txn_id', label: 'UTR / Txn ID' },
      { key: 'mode', label: 'Mode' }, { key: 'action', label: 'Action' }, { key: 'hold', label: 'Hold', num: true, fmt: v => v ? fmtINR(v) : '' },
      { key: 'remarks', label: 'Remarks', render: r => `<span class="small">${esc(String(r.remarks || '').slice(0, 90))}</span>` }, { key: '_src', label: 'File' }
    ], after: bindAccLinks, onRow: r => openTrail({ ack: r.ack_no, from: r.from_acc || (r.layer === 1 || r._type === 'trail' ? 'VICTIM:' + (r.ack_no || 'UNKNOWN') : 'UNIDENTIFIED'), to: r.to_acc || 'UNIDENTIFIED' })
  });
}

function importsTable(el, types) {
  const rows = S.data.imports.filter(i => types.includes(i.type)).slice().reverse();
  Table(el, {
    rows, pageSize: 20, exportName: 'imports', columns: [
      { key: 'when', label: 'When', fmt: v => v.slice(0, 16).replace('T', ' ') }, { key: 'file', label: 'File' }, { key: 'type', label: 'Type', fmt: v => TYPE_INFO[v]?.label.split('(')[0] || v }, { key: 'count', label: 'Records', num: true },
      { key: 'x', label: '', nosort: true, noexport: true, render: r => `<button class="btn sm danger" data-del="${r.id}">Remove</button>` }],
    after: c => $$('[data-del]', c).forEach(b => b.onclick = () => {
      const imp = S.data.imports.find(i => i.id === b.dataset.del); if (!imp || !UI.confirm(`Remove all ${imp.count} records imported from "${imp.file}"?`)) return;
      const store = TYPE_INFO[imp.type].store; S.data[store] = S.data[store].filter(r => r._src !== imp.file); S.data.imports = S.data.imports.filter(i => i !== imp); saveCase(); render();
    })
  });
}

function manualEntry(type, store) {
  const fields = type === 'txn' ? FIELDS.txn : FIELDS[type];
  UI.modal('Add record manually', `<div class="map-grid">${fields.map(([k, l]) => `<div class="f"><label>${esc(l)}</label><input data-k="${k}"></div>`).join('')}</div>`,
    [{ label: 'Cancel', onClick: UI.closeModal }, {
      label: 'Save', cls: 'primary', onClick: () => {
        const o = {}; $$('#mdBody [data-k]').forEach(i => o[i.dataset.k] = i.value);
        const r = type === 'txn' ? Parsers.normTxn(o, 'Manual entry') : type === 'kyc' ? Parsers.normKyc(o, 'Manual entry') : type === 'social' ? Parsers.normSocial(o, 'Manual entry') : Parsers.normNcrp(o, 'Manual entry');
        S.data[store].push(r); if (!S.data.imports.some(i => i.file === 'Manual entry' && i.type === type)) S.data.imports.push({ id: uid(), when: new Date().toISOString(), file: 'Manual entry', type, count: 0 });
        S.data.imports.find(i => i.file === 'Manual entry' && i.type === type).count++;
        saveCase(); UI.closeModal(); render(); UI.toast('Saved');
      }
    }]);
}

/* ======================= 2. SOCIAL MEDIA ======================= */
Pages.social = main => {
  const { cur, body } = tabs(main, 'social', [['data', 'Import & Data'], ['common', 'Commonality'], ['ip', 'IP Log Analysis'], ['graph', 'Link Graph']], '2 · Social Media Analysis',
    `<button class="btn primary" id="sImp">⬆ Import platform response</button>`);
  $('#sImp').onclick = () => openImport(['social'], render);
  SocTabs[cur](body);
};
const PLATFORMS = ['WhatsApp', 'Facebook', 'Instagram', 'Threads', 'Google / Gmail / YouTube', 'X (Twitter)', 'Telegram', 'Snapchat', 'ShareChat', 'Moj', 'LinkedIn', 'Truecaller', 'Signal', 'Other'];
const SocTabs = {
  data(el) {
    const d = S.data.social;
    el.innerHTML = `<div class="note">Import replies received from platforms (WhatsApp, Facebook, Instagram, Threads, Google, X, Telegram etc.) as CSV/Excel, or paste/load the text of a PDF reply in <b>Others → Identifier Extractor</b>. Each row = one profile or one IP-log entry. If the file has no "Platform" column, set it below after import.</div>
      ${UI.kpis([['Records', fmtNum(d.length)], ['Profiles', fmtNum(uniq(d.map(r => r.profile)).length)], ['Distinct mobiles', fmtNum(uniq(d.map(r => r.mobile)).length)], ['Distinct IPs', fmtNum(uniq(d.map(r => r.ip)).length)], ['Distinct IMEIs', fmtNum(uniq(d.map(r => r.imei)).length)]])}
      <div class="grid g2"><div class="card"><h3>By platform</h3><div id="sPl"></div></div><div class="card"><h3>Imported files</h3><div id="sF"></div>
      <div class="row" style="margin-top:10px"><label>Set platform for rows with no platform</label><select id="sSet">${PLATFORMS.map(p => `<option>${p}</option>`).join('')}</select><button class="btn sm" id="sSetGo">Apply</button></div></div></div>
      <div class="card"><div class="row"><h3 class="grow">All records</h3><button class="btn sm" id="sAdd">+ Add manually</button></div><div id="sT"></div></div>`;
    const P = groupBy(d, r => r.platform || '(not set)');
    Charts.hbar($('#sPl', el), [...P].map(([k, v]) => ({ label: k, value: v.length })).sort((a, b) => b.value - a.value), { fmt: v => v + ' records' });
    importsTable($('#sF', el), ['social']);
    $('#sSetGo', el).onclick = () => { let n = 0; d.forEach(r => { if (!r.platform) { r.platform = $('#sSet', el).value; n++; } }); saveCase(); UI.toast(n + ' rows updated'); render(); };
    $('#sAdd', el).onclick = () => manualEntry('social', 'social');
    Table($('#sT', el), { rows: d, exportName: 'social_records', columns: FIELDS.social.map(([k, l]) => ({ key: k, label: l })).concat([{ key: '_src', label: 'File' }]) });
  },
  common(el) {
    const f = S.socField || 'mobile', minP = S.socMin || 2;
    el.innerHTML = `<div class="card"><div class="row"><label>Find common</label>
      ${Object.entries(Analysis.SOC_COMMON).map(([k, l]) => `<button class="btn sm ${k === f ? 'primary' : ''}" data-sf="${k}">${l} <span class="badge">${Analysis.socCommon(k).filter(g => g.profiles >= 2 || g.platforms >= 2).length}</span></button>`).join('')}
      <label>Min profiles</label><select id="sMin">${[1, 2, 3, 5].map(n => `<option ${n === minP ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
      <div class="card"><h3>Common ${esc(Analysis.SOC_COMMON[f])}</h3><div class="sub">Values shared by several profiles / platforms point to the same person or device. Click a row to see the records.</div><div id="scT"></div></div>`;
    $$('[data-sf]', el).forEach(b => b.onclick = () => { S.socField = b.dataset.sf; SocTabs.common(el); });
    $('#sMin', el).onchange = e => { S.socMin = +e.target.value; SocTabs.common(el); };
    const rows = Analysis.socCommon(f).filter(g => Math.max(g.profiles, minP === 1 ? 1 : 0) >= minP || (minP > 1 && g.platforms >= 2));
    Table($('#scT', el), {
      rows, exportName: 'social_common_' + f, sortKey: 'profiles', sortDir: -1,
      columns: [{ key: 'value', label: Analysis.SOC_COMMON[f], render: r => `<span class="mono">${esc(r.value)}</span>${f === 'ip' ? ' <span class="small muted">' + esc(V.ipKind(r.value)) + '</span>' : ''}` }, { key: 'n', label: 'Times', num: true }, { key: 'profiles', label: 'Profiles', num: true }, { key: 'platforms', label: 'Platforms', num: true }, { key: 'platformList', label: 'Platform list' }, { key: 'profileList', label: 'Profiles list', render: r => esc(r.profileList.slice(0, 150)) }, { key: 'first', label: 'First seen' }, { key: 'last', label: 'Last seen' }],
      onRow: r => UI.drawer(r.value, r.recs.map(x => `<div class="list-item"><div class="grow small"><b>${esc(x.platform)}</b> · ${esc(x.profile)} ${esc(x.name)}<br>${esc([x.mobile, x.email, x.imei, x.ip, x.ip_time, x.device].filter(Boolean).join(' · '))}<br><span class="muted">${esc(x._src)}</span></div></div>`).join(''))
    });
  },
  ip(el) {
    const logs = S.data.social.filter(r => r.ip);
    const rows = Object.values(groupBy(logs, r => r.ip)).map(l => ({ ip: l[0].ip, kind: V.ipKind(l[0].ip), n: l.length, profiles: uniq(l.map(r => r.profile)).join(', '), platforms: uniq(l.map(r => r.platform)).join(', '), first: l.map(r => r.ip_time).filter(Boolean).sort()[0] || '', last: l.map(r => r.ip_time).filter(Boolean).sort().slice(-1)[0] || '', ports: uniq(l.map(r => r.port)).join(', ') }));
    el.innerHTML = `<div class="note">Offline tool: ISP / location lookup is not done automatically. Export this list and check ownership through WHOIS / the ISP. For <b>CGNAT</b> (100.64.x.x) and mobile-data IPs, the ISP needs the exact <b>timestamp with time zone and the source port</b>.</div>
      <div class="grid g2"><div class="card"><h3>Login activity by hour of day</h3><div class="sub">Usual active hours of the user (from IP timestamps)</div><div id="ipH"></div></div><div class="card"><h3>IP types</h3><div id="ipK"></div></div></div>
      <div class="card"><h3>IP addresses</h3><div id="ipT"></div></div>`;
    const hrs = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0'), value: logs.filter(r => /\d{2}:\d{2}/.test(r.ip_time) && +r.ip_time.match(/(\d{2}):\d{2}/)[1] === h).length }));
    Charts.vbar($('#ipH', el), hrs, { fmt: v => v + ' logins' });
    const K = groupBy(rows, r => r.kind); Charts.hbar($('#ipK', el), [...K].map(([k, v]) => ({ label: k, value: v.length })), { fmt: v => v + ' IPs' });
    Table($('#ipT', el), { rows, exportName: 'ip_addresses', sortKey: 'n', sortDir: -1, columns: [{ key: 'ip', label: 'IP', render: r => `<span class="mono">${esc(r.ip)}</span>` }, { key: 'kind', label: 'Type' }, { key: 'n', label: 'Hits', num: true }, { key: 'ports', label: 'Ports' }, { key: 'platforms', label: 'Platforms' }, { key: 'profiles', label: 'Profiles' }, { key: 'first', label: 'First' }, { key: 'last', label: 'Last' }] });
  },
  graph(el) {
    const shared = S.socShared !== false;
    el.innerHTML = `<div class="card"><div class="row"><label><input type="checkbox" id="sgS" ${shared ? 'checked' : ''}> Only identifiers shared by 2+ profiles</label><span class="spacer"></span><button class="btn sm" id="sgPng">⬇ PNG</button></div></div><div class="graph-box" id="sgBox"></div>`;
    $('#sgS', el).onchange = e => { S.socShared = e.target.checked; SocTabs.graph(el); };
    const nodes = new Map(), edges = [];
    const fields = ['mobile', 'email', 'imei', 'ip'];
    const cnt = {}; fields.forEach(f => Analysis.socCommon(f).forEach(g => cnt[f + ':' + g.value] = g.profiles));
    for (const r of S.data.social) {
      const pid = 'P:' + (r.platform || '') + ':' + (r.profile || r.name || r.id);
      if (!nodes.has(pid)) nodes.set(pid, { id: pid, label: r.profile || r.name || '(profile)', sub: r.platform, kind: 'profile', value: 1 });
      for (const f of fields) for (let v of String(r[f] || '').split(/[,;]/).map(s => s.trim()).filter(Boolean)) {
        if (f === 'mobile') v = N.mobile(v);
        if (shared && (cnt[f + ':' + v] || 0) < 2) continue;
        const id = f + ':' + v; if (!nodes.has(id)) nodes.set(id, { id, label: v, sub: f.toUpperCase(), kind: 'ident', value: 0 });
        nodes.get(id).value++;
        if (!edges.some(e => e.from === pid && e.to === id)) edges.push({ from: pid, to: id, amount: 0, count: 1 });
      }
    }
    let ns = [...nodes.values()]; if (shared) { const used = new Set(edges.flatMap(e => [e.from, e.to])); ns = ns.filter(n => used.has(n.id)); }
    if (!ns.length) { $('#sgBox', el).innerHTML = '<div class="muted" style="padding:40px;text-align:center">No shared identifiers found yet.</div>'; return; }
    const g = Graph.mount($('#sgBox', el), ns, edges, { mode: 'net', labels: false, onNode: n => { if (n.kind === 'ident') { S.socField = n.id.split(':')[0]; go('social', 'common'); } } });
    $('#sgPng', el).onclick = () => g.download('social_links', true);
  }
};

/* ======================= 3. NCRP ======================= */
Pages.ncrp = main => {
  const { cur, body } = tabs(main, 'ncrp', [['data', 'Complaints'], ['summary', 'Summary'], ['common', 'Common Suspects'], ['link', 'Link to Money Trail']], '3 · NCRP Analysis',
    `<button class="btn primary" id="nImp">⬆ Import NCRP export</button>`);
  $('#nImp').onclick = () => openImport(['ncrp', 'txn'], render);
  NcrpTabs[cur](body);
};
const NcrpTabs = {
  data(el) {
    el.innerHTML = `<div class="note">Import complaint lists exported from the NCRP / CFCFRMS portal (Excel/CSV). For the layer-wise money trail of a complaint, choose type "Money trail" while importing (it goes to the Financial section and links by Acknowledgement No).</div>
      <div class="card"><h3>Imported files</h3><div id="nF"></div></div><div class="card"><div class="row"><h3 class="grow">Complaints</h3><button class="btn sm" id="nAdd">+ Add manually</button></div><div id="nT"></div></div>`;
    importsTable($('#nF', el), ['ncrp']);
    $('#nAdd', el).onclick = () => manualEntry('ncrp', 'ncrp');
    Table($('#nT', el), { rows: S.data.ncrp, exportName: 'ncrp_complaints', sortKey: 'date', sortDir: -1, columns: FIELDS.ncrp.map(([k, l]) => ({ key: k, label: l, num: ['amount', 'hold_amount'].includes(k), fmt: ['amount', 'hold_amount'].includes(k) ? fmtINR : undefined })), onRow: r => showComplaint(r) });
  },
  summary(el) {
    const d = S.data.ncrp;
    el.innerHTML = UI.kpis([['Complaints', fmtNum(d.length)], ['Amount reported', fmtINR(sum(d, r => r.amount))], ['Amount on hold', fmtINR(sum(d, r => r.hold_amount))], ['Hold %', d.length && sum(d, r => r.amount) ? (100 * sum(d, r => r.hold_amount) / sum(d, r => r.amount)).toFixed(1) + '%' : '—'], ['Districts', uniq(d.map(r => r.district)).length]]) +
      `<div class="grid g2"><div class="card"><h3>By category</h3><div id="n1"></div></div><div class="card"><h3>By sub-category</h3><div id="n2"></div></div>
       <div class="card"><h3>Complaints per day</h3><div id="n3"></div></div><div class="card"><h3>Amount by district</h3><div id="n4"></div></div>
       <div class="card"><h3>Amount brackets</h3><div id="n5"></div></div><div class="card"><h3>Status</h3><div id="n6"></div></div></div>`;
    const bar = (id, key, val = l => l.length, fmt) => { const G = groupBy(d.filter(r => r[key]), r => r[key]); Charts.hbar($(id, el), [...G].map(([k, v]) => ({ label: k, value: val(v) })).sort((a, b) => b.value - a.value), { fmt }); };
    bar('#n1', 'category'); bar('#n2', 'sub_category'); bar('#n4', 'district', l => sum(l, r => r.amount), fmtINR); bar('#n6', 'status');
    const days = groupBy(d.filter(r => r.date), r => r.date.slice(0, 10)); Charts.line($('#n3', el), [...days.keys()].sort().map(k => ({ label: k, value: days.get(k).length })));
    const br = [[0, 10000, '< 10K'], [10000, 50000, '10K–50K'], [50000, 100000, '50K–1L'], [100000, 500000, '1L–5L'], [500000, 1e12, '> 5L']];
    Charts.vbar($('#n5', el), br.map(([a, b, l]) => ({ label: l, value: d.filter(r => r.amount >= a && r.amount < b).length })), { fmt: v => v + ' complaints' });
  },
  common(el) {
    const fields = [['suspect_mobile', 'Suspect mobile'], ['suspect_acc', 'Suspect account'], ['suspect_upi', 'Suspect UPI'], ['suspect_url', 'Suspect URL / app'], ['suspect_email', 'Suspect email'], ['victim_mobile', 'Victim mobile (repeat victim)']];
    const rows = [];
    for (const [f, l] of fields) for (const [v, list] of groupBy(S.data.ncrp.filter(r => r[f]), r => r[f])) if (list.length >= 2) rows.push({ type: l, value: v, n: list.length, amount: sum(list, r => r.amount), acks: list.map(r => r.ack_no).join(', '), districts: uniq(list.map(r => r.district)).join(', '), list });
    el.innerHTML = `<div class="card"><h3>Suspect identifiers repeated across complaints</h3><div class="sub">Same mobile / account / UPI / URL reported by different victims – likely the same gang. Also check Analytics → Cross-Link to match these against bank and social media data.</div><div id="ncT"></div></div>`;
    Table($('#ncT', el), { rows, exportName: 'ncrp_common_suspects', sortKey: 'n', sortDir: -1, columns: [{ key: 'type', label: 'Type' }, { key: 'value', label: 'Value', render: r => `<span class="mono">${esc(r.value)}</span>` }, { key: 'n', label: 'Complaints', num: true }, { key: 'amount', label: 'Total amount', num: true, fmt: fmtINR }, { key: 'districts', label: 'Districts' }, { key: 'acks', label: 'Ack Nos' }], onRow: r => UI.drawer(r.value, r.list.map(c => `<div class="list-item"><div class="grow small"><b>${esc(c.ack_no)}</b> · ${esc(c.date)} · ${fmtINR(c.amount)}<br>${esc(c.victim_name)} · ${esc(c.district)} · ${esc(c.category)}</div></div>`).join('')) });
  },
  link(el) {
    const { A } = Analysis.fin();
    const rows = S.data.ncrp.map(c => {
      const tx = S.data.txns.filter(t => t.ack_no && t.ack_no === c.ack_no);
      const accs = uniq(tx.map(t => t.to_acc)).filter(a => !isSynthetic(a));
      const suspAcc = c.suspect_acc && A.has(c.suspect_acc);
      return { ...c, txns: tx.length, accounts: accs.length, trailAmt: sum(tx.filter(t => t.layer === 1 || !t.layer), t => t.amount), holdT: sum(accs, a => (A.get(a) || {}).hold || 0), maxLayer: Math.max(0, ...accs.map(a => (A.get(a) || {}).layer || 0)), suspInTrail: suspAcc ? 'Yes' : '' };
    });
    el.innerHTML = `<div class="card"><h3>Complaint ↔ money trail</h3><div class="sub">For each complaint: how many trail transactions are imported, how deep the layers go, and how much is on hold. Complaints with 0 transactions still need their trail imported.</div><div id="nlT"></div></div>`;
    Table($('#nlT', el), { rows, exportName: 'ncrp_trail_link', sortKey: 'amount', sortDir: -1, columns: [{ key: 'ack_no', label: 'Ack No' }, { key: 'victim_name', label: 'Victim' }, { key: 'amount', label: 'Reported', num: true, fmt: fmtINR }, { key: 'txns', label: 'Trail txns', num: true, render: r => r.txns ? r.txns : '<span class="badge warn">0 – import trail</span>' }, { key: 'accounts', label: 'Accounts', num: true }, { key: 'maxLayer', label: 'Layers', num: true }, { key: 'holdT', label: 'Hold in trail', num: true, fmt: fmtINR }, { key: 'suspInTrail', label: 'Suspect a/c in trail' }], onRow: r => { if (r.txns) { S.ncrpAck = r.ack_no; go('ncrp', 'case'); } } });
  }
};
function showComplaint(c) {
  const tx = S.data.txns.filter(t => t.ack_no === c.ack_no);
  const b = UI.drawer('Complaint ' + (c.ack_no || ''), UI.kv(Object.fromEntries(FIELDS.ncrp.map(([k, l]) => [l, esc(['amount', 'hold_amount'].includes(k) ? fmtINR(c[k]) : c[k])]))) + `<div class="row"><button class="btn sm" id="cG" ${tx.length ? '' : 'disabled'}>Show money trail (${tx.length} txns)</button></div>`);
  $('#cG', b).onclick = () => { UI.closeDrawer(); S.ncrpAck = c.ack_no; go('ncrp', 'case'); };
}

/* ======================= 4. ANALYTICS ======================= */
Pages.analytics = main => {
  const { cur, body } = tabs(main, 'analytics', [['cross', 'Cross-Link (all sections)'], ['entity', 'Entity Graph'], ['time', 'Timeline'], ['geo', 'Hotspots'], ['flags', 'Bulk Split & Rapid'], ['velocity', 'Fast Movement'], ['round', 'Patterns']], '4 · Analytics');
  AnaTabs[cur](body);
};
const AnaTabs = {
  cross(el) {
    const minS = S.xlMin || 2, ty = S.xlType || '';
    const all = Analysis.crossLinks();
    const rows = all.filter(x => (x.refs >= minS || x.sections >= 2) && (!ty || x.type === ty));
    el.innerHTML = `<div class="note">Every identifier (account, mobile, email, PAN, Aadhaar, UPI, IMEI, IP, URL) from <b>Financial, Social Media, NCRP and extracted text</b> is put in one index. Values found in two or more different sources are listed here – e.g. a mobile number registered on a mule bank account <i>and</i> on a WhatsApp profile <i>and</i> given as suspect number in a complaint.</div>
      <div class="card"><div class="row"><label>Type</label><select id="xT"><option value="">All</option>${uniq(all.map(x => x.type)).sort().map(t => `<option ${t === ty ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <label>Found in at least</label><select id="xM">${[2, 3, 4, 5].map(n => `<option ${n === minS ? 'selected' : ''}>${n}</option>`).join('')}</select><label>sources</label>
      <span class="badge good">${rows.filter(r => r.sections >= 2).length} link across sections</span></div></div>
      <div class="card" id="xTbl"></div>`;
    $('#xT', el).onchange = e => { S.xlType = e.target.value; AnaTabs.cross(el); };
    $('#xM', el).onchange = e => { S.xlMin = +e.target.value; AnaTabs.cross(el); };
    Table($('#xTbl', el), { rows, exportName: 'cross_links', sortKey: 'sections', sortDir: -1, columns: [{ key: 'type', label: 'Type', render: r => `<span class="badge">${esc(r.type)}</span>` }, { key: 'value', label: 'Value', render: r => r.type === 'account' ? accLink(r.value) : `<span class="mono">${esc(r.value)}</span>` }, { key: 'sections', label: 'Sections', num: true }, { key: 'sectionList', label: 'Found in' }, { key: 'refs', label: 'Sources', num: true }, { key: 'refList', label: 'Where' }], onRow: r => UI.drawer(r.type + ': ' + r.value, r.items.map(i => `<div class="list-item"><div class="grow small"><b>${esc(i.section)}</b> · ${esc(i.ref)}</div></div>`).join('')), after: bindAccLinks });
  },
  entity(el) {
    const rows = Analysis.crossLinks().filter(x => x.refs >= 2).sort((a, b) => b.refs - a.refs).slice(0, 150);
    const nodes = new Map(), edges = [];
    for (const x of rows) {
      const id = x.type + ':' + x.value; nodes.set(id, { id, label: x.value, sub: x.type.toUpperCase(), kind: 'ident', value: x.refs });
      for (const ref of uniq(x.items.map(i => i.ref))) {
        const rid = 'R:' + ref; const sec = x.items.find(i => i.ref === ref).section;
        if (!nodes.has(rid)) nodes.set(rid, { id: rid, label: ref.split(' · ').slice(1).join(' · ') || ref, sub: ref.split(' · ')[0], kind: sec === 'Social Media' ? 'profile' : sec === 'NCRP' ? 'victim' : sec === 'Financial' ? 'account' : 'other', value: 0 });
        nodes.get(rid).value++; edges.push({ from: rid, to: id, amount: 0, count: 1 });
      }
    }
    el.innerHTML = `<div class="card"><div class="row"><span class="muted small">Violet = shared identifier; other colours = the record it appears in (blue financial, pink social profile, orange NCRP complaint). Shows the top 150 shared identifiers.</span><span class="spacer"></span><button class="btn sm" id="ePng">⬇ PNG</button></div></div><div class="graph-box" id="eBox" style="height:680px"></div>`;
    if (!nodes.size) { $('#eBox', el).innerHTML = '<div class="muted" style="padding:40px;text-align:center">No shared identifiers yet.</div>'; return; }
    const g = Graph.mount($('#eBox', el), [...nodes.values()], edges, { mode: 'net', labels: false, onNode: n => { if (n.kind === 'ident') { const x = rows.find(r => r.type + ':' + r.value === n.id); UI.drawer(n.id, x.items.map(i => `<div class="list-item small">${esc(i.section)} · ${esc(i.ref)}</div>`).join('')); } } });
    $('#ePng', el).onclick = () => g.download('entity_graph', true);
  },
  time(el) {
    const tx = S.data.txns.filter(t => t.date);
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Amount per day</h3><div id="t1"></div></div><div class="card"><h3>Transactions by hour of day</h3><div class="sub">When the money moves (only rows with time)</div><div id="t2"></div></div>
      <div class="card"><h3>Transactions by weekday</h3><div id="t3"></div></div><div class="card"><h3>Mode of transfer</h3><div id="t4"></div></div></div>
      <div class="card"><h3>Chronology</h3><div class="sub">All dated events (transactions, complaints, social logins) in one list</div><div id="t5"></div></div>`;
    const D = groupBy(tx, t => t.date.slice(0, 10)); Charts.line($('#t1', el), [...D.keys()].sort().map(k => ({ label: k, value: sum(D.get(k), t => t.amount) })), { fmt: fmtINR });
    Charts.vbar($('#t2', el), Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0'), value: tx.filter(t => t.date.length > 10 && +t.date.slice(11, 13) === h).length })), { fmt: v => v + ' txns' });
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; Charts.vbar($('#t3', el), wd.map((w, i) => ({ label: w, value: tx.filter(t => new Date(t.date.slice(0, 10)).getDay() === i).length })), { fmt: v => v + ' txns' });
    const M = groupBy(S.data.txns, t => t.mode || 'Unknown'); Charts.hbar($('#t4', el), [...M].map(([k, v]) => ({ label: k, value: sum(v, t => t.amount), sub: v.length + ' txns' })).sort((a, b) => b.value - a.value), { fmt: fmtINR });
    const ev = [...tx.map(t => ({ when: t.date, kind: 'Transaction', what: `${accLabel(t.from_acc || '?')} → ${accLabel(t.to_acc || '?')} ${fmtINR(t.amount)} ${t.mode}`, ref: t.ack_no || t.txn_id })),
      ...S.data.ncrp.filter(c => c.date).map(c => ({ when: c.date, kind: 'Complaint', what: `${c.victim_name} – ${c.category} ${fmtINR(c.amount)}`, ref: c.ack_no })),
      ...S.data.social.filter(s => s.ip_time).map(s => ({ when: s.ip_time, kind: 'Social login', what: `${s.platform} ${s.profile} from ${s.ip}`, ref: s._src }))];
    Table($('#t5', el), { rows: ev, exportName: 'chronology', sortKey: 'when', columns: [{ key: 'when', label: 'Date / time' }, { key: 'kind', label: 'Type' }, { key: 'what', label: 'Event' }, { key: 'ref', label: 'Reference' }] });
  },
  geo(el) {
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>States (beneficiary KYC & trail)</h3><div id="g1"></div></div><div class="card"><h3>Districts (beneficiary KYC & trail)</h3><div id="g2"></div></div>
      <div class="card"><h3>Victim states (NCRP)</h3><div id="g3"></div></div><div class="card"><h3>ATM / cash-out locations</h3><div id="g4"></div></div></div>
      <div class="card"><h3>PIN codes of beneficiaries</h3><div class="sub">Many mule accounts from one PIN code often means one recruiter / one area to raid.</div><div id="g5"></div></div>`;
    const cnt = (arr, id, fmt) => { const G = groupBy(arr.filter(Boolean), x => x); Charts.hbar($(id, el), [...G].map(([k, v]) => ({ label: k, value: v.length })).sort((a, b) => b.value - a.value), { fmt: fmt || (v => v + ' records'), max: 15 }); };
    cnt([...S.data.kyc.map(k => k.state), ...S.data.txns.map(t => t.state)], '#g1'); cnt([...S.data.kyc.map(k => k.district), ...S.data.txns.map(t => t.district)], '#g2');
    cnt(S.data.ncrp.map(c => c.state), '#g3'); cnt(S.data.txns.map(t => t.atm_loc ? N.upper(t.atm_loc) : ''), '#g4');
    const P = groupBy(S.data.kyc.filter(k => k.pincode || /\b\d{6}\b/.test(k.address)), k => k.pincode || k.address.match(/\b\d{6}\b/)[0]);
    Table($('#g5', el), { rows: [...P].map(([pin, l]) => ({ pin, n: l.length, accs: l.map(k => k.acc).join(', '), names: uniq(l.map(k => k.name)).join(', '), district: uniq(l.map(k => k.district)).join(', ') })), sortKey: 'n', sortDir: -1, exportName: 'pincodes', columns: [{ key: 'pin', label: 'PIN' }, { key: 'n', label: 'Accounts', num: true }, { key: 'district', label: 'District' }, { key: 'names', label: 'Names' }, { key: 'accs', label: 'Accounts list' }] });
  },
  velocity(el) {
    const { A, inE, outE } = Analysis.fin(); const rows = []; const W = d => Flags.when(d);
    for (const n of A.values()) {
      if (isSynthetic(n.acc) || n.acc.startsWith('VICTIM:')) continue;
      const ins = (inE.get(n.acc) || []).flatMap(e => e.txns).map(t => ({ t, w: W(t.date) })).filter(x => x.w).sort((a, b) => a.w.t - b.w.t);
      const outs = (outE.get(n.acc) || []).flatMap(e => e.txns).map(t => ({ t, w: W(t.date) })).filter(x => x.w).sort((a, b) => a.w.t - b.w.t);
      for (const i of ins) {
        // first money going out at or after this money came in
        const ot = i.w.time && outs.find(x => x.w.time && x.w.t >= i.w.t), od = outs.find(x => !x.w.time && x.w.day === i.w.day) || (!i.w.time && outs.find(x => x.w.day === i.w.day));
        const o = ot && ot.w.t - i.w.t <= 86400000 ? ot : od; if (!o) continue;
        const timed = i.w.time && o.w.time, mins = timed ? Math.round((o.w.t - i.w.t) / 60000) : null;
        if (timed ? mins > 1440 : o.w.day !== i.w.day) continue;
        rows.push({ acc: n.acc, name: [...n.names][0] || '', inAt: i.t.date, inAmt: i.t.amount, outAt: o.t.date, outAmt: o.t.amount, to: o.t.to_acc, mins, gapTxt: timed ? Flags.fmtGap({ gap: mins }) : 'same day – time not in data', ack: i.t.ack_no });
      }
    }
    const noTime = rows.filter(r => r.mins == null).length;
    el.innerHTML = `<div class="card"><h3>Money moved out within 24 hours of arriving</h3><div class="sub">Typical of mule / pass-through accounts. Gap = time between money coming in and the next money going out. When a row has only a date (no time), the gap is shown as "same day".</div>${noTime ? `<div class="note warn">${noTime} row(s) have no time for the money coming in, so the exact gap can't be worked out. If your sheet has the time in a separate column, map it to <b>Transaction Time</b> while importing.</div>` : ''}<div id="vT"></div></div>`;
    Table($('#vT', el), { rows, exportName: 'fast_movement', sortKey: 'mins', columns: [{ key: 'acc', label: 'Account', render: r => accLink(r.acc) }, { key: 'name', label: 'Name' }, { key: 'inAt', label: 'Received at' }, { key: 'inAmt', label: 'Received', num: true, fmt: fmtINR }, { key: 'outAt', label: 'Sent at' }, { key: 'outAmt', label: 'Sent', num: true, fmt: fmtINR }, { key: 'to', label: 'Sent to', render: r => accLink(r.to) }, { key: 'mins', label: 'Gap', num: true, csv: r => r.mins ?? r.gapTxt, render: r => r.mins != null ? `<b>${esc(r.gapTxt)}</b>` : `<span class="small muted">${esc(r.gapTxt)}</span>` }, { key: 'ack', label: 'Ack' }], after: bindAccLinks });
  },
  round(el) {
    const tx = S.data.txns;
    const round = tx.filter(t => t.amount >= 1000 && t.amount % 1000 === 0);
    const { E } = Analysis.fin();
    const back = [...E.values()].filter(e => E.has(e.to + '→' + e.from) && e.from < e.to && !isSynthetic(e.from) && !isSynthetic(e.to));
    const split = Object.values(groupBy(tx.filter(t => t.from_acc && t.date), t => t.from_acc + '|' + t.date.slice(0, 10))).filter(l => l.length >= 3).map(l => ({ acc: l[0].from_acc, day: l[0].date.slice(0, 10), n: l.length, total: sum(l, t => t.amount), to: uniq(l.map(t => t.to_acc)).length }));
    const below = tx.filter(t => t.amount >= 45000 && t.amount < 50000);
    el.innerHTML = UI.kpis([['Round-figure txns', fmtNum(round.length), 'multiples of ₹1,000'], ['Two-way transfers', fmtNum(back.length), 'A→B and B→A'], ['Split / fan-out days', fmtNum(split.length), '≥ 3 transfers from one account in a day'], ['Just-below ₹50K', fmtNum(below.length), 'possible limit avoidance']]) +
      `<div class="card"><h3>Fan-out: one account sending to many in a day</h3><div id="p1"></div></div><div class="card"><h3>Two-way (circular) transfers</h3><div id="p2"></div></div>`;
    Table($('#p1', el), { rows: split, exportName: 'fan_out', sortKey: 'n', sortDir: -1, columns: [{ key: 'acc', label: 'Account', render: r => accLink(r.acc) }, { key: 'day', label: 'Date' }, { key: 'n', label: 'Transfers', num: true }, { key: 'to', label: 'Receivers', num: true }, { key: 'total', label: 'Total', num: true, fmt: fmtINR }], after: bindAccLinks });
    Table($('#p2', el), { rows: back.map(e => ({ a: e.from, b: e.to, ab: e.amount, ba: E.get(e.to + '→' + e.from).amount })), exportName: 'two_way', columns: [{ key: 'a', label: 'Account A', render: r => accLink(r.a) }, { key: 'b', label: 'Account B', render: r => accLink(r.b) }, { key: 'ab', label: 'A → B', num: true, fmt: fmtINR }, { key: 'ba', label: 'B → A', num: true, fmt: fmtINR }], after: bindAccLinks });
  }
};

/* ======================= 5. OTHERS ======================= */
Pages.others = main => {
  const { cur, body } = tabs(main, 'others', [['cases', 'Cases'], ['notes', 'Notes & Tasks'], ['extract', 'Identifier Extractor'], ['tools', 'Validators & Lookup'], ['notices', 'Notice Templates'], ['reports', 'Reports & Export']], '5 · Others');
  OthTabs[cur](body);
};
const OthTabs = {
  cases(el) {
    el.innerHTML = `<div class="card"><h3>Case details</h3><div class="sub">Shown on reports and notices.</div><div class="map-grid" id="cd">${[['name', 'Case name'], ['fir', 'FIR / Case No'], ['section', 'Sections of law'], ['ps', 'Police Station'], ['io', 'Investigating Officer'], ['io_rank', 'IO rank / designation'], ['io_mobile', 'IO mobile'], ['io_email', 'IO official email'], ['district', 'District'], ['ack', 'Main NCRP Ack No'], ['status', 'Status']].map(([k, l]) => `<div class="f"><label>${l}</label><input data-k="${k}" value="${esc(activeCase()[k] || '')}"></div>`).join('')}</div>
      <div class="f" style="margin-top:10px"><label>Brief facts</label><textarea data-k="desc" style="font-family:inherit">${esc(activeCase().desc || '')}</textarea></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="cdSave">Save details</button></div></div>
      <div class="card"><h3>All cases</h3><div id="cl"></div></div>`;
    $('#cdSave', el).onclick = async () => { const c = activeCase(); $$('[data-k]', $('#cd', el).parentElement).forEach(i => c[i.dataset.k] = i.value); await saveMeta(); fillCaseSel(); UI.toast('Case details saved'); };
    const rows = S.cases.map(c => ({ ...c, active: c.id === S.caseId ? 'Active' : '' }));
    Table($('#cl', el), { rows, exportName: 'cases', columns: [{ key: 'name', label: 'Case' }, { key: 'fir', label: 'FIR' }, { key: 'ps', label: 'PS' }, { key: 'io', label: 'IO' }, { key: 'status', label: 'Status' }, { key: 'created', label: 'Created', fmt: v => (v || '').slice(0, 10) }, { key: 'active', label: '' },
      { key: 'x', label: '', nosort: true, noexport: true, render: r => `<button class="btn sm" data-open="${r.id}">Open</button> <button class="btn sm danger" data-delc="${r.id}">Delete</button>` }],
      after: c => { $$('[data-open]', c).forEach(b => b.onclick = () => switchCase(b.dataset.open)); $$('[data-delc]', c).forEach(b => b.onclick = () => deleteCase(b.dataset.delc)); } });
  },
  notes(el) {
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Case notes</h3><div class="sub">Diary of investigation steps, findings and leads</div>
      <input id="nTitle" placeholder="Title" style="width:100%;margin-bottom:6px"><textarea id="nText" placeholder="Write note…" style="font-family:inherit"></textarea>
      <div class="row" style="margin:8px 0 14px"><select id="nTag"><option>general</option><option>lead</option><option>finding</option><option>notice sent</option><option>reply received</option><option>arrest</option><option>recovery</option></select><button class="btn primary" id="nAdd">Add note</button></div><div id="nList"></div></div>
      <div class="card"><h3>Tasks / follow-ups</h3><div class="sub">Notices to send, replies awaited, raids to plan</div>
      <div class="row"><input id="tText" class="grow" placeholder="e.g. Send Sec 94 BNSS notice to Axis Bank nodal officer"><input id="tDue" type="date"><button class="btn primary" id="tAdd">Add</button></div><div id="tList" style="margin-top:12px"></div></div></div>`;
    const d = S.data;
    const drawN = () => $('#nList', el).innerHTML = d.notes.map(n => `<div class="list-item"><div class="grow"><b>${esc(n.title || '(untitled)')}</b> <span class="badge">${esc(n.tag)}</span> <span class="small muted">${esc(n.when.slice(0, 16).replace('T', ' '))}</span><div class="small" style="white-space:pre-wrap">${esc(n.text)}</div></div><button class="btn sm danger" data-dn="${n.id}">✕</button></div>`).join('') || '<p class="muted">No notes yet.</p>';
    const drawT = () => $('#tList', el).innerHTML = d.tasks.slice().sort((a, b) => a.done - b.done || (a.due || '9').localeCompare(b.due || '9')).map(t => `<div class="list-item"><input type="checkbox" data-tt="${t.id}" ${t.done ? 'checked' : ''}><div class="grow" style="${t.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(t.text)} ${t.due ? `<span class="badge ${!t.done && t.due < today() ? 'bad' : ''}">${esc(t.due)}</span>` : ''}</div><button class="btn sm danger" data-dt="${t.id}">✕</button></div>`).join('') || '<p class="muted">No tasks.</p>';
    const bind = () => {
      $$('[data-dn]', el).forEach(b => b.onclick = () => { d.notes = d.notes.filter(n => n.id !== b.dataset.dn); saveCase(); drawN(); bind(); });
      $$('[data-dt]', el).forEach(b => b.onclick = () => { d.tasks = d.tasks.filter(n => n.id !== b.dataset.dt); saveCase(); drawT(); bind(); });
      $$('[data-tt]', el).forEach(b => b.onchange = () => { d.tasks.find(t => t.id === b.dataset.tt).done = b.checked; saveCase(); drawT(); bind(); });
    };
    drawN(); drawT(); bind();
    $('#nAdd', el).onclick = () => { const t = $('#nText', el).value.trim(); if (!t) return; d.notes.unshift({ id: uid(), title: $('#nTitle', el).value, text: t, tag: $('#nTag', el).value, when: new Date().toISOString() }); saveCase(); $('#nText', el).value = ''; $('#nTitle', el).value = ''; drawN(); bind(); };
    $('#tAdd', el).onclick = () => { const t = $('#tText', el).value.trim(); if (!t) return; d.tasks.push({ id: uid(), text: t, due: $('#tDue', el).value, done: false }); saveCase(); $('#tText', el).value = ''; drawT(); bind(); };
  },
  extract(el) {
    el.innerHTML = `<div class="card"><h3>Identifier Extractor</h3><div class="sub">Paste any text – platform reply email, PDF reply, chat export, SMS, complaint text – or load a PDF/TXT/Excel file. It pulls out mobiles, emails, UPI IDs, account numbers, IFSC, PAN, Aadhaar (checksum verified), IMEI (checksum verified), IP addresses and URLs.</div>
      <div class="row" style="margin-bottom:8px"><button class="btn" id="xLoad">📄 Load file</button><input id="xSrc" placeholder="Source label (e.g. WhatsApp reply 12-Oct)" style="width:300px"></div>
      <textarea id="xText" style="min-height:180px" placeholder="Paste text here…"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="xGo">Extract</button><span class="spacer"></span><span class="muted small">${S.data.idents.length} identifiers saved in this case</span><button class="btn sm danger" id="xClr">Clear saved</button></div></div><div id="xOut"></div>`;
    $('#xLoad', el).onclick = () => { const fp = $('#filePick'); fp.value = ''; fp.onchange = async () => { const f = fp.files[0]; if (!f) return; try { const p = await Parsers.readFile(f, m => prompt(m)); $('#xText', el).value = p.text; $('#xSrc', el).value = f.name; UI.toast('Loaded ' + f.name); } catch (e) { UI.toast('Error: ' + e.message, 5000); } }; fp.click(); };
    $('#xClr', el).onclick = () => { if (UI.confirm('Delete all saved extracted identifiers?')) { S.data.idents = []; saveCase(); OthTabs.extract(el); } };
    $('#xGo', el).onclick = () => {
      const found = extractIdentifiers($('#xText', el).value);
      const src = $('#xSrc', el).value || 'Pasted text ' + new Date().toLocaleString();
      const known = new Set(Analysis.idents().map(i => i.type + '|' + i.value));
      $('#xOut', el).innerHTML = `<div class="card"><div class="row"><h3 class="grow">Found ${found.length} identifiers</h3><button class="btn primary sm" id="xSave">Save to case (for cross-linking)</button></div><div id="xT"></div></div>`;
      Table($('#xT', el), { rows: found.map(f => ({ ...f, info: f.type === 'ifsc' ? bankFromIfsc(f.value) : f.type === 'upi' ? (UPI_HANDLES[f.value.split('@')[1]] || '') : f.type === 'ip' ? V.ipKind(f.value) : f.type === 'pan' ? V.panType(f.value) : '', known: known.has(f.type + '|' + f.value) ? 'Already in case data' : '' })), exportName: 'extracted', sortKey: 'type', columns: [{ key: 'type', label: 'Type' }, { key: 'value', label: 'Value', render: r => `<span class="mono">${esc(r.value)}</span>` }, { key: 'info', label: 'Info' }, { key: 'known', label: 'Match', render: r => r.known ? '<span class="badge good">Already in case data</span>' : '' }] });
      $('#xSave', el).onclick = () => { found.forEach(f => S.data.idents.push({ id: uid(), ...f, source: src })); saveCase(); UI.toast(found.length + ' identifiers saved. See Analytics → Cross-Link.'); };
    };
  },
  tools(el) {
    el.innerHTML = `<div class="grid g3">
      <div class="card"><h3>Check a value</h3><div class="sub">IFSC → bank, PAN type, Aadhaar checksum, IMEI checksum, mobile, UPI handle → app/bank, IP type</div><input id="vIn" style="width:100%" placeholder="Paste IFSC / PAN / Aadhaar / IMEI / mobile / UPI / IP"><div id="vOut" style="margin-top:10px"></div></div>
      <div class="card"><h3>Bulk check</h3><div class="sub">One value per line</div><textarea id="vBulk"></textarea><button class="btn sm" id="vBulkGo" style="margin-top:6px">Check all</button><div id="vBulkOut"></div></div>
      <div class="card"><h3>Search inside case</h3><div class="sub">Where does this value appear?</div><input id="vFind" style="width:100%" placeholder="Account / mobile / UTR / name…"><div id="vFindOut" style="margin-top:10px"></div></div></div>
      <div class="card"><h3>UPI handle reference</h3><div class="small">${Object.entries(UPI_HANDLES).map(([k, v]) => `<span class="badge" style="margin:2px">@${k} – ${esc(v)}</span>`).join('')}</div></div>`;
    const check = v => {
      v = v.trim(); if (!v) return '';
      const out = [];
      if (V.ifsc(v)) out.push(['IFSC', `Valid format · <b>${esc(bankFromIfsc(v) || 'Bank code ' + v.slice(0, 4))}</b> · branch code ${esc(v.slice(5))}`]);
      if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(v)) out.push(['PAN', `Valid format · holder type <b>${V.panType(v)}</b> · surname/name initial ${esc(v[4].toUpperCase())}`]);
      if (/^\d{4}\s?\d{4}\s?\d{4}$/.test(v)) out.push(['Aadhaar', V.aadhaar(v) ? '<span class="badge good">Checksum valid</span>' : '<span class="badge bad">Invalid checksum – wrong / fake</span>']);
      if (/^\d{15}$/.test(v)) out.push(['IMEI', V.imei(v) ? `<span class="badge good">Valid (Luhn)</span> TAC ${v.slice(0, 8)} identifies model` : '<span class="badge bad">Invalid checksum</span>']);
      if (/^(\+?91|0)?[6-9]\d{9}$/.test(v.replace(/[\s\-]/g, ''))) out.push(['Mobile', `Indian mobile · ${N.mobile(v)}`]);
      if (/^[\w.\-]+@[a-z]+$/i.test(v)) out.push(['UPI ID', esc(UPI_HANDLES[v.split('@')[1].toLowerCase()] || 'Unknown handle – check NPCI list')]);
      if (V.email(v) && v.split('@')[1].includes('.')) out.push(['Email', 'Valid format · domain ' + esc(v.split('@')[1])]);
      if (/^[\d.]+$/.test(v) && v.split('.').length === 4 || /^[0-9a-f:]+$/i.test(v) && v.includes(':')) out.push(['IP', esc(V.ipKind(v))]);
      if (/^\d{9,18}$/.test(v) && !out.length) out.push(['Number', 'Could be a bank account / UTR / RRN']);
      return out.length ? out.map(([k, t]) => `<div><span class="badge info">${k}</span> ${t}</div>`).join('') : '<span class="muted">Not recognised</span>';
    };
    $('#vIn', el).oninput = e => $('#vOut', el).innerHTML = check(e.target.value);
    $('#vBulkGo', el).onclick = () => $('#vBulkOut', el).innerHTML = $('#vBulk', el).value.split('\n').filter(s => s.trim()).map(v => `<div class="list-item"><div class="grow small"><b class="mono">${esc(v)}</b><br>${check(v)}</div></div>`).join('');
    $('#vFind', el).oninput = e => { const r = Analysis.search(e.target.value); $('#vFindOut', el).innerHTML = r.slice(0, 50).map(x => `<div class="list-item small"><div class="grow"><b>${esc(x.section)}</b> · ${esc(x.label)}<br><span class="muted">${esc(x.field)}: ${esc(x.value)}</span></div></div>`).join('') || (e.target.value.length >= 3 ? '<span class="muted">Not found</span>' : ''); };
  },
  notices(el) { Notices.render(el); },
  reports(el) {
    el.innerHTML = `<div class="grid g3">
      <div class="card"><h3>🖨 Case report</h3><div class="sub">Printable report: case details, summary, complaints, layer-wise trail, suspect accounts, commonalities, cross-links, social media findings and notes. Use the browser's Print → "Save as PDF".</div><button class="btn primary" id="rRep">Open case report</button></div>
      <div class="card"><h3>📊 Excel workbook</h3><div class="sub">All data and analysis of this case in one .xlsx file (one sheet each).</div><button class="btn primary" id="rXls">Download Excel</button></div>
      <div class="card"><h3>💾 Backup / restore</h3><div class="sub">Save everything (all cases) to a file, and restore it on this or another computer. Keep backups safe – they contain case data.</div><div class="row"><button class="btn" id="rBak">Download backup</button><button class="btn" id="rRes">Restore from backup</button></div></div></div>`;
    $('#rRep', el).onclick = () => Reports.caseReport();
    $('#rXls', el).onclick = () => Reports.excel();
    $('#rBak', el).onclick = () => Reports.backup();
    $('#rRes', el).onclick = () => Reports.restore();
  }
};

/* ======================= SETTINGS ======================= */
Pages.settings = main => {
  main.innerHTML = `<div class="page-title"><h2>Settings</h2></div>
    <div class="grid g2"><div class="card"><h3>Change login ID / password</h3>
      <div class="note warn">The login is a <b>convenience lock</b> to keep casual users out. Data is stored unencrypted in this browser's storage on this computer, so anyone with access to your Windows account and some technical skill could read it. Use a password-protected Windows account, lock the screen when away, and keep backups safe.</div>
      <div class="map-grid"><div class="f"><label>Current password</label><input type="password" id="sCur"></div><div class="f"><label>New login ID</label><input id="sUser" value="${esc(S.settings.user)}"></div>
      <div class="f"><label>New password (min 6)</label><input type="password" id="sP1"></div><div class="f"><label>Repeat new password</label><input type="password" id="sP2"></div></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="sSave">Save</button><span class="err" id="sErr"></span></div></div>
    <div class="card"><h3>Preferences</h3><div class="map-grid">
      <div class="f"><label>Auto-lock after inactivity (minutes, 0 = never)</label><input type="number" id="sLock" min="0" value="${S.settings.lockMins}"></div>
      <div class="f"><label>Theme</label><select id="sTheme"><option value="dark" ${S.settings.theme !== 'light' ? 'selected' : ''}>Dark</option><option value="light" ${S.settings.theme === 'light' ? 'selected' : ''}>Light</option></select></div></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="sPref">Save preferences</button></div>
      <h3 style="margin-top:22px">Danger zone</h3><div class="row"><button class="btn danger" id="sClear">Clear all data of current case</button></div></div></div>
    <div class="card"><h3>About</h3><div class="small muted">Sudarshanastra v1.0 · offline single-folder web app · works in Chrome / Edge / Firefox without internet. Libraries: SheetJS (Excel), PDF.js (PDF). Your data never leaves this computer.</div></div>`;
  $('#sSave').onclick = async () => {
    const e = $('#sErr'); e.textContent = '';
    if (hashPass($('#sCur').value, S.settings.salt) !== S.settings.hash) { e.textContent = 'Current password is wrong'; return; }
    const p1 = $('#sP1').value, p2 = $('#sP2').value, u = $('#sUser').value.trim();
    if (!u) { e.textContent = 'Login ID required'; return; }
    if (p1 || p2) { if (p1.length < 6) { e.textContent = 'Password must be at least 6 characters'; return; } if (p1 !== p2) { e.textContent = 'Passwords do not match'; return; } S.settings.salt = uid(); S.settings.hash = hashPass(p1, S.settings.salt); S.settings.mustChange = false; }
    S.settings.user = u; await saveMeta(); UI.toast('Login updated');
  };
  $('#sPref').onclick = async () => { S.settings.lockMins = Math.max(0, +$('#sLock').value || 0); S.settings.theme = $('#sTheme').value; applyTheme(); await saveMeta(); UI.toast('Saved'); };
  $('#sClear').onclick = () => { if (UI.confirm('Delete ALL imported data, notes and tasks of the current case? This cannot be undone (unless you have a backup).')) { S.data = emptyCase(); saveCase(); UI.toast('Case data cleared'); render(); } };
};

/* ======================= Global search ======================= */
Pages.search = main => {
  const q = S.searchQ || ''; const r = Analysis.search(q);
  main.innerHTML = `<div class="page-title"><h2>Search: "${esc(q)}"</h2><span class="muted">${r.length} results</span></div><div class="card" id="srT"></div>`;
  Table($('#srT'), { rows: r, exportName: 'search', columns: [{ key: 'section', label: 'Section' }, { key: 'label', label: 'Record' }, { key: 'field', label: 'Matched field' }, { key: 'value', label: 'Value', render: x => esc(x.value).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), m => `<span class="hl">${m}</span>`) }],
    onRow: x => { if (x.rec.to_acc || x.rec.acc) showAccount(x.rec.acc || (x.rec.to_acc.includes(q.toUpperCase()) ? x.rec.to_acc : x.rec.from_acc || x.rec.to_acc)); else if (x.rec.ack_no && x.section === 'NCRP') showComplaint(x.rec); } });
};
