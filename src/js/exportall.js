/* exportall.js – every export / report in the tool can be seen in Preview and saved as HTML, Word, PDF, Excel, Image, or printed.
   Everything is made in this browser – nothing is sent online. */
'use strict';
const ExportAll = {
  fname(t, ext) { return (String(t || 'report').replace(/[^\wऀ-ॿ\- ]+/g, ' ').trim().replace(/\s+/g, '_').slice(0, 80) || 'report') + '_' + new Date().toISOString().slice(0, 10) + '.' + ext; },
  esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
  CSS: `@page{size:A4;margin:1.4cm}body{font-family:${"'Arial Narrow', Arial, 'Nirmala UI', Mangal, sans-serif"};font-size:11pt;color:#000;background:#fff;margin:8px}h2{font-size:15pt;margin:4px 0 8px;text-align:center}.xm{font-size:9pt;color:#555;text-align:center;margin-bottom:10px}table{border-collapse:collapse;width:100%;margin:6px 0 12px}th,td{border:1px solid #000;padding:3px 6px;text-align:left;vertical-align:top;font-size:10pt}th{background:#e5e7eb}`,
  // a preview window: the shared bar (Edit, Print, PDF, Word, HTML, Excel, Image) is added to it
  open(title, body, o = {}) {
    const w = window.open('', '_blank'); if (!w) { UI.toast('Allow pop-ups for this page to see the preview'); return null; }
    const font = typeof DocFont !== 'undefined' ? DocFont.css() : 'Arial';
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${this.esc(title)}</title><style>${this.CSS}body{font-family:${font}}${o.css || ''}</style></head><body>${o.bare ? '' : `<h2>${this.esc(title)}</h2><div class="xm">SudarshanAshtra · ${this.esc(new Date().toLocaleString('en-IN'))} · for official police use only</div>`}${body}</body></html>`);
    this.last = w; w.document.close(); if (o.print) setTimeout(() => { try { w.focus(); w.print(); } catch (e) { } }, 700);
    return w;
  },
  tableHtml(cols, rows) {
    const v = (c, r) => c.csv ? c.csv(r) : c.fmt ? c.fmt(r[c.key], r) : r[c.key];
    return `<table><thead><tr>${cols.map(c => `<th>${this.esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${this.esc(v(c, r))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  },
  table(title, cols, rows) { cols = cols.filter(c => !c.noexport); return this.open(title, `<div class="xm">${rows.length} rows</div>` + this.tableHtml(cols, rows)); },
  // tables inside any element (live page or preview window) as one Excel book
  excel(root, title) {
    if (typeof XLSX === 'undefined') return UI.toast('Excel library not loaded');
    const T = [...root.querySelectorAll('table')], wb = XLSX.utils.book_new();
    if (T.length) T.forEach((t, i) => { const c = t.cloneNode(true); c.querySelectorAll('.np,button,input,select').forEach(x => x.remove()); XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(c, { raw: true }), ('Table ' + (i + 1)).slice(0, 31)); });
    else XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(String(root.innerText || root.textContent || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => [x])), 'Report');
    UI.download(this.fname(title, 'xlsx'), new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  },
  word(html, title) { UI.download(this.fname(title, 'doc'), html.replace('<html', '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"'), 'application/msword'); },
  // the document drawn as a picture (white page)
  canvas(d, root, maxH = 30000) {
    return new Promise((res, rej) => {
      const W = Math.max(root.scrollWidth, 600), H = Math.max(root.scrollHeight, 100), cs = d.defaultView.getComputedStyle(d.body);
      const c = root.cloneNode(true); c.querySelectorAll('#deBar,.np,script,#deCss').forEach(x => x.remove()); c.removeAttribute('contenteditable');
      const wrap = d.createElement('div'); wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      wrap.setAttribute('style', `width:${W}px;background:#fff;color:#000;font-family:${cs.fontFamily};font-size:${cs.fontSize};line-height:${cs.lineHeight};padding:0;margin:0`);
      const st = d.createElement('style'); st.textContent = [...d.querySelectorAll('style')].filter(s => s.id !== 'deCss').map(s => s.textContent).join('\n').replace(/@media print[^{]*\{([^{}]*\{[^}]*\})*[^}]*\}/g, ''); wrap.appendChild(st); wrap.appendChild(c);
      const str = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${new XMLSerializer().serializeToString(wrap)}</foreignObject></svg>`;
      const img = new Image(), sc = Math.max(.3, Math.min(2, maxH / H));
      img.onload = () => { const cv = document.createElement('canvas'); cv.width = Math.round(W * sc); cv.height = Math.round(H * sc); const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.scale(sc, sc); x.drawImage(img, 0, 0); res(cv); };
      img.onerror = () => rej(new Error('Could not draw the picture'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
    });
  },
  // A4 PDF: the picture cut into pages – no library needed
  async pdf(cv) {
    const PW = 595.28, PH = 841.89, M = 28, cw = PW - 2 * M, ch = PH - 2 * M, k = cw / cv.width, sliceH = Math.floor(ch / k), pages = [];
    for (let y = 0; y < cv.height; y += sliceH) { const h = Math.min(sliceH, cv.height - y), s = document.createElement('canvas'); s.width = cv.width; s.height = h; const x = s.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, s.width, h); x.drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h);
      pages.push({ w: s.width, h, jpg: new Uint8Array(await (await new Promise(r => s.toBlob(r, 'image/jpeg', .9))).arrayBuffer()) }); }
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, f) => { offs[n] = len; put(`${n} 0 obj\n`); f(); put('\nendobj\n'); };
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'); const N = pages.length, kids = pages.map((p, i) => `${3 + i * 3} 0 R`).join(' ');
    obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>')); obj(2, () => put(`<< /Type /Pages /Kids [${kids}] /Count ${N} >>`));
    pages.forEach((p, i) => { const n = 3 + i * 3, ph = +(p.h * k).toFixed(2), cs = `q ${cw.toFixed(2)} 0 0 ${ph} ${M} ${(PH - M - ph).toFixed(2)} cm /Im${i} Do Q`;
      obj(n, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im${i} ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`));
      obj(n + 1, () => put(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
      obj(n + 2, () => { put(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`); put(p.jpg); put('\nendstream'); }); });
    const T = 3 + N * 3, x = len; put(`xref\n0 ${T}\n0000000000 65535 f \n` + Array.from({ length: T - 1 }, (_, i) => String(offs[i + 1]).padStart(10, '0') + ' 00000 n \n').join(''));
    put(`trailer\n<< /Size ${T} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  },
  async image(d, root, title) { try { const cv = await this.canvas(d, root); cv.toBlob(b => UI.download(this.fname(title, 'png'), b)); } catch (e) { UI.toast('Image failed: ' + e.message); } },
  async pdfOf(d, root, title) { try { UI.toast('Making PDF…'); UI.download(this.fname(title, 'pdf'), await this.pdf(await this.canvas(d, root, 60000))); } catch (e) { UI.toast('PDF failed: ' + e.message + ' – use Print › Save as PDF'); } },

  /* every CSV / Excel button that sits with a table gets a 👁 Preview next to it */
  scan() {
    $$('button').forEach(b => {
      if (b.dataset.xpv || b.dataset.r === 'csv' || b.closest('#deBar,.hx-menu,.xp-pv')) return; const t = b.textContent;
      if (!/\b(CSV|Excel|XLSX)\b/i.test(t) || /import|choose|upload|📥/i.test(t)) return;
      const box = b.closest('.card, .modal, .el-box, #tabBody') || b.parentNode; if (!box || !box.querySelector('table')) return;
      b.dataset.xpv = '1'; if (b.previousElementSibling && b.previousElementSibling.classList.contains('xp-pv')) return;
      const p = document.createElement('button'); p.type = 'button'; p.className = (b.className || 'btn') + ' xp-pv'; p.textContent = '👁 Preview'; p.title = 'See it first – then save as HTML, Word, PDF, Excel, Image or print';
      p.onclick = () => this.box(box); b.parentNode.insertBefore(p, b);
    });
  },
  title() { const h = $('#main .page-head h2'), t = $('#main .tabs .tab.active'); return [h && h.textContent.trim(), t && t.childNodes[0] && t.childNodes[0].textContent.trim()].filter(Boolean).join(' – ') || 'Report'; },
  box(box) {
    const hd = box.querySelector('h3, h4, .card-title, b'), T = [...box.querySelectorAll('table')];
    const html = T.map(t => { const c = t.cloneNode(true); c.removeAttribute('class'); c.querySelectorAll('button,input,select,.np').forEach(x => x.remove()); c.querySelectorAll('[class],[style]').forEach(x => { x.removeAttribute('class'); x.removeAttribute('style'); }); return c.outerHTML; }).join('');
    this.open(this.title() + (hd && hd.textContent.trim().length < 80 ? ' – ' + hd.textContent.trim() : ''), html);
  }
};
(() => { let q = 0; const run = () => { q = 0; try { ExportAll.scan(); } catch (e) { } };
  const mo = new MutationObserver(() => { if (!q) q = requestAnimationFrame(run); });
  const st = () => mo.observe(document.body, { childList: true, subtree: true }); if (document.body) st(); else document.addEventListener('DOMContentLoaded', st); })();
