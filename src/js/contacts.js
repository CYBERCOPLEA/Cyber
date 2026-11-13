/* contacts.js – Office › Contacts: Intermediaries (Banking, Social Media, Fintech / Payment Gateway, Merchant, UPI, Telecom, Others)
   and UP Cyber Police (the tool's registered users + police contacts you add). One list, kept on this computer. */
'use strict';
const Contacts = {
  CAT: [['bank', '🏦', 'Banking', '#2563eb', 'int'], ['social', '🌐', 'Social Media', '#db2777', 'int'], ['fintech', '💳', 'Fintech / Payment Gateway', '#7c3aed', 'int'], ['merchant', '🛒', 'Merchant / E-Commerce', '#ea580c', 'int'],
    ['upi', '📲', 'UPI / Wallet', '#16a34a', 'int'], ['telecom', '📡', 'Telecom', '#0891b2', 'int'], ['crypto', '🪙', 'Crypto Exchange', '#ca8a04', 'int'], ['other', '📁', 'Other Intermediary', '#64748b', 'int'],
    ['police', '👮', 'UP Cyber Police', '#1d4ed8', 'pol'], ['opolice', '🚓', 'Other State Police / Agency', '#475569', 'pol'], ['gov', '🏛️', 'Govt. Office / Court', '#0f766e', 'pol']],
  GRP: { int: '🏢 Intermediary', pol: '👮 Police / Govt.' },
  F: [['org', 'Company / Office', 'e.g. Demo Bank Ltd'], ['name', 'Name', 'Nodal / Grievance Officer name'], ['desig', 'Designation', 'Nodal Officer, SHO, Inspector…'], ['mobile', 'Mobile / Phone'], ['email', 'E-mail'], ['portal', 'Portal / Website', 'LE request portal link'], ['address', 'Address'], ['state', 'State'], ['district', 'District'], ['note', 'Note']],
  c(k) { return this.CAT.find(x => x[0] === k) || this.CAT[7]; },
  async list() { return Off.get('contacts', []); },
  /* the tool's registered users = UP Cyber Police (Super Admin link reads them from his own Google Sheet; kept here as a snapshot) */
  async reg(force) {
    let snap = await Off.get('contactsReg', { at: '', L: [] });
    if (Role.admin() && typeof Users !== 'undefined') {
      let d = Users._data; if ((!d || force)) { try { const lv = await Users.live(); if (lv.url && lv.key) d = Users._data = await Users.admin('list', { log: 1 }); } catch (e) { } }
      if (d && d.users) { snap = { at: new Date().toISOString(), L: d.users.map(u => ({ id: 'u:' + u.id, cat: 'police', reg: 1, name: u.name || u.id, desig: u.rank || '', org: u.ps || '', mobile: u.mobile || '', status: u.status || '' })) }; Off.D.contactsReg = snap; await Off.put('contactsReg'); }
    } else { const l = S.settings && S.settings.link; if (l && l.id && !snap.L.some(x => x.id === 'u:' + l.id)) snap = { ...snap, L: [...snap.L, { id: 'u:' + l.id, cat: 'police', reg: 1, name: l.name || l.id, desig: l.rank || '', org: l.ps || '', mobile: l.mobile || '' }] }; }
    return snap;
  },
  st() { return this._s || (this._s = { q: '' }); },
  async page(el, cur) {
    const st = this.st(), L = await this.list(), R = await this.reg(), A = [...L, ...R.L.filter(r => !L.some(x => x.regOf === r.id))];
    const grp = this.CAT.find(x => x[0] === cur) ? null : cur; // 'all' | 'int' | 'pol'
    let V = cur === 'all' ? A : grp ? A.filter(x => this.c(x.cat)[4] === grp) : A.filter(x => x.cat === cur);
    const cnt = k => A.filter(x => x.cat === k).length, ttl = cur === 'all' ? '📇 All Contacts' : grp ? this.GRP[grp] : this.c(cur)[1] + ' ' + this.c(cur)[2];
    el.innerHTML = `<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">${ttl} <span class="badge">${fmtNum(V.length)}</span></h3>
<button class="btn primary" id="ctAdd">➕ Add Contacts</button><button class="btn" id="ctImp" title="Excel / CSV with columns like Category, Company, Name, Designation, Mobile, E-mail">📥 Import Excel</button>
        ${cur === 'police' && Role.admin() ? '<button class="btn" id="ctReg" title="Read the registered users again from your Google Sheet">🔄 Fetch Registered Users</button>' : ''}</div>
      ${cur === 'all' ? `<div class="lr-ks" style="margin-top:12px">${this.CAT.map(([k, ic, l, c]) => `<button class="lr-k ${cur === k ? 'on' : ''}" data-ctc="${k}" style="--c:${c}"><span>${ic}</span><b>${fmtNum(cnt(k))}</b><small>${l}</small></button>`).join('')}</div>` : ''}
      ${cur === 'police' ? `<div class="small muted" style="margin-top:8px">👥 ${R.L.length} registered user(s) of the tool${R.at ? ' · fetched ' + esc(new Date(R.at).toLocaleString('en-IN')) : ''} · plus the police contacts you add.</div>` : ''}</div>
      <div class="card"><div id="ctTb"></div></div>`;
    Table($('#ctTb', el), { rows: V, pageSize: 50, exportName: 'contacts_' + cur, noNd: true, onRow: x => this.edit(x, () => this.page(el, cur)), columns: [
      { key: 'cat', label: 'Category', csv: x => this.c(x.cat)[2], render: x => { const c = this.c(x.cat); return `<span class="tg-sp" style="--c:${c[3]}">${c[1]} ${esc(c[2])}</span>${x.reg ? ' <span class="small muted" title="Registered user of the tool">👤 user</span>' : ''}`; } },
      { key: 'org', label: 'Company / Office', render: x => `<b>${esc(x.org || '')}</b>` }, { key: 'name', label: 'Name' }, { key: 'desig', label: 'Designation' },
      { key: 'mobile', label: 'Mobile', render: x => x.mobile ? `<a href="tel:${esc(x.mobile)}">${esc(x.mobile)}</a>` : '' },
      { key: 'email', label: 'E-mail', render: x => x.email ? String(x.email).split(/[,;\s]+/).filter(Boolean).map(e => `<a href="mailto:${esc(e)}">${esc(e)}</a>`).join('<br>') : '' },
      { key: 'portal', label: 'Portal', render: x => x.portal ? `<a href="${esc(/^https?:/i.test(x.portal) ? x.portal : 'https://' + x.portal)}" target="_blank" rel="noopener">open ↗</a>` : '' },
      { key: 'state', label: 'State / District', csv: x => [x.state, x.district].filter(Boolean).join(', '), render: x => esc([x.district, x.state].filter(Boolean).join(', ')) }, { key: 'note', label: 'Note', render: x => `<span class="small">${esc(x.note || x.status || '')}</span>` }] });
    /* Intermediary / Police tab: its kinds in the same line as the tabs */
    const tb = el.parentElement && $('.tabs', el.parentElement), g2 = grp || (this.CAT.find(x => x[0] === cur) || [])[4];
    if (tb && tb.classList.contains('tabs') && g2 && g2 !== 'all') { tb.insertAdjacentHTML('beforeend', `<span class="ct-sep">›</span>${this.CAT.filter(x => x[4] === g2).map(([k, ic, l, c]) => `<button class="ct-ch ${cur === k ? 'on' : ''}" data-ctc="${k}" style="--c:${c}">${ic} ${esc(l)} <b>${fmtNum(cnt(k))}</b></button>`).join('')}`); }
    $$('[data-ctc]', el.parentElement).forEach(b => b.onclick = () => go('contacts', S.sub.contacts === b.dataset.ctc ? (this.c(b.dataset.ctc)[4]) : b.dataset.ctc));
    $('#ctAdd', el).onclick = () => this.edit({ cat: this.CAT.some(x => x[0] === cur) ? cur : grp === 'pol' ? 'police' : 'bank' }, () => this.page(el, cur));
    $('#ctImp', el).onclick = () => this.imp(() => this.page(el, cur));
    if ($('#ctReg', el)) $('#ctReg', el).onclick = async () => { const r = await this.reg(true); UI.toast(r.L.length + ' registered user(s)'); this.page(el, cur); };
  },
  /* ➕ Add / ✏ Edit – choose the category first */
  edit(x, done) {
    const isNew = !x.id || x.reg, o = x.reg ? { ...x, id: '', reg: 0, regOf: x.id } : { ...x };
    const opt = g => this.CAT.filter(c => c[4] === g).map(([k, ic, l]) => `<option value="${k}" ${o.cat === k ? 'selected' : ''}>${ic} ${l}</option>`).join('');
    const m = UI.modal(x.id && !x.reg ? '✏ Edit Contact' : '➕ Add Contacts', `<div class="map-grid" style="grid-template-columns:1fr 1fr"><label>Category<select id="ctC"><optgroup label="🏢 Intermediary">${opt('int')}</optgroup><optgroup label="👮 Police / Govt.">${opt('pol')}</optgroup></select></label>
      ${this.F.map(([k, l, ph]) => `<label>${l}<input id="ct_${k}" value="${esc(o[k] || '')}" placeholder="${esc(ph || '')}"></label>`).join('')}</div><div class="err" id="ctErr"></div>`,
      [...(x.id && !x.reg ? [{ label: '🗑 Delete', cls: 'danger', onClick: async () => { if (!UI.confirm('Delete this contact?')) return; const L = await this.list(), i = L.findIndex(y => y.id === x.id); if (i >= 0) L.splice(i, 1); await Off.put('contacts'); UI.closeModal(); done && done(); } }] : []),
        { label: 'Cancel', onClick: UI.closeModal }, { label: '💾 Save', cls: 'primary', onClick: async () => {
          const v = k => $('#ct_' + k, m).value.trim(), y = { cat: $('#ctC', m).value }; this.F.forEach(([k]) => y[k] = v(k));
          if (!y.org && !y.name) return $('#ctErr', m).textContent = 'Type the Company / Office or the Name';
          if (y.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+([,;\s]+[^@\s]+@[^@\s]+\.[^@\s]+)*$/.test(y.email)) return $('#ctErr', m).textContent = 'E-mail does not look right';
          const L = await this.list(); if (x.id && !x.reg) Object.assign(L.find(z => z.id === x.id) || {}, y, { at: new Date().toISOString() }); else L.push({ id: uid(), ...y, regOf: o.regOf || undefined, added: new Date().toISOString() });
          await Off.put('contacts'); UI.closeModal(); UI.toast('📇 Contact saved'); done && done(); } }]);
    if (isNew) $('#ct_org', m).focus();
  },
  imp(done) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv,.ods';
    i.onchange = async () => { const f = i.files[0]; if (!f) return; try {
      const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), { type: 'string', raw: true }) : XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }); const L = await this.list(); let a = 0, u = 0;
      const RX = { cat: /categ|type|प्रकार/i, org: /company|bank|office|org|platform|intermediar|कंपनी|कार्यालय/i, name: /^name|officer|नाम/i, desig: /desig|post|rank|पद/i, mobile: /mobile|phone|contact|मोबाइल/i, email: /mail/i, portal: /portal|web|url|link/i, address: /addr|पता/i, state: /state|राज्य/i, district: /district|जनपद|जिला/i, note: /note|remark|टिप्पणी/i };
      for (const sn of wb.SheetNames) { const A = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: false }); const hi = A.findIndex(r => r.filter(c => Object.values(RX).some(re => re.test(String(c)))).length >= 2); if (hi < 0) continue;
        const M = {}; A[hi].forEach((h, j) => { const k = Object.keys(RX).find(k => !(k in M) && RX[k].test(String(h))); if (k) M[k] = j; });
        for (const r of A.slice(hi + 1)) { const y = {}; Object.keys(this.F.reduce((o, [k]) => (o[k] = 1, o), {})).forEach(k => y[k] = M[k] != null ? String(r[M[k]] || '').trim() : ''); if (!y.org && !y.name) continue;
          const ct = String(M.cat != null ? r[M.cat] : '').toLowerCase(), hay = ct + ' ' + y.org.toLowerCase();
          y.cat = (this.CAT.find(c => ct && c[2].toLowerCase().includes(ct.split(/[\s/]/)[0])) || [])[0] || (/bank/.test(hay) ? 'bank' : /police|thana|cyber cell/.test(hay) ? 'police' : /meta|facebook|instagram|whatsapp|google|youtube|telegram|twitter|x corp|snap|social/.test(hay) ? 'social' : /razorpay|cashfree|payu|gateway|fintech|ccavenue|billdesk/.test(hay) ? 'fintech' : /upi|paytm|phonepe|gpay|wallet|mobikwik/.test(hay) ? 'upi' : /airtel|jio|vodafone|vi |bsnl|telecom/.test(hay) ? 'telecom' : /amazon|flipkart|merchant|myntra|meesho/.test(hay) ? 'merchant' : /crypto|binance|wazirx|coin/.test(hay) ? 'crypto' : 'other');
          const o = L.find(z => z.org.toLowerCase() === y.org.toLowerCase() && (z.name || '').toLowerCase() === y.name.toLowerCase());
          if (o) { Object.keys(y).forEach(k => { if (y[k]) o[k] = y[k]; }); u++; } else { L.push({ id: uid(), ...y, added: new Date().toISOString() }); a++; } } }
      if (!a && !u) return UI.toast('No Company / Name column found in the file'); await Off.put('contacts'); UI.toast(`📇 ${a} added · ${u} updated`, 4000); done && done(); } catch (e) { UI.toast('Could not read: ' + e.message); } };
    i.click();
  }
};
PAGE_META.contacts = { group: 'Office', title: 'Contacts', desc: 'Intermediaries (bank, social media, fintech / payment gateway, merchant, UPI, telecom) and UP Cyber Police – nodal officers, e-mails, portals and phone numbers in one place.', order: ['all', 'int', 'pol', ...Contacts.CAT.map(x => x[0])], names: Object.fromEntries([['all', '📇 All'], ['int', '🏢 Intermediary'], ['pol', '👮 Police / Govt.'], ...Contacts.CAT.map(x => [x[0], x[1] + ' ' + x[2]])]) };
Pages.contacts = main => { if (!Role.can('contacts')) { main.innerHTML = '<div class="card" style="margin:20px"><h3>🔒 Contacts</h3><p class="muted">The Super Admin has not given you Contacts. Ask Vijay Tomar if you need it.</p></div>'; return; }
  const sb = S.sub.contacts || 'all', c = Contacts.CAT.find(x => x[0] === sb), { cur, body } = tabs(main, 'contacts', [['all', '📇 All'], ['int', '🏢 Intermediary'], ['pol', '👮 Police / Govt.']], 'Contacts');
  if (c) { $$('.tab', main).forEach(t => t.classList.toggle('active', t.dataset.t === c[4])); } Contacts.page(body, c ? sb : cur); };
