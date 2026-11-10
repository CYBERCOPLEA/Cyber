/* mailotp.js - optional "email me a code" password reset.
   Uses the EmailJS service (https://www.emailjs.com) with the officer's own free account.
   Only the registered e-mail address and a 6-digit code are sent. No case data ever leaves the computer.
   Needs internet only at the moment the code is sent. Off until set up in Settings. */
'use strict';

const Mail = {
  API: 'https://api.emailjs.com/api/v1.0/email/send',
  DEFAULT_EMAIL: '',
  cfg() { return S.settings.mail || {}; },
  ready() { const c = this.cfg(); return !!(c.on && c.email && c.service && c.template && c.key) || !!this._g; },
  ejs() { const c = this.cfg(); return !!(c.on && c.email && c.service && c.template && c.key); },
  /* Google route: the officer's own Live Data Form script e-mails the code to the Google account that owns it (no EmailJS needed) */
  _g: null,
  async gLoad() { try { if (typeof Off === 'undefined' || !Off.live) return null; const L = await Off.live(); this._g = L.url && L.key && (L.ver || 0) >= 11 && L.mailOff !== 1 ? { mail: L.mail || 'the Google account of your Live Data Form' } : null; } catch (e) { this._g = null; } return this._g; },
  async gSend(passcode, purpose) { if (!navigator.onLine) throw new Error('This computer is offline. Connect to the internet and try again, or use your recovery key.'); let j; try { j = await Off.liveApi({ api: 'otp', code: passcode, purpose }); } catch (e) { throw new Error('Google: ' + e.message); } return j.to; },
  mask(e) { const [u, d] = String(e).split('@'); if (!d) return e; return u.slice(0, 2) + '*'.repeat(Math.max(3, u.length - 3)) + u.slice(-1) + '@' + d; },
  code() { const r = new Uint32Array(1); crypto.getRandomValues(r); return String(r[0] % 1000000).padStart(6, '0'); },

  async send(c, passcode, purpose) {
    if (!navigator.onLine) throw new Error('This computer is offline. Connect to the internet and try again, or use your recovery key.');
    let res;
    try {
      res = await fetch(this.API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: c.service, template_id: c.template, user_id: c.key,
          template_params: { to_email: c.email, passcode, purpose, valid_minutes: 10, app_name: 'SudarshanAshtra', time: new Date().toLocaleString('en-IN') }
        })
      });
    } catch (e) { throw new Error('Could not reach the e-mail service (check internet / firewall).'); }
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error('E-mail service said: ' + (t || res.status)); }
  },

  /* login page: e-mail flow */
  forgot() {
    const c = this.cfg(), st = S.settings;
    const body = UI.modal('Reset password by e-mail code', `
      <p class="small muted">A 6-digit code will be sent to <b>${esc(this._g ? this._g.mail : this.mask(c.email))}</b>${this._g ? ' through your own Google script (Live Data Form)' : ''}. Internet is needed for this step only.</p>
      <div class="row"><button class="btn primary" id="otSend">Send code</button><span class="small muted" id="otInfo"></span></div>
      <div id="otStep2" class="${st.otpHash && Date.now() < st.otpExp ? '' : 'hidden'}" style="margin-top:14px">
        <div class="map-grid" style="grid-template-columns:1fr 1fr">
          <div class="f"><label>Code from e-mail</label><input id="otCode" class="mono" inputmode="numeric" maxlength="6" autocomplete="one-time-code" style="font-size:18px;letter-spacing:4px"></div>
          <div class="f"><label>Login ID</label><input id="otUser" value="${esc(st.user)}"></div>
          <div class="f"><label>New password (min 6)</label><input id="otP1" type="password"></div>
          <div class="f"><label>Repeat new password</label><input id="otP2" type="password"></div></div></div>
      <div class="err" id="otErr" style="margin-top:8px"></div>`,
      [{ label: 'Cancel', onClick: UI.closeModal }, { label: 'Set new password', cls: 'primary', onClick: () => this.verify() }]);
    $('#otSend', body).onclick = async () => {
      const err = $('#otErr'), info = $('#otInfo'), btn = $('#otSend'); err.textContent = '';
      const now = Date.now(); st.otpSends = (st.otpSends || []).filter(t => now - t < 3600000);
      if (st.otpSends.length && now - st.otpSends[st.otpSends.length - 1] < 60000) { err.textContent = 'Please wait a minute before asking for another code.'; return; }
      if (st.otpSends.length >= 5) { err.textContent = 'Too many codes asked in the last hour. Try later or use your recovery key.'; return; }
      btn.disabled = true; info.textContent = 'Sending…';
      const pc = this.code();
      let sentTo = '';
      try { if (this._g) { try { sentTo = await this.gSend(pc, 'Password reset'); } catch (ge) { if (!this.ejs()) throw ge; await this.send(c, pc, 'Password reset'); } } else await this.send(c, pc, 'Password reset'); }
      catch (e) { err.textContent = e.message + (S.settings.recHash ? ' – You can also use your recovery key (Cancel ▸ Forgot password ▸ Use my recovery key).' : ''); info.textContent = ''; btn.disabled = false; return; }
      st.otpSalt = uid(); st.otpHash = hashPass(pc, st.otpSalt); st.otpExp = now + 10 * 60000; st.otpTries = 0; st.otpSends.push(now);
      await DB.set('settings', st);
      info.textContent = 'Code sent' + (sentTo ? ' to ' + sentTo : '') + '. Check your inbox (and Spam). Valid for 10 minutes.'; btn.textContent = 'Send again'; btn.disabled = false;
      $('#otStep2').classList.remove('hidden'); $('#otCode').focus();
    };
  },
  async verify() {
    const st = S.settings, err = $('#otErr');
    if (!st.otpHash) { err.textContent = 'Click "Send code" first.'; return; }
    if (Date.now() > st.otpExp) { err.textContent = 'This code has expired. Send a new one.'; return; }
    const code = $('#otCode').value.replace(/\D/g, ''), u = $('#otUser').value.trim(), p1 = $('#otP1').value, p2 = $('#otP2').value;
    if (hashPass(code, st.otpSalt) !== st.otpHash) {
      st.otpTries = (st.otpTries || 0) + 1;
      if (st.otpTries >= 5) { st.otpHash = ''; err.textContent = 'Too many wrong codes. This code is cancelled – send a new one.'; }
      else err.textContent = `Code is not correct (${5 - st.otpTries} tries left).`;
      await DB.set('settings', st); return;
    }
    if (!u) { err.textContent = 'Login ID required'; return; }
    if (p1.length < 6) { err.textContent = 'Password must be at least 6 characters'; return; }
    if (p1 !== p2) { err.textContent = 'Passwords do not match'; return; }
    Object.assign(st, { user: u, salt: uid(), mustChange: false, otpHash: '', otpTries: 0 }); st.hash = hashPass(p1, st.salt);
    await DB.set('settings', st); UI.closeModal();
    $('#lgUser').value = u; $('#lgPass').value = ''; $('#lgErr').textContent = ''; $('#lgFirst').textContent = '';
    UI.toast('Password changed. Log in with your new password.', 6000);
  }
};

