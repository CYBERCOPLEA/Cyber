/* teleimp.js – "Import Files & Folder" on CDR / IPDR / TDR / SMS: first choose New case (fill FIR, police station, district,
   IO name / mobile / posting) or an Existing case (its details shown and editable), then pick files or a folder –
   the data is added to that case. */
'use strict';
const TelImp = {
  KN: { cdr: 'CDR', ipdr: 'IPDR', tdr: 'TDR (tower dump)', sms: 'SMS' },
  open(sel) {
    const k = TK[S.telKind] ? S.telKind : 'cdr', K = this.KN[k], col = TK[k][1];
    sel = sel || this._sel || S.caseId; if (sel !== 'new' && !S.cases.some(c => c.id === sel)) sel = S.caseId; this._sel = sel;
    const isNew = sel === 'new', c = isNew ? { year: String(new Date().getFullYear()), ps: activeCase().ps || '', district: activeCase().district || '', state: activeCase().state || 'UP – Uttar Pradesh', io: activeCase().io || '', io_mobile: activeCase().io_mobile || '', io_posting: activeCase().io_posting || '' } : S.cases.find(x => x.id === sel) || {};
    const here = !isNew && sel === S.caseId ? ['cdr', 'ipdr', 'tdr', 'sms'].map(x => [x.toUpperCase(), Tel.of(x).length, uniq(Tel.of(x).map(r => r._src)).length]) : null;
    const F = CaseBox.F.filter(f => ['ctype', 'fir', 'year', 'ps', 'district', 'state', 'io', 'io_mobile', 'io_posting', 'section'].includes(f[0]));
    const m = UI.modal(`📂 Import ${K} files / folder`, `<div class="ti" style="--tk:${col}">
      <div class="ti-step"><b>1</b> Which case are these files for?</div>
      <div class="ti-seg"><button data-ti="new" class="${isNew ? 'on' : ''}">➕ New case<small>Fill FIR, police station, IO details</small></button><button data-ti="old" class="${isNew ? '' : 'on'}">📁 Existing case<small>Add the files to a case already made</small></button></div>
      ${isNew ? '' : `<label class="ti-sel">Choose case<select id="tiCase">${S.cases.map(x => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${esc(x.name)}${x.fir ? ' · ' + esc(x.fir) : ''}</option>`).join('')}</select></label>`}
      ${here ? `<div class="ti-have">Already in this case: ${here.map(([n, r, f]) => `<span class="tf-chip${r ? ' warn' : ''}">${n} <b>${fmtNum(r)}</b> records · ${f} files</span>`).join(' ')}<div class="small muted">New files are added to these; the same file imported again is not counted twice.</div></div>` : ''}
      <div class="ti-step"><b>2</b> Case details ${isNew ? '' : '<span class="small muted">(check / complete – saved with the case)</span>'}</div>
      <div class="map-grid cb-grid">${F.map(([f, l, t]) => CaseBox.field(f, l, t, f === 'year' ? CaseBox.yearOf(c) : c[f])).join('')}<label style="grid-column:1/-1">Case name <span class="small muted">(blank = made from Case Type and FIR)</span><input data-cb="name" value="${esc(isNew ? '' : c.name || '')}" placeholder="${esc(CaseBox.autoName(c))}"></label></div>
      <div class="ti-step"><b>3</b> Add the ${K} data</div>
      <div class="ti-go"><button class="btn primary" data-pk="f">📄 Choose files<small>Excel, CSV, TXT, ZIP or RAR – many at once</small></button><button class="btn primary" data-pk="d">📁 Choose a folder<small>every file inside, sub-folders too</small></button></div>
      <div class="small muted">CDR, IPDR, TDR and SMS files are sorted automatically. <b>🔒 Everything stays on this computer, never uploaded online.</b></div>
      <div class="small" id="cbErr" style="color:var(--bad);min-height:1.2em"></div></div>`, [{ label: 'Close', onClick: UI.closeModal }, { label: '💾 Save details only', onClick: () => this.go(m, sel, null) }]);
    CaseBox.wire(m); m.addEventListener('input', () => { const e = $('#cbErr', m); if (e) e.textContent = ''; });
    $$('[data-ti]', m).forEach(b => b.onclick = () => this.open(b.dataset.ti === 'new' ? 'new' : (this._last && this._last !== 'new' ? this._last : S.caseId)));
    const cs = $('#tiCase', m); if (cs) cs.onchange = () => { this._last = cs.value; this.open(cs.value); };
    if (!isNew) this._last = sel;
    $$('[data-pk]', m).forEach(b => b.onclick = () => this.go(m, sel, b.dataset.pk));
  },
  go(m, sel, how) {
    const o = CaseBox.read(m), err = CaseBox.check(o);
    if (err) { $('#cbErr', m).textContent = err; return; }
    if (sel === 'new' && !o.fir && !o.name) { $('#cbErr', m).textContent = 'Enter the FIR No. (or a case name) for the new case'; $('[data-cb="fir"]', m).focus(); return; }
    o.name = o.name || CaseBox.autoName(o);
    if (!how) { UI.closeModal(); this.save(sel, o).then(() => UI.toast('Case details saved')); return; }
    /* open the picker now (needs the click); save the case and import when files are chosen */
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.className = 'hidden';
    if (how === 'd') { inp.webkitdirectory = true; inp.setAttribute('directory', ''); } else inp.accept = '.xlsx,.xls,.xlsm,.ods,.csv,.txt,.zip,.rar';
    inp.onchange = async () => { const files = [...inp.files]; inp.remove(); if (!files.length) return; UI.closeModal(); await this.save(sel, o); await TelUI.load(files); };
    document.body.appendChild(inp); inp.click();
  },
  async save(sel, o) {
    if (sel === 'new') { const c = { id: uid(), created: new Date().toISOString(), status: 'Under investigation', ...o }; S.cases.push(c); await DB.set('case:' + c.id, emptyCase()); this._sel = c.id; await switchCase(c.id); UI.toast('New case saved: ' + c.name); return c; }
    const c = S.cases.find(x => x.id === sel); if (!c) return; Object.assign(c, o);
    if (sel !== S.caseId) await switchCase(sel); else { await saveMeta(); fillCaseSel(); render(); }
    try { CaseBox.refresh(); } catch (e) { } return c;
  }
};
TelUI.menu = function () { TelImp._last = S.caseId; TelImp.open(S.caseId); };
/* case details strip in the Source bar: FIR · PS · IO, with edit */
{ const _bar = TSC.bar; TSC.bar = function (main, k) {
  _bar.call(this, main, k); const c = activeCase(), b = $('.tsc', main); if (!b) return;
  const bits = [c.fir && 'FIR ' + c.fir.replace(/^\s*FIR\s*(No\.?)?\s*/i, ''), c.ps && 'PS ' + c.ps, c.district, c.io && 'IO ' + c.io + (c.io_mobile ? ' (' + c.io_mobile + ')' : '')].filter(Boolean);
  const sel = $('#tscCase', b); if (!sel) return;
  sel.closest('.tsc-f').insertAdjacentHTML('afterend', `<button class="tsc-cd${bits.length ? '' : ' empty'}" id="tscCD" title="Case details – FIR, police station, district, IO">${bits.length ? '👮 ' + esc(bits.join(' · ')) : '⚠ Add FIR / PS / IO details'} <b>✎</b></button>`);
  $('#tscCD', b).onclick = () => TelImp.open(S.caseId);
}; }
