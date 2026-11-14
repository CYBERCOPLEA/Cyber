/* fulltab.js – "↗ New Tab" on every graph, flow chart, mind map, network and chart of the tool (Vijay 14-11:
   "all types graph, flow chart, network should open in a new full-screen tab … hover / click / inside … more functions").
   The new tab is the same tool (same data on this computer, nothing is uploaded), opened on the same page, with only that
   view filling the screen and a tool bar: search & highlight, bigger / smaller, fit, CSV of the values, PNG / SVG picture, print. */
'use strict';
const FullTab = {
  /* what gets the button: graph boxes (network / flow / mind map) and cards that hold a chart */
  graphs(root) { return $$('.graph-box', root); },
  has: c => !!(c.querySelector('svg.chart, canvas, .jm-bars, .jm-arc, svg [data-tip]') || $$('[data-tip]', c).length >= 2 || [...c.querySelectorAll('svg')].some(s => { const r = s.getBoundingClientRect(); return r.width >= 120 && r.height >= 90; })),
  /* a heading + chart block inside a bigger card (e.g. Case Mirror: Targets by State / District / Fraud Amount) */
  blocks(root) { return $$('h4', root).map(h => h.parentElement).filter(b => b && !b.classList.contains('card') && !b.closest('.graph-box') && b.closest('.card') && this.has(b) && !b.querySelector('h4 ~ * h4')); },
  charts(root) {
    const B = this.blocks(root);
    return $$('.card', root).filter(c => !c.querySelector('.graph-box') && !c.closest('.graph-box') && !c.closest('#ftBar') && !c.querySelector('.card') && B.filter(b => c.contains(b)).length < 2 && this.has(c)).concat(B.filter(b => B.filter(x => x.closest('.card') === b.closest('.card')).length >= 2));
  },
  kind: el => el.classList.contains('graph-box') ? 'g' : 'c',
  title(el) { const c = el.querySelector(':scope > h4, :scope > h3') ? el : el.closest('.card') || el, h = c.querySelector(':scope > h4, :scope > h3') || c.querySelector('h3, h2, .card-title'); return h ? h.textContent.replace(/\s+/g, ' ').replace(/↗ New Tab|Full view|Exit full view/g, '').trim().slice(0, 90) : ''; },
  scan() {
    if (document.body.classList.contains('ft-body')) return; const main = $('#main'); if (!main) return;
    for (const el of this.graphs(main)) { if (el.querySelector(':scope > .ft-btn')) continue; this.btn(el, true); }
    for (const el of this.charts(main)) { if (el.querySelector(':scope > .ft-btn')) continue; this.btn(el, false); if (!el.classList.contains('card')) el.classList.add('ft-blk'); }
  },
  btn(el, g) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm ft-btn' + (g ? ' ft-g' : ' ft-c');
    b.title = 'Open this ' + (g ? 'network / flow chart' : 'chart') + ' alone in a new full-screen tab – hover, click and drill-down keep working, plus search, zoom, CSV, picture and print';
    b.innerHTML = '↗<span> New Tab</span>'; b.onclick = e => { e.stopPropagation(); e.preventDefault(); this.open(el); };
    el.classList.add('ft-host'); if (g) { const fv = el.querySelector(':scope > .fv-btn'); fv ? fv.after(b) : el.prepend(b); } else el.prepend(b);
  },
  open(el) {
    const k = this.kind(el), L = k === 'g' ? this.graphs($('#main')) : this.charts($('#main')), id = uid();
    const loc = { caseId: S.caseId, page: S.page, sub: JSON.parse(JSON.stringify(S.sub || {})), k, idx: L.indexOf(el), title: this.title(el), at: Date.now() };
    try { localStorage.setItem('sud-ft-' + id, JSON.stringify(loc)); Object.keys(localStorage).filter(x => /^sud-ft-/.test(x)).forEach(x => { try { if (Date.now() - JSON.parse(localStorage.getItem(x)).at > 864e5) localStorage.removeItem(x); } catch (e) { localStorage.removeItem(x); } }); } catch (e) { }
    try { Sess.touch(true); } catch (e) { }
    const url = location.href.split('#')[0] + '#ft=' + id; let w = null; try { w = window.open(url, '_blank'); } catch (e) { }
    if (!w && typeof FullView !== 'undefined' && k === 'g') FullView.open(el);   // a new tab is not allowed here: full screen in place
  },
  /* ---------- in the new tab ---------- */
  want() { const m = location.hash.match(/ft=([\w-]+)/); if (!m) return null; try { return JSON.parse(localStorage.getItem('sud-ft-' + m[1]) || 'null'); } catch (e) { return null; } },
  async boot() {
    const W = this.want(); if (!W) return; this.W = W;
    const t0 = Date.now(); while (Date.now() - t0 < 6e5 && ($('#app').classList.contains('hidden') || !S.data)) await new Promise(r => setTimeout(r, 400));
    if ($('#app').classList.contains('hidden')) return;
    await new Promise(r => setTimeout(r, 1500));   // let the tool finish opening its own start page first
    try { UI.closeModal(); } catch (e) { }
    if (W.caseId && W.caseId !== '__none' && S.caseId !== W.caseId) { try { await switchCase(W.caseId); await new Promise(r => setTimeout(r, 800)); } catch (e) { } }
    S.sub = Object.assign(S.sub || {}, W.sub || {}); try { go(W.page, (W.sub || {})[W.page]); } catch (e) { }
    let el = null; const t1 = Date.now();
    while (!el && Date.now() - t1 < 20000) { await new Promise(r => setTimeout(r, 400)); if (S.page !== W.page) { try { go(W.page, (W.sub || {})[W.page]); } catch (e) { } continue; } const L = W.k === 'g' ? this.graphs($('#main')) : this.charts($('#main')); el = (W.title && L.find(x => this.title(x) === W.title)) || L[W.idx] || null; }
    if (!el) { UI.toast('That view was not found on this page – showing the whole page', 5000); return; }
    this.focus(el);
  },
  /* the page drew itself again (a click, a filter): find the same view and keep it full screen */
  relocate() {
    if (!this.el || this.el.isConnected || !this.W) return; const L = this.W.k === 'g' ? this.graphs($('#main')) : this.charts($('#main'));
    const el = (this.W.title && L.find(x => this.title(x) === this.W.title)) || L[this.W.idx]; if (!el) return;
    this.el = el; el.classList.add('ft-on'); const z = this.z; if (this.W.k === 'c') { this.inner().style.zoom = z; } else this.fit();
    const q = $('#ftQ'); if (q && q.value) this.find(q.value);
  },
  focus(el) {
    if ($('#ftBar')) $('#ftBar').remove();
    this.el = el; document.body.classList.add('ft-body'); el.classList.add('ft-on'); document.title = '↗ ' + (this.W.title || 'View') + ' – SudarshanAshtra';
    const bar = document.createElement('div'); bar.id = 'ftBar';
    bar.innerHTML = `<b class="ft-t">↗ ${esc(this.W.title || (this.W.k === 'g' ? 'Network / Flow Chart' : 'Chart'))}</b><span class="ft-h">hover = details · click = drill-down${this.W.k === 'g' ? ' · scroll = zoom · drag = move' : ''}</span><span class="grow"></span>
      <input id="ftQ" placeholder="🔍 Search & highlight…" title="Highlights every label / node / bar that contains this text and dims the rest"><span id="ftN" class="ft-h"></span>
      <button class="btn sm" data-ft="out" title="Smaller">A−</button><button class="btn sm" data-ft="in" title="Bigger">A+</button><button class="btn sm" data-ft="fit" title="Fit to the screen">⤢ Fit</button>
      <button class="btn sm" data-ft="csv" title="The values / names shown, as an Excel-readable CSV">⬇ CSV</button><button class="btn sm" data-ft="png" title="Picture of this view">⬇ PNG</button><button class="btn sm" data-ft="svg" title="Sharp picture (SVG) – for reports">⬇ SVG</button><button class="btn sm" data-ft="print">🖨 Print</button>
      <button class="btn sm" data-ft="all" title="Show the whole page of the tool in this tab">☰ Whole Page</button><button class="btn sm danger" data-ft="x" title="Close this tab">✖ Close</button>`;
    document.body.appendChild(bar);
    $('#ftQ').oninput = e => this.find(e.target.value);
    $$('[data-ft]', bar).forEach(b => b.onclick = () => this.act(b.dataset.ft));
    this.z = 1; this.fit(); addEventListener('resize', () => this.W.k !== 'g' && this.fit());
  },
  inner() { const el = this.el; let w = el.querySelector(':scope > .ft-in'); if (!w && this.W.k === 'c') { w = document.createElement('div'); w.className = 'ft-in'; [...el.childNodes].filter(n => !(n.classList && n.classList.contains('ft-btn'))).forEach(n => w.appendChild(n)); el.appendChild(w); } return w; },
  fit() {
    const el = this.el; if (!el) return; window.dispatchEvent(new Event('resize'));
    if (this.W.k === 'g') { [200, 700].forEach(t => setTimeout(() => { const f = el.querySelector('[data-z="fit"]'); if (f) f.click(); }, t)); return; }
    const w = this.inner(); w.style.zoom = 1; const r = w.getBoundingClientRect(), aw = el.clientWidth - 40, ah = el.clientHeight - 30;
    this.z = Math.max(.6, Math.min(3, aw / Math.max(1, r.width), ah / Math.max(1, r.height))); w.style.zoom = this.z;
  },
  act(a) {
    const el = this.el;
    if (a === 'x') { window.close(); setTimeout(() => this.act('all'), 300); return; }
    if (a === 'all') { document.body.classList.remove('ft-body'); el.classList.remove('ft-on'); const w = el.querySelector(':scope > .ft-in'); if (w) w.style.zoom = 1; $('#ftBar') && $('#ftBar').remove(); this.el = null; history.replaceState(null, '', location.href.split('#')[0]); this.scan(); return; }
    if (a === 'fit') return this.fit();
    if (a === 'in' || a === 'out') { if (this.W.k === 'g') { const b = el.querySelector(`[data-z="${a}"]`); if (b) b.click(); return; } this.z = Math.max(.4, Math.min(5, this.z * (a === 'in' ? 1.2 : 1 / 1.2))); this.inner().style.zoom = this.z; return; }
    if (a === 'print') return window.print();
    if (a === 'csv') { const R = this.rows(); if (!R.length) return UI.toast('No values found in this view'); const c = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      return this.dl(new Blob(['﻿' + [['Name / Label', 'Value', 'Details'].map(c).join(',')].concat(R.map(r => r.map(c).join(','))).join('\r\n')], { type: 'text/csv' }), this.fname() + '.csv'); }
    if (a === 'png' || a === 'svg') { const s = this.svg(); if (!s) return UI.toast('No picture in this view');
      if (a === 'svg') return this.dl(new Blob([s.txt], { type: 'image/svg+xml' }), this.fname() + '.svg');
      const img = new Image(); img.onload = () => { const k = 2, cv = document.createElement('canvas'); cv.width = s.w * k; cv.height = s.h * k; const x = cv.getContext('2d'); x.fillStyle = getComputedStyle(document.body).backgroundColor || '#0b1220'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height); cv.toBlob(b => this.dl(b, this.fname() + '.png')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.txt); }
  },
  fname() { return (this.W.title || 'view').replace(/[^\wऀ-ॿ]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'view'; },
  dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); },
  /* the values in the view: chart bars (data-tip), Pratibimb / Mirror bars, graph nodes */
  rows() {
    const el = this.el, R = [], txt = h => { const d = document.createElement('div'); d.innerHTML = String(h || '').replace(/<br\s*\/?>/gi, ' | '); return d.textContent.trim(); };
    $$('[data-tip]', el).forEach(n => { const p = String(n.dataset.tip).split(/<br\s*\/?>/i); R.push([txt(p[0]), txt(p[1] || ''), txt(p.slice(2).join('<br>'))]); });
    $$('.jm-bar', el).forEach(n => R.push([(n.querySelector('.jm-bn') || {}).textContent || '', (n.querySelector('b') || {}).textContent || '', '']));
    if (!R.length) $$('.nodes > g, g.node', el).forEach(n => { const t = [...n.querySelectorAll('text')].map(x => x.textContent.trim()).filter(Boolean); if (t.length) R.push([t[0], t.slice(1).join(' · '), n.getAttribute('data-id') || '']); });
    if (!R.length) $$('tbody tr', el).forEach(tr => { const t = [...tr.children].map(td => td.textContent.trim()); R.push([t[0], t[1] || '', t.slice(2).join(' · ')]); });
    return R.filter(r => r[0] || r[1]);
  },
  /* biggest svg of the view with its colours / fonts written in, so the picture looks like the screen */
  svg() {
    const S0 = $$('svg', this.el).filter(s => !s.closest('button')).map(s => ({ s, r: s.getBoundingClientRect() })).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]; if (!S0 || S0.r.width < 40) return null;
    const src = S0.s, cl = src.cloneNode(true), A = [src, ...src.querySelectorAll('*')], B = [cl, ...cl.querySelectorAll('*')];
    A.forEach((n, i) => { const cs = getComputedStyle(n), d = B[i]; if (!d || !d.style) return; ['fill', 'stroke', 'stroke-width', 'opacity', 'font-size', 'font-family', 'font-weight', 'stroke-dasharray', 'display'].forEach(p => { const v = cs.getPropertyValue(p); if (v) d.style.setProperty(p, v); }); });
    const w = Math.round(S0.r.width), h = Math.round(S0.r.height); cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); cl.setAttribute('width', w); cl.setAttribute('height', h);
    return { txt: new XMLSerializer().serializeToString(cl), w, h };
  },
  find(q) {
    const el = this.el; q = String(q || '').trim().toLowerCase(); const N = [...$$('[data-tip], .jm-bar, .nodes > g, g.node, .jm-arc, tbody tr, .mir-t, .lr-k', el)];
    N.forEach(n => n.classList.remove('ft-hit', 'ft-dim')); if (!q) { $('#ftN').textContent = ''; return; }
    let k = 0; N.forEach(n => { const t = (n.textContent + ' ' + (n.dataset.tip || '') + ' ' + (n.getAttribute('data-id') || '') + ' ' + Object.values(n.dataset || {}).join(' ')).toLowerCase(); const hit = t.includes(q); n.classList.add(hit ? 'ft-hit' : 'ft-dim'); if (hit) k++; });
    $('#ftN').textContent = k + ' found';
  }
};
(() => {
  let t = 0; const later = () => { if (FullTab.el && !FullTab.el.isConnected) { try { FullTab.relocate(); } catch (e) { } } clearTimeout(t); t = setTimeout(() => { try { FullTab.scan(); } catch (e) { } }, 200); };
  const m = $('#main'); if (m) new MutationObserver(later).observe(m, { childList: true, subtree: true });
  if (/[#&]ft=/.test(location.hash)) addEventListener('load', () => setTimeout(() => FullTab.boot().catch(e => console.warn('FullTab', e)), 300));
})();
