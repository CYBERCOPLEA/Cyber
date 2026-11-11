/* casex.js – "Case Number" column for common-item tables: the case (FIR · police station) the item belongs to, and any of
   your other cases where the same number / IMEI / IMSI / IP / cell also appears. Other cases are read once from this
   computer and remembered. */
'use strict';
const CX = {
  M: new Map(), busy: null, ready: false,
  lbl(c) { const f = String(c.fir || '').replace(/^\s*FIR\s*(No\.?)?\s*/i, ''); return f ? 'FIR ' + f : (c.name || 'Case'); },
  full(c) { return [c.name, c.fir && 'FIR ' + c.fir, c.ps && 'PS ' + c.ps, c.district, c.io && 'IO ' + c.io].filter(Boolean).join(' · '); },
  build() {
    if (this.busy || this.ready) return this.busy;
    this.M.delete(S.caseId);
    const todo = S.cases.filter(c => c.id !== S.caseId && !this.M.has(c.id));
    if (!todo.length) { this.ready = true; return null; }
    this.busy = (async () => {
      try { if (typeof Dash2 !== 'undefined' && Dash2.others) await Dash2.others(); } catch (e) { }
      for (const c of todo) {
        const s = new Set(await Vault.sum(c.id, 'cxt', 'v1', async () => { const s = new Set();
        let raw = null; try { raw = await DB.get('case:' + c.id); } catch (e) { }
        if (raw) for (const r of raw.tel || []) for (const v of [r.target, r.other, r.imei, r.imsi, r.mac, r.xip, r.cell]) if (v) s.add(String(v));
        return s; }));
        try { const X = Dash2.X.get(c.id); if (X) for (const k of X.keys()) s.add(k.slice(k.indexOf('|') + 1)); } catch (e) { }
        this.M.set(c.id, s); await new Promise(r => setTimeout(r, 0));
      }
      this.busy = null; this.ready = true; this.fill();
    })();
    return this.busy;
  },
  other(vals) { const out = []; for (const c of S.cases) { if (c.id === S.caseId) continue; const s = this.M.get(c.id); if (s && vals.some(v => s.has(v))) out.push(c); } return out; },
  inner(vals) {
    const c = activeCase(), O = this.other(vals), more = S.cases.length > 1;
    return `<span class="cx-cn cur" title="${esc(this.full(c))}">📁 ${esc(this.lbl(c))}</span>${O.map(o => `<span class="cx-cn oth" title="Also in: ${esc(this.full(o))}">⚑ ${esc(this.lbl(o))}</span>`).join('')}${more && !this.ready ? '<span class="cx-cn wait">checking other cases…</span>' : ''}`;
  },
  vals: v => (Array.isArray(v) ? v : [v]).map(x => String(x || '').trim()).filter(Boolean),
  cell(v) { const V = this.vals(v); this.build(); return `<span class="cx-cs" data-cxv="${esc(V.join('|'))}">${this.inner(V)}</span>`; },
  fill() { $$('[data-cxv]').forEach(e => e.innerHTML = this.inner(e.dataset.cxv.split('|'))); },
  col(get) { return { key: 'casen', label: 'Case Number', sortVal: x => this.other(this.vals(get(x))).length, csv: x => [this.lbl(activeCase()), ...this.other(this.vals(get(x))).map(c => this.lbl(c))].join('; '), render: x => this.cell(get(x)) }; }
};
/* "Found in" chips with counts, the same look everywhere */
CX.SC = { Financial: '#10b981', NCRP: '#f97316', 'Social Media': '#ec4899', Telecom: '#06b6d4', CAF: '#84cc16', Others: '#94a3b8' };
CX.chips = function (L) { return `<span class="d2-srcs">${L.map(([nm, n, c, ico, tip]) => `<span class="d2-sec" style="--sc:${c || '#94a3b8'}"${tip ? ` title="${esc(tip)}"` : ''}>${ico ? ico + ' ' : ''}${esc(nm)}${n > 0 ? ` <b>×${n}</b>` : ''}</span>`).join('')}</span>`; };
/* records of one value grouped by a label (kind, file …) */
CX.kchips = function (recs, kf, c) { return this.chips([...groupBy(recs || [], kf)].filter(([k]) => k).sort((a, b) => b[1].length - a[1].length).map(([k, v]) => [k, v.length, c])); };
CX.ktext = function (recs, kf) { return [...groupBy(recs || [], kf)].filter(([k]) => k).map(([k, v]) => k + ' ×' + v.length).join(', '); };
/* identifier-index items → exact sources (Money Trail, Google (Gmail), CDR, CAF …) */
CX.isrc = function (items) { const M = new Map(); for (const i of items || []) { const [sec, ico, nm] = Dash2.src(i); let e = M.get(nm); if (!e) M.set(nm, e = { sec, ico, nm, refs: new Set() }); e.refs.add(i.ref || i.section); } return [...M.values()].sort((a, b) => b.refs.size - a.refs.size); };
CX.ichips = function (items) { return this.chips(this.isrc(items).map(e => [e.nm, e.refs.size, this.SC[e.sec], e.ico, [...e.refs].slice(0, 8).join('\n')])); };
CX.itext = function (items) { return this.isrc(items).map(e => e.nm + ' ×' + e.refs.size).join(', '); };
/* "Also in case" text list → chips */
CX.also = function (s) { return s ? this.chips(String(s).split(/,\s*/).filter(Boolean).map(x => ['⚑ ' + x, 0, '#eab308'])) : ''; };
/* when the case changes, the index of "other cases" is refreshed */
{ const _sw = switchCase; switchCase = async function (id) { const prev = S.caseId; const r = await _sw.apply(this, arguments); CX.M.delete(prev); CX.M.delete(S.caseId); CX.ready = false; return r; }; }
