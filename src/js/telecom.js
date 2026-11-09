/* telecom.js - Analysis › CDR, IPDR, TDR (tower dump) and SMS analysis.
   Reads operator Excel / CSV / TXT files (Jio, Airtel, Vi, BSNL…) by matching column names,
   then shows contacts, handsets, towers and movement, IP sessions, common numbers and links with the rest of the case.
   Everything is read on this computer. */
'use strict';

const TK = {
  cdr: ['CDR Analysis', '#3b82f6', 'Call Detail Records: who talked to whom, when, for how long, from which tower and handset.', '📞'],
  ipdr: ['IPDR Analysis', '#06b6d4', 'Internet sessions: private / public IP and port, destination, data used, handset and tower.', '🌐'],
  tdr: ['TDR Analysis', '#f97316', 'Tower dump: every number on a tower in a time window. Find numbers present at several crime spots.', '📡'],
  sms: ['SMS Analysis', '#ec4899', 'SMS records: sender headers (banks, payment apps, loan apps, OTP), who sent what and when.', '✉']
};

/* ---------- reading files ---------- */
const TelRead = {
  /* header → field; first match wins, so the order matters */
  RULES: [
    ['dport', /(dest|destination|dst|server|remote)\w*port/], ['dip', /(dest|destination|dst|server|remote)\w*ip/],
    ['xport', /(public|translated|nat|allocated|global|natted)\w*port/], ['pport', /(private|source|src|internal|local)\w*port/], ['dport', /(dest|destination|dst|server|remote)\w*port/],
    ['xip', /(public|translated|nat|allocated|global|natted)\w*ip/], ['pip', /(private|source|src|internal|local)\w*ip|^ipaddress$|^ipv[46]$/], ['dip', /(dest|destination|dst|server|remote)\w*ip/],
    ['up', /uplink|upload|bytesup|ulvol|datavolumeup|^ul\w*(vol|byte|data)/], ['down', /downlink|download|bytesdown|dlvol|datavolumedown|^dl\w*(vol|byte|data)/],
    ['apn', /^apn|accesspoint/], ['dur', /dur(ation)?|^dur$|callsec|seconds/],
    ['end', /(end|stop|termination|close|disconnect)\w*(time|date)|^(end|stop)$/],
    ['imei', /imei/], ['imsi', /imsi/],
    ['ll2', /last\w*(latlong|latlon|latlng)/], ['ll', /latlong|latlon|latlng/], ['bop', /lrntsp|translationoflrn|lrnoperator|lrnlsa|bpartyoperator|operatorname/],
    ['addr2', /last\w*(addr|location|site|tower|bts|area)/], ['cell2', /last\w*(cell|cgi|lac|bts|tower|ecgi)/],
    ['addr', /addr|location|sitename|^site$|towername|btsloc|^area$|place|cellsite/], ['cell', /cell|cgi|^lac|bts|towerid|siteid|ecgi/],
    ['lat', /^lat/], ['lon', /^(lon|lng)/], ['roam', /roam|circle|^vlr/],
    ['dir', /calltype|callingtype|typeofcall|eventtype|recordtype|usagetype|direction|^type$|messagetype|smstype|calltyp|^inout$|^status$/],
    ['svc', /servicetype|^service$|bearer/], ['msg', /message$|messagetext|smstext|content|^text$|^body$/],
    ['target', /target|msisdn|mobileno|mobilenumber|subscriber(no|num)|servicenum|usernum|^mobile$/],
    ['pb', /^b$|bparty|bnum|called|partyb|otherparty|othernum|receiver|recipient|dial|^to(no|number)?$|destination(no|num)?$/],
    ['pa', /^a$|aparty|anum|calling|partya|sender|header|originat|^from(no|number)?$/],
    ['dt', h => /date/.test(h) && /time/.test(h)], ['date', /date|^day$/], ['time', /time/]
  ],
  field(h) { h = N.hdr(h); if (!h) return ''; for (const [f, r] of this.RULES) if (typeof r === 'function' ? r(h) : r.test(h)) return f; return ''; },
  /* rows of cells from a file */
  async rows(f) {
    const nm = f.name.toLowerCase();
    if (/\.(xlsx|xlsm|xls|ods)$/.test(nm)) {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false });
      return wb.SheetNames.map(s => XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, raw: true, defval: '' }));
    }
    if (/\.(pdf|html?|eml)$/.test(nm)) throw new Error('please give the CDR as Excel / CSV (PDF is not supported for CDR)');
    let t = await f.text(); t = t.replace(/^\uFEFF/, '');
    const lines = t.split(/\r?\n/).filter(l => l.trim());
    const cnt = ch => lines.slice(0, 40).reduce((a, l) => a + l.split(ch).length - 1, 0);
    const del = [',', '|', '\t', ';'].sort((a, b) => cnt(b) - cnt(a))[0];
    return [lines.map(l => { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === del && !q) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map(x => x.trim().replace(/^'+|'+$/g, '').trim()); })];
  },
  /* phone number: 10 digits for Indian mobiles, letters kept for SMS headers */
  num(v) {
    let s = String(v ?? '').trim().replace(/^'+|'+$/g, '').trim(); if (!s || s === '-' || /^(na|n\/a|null|nil)$/i.test(s)) return '';
    if (/[a-z]/i.test(s) && !/^\d+(\.\d+)?e\+\d+$/i.test(s)) return s.toUpperCase().replace(/\s+/g, '');
    if (/e\+/i.test(s)) s = Number(s).toFixed(0);
    let d = s.replace(/\.0+$/, '').replace(/\D/g, '');
    if (d.length === 12 && /^91[6-9]/.test(d)) d = d.slice(2); else if (d.length === 11 && /^0[6-9]/.test(d)) d = d.slice(1); else if (d.length === 13 && /^091[6-9]/.test(d)) d = d.slice(3);
    return d;
  },
  /* date + time → "YYYY-MM-DD HH:MM:SS" */
  dt(dv, tv) {
    if ((dv === '' || dv == null) && tv !== '' && tv != null && (typeof tv === 'number' ? tv > 20000 : /\d{1,4}[-\/.][\dA-Za-z]{1,9}[-\/.]\d{2,4}/.test(String(tv)))) return this.dt(tv);
    const p2 = n => String(n).padStart(2, '0');
    const fromSerial = v => { const d = new Date(Math.round((v - 25569) * 86400) * 1000); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`; };
    const tOf = v => { if (v === '' || v == null) return ''; if (typeof v === 'number') { if (v < 1) { const s = Math.round(v * 86400); return `${p2(Math.floor(s / 3600) % 24)}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}`; } if (v > 20000) return fromSerial(v).slice(11); return ''; }
      const m = String(v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,]\d+)?\s*([AaPp][Mm])?/); if (!m) { const c = String(v).match(/^(\d{2})(\d{2})(\d{2})$/); return c ? `${c[1]}:${c[2]}:${c[3]}` : ''; }
      let h = +m[1]; if (m[4]) { const pm = /p/i.test(m[4]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; } return `${p2(h)}:${m[2]}:${m[3] || '00'}`; };
    let d = '';
    if (typeof dv === 'number' && dv > 20000 && dv < 80000) { const full = fromSerial(dv); d = full.slice(0, 10); if (!tv && dv % 1) return full; }
    else if (dv !== '' && dv != null) { const s = String(dv).trim(); const c = s.match(/^(\d{4})(\d{2})(\d{2})(?:\D?(\d{2})(\d{2})(\d{2}))?$/); if (c) { d = `${c[1]}-${c[2]}-${c[3]}`; if (c[4] && !tv) return `${d} ${c[4]}:${c[5]}:${c[6]}`; } else { const n = N.date(s); if (/^\d{4}-\d{2}-\d{2}/.test(n)) d = n.slice(0, 10); } if (!tv) tv = s.replace(/^\S+\s*/, '') || (/\d:\d/.test(s) ? s : ''); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    return d + ' ' + (tOf(tv) || '00:00:00');
  },
  addr(v) { let a = N.text(v); if (!a || /^[-–]$/.test(a)) return ''; const t = a.split(' '); if (t.length > 8 && t.filter(x => x.length === 1).length > t.length * .6) a = N.text(String(v).split(/\s{2,}/).map(w => w.replace(/ /g, '')).join(' ')); return a; },
  secs(v) {
    if (v === '' || v == null) return 0; if (typeof v === 'number') return v < 1 && v > 0 ? Math.round(v * 86400) : Math.round(v);
    const s = String(v).trim(), m = s.match(/^(\d+):(\d{2}):(\d{2})$/) || s.match(/^()(\d+):(\d{2})$/); if (m) return (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3];
    const n = parseFloat(s.replace(/,/g, '')); return isNaN(n) ? 0 : Math.round(n);
  },
  bytes(v) { if (v === '' || v == null) return 0; if (typeof v === 'number') return v; const s = String(v).replace(/,/g, '').trim(), n = parseFloat(s); if (isNaN(n)) return 0; const u = (s.match(/[kmgt]b/i) || [''])[0].toLowerCase(); return Math.round(n * ({ kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776 }[u] || 1)); },
  dir(v, kind) {
    const t = ' ' + String(v ?? '').toLowerCase().replace(/sms/g, ' sms ').replace(/[_\-/]/g, ' ') + ' ';
    if (!t.trim()) return '';
    const inn = /incom|termin|receiv| in |sms in| mt|mtc|smt|deliver/.test(t), out = /out|origin| mo|moc|smo|dial|sent|submit/.test(t);
    if (/ sms|smt|smo|p2p|a2p|p2a|message/.test(t) || kind === 'SMS') return inn && !out ? 'SMS-IN' : out ? 'SMS-OUT' : 'SMS';
    if (/fow|forward|divert| cf /.test(t)) return 'FWD';
    if (/data|gprs|internet|lte|volte data|packet/.test(t)) return 'DATA';
    if (/forward|divert|cf /.test(t)) return 'FWD';
    if (inn && !out) return 'IN'; if (out) return 'OUT';
    return String(v).trim().toUpperCase().slice(0, 12);
  },
  /* one file → records */
  parse(sheets, name, want) {
    const out = [];
    for (const rows of sheets) {
      if (!rows || rows.length < 2) continue;
      let best = -1, bs = 0, map = null;
      for (let i = 0; i < Math.min(rows.length, 60); i++) {
        const m = {}; rows[i].forEach((c, j) => { const f = this.field(c); if (f && !(f in m)) m[f] = j; });
        const k = Object.keys(m), ok = k.some(f => ['pa', 'pb', 'target', 'xip', 'pip', 'dip'].includes(f)) && k.some(f => ['date', 'dt', 'time'].includes(f));
        if (ok && k.length > bs) { bs = k.length; best = i; map = m; }
      }
      if (best < 0 || bs < 3) continue;
      const pre = rows.slice(0, best).map(r => r.join(' ')).join(' ');
      const meta = {}; rows.slice(0, best).forEach(r => { const c = r.map(x => String(x).trim()).filter(Boolean); const m = c.length === 2 ? [c[0], c[1]] : (c.length === 1 && c[0].match(/^([A-Za-z /]{4,40}?)\s*:-?\s*(.+)$/) || []).slice(1); if (m && m.length === 2 && m[1]) { const k = N.hdr(m[0]); const key = /subscribername|^name$|customername/.test(k) ? 'Name' : /father|husband/.test(k) ? 'Father / husband' : /address/.test(k) ? 'Address' : /circle/.test(k) ? 'Circle' : /connectiontype/.test(k) ? 'Connection' : /activation/.test(k) ? 'Activation date' : /^portin|^mnp/.test(k) ? 'Port in / out' : /alternate/.test(k) ? 'Alternate no' : ''; if (key) meta[key] = N.text(m[1]).replace(/^'+|'+$/g, '').replace(/\s*\d{6}\s*$/, m0 => m0); } });
      if (Object.keys(meta).length) { S.data.telMeta = S.data.telMeta || {}; S.data.telMeta[name] = meta; }
      const preNum = this.num((pre.match(/(?:target|msisdn|mobile|subscriber|number|no\.?)\D{0,25}((?:\+?91)?[6-9]\d{9})\b/i) || [])[1] || '');
      const ipdr = 'xip' in map || 'dip' in map || ('pip' in map && !('pb' in map));
      const kind = ipdr ? 'IPDR' : want === 'IPDR' ? 'CDR' : want;
      const g = (r, f) => f in map ? r[map[f]] : '';
      const raw = rows.slice(best + 1).filter(r => r.some(c => String(c).trim()));
      // who is the target: a "Target" column, else the number in nearly every row, else the number above the table
      let fixedT = '';
      if (!('target' in map) && kind !== 'TDR') {
        const fq = new Map(); raw.forEach(r => uniq([this.num(g(r, 'pa')), this.num(g(r, 'pb'))]).forEach(n => n && fq.set(n, (fq.get(n) || 0) + 1)));
        const top = [...fq].sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] >= raw.length * .6) fixedT = top[0]; else if (!('pa' in map)) fixedT = preNum;
      }
      for (const r of raw) {
        const ts = 'dt' in map ? this.dt(g(r, 'dt')) : this.dt(g(r, 'date'), g(r, 'time'));
        if (!ts) continue;
        const pa = this.num(g(r, 'pa')), pb = this.num(g(r, 'pb'));
        let target = this.num(g(r, 'target')), other = '', dir = this.dir(g(r, 'dir'), kind);
        if (kind === 'IPDR') { target = target || pa || preNum; }
        else if (target) other = pb && pb !== target ? pb : pa && pa !== target ? pa : pb;
        else if (fixedT) { target = fixedT; other = pa === fixedT ? pb : pa || pb; if (!dir) dir = pa === fixedT ? 'OUT' : 'IN'; }
        else { target = pa; other = pb; }
        if (kind === 'SMS' && !dir) dir = 'SMS';
        const sv = String(g(r, 'svc')).toLowerCase(); if (/sms/.test(sv) && !/^SMS/.test(dir)) dir = dir === 'IN' ? 'SMS-IN' : dir === 'OUT' ? 'SMS-OUT' : 'SMS'; else if (/data|gprs|packet/.test(sv)) dir = 'DATA';
        const rec = { kind, _src: name, ts, target, other, dir, imei: (x => x.length >= 14 ? x : '')(N.imei(g(r, 'imei'))), imsi: String(g(r, 'imsi')).replace(/\D/g, ''), cell: String(g(r, 'cell')).trim(), addr: this.addr(g(r, 'addr')), roam: (x => /^[-–]?$|^na$/i.test(x) ? '' : x)(N.text(g(r, 'roam'))) };
        if ('cell2' in map) rec.cell2 = String(g(r, 'cell2')).trim(); if ('addr2' in map) rec.addr2 = this.addr(g(r, 'addr2'));
        if ('lat' in map) { rec.lat = parseFloat(g(r, 'lat')) || ''; rec.lon = parseFloat(g(r, 'lon')) || ''; }
        else if ('ll' in map) { const m = String(g(r, 'll')).match(/(-?\d{1,2}\.\d+)\s*[\/,; ]\s*(-?\d{1,3}\.\d+)/); if (m) { rec.lat = +m[1]; rec.lon = +m[2]; } }
        if ('bop' in map) rec.bop = N.text(g(r, 'bop'));
        if ('msg' in map) rec.msg = N.text(g(r, 'msg')).slice(0, 300);
        if (kind === 'IPDR') {
          Object.assign(rec, { pip: N.ip(g(r, 'pip')), pport: String(g(r, 'pport')).trim(), xip: N.ip(g(r, 'xip')), xport: String(g(r, 'xport')).trim(), dip: N.ip(g(r, 'dip')), dport: String(g(r, 'dport')).replace(/\.0+$/, '').trim(), up: this.bytes(g(r, 'up')), down: this.bytes(g(r, 'down')), apn: N.text(g(r, 'apn')) });
          const e = 'end' in map ? (this.dt(g(r, 'end')) || (ts.slice(0, 11) + (this.dt('2000-01-01', g(r, 'end')) || '').slice(11))) : '';
          if (e && e.length > 12) rec.end = e;
          rec.dur = this.secs(g(r, 'dur')) || (rec.end ? Math.max(0, (Date.parse(rec.end.replace(' ', 'T')) - Date.parse(ts.replace(' ', 'T'))) / 1000) : 0);
        } else rec.dur = this.secs(g(r, 'dur'));
        out.push(rec);
      }
    }
    return out;
  }
};

/* ---------- data store + analysis ---------- */
const Tel = {
  all() { if (!S.data.tel) S.data.tel = []; return S.data.tel; },
  of(k) {
    const K = k.toUpperCase();
    return Analysis.cached('tel:' + K, () => K === 'SMS' ? this.all().filter(r => r.kind === 'SMS' || (r.kind === 'CDR' && /^SMS/.test(r.dir))) : this.all().filter(r => r.kind === K));
  },
  async importFiles(list, want) {
    const files = await GReply.files([...list]), done = [];
    for (const f of files) {
      try {
        const recs = TelRead.parse(await TelRead.rows(f), f.name, want);
        if (!recs.length) throw new Error('no table with number + date columns found');
        recs.forEach(r => r.id = uid());
        const all = this.all(); for (const r of recs) all.push(r);
        const kinds = [...groupBy(recs, r => r.kind)].map(([k, v]) => k + ' ' + v.length).join(', ');
        done.push([f.name, recs.length, kinds]);
        S.data.imports.push({ id: uid(), when: new Date().toISOString(), file: f.name, type: 'telecom', count: recs.length });
      } catch (e) { done.push([f.name, 'Error: ' + (e.message || e)]); }
    }
    Analysis.invalidate(); saveCase(); return done;
  },
  removeFile(name) { S.data.tel = this.all().filter(r => r._src !== name); S.data.imports = S.data.imports.filter(i => !(i.type === 'telecom' && i.file === name)); Analysis.invalidate(); saveCase(); },
  /* identifiers found in the rest of the case (bank, KYC, NCRP, social, Google…) */
  elsewhere() {
    return Analysis.cached('tel:else', () => { const m = new Map(); try { Analysis.idents().filter(x => !x.tel).forEach(x => { const v = x.type === 'mobile' ? TelRead.num(x.value) : String(x.value).toLowerCase(); const k = x.type + '|' + v; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(x.label || x.section); }); } catch (e) { } return m; });
  },
  also(type, v) { const s = v && this.elsewhere().get(type + '|' + (type === 'mobile' ? v : String(v).toLowerCase())); return s ? [...s].join(', ') : ''; },
  alsoB(type, v) { const a = this.also(type, v); return a ? `<span class="badge warn" title="Also found in ${esc(a)}">⚑ ${esc(a)}</span>` : ''; },
  isMob: n => /^[6-9]\d{9}$/.test(n),
  hour: r => +r.ts.slice(11, 13), day: r => r.ts.slice(0, 10),
  night: r => { const h = +r.ts.slice(11, 13); return h >= 23 || h < 5; },
  hms(s) { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : m ? `${m}m ${String(x).padStart(2, '0')}s` : `${x}s`; },
  bytes(b) { b = +b || 0; return b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B'; },
  dd(s) { return s ? s.slice(8, 10) + '-' + s.slice(5, 7) + '-' + s.slice(0, 4) + (s.length > 10 ? ' ' + s.slice(11, 19) : '') : ''; },
  tower: r => r.cell || r.addr || '',
  PORTS: { 443: 'HTTPS – most apps', 80: 'HTTP – web', 53: 'DNS', 853: 'DNS over TLS', 5222: 'WhatsApp / XMPP chat', 5223: 'WhatsApp / Apple push', 5228: 'Google push (FCM)', 4244: 'WhatsApp', 3478: 'Voice / video call (STUN) – WhatsApp, Telegram, Meet', 3479: 'Voice / video call (STUN)', 3480: 'Voice / video call (STUN)', 19302: 'Google Meet / Duo call', 5242: 'Viber', 8801: 'Zoom', 1194: 'VPN (OpenVPN)', 51820: 'VPN (WireGuard)', 500: 'VPN (IPsec)', 4500: 'VPN (IPsec)', 1701: 'VPN (L2TP)', 1723: 'VPN (PPTP)', 9001: 'Tor', 9030: 'Tor', 7070: 'AnyDesk remote access', 6568: 'AnyDesk remote access', 5938: 'TeamViewer remote access', 3389: 'Remote desktop (RDP)', 5900: 'VNC remote access', 22: 'SSH', 993: 'E-mail (IMAP)', 995: 'E-mail (POP3)', 587: 'E-mail (SMTP)', 465: 'E-mail (SMTP)', 25: 'E-mail (SMTP)', 8443: 'HTTPS (alt)', 8080: 'HTTP proxy', 1080: 'SOCKS proxy', 3128: 'HTTP proxy' },
  portHint(p) { return this.PORTS[+p] || ''; },
  risky(p) { return /VPN|Tor|remote|proxy|RDP|SSH/.test(this.PORTS[+p] || ''); },
  /* SMS sender header → organisation and type */
  HDR: [
    ['Bank', /HDFC|SBI|ICICI|AXIS|KOTAK|PNB|BOB|BARODA|CANBNK|CANARA|UNION|UBI|IDFC|INDUS|YESB|AUBANK|AUSFB|FEDBNK|FEDERAL|IOB|BOI|CBOI|CENTRAL|IDBI|RBL|BANDHN|EQUITAS|UJJIVN|PAYTMB|AIRBNK|FINO|IPPB|KVB|CUB|SIB|TMB|DBS|HSBC|CITI|SCB|DCB|JKB|PSB|UCO|MAHB|BOM|INDBNK|IBKL/],
    ['Payment app', /PAYTM|PHONPE|PHONEPE|GPAY|GOOGLEPAY|AMAZON?PAY|AMZPAY|MOBIKW|BHIM|NPCI|CRED|FRECHG|FREECHARGE|SUPRMONY|POPPAY|JUPITR|FAMPAY|RAZORPAY|CASHFR|PAYU|BHARATPE|MSWIPE/],
    ['Loan / credit app', /KREDIT|MPOKKET|CASHE|NAVI|MNYVIEW|MONEYVIEW|SLICE|LAZYPY|LAZYPAY|BAJAJF|BAJFIN|HOMECR|TATACAP|FIBE|EARLYS|STASHF|KISSHT|ZESTMN|TRUBAL|SMCOIN|PAYSNS|LOAN|CREDIT|FINSERV|FINANCE/],
    ['Trading / crypto', /ZERODHA|UPSTOX|GROWW|ANGEL|5PAISA|WAZIRX|COINDCX|BINANCE|COINSW|MOTILAL|SHAREKHAN|NSE|BSE|CDSL|NSDL/],
    ['Telecom', /JIO|AIRTEL|VODAFONE|VIINDIA|^VI$|BSNL|MTNL/],
    ['Shopping / food', /AMAZON|FLPKRT|FLIPKART|MYNTRA|MEESHO|AJIO|NYKAA|SWIGGY|ZOMATO|BLINKIT|ZEPTO|BIGBSKT|DMART|JIOMRT/],
    ['Government', /GOVT|UIDAI|AADHAR|ITDEPT|INCOME|EPFO|CBDT|DIGILK|NICSI|CEIR|TRAI|DOT|PARIVA|VAHAN|SARTHI|IRCTC|POLICE|ECI|MYGOV|CBSE|UPSC/],
    ['Social / OTP', /WHATSAPP|FACEBK|INSTA|TELEGRAM|GOOGLE|GOOGLE|MSFT|MICROSOFT|APPLE|TWITTR|SNAPCH|TRUECALL|OLA|UBER|RAPIDO/]
  ],
  hdrInfo(h) {
    h = String(h || '').toUpperCase();
    if (!/[A-Z]/.test(h)) return null;
    const p = h.split('-'), ent = (p.length > 1 && p[0].length <= 3 ? p[1] : p[0]).replace(/[^A-Z0-9]/g, '');
    for (const [c, rx] of this.HDR) if (rx.test(ent) || rx.test(h)) return { ent, cat: c };
    return { ent, cat: 'Other business' };
  }
};

/* ---------- page ---------- */
const TelUI = {
  TABS: {
    cdr: [['sum', '📊 Overview'], ['con', '👥 Contacts'], ['dev', '📱 IMEI & IMSI'], ['loc', '📍 Towers & Movement'], ['time', '🕐 Date & Time'], ['com', '⚑ Common & Linked'], ['rec', '📋 All records'], ['files', '📁 Files']],
    ipdr: [['sum', '📊 Overview'], ['ses', '🔗 Sessions'], ['find', '🔎 Find IP at a time'], ['dst', '🎯 Destinations & Apps'], ['dev', '📱 IMEI & Towers'], ['time', '🕐 Date & Time'], ['files', '📁 Files']],
    tdr: [['sum', '📊 Overview'], ['com', '⚑ Common across spots'], ['num', '🔢 Frequent numbers'], ['dev', '📱 IMEI with many SIMs'], ['roam', '🌍 Roaming / foreign'], ['rec', '📋 All records'], ['files', '📁 Files']],
    sms: [['sum', '📊 Overview'], ['snd', '🏷 Sender headers'], ['con', '👥 Person to person'], ['time', '🕐 Date & Time'], ['rec', '📋 All records'], ['files', '📁 Files']]
  },
  page(main) {
    const k = TK[S.telKind] ? S.telKind : (S.telKind = 'cdr'), [title, col, desc, ic] = TK[k], d = Tel.of(k);
    PAGE_META.tele = { group: 'Analysis', title, desc: desc + ' Files are read on this computer only.', order: this.TABS[k].map(t => t[0]) };
    const { cur, body } = tabs(main, 'tele', this.TABS[k].map(([a, b]) => [a, b + (a === 'files' ? ` (${uniq(d.map(r => r._src)).length})` : '')]), title,
      `<button class="btn primary" id="telImp" style="background:${col}">⬆ Import ${k.toUpperCase()} file</button><input type="file" id="telPick" class="hidden" multiple accept=".xlsx,.xls,.xlsm,.ods,.csv,.txt,.zip,.rar">`);
    $('.tabs', main).insertAdjacentHTML('beforebegin', `<div class="tel-kinds">${Object.entries(TK).map(([id, x]) => `<button class="tel-k ${id === k ? 'on' : ''}" data-k="${id}" style="--tk:${x[1]}"><span>${x[3]}</span>${x[0].replace(' Analysis', '')}<b>${fmtNum(Tel.of(id).length)}</b></button>`).join('')}</div>`);
    $$('.tel-k', main).forEach(b => b.onclick = () => { S.telKind = b.dataset.k; render(); });
    $('#telImp').onclick = () => this.pick(); $('#telPick').onchange = e => this.load(e.target.files);
    if (!d.length && cur !== 'files') return this.empty(body, k);
    try { this[k + '_' + cur] ? this[k + '_' + cur](body, d) : this['x_' + cur](body, d, k); } catch (e) { console.error(e); body.innerHTML = `<div class="card err">Error: ${esc(e.message)}</div>`; }
  },
  pick() { const fp = $('#telPick'); fp.value = ''; fp.click(); },
  async load(files) {
    if (!files || !files.length) return; const k = S.telKind;
    UI.toast('Reading ' + files.length + ' file(s)…');
    const done = await Tel.importFiles(files, k.toUpperCase());
    const ok = done.filter(x => typeof x[1] === 'number'), bad = done.filter(x => typeof x[1] !== 'number');
    UI.toast(ok.length ? `${ok.map(x => x[2]).join(' · ')} records read` + (bad.length ? ` · ${bad.length} file(s) not read: ${bad[0][1]}` : '') : 'Not read: ' + (bad[0] || ['', 'no file'])[1], 6000);
    if (ok.length && !ok.some(x => x[2].startsWith(k.toUpperCase()))) { const nk = ok[0][2].split(' ')[0].toLowerCase(); if (TK[nk]) S.telKind = nk; }
    render();
  },
  drop(el, k) {
    const [t, col, , ic] = TK[k];
    el.innerHTML = `<div class="g-drop" id="telDrop" style="border-color:color-mix(in srgb,${col} 55%,var(--border))"><div class="g-dl" style="background:${col}">${ic}</div><b>Drop ${k.toUpperCase()} files here</b><span>or click to choose · Excel (.xlsx / .xls), CSV or TXT from Jio, Airtel, Vi, BSNL… · a .zip / .rar of them is fine</span>
      <div class="g-kinds">${{ cdr: ['A / B party', 'Call type', 'Date · time · duration', 'Cell ID / address', 'IMEI · IMSI'], ipdr: ['MSISDN', 'Private IP : port', 'Public IP : port', 'Destination IP : port', 'Start / end · data'], tdr: ['A / B party', 'Date · time', 'Cell ID / address', 'IMEI · IMSI', 'Roaming'], sms: ['Sender / header', 'Receiver', 'Date · time', 'Type', 'Message'] }[k].map((x, i) => `<i style="--k:${['#3b82f6', '#16a34a', '#a855f7', '#f97316', '#ef4444'][i]}">${x}</i>`).join('')}</div></div>`;
    const dz = $('#telDrop', el); dz.onclick = () => this.pick();
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); this.load(e.dataTransfer.files); };
  },
  empty(el, k) {
    el.innerHTML = `<div class="card"><h3>No ${k.toUpperCase()} data in this case yet</h3><div class="sub">Import the file you got from the operator. Columns are matched by their names, so most formats work. ${k === 'sms' ? 'SMS rows inside a CDR are shown here too.' : ''}${k === 'tdr' ? ' Import one file per crime spot / tower: numbers seen at two or more spots are listed first.' : ''}</div><div id="telD"></div></div>`;
    this.drop($('#telD', el), k);
  },
  /* shared small views */
  insights(list) { return list.length ? `<div class="card tel-ins"><h3>Key findings</h3><ul>${list.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''; },
  recDrawer(title, recs) {
    UI.drawer(title, `<div class="muted small" style="margin-bottom:8px">${fmtNum(recs.length)} records</div>` + recs.slice().sort((a, b) => a.ts.localeCompare(b.ts)).slice(0, 500).map(r => `<div class="list-item"><div class="grow small"><b>${esc(Tel.dd(r.ts))}</b> · ${esc(r.dir || r.kind)} ${r.dur ? '· ' + Tel.hms(r.dur) : ''}<br>${esc(r.target)} ↔ ${esc(r.other || '')}${r.xip ? ' · ' + esc(r.xip) + (r.xport ? ':' + esc(r.xport) : '') : ''}${r.dip ? ' → ' + esc(r.dip) + ':' + esc(r.dport) : ''}<br><span class="muted">${esc([r.cell, r.addr, r.imei && 'IMEI ' + r.imei, r.roam].filter(Boolean).join(' · '))}</span>${r.msg ? `<br><i>${esc(r.msg)}</i>` : ''}<br><span class="muted">${esc(r._src)}</span></div></div>`).join(''));
  },
  hourDay(el, d) {
    const W = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], g = Array.from({ length: 7 }, () => Array(24).fill(0));
    d.forEach(r => { const t = new Date(r.ts.slice(0, 10) + 'T00:00:00'); if (!isNaN(t)) g[(t.getDay() + 6) % 7][Tel.hour(r)]++; });
    const mx = Math.max(1, ...g.flat());
    el.innerHTML = `<div class="tel-heat"><div></div>${Array.from({ length: 24 }, (_, h) => `<div class="hh">${h}</div>`).join('')}${g.map((row, i) => `<div class="hd">${W[i]}</div>${row.map((v, h) => `<div class="hc" style="background:${v ? Charts.heat(v, mx, 0) : 'var(--surface-2)'}" data-tip="${W[i]} ${h}:00–${h}:59<br><b>${v}</b> records">${v || ''}</div>`).join('')}`).join('')}</div>`;
    Charts.bindTips(el);
  },
  timeCharts(el, d) {
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Hour of day</h3><div class="sub">Night = 11 pm to 5 am</div><div id="tt1"></div></div><div class="card"><h3>Day by day</h3><div id="tt2"></div></div></div>
      <div class="card"><h3>Weekday × hour</h3><div class="sub">Darker = more activity. Shows the daily routine (sleep, work, travel).</div><div id="tt3"></div></div>`;
    Charts.vbar($('#tt1', el), Array.from({ length: 24 }, (_, h) => ({ label: h + ':00', value: d.filter(r => Tel.hour(r) === h).length })));
    Charts.line($('#tt2', el), [...groupBy(d, Tel.day)].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k, value: v.length })));
    this.hourDay($('#tt3', el), d);
  },
  filesTab(el, k) {
    const F = groupBy(Tel.all().filter(r => k === 'sms' ? r.kind === 'SMS' || r.kind === 'CDR' : r.kind === k.toUpperCase()), r => r._src);
    el.innerHTML = `<div class="card"><h3>Add ${k.toUpperCase()} files</h3><div id="telD"></div></div><div class="card"><h3>Imported files</h3><div id="telF"></div></div>`;
    this.drop($('#telD', el), k);
    Table($('#telF', el), { rows: [...F].map(([file, v]) => ({ file, n: v.length, kind: uniq(v.map(r => r.kind)).join(', '), targets: uniq(v.map(r => r.target)).slice(0, 5).join(', ') + (uniq(v.map(r => r.target)).length > 5 ? ' …' : ''), from: v.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), to: v.reduce((a, r) => r.ts > a ? r.ts : a, '') })), exportName: k + '_files',
      columns: [{ key: 'file', label: 'File' }, { key: 'kind', label: 'Type' }, { key: 'n', label: 'Records', num: true }, { key: 'targets', label: 'Number(s)' }, { key: 'from', label: 'From', render: r => esc(Tel.dd(r.from)) }, { key: 'to', label: 'To', render: r => esc(Tel.dd(r.to)) }, { key: 'x', label: '', nosort: true, noexport: true, render: r => `<button class="btn sm" data-tdel="${esc(r.file)}">🗑 Remove</button>` }],
      after: t => $$('[data-tdel]', t).forEach(b => b.onclick = ev => { ev.stopPropagation(); if (UI.confirm('Remove all records from ' + b.dataset.tdel + '?')) { Tel.removeFile(b.dataset.tdel); render(); } }) });
  },
  recTable(el, d, k) {
    const ip = k === 'ipdr', sms = k === 'sms';
    const cols = [{ key: 'ts', label: 'Date & time', render: r => esc(Tel.dd(r.ts)), sortVal: r => r.ts }, { key: 'target', label: ip ? 'MSISDN' : sms ? 'Number' : 'A party', render: r => `<span class="mono">${esc(r.target)}</span>` },
      ...(ip ? [{ key: 'pip', label: 'Private IP:port', render: r => `<span class="mono ipv">${esc(r.pip)}${r.pport ? ':' + esc(r.pport) : ''}</span>`, csv: r => r.pip + (r.pport ? ':' + r.pport : '') }, { key: 'xip', label: 'Public IP:port', render: r => `<span class="mono ipv">${esc(r.xip)}${r.xport ? ':' + esc(r.xport) : ''}</span> ${Tel.alsoB('ip', r.xip)}`, csv: r => r.xip + (r.xport ? ':' + r.xport : '') }, { key: 'dip', label: 'Destination', render: r => `<span class="mono ipv">${esc(r.dip)}${r.dport ? ':' + esc(r.dport) : ''}</span>${r.dport && Tel.portHint(r.dport) ? `<div class="muted small">${esc(Tel.portHint(r.dport))}</div>` : ''}`, csv: r => r.dip + (r.dport ? ':' + r.dport : '') }, { key: 'dur', label: 'Duration', num: true, render: r => Tel.hms(r.dur) }, { key: 'vol', label: 'Data', num: true, sortVal: r => r.up + r.down, render: r => Tel.bytes(r.up + r.down), csv: r => r.up + r.down }]
        : [{ key: 'dir', label: 'Type' }, { key: 'other', label: sms ? 'Other / header' : 'B party', render: r => `<span class="mono">${esc(r.other)}</span> ${Tel.isMob(r.other) ? Tel.alsoB('mobile', r.other) : ''}` }, ...(sms ? [{ key: 'msg', label: 'Message' }] : [{ key: 'dur', label: 'Duration', num: true, render: r => Tel.hms(r.dur) }])]),
      { key: 'imei', label: 'IMEI', render: r => `<span class="mono">${esc(r.imei)}</span>` }, { key: 'cell', label: 'Cell ID', render: r => `<span class="mono ipv">${esc(r.cell)}</span>` }, { key: 'addr', label: 'Tower address', render: r => `<span class="small">${esc(r.addr)}</span>` }, { key: 'roam', label: 'Roaming' }, { key: '_src', label: 'File', render: r => `<span class="muted small">${esc(r._src)}</span>` }];
    el.innerHTML = `<div class="card"><div id="telR"></div></div>`;
    Table($('#telR', el), { rows: d, columns: cols, sortKey: 'ts', exportName: k + '_records', pageSize: 100, maxHeight: '70vh', onRow: r => this.recDrawer(r.ts, [r]) });
  },
  x_rec(el, d, k) { this.recTable(el, d, k); },
  x_files(el, d, k) { this.filesTab(el, k); },
  x_time(el, d) { this.timeCharts(el, d); },

  /* ======== CDR ======== */
  cdrStats(d) {
    return Analysis.cached('tel:cdrstat', () => {
      const pairs = new Map();
      for (const r of d) { if (!r.other || /[A-Z]/.test(r.other)) continue; const k = r.target + '|' + r.other; let p = pairs.get(k); if (!p) pairs.set(k, p = { target: r.target, other: r.other, n: 0, out: 0, inn: 0, sms: 0, dur: 0, night: 0, first: r.ts, last: r.ts, days: new Set(), recs: [] }); p.n++; if (r.dir === 'OUT') p.out++; else if (r.dir === 'IN') p.inn++; else if (/^SMS/.test(r.dir)) p.sms++; p.dur += r.dur || 0; if (Tel.night(r)) p.night++; if (r.ts < p.first) p.first = r.ts; if (r.ts > p.last) p.last = r.ts; p.days.add(Tel.day(r)); p.recs.push(r); }
      const P = [...pairs.values()]; P.forEach(p => { p.dayN = p.days.size; delete p.days; p.bop = (p.recs.find(r => r.bop && !/^[-–]$/.test(r.bop)) || {}).bop || ''; });
      const byOther = groupBy(P, p => p.other);
      P.forEach(p => { p.tN = byOther.get(p.other).length; });
      return { P, byOther };
    });
  },
  cdr_sum(el, d) {
    const { P, byOther } = this.cdrStats(d), T = uniq(d.map(r => r.target)), calls = d.filter(r => r.dir === 'IN' || r.dir === 'OUT');
    const imeis = uniq(d.map(r => r.imei)), towers = uniq(d.map(Tel.tower)), first = d.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last = d.reduce((a, r) => r.ts > a ? r.ts : a, '');
    const linked = [...byOther.keys()].filter(o => Tel.isMob(o) && Tel.also('mobile', o)), common = [...byOther].filter(([, v]) => v.length >= 2);
    el.innerHTML = UI.kpis([['Records', fmtNum(d.length), uniq(d.map(r => r._src)).length + ' file(s)', 'c2'], ['Target numbers', fmtNum(T.length), T.slice(0, 2).join(', ') + (T.length > 2 ? ' …' : ''), 'c5'], ['Contacts', fmtNum(byOther.size), fmtNum(linked.length) + ' also in case data', 'c1'],
      ['Calls out / in', `${fmtNum(calls.filter(r => r.dir === 'OUT').length)} / ${fmtNum(calls.filter(r => r.dir === 'IN').length)}`, 'talk time ' + Tel.hms(sum(calls, r => r.dur)), 'c3'], ['SMS', fmtNum(d.filter(r => /^SMS/.test(r.dir)).length), '', 'c6'], ['Handsets (IMEI)', fmtNum(imeis.length), imeis.length > T.length ? 'handset changed' : '', 'c4'], ['Towers', fmtNum(towers.length), '', 'c7'], ['Period', Tel.dd(first).slice(0, 10), 'to ' + Tel.dd(last).slice(0, 10), 'c8']])
      + this.insights(this.cdrFindings(d, P, byOther, linked, common)) + this.subscriber(d)
      + `<div class="grid g2"><div class="card"><h3>Top contacts</h3><div class="sub">Calls + SMS with each number. Click a bar for the records.</div><div id="cs1"></div></div><div class="card"><h3>Call type</h3><div id="cs2"></div></div>
      <div class="card"><h3>Most used towers</h3><div id="cs3"></div></div><div class="card"><h3>Hour of day</h3><div id="cs4"></div></div></div>`;
    const top = P.slice().sort((a, b) => b.n - a.n);
    Charts.hbar($('#cs1', el), top.map(p => ({ label: p.other, value: p.n, sub: `${p.out} out · ${p.inn} in · ${p.sms} SMS · ${Tel.hms(p.dur)}${Tel.also('mobile', p.other) ? ' · ⚑ ' + Tel.also('mobile', p.other) : ''}`, p })), { onClick: x => this.recDrawer(x.p.target + ' ↔ ' + x.p.other, x.p.recs) });
    Charts.donut($('#cs2', el), [...groupBy(d, r => r.dir || '—')].map(([k, v]) => ({ label: k, value: v.length })).sort((a, b) => b.value - a.value));
    Charts.hbar($('#cs3', el), [...groupBy(d.filter(Tel.tower), Tel.tower)].map(([k, v]) => ({ label: k, value: v.length, sub: v.find(r => r.addr)?.addr || '', recs: v })).sort((a, b) => b.value - a.value), { onClick: x => this.recDrawer('Tower ' + x.label, x.recs) });
    Charts.vbar($('#cs4', el), Array.from({ length: 24 }, (_, h) => ({ label: h + ':00', value: d.filter(r => Tel.hour(r) === h).length })));
  },
  subscriber(d) {
    const M = S.data.telMeta || {}, files = uniq(d.map(r => r._src)).filter(f => M[f]);
    return files.length ? `<div class="card"><h3>Subscriber details given by the operator</h3><div class="grid g2">${files.map(f => `<div><div class="muted small">${esc(f)} · ${esc(uniq(d.filter(r => r._src === f).map(r => r.target)).join(', '))}</div>${UI.kv(Object.fromEntries(Object.entries(M[f]).map(([k, v]) => [k, esc(v)])))}</div>`).join('')}</div></div>` : '';
  },
  cdrFindings(d, P, byOther, linked, common) {
    const f = [], b = s => `<b>${esc(s)}</b>`;
    for (const [t, v] of groupBy(d, r => r.target)) {
      if (!t) continue;
      const tp = P.filter(p => p.target === t && p.out + p.inn).sort((a, c) => (c.out + c.inn) - (a.out + a.inn))[0]; if (tp) f.push(`${b(t)} talked most with ${b(tp.other)} – ${tp.out + tp.inn} calls, ${Tel.hms(tp.dur)} (${tp.out} out, ${tp.inn} in)${Tel.also('mobile', tp.other) ? ' · ⚑ also in ' + esc(Tel.also('mobile', tp.other)) : ''}.`);
      const bz = uniq(v.filter(r => /[A-Z]/.test(r.other)).map(r => Tel.hdrInfo(r.other)).filter(h => h && /Bank|Payment|Loan|Trading/.test(h.cat)).map(h => h.ent)); if (bz.length) f.push(`SMS from banks / payment / loan apps to ${esc(t)}: ${b(bz.slice(0, 10).join(', '))}${bz.length > 10 ? ' …' : ''} – see SMS Analysis.`);
      const im = uniq(v.map(r => r.imei)); if (im.length > 1) f.push(`${b(t)} was used in ${b(im.length + ' handsets')} (IMEI ${im.slice(0, 4).map(esc).join(', ')}) – handset changed.`);
      const home = groupBy(v.filter(r => Tel.tower(r) && (Tel.hour(r) >= 22 || Tel.hour(r) < 6)), Tel.tower), work = groupBy(v.filter(r => Tel.tower(r) && Tel.hour(r) >= 10 && Tel.hour(r) < 18), Tel.tower);
      const top = m => [...m].sort((a, c) => c[1].length - a[1].length)[0];
      const h = top(home), w = top(work);
      if (h && h[1].length >= 3) f.push(`Likely ${b('night / home')} location of ${esc(t)}: ${b(h[1].find(r => r.addr)?.addr || h[0])} (${h[1].length} records between 10 pm and 6 am).`);
      if (w && w[1].length >= 3 && (!h || w[0] !== h[0])) f.push(`Likely ${b('day / work')} location: ${b(w[1].find(r => r.addr)?.addr || w[0])} (${w[1].length} records, 10 am – 6 pm).`);
      const ts = v.map(r => [Date.parse(r.ts.replace(' ', 'T')), r.ts]).filter(x => !isNaN(x[0])).sort((a, c) => a[0] - c[0]); let gap = null;
      for (let i = 1; i < ts.length; i++) if (!gap || ts[i][0] - ts[i - 1][0] > gap[1][0] - gap[0][0]) gap = [ts[i - 1], ts[i]];
      if (gap && gap[1][0] - gap[0][0] > 36 * 3600e3) f.push(`No activity for ${b(Math.round((gap[1][0] - gap[0][0]) / 3600e3) + ' hours')} from ${esc(Tel.dd(gap[0][1]))} to ${esc(Tel.dd(gap[1][1]))} – phone off or another SIM used.`);
      const rm = uniq(v.map(r => r.roam.toUpperCase()).filter(Boolean)); if (rm.length > 1) f.push(`Roaming circles seen: ${rm.slice(0, 6).map(esc).join(', ')}.`);
    }
    const nt = d.filter(r => (r.dir === 'IN' || r.dir === 'OUT') && Tel.night(r)); if (nt.length) f.push(`${b(nt.length + ' night calls')} (11 pm – 5 am) with ${uniq(nt.map(r => r.other)).length} numbers.`);
    const mi = [...groupBy(d.filter(r => r.imei), r => r.imei)].filter(([, v]) => uniq(v.map(r => r.target)).length > 1); if (mi.length) f.push(`${b(mi.length + ' handset(s)')} used with more than one SIM: ${mi.slice(0, 3).map(([i, v]) => esc(i) + ' → ' + uniq(v.map(r => r.target)).map(esc).join(', ')).join('; ')}.`);
    if (linked.length) f.push(`${b(linked.length + ' contact number(s)')} also found in this case's other data: ${linked.slice(0, 5).map(o => esc(o) + ' (' + esc(Tel.also('mobile', o)) + ')').join(', ')}.`);
    if (common.length) f.push(`${b(common.length + ' number(s)')} in touch with 2 or more targets: ${common.slice(0, 5).map(([o]) => esc(o)).join(', ')}.`);
    return f;
  },
  cdr_con(el, d) {
    const { P } = this.cdrStats(d);
    el.innerHTML = `<div class="card"><h3>Contacts</h3><div class="sub">One row per target ↔ number. ⚑ = the number is also in bank / KYC / NCRP / social media data of this case. Click a row for every call.</div><div id="cc"></div></div>`;
    Table($('#cc', el), { rows: P, sortKey: 'n', sortDir: -1, exportName: 'cdr_contacts', onRow: p => this.recDrawer(p.target + ' ↔ ' + p.other, p.recs),
      columns: [{ key: 'target', label: 'Target', render: p => `<span class="mono">${esc(p.target)}</span>` }, { key: 'other', label: 'Contact', render: p => `<b class="mono">${esc(p.other)}</b> ${Tel.isMob(p.other) ? Tel.alsoB('mobile', p.other) : ''}` }, { key: 'bop', label: 'Operator (LRN)', render: p => `<span class="small">${esc(p.bop)}</span>` }, { key: 'n', label: 'Total', num: true }, { key: 'out', label: 'Out', num: true }, { key: 'inn', label: 'In', num: true }, { key: 'sms', label: 'SMS', num: true },
        { key: 'dur', label: 'Talk time', num: true, render: p => Tel.hms(p.dur) }, { key: 'night', label: 'Night', num: true }, { key: 'dayN', label: 'Days', num: true }, { key: 'tN', label: 'Targets', num: true, render: p => p.tN > 1 ? `<span class="badge warn">${p.tN}</span>` : '1' }, { key: 'first', label: 'First', render: p => esc(Tel.dd(p.first)) }, { key: 'last', label: 'Last', render: p => esc(Tel.dd(p.last)) }, { key: 'also', label: 'Also in case', csv: p => Tel.also('mobile', p.other), render: p => esc(Tel.also('mobile', p.other)) }] });
  },
  devTables(el, d, label) {
    const I = [...groupBy(d.filter(r => r.imei), r => r.imei)].map(([imei, v]) => ({ imei, ok: V.luhn(imei) && imei.length === 15, tac: imei.slice(0, 8), sims: uniq(v.map(r => r.target)), n: v.length, first: v.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last: v.reduce((a, r) => r.ts > a ? r.ts : a, ''), recs: v }));
    const M = [...groupBy(d.filter(r => r.imsi), r => r.imsi)].map(([imsi, v]) => ({ imsi, mcc: imsi.slice(0, 3) + '-' + imsi.slice(3, 5), sims: uniq(v.map(r => r.target)), imeis: uniq(v.map(r => r.imei)), n: v.length, recs: v }));
    el.innerHTML = `<div class="card"><h3>Handsets (IMEI)</h3><div class="sub">${label} Same TAC (first 8 digits) = same make & model. Click a row for records.</div><div id="cd1"></div></div><div class="card"><h3>SIM cards (IMSI)</h3><div class="sub">IMSI starts with 404 / 405 for India. A different IMSI on the same number = SIM swapped / re-issued.</div><div id="cd2"></div></div>`;
    Table($('#cd1', el), { rows: I, sortKey: 'n', sortDir: -1, exportName: 'imei', onRow: x => this.recDrawer('IMEI ' + x.imei, x.recs), columns: [{ key: 'imei', label: 'IMEI', render: x => `<b class="mono">${esc(x.imei)}</b> ${x.ok ? '' : '<span class="badge bad">check digit wrong</span>'} ${Tel.alsoB('imei', x.imei)}` }, { key: 'tac', label: 'TAC', render: x => `<span class="mono">${esc(x.tac)}</span>` }, { key: 'sims', label: 'Numbers used', csv: x => x.sims.join(' '), sortVal: x => x.sims.length, render: x => (x.sims.length > 1 ? `<span class="badge warn">${x.sims.length} SIMs</span> ` : '') + x.sims.map(esc).join(', ') }, { key: 'n', label: 'Records', num: true }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] });
    Table($('#cd2', el), { rows: M, sortKey: 'n', sortDir: -1, exportName: 'imsi', onRow: x => this.recDrawer('IMSI ' + x.imsi, x.recs), columns: [{ key: 'imsi', label: 'IMSI', render: x => `<span class="mono">${esc(x.imsi)}</span>` }, { key: 'mcc', label: 'Country-network' }, { key: 'sims', label: 'Number', csv: x => x.sims.join(' '), render: x => x.sims.map(esc).join(', ') }, { key: 'imeis', label: 'Handsets', csv: x => x.imeis.join(' '), render: x => x.imeis.map(esc).join(', ') }, { key: 'n', label: 'Records', num: true }] });
  },
  cdr_dev(el, d) { this.devTables(el, d, 'A target in more than one handset = handset changed; a handset with more than one number = SIMs swapped in it.'); },
  cdr_loc(el, d) {
    const L = d.filter(Tel.tower);
    const T = [...groupBy(L, Tel.tower)].map(([t, v]) => ({ t, addr: v.find(r => r.addr)?.addr || '', n: v.length, night: v.filter(r => Tel.hour(r) >= 22 || Tel.hour(r) < 6).length, day: v.filter(r => Tel.hour(r) >= 10 && Tel.hour(r) < 18).length, days: uniq(v.map(Tel.day)).length, first: v.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last: v.reduce((a, r) => r.ts > a ? r.ts : a, ''), ll: v.find(r => r.lat) || null, recs: v }));
    const D = [...groupBy(L, r => r.target + '|' + Tel.day(r))].map(([k, v]) => { v = v.slice().sort((a, b) => a.ts.localeCompare(b.ts)); const f = v[0], l = v[v.length - 1]; return { target: f.target, day: Tel.day(f), ft: f.ts.slice(11, 19), ftow: f.addr || f.cell, lt: l.ts.slice(11, 19), ltow: l.addr || l.cell, nt: uniq(v.map(Tel.tower)).length, recs: v }; });
    const M = []; for (const [t, v] of groupBy(L, r => r.target)) { let prev = ''; v.slice().sort((a, b) => a.ts.localeCompare(b.ts)).forEach(r => { const tw = Tel.tower(r); if (tw !== prev) { M.push({ target: t, ts: r.ts, tw, addr: r.addr, dir: r.dir, other: r.other }); prev = tw; } }); }
    el.innerHTML = `<div class="card"><h3>Towers</h3><div class="sub">Night = 10 pm – 6 am (often home). Day = 10 am – 6 pm (often work). Click a row for records.</div><div id="cl1"></div></div>
      <div class="card"><h3>Day-wise first and last location</h3><div class="sub">Where the phone started and ended each day.</div><div id="cl2"></div></div>
      <div class="card"><h3>Movement (each change of tower, in time order)</h3><div id="cl3"></div></div>`;
    Table($('#cl1', el), { rows: T, sortKey: 'n', sortDir: -1, exportName: 'cdr_towers', onRow: x => this.recDrawer('Tower ' + x.t, x.recs), columns: [{ key: 't', label: 'Cell ID / tower', render: x => `<span class="mono ipv">${esc(x.t)}</span>` }, { key: 'addr', label: 'Address', render: x => `<span class="small">${esc(x.addr)}</span>${x.ll ? ` <a href="https://www.google.com/maps?q=${x.ll.lat},${x.ll.lon}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">map ↗</a>` : ''}` }, { key: 'n', label: 'Records', num: true }, { key: 'night', label: 'Night', num: true }, { key: 'day', label: 'Day', num: true }, { key: 'days', label: 'Days seen', num: true }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] });
    Table($('#cl2', el), { rows: D, sortKey: 'day', exportName: 'cdr_daywise', onRow: x => this.recDrawer(x.target + ' · ' + x.day, x.recs), columns: [{ key: 'target', label: 'Target' }, { key: 'day', label: 'Date', render: x => esc(Tel.dd(x.day)) }, { key: 'ft', label: 'First at' }, { key: 'ftow', label: 'First tower', render: x => `<span class="small">${esc(x.ftow)}</span>` }, { key: 'lt', label: 'Last at' }, { key: 'ltow', label: 'Last tower', render: x => `<span class="small">${esc(x.ltow)}</span>` }, { key: 'nt', label: 'Towers that day', num: true }] });
    Table($('#cl3', el), { rows: M, sortKey: 'ts', exportName: 'cdr_movement', pageSize: 50, columns: [{ key: 'target', label: 'Target' }, { key: 'ts', label: 'Time', render: x => esc(Tel.dd(x.ts)) }, { key: 'tw', label: 'Tower', render: x => `<span class="mono ipv">${esc(x.tw)}</span>` }, { key: 'addr', label: 'Address', render: x => `<span class="small">${esc(x.addr)}</span>` }, { key: 'dir', label: 'Event' }, { key: 'other', label: 'With' }] });
  },
  cdr_time(el, d) { this.timeCharts(el, d); },
  cdr_com(el, d) {
    const { byOther } = this.cdrStats(d);
    const C = [...byOther].filter(([, v]) => v.length >= 2).map(([o, v]) => ({ o, t: v.map(p => p.target), n: sum(v, p => p.n), dur: sum(v, p => p.dur), recs: v.flatMap(p => p.recs) }));
    const types = [['mobile', d.flatMap(r => [r.target, r.other]).filter(Tel.isMob)], ['imei', d.map(r => r.imei).filter(Boolean)]];
    const L = []; for (const [t, vals] of types) for (const v of uniq(vals)) { const a = Tel.also(t, v); if (a) L.push({ t, v, a, recs: d.filter(r => r.target === v || r.other === v || r.imei === v) }); }
    el.innerHTML = `<div class="card"><h3>Numbers in touch with two or more targets</h3><div class="sub">Likely the same gang / handler.</div><div id="cm1"></div></div><div class="card"><h3>Found in other data of this case</h3><div class="sub">Numbers and IMEIs from these CDRs that also appear in bank / KYC, NCRP complaints, social media, Google, WhatsApp, Telegram or CAF data.</div><div id="cm2"></div></div>`;
    Table($('#cm1', el), { rows: C, sortKey: 'n', sortDir: -1, exportName: 'cdr_common', onRow: x => this.recDrawer(x.o, x.recs), columns: [{ key: 'o', label: 'Number', render: x => `<b class="mono">${esc(x.o)}</b> ${Tel.alsoB('mobile', x.o)}` }, { key: 't', label: 'Targets', csv: x => x.t.join(' '), sortVal: x => x.t.length, render: x => `<span class="badge warn">${x.t.length}</span> ${x.t.map(esc).join(', ')}` }, { key: 'n', label: 'Records', num: true }, { key: 'dur', label: 'Talk time', num: true, render: x => Tel.hms(x.dur) }] });
    Table($('#cm2', el), { rows: L, exportName: 'cdr_linked', onRow: x => this.recDrawer(x.v, x.recs), columns: [{ key: 't', label: 'Type' }, { key: 'v', label: 'Value', render: x => `<b class="mono">${esc(x.v)}</b>` }, { key: 'a', label: 'Also in' }, { key: 'n', label: 'CDR records', num: true, sortVal: x => x.recs.length, render: x => fmtNum(x.recs.length), csv: x => x.recs.length }] });
  },

  /* ======== IPDR ======== */
  ipdr_sum(el, d) {
    const X = uniq(d.map(r => r.xip)), vol = sum(d, r => r.up + r.down), first = d.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last = d.reduce((a, r) => r.ts > a ? r.ts : a, '');
    const linked = X.filter(ip => Tel.also('ip', ip)), risky = d.filter(r => Tel.risky(r.dport));
    const f = [];
    if (linked.length) f.push(`<b>${linked.length} public IP(s)</b> match IPs in this case (platform logins, bank, KYC…): ${linked.slice(0, 5).map(ip => `<b>${esc(ip)}</b> (${esc(Tel.also('ip', ip))})`).join(', ')}. See <b>Find IP at a time</b> to match the exact time and port.`);
    const rk = [...groupBy(risky, r => Tel.portHint(r.dport))]; if (rk.length) f.push(`Remote-access / VPN / proxy use: ${rk.map(([k, v]) => `<b>${esc(k)}</b> ${v.length}×`).join(', ')} – common in screen-sharing and investment frauds.`);
    const im = uniq(d.map(r => r.imei)); if (im.length > uniq(d.map(r => r.target)).length) f.push(`${im.length} handsets (IMEI) for ${uniq(d.map(r => r.target)).length} number(s) – handset changed.`);
    const calls = d.filter(r => [3478, 3479, 3480, 19302].includes(+r.dport)); if (calls.length) f.push(`${calls.length} internet voice / video call sessions (WhatsApp / Telegram / Meet type).`);
    el.innerHTML = UI.kpis([['Sessions', fmtNum(d.length), uniq(d.map(r => r._src)).length + ' file(s)', 'c2'], ['Numbers (MSISDN)', fmtNum(uniq(d.map(r => r.target)).length), '', 'c5'], ['Public IPs', fmtNum(X.length), fmtNum(linked.length) + ' also in case data', 'c1'], ['Destinations', fmtNum(uniq(d.map(r => r.dip)).length), '', 'c3'], ['Handsets', fmtNum(im.length), '', 'c4'], ['Data used', Tel.bytes(vol), '', 'c6'], ['Period', Tel.dd(first).slice(0, 10), 'to ' + Tel.dd(last).slice(0, 10), 'c8']])
      + this.insights(f)
      + `<div class="grid g2"><div class="card"><h3>Public IPs</h3><div class="sub">Sessions per public (NAT) IP. Click for sessions.</div><div id="is1"></div></div><div class="card"><h3>What the phone connected to (port)</h3><div id="is2"></div></div>
      <div class="card"><h3>Hour of day</h3><div id="is3"></div></div><div class="card"><h3>Data used per day</h3><div id="is4"></div></div></div>`;
    Charts.hbar($('#is1', el), [...groupBy(d.filter(r => r.xip), r => r.xip)].map(([k, v]) => ({ label: k, value: v.length, sub: (Tel.also('ip', k) ? '⚑ ' + Tel.also('ip', k) + ' · ' : '') + V.ipKind(k), recs: v })).sort((a, b) => b.value - a.value), { onClick: x => this.recDrawer(x.label, x.recs) });
    Charts.hbar($('#is2', el), [...groupBy(d.filter(r => r.dport), r => r.dport)].map(([k, v]) => ({ label: k + (Tel.portHint(k) ? ' · ' + Tel.portHint(k).split(' – ')[0] : ''), value: v.length, sub: Tel.portHint(k), recs: v })).sort((a, b) => b.value - a.value), { onClick: x => this.recDrawer('Port ' + x.label, x.recs) });
    Charts.vbar($('#is3', el), Array.from({ length: 24 }, (_, h) => ({ label: h + ':00', value: d.filter(r => Tel.hour(r) === h).length })));
    Charts.vbar($('#is4', el), [...groupBy(d, Tel.day)].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k.slice(5), value: sum(v, r => r.up + r.down), sub: v.length + ' sessions' })), { fmt: v => Tel.bytes(v) });
  },
  ipdr_ses(el, d) { this.recTable(el, d, 'ipdr'); },
  ipdr_find(el, d) {
    const st = S.telFind = S.telFind || { ip: '', port: '', at: '', win: 30 };
    const caseIPs = uniq(d.map(r => r.xip).filter(ip => Tel.also('ip', ip)));
    el.innerHTML = `<div class="card"><h3>Who used this IP at this time?</h3><div class="sub">Platforms (Google, Meta, WhatsApp, Telegram, banks) give an IP, port and time. Enter them to find the matching session and number. Time in IST.</div>
      <div class="sop-form" style="grid-template-columns:2fr 1fr 2fr 1fr"><label>Public IP<input id="tfIp" value="${esc(st.ip)}" placeholder="49.36.x.x or IPv6"></label><label>Port (optional)<input id="tfPort" value="${esc(st.port)}"></label><label>Date & time (IST)<input id="tfAt" type="datetime-local" step="1" value="${esc(st.at)}"></label><label>± minutes<input id="tfWin" type="number" min="0" value="${esc(st.win)}"></label></div>
      <div class="row"><button class="btn primary" id="tfGo">Find</button>${caseIPs.length ? `<span class="muted small">IPs also in this case:</span> ${caseIPs.slice(0, 12).map(ip => `<button class="btn sm" data-ip="${esc(ip)}">${esc(ip)}</button>`).join(' ')}` : ''}</div><div id="tfOut" style="margin-top:12px"></div></div>`;
    const go = () => {
      st.ip = $('#tfIp', el).value.trim(); st.port = $('#tfPort', el).value.trim(); st.at = $('#tfAt', el).value; st.win = +$('#tfWin', el).value || 0;
      if (!st.ip) { $('#tfOut', el).innerHTML = ''; return; }
      const ipl = st.ip.toLowerCase(), t = st.at ? Date.parse(st.at) : null, w = st.win * 60e3;
      const R = d.filter(r => [r.xip, r.pip, r.dip].some(x => x && x.toLowerCase() === ipl) && (!st.port || [r.xport, r.pport, r.dport].includes(st.port)) && (t == null || (() => { const s = Date.parse(r.ts.replace(' ', 'T')), e = r.end ? Date.parse(r.end.replace(' ', 'T')) : s + (r.dur || 0) * 1000; return s - w <= t && t <= e + w; })()));
      const out = $('#tfOut', el);
      out.innerHTML = `<div class="${R.length ? 'note' : 'muted'}">${R.length ? `<b>${R.length} session(s) found</b> – number(s): ${uniq(R.map(r => r.target)).map(n => `<b class="mono">${esc(n)}</b>`).join(', ')}${uniq(R.map(r => r.imei)).length ? ' · IMEI ' + uniq(R.map(r => r.imei)).map(esc).join(', ') : ''}` : 'No session matches. Widen ± minutes, remove the port, or check the time zone (IPDR is usually IST; platforms often give UTC = IST − 5:30).'}</div><div id="tfT"></div>`;
      if (R.length) this.recTable($('#tfT', out), R, 'ipdr');
    };
    $('#tfGo', el).onclick = go; $$('[data-ip]', el).forEach(b => b.onclick = () => { $('#tfIp', el).value = b.dataset.ip; $('#tfAt', el).value = ''; go(); });
    if (st.ip) go();
  },
  ipdr_dst(el, d) {
    const D = [...groupBy(d.filter(r => r.dip), r => r.dip)].map(([ip, v]) => ({ ip, n: v.length, ports: uniq(v.map(r => r.dport)), vol: sum(v, r => r.up + r.down), first: v.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last: v.reduce((a, r) => r.ts > a ? r.ts : a, ''), recs: v }));
    el.innerHTML = `<div class="card"><h3>Destination servers</h3><div class="sub">The app is guessed from the port. Use Tools › IP Lookup → online fetch to see who owns a server IP.</div><div id="id1"></div></div>`;
    Table($('#id1', el), { rows: D, sortKey: 'n', sortDir: -1, exportName: 'ipdr_destinations', onRow: x => this.recDrawer(x.ip, x.recs), columns: [{ key: 'ip', label: 'Destination IP', render: x => `<span class="mono ipv">${esc(x.ip)}</span>` }, { key: 'ports', label: 'Ports / app', csv: x => x.ports.join(' '), render: x => x.ports.slice(0, 6).map(p => `<span class="${Tel.risky(p) ? 'badge bad' : 'badge'}" title="${esc(Tel.portHint(p))}">${esc(p)}${Tel.portHint(p) ? ' · ' + esc(Tel.portHint(p).split(' – ')[0]) : ''}</span>`).join(' ') }, { key: 'n', label: 'Sessions', num: true }, { key: 'vol', label: 'Data', num: true, render: x => Tel.bytes(x.vol) }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] });
  },
  ipdr_dev(el, d) { this.devTables(el, d, ''); el.insertAdjacentHTML('beforeend', '<div class="card"><h3>Towers</h3><div id="it1"></div></div>'); Charts.hbar($('#it1', el), [...groupBy(d.filter(Tel.tower), Tel.tower)].map(([k, v]) => ({ label: k, value: v.length, sub: v.find(r => r.addr)?.addr || '', recs: v })).sort((a, b) => b.value - a.value), { onClick: x => this.recDrawer(x.label, x.recs) }); },

  /* ======== TDR ======== */
  tdrStats(d) {
    return Analysis.cached('tel:tdr', () => {
      const multi = uniq(d.map(r => r._src)).length > 1, site = r => multi ? r._src : (r.addr || r.cell || r._src);
      const nums = new Map();
      for (const r of d) for (const n of [r.target, r.other]) { if (!n || !/\d{5,}/.test(n)) continue; let x = nums.get(n); if (!x) nums.set(n, x = { n, sites: new Set(), recs: [], imeis: new Set(), roam: new Set() }); x.sites.add(site(r)); x.recs.push(r); if (n === r.target) { if (r.imei) x.imeis.add(r.imei); if (r.roam) x.roam.add(r.roam); } }
      const L = [...nums.values()].map(x => ({ n: x.n, sites: [...x.sites], sN: x.sites.size, cnt: x.recs.length, imeis: [...x.imeis], roam: [...x.roam].join(', '), first: x.recs.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last: x.recs.reduce((a, r) => r.ts > a ? r.ts : a, ''), recs: x.recs }));
      return { L, site, multi, sites: uniq(d.map(site)) };
    });
  },
  tdr_sum(el, d) {
    const { L, sites, multi, site } = this.tdrStats(d), C = L.filter(x => x.sN >= 2), linked = L.filter(x => Tel.isMob(x.n) && Tel.also('mobile', x.n));
    const mi = [...groupBy(d.filter(r => r.imei), r => r.imei)].filter(([, v]) => uniq(v.map(r => r.target)).length > 1);
    const f = [];
    if (C.length) f.push(`<b>${C.length} number(s)</b> seen at ${multi ? 'two or more crime spots (files)' : 'two or more towers'}: ${C.sort((a, b) => b.sN - a.sN).slice(0, 6).map(x => `<b>${esc(x.n)}</b> (${x.sN})`).join(', ')}.`);
    if (linked.length) f.push(`<b>${linked.length} number(s)</b> also in this case's other data: ${linked.slice(0, 5).map(x => esc(x.n) + ' (' + esc(Tel.also('mobile', x.n)) + ')').join(', ')}.`);
    if (mi.length) f.push(`<b>${mi.length} handset(s)</b> with more than one SIM in the dump.`);
    const fr = L.filter(x => x.n.length > 10 || /^\+/.test(x.n)); if (fr.length) f.push(`${fr.length} foreign / unusual numbers.`);
    el.innerHTML = UI.kpis([['Records', fmtNum(d.length), uniq(d.map(r => r._src)).length + ' file(s)', 'c2'], ['Unique numbers', fmtNum(L.length), '', 'c5'], [multi ? 'Crime spots (files)' : 'Towers', fmtNum(sites.length), '', 'c3'], ['Common to 2+', fmtNum(C.length), '', 'c1'], ['Also in case', fmtNum(linked.length), '', 'c4'], ['Handsets', fmtNum(uniq(d.map(r => r.imei)).length), '', 'c6']])
      + this.insights(f) + `<div class="grid g2"><div class="card"><h3>Records per ${multi ? 'spot (file)' : 'tower'}</h3><div id="ts1"></div></div><div class="card"><h3>Hour of day</h3><div id="ts2"></div></div></div>`;
    Charts.hbar($('#ts1', el), [...groupBy(d, site)].map(([k, v]) => ({ label: k, value: v.length, sub: uniq(v.map(r => r.target)).length + ' numbers' })).sort((a, b) => b.value - a.value));
    Charts.vbar($('#ts2', el), Array.from({ length: 24 }, (_, h) => ({ label: h + ':00', value: d.filter(r => Tel.hour(r) === h).length })));
  },
  tdrTable(el, rows, title, sub) {
    el.innerHTML = `<div class="card"><h3>${title}</h3><div class="sub">${sub}</div><div id="tt"></div></div>`;
    Table($('#tt', el), { rows, sortKey: 'sN', sortDir: -1, exportName: 'tdr', onRow: x => this.recDrawer(x.n, x.recs), columns: [{ key: 'n', label: 'Number', render: x => `<b class="mono">${esc(x.n)}</b> ${Tel.isMob(x.n) ? Tel.alsoB('mobile', x.n) : ''}` }, { key: 'sN', label: 'Spots', num: true, render: x => x.sN > 1 ? `<span class="badge warn">${x.sN}</span>` : '1' }, { key: 'sites', label: 'Where', csv: x => x.sites.join(' | '), render: x => `<span class="small">${x.sites.slice(0, 4).map(esc).join('<br>')}</span>` }, { key: 'cnt', label: 'Records', num: true }, { key: 'imeis', label: 'IMEI', csv: x => x.imeis.join(' '), render: x => `<span class="mono small">${x.imeis.slice(0, 3).map(esc).join('<br>')}</span>` }, { key: 'roam', label: 'Roaming' }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] });
  },
  tdr_com(el, d) { const { L, multi } = this.tdrStats(d); this.tdrTable(el, L.filter(x => x.sN >= 2), 'Numbers common across ' + (multi ? 'crime spots' : 'towers'), 'Import one tower dump per crime spot. A number present at several spots around the crime times is a strong lead.'); },
  tdr_num(el, d) { const { L } = this.tdrStats(d); this.tdrTable(el, L.slice().sort((a, b) => b.cnt - a.cnt), 'All numbers', 'Sorted by spots, then use the Sort box for records. ⚑ = also in case data.'); },
  tdr_dev(el, d) { const multi = new Set([...groupBy(d.filter(r => r.imei), r => r.imei)].filter(([, v]) => uniq(v.map(r => r.target)).length > 1).map(([i]) => i)); this.devTables(el, d.filter(r => multi.has(r.imei)), 'Only handsets seen with 2 or more SIMs in the dump = SIMs being swapped.'); },
  tdr_roam(el, d) { const { L } = this.tdrStats(d); this.tdrTable(el, L.filter(x => x.roam || x.n.length > 10 || (x.n.length === 10 && !Tel.isMob(x.n))), 'Roaming / foreign / unusual numbers', 'Numbers roaming from another circle, foreign numbers and non-mobile numbers.'); },

  /* ======== SMS ======== */
  smsStats(d) {
    return Analysis.cached('tel:sms', () => {
      const H = [...groupBy(d.filter(r => Tel.hdrInfo(r.other)), r => Tel.hdrInfo(r.other).ent)].map(([ent, v]) => ({ ent, cat: Tel.hdrInfo(v[0].other).cat, hdrs: uniq(v.map(r => r.other)), n: v.length, targets: uniq(v.map(r => r.target)), first: v.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last: v.reduce((a, r) => r.ts > a ? r.ts : a, ''), recs: v }));
      const P = [...groupBy(d.filter(r => r.other && !Tel.hdrInfo(r.other)), r => r.target + '|' + r.other)].map(([, v]) => ({ target: v[0].target, other: v[0].other, n: v.length, out: v.filter(r => r.dir === 'SMS-OUT').length, inn: v.filter(r => r.dir === 'SMS-IN').length, first: v.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last: v.reduce((a, r) => r.ts > a ? r.ts : a, ''), recs: v }));
      return { H, P };
    });
  },
  sms_sum(el, d) {
    const { H, P } = this.smsStats(d), cat = c => H.filter(h => h.cat === c);
    const f = [], b = s => `<b>${esc(s)}</b>`;
    if (cat('Bank').length) f.push(`Bank SMS from ${b(cat('Bank').map(h => h.ent).join(', '))} – the number likely has accounts at these banks; ask them for KYC & statements.`);
    if (cat('Payment app').length) f.push(`Payment apps: ${b(cat('Payment app').map(h => h.ent).join(', '))}.`);
    if (cat('Loan / credit app').length) f.push(`Loan / credit apps: ${b(cat('Loan / credit app').map(h => h.ent).join(', '))}.`);
    if (cat('Trading / crypto').length) f.push(`Trading / crypto: ${b(cat('Trading / crypto').map(h => h.ent).join(', '))}.`);
    const biz = d.filter(r => Tel.hdrInfo(r.other)).sort((a, c) => a.ts.localeCompare(c.ts)); let burst = [];
    for (let i = 0, j = 0; i < biz.length; i++) { while (Date.parse(biz[i].ts.replace(' ', 'T')) - Date.parse(biz[j].ts.replace(' ', 'T')) > 600e3) j++; if (i - j + 1 >= 5) burst.push(biz[i].ts.slice(0, 16)); }
    burst = uniq(burst.map(x => x.slice(0, 13))); if (burst.length) f.push(`${b(burst.length + ' burst(s)')} of 5+ business SMS within 10 minutes (OTP / transaction storms) around ${burst.slice(0, 4).map(x => esc(Tel.dd(x + ':00:00').slice(0, 16))).join(', ')}.`);
    const lk = P.filter(p => Tel.isMob(p.other) && Tel.also('mobile', p.other)); if (lk.length) f.push(`${b(lk.length + ' SMS contact(s)')} also in case data: ${lk.slice(0, 4).map(p => esc(p.other)).join(', ')}.`);
    el.innerHTML = UI.kpis([['SMS', fmtNum(d.length), uniq(d.map(r => r._src)).length + ' file(s)', 'c2'], ['Business senders', fmtNum(H.length), fmtNum(sum(H, h => h.n)) + ' SMS', 'c5'], ['Banks', fmtNum(cat('Bank').length), '', 'c1'], ['Payment / loan apps', fmtNum(cat('Payment app').length + cat('Loan / credit app').length), '', 'c3'], ['Person-to-person', fmtNum(P.length), fmtNum(sum(P, p => p.n)) + ' SMS', 'c4']])
      + this.insights(f) + `<div class="grid g2"><div class="card"><h3>Sender type</h3><div id="ms1"></div></div><div class="card"><h3>Top senders</h3><div class="sub">Click for messages.</div><div id="ms2"></div></div><div class="card"><h3>Hour of day</h3><div id="ms3"></div></div><div class="card"><h3>Day by day</h3><div id="ms4"></div></div></div>`;
    Charts.donut($('#ms1', el), [...groupBy(H, h => h.cat)].map(([k, v]) => ({ label: k, value: sum(v, h => h.n) })).concat(P.length ? [{ label: 'Person (number)', value: sum(P, p => p.n) }] : []).sort((a, c) => c.value - a.value));
    Charts.hbar($('#ms2', el), H.map(h => ({ label: h.ent, value: h.n, sub: h.cat + ' · ' + h.hdrs.slice(0, 3).join(', '), recs: h.recs })).sort((a, c) => c.value - a.value), { onClick: x => this.recDrawer(x.label, x.recs) });
    Charts.vbar($('#ms3', el), Array.from({ length: 24 }, (_, h) => ({ label: h + ':00', value: d.filter(r => Tel.hour(r) === h).length })));
    Charts.line($('#ms4', el), [...groupBy(d, Tel.day)].sort((a, c) => a[0].localeCompare(c[0])).map(([k, v]) => ({ label: k, value: v.length })));
  },
  sms_snd(el, d) {
    const { H } = this.smsStats(d);
    el.innerHTML = `<div class="card"><h3>Business sender headers</h3><div class="sub">Header like AX-HDFCBK-S: the middle part is the company. Banks and payment apps show where the number holds accounts.</div><div id="mh"></div></div>`;
    Table($('#mh', el), { rows: H, sortKey: 'n', sortDir: -1, exportName: 'sms_senders', onRow: x => this.recDrawer(x.ent, x.recs), columns: [{ key: 'ent', label: 'Sender', render: x => `<b>${esc(x.ent)}</b>` }, { key: 'cat', label: 'Type', render: x => `<span class="badge ${/Bank|Payment|Loan|Trading/.test(x.cat) ? 'warn' : ''}">${esc(x.cat)}</span>` }, { key: 'hdrs', label: 'Headers', csv: x => x.hdrs.join(' '), render: x => `<span class="mono small">${x.hdrs.slice(0, 4).map(esc).join(', ')}</span>` }, { key: 'n', label: 'SMS', num: true }, { key: 'targets', label: 'To number', csv: x => x.targets.join(' '), render: x => x.targets.map(esc).join(', ') }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] });
  },
  sms_con(el, d) {
    const { P } = this.smsStats(d);
    el.innerHTML = `<div class="card"><h3>Person-to-person SMS</h3><div id="mp"></div></div>`;
    Table($('#mp', el), { rows: P, sortKey: 'n', sortDir: -1, exportName: 'sms_contacts', onRow: x => this.recDrawer(x.target + ' ↔ ' + x.other, x.recs), columns: [{ key: 'target', label: 'Number' }, { key: 'other', label: 'Other number', render: x => `<b class="mono">${esc(x.other)}</b> ${Tel.isMob(x.other) ? Tel.alsoB('mobile', x.other) : ''}` }, { key: 'n', label: 'SMS', num: true }, { key: 'out', label: 'Sent', num: true }, { key: 'inn', label: 'Received', num: true }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] });
  }
};

