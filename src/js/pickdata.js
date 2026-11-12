/* pickdata.js – fast open: after login nothing is loaded. The Dashboard shows a "Choose Data" screen (All Cases / FIR / NCRP /
   one case) built only from the case list, so the tool opens at once. Choosing loads only that data. */
'use strict';
const PickData = {
  PAGES: /^(dashboard|financial|social|ncrp|analytics|trail|caf|tele|others|search|cctns)$/,
  on: () => S.caseId === '__none',
  show(main) {
    const F = S.cases.filter(c => AllMode.cat(c) === 'fir'), N = S.cases.filter(c => AllMode.cat(c) === 'ncrp'), st = this._st || (this._st = { q: '', f: '' });
    const tile = (v, i, t, n, c, d) => `<button class="pk-t" data-pk="${v}" style="--c:${c}"><span class="pk-i">${i}</span><b>${t}</b><span class="pk-n">${fmtNum(n)}</span><small>${d}</small></button>`;
    const q = st.q.toLowerCase(), L = S.cases.filter(c => (!st.f || AllMode.cat(c) === st.f) && (!q || [c.name, c.fir, c.ack, c.ps, c.io, c.section].join(' ').toLowerCase().includes(q)));
    main.innerHTML = `<div class="hero-card dash-hero"><div class="dash-brand"><span class="ck-wrap db-mark"><i class="ck" aria-hidden="true"></i><span class="emblem emblem-sm" aria-hidden="true"></span></span><div class="db-txt"><div class="db-hi" lang="hi">सुदर्शनास्त्र</div><div class="db-en">SudarshanAshtra</div><div class="db-tag">Cyber Crime Analysis &amp; Tracking</div></div></div><div class="db-sep" aria-hidden="true"></div><div class="grow db-case"><div class="db-lbl">Choose Data</div><h2>What Do You Want To See?</h2><div class="sub2">Nothing is loaded yet, so the tool opens fast. Pick All Cases, FIR Cases, NCRP or one case – only that data is loaded. You can change it any time in the <b>CASE</b> box at the top ↑</div></div></div>
      <div class="pk-tiles">${S.cases.length > 1 ? tile('__all', '🗂', 'All Cases', S.cases.length, '#6366f1', 'Every case together – analysis at a glance') : ''}${S.cases.length > 1 && F.length ? tile('__fir', '📁', 'FIR Cases', F.length, '#0891b2', 'Cases with an FIR number') : ''}${S.cases.length > 1 && N.length ? tile('__ncrp', '🧾', 'NCRP (Without FIR)', N.length, '#d97706', 'Complaints with no FIR yet') : ''}${S.prevCase && S.cases.some(c => c.id === S.prevCase) ? tile(S.prevCase, '⏮', 'Last Case', 1, '#16a34a', esc(AllMode.caseLabel(S.cases.find(c => c.id === S.prevCase)))) : ''}</div>
      <div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">📄 One Case <span class="badge">${fmtNum(L.length)}</span></h3><div class="seg"><button class="btn sm ${!st.f ? 'primary' : ''}" data-pf="">All (${S.cases.length})</button><button class="btn sm ${st.f === 'fir' ? 'primary' : ''}" data-pf="fir">FIR (${F.length})</button><button class="btn sm ${st.f === 'ncrp' ? 'primary' : ''}" data-pf="ncrp">NCRP (${N.length})</button></div><input id="pkQ" placeholder="Find case, FIR, Ack No., PS, IO…" value="${esc(st.q)}" style="max-width:300px"></div>
        <div class="am-list" style="margin-top:12px">${L.map(c => `<button class="am-c" data-pk="${c.id}"><b>${esc(AllMode.caseLabel(c))}</b><small>${esc([AllMode.cat(c) === 'fir' ? 'FIR case' : 'NCRP – no FIR yet', c.ps, c.io && 'IO ' + c.io, c.final ? (c.final.type === 'PPI' ? 'CS-PPI' : c.final.type) : c.status].filter(Boolean).join(' · '))}</small></button>`).join('') || '<div class="muted">No case matches</div>'}</div></div>`;
    $$('[data-pk]', main).forEach(b => b.onclick = () => { b.disabled = true; b.classList.add('pk-wait'); switchCase(b.dataset.pk); });
    $$('[data-pf]', main).forEach(b => b.onclick = () => { st.f = b.dataset.pf; this.show(main); });
    const qi = $('#pkQ', main); qi.oninput = () => { st.q = qi.value; const p = qi.selectionStart; this.show(main); const n = $('#pkQ', main); n.focus(); n.setSelectionRange(p, p); };
  }
};
(() => {
  AllMode.SC.__none = ['🏁', 'Choose Data'];
  const ol = AllMode.list; AllMode.list = function (sc = S.caseId) { return sc === '__none' ? [] : ol.call(this, sc); };
  const oo = AllMode.options; AllMode.options = function () { return `<option value="__none" ${S.caseId === '__none' ? 'selected' : ''}>🏁 Choose Data…</option>` + oo.apply(this, arguments); };
  const lz = AllMode.lazy; AllMode.lazy = function (sc) { return sc === '__none' ? Promise.resolve(Object.assign(emptyCase(), { _all: '__none' })) : lz.apply(this, arguments); };
  const rf = AllMode.refresh; AllMode.refresh = function () { if (S.caseId === '__none') { fillCaseSel(); return render(); } return rf.apply(this, arguments); };
  const aw = AllMode.warn; AllMode.warn = function () { if (S.caseId === '__none') return UI.toast('Choose a case first – in the CASE box at the top', 4000); return aw.apply(this, arguments); };
  const r0 = render; render = function () {
    if (S.caseId === '__none' && PickData.PAGES.test(S.page)) { $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === S.page)); if (S.page !== 'dashboard') S.page = 'dashboard'; return PickData.show($('#main')); }
    return r0.apply(this, arguments);
  };
  /* every fresh login starts on "Choose Data"; a page refresh keeps the choice */
  const st0 = start; start = async function () { if (!sessionStorage.getItem('sud-picked')) { S.prevCase = await DB.get('caseId'); if (isScope(S.prevCase)) S.prevCase = null; await DB.set('caseId', '__none'); if (!S.settings.mustChange) S.page = 'dashboard'; } return st0.apply(this, arguments); };
  const sw = switchCase; switchCase = async function (id) { try { sessionStorage.setItem('sud-picked', id === '__none' ? '' : '1'); } catch (e) { } return sw.apply(this, arguments); };
  const lk = lock; lock = function () { try { sessionStorage.removeItem('sud-picked'); } catch (e) { } if (S.data && S.caseId && !isScope(S.caseId)) { clearTimeout(saveTimer); DB.set('case:' + S.caseId, S.data).catch(() => { }); } const r = lk.apply(this, arguments); S.data = null; return r; };
})();
