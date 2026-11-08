/* graph.js - flow chart (layered), mind map (radial) and network (force) in SVG with pan / zoom / drag */
'use strict';

const Graph = {
  colors() { const cs = getComputedStyle(document.documentElement); const g = k => cs.getPropertyValue(k).trim(); return { s: PALETTE(), text: g('--text-primary'), muted: g('--text-muted'), surface: g('--surface-1'), surface2: g('--surface-2'), border: g('--border') }; },

  /* nodes: [{id,label,sub,kind,value,layer}]  edges: [{from,to,amount,count,txns?}] */
  mount(box, nodes, edges, opt = {}) {
    const C = this.colors(), HL = C.s[1];
    const KIND = { victim: C.s[1], account: C.s[0], risk: C.s[7], cash: C.s[3], hold: C.s[2], nodal: C.s[5], ident: C.s[6], profile: C.s[4], other: C.muted };
    const byId = new Map(nodes.map(n => [n.id, n]));
    edges = edges.filter(e => byId.has(e.from) && byId.has(e.to));
    const maxV = Math.max(1, ...nodes.map(n => n.value || 0)), maxE = Math.max(1, ...edges.map(e => e.amount || 0));
    nodes.forEach(n => n.r = 7 + 15 * Math.sqrt((n.value || 0) / maxV));
    const mode = opt.mode || 'flow';
    const layout = () => { if (mode === 'flow') this.layoutFlow(nodes, edges); else if (mode === 'mind') this.layoutMind(nodes, edges, opt.root); else this.layoutForce(nodes, edges); };
    layout();
    const outE = new Map(), inE = new Map();
    edges.forEach((e, i) => { (outE.get(e.from) || outE.set(e.from, []).get(e.from)).push(i); (inE.get(e.to) || inE.set(e.to, []).get(e.to)).push(i); });
    const fmtD = d => { d = String(d || ''); const m = d.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/); return m ? `${m[3]}-${m[2]}-${m[1].slice(2)}${m[4] ? ' ' + m[4] : ''}` : d; };
    const edgeDate = e => { const ds = (e.txns || []).map(t => t.date).filter(Boolean).sort(); return ds.length ? fmtD(ds[0]) + (ds.length > 1 && ds[ds.length - 1].slice(0, 10) !== ds[0].slice(0, 10) ? ' → ' + fmtD(ds[ds.length - 1]).slice(0, 8) : '') : ''; };

    box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><defs>
      <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.muted}"/></marker>
      <marker id="arrH" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${HL}"/></marker></defs>
      <rect width="100%" height="100%" fill="${C.surface2}" class="bg"/><g class="vp"><g class="cols"></g><g class="edges"></g><g class="elabels"></g><g class="nodes"></g></g></svg>
      <div class="graph-zoom"><button class="btn sm" data-z="in" title="Zoom in">＋</button><button class="btn sm" data-z="out" title="Zoom out">－</button><button class="btn sm" data-z="fit" title="Fit to screen">⤢</button>
        <button class="btn sm" data-z="lbl" title="Labels on lines: amount → amount + date + layer → none">₹</button><button class="btn sm ${opt.live ? 'primary' : ''}" data-z="live" title="Live money flow: moving lines from sender to receiver">⚡</button><button class="btn sm" data-z="wide" title="More space between layers">↔</button><button class="btn sm" data-z="tall" title="More space between accounts">↕</button>
        <button class="btn sm" data-z="tight" title="Less space">⇲</button><button class="btn sm" data-z="re" title="Re-arrange automatically">⟲</button></div>
      <div class="graph-legend">${[['victim', 'Victim / source'], ['account', 'Account'], ['risk', 'High-risk / mule'], ['cash', 'Cash-out / ATM'], ['hold', 'Amount on hold'], ['nodal', 'Nodal / escrow / PG'], ['ident', 'Identifier'], ['profile', 'Social profile']].filter(([k]) => nodes.some(n => n.kind === k)).map(([k, l]) => `<span><i style="background:${KIND[k]}"></i>${l}</span>`).join('')}<span class="muted">Click account = highlight full trail · drag account${mode === 'flow' ? ' or "Layer" title' : ''} to move · scroll = zoom</span></div>`;
    const svg = $('svg', box); if (opt.live) svg.classList.add('live'); const vp = $('.vp', svg), gC = $('.cols', svg), gE = $('.edges', svg), gL = $('.elabels', svg), gN = $('.nodes', svg);
    let T = { x: 0, y: 0, k: 1 }, lblMode = opt.labels === false ? 0 : opt.labels === 'full' ? 2 : 1, hl = null, timers = [];
    const apply = () => vp.setAttribute('transform', `translate(${T.x},${T.y}) scale(${T.k})`);
    const path = e => {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (a === b) return `M${a.x},${a.y - a.r} c40,-50 60,10 ${a.r},${a.r}`;
      if (mode === 'flow' && Math.abs(b.x - a.x) <= 20) { const x1 = a.x + a.r, x2 = b.x + b.r + 4, cx = a.x + 120 + Math.abs(b.y - a.y) * .15; return `M${x1},${a.y} C${cx},${a.y} ${cx},${b.y} ${x2},${b.y}`; }
      if (mode === 'flow' && b.x > a.x + 20) { const x1 = a.x + a.r, x2 = b.x - b.r - 4, mx = (x1 + x2) / 2; return `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`; }
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const x1 = a.x + dx / d * a.r, y1 = a.y + dy / d * a.r, x2 = b.x - dx / d * (b.r + 4), y2 = b.y - dy / d * (b.r + 4);
      if (mode === 'flow') { const cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 60; return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`; }
      return `M${x1},${y1} L${x2},${y2}`;
    };
    const mid = e => { const a = byId.get(e.from), b = byId.get(e.to); if (mode === 'flow' && a !== b && Math.abs(b.x - a.x) <= 20) return [a.x + 100 + Math.abs(b.y - a.y) * .11, (a.y + b.y) / 2]; return [(a.x + b.x) / 2, (a.y + b.y) / 2 - 5]; };
    const ew = e => (1 + 6 * Math.sqrt((e.amount || 0) / maxE)).toFixed(1);
    gE.innerHTML = edges.map((e, i) => `<path data-e="${i}" d="${path(e)}" fill="none" stroke="${C.muted}" stroke-opacity=".55" stroke-width="${ew(e)}" marker-end="url(#arr)"><title>${esc(accLabel(e.from))} → ${esc(accLabel(e.to))}\n${fmtINR(e.amount)} in ${e.count} txn(s)${edgeDate(e) ? '\n' + edgeDate(e) : ''}</title></path>`).join('');
    const drawLabels = () => {
      gL.innerHTML = edges.map((e, i) => {
        const on = hl && hl.edges.has(i); if (!on && (!lblMode || hl)) return ''; if (!e.amount && !on) return '';
        const [x, y] = mid(e);
        if (on) { const dt = edgeDate(e); return `<g data-l="${i}" class="hl-lbl" style="opacity:0"><text x="${x}" y="${y - 4}" text-anchor="middle" font-size="12" font-weight="700" fill="${C.text}" paint-order="stroke" stroke="${C.surface2}" stroke-width="4">${esc(fmtINR(e.amount))}</text>${dt || e.tag ? `<text x="${x}" y="${y + 10}" text-anchor="middle" font-size="10.5" fill="${HL}" paint-order="stroke" stroke="${C.surface2}" stroke-width="4">${esc([e.tag, dt].filter(Boolean).join(' · '))}</text>` : ''}</g>`; }
        if (lblMode === 2) { const dt = edgeDate(e), t2 = [e.tag, dt].filter(Boolean).join(' · '); return `<g data-l="${i}"><text x="${x}" y="${y - 2}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${C.text}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(fmtINR(e.amount))}</text>${t2 ? `<text x="${x}" y="${y + 10}" text-anchor="middle" font-size="9" fill="${C.muted}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(t2)}</text>` : ''}</g>`; }
        return `<text data-l="${i}" x="${x}" y="${y}" text-anchor="middle" font-size="10" fill="${C.text}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(Charts.short(e.amount))}</text>`;
      }).join('');
      if (hl) hl.shown.forEach(i => { const l = gL.querySelector(`[data-l="${i}"]`); if (l) l.style.opacity = 1; });
    };
    gN.innerHTML = nodes.map((n, i) => `<g data-n="${i}" transform="translate(${n.x},${n.y})" style="cursor:pointer">
      <circle class="ring" r="${n.r + 5}" fill="none" stroke="${HL}" stroke-width="3" opacity="0"/>
      <circle r="${n.r}" fill="${KIND[n.kind] || KIND.other}" stroke="${C.surface}" stroke-width="2"/>
      ${n.badge ? `<text y="4" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${esc(n.badge)}</text>` : ''}
      <text y="${n.r + 13}" text-anchor="middle" font-size="11" fill="${C.text}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(String(n.label).slice(0, 24))}</text>
      ${n.sub ? `<text y="${n.r + 25}" text-anchor="middle" font-size="9.5" fill="${C.muted}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(String(n.sub).slice(0, 30))}</text>` : ''}
      <title>${esc(n.title || n.label)}</title></g>`).join('');
    const nodeEl = n => gN.children[nodes.indexOf(n)];
    // layer titles (flow chart): drag a title to move the whole layer
    const colsOf = () => mode === 'flow' ? [...groupBy(nodes, n => n.layer || 0)].sort((a, b) => a[0] - b[0]) : [];
    const drawCols = () => {
      gC.innerHTML = colsOf().map(([k, list]) => { const x = list.reduce((a, n) => a + n.x, 0) / list.length, y = Math.min(...list.map(n => n.y)) - 48;
        return `<g data-col="${k}" style="cursor:move"><rect x="${x - 52}" y="${y - 16}" width="104" height="24" rx="12" fill="${C.surface}" stroke="${C.border}"/><text x="${x}" y="${y + 1}" text-anchor="middle" font-size="12" font-weight="700" fill="${C.text}">${k === 0 ? 'Victim' : 'Layer ' + k} · ${list.length}</text></g>`; }).join('');
    };
    const redraw = moved => {
      moved.forEach(n => nodeEl(n).setAttribute('transform', `translate(${n.x},${n.y})`));
      const ids = new Set(moved.map(n => n.id));
      edges.forEach((ed, i) => { if (ids.has(ed.from) || ids.has(ed.to)) gE.children[i].setAttribute('d', path(ed)); });
      drawLabels(); drawCols();
    };
    drawLabels(); drawCols();
    const fit = () => {
      if (!nodes.length) return; const W = box.clientWidth || 900, H = box.clientHeight || 600;
      const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
      const x0 = Math.min(...xs) - 90, x1 = Math.max(...xs) + 90, y0 = Math.min(...ys) - 80, y1 = Math.max(...ys) + 60;
      T.k = Math.min(2, W / (x1 - x0), H / (y1 - y0)); T.x = (W - (x1 + x0) * T.k) / 2; T.y = (H - (y1 + y0) * T.k) / 2; apply();
    };
    fit();
    const zoomAt = (f, cx, cy) => { const k = Math.max(.05, Math.min(6, T.k * f)); T.x = cx - (cx - T.x) * k / T.k; T.y = cy - (cy - T.y) * k / T.k; T.k = k; apply(); };
    const scale = (fx, fy) => { nodes.forEach(n => { n.x *= fx; n.y *= fy; }); redraw(nodes); };
    svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    $$('[data-z]', box).forEach(b => b.onclick = () => {
      const z = b.dataset.z;
      if (z === 'fit') fit(); else if (z === 'lbl') { lblMode = (lblMode + 1) % 3; drawLabels(); }
      else if (z === 'live') { svg.classList.toggle('live'); b.classList.toggle('primary', svg.classList.contains('live')); }
      else if (z === 'wide') scale(1.25, 1); else if (z === 'tall') scale(1, 1.25); else if (z === 'tight') scale(.85, .85);
      else if (z === 're') { layout(); redraw(nodes); fit(); }
      else zoomAt(z === 'in' ? 1.3 : 1 / 1.3, box.clientWidth / 2, box.clientHeight / 2);
    });
    // drag: background pans, node moves, layer title moves the whole layer
    let drag = null;
    svg.addEventListener('pointerdown', e => {
      const g = e.target.closest('[data-n]'), col = e.target.closest('[data-col]');
      drag = { sx: e.clientX, sy: e.clientY, ox: T.x, oy: T.y, moved: false, list: null, node: null };
      if (g) { drag.node = nodes[+g.dataset.n]; drag.list = [drag.node]; }
      else if (col) drag.list = nodes.filter(n => String(n.layer || 0) === col.dataset.col);
      if (drag.list) drag.start = drag.list.map(n => [n.x, n.y]);
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.list) { drag.list.forEach((n, i) => { n.x = drag.start[i][0] + dx / T.k; n.y = drag.start[i][1] + dy / T.k; }); redraw(drag.list); }
      else { T.x = drag.ox + dx; T.y = drag.oy + dy; apply(); }
    });
    svg.addEventListener('pointerup', () => {
      if (drag && !drag.moved) { if (drag.node) { if (opt.onNode) opt.onNode(drag.node, api); if (opt.trail !== false) api.highlightNode(drag.node.id); } else if (!drag.list) api.clear(); }
      drag = null;
    });
    // hover: show neighbours (only when no trail is highlighted)
    $$('[data-n]', gN).forEach(g => {
      g.onmouseenter = () => { if (hl) return; const n = nodes[+g.dataset.n]; edges.forEach((e, i) => { const on = e.from === n.id || e.to === n.id; gE.children[i].setAttribute('stroke', on ? HL : C.muted); gE.children[i].setAttribute('stroke-opacity', on ? '.95' : '.25'); }); };
      g.onmouseleave = () => { if (hl) return; edges.forEach((e, i) => { gE.children[i].setAttribute('stroke', C.muted); gE.children[i].setAttribute('stroke-opacity', '.55'); }); };
    });

    /* ---- full trail highlight: everything upstream (to the victim) and downstream (to the last account) ---- */
    const walk = (startNodes, dir) => { const seen = new Set(), es = new Set(), q = [...startNodes]; while (q.length) { const id = q.shift(); if (seen.has(id)) continue; seen.add(id); for (const i of (dir > 0 ? outE : inE).get(id) || []) { es.add(i); q.push(dir > 0 ? edges[i].to : edges[i].from); } } return es; };
    function show(edgeSet, focusIds) {
      timers.forEach(clearTimeout); timers = [];
      const nodeSet = new Set(); edgeSet.forEach(i => { nodeSet.add(edges[i].from); nodeSet.add(edges[i].to); }); focusIds.forEach(id => nodeSet.add(id));
      // step number of each hop = distance from the start of the trail
      const hasIn = new Set([...edgeSet].map(i => edges[i].to)); const dist = new Map(); const q = [...nodeSet].filter(id => !hasIn.has(id) || ![...edgeSet].some(i => edges[i].to === id && edges[i].from !== id)).map(id => [id, 0]);
      while (q.length) { const [id, d] = q.shift(); if (dist.has(id) && dist.get(id) <= d) continue; dist.set(id, d); if (d > 50) continue; for (const i of outE.get(id) || []) if (edgeSet.has(i) && edges[i].to !== id) q.push([edges[i].to, d + 1]); }
      const order = [...edgeSet].sort((a, b) => (dist.get(edges[a].from) || 0) - (dist.get(edges[b].from) || 0));
      hl = { edges: edgeSet, nodes: nodeSet, shown: new Set(), order, dist };
      edges.forEach((e, i) => { const p = gE.children[i]; p.classList.remove('hl-run'); p.setAttribute('stroke', C.muted); p.setAttribute('stroke-opacity', edgeSet.has(i) ? '.25' : '.07'); p.setAttribute('marker-end', 'url(#arr)'); });
      nodes.forEach((n, i) => { const g = gN.children[i]; g.style.opacity = nodeSet.has(n.id) ? 1 : .15; g.querySelector('.ring').setAttribute('opacity', focusIds.includes(n.id) ? 1 : 0); });
      drawLabels();
      const steps = groupBy(order, i => dist.get(edges[i].from) || 0); let t = 0;
      [...steps.keys()].sort((a, b) => a - b).forEach(k => {
        timers.push(setTimeout(() => steps.get(k).forEach(i => { const p = gE.children[i]; p.setAttribute('stroke', HL); p.setAttribute('stroke-opacity', '1'); p.setAttribute('stroke-width', Math.max(3, ew(edges[i]))); p.setAttribute('marker-end', 'url(#arrH)'); p.classList.add('hl-run'); hl.shown.add(i); const l = gL.querySelector(`[data-l="${i}"]`); if (l) l.style.opacity = 1; }), t));
        t += 650;
      });
      if (opt.onTrail) opt.onTrail(order.map(i => ({ ...edges[i], step: (dist.get(edges[i].from) || 0) + 1 })), api);
    }
    const api = {
      svg,
      highlightNode(id) { if (!byId.has(id)) return; show(new Set([...walk([id], -1), ...walk([id], 1)]), [id]); },
      highlightEdge(from, to) { const i = edges.findIndex(e => e.from === from && e.to === to); if (i < 0) return this.highlightNode(byId.has(to) ? to : from); show(new Set([i, ...walk([from], -1), ...walk([to], 1)]), [from, to]); },
      replay() { if (hl) show(hl.edges, nodes.filter((n, i) => gN.children[i].querySelector('.ring').getAttribute('opacity') === '1').map(n => n.id)); },
      clear() {
        if (!hl) return; timers.forEach(clearTimeout); hl = null;
        edges.forEach((e, i) => { const p = gE.children[i]; p.classList.remove('hl-run'); p.setAttribute('stroke', C.muted); p.setAttribute('stroke-opacity', '.55'); p.setAttribute('stroke-width', ew(e)); p.setAttribute('marker-end', 'url(#arr)'); });
        nodes.forEach((n, i) => { gN.children[i].style.opacity = 1; gN.children[i].querySelector('.ring').setAttribute('opacity', 0); });
        drawLabels(); if (opt.onClear) opt.onClear();
      },
      exportSVG(name) {
        const clone = svg.cloneNode(true); const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
        const x0 = Math.min(...xs) - 120, y0 = Math.min(...ys) - 80, w = Math.max(...xs) - x0 + 120, h = Math.max(...ys) - y0 + 80;
        clone.setAttribute('viewBox', `${x0} ${y0} ${w} ${h}`); clone.setAttribute('width', w); clone.setAttribute('height', h);
        clone.querySelector('.vp').removeAttribute('transform'); const bg = clone.querySelector('.bg'); bg.setAttribute('x', x0); bg.setAttribute('y', y0); bg.setAttribute('width', w); bg.setAttribute('height', h);
        clone.querySelectorAll('.hl-lbl').forEach(l => l.style.opacity = 1);
        const str = new XMLSerializer().serializeToString(clone);
        return { str, w, h };
      },
      download(name, png) {
        const { str, w, h } = this.exportSVG();
        if (!png) return UI.download(name + '.svg', str, 'image/svg+xml');
        const img = new Image(); const sc = Math.min(3, 6000 / Math.max(w, h));
        img.onload = () => { const c = document.createElement('canvas'); c.width = w * sc; c.height = h * sc; const ctx = c.getContext('2d'); ctx.scale(sc, sc); ctx.drawImage(img, 0, 0); c.toBlob(b => UI.download(name + '.png', b)); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
      }
    };
    return api;
  },

  layoutFlow(nodes, edges) {
    const cols = groupBy(nodes, n => n.layer || 0);
    const keys = [...cols.keys()].sort((a, b) => a - b);
    const inc = new Map(); edges.forEach(e => { if (!inc.has(e.to)) inc.set(e.to, []); inc.get(e.to).push(e.from); });
    let prevOrder = new Map();
    keys.forEach((k, ci) => {
      const col = cols.get(k);
      // order by parent position (reduces crossings), then by value
      col.forEach(n => { const ps = (inc.get(n.id) || []).map(p => prevOrder.get(p)).filter(v => v != null); n._o = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 1e9; });
      col.sort((a, b) => a._o - b._o || (b.value || 0) - (a.value || 0));
      const gap = 84, h = col.length * gap;
      col.forEach((n, i) => { n.x = ci * 360; n.y = i * gap - h / 2; prevOrder.set(n.id, n.y); });
    });
  },

  layoutMind(nodes, edges, rootId) {
    const byId = new Map(nodes.map(n => [n.id, n])); const root = byId.get(rootId) || nodes[0]; if (!root) return;
    const kids = new Map(); const seen = new Set([root.id]); const q = [root.id]; const depth = new Map([[root.id, 0]]);
    const adj = new Map(); edges.forEach(e => { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from).push(e.to); if (!adj.has(e.to)) adj.set(e.to, []); adj.get(e.to).push(e.from); });
    while (q.length) { const id = q.shift(); for (const c of adj.get(id) || []) if (!seen.has(c)) { seen.add(c); depth.set(c, depth.get(id) + 1); if (!kids.has(id)) kids.set(id, []); kids.get(id).push(c); q.push(c); } }
    const leaves = id => (kids.get(id) || []).length ? kids.get(id).reduce((a, c) => a + leaves(c), 0) : 1;
    const place = (id, a0, a1) => {
      const n = byId.get(id), d = depth.get(id), a = (a0 + a1) / 2, R = d * 210;
      n.x = Math.cos(a) * R; n.y = Math.sin(a) * R * .8;
      let s = a0; const tot = leaves(id);
      for (const c of kids.get(id) || []) { const span = (a1 - a0) * leaves(c) / tot; place(c, s, s + span); s += span; }
    };
    place(root.id, 0, Math.PI * 2);
    let extra = 0; nodes.forEach(n => { if (!seen.has(n.id)) { n.x = 900 + (extra % 6) * 120; n.y = Math.floor(extra / 6) * 70; extra++; } });
  },

  layoutForce(nodes, edges) {
    const byId = new Map(nodes.map(n => [n.id, n])); const n = nodes.length;
    nodes.forEach((d, i) => { const a = i * 2.399963, r = 18 * Math.sqrt(i + 1); d.x = Math.cos(a) * r * 3; d.y = Math.sin(a) * r * 3; d.vx = 0; d.vy = 0; });
    const iters = n > 400 ? 160 : 320, kRep = 9000, L = 150;
    for (let it = 0; it < iters; it++) {
      const alpha = 1 - it / iters;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = nodes[i], b = nodes[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + .01; if (d2 > 250000) continue;
        const f = kRep / d2; const d = Math.sqrt(d2); dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
      for (const e of edges) { const a = byId.get(e.from), b = byId.get(e.to); if (a === b) continue; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - L) * .04; a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; }
      for (const d of nodes) { d.vx -= d.x * .004; d.vy -= d.y * .004; d.x += Math.max(-30, Math.min(30, d.vx)) * alpha; d.y += Math.max(-30, Math.min(30, d.vy)) * alpha; d.vx *= .5; d.vy *= .5; }
    }
  }
};
