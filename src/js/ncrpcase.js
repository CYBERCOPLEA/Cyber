/* ncrpcase.js - NCRP "Complaint Analysis": pick one complaint (Acknowledgement No) from the imported data and
   see beneficiaries, IFSC, dates, amounts, nodal / escrow accounts, layer totals and a live flow chart / mind map / network. */
'use strict';

// a "Money Transfer to" row: by the Action column, by a sheet named "Money Transfer to",
// or by any cell of the original row that says "Money Transfer to" (some exports put it in another column)
const _mtCache = new WeakMap();
const isMoneyTransfer = t => {
  if (/money\s*transfer/i.test(t.action || '') || /\[\s*money\s*transfer/i.test(t._src || '')) return true;
  const r = t._raw; if (!r || typeof r !== 'object') return false;
  if (!_mtCache.has(r)) _mtCache.set(r, Object.values(r).some(v => typeof v === 'string' && /^\s*money\s*transfer/i.test(v)));
  return _mtCache.get(r);
};

/* Nodal / pool / escrow / payment-gateway accounts: money passes through, they are not the fraudster's own account */
const ACC_TYPES = [
  ['Nodal / Escrow', /\b(NODAL|ESCROW|POOL(ING)?\s*A\/?C|POOL ACCOUNT|SETTLEMENT|SUSPENSE|CLEARING|SWEEP|PAYOUT|COLLECTION\s*(A\/?C|ACCOUNT)|VIRTUAL\s*A\/?C|TRUST\s*A\/?C|CURRENT\s*A\/?C\s*NODAL)\b/],
  ['Payment gateway', /\b(RAZORPAY|PAYU|CASHFREE|BILLDESK|CCAVENUE|PAYTM PAYMENTS|PHONEPE|EASEBUZZ|INSTAMOJO|PINE ?LABS|JUSPAY|MOBIKWIK|AIRPAY|ATOM TECH|PAYMENT GATEWAY|AGGREGATOR|BHARATPE|OPEN FINANCIAL|DECENTRO|M2P|YAP|SETU)\b/],
  ['Wallet', /\b(WALLET|PPI|AMAZON PAY|FREECHARGE|OLA MONEY|JIOMONEY|AIRTEL MONEY)\b/],
  ['Merchant', /\b(MERCHANT|P2M|POS|ECOM|E-COM|STORE|ENTERPRISES?|TRADERS?|PVT\.? ?LTD|PRIVATE LIMITED|LLP)\b/]
];
function accType(id, info) {
  if (/^CASH-OUT/.test(id)) return 'Cash-out / ATM';
  if (/^VICTIM:/.test(id)) return 'Victim';
  const txt = [...(info?.names || []), ...(info?.actions || []), ...(info?.remarks || [])].join(' ').toUpperCase();
  for (const [t, rx] of ACC_TYPES) if (rx.test(txt)) return t;
  return '';
}
const typeBadge = t => !t ? '' : `<span class="badge ${/Nodal|gateway|Wallet/.test(t) ? 'warn' : /Cash/.test(t) ? 'bad' : ''}">${esc(t)}</span>`;


/* Mule-behaviour flags
   Bulk split  = account received money and sent it on to many different accounts
   Rapid       = account sent money onward within a few minutes of receiving it */
const Flags = {
  rule() { if (!S.settings.flagRule) S.settings.flagRule = { fan: 5, mins: 60 }; return S.settings.flagRule; },
  when(d) { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/); if (!m) return null; return { t: Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)), time: !!m[4], day: m[1] + m[2] + m[3] }; },
  fmtGap(r) { if (r.gap == null) return r.sameDay ? 'same day (no time in data)' : ''; const g = r.gap; return g < 60 ? g + ' min' : g < 1440 ? Math.floor(g / 60) + ' h ' + (g % 60) + ' min' : Math.floor(g / 1440) + ' d ' + Math.floor(g % 1440 / 60) + ' h'; },
  compute(txns, key = 'all') {
    return Analysis.cached('flags:' + key + ':' + JSON.stringify(this.rule()), () => {
      const R = this.rule(), M = new Map();
      const get = (acc, t, side) => {
        if (!M.has(acc)) M.set(acc, { acc, names: new Set(), banks: new Set(), ifscs: new Set(), acks: new Set(), ins: [], outs: [], receivers: new Set(), inAmt: 0, outAmt: 0, layer: 0 });
        const a = M.get(acc);
        if (side === 'in') { if (t.to_name) a.names.add(t.to_name); if (t.to_bank) a.banks.add(t.to_bank); if (t.to_ifsc) a.ifscs.add(t.to_ifsc); if (t.layer) a.layer = a.layer ? Math.min(a.layer, t.layer) : t.layer; }
        else { if (t.from_name) a.names.add(t.from_name); if (t.from_bank) a.banks.add(t.from_bank); if (t.from_ifsc) a.ifscs.add(t.from_ifsc); }
        if (t.ack_no) a.acks.add(t.ack_no); return a;
      };
      for (const t of txns) {
        if (t.holdOnly) continue; const amt = Math.abs(t.amount || 0);
        if (t.to_acc && !isSynthetic(t.to_acc)) { const a = get(t.to_acc, t, 'in'); a.ins.push(t); a.inAmt += amt; }
        if (t.from_acc && !isSynthetic(t.from_acc) && !t.from_acc.startsWith('VICTIM:')) { const a = get(t.from_acc, t, 'out'); a.outs.push(t); a.outAmt += amt; if (t.to_acc) a.receivers.add(t.to_acc); }
      }
      const rows = [];
      for (const a of M.values()) {
        if (!a.ins.length || !a.outs.length) continue;      // must both receive and send
        let best = null, sameDay = false;
        const ins = a.ins.map(t => ({ t, w: this.when(t.date) })).filter(x => x.w).sort((x, y) => x.w.t - y.w.t);
        for (const o of a.outs) {
          const wo = this.when(o.date); if (!wo) continue;
          let src = null; for (const i of ins) { if (i.w.t <= wo.t) src = i; else break; }
          if (!src) continue;
          if (wo.time && src.w.time) { const g = Math.round((wo.t - src.w.t) / 60000); if (!best || g < best.gap) best = { gap: g, inT: src.t, outT: o }; }
          else if (wo.day === src.w.day) sameDay = true;
        }
        // biggest burst: different accounts paid within 60 minutes
        const outsW = a.outs.map(t => ({ t, w: this.when(t.date) })).filter(x => x.w && x.w.time).sort((x, y) => x.w.t - y.w.t);
        let burst = 0; for (let i = 0, j = 0; i < outsW.length; i++) { while (outsW[i].w.t - outsW[j].w.t > 3600000) j++; burst = Math.max(burst, new Set(outsW.slice(j, i + 1).map(x => x.t.to_acc)).size); }
        const bulk = a.receivers.size >= R.fan, rapid = best != null && best.gap <= R.mins;
        rows.push({ acc: a.acc, name: [...a.names].join(' / '), bank: [...a.banks].join(' / '), ifsc: [...a.ifscs].join(' / '), layer: a.layer, acks: a.acks.size, ackList: [...a.acks].slice(0, 6).join(', '),
          inCnt: a.ins.length, inAmt: a.inAmt, outCnt: a.outs.length, outAmt: a.outAmt, receivers: a.receivers.size, burst, pct: a.inAmt ? Math.round(100 * a.outAmt / a.inAmt) : 0,
          gap: best ? best.gap : null, sameDay: !best && sameDay, inAt: best ? best.inT.date : '', inAmt1: best ? Math.abs(best.inT.amount || 0) : 0, outAt: best ? best.outT.date : '', outAmt1: best ? Math.abs(best.outT.amount || 0) : 0, outTo: best ? best.outT.to_acc : '',
          bulk, rapid, flags: [bulk && 'Bulk split', rapid && 'Rapid pass-through'].filter(Boolean).join(', ') });
      }
      return rows;
    });
  },
  badges(r) { return (r.bulk ? `<span class="badge bad" title="Sent to ${r.receivers} different accounts">Bulk split · ${r.receivers}</span> ` : '') + (r.rapid ? `<span class="badge bad" title="Forwarded ${this.fmtGap(r)} after receiving">Rapid · ${this.fmtGap(r)}</span>` : ''); },
  columns() {
    return [
      { key: 'flags', label: 'Flag', render: r => this.badges(r) || '<span class="muted small">–</span>' },
      { key: 'acc', label: 'Account', render: r => accLink(r.acc) + (r.name ? `<div class="small muted">${esc(r.name)}</div>` : '') },
      { key: 'bank', label: 'Bank / IFSC', render: r => `${esc(r.bank)}<div class="small mono">${esc(r.ifsc)}</div>` }, { key: 'layer', label: 'Layer', num: true },
      { key: 'inAmt', label: 'Received', num: true, render: r => fmtINR(r.inAmt) + `<div class="small muted">${r.inCnt} txn</div>` },
      { key: 'receivers', label: 'Sent to (accounts)', num: true, render: r => `<b>${r.receivers}</b>${r.burst > 1 ? `<div class="small muted">${r.burst} within 1 hour</div>` : ''}` },
      { key: 'outAmt', label: 'Sent onward', num: true, render: r => fmtINR(r.outAmt) + `<div class="small muted">${r.outCnt} txn · ${r.pct}%</div>` },
      { key: 'gap', label: 'Fastest forward', num: true, sortVal: r => r.gap ?? (r.sameDay ? 100000 : null), render: r => r.gap != null ? `<b>${esc(this.fmtGap(r))}</b><div class="small muted">in ${esc(String(r.inAt).slice(5, 16))} ${fmtINR(r.inAmt1)} → out ${esc(String(r.outAt).slice(11, 16) || String(r.outAt).slice(5, 10))} ${fmtINR(r.outAmt1)}</div>` : `<span class="small muted">${esc(this.fmtGap(r))}</span>` },
      { key: 'acks', label: 'Complaints', num: true, render: r => r.acks > 1 ? `<span class="badge bad" title="${esc(r.ackList)}">${r.acks}</span>` : r.acks }];
  },
  ruleBar(id) {
    const R = this.rule();
    return `<div class="row" style="flex-wrap:wrap"><label>Bulk split = sent to at least</label><input type="number" id="${id}F" min="2" value="${R.fan}" style="width:64px"><label>accounts</label>
      <label style="margin-left:14px">Rapid = sent onward within</label><input type="number" id="${id}M" min="1" value="${R.mins}" style="width:74px"><label>minutes of receiving</label>
      <label style="margin-left:14px"><input type="checkbox" id="${id}O" ${S.flagOnly !== false ? 'checked' : ''}> only flagged accounts</label></div>`;
  },
  /* flagged-accounts table with filters, a Search button and row selection */
  table(host, rows, o) {
    const FF = S.flagF || (S.flagF = {}), SS = S.flagSel || (S.flagSel = {});
    const F = FF[o.id] || (FF[o.id] = { flag: '', bank: '', layer: '', minIn: '', minRecv: '', maxGap: '', q: '' });
    if (!SS[o.id] || SS[o.id].key !== o.key) SS[o.id] = { key: o.key, set: new Set() };
    const sel = SS[o.id].set;
    const banks = uniq(rows.flatMap(r => String(r.bank || '').split(' / ')).filter(Boolean)).sort();
    const layers = uniq(rows.map(r => r.layer).filter(Boolean)).sort((a, b) => a - b);
    const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
    host.innerHTML = `<div class="flagbar">
        <div class="f"><label>Flag</label><select data-f="flag">${[['', 'All rows'], ['any', 'Any flag'], ['bulk', 'Bulk split'], ['rapid', 'Rapid'], ['both', 'Both (bulk + rapid)']].map(([v, l]) => opt(v, l, F.flag)).join('')}</select></div>
        <div class="f"><label>Bank</label><select data-f="bank">${opt('', 'All banks (' + banks.length + ')', F.bank)}${banks.map(b => opt(b, b, F.bank)).join('')}</select></div>
        <div class="f"><label>Layer</label><select data-f="layer">${opt('', 'All layers', F.layer)}${layers.map(l => opt(l, 'Layer ' + l, F.layer)).join('')}</select></div>
        <div class="f"><label>Received at least ₹</label><input data-f="minIn" type="number" min="0" value="${esc(F.minIn)}" placeholder="e.g. 100000"></div>
        <div class="f"><label>Sent to at least (accounts)</label><input data-f="minRecv" type="number" min="0" value="${esc(F.minRecv)}" placeholder="e.g. 10"></div>
        <div class="f"><label>Forwarded within (min)</label><input data-f="maxGap" type="number" min="0" value="${esc(F.maxGap)}" placeholder="e.g. 30"></div>
        <div class="f grow"><label>Account / name / IFSC</label><input data-f="q" type="search" value="${esc(F.q)}" placeholder="type and press Search"></div>
        <div class="f"><label>&nbsp;</label><div class="row" style="gap:6px"><button class="btn srch" data-a="go">🔍 Search</button><button class="btn rst" data-a="reset">Reset</button></div></div>
      </div>
      <div class="selbar"><span data-a="cnt"></span><span data-a="found" class="muted small"></span><span class="spacer"></span>
        <button class="btn sm" data-a="all">☑ Select all found</button><button class="btn sm" data-a="none">Clear selection</button>
        ${o.onShow ? '<button class="btn sm primary" data-a="show">Show selected on chart</button>' : ''}<button class="btn sm" data-a="csv">⬇ CSV of selected</button><button class="btn sm" data-a="copy">Copy account numbers</button></div>
      <div data-a="tbl"></div>`;
    const q = k => host.querySelector(`[data-a="${k}"]`);
    let found = rows;
    const cnt = () => { q('cnt').innerHTML = `<b>${sel.size}</b> selected`; q('found').textContent = ` · ${fmtNum(found.length)} of ${fmtNum(rows.length)} accounts match`; };
    const selCol = { key: '_sel', label: '✓', nosort: true, render: r => `<input type="checkbox" class="fsel" data-acc="${esc(r.acc)}" ${sel.has(r.acc) ? 'checked' : ''} title="Select">` };
    const run = () => {
      $$('[data-f]', host).forEach(i => F[i.dataset.f] = i.value.trim());
      const t = F.q.toLowerCase(), minIn = +F.minIn || 0, minRecv = +F.minRecv || 0, maxGap = F.maxGap === '' ? null : +F.maxGap;
      found = rows.filter(r => (!F.flag || (F.flag === 'any' ? r.bulk || r.rapid : F.flag === 'both' ? r.bulk && r.rapid : r[F.flag]))
        && (!F.bank || String(r.bank).split(' / ').includes(F.bank)) && (!F.layer || String(r.layer) === F.layer)
        && r.inAmt >= minIn && r.receivers >= minRecv && (maxGap == null || (r.gap != null && r.gap <= maxGap))
        && (!t || [r.acc, r.name, r.ifsc, r.bank].some(v => String(v || '').toLowerCase().includes(t))));
      Table(q('tbl'), { rows: found, pageSize: o.pageSize || 25, exportName: o.exportName, sortKey: 'receivers', sortDir: -1, columns: [selCol, ...Flags.columns()], onRow: o.onRow,
        after: c => { bindAccLinks(c); $$('.fsel', c).forEach(cb => cb.onclick = e => { e.stopPropagation(); cb.checked ? sel.add(cb.dataset.acc) : sel.delete(cb.dataset.acc); cnt(); }); } });
      cnt();
    };
    q('go').onclick = run;
    $$('[data-f]', host).forEach(i => { i.onkeydown = e => { if (e.key === 'Enter') run(); }; if (i.tagName === 'SELECT') i.onchange = run; });
    q('reset').onclick = () => { Object.keys(F).forEach(k => F[k] = ''); $$('[data-f]', host).forEach(i => i.value = ''); run(); };
    q('all').onclick = () => { found.forEach(r => sel.add(r.acc)); run(); };
    q('none').onclick = () => { sel.clear(); run(); };
    const picked = () => rows.filter(r => sel.has(r.acc));
    const need = () => { if (!sel.size) { UI.toast('Tick one or more accounts first'); return false; } return true; };
    if (o.onShow) q('show').onclick = () => need() && o.onShow([...sel]);
    q('csv').onclick = () => need() && UI.download((o.exportName || 'flagged') + '_selected.csv', UI.toCSV([{ key: 'flags', label: 'Flag' }, { key: 'acc', label: 'Account' }, { key: 'name', label: 'Name' }, { key: 'bank', label: 'Bank' }, { key: 'ifsc', label: 'IFSC' }, { key: 'layer', label: 'Layer' }, { key: 'inAmt', label: 'Received' }, { key: 'inCnt', label: 'Txns in' }, { key: 'receivers', label: 'Sent to (accounts)' }, { key: 'outAmt', label: 'Sent onward' }, { key: 'gap', label: 'Fastest forward (min)' }, { key: 'inAt', label: 'Received at' }, { key: 'outAt', label: 'Forwarded at' }, { key: 'ackList', label: 'Complaints' }], picked()), 'text/csv');
    q('copy').onclick = () => { if (!need()) return; const txt = picked().map(r => r.acc + (r.ifsc ? '\t' + r.ifsc : '') + (r.bank ? '\t' + r.bank : '')).join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => UI.toast(sel.size + ' account numbers copied'), () => UI.drawer('Selected accounts', `<textarea style="width:100%;height:60vh" class="mono">${esc(txt)}</textarea>`)); };
    run();
  },
  bindRule(el, id, redraw) {
    const upd = async () => { const R = this.rule(); R.fan = Math.max(2, +$('#' + id + 'F', el).value || 5); R.mins = Math.max(1, +$('#' + id + 'M', el).value || 60); S.flagOnly = $('#' + id + 'O', el).checked; await DB.set('settings', S.settings); redraw(); };
    ['F', 'M', 'O'].forEach(k => $('#' + id + k, el).onchange = upd);
  }
};

