/* glancerecs.js – click a bar or slice in any "At a glance" chart: the records behind it open on the right */
'use strict';
const Records = {
  PRI: ['ack_no', 'acc', 'value', 'label', 'from_acc', 'from_name', 'to_acc', 'to_name', 'name', 'victim', 'layer', 'amount', 'inAmt', 'outAmt', 'hold', 'date', 'txn_id', 'mode', 'action', 'bank', 'to_bank', 'ifsc', 'to_ifsc',
    'mobile', 'email', 'pan', 'aadhaar', 'state', 'district', 'category', 'sub_category', 'status', 'platform', 'profile', 'ip', 'operator', 'pos_name', 'pos_code', 'pos_agent', 'act_date', 'alt', 'score', 'flags', 'n', 'accs', 'acks', 'title', 'text', 'tag', 'file', '_src'],
  NAMES: { ack_no: 'Ack No', acc: 'Account', from_acc: 'From account', from_name: 'From name', to_acc: 'To account', to_name: 'Beneficiary', inAmt: 'Received', outAmt: 'Sent', txn_id: 'Txn ID / UTR', to_bank: 'Bank', to_ifsc: 'IFSC', ifsc: 'IFSC', pan: 'PAN', ip: 'IP', act_date: 'Activation date', pos_name: 'POS', pos_code: 'POS code', pos_agent: 'POS agent', alt: 'Alternate no.', sub_category: 'Sub-category', n: 'Times', accs: 'Accounts', acks: 'Complaints', _src: 'File', value: 'Value' },
  ACC: new Set(['acc', 'from_acc', 'to_acc']), MONEY: new Set(['amount', 'inAmt', 'outAmt', 'hold', 'disputed', 'hold_amount', 'cashOut']),
  label(k) { return this.NAMES[k] || (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' '); },
  show(title, recs) {
    if (!recs || !recs.length) return;
    const seen = new Set(); recs.slice(0, 300).forEach(r => Object.keys(r).forEach(k => { const v = r[k]; if (v == null || v === '' || typeof v === 'function') return; if ((k.startsWith('_') && k !== '_src') || k === 'id' || k === 'fx' || k === 'readable' || (k === 'text' && String(v).length > 200) || k === 'photos' || k === 'pairs' || k === 'recs' || k === 'pages') return; if (typeof v === 'object' && !(Array.isArray(v) && v.every(x => typeof x !== 'object'))) return; seen.add(k); }));
    const keys = [...this.PRI.filter(k => seen.has(k)), ...[...seen].filter(k => !this.PRI.includes(k))].slice(0, 18);
    const amt = recs.some(r => r.amount != null) ? sum(recs, r => Math.abs(+r.amount || 0)) : null;
    const body = UI.drawer(title, `<div class="rec-kpi"><div><b>${fmtNum(recs.length)}</b><span>record${recs.length === 1 ? '' : 's'}</span></div>${amt != null ? `<div><b>${fmtINR(amt)}</b><span>total amount</span></div>` : ''}${recs.some(r => r.acc || r.to_acc) ? `<div><b>${fmtNum(uniq(recs.map(r => r.acc || r.to_acc).filter(Boolean)).length)}</b><span>accounts</span></div>` : ''}</div><div id="recT"></div>`);
    $('#drawer').classList.add('dr-wide');
    Table($('#recT', body), { rows: recs, exportName: 'records_' + title.replace(/\W+/g, '_').slice(0, 40), pageSize: 50,
      columns: keys.map(k => ({ key: k, label: this.label(k), num: this.MONEY.has(k) || k === 'layer' || k === 'score',
        render: r => { const v = r[k]; if (v == null) return ''; if (this.ACC.has(k)) return accLink(String(v)); if (this.MONEY.has(k)) return fmtINR(v); if (Array.isArray(v)) return esc(v.join('; ')); const s = String(v); return s.length > 90 ? `<span title="${esc(s)}">${esc(s.slice(0, 90))}…</span>` : esc(s); },
        csv: r => Array.isArray(r[k]) ? r[k].join('; ') : r[k] })),
      after: bindAccLinks, onRow: r => { if (r.pairs && typeof CAF !== 'undefined') CAF.show(r); else if (r.acc && !isSynthetic(r.acc)) showAccount(r.acc); else if (r.to_acc) showAccount(r.to_acc); } });
  },
  // hook a glance chart: el = chart host, data = its [{label, value, recs}], max = bars shown before "Others"
  bind(el, title, data, max) {
    if (!data.some(d => d.recs && d.recs.length)) return;
    el.classList.add('rec-click');
    el.addEventListener('click', e => {
      if (e.target.closest('.ch-sw')) return;
      const it = e.target.closest('[data-i],[data-li]'); if (!it || !el.contains(it)) return;
      const i = +(it.dataset.i ?? it.dataset.li); let d = data[i], recs, lab;
      if (i >= max || !d) { recs = data.slice(max).flatMap(x => x.recs || []); lab = 'Others'; } else { recs = d.recs || []; lab = d.label; }
      Charts.tip(e, null); Records.show(`${title} – ${lab}`, recs);
    });
  }
};
(() => { const od = UI.drawer; UI.drawer = function () { $('#drawer').classList.remove('dr-wide'); return od.apply(this, arguments); }; })();