Pages.tele = main => TelUI.page(main);

/* ---------- menu: Analytics opens a drop-down with CDR / IPDR / TDR / SMS ---------- */
(() => {
  const nav = $('#sidebar'), it = $('.nav-item[data-page="analytics"]', nav); if (!it) return;
  it.insertAdjacentHTML('beforeend', '<span class="nav-chev" title="Show / hide CDR, IPDR, TDR, SMS">▾</span>');
  it.insertAdjacentHTML('afterend', `<div class="nav-subs tel-subs">${Object.entries(TK).map(([k, x], i) => `<div class="nav-sub" data-tel="${k}" style="--pc:${x[1]}" title="${esc(x[2])}"><i></i><span>${i + 1}. ${esc(x[0])}</span></div>`).join('')}</div>`);
  const subs = $('.tel-subs', nav), setOpen = on => { S.telOpen = on; subs.classList.toggle('open', on); it.classList.toggle('open', on); };
  setOpen(false);
  $('.nav-chev', it).addEventListener('click', e => { e.stopPropagation(); setOpen(!S.telOpen); });
  it.addEventListener('click', e => { if (e.target.closest('.nav-chev')) return; setOpen(S.page === 'analytics' ? !S.telOpen : true); }, true);
  $$('.nav-sub[data-tel]', nav).forEach(n => n.onclick = () => { S.telKind = n.dataset.tel; go('tele'); });
  const orig = render;
  render = function () {
    orig();
    $$('.nav-sub[data-tel]').forEach(n => n.classList.toggle('active', S.page === 'tele' && S.telKind === n.dataset.tel));
    if (S.page === 'tele') { it.classList.add('active'); if (!S.telOpen) setOpen(true); }
  };
  // CDR / IPDR numbers, handsets and public IPs join the case-wide index
  const oi = Analysis.idents;
  Analysis.idents = function () {
    const out = oi.apply(this, arguments);
    if (!out._tel && S.data.tel && S.data.tel.length) {
      out._tel = 1; const seen = new Set(), add = (type, value, label, ref, rec) => { const k = type + '|' + value; if (!value || seen.has(k) || seen.size > 20000) return; seen.add(k); out.push({ type, value, section: 'Telecom', label, ref, rec, tel: 1 }); };
      for (const r of S.data.tel) {
        const lb = r.kind === 'TDR' ? 'Tower dump' : r.kind;
        if (r.kind !== 'TDR' && Tel.isMob(r.target)) add('mobile', r.target, lb, lb + ' target · ' + r._src, r);
        if (r.imei && r.kind !== 'TDR') add('imei', r.imei, lb, lb + ' · ' + r.target, r);
        if (r.xip) add('ip', r.xip, 'IPDR', 'IPDR · ' + r.target, r);
      }
    }
    return out;
  };
  // demo case: sample CDR, IPDR, TDR and SMS (dummy numbers)
  if (typeof Demo !== 'undefined') { const od = Demo.load; Demo.load = function () { const before = S.data.txns.length; const r = od.apply(this, arguments); if (S.data.txns.length > before && !Tel.all().length) { S.data.tel = TelDemo(); Analysis.invalidate(); saveCase(); } return r; }; }
})();

