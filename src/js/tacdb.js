/* tacdb.js – Brand & Model of a handset from its IMEI (TAC = first 8 digits). Works offline. */
'use strict';
const TACDB = {
  map: null, models: null, busy: null,
  load() {
    if (this.map) return null; if (this.busy) return this.busy;
    this.busy = (async () => {
      try {
        const s = atob(TACDB_B64), bin = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
        const txt = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
        const M = [], T = new Map(); let i = 0;
        for (const ln of txt.split('\n')) { const k = ln.indexOf('\t'); M.push(ln.slice(0, k)); let p = 0; const r = ln.slice(k + 1); if (r) for (const d of r.split(' ')) { p += parseInt(d, 36); T.set(p, i); } i++; }
        this.models = M; this.map = T;
      } catch (e) { this.models = []; this.map = new Map(); }
      this.busy = null; this.fill();
    })();
    return this.busy;
  },
  /* null = still loading, '' = not in list */
  name(imei) { const d = String(imei || '').replace(/\D/g, ''); if (d.length < 8) return ''; if (!this.map) { this.load(); return null; } const i = this.map.get(+d.slice(0, 8)); return i == null ? '' : this.models[i]; },
  text(imei) { return this.name(imei) || 'Unknown model'; },
  inner(imei) { const n = this.name(imei); return n === null ? '<span class="muted">finding model…</span>' : n ? '📱 ' + esc(n) : '<span class="muted">Unknown model</span>'; },
  html(imei) { return `<span class="tacm no-tc" data-tac="${esc(String(imei))}">${this.inner(imei)}</span>`; },
  fill() { $$('[data-tac]').forEach(e => e.innerHTML = this.inner(e.dataset.tac)); }
};
window.addEventListener('load', () => setTimeout(() => TACDB.load(), 2500));
