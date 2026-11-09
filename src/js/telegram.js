/* telegram.js – Social Media › Telegram: read Telegram LE replies (the e-mail reply saved as PDF / txt / html)
   "User #<id> @<username> : +<phone> [<display name>]" followed by "IP <ip>, <date time>" lines,
   plus "… not found" lines and the notice details (FIR / complaint no., NCRP no., requested IDs). */
'use strict';

const TReply = {
  RXU: /User\s*#\s*(\d{3,})\s*(?:@\s?([A-Za-z0-9_]{3,}))?\s*(?::\s*(\+?[\d\s-]{7,}\d))?\s*(?:\[([^\]]*)\]?)?/i,
  RXIP: /^\s*IP\s*:?\s*([0-9a-f]{0,4}[.:][0-9a-f.:]+)\s*[,;]?\s*(.*)$/i,
  ts(s) { s = String(s || '').trim(); if (!s) return ''; return GReply.ts(/utc|gmt|z$|[+-]\d\d:?\d\d$/i.test(s) ? s : s + ' UTC'); },
  parse(text, file) {
    const lines = String(text).split(/\r?\n/).map(l => l.replace(/[  ]/g, ' ').trim());
    // join a display name that wraps onto the next line: "[Customer Support 014" + "]"
    const L = []; for (let i = 0; i < lines.length; i++) { let l = lines[i]; if (/User\s*#/i.test(l) && l.includes('[') && !l.includes(']')) { while (i + 1 < lines.length && !lines[i + 1].includes(']') && !/^IP\b|User\s*#/i.test(lines[i + 1]) && i < lines.length) { l += ' ' + lines[++i]; } if (i + 1 < lines.length && /^[^#]*\]/.test(lines[i + 1])) l += ' ' + lines[++i]; } L.push(l); }
    const all = L.join('\n'), recs = [];
    const caseNo = ((all + ' ' + file).match(/\b(FIR(?:\s*No\.?)?|Com(?:plaint)?\.?\s*No\.?|Case\s*No\.?)[\s:.-]*(\d{1,5}\s*[\/_-]\s*\d{4})/i) || []).slice(1, 3).join(' ').replace(/\s+/g, ' ').replace(/_/g, '/').trim();
    const ncrp = uniq((all.match(/\b(?:2\d{13}|3\d{13})\b/g) || []));
    const replyAt = (all.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*\d{1,2}\s+\w{3}\s+\d{4}\s+\d{1,2}:\d\d(?::\d\d)?\s*(?:AM|PM)?\s*[+-]\d{4}/i) || [''])[0];
    const noticeAt = (all.match(/Dated?\s*[-:.]*\s*(\d{1,2}[-.\/]\d{1,2}[-.\/]\d{4})/i) || [])[1] || '';
    const notice = all.split(/-{3,}\s*Original Message\s*-{3,}/i).slice(1).join('\n');
    const requested = uniq([...all.matchAll(/(?:USER\s*NAME\s*\/?\s*ID|USER\s*LINK|GROUP\s*LINK|CHANNEL\s*LINK|LINK)\s*[:\-–]+\s*-?\s*(@\s?[A-Za-z0-9_]{3,}|https?:\/\/t\.me\/\S+)/gi), ...notice.matchAll(/^\s*\d{1,2}[.)]\s*(@\s?[A-Za-z0-9_]{3,}|https?:\/\/t\.me\/\S+)/gim)].map(m => m[1].replace(/\s/g, '').replace(/[.,;)]+$/, '')));
    // "…accounts and groups are mentioned below: 1. name 2. name" (bare usernames / group names)
    const nl = notice.split(/\n/).map(x => x.trim()); let inList = false;
    for (const x of nl) { if (/mentioned below|\bbelow\s*:\s*$|as under|following (telegram )?(accounts?|ids?|links?|groups?)\s*:/i.test(x)) { inList = true; continue; } if (!inList) continue; const m = x.match(/^\d{1,2}[.)]\s*(.{2,40})$/); if (m) { const v = m[1].trim(); if (!requested.some(q => q.replace(/^@|^https?:\/\/t\.me\//i, '').toLowerCase() === v.replace(/^@/, '').toLowerCase())) requested.push(v); } else if (x) inList = false; }
    const meta = { case_no: caseNo, ncrp: ncrp.join(', '), reply_at: replyAt, notice_at: noticeAt, _src: file };
    let u = null;
    for (const l of L) {
      let m = l.match(this.RXU);
      if (m) { const mob = m[3] ? m[3].replace(/[\s-]/g, '') : ''; u = { kind: 'User', uid: m[1], username: m[2] || '', mobile: mob ? (WReply.mob(mob) || mob) : '', mobile_raw: mob, name: (m[4] || '').trim(), ...meta, ips: 0, _f: [['Line', l]] }; u.acct = u.username ? '@' + u.username : '#' + u.uid; recs.push(u); continue; }
      m = l.match(this.RXIP);
      if (m && u && /[\d]/.test(m[1])) { const [ip, port] = WReply.splitIp(m[1]); const t = this.ts(m[2]); recs.push({ kind: 'IP', uid: u.uid, username: u.username, acct: u.acct, ip: ip.toLowerCase(), port, given: m[2], ts: t, ist: GReply.ist(t), case_no: caseNo, _src: file, _f: [['User', u.acct], ['Line', l]] }); u.ips++; continue; }
      m = l.match(/^(@\s?[A-Za-z0-9_]{3,}|https?:\/\/t\.me\/\S+)\s+(?:is\s+)?(not found|does not exist|no (?:data|records?)|deleted)\b/i);
      if (m) recs.push({ kind: 'Not found', acct: m[1].replace(/\s/g, ''), value: m[1].replace(/\s/g, ''), reason: m[2], case_no: caseNo, _src: file, _f: [['Line', l]] });
    }
    const users = recs.filter(r => r.kind === 'User');
    users.forEach(x => { const ips = recs.filter(r => r.kind === 'IP' && r.uid === x.uid); x.last_ip = ips.map(r => r.ip).pop() || ''; x.last_seen = ips.map(r => r.ist).sort().pop() || ''; x.country = WReply.country(x.mobile); });
    const found = new Set(users.flatMap(x => ['@' + x.username.toLowerCase(), 'https://t.me/' + x.username.toLowerCase(), x.username.toLowerCase()]));
    const nf = new Set(recs.filter(r => r.kind === 'Not found').map(r => r.value.toLowerCase()));
    recs.push({ kind: 'Reply', acct: caseNo || file, ...meta, requested: requested.join(', '), req_n: requested.length, users: users.length, ips: recs.filter(r => r.kind === 'IP').length, not_found: [...nf].join(', '),
      missing: requested.filter(q => !found.has(q.toLowerCase()) && !nf.has(q.toLowerCase()) && !nf.has('@' + q.toLowerCase())).join(', '), _f: [['Case', caseNo], ['NCRP', ncrp.join(', ')], ['Notice date', noticeAt], ['Reply received', replyAt], ['Requested', requested.join(', ')]] });
    if (replyAt) { const t = GReply.ts(replyAt.replace(/\s*([+-]\d\d)(\d\d)$/, ' GMT$1$2')); if (t) { const rr = recs[recs.length - 1]; rr.ts = t; rr.ist = GReply.ist(t); } }
    return recs;
  },
  TYPES: [['mobile', '📱 Mobile'], ['username', '👤 Username'], ['uid', '🆔 User #'], ['name', '🏷 Display name'], ['ip', '🌐 IP address'], ['subnet', '🛰 IP /24 network'], ['country', '🌍 Country code'], ['case', '📁 Case / FIR'], ['date', '📅 Date'], ['hour', '🕐 Hour (IST)']],
  ids(r) {
    if (r._ids) return r._ids;
    const out = new Map(), add = (t, v) => { v = String(v || '').trim(); if (v && v.length < 200) out.set(t + '|' + v.toLowerCase(), [t, v]); };
    if (r.kind === 'User') { add('mobile', r.mobile); if (r.username) add('username', r.username.toLowerCase()); add('uid', r.uid); if (r.name) add('name', r.name.toUpperCase()); add('country', r.country); add('case', r.case_no); }
    if (r.kind === 'IP') { add('ip', r.ip); if (/^\d+\.\d+\.\d+\.\d+$/.test(r.ip)) add('subnet', r.ip.split('.').slice(0, 3).join('.') + '.0/24'); else if (r.ip.includes(':')) add('subnet', r.ip.split(':').slice(0, 4).join(':') + '::/64'); add('case', r.case_no); }
    if (r.kind === 'Not found') add('username', r.value.replace(/^@|^https?:\/\/t\.me\//i, '').toLowerCase());
    if (r.ist && r.kind === 'IP') { add('date', r.ist.slice(0, 10)); if (r.ist.length > 10) add('hour', r.ist.slice(11, 13) + ':00'); }
    return (r._ids = [...out.values()]);
  }
};

const TData = {
  all() { if (!S.data.telegram) S.data.telegram = []; return S.data.telegram; },
  of(kind) { return this.all().filter(r => r.kind === kind); },
  async importFiles(list) {
    const files = await GReply.files([...list]); const done = [];
    for (const f of files) {
      try { const { text } = await GReply.read(f); const recs = TReply.parse(text, f.name); if (!recs.some(r => r.kind === 'User' || r.kind === 'Not found')) throw new Error('no "User #… @…" lines found');
        recs.forEach(r => r.id = uid()); this.all().push(...recs); done.push([f.name, recs.length]);
        S.data.imports.push({ id: uid(), when: new Date().toISOString(), file: f.name, type: 'telegram', count: recs.length }); }
      catch (e) { done.push([f.name, 'Error: ' + (e.message || e)]); }
    }
    saveCase(); return done;
  },
  removeFile(name) { S.data.telegram = this.all().filter(r => r._src !== name); S.data.imports = S.data.imports.filter(i => !(i.type === 'telegram' && i.file === name)); saveCase(); },
  elsewhere() {
    return Analysis.cached('t:else', () => { const m = new Map(); try { Analysis.idents().filter(x => !x.tg).forEach(x => { const k = x.type + '|' + String(x.value).toLowerCase(); if (!m.has(k)) m.set(k, new Set()); m.get(k).add(x.label || x.section); }); } catch (e) { } return m; });
  },
  common(type) {
    return Analysis.cached('t:c:' + type, () => {
      const G = new Map();
      for (const r of this.all()) for (const [t, v] of TReply.ids(r)) { if (t !== type) continue; const k = v.toLowerCase(); let g = G.get(k); if (!g) G.set(k, g = { value: v, n: 0, accts: new Set(), cases: new Set(), kinds: new Set(), times: [], recs: [] }); g.n++; if (r.acct && r.kind !== 'Not found') g.accts.add(r.acct); if (r.case_no) g.cases.add(r.case_no); g.kinds.add(r.kind); if (r.ist) g.times.push(r.ist); g.recs.push(r); }
      const EL = this.elsewhere(), map = { mobile: 'mobile', ip: 'ip', username: 'username' };
      return [...G.values()].map(g => { g.times.sort(); const el = map[type] ? EL.get(map[type] + '|' + g.value.toLowerCase()) : null; return { value: g.value, n: g.n, accts: g.accts.size, acctList: [...g.accts].join(', '), cases: [...g.cases].join(', '), kinds: [...g.kinds].join(', '), first: g.times[0] || '', last: g.times[g.times.length - 1] || '', also: el ? [...el].join(', ') : '', recs: g.recs }; });
    });
  },
  view(r) { const o = { kind: r.kind }; for (const k of ['uid', 'username', 'mobile', 'name', 'country', 'ip', 'port', 'given', 'ist', 'last_ip', 'last_seen', 'value', 'reason', 'case_no', 'ncrp', 'notice_at', 'reply_at', 'requested', 'not_found', 'missing']) if (r[k] !== undefined && r[k] !== '') o[{ uid: 'User #', username: 'username (@)', mobile: 'registered mobile', name: 'display name', given: 'time as given by Telegram', ist: 'time (IST)', case_no: 'case / FIR', ncrp: 'NCRP no.', notice_at: 'notice date', reply_at: 'reply received', not_found: 'not found', missing: 'no answer for' }[k] || k.replace(/_/g, ' ')] = r[k]; if (r.ip) o['IP type'] = V.ipKind(r.ip); o.file = r._src; return o; }
};

PAGE_META.tsocial = { group: 'Investigation › Social Media', title: 'Telegram (LE reply)', desc: 'Telegram replies to your notice: User #, @username, registered mobile, display name, IP with date & time, and IDs Telegram could not find. Common values are matched across Telegram, Facebook, Instagram, WhatsApp, Google and the rest of the case.',
  order: ['tsum', 'tusr', 'tip', 'treq', 'tcom', 'ttime', 'tcsv', 'tfiles'] };

const TTabs = {
  C: '#229ED9',
  page(main) {
    const d = TData.all(), c = k => d.filter(r => r.kind === k).length, csv = Analysis.socRows();
    const { cur, body } = tabs(main, 'tsocial', [['tsum', '📊 Overview'], ['tusr', `👤 Users (${c('User')})`], ['tip', `🌐 IP Activity (${c('IP')})`], ['treq', `📨 Requests & Replies (${c('Reply')})`], ['tcom', '⚑ Common'], ['ttime', '🕐 Date & Time'], ['tcsv', `📋 Other Telegram rows (${csv.length})`], ['tfiles', '📁 Files']], 'Telegram',
      `<button class="btn primary" id="tImp" style="background:${this.C}">⬆ Import Telegram reply</button><input type="file" id="tPick" class="hidden" multiple accept=".pdf,.txt,.html,.htm,.eml,.zip,.rar">`);
    GTabs.bar(main, body);
    $('#tImp').onclick = () => this.pick(); $('#tPick').onchange = e => this.load(e.target.files);
    if (!d.length && !['tfiles', 'tcsv'].includes(cur)) return this.empty(body, csv.length);
    this[cur](body, d);
  },
  pick() { const fp = $('#tPick'); fp.value = ''; fp.click(); },
  async load(files) {
    if (!files || !files.length) return; UI.toast('Reading ' + files.length + ' file(s)…');
    const done = await TData.importFiles(files); Analysis.invalidate();
    const ok = done.filter(x => typeof x[1] === 'number'), bad = done.length - ok.length;
    UI.toast(`Telegram: ${ok.length} file(s) read, ${fmtNum(sum(ok, x => x[1]))} records` + (bad ? ` · ${bad} without Telegram user lines` : ''));
    render();
  },
  drop(el) {
    el.innerHTML = `<div class="g-drop" id="tDrop"><div class="g-dl" style="background:${this.C}">✈</div><b>Drop Telegram reply files here</b><span>or click to choose · the reply e-mail saved as PDF, .txt or .html, or a .zip / .rar of them</span>
      <div class="g-kinds"><i style="--k:${this.C}">User # · @username</i><i style="--k:#16a34a">Registered mobile</i><i style="--k:#a855f7">Display name</i><i style="--k:#0ea5e9">IP · date &amp; time</i><i style="--k:#ef4444">Not found</i></div></div>`;
    const dz = $('#tDrop', el); dz.onclick = () => this.pick();
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); this.load(e.dataTransfer.files); };
  },
  empty(el, csvN) {
    el.innerHTML = `<div class="card"><h3>No Telegram reply in this case yet</h3><div class="sub">Save Telegram's reply e-mail as PDF (or copy it to a .txt) and import it. Several replies at once are fine. Everything is read on this computer only.${csvN ? ` You also have <b>${csvN}</b> Telegram row(s) from a CSV / Excel import in the <b>Other Telegram rows</b> tab.` : ''}</div><div id="tD"></div>
      <div class="g-help"><div><b style="color:${this.C}">User line</b> User #123456789 @username : +91XXXXXXXXXX [Display Name]</div><div><b style="color:#0ea5e9">IP line</b> IP 1.2.3.4, 10 Sep 2026 9:31:27</div><div><b style="color:#ef4444">Not found</b> @username not found · https://t.me/… not found</div><div><b style="color:#f59e0b">Your notice</b> FIR / Com. No., NCRP no., notice date, requested IDs and links are read from the quoted e-mail</div></div></div>`;
    this.drop($('#tD', el));
  },

  tsum(el, d) {
    const U = TData.of('User'), I = TData.of('IP'), N = TData.of('Not found'), R = TData.of('Reply');
    const shared = TReply.TYPES.reduce((s, [t]) => s + (['date', 'hour', 'country', 'case'].includes(t) ? 0 : TData.common(t).filter(g => g.accts >= 2 || g.also).length), 0);
    el.innerHTML = UI.kpis([['Telegram users', fmtNum(U.length), uniq(U.map(u => u.case_no).filter(Boolean)).length + ' case(s)', 'c2'], ['Registered mobiles', fmtNum(uniq(U.map(u => u.mobile).filter(Boolean)).length), uniq(U.map(u => u.country).filter(Boolean)).join(', ') || '—', 'c5'], ['IP entries', fmtNum(I.length), uniq(I.map(r => r.ip)).length + ' unique IPs', 'c4'],
      ['Not found', fmtNum(N.length), 'IDs / links Telegram could not find', 'c3'], ['Replies', fmtNum(R.length), R.filter(r => r.reply_at).length + ' with reply date', 'c6'], ['Common / cross-linked', fmtNum(shared), 'in 2+ users or Facebook / Instagram / WhatsApp / Google / bank / KYC / NCRP', 'c1']]) +
      `<div class="card"><h3>Users at a glance</h3><div class="sub">User #, @username, registered mobile, display name, IP and when it was used. Click a row for details.</div><div id="ts0"></div></div>
      <div class="grid g2"><div class="card"><h3>Mobile numbers by country</h3><div class="sub">Foreign numbers (for example +1 USA / Canada) on Telegram are often virtual / VoIP numbers bought online – ask the provider for the buyer</div><div id="ts1"></div></div><div class="card"><h3>IP type</h3><div class="sub">Cloud / data-centre IPs often mean a VPN or a bot</div><div id="ts2"></div></div>
      <div class="card"><h3>IP used – hour of day (IST)</h3><div id="ts3"></div></div><div class="card"><h3>Users per case</h3><div id="ts4"></div></div></div>`;
    this.userTable($('#ts0', el), U);
    const cc = groupBy(U, u => u.country || 'Unknown'); Charts.hbar($('#ts1', el), [...cc].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(TData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' user' : ' users') });
    const it = groupBy(I, r => V.ipKind(r.ip)); Charts.hbar($('#ts2', el), [...it].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(TData.view) })), { fmt: v => v + (v === 1 ? ' IP' : ' IPs') });
    Charts.vbar($('#ts3', el), Array.from({ length: 24 }, (_, h) => { const recs = I.filter(r => r.ist && r.ist.length > 10 && +r.ist.slice(11, 13) === h); return { label: String(h).padStart(2, '0'), value: recs.length, recs: recs.map(TData.view) }; }), { fmt: v => v + (v === 1 ? ' entry' : ' entries') });
    const pc = groupBy(U, u => u.case_no || 'Case not given'); Charts.hbar($('#ts4', el), [...pc].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(TData.view) })), { fmt: v => v + (v === 1 ? ' user' : ' users') });
  },
  userTable(el, U) {
    const EL = TData.elsewhere(), also = u => uniq([...(EL.get('mobile|' + String(u.mobile).toLowerCase()) || []), ...(EL.get('username|' + String(u.username).toLowerCase()) || [])]).join(', ');
    Table(el, { rows: U.map(u => ({ ...u, also: also(u) })), exportName: 'telegram_users', columns: [{ key: 'uid', label: 'User #', render: r => `<span class="mono">${esc(r.uid)}</span>` }, { key: 'username', label: 'User ID @', render: r => r.username ? `<b>@${esc(r.username)}</b>` : '<span class="muted">—</span>' }, { key: 'mobile', label: 'Registered mobile', render: r => `<b class="mono">${esc(r.mobile_raw ? (r.mobile_raw.startsWith('+') ? r.mobile_raw : '+' + r.mobile_raw) : '')}</b>` }, { key: 'country', label: 'Country' }, { key: 'name', label: 'Display name' },
      { key: 'last_ip', label: 'IP', render: r => `<span class="mono ipv">${esc(r.last_ip || '')}</span>` }, { key: 'last_seen', label: 'IP used (IST)', render: r => `<span class="mono">${esc(r.last_seen || '')}</span>` }, { key: 'case_no', label: 'Case / FIR' }, { key: 'also', label: 'Also in case', render: r => r.also ? `<span class="badge warn">⚑ ${esc(r.also)}</span>` : '' }],
      onRow: r => Records.show('Telegram ' + (r.username ? '@' + r.username : '#' + r.uid), [TData.view(r), ...TData.of('IP').filter(x => x.uid === r.uid).map(TData.view)]) });
  },

  tusr(el) {
    const U = TData.of('User');
    if (!U.length) { el.innerHTML = '<div class="card muted">No Telegram users in the imported files.</div>'; return; }
    el.innerHTML = `<div class="g-cards">${U.map(u => { const I = TData.of('IP').filter(x => x.uid === u.uid); return `<div class="g-card" style="--gc:${this.C}"><div class="g-ch"><span class="g-av" style="background:${this.C}">${esc((u.name || u.username || '?').trim()[0] || '?').toUpperCase()}</span><div><b>${esc(u.name || '(no display name)')}</b><small>${u.username ? '@' + esc(u.username) : 'no username'} · User #${esc(u.uid)}</small></div><span class="spacer"></span>${u.country ? `<span class="badge ${u.country === 'India' ? '' : 'warn'}">${esc(u.country)}</span>` : ''}</div>
      <div class="g-grid">${GTabs.kv('User #', u.uid, 'gh')}${GTabs.kv('User ID @', u.username && '@' + u.username, 'gh')}${GTabs.kv('Registered mobile', u.mobile_raw && (u.mobile_raw.startsWith('+') ? u.mobile_raw : '+' + u.mobile_raw), 'gh')}${GTabs.kv('Display name', u.name)}${I.map(x => GTabs.kv('IP', x.ip + (x.port ? ' port ' + x.port : ''), 'gh') + GTabs.kv('IP used', x.given + (x.ist ? ' (IST ' + x.ist + ' if Telegram time is UTC)' : ''), 'wide')).join('')}${GTabs.kv('IP type', I[0] && V.ipKind(I[0].ip))}${GTabs.kv('Case / FIR', u.case_no)}${GTabs.kv('NCRP no.', u.ncrp, 'wide')}${GTabs.kv('Reply received', u.reply_at)}</div>
      ${I.length ? `<div class="note small" style="margin-top:8px">ISP request: IP <b class="mono">${esc(I[I.length - 1].ip)}</b> at <b>${esc(I[I.length - 1].given)}</b>. Ask Telegram to confirm the time zone if the ISP needs it.</div>` : ''}
      <details><summary>Source · ${esc(u._src)}</summary><div class="g-all">${u._f.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div></details></div>`; }).join('')}</div>`;
  },

  tip(el) {
    const I = TData.of('IP');
    if (!I.length) { el.innerHTML = '<div class="card muted">No IP addresses in the imported files.</div>'; return; }
    const EL = TData.elsewhere();
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>IP /24 network</h3><div class="sub">Users on the same network block are often one group / one operator</div><div id="ti1"></div></div><div class="card"><h3>IP used – date (IST)</h3><div id="ti2"></div></div></div>
      <div class="card"><h3>Every IP entry</h3><div class="sub">"Time as given" is copied from Telegram's reply. The IST column assumes Telegram's time is UTC (adds 5 h 30 min).</div><div id="tiT"></div></div>`;
    const sn = groupBy(I, r => TReply.ids(r).find(x => x[0] === 'subnet')?.[1] || r.ip); Charts.hbar($('#ti1', el), [...sn].map(([k, v]) => ({ label: k, value: v.length, sub: uniq(v.map(x => x.acct)).join(', ').slice(0, 40), recs: v.map(TData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' entry' : ' entries'), max: 10 });
    const dd = groupBy(I.filter(r => r.ist), r => r.ist.slice(0, 10)); Charts.vbar($('#ti2', el), [...dd.keys()].sort().map(k => ({ label: k, value: dd.get(k).length, recs: dd.get(k).map(TData.view) })), { fmt: v => v + (v === 1 ? ' entry' : ' entries') });
    Table($('#tiT', el), { rows: I.map(r => ({ ...r, also: (x => x ? [...x].join(', ') : '')(EL.get('ip|' + r.ip)) })), exportName: 'telegram_ip', sortKey: 'ist', sortDir: -1, columns: [{ key: 'given', label: 'Time as given' }, { key: 'ist', label: 'Time (IST)', render: r => `<span class="mono">${esc(r.ist || '')}</span>` }, { key: 'ip', label: 'IP address', render: r => `<b class="mono ipv">${esc(r.ip)}</b>` }, { key: 'ipk', label: 'Type', render: r => esc(V.ipKind(r.ip)) }, { key: 'acct', label: 'User' }, { key: 'uid', label: 'User #' }, { key: 'case_no', label: 'Case / FIR' }, { key: 'also', label: 'Also in case', render: r => r.also ? `<span class="badge warn">⚑ ${esc(r.also)}</span>` : '' }], onRow: r => Records.show('IP ' + r.ip, [TData.view(r)]) });
  },

  treq(el) {
    const R = TData.of('Reply'), N = TData.of('Not found');
    el.innerHTML = `<div class="card"><h3>Your notices and Telegram's replies</h3><div class="sub">Compare what you asked for with what came back. <b>No answer for</b> = requested in your notice but neither found nor reported "not found" – follow up with Telegram.</div><div id="trT"></div></div>
      ${N.length ? '<div class="card"><h3>Not found by Telegram</h3><div id="trN"></div></div>' : ''}`;
    Table($('#trT', el), { rows: R, exportName: 'telegram_replies', columns: [{ key: 'case_no', label: 'Case / FIR', render: r => `<b>${esc(r.case_no || '—')}</b>` }, { key: 'ncrp', label: 'NCRP no.' }, { key: 'notice_at', label: 'Notice date' }, { key: 'reply_at', label: 'Reply received' }, { key: 'req_n', label: 'Requested', num: true }, { key: 'users', label: 'Users found', num: true }, { key: 'ips', label: 'IPs', num: true }, { key: 'not_found', label: 'Not found', render: r => r.not_found ? `<span class="badge">${esc(r.not_found)}</span>` : '' }, { key: 'missing', label: 'No answer for', render: r => r.missing ? `<span class="badge warn">${esc(r.missing)}</span>` : '' }, { key: '_src', label: 'File' }], onRow: r => Records.show('Reply – ' + (r.case_no || r._src), [TData.view(r)]) });
    if (N.length) Table($('#trN', el), { rows: N, exportName: 'telegram_not_found', columns: [{ key: 'value', label: 'ID / link', render: r => `<b class="mono">${esc(r.value)}</b>` }, { key: 'reason', label: 'Telegram said' }, { key: 'case_no', label: 'Case / FIR' }, { key: '_src', label: 'File' }] });
  },

  tcom(el) {
    const T = TReply.TYPES, f = T.some(t => t[0] === S.tField) ? S.tField : 'ip', only = S.tOnly !== false;
    const sh = g => g.accts >= 2 || g.also, allR = TData.common(f), shN = allR.filter(sh).length;
    const rows = allR.filter(g => !only || !shN || sh(g)).sort((a, b) => (b.also ? 1 : 0) - (a.also ? 1 : 0) || b.accts - a.accts || b.n - a.n);
    el.innerHTML = `<div class="card"><h3>Common analysis · Telegram</h3><div class="sub">The same value for 2+ Telegram users or cases. <b>Also in case</b> = it also appears in Facebook, Instagram, WhatsApp, Google, bank, KYC, NCRP or other social data.</div>
      <div class="g-fields">${T.map(([k, l]) => { const c = TData.common(k), n = c.filter(sh).length; return `<button class="${k === f ? 'on' : ''}" data-tf="${k}">${l}<b>${n}</b><small>${c.length}</small></button>`; }).join('')}</div>
      <label class="row small" style="gap:6px;margin:6px 0 2px"><input type="checkbox" id="tOnly" ${only ? 'checked' : ''}> Only shared values (2+ users, or also elsewhere in the case)</label>${only && !shN ? '<div class="note" style="margin-top:6px">No value of this type is shared yet, so all values are shown.</div>' : ''}</div>
      <div class="grid g2"><div class="card"><h3>Top ${esc((T.find(t => t[0] === f) || [])[1] || '')}</h3><div class="sub">Click a bar to see the records</div><div id="tcC"></div></div><div class="card"><h3>Seen in</h3><div id="tcK"></div></div></div>
      <div class="card"><div id="tcT"></div></div>`;
    $$('[data-tf]', el).forEach(b => b.onclick = () => { S.tField = b.dataset.tf; this.tcom(el); });
    $('#tOnly', el).onchange = e => { S.tOnly = e.target.checked; this.tcom(el); };
    Charts.hbar($('#tcC', el), rows.slice().sort((a, b) => b.n - a.n).map(g => ({ label: g.value, value: g.n, sub: g.also ? '⚑ ' + g.also : g.accts + ' user(s)', recs: g.recs.map(TData.view) })), { fmt: v => v + (v === 1 ? ' record' : ' records'), max: 10 });
    const K = new Map(); rows.forEach(g => g.recs.forEach(r => { const k = r.kind + (r.case_no ? ' · ' + r.case_no : ''); if (!K.has(k)) K.set(k, []); K.get(k).push(r); }));
    Charts.hbar($('#tcK', el), [...K].map(([k, v]) => ({ label: k, value: v.length, recs: v.map(TData.view) })).sort((a, b) => b.value - a.value), { fmt: v => v + (v === 1 ? ' record' : ' records') });
    Table($('#tcT', el), { rows, exportName: 'telegram_common_' + f, sortKey: 'n', sortDir: -1, columns: [{ key: 'value', label: 'Value', render: r => `<b class="mono ipv">${esc(r.value)}</b>` }, { key: 'n', label: 'Times', num: true }, { key: 'accts', label: 'Users', num: true }, { key: 'acctList', label: 'User list' }, { key: 'cases', label: 'Case / FIR' }, { key: 'kinds', label: 'Found in' }, { key: 'first', label: 'First (IST)' }, { key: 'last', label: 'Last (IST)' }, { key: 'also', label: 'Also in case', render: r => r.also ? `<span class="badge warn">⚑ ${esc(r.also)}</span>` : '' }],
      onRow: r => Records.show((T.find(t => t[0] === f) || [])[1] + ' – ' + r.value, r.recs.map(TData.view)) });
  },

  ttime(el) {
    const E = TData.all().filter(r => r.ist && (r.kind === 'IP' || r.kind === 'Reply'));
    if (!E.length) { el.innerHTML = '<div class="card muted">No dated entries in the imported files.</div>'; return; }
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], lab = r => r.kind === 'IP' ? 'IP used' : 'Reply received';
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>Weekday (IST)</h3><div id="tt1"></div></div><div class="card"><h3>Hour of day (IST)</h3><div id="tt2"></div></div></div><div class="card"><h3>Timeline</h3><div class="sub">IP use and reply dates, newest first</div><div id="ttT"></div></div>`;
    Charts.vbar($('#tt1', el), wd.map((w, i) => { const recs = E.filter(r => new Date(r.ist.slice(0, 10)).getDay() === i); return { label: w, value: recs.length, recs: recs.map(TData.view) }; }), { fmt: v => v + (v === 1 ? ' entry' : ' entries') });
    Charts.vbar($('#tt2', el), Array.from({ length: 24 }, (_, h) => { const recs = E.filter(r => r.ist.length > 10 && +r.ist.slice(11, 13) === h); return { label: String(h).padStart(2, '0'), value: recs.length, recs: recs.map(TData.view) }; }), { fmt: v => v + (v === 1 ? ' entry' : ' entries') });
    Table($('#ttT', el), { rows: E, exportName: 'telegram_timeline', sortKey: 'ist', sortDir: -1, columns: [{ key: 'ist', label: 'Time (IST)', render: r => `<span class="mono">${esc(r.ist)}</span>` }, { key: 'what', label: 'Event', render: r => esc(lab(r)) }, { key: 'acct', label: 'User / case' }, { key: 'ip', label: 'IP', render: r => `<span class="mono ipv">${esc(r.ip || '')}</span>` }, { key: 'case_no', label: 'Case / FIR' }, { key: '_src', label: 'File' }], onRow: r => Records.show(lab(r) + ' – ' + r.ist, [TData.view(r)]) });
  },

  tcsv(el) { return WTabs.wcsv(el); },

  tfiles(el) {
    const F = groupBy(TData.all(), r => r._src);
    el.innerHTML = `<div class="card"><h3>Add Telegram reply files</h3><div id="tD"></div></div><div class="card"><h3>Imported Telegram files</h3><div id="tfT"></div></div>`;
    this.drop($('#tD', el));
    Table($('#tfT', el), { rows: [...F].map(([file, v]) => ({ file, n: v.length, kinds: [...groupBy(v, r => r.kind)].map(([k, x]) => k + ' ' + x.length).join(' · '), cases: uniq(v.map(r => r.case_no).filter(Boolean)).join(', ') })), exportName: 'telegram_files',
      columns: [{ key: 'file', label: 'File' }, { key: 'n', label: 'Records', num: true }, { key: 'kinds', label: 'What was found' }, { key: 'cases', label: 'Case / FIR' }, { key: 'x', label: '', render: r => `<button class="btn sm" data-tdel="${esc(r.file)}">🗑 Remove</button>` }],
      after: t => $$('[data-tdel]', t).forEach(b => b.onclick = ev => { ev.stopPropagation(); if (UI.confirm('Remove all records from ' + b.dataset.tdel + '?')) { TData.removeFile(b.dataset.tdel); Analysis.invalidate(); render(); } }) });
  }
};