function TelDemo() {
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
  const p2 = n => String(n).padStart(2, '0'), T = '9000000101', base = Date.UTC(2026, 8, 1, 0, 0, 0);
  const at = (day, h, m) => { const d = new Date(base + ((day * 24 + h) * 60 + m) * 60e3 + Math.floor(rnd() * 59) * 1000); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`; };
  const luhn = b => { for (let i = 0; i < 10; i++) if (V.luhn(b + i)) return b + i; return b + '0'; };
  const IM1 = luhn('35345678901234'), IM2 = luhn('86012345678901');
  const TW = [['404-10-1101-21001', 'Sector 62, Noida (DUMMY)', 28.627, 77.373], ['404-10-1101-21002', 'Raj Nagar Extn, Ghaziabad (DUMMY)', 28.700, 77.420], ['404-10-1101-21003', 'Indirapuram, Ghaziabad (DUMMY)', 28.641, 77.371], ['404-10-1101-21004', 'Nuh Bus Stand (DUMMY)', 28.105, 77.001]];
  const C = ['9876501234', '9123456780', '9000000202', '9000000203', '9000000204', '9000000205', '9000000206', '9000000207'], W = [9, 7, 5, 3, 3, 2, 1, 1];
  const wc = () => { let t = rnd() * 31; for (let i = 0; i < C.length; i++) { t -= W[i]; if (t <= 0) return C[i]; } return C[0]; };
  const out = [], F1 = 'DEMO › CDR_9000000101_Jio.xlsx';
  for (let day = 0; day < 12; day++) for (let k = 0; k < 22; k++) {
    const h = pick([0, 1, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 23]), tw = h >= 22 || h < 7 ? TW[1] : day > 8 ? TW[3] : pick([TW[0], TW[0], TW[2]]);
    const dir = pick(['OUT', 'OUT', 'IN', 'IN', 'IN', 'SMS-IN']);
    out.push({ kind: 'CDR', _src: F1, ts: at(day, h, Math.floor(rnd() * 60)), target: T, other: wc(), dir, dur: dir.startsWith('SMS') ? 0 : Math.floor(rnd() * 600), imei: day < 6 ? IM1 : IM2, imsi: '405874000000101', cell: tw[0], addr: tw[1], roam: day > 8 ? 'Haryana' : 'UP (West)', lat: tw[2], lon: tw[3] });
  }
  const F2 = 'DEMO › CDR_9000000301_Airtel.xlsx';
  for (let i = 0; i < 60; i++) { const tw = pick(TW); out.push({ kind: 'CDR', _src: F2, ts: at(Math.floor(rnd() * 12), 9 + Math.floor(rnd() * 12), Math.floor(rnd() * 60)), target: '9000000301', other: pick(['9123456780', '9000000202', '9000000401', '9000000402']), dir: pick(['OUT', 'IN']), dur: Math.floor(rnd() * 300), imei: IM2, imsi: '404100000000301', cell: tw[0], addr: tw[1], roam: 'UP (West)' }); }
  const F3 = 'DEMO › IPDR_9000000101.csv', X = ['49.36.100.21', '49.36.101.7', '2409:40d0:1a:2b::1'], DS = [['157.240.16.53', '443'], ['157.240.16.60', '5222'], ['149.154.167.51', '443'], ['142.250.183.4', '443'], ['31.13.79.1', '3478'], ['195.181.174.10', '7070'], ['8.8.8.8', '53']];
  for (let i = 0; i < 160; i++) { const day = Math.floor(rnd() * 12), h = pick([9, 10, 11, 12, 14, 16, 18, 20, 21, 22, 23]), d = pick(DS), st = at(day, h, Math.floor(rnd() * 60)), du = 30 + Math.floor(rnd() * 1800); const e = new Date(Date.parse(st.replace(' ', 'T') + 'Z') + du * 1000).toISOString().replace('T', ' ').slice(0, 19); out.push({ kind: 'IPDR', _src: F3, ts: st, end: e, dur: du, target: T, pip: '10.' + Math.floor(rnd() * 250) + '.4.' + Math.floor(rnd() * 250), pport: String(30000 + Math.floor(rnd() * 30000)), xip: pick(X), xport: String(1024 + Math.floor(rnd() * 60000)), dip: d[0], dport: d[1], up: Math.floor(rnd() * 2e6), down: Math.floor(rnd() * 3e7), imei: day < 6 ? IM1 : IM2, imsi: '405874000000101', cell: TW[day > 8 ? 3 : 0][0], addr: TW[day > 8 ? 3 : 0][1], apn: 'jionet' }); }
  for (const [f, tw, gang] of [['DEMO › TDR spot-1 Raj Nagar.xlsx', TW[1], ['9123456780', '9000000202', '9000000501']], ['DEMO › TDR spot-2 Indirapuram.xlsx', TW[2], ['9123456780', '9000000501', '9000000502']]]) {
    for (let i = 0; i < 140; i++) { const n = i < 12 ? gang[i % gang.length] : '9' + String(100000000 + Math.floor(rnd() * 899999999)); out.push({ kind: 'TDR', _src: f, ts: at(3, 14 + Math.floor(rnd() * 2), Math.floor(rnd() * 60)), target: n, other: '9' + String(100000000 + Math.floor(rnd() * 899999999)), dir: pick(['OUT', 'IN', 'SMS-IN']), dur: Math.floor(rnd() * 200), imei: n === '9000000501' ? IM2 : luhn('35' + String(100000000000 + Math.floor(rnd() * 899999999999))), cell: tw[0], addr: tw[1], roam: rnd() < .08 ? 'Bihar' : '' }); }
  }
  const F4 = 'DEMO › SMS_9000000101.csv', HS = ['AX-HDFCBK-S', 'VM-SBIINB', 'JD-PAYTMB', 'VK-KREDTB', 'AD-AMAZON', 'BZ-JIOSVC', 'TX-GROWWS'];
  for (let i = 0; i < 90; i++) { const day = Math.floor(rnd() * 12); out.push({ kind: 'SMS', _src: F4, ts: at(day, 8 + Math.floor(rnd() * 14), Math.floor(rnd() * 60)), target: T, other: i < 70 ? pick(HS) : pick(['9000000202', '9123456780']), dir: i < 80 ? 'SMS-IN' : 'SMS-OUT', msg: i < 70 ? 'Dummy alert message (DEMO)' : '' }); }
  for (let i = 0; i < 7; i++) out.push({ kind: 'SMS', _src: F4, ts: at(5, 15, 2 + i), target: T, other: pick(['AX-HDFCBK-S', 'VM-SBIINB']), dir: 'SMS-IN', msg: 'OTP for transaction (DEMO)' });
  out.forEach(r => r.id = uid());
  return out;
}