/* Analytics → Bulk split & rapid (all complaints together) */
AnaTabs.flags = el => {
  const all = Flags.compute(S.data.txns), rows = S.flagOnly === false ? all : all.filter(r => r.bulk || r.rapid);
  el.innerHTML = UI.kpis([['Bulk-split accounts', all.filter(r => r.bulk).length, 'one in → many out', 'c2'], ['Rapid pass-through', all.filter(r => r.rapid).length, 'forwarded within ' + Flags.rule().mins + ' min', 'c3'], ['Both flags', all.filter(r => r.bulk && r.rapid).length, 'strong mule pattern', 'c6'], ['Accounts checked', all.length, 'received and sent money']]) +
    `<div class="card"><h3>Accounts that receive money and pass it on – in bulk or in minutes</h3><div class="sub">Typical of mule / layering accounts. Fastest forward = shortest time between money coming in and the next money going out. Click a row to see its full money trail.</div>${Flags.ruleBar('fl')}<div id="flT" style="margin-top:10px"></div></div>`;
  Flags.bindRule(el, 'fl', () => AnaTabs.flags(el));
  Flags.table($('#flT', el), rows, { id: 'fl', key: 'all', pageSize: 50, exportName: 'bulk_split_rapid_accounts', onRow: r => openTrail({ node: r.acc }) });
};

