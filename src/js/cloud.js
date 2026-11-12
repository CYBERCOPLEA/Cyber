/* cloud.js – one place (Settings, Super Admin only) to set up, update and check the Google Sheet + Apps Script used by the whole tool:
   Live Data Form by Police, user logins (Super Admin Control) and the e-mail password-reset code. */
'use strict';
const Cloud = {
  STEPS_NEW: `<ol class="lv-steps">
      <li>Sign in to your <b>official Google account</b> and open <a href="https://sheets.new" target="_blank" rel="noopener">sheets.new</a> (a new blank Google Sheet). Name it e.g. <i>SudarshanAshtra – Server</i>.</li>
      <li>In the sheet: <b>Extensions → Apps Script</b>. Delete what is there and paste the script (<b>📋 Copy Script</b> below). Press 💾 <b>Save</b>. Then pick <b>setupEmail</b> in the function list at the top ▸ ▶ <b>Run</b> ▸ <b>Allow</b> (once).</li>
      <li><b>Deploy → New deployment</b> → ⚙ type <b>Web app</b> → Execute as: <b>Me</b> · Who has access: <b>Anyone</b> → <b>Deploy</b> → <b>Authorize access</b> (your account → Advanced → Go to project → Allow).</li>
      <li>Copy the <b>Web app URL</b> (ends with <code>/exec</code>), paste it below and press <b>🔗 Connect</b>.</li></ol>`,
  STEPS_UPD: `<ol class="lv-steps">
      <li>Press <b>📋 Copy Script</b> here.</li>
      <li>Open your Google Sheet → <b>Extensions → Apps Script</b>. Select all old code (Ctrl+A), paste (Ctrl+V), press 💾 <b>Save</b>.</li>
      <li><b>Deploy → Manage deployments</b> → ✏ <b>Edit</b> → Version: <b>New version</b> → <b>Deploy</b>. (Not "New deployment" – that makes a new link.)</li>
      <li>Come back and press <b>🔄 Check Now</b>.</li></ol>`,
  async card(main) {
    if (!Role.admin() || typeof Off === 'undefined') return;
    const L = await Off.live(), cf = await Off.cfg();
    if (!L.key) { L.key = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join(''); await Off.liveSave(); }
    const code = Off.liveCode(L, cf.office || Off.OFFICE), old = L.url && (L.ver || 0) < Off.GSVER;
    let card = $('#cloudCard', main); if (!card) { card = document.createElement('div'); card.className = 'card'; card.id = 'cloudCard'; const r = $('#roleCard', main) || $('#vaultCard', main) || main.querySelector('.grid'); r ? r.parentNode.insertBefore(card, r.nextSibling) : main.appendChild(card); }
    card.innerHTML = `<h3>☁ Google Sheet &amp; Apps Script – Whole Tool <span class="badge">Super Admin</span></h3>
      <div class="sub">One Google Sheet in your own account serves the whole tool: <b>user logins</b> (Super Admin Control), <b>Live Data Form by Police</b> and the <b>e-mail password-reset code</b>. Set it up once and update it here. Case data never goes there.</div>
      ${L.url ? `<div class="cl-st ${L.err ? 'bad' : old ? 'old' : ''}">${L.err ? '⚠ ' + esc(L.err) : old ? '🟠 Connected – script is old' : '🟢 Connected'} · script version <b>${L.ver || '?'}</b> (tool needs ${Off.GSVER}) · last check ${L.last ? esc(new Date(L.last).toLocaleString('en-IN')) : '–'}${L.mail ? ' · e-mail ' + esc(L.mail) : ''}${L.sheet ? ` · <a href="${esc(L.sheet)}" target="_blank" rel="noopener">Open Google Sheet ↗</a>` : ''}</div>` : '<div class="cl-st bad">⚪ Not connected yet</div>'}
      ${old ? `<div class="lv-old"><b>⚠ Update your Google script once</b> – the link stays the same:${this.STEPS_UPD}</div>` : ''}
      ${!L.url ? this.STEPS_NEW : ''}
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn primary" id="clCp">📋 Copy Script</button><button class="btn" id="clDl">⬇ Download Script</button>${L.url ? '<button class="btn" id="clStaff" title="Staff personal links for the Live Data Form by Police">👮 Staff Links – Live Data Form</button><button class="btn" id="clChk">🔄 Check Now</button><button class="btn" id="clSet">⚙ Setup Steps / Change Link</button><button class="btn danger" id="clOff">Disconnect</button>' : ''}<span class="small muted">The script has your private key inside – do not share it.</span></div>
      <div id="clNew" class="${L.url ? 'hidden' : ''}" style="margin-top:8px">${L.url ? this.STEPS_NEW : ''}<div class="row" style="gap:6px"><input id="clUrl" class="grow" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(L.url || '')}"><button class="btn primary" id="clGo">🔗 Connect</button></div></div>
      ${L.url ? `<div class="small muted" style="margin-top:8px">Web app link: <code style="word-break:break-all">${esc(L.url)}</code></div>` : ''}`;
    const cp = () => { navigator.clipboard ? navigator.clipboard.writeText(code).then(() => UI.toast('Script copied – paste it in Apps Script'), () => Off.liveShow(code)) : Off.liveShow(code); };
    $('#clCp', card).onclick = cp; $('#clDl', card).onclick = () => UI.download('SudarshanAshtra_Code.gs.txt', code);
    if ($('#clStaff', card)) $('#clStaff', card).onclick = () => Off.liveOpen(() => this.card(main));
    if ($('#clSet', card)) $('#clSet', card).onclick = () => $('#clNew', card).classList.toggle('hidden');
    if ($('#clChk', card)) $('#clChk', card).onclick = async () => { const b = $('#clChk', card); b.disabled = true; b.textContent = '⏳ Checking…'; try { const j = await Off.liveApi({ api: 'ping' }); Object.assign(L, { sheet: j.sheet || L.sheet, ver: j.ver || 0, mail: j.mail || '', last: new Date().toISOString(), err: '' }); await Off.liveSave(); UI.toast((j.ver || 0) >= Off.GSVER ? '✔ Script is up to date' : '🟠 Script is still old – update it'); } catch (e) { L.err = e.message; await Off.liveSave(); UI.toast('Could not reach the script: ' + e.message, 7000); } Users._data = null; this.card(main); };
    if ($('#clOff', card)) $('#clOff', card).onclick = async () => { if (!UI.confirm('Disconnect the Google Sheet? User logins on the User link stop working and the Live Data Form stops coming in, until you connect again.')) return; clearInterval(Off._lsT); L.url = ''; L.err = ''; await Off.liveSave(); this.card(main); };
    $('#clGo', card).onclick = async () => {
      const u = $('#clUrl', card).value.trim(), g = $('#clGo', card); if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(u)) return UI.toast('Paste the Web app URL from Apps Script (https://script.google.com/…/exec)', 6000);
      g.disabled = true; g.textContent = '⏳ Checking…'; const o = L.url; L.url = u;
      try { const j = await Off.liveApi({ api: 'ping' }); Object.assign(L, { sheet: j.sheet || '', ver: j.ver || 0, mail: j.mail || '', paused: 0, err: '', last: new Date().toISOString() }); await Off.liveSave(); UI.toast('✔ Connected to your Google Sheet'); Off.liveStart && Off.liveStart(); Users._data = null; this.card(main); }
      catch (e) { L.url = o; await Off.liveSave(); g.disabled = false; g.textContent = '🔗 Connect'; UI.toast('Could not connect: ' + e.message, 8000); }
    };
  }
};
(() => {
  const os = Pages.settings; Pages.settings = main => { os(main); Cloud.card(main); };
  /* Live Data Form by Police: setup and script now live in Settings */
  if (typeof Off === 'undefined' || !Off.liveOpen) return;
  const lo = Off.liveOpen;
  Off.liveOpen = async function (re) {
    const L = await this.live();
    if (!L.url) { const b = UI.modal('🔴 Live Data Form by Police', `<p>First connect your Google Sheet once in <b>⚙ Settings › ☁ Google Sheet &amp; Apps Script</b>. The same sheet serves user logins and this form.</p>`, [{ label: 'Close', onClick: UI.closeModal }, { label: '⚙ Open Settings', cls: 'primary', onClick: () => { UI.closeModal(); go('settings'); setTimeout(() => { const c = $('#cloudCard'); c && c.scrollIntoView({ behavior: 'smooth' }); }, 400); } }]); return b; }
    const r = await lo.apply(this, arguments), m = $('#mdBody');
    ['#lvSet', '#lvOff'].forEach(s => { const x = $(s, m); if (x) x.remove(); }); const su = $('#lvSetup', m); if (su) su.remove();
    const old = $('.lv-old', m); if (old) old.innerHTML = '<b>⚠ Your Google script is old.</b> Update it once in <a href="#" class="cl-go">⚙ Settings › ☁ Google Sheet &amp; Apps Script</a>.';
    const st = $('.lv-st', m); if (st && !$('.cl-go2', m)) st.insertAdjacentHTML('beforeend', '<div class="small muted" style="margin-top:6px">Script setup / update / disconnect: <a href="#" class="cl-go cl-go2">⚙ Settings › ☁ Google Sheet &amp; Apps Script</a></div>');
    $$('.cl-go', m).forEach(a => a.onclick = e => { e.preventDefault(); UI.closeModal(); go('settings'); setTimeout(() => { const c = $('#cloudCard'); c && c.scrollIntoView({ behavior: 'smooth' }); }, 400); });
    return r;
  };
})();
