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
    // money graphs: circle size = how many accounts it sent money on to (bulk split) + amount; layer number inside
    const money = nodes.some(n => n.layer), fanOut = new Map();
    edges.forEach(e => { let s = fanOut.get(e.from); if (!s) fanOut.set(e.from, s = new Set()); s.add(e.to); });
    nodes.forEach(n => n.fan = (fanOut.get(n.id) || new Set()).size);
    const maxF = Math.max(1, ...nodes.map(n => n.fan)), BULK = Math.max(4, Math.ceil(maxF * .35));
    nodes.forEach(n => { n.bulk = money && n.fan >= BULK && n.fan >= 4; n.r = money ? 12 + 22 * Math.sqrt(n.fan / maxF) + 6 * Math.sqrt((n.value || 0) / maxV) : 7 + 15 * Math.sqrt((n.value || 0) / maxV); });
    const lab = n => (money && n.layer ? 'L' + n.layer + ' · ' : '') + String(n.label).slice(0, 24) + (n.bulk ? ' ⇉' + n.fan : '');
    const mode = opt.mode || 'flow', isMind = mode === 'mind', lay = mode === 'flow' || isMind;
    nodes.forEach(n => n.w = isMind ? Math.min(330, 34 + 8 * (lab(n).length + (n.badge ? 3 : 0))) * (n.bulk ? 1.08 : 1) : 0);
    const hw = n => isMind ? n.w / 2 : n.r;
    let vert = !!opt.vert;
    // portrait: layers go top → bottom instead of left → right
    const rot = () => { const fx = lay ? (isMind ? (Math.max(150, ...nodes.map(n => n.w)) + 30) / 50 : 1.9) : .75, fy = lay ? (isMind ? .55 : .62) : 1.33; nodes.forEach(n => { const x = n.x; n.x = n.y * fx; n.y = x * fy; }); };
    const layout = () => { if (mode === 'flow') this.layoutFlow(nodes, edges); else if (isMind) this.layoutMind(nodes, edges, opt.root); else if (opt.radial) this.layoutRadial(nodes, edges, opt.root); else this.layoutForce(nodes, edges, opt.root); if (vert) rot(); };
    layout();
    const outE = new Map(), inE = new Map();
    edges.forEach((e, i) => { (outE.get(e.from) || outE.set(e.from, []).get(e.from)).push(i); (inE.get(e.to) || inE.set(e.to, []).get(e.to)).push(i); });
    /* colours: by type (default for other charts), by victim (each victim's whole trail one colour) or by layer */
    const PAL = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#6366f1', '#14b8a6', '#eab308', '#f97316'];
    // one clearly different colour per layer: Victim orange, L1 blue, L2 green, L3 purple, L4 red, L5 yellow, L6 pink, L7 cyan, L8 brown, L9 lime …
    const LPAL = ['#f97316', '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#eab308', '#db2777', '#0891b2', '#a16207', '#65a30d', '#4f46e5', '#64748b'];
    let colorBy = opt.trailColors ? (opt.colorBy || 'layer') : 'kind';
    const vcol = new Map(), victims = [];
    if (opt.trailColors) {
      const hasIn = new Set(edges.filter(e => e.from !== e.to).map(e => e.to));
      let roots = nodes.filter(n => n.kind === 'victim'); if (!roots.length) roots = nodes.filter(n => !hasIn.has(n.id));
      roots = roots.slice().sort((a, b) => (b.value || 0) - (a.value || 0));
      const q = []; roots.forEach((r, i) => { const c = PAL[i % PAL.length]; vcol.set(r.id, c); victims.push([r, c]); q.push(r.id); });
      while (q.length) { const id = q.shift(); for (const i of (outE.get(id) || []).slice().sort((a, b) => edges[b].amount - edges[a].amount)) { const t = edges[i].to; if (!vcol.has(t)) { vcol.set(t, vcol.get(id)); q.push(t); } } }
    }
    const lcol = n => LPAL[(n.layer || 0) % LPAL.length];
    const nodeCol = n => colorBy === 'victim' ? (vcol.get(n.id) || C.muted) : colorBy === 'layer' ? lcol(n) : (KIND[n.kind] || KIND.other);
    const edgeCol = i => colorBy === 'kind' ? C.muted : colorBy === 'victim' ? (vcol.get(edges[i].from) || C.muted) : lcol(byId.get(edges[i].to));
    const eop = () => colorBy === 'kind' ? '.55' : '.8';
    const ink = c => { const m = /^#(..)(..)(..)$/.exec(c || ''); if (!m) return '#fff'; const [r, g, b] = m.slice(1).map(h => parseInt(h, 16)); return (r * 299 + g * 587 + b * 114) / 1000 > 165 ? '#1f1300' : '#fff'; };
    const fmtD = d => { d = String(d || ''); const m = d.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/); return m ? `${m[3]}-${m[2]}-${m[1].slice(2)}${m[4] ? ' ' + m[4] : ''}` : d; };
    const edgeDate = e => { const ds = (e.txns || []).map(t => t.date).filter(Boolean).sort(); return ds.length ? fmtD(ds[0]) + (ds.length > 1 && ds[ds.length - 1].slice(0, 10) !== ds[0].slice(0, 10) ? ' → ' + fmtD(ds[ds.length - 1]).slice(0, 8) : '') : ''; };

    const sizeKey = () => money ? `<span class="g-size" title="Circle size"><svg width="62" height="22" viewBox="0 0 62 22"><circle cx="8" cy="11" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="24" cy="11" r="7.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="48" cy="11" r="10" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="3 2"/></svg>Bigger circle = sent to more accounts · <b style="color:#fbbf24">gold ring ⇉N</b> = bulk split to N accounts (${BULK}+) · <b>L1, L2…</b> = layer</span>` : '';
    const legend = () => sizeKey() + legend0();
    const legend0 = () => {
      const sel = opt.trailColors ? `<select class="gcol" title="How to colour the chart">${[['layer', 'Colour: each layer'], ['victim', 'Colour: each victim\'s trail'], ['kind', 'Colour: account type']].map(([v, l]) => `<option value="${v}" ${v === colorBy ? 'selected' : ''}>${l}</option>`).join('')}</select>` : '';
      if (colorBy === 'victim') return sel + victims.slice(0, 14).map(([r, c]) => `<span><i style="background:${c}"></i>${esc(String(r.label).replace(/^Victim /, '').slice(0, 22))}</span>`).join('') + (victims.length > 14 ? `<span class="muted">+${victims.length - 14} more</span>` : '') + `<span class="muted">Each victim and the whole trail of its money have the same colour.</span>`;
      if (colorBy === 'layer') return sel + uniq(nodes.map(n => n.layer || 0)).sort((a, b) => a - b).map(l => `<span><i style="background:${LPAL[l % LPAL.length]}"></i>${l ? 'Layer ' + l : 'Victim'}</span>`).join('') + `<span class="muted">Lines take the colour of the layer they go to.</span>`;
      return sel + `${[['victim', 'Victim / source'], ['account', 'Account'], ['risk', 'High-risk / mule'], ['cash', 'Cash-out / ATM'], ['hold', 'Amount on hold'], ['nodal', 'Nodal / escrow / PG'], ['ident', 'Identifier'], ['profile', 'Social profile']].filter(([k]) => nodes.some(n => n.kind === k)).map(([k, l]) => `<span><i style="background:${KIND[k]}"></i>${l}</span>`).join('')}${nodes.some(n => n.more) ? `<span><b style="color:${HL}">+N</b> = open the accounts it paid</span>` : ''}<span class="muted">Point at a line = highlight · click a line = trail from victim through that transaction to the end · click an account = trail from victim to that account · drag account${mode === 'flow' ? ' or "Layer" title' : ''} to move · scroll = zoom</span>`;
    };
    box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><defs>
      <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.muted}"/></marker>
      <marker id="arrH" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${HL}"/></marker></defs>
      <rect width="100%" height="100%" fill="${C.surface2}" class="bg"/><g class="vp"><g class="cols"></g><g class="edges"></g><g class="ehit"></g><g class="elabels" style="pointer-events:none"></g><g class="nodes"></g></g></svg>
      <div class="graph-zoom"><button class="btn sm" data-z="in" title="Zoom in">＋</button><button class="btn sm" data-z="out" title="Zoom out">－</button><button class="btn sm" data-z="fit" title="Fit to screen">⤢</button>
        <button class="btn sm" data-z="lbl" title="Labels on lines: amount → amount + date + layer → none">₹</button><button class="btn sm ${opt.live ? 'primary' : ''}" data-z="live" title="Live money flow: moving lines from sender to receiver">⚡</button><button class="btn sm" data-z="wide" title="More space between layers">↔</button><button class="btn sm" data-z="tall" title="More space between accounts">↕</button>
        <button class="btn sm" data-z="tight" title="Less space">⇲</button><button class="btn sm" data-z="re" title="Re-arrange automatically">⟲</button><button class="btn sm" data-z="orient" title="Turn the chart: landscape ↔ portrait">${opt.vert ? '▭' : '▯'}</button></div>
      <div class="graph-legend">${legend()}</div>`;
    const svg = $('svg', box); if (opt.live) svg.classList.add('live'); const vp = $('.vp', svg), gC = $('.cols', svg), gE = $('.edges', svg), gH = $('.ehit', svg), gL = $('.elabels', svg), gN = $('.nodes', svg);
    let last = null, T = { x: 0, y: 0, k: 1 }, lblMode = opt.labels === false ? 0 : opt.labels === 'full' ? 2 : 1, hl = null, timers = [];
    const apply = () => { vp.setAttribute('transform', `translate(${T.x},${T.y}) scale(${T.k})`); svg.style.setProperty('--iz', (1 / Math.max(1, T.k)).toFixed(3)); };
    const path = e => {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (a === b) return `M${a.x},${a.y - a.r} c40,-50 60,10 ${a.r},${a.r}`;
      if (lay && vert) {
        const bot = n => isMind ? 52 : n.r + 40, top = n => isMind ? 20 : n.r + 4;
        if (Math.abs(b.y - a.y) <= 20) { const y1 = a.y + bot(a), cy = y1 + 70 + Math.abs(b.x - a.x) * .12; return `M${a.x},${y1} C${a.x},${cy} ${b.x},${cy} ${b.x},${b.y + bot(b)}`; }
        if (b.y > a.y + 20) { const y1 = a.y + bot(a), y2 = b.y - top(b), my = (y1 + y2) / 2; return `M${a.x},${y1} C${a.x},${my} ${b.x},${my} ${b.x},${y2}`; }
        return `M${a.x + hw(a)},${a.y} Q${Math.max(a.x, b.x) + 140},${(a.y + b.y) / 2} ${b.x + hw(b) + 4},${b.y}`;
      }
      if (lay && Math.abs(b.x - a.x) <= 20) { const x1 = a.x + hw(a), x2 = b.x + hw(b) + 4, cx = a.x + hw(a) + 100 + Math.abs(b.y - a.y) * .15; return `M${x1},${a.y} C${cx},${a.y} ${cx},${b.y} ${x2},${b.y}`; }
      if (lay && b.x > a.x + 20) { const x1 = a.x + hw(a), x2 = b.x - hw(b) - 4, mx = (x1 + x2) / 2; return `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`; }
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const x1 = a.x + dx / d * a.r, y1 = a.y + dy / d * a.r, x2 = b.x - dx / d * (b.r + 4), y2 = b.y - dy / d * (b.r + 4);
      if (lay) { const cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 60; return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`; }
      return `M${x1},${y1} L${x2},${y2}`;
    };
    const mid = e => { const a = byId.get(e.from), b = byId.get(e.to); if (lay && vert) { if (a !== b && Math.abs(b.y - a.y) <= 20) return [(a.x + b.x) / 2, a.y + 95]; if (b.y > a.y + 20) { const y1 = a.y + (isMind ? 52 : a.r + 40), y2 = b.y - (isMind ? 20 : b.r + 4); return [(a.x + b.x) / 2, (y1 + y2) / 2]; } } if (lay && a !== b && Math.abs(b.x - a.x) <= 20) return [a.x + hw(a) + 80 + Math.abs(b.y - a.y) * .11, (a.y + b.y) / 2]; return [(a.x + b.x) / 2, (a.y + b.y) / 2 - 5]; };
    const ew = e => (1 + 6 * Math.sqrt((e.amount || 0) / maxE)).toFixed(1);
    gE.innerHTML = edges.map((e, i) => `<path data-e="${i}" d="${path(e)}" fill="none" stroke="${edgeCol(i)}" stroke-opacity="${eop()}" stroke-width="${ew(e)}" marker-end="url(#arr)"><title>${esc(accLabel(e.from))} → ${esc(accLabel(e.to))}\n${fmtINR(e.amount)} in ${e.count} txn(s)${edgeDate(e) ? '\n' + edgeDate(e) : ''}</title></path>`).join('');
    const tip = e => `${accLabel(e.from)} → ${accLabel(e.to)}\n${fmtINR(e.amount)} in ${e.count} txn(s)${e.tag ? '\n' + e.tag : ''}${edgeDate(e) ? '\n' + edgeDate(e) : ''}\nClick = trace this transaction from start to end`;
    gH.innerHTML = edges.map((e, i) => `<path data-h="${i}" d="${path(e)}" fill="none" stroke="transparent" stroke-width="14" style="cursor:pointer;pointer-events:stroke"><title>${esc(tip(e))}</title></path>`).join('');
    const drawLabels = () => {
      gL.innerHTML = edges.map((e, i) => {
        const on = hl && hl.edges.has(i); if (!on && (!lblMode || hl)) return ''; if (!e.amount && !on) return '';
        const [x, y] = mid(e);
        if (on) { const dt = edgeDate(e); return `<g data-l="${i}" class="hl-lbl el" style="opacity:0"><text x="${x}" y="${y - 4}" text-anchor="middle" font-size="12" font-weight="700" fill="${C.text}" paint-order="stroke" stroke="${C.surface2}" stroke-width="4">${esc(fmtINR(e.amount))}</text>${dt || e.tag ? `<text x="${x}" y="${y + 10}" text-anchor="middle" font-size="10.5" fill="${HL}" paint-order="stroke" stroke="${C.surface2}" stroke-width="4">${esc([e.tag, dt].filter(Boolean).join(' · '))}</text>` : ''}</g>`; }
        if (lblMode === 2) { const dt = edgeDate(e), t2 = [e.tag, dt].filter(Boolean).join(' · '); return `<g data-l="${i}" class="el"><text x="${x}" y="${y - 2}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${C.text}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(fmtINR(e.amount))}</text>${t2 ? `<text x="${x}" y="${y + 10}" text-anchor="middle" font-size="9" fill="${C.muted}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(t2)}</text>` : ''}</g>`; }
        return `<text data-l="${i}" class="el" x="${x}" y="${y}" text-anchor="middle" font-size="10" fill="${C.text}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(Charts.short(e.amount))}</text>`;
      }).join('');
      if (hl) hl.shown.forEach(i => { const l = gL.querySelector(`[data-l="${i}"]`); if (l) l.style.opacity = 1; });
    };
    const more = n => n.more || n.collapse ? `<g data-x="1" transform="translate(${hw(n) + (isMind ? 2 : 4)},${isMind ? -15 : -n.r - 4})" style="cursor:pointer"><circle r="${n.more > 99 ? 12 : 10}" fill="${C.surface}" stroke="${HL}" stroke-width="1.6"/><text y="3.5" text-anchor="middle" font-size="${n.more > 99 ? 8.5 : 10}" font-weight="700" fill="${HL}">${n.more ? '+' + n.more : '−'}</text><title>${n.more ? `Open: show the ${n.more} account(s) this account sent money to` : 'Close: hide the accounts opened from here'}</title></g>` : '';
    gN.innerHTML = nodes.map((n, i) => isMind ? `<g data-n="${i}" transform="translate(${n.x},${n.y})" style="cursor:pointer">
      <rect class="ring" x="${-n.w / 2 - 5}" y="-21" width="${n.w + 10}" height="42" rx="21" fill="none" stroke="${HL}" stroke-width="3" opacity="0"/>
      <rect class="nb" x="${-n.w / 2}" y="${n.bulk ? -19 : -16}" width="${n.w}" height="${n.bulk ? 38 : 32}" rx="${n.bulk ? 19 : 16}" fill="${nodeCol(n)}" stroke="${n.bulk ? '#fbbf24' : C.surface}" stroke-width="${n.bulk ? 3 : 1.5}"/>
      <text class="pt" y="5" text-anchor="middle" font-size="${n.bulk ? 14.5 : 13.5}" font-weight="${n.bulk ? 800 : 600}" fill="${ink(nodeCol(n))}">${n.badge ? '⚑' + esc(n.badge) + ' ' : ''}${esc(lab(n))}</text>
      <g class="nt">${n.det ? `<text y="32" text-anchor="middle" font-size="12" font-weight="600" fill="${C.text}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(String(n.det).slice(0, 44))}</text>` : ''}${n.sub ? `<text y="${n.det ? 46 : 32}" text-anchor="middle" font-size="11" fill="${C.muted}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(String(n.sub).slice(0, 34))}</text>` : ''}</g>
      ${more(n)}<title>${esc(n.title || n.label)}</title></g>` : `<g data-n="${i}" transform="translate(${n.x},${n.y})" style="cursor:pointer">
      <circle class="ring" r="${n.r + 5}" fill="none" stroke="${HL}" stroke-width="3" opacity="0"/>
      ${n.bulk ? `<circle r="${n.r + 6}" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="5 4" opacity=".9"/>` : ''}<circle class="nb" r="${n.r}" fill="${nodeCol(n)}" stroke="${n.bulk ? '#fbbf24' : C.surface}" stroke-width="${n.bulk ? 3 : 2}"/>
      ${money && (n.layer || n.kind === 'victim') ? `<text y="${Math.round(n.r * .3)}" text-anchor="middle" font-size="${Math.max(10, Math.min(20, n.r * .8))}" font-weight="800" fill="${ink(nodeCol(n))}" style="pointer-events:none">${n.layer ? 'L' + n.layer : 'V'}</text>` : n.badge ? `<text y="4" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${esc(n.badge)}</text>` : ''}
      <g class="nt"><text y="${n.r + 13}" text-anchor="middle" font-size="11" font-weight="600" fill="${C.text}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(String(n.label).slice(0, 24))}</text>
      ${n.det ? `<text y="${n.r + 25}" text-anchor="middle" font-size="10" fill="${HL}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(String(n.det).slice(0, 44))}</text>` : ''}
      ${n.sub ? `<text y="${n.r + (n.det ? 37 : 25)}" text-anchor="middle" font-size="9.5" fill="${C.muted}" paint-order="stroke" stroke="${C.surface2}" stroke-width="3">${esc(String(n.sub).slice(0, 30))}</text>` : ''}</g>
      ${more(n)}<title>${esc((n.title || n.label) + (n.fan ? `\nSent money on to ${n.fan} account(s)${n.bulk ? ' – bulk split' : ''}` : ''))}</title></g>`).join('');
    const nodeEl = n => gN.children[nodes.indexOf(n)];
    // layer titles (flow chart): drag a title to move the whole layer
    const colsOf = () => mode === 'flow' || (isMind && nodes.some(n => n.layer)) ? [...groupBy(nodes, n => n.layer || 0)].sort((a, b) => a[0] - b[0]) : [];
    const drawCols = () => {
      gC.innerHTML = colsOf().map(([k, list]) => { const left = n => n.x - (isMind ? n.w / 2 : n.r), bw = isMind ? 132 : 104, lc = isMind ? LPAL[k % LPAL.length] : C.border;
        const x = vert ? Math.min(...list.map(left)) - bw / 2 - 24 : list.reduce((a, n) => a + n.x, 0) / list.length, y = vert ? list.reduce((a, n) => a + n.y, 0) / list.length : Math.min(...list.map(n => n.y)) - (isMind ? 56 : 48);
        return `<g data-col="${k}" style="cursor:move"><rect x="${x - bw / 2}" y="${y - (isMind ? 19 : 16)}" width="${bw}" height="${isMind ? 30 : 24}" rx="${isMind ? 15 : 12}" fill="${C.surface}" stroke="${lc}" stroke-width="${isMind ? 2 : 1}"/><text x="${x}" y="${y + 1}" text-anchor="middle" font-size="${isMind ? 15 : 12}" font-weight="700" fill="${C.text}">${k === 0 ? 'Victim' : 'Layer ' + k} · ${list.length}</text></g>`; }).join('');
    };
    const redraw = moved => {
      moved.forEach(n => nodeEl(n).setAttribute('transform', `translate(${n.x},${n.y})`));
      const ids = new Set(moved.map(n => n.id));
      edges.forEach((ed, i) => { if (ids.has(ed.from) || ids.has(ed.to)) { const d = path(ed); gE.children[i].setAttribute('d', d); gH.children[i].setAttribute('d', d); } });
      drawLabels(); drawCols();
    };
    drawLabels(); drawCols();
    const fit = readable => {
      if (!nodes.length) return; const W = box.clientWidth || 900, H = box.clientHeight || 600;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const n of nodes) { if (n.x < x0) x0 = n.x; if (n.x > x1) x1 = n.x; if (n.y < y0) y0 = n.y; if (n.y > y1) y1 = n.y; }
      x0 -= 90 + (isMind ? 120 : 0); x1 += 90 + (isMind ? 120 : 0); y0 -= 80; y1 += 60;
      T.k = Math.min(2, W / (x1 - x0), H / (y1 - y0)); T.x = (W - (x1 + x0) * T.k) / 2; T.y = (H - (y1 + y0) * T.k) / 2;
      // a big tree would be too small to read: start at a readable size, on the victim
      if (readable && lay && T.k < .55) { const r = byId.get(opt.root) || nodes[0]; T.k = .55; if (vert) { T.x = W / 2 - r.x * T.k; T.y = 30 - y0 * T.k; } else { T.x = 70 - (x0 + 90) * T.k; T.y = H / 2 - r.y * T.k; } }
      apply();
    };
    fit(true); apply();
    const zoomAt = (f, cx, cy) => { const k = Math.max(.05, Math.min(6, T.k * f)); T.x = cx - (cx - T.x) * k / T.k; T.y = cy - (cy - T.y) * k / T.k; T.k = k; apply(); };
    const scale = (fx, fy) => { nodes.forEach(n => { n.x *= fx; n.y *= fy; }); redraw(nodes); };
    svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    $$('[data-z]', box).forEach(b => b.onclick = () => {
      const z = b.dataset.z;
      if (z === 'fit') fit(false); else if (z === 'lbl') { lblMode = (lblMode + 1) % 3; drawLabels(); }
      else if (z === 'live') { svg.classList.toggle('live'); b.classList.toggle('primary', svg.classList.contains('live')); }
      else if (z === 'wide') scale(1.25, 1); else if (z === 'tall') scale(1, 1.25); else if (z === 'tight') scale(.85, .85);
      else if (z === 're') { layout(); redraw(nodes); fit(true); }
      else if (z === 'orient') { vert = !vert; b.textContent = vert ? '▭' : '▯'; layout(); redraw(nodes); fit(true); if (opt.onOrient) opt.onOrient(vert); }
      else zoomAt(z === 'in' ? 1.3 : 1 / 1.3, box.clientWidth / 2, box.clientHeight / 2);
    });
    // drag: background pans, node moves, layer title moves the whole layer
    let drag = null;
    svg.addEventListener('pointerdown', e => {
      const g = e.target.closest('[data-n]'), col = e.target.closest('[data-col]'), h = e.target.closest('[data-h]'), x = e.target.closest('[data-x]');
      unhover();
      drag = { sx: e.clientX, sy: e.clientY, ox: T.x, oy: T.y, moved: false, list: null, node: null, edge: h && !g ? +h.dataset.h : null, expand: x && g ? nodes[+g.dataset.n] : null };
      if (g && !x) { drag.node = nodes[+g.dataset.n]; drag.list = [drag.node]; }
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
      if (drag && !drag.moved) {
        if (drag.expand) { if (opt.onExpand) opt.onExpand(drag.expand, api); }
        else if (drag.node) { if (opt.onNode) opt.onNode(drag.node, api); if (opt.trail !== false) api.traceTo(drag.node.id); }
        else if (drag.edge != null) { if (opt.onEdge) opt.onEdge(edges[drag.edge], api); if (opt.trail !== false) api.traceEdge(drag.edge); }
        else if (!drag.list) api.clear();
      }
      drag = null;
    });
    // hover: show neighbours (only when no trail is highlighted)
    $$('[data-n]', gN).forEach(g => {
      g.onmouseenter = () => { if (hl) return; const n = nodes[+g.dataset.n]; edges.forEach((e, i) => { const on = e.from === n.id || e.to === n.id; gE.children[i].setAttribute('stroke', on ? HL : edgeCol(i)); gE.children[i].setAttribute('stroke-opacity', on ? '.95' : '.2'); }); };
      g.onmouseleave = () => { if (hl) return; edges.forEach((e, i) => { gE.children[i].setAttribute('stroke', edgeCol(i)); gE.children[i].setAttribute('stroke-opacity', eop()); }); };
    });

    // point at a line: make it stand out and show its amount, layer and date
    let hov = null;
    function unhover() {
      if (!hov) return; const p = gE.children[hov.i]; Object.entries(hov.prev).forEach(([k, v]) => v == null ? p.removeAttribute(k) : p.setAttribute(k, v));
      const l = gL.querySelector('.hov-lbl'); if (l) gL.removeChild(l); hov = null;
    }
    $$('[data-h]', gH).forEach(h => {
      h.onmouseenter = () => {
        if (drag) return; unhover(); const i = +h.dataset.h, e = edges[i], p = gE.children[i];
        hov = { i, prev: Object.fromEntries(['stroke', 'stroke-opacity', 'stroke-width', 'marker-end'].map(k => [k, p.getAttribute(k)])) };
        p.setAttribute('stroke', HL); p.setAttribute('stroke-opacity', '1'); p.setAttribute('stroke-width', Math.max(4, +ew(e) + 2)); p.setAttribute('marker-end', 'url(#arrH)');
        const [x, y] = mid(e), dt = edgeDate(e), t2 = [e.tag, dt].filter(Boolean).join(' · ');
        gL.insertAdjacentHTML('beforeend', `<g class="hov-lbl el" style="pointer-events:none"><text x="${x}" y="${y - 6}" text-anchor="middle" font-size="13" font-weight="700" fill="${C.text}" paint-order="stroke" stroke="${C.surface2}" stroke-width="5">${esc(fmtINR(e.amount))}</text>${t2 ? `<text x="${x}" y="${y + 9}" text-anchor="middle" font-size="11" fill="${HL}" paint-order="stroke" stroke="${C.surface2}" stroke-width="4">${esc(t2)}</text>` : ''}</g>`);
      };
      h.onmouseleave = unhover;
    });

    /* ---- full trail highlight: everything upstream (to the victim) and downstream (to the last account) ---- */
    const walk = (startNodes, dir) => { const seen = new Set(), es = new Set(), q = [...startNodes]; while (q.length) { const id = q.shift(); if (seen.has(id)) continue; seen.add(id); for (const i of (dir > 0 ? outE : inE).get(id) || []) { es.add(i); q.push(dir > 0 ? edges[i].to : edges[i].from); } } return es; };
    function show(edgeSet, focusIds, info = {}) {
      unhover(); last = { edgeSet, focusIds, info };
      timers.forEach(clearTimeout); timers = [];
      const nodeSet = new Set(); edgeSet.forEach(i => { nodeSet.add(edges[i].from); nodeSet.add(edges[i].to); }); focusIds.forEach(id => nodeSet.add(id));
      // step number of each hop = distance from the start of the trail
      const hasIn = new Set([...edgeSet].map(i => edges[i].to)); const dist = new Map(); const q = [...nodeSet].filter(id => !hasIn.has(id) || ![...edgeSet].some(i => edges[i].to === id && edges[i].from !== id)).map(id => [id, 0]);
      while (q.length) { const [id, d] = q.shift(); if (dist.has(id) && dist.get(id) <= d) continue; dist.set(id, d); if (d > 50) continue; for (const i of outE.get(id) || []) if (edgeSet.has(i) && edges[i].to !== id) q.push([edges[i].to, d + 1]); }
      const order = [...edgeSet].sort((a, b) => (dist.get(edges[a].from) || 0) - (dist.get(edges[b].from) || 0));
      hl = { edges: edgeSet, nodes: nodeSet, shown: new Set(), order, dist };
      edges.forEach((e, i) => { const p = gE.children[i]; p.classList.remove('hl-run'); p.setAttribute('stroke', edgeCol(i)); p.setAttribute('stroke-opacity', edgeSet.has(i) ? '.3' : '.07'); p.setAttribute('marker-end', 'url(#arr)'); });
      nodes.forEach((n, i) => { const g = gN.children[i]; g.style.opacity = nodeSet.has(n.id) ? 1 : .15; g.querySelector('.ring').setAttribute('opacity', focusIds.includes(n.id) ? 1 : 0); });
      drawLabels();
      const steps = groupBy(order, i => dist.get(edges[i].from) || 0); let t = 0;
      [...steps.keys()].sort((a, b) => a - b).forEach(k => {
        timers.push(setTimeout(() => steps.get(k).forEach(i => { const p = gE.children[i]; p.setAttribute('stroke', HL); p.setAttribute('stroke-opacity', '1'); p.setAttribute('stroke-width', Math.max(3, ew(edges[i]))); p.setAttribute('marker-end', 'url(#arrH)'); p.classList.add('hl-run'); hl.shown.add(i); const l = gL.querySelector(`[data-l="${i}"]`); if (l) l.style.opacity = 1; }), t));
        t += 650;
      });
      if (opt.onTrail) opt.onTrail(order.map(i => ({ ...edges[i], step: (dist.get(edges[i].from) || 0) + 1 })), api, info);
    }
    const recolor = () => {
      nodes.forEach((n, i) => { const g = gN.children[i], b = g.querySelector('.nb'), t = g.querySelector('.pt'); if (b) b.setAttribute('fill', nodeCol(n)); if (t) t.setAttribute('fill', ink(nodeCol(n))); });
      if (last && hl) show(last.edgeSet, last.focusIds, last.info); else edges.forEach((e, i) => { gE.children[i].setAttribute('stroke', edgeCol(i)); gE.children[i].setAttribute('stroke-opacity', eop()); });
      bindLegend();
    };
    function bindLegend() { const lg = $('.graph-legend', box); lg.innerHTML = legend(); const sl = $('.gcol', lg); if (sl) sl.onchange = () => { colorBy = sl.value; if (opt.onColor) opt.onColor(colorBy); recolor(); }; }
    bindLegend();
    const api = {
      svg,
      // whole trail through an account: from the victim, through it, to the last account
      highlightNode(id) { if (!byId.has(id)) return; show(new Set([...walk([id], -1), ...walk([id], 1)]), [id], { type: 'full', node: byId.get(id) }); },
      // several accounts at once: all their trails together
      highlightMany(ids) { ids = ids.filter(id => byId.has(id)); if (!ids.length) return; const es = new Set(); ids.forEach(id => { walk([id], -1).forEach(i => es.add(i)); walk([id], 1).forEach(i => es.add(i)); }); show(es, ids, { type: 'many', count: ids.length }); },
      // from the victim up to this account only
      traceTo(id) { if (!byId.has(id)) return; const es = walk([id], -1); if (!es.size) return this.highlightNode(id); show(es, [id], { type: 'upto', node: byId.get(id) }); },
      // one transaction line: from the victim, through this line, to the end of the trail
      traceEdge(i) { const e = edges[i]; if (!e) return; show(new Set([i, ...walk([e.from], -1), ...walk([e.to], 1)]), [e.from, e.to], { type: 'edge', edge: e, node: byId.get(e.to) }); },
      highlightEdge(from, to) { const i = edges.findIndex(e => e.from === from && e.to === to); if (i < 0) return this.highlightNode(byId.has(to) ? to : from); this.traceEdge(i); },
      replay() { if (last) show(last.edgeSet, last.focusIds, last.info); },
      clear() {
        if (!hl) return; timers.forEach(clearTimeout); hl = null;
        edges.forEach((e, i) => { const p = gE.children[i]; p.classList.remove('hl-run'); p.setAttribute('stroke', edgeCol(i)); p.setAttribute('stroke-opacity', eop()); p.setAttribute('stroke-width', ew(e)); p.setAttribute('marker-end', 'url(#arr)'); });
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

  /* mind map: left-to-right tree. Each account sits under the account that sent it the most money
     one step closer to the victim; other payments are still drawn as extra lines. */
  layoutMind(nodes, edges, rootId) {
    if (!nodes.length) return; const byId = new Map(nodes.map(n => [n.id, n]));
    const out = new Map(), inc = new Map();
    edges.forEach(e => { if (e.from === e.to || !byId.has(e.from) || !byId.has(e.to)) return; (out.get(e.from) || out.set(e.from, []).get(e.from)).push(e); (inc.get(e.to) || inc.set(e.to, []).get(e.to)).push(e); });
    const roots = [], hop = new Map(), kids = new Map();
    if (nodes.some(n => n.layer)) {
      // money trail: strict rows – Victim, then Layer 1, Layer 2 … ; each account hangs under the account of the layer above that sent it the most
      nodes.forEach(n => hop.set(n.id, n.kind === 'victim' ? 0 : (n.layer || 0)));
      const vic = n => n.kind === 'victim' ? 0 : 1;
      for (const n of nodes) {
        let best = null; const h = hop.get(n.id);
        for (const e of inc.get(n.id) || []) { const hf = hop.get(e.from); if (hf < h && (!best || hf > hop.get(best.from) || (hf === hop.get(best.from) && e.amount > best.amount))) best = e; }
        if (best) (kids.get(best.from) || kids.set(best.from, []).get(best.from)).push(n.id); else roots.push(n.id);
      }
      roots.sort((a, b) => hop.get(a) - hop.get(b) || vic(byId.get(a)) - vic(byId.get(b)) || (byId.get(b).value || 0) - (byId.get(a).value || 0));
    } else {
      const bfs = start => { roots.push(start); hop.set(start, 0); const q = [start]; while (q.length) { const id = q.shift(); for (const e of out.get(id) || []) if (!hop.has(e.to)) { hop.set(e.to, hop.get(id) + 1); q.push(e.to); } } };
      if (byId.has(rootId)) bfs(rootId);
      nodes.forEach(n => { if (!inc.has(n.id) && !hop.has(n.id)) bfs(n.id); });
      nodes.forEach(n => { if (!hop.has(n.id)) bfs(n.id); });
      for (const n of nodes) { if (roots.includes(n.id)) continue; let best = null; for (const e of inc.get(n.id) || []) if (hop.get(e.from) === hop.get(n.id) - 1 && (!best || e.amount > best.amount)) best = e; if (best) (kids.get(best.from) || kids.set(best.from, []).get(best.from)).push(n.id); }
    }
    kids.forEach(l => l.sort((a, b) => (byId.get(b).value || 0) - (byId.get(a).value || 0)));
    let row = 0; const gap = 62, dx = 330;
    const place = id => { const n = byId.get(id); n.x = hop.get(id) * dx; const ks = kids.get(id) || []; if (!ks.length) { n.y = row++ * gap; return; } ks.forEach(place); n.y = (byId.get(ks[0]).y + byId.get(ks[ks.length - 1]).y) / 2; };
    roots.forEach(id => { place(id); row += .6; });
    const mid = (row - 1) * gap / 2; nodes.forEach(n => n.y -= mid);
  },

  /* graph view for a money trail: victim in the centre, each step out is one ring */
  layoutRadial(nodes, edges, rootId) {
    if (!nodes.length) return; const byId = new Map(nodes.map(n => [n.id, n]));
    const out = new Map(), inc = new Set(); edges.forEach(e => { if (e.from === e.to || !byId.has(e.from) || !byId.has(e.to)) return; (out.get(e.from) || out.set(e.from, []).get(e.from)).push(e); inc.add(e.to); });
    const kids = new Map(), depth = new Map(), roots = [];
    const bfs = start => { roots.push(start); depth.set(start, 0); const q = [start]; while (q.length) { const id = q.shift(); for (const e of (out.get(id) || []).slice().sort((a, b) => b.amount - a.amount)) if (!depth.has(e.to)) { depth.set(e.to, depth.get(id) + 1); (kids.get(id) || kids.set(id, []).get(id)).push(e.to); q.push(e.to); } } };
    if (byId.has(rootId)) bfs(rootId); nodes.forEach(n => { if (!inc.has(n.id) && !depth.has(n.id)) bfs(n.id); }); nodes.forEach(n => { if (!depth.has(n.id)) bfs(n.id); });
    const leaves = new Map(); const cnt = id => { if (leaves.has(id)) return leaves.get(id); const ks = kids.get(id) || []; const v = ks.length ? ks.reduce((a, c) => a + cnt(c), 0) : 1; leaves.set(id, v); return v; };
    const tot = roots.reduce((a, r) => a + cnt(r), 0), maxD = Math.max(1, ...depth.values());
    const R = Math.max(230, tot * 46 / (2 * Math.PI * maxD));
    const place = (id, a0, a1) => { const n = byId.get(id), d = depth.get(id), a = (a0 + a1) / 2; n.x = Math.cos(a) * d * R; n.y = Math.sin(a) * d * R; let s0 = a0; for (const c of kids.get(id) || []) { const sp = (a1 - a0) * cnt(c) / cnt(id); place(c, s0, s0 + sp); s0 += sp; } };
    if (roots.length === 1) place(roots[0], 0, Math.PI * 2);
    else { // several starting accounts: a small ring of them in the centre
      const hub = { x: 0, y: 0 }; let s0 = 0; roots.forEach(r => { const sp = Math.PI * 2 * cnt(r) / tot; place(r, s0, s0 + sp); s0 += sp; });
      roots.forEach((r, i) => { const n = byId.get(r), a = Math.PI * 2 * i / roots.length; n.x = hub.x + Math.cos(a) * R * .35; n.y = hub.y + Math.sin(a) * R * .35; });
    }
  },

  layoutForce(nodes, edges, rootId) {
    if (nodes.length > 500) return this.layoutRadial(nodes, edges, rootId); // too many for the spring layout: rings by step from the victim
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