const NcrpCase = {
  data(ack) {
    return Analysis.cached('ncrpCase:' + ack + ':' + JSON.stringify(Flags.rule()), () => {
      const rows = S.data.txns.filter(t => t.ack_no === ack);
      const B = Trail.build(ack);
      const info = new Map(); for (const col of B.cols.values()) for (const n of col) info.set(n.id, n);
      for (const t of rows) { const n = info.get(t.to_acc); if (n && t.remarks) (n.remarks = n.remarks || new Set()).add(String(t.remarks).slice(0, 120)); }
      const layerOf = t => t.layer || B.L.get(t.to_acc || 'UNIDENTIFIED') || 0;
      const txns = rows.map(t => {
        const n = info.get(t.to_acc);
        return { ...t, _layer: layerOf(t), _type: accType(t.to_acc || '', n), _bank: t.to_bank || (n && [...n.banks][0]) || '', _ifsc: t.to_ifsc || (n && [...n.ifscs][0]) || '', _name: t.to_name || (n && [...n.names][0]) || '', _amt: Math.abs(t.amount || 0) };
      });
      const moved = txns.filter(t => !t.holdOnly);
      const layers = [...groupBy(moved, t => t._layer)].sort((a, b) => a[0] - b[0]).map(([l, list]) => {
        const ds = list.map(t => t.date).filter(Boolean).sort();
        return { layer: l, txns: list.length, accounts: uniq(list.map(t => t.to_acc).filter(a => a && !isSynthetic(a))).length, amount: sum(list, t => t._amt), hold: sum(txns.filter(t => t._layer === l), t => Math.abs(t.hold || 0)), first: ds[0] || '', last: ds[ds.length - 1] || '' };
      });
      const { A } = Analysis.fin();
      const bens = [...info.values()].filter(n => !n.id.startsWith('VICTIM:')).map(n => {
        const ds = n.dates.slice().sort(), a = A.get(n.id) || {};
        return { acc: n.id, name: [...n.names].join(' / '), bank: [...n.banks].join(' / '), ifsc: [...n.ifscs].join(' / '), layer: B.L.get(n.id) || 0, inAmt: n.inAmt, outAmt: n.outAmt, hold: n.hold, cash: n.cash, txns: moved.filter(t => t.to_acc === n.id).length, first: ds[0] || '', last: ds[ds.length - 1] || '', type: accType(n.id, n), score: a.score || 0, complaints: (a.acks && a.acks.size) || 0 };
      });
      const flags = Flags.compute(rows, ack), FL = new Map(flags.map(f => [f.acc, f]));
      bens.forEach(b => { b.fl = FL.get(b.acc) || null; b.flags = b.fl ? b.fl.flags : ''; });
      const c = Trail.complaints().find(x => x.ack === ack) || {};
      return { ack, c, B, info, txns, moved, layers, bens, total: sum(moved, t => t._amt), l1: sum(moved.filter(t => t._layer === 1), t => t._amt), hold: sum(txns, t => Math.abs(t.hold || 0)), cash: sum(moved.filter(t => /^CASH-OUT/.test(t.to_acc || '')), t => t._amt), nodal: bens.filter(b => /Nodal|gateway|Wallet/.test(b.type)), flags, FL };
    });
  },

  graphData(D) {
    const { A } = Analysis.fin();
    let nodes = [...D.info.values()].map(n => {
      const id = n.id, t = accType(id, n), a = A.get(id) || {};
      const L0 = (D.B.L.get(id) || 0) === 0 && n.inAmt === 0;
      const f = D.FL.get(id), flagged = f && (f.bulk || f.rapid);
      const kind = id.startsWith('VICTIM:') || L0 ? 'victim' : /^CASH-OUT/.test(id) ? 'cash' : /Nodal|gateway|Wallet/.test(t) ? 'nodal' : n.hold > 0 ? 'hold' : (a.score >= 60 || flagged) ? 'risk' : 'account';
      const lay = D.B.L.get(id) || 0;
      return { id, label: id.startsWith('VICTIM:') ? 'Victim' : L0 ? 'Victim ' + accLabel(id) : accLabel(id), sub: [[...n.names][0], [...n.banks][0]].filter(Boolean).join(' · '),
        det: [[...n.ifscs][0], lay ? 'L' + lay : 'Victim', n.inAmt ? fmtINR(n.inAmt) : n.outAmt ? 'sent ' + fmtINR(n.outAmt) : ''].filter(Boolean).join(' · '), kind, value: Math.max(n.inAmt, n.outAmt), layer: D.B.L.get(id) || 0,
        title: `${id.startsWith('VICTIM:') ? 'Victim of ' + D.ack : accLabel(id)}\n${[...n.names].join(' / ')}\n${[...n.banks].join(' / ')} ${[...n.ifscs].join(' / ')}\nLayer ${D.B.L.get(id) || 0} · received ${fmtINR(n.inAmt)} · sent ${fmtINR(n.outAmt)}${n.hold ? ' · hold ' + fmtINR(n.hold) : ''}${t ? '\n' + t : ''}${flagged ? '\n⚑ ' + f.flags + (f.bulk ? ' – sent to ' + f.receivers + ' accounts' : '') + (f.rapid ? ' – forwarded in ' + Flags.fmtGap(f) : '') : ''}`, badge: flagged ? (f.bulk && f.rapid ? 'BR' : f.bulk ? 'B' : 'R') : '' };
    });
    let edges = D.B.links.map(e => ({ from: e.from, to: e.to, amount: e.amount, count: e.txns.length, txns: e.txns, tag: [D.B.L.get(e.from) || 0, D.B.L.get(e.to) || 0].map(l => l ? 'L' + l : 'Victim').join('→') }));
    // "Money Transfer to" rows only (the action column, or a sheet with that name)
    const mtAll = D.moved.filter(isMoneyTransfer).length;
    if (mtAll && S.ncrpG.mt !== false) {
      edges = edges.map(e => { const tx = (e.txns || []).filter(isMoneyTransfer); return tx.length === e.txns.length ? e : { ...e, txns: tx, count: tx.length, amount: sum(tx, t => t._amt ?? Math.abs(t.amount || 0)) }; }).filter(e => e.count);
      const used = new Set(edges.flatMap(e => [e.from, e.to]));
      nodes = nodes.filter(n => used.has(n.id));
    }
    const total = nodes.length;
    return { nodes, edges, total, mtAll };
  },

  /* what the chart shows: every account up to `depth` steps from the victim, plus the accounts
     paid by any account the officer opened (+). Nothing in between is ever left out, so the
     trail is always connected from the victim. */
  view(full, depth, open) {
    const { nodes, edges } = full, out = new Map(), inc = new Map();
    edges.forEach(e => { if (e.from === e.to) return; (out.get(e.from) || out.set(e.from, []).get(e.from)).push(e); (inc.get(e.to) || inc.set(e.to, []).get(e.to)).push(e); });
    const hop = new Map(), q = [];
    nodes.filter(n => n.kind === 'victim' || !inc.has(n.id)).forEach(n => { hop.set(n.id, 0); q.push(n.id); });
    while (q.length) { const id = q.shift(); for (const e of out.get(id) || []) if (!hop.has(e.to)) { hop.set(e.to, hop.get(id) + 1); q.push(e.to); } }
    nodes.forEach(n => { if (!hop.has(n.id)) hop.set(n.id, Math.max(1, n.layer || 1)); });
    const parent = new Map();
    for (const [to, list] of inc) { let best = null; for (const e of list) if (hop.get(e.from) < hop.get(to) && (!best || e.amount > best.amount)) best = e; if (best) parent.set(to, best.from); }
    const maxHop = Math.max(0, ...hop.values());
    const vis = new Set(nodes.filter(n => hop.get(n.id) <= depth).map(n => n.id));
    let grew = true; while (grew) { grew = false; for (const id of open) if (vis.has(id)) for (const e of out.get(id) || []) if (!vis.has(e.to)) { vis.add(e.to); grew = true; } }
    const ns = nodes.filter(n => vis.has(n.id)).map(n => {
      const hidden = new Set((out.get(n.id) || []).filter(e => !vis.has(e.to)).map(e => e.to));
      return { ...n, more: hidden.size, collapse: !hidden.size && open.has(n.id) && hop.get(n.id) >= depth && (out.get(n.id) || []).length > 0 };
    });
    return { nodes: ns, edges: edges.filter(e => vis.has(e.from) && vis.has(e.to)), hop, parent, maxHop, out };
  },

  render(el) {
    const files = NcrpData.files(); if (S.ncrpSrc && !files.includes(S.ncrpSrc)) S.ncrpSrc = '';
    const _pick = S.ncrpPick; S.ncrpPick = ''; const list = NcrpData.list().slice().sort((a, b) => (b.amount || 0) - (a.amount || 0)); S.ncrpPick = _pick;
    if (!list.length && S.ncrpSrc) { S.ncrpSrc = ''; return NcrpTabs.case(el); }
    if (!list.length) { el.innerHTML = UI.empty('No complaints found yet. Import the NCRP money trail / bank action sheet (it must have an <b>Acknowledgement No</b> column) or an NCRP complaint export.', '<button class="btn primary" onclick="openImport([\'txn\',\'ncrp\'], render)">⬆ Import</button>'); return; }
    if (!list.some(c => c.ack === S.ncrpAck)) S.ncrpAck = (list.find(c => c.txns) || list[0]).ack;
    const ack = S.ncrpAck, D = this.data(ack), c = D.c, idx = list.findIndex(x => x.ack === ack);
    const go2 = a => { S.ncrpAck = a; NcrpTabs.case(el); };
    const srcs = uniq(D.txns.map(t => t._src).filter(Boolean));
    // default: the complete trail, so every layer stays linked (L1 → L2 → L3 …); very big cases start with "Auto"
    const depthNow = S.ncrpG.depth == null ? (D.info.size <= 1500 ? 99 : 0) : +S.ncrpG.depth;
    el.innerHTML = `
      <div class="card hero-card" style="padding:16px 18px"><div class="row" style="gap:10px;flex-wrap:wrap">
        <label style="font-weight:700">Data file</label><select id="ncSrc" style="max-width:220px"><option value="">All files (${files.length})</option>${files.map(f => `<option ${f === S.ncrpSrc ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>
        <label style="font-weight:700">Complaint (Acknowledgement No)</label>
        <select id="ncSel" style="min-width:330px">${list.map(x => `<option value="${esc(x.ack)}" ${x.ack === ack ? 'selected' : ''}>${esc(x.ack)} · ${fmtINR(x.amount || 0)} · ${x.layers || 0} layers · ${x.txns} txns${x.victim ? ' · ' + esc(x.victim) : ''}</option>`).join('')}</select>
        <input id="ncFind" list="ncAcks" placeholder="Type Ack No…" style="width:190px"><datalist id="ncAcks">${list.map(x => `<option value="${esc(x.ack)}">`).join('')}</datalist>
        <button class="btn sm" id="ncPrev" ${idx <= 0 ? 'disabled' : ''}>‹ Prev</button><button class="btn sm" id="ncNext" ${idx >= list.length - 1 ? 'disabled' : ''}>Next ›</button>
        <span class="spacer"></span><span class="small muted">${idx + 1} of ${list.length} complaints (sorted by amount, highest first)</span></div>
        <div class="small muted" style="margin-top:8px">${[c.victim && 'Victim: <b>' + esc(c.victim) + '</b>', c.district && 'District: ' + esc(c.district), c.category && 'Category: ' + esc(c.category), c.date && 'First txn / complaint date: ' + esc(c.date), srcs.length && 'From file: ' + esc(srcs.slice(0, 3).join(', ')) + (srcs.length > 3 ? ' …' : '')].filter(Boolean).join(' · ')}</div></div>
      ${UI.kpis([
        ['Disputed amount', fmtINR(c.reported ?? D.l1), c.reported != null ? 'as reported in NCRP' : 'Layer 1 total', 'c2'],
        ['Total txn amount', fmtINR(D.total), 'all layers added', 'c3'],
        ['Layers', D.layers.filter(l => l.layer > 0).length || 0, 'deepest: Layer ' + Math.max(0, ...D.layers.map(l => l.layer))],
        ['Beneficiary accounts', fmtNum(D.bens.filter(b => !isSynthetic(b.acc)).length), fmtNum(D.moved.length) + ' transactions'],
        ['On hold', fmtINR(D.hold), D.total ? (100 * D.hold / Math.max(1, c.reported ?? D.l1)).toFixed(1) + '% of disputed' : '', 'c4'],
        ['Cash / ATM withdrawn', fmtINR(D.cash), '', 'c5'],
        ['Bulk-split accounts', D.flags.filter(f => f.bulk).length, 'sent to ' + Flags.rule().fan + '+ accounts', 'c2'],
        ['Rapid pass-through', D.flags.filter(f => f.rapid).length, 'forwarded within ' + Flags.rule().mins + ' min', 'c3'],
        ['Nodal / escrow / PG', D.nodal.length, D.nodal.length ? 'check before freezing' : 'none found', 'c6']]).replace('class="kpis"', 'class="kpis kpis-c"')}
      <div class="grid g2">
        <div class="card"><h3>Layer-wise money trail</h3><div class="sub">Money moved at each layer. Total row = all layers together.</div><div id="ncL"></div></div>
        <div class="card"><h3>Amount per layer</h3><div id="ncLc"></div>${D.nodal.length ? `<div class="note warn" style="margin-top:12px"><b>${D.nodal.length} nodal / escrow / payment-gateway account(s)</b> in this trail: ${D.nodal.slice(0, 4).map(b => `<span class="mono">${esc(b.acc)}</span> (${esc(b.type)})`).join(', ')}${D.nodal.length > 4 ? ' …' : ''}. Money passes through these – ask the bank / PG for the onward merchant or sub-account instead of freezing the whole pool.</div>` : ''}</div></div>
      <div class="card"><h3>⚑ Flagged accounts – bulk split &amp; rapid pass-through</h3><div class="sub">Accounts in this complaint that received money and sent it on to many accounts (bulk split, <b>B</b> on the chart) or within minutes (rapid, <b>R</b>). Use the filters and <b>Search</b> to narrow the list. Tick accounts to show them together on the chart, download them or copy their numbers. Click a row to show its trail on the chart.</div>${Flags.ruleBar('ncf')}<div id="ncF" style="margin-top:10px"></div></div>
      <div class="card"><div class="row" style="flex-wrap:wrap">
        <h3 class="grow" style="margin:0">Money trail chart</h3>
        <span class="pill-group">${[['flow', 'Flow chart'], ['mind', 'Mind map'], ['net', 'Graph']].map(([k, l]) => `<button data-gm="${k}" class="${S.ncrpG.mode === k ? 'active' : ''}">${l}</button>`).join('')}</span>
        ${D.moved.some(isMoneyTransfer) ? `<label class="small">Rows</label><select id="ncMt"><option value="1" ${S.ncrpG.mt !== false ? 'selected' : ''}>Money Transfer to only</option><option value="0" ${S.ncrpG.mt === false ? 'selected' : ''}>All rows (with ATM, hold…)</option></select>` : ''}
        <label class="small">Show</label><select id="ncDepth">${[[0, 'Auto (fits screen)'], [1, 'Layer 1'], [2, 'Up to Layer 2'], [3, 'Up to Layer 3'], [4, 'Up to Layer 4'], [6, 'Up to Layer 6'], [99, 'Complete trail (all – big cases take a few seconds)']].map(([v, l]) => `<option value="${v}" ${depthNow === v ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="small muted" id="ncTopInfo"></span>
        <button class="btn sm" id="ncReplay">▶ Play whole trail</button><button class="btn sm" id="ncSvg">⬇ SVG</button><button class="btn sm" id="ncPng">⬇ PNG</button></div>
        <div class="sub" style="margin-top:6px">Lines move from sender to receiver (⚡ switches it off). Each line shows amount, layer (L1→L2) and date (₹ button changes labels). Point at a line to highlight it. Click a line to trace that transaction from the victim to the end. Click an account to trace the money from the victim to that account. Click <b>+N</b> on an account to open the accounts it paid (<b>−</b> closes them). Drag accounts or a "Layer" title to make space.</div>
        <div class="graph-box" id="ncBox" style="height:640px"></div></div>
      <div class="card"><h3>Transactions of this complaint</h3><div class="sub">Sorted by amount, maximum to minimum (use Sort / A→Z / Z→A or click a column title to change). Click a row to show it on the chart.</div>
        <div class="row" style="margin-bottom:8px"><label>Layer</label><select id="ncLay"><option value="">All layers</option>${D.layers.map(l => `<option value="${l.layer}" ${String(S.ncrpLay) === String(l.layer) ? 'selected' : ''}>${l.layer === 0 ? 'Victim / no layer' : 'Layer ' + l.layer} (${l.txns})</option>`).join('')}</select>
        <label><input type="checkbox" id="ncHold" ${S.ncrpHold ? 'checked' : ''}> show hold-only rows</label></div><div id="ncT"></div></div>
      <div class="card"><h3>Beneficiary accounts</h3><div class="sub">Every account that received money in this complaint, with IFSC, bank, layer, amounts and type. Sorted by amount received, highest first.</div><div id="ncB"></div></div>`;

    $('#ncSel', el).onchange = e => go2(e.target.value);
    $('#ncSrc', el).onchange = e => { S.ncrpSrc = e.target.value; S.ncrpAck = ''; NcrpTabs.case(el); };
    $('#ncFind', el).onchange = e => { const v = N.ack(e.target.value); if (list.some(x => x.ack === v)) go2(v); else UI.toast('Ack No not found'); };
    $('#ncPrev', el).onclick = () => go2(list[idx - 1].ack); $('#ncNext', el).onclick = () => go2(list[idx + 1].ack);

    // layer table + chart
    const lrows = D.layers.map(l => ({ ...l, name: l.layer === 0 ? 'Victim / no layer' : 'Layer ' + l.layer }));
    lrows.push({ name: 'TOTAL', txns: sum(D.layers, l => l.txns), accounts: D.bens.filter(b => !isSynthetic(b.acc)).length, amount: D.total, hold: D.hold, first: D.layers.map(l => l.first).filter(Boolean).sort()[0] || '', last: D.layers.map(l => l.last).filter(Boolean).sort().pop() || '', _tot: true });
    $('#ncL', el).innerHTML = `<div class="tbl-wrap"><table class="tbl"><tr><th>Layer</th><th class="num">Txns</th><th class="num">Accounts</th><th class="num">Txn amount</th><th class="num">On hold</th><th>First – last date</th></tr>
      ${lrows.map(r => `<tr class="${r._tot ? '' : 'clickable'}" ${r._tot ? 'style="font-weight:700;border-top:2px solid var(--border)"' : `data-lay="${r.layer}"`}><td style="white-space:nowrap">${esc(r.name)}</td><td class="num">${fmtNum(r.txns)}</td><td class="num">${fmtNum(r.accounts)}</td><td class="num">${fmtINR(r.amount)}</td><td class="num" style="white-space:nowrap">${r.hold ? fmtINR(r.hold) : ''}</td><td class="small">${esc(String(r.first).slice(0, 16))}${r.last && r.last !== r.first ? ' – ' + esc(String(r.last).slice(0, 16)) : ''}</td></tr>`).join('')}</table></div>`;
    $$('[data-lay]', el).forEach(tr => tr.onclick = () => { S.ncrpLay = tr.dataset.lay; NcrpTabs.case(el); setTimeout(() => $('#ncT').scrollIntoView({ behavior: 'smooth' }), 50); });
    Charts.hbar($('#ncLc', el), D.layers.map(l => ({ label: l.layer === 0 ? 'Victim' : 'Layer ' + l.layer, value: l.amount, sub: l.txns + ' txns · ' + l.accounts + ' accounts' })), { fmt: fmtINR, max: 30 });

    // chart
    const full = this.graphData(D); let g = null, V = null;
    const depthNow2 = () => S.ncrpG.depth == null ? depthNow : +S.ncrpG.depth;
    if (!S.ncrpOpen || S.ncrpOpen.ack !== ack || S.ncrpOpen.mt !== S.ncrpG.mt) S.ncrpOpen = { ack, mt: S.ncrpG.mt, set: new Set() };
    const open = S.ncrpOpen.set, box = $('#ncBox', el);
    const pickDepth = () => {
      const d = depthNow2(); if (d) return d;
      const v0 = this.view(full, 99, new Set()); let best = 1;
      for (let k = 1; k <= v0.maxHop; k++) { if (v0.nodes.filter(n => v0.hop.get(n.id) <= k).length <= 160) best = k; else break; }
      return best;
    };
    const draw = then => {
      const depth = pickDepth(); V = this.view(full, depth, open);
      const shownL = Math.min(depth, V.maxHop), all = V.nodes.length === full.nodes.length;
      $('#ncTopInfo', el).innerHTML = all ? `Complete trail: all <b>${fmtNum(full.nodes.length)}</b> accounts, ${V.maxHop} steps from the victim.` : `Showing <b>${fmtNum(V.nodes.length)}</b> of ${fmtNum(full.nodes.length)} accounts (victim → step ${shownL}${open.size ? ' + ' + open.size + ' opened' : ''}). Click <b>+N</b> on an account to open it, or <button class="btn sm primary" id="ncAll">Show complete trail</button>`;
      const ab = $('#ncAll', el); if (ab) ab.onclick = () => { S.ncrpG.depth = 99; const sel = $('#ncDepth', el); if (sel) sel.value = '99'; open.clear(); draw(); };
      if (!V.nodes.length) { box.innerHTML = '<div class="muted" style="padding:40px;text-align:center">This complaint has no money-trail transactions imported yet.</div>'; g = null; return; }
      const root = (V.nodes.find(n => n.kind === 'victim') || V.nodes[0]).id;
      g = Graph.mount(box, V.nodes, V.edges, { mode: S.ncrpG.mode, root, radial: true, trailColors: true, colorBy: S.settings.graphColor, onColor: v => { S.settings.graphColor = v; DB.set('settings', S.settings); }, vert: !!S.ncrpG.vert, onOrient: v => { S.ncrpG.vert = v; }, live: S.ncrpG.live !== false && V.edges.length <= 1000, labels: V.edges.length > 160 ? true : 'full',
        onTrail: (hops, api, info) => trailDrawer(hops, api, info), onClear: UI.closeDrawer,
        onExpand: n => {
          if (n.more) open.add(n.id);
          else { // close: this account and everything opened below it
            const drop = [n.id]; while (drop.length) { const id = drop.pop(); if (!open.delete(id) && id !== n.id) continue; for (const e of V.out.get(id) || []) if (open.has(e.to)) drop.push(e.to); }
          }
          draw();
        } });
      g.root = root;
      if (then) setTimeout(() => then(g), 60);
    };
    // make sure an account is on the chart (open the path to it), then run fn
    const showOn = (id, fn) => {
      if (V && V.nodes.some(n => n.id === id)) return g && fn(g);
      let p = V && V.parent.get(id), guard = 0; while (p && guard++ < 100) { open.add(p); p = V.parent.get(p); }
      draw(fn);
    };
    const showMany = (ids, fn) => {
      const miss = ids.filter(id => !V.nodes.some(n => n.id === id)); if (!miss.length) return g && fn(g);
      for (const id of miss) { let p = V.parent.get(id), guard = 0; while (p && guard++ < 100) { open.add(p); p = V.parent.get(p); } }
      draw(fn);
    };
    draw();
    const mt = $('#ncMt', el); if (mt) mt.onchange = e => { S.ncrpG.mt = e.target.value === '1'; NcrpTabs.case(el); setTimeout(() => $('#ncBox').scrollIntoView({ block: 'center' }), 30); };
    $('#ncDepth', el).onchange = e => { S.ncrpG.depth = +e.target.value; open.clear(); draw(); };
    $('#ncSvg', el).onclick = () => g && g.download('trail_' + ack + '_' + S.ncrpG.mode);
    $('#ncPng', el).onclick = () => g && g.download('trail_' + ack + '_' + S.ncrpG.mode, true);
    $('#ncReplay', el).onclick = () => g && g.highlightNode(g.root);
    box.addEventListener('click', e => { const z = e.target.closest('[data-z="live"]'); if (z) S.ncrpG.live = $('#ncBox svg').classList.contains('live'); });
    $$('[data-gm]', el).forEach(b => b.onclick = () => { S.ncrpG.mode = b.dataset.gm; NcrpTabs.case(el); setTimeout(() => $('#ncBox').scrollIntoView({ block: 'center' }), 30); });

    // flagged accounts
    Flags.bindRule(el, 'ncf', () => NcrpCase.render(el));
    Flags.table($('#ncF', el), S.flagOnly === false ? D.flags : D.flags.filter(f => f.bulk || f.rapid), { id: 'ncf', key: ack, exportName: 'complaint_' + ack + '_flagged',
      onRow: r => { $('#ncBox').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => showOn(r.acc, g => g.highlightNode(r.acc)), 350); },
      onShow: ids => { $('#ncBox').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => showMany(ids, g => g.highlightMany(ids)), 350); } });
    // transactions table
    $('#ncLay', el).onchange = e => { S.ncrpLay = e.target.value; NcrpTabs.case(el); setTimeout(() => $('#ncT').scrollIntoView(), 30); };
    $('#ncHold', el).onchange = e => { S.ncrpHold = e.target.checked; NcrpTabs.case(el); setTimeout(() => $('#ncT').scrollIntoView(), 30); };
    const trows = D.txns.filter(t => (S.ncrpHold || !t.holdOnly) && (S.ncrpLay === '' || S.ncrpLay == null || String(t._layer) === String(S.ncrpLay)));
    Table($('#ncT', el), {
      rows: trows, pageSize: 100, exportName: 'complaint_' + ack + '_transactions', sortKey: '_amt', sortDir: -1,
      columns: [
        { key: '_layer', label: 'Layer', num: true },
        { key: 'from_acc', label: 'From account', render: r => r.from_acc ? accLink(r.from_acc) + (r.from_name ? `<div class="small muted">${esc(r.from_name)}</div>` : '') : '<span class="muted">Victim</span>' },
        { key: 'to_acc', label: 'Beneficiary account', render: r => accLink(r.to_acc) + (r._name ? `<div class="small muted">${esc(r._name)}</div>` : '') },
        { key: '_ifsc', label: 'IFSC', render: r => `<span class="mono">${esc(r._ifsc)}</span>` }, { key: '_bank', label: 'Bank' },
        { key: 'date', label: 'Txn date' }, { key: '_amt', label: 'Txn amount', num: true, fmt: v => fmtINR(v) },
        { key: 'txn_id', label: 'UTR / Txn ID', render: r => `<span class="mono small">${esc(r.txn_id || '')}</span>` },
        { key: '_type', label: 'Account type', render: r => typeBadge(r._type) },
        { key: 'hold', label: 'Hold', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'action', label: 'Action / status' }, { key: 'mode', label: 'Mode' }],
      after: bindAccLinks,
      onRow: r => { const from = r.from_acc || 'VICTIM:' + ack, to = r.to_acc || 'UNIDENTIFIED'; $('#ncBox').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => showOn(to, g => g.highlightEdge(from, to)), 350); }
    });
    // beneficiaries
    Table($('#ncB', el), {
      rows: D.bens, pageSize: 50, exportName: 'complaint_' + ack + '_beneficiaries', sortKey: 'inAmt', sortDir: -1,
      columns: [
        { key: 'layer', label: 'Layer', num: true }, { key: 'acc', label: 'Account', render: r => accLink(r.acc) }, { key: 'name', label: 'Name' },
        { key: 'ifsc', label: 'IFSC', render: r => `<span class="mono">${esc(r.ifsc)}</span>` }, { key: 'bank', label: 'Bank' },
        { key: 'inAmt', label: 'Received', num: true, fmt: fmtINR }, { key: 'outAmt', label: 'Sent onward', num: true, fmt: fmtINR },
        { key: 'hold', label: 'On hold', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'txns', label: 'Txns', num: true },
        { key: 'first', label: 'First txn' }, { key: 'last', label: 'Last txn' },
        { key: 'type', label: 'Type', render: r => typeBadge(r.type) }, { key: 'flags', label: 'Flags', render: r => r.fl ? Flags.badges(r.fl) : '' }, { key: 'complaints', label: 'In complaints', num: true, render: r => r.complaints > 1 ? `<span class="badge bad">${r.complaints}</span>` : (r.complaints || '') },
        { key: 'score', label: 'Risk', num: true }],
      after: bindAccLinks,
      onRow: r => { $('#ncBox').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => showOn(r.acc, g => g.traceTo(r.acc)), 350); }
    });
  }
};
S.ncrpG = S.ncrpG || { mode: 'flow', live: true, top: 60 };
if (S.ncrpLay == null) S.ncrpLay = '';

