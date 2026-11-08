/* trail.js - "Money Trail" screen: complaints from Acknowledgement No, and a layer-wise chart
   Victim → Layer 1 → Layer 2 → … exactly as numbered in the bank action / NCRP trail sheet */
'use strict';

const Trail = {
  /* every complaint found in the Acknowledgement No column of any sheet */
  complaints() {
    return Analysis.cached('complaints', () => {
      const M = new Map();
      const get = a => { if (!M.has(a)) M.set(a, { ack: a, victim: '', district: '', category: '', date: '', reported: null, hold: 0, trailAmt: 0, txns: 0, layers: 0, accounts: new Set(), ncrp: null }); return M.get(a); };
      for (const t of S.data.txns) {
        if (!t.ack_no) continue; const c = get(t.ack_no); c.txns++;
        if (t.layer && !t.holdOnly) c.layers = Math.max(c.layers, t.layer);
        if (t.layer === 1 && !t.holdOnly) c.trailAmt += Math.abs(t.amount || 0);
        if (t.hold) c.hold += Math.abs(t.hold);
        if (t.to_acc && !isSynthetic(t.to_acc)) c.accounts.add(t.to_acc);
        if (t.date && (!c.date || t.date < c.date)) c.date = t.date.slice(0, 10);
      }
      for (const n of S.data.ncrp) {
        if (!n.ack_no) continue; const c = get(n.ack_no); c.ncrp = n;
        Object.assign(c, { victim: n.victim_name || c.victim, district: n.district, category: n.sub_category || n.category, reported: n.amount, date: n.date || c.date });
        if (!c.hold && n.hold_amount) c.hold = n.hold_amount;
      }
      return [...M.values()].map(c => ({ ...c, accounts: c.accounts.size, amount: c.reported ?? c.trailAmt }));
    });
  },

  /* build the columns for one complaint (or all complaints) */
  build(ack) {
    const rows = S.data.txns.filter(t => (!ack || t.ack_no === ack));
    const L = new Map(), info = new Map(), links = new Map();
    const node = (id, name, bank, ifsc) => {
      if (!info.has(id)) info.set(id, { id, names: new Set(), banks: new Set(), ifscs: new Set(), inAmt: 0, outAmt: 0, hold: 0, cash: 0, dates: [], actions: new Set(), acks: new Set() });
      const n = info.get(id); if (name) n.names.add(name); if (bank) n.banks.add(bank); if (ifsc) n.ifscs.add(ifsc); return n;
    };
    const setL = (id, l) => { if (l == null) return; if (!L.has(id) || l < L.get(id)) L.set(id, l); };
    for (const t of rows) {
      const from = t.from_acc || 'VICTIM:' + (t.ack_no || '?'), to = t.to_acc || 'UNIDENTIFIED';
      if (t.holdOnly) { const n = node(to, t.to_name, t.to_bank, t.to_ifsc); n.hold += Math.abs(t.hold || t.amount || 0); n.actions.add('On hold'); if (t.layer) setL(to, t.layer - 1 || 1); continue; }
      const a = node(from, t.from_name, t.from_bank, t.from_ifsc), b = node(to, t.to_name, t.to_bank, t.to_ifsc), amt = Math.abs(t.amount || 0);
      a.outAmt += amt; b.inAmt += amt; if (t.date) b.dates.push(t.date); if (t.ack_no) { a.acks.add(t.ack_no); b.acks.add(t.ack_no); }
      if (t.hold) b.hold += Math.abs(t.hold);
      if (t.action) b.actions.add(t.action);
      if (/^CASH-OUT/.test(to)) a.cash += amt;
      if (t.layer) { setL(to, t.layer); setL(from, t.layer - 1); }
      const k = from + '→' + to; if (!links.has(k)) links.set(k, { from, to, amount: 0, txns: [] });
      const e = links.get(k); e.amount += amt; e.txns.push(t);
    }
    // rows without a layer number (e.g. statements): place one step after the sender
    for (let pass = 0; pass < 12; pass++) for (const e of links.values()) { if (!L.has(e.to) && L.has(e.from)) L.set(e.to, L.get(e.from) + 1); if (!L.has(e.from) && L.has(e.to)) L.set(e.from, Math.max(0, L.get(e.to) - 1)); }
    for (const id of info.keys()) if (!L.has(id)) L.set(id, 0);
    const cols = new Map(); for (const [id, l] of L) { if (!cols.has(l)) cols.set(l, []); cols.get(l).push(info.get(id)); }
    const keys = [...cols.keys()].sort((a, b) => a - b);
    // order cards in each column after their senders to keep arrows short
    const pos = new Map(); const inc = new Map(); for (const e of links.values()) { if (!inc.has(e.to)) inc.set(e.to, []); inc.get(e.to).push(e.from); }
    for (const k of keys) {
      const col = cols.get(k);
      col.forEach(n => { const p = (inc.get(n.id) || []).map(x => pos.get(x)).filter(v => v != null); n._o = p.length ? Math.min(...p) : 1e9; });
      col.sort((a, b) => a._o - b._o || b.inAmt - a.inAmt); col.forEach((n, i) => pos.set(n.id, i + k * 0.001));
    }
    return { keys, cols, links: [...links.values()], L };
  },

  render(main) {
    const list = Trail.complaints();
    const sel = S.trailAck && list.some(c => c.ack === S.trailAck) ? S.trailAck : (S.trailAck === '*' ? '*' : (list[0] || {}).ack || '*');
    S.trailAck = sel;
    main.innerHTML = `<div class="page-title"><div><h2>Money Trail</h2><div class="sub2">Victim → Layer 1 → Layer 2 → … exactly as numbered in the bank action / NCRP trail sheet. Click any account card to highlight its full path.</div></div><span class="spacer"></span>
      <button class="btn" id="trImp">⬆ Import trail</button><button class="btn" id="trPrint">🖨 Print / PDF</button><button class="btn" id="trCsv">⬇ CSV</button></div>
      <div class="trail-layout">
        <aside class="card trail-list"><div class="row" style="margin-bottom:8px"><h3 class="grow" style="margin:0">Complaints <span class="badge">${list.length}</span></h3></div>
          <input id="trQ" type="search" placeholder="Search Ack No / victim…" style="width:100%;margin-bottom:8px">
          <div class="cmp ${sel === '*' ? 'active' : ''}" data-ack="*"><b>All complaints together</b><div class="small muted">${fmtNum(S.data.txns.length)} transactions</div></div>
          <div id="trItems">${list.sort((a, b) => String(b.date).localeCompare(String(a.date))).map(c => `<div class="cmp ${c.ack === sel ? 'active' : ''}" data-ack="${esc(c.ack)}">
            <div class="row"><b class="mono">${esc(c.ack)}</b><span class="spacer"></span>${c.txns ? `<span class="badge info">${c.layers || '?'} layers</span>` : '<span class="badge warn">no trail</span>'}</div>
            <div class="small">${esc(c.victim || 'Victim not in NCRP list')}${c.district ? ' · ' + esc(c.district) : ''}</div>
            <div class="small muted">${fmtINR(c.amount)}${c.hold ? ' · <span style="color:var(--good)">hold ' + fmtINR(c.hold) + '</span>' : ''}${c.date ? ' · ' + esc(c.date) : ''}</div></div>`).join('') || '<p class="muted small">No Acknowledgement numbers found yet. Import the NCRP money trail / bank action sheet.</p>'}</div>
        </aside>
        <section class="trail-main"><div id="trHead"></div><div class="trail-scroll" id="trScroll"><div class="trail-canvas" id="trCanvas"></div></div></section>
      </div>`;
    $('#trImp').onclick = () => openImport(['txn', 'ncrp', 'stmt', 'kyc'], render);
    $('#trPrint').onclick = () => { document.body.classList.add('print-trail'); window.print(); setTimeout(() => document.body.classList.remove('print-trail'), 500); };
    $$('.cmp', main).forEach(c => c.onclick = () => { S.trailAck = c.dataset.ack; render(); });
    $('#trQ').oninput = e => { const q = e.target.value.toLowerCase(); $$('#trItems .cmp', main).forEach(c => c.style.display = c.innerText.toLowerCase().includes(q) ? '' : 'none'); };
    Trail.draw(sel === '*' ? '' : sel);
  },

  draw(ack) {
    const c = Trail.complaints().find(x => x.ack === ack);
    const { keys, cols, links, L } = Trail.build(ack);
    $('#trCsv').onclick = () => UI.download('money_trail_' + (ack || 'all') + '.csv', UI.toCSV([{ key: 'layer', label: 'Layer' }, { key: 'from_acc', label: 'From' }, { key: 'to_acc', label: 'To' }, { key: 'to_name', label: 'Beneficiary' }, { key: 'to_bank', label: 'Bank' }, { key: 'to_ifsc', label: 'IFSC' }, { key: 'amount', label: 'Amount' }, { key: 'date', label: 'Date' }, { key: 'txn_id', label: 'UTR' }, { key: 'action', label: 'Action' }, { key: 'hold', label: 'Hold' }], S.data.txns.filter(t => !ack || t.ack_no === ack).sort((a, b) => (a.layer || 99) - (b.layer || 99))), 'text/csv');
    const total = sum(links.filter(l => (L.get(l.from) || 0) === 0), l => l.amount);
    const allAcc = [...cols.values()].flat().filter(n => !isSynthetic(n.id) && !n.id.startsWith('VICTIM:'));
    $('#trHead').innerHTML = `<div class="kpis kpis-sm">
      <div class="kpi"><div class="label">Complaint</div><div class="value mono" style="font-size:17px">${esc(ack || 'All')}</div><div class="hint">${esc(c ? [c.victim, c.category].filter(Boolean).join(' · ') : '')}</div></div>
      <div class="kpi"><div class="label">Defrauded (victim → layer 1)</div><div class="value">${fmtINR(total || (c && c.amount))}</div></div>
      <div class="kpi"><div class="label">Layers</div><div class="value">${Math.max(0, ...keys)}</div><div class="hint">${allAcc.length} accounts</div></div>
      <div class="kpi"><div class="label">On hold</div><div class="value" style="color:var(--good)">${fmtINR(sum(allAcc, n => n.hold))}</div></div>
      <div class="kpi"><div class="label">Cash / ATM withdrawn</div><div class="value" style="color:var(--warn)">${fmtINR(sum([...cols.values()].flat().filter(n => /^CASH-OUT/.test(n.id)), n => n.inAmt))}</div></div></div>`;
    const cv = $('#trCanvas');
    if (!links.length && !allAcc.length) { cv.innerHTML = `<div class="muted" style="padding:50px;text-align:center">No money-trail rows for this complaint yet.<br>Import the bank action / NCRP trail sheet (any sheet with "Acknowledgement No." and "Layer" columns).</div>`; return; }
    const { A } = Analysis.fin();
    const card = n => {
      const victim = n.id.startsWith('VICTIM:') || (keys[0] === 0 && cols.get(0).includes(n)), cash = /^CASH-OUT/.test(n.id), unk = n.id === 'UNIDENTIFIED';
      const risk = (A.get(n.id) || {}).score || 0;
      const dates = n.dates.sort(); const out = links.filter(l => l.from === n.id && l.to !== n.id).length;
      const status = cash ? '<span class="tag warn">Cash / ATM withdrawal</span>' : n.hold ? `<span class="tag good">On hold ${fmtINR(n.hold)}</span>` : victim ? '' : out ? `<span class="tag">Sent onward to ${out}</span>` : '<span class="tag bad">End of trail – not traced further</span>';
      return `<div class="tcard ${victim ? 'victim' : ''} ${cash ? 'cash' : ''} ${n.hold ? 'hold' : ''} ${risk >= 60 ? 'risk' : ''}" data-id="${esc(n.id)}">
        <div class="row" style="gap:6px"><span class="tacc mono">${esc(n.id.startsWith('VICTIM:') ? 'Victim account' : cash ? 'ATM / Cash' : accLabel(n.id))}</span><span class="spacer"></span>${risk >= 60 ? `<span class="tag bad" title="Risk score">⚠ ${risk}</span>` : ''}</div>
        <div class="tname">${esc([...n.names][0] || (cash ? n.id.slice(9) : victim ? 'Victim' : unk ? 'Account not given' : ''))}</div>
        <div class="tbank">${esc([[...n.banks][0], [...n.ifscs][0]].filter(Boolean).join(' · '))}</div>
        ${victim ? `<div class="tamt">Lost ${fmtINR(n.outAmt)}</div>` : `<div class="tamt">${fmtINR(n.inAmt)} <span class="small muted">${dates.length ? esc(dates[0].replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3-$2-$1')) : ''}</span></div>`}
        ${status}</div>`;
    };
    cv.innerHTML = `<svg class="tsvg"></svg>` + keys.map(k => `<div class="tcol"><div class="tcol-h">${k === 0 ? 'Victim' : 'Layer ' + k}<span>${cols.get(k).length} · ${fmtINR(sum(cols.get(k), n => k === 0 ? n.outAmt : n.inAmt))}</span></div>${cols.get(k).map(card).join('')}</div>`).join('');
    const svg = $('.tsvg', cv), C = Graph.colors();
    const drawArrows = () => {
      const r0 = cv.getBoundingClientRect(); svg.setAttribute('width', cv.scrollWidth); svg.setAttribute('height', cv.scrollHeight);
      const box = id => { const el = cv.querySelector(`.tcard[data-id="${CSS.escape(id)}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left - r0.left, r: r.right - r0.left, t: r.top - r0.top, b: r.bottom - r0.top, m: (r.top + r.bottom) / 2 - r0.top }; };
      const maxA = Math.max(1, ...links.map(l => l.amount));
      svg.innerHTML = `<defs><marker id="tarr" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.muted}"/></marker><marker id="tarrH" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.s[1]}"/></marker></defs>` +
        links.map((l, i) => {
          const a = box(l.from), b = box(l.to); if (!a || !b || l.from === l.to) return '';
          let d, lx, ly;
          if (b.l > a.r) { const x1 = a.r, x2 = b.l - 2, mx = (x1 + x2) / 2; d = `M${x1},${a.m} C${mx},${a.m} ${mx},${b.m} ${x2},${b.m}`; lx = mx; ly = (a.m + b.m) / 2; }
          else { const x1 = a.r, x2 = b.r + 2, cx = Math.max(a.r, b.r) + 60; d = `M${x1},${a.m} C${cx},${a.m} ${cx},${b.m} ${x2},${b.m}`; lx = cx - 14; ly = (a.m + b.m) / 2; }
          const ds = l.txns.map(t => t.date).filter(Boolean).sort(); const dt = ds.length ? ds[0].replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3-$2-$1') : '';
          return `<g class="tlink" data-i="${i}" data-from="${esc(l.from)}" data-to="${esc(l.to)}"><path d="${d}" fill="none" stroke="${C.muted}" stroke-opacity=".6" stroke-width="${(1.5 + 4 * Math.sqrt(l.amount / maxA)).toFixed(1)}" marker-end="url(#tarr)"/>
            <text x="${lx}" y="${ly - 3}" text-anchor="middle" class="tl1">${esc(fmtINR(l.amount))}${l.txns.length > 1 ? ' (' + l.txns.length + ')' : ''}</text>${dt ? `<text x="${lx}" y="${ly + 10}" text-anchor="middle" class="tl2">${esc(dt)}</text>` : ''}<title>${esc(accLabel(l.from))} → ${esc(accLabel(l.to))}\n${l.txns.map(t => `${fmtINR(t.amount)}  ${t.date || ''}  ${t.txn_id || ''}`).join('\n')}</title></g>`;
        }).join('');
    };
    requestAnimationFrame(drawArrows);
    window.onresize = () => { if ($('#trCanvas')) drawArrows(); };
    // click a card: highlight the full path through it (back to the victim, forward to the end)
    const walk = (id, dir) => { const seen = new Set([id]), q = [id]; while (q.length) { const x = q.shift(); for (const l of links) { const nx = dir > 0 ? (l.from === x ? l.to : null) : (l.to === x ? l.from : null); if (nx && !seen.has(nx)) { seen.add(nx); q.push(nx); } } } return seen; };
    $$('.tcard', cv).forEach(el => el.onclick = () => {
      const id = el.dataset.id;
      if (cv.dataset.sel === id) { cv.dataset.sel = ''; cv.classList.remove('focus'); $$('.on', cv).forEach(x => x.classList.remove('on')); $$('.tlink path', cv).forEach(p => p.setAttribute('marker-end', 'url(#tarr)')); return; }
      cv.dataset.sel = id; cv.classList.add('focus');
      const up = walk(id, -1), down = walk(id, 1), on = new Set([...up, ...down]);
      $$('.tcard', cv).forEach(x => x.classList.toggle('on', on.has(x.dataset.id)));
      $$('.tlink', cv).forEach(g => { const hit = (up.has(g.dataset.from) && up.has(g.dataset.to)) || (down.has(g.dataset.from) && down.has(g.dataset.to)); g.classList.toggle('on', hit); g.querySelector('path').setAttribute('marker-end', hit ? 'url(#tarrH)' : 'url(#tarr)'); });
      if (!id.startsWith('VICTIM:') && !isSynthetic(id)) showAccount(id);
    });
  }
};
Pages.trail = main => Trail.render(main);
