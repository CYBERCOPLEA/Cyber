/* google.js – Social Media › Google: read Google LERS replies (Subscriber info, Change history,
   Android Device Configuration Service, Google Pay customer info) and find common identifiers */
'use strict';

const GReply = {
  SECT: /phone numbers|account recovery|ip activity|device information|change history|subscriber|device attributes|device and account identifiers|network connectivity|google pay|customer information|payment|transactions?|instruments|addresses|devices|login|services|configuration service|subscriber information/i,
  HK: /^(timestamp|time|date|ip|ip address|change type|old value|new value|activity|activity type|event|android id|apple ios idfv|ios idfv|idfv|imei|device|model|brand|make|user agent|description|amount|status|type|location|country|serial|mac|merchant|counterparty|upi|transaction|instrument|reason)/i,
  RXIP4: /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g,
  RXIP6: /\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b|\b(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?\b/gi,
  RXMAC: /\b[0-9a-f]{2}(?:[:-][0-9a-f]{2}){5}\b/gi,
  RXUPI: /\b[\w.\-]{2,}@(?:ok[a-z]+|ybl|ibl|axl|paytm|upi|apl|yapl|ikwik|fbl|pthdfc|ptsbi|ptaxis|ptyes|[a-z]{2,12})\b(?!\.)/gi,
  key: k => String(k).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),

  /* ---------- files → rows of cells ---------- */
  async files(list) {
    const out = [];
    for (const f of list) {
      if (/\.zip$/i.test(f.name)) out.push(...await this.files(await this.unzip(await f.arrayBuffer())));
      else if (/\.rar$/i.test(f.name)) { if (!window.Unrar) throw new Error('RAR reader not loaded'); out.push(...await this.files((await Unrar.extract(await f.arrayBuffer())).map(x => new File([x.data], this.short(x.name))))); }
      else out.push(f);
    }
    return out;
  },
  short(n) { return n.split(/[\/\\]/).filter(Boolean).slice(-2).join(' › '); },
  async unzip(buf) {
    const dv = new DataView(buf); let e = buf.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Not a valid ZIP file');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nl)); p += 46 + nl + xl + cl;
      if (name.endsWith('/') || /__MACOSX|\.DS_Store/.test(name)) continue;
      const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), data = new Uint8Array(buf, off + 30 + lnl + lxl, csize);
      let bytes; if (method === 0) bytes = data; else if (method === 8) bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); else continue;
      out.push(new File([bytes], this.short(name)));
    }
    return out;
  },
  html2text(h) { const t = document.createElement('textarea'); t.innerHTML = h.replace(/<(script|style|title)[\s\S]*?<\/\1>/gi, '').replace(/<\/tr>/gi, '\n').replace(/<tr\b[^>]*>/gi, '').replace(/<\/?(br|p|div|h\d|li|ul|ol|table)\b[^>]*>/gi, '\n').replace(/<\/t[dh]>/gi, '\t').replace(/<[^>]+>/g, ''); return t.value; },
  csvRows(text) { const rows = []; text.split(/\r?\n/).forEach(l => { if (!l.trim()) rows.push([]); else { const c = Parsers.csv(l)[0] || []; while (c.length && !c[c.length - 1]) c.pop(); rows.push(c); } }); return rows; },
  textRows(text) { return String(text).split(/\r?\n/).map(l => { if (!l.trim()) return []; const c = (l.includes('\t') ? l.split('\t') : l.trim().split(/\s{2,}/)).map(x => x.trim()); while (c.length && !c[c.length - 1]) c.pop(); return c; }); },
  async read(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') { const p = await Parsers.readPdf(file, m => window.prompt(m)); return { text: p.text, rows: this.textRows(p.text) }; }
    if (['xlsx', 'xls', 'ods'].includes(ext)) { const p = await Parsers.readFile(file); const rows = []; p.sheets.forEach(s => { rows.push([s.name.toUpperCase()]); s.rows.forEach(r => { const c = r.map(x => x instanceof Date ? x.toISOString() : String(x ?? '').trim()); while (c.length && !c[c.length - 1]) c.pop(); rows.push(c); }); rows.push([]); }); return { text: p.text, rows }; }
    let text = await file.text(); if (/^(html?|xml)$/.test(ext) || /^\s*<(!doctype|html)/i.test(text)) text = this.html2text(text);
    if (ext === 'csv' && !/\t/.test(text)) return { text, rows: this.csvRows(text) };
    if (ext === 'json') { try { text = JSON.stringify(JSON.parse(text), null, 1).replace(/[{}\[\]",]/g, '').replace(/^\s+/gm, ''); } catch (e) { } }
    return { text, rows: this.textRows(text) };
  },

  /* ---------- rows → key/values and tables ---------- */
  scan(rows) {
    const kvs = [], tables = []; let sect = '', head = null, last = null;
    const KV = /^\s*([A-Za-z][A-Za-z0-9 ()\/&,.'_\-]{0,70}?)\s*:\s*(.*)$/;
    const isHead = r => r.length >= 2 && r.filter(c => this.HK.test(c) && c.length < 40).length >= 2 && !r.some(c => /\d{4,}|@/.test(c) || this.RXIP4.test(c) && (this.RXIP4.lastIndex = 0, true));
    for (const r0 of rows) {
      const r = r0;
      if (!r.length || r.every(c => !c)) continue;
      if (r.length === 1 && /confidential (and|&) proprietary|^#{5,}/i.test(r[0])) continue;
      this.RXIP4.lastIndex = 0;
      if (isHead(r)) { head = { sect, header: r, rows: [] }; tables.push(head); last = null; continue; }
      if (head && r.length >= 2 && !(r.length === 2 && /:$/.test(r[0]))) { head.rows.push(r); continue; }
      head = null;
      const m = KV.exec(r[0]);
      if (m && m[1].split(/\s+/).length <= 9 && !/^\d/.test(m[1])) { last = { sect, key: m[1].trim(), val: [m[2], ...r.slice(1)].map(x => x.trim()).filter(Boolean).join(', ') }; kvs.push(last); continue; }
      if (r.length === 2 && /:$/.test(r[0])) { last = { sect, key: r[0].replace(/:$/, '').trim(), val: r[1] }; kvs.push(last); continue; }
      if (r.length === 2 && r[0].length < 50 && /[a-z]/i.test(r[0]) && !/\d{4,}/.test(r[0])) { last = { sect, key: r[0], val: r[1] }; kvs.push(last); continue; }
      const line = r.join(' ').trim();
      const heading = /[A-Za-z]/.test(line) && !/\d{5,}|@/.test(line) && line.length < 80 && (line === line.toUpperCase() || this.SECT.test(line) || /:$/.test(line));
      if (heading && !(last && last.sect === sect && last.val === '' && !/:$/.test(line) && line !== line.toUpperCase())) { sect = line.replace(/:$/, '').trim(); last = null; continue; }
      if (last && last.sect === sect) last.val = last.val ? last.val + ', ' + line : line;
      else { last = { sect, key: sect || 'Value', val: line }; kvs.push(last); }
    }
    return { kvs, tables };
  },

  ts(s) {
    s = String(s || '').replace(/[\u202f\u00a0]/g, ' ').trim(); if (!s || /^1970-01-01/.test(s)) return '';
    if (!/^\d{4}/.test(s)) { const d = Date.parse(s.replace(/ UTC$/, ' GMT')); return isNaN(d) ? '' : new Date(d).toISOString().slice(0, 19) + 'Z'; }
    let t = s.replace(/\s+(UTC|GMT|Z)$/i, 'Z').replace(/^(\d{4})[\/.](\d\d)[\/.](\d\d)/, '$1-$2-$3');
    if (/^\d{4}-\d\d-\d\d \d/.test(t)) t = t.replace(' ', 'T');
    const d = Date.parse(t); if (isNaN(d)) { const m = s.match(/(\d{4})-(\d\d)-(\d\d)/); return m ? m[0] : ''; }
    return new Date(d).toISOString().slice(0, 19) + 'Z';
  },
  ist(iso) { if (!iso) return ''; if (iso.length <= 10) return iso; const d = Date.parse(iso); return isNaN(d) ? iso : new Date(d + 19800000).toISOString().slice(0, 19).replace('T', ' '); },

  /* ---------- key/values + tables → records ---------- */
  DEVK: /android id|imei|serial|mac address|user profile|^users?$|time ?zone|^model|^brand|manufacturer|device type|roaming|registration time|last data connection|^operator|carrier|^sim|iccid|imsi|build|^os|android version|device name/,
  na: v => !v || /^(n\/?a|none|null|-|\+0|unknown|0|false)$/i.test(String(v).trim()),
  androidHex(v) { v = String(v).trim(); if (/^\d{17,20}$/.test(v)) { try { return BigInt(v).toString(16).padStart(16, '0'); } catch (e) { } } return /^[0-9a-f]{8,20}$/i.test(v) ? v.toLowerCase() : ''; },
  parse(text, rows, file) {
    const { kvs, tables } = this.scan(rows), head = file + ' ' + text.slice(0, 400), pay = /google ?pay|gpay|payments? (profile|customer)|customerinfo|instruments?_|^\s*instrument\b/im.test(head), devFile = /android device configuration|^device-\d/im.test(head) || /› Device-\d/.test(file), recs = [];
    if (pay) recs.push(...this.payRec(kvs, tables, file, text));
    const fileAcct = { email: '', gaia: '' };
    for (const kv of kvs) { const k = this.key(kv.key); if (!fileAcct.gaia && /google account id|gaia/.test(k)) fileAcct.gaia = (kv.val.match(/\d{6,}/) || [kv.val])[0]; if (!fileAcct.email && /^e mail$|^email$|^e mail address|^email address|^account e mail/.test(k)) fileAcct.email = (kv.val.match(RX.email) || [''])[0].toLowerCase(); }
    const acctOf = () => fileAcct.email || fileAcct.gaia;
    // group key/values: a repeated key in the same section starts a new group
    const groups = []; let g = null;
    for (const kv of kvs) { const k = this.key(kv.key); if (!g || g.sect !== kv.sect || g.keys.has(k)) { g = { sect: kv.sect, keys: new Set(), kv: [] }; groups.push(g); } g.keys.add(k); g.kv.push(kv); }
    let acct = null, dev = null, gp = null;
    const label = kv => (kv.sect && !this.key(kv.key).includes(this.key(kv.sect)) && kv.key !== kv.sect ? kv.sect + ' › ' : '') + kv.key;
    for (const gr of pay ? [] : groups) {
      gr.kv = gr.kv.filter(v => !this.na(v.val)); if (!gr.kv.length) continue;
      const K = [...gr.keys], sk = this.key(gr.sect), has = re => K.some(k => re.test(k)), get = re => { const x = gr.kv.find(v => re.test(this.key(v.key))); return x ? x.val : ''; };
      if (has(/change type/)) { recs.push(this.ev('change', { ts: get(/time|date/), ip: get(/(^| )ip( |$)|ip address/), type: get(/change type/), old: get(/old value/), new: get(/new value/) }, gr.kv, file, acctOf())); continue; }
      if (has(/time|date/) && has(/(^| )ip( |$)|ip address/) && !has(/last data connection/) && (/ip activity|login|activity/.test(sk) || has(/activity|event/) || K.length <= 5)) { recs.push(this.ev('ip', { ts: get(/time|date/), ip: get(/(^| )ip( |$)|ip address/), activity: get(/activity|event|type/), android_id: get(/android id/), idfv: get(/idfv/), device: get(/user agent|device/) }, gr.kv, file, acctOf())); continue; }
      const devish = devFile || K.filter(k => this.DEVK.test(k)).length >= Math.max(1, K.length / 2) || /device|network connectivity|attributes|identifiers/.test(sk) && !/account/.test(sk.replace('device and account identifiers', ''));
      if (devish) {
        const aid = this.androidHex(get(/android id/)) || get(/android id/);
        if (!dev || (aid && dev.android_id && aid !== dev.android_id)) { dev = { kind: 'Device', acct: acctOf(), _src: file, _f: [] }; recs.push(dev); if (aid) dev.android_id = aid; }
        for (const kv of gr.kv) { dev._f.push([label(kv), kv.val]); const k = this.key(kv.key), set = (f, re) => { if (re.test(k) && !dev[f]) dev[f] = kv.val; };
          set('android_id', /android id/); set('imei', /imei/); set('serial', /serial/); set('mac', /mac/); set('user_profile', /user profile/); set('users', /^users?$/); set('timezone', /time ?zone/);
          set('model', /model/); set('brand', /^brand|manufacturer|make/); set('device_type', /device type/); set('roaming', /roaming/); set('reg_time', /registration time/);
          set('last_conn', /^time of last data connection|last data connection time/); set('last_ip', /ip address from last data connection|last data connection ip/); set('last_reason', /reason for last data connection/); set('operator', /operator|carrier/);
          set('meid', /meid/); set('locale', /^locale/); set('network', /data network type/); set('patch', /security patch/); set('sdk', /android sdk/); set('first_conn', /first data connection/); set('fingerprint', /build fingerprint/); }
        continue;
      }
      if (pay) {
        if (!gp) { gp = { kind: 'Google Pay', acct: acctOf(), _src: file, _f: [] }; recs.push(gp); }
        for (const kv of gr.kv) { gp._f.push([label(kv), kv.val]); const k = this.key(kv.key), set = (f, re) => { if (re.test(k) && !gp[f]) gp[f] = kv.val; };
          set('name', /name/); set('email', /e ?mail/); set('mobile', /phone|mobile/); set('address', /address/); set('upi', /upi|vpa/); set('bank', /bank|instrument|linked account|account number|card/); set('created', /created|registration|since/); }
        continue;
      }
      const gid = get(/google account id|gaia/);
      if (!acct || (gid && acct.gaia && this.key(gid) !== this.key(acct.gaia))) { acct = { kind: 'Account', acct: '', _src: file, _f: [] }; recs.push(acct); }
      for (const kv of gr.kv) { acct._f.push([label(kv), kv.val]); const k = this.key(kv.key), s = this.key(kv.sect), set = (f, re) => { if (re.test(k) && !acct[f]) acct[f] = kv.val; };
        set('gaia', /google account id|gaia/); set('name', /^name$|^full name|^display name/); set('given', /given name|first name/); set('family', /family name|last name|surname/);
        set('email', /^e mail$|^email$|^e mail address|^email address/); set('alt_emails', /alternate e ?mails?/); set('created', /created on|creation/); set('tos_country', /terms of service country/);
        set('tos_ip', /terms of service ip/); set('birthday', /birthday|date of birth/); set('services', /^services/); set('updated', /last updated/); set('logins', /last logins?/);
        set('status', /status/); set('deleted', /deletion/);
        if (/phone|sms/.test(k) || /phone numbers/.test(s)) acct.phones = [acct.phones, kv.val].filter(Boolean).join(', ');
        if (/account recovery/.test(s) || /recovery/.test(k)) acct.recovery = [acct.recovery, kv.key + ': ' + kv.val].filter(Boolean).join(' · '); }
      if (acct.email) acct.email = (acct.email.match(RX.email) || [acct.email])[0].toLowerCase();
      acct.acct = acct.email || acct.gaia || acctOf();
    }
    for (const t of tables) {
      const H = t.header.map(h => this.key(h)), col = re => H.findIndex(h => re.test(h)), at = (r, re) => { const i = col(re); return i >= 0 ? r[i] || '' : ''; };
      const kind = H.some(h => /change type|old value|new value/.test(h)) ? 'change' : H.some(h => /(^| )ip( |$)|ip address/.test(h)) && H.some(h => /time|date/.test(h)) ? 'ip' : H.some(h => /android id|imei|model|serial/.test(h)) && !H.some(h => /time|date/.test(h)) ? 'device' : pay ? 'pay' : 'row';
      for (const r of t.rows) {
        const f = t.header.map((h, i) => [h, r[i] || '']).filter(x => x[1]);
        if (kind === 'change') recs.push(this.ev('change', { ts: at(r, /time|date/), ip: at(r, /(^| )ip( |$)|ip address/), type: at(r, /change type|type/), old: at(r, /old value/), new: at(r, /new value/) }, null, file, acctOf(), f));
        else if (kind === 'ip') recs.push(this.ev('ip', { ts: at(r, /time|date/), ip: at(r, /(^| )ip( |$)|ip address/), activity: at(r, /activity|event|type/), android_id: at(r, /android id/), idfv: at(r, /idfv/), device: at(r, /user agent|device|model/) }, null, file, acctOf(), f));
        else if (kind === 'device') recs.push({ kind: 'Device', acct: acctOf(), _src: file, _f: f, android_id: at(r, /android id/), imei: at(r, /imei/), serial: at(r, /serial/), mac: at(r, /mac/), model: at(r, /model/), brand: at(r, /brand|make|manufacturer/), timezone: at(r, /time ?zone/), roaming: at(r, /roaming/) });
        else if (kind === 'pay') recs.push(this.ev('pay', { ts: at(r, /time|date/), description: at(r, /description|merchant|counterparty|details|narration/), amount: at(r, /amount/), status: at(r, /status/), txn_id: at(r, /transaction id|utr|upi transaction|reference|txn/), instrument: at(r, /instrument|account|method/) }, null, file, acctOf(), f));
        else if (H.some(h => /phone number/.test(h))) { const ts = this.ts(at(r, /last updated|time|date/)); recs.push({ kind: 'Sign-in phone', acct: acctOf(), _src: file, _f: f, mobile: at(r, /phone number/), country: at(r, /country/), ts, ist: this.ist(ts), activity: [at(r, /send method/), /true/i.test(at(r, /default/)) ? 'default' : '', /true/i.test(at(r, /verified/)) ? 'verified' : ''].filter(Boolean).join(' · ') }); }
        else recs.push({ kind: 'Other', acct: acctOf(), _src: file, _f: f, section: t.sect });
      }
    }
    // last logins → timeline events
    if (!recs.some(r => r.kind === 'IP activity')) recs.filter(r => r.kind === 'Account' && r.logins).forEach(a => a.logins.split(/,\s*(?=\d{4}|[A-Z][a-z]{2} \d)/).forEach(x => { const ts = this.ts(x); if (ts) recs.push({ kind: 'Login', acct: a.acct, ts, ist: this.ist(ts), activity: 'Last login (subscriber info)', _src: file, _f: [['Last login', x]] }); }));
    recs.forEach(r => { if (!r.acct) r.acct = acctOf() || ((r.users || '').match(RX.email) || [''])[0].toLowerCase(); });
    // a file header that only repeats the account ID / e-mail is not a separate account
    return recs.filter(r => !(r.kind === 'Account' && recs.length > 1 && r._f.every(([k]) => /google account id|gaia|e-?mail/i.test(k)) && r._f.length <= 2));
  },
  payRec(kvs, tables, file, text) {
    const ok = kvs.filter(v => !this.na(v.val)), all = re => [...new Set(ok.filter(v => re.test(this.key(v.key))).map(v => v.val.trim()))];
    const pid = (all(/payments profile id/)[0] || (file.match(/_(\d{6,})/) || [])[1] || '').replace(/\D/g, '');
    const emails = [...new Set(ok.flatMap(v => (v.val.match(RX.email) || []).map(e => e.toLowerCase())))];
    const addr = []; let cur = null;
    for (const v of kvs) { const k = this.key(v.key); if (/postal address/.test(this.key(v.sect)) || /^address line|locality|administrative area|postal code number$/.test(k)) { if (!cur || /^address line/.test(k) && cur.done) { cur = { p: [] }; addr.push(cur); } if (!this.na(v.val) && /address line|locality name|administrative area name|postal code number$|premise name|thoroughfare name/.test(k)) cur.p.push(v.val); if (/postal code number$/.test(k)) cur.done = 1; } }
    const r = { kind: 'Google Pay', pid, part: /instrument/i.test(file + text.slice(0, 200)) ? 'Instruments' : 'Customer info', _src: file, _f: ok.map(v => [(v.sect ? v.sect + ' › ' : '') + v.key, v.val.slice(0, 1500)]) };
    const put = (f, arr) => { arr = arr.filter(Boolean); if (arr.length) r[f] = arr.join('; '); };
    put('name', all(/^name$|recipient name|^first name|structured name/)); put('mobile', all(/phone number|^phone|unstructured phone|otp phone/).filter(x => /\d{6,}/.test(x)));
    put('email', emails); put('gaia', [...new Set(all(/gaia id|^user id/).flatMap(x => x.match(/\d{6,}/g) || []))]); put('created', all(/payments profile creation/));
    put('address', [...new Set(addr.map(a => a.p.join(', ')).filter(Boolean))]); put('device', all(/^device$/)); put('sim', all(/sim operator name/));
    put('bank', [...new Set([...all(/instrument issuer name|issuer id/), ...all(/^domain$/).map(d => 'UPI @' + d)])]); put('masked', all(/masked account number|account number suffix/));
    put('vpa_status', [...new Set(all(/^status$/).filter(x => /vpa/i.test(x)))]); put('instruments', [String(kvs.filter(v => /financial account type/i.test(v.key)).length || '')]);
    r.acct = emails[0] || (pid ? 'Payments profile ' + pid : '');
    return [r];
  },
  ev(kind, o, kv, file, acct, f) {
    const K = { change: 'Change', ip: 'IP activity', pay: 'Payment' }[kind];
    const ts = this.ts(o.ts);
    return { kind: K, acct, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v)), ts, ist: this.ist(ts), _src: file, _f: f || (kv || []).map(x => [x.key, x.val]) };
  },

  /* ---------- identifiers in one record (for the Common view) ---------- */
  TYPES: [['mobile', '📱 Mobile'], ['email', '✉ Email'], ['android', '🤖 Android ID'], ['device', '📲 Brand & Model'], ['ip', '🌐 IP address'], ['imei', '🔢 IMEI'], ['mac', '📶 MAC'], ['location', '📍 Location / time zone'], ['date', '📅 Date'], ['hour', '🕐 Hour (IST)'], ['roaming', '✈ Roaming'], ['serial', '🏷 Serial no.'], ['gaia', '🆔 Google Account ID'], ['upi', '₹ UPI ID'], ['idfv', '🍎 Apple IDFV']],
  ids(r) {
    if (r._ids) return r._ids;
    const out = new Map(), add = (t, v) => { v = String(v || '').trim(); if (v && v.length < 200) out.set(t + '|' + v, [t, v]); };
    const all = Object.entries(r).filter(([k, v]) => !k.startsWith('_') && typeof v === 'string' && !['kind', 'ts', 'ist', 'acct'].includes(k)).concat(r._f || []);
    if (r.acct && r.acct.includes('@')) add('email', r.acct.toLowerCase());
    for (const [k0, v0] of all) {
      const k = this.key(k0), v = String(v0);
      (v.match(RX.email) || []).forEach(e => add('email', e.toLowerCase()));
      if (/phone|sms|mobile|recovery|contact|msisdn/.test(k)) (v.match(RX.mobile) || []).forEach(m => { const d = N.mobile(m); if (V.mobile(d)) add('mobile', d); });
      if (/imei/.test(k)) (v.match(/\b\d{14,16}\b/g) || []).forEach(x => add('imei', x));
      if (/android id|android_id/.test(k)) v.split(/[,;\s]+/).map(x => this.androidHex(x)).filter(Boolean).forEach(x => add('android', x));
      if (/meid/.test(k)) (v.match(/\b[0-9a-f]{14}\b/gi) || []).forEach(x => add('imei', x.toUpperCase()));
      const macs = (v.match(this.RXMAC) || []).map(x => x.toLowerCase().replace(/-/g, ':')); macs.forEach(x => add('mac', x));
      if (/(^| )ip( |$)|ip address|last ip|tos ip/.test(k)) { (v.match(this.RXIP4) || []).forEach(x => add('ip', x)); (v.match(this.RXIP6) || []).filter(x => !macs.includes(x.toLowerCase()) && x.split(':').length > 3).forEach(x => add('ip', x.toLowerCase())); }
      if (/serial/.test(k)) v.split(/[,;\s]+/).filter(x => /^[A-Z0-9][A-Z0-9:._-]{5,}$/i.test(x)).forEach(x => add('serial', x.toUpperCase()));
      if (/idfv/.test(k)) (v.match(/[0-9a-f-]{20,}/gi) || []).forEach(x => add('idfv', x.toUpperCase()));
      if (/time ?zone|country|location|city|(^| )address$|region|^state$|^address/.test(k) && !/(^| )ip( |$)|mac|e ?mail|roaming/.test(k)) add('location', v.toUpperCase());
      if (/roaming/.test(k)) add('roaming', v);
      if (/google account id|gaia/.test(k)) (v.match(/\d{6,}/g) || []).forEach(x => add('gaia', x));
      if (/upi|vpa|payment|instrument/.test(k) || r.kind === 'Google Pay' || r.kind === 'Payment') (v.match(this.RXUPI) || []).filter(x => !/@(gmail|yahoo|outlook|hotmail|example)$/i.test(x)).forEach(x => add('upi', x.toLowerCase()));
    }
    if (r.brand || r.model) add('device', [r.brand, r.model].filter(Boolean).join(' ').toUpperCase());
    else if (r.device && r.kind === 'IP activity') add('device', r.device.toUpperCase());
    [r.ts, r.reg_time && this.ts(r.reg_time), r.last_conn && this.ts(r.last_conn)].filter(Boolean).forEach(t => { const i = this.ist(t); add('date', i.slice(0, 10)); if (i.length > 10) add('hour', i.slice(11, 13) + ':00'); });
    return (r._ids = [...out.values()]);
  }
};

const GData = {
  all() { if (!S.data.google) S.data.google = []; return S.data.google; },
  of(kind) { return this.all().filter(r => r.kind === kind); },
  async importFiles(list) {
    const files = await GReply.files([...list]); let n = 0; const done = [];
    for (const f of files) {
      try { const { text, rows } = await GReply.read(f); const recs = GReply.parse(text, rows, f.name); recs.forEach(r => r.id = uid()); this.all().push(...recs); n += recs.length; done.push([f.name, recs.length]);
        S.data.imports.push({ id: uid(), when: new Date().toISOString(), file: f.name, type: 'google', count: recs.length }); }
      catch (e) { done.push([f.name, 'Error: ' + (e.message || e)]); }
    }
    saveCase(); return done;
  },
  removeFile(name) { S.data.google = this.all().filter(r => r._src !== name); S.data.imports = S.data.imports.filter(i => !(i.type === 'google' && i.file === name)); saveCase(); },
  // where else in the case an identifier appears (bank / KYC / NCRP / other social / CAF)
  elsewhere() {
    return Analysis.cached('g:else', () => { const m = new Map(); try { Analysis.idents().filter(x => !x.google).forEach(x => { const k = x.type + '|' + String(x.value).toLowerCase(); if (!m.has(k)) m.set(k, new Set()); m.get(k).add(x.section); }); } catch (e) { } return m; });
  },
  common(type) {
    return Analysis.cached('g:c:' + type, () => {
      const G = new Map();
      for (const r of this.all()) for (const [t, v] of GReply.ids(r)) { if (t !== type) continue; const k = v.toLowerCase(); let g = G.get(k); if (!g) G.set(k, g = { value: v, n: 0, accts: new Set(), kinds: new Set(), files: new Set(), times: [], recs: [] }); g.n++; if (r.acct) g.accts.add(r.acct); g.kinds.add(r.kind); g.files.add(r._src); if (r.ist) g.times.push(r.ist); g.recs.push(r); }
      const EL = this.elsewhere(), map = { mobile: 'mobile', email: 'email', ip: 'ip', imei: 'imei', upi: 'upi' };
      return [...G.values()].map(g => { g.times.sort(); const el = map[type] ? EL.get(map[type] + '|' + g.value.toLowerCase()) : null; return { value: g.value, n: g.n, accts: g.accts.size, acctList: [...g.accts].join(', '), kinds: [...g.kinds].join(', '), files: g.files.size, first: g.times[0] || '', last: g.times[g.times.length - 1] || '', also: el ? [...el].join(', ') : '', recs: g.recs }; });
    });
  },
  view(r) { const o = { kind: r.kind, acct: r.acct }; for (const k of ['ist', 'ip', 'activity', 'type', 'old', 'new', 'name', 'email', 'phones', 'mobile', 'android_id', 'imei', 'serial', 'mac', 'brand', 'model', 'device', 'timezone', 'roaming', 'last_conn', 'last_ip', 'description', 'amount', 'status', 'txn_id', 'upi']) if (r[k]) o[k === 'ist' ? 'time (IST)' : k] = r[k]; o.file = r._src; return o; }
};

/* ---------- page ---------- */
PAGE_META.gsocial = { group: 'Investigation › Social Media', title: 'Google (Gmail · Android · Google Pay)', desc: 'Google LERS replies: Subscriber info, Change history, Android Device Configuration Service and Google Pay. Find the same mobile, email, Android ID, device, IP, IMEI or MAC across them.',
  order: ['gsum', 'gacc', 'gdev', 'gip', 'gchg', 'gpay', 'gcom', 'gtime', 'gfiles'] };

const GTabs = {
  bar(main, body) {
    const PL = Analysis.SOC_PLAT, all = S.data.social, cn = {}; all.forEach(r => { const p = Analysis.platOf(r); cn[p] = (cn[p] || 0) + 1; });
    cn.google = (cn.google || 0) + GData.all().length;
    const bar = document.createElement('div'); bar.className = 'platbar';
    bar.innerHTML = `<span class="pchip" data-plat="" style="--pc:var(--accent)">All platforms <b>${fmtNum(all.length)}</b></span>` + PL.map(([id, l, c]) => `<span class="pchip ${S.socPlat === id ? 'on' : ''}" data-plat="${id}" style="--pc:${c}"><i></i>${l} <b>${fmtNum(cn[id] || 0)}</b></span>`).join('');
    body.parentNode.insertBefore(bar, body.previousElementSibling);
    $$('.pchip', bar).forEach(b => b.onclick = () => { S.socPlat = b.dataset.plat; render(); });
  },
  page(main) {
    const d = GData.all(), c = k => d.filter(r => r.kind === k).length;
    const { cur, body } = tabs(main, 'gsocial', [['gsum', '📊 Overview'], ['gacc', `👤 Accounts (${c('Account')})`], ['gdev', `🤖 Android Devices (${c('Device')})`], ['gip', `🌐 IP Activity (${c('IP activity') + c('Login')})`], ['gchg', `🔁 Change History (${c('Change')})`], ['gpay', `₹ Google Pay (${c('Google Pay') + c('Payment')})`], ['gcom', '⚑ Common'], ['gtime', '🕐 Date & Time'], ['gfiles', '📁 Files']], 'Google',
      `<button class="btn primary" id="gImp">⬆ Import Google reply</button><input type="file" id="gPick" class="hidden" multiple accept=".txt,.csv,.xlsx,.xls,.pdf,.html,.htm,.zip,.json,.log">`);
    this.bar(main, body);
    $('#gImp').onclick = () => this.pick(); $('#gPick').onchange = e => this.load(e.target.files);
    if (!d.length && cur !== 'gfiles') return this.empty(body);
    this[cur](body, d);
  },
  pick() { const fp = $('#gPick'); fp.value = ''; fp.click(); },
  async load(files) {
    if (!files || !files.length) return; UI.toast('Reading ' + files.length + ' file(s)…');
    const done = await GData.importFiles(files); Analysis.invalidate();
    const bad = done.filter(x => typeof x[1] !== 'number');
    UI.toast(`Google: ${done.filter(x => typeof x[1] === 'number').length} file(s) read, ${fmtNum(sum(done, x => typeof x[1] === 'number' ? x[1] : 0))} records` + (bad.length ? ` · ${bad.length} failed` : ''));
    render();
  },
  drop(el) {
    el.innerHTML = `<div class="g-drop" id="gDrop"><div class="g-dl">G</div><b>Drop Google reply files here</b><span>or click to choose · .txt .csv .xlsx .pdf .html or the whole .zip from Google</span>
      <div class="g-kinds"><i style="--k:#4285F4">Subscriber Info</i><i style="--k:#EA4335">Change History</i><i style="--k:#34A853">Android Device Configuration</i><i style="--k:#FBBC05">Google Pay customer info</i></div></div>`;
    const dz = $('#gDrop', el); dz.onclick = () => this.pick();
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); this.load(e.dataTransfer.files); };
  },
  empty(el) {
    el.innerHTML = `<div class="card"><h3>No Google reply in this case yet</h3><div class="sub">Import the files Google sends (you can drop the whole .zip). Each file is read on this computer only.</div><div id="gD"></div>
      <div class="g-help"><div><b style="color:#4285F4">Subscriber Info</b> (.SubscriberInfo) Google Account ID, Name, Family Name, e-Mail, Alternate e-Mails, Created on, Terms of Service Country, Birthday, Services, Last Updated, Last Logins, Phone numbers, Account recovery, Device information, IP activity, Android ID, Apple iOS IDFV</div>
      <div><b style="color:#EA4335">Change History</b> (.ChangeHistory) Timestamp, IP Address, Change Type, Old Value, New Value</div>
      <div><b style="color:#34A853">Android Device Configuration Service</b> Android ID, IMEI(s), Serial Number(s), MAC Addresses, User Profile, Users, Timezone, Model, Brand, Device Type, Roaming State, Registration Time, Last Data Connection time / IP / reason</div>
      <div><b style="color:#FBBC05">Google Pay</b> Customer information, UPI IDs, linked bank accounts, transactions</div></div></div>`;
    this.drop($('#gD', el));
  },
  kv(label, v, cls = '') { return v ? `<div class="${cls}"><span>${esc(label)}</span><b>${esc(v)}</b></div>` : ''; },

  gsum(el, d) {
    const ipv = new Set(), dev = GData.of('Device'), ev = d.filter(r => r.ts);
    d.forEach(r => GReply.ids(r).forEach(([t, v]) => { if (t === 'ip') ipv.add(v); }));
    const ph = new Set(), em = new Set(); d.forEach(r => GReply.ids(r).forEach(([t, v]) => { if (t === 'mobile') ph.add(v); if (t === 'email') em.add(v); }));
    const shared = GReply.TYPES.reduce((a, [t]) => a + GData.common(t).filter(g => g.accts >= 2 || (g.also && t !== 'date' && t !== 'hour')).length, 0);
    el.innerHTML = UI.kpis([['Google accounts', fmtNum(GData.of('Account').length), uniq(d.map(r => r.acct).filter(Boolean)).length + ' linked e-mail / ID', 'c2'], ['Android devices', fmtNum(dev.length), uniq(dev.map(x => [x.brand, x.model].filter(Boolean).join(' ')).filter(Boolean)).slice(0, 2).join(', ') || '—', 'c6'],
      ['IP events', fmtNum(GData.of('IP activity').length), ipv.size + ' unique IPs', 'c4'], ['Account changes', fmtNum(GData.of('Change').length), 'password, phone, recovery…', 'c3'], ['Mobiles · E-mails', ph.size + ' · ' + em.size, 'found in all files', 'c5'], ['Common / cross-linked', fmtNum(shared), 'values in 2+ accounts or other data', 'c1']]) +
      `<div class="grid g2"><div class="card"><h3>Top IP addresses</h3><div class="sub">Click a bar to see every event</div><div id="gs1"></div></div><div class="card"><h3>Activity by date (IST)</h3><div id="gs2"></div></div>
       <div class="card"><h3>Devices (brand &amp; model)</h3><div id="gs3"></div></div><div class="card"><h3>Change types</h3><div id="gs4"></div></div></div>`;
    const top = (t, id, fmt, max) => Charts.hbar($(id, el), GData.common(t).sort((a, b) => b.n - a.n).map(g => ({ label: g.value, value: g.n, sub: g.acctList.slice(0, 40), recs: g.recs.map(GData.view) })), { fmt, max });
    top('ip', '#gs1', v => v + (v === 1 ? ' event' : ' events'), 10); top('device', '#gs3', v => v + (v === 1 ? ' record' : ' records'), 10);
    const days = groupBy(ev, r => r.ist.slice(0, 10)); Charts.line($('#gs2', el), [...days.keys()].sort().map(k => ({ label: k, value: days.get(k).length, recs: days.get(k).map(GData.view) })), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    const ct = groupBy(GData.of('Change'), r => r.type || 'Not given'); Charts.hbar($('#gs4', el), [...ct].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(GData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' change' : ' changes') });
  },

  gacc(el) {
    const A = GData.of('Account');
    el.innerHTML = A.length ? `<div class="g-cards">${A.map((a, i) => `<div class="g-card" style="--gc:#4285F4"><div class="g-ch"><span class="g-av">${esc((a.name || a.email || '?').trim()[0] || '?').toUpperCase()}</span><div><b>${esc(a.name || [a.given, a.family].filter(Boolean).join(' ') || '(name not given)')}</b><small>${esc(a.email || a.acct || '')}</small></div><span class="spacer"></span><span class="badge">${esc(a._src)}</span></div>
      <div class="g-grid">${this.kv('Google Account ID', a.gaia)}${this.kv('Family name', a.family)}${this.kv('Created on', a.created && (a.created + (GReply.ts(a.created).length > 10 ? ' (IST ' + GReply.ist(GReply.ts(a.created)) + ')' : '')))}${this.kv('Terms of Service country', a.tos_country)}${this.kv('Terms of Service IP', a.tos_ip)}${this.kv('Birthday', a.birthday)}${this.kv('Last updated', a.updated)}${this.kv('Status', a.status)}
        ${this.kv('Phone numbers', uniq(String(a.phones || '').split(/\s*,\s*/).filter(x => /\d{6,}/.test(x))).join(', '), 'wide gh')}${this.kv('Alternate e-mails', a.alt_emails, 'wide gh')}${this.kv('Account recovery', a.recovery, 'wide gh')}${this.kv('Last logins', a.logins, 'wide')}${this.kv('Sign-in / 2-Step phones', uniq(GData.of('Sign-in phone').filter(x => x.acct === a.acct).map(x => x.mobile + (x.activity ? ' (' + x.activity + ')' : ''))).join(', '), 'wide gh')}${this.kv('IP events', String(GData.of('IP activity').filter(x => x.acct === a.acct).length || ''))}</div>
      ${a.services ? `<div class="g-svc">${a.services.split(/,\s*/).filter(Boolean).map(s => `<i>${esc(s)}</i>`).join('')}</div>` : ''}
      <details><summary>All ${a._f.length} fields</summary><div class="g-all">${a._f.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div></details></div>`).join('')}</div>` : '<div class="card muted">No subscriber information in the imported files.</div>';
  },
  gdev(el) {
    const D = GData.of('Device');
    el.innerHTML = D.length ? `<div class="g-cards">${D.map(x => `<div class="g-card" style="--gc:#34A853"><div class="g-ch"><span class="g-av">🤖</span><div><b>${esc([x.brand, x.model].filter(Boolean).join(' ') || 'Android device')}</b><small>${esc(x.device_type || '')}${x.users ? ' · ' + x.users.split(/,\s*/).length + ' Google account(s) signed in' : ''}</small></div><span class="spacer"></span>${x.roaming ? `<span class="badge ${/not|no|false|home/i.test(x.roaming) ? 'good' : 'warn'}">✈ ${esc(x.roaming)}</span>` : ''}</div>
      <div class="g-grid">${this.kv('Google accounts on this device', x.users, 'wide gh')}${this.kv('Seen in IP activity', (n => n ? n + ' events' : '')(GData.of('IP activity').filter(r => r.android_id && GReply.androidHex(r.android_id) === x.android_id).length))}${this.kv('Android ID', x.android_id, 'gh')}${this.kv('IMEI(s)', x.imei, 'gh')}${this.kv('Serial number(s)', x.serial)}${this.kv('MAC addresses', x.mac)}${this.kv('User profile', x.user_profile)}${this.kv('Timezone', x.timezone)}${this.kv('Registration time', x.reg_time)}${this.kv('Last data connection', x.last_conn && x.last_conn + (GReply.ts(x.last_conn).length > 10 ? ' (IST ' + GReply.ist(GReply.ts(x.last_conn)) + ')' : ''))}${this.kv('IP of last data connection', x.last_ip, 'gh')}${this.kv('Reason for last connection', x.last_reason)}${this.kv('SIM / cell operator (MCC+MNC)', x.operator)}${this.kv('MEID', x.meid)}${this.kv('Data network', x.network)}${this.kv('First data connection', x.first_conn)}${this.kv('Android SDK', x.sdk)}${this.kv('Security patch', x.patch)}${this.kv('Locale', x.locale)}</div>
      <details><summary>All ${x._f.length} fields · ${esc(x._src)}</summary><div class="g-all">${x._f.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div></details></div>`).join('')}</div>
      <div class="card"><h3>All devices</h3><div id="gdT"></div></div>` : '<div class="card muted">No Android Device Configuration data in the imported files.</div>';
    if (D.length) Table($('#gdT', el), { rows: D, exportName: 'google_devices', columns: ['brand', 'model', 'android_id', 'imei', 'serial', 'mac', 'users', 'timezone', 'roaming', 'reg_time', 'last_conn', 'last_ip', 'last_reason', 'acct', '_src'].map(k => ({ key: k, label: { android_id: 'Android ID', imei: 'IMEI', mac: 'MAC', reg_time: 'Registered', last_conn: 'Last data connection', last_ip: 'Last IP', last_reason: 'Reason', acct: 'Account', _src: 'File' }[k] || k[0].toUpperCase() + k.slice(1) })) });
  },
  evTable(el, rows, cols, name) {
    Table(el, { rows, exportName: name, sortKey: 'ts', sortDir: -1, columns: [{ key: 'ist', label: 'Time (IST)', render: r => `<span class="mono">${esc(r.ist || '')}</span>` }, { key: 'ts', label: 'Time (UTC)', render: r => `<span class="mono muted">${esc(r.ts ? r.ts.replace('T', ' ').replace('Z', '') : '')}</span>` }, ...cols, { key: 'acct', label: 'Account' }, { key: '_src', label: 'File' }], onRow: r => Records.show(r.kind + ' – ' + (r.ist || ''), [GData.view(r)]) });
  },
  gip(el) {
    const R = [...GData.of('IP activity'), ...GData.of('Login')];
    if (!R.length) { el.innerHTML = '<div class="card muted">No IP activity in the imported files.</div>'; return; }
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Most used IP addresses</h3><div id="gi1"></div></div><div class="card"><h3>Logins by hour of day (IST)</h3><div id="gi2"></div></div></div><div class="card"><h3>IP activity &amp; logins</h3><div class="sub">Times from Google are UTC; the IST column adds 5 h 30 min. Send ISP requests with the IP, the exact time and the time zone.</div><div id="giT"></div></div>`;
    const ip = groupBy(R.filter(r => r.ip), r => r.ip); Charts.hbar($('#gi1', el), [...ip].map(([k, v]) => ({ label: k, value: v.length, sub: V.ipKind ? V.ipKind(k) : '', recs: v.map(GData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' event' : ' events'), max: 10 });
    Charts.vbar($('#gi2', el), Array.from({ length: 24 }, (_, h) => { const recs = R.filter(r => r.ist && r.ist.length > 10 && +r.ist.slice(11, 13) === h); return { label: String(h).padStart(2, '0'), value: recs.length, recs: recs.map(GData.view) }; }), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    this.evTable($('#giT', el), R, [{ key: 'ip', label: 'IP address', render: r => `<b class="mono">${esc(r.ip || '')}</b>` }, { key: 'activity', label: 'Activity' }, { key: 'android_id', label: 'Android ID' }, { key: 'idfv', label: 'iOS IDFV' }, { key: 'device', label: 'Device / agent' }], 'google_ip_activity');
  },
  gchg(el) {
    const R = GData.of('Change');
    if (!R.length) { el.innerHTML = '<div class="card muted">No change history in the imported files.</div>'; return; }
    el.innerHTML = `<div class="card"><h3>Google account change history</h3><div class="sub">Look for phone / recovery e-mail / password changes just before or after the fraud date.</div><div id="gcT"></div></div>`;
    this.evTable($('#gcT', el), R, [{ key: 'type', label: 'Change type', render: r => `<span class="badge">${esc(r.type || '')}</span>` }, { key: 'old', label: 'Old value' }, { key: 'new', label: 'New value', render: r => `<b>${esc(r.new || '')}</b>` }, { key: 'ip', label: 'IP address', render: r => `<span class="mono">${esc(r.ip || '')}</span>` }], 'google_change_history');
  },
  gpay(el) {
    const M = new Map();
    GData.of('Google Pay').forEach(p => { const k = p.pid || p._src, m = M.get(k) || { kind: 'Google Pay', _f: [], parts: [] };
      for (const [f, v] of Object.entries(p)) if (!f.startsWith('_') && v && !['kind', 'part', 'acct'].includes(f)) m[f] = m[f] && m[f] !== v ? uniq((m[f] + '; ' + v).split('; ')).join('; ') : v;
      m._f.push(...p._f.map(([a, b]) => [(p.part || '') + ' › ' + a, b])); m.parts.push(p.part); m._src = [m._src, p._src].filter(Boolean).join(', ');
      m.acct = (m.email || '').split('; ')[0] || p.acct; M.set(k, m); });
    const byGaia = new Map(GData.of('Account').filter(a => a.gaia).map(a => [String(a.gaia).replace(/\D/g, ''), a.email || a.acct]));
    const P = [...M.values()].map(m => ({ ...m, part: uniq(m.parts).join(' + '), linked: uniq((m.gaia || '').split('; ').map(g => byGaia.get(g)).filter(Boolean)).join(', ') })), T = GData.of('Payment');
    if (!P.length && !T.length) { el.innerHTML = '<div class="card muted">No Google Pay customer information in the imported files.</div>'; return; }
    const upi = new Set(); [...P, ...T].forEach(r => GReply.ids(r).forEach(([t, v]) => { if (t === 'upi') upi.add(v); }));
    el.innerHTML = `<div class="g-cards">${P.map(p => `<div class="g-card" style="--gc:#FBBC05"><div class="g-ch"><span class="g-av">₹</span><div><b>${esc(p.name || 'Google Pay customer')}</b><small>${esc(p.email || p.acct || '')}</small></div><span class="spacer"></span><span class="badge">${esc(p.part || '')}</span></div>
      <div class="g-grid">${this.kv('Payments profile ID', p.pid)}${this.kv('Profile created', p.created)}${this.kv('Google Account ID', p.gaia)}${this.kv('Linked Google account (in this case)', p.linked, 'gh')}${this.kv('Phone', p.mobile, 'gh')}${this.kv('UPI ID', p.upi, 'gh')}${this.kv('Bank / UPI handle', p.bank, 'wide gh')}${this.kv('Masked account / VPA', p.masked, 'wide')}${this.kv('VPA status', p.vpa_status, 'wide')}${this.kv('Address', p.address, 'wide')}${this.kv('Device', p.device)}${this.kv('SIM operator', p.sim)}${this.kv('Instruments', p.instruments)}</div>
      <details><summary>All ${p._f.length} fields · ${esc(p._src)}</summary><div class="g-all">${p._f.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div></details></div>`).join('')}</div>
      ${upi.size ? `<div class="card"><h3>UPI IDs found</h3><div class="g-svc">${[...upi].map(u => `<i class="mono">${esc(u)}</i>`).join('')}</div></div>` : ''}
      ${T.length ? '<div class="card"><h3>Google Pay transactions</h3><div id="gpT"></div></div>' : ''}`;
    if (T.length) this.evTable($('#gpT', el), T, [{ key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' }, { key: 'txn_id', label: 'Txn ID' }, { key: 'instrument', label: 'Instrument' }], 'google_pay');
  },
  gcom(el) {
    const T = GReply.TYPES, f = T.some(t => t[0] === S.gField) ? S.gField : 'ip', only = S.gOnly !== false;
    const sh = g => g.accts >= 2 || g.also, allR = GData.common(f), shN = allR.filter(sh).length;
    const rows = allR.filter(g => !only || !shN || sh(g)).sort((a, b) => (b.also ? 1 : 0) - (a.also ? 1 : 0) || b.accts - a.accts || b.n - a.n);
    el.innerHTML = `<div class="card"><h3>Common analysis</h3><div class="sub">The same value seen more than once across accounts, devices, IP activity, change history and Google Pay. <b>Also in case</b> means it also appears in bank / KYC / NCRP / other social data.</div>
      <div class="g-fields">${T.map(([k, l]) => { const c = GData.common(k), n = c.filter(g => g.accts >= 2 || g.also).length; return `<button class="${k === f ? 'on' : ''}" data-gf="${k}">${l}<b>${n}</b><small>${c.length}</small></button>`; }).join('')}</div>
      <label class="row small" style="gap:6px;margin:6px 0 2px"><input type="checkbox" id="gOnly" ${only ? 'checked' : ''}> Only shared values (in 2+ Google accounts, or also in bank / KYC / NCRP / other social data)</label>${only && !shN ? '<div class="note" style="margin-top:6px">No value of this type is shared between accounts, so all values are shown.</div>' : ''}</div>
      <div class="grid g2"><div class="card"><h3>Top ${esc((T.find(t => t[0] === f) || [])[1] || '')}</h3><div class="sub">Click a bar to see the records</div><div id="gcC"></div></div><div class="card"><h3>Seen in</h3><div id="gcK"></div></div></div>
      <div class="card"><div id="gcT"></div></div>`;
    $$('[data-gf]', el).forEach(b => b.onclick = () => { S.gField = b.dataset.gf; this.gcom(el); });
    $('#gOnly', el).onchange = e => { S.gOnly = e.target.checked; this.gcom(el); };
    Charts.hbar($('#gcC', el), rows.slice().sort((a, b) => b.n - a.n).map(g => ({ label: g.value, value: g.n, sub: g.accts + ' account(s)', recs: g.recs.map(GData.view) })), { fmt: v => v + (v === 1 ? ' record' : ' records'), max: 10 });
    const K = new Map(); rows.forEach(g => g.recs.forEach(r => { if (!K.has(r.kind)) K.set(r.kind, []); K.get(r.kind).push(r); }));
    Charts.hbar($('#gcK', el), [...K].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(GData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' record' : ' records') });
    Table($('#gcT', el), { rows, exportName: 'google_common_' + f, sortKey: 'n', sortDir: -1, columns: [{ key: 'value', label: 'Value', render: r => `<b class="mono">${esc(r.value)}</b>` }, { key: 'n', label: 'Times', num: true }, { key: 'accts', label: 'Accounts', num: true }, { key: 'acctList', label: 'Account list' }, { key: 'kinds', label: 'Found in' }, { key: 'first', label: 'First (IST)' }, { key: 'last', label: 'Last (IST)' }, { key: 'also', label: 'Also in case', render: r => r.also ? `<span class="badge warn">⚑ ${esc(r.also)}</span>` : '' }],
      onRow: r => Records.show((T.find(t => t[0] === f) || [])[1] + ' – ' + r.value, r.recs.map(GData.view)) });
  },
  gtime(el, d) {
    const E = d.filter(r => r.ts);
    if (!E.length) { el.innerHTML = '<div class="card muted">No dated events in the imported files.</div>'; return; }
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Events per day (IST)</h3><div id="gt1"></div></div><div class="card"><h3>Hour of day (IST)</h3><div class="sub">When the user is active</div><div id="gt2"></div></div>
      <div class="card"><h3>Weekday</h3><div id="gt3"></div></div><div class="card"><h3>Event type</h3><div id="gt4"></div></div></div><div class="card"><h3>Timeline</h3><div class="sub">Every dated event from all Google files, newest first</div><div id="gtT"></div></div>`;
    const days = groupBy(E, r => r.ist.slice(0, 10)); Charts.line($('#gt1', el), [...days.keys()].sort().map(k => ({ label: k, value: days.get(k).length, recs: days.get(k).map(GData.view) })), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    Charts.vbar($('#gt2', el), Array.from({ length: 24 }, (_, h) => { const recs = E.filter(r => r.ist.length > 10 && +r.ist.slice(11, 13) === h); return { label: String(h).padStart(2, '0'), value: recs.length, recs: recs.map(GData.view) }; }), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    Charts.vbar($('#gt3', el), wd.map((w, i) => { const recs = E.filter(r => new Date(r.ist.slice(0, 10)).getDay() === i); return { label: w, value: recs.length, recs: recs.map(GData.view) }; }), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    const K = groupBy(E, r => r.kind + (r.activity ? ' · ' + r.activity : r.type ? ' · ' + r.type : '')); Charts.hbar($('#gt4', el), [...K].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(GData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' event' : ' events') });
    Table($('#gtT', el), { rows: E, exportName: 'google_timeline', sortKey: 'ist', sortDir: -1, columns: [{ key: 'ist', label: 'Time (IST)', render: r => `<span class="mono">${esc(r.ist)}</span>` }, { key: 'kind', label: 'Type' }, { key: 'what', label: 'Details', render: r => esc([r.activity, r.type, r.old && r.new ? r.old + ' → ' + r.new : r.new, r.description, r.amount].filter(Boolean).join(' · ')) }, { key: 'ip', label: 'IP', render: r => `<span class="mono">${esc(r.ip || '')}</span>` }, { key: 'acct', label: 'Account' }, { key: '_src', label: 'File' }], onRow: r => Records.show(r.kind + ' – ' + r.ist, [GData.view(r)]) });
  },
  gfiles(el) {
    const F = groupBy(GData.all(), r => r._src);
    el.innerHTML = `<div class="card"><h3>Add Google reply files</h3><div id="gD"></div></div><div class="card"><h3>Imported Google files</h3><div id="gfT"></div></div>`;
    this.drop($('#gD', el));
    Table($('#gfT', el), { rows: [...F].map(([file, v]) => ({ file, n: v.length, kinds: [...groupBy(v, r => r.kind)].map(([k, x]) => k + ' ' + x.length).join(' · '), accts: uniq(v.map(r => r.acct).filter(Boolean)).join(', ') })), exportName: 'google_files',
      columns: [{ key: 'file', label: 'File' }, { key: 'n', label: 'Records', num: true }, { key: 'kinds', label: 'What was found' }, { key: 'accts', label: 'Account' }, { key: 'x', label: '', render: r => `<button class="btn sm" data-gdel="${esc(r.file)}">🗑 Remove</button>` }],
      after: t => $$('[data-gdel]', t).forEach(b => b.onclick = ev => { ev.stopPropagation(); if (UI.confirm('Remove all records from ' + b.dataset.gdel + '?')) { GData.removeFile(b.dataset.gdel); render(); } }) });
  }
};

(() => {
  const op = Pages.social;
  Pages.social = function (main) { if (S.socPlat === 'google') return GTabs.page(main); return op.apply(this, arguments); };
  // Google identifiers join the case-wide identifier index (cross-links, search)
  const oi = Analysis.idents;
  Analysis.idents = function () {
    const out = oi.apply(this, arguments);
    if (!out._g && S.data.google && S.data.google.length) { out._g = 1; for (const r of S.data.google) for (const [t, v] of GReply.ids(r)) if (['mobile', 'email', 'ip', 'imei', 'upi'].includes(t)) out.push({ type: t, value: v, section: 'Social', ref: 'Google · ' + r.kind + (r.acct ? ' · ' + r.acct : ''), rec: r, google: 1 }); }
    return out;
  };
  // demo: a small fake Google reply that links to the demo social records
  if (typeof Demo !== 'undefined') { const od = Demo.load; Demo.load = function () { const before = S.data.txns.length; const r = od.apply(this, arguments); if (S.data.txns.length > before && !GData.all().length) { for (const [name, text] of Object.entries(GDEMO)) { const recs = GReply.parse(text, /\.csv$/.test(name) ? GReply.csvRows(text) : GReply.textRows(text), name); recs.forEach(x => x.id = uid()); GData.all().push(...recs); } saveCase(); } return r; }; }
})();

const GDEMO = {
  'DEMO.123456789012.SubscriberInfo.txt': `GOOGLE SUBSCRIBER INFORMATION
Google Account ID: 123456789012
Name: Riya Invest (DUMMY)
Given Name: Riya
Family Name: Invest
e-Mail: riya.invest.dummy@example.com
Alternate e-Mails: stockguru.dummy@example.com
Created on: 2026-08-01 09:12:44 UTC
Terms of Service IP: 106.210.33.7, on 2026-08-01 09:12:44 UTC
Terms of Service Language: en
Terms of Service Country: IN
Birthday (Month Day, Year): March 3, 1995
Services: Android, Gmail, Google Pay, YouTube, Google Drive
Last Updated Date: 2026-10-03 18:20:10 UTC
Last Logins: 2026-10-02 16:45:00 UTC, 2026-10-01 15:40:00 UTC

ACCOUNT RECOVERY
Contact e-Mail: stockguru.dummy@example.com
Recovery e-Mail: stockguru.dummy@example.com
Recovery SMS: +91 9988776655

PHONE NUMBERS
User Phone Numbers: +91 9988776655 [Verified], +91 9123456780 [Unverified]

DEVICE INFORMATION
Android ID: 3f9a2b7c1d0e5a64
Device Make: Xiaomi
Device Model: Redmi Note 12

IP ACTIVITY
Timestamp	IP Address	Activity Type	Android ID	Apple iOS IDFV
2026-10-01 15:40:00 UTC	49.36.100.21	Login	3f9a2b7c1d0e5a64
2026-10-02 16:45:00 UTC	106.210.33.7	Login	3f9a2b7c1d0e5a64
2026-10-02 17:05:12 UTC	49.36.100.21	Gmail	3f9a2b7c1d0e5a64
2026-10-03 18:20:10 UTC	203.0.113.45	Account settings
`,
  'DEMO.123456789012.ChangeHistory.csv': `GOOGLE ACCOUNT CHANGE HISTORY
Google Account ID: 123456789012
e-Mail: riya.invest.dummy@example.com

Timestamp,IP Address,Change Type,Old Value,New Value
2026-08-01 09:12:44 UTC,106.210.33.7,ACCOUNT_CREATED,,riya.invest.dummy@example.com
2026-09-30 11:02:10 UTC,49.36.100.21,PHONE_NUMBER_ADDED,,+91 9123456780
2026-10-03 18:20:10 UTC,203.0.113.45,RECOVERY_EMAIL_CHANGED,old.dummy@example.com,stockguru.dummy@example.com
2026-10-03 18:21:02 UTC,203.0.113.45,PASSWORD_CHANGED,,
`,
  'DEMO.AndroidDeviceConfigurationService.txt': `Android Device Configuration Service
Device and Account Identifiers
Android ID: 3f9a2b7c1d0e5a64
IMEI(s): 490154203237518
Serial Number(s): R58T20DUMMY
MAC Addresses: 02:1a:2b:3c:4d:5e
User Profile: 0
Users: riya.invest.dummy@example.com, stockguru.dummy@example.com
Timezone: Asia/Kolkata
Device Attributes
Model: Redmi Note 12
Brand: Xiaomi
Device Type: Phone
Network Connectivity & Performance
Roaming State: Not roaming
Registration Time: 2026-07-18 08:00:00 UTC
Time of Last Data Connection: 2026-10-03 18:25:40 UTC
IP address from Last Data Connection: 49.36.100.21
Reason for Last Data Connection: Periodic check-in
`,
  'DEMO.GooglePay.CustomerInformation.txt': `GOOGLE PAY CUSTOMER INFORMATION
Google Account ID: 123456789012
Name: Riya Invest (DUMMY)
e-Mail: riya.invest.dummy@example.com
Phone Number: +91 9988776655
UPI IDs: riyainvest.dummy@okaxis, 9988776655@okhdfcbank
Linked Bank Account: XXXXXXXX3456 (Punjab National Bank)
Address: Nuh, Haryana

TRANSACTIONS
Time	Description	Amount	Status	UPI Transaction ID
2026-10-02 10:05:00 UTC	Received from DEMO VICTIM ONE	INR 50,000	Completed	629812345678
2026-10-02 10:20:00 UTC	Paid to arif.dummy@ybl	INR 49,000	Completed	629812345690
`
};
