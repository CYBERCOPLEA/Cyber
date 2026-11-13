/* ocr.js – read scanned PDFs and photos (English + Hindi) on this computer. No internet is used:
   the OCR engine and the language files are built into this tool. */
'use strict';
const OCR = {
  langs: ['eng', 'hin'], scale: 3, url: null, pool: [], making: 0, wait: [], prog: null,
  size() { const hc = navigator.hardwareConcurrency || 2, mem = navigator.deviceMemory || 8; return Math.max(1, Math.min(mem >= 8 ? 4 : mem >= 4 ? 3 : 2, hc - 1)); },
  blob() {
    if (this.url) return this.url;
    const pk = JSON.stringify({ wasm: OCR_PACK.wasm, hin: OCR_PACK.hin, eng: OCR_PACK.eng });
    const pre = `self.__pk=${pk};
const __u=s=>{const a=atob(s),u=new Uint8Array(a.length);for(let i=0;i<a.length;i++)u[i]=a.charCodeAt(i);return u};
self.__wasmP=new Response(new Blob([__u(self.__pk.wasm)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
const __f=self.fetch;self.fetch=(u,o)=>{const m=/\\/(hin|eng)\\.traineddata/.exec(String(u));return m?Promise.resolve(new Response(__u(self.__pk[m[1]]))):__f(u,o)};
`;
    const fix = `\n;(()=>{const _TC=TesseractCore;self.TesseractCore=m=>self.__wasmP.then(w=>_TC(Object.assign(m||{},{wasmBinary:new Uint8Array(w)})));})();\n`;
    return this.url = URL.createObjectURL(new Blob([pre, OCR_PACK.core, fix, OCR_PACK.worker], { type: 'text/javascript' }));
  },
  async make() {
    const w = await Tesseract.createWorker(this.langs, 1, { workerPath: this.blob(), workerBlobURL: false, corePath: 'https://local.invalid/core.js', langPath: 'https://local.invalid', cacheMethod: 'none', gzip: true });
    try { await w.setParameters({ preserve_interword_spaces: '1' }); } catch (e) { }
    return w;
  },
  /* borrow a free worker (creates up to size()) */
  async get() {
    const free = this.pool.find(x => !x.busy); if (free) { free.busy = true; return free; }
    if (this.pool.length + this.making < this.size()) { this.making++; try { const x = { w: await this.make(), busy: true }; this.pool.push(x); return x; } finally { this.making--; } }
    return new Promise(r => this.wait.push(r));
  },
  put(x) { const n = this.wait.shift(); if (n) n(x); else x.busy = false; },
  async img(src) { const x = await this.get(); try { const r = await x.w.recognize(src); return (r.data && r.data.text) || ''; } finally { this.put(x); } },
  async page(doc, i) {
    const pg = await doc.getPage(i), vp = pg.getViewport({ scale: this.scale }), cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    try { return await this.img(cv); } finally { try { pg.cleanup(); } catch (e) { } cv.width = cv.height = 0; }
  },
  /* scanned PDF → text; pages are read in parallel; onPage(done, total) for progress */
  async pdf(file, onPage) {
    if (!window.pdfjsLib) throw new Error('PDF reader not available');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, isOffscreenCanvasSupported: false }).promise;
    const n = doc.numPages, out = new Array(n); let next = 1, done = 0;
    const run = async () => { while (next <= n) { const i = next++; out[i - 1] = await this.page(doc, i); done++; onPage && onPage(done, n); } };
    await Promise.all(Array.from({ length: Math.min(this.size(), n) }, run));
    try { doc.destroy(); } catch (e) { }
    return out.join('\n\f\n');
  },
  /* only the given page numbers of an already open PDF (pages that have no text layer) */
  async pages(doc, list, onPage) {
    const out = {}; let k = 0, done = 0;
    const run = async () => { while (k < list.length) { const i = list[k++]; out[i] = await this.page(doc, i); done++; onPage && onPage(done, list.length); } };
    await Promise.all(Array.from({ length: Math.min(this.size(), list.length) }, run));
    return out;
  },
  async read(file, onPage) {
    const n = (file.name || '').toLowerCase();
    if (/\.(png|jpe?g|webp|bmp|gif)$/.test(n)) { const u = URL.createObjectURL(file); try { return await this.img(u); } finally { URL.revokeObjectURL(u); } }
    if (/\.pdf$/.test(n)) return this.pdf(file, onPage);
    return '';
  },
  async stop() { const P = this.pool; this.pool = []; for (const x of P) try { await x.w.terminate(); } catch (e) { } }
};
