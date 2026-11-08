/* fullview.js – a "Full view" button on big views (money trail, flow chart / mind map / graphs, big tables).
   It opens that view on the whole screen; Esc or the button closes it. */
'use strict';
const FullView = {
  cur: null,
  // what gets a button: the money trail, every graph, and tables with many rows
  targets() {
    const out = new Set(), main = $('#main'); if (!main) return [];
    $$('.trail-main', main).forEach(e => out.add(e));
    $$('.graph-box', main).forEach(g => out.add(g.closest('.card') || g));
    $$('.tbl-wrap', main).forEach(t => { if (t.querySelectorAll('tbody tr').length >= 8 && !t.closest('.modal, #drawer')) out.add(t.closest('.card') || t); });
    return [...out];
  },
  scan() {
    for (const el of this.targets()) {
      if (el.querySelector(':scope > .fv-btn')) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm fv-btn'; b.title = 'Show this on the full screen (Esc to close)';
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span>Full view</span>';
      b.onclick = e => { e.stopPropagation(); this.cur === el ? this.close() : this.open(el); };
      el.classList.add('fv-host'); el.prepend(b);
    }
  },
  open(el) {
    if (this.cur) this.close();
    this.cur = el; el.classList.add('fv-on'); document.body.classList.add('fv-body');
    const b = el.querySelector(':scope > .fv-btn'); if (b) b.querySelector('span').textContent = 'Exit full view';
    try { const r = el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' }); if (r && r.catch) r.catch(() => { }); } catch (e) { }
    window.dispatchEvent(new Event('resize'));
  },
  close() {
    const el = this.cur; if (!el) return; this.cur = null;
    el.classList.remove('fv-on'); document.body.classList.remove('fv-body');
    const b = el.querySelector(':scope > .fv-btn'); if (b) b.querySelector('span').textContent = 'Full view';
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { } }
    window.dispatchEvent(new Event('resize'));
  }
};
(() => {
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(() => { try { FullView.scan(); } catch (e) { } }, 120); };
  new MutationObserver(later).observe($('#main'), { childList: true, subtree: true });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && FullView.cur) FullView.close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && FullView.cur && !document.fullscreenElement) FullView.close(); });
  // leaving the page closes it
  const og = go; go = function () { if (FullView.cur) FullView.close(); return og.apply(this, arguments); };
})();
