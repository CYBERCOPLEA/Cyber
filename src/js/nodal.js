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
  col() { return { key: 'ntype', label: 'A/C Type', render: r => this.badge(r.acc), csv: r => this.text(r.acc), sortVal: r => this.of(r.acc) ? 1 : 0 }; }
};
/* every account list gets the choice: All / Without Nodal / With Nodal */
{ const _at = accountTable;
  accountTable = function (el, rows, o = {}) {
    const wo = rows.filter(r => !Nodal.of(r.acc)), wi = rows.filter(r => Nodal.of(r.acc)), f = S.nodalF || 'all';
    el.innerHTML = `<div class="nd-bar"><span class="nd-l">Show</span>${[['all', 'All Bank Accounts', rows.length], ['wo', '🎯 Bank A/C Without Nodal A/C', wo.length], ['wi', '🏛️ Bank A/C With Nodal A/C', wi.length]].map(([k, l, n]) => `<button class="nd-b no-tc ${k} ${k === f ? 'on' : ''}" data-nd="${k}">${l} <b>${fmtNum(n)}</b></button>`).join('')}
      <div class="small muted nd-h"><b>Without Nodal</b> = own / mule account – freeze and act first. <b>With Nodal</b> = nodal / escrow / payment-gateway / wallet pool account – ask it for the next beneficiary.</div></div><div class="nd-t"></div>`;
    $$('[data-nd]', el).forEach(b => b.onclick = () => { S.nodalF = b.dataset.nd; accountTable(el, rows, o); });
    _at($('.nd-t', el), f === 'wo' ? wo : f === 'wi' ? wi : rows, o);
  };
}
