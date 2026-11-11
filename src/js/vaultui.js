/* vaultui.js – "Lock Case Data" card in Settings, the one-time offer after login, and a save when the tab is hidden */
'use strict';
const VaultUI = {
  busy: false,
  async lockNow(pw) {
    if (this.busy || Vault.on()) return; this.busy = true;
    const body = UI.modal('🔒 Locking Case Data…', `<p>Sealing every case, file and note in this browser with your password. Please keep this page open.</p><div class="small muted" id="vlProg">Starting…</div>`, []);
    try {
      if (S.caseId && S.data && !isScope(S.caseId)) { clearTimeout(saveTimer); await DB.set('case:' + S.caseId, S.data); }
      const n = await Vault.enable(pw, (i, t) => { const e = $('#vlProg', body); if (e) e.textContent = `${i} of ${t} records…`; });
      UI.closeModal(); await Recovery.create();   // new recovery key – it can open the locked data too
      UI.toast(`✔ Case data locked (${n} records). Save the new recovery key shown now.`, 8000);
      if (S.page === 'settings') render();
    } catch (e) { UI.closeModal(); UI.toast('Could not lock: ' + e.message, 8000); console.warn('vault', e); }
    this.busy = false;
  },
  offer(pw) {
    if (Vault.on() || !Vault.ok()) return;
    UI.modal('🔒 Lock Case Data With Your Password', `
      <div class="note"><b>Recommended.</b> All cases, imported files, Case One Files and notes kept in this browser will be locked (AES-256). They open only after you log in.
      Anyone who copies the browser files or opens this computer without your password sees nothing readable.</div>
      <ul class="small" style="color:var(--text-secondary);margin-top:10px">
        <li>A <b>new recovery key</b> is shown at the end. Keep it safe: it is the only way back if you forget the password.</li>
        <li>If both the password and the recovery key are lost, the data cannot be opened – only your backup files can bring it back.</li>
        <li>Files you save outside (exports, Case One File folder, backups) stay normal files so Word / Excel can open them – keep that folder safe.</li>
        <li>Password reset by e-mail code is turned off after locking (it cannot open the data). Use the recovery key.</li></ul>`,
      [{ label: 'Later', onClick: async () => { UI.closeModal(); S.settings.encAsk = today(); await DB.set('settings', S.settings); } },
       { label: '🔒 Lock Now', cls: 'primary', onClick: () => { UI.closeModal(); this.lockNow(pw); } }]);
  },
  after(pw) {
    if (Vault.on() || S.settings.mustChange || S.settings.encAsk === today()) return;
    let n = 0; const t = setInterval(() => { if (++n > 400 || Vault.on() || $('#app').classList.contains('hidden')) { clearInterval(t); return; }   // wait until other pop-ups (recovery key) are closed
      if (n > 1 && $('#modal').classList.contains('hidden')) { clearInterval(t); this.offer(pw); } }, 1500);
  }
};

/* Settings card */
(() => {
  const orig = Pages.settings;
  Pages.settings = main => {
    orig(main);
    const card = document.createElement('div'); card.className = 'card'; card.id = 'vaultCard';
    const E = S.settings.enc;
    card.innerHTML = `<h3>🔒 Lock Case Data With Password</h3>
      <div class="sub">Seals all cases, files and notes kept in this browser (AES-256, fully offline). They open only with your login password or your recovery key.</div>
      ${E ? `<div class="row"><span class="badge good">Locked</span><span class="small muted">since ${esc(new Date(E.when).toLocaleDateString('en-IN'))} · opens with your password or recovery key</span><span class="spacer"></span><input type="password" id="vlOffPw" placeholder="Your current password" style="max-width:220px"><button class="btn" id="vlOff">🔓 Remove Lock</button><span class="err" id="vlErr"></span></div>`
        : Vault.ok() ? `<div class="row"><span class="badge bad">Not locked</span><input type="password" id="vlPw" placeholder="Your current password" style="max-width:240px"><button class="btn primary" id="vlGo">🔒 Lock Now</button><span class="err" id="vlErr"></span></div>`
        : '<div class="note warn">This browser cannot lock data. Use Google Chrome or Microsoft Edge.</div>'}`;
    const grid = main.querySelector('.grid'); grid.parentNode.insertBefore(card, grid.nextSibling);
    const go = $('#vlGo', card);
    if (go) go.onclick = () => { const pw = $('#vlPw', card).value; if (hashPass(pw, S.settings.salt) !== S.settings.hash) { $('#vlErr', card).textContent = 'Password is wrong'; return; } VaultUI.offer(pw); };
    const off = $('#vlOff', card);
    if (off) off.onclick = async () => {
      const pw = $('#vlOffPw', card).value; if (hashPass(pw, S.settings.salt) !== S.settings.hash) { $('#vlErr', card).textContent = 'Password is wrong'; return; }
      if (!UI.confirm('Remove the lock? All case data in this browser will be stored without encryption again. You can lock it again any time.')) return;
      const body = UI.modal('🔓 Removing Lock…', `<p>Opening every record and saving it as normal data. Please keep this page open.</p><div class="small muted" id="vlProg">Starting…</div>`, []);
      try { if (S.caseId && S.data && !isScope(S.caseId)) { clearTimeout(saveTimer); await DB.set('case:' + S.caseId, S.data); }
        const n = await Vault.disable(pw, (i, t) => { const e = $('#vlProg', body); if (e) e.textContent = `${i} of ${t} records…`; });
        UI.closeModal(); UI.toast(`✔ Lock removed – ${n} records are normal data again`, 7000); S.settings.encAsk = today(); await DB.set('settings', S.settings); render();
      } catch (e) { UI.closeModal(); UI.toast('Could not remove the lock: ' + e.message, 8000); }
    };
    /* first password change: offer locking with the new password */
    const btn = $('#sSave'), save = btn.onclick;
    btn.onclick = async () => { const before = S.settings.hash, p1 = $('#sP1').value; await save(); if (S.settings.hash !== before && p1 && !Vault.on()) setTimeout(() => VaultUI.after(p1), 600); };
  };
})();

/* save the open case when the tab is hidden – sealing takes a moment, closing can be too quick */
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S.caseId && S.data && !isScope(S.caseId) && !$('#app').classList.contains('hidden')) DB.set('case:' + S.caseId, S.data); });
