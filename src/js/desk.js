/* desk.js – SudarshanAshtra Desktop (Windows EXE). Active only inside the EXE (window.SudDesk comes from the EXE's preload).
   The EXE opens the User edition. Here the licence takes the place of the online login:
   - who the user is, category, valid dates, left-panel sections and extra rights come from the signed licence,
   - the user keeps an own password on this computer (first start: choose it),
   - top bar: licence chip (category · days left) and the ⬆ Update button. */
'use strict';
const Desk = {
  on: typeof window !== 'undefined' && !!window.SudDesk && SUD_ED === 'user',
  lic() { return window.SudDesk && window.SudDesk.lic || null; },
  link() {
    const p = this.lic(); if (!p) return null;
    const L = (S.settings && S.settings.link && S.settings.link.desk === p.lid) ? S.settings.link : { desk: p.lid };
    const rs = Plans.rightsOf(Role.defRights().filter(k => !['lists', 'delcase'].includes(k)).concat(p.xr || []).join(','), { hide: p.hide || [] });
    return Object.assign(L, { id: p.lid, name: p.n, rank: p.rk, ps: [p.ps, p.dist].filter(Boolean).join(', '), rights: rs.join(','), status: 'Active', tok: 'desk', okAt: Date.now(), plan: { tier: p.tier, hide: p.hide || [], h: 0, from: p.from, to: p.to } });
  },
  left() { const p = this.lic(); return p ? ExeLic.left(p) : 0; },
  chip() {
    const p = this.lic(), rb = $('#roleBadge') || $('#btnTheme'); if (!p || !rb || $('#app').classList.contains('hidden')) return;
    let c = $('#dkLic'); if (!c) { rb.insertAdjacentHTML('beforebegin', '<span id="dkLic" class="pl-tm"></span><button class="btn sm" id="dkUpd" title="Check for a newer SudarshanAshtra and install it">⬆ Update</button>'); c = $('#dkLic'); c.onclick = () => this.account(); $('#dkUpd').onclick = () => this.update(); }
    const t = Plans.t(p.tier), l = this.left(); c.style.setProperty('--c', l <= 10 ? '#dc2626' : t[2]);
    c.className = 'pl-tm' + (l <= 10 ? ' low' : l <= 15 ? ' mid' : ''); c.innerHTML = `${t[1]} · <b>${l} day${l === 1 ? '' : 's'}</b>`; c.title = 'Licence valid till ' + ExeLic.dmy(p.to) + ' – click for details';
    const pt = $('#plTimer'); if (pt) pt.remove();
    this.updBtn();
  },
  /* ---------- login screen: own password on this computer ---------- */
  note() {
    const f = $('#lgFirst'), p = this.lic(); if (!f || !p || !S.settings) return;
    const set = !!S.settings.deskSet, fg = $('#lgForgot'); if (fg) fg.parentNode.classList.add('hidden');
    $('#lgUser').value = p.lid; $('#lgUser').readOnly = true; const lb = $('label[for="lgUser"]'); if (lb) lb.textContent = 'Licence ID';
    f.innerHTML = `<span class="lg-sa">🖥 <b>${esc([p.rk, p.n].filter(Boolean).join(' '))}</b> · ${Plans.badge(p.tier)} · valid till <b>${ExeLic.dmy(p.to)}</b></span>
      <span class="small muted" style="display:block;margin-top:6px">${set ? 'Enter your password for this computer.' : '<b>First time:</b> choose your own password (at least 6 characters) and remember it.'}</span>
      ${set ? '<a href="#" id="dkForgot" class="small" style="display:block;margin-top:8px;color:var(--accent)">Forgot password?</a>' : ''}`;
    if ($('#dkForgot')) $('#dkForgot').onclick = e => { e.preventDefault(); this.forgot(); };
    this.blockNote();
  },
  ask(title, html) {
    return new Promise(res => { const b = UI.modal(title, html + '<div class="err" id="dkErr"></div>', [{ label: 'Cancel', onClick: () => { UI.closeModal(); res(null); } }, { label: 'OK', cls: 'primary', onClick: () => res(b) }]); });
  },
  async setPw(pw) { S.settings.user = this.lic().lid; S.settings.salt = uid(); S.settings.hash = hashPass(pw, S.settings.salt); S.settings.mustChange = false; S.settings.deskSet = 1; await DB.set('settings', S.settings); },
  async onSubmit(e) {
    if (e.target.id !== 'loginForm') return;
    if (this.overdue()) { e.preventDefault(); e.stopImmediatePropagation(); $('#lgErr').textContent = '⬆ First update SudarshanAshtra to the latest version, then log in.'; if (!$('#dkMust')) this.blockNote(); return; }
    if (Users._pass) return;
    $('#lgUser').value = this.lic().lid;
    if (S.settings.deskSet) return;                      // normal check by the tool (password on this computer)
    e.preventDefault(); e.stopImmediatePropagation();
    const pw = $('#lgPass').value; if (pw.length < 6) { $('#lgErr').textContent = 'Choose a password of at least 6 characters'; return; }
    const b = await this.ask('🔑 Confirm Your Password', '<p class="small">Type the same password again. You will need it every time you open SudarshanAshtra.</p><input type="password" id="dkPw2">');
    if (!b) return; if ($('#dkPw2', b).value !== pw) { UI.closeModal(); $('#lgErr').textContent = 'The two passwords were not the same – try again'; return; }
    UI.closeModal(); await this.setPw(pw); $('#lgErr').textContent = ''; Users.pass();
  },
  /* ---------- talking to the Super Admin's Google script (e-mail code, reset request) – needs internet ---------- */
  SITE: 'https://cybercoplea.github.io/SudarshanAshtra/',
  async gsUrl() {
    const p = this.lic(); if (p && /^https:\/\/script\.google/.test(p.u || '')) return p.u;
    try { const j = await (await fetch(this.SITE + 'desktop/latest.json?t=' + Date.now(), { cache: 'no-store' })).json(); if (/^https:\/\/script\.google/.test(j.req || '')) { localStorage.setItem('sud-gsu', j.req); return j.req; } } catch (e) { }
    return localStorage.getItem('sud-gsu') || '';
  },
  async gs(body) {
    const D = window.SudDesk; body = Object.assign({ mid: D.mid }, body);
    if (D.gs) { const r = await D.gs(body); if (!r.ok) throw new Error(r.err || 'no answer'); return r.r; }
    const u = await this.gsUrl(); if (!u) throw new Error('No internet – could not reach the SudarshanAshtra team');
    let j; try { j = await (await fetch(u, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' }, redirect: 'follow' })).json(); } catch (e) { throw new Error('No internet – could not reach the SudarshanAshtra team'); }
    if (!j.ok) throw new Error(/Unknown request/.test(j.err || '') ? 'The SudarshanAshtra team has not switched this on yet – use Connect To SudarshanAshtra Team' : (j.err || 'no answer')); return j.r;
  },
  email() { let o = null; try { o = JSON.parse(localStorage.getItem('sud-em') || 'null'); } catch (e) { } return (S.settings && S.settings.deskEm) || (o && o.ok && o.em) || (this.lic() && this.lic().em) || ''; },
  maskEm(e) { const a = String(e || '').split('@'); return a.length < 2 ? '' : a[0].slice(0, 2) + '****' + a[0].slice(-1) + '@' + a[1]; },
  /* e-mail code: send → type the 6 digits → checked by the Super Admin's script */
  otp(em, why, title) {
    return new Promise(res => {
      const fix = !!em;
      const b = UI.modal(title || '📧 Check Your E-mail', `<p class="small">${why === 'reset' ? 'A 6-digit code goes to your e-mail. Type it here to set a new password.' : 'Type your e-mail. A 6-digit code goes there – type it here to confirm.'} <b>Needs internet.</b></p>
        <div class="map-grid" style="grid-template-columns:1fr"><div class="f"><label>E-mail</label><input id="dkEm" type="email" value="${esc(fix ? (why === 'reset' ? this.maskEm(em) : em) : '')}" ${fix && why === 'reset' ? 'readonly' : ''} data-nov></div>
        <div class="f"><label>Code From The E-mail</label><input id="dkOtp" inputmode="numeric" maxlength="6" placeholder="6 digits" data-nov></div></div><div class="err" id="dkOe"></div>`,
        [{ label: 'Cancel', onClick: () => { UI.closeModal(); res(null); } }, { label: '📨 Send Code', onClick: async () => {
          const e = why === 'reset' ? em : $('#dkEm', b).value.trim().toLowerCase(), say = t => { $('#dkOe', b).textContent = t; };
          if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(e)) return say('Check the e-mail address');
          say('⏳ Sending the code…'); try { await this.gs({ fn: 'lotp', em: e, why }); say('✔ Code sent to ' + this.maskEm(e) + ' – check Inbox and Spam.'); $('#dkOtp', b).focus(); } catch (x) { say('❌ ' + x.message); }
        } }, { label: '✔ Confirm', cls: 'primary', onClick: async () => {
          const e = why === 'reset' ? em : $('#dkEm', b).value.trim().toLowerCase(), c = $('#dkOtp', b).value.trim(), say = t => { $('#dkOe', b).textContent = t; };
          if (!/^\d{6}$/.test(c)) return say('Type the 6-digit code from the e-mail');
          say('⏳ Checking…'); try { await this.gs({ fn: 'lotpok', em: e, otp: c }); UI.closeModal(); res(e); } catch (x) { say('❌ ' + x.message); }
        } }]);
    });
  },
  async addEmail() {
    const e = await this.otp(this.email(), 'verify', '📧 Add / Change My E-mail'); if (!e) return;
    S.settings.deskEm = e; await DB.set('settings', S.settings); localStorage.setItem('sud-em', JSON.stringify({ em: e, ok: 1 }));
    UI.toast('✔ E-mail confirmed – you can reset your password with it'); this.account();
  },
  newPw(title) {
    return new Promise(res => {
      const b = UI.modal(title || '🔑 Choose A New Password', '<div class="map-grid" style="grid-template-columns:1fr"><div class="f"><label>New Password (at least 6)</label><input type="password" id="dkN1"></div><div class="f"><label>Again</label><input type="password" id="dkN2"></div></div><div class="err" id="dkFe"></div>',
        [{ label: 'Cancel', onClick: () => { UI.closeModal(); res(null); } }, { label: 'Save New Password', cls: 'primary', onClick: async () => {
          const n1 = $('#dkN1', b).value; if (n1.length < 6) return $('#dkFe', b).textContent = 'At least 6 characters'; if (n1 !== $('#dkN2', b).value) return $('#dkFe', b).textContent = 'The two passwords are not the same';
          await this.setPw(n1); UI.closeModal(); res(1);
        } }]);
    });
  },
  pwDone() { try { window.LoginLock && window.LoginLock.ok(); } catch (e) { } UI.toast('✔ New password saved – log in now', 6000); this.note(); $('#lgErr').textContent = ''; $('#lgPass').value = ''; $('#lgPass').focus(); },
  async forgot() {
    const em = this.email(), p = this.lic();
    const b = UI.modal('🔑 Forgot Password?', `<div class="dk-fg">
      <button class="btn primary" id="dkFgE" ${em ? '' : 'disabled'}>📧 Reset By E-mail</button><div class="small muted">${em ? 'A code goes to ' + esc(this.maskEm(em)) + ' (needs internet). You do it yourself.' : 'No e-mail on this computer yet – add one later in My Licence.'}</div>
      <button class="btn" id="dkFgT">🤝 Connect To SudarshanAshtra Team</button><div class="small muted">Your request goes to the SudarshanAshtra Super Admin, who sends you a one-time reset code.</div>
      <button class="btn" id="dkFgC">🔓 I Have A Reset Code</button><div class="small muted">Paste the code from the Super Admin and choose a new password.</div>
      <div class="err" id="dkFgX"></div></div>`, [{ label: 'Close', onClick: UI.closeModal }]);
    $('#dkFgE', b).onclick = async () => { if (!await this.otp(em, 'reset', '📧 Reset By E-mail')) return; if (await this.newPw()) this.pwDone(); };
    $('#dkFgT', b).onclick = async () => {
      const x = $('#dkFgX', b); x.textContent = '⏳ Sending your request…';
      try { await this.gs({ fn: 'lreq', type: 'reset', lid: p.lid, r: { mid: window.SudDesk.mid, n: p.n, rk: p.rk, ps: p.ps, dist: p.dist, st: p.st, mob: p.mob, em }, build: window.SudDesk.build }); x.innerHTML = '<span class="good">✔ Request sent to the SudarshanAshtra team. When you get the reset code, press “I Have A Reset Code”.</span>'; }
      catch (e) { const t = `SudarshanAshtra – password reset request\nName: ${[p.rk, p.n].filter(Boolean).join(' ')}\nLicence ID: ${p.lid}\nMachine ID: ${window.SudDesk.mid}`; x.innerHTML = `❌ ${esc(e.message)}<br><span class="small">Send this by WhatsApp instead:</span><textarea readonly rows="4" style="width:100%">${esc(t)}</textarea>`; }
    };
    $('#dkFgC', b).onclick = () => {
      const c = UI.modal('🔓 I Have A Reset Code', '<p class="small">Paste the reset code from the SudarshanAshtra Super Admin.</p><textarea id="dkRc" rows="3" class="mono" style="width:100%"></textarea><div class="err" id="dkRe"></div>',
        [{ label: 'Cancel', onClick: UI.closeModal }, { label: 'Next', cls: 'primary', onClick: async () => {
          const o = ExeLic.verifyReset($('#dkRc', c).value, p.lid, window.SudDesk.mid); if (typeof o === 'string') return $('#dkRe', c).textContent = o;
          let used = []; try { used = JSON.parse(localStorage.getItem('sud-rst') || '[]'); } catch (e) { } if (used.includes(o.n)) return $('#dkRe', c).textContent = 'This reset code was already used – ask for a new one';
          if (!await this.newPw()) return; used.push(o.n); localStorage.setItem('sud-rst', JSON.stringify(used.slice(-50))); this.pwDone();
        } }]);
    };
  },
  /* ---------- My Licence ---------- */
  account() {
    const p = this.lic(), D = window.SudDesk, l = this.left(), H = new Set(p.hide || []), tr = Plans.tree();
    const shown = tr.filter(s => !H.has('S:' + s.k)).map(s => esc(s.name)).join(' · ');
    UI.modal('🖥 My Licence', `<div class="ua-head"><span class="ua-av">${esc((p.n || '?').slice(0, 1).toUpperCase())}</span><div><b>${esc([p.rk, p.n].filter(Boolean).join(' '))}</b><div class="small muted">${esc([p.ps, p.dist, p.st].filter(Boolean).join(', '))}</div></div><span class="spacer"></span>${Plans.badge(p.tier)}</div>
      <table class="tbl ad-kv" style="margin-top:10px"><tr><th>Licence ID</th><td class="mono"><b>${esc(p.lid)}</b> · issue #${p.seq}</td></tr><tr><th>Valid</th><td>${ExeLic.dmy(p.from)} → <b>${ExeLic.dmy(p.to)}</b> · <b>${l} day${l === 1 ? '' : 's'} left</b></td></tr>
      <tr><th>E-mail</th><td>${this.email() ? esc(this.email()) : '<span class="muted">— (add one for password reset)</span>'}</td></tr><tr><th>This Computer</th><td class="mono">${esc(D.mid)}</td></tr><tr><th>Last Online Check</th><td>${D.state && D.state.chk ? Users.dt(D.state.chk) : '— (works offline)'}</td></tr><tr><th>Version</th><td>build ${esc(D.build || '?')} · setup ${esc(D.shell || '?')}</td></tr><tr><th>Sections</th><td class="small">${shown || '—'}</td></tr></table>
      <p class="small muted" style="margin-top:10px">Your case data stays only on this computer. To extend the licence, change category or move to a new computer, contact the SudarshanAshtra Super Admin.</p>`,
      [{ label: '🔄 Check Licence Online', onClick: async () => { UI.toast('⏳ Checking…'); const r = await D.checkOnline(); UI.toast(r.msg || (r.ok ? '✔ Licence is fine' : 'Could not check'), 6000); if (r.reload) location.reload(); } },
        { label: '🔑 Enter New Licence Key', onClick: () => this.newKey() }, { label: '🔑 Change My Password', onClick: () => this.chPw() }, { label: '📧 E-mail', onClick: () => this.addEmail() }, { label: 'Close', onClick: UI.closeModal }]);
  },
  newKey() {
    const b = UI.modal('🔑 Enter New Licence Key', '<p class="small">Paste the new key from the Super Admin, or load the .lic file.</p><textarea id="dkNk" rows="4" class="mono" style="width:100%"></textarea><label class="btn sm" style="cursor:pointer;margin-top:6px">📂 Load .lic File<input type="file" id="dkNf" accept=".lic,.txt" hidden></label><div class="err" id="dkNe"></div>',
      [{ label: 'Cancel', onClick: UI.closeModal }, { label: 'Activate', cls: 'primary', onClick: async () => { const r = await window.SudDesk.setLicence($('#dkNk', b).value); if (!r.ok) return $('#dkNe', b).textContent = r.err; UI.toast('✔ New licence active'); setTimeout(() => location.reload(), 600); } }]);
    $('#dkNf', b).onchange = async e => { const f = e.target.files[0]; if (f) $('#dkNk', b).value = await f.text(); };
  },
  chPw() {
    const b = UI.modal('🔑 Change My Password', '<div class="map-grid" style="grid-template-columns:1fr"><div class="f"><label>Old Password</label><input type="password" id="dkO"></div><div class="f"><label>New Password (at least 6)</label><input type="password" id="dkP1"></div><div class="f"><label>Again</label><input type="password" id="dkP2"></div></div><div class="err" id="dkPe"></div>',
      [{ label: 'Cancel', onClick: UI.closeModal }, { label: 'Save', cls: 'primary', onClick: async () => { const e = t => { $('#dkPe', b).textContent = t; }, n = $('#dkP1', b).value;
        if (hashPass($('#dkO', b).value, S.settings.salt) !== S.settings.hash) return e('Old password is not right'); if (n.length < 6) return e('At least 6 characters'); if (n !== $('#dkP2', b).value) return e('Not the same');
        await this.setPw(n); Sess.save(); UI.closeModal(); UI.toast('✔ Password changed'); } }]);
  },
  /* ---------- ⬆ Update ---------- */
  async update() {
    const D = window.SudDesk; UI.modal('⬆ Update SudarshanAshtra', '<p>⏳ Checking for a newer version… (needs internet)</p>', [{ label: 'Close', onClick: UI.closeModal }]);
    let r; try { r = await D.checkUpdate(); } catch (e) { r = { err: e.message }; }
    if (r.err) return UI.modal('⬆ Update SudarshanAshtra', `<p>❌ ${esc(r.err)}</p><p class="small muted">Connect to the internet and press Update again. Your work is not affected.</p>`, [{ label: 'Close', onClick: UI.closeModal }]);
    const shell = r.shellNew ? `<div class="note warn" style="margin-top:8px">A new <b>setup</b> (${esc(r.shellNew)}) is also available. <a href="#" id="dkSh">Download it</a> and install it over the old one – your data stays.</div>` : '';
    if (!r.newer) { UI.modal('⬆ Update SudarshanAshtra', `<p>✅ You have the latest version (build ${esc(r.cur)}).</p>${shell}`, [{ label: 'Close', onClick: UI.closeModal }]); }
    else {
      const b = UI.modal('⬆ Update Available', `<p>New version: <b>build ${esc(r.latest)}</b><br>You have: build ${esc(r.cur)}</p><p class="small muted">About ${r.mb || 14} MB is downloaded. Your cases and data stay as they are. The tool restarts after the update.</p><div id="dkPr" class="small"></div>${shell}`,
        [{ label: 'Later', onClick: UI.closeModal }, { label: '⬇ Download & Install Now', cls: 'primary', onClick: async () => {
          if (S.caseId && !isScope(S.caseId) && S.data) await DB.set('case:' + S.caseId, S.data);
          $('#dkPr', b).textContent = '⏳ Downloading…'; $$('#mdFoot button').forEach(x => { x.disabled = true; });
          const x = await D.applyUpdate(); if (!x.ok) { $('#dkPr', b).textContent = '❌ ' + x.err; $$('#mdFoot button').forEach(y => { y.disabled = false; }); return; }
          if (!r.shellNew) localStorage.removeItem(this.UPD_K); $('#dkPr', b).textContent = '✅ Updated – restarting…'; setTimeout(() => location.reload(), 800);
        } }]);
    }
    const sh = $('#dkSh'); if (sh) sh.onclick = e => { e.preventDefault(); D.open(r.shellUrl); };
  },
  /* ---------- new version: 3 days to update, then logged out and login only after the update ---------- */
  UPD_K: 'sud-upd', GRACE: 3 * 864e5,
  pend() {   // { since, kind } while a newer version is waiting for THIS build / setup
    let s; try { s = JSON.parse(localStorage.getItem(this.UPD_K) || 'null'); } catch (e) { s = null; }
    const D = window.SudDesk; if (!s || !s.since || s.cur !== D.build || s.shellCur !== D.shell) return null; return s;
  },
  dueAt() { const s = this.pend(); return s ? s.since + this.GRACE : 0; },
  overdue() { const d = this.dueAt(); return !!d && Date.now() >= d; },
  daysLeftUpd() { const d = this.dueAt(); return d ? Math.max(0, Math.ceil((d - Date.now()) / 864e5)) : 0; },
  dueTxt() { const d = this.dueAt(); return d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; },
  async chkUpd() {   // online check; offline keeps the last state (the 3 days keep running)
    const D = window.SudDesk; let r; try { r = await D.checkUpdate(); } catch (e) { return; } if (!r || r.err) return;
    this._upd = r;
    if (r.newer || r.shellNew) {
      const old = this.pend();
      localStorage.setItem(this.UPD_K, JSON.stringify({ since: old ? old.since : Date.now(), cur: D.build, shellCur: D.shell, v: r.newer ? r.latest : '', shell: r.shellNew || '', url: r.shellUrl || '' }));
    } else localStorage.removeItem(this.UPD_K);
    this.updBtn();
  },
  updBtn() {
    const u = $('#dkUpd'); if (!u) return; const p = this.pend();
    u.classList.toggle('dk-new', !!p); u.classList.toggle('dk-blink', !!p);
    u.textContent = p ? '⬆ Update Now' : '⬆ Update';
    u.title = p ? `A new version is ready – update by ${this.dueTxt()}` : 'Check for a newer SudarshanAshtra and install it';
  },
  async enforce(atStart) {
    const p = this.pend(); if (!p || $('#app').classList.contains('hidden')) return;
    if (this.overdue()) {
      if (S.caseId && !isScope(S.caseId) && S.data) { try { await DB.set('case:' + S.caseId, S.data); } catch (e) { } }
      lock(); setTimeout(() => this.note(), 80); return;
    }
    if (atStart || !this._flashed) {
      this._flashed = 1; const n = this.daysLeftUpd();
      UI.modal('🆕 New Version Of SudarshanAshtra', `<div class="dk-flash"><p><b>A new version is ready.</b> Please update now – it takes about a minute and your cases stay as they are.</p>
        <p>You have <b>${n} day${n === 1 ? '' : 's'}</b> left to update (by <b>${esc(this.dueTxt())}</b>). After that you will be logged out and can log in again only after updating.</p></div>`,
        [{ label: 'Later', onClick: UI.closeModal }, { label: '⬆ Update Now', cls: 'primary', onClick: () => { UI.closeModal(); this.update(); } }]);
    }
  },
  /* the login screen after the 3 days: update first, then log in */
  blockNote() {
    const f = $('#lgFirst'), p = this.pend(); if (!f || !p || !this.overdue()) return;
    f.insertAdjacentHTML('beforeend', `<div class="dk-must"><b>⬆ Update first.</b> A new version of SudarshanAshtra came out and the 3 days to update are over. Update to the latest version, then log in.<div id="dkMsg" class="small" style="margin-top:6px"></div><button type="button" class="btn sm primary" id="dkMust" style="margin-top:6px">⬆ Update Now</button></div>`);
    $('#dkMust').onclick = () => this.mustUpdate();
  },
  async mustUpdate() {
    const D = window.SudDesk, m = $('#dkMsg'), b = $('#dkMust'), say = t => { if (m) m.textContent = t; };
    b.disabled = true; say('⏳ Checking for the new version… (needs internet)');
    await this.chkUpd(); const r = this._upd, p = this.pend();
    if (!r) { b.disabled = false; return say('❌ No internet – connect and press Update Now again.'); }
    if (!p) { say('✔ You already have the latest version – log in now.'); setTimeout(() => location.reload(), 900); return; }
    if (r.newer) {
      say('⏳ Downloading the new version…'); const x = await D.applyUpdate();
      if (!x.ok) { b.disabled = false; return say('❌ ' + x.err); }
      if (!r.shellNew) { localStorage.removeItem(this.UPD_K); say('✅ Updated – restarting…'); setTimeout(() => location.reload(), 800); return; }
    }
    b.disabled = false; say('A new setup is needed: download it, install it over the old one (your data stays), then open SudarshanAshtra again.');
    D.open(r.shellUrl || p.url);
  },
  async bg() {   // online check after start and every 30 minutes: blink the Update button, flash, log out after 3 days
    await this.chkUpd(); this.enforce(false);
    try { const r = await window.SudDesk.checkOnline(); if (r && r.reload) { UI.toast('🔄 ' + (r.msg || 'The Super Admin changed your licence') + ' – reloading…', 5000); if (S.caseId && !isScope(S.caseId) && S.data) await DB.set('case:' + S.caseId, S.data); setTimeout(() => location.reload(), 2500); } } catch (e) { }
  }

};

/* ---------- wiring (EXE only) ---------- */
(() => {
  if (!Desk.on) return;
  document.documentElement.classList.add('ed-desk');
  document.title = 'SudarshanAshtra Desktop';
  Users.link = function () { if (!S.settings) return null; S.settings.link = Desk.link(); return S.settings.link; };
  Users.tick = async () => { };
  Users.note = () => Desk.note();
  Users.onSubmit = e => Desk.onSubmit(e);
  Users.account = () => Desk.account();
  Users.ownPw = () => Desk.chPw();
  if (typeof Recovery !== 'undefined') Recovery._reminded = true;   // no Settings in the EXE – the licence key resets the password
  Plans.timer = () => Desk.chip();
  const os = start; start = async function () { Users.link(); Role.apply(); Plans.apply(); const r = await os.apply(this, arguments); Desk.chip(); Desk.enforce(true); if (!Desk._bg) { Desk._bg = 1; setTimeout(() => Desk.bg(), 8000); setInterval(() => Desk.bg(), 30 * 60e3); } const l = Desk.left(); if (l <= 10) setTimeout(() => UI.toast(`⚠ Your licence ends in ${l} day${l === 1 ? '' : 's'} (${ExeLic.dmy(Desk.lic().to)}). Ask the SudarshanAshtra Super Admin to extend it.`, 9000), 2500); return r; };
  const ra = Role.apply.bind(Role); Role.apply = function () { if (S.settings) Users.link(); const r = ra(); const b = $('#roleBadge'); if (b && Desk.lic()) { b.textContent = '👤 ' + (Desk.lic().n || 'User'); b.title = 'My licence'; } return r; };
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#lgForgot')) { e.preventDefault(); e.stopImmediatePropagation(); Desk.forgot(); } }, true);
})();
