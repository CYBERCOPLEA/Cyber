/* whatsapp.js – Social Media › WhatsApp: read Meta / WhatsApp LE replies (records.html, PDF print, txt)
   – request parameters, NCMEC, e-mails, connection, web info, device info, address book, groups,
   message & call logs – and find common identifiers with Google, bank, KYC and NCRP data */
'use strict';

const WReply = {
  // every field name WhatsApp uses (lower case); a line equal to one of these starts a new field
  KEYS: ['service', 'internal ticket number', 'target', 'logical id', 'account identifier', 'account type', 'generated', 'date range',
    'ncmec reports', 'ncmec cybertips', 'ncmec cybertip numbers', 'emails', 'registered email addresses',
    'connection', 'connection info', 'device id', 'service start', 'device type', 'app version', 'device os build number', 'connection state', 'connection time',
    'inactive since', 'online since', 'last seen', 'last ip', 'last connected ip', 'connected from address', 'last port', 'port', 'push name',
    'web info', 'availability', 'platform', 'version', 'device info', 'device manufacturer', 'device model', 'os version', 'os build number',
    'address book', 'last client sync', 'last address book change', 'last subscription change', 'symmetric contacts', 'asymmetric contacts', 'backup setting',
    'ip addresses', 'ip address', 'time', 'groups', 'owned groups', 'participating groups', 'picture', 'thumbnail', 'id', 'creation', 'size', 'description', 'subject',
    'message log', 'messages', 'timestamp', 'message id', 'sender', 'recipients', 'group id', 'sender ip', 'sender port', 'sender device', 'type', 'message style', 'message size',
    'call logs', 'call log', 'call id', 'call creator', 'events', 'from', 'to', 'from ip', 'from port', 'media type', 'participants', 'phone number',
    'about', 'profile picture', 'small medium business', 'business name', 'address', 'email', 'website', 'location', 'imei', 'mac address'],
  SECTIONS: { 'ncmec reports': 'ncmec', 'emails': 'emails', 'connection': 'conn', 'connection info': 'conn', 'web info': 'web', 'device info': 'device', 'address book': 'book',
    'ip addresses': 'ips', 'groups': 'groups', 'owned groups': 'groups', 'participating groups': 'groups', 'message log': 'msg', 'messages': 'msg', 'call logs': 'call', 'call log': 'call' },
  NOREC: /^no responsive records?( located)?\.?$/i,
  key: k => String(k).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  mob(v) {
    const d = String(v || '').replace(/\D/g, '');
    if ((d.length === 10 || d.length === 12 && d.startsWith('91') || d.length === 11 && d.startsWith('0')) && V.mobile(d)) return N.mobile(d);
    return d.length >= 8 && d.length <= 15 ? '+' + d : '';
  },
  CC: { 7: 'Russia / Kazakhstan', 1: 'USA / Canada', 20: 'Egypt', 27: 'South Africa', 33: 'France', 44: 'UK', 49: 'Germany', 60: 'Malaysia', 61: 'Australia', 62: 'Indonesia', 63: 'Philippines', 64: 'New Zealand', 65: 'Singapore', 66: 'Thailand', 81: 'Japan', 82: 'South Korea', 84: 'Vietnam', 86: 'China', 90: 'Turkey', 91: 'India', 92: 'Pakistan', 93: 'Afghanistan', 94: 'Sri Lanka', 95: 'Myanmar', 98: 'Iran',
    30: 'Greece', 31: 'Netherlands', 32: 'Belgium', 34: 'Spain', 36: 'Hungary', 39: 'Italy', 40: 'Romania', 41: 'Switzerland', 43: 'Austria', 45: 'Denmark', 46: 'Sweden', 47: 'Norway', 48: 'Poland', 51: 'Peru', 52: 'Mexico', 54: 'Argentina', 55: 'Brazil', 56: 'Chile', 57: 'Colombia', 58: 'Venezuela',
    212: 'Morocco', 213: 'Algeria', 216: 'Tunisia', 218: 'Libya', 233: 'Ghana', 249: 'Sudan', 251: 'Ethiopia', 255: 'Tanzania', 256: 'Uganda', 351: 'Portugal', 353: 'Ireland', 358: 'Finland', 359: 'Bulgaria', 370: 'Lithuania', 372: 'Estonia', 373: 'Moldova', 374: 'Armenia', 375: 'Belarus', 380: 'Ukraine', 420: 'Czechia', 421: 'Slovakia',
    673: 'Brunei', 679: 'Fiji', 853: 'Macau', 963: 'Syria', 967: 'Yemen', 970: 'Palestine', 972: 'Israel', 976: 'Mongolia', 992: 'Tajikistan', 993: 'Turkmenistan', 994: 'Azerbaijan', 995: 'Georgia', 996: 'Kyrgyzstan', 998: 'Uzbekistan',
    234: 'Nigeria', 254: 'Kenya', 852: 'Hong Kong', 855: 'Cambodia', 856: 'Laos', 880: 'Bangladesh', 886: 'Taiwan', 960: 'Maldives', 961: 'Lebanon', 962: 'Jordan', 964: 'Iraq', 965: 'Kuwait', 966: 'Saudi Arabia', 968: 'Oman', 971: 'UAE', 973: 'Bahrain', 974: 'Qatar', 975: 'Bhutan', 977: 'Nepal' },
  country(n) { n = String(n || ''); if (/^[6-9]\d{9}$/.test(n)) return 'India'; const d = n.replace(/\D/g, ''); if (!n.startsWith('+') || !d) return ''; for (const l of [3, 2, 1]) { const c = this.CC[+d.slice(0, l)]; if (c) return c; } return 'Other'; },
  splitIp(v) {
    v = String(v || '').trim(); let m;
    if ((m = v.match(/^\[([0-9a-f:]+)\]:(\d{1,5})$/i))) return [m[1].toLowerCase(), m[2]];
    if ((m = v.match(/^((?:\d{1,3}\.){3}\d{1,3}):(\d{1,5})$/))) return [m[1], m[2]];
    return [v, ''];
  },

  /* ---------- text → list of [key, value, section] ---------- */
  fields(text, KEYS = this.KEYS, SECTIONS = this.SECTIONS) {
    const K = new Set(KEYS), long = KEYS.filter(k => k.includes(' ')).sort((a, b) => b.length - a.length);
    const out = []; let cur = null, skip = false, sect = '', started = false;
    const lines = String(text).split(/\r?\n/).flatMap(l => l.split('\t')).map(l => l.replace(/[  ]/g, ' ').trim()).filter(Boolean);
    for (const line of lines) {
      if (/^(whatsapp|meta platforms) business record( page \d+)?$/i.test(line) || /^page \d+( of \d+)?$/i.test(line) || /^see (more|less)$/i.test(line)) continue;
      const k = this.key(line.replace(/:$/, ''));
      if (/ definition$/.test(k)) { skip = true; cur = null; continue; }
      let key = null, val = '';
      if (K.has(k) && line.length < 45 && !(skip && /:$/.test(line))) key = k;
      else {
        const m = line.match(/^([A-Za-z][A-Za-z ]{1,40}?)\s*:\s+(.+)$/); const mk = m && this.key(m[1]);
        if (m && K.has(mk) && !skip) { key = mk; val = m[2]; }
        else if (!skip) { const lk = long.find(x => k.startsWith(x + ' ') && line.length > x.length + 1); if (lk) { key = lk; val = line.slice(lk.length).replace(/^[\s:]+/, ''); } }
      }
      if (key) {
        if (key === 'service' || key === 'target') started = true;
        if (!started) continue;
        skip = false;
        if (SECTIONS[key]) sect = SECTIONS[key];
        if (key === 'account identifier' || key === 'target') sect = '';
        cur = [key, [], sect]; out.push(cur); if (val) cur[1].push(val); continue;
      }
      if (skip || !cur) continue;
      cur[1].push(line);
    }
    return out.map(([k, v, s]) => [k, v.filter(x => !this.NOREC.test(x)).join(', '), s]);
  },

  /* ---------- fields → records ---------- */
  parse(text, file) {
    const F = this.fields(text), recs = []; let acct = null, conn = null, dev = null, ip = null, msg = null, call = null, cev = null, grp = null;
    const A = () => { if (!acct) { acct = { kind: 'Account', _src: file, _f: [] }; recs.push(acct); } return acct; };
    const who = () => (acct && acct.acct) || '';
    const tsOf = v => GReply.ts(v), ist = v => GReply.ist(tsOf(v));
    for (const [k, v, s] of F) {
      const a = A();
      if (k === 'account identifier' && a.account_id) { acct = null; conn = dev = ip = msg = call = cev = grp = null; }
      const r = A();
      if (k === 'target' || k === 'account identifier' || k === 'service' || k === 'internal ticket number' || k === 'logical id' || k === 'account type' || k === 'generated' || k === 'date range') {
        const f = { target: 'target', 'account identifier': 'account_id', service: 'service', 'internal ticket number': 'ticket', 'logical id': 'logical_id', 'account type': 'acct_type', generated: 'generated', 'date range': 'date_range' }[k];
        if (v && !r[f]) r[f] = v; r._f.push([k, v]);
        if (k === 'account identifier' || k === 'target' && !r.acct) r.acct = this.mob(v) || v;
        continue;
      }
      if (s === 'ncmec' || /ncmec/.test(k)) { if (v) r.ncmec = [r.ncmec, v].filter(Boolean).join('; '); r._f.push(['NCMEC › ' + k, v || 'No responsive records']); if (!r.ncmec) r.ncmec_none = 1; continue; }
      if (s === 'emails' || k === 'registered email addresses') { if (k !== 'emails') { r.emails = [r.emails, v].filter(Boolean).join(', '); r._f.push(['Registered e-mail addresses', v || 'No responsive records']); } continue; }
      if (s === 'conn') {
        if (k === 'connection' || k === 'connection info') continue;
        if (k === 'device id' || !conn) { conn = { kind: 'Connection', acct: who(), _src: file, _f: [] }; recs.push(conn); }
        conn._f.push([k, v]); if (!v) continue;
        const set = f => { if (!conn[f]) conn[f] = v; };
        ({ 'device id': () => set('device_id'), 'service start': () => set('service_start'), 'device type': () => set('device_type'), 'app version': () => set('app_version'), 'device os build number': () => set('os_build'),
          'connection state': () => set('state'), 'connection time': () => set('conn_time'), 'inactive since': () => set('inactive_since'), 'online since': () => set('online_since'), 'last seen': () => set('last_seen'),
          'push name': () => set('push_name'), 'last port': () => set('port'), port: () => set('port') }[k] || (() => {}))();
        if (/last ip|last connected ip|connected from address/.test(k)) { const [i, p] = this.splitIp(v); conn.ip = i; if (p) conn.port = p; conn.ip_label = k; }
        const om = String(conn.os_build || '').match(/model:\s*([^,]+)/i); if (om) conn.model = om[1].trim();
        continue;
      }
      if (s === 'web') { if (k !== 'web info') { r.web = [r.web, k + ': ' + v].filter(Boolean).join(' · '); r._f.push(['Web info › ' + k, v]); } else if (v) r.web = v; continue; }
      if (s === 'device') {
        if (k === 'device info') continue;
        if (k === 'device id' || !dev) { dev = { kind: 'Device', acct: who(), _src: file, _f: [] }; recs.push(dev); }
        dev._f.push([k, v]); if (!v) continue;
        const f = { 'device id': 'device_id', 'app version': 'app_version', 'os version': 'os_version', 'os build number': 'os_build', 'device manufacturer': 'brand', 'device model': 'model', 'device type': 'device_type', imei: 'imei', 'mac address': 'mac' }[k];
        if (f && !dev[f]) dev[f] = v; continue;
      }
      if (s === 'book') {
        if (k === 'address book') continue;
        r._f.push(['Address book › ' + k, v.length > 300 ? v.slice(0, 300) + '…' : v]);
        if (k === 'last address book change') r.ab_change = v; else if (k === 'last client sync') r.ab_sync = v; else if (k === 'last subscription change') r.ab_sub = v; else if (k === 'backup setting') r.ab_backup = v;
        else if (/contacts/.test(k)) {
          const t = /^asym/.test(k) ? 'Asymmetric' : 'Symmetric', tot = (v.match(/(\d+)\s*total/i) || [])[1];
          r[t === 'Symmetric' ? 'sym' : 'asym'] = tot || '';
          v.replace(/\d+\s*total/i, '').split(/[,;\s]+/).map(x => x.replace(/[^\d+]/g, '')).filter(x => x.replace(/\D/g, '').length >= 8).forEach(n => recs.push({ kind: 'Contact', acct: who(), contact: this.mob(n) || n, raw: n, list: t, _src: file, _f: [['Contact', n], ['List', t + ' contacts'], ['Address book of', who()]] }));
        }
        continue;
      }
      if (s === 'ips') {
        if (k === 'ip addresses') continue;
        if (k === 'ip address' || !ip) { if (!ip || ip.ip) { ip = { kind: 'IP', acct: who(), _src: file, _f: [] }; recs.push(ip); } }
        ip._f.push([k, v]); if (k === 'ip address') { const [i, p] = this.splitIp(v); ip.ip = i; if (p) ip.port = p; } else if (k === 'time' || k === 'timestamp') { ip.ts = tsOf(v); ip.ist = ist(v); } else if (/port/.test(k)) ip.port = v;
        continue;
      }
      if (s === 'groups') {
        if (k === 'groups' || k === 'owned groups' || k === 'participating groups') { grp = null; r._gt = k === 'owned groups' ? 'Owned' : k === 'participating groups' ? 'Participating' : ''; continue; }
        if (!grp || k === 'picture' && grp.picture || k === 'id' && grp.gid) { grp = { kind: 'Group', acct: who(), role: r._gt || '', _src: file, _f: [] }; recs.push(grp); }
        grp._f.push([k, v]); const f = { id: 'gid', creation: 'created', size: 'size', description: 'description', subject: 'subject', picture: 'picture' }[k]; if (f && v) grp[f] = v;
        if (k === 'creation') { grp.ts = tsOf(v); grp.ist = ist(v); }
        continue;
      }
      if (s === 'msg') {
        if (k === 'message log' || k === 'messages') continue;
        if (k === 'timestamp' || !msg) { msg = { kind: 'Message', acct: who(), _src: file, _f: [] }; recs.push(msg); }
        msg._f.push([k, v]); if (!v) continue;
        const f = { timestamp: 'time', 'message id': 'msg_id', sender: 'from', recipients: 'to', 'group id': 'gid', 'sender ip': 'ip', 'sender port': 'port', 'sender device': 'device', type: 'type', 'message style': 'style', 'message size': 'size' }[k];
        if (f) msg[f] = v; if (k === 'timestamp') { msg.ts = tsOf(v); msg.ist = ist(v); } if (k === 'sender ip') { const [i, p] = this.splitIp(v); msg.ip = i; if (p) msg.port = p; }
        continue;
      }
      if (s === 'call') {
        if (k === 'call logs' || k === 'call log') continue;
        if (k === 'call id') { call = { id: v, creator: '' }; cev = null; continue; }
        if (k === 'call creator') { if (call) call.creator = v; continue; }
        if (k === 'events') continue;
        if (k === 'type' || !cev) { cev = { kind: 'Call', acct: who(), call_id: call && call.id, creator: call && call.creator, _src: file, _f: call ? [['Call id', call.id], ['Call creator', call.creator]] : [] }; recs.push(cev); }
        cev._f.push([k, v]); if (!v) continue;
        const f = { type: 'type', timestamp: 'time', from: 'from', to: 'to', 'from ip': 'ip', 'from port': 'port', 'media type': 'media', participants: 'participants', 'phone number': 'to' }[k];
        if (f) cev[f] = v; if (k === 'timestamp') { cev.ts = tsOf(v); cev.ist = ist(v); } if (k === 'from ip') { const [i, p] = this.splitIp(v); cev.ip = i; if (p) cev.port = p; }
        continue;
      }
      if (v) { r._f.push([k, v]); const f = { 'push name': 'push_name', about: 'about', email: 'emails', 'business name': 'business', address: 'address', website: 'website', location: 'location' }[k]; if (f && !r[f]) r[f] = v; }
    }
    // every record knows its target; the account gets a summary of its main connection / device
    for (const x of recs) {
      if (x.kind === 'Account') continue;
      const own = recs.filter(a => a.kind === 'Account' && recs.indexOf(a) < recs.indexOf(x)).pop();
      if (own && !x.acct) x.acct = own.acct;
    }
    for (const a of recs.filter(x => x.kind === 'Account')) {
      const c = recs.find(x => x.kind === 'Connection' && x.acct === a.acct), d = recs.find(x => x.kind === 'Device' && x.acct === a.acct);
      if (c) for (const f of ['service_start', 'device_type', 'app_version', 'os_build', 'state', 'last_seen', 'ip', 'port', 'push_name', 'online_since', 'inactive_since']) if (c[f] && !a[f]) a[f] = c[f];
      if (d) { a.brand = d.brand || ''; a.model = d.model || ''; }
      if (!a.model && c && c.model) a.model = c.model;
      if (a.emails) a.emails = uniq((a.emails.match(RX.email) || []).map(e => e.toLowerCase())).join(', ') || a.emails;
      if (a.last_seen) { a.ts = tsOf(a.last_seen); a.ist = ist(a.last_seen); a.activity = 'Last seen'; }
      delete a._gt;
    }
    // a connection is an event at "last seen" (or connection time)
    recs.filter(x => x.kind === 'Connection').forEach(c => { const t = c.last_seen || c.conn_time || c.online_since || c.inactive_since; if (t) { c.ts = tsOf(t); c.ist = ist(t); } c.activity = c.state || ''; });
    recs.filter(x => x.kind === 'Device').forEach(d => { const c = recs.find(x => x.kind === 'Connection' && x.acct === d.acct && (x.device_id || '0') === (d.device_id || '0')); if (c) { d.state = c.state; d.last_seen = c.last_seen; d.ip = c.ip; d.port = c.port; d.os_build = d.os_build || c.os_build; d.device_type = d.device_type || c.device_type; } });
    return recs.filter(x => x.kind !== 'Account' || x.acct || x._f.length);
  },

  /* ---------- identifiers in one record (for the Common view) ---------- */
  TYPES: [['mobile', '📱 Mobile'], ['contact', '👥 Address-book contact'], ['email', '✉ Email'], ['ip', '🌐 IP address'], ['device', '📲 Brand & Model'], ['os', '🛠 OS build'], ['app', '💬 App version'],
    ['imei', '🔢 IMEI'], ['mac', '📶 MAC'], ['location', '📍 Location'], ['date', '📅 Date'], ['hour', '🕐 Hour (IST)'], ['group', '👪 Group'], ['name', '🏷 Push name'], ['country', '🌍 Country code']],
  ids(r) {
    if (r._ids) return r._ids;
    const out = new Map(), add = (t, v) => { v = String(v || '').trim(); if (v && v.length < 200) out.set(t + '|' + v.toLowerCase(), [t, v]); };
    if (r.acct && r.kind !== 'Contact') add('mobile', r.acct);
    if (r.kind === 'Contact') { add('contact', r.contact); add('mobile', r.contact); }
    for (const f of ['from', 'to', 'creator', 'participants']) if (r[f]) String(r[f]).split(/[,;\s]+/).map(x => this.mob(x)).filter(Boolean).forEach(m => add('mobile', m));
    (String(r.emails || '').match(RX.email) || []).forEach(e => add('email', e.toLowerCase()));
    if (r.ip) add('ip', r.ip.toLowerCase());
    if (r.brand || r.model) add('device', [r.brand, r.model].filter(Boolean).join(' ').toUpperCase());
    else if (r.device_type && r.kind !== 'Account') add('device', r.device_type.toUpperCase());
    if (r.os_build || r.os_version) add('os', r.os_build || r.device_type + ' ' + r.os_version);
    if (r.app_version) add('app', r.app_version.replace(/^android-|^ios-/i, ''));
    if (r.imei) (String(r.imei).match(/\b\d{14,16}\b/g) || []).forEach(x => add('imei', x));
    if (r.mac) (String(r.mac).match(GReply.RXMAC) || []).forEach(x => add('mac', x.toLowerCase().replace(/-/g, ':')));
    if (r.location || r.address) add('location', String(r.location || r.address).toUpperCase());
    if (r.gid) add('group', r.subject ? r.subject + ' (' + r.gid + ')' : r.gid);
    if (r.push_name) add('name', r.push_name);
    const cn = WReply.country(r.kind === 'Contact' ? r.contact : r.acct); if (cn) add('country', cn);
    if (r.ist) { add('date', r.ist.slice(0, 10)); if (r.ist.length > 10) add('hour', r.ist.slice(11, 13) + ':00'); }
    return (r._ids = [...out.values()]);
  }
};

