/* users.js – Super Admin control of every user's login (through the Super Admin's own Google Sheet script, Live Data Form).
   Only User ID, name, posting, status, rights and a scrambled password go online. Case data never leaves the computer.
   Super Admin link: Super Admin Control page (Pages.sadmin). User link: online login check, live status check, My Account. */
'use strict';
const Users = {
  USER_URL: 'https://cybercoplea.github.io/SudarshanAshtra/User.html',
  ADMIN_URL: 'https://cybercoplea.github.io/SudarshanAshtra/Sudarshanastra.html',
  SERVER: '',         // Super Admin's login server (Google script Web app URL); when set, users only need User ID + password
  GRACE: 3 * 864e5,   // users may log in offline for 3 days after the last online check
  link() { if (!S.settings) return null; if (!S.settings.link && this.SERVER && SUD_ED === 'user') S.settings.link = { url: this.SERVER }; return S.settings.link || null; },
  dt(x) { return x ? new Date(x).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; },
  async post(url, body) {
    let r; try { r = await fetch(url, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' }); } catch (e) { const x = new Error('No internet – could not reach the Super Admin'); x.net = 1; throw x; }
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { throw new Error('The Super Admin server did not answer properly. Try again in a minute.'); }
    if (!j.ok) throw new Error(j.err || 'Not done'); return j.r;
  },
  async live() { const L = typeof Off !== 'undefined' ? await Off.live() : {}; return L; },
  async admin(op, x) {
    const L = await this.live(); if (!L.url || !L.key) throw new Error('Connect your Google Sheet first (Office Work › Crime Data › 🔴 Live Data Form by Police)');
    const r = await this.post(L.url, Object.assign({ fn: 'uadmin', key: L.key, op }, x || {}));
    if (r.ver && r.ver !== L.ver) { L.ver = r.ver; await Off.liveSave(); }
    return r;
  },
  /* join code / link: carries the script address and the User ID, nothing secret */
  code(u, i) { return 'SA1.' + btoa(unescape(encodeURIComponent(JSON.stringify({ u, i })))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); },
  parse(c) {
    const m = String(c || '').match(/SA1\.([A-Za-z0-9_-]+)/); if (!m) return null;
    try { const b = m[1].replace(/-/g, '+').replace(/_/g, '/'); const o = JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))); return /^https:\/\/script\.google(usercontent)?\.com\//.test(o.u) ? o : null; } catch (e) { return null; }
  },
  joinUrl(u, i) { return this.USER_URL + '#join=' + this.code(u, i); },
  pwGen() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', v = crypto.getRandomValues(new Uint8Array(8)); return 'Sa@' + [...v].map(x => A[x % A.length]).join(''); },
  async useJoin(o) {
    if (!o || !S.settings) return false; const L = this.link();
    if (L && L.url === o.u && L.id === o.i) return true;
    S.settings.link = { url: o.u, id: o.i, joined: new Date().toISOString() }; await DB.set('settings', S.settings); return true;
  },

  /* ---------- login screen ---------- */
  note() {
    const f = $('#lgFirst'), fg = $('#lgForgot'); if (!f || !S.settings) return;
    if (SUD_ED === 'admin') {
      if (Role.admin()) return;
      f.innerHTML = `<span class="lg-sa">🔒 <b>This link is for the Super Admin only.</b><br>Users: open the <b>User link</b> sent by the Super Admin.</span>
        <span class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><label class="btn sm" style="cursor:pointer">🔑 Load Super Admin Key File<input type="file" id="lgSaFile" accept=".txt,.key,text/plain" hidden></label></span>`;
      $('#lgSaFile').onchange = async e => { const x = e.target.files[0]; if (!x) return; if (Role.take(await x.text())) { UI.toast('👑 Super Admin key loaded – log in now'); f.innerHTML = S.settings.mustChange ? 'First time? Default User ID <b>admin</b>, password <b>admin@123</b>. You will be asked to change it.' : ''; } else $('#lgErr').textContent = 'This is not the Super Admin key'; };
      return;
    }
    if (fg) fg.parentNode.classList.add('hidden');
    const lb = $('label[for="lgUser"]'); if (lb) lb.textContent = 'User ID';
    const L = this.link();
    f.innerHTML = `<span class="lg-sa">👤 Log in with the <b>User ID</b> and <b>password</b> given by the Super Admin (Vijay Tomar).</span>
      <span class="small muted" style="display:block;margin-top:6px">Forgot your password? Ask the Super Admin to reset it.</span>
      ${L && L.url ? '' : `<a href="#" id="lgJoinT" class="small" style="display:block;margin-top:8px;color:var(--accent)">First time on this computer and login does not work? ›</a>
      <span id="lgJoinB" class="hidden" style="display:block;margin-top:6px"><span class="small">Open the personal link the Super Admin sent you once – or paste that link here:</span>
      <span class="row" style="gap:6px;margin-top:4px"><input id="lgJoin" placeholder="Paste the link from the Super Admin" style="flex:1"><button class="btn sm primary" type="button" id="lgJoinGo">OK</button></span></span>`}`;
    if ($('#lgJoinT')) $('#lgJoinT').onclick = e => { e.preventDefault(); $('#lgJoinB').classList.remove('hidden'); $('#lgJoin').focus(); };
    if ($('#lgJoinGo')) $('#lgJoinGo').onclick = async () => { const o = this.parse($('#lgJoin').value); if (!o) { $('#lgErr').textContent = 'This is not the link from the Super Admin. Ask him to send it again.'; return; } await this.useJoin(o); $('#lgUser').value = o.i; $('#lgErr').textContent = ''; this.note(); $('#lgPass').focus(); };
    if (L && L.id && !$('#lgUser').value) $('#lgUser').value = L.id;
  },
  async onSubmit(e) {
    if (e.target.id !== 'loginForm' || this._pass) return;
    if (SUD_ED === 'admin') { if (Role.admin()) return; e.preventDefault(); e.stopImmediatePropagation(); $('#lgErr').textContent = 'This link is for the Super Admin only. Users must open their own User link.'; return; }
    e.preventDefault(); e.stopImmediatePropagation();
    const err = t => { $('#lgErr').textContent = t; }, L = this.link(), id = $('#lgUser').value.trim(), pw = $('#lgPass').value, btn = $('#loginForm button');
    if (!L || !L.url) { if ($('#lgJoinB')) $('#lgJoinB').classList.remove('hidden'); return err('This computer is not connected to the Super Admin yet. Open the personal link he sent you once, then log in with your User ID and password.'); }
    err('⏳ Checking your account with the Super Admin…'); btn.disabled = true;
    let r; try { r = await this.post(L.url, { fn: 'ulogin', id, pw, dev: (navigator.userAgent || '').slice(0, 110) }); }
    catch (x) {
      btn.disabled = false;
      if (x.net && L.id && L.id.toLowerCase() === id.toLowerCase() && L.status === 'Active' && L.okAt && Date.now() - L.okAt < this.GRACE) { err(''); this.pass(); UI.toast('Offline login – your account will be checked when the internet is back', 6000); return; }
      return err(x.net ? 'Internet is needed to check your account (last checked ' + this.dt(L.okAt) + '). Connect and try again.' : x.message);
    }
    btn.disabled = false;
    if (r.off) { L.status = 'Off'; await DB.set('settings', S.settings); return err('⛔ Your access has been switched off by the Super Admin' + (r.at ? ' on ' + this.dt(r.at) : '') + '. Contact Vijay Tomar.'); }
    if (Vault.on() && !Vault.key && !(await Vault.unlock(pw))) {
      const old = await this.askOld(); if (!old) return err('Your password was reset, so enter your old password once to open the case data kept on this computer.');
      await Vault.rewrap(pw);
    }
    Object.assign(L, { id: r.user.id, tok: r.tok, name: r.user.name, rank: r.user.rank, ps: r.user.ps, rights: r.user.rights, status: 'Active', okAt: Date.now(), lastLogin: new Date().toISOString() });
    Object.assign(S.settings, { user: r.user.id, salt: uid(), mustChange: false }); S.settings.hash = hashPass(pw, S.settings.salt); await DB.set('settings', S.settings);
    $('#lgUser').value = r.user.id; err(''); Role.apply(); this.pass();
    if (r.temp) setTimeout(() => this.ownPw(pw, true), 900);
  },
  pass() { this._pass = 1; try { $('#loginForm').requestSubmit(); } finally { this._pass = 0; } },
  askOld() {
    return new Promise(res => {
      const b = UI.modal('🔑 Open Your Case Data', `<p class="small">Your case data on this computer is locked with your <b>old</b> password. Enter the old password (or your recovery key) once. It is then moved to your new password.</p><input type="password" id="uoPw" placeholder="Old password or recovery key"><div class="err" id="uoErr"></div>`,
        [{ label: 'Cancel', onClick: () => { UI.closeModal(); res(false); } }, { label: 'Open', cls: 'primary', onClick: async () => { const v = $('#uoPw', b).value; if (await Vault.unlock(v) || await Vault.fromRec(v)) { UI.closeModal(); res(true); } else $('#uoErr', b).textContent = 'Not right – try again'; } }]);
    });
  },

  /* ---------- user side: live status, my account ---------- */
  async out(msg) { const L = this.link(); if (L) { L.tok = ''; await DB.set('settings', S.settings); } lock(); setTimeout(() => { $('#lgErr').textContent = msg; }, 50); },
  async tick() {
    const L = this.link(); if (SUD_ED !== 'user' || !L || !L.tok || $('#app').classList.contains('hidden') || this._tb) return;
    this._tb = 1;
    try {
      const r = await this.post(L.url, { fn: 'ustat', id: L.id, tok: L.tok });
      if (r.off) { L.status = 'Off'; return this.out('⛔ Your access has been switched off by the Super Admin' + (r.at ? ' on ' + this.dt(r.at) : '') + '. Contact Vijay Tomar.'); }
      if (r.kicked) return this.out('Your login was reset by the Super Admin or used on another computer. Please log in again.');
      if (r.gone) { L.url = L.url; return this.out('Your User ID was changed or removed by the Super Admin. Ask Vijay Tomar for your new login.'); }
      const u = r.user, ch = u.rights !== L.rights;
      Object.assign(L, { id: u.id, name: u.name, rank: u.rank, ps: u.ps, rights: u.rights, status: u.status, okAt: Date.now() }); await DB.set('settings', S.settings);
      if (ch) { Role.apply(); render(); UI.toast('🛡 The Super Admin changed your rights', 5000); }
    } catch (e) { } finally { this._tb = 0; }
  },
  account() {
    const L = this.link() || {}, R = Role.rights();
    const b = UI.modal('👤 My Account', `<div class="ua-head"><span class="ua-av">${esc((L.name || L.id || '?').slice(0, 1).toUpperCase())}</span><div><b>${esc([L.rank, L.name].filter(Boolean).join(' ') || L.id || 'User')}</b><div class="small muted">${esc(L.ps || '')}</div></div><span class="spacer"></span><span class="badge ${L.status === 'Off' ? 'bad' : 'good'}">${L.status === 'Off' ? '⛔ Switched Off' : '✅ Active'}</span></div>
      <table class="tbl ad-kv" style="margin-top:10px"><tr><th>User ID</th><td><b>${esc(L.id || '—')}</b></td></tr><tr><th>Last Login</th><td>${this.dt(L.lastLogin)}</td></tr><tr><th>Last Checked With Super Admin</th><td>${this.dt(L.okAt)}</td></tr></table>
      <h4 style="margin:14px 0 6px">🛡 My Rights</h4><div class="ua-rights">${Role.RIGHTS.map(([k, t, d]) => `<div class="ua-r ${R.includes(k) ? 'on' : ''}"><span>${R.includes(k) ? '✅' : '🚫'}</span><div><b>${esc(t)}</b><small>${esc(d)}</small></div></div>`).join('')}</div>
      <p class="small muted" style="margin-top:10px">Rights, User ID and password resets are given by the Super Admin (Vijay Tomar). Your case data stays on this computer; only your login is checked online.</p>`,
      [{ label: '🔑 Change My Password', cls: 'primary', onClick: () => this.ownPw('', false) }, { label: '🔄 Check Now', onClick: async () => { await this.tick(); if (!$('#app').classList.contains('hidden')) this.account(); } }, { label: 'Close', onClick: UI.closeModal }]);
    return b;
  },
  ownPw(old, must) {
    const L = this.link(); if (!L || !L.tok) return UI.toast('Log in again first');
    const b = UI.modal(must ? '🔑 Set Your Own Password' : '🔑 Change My Password', `${must ? '<div class="note warn">The Super Admin gave you a <b>temporary password</b>. Set your own password now – only you will know it.</div>' : ''}
      <div class="map-grid" style="grid-template-columns:1fr;margin-top:10px">${old ? '' : '<div class="f"><label>Old Password</label><input type="password" id="opOld"></div>'}<div class="f"><label>New Password (at least 6 characters)</label><input type="password" id="opN1"></div><div class="f"><label>New Password Again</label><input type="password" id="opN2"></div></div><div class="err" id="opErr"></div>`,
      [...(must ? [] : [{ label: 'Cancel', onClick: UI.closeModal }]), { label: 'Save Password', cls: 'primary', onClick: async () => {
        const o = old || $('#opOld', b).value, n1 = $('#opN1', b).value, n2 = $('#opN2', b).value, e = $('#opErr', b);
        if (n1.length < 6) return e.textContent = 'At least 6 characters'; if (n1 !== n2) return e.textContent = 'The two passwords are not the same';
        e.textContent = '⏳ Saving…';
        try { await this.post(L.url, { fn: 'upw', id: L.id, tok: L.tok, old: o, pw: n1 }); } catch (x) { e.textContent = x.message; return; }
        S.settings.salt = uid(); S.settings.hash = hashPass(n1, S.settings.salt); if (Vault.on() && Vault.key) await Vault.rewrap(n1); await DB.set('settings', S.settings); Sess.save();
        UI.closeModal(); UI.toast('✔ Your new password is saved');
      } }]);
    if (must) { const x = $('#modal .md-x, #modal [data-close]'); if (x) x.classList.add('hidden'); }
  }
};

