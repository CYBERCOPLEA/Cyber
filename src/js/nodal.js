/* nodal.js – Bank Account without Nodal A/C (own / mule accounts) vs Bank Account with Nodal A/C
   (nodal / escrow / pool accounts of payment gateways, wallets, aggregators). Read from account name,
   bank action and remarks in the trail and KYC. Everything stays on this computer. */
'use strict';
const Nodal = {
  map() {
    return Analysis.cached('nodal', () => {
      const T = new Map(), M = new Map();
      const add = (a, ...x) => { if (!a) return; const s = T.get(a) || ''; if (s.length < 4000) T.set(a, s + ' ' + x.filter(Boolean).join(' ')); };
      for (const t of S.data.txns || []) add(t.to_acc, t.to_name, t.action, t.remarks, t.narration);
      for (const k of S.data.kyc || []) add(k.acc, k.name, k.acc_type, k.type, k.remarks);
      for (const [a, s] of T) { const u = s.toUpperCase(); for (const [t, rx] of ACC_TYPES.slice(0, 3)) if (rx.test(u)) { M.set(a, t); break; } }
      return M;
    });
  },
  of(acc) { try { return this.map().get(acc) || ''; } catch (e) { return ''; } },
  badge(acc) { const t = this.of(acc); return t ? `<span class="nd-tag wi" title="Nodal / pool account – ask for the next beneficiary, not the fraudster's own account">🏛️ With Nodal · ${esc(t)}</span>` : `<span class="nd-tag wo" title="Own / mule account – freeze and act first">🎯 Without Nodal</span>`; },
  text(acc) { const t = this.of(acc); return t ? 'With Nodal A/C (' + t + ')' : 'Without Nodal A/C'; },
  OPTS: (a, o, i) => [['all', '🗂 All Accounts', a], ['wo', '🎯 Without Nodal ~ Escrow', o], ['wi', '🏛️ With Nodal ~ Escrow', i]],
  col() { return { key: 'ntype', label: 'A/C Type', render: r => this.badge(r.acc), csv: r => this.text(r.acc), sortVal: r => this.of(r.acc) ? 1 : 0 }; }
};
/* every account list gets the choice: All / Without Nodal / With Nodal */
{ const _at = accountTable;
  accountTable = function (el, rows, o = {}) {
    const wo = rows.filter(r => !Nodal.of(r.acc)), wi = rows.filter(r => Nodal.of(r.acc)), f = S.nodalF || 'all';
    el.innerHTML = `<div class="nd-bar"><span class="nd-l">Show</span>${Nodal.OPTS(rows.length, wo.length, wi.length).map(([k, l, n]) => `<button class="nd-b no-tc ${k} ${k === f ? 'on' : ''}" data-nd="${k}">${l} <b>${fmtNum(n)}</b></button>`).join('')}
      <div class="small muted nd-h"><b>Without Nodal</b> = own / mule account – freeze and act first. <b>With Nodal</b> = nodal / escrow / payment-gateway / wallet pool account – ask it for the next beneficiary.</div></div><div class="nd-t"></div>`;
    $$('[data-nd]', el).forEach(b => b.onclick = () => { S.nodalF = b.dataset.nd; accountTable(el, rows, o); });
    _at($('.nd-t', el), f === 'wo' ? wo : f === 'wi' ? wi : rows, o);
  };
}

/* whole tool: every table that lists bank accounts (account lists, trails, transactions, links…) gets the same
   All Accounts / Without Nodal ~ Escrow / With Nodal ~ Escrow choice. One choice for the whole tool (S.nodalF). */
{ const T0 = Table;
  Table = function (box, o) {
    const R = o && o.rows, acc = r => r && typeof r === 'object' ? String(r.acc || r.to_acc || r.account || r.acc_no || '') : '';
    if (!box || !Array.isArray(R) || R.length < 2 || o.noNd || box.closest('.nd-t, .nd-w') || !R.slice(0, 300).some(r => /\d{6,}/.test(acc(r)))) return T0.apply(this, arguments);
    const all = R, isN = r => !!Nodal.of(acc(r)), draw = () => {
      const f = S.nodalF || 'all', wo = all.filter(r => !isN(r)), wi = all.filter(isN);
      box.innerHTML = `<div class="nd-bar nd-sm"><span class="nd-l">Accounts</span>${Nodal.OPTS(all.length, wo.length, wi.length).map(([k, l, n]) => `<button class="nd-b no-tc ${k} ${k === f ? 'on' : ''}" data-nd="${k}" title="${k === 'wo' ? 'Own / mule accounts – freeze and act first' : k === 'wi' ? 'Nodal / escrow / payment-gateway / wallet pool accounts – ask them for the next beneficiary' : 'Every account'}">${l} <b>${fmtNum(n)}</b></button>`).join('')}</div><div class="nd-w"></div>`;
      $$('[data-nd]', box).forEach(b => b.onclick = () => { S.nodalF = b.dataset.nd; draw(); });
      return T0($('.nd-w', box), Object.assign({}, o, { rows: f === 'wo' ? wo : f === 'wi' ? wi : all }));
    };
    let api = draw();
    return { render: () => { api = draw(); }, setRows(r) { o.rows = r; return Table(box, o); } };
  };
}
