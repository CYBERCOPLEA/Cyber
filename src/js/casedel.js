/* casedel.js – "Delete Case Data" in the top bar: choose the case, keep a backup, confirm with the password */
'use strict';
const CaseDel = {
  open() {
    if (!S.cases.length) { UI.toast('No case to delete'); return; }
    const cur = isScope(S.caseId) ? '' : S.caseId;
    const grp = (l, L) => L.length ? `<optgroup label="${esc(l)}">${L.map(c => `<option value="${esc(c.id)}" ${c.id === cur ? 'selected' : ''}>${esc(AllMode.caseLabel(c))}</option>`).join('')}</optgroup>` : '';
    const body = UI.modal('🗑 Delete Case Data', `
      <div class="note warn"><b>This removes the case and all its data from this computer</b> – imported files, trail, CDR, CD, notices and notes. It cannot be undone, except from a backup file.</div>
      <div class="map-grid" style="grid-template-columns:1fr;margin-top:12px">
        <div class="f"><label>Case to delete</label><select id="cdSel">${cur ? '' : '<option value="">— Choose the case —</option>'}${grp('📁 FIR Cases', S.cases.filter(c => AllMode.cat(c) === 'fir'))}${grp('🧾 NCRP – No FIR Yet', S.cases.filter(c => AllMode.cat(c) !== 'fir'))}</select></div>
        <div id="cdInfo" class="small muted"></div>
        <label class="row" style="gap:8px;align-items:center"><input type="checkbox" id="cdBak" checked style="width:auto"> Download a backup file of this case first (recommended)</label>
        <div class="f"><label>Your login password (to confirm)</label><input type="password" id="cdPw" autocomplete="current-password"></div></div>
      <div class="err" id="cdErr" style="margin-top:8px"></div>`,
      [{ label: 'Cancel', onClick: UI.closeModal }, { label: '🗑 Delete This Case', cls: 'danger', onClick: () => this.go() }]);
    const info = async () => { const id = $('#cdSel', body).value, i = $('#cdInfo', body); if (!id) { i.textContent = ''; return; } i.textContent = 'Reading…';
      let d = {}; try { d = (id === S.caseId ? S.data : await DB.get('case:' + id)) || {}; } catch (e) { }
      const n = k => (d[k] || []).length, cc = d.cctns || {};
      i.innerHTML = `Contains: <b>${fmtNum(n('txns'))}</b> transactions · <b>${fmtNum(n('ncrp'))}</b> complaints · <b>${fmtNum(n('tel'))}</b> CDR / IPDR rows · <b>${fmtNum(n('social'))}</b> social · <b>${fmtNum((cc.cd || []).length)}</b> CD parts · <b>${fmtNum(n('imports'))}</b> files imported`; };
    $('#cdSel', body).onchange = info; info();
  },
  async go() {
    const id = $('#cdSel').value, pw = $('#cdPw').value, err = $('#cdErr'), c = S.cases.find(x => x.id === id);
    if (!c) { err.textContent = 'Choose the case to delete'; return; }
    if (hashPass(pw, S.settings.salt) !== S.settings.hash) { err.textContent = 'Password is wrong'; return; }
    if ($('#cdBak').checked) {
      let d = null; try { d = (id === S.caseId ? S.data : await DB.get('case:' + id)) || emptyCase(); } catch (e) { err.textContent = 'Could not read the case for the backup – nothing deleted.'; return; }
      UI.download(`SudarshanAshtra_backup_${(c.fir || c.ack || c.name || 'case').replace(/[^\w.-]+/g, '_')}_${today()}.json`, JSON.stringify({ app: 'sudarshanastra', version: 1, exported: new Date().toISOString(), cases: [c], data: { [id]: d } }), 'application/json');
    }
    UI.closeModal();
    await deleteCase(id, true);
    if (isScope(S.caseId) && (S.cases.length < 2 || !AllMode.list(S.caseId).length)) await switchCase(S.cases[0].id);   // one case left: show it
    for (const k of ['dx', 'cxt', 'cc', 'ofx', 'ad']) DB.del('sum:' + k + ':' + id).catch(() => { });
    UI.toast(`🗑 Case "${c.name}" deleted`, 6000);
  }
};
(() => {
  const nb = $('#btnNewCase'); if (!nb || $('#btnDelCase')) return;
  nb.insertAdjacentHTML('afterend', '<button class="btn sm" id="btnDelCase" title="Remove a case and all its data from this computer (asks for your password; keeps a backup file)">🗑 Delete Case Data</button>');
  $('#btnDelCase').onclick = () => CaseDel.open();
})();
