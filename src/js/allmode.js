/* allmode.js – top Case drop-down: "All Cases", "FIR Cases" and "NCRP (Without FIR)" show the combined data of
   those cases on every page (view only). A case is an FIR case once it has an FIR number; until then it is an
   NCRP case (Acknowledgement No. only). Pages that work on one case (Case File & Notices) ask you to pick the case. */
'use strict';
const AllMode = {
  SC: { __all: ['🗂', 'All Cases'], __fir: ['📁', 'FIR Cases'], __ncrp: ['🧾', 'NCRP (Without FIR)'] },
  on: () => isScope(S.caseId),
  cat: c => String((c && c.fir) || '').trim() ? 'fir' : 'ncrp',
  list(sc = S.caseId) { return sc === '__fir' ? S.cases.filter(c => this.cat(c) === 'fir') : sc === '__ncrp' ? S.cases.filter(c => this.cat(c) === 'ncrp') : S.cases.slice(); },
  label(sc) { const x = this.SC[sc] || this.SC.__all; return `${x[1]} (${this.list(sc).length})`; },
  pick() { const L = this.on() ? this.list() : S.cases, ok = id => id && L.some(c => c.id === id); return ok(S.prevCase) ? S.prevCase : ((L[0] || S.cases[0] || {}).id); },
  ackOf: c => String(c.ack || '').split(/[,;\s]+/).filter(Boolean),
  caseLabel(c) { const a = this.ackOf(c); return `${c.name || ''}${c.fir && !String(c.name).includes(c.fir) ? ' · ' + c.fir : ''}${!c.fir && a.length && !String(c.name).includes(a[0]) ? ' · Ack ' + a[0] + (a.length > 1 ? ' +' + (a.length - 1) : '') : ''}`; },
  options() {
    const F = S.cases.filter(c => this.cat(c) === 'fir'), N = S.cases.filter(c => this.cat(c) === 'ncrp'), o = (v, t) => `<option value="${v}" ${S.caseId === v ? 'selected' : ''}>${esc(t)}</option>`;
    let h = '';
    if (S.cases.length > 1) h += o('__all', `🗂 All Cases (${S.cases.length})`);
    if (S.cases.length > 1 && F.length) h += o('__fir', `📁 FIR Cases (${F.length})`);
    if (S.cases.length > 1 && N.length) h += o('__ncrp', `🧾 NCRP (Without FIR) (${N.length})`);
    const grp = (l, L) => L.length ? (h ? `<optgroup label="${esc(l)}">` : '') + L.map(c => o(c.id, this.caseLabel(c))).join('') + (h ? '</optgroup>' : '') : '';
    return h + grp(`📄 One Case – FIR (${F.length})`, F) + grp(`📄 One Case – NCRP Without FIR (${N.length})`, N);
  },
  /* All / FIR / NCRP open at once: the Dashboard works from saved summaries while the rows of every case
     are joined in the background; the joined data is kept until a case changes */
  async lazy(sc) {
    const key = sc + '|' + await Vault.verKey() + '|' + S.cases.map(c => c.id + ':' + c.name).join(',');
    clearTimeout(this._drop);
    if (this._mc && this._mc.key === key) return this._mc.data;
    const ph = Object.assign(emptyCase(), { _all: sc, _loading: true }), tok = this._tok = {};
    (async () => { await new Promise(r => setTimeout(r, 200)); while (typeof AllDash !== 'undefined' && AllDash.busy) { try { await AllDash.busy; } catch (e) { } } return this.merge(sc); })().then(d => { if (this._tok !== tok) return; this._mc = { key, data: d }; if (S.caseId !== sc || !S.data || !S.data._loading) return;
      S.data = d; Analysis.invalidate(); try { render(); } catch (e) { console.warn(e); } }).catch(e => console.warn('merge', e));
    return ph;
  },
  async merge(sc = '__all') {
    const out = emptyCase();
    for (const c of this.list(sc)) {
      const d = await DB.get('case:' + c.id) || {}; await new Promise(r => setTimeout(r, 0));
      for (const [k, v] of Object.entries(d)) {
        if (!Array.isArray(v) || !v.length) continue;
        const a = out[k] || (out[k] = []);
        for (const r of v) a.push(r && typeof r === 'object' && !Array.isArray(r) ? { ...r, _case: c.name || '', _caseId: c.id } : r);
      }
    }
    out._all = sc; return out;
  },
  _w: 0,
  wait(main) { const n = this.list(S.data._all).length; main.innerHTML = `<div class="card" style="padding:28px"><h3>⏳ Joining the data of ${n} case${n === 1 ? '' : 's'}…</h3><div class="sub">This page needs every row of every case. It opens by itself in a moment – the Dashboard is ready now.</div><div class="row" style="margin-top:12px"><button class="btn primary" id="amWaitD">📊 Open Dashboard</button></div></div>`; $('#amWaitD', main).onclick = () => go('dashboard'); },
  warn() { if (Date.now() - this._w < 20000) return; this._w = Date.now(); UI.toast('Combined view is for viewing only – choose one case in the Case box to add or change data', 5000); },
  one(main, what) {
    const L = this.list();
    main.innerHTML = `<div class="card am-pick"><h3>📁 Choose A Case</h3><div class="small muted" style="margin-bottom:12px">${esc(what)} works on one case. You are viewing <b>${esc(this.label(S.caseId))}</b> – pick the case to open:</div>
      <div class="am-list">${L.map(c => `<button class="am-c" data-am="${c.id}"><b>${esc(this.caseLabel(c))}</b><small>${esc([this.cat(c) === 'fir' ? 'FIR case' : 'NCRP – no FIR yet', c.ps, c.io && 'IO ' + c.io, c.final ? (c.final.type === 'PPI' ? 'CS-PPI' : c.final.type) : c.status].filter(Boolean).join(' · '))}</small></button>`).join('')}</div></div>`;
    $$('[data-am]', main).forEach(b => b.onclick = () => switchCase(b.dataset.am));
  },
  async refresh() { if (!this.on()) return; if (!this.list().length) return switchCase(S.cases[0].id); S.data = await this.lazy(S.caseId); Analysis.invalidate(); if (typeof AllDash !== 'undefined') AllDash.C.clear(); fillCaseSel(); render(); }
};
(() => {
  const ONE = { others: 'Case File & Notices (case details, notes, notice drafts, reports)' };
  for (const [p, what] of Object.entries(ONE)) { const og = Pages[p]; if (!og) continue; Pages[p] = function (main) { if (AllMode.on()) return AllMode.one(main, what); return og.apply(this, arguments); }; }
  // "common with your other cases" bar has no meaning when the cases are already combined
  if (typeof CaseCommon !== 'undefined' && CaseCommon.mount) { const m = CaseCommon.mount; CaseCommon.mount = function () { if (AllMode.on()) return; return m.apply(this, arguments); }; }
  // files imported while viewing a combined list → read the cases again
  if (typeof Hub !== 'undefined') { const hr = Hub.run; Hub.run = async function () { const r = await hr.apply(this, arguments); await AllMode.refresh(); return r; }; }
  const dc = window.deleteCase; if (typeof dc === 'function') deleteCase = async function () { const r = await dc.apply(this, arguments); await AllMode.refresh(); return r; };
  // case details saved (e.g. FIR No. added to an NCRP case) → drop-down groups update
  const sm = saveMeta; saveMeta = async function () { const r = await sm.apply(this, arguments); try { fillCaseSel(); } catch (e) { } return r; };
})();

/* while the rows are being joined, pages that need them show a short wait note */
(() => {
  const r0 = render;
  render = function () {
    if (S.data && S.data._loading && /^(financial|social|ncrp|analytics|trail|caf|tele|others|search)$/.test(S.page)) {
      $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === S.page)); AllMode.wait($('#main')); return;
    }
    return r0.apply(this, arguments);
  };
})();
