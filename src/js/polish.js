/* polish.js – Vijay's list of 13-11-2026 (all links; the EXE uses the same build):
   ⟳ Refresh button before the theme button · Offline heading on every import screen · normal users: no Add Contacts,
   no Import Excel, no Add Web Link · plan ending in under 10 days shows red · the chosen case shows green with white text. */
'use strict';
const Polish = {
  OFF: '<div class="imp-off no-tc" role="note"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="#10b981"/><rect x="8.5" y="11" width="7" height="5.5" rx="1" fill="#fff"/><path d="M10 11V9.5a2 2 0 0 1 4 0V11" fill="none" stroke="#fff" stroke-width="1.6"/></svg><span><b>Offline</b> · Files are read on this computer only. Your case data stays here, never uploaded to any server or online.</span></div>',
  IMP: /(^|[^a-z])(import|upload|reading|read case|choose .*files|add files)/i,
  daysLeft(to, today) { if (!to) return null; const d = (Date.parse(to) - Date.parse(today || new Date().toISOString().slice(0, 10))) / 864e5; return isNaN(d) ? null : Math.ceil(d); },
  user: () => typeof Role !== 'undefined' && !Role.admin(),
  async refresh() {
    const b = $('#btnRefresh'); if (b) b.classList.add('spin');
    try { if (S.data && S.caseId && !isScope(S.caseId)) { clearTimeout(saveTimer); await DB.set('case:' + S.caseId, S.data); } if (typeof Sess !== 'undefined') Sess.save(); } catch (e) { }
    location.reload();
  }
};
(() => {
  /* ⟳ Refresh */
  const rb = $('#btnRefresh'); if (rb) { rb.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>'; rb.onclick = () => Polish.refresh(); }

  /* Offline heading on every import window */
  const om = UI.modal; UI.modal = function (title) { const body = om.apply(this, arguments); try { if (Polish.IMP.test(String(title || '')) && !/download|setup/i.test(String(title)) && body && !body.querySelector('.imp-off')) body.insertAdjacentHTML('afterbegin', Polish.OFF); } catch (e) { } return body; };

  const r0 = render; render = function () {
    const r = r0.apply(this, arguments);
    try {
      /* Offline heading on import tabs and import pages */
      const tb = $('#tabBody'), act = $('#main .tabs .tab.active');
      if (tb && act && /import|upload|files/i.test(act.textContent) && !tb.querySelector(':scope > .imp-off')) tb.insertAdjacentHTML('afterbegin', Polish.OFF);
      const tip = $('#dxTip'); if (tip) tip.classList.remove('on');   // no leftover hover box from the page before
      const rf = $('#btnRefresh'), th = $('#btnTheme'); if (rf && th && rf.nextElementSibling !== th) th.before(rf);
      /* chosen case: green with white text */
      const cs = $('#caseSel'); if (cs) cs.classList.toggle('cs-on', !!S.caseId && S.caseId !== '__none');
      const pv = S.caseId === '__none' ? S.prevCase : S.caseId; if (pv) $$('#main [data-pk]').forEach(b => b.classList.toggle('pk-cur', b.dataset.pk === pv));
      /* normal users: no adding web links */
      if (Polish.user() && S.page === 'tools' && S.sub.tools === 'addlink') { S.sub.tools = ''; setTimeout(() => go('tools'), 0); }
    } catch (e) { console.warn('polish', e); }
    return r;
  };
  const sw = switchCase; switchCase = async function () { const r = await sw.apply(this, arguments); const cs = $('#caseSel'); if (cs) cs.classList.toggle('cs-on', !!S.caseId && S.caseId !== '__none'); return r; };

  /* normal users: Contacts can be read, not added to or imported */
  if (typeof Contacts !== 'undefined') { const oe = Contacts.edit; Contacts.edit = function (x) { if (Polish.user() && !(x && x.id)) return UI.toast('Only the SudarshanAshtra Super Admin can add contacts', 4000); return oe.apply(this, arguments); }; }
  if (typeof XT !== 'undefined' && XT.addView) { const ov = XT.addView; XT.addView = function (body) { if (Polish.user()) { body.innerHTML = '<div class="card"><h3>🔒 Add Web Link</h3><p class="muted">Only the SudarshanAshtra Super Admin can add web links.</p></div>'; return; } return ov.apply(this, arguments); }; }

  /* plan with under 10 days left: red */
  if (typeof Plans !== 'undefined') {
    const ot = Plans.timer; Plans.timer = function () { const r = ot.apply(this, arguments); try { const L = Users.link(), p = L && L.plan, c = $('#plTimer'); const d = p && Polish.daysLeft(p.to, p.today);
      if (c && d != null) { c.classList.toggle('pl-soon', d < 10); let s = c.querySelector('.pl-dl'); if (d < 10) { if (!s) { c.insertAdjacentHTML('beforeend', '<span class="pl-dl"></span>'); s = c.querySelector('.pl-dl'); } s.textContent = ' · ' + Math.max(0, d) + (d === 1 ? ' day' : ' days') + ' left'; c.title = 'Your access ends on ' + Plans.dmy(p.to) + ' – contact the SudarshanAshtra Super Admin to extend it'; } else if (s) s.remove(); } } catch (e) { } return r; };
    const ob = Plans.badge; Plans.badge = function (k, to, today) { const h = ob.apply(this, arguments), d = Polish.daysLeft(to, today); return d != null && d < 10 ? h.replace('class="pl-b"', 'class="pl-b pl-soon" title="' + Math.max(0, d) + ' days left"') : h; };
  }
})();
