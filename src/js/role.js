/* role.js – two links, two editions:
   Sudarshanastra.html = Super Admin (Vijay Tomar). It opens only on a computer where the private Super Admin key file was loaded once.
   User.html           = Users. Login is checked online against the Super Admin's Google Sheet (users.js); each user has the rights
                         the Super Admin gave (Role.RIGHTS). Users have no Settings page. */
'use strict';
const Role = {
  H: '756a3d215d19c2172740d792a16f2ec23e7710d7b79ebb3f4365cbf4e4f7010e',
  K: 'sud-sa',
  _a: null,
  RIGHTS: [
    ['crime', '🗃 View Crime Data', 'See Crime Data in Office Work (view only)', 1],
    ['crimeEdit', '✏ Crime Data – Full Use', 'Import, Add Entry, Police Data Forms, Columns', 0],
    ['office', '🏢 Office Work', 'Good Work, Press Note, Duty Chart', 1],
    ['upload', '⬆ Office Upload +', 'Keep office files in Upload +', 0],
    ['lists', '✏ Edit / Reorder Lists', 'Change drop-down lists and menus', 0],
    ['delcase', '🗑 Delete Case Data', 'Remove own cases from own computer', 1],
    ['contacts', '📇 Contacts', 'See and add Contacts – Intermediary, UP Cyber Police', 1]],
  user() { return SUD_ED === 'user'; },
  admin() { if (SUD_ED === 'user') return false; if (this._a === null) { const k = localStorage.getItem(this.K) || ''; this._a = !!k && sha256('SA|' + k) === this.H; } return this._a; },
  take(txt) { const m = String(txt || '').match(/\b[0-9a-f]{64}\b/i); const k = m ? m[0].toLowerCase() : ''; if (!k || sha256('SA|' + k) !== this.H) return false; localStorage.setItem(this.K, k); this._a = true; this.apply(); return true; },
  off() { localStorage.removeItem(this.K); this._a = false; this.apply(); },
  defRights() { return this.RIGHTS.filter(r => r[3]).map(r => r[0]); },
  rights() { const l = S.settings && S.settings.link; return l && l.rights != null ? String(l.rights).split(',').map(s => s.trim()).filter(Boolean) : this.defRights(); },
  can(k) { return this.admin() || this.rights().includes(k); },
  deny(what) { UI.toast('🔒 Only the Super Admin (Vijay Tomar) can ' + (what || 'change this') + '. Ask him if you need it.', 5000); },
  apply() {
    const a = this.admin(), H = document.documentElement; H.classList.toggle('role-user', !a); H.classList.toggle('role-admin', a); H.classList.toggle('ed-user', this.user());
    for (const [k] of this.RIGHTS) H.classList.toggle('no-' + k, !this.can(k));
    let b = $('#roleBadge'); const t = $('#btnTheme');
    if (!b && t) { t.insertAdjacentHTML('beforebegin', '<span id="roleBadge"></span>'); b = $('#roleBadge'); b.onclick = () => Role.admin() ? go('sadmin') : typeof Users !== 'undefined' && Users.account(); }
    const l = S.settings && S.settings.link;
    if (b) { b.className = a ? 'rb-admin' : 'rb-user'; b.textContent = a ? '👑 Super Admin' : '👤 ' + (l && (l.name || l.id) || 'User'); b.title = a ? 'Super Admin Control – users, rights, access' : 'My account – rights, change password'; }
  }
};