(() => {
  const op = Pages.social;
  Pages.social = function (main) { if (S.socPlat === 'telegram') return TTabs.page(main); return op.apply(this, arguments); };
  const ob = GTabs.bar; GTabs.bar = function (main) { ob.apply(this, arguments); const n = TData.of('User').length, b = $('.pchip[data-plat=telegram] b', main); if (b && n) b.textContent = fmtNum(S.data.social.filter(r => Analysis.platOf(r) === 'telegram').length + n); };
  const oi = Analysis.idents;
  Analysis.idents = function () {
    const out = oi.apply(this, arguments);
    if (!out._t && S.data.telegram && S.data.telegram.length) { out._t = 1; for (const r of S.data.telegram) for (const [t, v] of TReply.ids(r)) if (['mobile', 'ip', 'username'].includes(t) && r.kind !== 'Not found') out.push({ type: t, value: v, section: 'Social', ref: 'Telegram · ' + (r.acct || '') + (r.case_no ? ' · ' + r.case_no : ''), rec: r, tg: 1, label: 'Telegram' }); }
    return out;
  };
  if (typeof Demo !== 'undefined') { const od = Demo.load; Demo.load = function () { const before = S.data.txns.length; const r = od.apply(this, arguments); if (S.data.txns.length > before && !TData.all().length) { for (const [name, text] of Object.entries(TDEMO)) { const recs = TReply.parse(text, name); recs.forEach(x => x.id = uid()); TData.all().push(...recs); } saveCase(); } return r; }; }
})();

const TDEMO = {
  'DEMO › Telegram reply FIR-999_2026.txt': `Thu, 8 Oct 2026 4:49:26 PM +0530

User #7000000001 @stockguru_tips_dummy : +919123456780 [Stock Guru (DUMMY)]
IP 49.36.100.21, 2 Oct 2026 10:15:00

User #7000000002 @riya_invest_dummy : +919000011122 [Riya Invest (DUMMY)]
IP 49.36.100.88, 3 Oct 2026 18:40:12

@helpdesk_dummy not found

-------- Original Message --------
Subject: FIR No. 999/2026 (DUMMY) Regarding Telegram accounts
Dated-05-10-2026
USER NAME /ID:- @stockguru_tips_dummy
USER NAME /ID:- @riya_invest_dummy
USER NAME /ID:- @helpdesk_dummy
USER LINK:- https://t.me/vip_signals_dummy
`
};