const WData = {
  all() { if (!S.data.whatsapp) S.data.whatsapp = []; return S.data.whatsapp; },
  of(kind) { return this.all().filter(r => r.kind === kind); },
  async importFiles(list) {
    const files = await GReply.files([...list]); const done = [];
    for (const f of files) {
      try { const { text } = await GReply.read(f); const recs = WReply.parse(text, f.name); recs.forEach(r => r.id = uid()); this.all().push(...recs); done.push([f.name, recs.length]);
        S.data.imports.push({ id: uid(), when: new Date().toISOString(), file: f.name, type: 'whatsapp', count: recs.length }); }
      catch (e) { done.push([f.name, 'Error: ' + (e.message || e)]); }
    }
    saveCase(); return done;
  },
  removeFile(name) { S.data.whatsapp = this.all().filter(r => r._src !== name); S.data.imports = S.data.imports.filter(i => !(i.type === 'whatsapp' && i.file === name)); saveCase(); },
  // one card per WhatsApp number, merged across all reply files
  accounts() {
    return Analysis.cached('w:acc', () => {
      const M = new Map();
      for (const a of this.of('Account')) { const k = a.acct || a._src, m = M.get(k) || { kind: 'Account', acct: a.acct, _f: [], files: [] };
        for (const [f, v] of Object.entries(a)) if (!f.startsWith('_') && v && !['kind', 'id'].includes(f)) { if (!m[f]) m[f] = v; else if (f !== 'acct' && String(m[f]) !== String(v) && !['ts', 'ist'].includes(f)) m[f] = uniq((m[f] + '; ' + v).split('; ')).join('; '); }
        m._f.push(...a._f.map(([x, y]) => [x, y, a._src])); m.files.push(a._src); M.set(k, m); }
      return [...M.values()].map(m => ({ ...m, _src: uniq(m.files).join(', '), contacts: this.of('Contact').filter(c => c.acct === m.acct).length }));
    });
  },
  elsewhere() {
    return Analysis.cached('w:else', () => { const m = new Map(); try { Analysis.idents().filter(x => !x.wa).forEach(x => { const k = x.type + '|' + String(x.value).toLowerCase(); if (!m.has(k)) m.set(k, new Set()); m.get(k).add(x.label || x.section); }); } catch (e) { } return m; });
  },
  common(type) {
    return Analysis.cached('w:c:' + type, () => {
      const G = new Map();
      for (const r of this.all()) for (const [t, v] of WReply.ids(r)) { if (t !== type) continue; const k = v.toLowerCase(); let g = G.get(k); if (!g) G.set(k, g = { value: v, n: 0, accts: new Set(), kinds: new Set(), files: new Set(), times: [], recs: [] }); g.n++; if (r.acct) g.accts.add(r.acct); g.kinds.add(r.kind); g.files.add(r._src); if (r.ist) g.times.push(r.ist); g.recs.push(r); }
      const EL = this.elsewhere(), map = { mobile: 'mobile', contact: 'mobile', email: 'email', ip: 'ip', imei: 'imei' };
      return [...G.values()].map(g => { g.times.sort(); const el = map[type] ? EL.get(map[type] + '|' + g.value.toLowerCase()) : null; return { value: g.value, n: g.n, accts: g.accts.size, acctList: [...g.accts].join(', '), kinds: [...g.kinds].join(', '), files: g.files.size, first: g.times[0] || '', last: g.times[g.times.length - 1] || '', also: el ? [...el].join(', ') : '', recs: g.recs }; });
    });
  },
  view(r) { const o = { kind: r.kind, 'whatsapp number': r.acct }; if (r.kind === 'Contact') o.country = WReply.country(r.contact); for (const k of ['ist', 'contact', 'list', 'from', 'to', 'type', 'media', 'ip', 'port', 'state', 'last_seen', 'service_start', 'device_type', 'brand', 'model', 'os_build', 'os_version', 'app_version', 'push_name', 'emails', 'subject', 'gid', 'size', 'msg_id', 'call_id']) if (r[k]) o[k === 'ist' ? 'time (IST)' : k.replace(/_/g, ' ')] = r[k]; o.file = r._src; return o; }
};

