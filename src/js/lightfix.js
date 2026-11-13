/* lightfix.js – Light theme readability.
   Many boxes, chips, rings and bars were drawn for the dark theme (pale text on dark). In the light theme the tool now
   checks every visible text against the colour really behind it (gradients included) and, where it is hard to read,
   darkens the text (or turns it white on a strong colour) until it reads clearly. Dark theme is never touched. */
'use strict';
const LightFix = (() => {
  const DK = [15, 23, 42], WH = [255, 255, 255];
  const parse = s => {
    if (!s) return null; let m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) { const a = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; }
    m = s.match(/^color\(srgb ([^)]+)\)$/); if (m) { const a = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return [a[0] * 255, a[1] * 255, a[2] * 255, a.length > 3 ? a[3] : 1]; }
    return null; };
  const stops = img => { const L = []; const rx = /(rgba?\([^)]*\)|color\(srgb [^)]*\))/g; let m; while ((m = rx.exec(img))) { const c = parse(m[1]); if (c) L.push(c); } return L; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const mix = (t, b) => [0, 1, 2].map(i => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const tone = (a, b, k) => [0, 1, 2].map(i => a[i] * (1 - k) + b[i] * k).concat(1);
  let cache = new WeakMap();
  /* colour really behind an element: its own and its parents' backgrounds, gradients averaged */
  const bgOf = el => {
    if (cache.has(el)) return cache.get(el);
    const cs = getComputedStyle(el); let layers = [];
    if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/url\(/.test(cs.backgroundImage)) { const st = stops(cs.backgroundImage); if (st.length) { const A = st.reduce((s, c) => s + c[3], 0); if (A > 0) layers.push([0, 1, 2].map(i => st.reduce((s, c) => s + c[i] * c[3], 0) / A).concat(A / st.length)); } }
    const c = parse(cs.backgroundColor); if (c && c[3] > 0) layers.push(c);
    let r; const solid = layers.some(l => l[3] >= .95);
    if (!solid) r = el.parentElement ? bgOf(el.parentElement) : WH.concat(1); else r = WH.concat(1);
    for (let i = layers.length - 1; i >= 0; i--) r = mix(layers[i], r);
    cache.set(el, r); return r; };
  const SKIP = '.fx,.fxn,svg,canvas,input,textarea,select,option,.no-lf,#chartTip';
  /* fix = true: set a readable colour; false: just list the hard-to-read texts */
  const scan = (root, fix) => {
    const out = []; if (!root || !root.ownerDocument) return out; cache = new WeakMap(); const seen = new Set();
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const t = tw.currentNode; if (!t.data.trim()) continue; const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
      if (el.closest(SKIP) || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || /text/.test(cs.webkitBackgroundClip || cs.backgroundClip || '')) continue;
      const fg = parse(cs.color); if (!fg || fg[3] < .05) continue;
      const bg = bgOf(el), f = mix(fg, bg); const big = parseFloat(cs.fontSize) >= 18 || (parseFloat(cs.fontSize) >= 14 && +cs.fontWeight >= 700); const need = big ? 3.2 : 4.5;
      const strong = lum(bg) < .42;   // a strong colour behind (button, badge, active tab): white text is the design
      const c0 = cr(f, bg); if (c0 >= (strong ? 2.6 : need)) continue; if (strong && lum(f) > .8) continue;
      if (!fix) { out.push({ el, cr: +c0.toFixed(2), fg: cs.color, bg: 'rgb(' + bg.slice(0, 3).map(Math.round) + ')', tx: t.data.trim().slice(0, 30) }); continue; }
      const toward = strong ? WH : DK; let k = .15, n = f;
      while (k <= 1.001) { n = tone(f, toward, k); if (cr(n, bg) >= need) break; k += .15; }
      el.style.setProperty('color', `rgb(${n.slice(0, 3).map(Math.round).join(',')})`, 'important'); el.dataset.lf = '1';
    }
    return out; };
  const on = () => document.documentElement.dataset.theme === 'light';
  const clear = () => document.querySelectorAll('[data-lf]').forEach(e => { e.style.removeProperty('color'); delete e.dataset.lf; });
  let q = new Set(), tm = 0;
  const run = () => { tm = 0; if (!on()) { q.clear(); return; } const L = [...q].filter(n => n.isConnected); q.clear(); L.filter(n => !L.some(o => o !== n && o.contains(n))).forEach(n => scan(n, true)); };
  const later = n => { q.add(n); if (!tm) tm = setTimeout(run, 140); };
  const unfix = e => { if (e.dataset.lf) { e.style.removeProperty('color'); delete e.dataset.lf; } e.querySelectorAll('[data-lf]').forEach(x => { x.style.removeProperty('color'); delete x.dataset.lf; }); };
  const mo = new MutationObserver(ms => { if (!on()) return; for (const m of ms) { if (m.type === 'attributes') { const e = m.target; if (e.nodeType === 1 && !e.closest('#chartTip,#dxTip')) { unfix(e); later(e); } continue; } m.addedNodes.forEach(x => { const e = x.nodeType === 1 ? x : x.parentElement; if (e && !e.closest('#chartTip')) later(e); }); } });
  const all = () => { clear(); if (on()) later(document.body); };
  new MutationObserver(all).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const go = () => { mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); all(); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
  return { scan, clear, all, cr, parse };
})();
