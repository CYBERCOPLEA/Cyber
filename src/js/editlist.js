/* editlist.js - make any fixed drop-down (<select>) editable: reorder, rename, delete, add, reset.
   EditList.items(key, defaults) -> current list. EditList.attach(select, key, defaults) adds "✏ Edit / reorder this list…" at the end. */
const EditList = {
  KEY: 'sud-edit-lists',
  all() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch (e) { return {}; } },
  items(key, defs) { const a = this.all()[key]; return Array.isArray(a) && a.length ? a : defs.slice(); },
  save(key, list) { const a = this.all(); if (list) a[key] = list; else delete a[key]; localStorage.setItem(this.KEY, JSON.stringify(a)); },
  fill(sel, key, defs, keep) {
    const v = keep !== undefined ? keep : sel.value, L = this.items(key, defs);
    sel.innerHTML = L.map(x => `<option>${esc(x)}</option>`).join('') + '<option value="__edit">✏ Edit / reorder this list…</option>';
    sel.value = L.includes(v) ? v : (L[0] || ''); sel.dataset.last = sel.value;
  },
  attach(sel, key, defs, title) {
    if (!sel) return; this.fill(sel, key, defs);
    sel.addEventListener('focus', () => { sel.dataset.last = sel.value; });
    sel.addEventListener('change', () => {
      if (sel.value !== '__edit') { sel.dataset.last = sel.value; return; }
      const last = sel.dataset.last || ''; sel.value = last;
      this.edit(key, defs, title || 'Edit list', () => this.fill(sel, key, defs, last));
    });
  },
  // own overlay so it can open on top of another dialog without closing it
  edit(key, defs, title, done) {
    let L = this.items(key, defs);
    const ov = document.createElement('div'); ov.className = 'el-ov';
    ov.innerHTML = `<div class="el-box"><div class="el-hd"><b>✏ ${esc(title)}</b><button class="btn sm" data-x>✕</button></div>
      <div class="small muted">Drag ⠿ or use ▲ ▼ to reorder · type to rename · 🗑 to delete</div><div class="el-rows"></div>
      <div class="row" style="gap:6px;margin-top:8px"><input class="el-new" placeholder="New item…" style="flex:1"><button class="btn" data-add>➕ Add</button></div>
      <div class="row" style="gap:6px;margin-top:12px"><button class="btn sm" data-reset>↺ Reset to default</button><span class="spacer" style="flex:1"></span><button class="btn" data-x>Cancel</button><button class="btn primary" data-save>Save</button></div></div>`;
    document.body.appendChild(ov);
    const rows = ov.querySelector('.el-rows');
    const take = () => { L = [...rows.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean); };
    const draw = () => {
      rows.innerHTML = L.map((x, i) => `<div class="el-row" draggable="true" data-i="${i}"><span class="el-dr" title="Drag">⠿</span><input value="${esc(x)}"><button class="btn sm" data-up="${i}" ${i ? '' : 'disabled'}>▲</button><button class="btn sm" data-dn="${i}" ${i < L.length - 1 ? '' : 'disabled'}>▼</button><button class="btn sm danger" data-del="${i}" title="Delete">🗑</button></div>`).join('') || '<div class="muted small">Empty – add an item below.</div>';
      let from = -1;
      rows.querySelectorAll('.el-row').forEach(r => {
        r.ondragstart = () => { take(); from = +r.dataset.i; r.classList.add('drag'); };
        r.ondragover = e => e.preventDefault();
        r.ondrop = e => { e.preventDefault(); const to = +r.dataset.i; if (from < 0 || from === to) return; const [m] = L.splice(from, 1); L.splice(to, 0, m); draw(); };
      });
    };
    const mv = (i, d) => { take(); const j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; draw(); };
    ov.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) { if (e.target === ov) close(); return; }
      if (t.dataset.up !== undefined) mv(+t.dataset.up, -1);
      else if (t.dataset.dn !== undefined) mv(+t.dataset.dn, 1);
      else if (t.dataset.del !== undefined) { take(); const i = +t.dataset.del; if (confirm(`Delete "${L[i]}" from this list?`)) { L.splice(i, 1); draw(); } }
      else if (t.hasAttribute('data-add')) { take(); const n = ov.querySelector('.el-new'), v = n.value.trim(); if (!v) return n.focus(); if (!L.includes(v)) L.push(v); n.value = ''; this.save(key, L); draw(); }
      else if (t.hasAttribute('data-reset')) { if (confirm('Go back to the original list?')) { L = defs.slice(); draw(); } }
      else if (t.hasAttribute('data-save')) { take(); this.save(key, L.length ? L : null); close(); UI.toast('List saved'); }
      else if (t.hasAttribute('data-x')) close();
    });
    ov.querySelector('.el-new').onkeydown = e => { if (e.key === 'Enter') ov.querySelector('[data-add]').click(); };
    const close = () => { ov.remove(); done && done(); };
    draw();
  }
};
