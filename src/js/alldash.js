/* alldash.js – Dashboard for ALL cases: totals, status, money, mule accounts, common suspects across cases,
   case-by-case analysis table and pending work – with an "All Cases / This Case" switch. */
'use strict';
const AllDash = {
  C: new Map(),            // caseId → summary (recomputed when that case changes)
  busy: null,
  fin: c => (c && c.final && c.final.type) || (typeof CaseStat !== 'undefined' ? CaseStat.fin(c) : ''),
  pend(c) { const f = this.fin(c); return f ? f === 'PPI' : !/complet|closed|disposed|solved|\bdone\b/i.test(c.status || ''); },
  async one(c) {
    const cur = S.data, cid = S.caseId; let d = c.id === S.caseId ? S.data : Object.assign(emptyCase(), await DB.get('case:' + c.id) || {});
    const o = { id: c.id, cat: AllMode.cat(c), name: c.name || '', fir: c.fir || '', ps: c.ps || '', io: c.io || '', section: c.section || '', fin: this.fin(c), finNo: (c.final || {}).no || '', status: c.status || 'Under investigation', pend: this.pend(c), ids: new Map() };
    S.data = d; S.caseId = c.id; Analysis.invalidate(); if (typeof CDX !== 'undefined') CDX._m = null;
    try {
      const acc = Analysis.accountRows(); o.acc = acc.filter(a => !isSynthetic(a.acc)).length; o.mule = acc.filter(a => a.score >= 60).length;
      o.ncrp = (d.ncrp || []).length; o.txns = (d.txns || []).length; let comps = []; try { comps = Trail.complaints(); } catch (e) { } o.comps = comps.length || o.ncrp;
      o.acks = uniq([...comps.map(x => String(x.ack)), ...AllMode.ackOf(c)]); o.layers = Math.max(0, ...comps.map(x => x.layers || 0)); o.banks = uniq((d.txns || []).map(t => String(t.to_bank || '').split(' / ')[0].trim().toUpperCase()).filter(b => b && !/withdraw|transfer|hold|action|cheque/i.test(b))).length;
      o.amount = sum(d.ncrp || [], r => +r.amount || 0) || sum(comps, x => +x.amount || 0);
      o.hold = Math.max(sum(acc, a => a.hold || 0), sum(d.ncrp || [], r => +r.hold_amount || 0), sum(comps, x => +x.hold || 0));
      const cc = d.cctns || {}; o.cd = (cc.cd || []).length; o.cdLast = typeof CDX !== 'undefined' ? CDX.lastNo(cc.cd) : ''; o.cdDate = typeof CDX !== 'undefined' ? CDX.lastDate(cc.cd) : ''; o.cdGap = typeof CDX !== 'undefined' ? CDX.gaps(cc.cd) : '';
      if (typeof CDX !== 'undefined' && (o.cd || cc.fir)) { const r = CDX.analyse(d, c); if (!o.amount) o.amount = r.fir.amount || 0; o.secs = r.fir.sections.join(', '); o.got = r.items.filter(i => i.status === 'Received').length; o.ask = r.items.filter(i => i.status !== 'Received').length + r.agencies.filter(a => a.status === 'Pending').length; o.oldest = Math.max(0, ...r.agencies.filter(a => a.status === 'Pending').map(a => a.age), ...r.items.map(i => i.age || 0)); o.sugg = r.sugg.slice(0, 3).map(s => s.en); o.kyc = r.items.filter(i => i.kyc).length; }
      try { const W = CCTNS.work(d, c).filter(w => w.status === 'Pending'); o.work = W.length; o.workList = W.map(w => w.title); } catch (e) { o.work = 0; o.workList = []; }
      let ids = []; try { ids = Analysis.idents(); } catch (e) { }
      for (const i of ids) { const k = Dash2.nk(i.type, i.value); if (!k || /\(victim\)/.test(i.ref || '')) continue; const key = i.type + '|' + k; let e = o.ids.get(key); if (!e) o.ids.set(key, e = { type: i.type, value: String(i.value), secs: new Set() }); e.secs.add(Dash2.sec(i.section)); }
      o.nIds = o.ids.size;
    } catch (e) { console.error(e); }
    finally { S.data = cur; S.caseId = cid; Analysis.invalidate(); if (typeof CDX !== 'undefined') CDX._m = null; }
    return o;
  },
  async collect(onP) {
    while (this.busy) { try { await this.busy; } catch (e) { } }
    const pr = (async () => {
      this.C.delete(S.caseId); const out = [], L = AllMode.on() ? AllMode.list() : S.cases;
      for (let n = 0; n < L.length; n++) { const c = L[n]; let o = this.C.get(c.id); if (!o) { onP && onP(n + 1, L.length, c.name); o = c.id === S.caseId ? await this.one(c) : await Vault.sum(c.id, 'ad', 'v1|' + JSON.stringify(c) + '|' + today(), () => this.one(c)); this.C.set(c.id, o); await new Promise(r => setTimeout(r, 0)); }
        Object.assign(o, { cat: AllMode.cat(c), name: c.name || '', fir: c.fir || '', ps: c.ps || '', io: c.io || '', fin: this.fin(c), finNo: (c.final || {}).no || '', status: c.status || '', pend: this.pend(c) }); out.push(o); }
      for (const id of [...this.C.keys()]) if (!S.cases.some(c => c.id === id)) this.C.delete(id);
      return out;
    })();
    this.busy = pr; try { return await pr; } finally { if (this.busy === pr) this.busy = null; }
  },
  common(R) {
    const M = new Map();
    for (const o of R) for (const [k, e] of o.ids) { let g = M.get(k); if (!g) M.set(k, g = { key: k, type: e.type, value: e.value, cases: [], secs: new Set() }); g.cases.push(o); e.secs.forEach(s => g.secs.add(s)); }
    return [...M.values()].filter(g => g.cases.length >= 2).sort((a, b) => b.cases.length - a.cases.length || b.secs.size - a.secs.size);
  },
  what() {
    const n = sc => AllMode.list(sc).length, pl = (k, a, b) => `${k} ${k === 1 ? a : b}`;
    return { __all: `every case on this computer – ${pl(n('__fir'), 'FIR case', 'FIR cases')} + ${pl(n('__ncrp'), 'NCRP complaint', 'NCRP complaints')} without FIR`, __fir: `${pl(n('__fir'), 'FIR case', 'FIR cases')} together`, __ncrp: `${pl(n('__ncrp'), 'NCRP complaint', 'NCRP complaints')} with no FIR yet` }[S.caseId] || '';
  },
  open(id) { UI.closeDrawer(); if (id !== S.caseId) switchCase(id); else render(); },
  async draw(main) {
    const pct = (n, t) => t ? Math.round(n / t * 100) : 0;
    main.innerHTML = `<i class="ad-dv" hidden></i><div class="hero-card dash-hero ad-head"><div class="dash-brand"><span class="ck-wrap db-mark"><i class="ck" aria-hidden="true"></i><span class="emblem emblem-sm" aria-hidden="true"></span></span><div class="db-txt"><div class="db-hi" lang="hi">सुदर्शनास्त्र</div><div class="db-en">SudarshanAshtra</div><div class="db-tag">Cyber Crime Analysis &amp; Tracking</div></div></div><div class="db-sep" aria-hidden="true"></div><div class="grow db-case"><div class="db-lbl">${esc(AllMode.SC[S.caseId][1])} – Overview</div><h2>${AllMode.SC[S.caseId][0]} ${esc(AllMode.label(S.caseId))} At A Glance</h2><div class="sub2">${S.caseId === '__ncrp' ? 'Complaints on NCRP (1930 / cybercrime.gov.in) with no FIR yet – Acknowledgement No., money reported, on hold and where it went. ₹5 lakh or more needs an FIR (e-Zero FIR).' : S.caseId === '__fir' ? 'FIR cases – CS / CS-PPI / FR, case diary, money, suspects and pending work.' : ''} Click a case to open it.</div><div class="ad-dv-w" style="margin-top:6px">Showing: <b>${esc(this.what())}</b> · change it in the <b>CASE</b> box at the top ↑</div></div><div class="ad-acts"><button class="btn primary" id="adRe">🔄 Refresh</button></div></div><div id="adBody"><div class="muted" style="padding:20px">Reading your cases…</div></div>`;
    $('#adRe', main).onclick = () => { this.C.clear(); this.draw(main); };
    const R = await this.collect((i, t, nm) => { const b = $('#adBody', main); if (b) b.innerHTML = `<div class="muted" style="padding:20px">Reading case ${i} of ${t}: ${esc(nm)}…</div>`; });
    if (!document.body.contains(main) || S.page !== 'dashboard' || !isScope(S.caseId)) return;
    const SC = S.caseId, isN = SC === '__ncrp', isF = SC === '__fir', BIG = 500000;
    const T = R.length, P = R.filter(r => r.pend), CS = R.filter(r => r.fin === 'CS'), PPI = R.filter(r => r.fin === 'PPI'), FR = R.filter(r => r.fin === 'FR'), UI_ = R.filter(r => !r.fin && r.pend);
    const amt = sum(R, r => r.amount || 0), hold = sum(R, r => r.hold || 0), com = this.common(R), FC = R.filter(r => r.cat === 'fir'), NC = R.filter(r => r.cat === 'ncrp'), NEED = NC.filter(r => (r.amount || 0) >= BIG), ACK = uniq(R.flatMap(r => r.acks || []));
    const k = (l, v, h, cls) => [l, v, h, cls];
    const KA = [k('Total Cases', fmtNum(T), `FIR ${FC.length} · NCRP without FIR ${NC.length}`, 'c2'), k('FIR Cases', fmtNum(FC.length), `CS ${CS.length} · CS-PPI ${PPI.length} · FR ${FR.length}`, 'c1'), k('NCRP (Without FIR)', fmtNum(NC.length), NEED.length ? NEED.length + ' need FIR (₹5 lakh +)' : 'Acknowledgement No. only', 'c4'), k('Pending', fmtNum(P.length), `${pct(P.length, T)}% · Under Investigation ${UI_.length} + CS-PPI ${PPI.length}`, 'c5')];
    const KF = [k('Total FIR Cases', fmtNum(T), 'On this computer', 'c2'), k('Pending', fmtNum(P.length), `${pct(P.length, T)}% · Under Investigation ${UI_.length} + CS-PPI ${PPI.length}`, 'c5'), k('CS', fmtNum(CS.length), `Charge Sheet · ${pct(CS.length, T)}%`, 'c1'), k('CS-PPI', fmtNum(PPI.length), `Further inv. pending · ${pct(PPI.length, T)}%`, 'c2'), k('FR', fmtNum(FR.length), `Final Report · ${pct(FR.length, T)}%`, 'c5')];
    const KN = [k('NCRP Cases', fmtNum(T), 'No FIR yet', 'c4'), k('FIR Needed', fmtNum(NEED.length), '₹5 lakh or more – register FIR / e-Zero FIR', 'c5'), k('Acknowledgement Nos', fmtNum(ACK.length), 'Complaints on NCRP portal', 'c2'), k('Transactions', fmtNum(sum(R, r => r.txns || 0)), `Up to layer ${Math.max(0, ...R.map(r => r.layers || 0))} · ${fmtNum(sum(R, r => r.banks || 0))} bank(s)`, 'c3')];
    const KC = [k('Amount Defrauded', fmtINR(amt), `${fmtINR(hold)} on hold / lien`, 'c3'), ...(isN ? [k('On Hold / Lien', fmtINR(hold), `${pct(hold, amt)}% of the amount reported`, 'c1')] : [k('Complaints', fmtNum(sum(R, r => r.comps || 0)), fmtNum(sum(R, r => r.txns || 0)) + ' transactions', 'c4')]),
      k('Mule Accounts', fmtNum(sum(R, r => r.mule || 0)), 'High risk (score ≥ 60)', 'c5'), k('Common Suspects', fmtNum(com.length), 'Found in 2+ cases', 'c6'), k('Pending Work', fmtNum(sum(R, r => r.work || 0)), 'Demands / notices to do', 'c4'), ...(isN ? [] : [k('Replies Pending', fmtNum(sum(R, r => r.ask || 0)), 'From bank, telecom, platforms…', 'c5')]),
      ...(isF ? [k('Case Diary Parts', fmtNum(sum(R, r => r.cd || 0)), R.filter(r => r.cdGap).length ? R.filter(r => r.cdGap).length + ' case(s) with missing CD' : 'CD numbering OK', 'c3')] : [])];
    $('#adBody', main).innerHTML = `<div class="kpis ad-k">${[...(isN ? KN : isF ? KF : KA), ...KC].map(x => `<div class="kpi ${x[3]}"><div class="label">${esc(x[0])}</div><div class="value">${x[1]}</div><div class="hint">${esc(x[2])}</div></div>`).join('')}</div>
      <div class="grid g2">${isN ? `<div class="card"><h3>⚖ FIR Needed – ₹5 Lakh Or More</h3>${NEED.length ? NEED.sort((a, b) => b.amount - a.amount).map(r => `<div class="ad-bar" data-open="${r.id}" title="Open ${esc(r.name)}"><span>${esc(AllMode.caseLabel(r))}</span><i><b style="width:${Math.min(100, r.amount / Math.max(...NEED.map(x => x.amount)) * 100)}%"></b></i><em>${fmtINR(r.amount)}</em></div>`).join('') + '<div class="small muted" style="margin-top:8px">Open the case, then add the FIR No. in Case Details – it moves to FIR Cases.</div>' : '<div class="good-t small">No NCRP case of ₹5 lakh or more.</div>'}</div>` : `<div class="card"><h3>📊 Case Status</h3><div class="ad-stack">${[['CS', CS.length, '#10b981'], ['CS-PPI', PPI.length, '#3b82f6'], ['FR', FR.length, '#ef4444'], ['Under Investigation', UI_.length, '#f59e0b'], ['Other Closed', T - CS.length - PPI.length - FR.length - UI_.length, '#64748b']].filter(x => x[1] > 0).map(([l, n, c]) => `<b style="flex:${n};background:${c}" title="${l}: ${n}">${n}</b>`).join('')}</div>
        <div class="ad-leg">${[['CS', CS.length, '#10b981'], ['CS-PPI', PPI.length, '#3b82f6'], ['FR', FR.length, '#ef4444'], ['Under Investigation', UI_.length, '#f59e0b']].map(([l, n, c]) => `<span><i style="background:${c}"></i>${l} <b>${n}</b> (${pct(n, T)}%)</span>`).join('')}</div>${SC === '__all' ? `<div class="ad-leg" style="margin-top:8px"><span>📁 FIR cases <b>${FC.length}</b></span><span>🧾 NCRP without FIR <b>${NC.length}</b></span>${NEED.length ? `<span class="bad-t">⚖ ${NEED.length} NCRP case(s) ₹5 lakh + need FIR</span>` : ''}</div>` : ''}</div>`}
        <div class="card"><h3>💰 Amount By Case <span class="small muted">(green = on hold)</span></h3>${(() => { const L = R.filter(r => r.amount).sort((a, b) => b.amount - a.amount).slice(0, 8), mx = Math.max(1, ...L.map(r => r.amount)); return L.length ? L.map(r => `<div class="ad-bar" data-open="${r.id}" title="Open ${esc(r.name)}"><span>${esc(AllMode.caseLabel(r))}</span><i style="position:relative"><b style="width:${Math.max(2, r.amount / mx * 100)}%"></b><b class="ad-hold" style="width:${Math.min(r.amount, r.hold || 0) / mx * 100}%"></b></i><em>${fmtINR(r.amount)}</em></div>`).join('') : '<div class="muted small">No amount found yet.</div>'; })()}</div></div>
      <div class="card"><div class="d2-hd"><h3>📋 ${esc(AllMode.SC[SC][1])} – Analysis At A Glance</h3><span class="sub">Click a row to open that case.</span></div><div id="adT"></div></div>
      <div class="card"><div class="d2-hd"><h3>🎯 Common Suspects Across Cases</h3><span class="sub">Mobile, account, UPI, email, IP, IMEI… found in two or more of your cases – the strongest leads to the gang. Click to track.</span></div><div id="adC"></div></div>
      <div class="card"><div class="d2-hd"><h3>⏳ Pending Work Across Cases</h3><span class="sub">What each case is waiting for – oldest pending reply first.</span></div><div id="adP"></div></div>`;
    const stChip = r => r.fin ? `<span class="cc-fin ${({ CS: 'cs', PPI: 'ppi', FR: 'fr' })[r.fin] || 'cs'}">${r.fin === 'PPI' ? 'CS-PPI' : r.fin}${r.finNo ? ' ' + esc(r.finNo) : ''}</span>` : `<span class="cs-st ${r.pend ? 'p' : 'd'}">${esc(r.pend ? 'Under Investigation' : r.status)}</span>`;
    const CD = !isN; const comN = new Map(); com.forEach(g => g.cases.forEach(o => comN.set(o.id, (comN.get(o.id) || 0) + 1)));
    Table($('#adT', main), { rows: R.map(r => ({ ...r, common: comN.get(r.id) || 0 })).sort((a, b) => (b.pend - a.pend) || (b.common - a.common) || (b.amount || 0) - (a.amount || 0)), pageSize: 15, exportName: 'all_cases_analysis', onRow: r => this.open(r.id),
      columns: [{ key: 'name', label: 'Case', render: r => `<b>${esc(r.name)}</b>${r.id === S.caseId ? ' <span class="badge info">open</span>' : ''}<div class="small muted">${esc([r.fir ? 'FIR ' + r.fir : '🧾 NCRP – no FIR', r.ps, r.io && 'IO ' + r.io].filter(Boolean).join(' · '))}</div>${!r.fir && (r.amount || 0) >= BIG ? '<span class="badge bad">⚖ FIR needed</span>' : ''}` },
        { key: 'acks', label: 'Ack Nos', sortVal: r => (r.acks || []).length, render: r => (r.acks || []).length ? `<span class="mono small" title="${esc(r.acks.join(', '))}">${esc(r.acks[0])}${r.acks.length > 1 ? ` <b>+${r.acks.length - 1}</b>` : ''}</span>` : '', csv: r => (r.acks || []).join('; ') },
        { key: 'fin', label: 'Status', render: stChip, csv: r => r.fin || r.status }, ...(isN ? [] : [{ key: 'secs', label: 'Sections', render: r => `<span class="small">${esc(r.secs || r.section || '')}</span>` }]),
        { key: 'amount', label: 'Amount', num: true, render: r => r.amount ? fmtINR(r.amount) : '' }, { key: 'hold', label: 'On Hold', num: true, render: r => r.hold ? `<span class="good-t">${fmtINR(r.hold)}</span>` : '' }, { key: 'layers', label: 'Layers', num: true, render: r => r.layers || '' }, { key: 'comps', label: 'Complaints', num: true }, { key: 'mule', label: 'Mule A/C', num: true, render: r => r.mule ? `<b class="bad-t">${r.mule}</b>` : '0' },
        { key: 'nIds', label: 'Identifiers', num: true }, { key: 'common', label: 'Common Suspects', num: true, render: r => r.common ? `<b class="bad-t">${r.common}</b>` : '0' },
        ...(!CD ? [] : [{ key: 'cd', label: 'CD Parts', num: true, render: r => r.cd ? `${r.cd}${r.cdLast ? ` <span class="small muted">last ${r.cdLast}${r.cdDate ? ' · ' + esc(r.cdDate) : ''}</span>` : ''}` : '0' }, { key: 'cdGap', label: 'Missing CD', render: r => r.cdGap ? `<b class="bad-t">${esc(r.cdGap)}</b>` : '' }]),
        { key: 'work', label: 'Pending Work', num: true, render: r => r.work ? `<b class="bad-t" title="${esc((r.workList || []).join('; '))}">${r.work}</b>` : '0' }, { key: 'ask', label: 'Replies Pending', num: true, render: r => r.ask ? `<b class="bad-t">${r.ask}</b>${r.oldest ? ` <span class="small muted">${r.oldest} d</span>` : ''}` : '' }] });
    if (com.length) Table($('#adC', main), { rows: com, pageSize: 10, exportName: 'common_suspects_all_cases', onRow: g => Dash2.track(g.value),
      columns: [{ key: 'type', label: 'Type', render: g => `<span class="d2-tc">${Dash2.tico ? Dash2.tico(g.type) : ''}<small>${esc((Dash2.TYPE[g.type] || [0, g.type])[1])}</small></span>` }, { key: 'value', label: 'Identifier', render: g => `<b class="mono">${esc(g.value)}</b>` },
        { key: 'n', label: 'Cases', num: true, render: g => `<b class="bad-t">${g.cases.length}</b>`, csv: g => g.cases.length }, { key: 'cases', label: 'Case Number', render: g => g.cases.map(o => `<span class="ad-cn${o.fir ? '' : ' n'}" data-open="${o.id}" title="Open ${esc(o.name)}">${esc(o.fir ? 'FIR ' + o.fir : (o.acks || [])[0] ? '🧾 ' + o.acks[0] : o.name)}</span>`).join(' '), csv: g => g.cases.map(o => o.fir || (o.acks || [])[0] || o.name).join('; ') },
        { key: 'secs', label: 'Found In', render: g => `<span class="small">${esc([...g.secs].join(', '))}</span>`, csv: g => [...g.secs].join(', ') }] });
    else $('#adC', main).innerHTML = `<div class="muted small">${T < 2 ? 'Only one case – nothing to compare yet.' : 'No identifier is common to two cases yet.'}</div>`;
    const PL = R.filter(r => r.pend && (r.work || r.ask || (r.sugg || []).length)).sort((a, b) => (b.oldest || 0) - (a.oldest || 0) || b.work - a.work);
    $('#adP', main).innerHTML = PL.length ? PL.map(r => `<div class="ad-pw" data-open="${r.id}"><div class="ad-pn"><b>${esc(r.name)}</b>${stChip(r)}${r.oldest ? `<span class="bad-t small">oldest reply ${r.oldest} days</span>` : ''}</div><ul>${[...(r.sugg || []), ...(r.workList || [])].slice(0, 4).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('') : '<div class="good-t small">No pending work found.</div>';
    $$('[data-open]', main).forEach(x => x.addEventListener('click', e => { e.stopPropagation(); this.open(x.dataset.open); }));
        const KL = isN ? [['🧾 NCRP cases', R], ['⚖ FIR needed (₹5 lakh +)', NEED]] : isF ? [['📁 FIR cases', R], ['⏳ Pending cases', P], ['📗 CS – Charge Sheet', CS], ['📘 CS-PPI', PPI], ['📕 FR – Final Report', FR]] : [['🗂 All cases', R], ['📁 FIR cases', FC], ['🧾 NCRP without FIR', NC], ['⏳ Pending cases', P]];
    $$('.ad-k .kpi', main).slice(0, KL.length).forEach((el, i) => DashX.bind(el, { title: KL[i][0], rows: () => KL[i][1], cols: [{ key: 'name', label: 'Case' }, { key: 'fir', label: 'FIR / Ack No', fmt: (v, r) => v || (r.acks || []).join(', ') }, { key: 'amount', label: 'Amount', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'io', label: 'IO' }, { key: 'status', label: 'Status' }, { key: 'work', label: 'Pending Work', num: true }], sort: 'name', pv: r => [r.name, r.fin || r.status], onRow: r => this.open(r.id) }));
  }
};
(() => {
  const og = Pages.dashboard;
  Pages.dashboard = function (main) {
    if (isScope(S.caseId)) { AllDash.draw(main); return; }
    const r = og.apply(this, arguments);
    if (S.cases.length > 1) main.insertAdjacentHTML('afterbegin', '<i class="ad-dv" hidden></i>');   // the CASE box at the top is the one place to choose
    return r;
  };
  const sw = switchCase; switchCase = async function (id) { AllDash.C.delete(S.caseId); return sw.apply(this, arguments); };
  const sc = saveCase; saveCase = function () { AllDash.C.delete(S.caseId); return sc.apply(this, arguments); };
  // CS-PPI is still under investigation → counts as pending everywhere
  if (typeof CaseStat !== 'undefined') { const od = CaseStat.done; CaseStat.done = c => CaseStat.fin(c) === 'PPI' ? false : od(c); }
})();
