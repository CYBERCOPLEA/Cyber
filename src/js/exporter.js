/* exporter.js – an "Export" button on the mind map, network graph, flow chart and Money Trail.
   Saves the view as HTML, PNG, SVG or PDF. Everything is made in this browser – nothing is sent online. */
'use strict';
const Exporter = {
  // computed styles copied onto the copy, so the file looks like the screen without the app's CSS
  SVGP: ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'paint-order', 'display', 'visibility', 'text-anchor', 'dominant-baseline'],
  HTMLP: ['display', 'position', 'left', 'top', 'right', 'bottom', 'width', 'height', 'min-width', 'box-sizing', 'flex-direction', 'flex-wrap', 'flex', 'align-items', 'justify-content', 'gap', 'margin', 'padding', 'border', 'border-left', 'border-radius', 'background-color', 'background-image', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'white-space', 'overflow', 'text-overflow', 'opacity', 'box-shadow', 'z-index', 'vertical-align', 'word-break'],
  inline(src, dst) {
    const a = [src, ...src.querySelectorAll('*')], b = [dst, ...dst.querySelectorAll('*')];
    a.forEach((el, i) => {
      const d = b[i]; if (!d || d.nodeType !== 1) return;
      const cs = getComputedStyle(el), isSvg = el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg';
      const props = isSvg ? this.SVGP : this.HTMLP;
      let st = props.map(p => { const v = cs.getPropertyValue(p); return v ? `${p}:${v}` : ''; }).filter(Boolean).join(';');
      if (!isSvg && el.tagName.toLowerCase() === 'svg') st += ';overflow:visible';
      d.setAttribute('style', st + ';animation:none;transition:none');
      d.removeAttribute('class');
    });
    return dst;
  },
  // which view is on screen, for the title and the file name
  title(el) {
    const h = $('#main .page-title h2') || $('#main .page-head h2'), t = $('#main .tabs .tab.active');
    const m = $('#main .pill-group [data-m].active');
    const parts = [h && h.textContent.trim(), m ? m.textContent.replace(/\s*\(.*\)/, '').trim() : t && t.childNodes[0] && t.childNodes[0].textContent.trim()].filter(Boolean);
    if (el.classList.contains('trail-main')) return parts[0] || 'Money Trail';
    return parts.join(' – ') || 'Graph';
  },
  bg() { return getComputedStyle(document.documentElement).getPropertyValue('--surface-2').trim() || '#0f172a'; },
  ink() { return getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e5e7eb'; },
  // the view as one SVG: a title band on top, then the drawing
  build(el) {
    let inner, w, h;
    if (el.classList.contains('trail-main') || el.dataset.exPage) {
      const cv = el.dataset.exPage ? el : el.querySelector('#trCanvas'); if (!cv) return null;
      w = cv.scrollWidth; h = cv.scrollHeight;
      const c = this.inline(cv, cv.cloneNode(true));
      c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.background = this.bg();
      c.querySelectorAll('*').forEach(x => { if (x.style.position === 'sticky') x.style.position = 'relative'; });
      if (el.dataset.exPage) { c.removeAttribute('data-ex-page'); c.querySelectorAll('input[type=file]').forEach(x => x.remove()); }
      c.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      inner = `<foreignObject x="0" y="0" width="${w}" height="${h}">${new XMLSerializer().serializeToString(c)}</foreignObject>`;
    } else {
      const vp = el.querySelector('svg .vp'), svg = vp && vp.ownerSVGElement; if (!svg) return null;
      const bb = vp.getBBox(), pad = 40, x0 = bb.x - pad, y0 = bb.y - pad; w = Math.ceil(bb.width + pad * 2); h = Math.ceil(bb.height + pad * 2);
      const c = this.inline(svg, svg.cloneNode(true));
      const kids = [...svg.children], cc = [...c.children], iv = kids.indexOf(vp), ib = kids.findIndex(n => n.classList.contains('bg'));
      if (cc[iv]) cc[iv].removeAttribute('transform');
      const r = cc[ib]; if (r) { r.setAttribute('x', x0); r.setAttribute('y', y0); r.setAttribute('width', w); r.setAttribute('height', h); }
      c.setAttribute('viewBox', `${x0} ${y0} ${w} ${h}`); c.setAttribute('width', w); c.setAttribute('height', h); c.removeAttribute('style');
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      inner = new XMLSerializer().serializeToString(c);
    }
    const name = this.title(el), when = new Date().toLocaleString('en-IN'), TH = 56, W = Math.max(w, 480), H = h + TH;
    const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const str = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
      + `<rect width="${W}" height="${H}" fill="${this.bg()}"/>`
      + `<text x="20" y="25" font-family="Segoe UI,Arial,sans-serif" font-size="17" font-weight="700" fill="${this.ink()}">${e(name)}</text>`
      + `<text x="20" y="45" font-family="Segoe UI,Arial,sans-serif" font-size="12" fill="#94a3b8">SudarshanAshtra · exported ${e(when)} · for official police use only</text>`
      + `<g transform="translate(0,${TH})">${inner}</g></svg>`;
    return { str, w: W, h: H, name };
  },
  file(name, ext) { return 'SudarshanAshtra_' + name.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') + '_' + new Date().toISOString().slice(0, 10) + '.' + ext; },
  canvas(o, maxSide) {
    return new Promise((res, rej) => {
      const img = new Image(), sc = Math.max(.2, Math.min(2, maxSide / Math.max(o.w, o.h)));
      img.onload = () => { const c = document.createElement('canvas'); c.width = Math.round(o.w * sc); c.height = Math.round(o.h * sc); const x = c.getContext('2d'); x.fillStyle = this.bg(); x.fillRect(0, 0, c.width, c.height); x.scale(sc, sc); x.drawImage(img, 0, 0); res(c); };
      img.onerror = () => rej(new Error('Could not draw the picture'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(o.str);
    });
  },
  // a one-page PDF holding the picture as JPEG – no library needed
  async pdf(c) {
    const jpg = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', .92))).arrayBuffer());
    let pw = c.width * .75, ph = c.height * .75; const k = Math.min(1, 14000 / Math.max(pw, ph)); pw = +(pw * k).toFixed(2); ph = +(ph * k).toFixed(2);
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const cs = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => put('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    obj(3, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`));
    obj(4, () => put(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(5, () => { put(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); put(jpg); put('\nendstream'); });
    const x = len; put('xref\n0 6\n0000000000 65535 f \n' + [1, 2, 3, 4, 5].map(n => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join(''));
    put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  },
  html(o) {
    const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${e(o.name)} – SudarshanAshtra</title><style>
body{margin:0;background:${this.bg()};font-family:Segoe UI,Arial,sans-serif;color:${this.ink()}}
.bar{position:sticky;top:0;display:flex;gap:10px;align-items:center;padding:8px 14px;background:rgba(15,23,42,.92);border-bottom:1px solid #334155;z-index:2;font-size:13px}
.bar button{background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer}
.wrap{overflow:auto}.wrap svg{display:block}.fit .wrap svg{width:100%;height:auto}</style></head>
<body class="fit"><div class="bar"><b>${e(o.name)}</b><span style="flex:1"></span><span>Point at a line or account for details</span><button onclick="document.body.classList.toggle('fit')">Fit / actual size</button><button onclick="print()">Print</button></div>
<div class="wrap">${o.str}</div></body></html>`;
  },
  async run(el, kind) {
    const o = this.build(el); if (!o) return UI.toast ? UI.toast('Nothing to export yet') : null;
    try {
      if (kind === 'svg') return UI.download(this.file(o.name, 'svg'), o.str, 'image/svg+xml');
      if (kind === 'html') return UI.download(this.file(o.name, 'html'), this.html(o), 'text/html');
      if (kind === 'xls') { const live = el.querySelector('table') ? el : null; return live ? ExportAll.excel(live, o.name) : UI.toast('No table on this tab – use Image, PDF or Word'); }
      if (kind === 'pv' || kind === 'print' || kind === 'doc') { const c = await this.canvas(o, 8000), body = `<img src="${c.toDataURL('image/png')}" style="max-width:100%">`;
        if (kind === 'doc') return ExportAll.word(`<html><head><meta charset="utf-8"><title>${o.name}</title></head><body><h2>${ExportAll.esc(o.name)}</h2>${body}</body></html>`, o.name);
        return ExportAll.open(o.name, body, { print: kind === 'print' }); }
      const c = await this.canvas(o, kind === 'pdf' ? 5000 : 8000);
      if (kind === 'png') return c.toBlob(b => UI.download(this.file(o.name, 'png'), b));
      UI.download(this.file(o.name, 'pdf'), await this.pdf(c));
    } catch (err) { if (UI.toast) UI.toast('Export failed: ' + err.message); }
  },
  targets() {
    const main = $('#main'); if (!main) return [];
    return [...$$('.graph-box', main).filter(g => g.querySelector('svg .nodes')), ...$$('.trail-main', main)];
  },
  // header button: the chart on this tab if there is one, otherwise the whole tab
  page() { const g = this.targets().find(t => t.offsetParent); if (g) return g; const b = $('#tabBody') || $('#main'); b.dataset.exPage = '1'; return b; },
  head() {
    const host = $('#main .ph-actions') || $('#main .page-title'); if (!host || host.querySelector('.hx-wrap')) return;
    const w = document.createElement('div'); w.className = 'hx-wrap';
    w.innerHTML = `<button type="button" class="hx-btn" title="Save this page or chart as a file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg><span>Export</span><i>▾</i></button>
      <div class="hx-menu hidden"><div class="hx-h">Save as</div>${[['pv', '👁', 'Preview', 'see it, edit, then save', '#8b5cf6'], ['html', '🌐', '.html', 'opens in any browser', '#3b82f6'], ['doc', '📘', 'Word', 'edit in MS Word', '#2563eb'], ['pdf', '📄', '.pdf', 'for print / case file', '#ef4444'], ['xls', '📗', 'Excel', 'tables on this tab', '#16a34a'], ['png', '🖼', 'Image', 'picture (.png)', '#f97316'], ['svg', '✏️', '.svg', 'sharp at any zoom', '#10b981'], ['print', '🖨', 'Print', 'straight to printer', '#64748b']].map(([k, ic, a, b, c]) => `<button type="button" data-hx="${k}" style="--xc:${c}"><span class="hx-ic">${ic}</span><span><b>${a}</b><small>${b}</small></span></button>`).join('')}
      <div class="hx-f">Chart on this tab, or the whole tab · made on this computer</div></div>`;
    const m = w.querySelector('.hx-menu');
    w.querySelector('.hx-btn').onclick = ev => { ev.stopPropagation(); m.classList.toggle('hidden'); };
    m.querySelectorAll('[data-hx]').forEach(b => b.onclick = async ev => { ev.stopPropagation(); m.classList.add('hidden'); const el = this.page(); UI.toast('Preparing ' + b.dataset.hx.toUpperCase() + '…'); await this.run(el, b.dataset.hx); delete el.dataset.exPage; });
    host.appendChild(w);
  },
  scan() {
    try { this.head(); } catch (e) { }
    for (const el of this.targets()) {
      if (el.querySelector(':scope > .ex-wrap')) continue;
      const w = document.createElement('div'); w.className = 'ex-wrap';
      w.innerHTML = `<button type="button" class="btn sm ex-btn" title="Save this view as a file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg><span>Export</span></button>
        <div class="ex-menu hidden">${[['html', 'HTML', 'opens in any browser'], ['png', 'PNG', 'picture'], ['svg', 'SVG', 'sharp at any zoom'], ['pdf', 'PDF', 'for print / case file']].map(([k, a, b]) => `<button type="button" data-ex="${k}"><b>${a}</b><small>${b}</small></button>`).join('')}</div>`;
      const m = w.querySelector('.ex-menu');
      w.querySelector('.ex-btn').onclick = ev => { ev.stopPropagation(); $$('.ex-menu').forEach(x => x !== m && x.classList.add('hidden')); m.classList.toggle('hidden'); };
      m.querySelectorAll('[data-ex]').forEach(b => b.onclick = ev => { ev.stopPropagation(); m.classList.add('hidden'); this.run(el, b.dataset.ex); });
      el.classList.add('ex-host'); el.prepend(w);
    }
  }
};
(() => {
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(() => { try { Exporter.scan(); } catch (e) { } }, 150); };
  new MutationObserver(later).observe($('#main'), { childList: true, subtree: true });
  document.addEventListener('click', () => $$('.ex-menu, .hx-menu').forEach(m => m.classList.add('hidden')));
})();