/* "Forgot password?" now offers both ways */
(() => {
  const byKey = Recovery.forgot.bind(Recovery);
  Recovery.forgotKey = byKey;
  Recovery.forgot = async () => {
    await Mail.gLoad();
    if (!Mail.ready()) return byKey();
    const btns = [{ label: 'Cancel', onClick: UI.closeModal }];
    if (S.settings.recHash) btns.push({ label: 'Use my recovery key', onClick: byKey });
    btns.push({ label: 'E-mail me a code', cls: 'primary', onClick: () => Mail.forgot() });
    UI.modal('Forgot password', `<p>How do you want to reset your password?</p>
      <ul class="small" style="color:var(--text-secondary)">
      ${S.settings.recHash ? '<li><b>Recovery key</b> – works without internet.</li>' : ''}
      <li><b>E-mail code</b> – a 6-digit code is sent to ${esc(Mail._g ? Mail._g.mail : Mail.mask(Mail.cfg().email))}${Mail._g ? ' by your own Google script' : ''}. Needs internet.</li></ul>`, btns);
  };
})();

/* Settings card */
(() => {
  const orig = Pages.settings;
  Pages.settings = main => {
    orig(main);
    const c = Mail.cfg(), card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<h3>Forgot-password by e-mail code <span class="badge ${Mail.ready() ? 'good' : 'bad'}" style="margin-left:8px">${Mail.ready() ? 'On' : 'Off'}</span></h3>
      <div class="lv-gm" id="mlG"></div>
      <div class="sub">Optional second way. Sends a 6-digit code to your registered e-mail through your own free <b>EmailJS</b> account (emailjs.com). Only the e-mail address and the code are sent – no case data. Internet is needed only when a code is sent. Setup steps are in README.txt.</div>
      <div class="map-grid">
        <div class="f"><label>Registered e-mail</label><input id="mlEmail" type="email" value="${esc(c.email || Mail.DEFAULT_EMAIL)}"></div>
        <div class="f"><label>EmailJS Service ID</label><input id="mlSvc" class="mono" placeholder="service_xxxxxxx" value="${esc(c.service || '')}"></div>
        <div class="f"><label>EmailJS Template ID</label><input id="mlTpl" class="mono" placeholder="template_xxxxxxx" value="${esc(c.template || '')}"></div>
        <div class="f"><label>EmailJS Public Key</label><input id="mlKey" class="mono" placeholder="from Account → General" value="${esc(c.key || '')}"></div>
        <div class="f"><label>Current password (to save changes)</label><input id="mlCur" type="password"></div>
        <div class="f"><label>&nbsp;</label><label class="small"><input type="checkbox" id="mlOn" ${c.on ? 'checked' : ''}> Allow e-mail code on the login page</label></div></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="mlSave">Save</button><button class="btn" id="mlTest">Send test e-mail</button><span class="err" id="mlErr"></span></div>`;
    const anchor = [...main.querySelectorAll('.card')].find(x => /Forgot-password recovery/.test(x.querySelector('h3')?.textContent || '')) || main.querySelector('.grid');
    anchor.parentNode.insertBefore(card, anchor.nextSibling);
    Mail.gLoad().then(async g => { const box = $('#mlG', card); if (!box) return; const L = typeof Off !== 'undefined' ? await Off.live() : {};
      box.innerHTML = g ? `<div class="lv-st" style="margin-bottom:8px">✔ <b>E-mail code through your Google script is ON</b> – the code goes to <b>${esc(g.mail)}</b> (the Google account that owns your Live Data Form sheet). No EmailJS needed. <button class="btn sm" id="mlGt">Send test code</button></div>`
        : `<div class="lv-old" style="margin-bottom:8px"><b>Easiest way (recommended):</b> use your Live Data Form Google script to e-mail the code – no EmailJS account needed. ${L.url ? `Your script is older than needed: paste the new script (Crime Data ▸ 🔴 Live Data Form ▸ 📋 Copy new script), then in Apps Script choose <b>setupEmail</b> ▸ ▶ Run ▸ Allow, and Deploy ▸ Manage deployments ▸ ✏ Edit ▸ New version ▸ Deploy.` : 'Connect the Live Data Form first (Office Work ▸ Crime Data ▸ 🔴 Live Data Form by Police), then in Apps Script choose <b>setupEmail</b> ▸ ▶ Run ▸ Allow.'}</div>`;
      const t = $('#mlGt', card); if (t) t.onclick = async () => { t.disabled = true; try { const to = await Mail.gSend('123456', 'Test e-mail – this is not a real code'); UI.toast('Test code sent to ' + to + '. Check inbox / Spam.', 7000); } catch (e) { UI.toast(e.message + ' – In Apps Script choose setupEmail ▸ Run ▸ Allow once, then Deploy ▸ Manage deployments ▸ Edit ▸ New version.', 10000); } t.disabled = false; }; });
    const read = () => ({ email: $('#mlEmail').value.trim(), service: $('#mlSvc').value.trim(), template: $('#mlTpl').value.trim(), key: $('#mlKey').value.trim(), on: $('#mlOn').checked });
    $('#mlSave', card).onclick = async () => {
      const e = $('#mlErr'), v = read(); e.textContent = '';
      if (hashPass($('#mlCur').value, S.settings.salt) !== S.settings.hash) { e.textContent = 'Current password is wrong'; return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { e.textContent = 'Enter a valid e-mail'; return; }
      if (v.on && !(v.service && v.template && v.key)) { e.textContent = 'Fill Service ID, Template ID and Public Key to switch it on'; return; }
      S.settings.mail = v; await DB.set('settings', S.settings); UI.toast('E-mail reset settings saved'); render();
    };
    $('#mlTest', card).onclick = async () => {
      const e = $('#mlErr'), v = read(); e.textContent = '';
      if (!(v.email && v.service && v.template && v.key)) { e.textContent = 'Fill all EmailJS fields first'; return; }
      e.textContent = 'Sending…';
      try { await Mail.send(v, '123456', 'Test e-mail (this is not a real code)'); e.textContent = ''; UI.toast('Test e-mail sent to ' + v.email + '. Check inbox / Spam.', 6000); }
      catch (x) { e.textContent = x.message; }
    };
  };
})();
