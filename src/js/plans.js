/* plans.js – user categories (Trial / Normal / Pro / Premium), set by the Super Admin in Super Admin Control.
   Per category: daily hours (0 = 24×7) and which sidebar sections / drop-down items are shown.
   Per user: category, Valid From / Valid To, own daily hours (blank = category hours), switch off (existing).
   The Google script (version 14) checks dates and time used today at login and every minute, and ends the old
   session when the same User ID logs in somewhere else (one session at a time). The User link shows a countdown. */
'use strict';
const Plans = {
  T: [['trial', '🧪 Trial', '#f59e0b', 3], ['normal', '👤 Normal', '#0ea5e9', 2], ['pro', '⭐ Pro', '#8b5cf6', 4], ['premium', '💎 Premium', '#16a34a', 0]],
  t(k) { return this.T.find(x => x[0] === k) || this.T[0]; },
  badge(k) { const t = this.t(k); return `<span class="pl-b" style="--c:${t[2]}">${t[1]}</span>`; },
  hrs(h) { h = +h || 0; return h > 0 ? (h % 1 ? h : h | 0) + ' h / day' : '24×7'; },
  dmy(d) { return d ? d.split('-').reverse().join('-') : ''; },
  mins(m) { m = Math.max(0, Math.round(m)); return m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min'; },
  msg(r) {
    if (r.notyet) return '⏳ Your access starts on ' + this.dmy(r.notyet) + '. Contact the SudarshanAshtra Super Admin.';
    if (r.expired) return '⌛ Your access period ended on ' + this.dmy(r.expired) + '. Contact the SudarshanAshtra Super Admin to extend it.';
    if (r.outhours) return '🕘 You can use the tool only between ' + r.tf + ' and ' + r.tt + ' (India time). Please log in again in that time.';
    if (r.timeup) return '⏰ Your time for today (' + this.hrs(r.h) + ') is over. You can log in again tomorrow, or ask the Super Admin for more time.';
    return '';
  },
  /* ---------- sidebar: every section and its drop-down items (built from the sidebar itself) ---------- */
  secKey(it) { return it.dataset.page || [...it.classList].find(c => !/^(nav-item|open|active|hero|pl-hide)$/.test(c)) || it.textContent.trim(); },
  tree() {
    const out = [];
    let grp = '';
    [...$('#sidebar').children].forEach(it => { if (it.classList.contains('nav-group')) { grp = it.textContent.trim(); return; } if (!it.classList.contains('nav-item')) return; const k = this.secKey(it); if (k === 'settings') return; const nx = it.nextElementSibling, subs = nx && nx.classList.contains('nav-subs') ? nx : null;
      out.push({ g: grp, k, name: (it.dataset.ncOrig || it.textContent).replace(/[▾▸▶]/g, '').trim(), subs: subs ? NavCustom.items(subs).map(n => ({ k: k + '|' + NavCustom.id(n), name: (n.dataset.ncOrig || n.textContent).replace(/\s+/g, ' ').trim() })) : [] }); });
    const o = out.find(s => s.k === 'offx-item'), i = o ? o.subs.findIndex(x => x.k === this.CD) : -1;
    if (i >= 0) { o.subs[i].name = '👁 View Crime Data'; o.subs.splice(i + 1, 0, { k: this.CDF, name: '✏ Crime Data – Full Use (Import, Add Entry, Forms, Columns)', inv: 1 }); }
    return out;
  },
  CD: 'offx-item|ox:offx|crime', CDF: '+R:crimeEdit',
  /* rights that follow the Left Panel ticks (Office Work) – the rest stay as given */
  rightsOf(rs, p) {
    const R = new Set(String(rs || '').split(',').map(s => s.trim()).filter(Boolean)); if (!p) return [...R];
    const H = new Set(p.hide || []), sec = H.has('S:offx-item'), sub = k => !sec && !H.has('offx-item|ox:offx|' + k);
    ['crime', 'crimeEdit', 'office', 'upload'].forEach(k => R.delete(k));
    if (sub('crime')) { R.add('crime'); if (H.has(this.CDF)) R.add('crimeEdit'); }
    if (['good', 'press', 'duty'].some(sub)) R.add('office');
    if (sub('files')) R.add('upload');
    R.delete('contacts'); if (!H.has('S:ct-item')) R.add('contacts');
    return [...R];
  },
  hideNav(hide) {
    const H = new Set(hide || []);
    $$('#sidebar > .nav-item').forEach(it => { const k = this.secKey(it), off = H.has('S:' + k); it.classList.toggle('pl-hide', off); const nx = it.nextElementSibling;
      if (nx && nx.classList.contains('nav-subs')) { nx.classList.toggle('pl-hide', off); NavCustom.items(nx).forEach(n => n.classList.toggle('pl-hide', H.has(k + '|' + NavCustom.id(n)))); } });
    $$('#sidebar > .nav-group').forEach(g => { let n = g.nextElementSibling, any = false; while (n && !n.classList.contains('nav-group')) { if (n.classList.contains('nav-item') && !n.classList.contains('pl-hide') && getComputedStyle(n).display !== 'none') any = true; n = n.nextElementSibling; } g.classList.toggle('pl-hide', !any); });
  },
  plan() { const L = SUD_ED === 'user' && typeof Users !== 'undefined' ? Users.link() : null; return L && L.plan ? L.plan : null; },
  SEC: { nodalm: 'eo-item', prb: 'analytics', contacts: 'ct-item', arrest: 'arrest-item', cctns: 'io-item', others: 'io-item', formats: 'io-item', eo: 'eo-item', jmis: 'eo-item' },
  blocked(page) { const p = this.plan(), H = p && p.hide || []; return !!(p && page && (H.includes('S:' + page) || (this.SEC[page] && (H.includes('S:' + this.SEC[page]) || (this.SEC[page] === 'eo-item' && H.includes('eo-item|eo:' + page)))))); },
  apply() {
    if (SUD_ED !== 'user') return; const p = this.plan();
    this._busy = 1; try { this.hideNav(p ? p.hide : []); for (const [k] of Role.RIGHTS) document.documentElement.classList.toggle('no-' + k, !Role.can(k)); } finally { this._busy = 0; }
    this.timer();
  },
  /* ---------- countdown (User link) ---------- */
  istMin() { const d = new Date(Date.now() + 5.5 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60; },
  winLeft(p) { if (!p || !p.tf || !p.tt) return null; const hm = s => +s.slice(0, 2) * 60 + +s.slice(3, 5), a = hm(p.tf), b = hm(p.tt), n = this.istMin(); let m = b - n; if (a > b) m = n >= a ? 1440 - n + b : b - n; return Math.max(0, m) * 60000; },
  left() { const L = Users.link(), p = L && L.plan; if (!p) return null; const d = p.h > 0 ? p.left * 60000 - (Date.now() - (L.planAt || Date.now())) : null, w = this.winLeft(p); return d == null ? w : w == null ? d : Math.min(d, w); },
  timer() {
    if (SUD_ED !== 'user') return; const L = Users.link(), p = L && L.plan, on = !$('#app').classList.contains('hidden') && L && L.tok;
    let c = $('#plTimer'); if (!on || !p) { if (c) c.remove(); return; }
    if (!c) { const rb = $('#roleBadge') || $('#btnTheme'); if (!rb) return; rb.insertAdjacentHTML('beforebegin', '<span id="plTimer" title="Time left today"></span>'); c = $('#plTimer'); c.onclick = () => Users.account(); }
    const t = this.t(p.tier); c.style.setProperty('--c', t[2]);
    if (!(p.h > 0) && !(p.tf && p.tt)) { c.className = 'pl-tm'; c.innerHTML = `${t[1]} · <b>24×7</b>`; return; }
    const ms = this.left(), s = Math.max(0, Math.floor(ms / 1000));
    c.className = 'pl-tm' + (s < 600 ? ' low' : s < 1800 ? ' mid' : '');
    c.innerHTML = `${t[1]} · ⏳ <b class="mono">${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}</b>`; c.title = "Time left today – click for your account";
    if (s <= 0 && !this._out) { this._out = 1; L.tok = ''; const w = this.winLeft(p); Users.out(this.msg(w != null && w <= 0 ? { outhours: 1, tf: p.tf, tt: p.tt } : { timeup: 1, h: p.h })).finally(() => { this._out = 0; }); }
    else if (s > 0 && s <= 300 && !this._warn) { this._warn = 1; UI.toast('⏰ Only ' + Math.ceil(s / 60) + ' minutes left for today – save your work', 8000); }
  },
  /* ---------- Super Admin: Plans tab ---------- */
  treeHtml(hide) {
    const H = new Set(hide || []), tr = this.tree(), G = [...new Set(tr.map(s => s.g))];
    return `<div class="row pl-tbar" style="gap:6px;flex-wrap:wrap"><button type="button" class="btn sm" data-tall="1">☑ Show All</button><button type="button" class="btn sm" data-tall="0">☐ Hide All</button><button type="button" class="btn sm" data-topen>▾ Open All</button></div>
      ${G.map(g => `<div class="pl-grp"><div class="pl-gh">${esc(g || 'Other')}</div><div class="pl-tree">${tr.filter(s => s.g === g).map(s => `<details class="pl-sec"><summary><label onclick="event.stopPropagation()"><input type="checkbox" data-pk="S:${esc(s.k)}" ${H.has('S:' + s.k) ? '' : 'checked'}> <b>${esc(s.name)}</b></label>${s.subs.length ? `<span class="small muted">${s.subs.filter(x => !x.inv && !H.has(x.k)).length} / ${s.subs.filter(x => !x.inv).length}</span>` : '<span class="small muted">no drop-down</span>'}</summary>
        ${s.subs.length ? `<div class="pl-subs">${s.subs.map(x => `<label class="${x.inv ? 'pl-full' : ''}"><input type="checkbox" data-pk="${esc(x.k)}" ${x.inv ? 'data-inv="1"' : ''} ${H.has(x.k) === !x.inv ? '' : 'checked'}> ${esc(x.name)}</label>`).join('')}</div>` : ''}</details>`).join('')}</div></div>`).join('')}`;
  },
  treeBind(root, onChange) {
    const boxes = () => $$('[data-pk]', root);
    $$('[data-tall]', root).forEach(b => b.onclick = () => { boxes().forEach(x => { if (!x.dataset.inv || b.dataset.tall !== '1') x.checked = b.dataset.tall === '1'; }); onChange && onChange(); });
    const cd = $(`[data-pk="${this.CD}"]`, root), cf = $(`[data-pk="${this.CDF}"]`, root);
    $$('[data-topen]', root).forEach(b => b.onclick = () => $$('details.pl-sec', root).forEach(x => x.open = true));
    $$('details.pl-sec', root).forEach(dt => { const sec = $('summary [data-pk]', dt); sec.onchange = () => { $$('.pl-subs [data-pk]', dt).forEach(x => { if (!x.dataset.inv || !sec.checked) x.checked = sec.checked; }); onChange && onChange(); }; $$('.pl-subs [data-pk]', dt).forEach(x => x.onchange = () => { if (x.checked) sec.checked = true; if (cd && cf) { if (x === cf && cf.checked) cd.checked = true; if (x === cd && !cd.checked) cf.checked = false; } onChange && onChange(); }); });
  },
  treeRead(root) { return $$('[data-pk]', root).filter(x => x.dataset.inv ? x.checked : !x.checked).map(x => x.dataset.pk); },
  tiersOf(d) { const T = (d && d.tiers) || {}; return Object.fromEntries(this.T.map(([k, , , h]) => [k, { h: T[k] && T[k].h != null ? +T[k].h : h, hide: (T[k] && T[k].hide) || [] }])); },
  tab(body, d, main, st) {
    const T = this.tiersOf(d), cur = st.pt || 'trial', tr = this.tree(), U = d.users || [];
    const old = (d.ver || 0) < 15;
    body.innerHTML = `${old ? '<div class="note warn"><b>Update your Google script once</b> (Settings › ☁ Google Sheet &amp; Apps Script › copy the new script, paste it, Deploy › Manage deployments › Edit › New version). Until then plans, dates and time limits are not checked.</div>' : ''}
      <p class="small muted">Choose a category, set its daily hours and tick what its users see in the left panel. Open ▸ a section to choose its drop-down items. Each user's category, dates and own hours are set with 💎 in the Users list. Changes reach users within a minute.</p>
      <div class="pl-cats">${this.T.map(([k, n, c]) => `<button class="pl-cat ${k === cur ? 'on' : ''}" data-pt="${k}" style="--c:${c}"><b>${n}</b><small>${this.hrs(T[k].h)} · ${U.filter(u => (u.plan && u.plan.tier || 'trial') === k).length} user(s) · ${T[k].hide.length ? T[k].hide.length + ' hidden' : 'everything shown'}</small></button>`).join('')}</div>
      <div class="pl-ed" style="--c:${this.t(cur)[2]}"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><b>${this.t(cur)[1]}</b><label class="row" style="gap:6px;align-items:center">Daily Hours <input id="plH" type="number" min="0" max="24" step="0.5" value="${T[cur].h}" style="width:80px" data-nov></label><span class="small muted">0 = 24×7, no limit</span><span class="spacer"></span>
</div><div id="plTr">${this.treeHtml(T[cur].hide)}</div>
      <div class="row" style="gap:8px;margin-top:10px"><span class="spacer"></span><button class="btn primary" id="plSave" data-nov>💾 Save ${esc(this.t(cur)[1].replace(/^\S+ /, ''))} Plan</button></div></div>`;
    $$('[data-pt]', body).forEach(b => b.onclick = () => { st.pt = b.dataset.pt; this.tab(body, d, main, st); });
    this.treeBind($('#plTr', body));
    $('#plSave', body).onclick = async () => {
      const h = +$('#plH', body).value; if (!(h >= 0 && h <= 24)) return UI.toast('Daily hours: 0 to 24');
      T[cur] = { h, hide: this.treeRead($('#plTr', body)) };
      try { await Users.admin('tiers', { tiers: JSON.stringify(T) }); Users._data = await Users.admin('list', { log: 1 }); UI.toast('💾 ' + this.t(cur)[1] + ' plan saved – users get it within a minute'); Pages.sadmin(main); } catch (e) { UI.toast('❌ ' + e.message, 7000); }
    };
  },
  /* plan fields for Add User / Plan modal */
  box(p, T) {
    p = p || {}; const tier = p.tier || 'trial';
    return `<div class="pl-box"><label>Category<select id="plT">${this.T.map(([k, n]) => `<option value="${k}" ${k === tier ? 'selected' : ''}>${n} (${this.hrs(T[k].h)})</option>`).join('')}</select></label>
      <label>Valid From<input type="date" id="plF" value="${esc(p.from || today())}"></label><label>Valid To <span class="small muted">(blank = no end)</span><input type="date" id="plTo" value="${esc(p.to || '')}"></label>
      <label>Own Daily Hours <span class="small muted">(blank = category hours, 0 = 24×7)</span><input type="number" id="plUh" min="0" max="24" step="0.5" value="${esc(p.hrs != null ? p.hrs : '')}" data-nov></label>
      <label>Allowed Time From <span class="small muted">(blank = any time)</span><input type="time" id="plTf" value="${esc(p.tf || '')}"></label><label>Allowed Time To<input type="time" id="plTt" value="${esc(p.tt || '')}"></label></div>
      <div class="pl-own"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><b>🧭 Left Panel – Sections &amp; Sub-Sections This User Can Use</b><span class="small muted" id="plOwnT">${p.own ? '✏ Set for this user only' : 'Same as the category – change any tick to set it for this user only'}</span><button type="button" class="btn sm" id="plOwnR" ${p.own ? '' : 'style="display:none"'}>↺ Back to Category</button></div>
      <div id="plUTr">${this.treeHtml(p.own ? p.hide : T[tier].hide)}</div></div>`;
  },
  bindBox(b, T, own) {
    const st = { own: !!own }, tr = $('#plUTr', b), lab = () => { $('#plOwnT', b).textContent = st.own ? '✏ Set for this user only' : 'Same as the category – change any tick to set it for this user only'; $('#plOwnR', b).style.display = st.own ? '' : 'none'; };
    const fill = () => { tr.innerHTML = this.treeHtml(T[$('#plT', b).value].hide); this.treeBind(tr, () => { st.own = true; lab(); }); };
    this.treeBind(tr, () => { st.own = true; lab(); });
    $('#plT', b).addEventListener('change', () => { if (!st.own || UI.confirm('Use the left panel of the new category for this user? (Your own ticks are replaced.)')) { st.own = false; fill(); lab(); } });
    $('#plOwnR', b).onclick = () => { st.own = false; fill(); lab(); };
    b._plOwn = st;
  },
  read(b) { const st = b._plOwn || {}; return { tier: $('#plT', b).value, from: $('#plF', b).value, to: $('#plTo', b).value, hrs: $('#plUh', b).value.trim(), tf: $('#plTf', b).value, tt: $('#plTt', b).value, side: st.own ? JSON.stringify(this.treeRead($('#plUTr', b))) : '' }; },
  check(x) { if (x.from && x.to && x.to < x.from) return 'Valid To is before Valid From'; if (x.hrs !== '' && !(+x.hrs >= 0 && +x.hrs <= 24)) return 'Own daily hours: 0 to 24'; if (!!x.tf !== !!x.tt) return 'Fill both Allowed Time From and To (or leave both blank)'; if (x.tf && x.tf === x.tt) return 'Allowed Time From and To cannot be the same'; return ''; },
  edit(u, main) {
    const T = this.tiersOf(Users._data), p = u.plan || {};
    const b = UI.modal('💎 Plan – ' + u.id, `${this.box(p, T)}<div class="small muted" style="margin-top:8px">Today: ${p.h > 0 ? this.mins(p.used || 0) + ' used, ' + this.mins(p.left) + ' left' : 'no time limit'}.</div><div class="err" id="plErr"></div>`,
      [{ label: 'Cancel', onClick: UI.closeModal }, ...(p.h > 0 ? [{ label: '🔄 Give Fresh Time Today', onClick: async () => { UI.closeModal(); await Users.run('fresh', { id: u.id }, main, '🔄 ' + u.id + ' can use the full time again today'); } }] : []),
        { label: '💾 Save Plan', cls: 'primary', onClick: async () => { const x = this.read(b), e = this.check(x); if (e) return $('#plErr', b).textContent = e; UI.closeModal(); await Users.run('plan', Object.assign({ id: u.id }, x), main, '💎 Plan saved for ' + u.id); } }]);
    this.bindBox(b, T, p.own);
  }
};

/* ---------- wiring ---------- */
(() => {
  /* Super Admin Control: Plans tab, Plan column, 💎 action, plan fields in Add User */
  const sp = Pages.sadmin; Pages.sadmin = function (main) {
    const r = sp.apply(this, arguments), seg = $('.seg', main);
    if (seg && !$('[data-tb="plans"]', seg)) { seg.insertAdjacentHTML('beforeend', `<button class="btn sm" data-tb="plans">💎 Plans &amp; Time</button>`); const b = $('[data-tb="plans"]', seg); b.onclick = () => { Users._plTab = 1; Pages.sadmin(main); }; }
    $$('[data-tb]', main).forEach(b => { if (b.dataset.tb !== 'plans') b.addEventListener('click', () => { Users._plTab = 0; }, true); });
    if (Users._plTab) { $$('[data-tb]', main).forEach(b => b.classList.toggle('primary', b.dataset.tb === 'plans')); }
    return r;
  };
  const dr = Users.draw; Users.draw = async function (main, st) {
    if (Users._plTab) { const body = $('#saBody', main); await dr.call(this, main, Object.assign({}, st, { tab: 'rights' })); if (this._data) Plans.tab(body, this._data, main, Users._st || (Users._st = {})); return; }
    return dr.call(this, main, st);
  };
  const ot = Table; Table = function (box, opt) {
    if (box && box.id === 'saBody' && opt && opt.exportName === 'users' && Array.isArray(opt.columns) && !opt.columns.some(c => c.key === 'plan')) {
      const i = opt.columns.findIndex(c => c.key === 'status');
      opt.columns.splice(i + 1, 0, { key: 'plan', label: 'Plan & Time', sortVal: u => Plans.T.findIndex(t => t[0] === (u.plan && u.plan.tier)), csv: u => u.plan ? [u.plan.tier, Plans.hrs(u.plan.h), u.plan.from && 'from ' + u.plan.from, u.plan.to && 'to ' + u.plan.to].filter(Boolean).join(' ') : '',
        render: u => { const p = u.plan; if (!p) return '<span class="small muted">update script</span>'; const exp = p.to && p.today > p.to, ny = p.from && p.today < p.from;
          return `${Plans.badge(p.tier)}<div class="small">${Plans.hrs(p.h)}${p.hrs !== '' && p.hrs != null ? ' <i class="muted">(own)</i>' : ''}${p.h > 0 ? ` · <b>${Plans.mins(p.left)}</b> left today` : ''}${p.tf && p.tt ? ` · 🕘 ${p.tf}–${p.tt}` : ''}${p.own ? ' · 🧭 own panel' : ''}</div><div class="small ${exp ? 'bad-t' : ny ? 'warn-t' : 'muted'}">${p.from || p.to ? `${Plans.dmy(p.from) || '…'} → ${Plans.dmy(p.to) || 'no end'}` : 'No end date'}${exp ? ' · ⌛ Over' : ny ? ' · ⏳ Not Started' : ''}</div>`; } });
      const rc = opt.columns.find(c => c.key === 'rights'); if (rc) { const RN = Object.fromEntries(Role.RIGHTS.map(r => [r[0], r[1]])); rc.label = 'Rights'; rc.render = u => `<div class="sa-rc">${Plans.rightsOf(u.rights, u.plan).map(k => `<i>${esc(RN[k] || k)}</i>`).join('') || '<span class="muted small">Cases only</span>'}</div>`; }
      const ac = opt.columns.find(c => c.key === 'act'); if (ac) { const r0 = ac.render; ac.render = u => r0(u).replace('<button class="btn sm" data-ua="rights"', `<button class="btn sm" data-ua="plan" data-id="${esc(u.id)}" title="Plan, Dates &amp; Daily Time">💎</button><button class="btn sm" data-ua="rights"`); }
    }
    return ot.call(this, box, opt);
  };
  const ac = Users.act; Users.act = async function (op, u, main) { if (op === 'plan') return Plans.edit(u, main); return ac.call(this, op, u, main); };
  const on = Users.one; Users.one = function (u, main) { const r = on.call(this, u, main); const b = $('#mdBody'), p = u.plan;
    if (b && p) { const tb = $('.ad-kv', b); tb && tb.insertAdjacentHTML('beforeend', `<tr><th>Plan</th><td>${Plans.badge(p.tier)} ${Plans.hrs(p.h)}${p.h > 0 ? ' · ' + Plans.mins(p.left) + ' left today' : ''}</td></tr><tr><th>Valid</th><td>${Plans.dmy(p.from) || '…'} → ${Plans.dmy(p.to) || 'no end'}</td></tr>`); const a = $('.sa-acts', b); a && a.insertAdjacentHTML('afterbegin', '<button class="btn" data-o2="plan">💎 Plan &amp; Time</button>'); const x = $('[data-o2]', b); if (x) x.onclick = () => Plans.edit(u, main); }
    return r; };
  /* Add User: category (Trial first), dates, own hours – sent with the new user */
  const ue = Users.edit; Users.edit = async function (u, done) {
    const r = await ue.call(this, u, done); if (u) return r; const b = $('#mdBody'); if (!b || $('#plT', b)) return r;
    const T = Plans.tiersOf(this._data), err = $('#ueErr', b); err.insertAdjacentHTML('beforebegin', `<div class="f"><label>💎 Plan, Dates, Time &amp; Left Panel</label>${Plans.box({ tier: 'trial' }, T)}</div>`); Plans.bindBox(b, T, false);
    const ad = this.admin; const me = this;
    const btn = [...$$('#mdFoot button')].find(x => /Add User/.test(x.textContent)); if (btn) btn.addEventListener('click', ev => { const x = Plans.read(b), e = Plans.check(x); if (e) { ev.stopImmediatePropagation(); err.textContent = e; return; } me._addPlan = x; }, true);
    return r;
  };
  const adm = Users.admin; Users.admin = function (op, x) { if (op === 'add' && this._addPlan) { x = Object.assign({}, x, this._addPlan); this._addPlan = null; } return adm.call(this, op, x); };

  /* User link: login answer, live check, sidebar, countdown, My Account */
  const pst = Users.post; Users.post = async function (url, body) {
    const r = await pst.call(this, url, body);
    if (SUD_ED === 'user' && body && (body.fn === 'ulogin' || body.fn === 'ustat') && r) {
      const L = this.link();
      if (r.notyet || r.expired || r.timeup || r.outhours) { const m = Plans.msg(r); if (body.fn === 'ustat') { if (L) L.tok = ''; setTimeout(() => this.out(m), 0); } throw new Error(m); }
      if (L) { L.plan = r.plan || null; L.planAt = Date.now(); Plans._warn = 0; setTimeout(() => Plans.apply(), 0); }
    }
    return r;
  };
  if (SUD_ED === 'user') {
    const og = go; go = function (page, sub) { if (Plans.blocked(page)) { const p = Plans.plan(); UI.toast('🔒 Not part of your ' + Plans.t(p.tier)[1] + ' plan. Ask the SudarshanAshtra Super Admin.', 5000); return; } return og(page, sub); };
    setInterval(() => Plans.timer(), 1000);
    const obs = new MutationObserver(() => { if (Plans._busy || !Plans.plan()) return; clearTimeout(Plans._mt); Plans._mt = setTimeout(() => Plans.apply(), 60); });
    const hook = () => { const s = $('#sidebar'); if (s) obs.observe(s, { childList: true, subtree: true }); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
    const rr = Role.rights; Role.rights = function () { const r = rr.apply(this, arguments), p = Plans.plan(); return p ? Plans.rightsOf(r.join(','), p) : r; };
    const po = Pages.offx; Pages.offx = function (main) { const p = Plans.plan(), H = new Set(p && p.hide || []), hid = t => H.has('offx-item|ox:offx|' + t);
      const ok = ['crime', 'daily', 'good', 'press', 'duty', 'files'].filter(t => !hid(t)); if (p && ok.length && hid(S.sub.offx || 'crime')) S.sub.offx = ok[0];
      const r = po.apply(this, arguments); if (p) $$('.tab[data-t]', main).forEach(x => { if (hid(x.dataset.t)) x.remove(); }); return r; };
    const ra = Role.apply; Role.apply = function () { const r = ra.apply(this, arguments); setTimeout(() => Plans.apply(), 0); return r; };
    const acc = Users.account; Users.account = function () { const r = acc.apply(this, arguments); const p = Plans.plan(), b = $('#mdBody');
      if (p && b) { const tb = $('.ad-kv', b); const ms = Plans.left(); tb && tb.insertAdjacentHTML('beforeend', `<tr><th>Plan</th><td>${Plans.badge(p.tier)} ${Plans.hrs(p.h)}</td></tr>${p.h > 0 ? `<tr><th>Time Left Today</th><td><b>${Plans.mins((ms || 0) / 60000)}</b></td></tr>` : ''}<tr><th>Valid</th><td>${Plans.dmy(p.from) || '…'} → ${Plans.dmy(p.to) || 'no end'}</td></tr><tr><th>Session</th><td>One computer at a time – logging in elsewhere ends this session</td></tr>`); }
      return r; };
  }
})();