/* sidebar: 📇 Contacts drop-down right after Office Work, then ➕ Add Contacts */
(() => {
  const nav = $('#sidebar'), ox = nav && $('.offx-subs', nav); if (!ox) return;
  const SUB = [['all', 'All Contacts', '#6366f1'], ['add', '+ Add Contacts', '#16a34a']];
  ox.insertAdjacentHTML('afterend', `<div class="nav-item ct-item" title="Contacts: intermediaries (bank, social media, fintech, merchant, UPI…) and UP Cyber Police" style="--c:#6366f1"><span class="nib">📇</span><span>Contacts</span><span class="nav-chev">▾</span></div><div class="nav-subs ct-subs">${SUB.map(([s, l, c], i) => `<div class="nav-sub" data-ctn="${s}" style="--pc:${c}" ${s === 'add' ? 'title="Add a contact – choose Intermediary / Police category"' : ''}><i></i><span>${i + 1}. ${l}</span></div>`).join('')}</div>`);
  const it = $('.ct-item', nav), subs = $('.ct-subs', nav), setOpen = on => { S.ctOpen = on; subs.classList.toggle('open', on); it.classList.toggle('open', on); };
  setOpen(false); it.addEventListener('click', e => { e.stopImmediatePropagation(); setOpen(!S.ctOpen); }, true);
  $$('[data-ctn]', subs).forEach(n => n.onclick = n.dataset.ctn === 'add' ? null : () => go('contacts', 'all'));
  $('[data-ctn="add"]', subs).addEventListener('click', e => { e.stopImmediatePropagation(); if (!Role.can('contacts')) return Role.deny('add Contacts'); Contacts.edit({ cat: S.page === 'contacts' && Contacts.CAT.some(x => x[0] === S.sub.contacts) ? S.sub.contacts : 'bank' }, () => { if (S.page === 'contacts') render(); else go('contacts', 'all'); }); }, true);
  const or = render; render = function () { const r = or.apply(this, arguments);
    $$('[data-ctn]', subs).forEach(n => n.classList.toggle('active', S.page === 'contacts' && n.dataset.ctn === 'all'));
    const on = S.page === 'contacts'; it.classList.toggle('active', on); if (on && !S.ctOpen) setOpen(true); return r; };
})();
