/* role.js – Super Admin (Vijay Tomar) and User.
   Every computer starts as "User". Super Admin opens only on a computer where the private Super Admin key file was loaded once
   (Settings > 👑 Super Admin). Users see Crime Data as view only, and cannot use Office Upload + or any "Edit / reorder this list". */
'use strict';
const Role = {
  H: '756a3d215d19c2172740d792a16f2ec23e7710d7b79ebb3f4365cbf4e4f7010e',
  K: 'sud-sa',
  _a: null,
  admin() { if (this._a === null) { const k = localStorage.getItem(this.K) || ''; this._a = !!k && sha256('SA|' + k) === this.H; } return this._a; },
  take(txt) { const m = String(txt || '').match(/\b[0-9a-f]{64}\b/i); const k = m ? m[0].toLowerCase() : ''; if (!k || sha256('SA|' + k) !== this.H) return false; localStorage.setItem(this.K, k); this._a = true; this.apply(); return true; },
  off() { localStorage.removeItem(this.K); this._a = false; this.apply(); },
  deny(what) { UI.toast('🔒 Only the Super Admin (Vijay Tomar) can ' + (what || 'change this') + '. You can view the data.', 5000); },
  apply() {
    const a = this.admin(); document.documentElement.classList.toggle('role-user', !a); document.documentElement.classList.toggle('role-admin', a);
    let b = $('#roleBadge'); const t = $('#btnTheme');
    if (!b && t) { t.insertAdjacentHTML('beforebegin', '<span id="roleBadge"></span>'); b = $('#roleBadge'); b.onclick = () => go('settings'); }
    if (b) { b.className = a ? 'rb-admin' : 'rb-user'; b.textContent = a ? '👑 Super Admin' : '👤 User'; b.title = a ? 'Super Admin – full access on this computer' : 'User – Crime Data is view only. Click for Settings.'; }
  }
};

/* Crime Data (Office Work): view only for users */
(() => {
  if (typeof Off === 'undefined') return;
  const oc = Off.crime, ADM = ['#cdImpM', '#cdScan', '#cdFile', '#cdAdd', '#cdForm', '#cdFImp', '#cdLive', '#cdCols', '#cdSe', '#cdKe'];
  Off.crime = async function (el) {
    if (!Role.admin()) { try { const v = await Vault.verKey(); if (localStorage.getItem('sud-cdv') !== v) { await this.rescan(true); localStorage.setItem('sud-cdv', v); } } catch (e) { } }
    const r = await oc.call(this, el);
    if (!Role.admin()) { ADM.forEach(s => { const b = $(s, el); if (b) b.remove(); }); const h = $('.cd-bar h3', el); if (h && !$('.cd-ro', el)) h.insertAdjacentHTML('beforeend', ' <span class="cd-ro">👁 View Only</span>'); }
    return r;
  };
  const LBL = [['value', 'Identifier'], ['type', 'Type'], ['name', 'Name / Holder'], ['case', 'Case'], ['fir', 'FIR'], ['year', 'Year'], ['ctype', 'Case Type'], ['pstn', 'Police Station'], ['dist', 'District / Commissionerate'], ['source', 'Found In'], ['istate', 'Identifier State'], ['idist', 'Identifier District'], ['acc', 'Account'], ['ifsc', 'IFSC'], ['ackList', 'Acknowledgement No.'], ['note', 'Note'], ['added', 'Added']];
  const oe = Off.cdEdit;
  Off.cdEdit = function (r, done) {
    if (Role.admin()) return oe.call(this, r, done);
    if (!r) return Role.deny('add entries');
    const val = k => k === 'type' ? (this.ct(r.type) || [])[1] || r.type : k === 'added' && r.added ? new Date(r.added).toLocaleString('en-IN') : r[k];
    UI.modal('👁 Crime Data Entry', `<table class="tbl ad-kv">${LBL.filter(([k]) => r[k]).map(([k, l]) => `<tr><th>${esc(l)}</th><td>${esc(String(val(k)))}</td></tr>`).join('')}</table>`,
      [{ label: '🎯 Track This Everywhere', onClick: () => { UI.closeModal(); typeof Dash2 !== 'undefined' && Dash2.track(r.value); } }, { label: 'Close', onClick: UI.closeModal }]);
  };
  for (const [f, w] of [['formMake', 'make data forms'], ['formImport', 'import form files'], ['liveOpen', 'use the Live Data Form'], ['cdImport', 'import files']]) {
    const o = Off[f]; if (o) Off[f] = function (...a) { return Role.admin() ? o.apply(this, a) : Role.deny(w); };
  }
  const ofp = Off.filesPage; if (ofp) Off.filesPage = function (...a) { return Role.admin() ? ofp.apply(this, a) : (S.sub.offx = 'crime', render()); };
  const po = Pages.offx;
  Pages.offx = main => { if (!Role.admin() && S.sub.offx === 'files') S.sub.offx = 'crime'; po(main); if (!Role.admin()) { const t = $('.tab[data-t="files"]', main); if (t) t.remove(); } };
})();

/* every "Edit / reorder this list" – Super Admin only */
(() => {
  const wrap = (o, f, w) => { if (o && o[f]) { const x = o[f]; o[f] = function (...a) { return Role.admin() ? x.apply(this, a) : Role.deny(w); }; } };
  wrap(typeof EditList !== 'undefined' && EditList, 'edit', 'edit or reorder this list');
  wrap(typeof NavCustom !== 'undefined' && NavCustom, 'edit', 'edit or reorder this list');
  wrap(typeof Formats !== 'undefined' && Formats, 'editList', 'edit or reorder this list');
  wrap(typeof LEA !== 'undefined' && LEA, 'edit', 'edit or reorder this list');
})();

/* Settings card */
(() => {
  const orig = Pages.settings;
  Pages.settings = main => {
    orig(main);
    const a = Role.admin(), card = document.createElement('div'); card.className = 'card'; card.id = 'roleCard';
    card.innerHTML = `<h3>👑 Super Admin</h3>
      <div class="sub">Super Admin (Vijay Tomar) has full access. Every other computer works as <b>User</b>: Crime Data is view only, Office Upload + is hidden and lists cannot be edited or reordered.</div>
      ${a ? `<div class="row"><span class="badge good">Super Admin on this computer</span><span class="spacer"></span><button class="btn" id="saOff" title="This computer becomes User. Load the key file again to come back.">Switch This Computer To User</button></div>`
        : `<div class="row" style="gap:8px;flex-wrap:wrap"><span class="badge">User</span><span class="spacer"></span><label class="btn" style="cursor:pointer">🔑 Load Super Admin Key File<input type="file" id="saFile" accept=".txt,.key,.sakey,text/plain" hidden></label><input type="password" id="saKey" placeholder="or paste the key" style="max-width:260px"><button class="btn primary" id="saGo">Open Super Admin</button><span class="err" id="saErr"></span></div>`}`;
    const v = $('#vaultCard', main) || main.querySelector('.grid'); if (v) v.parentNode.insertBefore(card, v.nextSibling); else main.appendChild(card);
    const ok = t => { if (Role.take(t)) { UI.toast('👑 Super Admin opened on this computer'); render(); } else $('#saErr', card).textContent = 'This is not the Super Admin key'; };
    if (a) $('#saOff', card).onclick = () => { if (!UI.confirm('Switch this computer to User? You need the Super Admin key file to come back.')) return; Role.off(); render(); };
    else { $('#saGo', card).onclick = () => ok($('#saKey', card).value); $('#saFile', card).onchange = async e => { const f = e.target.files[0]; if (f) ok(await f.text()); }; }
  };
})();
Role.apply();
