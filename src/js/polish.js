/* polish.js – Vijay's list of 13-11-2026 (all links; the EXE uses the same build):
   ⟳ Refresh button before the theme button · Offline heading on every import screen · normal users: no Add Contacts,
   no Import Excel, no Add Web Link · plan ending in under 10 days shows red · the chosen case shows green with white text. */
'use strict';
const Polish = {
  OFF: '<div class="imp-off no-tc" role="note"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="#10b981"/><rect x="8.5" y="11" width="7" height="5.5" rx="1" fill="#fff"/><path d="M10 11V9.5a2 2 0 0 1 4 0V11" fill="none" stroke="#fff" stroke-width="1.6"/></svg><span><b>Offline</b> · Files are read on this computer only. Your case data stays here, never uploaded to any server or online.</span></div>',
  PILL: '<span id="mdOff" class="md-off no-tc" title="Files are read on this computer only – nothing is uploaded"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="#10b981"/><rect x="8.5" y="11" width="7" height="5.5" rx="1" fill="#fff"/><path d="M10 11V9.5a2 2 0 0 1 4 0V11" fill="none" stroke="#fff" stroke-width="1.6"/></svg><b>Offline</b> · read on this computer, never uploaded</span>',
  RFI: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><defs><linearGradient id="RFG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#4f46e5"/></linearGradient></defs><circle cx="12" cy="12" r="11" fill="url(#RFG)"/><path d="M16.9 9.2A5.4 5.4 0 0 0 7.4 8.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M17.3 5.9v3.6h-3.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.1 14.8a5.4 5.4 0 0 0 9.5.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M6.7 18.1v-3.6h3.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  IMP: /(^|[^a-z])(import|upload|reading|read case|choose .*files|add files)/i,
  daysLeft(to, today) { if (!to) return null; const d = (Date.parse(to) - Date.parse(today || new Date().toISOString().slice(0, 10))) / 864e5; return isNaN(d) ? null : Math.ceil(d); },
  user: () => typeof Role !== 'undefined' && !Role.admin(),
  /* web User link (not the EXE, not the Super Admin): no web links at all */
  webUser: () => typeof Role !== 'undefined' && !Role.admin() && !document.documentElement.classList.contains('ed-desk'),
  RES: [[2560, 1600], [2560, 1440], [1920, 1200], [1920, 1080, 1], [1680, 1050], [1600, 900], [1536, 864], [1440, 900], [1366, 768]],
  bestView() {
    const m = $('#bvMenu'); if (!m) return; const dpr = window.devicePixelRatio || 1, W = Math.round(screen.width * dpr), H = Math.round(screen.height * dpr);
    m.innerHTML = `<div class="bv-hd">Screen resolution for the best view</div>` + this.RES.map(r => `<button type="button" class="bv-o${r[2] ? ' rec' : ''}${r[0] === W && r[1] === H ? ' cur' : ''}" data-w="${r[0]}" data-h="${r[1]}"><span>${r[0]} × ${r[1]}</span>${r[2] ? '<em>Recommended</em>' : ''}${r[0] === W && r[1] === H ? '<small>Your screen</small>' : ''}</button>`).join('')
      + `<div class="bv-ft" id="bvNote">Your screen now: <b>${W} × ${H}</b> at ${Math.round(dpr * 100)}% scale. <b>1920 × 1080</b> with Scale 100% or 125% shows every page best.</div>`;
    const z0 = Polish.bvGet(); if (z0) $$('.bv-o', m).forEach(x => x.classList.toggle('on', +x.dataset.w === z0.w && +x.dataset.h === z0.h));
    m.insertAdjacentHTML('beforeend', `<button type="button" class="bv-o bv-def${z0 ? '' : ' on'}" data-w="0" data-h="0"><span>↺ Default (fit this screen)</span></button>`);
    $$('.bv-o', m).forEach(b => b.onclick = e => { e.stopPropagation(); $$('.bv-o', m).forEach(x => x.classList.toggle('on', x === b)); const w = +b.dataset.w, h = +b.dataset.h; Polish.bvSet(w ? { w, h } : null);
      $('#bvNote', m).innerHTML = w ? `The tool now shows its pages as on a <b>${w} × ${h}</b> screen (only inside SudarshanAshtra; Windows is not changed). Choose <b>↺ Default</b> to go back.` : 'The tool is back to its normal size for this screen.'; });
  },
  /* For Best View: lay the tool out as on the chosen screen (CSS zoom on this page only; Windows is not touched) */
  bvGet() { try { return JSON.parse(localStorage.getItem('sud-bv') || 'null'); } catch (e) { return null; } },
  bvSet(v) { try { v ? localStorage.setItem('sud-bv', JSON.stringify(v)) : localStorage.removeItem('sud-bv'); } catch (e) { } this.bvApply(); },
  bvApply() { const v = this.bvGet(), r = document.documentElement; if (!v || !v.w) { r.style.zoom = ''; r.classList.remove('bv-z'); return; }
    const z = Math.max(.5, Math.min(2, screen.width / v.w)), on = Math.abs(z - 1) >= .01; r.style.zoom = on ? String(+z.toFixed(3)) : ''; r.classList.toggle('bv-z', on);
  },
  /* 📑 Report / Export (dashboard): All Cases or one case, as PDF, Word, Excel or HTML */
  report() {
    const real = S.cases.filter(c => c && c.id), cur = real.some(c => c.id === S.caseId) ? S.caseId : (S.prevCase && real.some(c => c.id === S.prevCase) ? S.prevCase : (real[0] || {}).id);
    if (!real.length) return UI.toast('No case yet – make a case first', 4000);
    const b = UI.modal('📑 Report / Export', `<div class="rx-pick"><div class="rx-h">1 · Which data?</div>
      <label class="rx-o"><input type="radio" name="rxS" value="all" ${isScope(S.caseId) ? 'checked' : ''}><span><b>🗂 All Cases</b><small>${real.length} case(s) – one summary table: FIR, PS, IO, status, complaints, amount lost, on hold, transactions, KYC, social, files</small></span></label>
      <label class="rx-o"><input type="radio" name="rxS" value="one" ${isScope(S.caseId) ? '' : 'checked'}><span><b>📄 Particular Case</b><small>Full case report: details, summary, complaints, layer-wise trail, suspect accounts, flow chart</small></span></label>
      <select id="rxC">${real.map(c => `<option value="${esc(c.id)}" ${c.id === cur ? 'selected' : ''}>${esc(AllMode && AllMode.caseLabel ? AllMode.caseLabel(c) : c.name)}</option>`).join('')}</select>
      <div class="rx-h">2 · Format</div><div class="rx-f">${[['pdf', '📕 PDF'], ['word', '📘 Word'], ['excel', '📗 Excel'], ['html', '🌐 HTML']].map(f => `<button class="btn" data-rx="${f[0]}">${f[1]}</button>`).join('')}</div>
      <div class="rx-h">3 · Language</div><div class="rx-lang">${Object.entries(ExpLang.L).map(([k, v]) => `<label class="rx-o" style="padding:6px 12px"><input type="radio" name="rxL" value="${k}" ${k === ExpLang.get() ? 'checked' : ''}><span><b>${k === 'en' ? '🇬🇧' : k === 'hi' ? '🇮🇳' : '🌐'} ${v}</b></span></label>`).join('')}</div>
      <div class="small muted" id="rxMsg">PDF opens the print window – choose <b>Save as PDF</b>. Everything is made on this computer.</div></div>`, [{ label: 'Close', onClick: UI.closeModal }]);
    const sel = $('#rxC', b), sync = () => { sel.disabled = $('input[name=rxS]:checked', b).value !== 'one'; }; $$('input[name=rxS]', b).forEach(r => r.onchange = sync); sync();
    $$('[data-rx]', b).forEach(x => x.onclick = async () => { const f = x.dataset.rx, one = $('input[name=rxS]:checked', b).value === 'one', id = sel.value; ExpLang.set($('input[name=rxL]:checked', b).value); $$('[data-rx]', b).forEach(y => { y.disabled = true; }); $('#rxMsg', b).textContent = '⏳ Preparing…';
      try { await (one ? this.oneCase(id, f) : this.allCases(f)); UI.closeModal(); } catch (e) { console.warn('report', e); $('#rxMsg', b).textContent = '❌ ' + e.message; $$('[data-rx]', b).forEach(y => { y.disabled = false; }); } });
  },
  async oneCase(id, f) {
    if (id !== S.caseId) await switchCase(id);
    if (f === 'pdf') return CaseReport.pdf(true);
    const L = ExpLang.get();
    if (f === 'word' && L === 'en') return CaseReport.word();
    const m = CaseReport.model(), im = await CaseReport.images(), h = ExpLang.html(CaseReport.html(m, im), L), t = 'Case Report ' + ((activeCase() || {}).fir || (activeCase() || {}).name || '');
    if (f === 'html') return UI.download(ExportAll.fname(t, 'html'), h, 'text/html');
    if (f === 'word') return ExportAll.word(h, t);
    const d = document.createElement('div'); d.innerHTML = new DOMParser().parseFromString(h, 'text/html').body.innerHTML; ExportAll.excel(d, t);
  },
  async allCases(f) {
    const R = [], sum = (a, k) => (a || []).reduce((s, x) => s + (+x[k] || 0), 0);
    for (const c of S.cases.filter(c => c && c.id)) { let d = null; try { d = c.id === S.caseId && !isScope(S.caseId) ? S.data : await DB.get('case:' + c.id); } catch (e) { } d = d || {};
      R.push({ c, n: (d.ncrp || []).length, loss: sum(d.ncrp, 'amount'), hold: sum(d.ncrp, 'hold_amount'), tx: (d.txns || []).length, kyc: (d.kyc || []).length, soc: (d.social || []).length, files: (d.imports || []).length }); }
    const st = c => c.final ? (c.final.type === 'PPI' ? 'CS-PPI' : c.final.type) : (c.status || '');
    const H = ['Sr', 'Case', 'FIR / Ack No.', 'Police Station', 'IO', 'Status', 'Complaints', 'Amount Lost (₹)', 'On Hold (₹)', 'Transactions', 'KYC', 'Social', 'Files'];
    const rows = R.map((r, i) => [i + 1, r.c.name || '', r.c.fir || r.c.ack || '', r.c.ps || '', r.c.io || '', st(r.c), r.n, r.loss, r.hold, r.tx, r.kyc, r.soc, r.files]);
    const tot = ['', 'Total', '', '', '', '', ...[6, 7, 8, 9, 10, 11, 12].map(k => rows.reduce((s, x) => s + (+x[k] || 0), 0))];
    const e = ExportAll.esc.bind(ExportAll), t = 'All Cases Report';
    const tbl = `<table><thead><tr>${H.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.concat([tot]).map(r => `<tr>${r.map((v, k) => `<td>${e(k === 7 || k === 8 ? (v === '' ? '' : fmtINR(v)) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const body = `<div class="xm">${R.length} case(s) · made ${e(new Date().toLocaleString('en-IN'))}</div>` + tbl;
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t}</title><style>${ExportAll.CSS}</style></head><body><h2>${t}</h2>${body}</body></html>`;
    if (f === 'pdf') return ExportAll.open(t, body, { print: true });
    const L = ExpLang.get();
    if (f === 'word') return ExportAll.word(ExpLang.html(doc, L), t);
    if (f === 'html') return UI.download(ExportAll.fname(t, 'html'), ExpLang.html(doc, L), 'text/html');
    const d = document.createElement('div'); d.innerHTML = tbl; ExpLang.apply(d, L); ExportAll.excel(d, t);
  },
  topIcons() {
    const dc = $('#btnDelCase'); if (dc && !dc.classList.contains('ic-only')) { dc.classList.add('ic-only'); dc.textContent = '🗑'; dc.title = 'Delete Case Data – remove a case and all its data from this computer (asks for your password; keeps a backup file)'; dc.setAttribute('aria-label', 'Delete Case Data'); }
    const u = $('#dkUpd'); if (u && !u.querySelector('.upd-ic')) { const t = u.textContent.replace(/^[\s⬆↑]+/, '').trim() || 'Update'; u.innerHTML = '<span class="upd-ic" aria-hidden="true"></span><span>' + esc(t) + '</span>'; }
  },
  async refresh() {
    const b = $('#btnRefresh'); if (b) b.classList.add('spin');
    try { if (S.data && S.caseId && !isScope(S.caseId)) { clearTimeout(saveTimer); await DB.set('case:' + S.caseId, S.data); } if (typeof Sess !== 'undefined') Sess.save(); } catch (e) { }
    location.reload();
  }
};
(() => {
  /* ⟳ Refresh */
  const rb = $('#btnRefresh'); if (rb) { rb.innerHTML = Polish.RFI; rb.onclick = () => Polish.refresh(); }

  /* login page: refresh and For Best View */
  const hr = $('#hpRf'); if (hr) hr.innerHTML = Polish.RFI.replace(/RFG/g, 'RFH').replace(/22"/g, '26"');
  if (hr) hr.onclick = () => location.reload();
  const bv = $('#hpBv'), bm = $('#bvMenu'); if (bv && bm) { bv.onclick = e => { e.stopPropagation(); if (bm.hidden) Polish.bestView(); bm.hidden = !bm.hidden; bv.classList.toggle('on', !bm.hidden); }; document.addEventListener('click', e => { if (!bm.hidden && !e.target.closest('.bv-wrap')) { bm.hidden = true; bv.classList.remove('on'); } }); }

  /* Offline heading on every import window */
  /* (in the pop-up's title line, just before the close button) */
  const om = UI.modal; UI.modal = function (title) { const body = om.apply(this, arguments); try { const hd = $('#modal header'), x = $('#mdClose'); let pill = $('#mdOff');
      const imp = Polish.IMP.test(String(title || '')) && !/download|setup/i.test(String(title));
      if (imp && !pill && hd && x) { x.insertAdjacentHTML('beforebegin', Polish.PILL); pill = $('#mdOff'); }
      if (pill) pill.hidden = !imp; $('#modal').classList.toggle('md-imp', imp); } catch (e) { } return body; };

  const r0 = render; render = function () {
    const r = r0.apply(this, arguments);
    try {
      /* Offline heading on import tabs and import pages */
      const tb = $('#tabBody'), act = $('#main .tabs .tab.active');
      if (tb && act && /import|upload|files/i.test(act.textContent) && !tb.querySelector(':scope > .imp-off')) tb.insertAdjacentHTML('afterbegin', Polish.OFF);
      /* dashboard: 📑 Report / Export in place of Case report / Refresh */
      if (S.page === 'dashboard') { ['#dReport', '#adRe'].forEach(q => { const x = $(q); if (x && !x.dataset.rx) { x.dataset.rx = '1'; x.innerHTML = '📑 Report / Export'; x.className = 'btn rx-btn'; x.title = 'Report of all cases or one case – PDF, Word, Excel or HTML'; x.onclick = e => { e.stopImmediatePropagation(); Polish.report(); }; } }); }
      Polish.topIcons();
      const tip = $('#dxTip'); if (tip) tip.classList.remove('on');   // no leftover hover box from the page before
      const rf = $('#btnRefresh'), th = $('#btnTheme'); if (rf && th && rf.nextElementSibling !== th) th.before(rf);
      /* chosen case: green with white text */
      const cs = $('#caseSel'); if (cs) cs.classList.toggle('cs-on', !!S.caseId && S.caseId !== '__none');
      const pv = S.caseId === '__none' ? S.prevCase : S.caseId; if (pv) $$('#main [data-pk]').forEach(b => b.classList.toggle('pk-cur', b.dataset.pk === pv));
      /* normal users: no adding web links */
      if (Polish.webUser() && S.page === 'tools' && S.sub.tools === 'addlink') { S.sub.tools = ''; setTimeout(() => go('tools'), 0); }
    } catch (e) { console.warn('polish', e); }
    return r;
  };
  const sw = switchCase; switchCase = async function () { const r = await sw.apply(this, arguments); const cs = $('#caseSel'); if (cs) cs.classList.toggle('cs-on', !!S.caseId && S.caseId !== '__none'); return r; };

  /* normal users: Contacts can be read, not added to or imported */
  if (typeof Contacts !== 'undefined') { const oe = Contacts.edit; Contacts.edit = function (x) { if (Polish.user() && !(x && x.id)) return UI.toast('Only the SudarshanAshtra Super Admin can add contacts', 4000); return oe.apply(this, arguments); }; }
  if (typeof XT !== 'undefined' && XT.addView) { const ov = XT.addView; XT.addView = function (body) { if (Polish.webUser()) { body.innerHTML = '<div class="card"><h3>🔒 Add Web Link</h3><p class="muted">Only the SudarshanAshtra Super Admin can add web links.</p></div>'; return; } return ov.apply(this, arguments); }; }

  /* plan with under 10 days left: red */
  if (typeof Plans !== 'undefined') {
    const ot = Plans.timer; Plans.timer = function () { const r = ot.apply(this, arguments); try { const L = Users.link(), p = L && L.plan, c = $('#plTimer'); const d = p && Polish.daysLeft(p.to, p.today);
      if (c && d != null) { c.classList.toggle('pl-soon', d < 10); let s = c.querySelector('.pl-dl'); if (d < 10) { if (!s) { c.insertAdjacentHTML('beforeend', '<span class="pl-dl"></span>'); s = c.querySelector('.pl-dl'); } s.textContent = ' · ' + Math.max(0, d) + (d === 1 ? ' day' : ' days') + ' left'; c.title = 'Your access ends on ' + Plans.dmy(p.to) + ' – contact the SudarshanAshtra Super Admin to extend it'; } else if (s) s.remove(); } } catch (e) { } return r; };
    const ob = Plans.badge; Plans.badge = function (k, to, today) { const h = ob.apply(this, arguments), d = Polish.daysLeft(to, today); return d != null && d < 10 ? h.replace('class="pl-b"', 'class="pl-b pl-soon" title="' + Math.max(0, d) + ' days left"') : h; };
  }
})();

/* Update button text is rewritten by the EXE every few minutes: keep the cloud icon */
(() => { let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; try { Polish.topIcons(); } catch (e) { } }); }).observe(document.getElementById('topbar') || document.body, { childList: true, subtree: true, characterData: true }); })();

/* dashboard ✏ Edit: open the case details */
document.addEventListener('click', e => { const a = e.target.closest('[data-cbedit]'); if (!a) return; e.preventDefault(); try { CaseBox.open(S.caseId === '__all' ? undefined : S.caseId); } catch (x) { console.warn(x); } });

/* For Best View choice is kept on this computer */
try { Polish.bvApply(); } catch (e) { }
