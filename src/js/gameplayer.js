/* gameplayer.js – "Game Player / Short-Loan Receivers": accounts that got SMALL amounts from the
   bulk-split (one in → many out) mule accounts. Shown on Analytics → Bulk Split & Rapid. */
'use strict';
const GamePlayer = {
  rule() { if (!S.settings.gpRule) S.settings.gpRule = { max: 10000, src: 'bulk' }; return S.settings.gpRule; },
  data() {
    const R = this.rule();
    return Analysis.cached('gp:' + JSON.stringify(R) + ':' + JSON.stringify(Flags.rule()), () => {
      const F = Flags.compute(S.data.txns), snd = new Map(F.filter(r => R.src === 'any' ? (r.bulk || r.rapid) : r.bulk).map(r => [r.acc, r]));
      const tx = [];
      for (const t of S.data.txns) {
        if (t.holdOnly || !t.to_acc || isSynthetic(t.to_acc) || !snd.has(t.from_acc)) continue;
        const amt = Math.abs(t.amount || 0); if (!amt || amt > R.max) continue;
        const s = snd.get(t.from_acc);
        tx.push({ ...t, _amt: amt, s_acc: t.from_acc, s_name: t.from_name || s.name, s_ifsc: t.from_ifsc || s.ifsc, s_bank: t.from_bank || s.bank, s_fan: s.receivers,
          r_acc: t.to_acc, r_name: t.to_name || '', r_ifsc: t.to_ifsc || '', r_bank: t.to_bank || '' });
      }
      const G = new Map();
      for (const t of tx) {
        let g = G.get(t.r_acc); if (!g) G.set(t.r_acc, g = { acc: t.r_acc, names: new Set(), ifscs: new Set(), banks: new Set(), senders: new Set(), acks: new Set(), n: 0, amount: 0, dates: [], layer: 0 });
        if (t.r_name) g.names.add(t.r_name); if (t.r_ifsc) g.ifscs.add(t.r_ifsc); if (t.r_bank) g.banks.add(t.r_bank); if (t.ack_no) g.acks.add(t.ack_no);
        g.senders.add(t.s_acc); g.n++; g.amount += t._amt; if (t.date) g.dates.push(t.date); if (t.layer) g.layer = g.layer ? Math.min(g.layer, t.layer) : t.layer;
      }
      const recv = [...G.values()].map(g => { const d = g.dates.sort(); return { acc: g.acc, name: [...g.names].join(' / '), ifsc: [...g.ifscs].join(' / '), bank: [...g.banks].join(' / '), senders: g.senders.size, senderList: [...g.senders].join(', '), n: g.n, amount: g.amount, avg: Math.round(g.amount / g.n), first: d[0] || '', last: d[d.length - 1] || '', complaints: g.acks.size, layer: g.layer }; });
      return { tx, recv, snd };
    });
  },
  mount(host) {
    const R = this.rule(), D = this.data(), view = S.gpView || 'table';
    const multi = D.recv.filter(r => r.senders >= 2).length, usedSnd = new Set(D.tx.map(t => t.s_acc)).size;
    host.innerHTML = `<div class="gp-head"><span class="gp-ic">🎮</span><div class="grow"><h3>Game Player / Short-Loan Receivers</h3>
        <div class="sub">Accounts that got <b>small amounts</b> (up to ${fmtINR(R.max)}) from the <b>bulk-split</b> accounts – the accounts that receive money and pass it on to many others. These are often online-game players or people who took a short loan, paid by the gang.</div></div></div>
      <div class="gp-rule"><label>Small amount = up to ₹</label><input type="number" id="gpMax" min="1" value="${R.max}" style="width:110px">
        <label>Paid by</label><select id="gpSrc"><option value="bulk" ${R.src === 'bulk' ? 'selected' : ''}>bulk-split accounts</option><option value="any" ${R.src === 'any' ? 'selected' : ''}>bulk-split or rapid pass-through accounts</option></select>
        <span class="small muted">Bulk split = sent to ${Flags.rule().fan}+ accounts (change it in the box below)</span></div>
      <div class="gp-kpis">${[['🎮', fmtNum(D.recv.length), 'receiver accounts', '#a855f7'], ['🔁', fmtNum(D.tx.length), 'small transactions', '#3b82f6'], ['₹', fmtINR(sum(D.tx, t => t._amt)), 'total paid to them', '#10b981'], ['⇉', fmtNum(usedSnd), 'bulk accounts paying', '#f97316'], ['⚑', fmtNum(multi), 'paid by 2+ bulk accounts', '#ef4444']].map(([i, v, l, c]) => `<div class="gp-k" style="--gc:${c}"><span>${i}</span><b>${v}</b><small>${l}</small></div>`).join('')}</div>
      <div class="row" style="margin:12px 0 8px;flex-wrap:wrap"><span class="pill-group">${[['table', '📋 Transactions'], ['recv', '👤 Receivers'], ['net', '🕸 Network'], ['flow', '➜ Flow chart'], ['chart', '📊 Charts']].map(([k, l]) => `<button data-gv="${k}" class="${k === view ? 'active' : ''}">${l}</button>`).join('')}</span></div>
      <div id="gpBody"></div>`;
    const redo = () => this.mount(host);
    $('#gpMax', host).onchange = e => { const v = Math.max(1, +e.target.value || 10000); R.max = v; DB.set('settings', S.settings); redo(); };
    $('#gpSrc', host).onchange = e => { R.src = e.target.value; DB.set('settings', S.settings); redo(); };
    $$('[data-gv]', host).forEach(b => b.onclick = () => { S.gpView = b.dataset.gv; redo(); });
    const body = $('#gpBody', host);
    if (!D.tx.length) { body.innerHTML = `<div class="muted" style="padding:24px;text-align:center">No small payments from bulk-split accounts found. Raise the small-amount limit above, or import more bank-action sheets.</div>`; return; }
    if (view === 'table') return Table(body, {
      rows: D.tx, exportName: 'game_player_short_loan_transactions', sortKey: 'date', sortDir: -1, pageSize: 50,
      columns: [
        { key: 's_acc', label: 'Sender account (bulk)', render: r => accLink(r.s_acc) + ` <span class="badge bad" title="Sent to ${r.s_fan} accounts">⇉${r.s_fan}</span>` },
        { key: 's_name', label: 'Sender name' }, { key: 's_ifsc', label: 'Sender IFSC', render: r => `<span class="mono">${esc(r.s_ifsc)}</span>` }, { key: 's_bank', label: 'Sender bank' },
        { key: 'date', label: 'Txn date' }, { key: '_amt', label: 'Txn amount', num: true, render: r => fmtINR(r._amt) }, { key: 'txn_id', label: 'Txn ID / UTR', render: r => `<span class="mono">${esc(r.txn_id || '')}</span>` },
        { key: 'r_acc', label: 'Game player / short-loan account', render: r => `<b>${accLink(r.r_acc)}</b>` }, { key: 'r_name', label: 'Receiver name' }, { key: 'r_ifsc', label: 'Receiver IFSC', render: r => `<span class="mono">${esc(r.r_ifsc)}</span>` }, { key: 'r_bank', label: 'Receiver bank' },
        { key: 'layer', label: 'Layer', num: true }, { key: 'ack_no', label: 'Complaint (Ack No)', render: r => `<span class="mono small">${esc(r.ack_no || '')}</span>` }, { key: 'mode', label: 'Mode' }
      ], after: bindAccLinks, onRow: r => showAccount(r.r_acc) });
    if (view === 'recv') return Table(body, {
      rows: D.recv, exportName: 'game_player_short_loan_receivers', sortKey: 'senders', sortDir: -1, pageSize: 50,
      columns: [
        { key: 'acc', label: 'Game player / short-loan account', render: r => `<b>${accLink(r.acc)}</b>` }, { key: 'name', label: 'Name' }, { key: 'ifsc', label: 'IFSC', render: r => `<span class="mono">${esc(r.ifsc)}</span>` }, { key: 'bank', label: 'Bank' },
        { key: 'senders', label: 'Bulk accounts paying', num: true, render: r => r.senders >= 2 ? `<span class="badge bad">⚑ ${r.senders}</span>` : r.senders }, { key: 'n', label: 'Txns', num: true },
        { key: 'amount', label: 'Total received', num: true, render: r => fmtINR(r.amount) }, { key: 'avg', label: 'Average', num: true, render: r => fmtINR(r.avg) },
        { key: 'first', label: 'First' }, { key: 'last', label: 'Last' }, { key: 'complaints', label: 'Complaints', num: true },
        { key: 'senderList', label: 'Paid by (bulk accounts)', render: r => `<span class="small mono">${esc(r.senderList.slice(0, 120))}${r.senderList.length > 120 ? '…' : ''}</span>` }
      ], after: bindAccLinks, onRow: r => showAccount(r.acc) });
    if (view === 'chart') {
      body.innerHTML = `<div class="grid g2"><div><h3 style="font-size:15px">Top receivers by amount</h3><div id="gpC1"></div></div><div><h3 style="font-size:15px">Size of the small payments</h3><div id="gpC2"></div></div>
        <div><h3 style="font-size:15px">Bulk accounts paying the most receivers</h3><div id="gpC3"></div></div><div><h3 style="font-size:15px">Receivers paid by many bulk accounts</h3><div id="gpC4"></div></div></div>`;
      Charts.hbar($('#gpC1', body), D.recv.slice().sort((a, b) => b.amount - a.amount).slice(0, 15).map(r => ({ label: accLabel(r.acc), value: r.amount, sub: r.n + ' txns · ' + r.senders + ' bulk acc.' })), { fmt: fmtINR, onClick: d => showAccount(D.recv.find(r => accLabel(r.acc) === d.label).acc) });
      const B = [[1000, 'Up to ₹1,000'], [2000, '₹1,001 – 2,000'], [5000, '₹2,001 – 5,000'], [10000, '₹5,001 – 10,000'], [Infinity, 'Above ₹10,000']];
      Charts.hbar($('#gpC2', body), B.map(([m, l], i) => ({ label: l, value: D.tx.filter(t => t._amt <= m && t._amt > (i ? B[i - 1][0] : 0)).length })).filter(x => x.value), { fmt: v => fmtNum(v) + ' txns' });
      const P = groupBy(D.tx, t => t.s_acc);
      Charts.hbar($('#gpC3', body), [...P].map(([k, v]) => ({ label: accLabel(k), value: new Set(v.map(t => t.r_acc)).size, sub: fmtINR(sum(v, t => t._amt)) })).sort((a, b) => b.value - a.value).slice(0, 15), { fmt: v => fmtNum(v) + ' receivers' });
      Charts.hbar($('#gpC4', body), D.recv.filter(r => r.senders >= 2).sort((a, b) => b.senders - a.senders).slice(0, 15).map(r => ({ label: accLabel(r.acc), value: r.senders, sub: fmtINR(r.amount) })), { fmt: v => v + ' bulk accounts' });
      return;
    }
    // network / flow chart: bulk accounts → receivers (biggest 250 receivers)
    const top = D.recv.slice().sort((a, b) => b.senders - a.senders || b.amount - a.amount).slice(0, 250), keep = new Set(top.map(r => r.acc));
    const E = new Map(); D.tx.forEach(t => { if (!keep.has(t.r_acc)) return; const k = t.s_acc + '>' + t.r_acc; let e = E.get(k); if (!e) E.set(k, e = { from: t.s_acc, to: t.r_acc, amount: 0, count: 0, txns: [] }); e.amount += t._amt; e.count++; e.txns.push(t); });
    const edges = [...E.values()], sIds = new Set(edges.map(e => e.from));
    const nodes = [...[...sIds].map(id => { const s = D.snd.get(id); return { id, label: accLabel(id), sub: [s.name, s.bank].filter(Boolean).join(' · '), det: 'Bulk split ⇉' + s.receivers, kind: 'risk', value: s.outAmt, layer: 1, badge: 'B', title: `${accLabel(id)} – bulk-split account\nSent to ${s.receivers} accounts\n${s.name || ''} ${s.bank || ''}` }; }),
      ...top.map(r => ({ id: r.acc, label: accLabel(r.acc), sub: [r.name, r.bank].filter(Boolean).join(' · '), det: fmtINR(r.amount) + ' · ' + r.n + ' txns', kind: r.senders >= 2 ? 'hold' : 'account', value: r.amount, layer: 2, title: `${accLabel(r.acc)} – game player / short-loan receiver\nGot ${fmtINR(r.amount)} in ${r.n} txns from ${r.senders} bulk account(s)` }))];
    body.innerHTML = `<div class="small muted" style="margin-bottom:6px">${D.recv.length > top.length ? `Showing the ${top.length} receivers paid by the most bulk accounts (of ${fmtNum(D.recv.length)}). ` : ''}<b>B</b> = bulk-split account (centre / left), <b>G</b> = game player / short-loan receiver. Green = receiver paid by 2+ bulk accounts. Click an account for its details.</div><div class="graph-box" id="gpG" style="height:620px"></div>`;
    const net = view === 'net';
    Graph.mount($('#gpG', body), nodes, edges, { mode: net ? 'net' : 'flow', tag: n => n.layer === 1 ? 'B' : 'G', ringName: k => k === 1 ? 'Bulk-split accounts' : 'Game player / loan',  live: edges.length <= 600, labels: edges.length > 160 ? true : 'full',
      onTrail: (hops, api, info) => { const id = info && info.node && info.node.id; if (id) showAccount(id); } });
  }
};
// show the box on Analytics → Bulk Split & Rapid, right after "At a glance"
(() => {
  const og = AnaTabs.flags;
  AnaTabs.flags = el => {
    og(el);
    const box = document.createElement('div'); box.className = 'card gp-card'; box.id = 'gpBox';
    const fl = [...el.children].find(c => c.classList.contains('card') && !c.classList.contains('glance')); el.insertBefore(box, fl || null);
    try { GamePlayer.mount(box); } catch (e) { box.innerHTML = '<div class="err">Could not build this box: ' + esc(e.message) + '</div>'; }
  };
})();
