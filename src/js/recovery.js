/* recovery.js - offline "Forgot password" using a one-time recovery key (nothing is sent over the internet) */
'use strict';

const Recovery = {
  gen() {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = new Uint32Array(16); crypto.getRandomValues(r);
    let k = ''; r.forEach((v, i) => { k += a[v % a.length]; if (i % 4 === 3 && i < 15) k += '-'; }); return k;
  },
  norm: k => String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
  async create() {
    const k = this.gen(); S.settings.recSalt = uid(); S.settings.recHash = hashPass(this.norm(k), S.settings.recSalt); S.settings.recWhen = new Date().toISOString();
    await DB.set('settings', S.settings); this.show(k);
  },
  show(k) {
    const body = UI.modal('Your password recovery key', `
      <div class="note warn"><b>Save this key now.</b> It is shown only once. If you forget your password, click "Forgot password?" on the login page and enter this key to set a new password.</div>
      <div style="text-align:center;margin:22px 0"><div class="mono" style="font-size:30px;font-weight:700;letter-spacing:3px;padding:16px;border:2px dashed var(--accent);border-radius:12px;display:inline-block">${k}</div></div>
      <ul class="small" style="color:var(--text-secondary)"><li>Write it in your diary, or print it and keep it in a safe place – not on this computer's desktop.</li>
      <li>Anyone who has this key can reset the password, so keep it private.</li><li>Each key works once. After using it you get a new one.</li></ul>`,
      [{ label: 'Copy', onClick: () => { navigator.clipboard?.writeText(k); UI.toast('Copied'); } },
       { label: 'Download as .txt', onClick: () => UI.download('Sudarshanastra_recovery_key.txt', `Sudarshanastra password recovery key\r\n\r\n${k}\r\n\r\nCreated: ${new Date().toLocaleString('en-IN')}\r\nKeep this private. Use it on the login page: "Forgot password?"\r\n`) },
       { label: 'Print', onClick: () => Reports.win('Recovery key', `<h1>Sudarshanastra – password recovery key</h1><p style="font:700 28px Consolas,monospace;letter-spacing:3px">${k}</p><p>Created ${new Date().toLocaleString('en-IN')}. Keep private.</p>`) },
       { label: 'I have saved it', cls: 'primary', onClick: UI.closeModal }]);
    return body;
  },
  forgot() {
    if (!S.settings.recHash) {
      UI.modal('Forgot password', `<p>No recovery key has been set up yet, so the password cannot be reset from here.</p>
        <ul class="small" style="color:var(--text-secondary)"><li>Try the default password <b>admin@123</b> if it was never changed.</li>
        <li>Otherwise the only way in is to start fresh: in the browser settings, clear "Site data" for this page. <b>This deletes all cases</b> stored in this browser – restore them afterwards from a backup file (Others → Reports &amp; Export → Download backup).</li></ul>
        <p class="small muted">After you log in, create a recovery key in Settings so this does not happen again.</p>`, [{ label: 'Close', cls: 'primary', onClick: UI.closeModal }]);
      return;
    }
    const body = UI.modal('Reset password with recovery key', `
      <p class="small muted">Enter the recovery key you saved when you set up your password (format XXXX-XXXX-XXXX-XXXX).</p>
      <div class="map-grid" style="grid-template-columns:1fr 1fr">
        <div class="f" style="grid-column:1/3"><label>Recovery key</label><input id="rcKey" class="mono" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" style="font-size:16px;letter-spacing:1px"></div>
        <div class="f"><label>Login ID</label><input id="rcUser" value="${esc(S.settings.user)}"></div><div></div>
        <div class="f"><label>New password (min 6)</label><input id="rcP1" type="password"></div>
        <div class="f"><label>Repeat new password</label><input id="rcP2" type="password"></div></div>
      <div class="err" id="rcErr" style="margin-top:8px"></div>`,
      [{ label: 'Cancel', onClick: UI.closeModal }, {
        label: 'Reset password', cls: 'primary', onClick: async () => {
          const err = $('#rcErr'), key = Recovery.norm($('#rcKey').value), p1 = $('#rcP1').value, p2 = $('#rcP2').value, u = $('#rcUser').value.trim();
          S.settings.recTries = (S.settings.recTries || 0);
          if (S.settings.recLockUntil && Date.now() < S.settings.recLockUntil) { err.textContent = 'Too many wrong keys. Try again after ' + new Date(S.settings.recLockUntil).toLocaleTimeString('en-IN'); return; }
          if (hashPass(key, S.settings.recSalt) !== S.settings.recHash) {
            S.settings.recTries++; if (S.settings.recTries >= 5) { S.settings.recLockUntil = Date.now() + 15 * 60000; S.settings.recTries = 0; }
            await DB.set('settings', S.settings); err.textContent = 'Recovery key is not correct.'; return;
          }
          if (!u) { err.textContent = 'Login ID required'; return; }
          if (p1.length < 6) { err.textContent = 'Password must be at least 6 characters'; return; }
          if (p1 !== p2) { err.textContent = 'Passwords do not match'; return; }
          Object.assign(S.settings, { user: u, salt: uid(), mustChange: false, recTries: 0, recLockUntil: 0 }); S.settings.hash = hashPass(p1, S.settings.salt);
          await Recovery.create();   // old key is used up – show a new one
          $('#lgUser').value = u; $('#lgPass').value = ''; $('#lgErr').textContent = ''; $('#lgFirst').textContent = '';
          UI.toast('Password changed. Save your NEW recovery key, then log in.', 6000);
        }
      }]);
    $('#rcKey', body).focus();
  }
};

/* login page link */
$('#lgForgot').onclick = e => { e.preventDefault(); if (S.settings) Recovery.forgot(); };

/* Settings: recovery card, and create a key right after the first password change */
(() => {
  const orig = Pages.settings;
  Pages.settings = main => {
    orig(main);
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<h3>Forgot-password recovery</h3><div class="sub">Works fully offline: a one-time recovery key lets you set a new password from the login page ("Forgot password?"). No e-mail or internet is used.</div>
      <div class="row">${S.settings.recHash ? `<span class="badge good">Recovery key is set</span><span class="small muted">created ${esc((S.settings.recWhen || '').slice(0, 10))}</span>` : '<span class="badge bad">No recovery key yet</span>'}
      <span class="spacer"></span><button class="btn primary" id="recNew">${S.settings.recHash ? 'Create a new key (old one stops working)' : 'Create recovery key'}</button></div>`;
    const grid = main.querySelector('.grid'); grid.parentNode.insertBefore(card, grid.nextSibling);
    $('#recNew', card).onclick = async () => { if (S.settings.recHash && !UI.confirm('Create a new recovery key? The old key will stop working.')) return; await Recovery.create(); render(); };
    const btn = $('#sSave'), save = btn.onclick;
    btn.onclick = async () => { const before = S.settings.hash; await save(); if (S.settings.hash !== before && !S.settings.recHash) { await Recovery.create(); render(); } };
  };
})();

/* after login: remind once per session if no key exists */
$('#loginForm').addEventListener('submit', () => setTimeout(() => {
  if (!$('#app').classList.contains('hidden') && !S.settings.mustChange && !S.settings.recHash && !Recovery._reminded) { Recovery._reminded = true; UI.toast('Tip: create a password recovery key in Settings, in case you forget your password.', 7000); }
}, 900));