/* ---------- Super Admin Control page ---------- */
PAGE_META.sadmin = { group: 'Super Admin', title: 'Super Admin Control', desc: 'Every user’s login, rights and access in one place – add, switch on / off, reset password, change User ID, rights and the full activity log.', order: [] };
Pages.sadmin = main => {
  if (!Role.admin()) { main.innerHTML = '<div class="card" style="margin:20px">🔒 Super Admin only.</div>'; return; }
  const st = Users._st || (Users._st = { tab: 'users', q: '', f: '' });
  main.innerHTML = `<div class="hero-card sa-hero"><div class="sa-crown">👑</div><div class="grow"><div class="db-lbl">Super Admin</div><h2>Super Admin Control</h2><div class="sub2">Vijay Tomar · give each user a login, choose their rights, switch access on or off, reset passwords – every change is kept with date &amp; time.</div></div>
      <div class="sa-links"><div class="small muted">🔗 User link (send to users)</div><code>${esc(Users.USER_URL)}</code><div class="small muted" style="margin-top:4px">👑 Your link (Super Admin only)</div><code>${esc(Users.ADMIN_URL)}</code></div></div>
    <div id="saConn"></div><div id="saKpi" class="sa-kpis"></div>
    <div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><div class="seg"><button class="btn sm ${st.tab === 'users' ? 'primary' : ''}" data-tb="users">👥 Users</button><button class="btn sm ${st.tab === 'log' ? 'primary' : ''}" data-tb="log">📜 Activity Log</button><button class="btn sm ${st.tab === 'rights' ? 'primary' : ''}" data-tb="rights">🛡 What Users Can Do</button></div><span class="spacer"></span>
      <button class="btn primary" id="saAdd">➕ Add User</button><button class="btn" id="saRe">🔄 Refresh</button></div><div id="saBody" style="margin-top:12px"><div class="muted">⏳ Reading users from your Google Sheet…</div></div></div>`;
  $$('[data-tb]', main).forEach(b => b.onclick = () => { st.tab = b.dataset.tb; Pages.sadmin(main); });
  $('#saAdd', main).onclick = () => Users.edit(null, () => Pages.sadmin(main));
  $('#saRe', main).onclick = () => { Users._data = null; Pages.sadmin(main); };
  Users.draw(main, st);
};
Object.assign(Users, {
  async draw(main, st) {
    const conn = $('#saConn', main), body = $('#saBody', main), L = await this.live();
    const bad = (t, btn) => { conn.innerHTML = `<div class="note warn sa-conn">${t} ${btn ? '<button class="btn sm primary" id="saLv">🔴 Open Live Data Form Setup</button>' : ''}</div>`; const x = $('#saLv', conn); if (x) x.onclick = () => Off.liveOpen ? Off.liveOpen(() => { }) : go('offx', 'crime'); };
    if (!L.url || !L.key) { bad('<b>Connect your Google Sheet first.</b> User logins are kept in the same Google Sheet as your Live Data Form by Police. Set it up once, then come back here.', 1); body.innerHTML = ''; return; }
    let d = this._data;
    if (!d) { try { d = this._data = await this.admin('list', { log: 1 }); } catch (e) { bad(/Unknown request/.test(e.message) ? '<b>Update your Google script once</b> (new version ' + Off.GSVER + ' adds user control). Open the setup, copy the new script, paste it over the old one in Apps Script and choose Deploy › Manage deployments › Edit › New version. The link stays the same.' : '❌ ' + esc(e.message), 1); body.innerHTML = ''; return; } }
    if ((d.ver || 0) < Off.GSVER) { bad('<b>Update your Google script once</b> – it is version ' + (d.ver || '?') + ', the tool needs ' + Off.GSVER + '.', 1); }
    else conn.innerHTML = `<div class="sa-ok">🟢 Connected to your Google Sheet${L.sheet ? ` · <a href="${esc(L.sheet)}" target="_blank" rel="noopener">open sheet ↗</a>` : ''} · logins checked live · case data never goes online</div>`;
    const U = d.users || [], day = Date.now() - 864e5, temp = u => u.tempAt && !u.ownAt;
    const K = [['👥', 'Total Users', U.length, '#6366f1', ''], ['✅', 'Active', U.filter(u => u.status === 'Active').length, '#16a34a', 'Active'], ['⛔', 'Switched Off', U.filter(u => u.status !== 'Active').length, '#dc2626', 'Off'], ['🟢', 'Seen Last 24 Hours', U.filter(u => u.lastSeen && +new Date(u.lastSeen) > day).length, '#0891b2', 'seen'], ['🟠', 'Temporary Password', U.filter(temp).length, '#d97706', 'temp']];
    $('#saKpi', main).innerHTML = K.map(([i, t, n, c, f]) => `<button class="sa-k ${st.f === f && f ? 'on' : ''}" data-kf="${f}" style="--c:${c}"><span>${i}</span><b>${fmtNum(n)}</b><small>${t}</small></button>`).join('');
    $$('[data-kf]', main).forEach(b => b.onclick = () => { st.f = st.f === b.dataset.kf ? '' : b.dataset.kf; st.tab = 'users'; Pages.sadmin(main); });
    const RN = Object.fromEntries(Role.RIGHTS.map(r => [r[0], r[1]]));
    if (st.tab === 'rights') {
      body.innerHTML = `<p class="small muted">Tick these for each user (➕ Add User or 🛡 Rights). Everything else in the tool – cases, import of own case files, analysis, dashboards, notices – every active user can use. Users have no Settings page.</p><div class="ua-rights">${Role.RIGHTS.map(([k, t, dd, def]) => `<div class="ua-r on"><span>${def ? '✅' : '➖'}</span><div><b>${esc(t)}</b><small>${esc(dd)}${def ? ' · on for new users' : ' · off for new users'}</small></div></div>`).join('')}<div class="ua-r"><span>👑</span><div><b>Super Admin Only</b><small>Settings, Super Admin Control, the Google script, user logins</small></div></div></div>`;
      return;
    }
    if (st.tab === 'log') {
      Table(body, { rows: d.log || [], pageSize: 50, exportName: 'user_activity_log', columns: [{ key: 'at', label: 'Date & Time', render: x => this.dt(x.at), sortVal: x => x.at }, { key: 'id', label: 'User ID', render: x => `<b>${esc(x.id)}</b>` }, { key: 'act', label: 'What Happened', render: x => `<span class="sa-act a-${esc(x.act.split(' ')[0].toLowerCase())}">${esc(x.act)}</span>` }, { key: 'by', label: 'By' }, { key: 'det', label: 'Detail' }] });
      return;
    }
    const rows = U.filter(u => !st.f || (st.f === 'Active' ? u.status === 'Active' : st.f === 'Off' ? u.status !== 'Active' : st.f === 'seen' ? u.lastSeen && +new Date(u.lastSeen) > day : temp(u)));
    if (!U.length) { body.innerHTML = '<div class="sa-empty">No users yet. Press <b>➕ Add User</b> to give the first user a login.</div>'; return; }
    Table(body, { rows, pageSize: 50, exportName: 'users', sortKey: 'id', onRow: u => this.one(u, main), columns: [
      { key: 'id', label: 'User ID', render: u => `<b class="mono">${esc(u.id)}</b>` },
      { key: 'name', label: 'Name', render: u => `<b>${esc([u.rank, u.name].filter(Boolean).join(' '))}</b><div class="small muted">${esc(u.ps)}${u.mobile ? ' · ' + esc(u.mobile) : ''}</div>` },
      { key: 'status', label: 'Status', render: u => u.status === 'Active' ? '<span class="badge good">✅ Active</span>' : '<span class="badge bad">⛔ Off</span>' + `<div class="small muted">${this.dt(u.statusAt)}</div>` },
      { key: 'pw', label: 'Password', sortVal: u => temp(u) ? 0 : 1, render: u => temp(u) ? `<span class="sa-pw t">🟠 Temporary</span><div class="small muted">given ${this.dt(u.tempAt)}</div>` : `<span class="sa-pw o">🟢 Own Password</span><div class="small muted">set ${this.dt(u.ownAt)}</div>` },
      { key: 'rights', label: 'Rights', render: u => `<div class="sa-rc">${String(u.rights || '').split(',').filter(Boolean).map(k => `<i>${esc(RN[k] || k)}</i>`).join('') || '<span class="muted small">Cases only</span>'}</div>` },
      { key: 'lastLogin', label: 'Last Login', render: u => this.dt(u.lastLogin), sortVal: u => u.lastLogin || '' },
      { key: 'lastSeen', label: 'Last Seen', render: u => this.dt(u.lastSeen), sortVal: u => u.lastSeen || '' },
      { key: 'created', label: 'Created', render: u => this.dt(u.created), sortVal: u => u.created || '' },
      { key: 'act', label: 'Actions', nosort: true, noexport: true, render: u => `<div class="sa-acts">${u.status === 'Active' ? `<button class="btn sm" data-ua="off" data-id="${esc(u.id)}" title="Switch Off">⛔</button>` : `<button class="btn sm" data-ua="on" data-id="${esc(u.id)}" title="Switch On">✅</button>`}<button class="btn sm" data-ua="reset" data-id="${esc(u.id)}" title="Reset Password">🔑</button><button class="btn sm" data-ua="rights" data-id="${esc(u.id)}" title="Rights">🛡</button><button class="btn sm" data-ua="more" data-id="${esc(u.id)}" title="More">⋯</button></div>` }],
      after: c => $$('[data-ua]', c).forEach(b => b.onclick = () => { const u = U.find(x => x.id === b.dataset.id); if (u) b.dataset.ua === 'more' ? this.one(u, main) : this.act(b.dataset.ua, u, main); }) });
  },
  redo(main) { this._data = null; Pages.sadmin(main); },
  async run(op, x, main, ok) { try { this._data = Object.assign(await this.admin(op, x), {}); this._data = await this.admin('list', { log: 1 }); UI.toast(ok); Pages.sadmin(main); return true; } catch (e) { UI.toast('❌ ' + e.message, 7000); return false; } },
  one(u, main) {
    const RN = Object.fromEntries(Role.RIGHTS.map(r => [r[0], r[1]])), log = (this._data && this._data.log || []).filter(l => l.id === u.id).slice(0, 15);
    const b = UI.modal('👤 ' + ([u.rank, u.name].filter(Boolean).join(' ') || u.id), `<table class="tbl ad-kv">${[['User ID', `<b class="mono">${esc(u.id)}</b>`], ['Name', esc(u.name)], ['Rank', esc(u.rank)], ['Posting / PS', esc(u.ps)], ['Mobile', esc(u.mobile)], ['Status', u.status === 'Active' ? '✅ Active' : '⛔ Switched Off'], ['Status Changed', this.dt(u.statusAt)], ['Password', u.tempAt && !u.ownAt ? '🟠 Temporary (given ' + this.dt(u.tempAt) + ') – not yet changed by the user' : '🟢 User’s own password (set ' + this.dt(u.ownAt) + ')'], ['Rights', String(u.rights || '').split(',').filter(Boolean).map(k => esc(RN[k] || k)).join(' · ') || 'Cases only'], ['Created', this.dt(u.created)], ['Last Login', this.dt(u.lastLogin)], ['Last Seen', this.dt(u.lastSeen)], ['Note', esc(u.note)]].map(([k, v]) => `<tr><th>${k}</th><td>${v || '—'}</td></tr>`).join('')}</table>
      <div class="sa-acts big">${u.status === 'Active' ? '<button class="btn" data-o="off">⛔ Switch Off</button>' : '<button class="btn" data-o="on">✅ Switch On</button>'}<button class="btn" data-o="reset">🔑 Reset Password</button><button class="btn" data-o="rename">🆔 Change User ID</button><button class="btn" data-o="rights">🛡 Rights</button><button class="btn" data-o="edit">✏ Edit Details</button><button class="btn" data-o="link">🔗 Join Link</button><button class="btn danger" data-o="del">🗑 Remove User</button></div>
      <h4 style="margin:12px 0 4px">📜 Recent Activity</h4>${log.length ? `<table class="tbl">${log.map(l => `<tr><td class="small">${this.dt(l.at)}</td><td>${esc(l.act)}</td><td class="small muted">${esc(l.det)}</td></tr>`).join('')}</table>` : '<div class="small muted">Nothing yet</div>'}`,
      [{ label: 'Close', onClick: UI.closeModal }]);
    $$('[data-o]', b).forEach(x => x.onclick = () => this.act(x.dataset.o, u, main));
  },
  share(u, pw, title) {
    const L = this._liveUrl, link = this.joinUrl(L, u.id);
    const txt = `SudarshanAshtra – your login\nOpen this link (Chrome / Edge): ${link}\nUser ID: ${u.id}${pw ? `\nTemporary password: ${pw}\nYou will be asked to set your own password at the first login.` : ''}\n– Super Admin, Vijay Tomar`;
    const b = UI.modal(title || '🔗 Send This To The User', `${pw ? '<div class="note warn"><b>The password is shown only now.</b> It is kept scrambled – nobody, not even you, can read it later. If it is lost, use 🔑 Reset Password.</div>' : ''}
      <table class="tbl ad-kv" style="margin-top:10px"><tr><th>User Link</th><td><code style="word-break:break-all">${esc(link)}</code></td></tr><tr><th>User ID</th><td><b class="mono" style="font-size:16px">${esc(u.id)}</b></td></tr>${pw ? `<tr><th>Temporary Password</th><td><b class="mono" style="font-size:18px;letter-spacing:1px">${esc(pw)}</b></td></tr>` : ''}</table>
      <p class="small muted">Send it to the user personally (WhatsApp / SMS). The link connects their computer to you; the password lets them in.</p>`,
      [{ label: '📋 Copy All', cls: 'primary', onClick: async () => { try { await navigator.clipboard.writeText(txt); UI.toast('Copied – paste it in WhatsApp / SMS'); } catch (e) { UI.toast('Copy failed – select the text and copy'); } } }, { label: 'Done', onClick: UI.closeModal }]);
    return b;
  },
  pwBox(pw) { return `<div class="f"><label>Temporary Password (the user changes it at first login)</label><div class="row" style="gap:6px"><input id="uePw" value="${esc(pw)}" class="mono"><button class="btn sm" type="button" id="ueGen">🎲 New</button></div></div>`; },
  rightsBox(sel) { return `<div class="f"><label>Rights</label><div class="ua-rights pick">${Role.RIGHTS.map(([k, t, d]) => `<label class="ua-r"><input type="checkbox" data-rt="${k}" ${sel.includes(k) ? 'checked' : ''}><div><b>${esc(t)}</b><small>${esc(d)}</small></div></label>`).join('')}</div></div>`; },
  async act(op, u, main) {
    const L = await this.live(); this._liveUrl = L.url;
    if (op === 'link') return this.share(u, '', '🔗 Join Link For ' + u.id);
    if (op === 'edit') return this.edit(u, () => this.redo(main));
    if (op === 'on' || op === 'off') {
      const b = UI.modal(op === 'off' ? '⛔ Switch Off ' + u.id : '✅ Switch On ' + u.id, `<p>${op === 'off' ? 'The user is logged out within a minute and cannot log in until you switch them on again. Their case data stays on their computer.' : 'The user can log in again.'}</p>${op === 'off' ? '<input id="ueWhy" placeholder="Reason (optional, kept in the log)">' : ''}`,
        [{ label: 'Cancel', onClick: UI.closeModal }, { label: op === 'off' ? '⛔ Switch Off' : '✅ Switch On', cls: op === 'off' ? 'danger' : 'primary', onClick: async () => { const why = $('#ueWhy', b) ? $('#ueWhy', b).value : ''; UI.closeModal(); await this.run(op, { id: u.id, why }, main, op === 'off' ? '⛔ ' + u.id + ' switched off' : '✅ ' + u.id + ' switched on'); } }]);
      return;
    }
    if (op === 'reset') {
      const b = UI.modal('🔑 Reset Password – ' + u.id, `<p class="small">The user's current password stops working at once. Give them this temporary password; they set their own at the next login.</p>${this.pwBox(this.pwGen())}`,
        [{ label: 'Cancel', onClick: UI.closeModal }, { label: '🔑 Reset Password', cls: 'primary', onClick: async () => { const pw = $('#uePw', b).value.trim(); if (pw.length < 6) return UI.toast('At least 6 characters'); UI.closeModal(); if (await this.run('reset', { id: u.id, pw }, main, '🔑 Password reset for ' + u.id)) this.share(u, pw, '🔑 New Temporary Password'); } }]);
      $('#ueGen', b).onclick = () => { $('#uePw', b).value = this.pwGen(); };
      return;
    }
    if (op === 'rename') {
      const b = UI.modal('🆔 Change User ID – ' + u.id, `<div class="f"><label>New User ID (letters, numbers, . _ - @, no spaces)</label><input id="ueNid" value="${esc(u.id)}" class="mono"></div><p class="small muted">The user is logged out and must log in with the new ID (same password).</p>`,
        [{ label: 'Cancel', onClick: UI.closeModal }, { label: 'Change User ID', cls: 'primary', onClick: async () => { const nid = $('#ueNid', b).value.trim(); UI.closeModal(); if (await this.run('rename', { id: u.id, nid }, main, '🆔 User ID changed to ' + nid)) this.share(Object.assign({}, u, { id: nid }), '', '🔗 New User ID – Send To The User'); } }]);
      return;
    }
    if (op === 'rights') {
      const b = UI.modal('🛡 Rights – ' + u.id, this.rightsBox(String(u.rights || '').split(',')) + '<p class="small muted">Changes reach the user within a minute.</p>',
        [{ label: 'Cancel', onClick: UI.closeModal }, { label: 'Save Rights', cls: 'primary', onClick: async () => { const rights = $$('[data-rt]', b).filter(x => x.checked).map(x => x.dataset.rt).join(','); UI.closeModal(); await this.run('rights', { id: u.id, rights }, main, '🛡 Rights saved for ' + u.id); } }]);
      return;
    }
    if (op === 'del') { if (!UI.confirm(`Remove user ${u.id}? They can no longer log in. Their case data stays on their own computer. This cannot be undone (you can add them again).`)) return; UI.closeModal(); await this.run('del', { id: u.id }, main, '🗑 ' + u.id + ' removed'); }
  },
  async edit(u, done) {
    const L = await this.live(); this._liveUrl = L.url; const isNew = !u; u = u || { rights: Role.defRights().join(',') };
    const f = (k, l, ph) => `<div class="f"><label>${l}</label><input id="ue_${k}" value="${esc(u[k] || '')}" placeholder="${ph || ''}" ${k === 'id' && !isNew ? 'disabled' : ''}></div>`;
    const b = UI.modal(isNew ? '➕ Add User' : '✏ Edit ' + u.id, `<div class="map-grid" style="grid-template-columns:1fr 1fr">${f('id', 'User ID', 'e.g. si.ramkumar')}${f('rank', 'Rank', 'SI / HC / Constable…')}${f('name', 'Name')}${f('ps', 'Posting / Police Station')}${f('mobile', 'Mobile')}${f('note', 'Note')}</div>
      ${isNew ? this.pwBox(this.pwGen()) + this.rightsBox(String(u.rights).split(',')) : ''}<div class="err" id="ueErr"></div>`,
      [{ label: 'Cancel', onClick: UI.closeModal }, { label: isNew ? '➕ Add User' : 'Save', cls: 'primary', onClick: async () => {
        const v = k => ($('#ue_' + k, b) || {}).value || '', x = { id: isNew ? v('id').trim() : u.id, name: v('name'), rank: v('rank'), ps: v('ps'), mobile: v('mobile'), note: v('note') }, e = $('#ueErr', b);
        if (isNew) { x.pw = $('#uePw', b).value.trim(); x.rights = $$('[data-rt]', b).filter(c => c.checked).map(c => c.dataset.rt).join(','); if (!/^[A-Za-z0-9._@-]{3,40}$/.test(x.id)) return e.textContent = 'User ID: 3 to 40 letters or numbers, no spaces'; if (x.pw.length < 6) return e.textContent = 'Password: at least 6 characters'; }
        e.textContent = '⏳ Saving…';
        try { await this.admin(isNew ? 'add' : 'edit', x); this._data = await this.admin('list', { log: 1 }); } catch (er) { e.textContent = '❌ ' + er.message; return; }
        UI.closeModal(); done && done(); if (isNew) this.share(x, x.pw, '✅ User Added – Send This To ' + x.id); else UI.toast('Saved');
      } }]);
    if ($('#ueGen', b)) $('#ueGen', b).onclick = () => { $('#uePw', b).value = this.pwGen(); };
  }
});

