/* navcustom.js – every sidebar drop-down (Financial Trail, Social Media, Analytics, Tools, SOP…) can be
   re-ordered, renamed, hidden and given extra web links. Built-in items are only hidden, never removed.
   Saved in this browser only. (All LEA Portal has its own editor in leaportal.js.) */
'use strict';
const NavCustom = {
  KEY: 'sud-nav-custom',
  cfg() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch (e) { return {}; } },
  store(c) { localStorage.setItem(this.KEY, JSON.stringify(c)); },
  menus() { return $$('#sidebar .nav-subs').filter(s => !s.classList.contains('lea-subs')); },
  key(subs) { const p = subs.previousElementSibling; return p ? (p.dataset.page || [...p.classList].find(c => c !== 'nav-item' && c !== 'open' && c !== 'active') || p.textContent.trim()) : 'menu'; },
  title(subs) { const p = subs.previousElementSibling; return p ? p.textContent.replace(/[▾▸▶]/g, '').trim() : 'Menu'; },
  /* built-in items: the ones the app made (not action rows like Upload / Add link, not ours) */
  items(subs) { return [...subs.children].filter(n => n.classList.contains('nav-sub') && !n.classList.contains('sop-upl') && !n.classList.contains('nc-x') && !n.classList.contains('nc-edit')); },
  id(n) { const d = Object.entries(n.dataset).find(([k]) => !k.startsWith('nc')); return d ? d[0] + ':' + d[1] : 't:' + n.textContent.trim(); },
  textNode(n) { const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let best = null, t; while ((t = w.nextNode())) if (t.nodeValue.trim() && (!best || t.nodeValue.trim().length > best.nodeValue.trim().length)) best = t; return best; },
  orig(n) { if (n.dataset.ncOrig == null) { const t = this.textNode(n); n.dataset.ncOrig = t ? t.nodeValue.trim() : n.textContent.trim(); } return n.dataset.ncOrig; },
  busy: false,
  apply() {
    if (this.busy) return; this.busy = true;
    try {
      const C = this.cfg();
      for (const subs of this.menus()) {
        const k = this.key(subs), c = C[k] || {}, hid = c.hidden || [], nm = c.names || {}, ord = c.order || [];
        const its = this.items(subs);
        its.forEach((n, i) => { if (n.dataset.ncI == null) n.dataset.ncI = i; });
        for (const n of its) {
          const id = this.id(n), o = this.orig(n), want = nm[id] || o, t = this.textNode(n);
          if (t && t.nodeValue.trim() !== want) t.nodeValue = want;
          n.classList.toggle('nc-hid', hid.includes(id));
        }
        // extra web links
        const have = new Set($$('.nc-x', subs).map(n => n.dataset.ncx)), ex = c.extra || [];
        $$('.nc-x', subs).forEach(n => { const e = ex.find(x => x.id === n.dataset.ncx); if (!e) n.remove(); else { const sp = n.querySelector('span'); if (sp.textContent !== e.name) sp.textContent = e.name; n.title = 'Open ' + e.url; } });
        for (const e of ex) if (!have.has(e.id)) { const d = document.createElement('div'); d.className = 'nav-sub nc-x'; d.dataset.ncx = e.id; d.title = 'Open ' + e.url; d.innerHTML = `<span>${esc(e.name)}</span><span class="lea-ext">↗</span>`; subs.appendChild(d); }
        $$('.nc-x', subs).forEach(n => { n.onclick = ev => { ev.stopPropagation(); const e = (this.cfg()[k] || {}).extra.find(x => x.id === n.dataset.ncx); if (e && e.url) window.open(e.url, '_blank', 'noopener'); }; });
        // order: built-in + extras by saved order, action rows and the edit row last
        const all = [...this.items(subs), ...$$('.nc-x', subs)], pos = n => { const i = ord.indexOf(n.dataset.ncx ? 'x:' + n.dataset.ncx : this.id(n)); return i < 0 ? 1e6 : i; };
        const sorted = all.map((n, i) => [n, n.dataset.ncI != null ? +n.dataset.ncI : 1000 + i]).sort((a, b) => pos(a[0]) - pos(b[0]) || a[1] - b[1]).map(x => x[0]);
        const tail = [...subs.children].filter(n => !all.includes(n) && !n.classList.contains('nc-edit'));
        let ed = $('.nc-edit', subs);
        if (!ed) { ed = document.createElement('div'); ed.className = 'nav-sub sop-upl nc-edit'; ed.innerHTML = '<span>✏️ Edit / reorder this list</span>'; }
        ed.onclick = ev => { ev.stopPropagation(); this.edit(subs); };
        const want = [...sorted, ...tail, ed];
        if (want.some((n, i) => subs.children[i] !== n) || subs.children.length !== want.length) want.forEach(n => subs.appendChild(n));
      }
    } finally { this.busy = false; }
  },
  edit(subs) {
    const k = this.key(subs), C = this.cfg(), c = C[k] = C[k] || {}; c.hidden = c.hidden || []; c.names = c.names || {}; c.extra = c.extra || [];
    const rows = [...this.items(subs).filter(n => !c.hidden.includes(this.id(n))), ...$$('.nc-x', subs)].map(n => n.dataset.ncx
      ? { id: 'x:' + n.dataset.ncx, name: (c.extra.find(x => x.id === n.dataset.ncx) || {}).name || '', url: (c.extra.find(x => x.id === n.dataset.ncx) || {}).url || '', link: 1 }
      : { id: this.id(n), name: c.names[this.id(n)] || this.orig(n), def: this.orig(n) });
    const hiddenN = c.hidden.length, gone = new Set();
    const body = UI.modal(`${this.title(subs)} – edit list`, `<div class="sub" style="margin-bottom:8px">Rename any item, delete with <b>🗑</b>, or add a web link below. To change the order, drag <b>⠿</b> or use <b>▲ ▼</b>. Deleting a built-in item only hides it from this list – the feature stays in the app. Press <b>Save</b> to keep changes (this browser only).</div>
      <div class="lea-ed">${rows.map(r => `<div class="lea-row nc-row" data-row="${esc(r.id)}"><span class="lea-drag" title="Drag to move">⠿</span><span class="lea-nm"><input data-lname value="${esc(r.name)}" placeholder="${esc(r.def || 'Name')}"></span>${r.link ? `<input data-lurl value="${esc(r.url)}" placeholder="https://…">` : `<span class="muted small">Built-in${r.def !== r.name ? ' · was “' + esc(r.def) + '”' : ''}</span>`}<span class="lea-mv"><button class="btn sm" data-up title="Move up">▲</button><button class="btn sm" data-dn title="Move down">▼</button><button class="btn sm lea-del" data-del title="${r.link ? 'Delete this link' : 'Hide this item'}">🗑</button></span></div>`).join('')}</div>
      ${hiddenN ? `<div class="small muted" style="margin-top:6px">${hiddenN} built-in item${hiddenN > 1 ? 's are' : ' is'} hidden. <a href="#" data-unhide>Show them again</a></div>` : ''}
      <div class="lea-add"><input id="ncN" placeholder="New item name"><input id="ncU" placeholder="https://… (web link)"><button class="btn sm" id="ncA">➕ Add</button></div>`,
      [{ label: 'Reset to default', onClick: () => { if (UI.confirm(`Reset "${this.title(subs)}" to the default list?`)) { const A = this.cfg(); delete A[k]; this.store(A); UI.closeModal(); this.apply(); UI.toast('List reset'); } } },
       { label: 'Save', cls: 'primary', onClick: () => { take(); this.store(C); UI.closeModal(); this.apply(); UI.toast('Menu saved'); } }]);
    const take = () => {
      $$('[data-row]', body).forEach(r => { const id = r.dataset.row, n = $('[data-lname]', r).value.trim();
        if (id.startsWith('x:')) { const e = c.extra.find(x => x.id === id.slice(2)); if (e) { if (n) e.name = n; e.url = $('[data-lurl]', r).value.trim(); } return; }
        const def = (rows.find(x => x.id === id) || {}).def; if (n && n !== def) c.names[id] = n; else delete c.names[id]; });
      for (const id of gone) { if (id.startsWith('x:')) c.extra = c.extra.filter(x => x.id !== id.slice(2)); else { if (!c.hidden.includes(id)) c.hidden.push(id); delete c.names[id]; } }
      gone.clear(); const vis = $$('[data-row]', body).map(r => r.dataset.row); c.order = [...vis, ...(c.order || []).filter(x => !vis.includes(x))];
    };
    const ed = $('.lea-ed', body); let drag = null;
    const flash = r => { r.classList.remove('lea-moved'); void r.offsetWidth; r.classList.add('lea-moved'); };
    ed.addEventListener('click', e => {
      const d = e.target.closest('[data-del]'); if (d) { e.preventDefault(); const r = d.closest('[data-row]'), nm = $('[data-lname]', r).value.trim() || 'this item';
        if (UI.confirm(r.dataset.row.startsWith('x:') ? `Delete the link "${nm}"?` : `Hide "${nm}" from this list?\n(The feature stays in the app. "Reset to default" or "Show them again" brings it back.)`)) { gone.add(r.dataset.row); r.remove(); } return; }
      const b = e.target.closest('[data-up],[data-dn]'); if (!b) return; e.preventDefault(); const r = b.closest('[data-row]');
      if (b.hasAttribute('data-up') && r.previousElementSibling) ed.insertBefore(r, r.previousElementSibling);
      else if (b.hasAttribute('data-dn') && r.nextElementSibling) ed.insertBefore(r.nextElementSibling, r);
      flash(r); r.scrollIntoView({ block: 'nearest' });
    });
    ed.addEventListener('mousedown', e => { const h = e.target.closest('.lea-drag'); if (h) h.parentElement.draggable = true; });
    ed.addEventListener('dragstart', e => { drag = e.target.closest('[data-row]'); if (!drag) return; drag.classList.add('lea-dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (x) { } });
    ed.addEventListener('dragover', e => { if (!drag) return; e.preventDefault(); const r = e.target.closest('[data-row]'); if (!r || r === drag) return; const b = r.getBoundingClientRect(); ed.insertBefore(drag, e.clientY > b.top + b.height / 2 ? r.nextElementSibling : r); });
    ed.addEventListener('drop', e => e.preventDefault());
    ed.addEventListener('dragend', () => { if (!drag) return; drag.classList.remove('lea-dragging'); drag.draggable = false; flash(drag); drag = null; });
    const un = $('[data-unhide]', body); if (un) un.onclick = e => { e.preventDefault(); take(); c.hidden = []; this.store(C); this.apply(); this.edit(subs); };
    $('#ncA', body).onclick = () => { const n = $('#ncN', body).value.trim(), u = $('#ncU', body).value.trim(); if (!n || !/^https?:\/\//i.test(u)) return UI.toast('Give a name and a link starting with https://');
      take(); const id = 'n' + Date.now(); c.extra.push({ id, name: n, url: u }); c.order = [...$$('[data-row]', body).map(r => r.dataset.row), 'x:' + id]; this.store(C); this.apply(); this.edit(subs); };
  }
};
(() => {
  const sb = $('#sidebar'); if (!sb) return;
  let q = false; const run = () => { q = false; NavCustom.apply(); };
  new MutationObserver(() => { if (NavCustom.busy || q) return; q = true; queueMicrotask(run); }).observe(sb, { childList: true, subtree: true });
  NavCustom.apply();
})();
