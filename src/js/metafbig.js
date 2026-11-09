/* metafbig.js – Social Media › Facebook & Instagram: read Meta LE replies (records.html, PDF print)
   – request parameters, NCMEC, registration date / IP, creator, vanity, names, e-mails, phones, IP addresses,
   basic info – and find common identifiers across Facebook, Instagram, WhatsApp, Google, bank, KYC and NCRP */
'use strict';

const MReply = {
  KEYS: ['service', 'internal ticket number', 'target', 'alternate target ids', 'account identifier', 'account type', 'generated', 'date range',
    'ncmec reports', 'ncmec cybertips', 'creator', 'registration date', 'registration ip', 'account closure date', 'account end date', 'account still active', 'time', 'reason',
    'ip addresses', 'ip address', 'identifiers', 'vanity', 'vanity name', 'profile uri', 'emails', 'registered email addresses', 'verified emails', 'unverified emails', 'primary email', 'email',
    'names', 'name', 'first name', 'last name', 'middle name', 'full name', 'first', 'last', 'alternate names', 'alternate name', 'type',
    'phone numbers', 'verified phone numbers', 'unverified phone numbers', 'phone type', 'phone number', 'basic info', 'url', 'updated', 'creation date',
    'threads registration date', 'date of birth', 'birthday', 'gender', 'city', 'current city', 'hometown', 'location', 'websites', 'website', 'devices', 'device', 'linked accounts'],
  SECTIONS: { 'ncmec reports': 'ncmec', 'account closure date': 'closure', 'account end date': 'closure', 'ip addresses': 'ips', identifiers: 'ids', emails: 'emails', 'registered email addresses': 'emails',
    names: 'names', 'alternate names': 'altnames', 'phone numbers': 'phones', 'basic info': 'basic', 'registration ip': 'reg', 'registration date': 'reg', creator: 'reg', 'vanity name': 'ids', 'profile uri': 'ids', 'threads registration date': 'reg' },
  plat: s => /instagram/i.test(s) ? 'instagram' : 'facebook',
  PL: { facebook: ['Facebook', '#1877F2', 'f'], instagram: ['Instagram', '#E4405F', '◎'] },

  parse(text, file) {
    const F = WReply.fields(text, this.KEYS, this.SECTIONS), recs = []; let a = null, ip = null, sub = '', alt = null;
    const A = () => { if (!a) { a = { kind: 'Account', platform: this.plat(file + ' ' + text.slice(0, 600)), _src: file, _f: [], phones: [], emails: [], names: [] }; recs.push(a); } return a; };
    for (const [k, v, s] of F) {
      if ((k === 'service' || k === 'target') && a && a.target && (k === 'service' || a.service)) { a = null; ip = null; }
      const r = A();
      if (k === 'service') { r.service = v; r.platform = this.plat(v || r.platform); }
      if (!/^(ip address|time)$/.test(k) || s !== 'ips') r._f.push([k, v || (s === 'ips' ? '' : 'No responsive records')]);
      if (k === 'verified phone numbers' || k === 'unverified phone numbers' || k === 'verified emails' || k === 'unverified emails' || k === 'primary email') { sub = k.split(' ')[0]; continue; }
      if (['phone numbers', 'emails', 'registered email addresses'].includes(k)) sub = '';
      const set = f => { if (v && !r[f]) r[f] = v; };
      switch (k) {
        case 'internal ticket number': set('ticket'); continue;
        case 'target': set('target'); continue;
        case 'alternate target ids': set('alt_targets'); continue;
        case 'account identifier': set('account_id'); continue;
        case 'account type': set('acct_type'); continue;
        case 'generated': set('generated'); continue;
        case 'date range': set('date_range'); continue;
        case 'ncmec cybertips': case 'ncmec reports': if (v) r.ncmec = v; else r.ncmec_none = 1; continue;
        case 'creator': set('creator'); continue;
        case 'registration date': set('reg_date'); continue;
        case 'registration ip': set('reg_ip'); continue;
        case 'account still active': r.active = v; continue;
        case 'vanity': case 'vanity name': set('vanity'); continue;
        case 'profile uri': set('profile_uri'); continue;
        case 'threads registration date': set('threads_reg'); continue;
        case 'url': set('url'); continue;
        case 'updated': set('updated'); continue;
        case 'creation date': set('created'); continue;
        case 'first name': case 'first': set('first'); continue;
        case 'last name': case 'last': r.last = v; continue;
        case 'middle name': r.middle = v; continue;
        case 'full name': r.full = v; continue;
        case 'alternate name': if (v) r.names.push(v + (alt ? ' (' + alt + ')' : '')); continue;
        case 'date of birth': case 'birthday': set('dob'); continue;
        case 'gender': set('gender'); continue;
        case 'city': case 'current city': case 'hometown': case 'location': if (v) r.location = [r.location, v].filter(Boolean).join('; '); continue;
        case 'websites': case 'website': set('website'); continue;
      }
      if (k === 'type') { if (s === 'altnames') alt = v; else if (s === 'phones') r._ptype = v; continue; }
      if (k === 'name') { if (s === 'basic' && v) r.page_name = v; else if (v) r.names.push(v); continue; }
      if (k === 'time') { if (s === 'closure') r.closed = v; else if (s === 'ips' && ip) { ip.ts = GReply.ts(v); ip.ist = GReply.ist(ip.ts); } continue; }
      if (k === 'reason') { if (s === 'closure') r.closed_reason = v; continue; }
      if (k === 'ip address' && s === 'ips') { if (!v) continue; const [i, p] = WReply.splitIp(v); ip = { kind: 'IP', platform: r.platform, acct: '', ip: i.toLowerCase(), port: p, _src: file, _f: [['IP address', v]] }; recs.push(ip); continue; }
      if (k === 'phone number' || k === 'phone numbers') { this.phones(v, sub).forEach(x => r.phones.push(x)); continue; }
      if (k === 'email' || k === 'registered email addresses' || k === 'emails') { this.emails(v, sub).forEach(x => r.emails.push(x)); continue; }
    }
    // tidy each account and give child records its key
    for (const r of recs.filter(x => x.kind === 'Account')) {
      r.name = r.full || [r.first, r.middle, r.last].filter(Boolean).join(' ') || r.page_name || r.names[0] || '';
      if (r.page_name && r.page_name !== r.name) r.names.unshift(r.page_name);
      r.names = uniq(r.names.filter(n => n !== r.name)).join(', ');
      if (!r.vanity && r.account_id) { const m = r.account_id.match(/(?:facebook|instagram)\.com\/(?!profile\.php|uid\/)([\w.]+)/i); if (m) r.vanity = m[1]; }
      r.acct = (r.vanity || r.target || r.account_id || r._src) + '';
      r.label = (r.vanity || r.name || r.target) + ' · ' + this.PL[r.platform][0];
      r.phone_list = r.phones.map(p => p.mobile + (p.status ? ' (' + p.status + (p.on ? ' ' + p.on : '') + ')' : '')).join(', ');
      r.email_list = r.emails.map(e => e.email + (e.status ? ' (' + e.status + (e.on ? ' ' + e.on : '') + ')' : '')).join(', ');
      r.creator_id = ((r.creator || '').match(/\((\d{6,})\)/) || [])[1] || '';
      const [ri] = WReply.splitIp(r.reg_ip || ''); r.reg_ip_only = ri && /[\d.:]/.test(ri) ? ri.toLowerCase() : '';
      delete r._ptype;
    }
    let owner = null;
    for (const x of recs) { if (x.kind === 'Account') owner = x; else if (owner) { x.acct = owner.acct; x.platform = owner.platform; } }
    // registration and account-closure as dated events
    for (const r of recs.filter(x => x.kind === 'Account')) {
      const ev = (t, what, extra) => { const ts = GReply.ts(t); if (ts) recs.push({ kind: 'Event', platform: r.platform, acct: r.acct, activity: what, ts, ist: GReply.ist(ts), _src: r._src, _f: [[what, t]], ...extra }); };
      ev(r.reg_date, 'Registered', r.reg_ip_only ? { ip: r.reg_ip_only } : {}); ev(r.closed, 'Account closed' + (r.closed_reason ? ' (' + r.closed_reason + ')' : '')); ev(r.threads_reg, 'Threads registered');
      r.phones.filter(p => p.on).forEach(p => ev(p.on, 'Phone verified', { mobile: p.mobile }));
      r.emails.filter(e => e.on).forEach(e => ev(e.on, 'E-mail verified', { email: e.email }));
      const ips = recs.filter(x => x.kind === 'IP' && x.acct === r.acct);
      r.ip_n = ips.length; r.ip_u = uniq(ips.map(x => x.ip)).length; const t = ips.map(x => x.ist).filter(Boolean).sort(); r.first_ip = t[0] || ''; r.last_ip_t = t[t.length - 1] || '';
      r.last_ip = (ips.find(x => x.ist === r.last_ip_t) || {}).ip || ''; r.last_port = (ips.find(x => x.ist === r.last_ip_t) || {}).port || '';
    }
    return recs;
  },
  phones(v, sub) {
    return String(v || '').split(/,\s*(?=\+?\d)/).map(x => x.trim()).filter(Boolean).map(x => {
      const num = (x.match(/\+?\d[\d\s-]{7,}\d/) || [''])[0].replace(/[\s-]/g, ''); if (!num) return null;
      const st = /unverified/i.test(x) ? 'Unverified' : /verified/i.test(x) ? 'Verified' : sub ? sub[0].toUpperCase() + sub.slice(1) : '';
      return { mobile: WReply.mob(num) || num, raw: num, status: st, type: (x.match(/\b(cell|mobile|landline|home|work)\b/i) || [''])[0], on: (x.match(/\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?: UTC)?/) || [''])[0] };
    }).filter(Boolean);
  },
  emails(v, sub) {
    const out = []; String(v || '').split(/,\s*(?=[\w.%+-]+@)/).forEach(x => (x.match(RX.email) || []).forEach(e => out.push({ email: e.toLowerCase(), status: /unverified/i.test(x) ? 'Unverified' : /verified/i.test(x) ? 'Verified' : sub ? sub[0].toUpperCase() + sub.slice(1) : '', on: (x.match(/\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?: UTC)?/) || [''])[0] })));
    return out;
  },

  TYPES: [['mobile', '📱 Mobile'], ['email', '✉ Email'], ['ip', '🌐 IP address'], ['regip', '🆕 Registration IP'], ['username', '👤 Username / vanity'], ['name', '🏷 Name'], ['metaid', '🆔 Meta ID / target'], ['url', '🔗 URL'],
    ['location', '📍 Location'], ['date', '📅 Date'], ['hour', '🕐 Hour (IST)'], ['iptype', '🛰 IP type']],
  ids(r) {
    if (r._ids) return r._ids;
    const out = new Map(), add = (t, v) => { v = String(v || '').trim(); if (v && v.length < 200) out.set(t + '|' + v.toLowerCase(), [t, v]); };
    if (r.kind === 'Account') {
      r.phones.forEach(p => add('mobile', p.mobile)); r.emails.forEach(e => add('email', e.email));
      if (r.reg_ip_only) { add('ip', r.reg_ip_only); add('regip', r.reg_ip_only); }
      if (r.vanity) add('username', r.vanity.toLowerCase());
      [r.name, ...String(r.names || '').split(/,\s*/)].map(n => n.replace(/\s*\(.*\)$/, '')).filter(Boolean).forEach(n => add('name', n.toUpperCase()));
      [r.target, ...String(r.alt_targets || '').split(/[,;\s]+/), r.creator_id].filter(x => /^\d{6,}$/.test(x || '')).forEach(x => add('metaid', x));
      [r.account_id, r.profile_uri, r.url, r.website].filter(x => /^https?:/i.test(x || '')).forEach(u => add('url', u.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')));
      if (r.location) add('location', r.location.toUpperCase());
    }
    if (r.kind === 'IP') { add('ip', r.ip); add('iptype', V.ipKind(r.ip)); }
    if (r.kind === 'Event') { if (r.ip) add('ip', r.ip); if (r.mobile) add('mobile', r.mobile); if (r.email) add('email', r.email); }
    if (r.ist) { add('date', r.ist.slice(0, 10)); if (r.ist.length > 10) add('hour', r.ist.slice(11, 13) + ':00'); }
    return (r._ids = [...out.values()]);
  }
};

const MData = {
  all() { if (!S.data.meta) S.data.meta = []; return S.data.meta; },
  mine(pl) { return this.all().filter(r => r.platform === pl); },
  async importFiles(list, pl) {
    const files = await GReply.files([...list]); const done = [];
    for (const f of files) {
      try { const { text } = await GReply.read(f); const recs = MReply.parse(text, f.name); if (!recs.some(r => r.kind === 'Account' && (r.target || r.account_id))) throw new Error('not a Facebook / Instagram records file');
        recs.forEach(r => r.id = uid()); this.all().push(...recs); done.push([f.name, recs.length, recs[0].platform]);
        S.data.imports.push({ id: uid(), when: new Date().toISOString(), file: f.name, type: recs[0].platform, count: recs.length }); }
      catch (e) { done.push([f.name, 'Error: ' + (e.message || e)]); }
    }
    saveCase(); return done;
  },
  removeFile(name) { S.data.meta = this.all().filter(r => r._src !== name); S.data.imports = S.data.imports.filter(i => !(/facebook|instagram/.test(i.type) && i.file === name)); saveCase(); },
  elsewhere() {
    return Analysis.cached('m:else', () => { const m = new Map(); try { Analysis.idents().filter(x => !x.meta).forEach(x => { const k = x.type + '|' + String(x.value).toLowerCase(); if (!m.has(k)) m.set(k, new Set()); m.get(k).add(x.label || x.section); }); } catch (e) { } return m; });
  },
  // common values across ALL Facebook + Instagram records (the same person often has both)
  common(type) {
    return Analysis.cached('m:c:' + type, () => {
      const G = new Map();
      for (const r of this.all()) for (const [t, v] of MReply.ids(r)) { if (t !== type) continue; const k = v.toLowerCase(); let g = G.get(k); if (!g) G.set(k, g = { value: v, n: 0, accts: new Set(), plats: new Set(), kinds: new Set(), times: [], recs: [] }); g.n++; g.accts.add(r.acct + ' · ' + MReply.PL[r.platform][0]); g.plats.add(MReply.PL[r.platform][0]); g.kinds.add(r.kind === 'Event' ? r.activity : r.kind); if (r.ist) g.times.push(r.ist); g.recs.push(r); }
      const EL = this.elsewhere(), map = { mobile: 'mobile', email: 'email', ip: 'ip', regip: 'ip', username: 'username' };
      return [...G.values()].map(g => { g.times.sort(); const el = map[type] ? EL.get(map[type] + '|' + g.value.toLowerCase()) : null; return { value: g.value, n: g.n, accts: g.accts.size, acctList: [...g.accts].join(', '), plats: [...g.plats].join(' + '), kinds: [...g.kinds].join(', '), first: g.times[0] || '', last: g.times[g.times.length - 1] || '', also: el ? [...el].join(', ') : '', recs: g.recs }; });
    });
  },
  view(r) { const o = { platform: MReply.PL[r.platform][0], kind: r.kind === 'Event' ? r.activity : r.kind, account: r.acct };
    for (const k of ['ist', 'ip', 'port', 'name', 'target', 'account_id', 'acct_type', 'reg_date', 'reg_ip', 'creator', 'phone_list', 'email_list', 'mobile', 'email', 'vanity', 'active', 'closed']) if (r[k]) o[{ ist: 'time (IST)', phone_list: 'phones', email_list: 'e-mails', reg_date: 'registration date', reg_ip: 'registration IP', account_id: 'account identifier', acct_type: 'account type', active: 'still active' }[k] || k] = r[k];
    if (r.ip) o['IP type'] = V.ipKind(r.ip); o.file = r._src; return o; }
};

/* ---------- page ---------- */
PAGE_META.msocial = { group: 'Investigation › Social Media', title: 'Facebook & Instagram (Meta LE reply)', desc: 'Meta records for Facebook profiles / pages and Instagram accounts: target, registration date & IP, creator, vanity, names, verified phones and e-mails, IP addresses with port. Common values are matched across Facebook, Instagram, WhatsApp, Google and the rest of the case.',
  order: ['msum', 'macc', 'mip', 'mcon', 'mcom', 'mtime', 'mcsv', 'mfiles'] };

const MTabs = {
  pl() { return S.socPlat === 'instagram' ? 'instagram' : 'facebook'; },
  page(main) {
    const pl = this.pl(), [PN, PC] = MReply.PL[pl], d = MData.mine(pl), c = k => d.filter(r => r.kind === k).length, A = d.filter(r => r.kind === 'Account'), csv = Analysis.socRows();
    PAGE_META.msocial.title = PN + ' (Meta LE reply)';
    const { cur, body } = tabs(main, 'msocial', [['msum', '📊 Overview'], ['macc', `👤 Accounts (${A.length})`], ['mip', `🌐 IP Activity (${c('IP')})`], ['mcon', `📱 Phones & E-mails (${sum(A, a => a.phones.length + a.emails.length)})`],
      ['mcom', '⚑ Common'], ['mtime', '🕐 Date & Time'], ['mcsv', `📋 Other ${PN} rows (${csv.length})`], ['mfiles', '📁 Files']], PN,
      `<button class="btn primary" id="mImp" style="background:${PC}">⬆ Import ${PN} reply</button><input type="file" id="mPick" class="hidden" multiple accept=".html,.htm,.txt,.pdf,.zip,.rar,.json">`);
    GTabs.bar(main, body);
    $('#mImp').onclick = () => this.pick(); $('#mPick').onchange = e => this.load(e.target.files);
    if (!d.length && !['mfiles', 'mcsv'].includes(cur)) return this.empty(body, csv.length);
    this[cur](body, d);
  },
  pick() { const fp = $('#mPick'); fp.value = ''; fp.click(); },
  async load(files) {
    if (!files || !files.length) return; UI.toast('Reading ' + files.length + ' file(s)…');
    const done = await MData.importFiles(files); Analysis.invalidate();
    const ok = done.filter(x => typeof x[1] === 'number'), bad = done.length - ok.length, other = ok.filter(x => x[2] !== this.pl());
    UI.toast(`${ok.length} file(s) read, ${fmtNum(sum(ok, x => x[1]))} records` + (other.length ? ` · ${other.length} went to ${MReply.PL[other[0][2]][0]}` : '') + (bad ? ` · ${bad} failed` : ''));
    render();
  },
  drop(el) {
    const [PN, PC, PI] = MReply.PL[this.pl()];
    el.innerHTML = `<div class="g-drop" id="mDrop"><div class="g-dl" style="background:${PC}">${PI}</div><b>Drop ${PN} reply files here</b><span>or click to choose · records.html, the .zip / .rar from Meta, or a PDF print. Facebook and Instagram files are sorted automatically.</span>
      <div class="g-kinds"><i style="--k:${PC}">Request parameters</i><i style="--k:#16a34a">Registration date &amp; IP</i><i style="--k:#f59e0b">Phones &amp; e-mails</i><i style="--k:#0ea5e9">IP addresses &amp; port</i><i style="--k:#a855f7">Vanity · names · basic info</i></div></div>`;
    const dz = $('#mDrop', el); dz.onclick = () => this.pick();
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); this.load(e.dataTransfer.files); };
  },
  empty(el, csvN) {
    const PN = MReply.PL[this.pl()][0];
    el.innerHTML = `<div class="card"><h3>No ${PN} reply in this case yet</h3><div class="sub">Import the records.html files Meta sends (you can drop the whole .zip or .rar). Everything is read on this computer only.${csvN ? ` You also have <b>${csvN}</b> ${PN} row(s) from a CSV / Excel import in the <b>Other ${PN} rows</b> tab.` : ''}</div><div id="mD"></div>
      <div class="g-help"><div><b style="color:${MReply.PL[this.pl()][1]}">Request parameters</b> Service, Target, Alternate Target IDs, Account Identifier, Account Type, Generated, Date Range, NCMEC CyberTips</div>
      <div><b style="color:#16a34a">Registration</b> Registration date, Registration IP, Creator (pages), Account still active / closure</div>
      <div><b style="color:#f59e0b">Contacts</b> Registered e-mail addresses and phone numbers, verified / unverified with date</div>
      <div><b style="color:#0ea5e9">IP addresses</b> Every login IP with source port and time</div>
      <div><b style="color:#a855f7">Identity</b> Vanity name, profile URI, names, alternate names, basic info (page name, URL, created)</div></div></div>`;
    this.drop($('#mD', el));
  },
  kv: (...a) => GTabs.kv(...a), t: v => WTabs.t(v),

  msum(el, d) {
    const pl = this.pl(), A = d.filter(r => r.kind === 'Account'), I = d.filter(r => r.kind === 'IP'), ipu = uniq(I.map(r => r.ip));
    const shared = MReply.TYPES.reduce((s, [t]) => s + (['date', 'hour', 'iptype'].includes(t) ? 0 : MData.common(t).filter(g => g.accts >= 2 || g.also).length), 0);
    const ph = A.flatMap(a => a.phones), em = A.flatMap(a => a.emails);
    el.innerHTML = UI.kpis([['Accounts', fmtNum(A.length), uniq(A.map(a => a.acct_type).filter(Boolean)).join(', ') || '—', 'c2'], ['IP events', fmtNum(I.length), ipu.length + ' unique IPs', 'c4'], ['Phones', fmtNum(ph.length), ph.filter(p => p.status === 'Verified').length + ' verified', 'c5'],
      ['E-mails', fmtNum(em.length), em.filter(e => e.status === 'Verified').length + ' verified', 'c3'], ['Registration IPs', fmtNum(A.filter(a => a.reg_ip_only).length), A.filter(a => a.reg_date).length + ' registration dates', 'c6'], ['Common / cross-linked', fmtNum(shared), 'Facebook + Instagram + WhatsApp / Google / bank / KYC / NCRP', 'c1']]) +
      `<div class="card"><h3>Accounts at a glance</h3><div class="sub">Click a row for every field</div><div id="ms0"></div></div>
      <div class="grid g2"><div class="card"><h3>Logins per day (IST)</h3><div id="ms1"></div></div><div class="card"><h3>Hour of day (IST)</h3><div class="sub">When the account is used</div><div id="ms2"></div></div>
      <div class="card"><h3>Top IP addresses</h3><div id="ms3"></div></div><div class="card"><h3>IP type</h3><div class="sub">IPv6 / IPv4 / CGNAT – CGNAT needs port + exact time for the ISP</div><div id="ms4"></div></div></div>`;
    Table($('#ms0', el), { rows: A, exportName: pl + '_accounts', columns: [{ key: 'label', label: 'Account', render: r => `<b>${esc(r.vanity || r.target || '')}</b><div class="muted small">${esc(r.acct_type || '')}</div>` }, { key: 'name', label: 'Name' }, { key: 'target', label: 'Target ID', render: r => `<span class="mono">${esc(r.target || '')}</span>` }, { key: 'reg_date', label: 'Registered (IST)', render: r => esc(r.reg_date ? GReply.ist(GReply.ts(r.reg_date)) : '') }, { key: 'reg_ip', label: 'Registration IP', render: r => `<span class="mono">${esc(r.reg_ip || '')}</span>` },
      { key: 'phone_list', label: 'Phones' }, { key: 'email_list', label: 'E-mails' }, { key: 'ip_n', label: 'IP events', num: true }, { key: 'last_ip_t', label: 'Last IP time (IST)' }, { key: 'active', label: 'Active', render: r => r.active ? `<span class="badge ${/true/i.test(r.active) ? 'good' : 'warn'}">${/true/i.test(r.active) ? 'Active' : 'Closed'}</span>` : '' }], onRow: r => Records.show(r.label, [MData.view(r)]) });
    const E = d.filter(r => r.kind === 'IP' && r.ist), days = groupBy(E, r => r.ist.slice(0, 10));
    Charts.line($('#ms1', el), [...days.keys()].sort().map(k => ({ label: k, value: days.get(k).length, recs: days.get(k).map(MData.view) })), { fmt: v => v + (v === 1 ? ' login' : ' logins') });
    Charts.vbar($('#ms2', el), Array.from({ length: 24 }, (_, h) => { const recs = E.filter(r => r.ist.length > 10 && +r.ist.slice(11, 13) === h); return { label: String(h).padStart(2, '0'), value: recs.length, recs: recs.map(MData.view) }; }), { fmt: v => v + (v === 1 ? ' login' : ' logins') });
    const g = groupBy(I, r => r.ip); Charts.hbar($('#ms3', el), [...g].map(([k, v]) => ({ label: k, value: v.length, sub: V.ipKind(k), recs: v.map(MData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' time' : ' times'), max: 10 });
    const t = groupBy(I, r => V.ipKind(r.ip)); Charts.hbar($('#ms4', el), [...t].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(MData.view) })), { fmt: v => v + (v === 1 ? ' event' : ' events') });
  },

  macc(el, d) {
    const A = d.filter(r => r.kind === 'Account'), [, PC, PI] = MReply.PL[this.pl()];
    el.innerHTML = `<div class="g-cards">${A.map(a => `<div class="g-card" style="--gc:${PC}"><div class="g-ch"><span class="g-av" style="background:${PC}">${PI}</span><div><b>${esc(a.name || a.vanity || '(name not given)')}</b><small>${esc([a.vanity && '@' + a.vanity, a.acct_type].filter(Boolean).join(' · '))}</small></div><span class="spacer"></span>${a.active ? `<span class="badge ${/true/i.test(a.active) ? 'good' : 'warn'}">${/true/i.test(a.active) ? 'Account active' : 'Account closed' + (a.closed ? ' ' + esc(GReply.ist(GReply.ts(a.closed))) + ' IST' : '')}</span>` : ''}</div>
      <div class="w-sec" style="color:${PC}">Request parameters</div>
      <div class="g-grid">${this.kv('Service', a.service)}${this.kv('Target', a.target, 'gh')}${this.kv('Alternate target IDs', a.alt_targets, 'gh')}${this.kv('Account identifier', a.account_id, 'wide gh')}${this.kv('Account type', a.acct_type)}${this.kv('Internal ticket no.', a.ticket)}${this.kv('Generated', this.t(a.generated))}${this.kv('Date range', a.date_range, 'wide')}${this.kv('NCMEC CyberTips', a.ncmec || (a.ncmec_none ? 'No responsive records' : ''))}</div>
      <div class="w-sec" style="color:${PC}">Registration</div>
      <div class="g-grid">${this.kv('Registration date', this.t(a.reg_date) || 'No responsive records')}${this.kv('Registration IP', a.reg_ip || 'No responsive records', a.reg_ip ? 'gh' : '')}${a.reg_ip_only ? this.kv('Registration IP type', V.ipKind(a.reg_ip_only)) : ''}${this.kv('Creator', a.creator, 'wide gh')}${this.kv('Account still active', a.active)}${this.kv('Closed on', this.t(a.closed))}${this.kv('Closure reason', a.closed_reason)}${this.kv('Threads registration date', a.threads_reg)}</div>
      <div class="w-sec" style="color:${PC}">Identity</div>
      <div class="g-grid">${this.kv('Vanity name', a.vanity, 'gh')}${this.kv('Profile URI', a.profile_uri, 'wide')}${this.kv('Name', a.name, 'gh')}${this.kv('Other / alternate names', a.names, 'wide')}${this.kv('URL', a.url, 'wide')}${this.kv('Page updated', a.updated)}${this.kv('Page created', a.created)}${this.kv('Date of birth', a.dob)}${this.kv('Gender', a.gender)}${this.kv('Location', a.location)}${this.kv('Website', a.website)}</div>
      <div class="w-sec" style="color:${PC}">Phones, e-mails &amp; IP</div>
      <div class="g-grid">${this.kv('Phone numbers', a.phone_list || 'No responsive records', a.phone_list ? 'wide gh' : 'wide')}${this.kv('Registered e-mail addresses', a.email_list || 'No responsive records', a.email_list ? 'wide gh' : 'wide')}${this.kv('IP events', a.ip_n ? a.ip_n + ' (' + a.ip_u + ' unique)' : '')}${this.kv('First → last IP (IST)', a.first_ip && a.first_ip + ' → ' + a.last_ip_t, 'wide')}${this.kv('Last IP', a.last_ip && a.last_ip + (a.last_port ? ' port ' + a.last_port : ''), 'gh')}</div>
      ${a.last_ip ? `<div class="note small" style="margin-top:8px">ISP request: IP <b class="mono">${esc(a.last_ip)}</b>${a.last_port ? ' port <b>' + esc(a.last_port) + '</b>' : ''} at <b>${esc(a.last_ip_t)} IST</b>${a.reg_ip_only ? ` · registration IP <b class="mono">${esc(a.reg_ip_only)}</b> at <b>${esc(GReply.ist(GReply.ts(a.reg_date)) || '—')} IST</b>` : ''}. Port and exact time are needed for IPv6 / shared IPs.</div>` : ''}
      <details><summary>All ${a._f.length} fields · ${esc(a._src)}</summary><div class="g-all">${a._f.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v || '—')}</b>`).join('')}</div></details></div>`).join('')}</div>`;
  },

  mip(el, d) {
    const I = d.filter(r => r.kind === 'IP' || r.kind === 'Event' && r.ip);
    if (!I.length) { el.innerHTML = '<div class="card muted">No IP addresses in the imported files.</div>'; return; }
    const EL = MData.elsewhere(), rows = [...groupBy(I, r => r.ip)].map(([ip, v]) => { const t = v.map(x => x.ist).filter(Boolean).sort(); return { ip, n: v.length, type: V.ipKind(ip), ports: uniq(v.map(x => x.port).filter(Boolean)).length, accts: uniq(v.map(x => x.acct)).join(', '), first: t[0] || '', last: t[t.length - 1] || '', reg: v.some(x => x.kind === 'Event') ? 'Yes' : '', also: (x => x ? [...x].join(', ') : '')(EL.get('ip|' + ip)), recs: v }; });
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Logins by weekday</h3><div id="mi1"></div></div><div class="card"><h3>IPv6 prefix (first 4 blocks = same home / mobile network)</h3><div class="sub">Many IPv6 addresses with one prefix usually mean one connection</div><div id="mi2"></div></div></div>
      <div class="card"><h3>Unique IP addresses</h3><div class="sub"><b>⚑ Also in case</b> = the IP also appears in WhatsApp, Google, bank or other data</div><div id="miU"></div></div>
      <div class="card"><h3>Every IP event</h3><div class="sub">Times from Meta are UTC; IST adds 5 h 30 min. Send ISP requests with IP, port, exact time and time zone.</div><div id="miT"></div></div>`;
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], E = I.filter(r => r.ist);
    Charts.vbar($('#mi1', el), wd.map((w, i) => { const recs = E.filter(r => new Date(r.ist.slice(0, 10)).getDay() === i); return { label: w, value: recs.length, recs: recs.map(MData.view) }; }), { fmt: v => v + (v === 1 ? ' login' : ' logins') });
    const pf = groupBy(I.filter(r => r.ip.includes(':')), r => r.ip.split(':').slice(0, 4).join(':') + '::/64');
    Charts.hbar($('#mi2', el), [...pf].map(([k, v]) => ({ label: k, value: v.length, sub: uniq(v.map(x => x.ip)).length + ' IPs', recs: v.map(MData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' event' : ' events'), max: 10 });
    if (!pf.size) $('#mi2', el).innerHTML = '<div class="muted small">No IPv6 addresses.</div>';
    Table($('#miU', el), { rows: rows.sort((a, b) => (b.also ? 1 : 0) - (a.also ? 1 : 0) || b.n - a.n), exportName: this.pl() + '_unique_ips', columns: [{ key: 'ip', label: 'IP address', render: r => `<b class="mono ipv">${esc(r.ip)}</b>` }, { key: 'type', label: 'Type' }, { key: 'n', label: 'Times', num: true }, { key: 'ports', label: 'Ports', num: true }, { key: 'first', label: 'First (IST)' }, { key: 'last', label: 'Last (IST)' }, { key: 'reg', label: 'Registration IP' }, { key: 'accts', label: 'Account' }, { key: 'also', label: 'Also in case', render: r => r.also ? `<span class="badge warn">⚑ ${esc(r.also)}</span>` : '' }], onRow: r => Records.show('IP ' + r.ip, r.recs.map(MData.view)) });
    Table($('#miT', el), { rows: I, exportName: this.pl() + '_ip_events', sortKey: 'ist', sortDir: -1, columns: [{ key: 'ist', label: 'Time (IST)', render: r => `<span class="mono">${esc(r.ist || '')}</span>` }, { key: 'ts', label: 'Time (UTC)', render: r => `<span class="mono muted">${esc(r.ts ? r.ts.replace('T', ' ').replace('Z', '') : '')}</span>` }, { key: 'ip', label: 'IP address', render: r => `<b class="mono ipv">${esc(r.ip)}</b>` }, { key: 'port', label: 'Port', render: r => `<span class="mono nowrap">${esc(r.port || '')}</span>` }, { key: 'ipk', label: 'Type', render: r => esc(V.ipKind(r.ip)) }, { key: 'activity', label: 'Event', render: r => esc(r.activity || 'Login / activity') }, { key: 'acct', label: 'Account' }, { key: '_src', label: 'File' }], onRow: r => Records.show('IP – ' + r.ip, [MData.view(r)]) });
  },

  mcon(el, d) {
    const A = d.filter(r => r.kind === 'Account'), EL = MData.elsewhere();
    const P = A.flatMap(a => a.phones.map(p => ({ ...p, acct: a.label, country: WReply.country(p.mobile), also: (x => x ? [...x].join(', ') : '')(EL.get('mobile|' + String(p.mobile).toLowerCase())), rec: a })));
    const M = A.flatMap(a => a.emails.map(e => ({ ...e, acct: a.label, also: (x => x ? [...x].join(', ') : '')(EL.get('email|' + e.email)), rec: a })));
    if (!P.length && !M.length) { el.innerHTML = '<div class="card muted">No phone numbers or e-mail addresses in the imported files.</div>'; return; }
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Phone numbers</h3><div class="sub"><b>Verified</b> = the user replied to an SMS on that number – strong link to the SIM holder. <b>⚑</b> = also in WhatsApp / Google / bank / KYC / NCRP.</div><div id="mcP"></div></div>
      <div class="card"><h3>E-mail addresses</h3><div class="sub">Search the e-mail in Google replies and bank KYC</div><div id="mcE"></div></div></div>`;
    Table($('#mcP', el), { rows: P, exportName: this.pl() + '_phones', columns: [{ key: 'mobile', label: 'Phone', render: r => `<b class="mono">${esc(r.mobile)}</b>` }, { key: 'status', label: 'Status', render: r => r.status ? `<span class="badge ${r.status === 'Verified' ? 'good' : ''}">${esc(r.status)}</span>` : '' }, { key: 'on', label: 'Verified on' }, { key: 'type', label: 'Type' }, { key: 'country', label: 'Country' }, { key: 'acct', label: 'Account' }, { key: 'also', label: 'Also in case', render: r => r.also ? `<span class="badge warn">⚑ ${esc(r.also)}</span>` : '' }], onRow: r => Records.show('Phone ' + r.mobile, [MData.view(r.rec)]) });
    Table($('#mcE', el), { rows: M, exportName: this.pl() + '_emails', columns: [{ key: 'email', label: 'E-mail', render: r => `<b class="mono">${esc(r.email)}</b>` }, { key: 'status', label: 'Status', render: r => r.status ? `<span class="badge ${r.status === 'Verified' ? 'good' : ''}">${esc(r.status)}</span>` : '' }, { key: 'on', label: 'Verified on' }, { key: 'acct', label: 'Account' }, { key: 'also', label: 'Also in case', render: r => r.also ? `<span class="badge warn">⚑ ${esc(r.also)}</span>` : '' }], onRow: r => Records.show('E-mail ' + r.email, [MData.view(r.rec)]) });
  },

  mcom(el) {
    const T = MReply.TYPES, f = T.some(t => t[0] === S.mField) ? S.mField : 'ip', only = S.mOnly !== false;
    const sh = g => g.accts >= 2 || g.also, allR = MData.common(f), shN = allR.filter(sh).length;
    const rows = allR.filter(g => !only || !shN || sh(g)).sort((a, b) => (b.also ? 1 : 0) - (a.also ? 1 : 0) || b.accts - a.accts || b.n - a.n);
    el.innerHTML = `<div class="card"><h3>Common analysis · Facebook + Instagram</h3><div class="sub">The same value in 2+ Facebook / Instagram accounts. <b>Also in case</b> = it also appears in WhatsApp, Google, bank, KYC, NCRP or other social data.</div>
      <div class="g-fields">${T.map(([k, l]) => { const c = MData.common(k), n = c.filter(sh).length; return `<button class="${k === f ? 'on' : ''}" data-mf="${k}">${l}<b>${n}</b><small>${c.length}</small></button>`; }).join('')}</div>
      <label class="row small" style="gap:6px;margin:6px 0 2px"><input type="checkbox" id="mOnly" ${only ? 'checked' : ''}> Only shared values (in 2+ accounts, or also in WhatsApp / Google / bank / KYC / NCRP)</label>${only && !shN ? '<div class="note" style="margin-top:6px">No value of this type is shared yet, so all values are shown.</div>' : ''}</div>
      <div class="grid g2"><div class="card"><h3>Top ${esc((T.find(t => t[0] === f) || [])[1] || '')}</h3><div class="sub">Click a bar to see the records</div><div id="mcC"></div></div><div class="card"><h3>Seen in</h3><div id="mcK"></div></div></div>
      <div class="card"><div id="mcT"></div></div>`;
    $$('[data-mf]', el).forEach(b => b.onclick = () => { S.mField = b.dataset.mf; this.mcom(el); });
    $('#mOnly', el).onchange = e => { S.mOnly = e.target.checked; this.mcom(el); };
    Charts.hbar($('#mcC', el), rows.slice().sort((a, b) => b.n - a.n).map(g => ({ label: g.value, value: g.n, sub: g.also ? '⚑ ' + g.also : g.accts + ' account(s)', recs: g.recs.map(MData.view) })), { fmt: v => v + (v === 1 ? ' record' : ' records'), max: 10 });
    const K = new Map(); rows.forEach(g => g.recs.forEach(r => { const k = MReply.PL[r.platform][0] + ' · ' + (r.kind === 'Event' ? r.activity : r.kind); if (!K.has(k)) K.set(k, []); K.get(k).push(r); }));
    Charts.hbar($('#mcK', el), [...K].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(MData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' record' : ' records') });
    Table($('#mcT', el), { rows, exportName: 'meta_common_' + f, sortKey: 'n', sortDir: -1, columns: [{ key: 'value', label: 'Value', render: r => `<b class="mono">${esc(r.value)}</b>` }, { key: 'n', label: 'Times', num: true }, { key: 'accts', label: 'Accounts', num: true }, { key: 'acctList', label: 'Account list' }, { key: 'plats', label: 'Platform' }, { key: 'kinds', label: 'Found in' }, { key: 'first', label: 'First (IST)' }, { key: 'last', label: 'Last (IST)' }, { key: 'also', label: 'Also in case', render: r => r.also ? `<span class="badge warn">⚑ ${esc(r.also)}</span>` : '' }],
      onRow: r => Records.show((T.find(t => t[0] === f) || [])[1] + ' – ' + r.value, r.recs.map(MData.view)) });
  },

  mtime(el, d) {
    const E = d.filter(r => r.ist);
    if (!E.length) { el.innerHTML = '<div class="card muted">No dated events in the imported files.</div>'; return; }
    const lab = r => r.kind === 'Event' ? r.activity : 'Login / IP activity';
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Event type</h3><div id="mt1"></div></div><div class="card"><h3>Events per month (IST)</h3><div id="mt2"></div></div></div><div class="card"><h3>Timeline</h3><div class="sub">Registration, phone / e-mail verification, every IP event and account closure – newest first</div><div id="mtT"></div></div>`;
    const K = groupBy(E, lab); Charts.hbar($('#mt1', el), [...K].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(MData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    const mo = groupBy(E, r => r.ist.slice(0, 7)); Charts.vbar($('#mt2', el), [...mo.keys()].sort().map(k => ({ label: k, value: mo.get(k).length, recs: mo.get(k).map(MData.view) })), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    Table($('#mtT', el), { rows: E, exportName: this.pl() + '_timeline', sortKey: 'ist', sortDir: -1, columns: [{ key: 'ist', label: 'Time (IST)', render: r => `<span class="mono">${esc(r.ist)}</span>` }, { key: 'what', label: 'Event', render: r => esc(lab(r)) }, { key: 'det', label: 'Details', render: r => esc([r.mobile, r.email].filter(Boolean).join(' · ')) }, { key: 'ip', label: 'IP', render: r => `<span class="mono ipv">${esc((r.ip || '') + (r.port ? ' : ' + r.port : ''))}</span>` }, { key: 'acct', label: 'Account' }, { key: '_src', label: 'File' }], onRow: r => Records.show(lab(r) + ' – ' + r.ist, [MData.view(r)]) });
  },

  mcsv(el) { return WTabs.wcsv(el); },

  mfiles(el) {
    const F = groupBy(MData.all(), r => r._src);
    el.innerHTML = `<div class="card"><h3>Add Facebook / Instagram reply files</h3><div id="mD"></div></div><div class="card"><h3>Imported Meta files (Facebook and Instagram)</h3><div id="mfT"></div></div>`;
    this.drop($('#mD', el));
    Table($('#mfT', el), { rows: [...F].map(([file, v]) => ({ file, plat: MReply.PL[v[0].platform][0], n: v.length, kinds: [...groupBy(v, r => r.kind)].map(([k, x]) => k + ' ' + x.length).join(' · '), accts: uniq(v.filter(r => r.kind === 'Account').map(r => r.label)).join(', ') })), exportName: 'meta_files',
      columns: [{ key: 'file', label: 'File' }, { key: 'plat', label: 'Platform' }, { key: 'n', label: 'Records', num: true }, { key: 'kinds', label: 'What was found' }, { key: 'accts', label: 'Account' }, { key: 'x', label: '', render: r => `<button class="btn sm" data-mdel="${esc(r.file)}">🗑 Remove</button>` }],
      after: t => $$('[data-mdel]', t).forEach(b => b.onclick = ev => { ev.stopPropagation(); if (UI.confirm('Remove all records from ' + b.dataset.mdel + '?')) { MData.removeFile(b.dataset.mdel); Analysis.invalidate(); render(); } }) });
  }
};

(() => {
  const op = Pages.social;
  Pages.social = function (main) { if (S.socPlat === 'facebook' || S.socPlat === 'instagram') return MTabs.page(main); return op.apply(this, arguments); };
  const ob = GTabs.bar; GTabs.bar = function (main) { ob.apply(this, arguments); for (const pl of ['facebook', 'instagram']) { const n = MData.mine(pl).filter(r => r.kind === 'Account').length, b = $(`.pchip[data-plat=${pl}] b`, main); if (b && n) b.textContent = fmtNum(S.data.social.filter(r => Analysis.platOf(r) === pl).length + n); } };
  const oi = Analysis.idents;
  Analysis.idents = function () {
    const out = oi.apply(this, arguments);
    if (!out._m && S.data.meta && S.data.meta.length) { out._m = 1; for (const r of S.data.meta) for (const [t, v] of MReply.ids(r)) if (['mobile', 'email', 'ip', 'username'].includes(t)) out.push({ type: t, value: v, section: 'Social', ref: MReply.PL[r.platform][0] + ' · ' + (r.kind === 'Account' ? r.label : r.kind + ' · ' + r.acct), rec: r, meta: 1, label: MReply.PL[r.platform][0] }); }
    return out;
  };
  if (typeof Demo !== 'undefined') { const od = Demo.load; Demo.load = function () { const before = S.data.txns.length; const r = od.apply(this, arguments); if (S.data.txns.length > before && !MData.all().length) { for (const [name, text] of Object.entries(MDEMO)) { const recs = MReply.parse(text, name); recs.forEach(x => x.id = uid()); MData.all().push(...recs); } saveCase(); } return r; }; }
})();

const MDEMO = {
  'DEMO › facebook records.html': `Service
Facebook
Internal Ticket Number
900000002
Target
100000000000777
Alternate Target IDs
600000000000777
Account Identifier
https://www.facebook.com/stockguru.dummy
Account Type
User
Generated
2026-10-04 10:00:00 UTC
Date Range
2026-09-01 00:00:00 UTC to 2026-10-04 00:00:00 UTC
NCMEC CyberTips
No responsive records
Registration Date
2026-07-20 09:00:00 UTC
Registration Ip
106.210.33.7
Account Closure Date
Account Still Active
true
Ip Addresses
IP Address
49.36.100.21:40522
Time
2026-10-02 10:00:00 UTC
IP Address
[2401:4900:1c2a:1b3d:aaaa:bbbb:cccc:1]:51000
Time
2026-10-03 18:30:00 UTC
Identifiers
Vanity
stockguru.dummy
Profile URI
https://www.facebook.com/stockguru.dummy
Emails
Verified Emails
Email
stockguru.dummy@example.com
Names
First Name
Stock
Last Name
Guru (DUMMY)
Full Name
Stock Guru (DUMMY)
Phone Numbers
Verified Phone Numbers
Phone Type
Mobile
Phone Number
+919123456780
`,
  'DEMO › instagram records.html': `Service
Instagram
Internal Ticket Number
900000003
Target
27000000000777
Account Identifier
https://www.instagram.com/stockguru_tips_dummy
Account Type
InstagramUser
Generated
2026-10-04 10:00:00 UTC
Date Range
2026-09-01 00:00:00 UTC to 2026-10-04 00:00:00 UTC
NCMEC CyberTips
No responsive records
Name
First
Stock Guru Tips
Registered Email Addresses
stockguru.dummy@example.com (Verified on 2026-07-21 10:00:00 UTC)
Vanity Name
stockguru_tips_dummy
Registration Date
2026-07-21 09:55:00 UTC
Registration Ip
49.36.100.21
Account Closure Date
Account Still Active
true
Phone Numbers
+919988776655  Verified on 2026-07-21 10:05:00 UTC
Ip Addresses
IP Address
49.36.100.21:33400
Time
2026-10-01 15:41:00 UTC
`
};