/* ---------- wiring ---------- */
(() => {
  const m = location.hash.match(/#join=([^&]+)/);
  if (m) { const o = Users.parse(decodeURIComponent(m[1])); if (o) localStorage.setItem('sud-join', JSON.stringify(o)); history.replaceState(null, '', location.pathname + location.search); }
  document.addEventListener('submit', e => { Users.onSubmit(e); }, true);
  document.addEventListener('click', e => { if (SUD_ED === 'user' && e.target.closest && e.target.closest('#lgForgot')) { e.preventDefault(); e.stopImmediatePropagation(); UI.toast('Ask the Super Admin (Vijay Tomar) to reset your password', 6000); } }, true);
  const sl = showLogin; showLogin = function (on = true) { const r = sl.apply(this, arguments); if (on) (async () => { try { const j = JSON.parse(localStorage.getItem('sud-join') || 'null'); if (j && S.settings) { localStorage.removeItem('sud-join'); await Users.useJoin(j); $('#lgUser').value = j.i; } } catch (e) { } Users.note(); })(); return r; };
  const os = start; start = async function () { const r = await os.apply(this, arguments); Role.apply(); return r; };
  if (SUD_ED === 'user') {
    const og = go; go = function (page, sub) { if (page === 'settings' || page === 'sadmin') { Users.account(); return; } return og(page, sub); };
    if (typeof VaultUI !== 'undefined') { VaultUI.offer = () => { }; VaultUI.after = () => { }; }
    setInterval(() => Users.tick(), 60000); setTimeout(() => Users.tick(), 4000);
    document.title = 'SudarshanAshtra – User';
  }
  /* open the join link on an open page too */
  window.addEventListener('hashchange', () => { const m2 = location.hash.match(/#join=([^&]+)/); if (m2 && SUD_ED === 'user') { const o = Users.parse(decodeURIComponent(m2[1])); if (o) { localStorage.setItem('sud-join', JSON.stringify(o)); history.replaceState(null, '', location.pathname + location.search); if ($('#app').classList.contains('hidden')) showLogin(); } } });
})();