/* ---------- page ---------- */
PAGE_META.wsocial = { group: 'Investigation › Social Media', title: 'WhatsApp (Meta LE reply)', desc: 'WhatsApp records from Meta: request parameters, e-mails, connection, last IP & port, devices, address book, groups, message and call logs. Find the same mobile, e-mail, IP or device across numbers and the rest of the case.',
  order: ['wsum', 'wacc', 'wconn', 'wbook', 'wlog', 'wcom', 'wtime', 'wcsv', 'wfiles'] };

const WTabs = {
  C: '#25D366',
  page(main) {
    const d = WData.all(), c = k => d.filter(r => r.kind === k).length, csv = Analysis.socRows();
    const { cur, body } = tabs(main, 'wsocial', [['wsum', '📊 Overview'], ['wacc', `👤 Accounts (${WData.accounts().length})`], ['wconn', `🌐 Connection & Devices (${c('Connection') + c('Device') + c('IP')})`], ['wbook', `📒 Address Book (${c('Contact')})`],
      ['wlog', `💬 Messages & Calls (${c('Message') + c('Call')})`], ['wcom', '⚑ Common'], ['wtime', '🕐 Date & Time'], ['wcsv', `📋 Other WhatsApp rows (${csv.length})`], ['wfiles', '📁 Files']], 'WhatsApp',
      `<button class="btn primary" id="wImp">⬆ Import WhatsApp reply</button><input type="file" id="wPick" class="hidden" multiple accept=".html,.htm,.txt,.pdf,.zip,.rar,.csv,.json">`);
    GTabs.bar(main, body);
    $('#wImp').onclick = () => this.pick(); $('#wPick').onchange = e => this.load(e.target.files);
    if (!d.length && !['wfiles', 'wcsv'].includes(cur)) return this.empty(body, csv.length);
    this[cur](body, d);
  },
  pick() { const fp = $('#wPick'); fp.value = ''; fp.click(); },
  async load(files) {
    if (!files || !files.length) return; UI.toast('Reading ' + files.length + ' file(s)…');
    const done = await WData.importFiles(files); Analysis.invalidate();
    const bad = done.filter(x => typeof x[1] !== 'number');
    UI.toast(`WhatsApp: ${done.filter(x => typeof x[1] === 'number').length} file(s) read, ${fmtNum(sum(done, x => typeof x[1] === 'number' ? x[1] : 0))} records` + (bad.length ? ` · ${bad.length} failed` : ''));
    render();
  },
  drop(el) {
    el.innerHTML = `<div class="g-drop w-drop" id="wDrop"><div class="g-dl w-dl">✆</div><b>Drop WhatsApp reply files here</b><span>or click to choose · records.html, the .zip / .rar from Meta, or a PDF print</span>
      <div class="g-kinds"><i style="--k:#25D366">Request parameters</i><i style="--k:#128C7E">Connection &amp; last IP</i><i style="--k:#34B7F1">Device info</i><i style="--k:#075E54">Address book</i><i style="--k:#FBBC05">Message / call logs</i></div></div>`;
    const dz = $('#wDrop', el); dz.onclick = () => this.pick();
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); this.load(e.dataTransfer.files); };
  },
  empty(el, csvN) {
    el.innerHTML = `<div class="card"><h3>No WhatsApp reply in this case yet</h3><div class="sub">Import the records.html files Meta sends (you can drop the whole .zip or .rar). Everything is read on this computer only.${csvN ? ` You also have <b>${csvN}</b> WhatsApp row(s) from a CSV / Excel import in the <b>Other WhatsApp rows</b> tab.` : ''}</div><div id="wD"></div>
      <div class="g-help"><div><b style="color:#25D366">Request parameters</b> Target, Logical ID, Account Identifier, Account Type, Generated, Date Range, NCMEC Reports, Registered e-mail addresses</div>
      <div><b style="color:#128C7E">Connection</b> Device ID, Service start, Device type, App version, Device OS build number, Connection state, Last seen, Last IP and port, Push name, Web info</div>
      <div><b style="color:#34B7F1">Device info</b> Device manufacturer, Device model, OS version, App version</div>
      <div><b style="color:#075E54">Address book</b> Symmetric / asymmetric contacts, Last address book change, Last client sync, Backup setting</div>
      <div><b style="color:#FBBC05">Logs</b> Message log (timestamp, sender, recipients, sender IP and port, device) and call logs, groups</div></div></div>`;
    this.drop($('#wD', el));
  },
  kv: (...a) => GTabs.kv(...a),
  t(v) { const t = GReply.ts(v); return v ? v + (t.length > 10 ? ' (IST ' + GReply.ist(t) + ')' : '') : ''; },

  wsum(el, d) {
    const A = WData.accounts(), ipv = new Set(), em = new Set(), ph = new Set();
    d.forEach(r => WReply.ids(r).forEach(([t, v]) => { if (t === 'ip') ipv.add(v); if (t === 'email') em.add(v); if (t === 'mobile') ph.add(v); }));
    const shared = WReply.TYPES.reduce((a, [t]) => a + (['date', 'hour', 'country'].includes(t) ? 0 : WData.common(t).filter(g => g.accts >= 2 || g.also).length), 0);
    const C = WData.of('Contact'), D = [...WData.of('Device'), ...WData.of('Connection').filter(c => !WData.of('Device').some(x => x.acct === c.acct))];
    el.innerHTML = UI.kpis([['WhatsApp numbers', fmtNum(A.length), A.slice(0, 2).map(a => a.acct).join(', ') || '—', 'c2'], ['Devices', fmtNum(WData.of('Device').length || WData.of('Connection').length), uniq(D.map(x => [x.brand, x.model].filter(Boolean).join(' ') || x.device_type).filter(Boolean)).slice(0, 2).join(', ') || '—', 'c6'],
      ['IP addresses', fmtNum(ipv.size), uniq(A.map(a => a.ip).filter(Boolean)).length + ' last IP(s)', 'c4'], ['Address-book contacts', fmtNum(C.length), uniq(C.map(c => c.contact)).length + ' unique numbers', 'c3'], ['Messages · Calls', fmtNum(WData.of('Message').length) + ' · ' + fmtNum(WData.of('Call').length), 'from message / call logs', 'c5'], ['Common / cross-linked', fmtNum(shared), 'in 2+ numbers or Google / bank / KYC / NCRP', 'c1']]) +
      `<div class="card"><h3>Numbers at a glance</h3><div class="sub">Click a row to see every field</div><div id="ws0"></div></div>
       <div class="grid g2"><div class="card"><h3>Last seen / activity by date (IST)</h3><div id="ws1"></div></div><div class="card"><h3>Devices (brand &amp; model)</h3><div id="ws2"></div></div>
       <div class="card"><h3>Top IP addresses</h3><div class="sub">Last IP, message and call IPs</div><div id="ws3"></div></div><div class="card"><h3>Contacts shared by 2+ numbers or found in the case</h3><div id="ws4"></div></div></div>`;
    Table($('#ws0', el), { rows: A, exportName: 'whatsapp_numbers', columns: [{ key: 'acct', label: 'WhatsApp number', render: r => `<b class="mono">${esc(r.acct || '')}</b>` }, { key: 'country', label: 'Country', render: r => esc(WReply.country(r.acct)) }, { key: 'push_name', label: 'Push name' }, { key: 'state', label: 'State', render: r => r.state ? `<span class="badge ${/online/i.test(r.state) ? 'good' : ''}">${esc(r.state)}</span>` : '' }, { key: 'last_seen', label: 'Last seen (IST)', render: r => esc(r.last_seen ? GReply.ist(GReply.ts(r.last_seen)) : '') }, { key: 'ip', label: 'Last IP', render: r => `<span class="mono ipv">${esc(r.ip || '')}</span>` }, { key: 'port', label: 'Port', render: r => `<span class="mono nowrap">${esc(r.port || '')}</span>` }, { key: 'dev', label: 'Device', render: r => esc([r.brand, r.model].filter(Boolean).join(' ') || r.os_build || r.device_type || '') }, { key: 'emails', label: 'E-mail' }, { key: 'contacts', label: 'Contacts', num: true }, { key: 'service_start', label: 'Service start' }],
      onRow: r => Records.show('WhatsApp ' + r.acct, [WData.view(r)]) });
    const ev = d.filter(r => r.ist), days = groupBy(ev, r => r.ist.slice(0, 10));
    Charts.line($('#ws1', el), [...days.keys()].sort().map(k => ({ label: k, value: days.get(k).length, recs: days.get(k).map(WData.view) })), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    const top = (t, id, fmt, max, f = () => true) => Charts.hbar($(id, el), WData.common(t).filter(f).sort((a, b) => b.n - a.n).map(g => ({ label: g.value, value: g.n, sub: g.also ? '⚑ ' + g.also : g.acctList.slice(0, 40), recs: g.recs.map(WData.view) })), { fmt, max });
    top('device', '#ws2', v => v + (v === 1 ? ' record' : ' records'), 10); top('ip', '#ws3', v => v + (v === 1 ? ' time' : ' times'), 10);
    if (WData.common('contact').some(g => g.accts >= 2 || g.also)) top('contact', '#ws4', v => v + (v === 1 ? ' list' : ' lists'), 10, g => g.accts >= 2 || g.also);
    else $('#ws4', el).innerHTML = '<div class="muted small">No contact is shared between WhatsApp numbers or found in other case data yet.</div>';
  },

  wacc(el) {
    const A = WData.accounts();
    if (!A.length) { el.innerHTML = '<div class="card muted">No WhatsApp account information in the imported files.</div>'; return; }
    el.innerHTML = `<div class="g-cards">${A.map(a => `<div class="g-card" style="--gc:${this.C}"><div class="g-ch"><span class="g-av" style="background:${this.C}">✆</span><div><b class="mono">${esc(a.acct || a.account_id || '(number not given)')}</b><small>${esc([WReply.country(a.acct), a.push_name, a.acct_type].filter(Boolean).join(' · '))}</small></div><span class="spacer"></span>${a.state ? `<span class="badge ${/online/i.test(a.state) ? 'good' : 'warn'}">${esc(a.state)}</span>` : ''}</div>
      <div class="w-sec">Request parameters</div>
      <div class="g-grid">${this.kv('Target', a.target, 'gh')}${this.kv('Account identifier', a.account_id, 'gh')}${this.kv('Logical ID', a.logical_id)}${this.kv('Account type', a.acct_type)}${this.kv('Service', a.service)}${this.kv('Internal ticket no.', a.ticket)}${this.kv('Generated', this.t(a.generated))}${this.kv('Date range', a.date_range, 'wide')}${this.kv('NCMEC reports', a.ncmec || (a.ncmec_none ? 'No responsive records' : ''))}${this.kv('Registered e-mail addresses', a.emails || 'No responsive records', a.emails ? 'gh' : '')}</div>
      <div class="w-sec">Connection</div>
      <div class="g-grid">${this.kv('Last IP', a.ip, 'gh')}${this.kv('Port', a.port, 'gh')}${this.kv('Last seen', this.t(a.last_seen))}${this.kv('Connection state', a.state)}${this.kv('Device OS build number', a.os_build)}${this.kv('Device type', a.device_type)}${this.kv('Brand & model', [a.brand, a.model].filter(Boolean).join(' '), 'gh')}${this.kv('App version', a.app_version)}${this.kv('Service start', this.t(a.service_start))}${this.kv('Online since', this.t(a.online_since))}${this.kv('Inactive since', this.t(a.inactive_since))}${this.kv('Web info', a.web)}</div>
      <div class="w-sec">Address book</div>
      <div class="g-grid">${this.kv('Symmetric contacts', a.sym && a.sym + ' total')}${this.kv('Asymmetric contacts', a.asym && a.asym + ' total')}${this.kv('Contacts read', String(a.contacts || ''))}${this.kv('Last address book change', this.t(a.ab_change))}${this.kv('Last client sync', this.t(a.ab_sync))}${this.kv('Last subscription change', this.t(a.ab_sub))}${this.kv('Backup setting', a.ab_backup)}</div>
      ${a.ip ? `<div class="note small" style="margin-top:8px">ISP request: IP <b class="mono">${esc(a.ip)}</b>${a.port ? ' port <b>' + esc(a.port) + '</b>' : ''} at <b>${esc(a.last_seen || '')}</b> (IST ${esc(GReply.ist(GReply.ts(a.last_seen)) || '—')}). Port and exact time are needed for shared (CGNAT) IPs.</div>` : ''}
      <details><summary>All ${a._f.length} fields · ${esc(a._src)}</summary><div class="g-all">${a._f.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v || '—')}</b>`).join('')}</div></details></div>`).join('')}</div>`;
  },

  wconn(el) {
    const C = WData.of('Connection'), D = WData.of('Device'), I = [...WData.of('IP'), ...C.filter(c => c.ip), ...WData.of('Message').filter(m => m.ip), ...WData.of('Call').filter(m => m.ip)];
    if (!C.length && !D.length && !I.length) { el.innerHTML = '<div class="card muted">No connection or device information in the imported files.</div>'; return; }
    el.innerHTML = `${D.length ? `<div class="g-cards">${D.map(x => `<div class="g-card" style="--gc:#34B7F1"><div class="g-ch"><span class="g-av" style="background:#34B7F1">📱</span><div><b>${esc([x.brand, x.model].filter(Boolean).join(' ') || x.device_type || 'Device')}</b><small>WhatsApp ${esc(x.acct || '')} · device ID ${esc(x.device_id || '0')}</small></div><span class="spacer"></span>${x.state ? `<span class="badge">${esc(x.state)}</span>` : ''}</div>
      <div class="g-grid">${this.kv('Device manufacturer', x.brand, 'gh')}${this.kv('Device model', x.model, 'gh')}${this.kv('OS version', x.os_version)}${this.kv('OS build number', x.os_build)}${this.kv('App version', x.app_version)}${this.kv('Device type', x.device_type)}${this.kv('Last IP', x.ip, 'gh')}${this.kv('Port', x.port)}${this.kv('Last seen', this.t(x.last_seen))}${this.kv('IMEI', x.imei, 'gh')}${this.kv('MAC', x.mac)}</div>
      <details><summary>All ${x._f.length} fields · ${esc(x._src)}</summary><div class="g-all">${x._f.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v || '—')}</b>`).join('')}</div></details></div>`).join('')}</div>` : ''}
      ${C.length ? '<div class="card"><h3>Connection info</h3><div class="sub">One row per linked device (ID 0 = main phone). Times from WhatsApp are UTC; IST adds 5 h 30 min.</div><div id="wcC"></div></div>' : ''}
      ${I.length ? '<div class="grid g2"><div class="card"><h3>IP addresses</h3><div id="wcI1"></div></div><div class="card"><h3>IP type</h3><div id="wcI2"></div></div></div><div class="card"><h3>All IP events</h3><div class="sub">Send ISP requests with the IP, port, exact time and time zone</div><div id="wcIT"></div></div>' : ''}`;
    if (C.length) Table($('#wcC', el), { rows: C, exportName: 'whatsapp_connection', columns: [{ key: 'acct', label: 'WhatsApp number', render: r => `<b class="mono">${esc(r.acct || '')}</b>` }, { key: 'device_id', label: 'Device ID' }, { key: 'state', label: 'State' }, { key: 'last_seen', label: 'Last seen (UTC)' }, { key: 'ist', label: 'Last seen (IST)', render: r => `<span class="mono">${esc(r.ist || '')}</span>` }, { key: 'ip', label: 'Last IP', render: r => `<b class="mono ipv">${esc(r.ip || '')}</b>` }, { key: 'port', label: 'Port' }, { key: 'os_build', label: 'Device OS build' }, { key: 'device_type', label: 'Device type' }, { key: 'app_version', label: 'App version' }, { key: 'service_start', label: 'Service start' }, { key: 'push_name', label: 'Push name' }, { key: '_src', label: 'File' }], onRow: r => Records.show('Connection – ' + r.acct, [WData.view(r)]) });
    if (I.length) {
      const g = groupBy(I, r => r.ip); Charts.hbar($('#wcI1', el), [...g].map(([k, v]) => ({ label: k, value: v.length, sub: V.ipKind(k), recs: v.map(WData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' time' : ' times'), max: 10 });
      const t = groupBy(I, r => V.ipKind(r.ip)); Charts.hbar($('#wcI2', el), [...t].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(WData.view) })), { fmt: v => v + (v === 1 ? ' IP' : ' IPs') });
      Table($('#wcIT', el), { rows: I, exportName: 'whatsapp_ip', sortKey: 'ts', sortDir: -1, columns: [{ key: 'ist', label: 'Time (IST)', render: r => `<span class="mono">${esc(r.ist || '')}</span>` }, { key: 'ts', label: 'Time (UTC)', render: r => `<span class="mono muted">${esc(r.ts ? r.ts.replace('T', ' ').replace('Z', '') : '')}</span>` }, { key: 'ip', label: 'IP address', render: r => `<b class="mono ipv">${esc(r.ip)}</b>` }, { key: 'port', label: 'Port' }, { key: 'kind', label: 'From' }, { key: 'ipk', label: 'Type', render: r => esc(V.ipKind(r.ip)) }, { key: 'acct', label: 'WhatsApp number' }, { key: '_src', label: 'File' }], onRow: r => Records.show('IP – ' + r.ip, [WData.view(r)]) });
    }
  },

  wbook(el) {
    const C = WData.of('Contact'), A = WData.accounts();
    if (!C.length) { el.innerHTML = '<div class="card muted">No address book in the imported files.' + (A.some(a => a.sym || a.asym) ? '' : ' (Meta sends it only when it was asked for in the request.)') + '</div>'; return; }
    const EL = WData.elsewhere(), rows = [...groupBy(C, c => c.contact)].map(([n, v]) => ({ contact: n, country: WReply.country(n), lists: uniq(v.map(x => x.list)).join(', '), owners: uniq(v.map(x => x.acct)).join(', '), on: uniq(v.map(x => x.acct)).length, isTarget: A.some(a => a.acct === n) ? 'Yes' : '', also: (x => x ? [...x].join(', ') : '')(EL.get('mobile|' + String(n).toLowerCase())), recs: v }));
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Contacts per WhatsApp number</h3><div id="wb1"></div></div><div class="card"><h3>Symmetric vs asymmetric</h3><div class="sub">Symmetric = both have saved each other. Asymmetric = only one side saved the number.</div><div id="wb2"></div></div><div class="card"><h3>Contacts by country (from the dialling code)</h3><div class="sub">Foreign numbers in the address book of an Indian fraud suspect are a strong lead</div><div id="wb3"></div></div></div>
      <div class="card"><h3>Address-book contacts</h3><div class="sub"><b>⚑ Also in case</b> = the contact also appears in Google, bank, KYC, NCRP or other social data. <b>Shared</b> = in the address book of 2+ WhatsApp numbers.</div><div id="wbT"></div></div>`;
    const by = groupBy(C, c => c.acct); Charts.hbar($('#wb1', el), [...by].map(([k, v]) => ({ label: k || '—', value: v.length, recs: v.map(WData.view) })), { fmt: v => v + (v === 1 ? ' contact' : ' contacts') });
    const ls = groupBy(C, c => c.list); Charts.hbar($('#wb2', el), [...ls].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(WData.view) })), { fmt: v => v + (v === 1 ? ' contact' : ' contacts') });
    const cc = groupBy(C, c => WReply.country(c.contact) || 'Unknown'); Charts.hbar($('#wb3', el), [...cc].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(WData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' contact' : ' contacts') });
    Table($('#wbT', el), { rows: rows.sort((a, b) => (b.also ? 1 : 0) - (a.also ? 1 : 0) || b.on - a.on), exportName: 'whatsapp_address_book', columns: [{ key: 'contact', label: 'Contact number', render: r => `<b class="mono">${esc(r.contact)}</b>` }, { key: 'country', label: 'Country' }, { key: 'lists', label: 'List' }, { key: 'owners', label: 'In address book of' }, { key: 'on', label: 'Numbers', num: true, render: r => r.on >= 2 ? `<span class="badge warn">${r.on} shared</span>` : '1' }, { key: 'isTarget', label: 'Also a target' }, { key: 'also', label: 'Also in case', render: r => r.also ? `<span class="badge warn">⚑ ${esc(r.also)}</span>` : '' }],
      onRow: r => Records.show('Contact ' + r.contact, r.recs.map(WData.view)) });
  },

  wlog(el) {
    const M = WData.of('Message'), K = WData.of('Call'), G = WData.of('Group');
    if (!M.length && !K.length && !G.length) { el.innerHTML = '<div class="card muted">No message log, call log or groups in the imported files. Meta sends these only for a pen-register / prospective request.</div>'; return; }
    const E = [...M, ...K];
    el.innerHTML = `${E.length ? `<div class="grid g2"><div class="card"><h3>Top counterparts</h3><div class="sub">Numbers the target exchanged messages / calls with</div><div id="wl1"></div></div><div class="card"><h3>Hour of day (IST)</h3><div id="wl2"></div></div></div>
      <div class="card"><h3>Message &amp; call log</h3><div id="wlT"></div></div>` : ''}${G.length ? '<div class="card"><h3>Groups</h3><div id="wlG"></div></div>' : ''}`;
    if (E.length) {
      const cp = new Map(); E.forEach(r => [r.from, r.to].join(',').split(/[,;\s]+/).map(x => WReply.mob(x)).filter(x => x && x !== r.acct).forEach(n => { if (!cp.has(n)) cp.set(n, []); cp.get(n).push(r); }));
      Charts.hbar($('#wl1', el), [...cp].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(WData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' event' : ' events'), max: 10 });
      Charts.vbar($('#wl2', el), Array.from({ length: 24 }, (_, h) => { const recs = E.filter(r => r.ist && r.ist.length > 10 && +r.ist.slice(11, 13) === h); return { label: String(h).padStart(2, '0'), value: recs.length, recs: recs.map(WData.view) }; }), { fmt: v => v + (v === 1 ? ' event' : ' events') });
      Table($('#wlT', el), { rows: E, exportName: 'whatsapp_logs', sortKey: 'ist', sortDir: -1, columns: [{ key: 'ist', label: 'Time (IST)', render: r => `<span class="mono">${esc(r.ist || '')}</span>` }, { key: 'kind', label: 'Kind' }, { key: 'type', label: 'Type', render: r => esc([r.type, r.media, r.style].filter(Boolean).join(' · ')) }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'ip', label: 'IP', render: r => `<span class="mono ipv">${esc(r.ip || '')}</span>` }, { key: 'port', label: 'Port' }, { key: 'device', label: 'Device' }, { key: 'gid', label: 'Group' }, { key: 'acct', label: 'WhatsApp number' }], onRow: r => Records.show(r.kind + ' – ' + (r.ist || ''), [WData.view(r)]) });
    }
    if (G.length) Table($('#wlG', el), { rows: G, exportName: 'whatsapp_groups', columns: [{ key: 'subject', label: 'Subject' }, { key: 'gid', label: 'Group ID', render: r => `<span class="mono">${esc(r.gid || '')}</span>` }, { key: 'role', label: 'Owned / participating' }, { key: 'size', label: 'Members' }, { key: 'created', label: 'Created' }, { key: 'description', label: 'Description' }, { key: 'acct', label: 'WhatsApp number' }], onRow: r => Records.show('Group ' + (r.subject || r.gid), [WData.view(r)]) });
  },

  wcom(el) {
    const T = WReply.TYPES, f = T.some(t => t[0] === S.wField) ? S.wField : 'mobile', only = S.wOnly !== false;
    const sh = g => g.accts >= 2 || g.also, allR = WData.common(f), shN = allR.filter(sh).length;
    const rows = allR.filter(g => !only || !shN || sh(g)).sort((a, b) => (b.also ? 1 : 0) - (a.also ? 1 : 0) || b.accts - a.accts || b.n - a.n);
    el.innerHTML = `<div class="card"><h3>Common analysis</h3><div class="sub">The same value across WhatsApp numbers, devices, IPs, address books and logs. <b>Also in case</b> = it also appears in Google, bank, KYC, NCRP or other social data.</div>
      <div class="g-fields">${T.map(([k, l]) => { const c = WData.common(k), n = c.filter(sh).length; return `<button class="${k === f ? 'on' : ''}" data-wf="${k}">${l}<b>${n}</b><small>${c.length}</small></button>`; }).join('')}</div>
      <label class="row small" style="gap:6px;margin:6px 0 2px"><input type="checkbox" id="wOnly" ${only ? 'checked' : ''}> Only shared values (in 2+ WhatsApp numbers, or also in Google / bank / KYC / NCRP / other social data)</label>${only && !shN ? '<div class="note" style="margin-top:6px">No value of this type is shared yet, so all values are shown.</div>' : ''}</div>
      <div class="grid g2"><div class="card"><h3>Top ${esc((T.find(t => t[0] === f) || [])[1] || '')}</h3><div class="sub">Click a bar to see the records</div><div id="wcC"></div></div><div class="card"><h3>Seen in</h3><div id="wcK"></div></div></div>
      <div class="card"><div id="wcT"></div></div>`;
    $$('[data-wf]', el).forEach(b => b.onclick = () => { S.wField = b.dataset.wf; this.wcom(el); });
    $('#wOnly', el).onchange = e => { S.wOnly = e.target.checked; this.wcom(el); };
    Charts.hbar($('#wcC', el), rows.slice().sort((a, b) => b.n - a.n).map(g => ({ label: g.value, value: g.n, sub: g.also ? '⚑ ' + g.also : g.accts + ' number(s)', recs: g.recs.map(WData.view) })), { fmt: v => v + (v === 1 ? ' record' : ' records'), max: 10 });
    const K = new Map(); rows.forEach(g => g.recs.forEach(r => { if (!K.has(r.kind)) K.set(r.kind, []); K.get(r.kind).push(r); }));
    Charts.hbar($('#wcK', el), [...K].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(WData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' record' : ' records') });
    Table($('#wcT', el), { rows, exportName: 'whatsapp_common_' + f, sortKey: 'n', sortDir: -1, columns: [{ key: 'value', label: 'Value', render: r => `<b class="mono">${esc(r.value)}</b>` }, { key: 'n', label: 'Times', num: true }, { key: 'accts', label: 'WhatsApp numbers', num: true }, { key: 'acctList', label: 'Number list' }, { key: 'kinds', label: 'Found in' }, { key: 'first', label: 'First (IST)' }, { key: 'last', label: 'Last (IST)' }, { key: 'also', label: 'Also in case', render: r => r.also ? `<span class="badge warn">⚑ ${esc(r.also)}</span>` : '' }],
      onRow: r => Records.show((T.find(t => t[0] === f) || [])[1] + ' – ' + r.value, r.recs.map(WData.view)) });
  },

  wtime(el, d) {
    const E = d.filter(r => r.ist);
    const extra = []; WData.accounts().forEach(a => [['service_start', 'Service start'], ['ab_change', 'Last address book change'], ['generated', 'Reply generated']].forEach(([f, l]) => { const t = GReply.ts(a[f]); if (t) extra.push({ kind: 'Account', activity: l, acct: a.acct, ts: t, ist: GReply.ist(t), _src: a._src, _f: [[l, a[f]]] }); }));
    const all = [...E, ...extra];
    if (!all.length) { el.innerHTML = '<div class="card muted">No dated events in the imported files.</div>'; return; }
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Events per day (IST)</h3><div id="wt1"></div></div><div class="card"><h3>Hour of day (IST)</h3><div class="sub">When the number is active</div><div id="wt2"></div></div>
      <div class="card"><h3>Weekday</h3><div id="wt3"></div></div><div class="card"><h3>Event type</h3><div id="wt4"></div></div></div><div class="card"><h3>Timeline</h3><div class="sub">Every dated event from all WhatsApp files, newest first</div><div id="wtT"></div></div>`;
    const days = groupBy(all, r => r.ist.slice(0, 10)); Charts.line($('#wt1', el), [...days.keys()].sort().map(k => ({ label: k, value: days.get(k).length, recs: days.get(k).map(WData.view) })), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    Charts.vbar($('#wt2', el), Array.from({ length: 24 }, (_, h) => { const recs = all.filter(r => r.ist.length > 10 && +r.ist.slice(11, 13) === h); return { label: String(h).padStart(2, '0'), value: recs.length, recs: recs.map(WData.view) }; }), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    Charts.vbar($('#wt3', el), wd.map((w, i) => { const recs = all.filter(r => new Date(r.ist.slice(0, 10)).getDay() === i); return { label: w, value: recs.length, recs: recs.map(WData.view) }; }), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    const lab = r => r.kind === 'Account' ? r.activity : r.kind + (r.activity ? ' · ' + r.activity : r.type ? ' · ' + r.type : '');
    const K = groupBy(all, lab); Charts.hbar($('#wt4', el), [...K].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(WData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    Table($('#wtT', el), { rows: all, exportName: 'whatsapp_timeline', sortKey: 'ist', sortDir: -1, columns: [{ key: 'ist', label: 'Time (IST)', render: r => `<span class="mono">${esc(r.ist)}</span>` }, { key: 'what', label: 'Event', render: r => esc(lab(r)) }, { key: 'det', label: 'Details', render: r => esc([r.from && r.to ? r.from + ' → ' + r.to : '', r.subject, r.os_build].filter(Boolean).join(' · ')) }, { key: 'ip', label: 'IP', render: r => `<span class="mono ipv">${esc((r.ip || '') + (r.port ? ':' + r.port : ''))}</span>` }, { key: 'acct', label: 'WhatsApp number' }, { key: '_src', label: 'File' }], onRow: r => Records.show(lab(r) + ' – ' + r.ist, [WData.view(r)]) });
  },

  wcsv(el) {
    const R = Analysis.socRows();
    if (!R.length) { el.innerHTML = '<div class="card muted">No WhatsApp rows from CSV / Excel imports. Use <b>Import WhatsApp reply</b> for the records.html files from Meta.</div>'; return; }
    const keys = uniq(R.flatMap(r => Object.keys(r).filter(k => !k.startsWith('_') && !['id', 'src', 'srcId'].includes(k) && R.some(x => x[k] !== undefined && x[k] !== '')))).slice(0, 14);
    el.innerHTML = '<div class="card"><h3>WhatsApp rows from CSV / Excel imports</h3><div class="sub">Rows imported through Data Import with platform WhatsApp</div><div id="wvT"></div></div>';
    Table($('#wvT', el), { rows: R, exportName: 'whatsapp_rows', columns: keys.map(k => ({ key: k, label: k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) })), onRow: r => Records.show('WhatsApp row', [Object.fromEntries(keys.filter(k => r[k]).map(k => [k, r[k]]))]) });
  },

  wfiles(el) {
    const F = groupBy(WData.all(), r => r._src);
    el.innerHTML = `<div class="card"><h3>Add WhatsApp reply files</h3><div id="wD"></div></div><div class="card"><h3>Imported WhatsApp files</h3><div id="wfT"></div></div>`;
    this.drop($('#wD', el));
    Table($('#wfT', el), { rows: [...F].map(([file, v]) => ({ file, n: v.length, kinds: [...groupBy(v, r => r.kind)].map(([k, x]) => k + ' ' + x.length).join(' · '), accts: uniq(v.map(r => r.acct).filter(Boolean)).join(', ') })), exportName: 'whatsapp_files',
      columns: [{ key: 'file', label: 'File' }, { key: 'n', label: 'Records', num: true }, { key: 'kinds', label: 'What was found' }, { key: 'accts', label: 'WhatsApp number' }, { key: 'x', label: '', render: r => `<button class="btn sm" data-wdel="${esc(r.file)}">🗑 Remove</button>` }],
      after: t => $$('[data-wdel]', t).forEach(b => b.onclick = ev => { ev.stopPropagation(); if (UI.confirm('Remove all records from ' + b.dataset.wdel + '?')) { WData.removeFile(b.dataset.wdel); Analysis.invalidate(); render(); } }) });
  }
};

(() => {
  const op = Pages.social;
  Pages.social = function (main) { if (S.socPlat === 'whatsapp') return WTabs.page(main); return op.apply(this, arguments); };
  // the platform chip shows WhatsApp reply records too
  const ob = GTabs.bar; GTabs.bar = function (main) { ob.apply(this, arguments); const n = (S.data.whatsapp || []).length, b = $('.pchip[data-plat=whatsapp] b', main); if (b && n) b.textContent = fmtNum(S.data.social.filter(r => Analysis.platOf(r) === 'whatsapp').length + n); };
  // WhatsApp identifiers join the case-wide identifier index (cross-links with Google, bank, KYC, NCRP)
  const oi = Analysis.idents;
  Analysis.idents = function () {
    const out = oi.apply(this, arguments);
    if (!out._w && S.data.whatsapp && S.data.whatsapp.length) { out._w = 1; for (const r of S.data.whatsapp) for (const [t, v] of WReply.ids(r)) if (['mobile', 'email', 'ip', 'imei'].includes(t)) out.push({ type: t, value: v, section: 'Social', ref: 'WhatsApp · ' + (r.kind === 'Contact' ? 'address book of ' : r.kind + ' · ') + (r.acct || ''), rec: r, wa: 1, label: 'WhatsApp' }); }
    return out;
  };
  // demo: a small fake WhatsApp reply that links to the demo Google and social records
  if (typeof Demo !== 'undefined') { const od = Demo.load; Demo.load = function () { const before = S.data.txns.length; const r = od.apply(this, arguments); if (S.data.txns.length > before && !WData.all().length) { for (const [name, text] of Object.entries(WDEMO)) { const recs = WReply.parse(text, name); recs.forEach(x => x.id = uid()); WData.all().push(...recs); } saveCase(); } return r; }; }
})();

const WDEMO = {
  'DEMO › records1.html': `WhatsApp Business Record Page 1
Service
WhatsApp
Internal Ticket Number
900000001
Target
+919123456780
Logical ID
100000000000001
Account Identifier
+919123456780
Account Type
WhatsAppUser
Generated
2026-10-04 10:00:00 UTC
Date Range
2026-09-01 00:00:00 UTC to 2026-10-04 00:00:00 UTC
Ncmec Reports Definition
Ncmec Reports: NCMEC Cybertip information (dummy).
NCMEC CyberTips
No responsive records
Emails Definition
Emails: The account holder's recovery email (dummy).
Registered Email Addresses
stockguru.dummy@example.com
Connection Info Definition
Last Connected IP: dummy definition text.
Connection
Device Id
0
Service start
2026-07-18 08:30:00 UTC
Device Type
Android
App Version
2.26.6.72
Device OS Build Number
os: 14, model: Redmi Note 12
Connection State
OFFLINE
Last seen
2026-10-03 18:24:10 UTC
Last IP
49.36.100.21:40521
Push Name
Stock Guru (DUMMY)
Device Info
Device Id
0
App Version
Android-2.26.6.72
OS Version
14
Device Manufacturer
Xiaomi
Device Model
Redmi Note 12
Address Book
Last address book change
2026-10-02 11:55:41 UTC
Symmetric contacts
3 Total
919988776655
919000011122
919876500001
Asymmetric contacts
1 Total
918888800002
Backup Setting
True
Message Log
Timestamp
2026-10-02 10:02:00 UTC
Message Id
DUMMYMSG001
Sender
919123456780
Recipients
919988776655
Sender Ip
49.36.100.21
Sender Port
40521
Sender Device
android
Type
text
Message Style
individual
Message Size
120
Timestamp
2026-10-02 10:25:00 UTC
Message Id
DUMMYMSG002
Sender
919988776655
Recipients
919123456780
Sender Ip
106.210.33.7
Sender Port
5222
Sender Device
android
Type
image
Message Style
individual
Message Size
84512
`
};
