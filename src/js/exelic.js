/* exelic.js – Desktop (EXE) licences, made by the Super Admin in Super Admin Control › 🖥 EXE Users.
   The Windows setup (SudarshanAshtra Desktop) works fully offline. Each user gets a licence key that is
   - locked to one computer (its Machine ID),
   - valid from / to a date (number of days),
   - for one category (Normal / Pro / Premium) with the left-panel sections and sub-sections the Super Admin ticked,
   - signed with a key made from the Super Admin key file, so nobody else can make or change a licence.
   The register of all licences is kept on the Super Admin computer (and in the Google Sheet "EXE Licences" when connected,
   so Suspend / Delete / Extend reach a user's EXE the next time it is online). Case data never goes anywhere. */
'use strict';
const ExeLic = {
  PUB: '2354206a5a6b00597cd19f967725427f1535fd7b83a93370418a28525ec769c9',
  PRE: 'SADL1',
  SETUP_URL: 'https://github.com/CYBERCOPLEA/SudarshanAshtra/releases/latest',
  TIERS: ['normal', 'pro', 'premium'],
  XR: [['lists', '✏ Edit / Reorder Lists'], ['delcase', '🗑 Delete Case Data']],
  /* ---------- small helpers ---------- */
  b64u(bytes) { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  unb64u(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); s += '==='.slice((s.length + 3) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); },
  hex(b) { return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); },
  unhex(h) { return Uint8Array.from(h.match(/../g).map(x => parseInt(x, 16))); },
  utf8: s => new TextEncoder().encode(s),
  dmy(d) { return d ? d.split('-').reverse().join('-') : '—'; },
  addDays(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); },
  daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5); },
  istToday() { return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); },
  left(r) { return this.daysBetween(this.istToday(), r.to) + 1; },
  rid() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', v = crypto.getRandomValues(new Uint8Array(6)); return 'SAL-' + [...v].map(x => A[x % A.length]).join(''); },
  normMid(s) { const m = String(s || '').toUpperCase().match(/SA-([0-9A-Z]{4})-?([0-9A-Z]{4})-?([0-9A-Z]{4})-?([0-9A-Z]{4})/); return m ? `SA-${m[1]}-${m[2]}-${m[3]}-${m[4]}` : ''; },
  /* request code from the EXE activation screen: SUDREQ1.<base64 json {mid,n,rk,ps,dist,st,mob}> */
  parseReq(t) { const m = String(t || '').match(/SUDREQ1\.([A-Za-z0-9_-]+)/); if (!m) return null; try { const o = JSON.parse(new TextDecoder().decode(this.unb64u(m[1]))); o.mid = this.normMid(o.mid); return o.mid ? o : null; } catch (e) { return null; } },
  /* ---------- licence key: SADL1.<payload>.<signature> ---------- */
  parse(key) {
    const m = String(key || '').replace(/\s+/g, '').match(/SADL1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/); if (!m) return null;
    try { const p = JSON.parse(new TextDecoder().decode(this.unb64u(m[1]))); return { p, body: m[1], sig: m[2], key: this.PRE + '.' + m[1] + '.' + m[2] }; } catch (e) { return null; }
  },
  verify(key) { const x = this.parse(key); if (!x || typeof nacl === 'undefined') return null; try { return nacl.sign.detached.verify(this.utf8(x.body), this.unb64u(x.sig), this.unhex(this.PUB)) ? x.p : null; } catch (e) { return null; } },
  async signer() {
    if (!Role.admin()) throw new Error('Only the Super Admin can make a licence');
    const k = localStorage.getItem(Role.K) || ''; if (!k) throw new Error('Load the Super Admin key file first');
    const seed = new Uint8Array(await crypto.subtle.digest('SHA-256', this.utf8('SA-LIC-ED25519|' + k)));
    const kp = nacl.sign.keyPair.fromSeed(seed); if (this.hex(kp.publicKey) !== this.PUB) throw new Error('This Super Admin key cannot sign licences');
    return kp.secretKey;
  },
  async sign(r) {
    const sk = await this.signer();
    const p = { v: 1, lid: r.lid, seq: r.seq, n: r.name, rk: r.rank || '', ps: r.ps || '', dist: r.dist || '', st: r.st || '', mob: r.mob || '', mid: r.mid, tier: r.tier, from: r.from, to: r.to, hide: r.hide || [], xr: r.xr || [], iss: new Date().toISOString(), u: r.u || '' };
    const body = this.b64u(this.utf8(JSON.stringify(p)));
    return this.PRE + '.' + body + '.' + this.b64u(nacl.sign.detached(this.utf8(body), sk));
  },
  /* ---------- register (Super Admin computer) ---------- */
  list() { if (!S.settings.exeLic) S.settings.exeLic = []; return S.settings.exeLic; },
  defs() {
    const d = S.settings.exeTiers || (S.settings.exeTiers = {});
    this.TIERS.forEach(t => { if (!d[t]) d[t] = { days: t === 'premium' ? 365 : t === 'pro' ? 180 : 90, hide: [], xr: t === 'normal' ? [] : ['delcase'] }; });
    return d;
  },
  async save() { await DB.set('settings', S.settings); },
  hist(r, act, det) { (r.hist || (r.hist = [])).unshift({ at: new Date().toISOString(), act, det: det || '' }); r.hist = r.hist.slice(0, 60); },
  status(r) { if (r.status === 'Deleted') return 'Deleted'; if (r.status === 'Suspended') return 'Suspended'; const l = this.left(r); if (r.from > this.istToday()) return 'NotYet'; return l <= 0 ? 'Expired' : l <= 15 ? 'Soon' : 'Active'; },
  stBadge(r) { const s = this.status(r), l = this.left(r);
    return ({ Deleted: '<span class="badge bad">🗑 Deleted</span>', Suspended: '<span class="badge bad">⏸ Suspended</span>', NotYet: '<span class="badge">⏳ Not Started</span>', Expired: '<span class="badge bad">⌛ Expired</span>', Soon: `<span class="badge warn">⚠ ${l} day${l === 1 ? '' : 's'} left</span>`, Active: `<span class="badge good">✅ Active · ${l} days</span>` })[s]; },
  async liveUrl() { try { const L = await Users.live(); return L && L.url && L.key ? L : null; } catch (e) { return null; } },
  /* send the record to the Google Sheet (needs Google script version 16) – best effort */
  async sync(r) {
    const L = await this.liveUrl(); if (!L) { r.sync = 'none'; return false; }
    try { await Users.admin('lic', { rec: { lid: r.lid, seq: r.seq, name: r.name, rank: r.rank, ps: r.ps, dist: r.dist, st: r.st, mob: r.mob, mid: r.mid, tier: r.tier, from: r.from, to: r.to, status: r.status, key: r.status === 'Active' ? r.key : '' } }); r.sync = 'ok'; r.syncAt = new Date().toISOString(); return true; }
    catch (e) { r.sync = /Unknown|op/i.test(e.message) ? 'old' : 'err'; r.syncErr = e.message; return false; }
  },
  async issue(r, act, det) {
    const L = await this.liveUrl(); r.u = L ? L.url : (r.u || '');
    r.seq = (r.seq || 0) + 1; r.key = await this.sign(r); r.at = new Date().toISOString();
    this.hist(r, act, det); await this.sync(r); await this.save(); return r;
  },
  /* ---------- Super Admin page ---------- */
  st: { f: '', q: '' },
  async draw(main) {
    const body = $('#saBody', main), kpi = $('#saKpi', main), conn = $('#saConn', main), R = this.list(), st = this.st;
    [$('#saAdd', main), $('#saRe', main)].forEach(b => b && (b.style.display = 'none'));
    const L = await this.liveUrl(), oldS = L && (L.ver || 0) < 16;
    conn.innerHTML = `<div class="${L && !oldS ? 'sa-ok' : 'note warn sa-conn'}">${L && !oldS ? '🟢 Google Sheet connected – Suspend, Delete and Extend reach each EXE the next time it is online.' : L ? '🟠 <b>Update your Google script once</b> (Settings › ☁ Google Sheet &amp; Apps Script) so Suspend, Delete and Extend also reach EXE users online. Licences work without it.' : '⚪ Licences work fully offline. To also Suspend / Delete / Extend EXE users from here when they are online, connect your Google Sheet (Settings › ☁ Google Sheet &amp; Apps Script).'}</div>`;
    const S0 = R.map(r => this.status(r));
    const K = [['🖥', 'EXE Users', R.filter(r => r.status !== 'Deleted').length, '#6366f1', ''], ['✅', 'Active', S0.filter(s => s === 'Active' || s === 'Soon').length, '#16a34a', 'Active'], ['⚠', 'Ending In 15 Days', S0.filter(s => s === 'Soon').length, '#d97706', 'Soon'], ['⌛', 'Expired', S0.filter(s => s === 'Expired').length, '#dc2626', 'Expired'], ['⏸', 'Suspended / Deleted', S0.filter(s => s === 'Suspended' || s === 'Deleted').length, '#64748b', 'Off']];
    kpi.innerHTML = K.map(([i, t, n, c, f]) => `<button class="sa-k ${st.f === f && f ? 'on' : ''}" data-xf="${f}" style="--c:${c}"><span>${i}</span><b>${fmtNum(n)}</b><small>${t}</small></button>`).join('');
    $$('[data-xf]', kpi).forEach(b => b.onclick = () => { st.f = st.f === b.dataset.xf ? '' : b.dataset.xf; this.draw(main); });
    body.innerHTML = `<div class="ex-top"><div><b>🖥 SudarshanAshtra Desktop (Windows EXE)</b><div class="small muted">Users install the setup once – no internet needed. On first start it shows a <b>Machine ID</b> and a <b>Request Code</b>. The user sends you the Request Code; you press <b>➕ Add EXE User</b>, paste it, choose the category, days and sections, and send back the licence key.</div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn primary" id="exAdd">➕ Add EXE User</button><button class="btn" id="exDef">🧭 Category Defaults</button><button class="btn" id="exSetup">⬇ Setup Download Link</button><button class="btn" id="exBak">💾 Backup Register</button><label class="btn" style="cursor:pointer">📂 Restore<input type="file" id="exRes" accept=".json" hidden></label></div></div><div id="exTbl"></div>`;
    $('#exAdd', body).onclick = () => this.edit(null, main);
    $('#exDef', body).onclick = () => this.defsEdit(main);
    $('#exSetup', body).onclick = () => this.setupInfo();
    $('#exBak', body).onclick = () => UI.download('SudarshanAshtra_EXE_Licences_' + today() + '.json', JSON.stringify({ kind: 'sud-exe-licences', at: new Date().toISOString(), lic: R, tiers: this.defs() }, null, 1), 'application/json');
    $('#exRes', body).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); if (j.kind !== 'sud-exe-licences' || !Array.isArray(j.lic)) throw 0; const have = new Map(R.map(r => [r.lid, r])); let n = 0; j.lic.forEach(r => { const o = have.get(r.lid); if (!o || (r.seq || 0) > (o.seq || 0)) { if (o) R.splice(R.indexOf(o), 1); R.push(r); n++; } }); if (j.tiers) S.settings.exeTiers = Object.assign(this.defs(), j.tiers); await this.save(); UI.toast('📂 ' + n + ' licence(s) restored'); this.draw(main); } catch (x) { UI.toast('This is not a SudarshanAshtra EXE register backup'); } };
    const rows = R.filter(r => { const s = this.status(r); return st.f === 'Active' ? s === 'Active' || s === 'Soon' : st.f === 'Off' ? s === 'Suspended' || s === 'Deleted' : st.f ? s === st.f : s !== 'Deleted'; });
    if (!R.length) { $('#exTbl', body).innerHTML = '<div class="sa-empty">No EXE users yet. Press <b>➕ Add EXE User</b> and paste the Request Code the user sends you.</div>'; return; }
    Table($('#exTbl', body), { rows, pageSize: 50, exportName: 'exe_licences', sortKey: 'to', onRow: r => this.one(r, main), columns: [
      { key: 'lid', label: 'Licence', render: r => `<b class="mono">${esc(r.lid)}</b><div class="small muted">issue #${r.seq}</div>` },
      { key: 'name', label: 'Name', render: r => `<b>${esc([r.rank, r.name].filter(Boolean).join(' '))}</b><div class="small muted">${esc([r.ps, r.dist, r.st].filter(Boolean).join(', '))}${r.mob ? ' · ' + esc(r.mob) : ''}</div>` },
      { key: 'tier', label: 'Category', sortVal: r => this.TIERS.indexOf(r.tier), csv: r => r.tier, render: r => `${Plans.badge(r.tier)}<div class="small muted">${(r.hide || []).length ? (r.hide || []).length + ' item(s) hidden' : 'everything shown'}</div>` },
      { key: 'to', label: 'Valid', sortVal: r => r.to, csv: r => r.from + ' to ' + r.to, render: r => `<div class="small">${this.dmy(r.from)} → <b>${this.dmy(r.to)}</b></div>${this.stBadge(r)}` },
      { key: 'mid', label: 'Computer (Machine ID)', render: r => `<span class="mono small">${esc(r.mid)}</span>` },
      { key: 'chk', label: 'Last Seen Online', csv: r => r.seen || '', render: r => r.seen ? `<span class="small">${Users.dt(r.seen)}</span>${r.build ? `<div class="small muted">build ${esc(r.build)}</div>` : ''}` : `<span class="small muted">${r.sync === 'ok' ? 'not yet' : 'offline only'}</span>` },
      { key: 'act', label: 'Actions', nosort: true, noexport: true, render: r => `<div class="sa-acts"><button class="btn sm" data-xa="key" data-id="${esc(r.lid)}" title="Licence Key – copy / send">🔑</button><button class="btn sm" data-xa="ext" data-id="${esc(r.lid)}" title="Extend / Renew">⏩</button><button class="btn sm" data-xa="edit" data-id="${esc(r.lid)}" title="Change Category, Sections, Computer or Details">✏</button>${r.status === 'Suspended' ? `<button class="btn sm" data-xa="on" data-id="${esc(r.lid)}" title="Resume">▶</button>` : r.status === 'Deleted' ? `<button class="btn sm" data-xa="on" data-id="${esc(r.lid)}" title="Bring Back">↩</button>` : `<button class="btn sm" data-xa="off" data-id="${esc(r.lid)}" title="Suspend">⏸</button>`}<button class="btn sm" data-xa="${r.status === 'Deleted' ? 'purge' : 'del'}" data-id="${esc(r.lid)}" title="${r.status === 'Deleted' ? 'Remove From List' : 'Delete Licence'}">🗑</button></div>` }] });
    const tb = $('#exTbl', body);
    tb.addEventListener('click', e => { const b = e.target.closest('[data-xa]'); if (!b) return; e.stopPropagation(); const r = R.find(x => x.lid === b.dataset.id); if (r) this.act(b.dataset.xa, r, main); }, true);
  },
  async act(a, r, main) {
    if (a === 'key') return this.share(r);
    if (a === 'ext') return this.extend(r, main);
    if (a === 'edit') return this.edit(r, main);
    if (a === 'off') { if (!UI.confirm(`Suspend ${r.name} (${r.lid})?\n\nThe EXE stops the next time it is online. A computer that never comes online keeps working until ${this.dmy(r.to)}.`)) return; r.status = 'Suspended'; this.hist(r, 'Suspended'); }
    if (a === 'on') { r.status = 'Active'; this.hist(r, 'Resumed'); }
    if (a === 'del') { if (!UI.confirm(`Delete the licence of ${r.name} (${r.lid})?\n\nThe EXE stops the next time it is online. A computer that never comes online keeps working until ${this.dmy(r.to)}.`)) return; r.status = 'Deleted'; this.hist(r, 'Deleted'); }
    if (a === 'purge') { if (!UI.confirm(`Remove ${r.name} (${r.lid}) from this list for ever?`)) return; const R = this.list(); R.splice(R.indexOf(r), 1); await this.save(); return this.draw(main); }
    const ok = await this.sync(r); await this.save(); this.draw(main);
    UI.toast(({ off: '⏸ Suspended', on: '▶ Active again', del: '🗑 Licence deleted' })[a] + (ok ? ' – the EXE gets it when online' : ' – saved here (Google Sheet not reached)'), 5000);
  },
  /* ---------- Add / Edit ---------- */
  edit(r, main) {
    const D = this.defs(), isNew = !r, x = r ? Object.assign({}, r) : { tier: 'normal', from: this.istToday(), days: D.normal.days, hide: D.normal.hide.slice(), xr: D.normal.xr.slice() };
    if (!isNew) x.days = this.daysBetween(x.from, x.to) + 1;
    const b = UI.modal(isNew ? '➕ Add EXE User (Desktop Licence)' : '✏ Change Licence – ' + r.lid, `
      ${isNew ? `<div class="ex-req"><b>1.</b> Paste the <b>Request Code</b> the user sent from the EXE (it fills everything below):<textarea id="exReq" rows="2" placeholder="SUDREQ1.…"></textarea></div>` : ''}
      <div class="ex-grid">
        <label>Name<input id="exN" value="${esc(x.name || '')}"></label><label>Rank / Post<input id="exRk" value="${esc(x.rank || '')}"></label>
        <label>Posting / Police Station / Unit<input id="exPs" value="${esc(x.ps || '')}"></label><label>District / Commissionerate<input id="exDi" value="${esc(x.dist || '')}"></label>
        <label>State<input id="exSt" value="${esc(x.st || '')}"></label><label>Mobile<input id="exMo" value="${esc(x.mob || '')}"></label>
        <label class="ex-w">Machine ID of the user's computer <span class="small muted">(shown on the EXE's first screen)</span><input id="exMid" class="mono" placeholder="SA-XXXX-XXXX-XXXX-XXXX" value="${esc(x.mid || '')}"></label>
      </div>
      <div class="ex-grid ex-plan">
        <label>Category<select id="exT">${this.TIERS.map(t => `<option value="${t}" ${t === x.tier ? 'selected' : ''}>${Plans.t(t)[1]}</option>`).join('')}</select></label>
        <label>Valid From<input type="date" id="exF" value="${esc(x.from)}"></label>
        <label>Number of Days<input type="number" id="exD" min="1" max="3650" value="${x.days}" data-nov></label>
        <label>Valid To<input type="date" id="exTo" value="${esc(this.addDays(x.from, x.days - 1))}"></label>
      </div>
      <div class="row" style="gap:12px;flex-wrap:wrap;margin:6px 0">${this.XR.map(([k, n]) => `<label class="row" style="gap:6px"><input type="checkbox" data-xr="${k}" ${(x.xr || []).includes(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>
      <div class="pl-own"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><b>🧭 Left Panel – Sections &amp; Sub-Sections This User Can Use</b><span class="small muted">Starts from the category default (🧭 Category Defaults). Change any tick for this user only.</span></div><div id="exTr">${Plans.treeHtml(x.hide || [])}</div></div>
      <div class="err" id="exErr"></div>`,
      [{ label: 'Cancel', onClick: UI.closeModal }, { label: isNew ? '🔑 Make Licence Key' : '🔑 Save & Make New Key', cls: 'primary', onClick: () => go2() }]);
    Plans.treeBind($('#exTr', b));
    const to = () => { const f = $('#exF', b).value, d = +$('#exD', b).value; if (f && d > 0) $('#exTo', b).value = this.addDays(f, d - 1); };
    $('#exF', b).onchange = to; $('#exD', b).oninput = to;
    $('#exTo', b).onchange = () => { const f = $('#exF', b).value, t = $('#exTo', b).value; if (f && t) $('#exD', b).value = Math.max(1, this.daysBetween(f, t) + 1); };
    $('#exT', b).onchange = () => { const d = D[$('#exT', b).value]; $('#exD', b).value = d.days; to(); $('#exTr', b).innerHTML = Plans.treeHtml(d.hide); Plans.treeBind($('#exTr', b)); $$('[data-xr]', b).forEach(c => { c.checked = d.xr.includes(c.dataset.xr); }); };
    if ($('#exReq', b)) $('#exReq', b).oninput = () => { const q = this.parseReq($('#exReq', b).value); if (!q) return; [['exN', q.n], ['exRk', q.rk], ['exPs', q.ps], ['exDi', q.dist], ['exSt', q.st], ['exMo', q.mob], ['exMid', q.mid]].forEach(([i, v]) => { if (v) $('#' + i, b).value = v; }); UI.toast('✔ Request Code read – choose the category and days'); };
    const go2 = async () => {
      const e = t => { $('#exErr', b).textContent = t; }, mid = this.normMid($('#exMid', b).value), name = $('#exN', b).value.trim(), f = $('#exF', b).value, t = $('#exTo', b).value;
      if (!name) return e('Enter the user’s name'); if (!mid) return e('Machine ID must look like SA-XXXX-XXXX-XXXX-XXXX (paste the Request Code)');
      if (!f || !t || t < f) return e('Check Valid From / Valid To');
      const dup = this.list().find(o => o.mid === mid && o.status !== 'Deleted' && (!r || o.lid !== r.lid)); if (dup && !UI.confirm(`This computer already has licence ${dup.lid} (${dup.name}). Make another one for it anyway?`)) return;
      const n = r || { lid: this.rid(), seq: 0, status: 'Active', made: new Date().toISOString() };
      const old = r ? { tier: r.tier, to: r.to, mid: r.mid } : null;
      Object.assign(n, { name, rank: $('#exRk', b).value.trim(), ps: $('#exPs', b).value.trim(), dist: $('#exDi', b).value.trim(), st: $('#exSt', b).value.trim(), mob: $('#exMo', b).value.trim(), mid, tier: $('#exT', b).value, from: f, to: t, hide: Plans.treeRead($('#exTr', b)), xr: $$('[data-xr]', b).filter(c => c.checked).map(c => c.dataset.xr) });
      e('⏳ Signing the licence…');
      try { await this.issue(n, isNew ? 'Added' : 'Changed', isNew ? `${n.tier}, ${this.dmy(f)} → ${this.dmy(t)}` : [old.tier !== n.tier && 'category ' + old.tier + ' → ' + n.tier, old.to !== n.to && 'valid to ' + this.dmy(n.to), old.mid !== n.mid && 'moved to computer ' + n.mid].filter(Boolean).join(', ') || 'sections / details'); } catch (x) { return e('❌ ' + x.message); }
      if (isNew) this.list().push(n); await this.save();
      UI.closeModal(); this.draw(main); this.share(n, isNew ? '✅ Licence Made – Send This To ' + n.name : '🔑 New Licence Key – ' + n.name);
    };
  },
  extend(r, main) {
    const base = r.to >= this.istToday() ? r.to : this.istToday();
    const b = UI.modal('⏩ Extend / Renew – ' + r.name, `<p>Now valid <b>${this.dmy(r.from)} → ${this.dmy(r.to)}</b> ${this.stBadge(r)}</p>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin:8px 0">${[30, 90, 180, 365].map(d => `<button class="btn sm" data-ed="${d}">+ ${d} days</button>`).join('')}</div>
      <div class="ex-grid"><label>New Valid To<input type="date" id="exNT" value="${esc(this.addDays(base, 89))}"></label><label>Category<select id="exET">${this.TIERS.map(t => `<option value="${t}" ${t === r.tier ? 'selected' : ''}>${Plans.t(t)[1]}</option>`).join('')}</select></label></div>
      <p class="small muted">Days are added after ${r.to >= this.istToday() ? 'the present end date' : 'today (the licence has ended)'}. If the user's EXE is online it gets the new date by itself; otherwise send the new key.</p><div class="err" id="exEE"></div>`,
      [{ label: 'Cancel', onClick: UI.closeModal }, { label: '⏩ Extend & Make New Key', cls: 'primary', onClick: async () => {
        const t = $('#exNT', b).value; if (!t || t < r.from) return $('#exEE', b).textContent = 'Choose a date after Valid From';
        const old = r.to, ot = r.tier; r.to = t; r.tier = $('#exET', b).value; if (r.status !== 'Active') { r.status = 'Active'; }
        try { await this.issue(r, 'Extended', this.dmy(old) + ' → ' + this.dmy(t) + (ot !== r.tier ? ', category ' + r.tier : '')); } catch (x) { r.to = old; return $('#exEE', b).textContent = '❌ ' + x.message; }
        UI.closeModal(); this.draw(main); this.share(r, '⏩ Extended – New Key For ' + r.name);
      } }]);
    $$('[data-ed]', b).forEach(x => x.onclick = () => { $('#exNT', b).value = this.addDays(base, +x.dataset.ed); });
  },
  defsEdit(main) {
    const D = this.defs(); let cur = this.st.dt || 'normal';
    const draw = () => {
      const b = UI.modal('🧭 Category Defaults For New EXE Users', `<p class="small muted">What a new EXE user of each category gets. You can still change it for each user. Users who already have a licence keep theirs until you press ✏ or ⏩ for them.</p>
        <div class="pl-cats">${this.TIERS.map(t => `<button class="pl-cat ${t === cur ? 'on' : ''}" data-dt="${t}" style="--c:${Plans.t(t)[2]}"><b>${Plans.t(t)[1]}</b><small>${D[t].days} days · ${D[t].hide.length ? D[t].hide.length + ' hidden' : 'everything shown'}</small></button>`).join('')}</div>
        <div class="row" style="gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0"><label class="row" style="gap:6px;align-items:center">Default Days <input type="number" id="dfD" min="1" max="3650" value="${D[cur].days}" style="width:90px" data-nov></label>${this.XR.map(([k, n]) => `<label class="row" style="gap:6px"><input type="checkbox" data-dxr="${k}" ${D[cur].xr.includes(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>
        <div id="dfTr">${Plans.treeHtml(D[cur].hide)}</div>`,
        [{ label: 'Close', onClick: UI.closeModal }, { label: '💾 Save ' + Plans.t(cur)[1].replace(/^\S+ /, '') + ' Default', cls: 'primary', onClick: async () => { keep(); await this.save(); UI.toast('💾 Saved'); UI.closeModal(); this.draw(main); } }]);
      Plans.treeBind($('#dfTr', b));
      const keep = () => { D[cur] = { days: Math.max(1, +$('#dfD', b).value || 90), hide: Plans.treeRead($('#dfTr', b)), xr: $$('[data-dxr]', b).filter(c => c.checked).map(c => c.dataset.dxr) }; };
      $$('[data-dt]', b).forEach(x => x.onclick = () => { keep(); cur = this.st.dt = x.dataset.dt; draw(); });
    };
    draw();
  },
  share(r, title) {
    const txt = `SudarshanAshtra Desktop – your licence\nName: ${[r.rank, r.name].filter(Boolean).join(' ')}\nCategory: ${Plans.t(r.tier)[1].replace(/^\S+ /, '')}\nValid: ${this.dmy(r.from)} to ${this.dmy(r.to)}\nComputer: ${r.mid}\n\nOpen SudarshanAshtra on that computer › paste this key › Activate:\n\n${r.key}\n\n– Super Admin, Vijay Tomar`;
    const b = UI.modal(title || '🔑 Licence Key – ' + r.name, `<table class="tbl ad-kv"><tr><th>Licence</th><td><b class="mono">${esc(r.lid)}</b> · issue #${r.seq}</td></tr><tr><th>User</th><td><b>${esc([r.rank, r.name].filter(Boolean).join(' '))}</b> <span class="small muted">${esc(r.ps || '')}</span></td></tr><tr><th>Category</th><td>${Plans.badge(r.tier)}</td></tr><tr><th>Valid</th><td><b>${this.dmy(r.from)} → ${this.dmy(r.to)}</b></td></tr><tr><th>Computer</th><td class="mono">${esc(r.mid)}</td></tr></table>
      <textarea readonly class="mono ex-key" rows="5">${esc(r.key)}</textarea>
      <p class="small muted">Works only on that one computer. Send it by WhatsApp / e-mail, or send the .lic file. ${r.sync === 'ok' ? '🟢 Also saved in your Google Sheet – an online EXE picks up changes by itself.' : ''}</p>`,
      [{ label: '📋 Copy Message', cls: 'primary', onClick: async () => { try { await navigator.clipboard.writeText(txt); UI.toast('Copied – paste it in WhatsApp / e-mail'); } catch (e) { UI.toast('Copy failed – select the key and copy'); } } },
        { label: '⬇ Download .lic File', onClick: () => UI.download(`SudarshanAshtra_${r.lid}_${(r.name || '').replace(/[^\w]+/g, '_')}.lic`, r.key + '\n') },
        { label: '🟢 WhatsApp', onClick: () => window.open('https://wa.me/' + (String(r.mob || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')) + '?text=' + encodeURIComponent(txt), '_blank', 'noopener') },
        { label: 'Done', onClick: UI.closeModal }]);
    const ta = $('.ex-key', b); ta.onclick = () => ta.select();
  },
  one(r, main) {
    const b = UI.modal('🖥 ' + [r.rank, r.name].filter(Boolean).join(' '), `<table class="tbl ad-kv"><tr><th>Licence</th><td class="mono"><b>${esc(r.lid)}</b> · issue #${r.seq}</td></tr><tr><th>Status</th><td>${this.stBadge(r)}</td></tr><tr><th>Category</th><td>${Plans.badge(r.tier)}</td></tr><tr><th>Valid</th><td>${this.dmy(r.from)} → <b>${this.dmy(r.to)}</b></td></tr><tr><th>Posting</th><td>${esc([r.ps, r.dist, r.st].filter(Boolean).join(', ') || '—')}</td></tr><tr><th>Mobile</th><td>${esc(r.mob || '—')}</td></tr><tr><th>Computer</th><td class="mono">${esc(r.mid)}</td></tr><tr><th>Last Seen Online</th><td>${r.seen ? Users.dt(r.seen) + (r.build ? ' · build ' + esc(r.build) : '') : '—'}</td></tr><tr><th>Extra Rights</th><td>${(r.xr || []).map(k => esc((this.XR.find(z => z[0] === k) || [k, k])[1])).join(', ') || '—'}</td></tr><tr><th>Hidden Sections</th><td>${(r.hide || []).length || 'none'}</td></tr></table>
      <h4 style="margin:12px 0 6px">📜 History</h4><div class="ex-hist">${(r.hist || []).map(h => `<div><span class="small muted">${Users.dt(h.at)}</span> <b>${esc(h.act)}</b> <span class="small">${esc(h.det)}</span></div>`).join('') || '<span class="muted small">—</span>'}</div>`,
      [{ label: '🔑 Key', onClick: () => this.share(r) }, { label: '⏩ Extend', onClick: () => this.extend(r, main) }, { label: '✏ Change', onClick: () => this.edit(r, main) }, { label: 'Close', onClick: UI.closeModal }]);
    return b;
  },
  setupInfo() {
    const txt = `SudarshanAshtra Desktop (Windows 10 / 11, 64-bit)\nDownload the setup: ${this.SETUP_URL}\n(Download "SudarshanAshtra-Setup-….exe". It installs without internet.)\nAfter installing, open SudarshanAshtra, fill your name and posting, and send the Request Code to the Super Admin (Vijay Tomar).`;
    UI.modal('⬇ Setup Download Link', `<p>Send this to new users. The setup can also be copied on a pen drive – it installs without internet.</p><code style="display:block;word-break:break-all;padding:8px">${esc(this.SETUP_URL)}</code><textarea readonly rows="5" style="width:100%;margin-top:8px">${esc(txt)}</textarea>`,
      [{ label: '📋 Copy Message', cls: 'primary', onClick: async () => { try { await navigator.clipboard.writeText(txt); UI.toast('Copied'); } catch (e) { UI.toast('Copy failed'); } } }, { label: 'Open', onClick: () => window.open(this.SETUP_URL, '_blank', 'noopener') }, { label: 'Done', onClick: UI.closeModal }]);
  },
  /* pull "last seen" from the Google Sheet (version 16) */
  async pull() {
    const L = await this.liveUrl(); if (!L || (L.ver || 0) < 16) return;
    try { const d = await Users.admin('liclist', {}); const R = this.list(); let ch = 0; (d.lic || []).forEach(o => { const r = R.find(x => x.lid === o.lid); if (r && o.seen && o.seen !== r.seen) { r.seen = o.seen; r.build = o.build || ''; ch = 1; } }); if (ch) await this.save(); } catch (e) { }
  }
};

/* ---------- wiring: 🖥 EXE Users tab in Super Admin Control (Super Admin link only) ---------- */
(() => {
  if (SUD_ED !== 'admin') return;
  const sp = Pages.sadmin; Pages.sadmin = function (main) {
    const r = sp.apply(this, arguments), seg = $('.seg', main);
    if (seg && !$('[data-tb="exe"]', seg)) {
      seg.insertAdjacentHTML('beforeend', `<button class="btn sm" data-tb="exe">🖥 EXE Users</button>`);
      $('[data-tb="exe"]', seg).onclick = () => { Users._plTab = 0; Users._exTab = 1; Pages.sadmin(main); };
      $$('[data-tb]', seg).forEach(b => { if (b.dataset.tb !== 'exe') b.addEventListener('click', () => { Users._exTab = 0; }, true); });
    }
    if (Users._exTab) $$('[data-tb]', main).forEach(b => b.classList.toggle('primary', b.dataset.tb === 'exe'));
    return r;
  };
  const dr = Users.draw; Users.draw = async function (main, st) {
    if (Users._exTab && Role.admin()) { await ExeLic.draw(main); ExeLic.pull().then(() => { if (Users._exTab && S.page === 'sadmin' && document.body.contains(main)) ExeLic.draw(main); }); return; }
    return dr.call(this, main, st);
  };
})();