/* NCRP page: new first tab "Complaint Analysis"; complaints list also shows complaints found in money-trail sheets */
NcrpTabs.case = el => NcrpCase.render(el);
(() => {
  const origData = NcrpTabs.data;
  NcrpTabs.data = el => {
    origData(el);
    const _pick = S.ncrpPick; S.ncrpPick = ''; const list = NcrpData.list(); S.ncrpPick = _pick;
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<h3>Complaints found in imported data (${list.length})</h3><div class="sub">From the <b>Acknowledgement No</b> column of every imported sheet – money trail, bank action sheet or NCRP export. Click a complaint to open its full analysis.</div><div id="nAll"></div>`;
    el.insertBefore(card, el.children[1] || null);
    Table($('#nAll', card), { rows: list, pageSize: 50, exportName: 'complaints_found', sortKey: 'amount', sortDir: -1,
      columns: [{ key: 'ack', label: 'Acknowledgement No', render: r => `<b class="mono">${esc(r.ack)}</b>` }, { key: 'victim', label: 'Victim' }, { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount', num: true, fmt: fmtINR }, { key: 'layers', label: 'Layers', num: true }, { key: 'txns', label: 'Txns', num: true }, { key: 'accounts', label: 'Accounts', num: true }, { key: 'hold', label: 'On hold', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'district', label: 'District' }],
      onRow: r => { S.ncrpAck = r.ack; go('ncrp', 'case'); } });
    const fb = document.createElement('div'); fb.className = 'card filter-bar';
    fb.innerHTML = `<div class="row"><label><b>Imported data file</b></label><select id="ndSrc" style="min-width:240px"><option value="">All files</option>${NcrpData.files().map(f => `<option ${f === S.ncrpSrc ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select><span class="small muted">Choose a file to see only the complaints in it.</span></div>`;
    el.prepend(fb); $('#ndSrc', fb).onchange = e => { S.ncrpSrc = e.target.value; NcrpTabs.data(el); };
  };
})();
Pages.ncrp = main => {
  const n = Trail.complaints().length;
  const { cur, body } = tabs(main, 'ncrp', [['case', 'Complaint Analysis'], ['data', `Complaints (${n})`], ['summary', 'Summary'], ['common', 'Common Suspects'], ['link', 'Link to Money Trail']], '3 · NCRP Analysis',
    `<button class="btn primary" id="nImp">⬆ Import NCRP / trail</button>`);
  $('#nImp').onclick = () => openImport(['ncrp', 'txn'], render);
  NcrpTabs[cur](body);
};

/* ===== NCRP tabs that work from the money-trail sheet as well as NCRP exports ===== */
const NcrpData = {
  files() { return uniq([...S.data.txns.filter(t => t.ack_no).map(t => t._src), ...S.data.ncrp.map(n => n._src)].filter(Boolean)).sort(); },
  /* complaints after the "Data file" and "Complaint" choices at the top of the tab */
  list() {
    let L = Trail.complaints();
    if (S.ncrpSrc) { const acks = new Set([...S.data.txns.filter(t => t._src === S.ncrpSrc).map(t => t.ack_no), ...S.data.ncrp.filter(n => n._src === S.ncrpSrc).map(n => n.ack_no)]); L = L.filter(c => acks.has(c.ack)); }
    if (S.ncrpPick) L = L.filter(c => c.ack === S.ncrpPick);
    return L;
  },
  txns(list) { const acks = new Set(list.map(c => c.ack)); return S.data.txns.filter(t => acks.has(t.ack_no) && (!S.ncrpSrc || t._src === S.ncrpSrc)); },
  bar(el, redraw) {
    const files = this.files(), all = Trail.complaints();
    if (S.ncrpSrc && !files.includes(S.ncrpSrc)) S.ncrpSrc = '';
    if (S.ncrpPick && !all.some(c => c.ack === S.ncrpPick)) S.ncrpPick = '';
    const acks = S.ncrpSrc ? (() => { const s = new Set(S.data.txns.filter(t => t._src === S.ncrpSrc).map(t => t.ack_no)); S.data.ncrp.filter(n => n._src === S.ncrpSrc).forEach(n => s.add(n.ack_no)); return all.filter(c => s.has(c.ack)); })() : all;
    const div = document.createElement('div'); div.className = 'card filter-bar';
    div.innerHTML = `<div class="row" style="flex-wrap:wrap"><label><b>Imported data file</b></label><select id="nbSrc" style="min-width:240px"><option value="">All files (${files.length})</option>${files.map(f => `<option ${f === S.ncrpSrc ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>
      <label style="margin-left:10px"><b>Complaint</b></label><select id="nbAck" style="min-width:300px"><option value="">All complaints (${acks.length})</option>${acks.slice().sort((a, b) => (b.amount || 0) - (a.amount || 0)).map(c => `<option value="${esc(c.ack)}" ${c.ack === S.ncrpPick ? 'selected' : ''}>${esc(c.ack)} · ${fmtINR(c.amount || 0)}${c.victim ? ' · ' + esc(c.victim) : ''}</option>`).join('')}</select>
      <span class="spacer"></span><span class="small muted">Shows complaints from the Acknowledgement No. column of money-trail / bank-action sheets and NCRP exports.</span></div>`;
    el.prepend(div);
    $('#nbSrc', div).onchange = e => { S.ncrpSrc = e.target.value; S.ncrpPick = ''; redraw(); };
    $('#nbAck', div).onchange = e => { S.ncrpPick = e.target.value; redraw(); };
  },
  stats(c) {
    const tx = S.data.txns.filter(t => t.ack_no === c.ack && (!S.ncrpSrc || t._src === S.ncrpSrc)), mv = tx.filter(t => !t.holdOnly);
    const accs = uniq(mv.map(t => t.to_acc)).filter(a => a && !isSynthetic(a));
    const fl = Flags.compute(tx, 'stat:' + c.ack + ':' + (S.ncrpSrc || '')).filter(f => f.bulk || f.rapid).length;
    return { ...c, files: uniq(tx.map(t => t._src).filter(Boolean)).join(', '), txns: tx.length, accounts: accs.length, moved: sum(mv, t => Math.abs(t.amount || 0)), l1: sum(mv.filter(t => t.layer === 1), t => Math.abs(t.amount || 0)),
      hold: sum(tx, t => Math.abs(t.hold || 0)) || c.hold || 0, cash: sum(mv.filter(t => /^CASH-OUT/.test(t.to_acc || '')), t => Math.abs(t.amount || 0)), flagged: fl, banks: uniq(mv.map(t => t.to_bank).filter(Boolean)).length,
      first: mv.map(t => t.date).filter(Boolean).sort()[0] || c.date || '' };
  }
};

/* Complaint <-> money trail */
NcrpTabs.link = el => {
  const rows = NcrpData.list().map(c => NcrpData.stats(c));
  el.innerHTML = `<div class="card"><h3>Complaint ↔ money trail</h3><div class="sub">For each complaint: transactions imported, layers, accounts, amount moved, on hold, cash withdrawn and flagged mule accounts. Click a complaint to open its full analysis.</div><div id="nlT"></div></div>`;
  NcrpData.bar(el, () => NcrpTabs.link(el));
  Table($('#nlT', el), { rows, exportName: 'complaint_trail_link', sortKey: 'amount', sortDir: -1, columns: [
    { key: 'ack', label: 'Ack No', render: r => `<b class="mono">${esc(r.ack)}</b>` }, { key: 'victim', label: 'Victim' }, { key: 'first', label: 'First txn', fmt: v => String(v || '').slice(0, 16) },
    { key: 'amount', label: 'Disputed', num: true, fmt: fmtINR }, { key: 'moved', label: 'Moved (all layers)', num: true, fmt: fmtINR },
    { key: 'txns', label: 'Trail txns', num: true, render: r => r.txns ? fmtNum(r.txns) : '<span class="badge warn">0 – import trail</span>' },
    { key: 'layers', label: 'Layers', num: true }, { key: 'accounts', label: 'Accounts', num: true }, { key: 'banks', label: 'Banks', num: true },
    { key: 'hold', label: 'On hold', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'cash', label: 'Cash / ATM', num: true, fmt: v => v ? fmtINR(v) : '' },
    { key: 'flagged', label: 'Flagged mules', num: true, render: r => r.flagged ? `<span class="badge bad">${r.flagged}</span>` : '' }, { key: 'files', label: 'File' }],
    onRow: r => { S.ncrpAck = r.ack; go('ncrp', 'case'); } });
};

/* Common suspects: works for one complaint (inside it) and across many complaints */
NcrpTabs.common = el => {
  const list = NcrpData.list(), tx = NcrpData.txns(list).filter(t => !t.holdOnly), acks = new Set(list.map(c => c.ack));
  const rows = [], add = (type, value, items) => {
    const accs = uniq(items.map(i => i.acc).filter(Boolean)), cs = uniq(items.map(i => i.ack).filter(Boolean));
    const pr = /several complaints|Suspect|Repeat|mobile|email|PAN|Aadhaar/.test(type) ? 1 : /senders|name|address/.test(type) ? 2 : 3;
    rows.push({ type, value, prio: pr, prioV: pr * 1e7 - accs.length * 10 - cs.length, accounts: accs.length, complaints: cs.length, amount: sum(items, i => i.amt || 0), layers: uniq(items.map(i => i.layer).filter(Boolean)).sort((a, b) => a - b).join(', '), acks: cs.slice(0, 8).join(', '), accList: accs, items });
  };
  const recv = tx.filter(t => t.to_acc && !isSynthetic(t.to_acc)).map(t => ({ acc: t.to_acc, ack: t.ack_no, amt: Math.abs(t.amount || 0), layer: t.layer, t }));
  // 1. same account in several complaints
  for (const [a, it] of groupBy(recv, i => i.acc)) if (uniq(it.map(i => i.ack)).length >= 2) add('Account in several complaints', a, it);
  // 2. account receiving from many different senders
  for (const [a, it] of groupBy(recv, i => i.acc)) { const s = uniq(it.map(i => i.t.from_acc || 'VICTIM:' + i.ack)).length; if (s >= 3) add(`Account receiving from ${s} senders`, a, it); }
  // 3. identifiers shared by different accounts (name, mobile, email, PAN, Aadhaar, IFSC) from trail + KYC
  const kyc = S.data.kyc.filter(k => recv.some(r => r.acc === k.acc));
  const fields = [['to_name', 'name', 'Same beneficiary name'], ['mobile', 'mobile', 'Same mobile'], ['email', 'email', 'Same email'], ['pan', 'pan', 'Same PAN'], ['aadhaar', 'aadhaar', 'Same Aadhaar'], ['to_ifsc', 'ifsc', 'Same IFSC (branch)'], ['address', 'address', 'Same address']];
  for (const [tf, kf, label] of fields) {
    const m = new Map(), put = (v, item) => { v = String(v || '').trim().toUpperCase(); if (!v || v.length < 3) return; if (!m.has(v)) m.set(v, []); m.get(v).push(item); };
    recv.forEach(r => put(r.t[tf], r));
    kyc.forEach(k => put(k[kf], { acc: k.acc, ack: (recv.find(r => r.acc === k.acc) || {}).ack, amt: 0 }));
    for (const [v, it] of m) if (uniq(it.map(i => i.acc)).length >= (kf === 'ifsc' ? 3 : 2)) add(label, v, it);
  }
  // 4. NCRP export suspect details repeated across complaints
  const nc = S.data.ncrp.filter(n => acks.has(n.ack_no));
  for (const [f, l] of [['suspect_mobile', 'Suspect mobile (NCRP)'], ['suspect_acc', 'Suspect account (NCRP)'], ['suspect_upi', 'Suspect UPI (NCRP)'], ['suspect_url', 'Suspect URL / app (NCRP)'], ['suspect_email', 'Suspect email (NCRP)'], ['victim_mobile', 'Repeat victim mobile']])
    for (const [v, it] of groupBy(nc.filter(r => r[f]), r => r[f])) if (it.length >= 2) add(l, v, it.map(r => ({ acc: '', ack: r.ack_no, amt: r.amount })));
  const types = uniq(rows.map(r => r.type.replace(/\d+ senders/, 'many senders'))).sort();
  const ty = S.ncrpComType && types.includes(S.ncrpComType) ? S.ncrpComType : '';
  const shown = ty ? rows.filter(r => r.type.replace(/\d+ senders/, 'many senders') === ty) : rows;
  el.innerHTML = `<div class="card"><h3>Common suspects</h3><div class="sub">Accounts and details that repeat – the same account in several complaints, one account collecting from many senders, or the same name / mobile / email / PAN / Aadhaar / IFSC on different accounts (from the trail sheet and KYC). Click a row to see the accounts.</div>
    <div class="row" style="margin-bottom:8px"><label>Type</label><select id="ncTy"><option value="">All types (${rows.length})</option>${types.map(t => `<option ${t === ty ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div><div id="ncT2"></div></div>`;
  NcrpData.bar(el, () => NcrpTabs.common(el));
  $('#ncTy', el).onchange = e => { S.ncrpComType = e.target.value; NcrpTabs.common(el); };
  Table($('#ncT2', el), { rows: shown, exportName: 'common_suspects', sortKey: 'prio', sortDir: 1, columns: [
    { key: 'prio', label: 'Priority', sortVal: r => r.prioV, csv: r => ['', 'High', 'Medium', 'Low'][r.prio], render: r => `<span class="badge ${r.prio === 1 ? 'bad' : r.prio === 2 ? 'warn' : ''}">${['', 'High', 'Medium', 'Low'][r.prio]}</span>` },
    { key: 'type', label: 'Type', render: r => `<span class="badge">${esc(r.type)}</span>` }, { key: 'value', label: 'Value', render: r => /^\d{6,}$/.test(r.value) ? accLink(r.value) : `<span class="mono">${esc(r.value)}</span>` },
    { key: 'accounts', label: 'Accounts', num: true }, { key: 'complaints', label: 'Complaints', num: true }, { key: 'amount', label: 'Amount', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'layers', label: 'Layers' }, { key: 'acks', label: 'Ack Nos' }],
    after: bindAccLinks,
    onRow: r => { const b = UI.drawer(r.type + ': ' + r.value, `<p class="small muted">${r.accounts} account(s) · ${r.complaints} complaint(s)${r.amount ? ' · ' + fmtINR(r.amount) : ''}</p>` + (r.accList.length ? r.accList.map(a => { const it = r.items.filter(i => i.acc === a); const t = (it.find(i => i.t) || {}).t || {}; return `<div class="list-item"><div class="grow small">${accLink(a)} · ${esc(t.to_name || '')} · ${esc(t.to_bank || '')} <span class="mono">${esc(t.to_ifsc || '')}</span><br>${it.length} txn · ${fmtINR(sum(it, i => i.amt || 0))} · Layer ${esc(uniq(it.map(i => i.layer).filter(Boolean)).join(', '))} · Ack ${esc(uniq(it.map(i => i.ack)).join(', '))}</div></div>`; }).join('') : r.items.map(i => `<div class="list-item small">Ack ${esc(i.ack)} · ${fmtINR(i.amt || 0)}</div>`).join(''))); bindAccLinks(b); } });
};

/* Summary & charts */
NcrpTabs.summary = el => {
  const list = NcrpData.list(), st = list.map(c => NcrpData.stats(c)), tx = NcrpData.txns(list), mv = tx.filter(t => !t.holdOnly);
  const disputed = sum(st, c => c.amount || 0), hold = sum(st, c => c.hold || 0);
  el.innerHTML = UI.kpis([['Complaints', fmtNum(list.length), '', 'c2'], ['Disputed amount', fmtINR(disputed), 'reported / Layer 1'], ['Moved (all layers)', fmtINR(sum(mv, t => Math.abs(t.amount || 0))), fmtNum(mv.length) + ' txns', 'c3'],
    ['On hold', fmtINR(hold), disputed ? (100 * hold / disputed).toFixed(1) + '% of disputed' : '', 'c4'], ['Cash / ATM', fmtINR(sum(st, c => c.cash)), '', 'c5'],
    ['Accounts', fmtNum(uniq(mv.map(t => t.to_acc)).filter(a => a && !isSynthetic(a)).length), uniq(mv.map(t => t.to_bank).filter(Boolean)).length + ' banks'], ['Flagged mules', fmtNum(sum(st, c => c.flagged)), 'bulk split / rapid', 'c6']]).replace('class="kpis"', 'class="kpis kpis-c"') +
    `<div class="grid g2">
      <div class="card"><h3>Amount per layer</h3><div id="s1"></div></div>
      <div class="card"><h3>Top receiving banks</h3><div class="sub">Amount received – send notices to these first.</div><div id="s2"></div></div>
      <div class="card"><h3>Transactions per day</h3><div id="s3"></div></div>
      <div class="card"><h3>Payment mode</h3><div id="s4"></div></div>
      <div class="card"><h3>Biggest beneficiary accounts</h3><div id="s5"></div></div>
      <div class="card"><h3>${list.length > 1 ? 'Complaints by amount' : 'Action / status in bank reply'}</h3><div id="s6"></div></div>
      ${S.data.ncrp.length ? '<div class="card"><h3>By category (NCRP export)</h3><div id="s7"></div></div><div class="card"><h3>Amount by district (NCRP export)</h3><div id="s8"></div></div>' : ''}</div>`;
  NcrpData.bar(el, () => NcrpTabs.summary(el));
  const hb = (id, G, fmt = fmtINR, max = 12) => Charts.hbar($(id, el), [...G].map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value), { fmt, max });
  const by = (rows, key, val) => { const m = new Map(); rows.forEach(r => { const k = key(r); if (k == null || k === '') return; m.set(k, (m.get(k) || 0) + val(r)); }); return m; };
  const amt = t => Math.abs(t.amount || 0);
  Charts.hbar($('#s1', el), [...by(mv, t => t.layer || 0, amt)].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ label: k ? 'Layer ' + k : 'Victim / no layer', value: v })), { fmt: fmtINR, max: 30 });
  hb('#s2', by(mv, t => t.to_bank, amt));
  const days = by(mv.filter(t => t.date), t => t.date.slice(0, 10), () => 1); Charts.line($('#s3', el), [...days.keys()].sort().map(k => ({ label: k, value: days.get(k) })));
  hb('#s4', by(mv, t => (t.mode || (/^CASH-OUT/.test(t.to_acc || '') ? 'ATM / cash' : 'Not given')).toUpperCase(), () => 1), v => fmtNum(v) + ' txns');
  hb('#s5', by(mv.filter(t => t.to_acc && !isSynthetic(t.to_acc)), t => t.to_acc + (t.to_name ? ' · ' + t.to_name.slice(0, 14) : ''), amt), fmtINR, 10);
  if (list.length > 1) { const br = [[0, 10000, '< 10K'], [10000, 50000, '10K–50K'], [50000, 100000, '50K–1L'], [100000, 500000, '1L–5L'], [500000, 1e13, '> 5L']]; Charts.vbar($('#s6', el), br.map(([a, b, l]) => ({ label: l, value: st.filter(c => (c.amount || 0) >= a && (c.amount || 0) < b).length })), { fmt: v => v + ' complaints' }); }
  else hb('#s6', by(tx, t => String(t.action || '').trim() || null, () => 1), v => fmtNum(v) + ' rows');
  if (S.data.ncrp.length) { const nc = S.data.ncrp.filter(n => list.some(c => c.ack === n.ack_no)); hb('#s7', by(nc, n => n.category, () => 1), v => v + ' complaints'); hb('#s8', by(nc, n => n.district, n => n.amount || 0)); }
};
