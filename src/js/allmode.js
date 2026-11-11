/* allmode.js – "🗂 All Cases" in the top Case drop-down: every page reads the combined data of all cases
   (read-only). Pages that work on one case (Case File & Notices) ask you to pick the case. */
'use strict';
const AllMode = {
  on: () => S.caseId === '__all',
  pick() { return S.prevCase && S.cases.some(c => c.id === S.prevCase) ? S.prevCase : (S.cases[0] || {}).id; },
  async merge() {
    const out = emptyCase();
    for (const c of S.cases) {
      const d = await DB.get('case:' + c.id) || {};
      for (const [k, v] of Object.entries(d)) {
        if (!Array.isArray(v) || !v.length) continue;
        const a = out[k] || (out[k] = []);
        for (const r of v) a.push(r && typeof r === 'object' && !Array.isArray(r) ? { ...r, _case: c.name || '', _caseId: c.id } : r);
      }
    }
    out._all = true; return out;
  },
  _w: 0,
  warn() { if (Date.now() - this._w < 20000) return; this._w = Date.now(); UI.toast('All Cases view is for viewing only – choose one case in the Case box to add or change data', 5000); },
  one(main, what) {
    main.innerHTML = `<div class="card am-pick"><h3>📁 Choose A Case</h3><div class="small muted" style="margin-bottom:12px">${esc(what)} works on one case. You are viewing <b>All Cases</b> – pick the case to open:</div>
      <div class="am-list">${S.cases.map(c => `<button class="am-c" data-am="${c.id}"><b>${esc(c.name || '')}</b><small>${esc([c.fir && 'FIR ' + c.fir, c.ps, c.io && 'IO ' + c.io, c.final ? (c.final.type === 'PPI' ? 'CS-PPI' : c.final.type) : c.status].filter(Boolean).join(' · '))}</small></button>`).join('')}</div></div>`;
    $$('[data-am]', main).forEach(b => b.onclick = () => switchCase(b.dataset.am));
  }
};
(() => {
  const ONE = { others: 'Case File & Notices (case details, notes, notice drafts, reports)' };
  for (const [p, what] of Object.entries(ONE)) { const og = Pages[p]; if (!og) continue; Pages[p] = function (main) { if (AllMode.on()) return AllMode.one(main, what); return og.apply(this, arguments); }; }
  // "common with your other cases" bar has no meaning when every case is already combined
  if (typeof CaseCommon !== 'undefined' && CaseCommon.mount) { const m = CaseCommon.mount; CaseCommon.mount = function () { if (AllMode.on()) return; return m.apply(this, arguments); }; }
  // files imported by FIR while viewing All → read the cases again
  if (typeof Hub !== 'undefined') { const hr = Hub.run; Hub.run = async function () { const r = await hr.apply(this, arguments); if (AllMode.on()) { S.data = await AllMode.merge(); Analysis.invalidate(); AllDash.C.clear(); render(); } return r; }; }
  // a case deleted / renamed while viewing All → rebuild the combined data
  const dc = window.deleteCase; if (typeof dc === 'function') deleteCase = async function () { const r = await dc.apply(this, arguments); if (AllMode.on()) { if (S.cases.length < 2) await switchCase(S.cases[0].id); else { S.data = await AllMode.merge(); Analysis.invalidate(); fillCaseSel(); render(); } } return r; };
})();
