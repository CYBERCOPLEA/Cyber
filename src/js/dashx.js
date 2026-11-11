/* dashx.js – Dashboard: every number box and step card is live.
   Hover = quick preview of the top records, click = the full data in the side panel (search, sort, CSV). */
'use strict';
const DashX = {
  /* what is behind each box */
  defs() {
    const d = S.data, acc = Analysis.accountRows().filter(a => !isSynthetic(a.acc)), comps = Trail.complaints();
    const A = { key: 'label', label: 'Account', render: r => accLink(r.acc), csv: r => r.acc };
    const INR = (key, label) => ({ key, label, num: true, render: r => r[key] ? fmtINR(r[key]) : '', csv: r => r[key] || 0 });
    const accCols = [A, { key: 'name', label: 'Holder' }, { key: 'bank', label: 'Bank' }, { key: 'layer', label: 'Layer', num: true }, INR('inAmt', 'Received'), INR('outAmt', 'Sent'), INR('hold', 'On hold'), { key: 'score', label: 'Risk', num: true, render: r => riskBadge(r.score) }, { key: 'acks', label: 'Complaints', num: true }];
    const accPv = r => [accLabel(r.acc) + (r.name ? ' · ' + r.name.split(' / ')[0] : ''), fmtINR(r.inAmt)];
    const cmpCols = [{ key: 'ack', label: 'Ack No', render: r => `<b class="mono">${esc(r.ack)}</b>` }, { key: 'victim', label: 'Victim' }, { key: 'district', label: 'District' }, { key: 'date', label: 'Date' }, INR('amount', 'Amount'), { key: 'layers', label: 'Layers', num: true }, { key: 'accounts', label: 'Accounts', num: true }, INR('hold', 'On hold')];
    const cmp = { title: 'Complaints (Ack Nos)', rows: () => comps, cols: cmpCols, sort: 'amount', pv: r => [r.ack + (r.victim ? ' · ' + r.victim : ''), fmtINR(r.amount)], onRow: r => { UI.closeDrawer(); S.trailAck = r.ack; go('trail'); }, page: ['trail'], total: r => r.amount };
    const l1 = () => { const t = d.txns.filter(t => t.layer === 1); return t.length ? t : d.txns.filter(t => t._type === 'trail'); };
    const txnCols = [{ key: 'date', label: 'Date' }, { key: 'ack_no', label: 'Ack No' }, { key: 'from_acc', label: 'From', render: r => accLink(r.from_acc), csv: r => r.from_acc }, { key: 'to_acc', label: 'To', render: r => accLink(r.to_acc), csv: r => r.to_acc }, { key: 'to_name', label: 'Beneficiary' }, { key: 'to_bank', label: 'Bank' }, { key: 'layer', label: 'Layer', num: true }, INR('amount', 'Amount'), { key: 'txn_id', label: 'UTR / Txn ID' }];
    const held = () => { const a = acc.filter(x => x.hold > 0); return a.length ? a : d.ncrp.filter(n => n.hold_amount > 0).map(n => ({ ...n, acc: n.to_acc || n.acc || '', label: n.ack_no, inAmt: n.amount, hold: n.hold_amount })); };
    const banks = () => [...groupBy(acc.filter(a => a.layer > 0 && a.bank), a => a.bank.split(' / ')[0])].map(([bank, v]) => ({ bank, accounts: v.length, inAmt: sum(v, a => a.inAmt), hold: sum(v, a => a.hold), high: v.filter(a => a.score >= 60).length, recs: v }));
    const xl = () => Analysis.crossLinks().filter(x => x.refs >= 2);
    return {
      kpi: [
        cmp,
        { title: 'Money in trail (layer 1)', rows: l1, cols: txnCols, sort: 'amount', pv: r => [(r.to_name || accLabel(r.to_acc) || '') + (r.to_bank ? ' · ' + r.to_bank : ''), fmtINR(r.amount)], page: ['financial', 'trail'], total: r => r.amount },
        { title: 'Amount on hold / lien', rows: held, cols: accCols, sort: 'hold', pv: r => [accLabel(r.acc) || r.label, fmtINR(r.hold)], onRow: r => r.acc && showAccount(r.acc), page: ['financial', 'suspects'], total: r => r.hold },
        { title: 'Accounts in trail', rows: () => acc, cols: accCols, sort: 'inAmt', pv: accPv, onRow: r => showAccount(r.acc), page: ['financial', 'suspects'], total: r => r.inAmt },
        { title: 'High-risk accounts (score ≥ 60)', rows: () => acc.filter(a => a.score >= 60), cols: accCols, sort: 'score', pv: r => [accLabel(r.acc) + (r.name ? ' · ' + r.name.split(' / ')[0] : ''), 'risk ' + r.score], onRow: r => showAccount(r.acc), page: ['financial', 'suspects'], total: r => r.inAmt },
        { title: 'Cross-linked identifiers', rows: xl, cols: [{ key: 'type', label: 'Type' }, { key: 'value', label: 'Value', render: r => `<b class="mono">${esc(r.value)}</b>` }, { key: 'refs', label: 'Places', num: true }, { key: 'sectionList', label: 'Found in', csv: r => CX.itext(r.items), render: r => CX.ichips(r.items) }, CX.col(r => r.value), { key: 'refList', label: 'Where' }], sort: 'refs', pv: r => [r.type + ' · ' + r.value, r.refs + ' places'], page: ['analytics', 'cross'] }
      ],
      step: [
        { title: 'Imported files', rows: () => d.imports.slice().reverse(), cols: [{ key: 'when', label: 'When', render: r => esc(String(r.when || '').replace('T', ' ').slice(0, 16)) }, { key: 'file', label: 'File' }, { key: 'type', label: 'Type' }, { key: 'count', label: 'Records', num: true }], sort: 'when', pv: r => [r.file, fmtNum(r.count || 0)], page: ['financial', 'data'] },
        cmp,
        { title: 'Mule accounts (high-risk)', rows: () => acc.filter(a => a.score >= 60 || a.acks >= 2), cols: accCols, sort: 'score', pv: r => [accLabel(r.acc) + (r.name ? ' · ' + r.name.split(' / ')[0] : ''), r.acks >= 2 ? r.acks + ' complaints' : 'risk ' + r.score], onRow: r => showAccount(r.acc), page: ['financial', 'suspects'], total: r => r.inAmt },
        { title: 'Shared identifiers (social ↔ bank)', rows: xl, cols: [{ key: 'type', label: 'Type' }, { key: 'value', label: 'Value', render: r => `<b class="mono">${esc(r.value)}</b>` }, { key: 'refs', label: 'Places', num: true }, { key: 'sectionList', label: 'Found in', csv: r => CX.itext(r.items), render: r => CX.ichips(r.items) }, CX.col(r => r.value), { key: 'refList', label: 'Where' }], sort: 'refs', pv: r => [r.type + ' · ' + r.value, r.refs + ' places'], page: ['analytics', 'cross'] },
        { title: 'Banks to write to', rows: banks, cols: [{ key: 'bank', label: 'Bank', render: r => `<b>${esc(r.bank)}</b>` }, { key: 'accounts', label: 'Accounts', num: true }, { key: 'high', label: 'High-risk', num: true }, INR('inAmt', 'Received'), INR('hold', 'On hold')], sort: 'inAmt', pv: r => [r.bank + ' · ' + r.accounts + ' acc', fmtINR(r.inAmt)], onRow: r => { UI.closeDrawer(); S.filterBank = r.bank; go('financial', 'suspects'); }, page: ['others', 'notices'], total: r => r.inAmt }
      ],
      cs: {
        all: { title: 'All cases', rows: () => S.cases },
        done: { title: 'Completed cases', rows: () => S.cases.filter(c => CaseStat.done(c)) },
        pend: { title: 'Pending cases', rows: () => S.cases.filter(c => !CaseStat.done(c)) }
      }
    };
  },
  tip(el, def) {
    let t = $('#dxTip'); if (!t) { document.body.insertAdjacentHTML('beforeend', '<div id="dxTip" class="dx-tip"></div>'); t = $('#dxTip'); }
    if (!def) { t.classList.remove('on'); return; }
    let R = []; try { R = def.rows() || []; } catch (e) { }
    const top = def.sort ? R.slice().sort((a, b) => { const x = a[def.sort], y = b[def.sort]; return typeof x === 'number' ? (y || 0) - (x || 0) : String(y || '').localeCompare(String(x || '')); }) : R;
    const pv = def.pv || (c => [c.name + (c.fir ? ' · FIR ' + c.fir : ''), c.status || 'Pending']);
    t.innerHTML = `<div class="dx-th"><b>${esc(def.title)}</b><span>${fmtNum(R.length)}</span></div>${R.length ? `<div class="dx-tl">${top.slice(0, 5).map(r => { const [a, b] = pv(r); return `<div><span>${esc(String(a || '—'))}</span><b>${esc(String(b || ''))}</b></div>`; }).join('')}</div>` : '<div class="muted small">Nothing yet.</div>'}<div class="dx-tf">${R.length > 5 ? `+ ${fmtNum(R.length - 5)} more · ` : ''}Click to open all</div>`;
    const r = el.getBoundingClientRect(), w = 320; t.style.width = w + 'px';
    t.style.left = Math.min(innerWidth - w - 10, Math.max(10, r.left + r.width / 2 - w / 2)) + 'px';
    t.classList.add('on'); const h = t.offsetHeight;
    t.style.top = (r.bottom + 8 + h > innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 8) + 'px';
  },
  open(def) {
    this.tip(null, null);
    const R = def.rows() || [], tot = def.total ? sum(R, def.total) : 0;
    const body = UI.drawer(`${def.title} (${fmtNum(R.length)})`, `<div class="dx-head"><div><b>${fmtNum(R.length)}</b><span>records</span></div>${def.total ? `<div><b>${fmtINR(tot)}</b><span>total</span></div>` : ''}${def.page ? `<button class="btn sm srch" data-dxgo>Open full page ›</button>` : ''}</div><div id="dxT"></div>`);
    $('#drawer').classList.add('dx-wide');
    Table($('#dxT', body), { rows: R, columns: def.cols, sortKey: def.sort, sortDir: -1, pageSize: 50, exportName: def.title.toLowerCase().replace(/\W+/g, '_'), onRow: def.onRow, after: t => bindAccLinks(t) });
    bindAccLinks(body);
    const g = $('[data-dxgo]', body); if (g) g.onclick = () => { UI.closeDrawer(); go(def.page[0], def.page[1]); };
  },
  bind(el, def, click = true) {
    el.classList.add('dx-live'); el.setAttribute('tabindex', '0');
    el.addEventListener('mouseenter', () => this.tip(el, def)); el.addEventListener('mouseleave', () => this.tip(null, null));
    if (click) { el.onclick = e => { if (e.target.closest('a[data-acc]')) return; this.open(def); }; el.onkeydown = e => { if (e.key === 'Enter') this.open(def); }; }
  }
};
(() => {
  const od = UI.drawer; UI.drawer = function () { $('#drawer').classList.remove('dx-wide'); return od.apply(this, arguments); };
  const og = Pages.dashboard;
  Pages.dashboard = function (main) {
    const r = og.apply(this, arguments);
    try {
      const D = DashX.defs();
      $$('.kpis', main)[0] && $$('.kpi', $$('.kpis', main)[0]).forEach((k, i) => { if (D.kpi[i]) { DashX.bind(k, D.kpi[i]); k.insertAdjacentHTML('beforeend', '<span class="dx-more">View all ›</span>'); } });
      $$('.steps .step', main).forEach((s, i) => { if (D.step[i]) { DashX.bind(s, D.step[i]); s.insertAdjacentHTML('beforeend', `<span class="dx-cnt">${fmtNum((D.step[i].rows() || []).length)}</span>`); } });
      $$('[data-cs]', main).forEach(b => D.cs[b.dataset.cs] && DashX.bind(b, D.cs[b.dataset.cs], false));
    } catch (e) { console.error(e); }
    return r;
  };
  const or = render; render = function () { DashX.tip(null, null); return or.apply(this, arguments); };
})();