/* Crime Data (Office Work): view only without the "crimeEdit" right */
(() => {
  if (typeof Off === 'undefined') return;
  const oc = Off.crime, ADM = ['#cdImpM', '#cdScan', '#cdFile', '#cdAdd', '#cdForm', '#cdFImp', '#cdLive', '#cdCols', '#cdSe', '#cdKe'];
  Off.crime = async function (el) {
    const full = Role.can('crimeEdit');
    if (!full) { try { const v = await Vault.verKey(); if (localStorage.getItem('sud-cdv') !== v) { await this.rescan(true); localStorage.setItem('sud-cdv', v); } } catch (e) { } }
    const r = await oc.call(this, el);
    if (!Role.admin()) { const lv = $('#cdLive', el); if (lv) lv.remove(); }
    if (!full) { ADM.forEach(s => { const b = $(s, el); if (b) b.remove(); }); const h = $('.cd-bar h3', el); if (h && !$('.cd-ro', el)) h.insertAdjacentHTML('beforeend', ' <span class="cd-ro">👁 View Only</span>'); }
    return r;
  };
  const LBL = [['value', 'Identifier'], ['type', 'Type'], ['name', 'Name / Holder'], ['case', 'Case'], ['fir', 'FIR'], ['year', 'Year'], ['ctype', 'Case Type'], ['pstn', 'Police Station'], ['dist', 'District / Commissionerate'], ['source', 'Found In'], ['istate', 'Identifier State'], ['idist', 'Identifier District'], ['acc', 'Account'], ['ifsc', 'IFSC'], ['ackList', 'Acknowledgement No.'], ['note', 'Note'], ['added', 'Added']];
  const oe = Off.cdEdit;
  Off.cdEdit = function (r, done) {
    if (Role.can('crimeEdit')) return oe.call(this, r, done);
    if (!r) return Role.deny('add entries');
    const val = k => k === 'type' ? (this.ct(r.type) || [])[1] || r.type : k === 'added' && r.added ? new Date(r.added).toLocaleString('en-IN') : r[k];
    UI.modal('👁 Crime Data Entry', `<table class="tbl ad-kv">${LBL.filter(([k]) => r[k]).map(([k, l]) => `<tr><th>${esc(l)}</th><td>${esc(String(val(k)))}</td></tr>`).join('')}</table>`,
      [{ label: '🎯 Track This Everywhere', onClick: () => { UI.closeModal(); typeof Dash2 !== 'undefined' && Dash2.track(r.value); } }, { label: 'Close', onClick: UI.closeModal }]);
  };
  for (const [f, w, sa] of [['formMake', 'make data forms'], ['formImport', 'import form files'], ['liveOpen', 'use the Live Data Form', 1], ['cdImport', 'import files']]) {
    const o = Off[f]; if (o) Off[f] = function (...a) { return (sa ? Role.admin() : Role.can('crimeEdit')) ? o.apply(this, a) : Role.deny(w); };
  }
  const TABR = { crime: 'crime', daily: 'crime', eo: 'office', good: 'office', press: 'office', duty: 'office', files: 'upload' };
  const ofp = Off.filesPage; if (ofp) Off.filesPage = function (...a) { return Role.can('upload') ? ofp.apply(this, a) : Role.deny('use Office Upload +'); };
  const po = Pages.offx;
  Pages.offx = main => {
    const ok = Object.keys(TABR).filter(t => Role.can(TABR[t]));
    if (!ok.length) { main.innerHTML = '<div class="card" style="margin:20px"><h3>🔒 Office Work</h3><p class="muted">The Super Admin has not given you Office Work. Ask Vijay Tomar if you need it.</p></div>'; return; }
    if (!ok.includes(S.sub.offx || 'crime')) S.sub.offx = ok[0];
    po(main); Object.keys(TABR).filter(t => !ok.includes(t)).forEach(t => { const x = $(`.tab[data-t="${t}"]`, main); if (x) x.remove(); });
  };
})();

/* every "Edit / reorder this list" and Delete Case Data follow the rights */
(() => {
  const wrap = (o, f, k, w) => { if (o && o[f]) { const x = o[f]; o[f] = function (...a) { return Role.can(k) ? x.apply(this, a) : Role.deny(w); }; } };
  wrap(typeof EditList !== 'undefined' && EditList, 'edit', 'lists', 'edit or reorder this list');
  wrap(typeof NavCustom !== 'undefined' && NavCustom, 'edit', 'lists', 'edit or reorder this list');
  wrap(typeof Formats !== 'undefined' && Formats, 'editList', 'lists', 'edit or reorder this list');
  wrap(typeof LEA !== 'undefined' && LEA, 'edit', 'lists', 'edit or reorder this list');
  wrap(typeof CaseDel !== 'undefined' && CaseDel, 'open', 'delcase', 'delete case data');
})();

/* Settings card (Super Admin link only – users have no Settings) */
(() => {
  const orig = Pages.settings;
  Pages.settings = main => {
    orig(main);
    const a = Role.admin(), card = document.createElement('div'); card.className = 'card'; card.id = 'roleCard';
    card.innerHTML = `<h3>👑 Super Admin</h3>
      <div class="sub">This link is for the Super Admin (Vijay Tomar) only. Users use their own <b>User link</b>, made in Super Admin Control, where you give each user a login, rights and access.</div>
      ${a ? `<div class="row" style="gap:8px;flex-wrap:wrap"><span class="badge good">Super Admin on This Computer</span><span class="spacer"></span><button class="btn primary" id="saCtl">👥 Open Super Admin Control</button></div>`
        : `<div class="row" style="gap:8px;flex-wrap:wrap"><span class="badge">Not Super Admin</span><span class="spacer"></span><label class="btn" style="cursor:pointer">🔑 Load Super Admin Key File<input type="file" id="saFile" accept=".txt,.key,.sakey,text/plain" hidden></label><input type="password" id="saKey" placeholder="or paste the key" style="max-width:260px"><button class="btn primary" id="saGo">Open Super Admin</button><span class="err" id="saErr"></span></div>`}`;
    const v = $('#vaultCard', main) || main.querySelector('.grid'); if (v) v.parentNode.insertBefore(card, v.nextSibling); else main.appendChild(card);
    const ok = t => { if (Role.take(t)) { UI.toast('👑 Super Admin opened on this computer'); render(); } else $('#saErr', card).textContent = 'This is not the Super Admin key'; };
    if (a) { $('#saCtl', card).onclick = () => go('sadmin'); }
    else { $('#saGo', card).onclick = () => ok($('#saKey', card).value); $('#saFile', card).onchange = async e => { const f = e.target.files[0]; if (f) ok(await f.text()); }; }
  };
})();
Role.apply();
