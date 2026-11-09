/* pagecharts.js – an "At a glance" card with bar + round charts on pages that only had tables.
   Each entry returns a list of charts: [title, data [{label, value, sub}], fmt]. */
'use strict';
(() => {
  // each bar keeps the records behind it (recs), so a click can list them
  const cnt = (arr, key) => { const M = new Map(); arr.forEach(x => { const k = typeof key === 'function' ? key(x) : x[key]; if (k == null || k === '') return; (M.get(k) || M.set(k, []).get(k)).push(x); }); return [...M].map(([label, recs]) => ({ label: String(label), value: recs.length, recs })).sort((a, b) => b.value - a.value); };
  const add = (arr, key, val) => { const M = new Map(); arr.forEach(x => { const k = typeof key === 'function' ? key(x) : x[key]; if (k == null || k === '') return; const g = M.get(k) || M.set(k, { v: 0, recs: [] }).get(k); g.v += +val(x) || 0; g.recs.push(x); }); return [...M].map(([label, g]) => ({ label: String(label), value: g.v, recs: g.recs })).filter(d => d.value > 0).sort((a, b) => b.value - a.value); };
  const recs = n => v => fmtNum(v) + ' ' + (v === 1 ? ({ IPs: 'IP', CAFs: 'CAF', SIMs: 'SIM' }[n] || n.replace(/ies$/, 'y').replace(/s$/, '')) : n);
  const bank1 = a => (a.bank || '').split(' / ')[0] || 'Unknown';
  const accs = () => Analysis.accountRows().filter(a => !isSynthetic(a.acc));
  const risk = a => a.score >= 60 ? 'High risk (60+)' : a.score >= 30 ? 'Medium risk (30–59)' : 'Low risk (< 30)';
  const commonCounts = (fields, fn, lab) => fields.map(f => { let g = []; try { g = fn(f); } catch (e) { } return { label: lab(f), value: g.length, recs: g.map(({ recs, ...x }) => x) }; }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  const months = (arr, key) => cnt(arr.filter(x => x[key]), x => String(x[key]).slice(0, 7)).sort((a, b) => a.label.localeCompare(b.label));
  const G = {
    'financial/data': () => [['Amount by payment mode', add(S.data.txns, t => t.mode || 'Unknown', t => Math.abs(t.amount)), fmtINR], ['Transactions by layer', cnt(S.data.txns.filter(t => t.layer), t => 'Layer ' + t.layer).sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })), recs('txns'), 'v']],
    'financial/trail': () => [['Money received by layer', add(accs().filter(a => a.layer > 0), a => 'Layer ' + a.layer, a => a.inAmt).sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })), fmtINR, 'v'], ['Accounts by bank', cnt(accs().filter(a => a.layer > 0), bank1), recs('accounts')]],
    'financial/suspects': () => [['Accounts by risk level', cnt(accs(), risk), recs('accounts')], ['Top suspect accounts by money received', accs().sort((a, b) => b.inAmt - a.inAmt).slice(0, 10).map(a => ({ label: a.acc, value: a.inAmt, sub: [a.name, bank1(a), 'risk ' + a.score].filter(Boolean).join(' · '), recs: [a] })), fmtINR]],
    'financial/common': () => [['Shared values by type', commonCounts(['account', 'beneficiary', 'mobile', 'email', 'pan', 'aadhaar', 'ifsc', 'name'], f => Analysis.finCommon(f).filter(g => g.n >= 2), f => Analysis.FIN_COMMON[f].label), recs('shared values')]],
    'financial/kyc': () => [['KYC records by bank', cnt(S.data.kyc, k => k.bank || 'Unknown'), recs('records')], ['KYC records by state', cnt(S.data.kyc, 'state'), recs('records')]],
    'financial/banks': () => [['Money received by bank', add(accs().filter(a => a.layer > 0), bank1, a => a.inAmt), fmtINR], ['Amount on hold by bank', add(accs(), bank1, a => a.hold), fmtINR]],
    'social/common': () => [['Shared values by type', commonCounts(['mobile', 'email', 'imei', 'ip'], f => Analysis.socCommon(f).filter(g => g.profiles >= 2), f => f.toUpperCase()), recs('shared values')], ['Records by platform', cnt(S.data.social, s => s.platform || 'Other'), recs('records')]],
    'ncrp/data': () => [['Complaints by category', cnt(S.data.ncrp, n => n.sub_category || n.category || 'Not given'), recs('complaints')], ['Reported loss by district', add(S.data.ncrp, n => n.district || 'Not given', n => n.amount), fmtINR]],
    'ncrp/link': () => [['Complaints by status', cnt(S.data.ncrp, n => n.status || 'Not given'), recs('complaints')], ['Loss vs on hold', [{ label: 'Still lost', value: Math.max(0, S.data.ncrp.reduce((a, n) => a + (+n.amount || 0), 0) - S.data.ncrp.reduce((a, n) => a + (+n.hold_amount || 0), 0)) }, { label: 'On hold', value: S.data.ncrp.reduce((a, n) => a + (+n.hold_amount || 0), 0) }], fmtINR]],
    'ncrp/common': () => [['Complaints by district', cnt(S.data.ncrp, 'district'), recs('complaints')], ['Complaints by month', months(S.data.ncrp, 'date'), recs('complaints'), 'v']],
    'analytics/common': () => [['Shared values by type', commonCounts(['account', 'mobile', 'email', 'pan', 'aadhaar', 'ifsc'], f => Analysis.finCommon(f).filter(g => g.n >= 2), f => Analysis.FIN_COMMON[f].label), recs('shared values')]],
    'analytics/flags': () => { const F = new Map(); accs().forEach(a => (a.flags || []).forEach(f => { const k = /complaints/i.test(f) ? 'In 2 or more complaints' : /senders/i.test(f) ? 'Paid by many senders' : /^Pass-through/.test(f) ? 'Pass-through (out ≥ 80% of in)' : /^Shares KYC/.test(f) ? 'Shares KYC details with others' : /sent to \d+/i.test(f) ? 'Bulk split (sent to many)' : f.slice(0, 40); (F.get(k) || F.set(k, []).get(k)).push(a); })); return [['Mule flags found', [...F].map(([label, recs]) => ({ label, value: recs.length, recs })).sort((a, b) => b.value - a.value), recs('accounts')], ['Accounts by risk level', cnt(accs(), risk), recs('accounts')]]; },
    'analytics/velocity': () => [['Money received by layer', add(accs().filter(a => a.layer > 0), a => 'Layer ' + a.layer, a => a.inAmt).sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })), fmtINR, 'v'], ['Cash / ATM withdrawn by bank', add(accs(), bank1, a => a.cashOut), fmtINR]],
    'analytics/cross': () => { let X = []; try { X = Analysis.crossLinks().filter(x => x.refs >= 2); } catch (e) { } return [['Cross-linked identifiers by type', cnt(X, 'type'), recs('identifiers')], ['Seen in how many sources', cnt(X, x => x.sections + ' sources'), recs('identifiers')]]; },
    'analytics/round': () => [['Accounts by risk level', cnt(accs(), risk), recs('accounts')]],
    'caf/data': () => { const L = CAF.list(); return [['CAFs by operator', cnt(L, c => c.operator || 'Not known'), recs('CAFs')], ['SIMs by POS', cnt(L, c => c.pos_name || c.pos_code), recs('SIMs')], ['Activations by month', months(L, 'act_date'), recs('SIMs'), 'v']]; },
    'caf/common': () => { const L = CAF.list(); return [['SIMs by POS agent', cnt(L, 'pos_agent'), recs('SIMs')], ['SIMs by activation date', cnt(L, 'act_date').slice(0, 15).sort((a, b) => a.label.localeCompare(b.label)), recs('SIMs'), 'v']]; },
    'trail/trail': () => G['trail/'](),
    'trail/': () => [['Money received by layer', add(accs().filter(a => a.layer > 0), a => 'Layer ' + a.layer, a => a.inAmt).sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })), fmtINR, 'v'], ['Money received by bank', add(accs().filter(a => a.layer > 0), bank1, a => a.inAmt), fmtINR]],
    'others/notes': () => [['Tasks', [{ label: 'Done', value: S.data.tasks.filter(t => t.done).length }, { label: 'Pending', value: S.data.tasks.filter(t => !t.done).length }].filter(d => d.value), recs('tasks')], ['Notes by tag', cnt(S.data.notes, n => n.tag || 'Note'), recs('notes')]]
  };
  let n = 0;
  const inject = page => {
    const tab = $('#main .tabs .tab.active'), key = page + '/' + (tab ? tab.dataset.t : '');
    const fn = G[key];
    if (!fn) return;
    let list; try { list = fn().filter(c => c[1] && c[1].length >= 1 && c[1].some(d => d.value > 0)); } catch (e) { console.warn('glance', key, e); return; }
    if (!list.length) return;
    const host = $('#tabBody') || $('#main'); if (!host || host.querySelector('.glance')) return;
    const id = 'gl' + (++n);
    const box = document.createElement('div'); box.className = 'card glance';
    box.innerHTML = `<h3>📊 At a glance</h3><div class="sub">Hover a bar or slice to see its figures. <b>Click it to see all its records on the right.</b> Switch between Bar, Round and Both.</div><div class="glance-g g${Math.min(list.length, 3)}">${list.map((c, i) => `<div class="glance-c"><h4>${esc(c[0])}</h4><div id="${id}_${i}"></div></div>`).join('')}</div>`;
    const k = host.querySelector(':scope > .kpis') || host.querySelector(':scope > .note') || host.querySelector(':scope > .caf-drop') || (host.id === 'main' && host.querySelector(':scope > .page-title'));
    k ? k.after(box) : host.prepend(box);
    list.forEach((c, i) => { const el = $('#' + id + '_' + i); el.id = 'glc_' + key.replace(/\W/g, '_') + '_' + i; (c[3] === 'v' ? Charts.vbar : Charts.hbar)(el, c[1], { fmt: c[2] || fmtNum, max: 10 }); if (typeof Records !== 'undefined') Records.bind(el, c[0], c[1], c[3] === 'v' ? 1e9 : 10); });
  };
  Object.keys(Pages).forEach(p => { const orig = Pages[p]; Pages[p] = function (main) { const r = orig.apply(this, arguments); try { inject(p); } catch (e) { console.warn(e); } return r; }; });
  // tab clicks inside a page re-render only the tab body: watch for that too
  new MutationObserver(() => { const p = S.page; if (p && !$('#main .glance')) { try { inject(p); } catch (e) { } } }).observe($('#main'), { childList: true });
})();
