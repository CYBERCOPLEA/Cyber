/* tools.js - Analysis › Tools: IP Lookup, MNP, IMEI, MAC, Email Header, WhoIS.
   Each tool has an offline check (nothing leaves the computer) and buttons for lookup websites.
   Officers can add their own website buttons; they are saved in this browser. */
'use strict';

const XT = {
  CATS: [
    ['ip', 'IP Lookup', '#06b6d4', 'IPv4 / IPv6 type, CGNAT, network block, and who owns it'],
    ['mnp', 'MNP', '#f97316', 'Mobile number check, country, and current operator after porting'],
    ['imei', 'IMEI', '#8b5cf6', 'Check digit, TAC (make / model), and stolen / blocked status'],
    ['mac', 'MAC', '#10b981', 'Format, vendor prefix (OUI), random / private MAC'],
    ['email', 'Email Header', '#ec4899', 'Sender IP, mail servers on the way, SPF / DKIM / DMARC'],
    ['whois', 'WhoIS', '#eab308', 'Domain / website owner, registrar, dates, name servers']
  ],
  /* built-in website buttons; {q} is replaced with the value typed in the box */
  SITES: {
    ip: [['IPLocation.net', 'https://www.iplocation.net/ip-lookup'], ['IPGeolocation', 'https://ipgeolocation.io/ip-location/{q}'], ['IPLeak', 'https://ipleak.net/?q={q}'], ['DB-IP', 'https://db-ip.com/{q}'], ['IPAddress.com bulk', 'https://www.ipaddress.com/bulk-ip-lookup'], ['ipapi bulk', 'https://app.ipapi.co/bulk/'], ['WhatIsMyIPAddress', 'https://whatismyipaddress.com/ip/{q}'],
      ['IPinfo', 'https://ipinfo.io/{q}'], ['AbuseIPDB', 'https://www.abuseipdb.com/check/{q}'], ['APNIC Whois', 'https://wq.apnic.net/static/search.html?query={q}'], ['ARIN RDAP', 'https://search.arin.net/rdap/?query={q}'], ['Shodan', 'https://www.shodan.io/host/{q}'], ['VirusTotal', 'https://www.virustotal.com/gui/ip-address/{q}']],
    mnp: [['CyberKendra MNP checker', 'https://tools.cyberkendra.com/tools/mnp-checker/'], ['Ding (operator by number)', 'https://www.ding.com/'], ['Sanchar Saathi', 'https://sancharsaathi.gov.in/'], ['Truecaller', 'https://www.truecaller.com/search/in/{q}'], ['TRAI', 'https://www.trai.gov.in/']],
    imei: [['IMEI.info', 'https://www.imei.info/?imei={q}'], ['Sanchar Saathi (CEIR / KYM)', 'https://sancharsaathi.gov.in/'], ['IMEI24', 'https://imei24.com/imei_check/{q}/']],
    mac: [['MACLookup.app', 'https://maclookup.app/search/result?mac={q}'], ['DNSChecker MAC', 'https://dnschecker.org/mac-lookup.php'], ['MAC Vendors', 'https://api.macvendors.com/{q}'], ['Wireshark OUI', 'https://www.wireshark.org/tools/oui-lookup.html']],
    email: [['Google Message Header', 'https://toolbox.googleapps.com/apps/messageheader/'], ['MXToolbox Header', 'https://mxtoolbox.com/EmailHeaders.aspx'], ['Microsoft MHA', 'https://mha.azurewebsites.net/']],
    whois: [['whois.com', 'https://www.whois.com/whois/{q}'], ['ICANN Lookup', 'https://lookup.icann.org/en/lookup?name={q}'], ['who.is', 'https://who.is/whois/{q}'], ['DNS records (MXToolbox)', 'https://mxtoolbox.com/SuperTool.aspx?action=a%3a{q}'], ['VirusTotal', 'https://www.virustotal.com/gui/domain/{q}'], ['Wayback Machine', 'https://web.archive.org/web/*/{q}']]
  },
  links: null, cats: null,
  async load() {
    if (!this.links && DB.db) { try { this.links = (await DB.get('tools:links')) || []; this.cats = (await DB.get('tools:cats')) || []; } catch (e) { this.links = []; this.cats = []; } }
  },
  async save() { await DB.set('tools:links', this.links); await DB.set('tools:cats', this.cats); },
  all() { return [...this.CATS, ...(this.cats || []).map(c => [c.id, c.name, c.color || '#64748b', 'Your own section'])]; },
  cat(id) { return this.all().find(c => c[0] === id); },
  url(u, q) { u = String(u).trim(); if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u.includes('{q}') ? u.replace(/\{q\}/g, encodeURIComponent(q || '')) : u; },
  inCase(vals) {
    if (!S.data || !vals.length) return [];
    const want = new Set(vals.map(v => String(v).toLowerCase()));
    let id = []; try { id = Analysis.idents(); } catch (e) { }
    return id.filter(i => want.has(String(i.value).toLowerCase()));
  },
  vals(text, cat) { return uniq(String(text || '').split(cat === 'mnp' ? /[\n,;]+/ : /[\s,;]+/).map(x => x.trim()).filter(Boolean)); },
  isIP(v) { v = String(v).trim(); return /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(v) || (/^[0-9a-f:]+$/i.test(v) && (v.includes('::') || v.split(':').length >= 6) && v.split(':').length <= 8); },

  /* ---------- offline checks ---------- */
  ip(v) {
    const k = XT.isIP(v) ? V.ipKind(v) : 'Invalid'; const r = { Value: esc(v), Type: k === 'Invalid' ? '<span class="badge bad">Not a valid IP</span>' : `<span class="badge ${/public/.test(k) ? 'good' : 'warn'}">${esc(k)}</span>` };
    if (k === 'Invalid') return r;
    if (v.includes(':')) { const h = v.split(':'); r['Network (/64)'] = esc(h.slice(0, 4).join(':') + '::/64'); r.Note = 'IPv6 is usually one customer / one phone. Ask the ISP for the subscriber of the /64 at that time.'; }
    else { const p = v.split('.'); r['Network (/24)'] = esc(p.slice(0, 3).join('.') + '.0/24'); if (/CGNAT/.test(k)) r.Note = 'Shared address inside the operator network: you need the port and exact time.'; else if (/public/.test(k)) r.Note = 'Indian mobile IPs are shared (NAT): send the ISP the IP with port and date / time (IST).'; }
    return r;
  },
  mnp(v) {
    const raw = String(v).trim(), d = raw.replace(/\D/g, '');
    let n = d; if (/^(91|0)[6-9]\d{9}$/.test(d)) n = d.slice(-10);
    const r = { Value: esc(raw) };
    if (/^[6-9]\d{9}$/.test(n) && !(raw.startsWith('+') && !raw.startsWith('+91'))) {
      r.Number = `<b class="mono">+91 ${n.slice(0, 5)} ${n.slice(5)}</b> <span class="badge good">Valid Indian mobile</span>`;
      r.Series = esc(n.slice(0, 4) + ' / ' + n.slice(0, 5));
      r['Current operator'] = 'Not available offline. A number can be ported (MNP), so the series does not prove the operator. Use the Sanchar Saathi / TRAI buttons, or ask the MNP service provider via the nodal officer.';
    } else if (raw.startsWith('+') || d.length > 10) {
      const c = typeof WReply !== 'undefined' ? WReply.country('+' + d) : '';
      r.Number = `<span class="badge warn">Foreign number</span> ${esc(c || 'Unknown country')}`;
      r.Note = 'Foreign numbers used on Telegram / WhatsApp are often virtual (VoIP) numbers bought online.';
    } else r.Number = '<span class="badge bad">Not a valid mobile number</span>';
    return r;
  },
  imei(v) {
    const d = String(v).replace(/\D/g, ''), r = { Value: esc(v) };
    if (d.length === 14) { let c = 0; for (let i = 0; i <= 9; i++) if (V.luhn(d + i)) { c = i; break; } r.IMEI = `<b class="mono">${d}${c}</b> <span class="badge warn">14 digits – check digit ${c} added</span>`; }
    else if (d.length === 15) r.IMEI = `<b class="mono">${d}</b> ` + (V.luhn(d) ? '<span class="badge good">Valid (check digit OK)</span>' : '<span class="badge bad">Invalid check digit – may be fake / cloned or mistyped</span>');
    else if (d.length === 16) r.IMEI = `<b class="mono">${d}</b> <span class="badge warn">16 digits = IMEISV (software version ${d.slice(14)})</span> → IMEI body ${d.slice(0, 14)}`;
    else { r.IMEI = '<span class="badge bad">IMEI must be 14–16 digits</span>'; return r; }
    r['TAC (model code)'] = `<span class="mono">${d.slice(0, 8)}</span> – same TAC = same make & model`;
    r['Serial'] = `<span class="mono">${d.slice(8, 14)}</span>`;
    if (/^(\d)\1{13}/.test(d) || /^0{8}/.test(d)) r.Note = '<span class="badge bad">Dummy / null IMEI pattern</span>';
    else r.Note = 'Dual-SIM phones have two IMEIs, usually with the same TAC. Send both to the operator for numbers used.';
    return r;
  },
  mac(v) {
    const h = String(v).replace(/[^0-9a-f]/gi, '').toUpperCase(), r = { Value: esc(v) };
    if (h.length !== 12) { r.MAC = '<span class="badge bad">A MAC address has 12 hex digits</span>'; return r; }
    const pr = h.match(/../g), b0 = parseInt(pr[0], 16);
    r.MAC = `<b class="mono">${pr.join(':')}</b>`;
    r['Vendor prefix (OUI)'] = `<span class="mono">${pr.slice(0, 3).join(':')}</span> – use the vendor buttons`;
    r.Kind = (b0 & 1 ? '<span class="badge warn">Multicast / group</span> ' : '') + (b0 & 2 ? '<span class="badge warn">Locally administered – random / private MAC</span> Phones (Android 10+, iOS 14+) make a random MAC per Wi-Fi network, so it will not match the handset’s real MAC.' : '<span class="badge good">Globally unique (burned-in)</span> Belongs to the device maker.');
    return r;
  },
  whois(v) {
    let s = String(v).trim(), r = { Value: esc(s) };
    if (XT.isIP(s)) { r.Type = 'IP address – the WhoIS buttons show the network owner (ISP / hosting).'; return r; }
    s = s.replace(/^[a-z]+:\/\//i, '').replace(/^[^@/]*@/, '').split(/[/?#:]/)[0].toLowerCase().replace(/\.$/, '');
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) { r.Domain = '<span class="badge bad">Not a domain / URL</span>'; return r; }
    const parts = s.split('.'), two = /^(co|gov|nic|ac|org|net|edu|res|firm|gen|ind|com)$/.test(parts[parts.length - 2]) && parts.length > 2;
    const reg = parts.slice(two ? -3 : -2).join('.');
    r.Domain = `<b class="mono">${esc(reg)}</b>${reg !== s ? ` <span class="muted">(host ${esc(s)})</span>` : ''}`;
    const fl = [];
    if (/(^|\.)xn--/.test(s)) fl.push('<span class="badge bad">Punycode (xn--) – may imitate another site with look-alike letters</span>');
    if (/\.(xyz|top|icu|shop|online|site|club|live|buzz|cyou|sbs|cfd|click|link|vip|win|bond|rest|lol|monster|work)$/.test(reg)) fl.push('<span class="badge warn">Cheap TLD often used for fraud sites</span>');
    if (/(sbi|hdfc|icici|axis|kotak|paytm|phonepe|gpay|amazon|flipkart|kyc|refund|rbi|npci|upi|loan|bonus|reward|customer-?care|helpdesk)/.test(s) && !/\.(gov|nic|bank)\.in$|\.bank\.in$/.test(s)) fl.push('<span class="badge warn">Uses a bank / brand / KYC word – check it is the real site</span>');
    if (/\.(gov|nic)\.in$/.test(s)) fl.push('<span class="badge good">Indian government domain</span>');
    r.Flags = fl.join(' ') || '<span class="muted">No obvious warning sign</span>';
    r._q = reg;
    return r;
  },
  /* email header: parse the raw header text */
  header(text) {
    const raw = String(text || '').replace(/\r/g, ''), body = raw.split(/\n\s*\n/)[0];
    const lines = []; body.split('\n').forEach(l => { if (/^[ \t]/.test(l) && lines.length) lines[lines.length - 1] += ' ' + l.trim(); else if (l.trim()) lines.push(l.trim()); });
    const H = []; lines.forEach(l => { const m = l.match(/^([A-Za-z0-9-]+):\s*(.*)$/); if (m) H.push([m[1].toLowerCase(), m[2]]); });
    const get = k => (H.find(h => h[0] === k) || [])[1] || '';
    const ipRx = /\[?((?:\d{1,3}\.){3}\d{1,3}|[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7})\]?/i;
    const hops = H.filter(h => h[0] === 'received').map(([, v]) => {
      const from = (v.match(/from\s+([^\s;]+)/i) || [])[1] || '', by = (v.match(/\bby\s+([^\s;]+)/i) || [])[1] || '';
      const ips = [...v.replace(/\bby\s.*$/i, '').matchAll(new RegExp(ipRx.source, 'gi'))].map(m => m[1]).filter(x => XT.isIP(x));
      const when = (v.split(';').pop() || '').trim(); const t = Date.parse(when.replace(/\s*\(.*\)\s*$/, ''));
      return { from, by, ip: ips.find(x => /public/.test(V.ipKind(x))) || ips[0] || '', when, t: isNaN(t) ? null : t };
    }).reverse(); // oldest first
    const auth = (get('authentication-results') + ' ' + get('arc-authentication-results')).toLowerCase();
    const res = k => (auth.match(new RegExp(k + '=(\\w+)')) || [])[1] || '';
    const xo = get('x-originating-ip').replace(/[\[\]]/g, '') || get('x-sender-ip') || get('x-source-ip');
    const pub = hops.find(h => h.ip && /public/.test(V.ipKind(h.ip)));
    const dom = s => ((String(s).match(/@([A-Za-z0-9.-]+)/) || [])[1] || '').toLowerCase();
    return { from: get('from'), to: get('to'), subject: get('subject'), date: get('date'), msgid: get('message-id'), replyTo: get('reply-to'), returnPath: get('return-path'), xmailer: get('x-mailer') || get('user-agent'),
      spf: res('spf'), dkim: res('dkim'), dmarc: res('dmarc'), origin: xo || (pub && pub.ip) || '', originFrom: xo ? 'X-Originating-IP header' : pub ? 'first public IP in Received lines' : '', hops, dom, n: H.length };
  }
};

PAGE_META.tools = { group: 'Analysis', title: 'Tools', desc: 'Quick checks for IP, mobile (MNP), IMEI, MAC, e-mail header and WhoIS. The check on this page runs offline; the website buttons open the site in a new tab and send it the value.',
  order: [...XT.CATS.map(c => c[0]), 'addlink'], names: { addlink: '➕ Add web link' } };

Pages.tools = function (main) {
  if (!XT.links) { main.innerHTML = '<div class="card muted">Loading tools…</div>'; XT.load().then(() => { if (S.page === 'tools') render(); }); return; }
  const { cur, body } = tabs(main, 'tools', [...XT.all().map(c => [c[0], c[1]]), ['addlink', 'Add web link']], 'Tools', `<button class="btn" id="xtAdd">➕ Add web link</button>`);
  $('#xtAdd', main).onclick = () => { S.xtCat = XT.cat(cur) ? cur : S.xtCat; S.sub.tools = 'addlink'; render(); };
  if (cur === 'addlink') return XT.addView(body);
  XT.toolView(body, cur);
};

XT.siteBtns = function (cat, q) {
  const own = XT.links.filter(l => l.cat === cat), built = XT.SITES[cat] || [];
  const b = (name, u, id) => `<span class="xt-site${id ? ' own' : ''}"><a class="btn"${String(u).includes('{q}') ? '' : ' data-copy="1"'} href="${esc(XT.url(u, q))}" target="_blank" rel="noopener noreferrer" title="${esc(XT.url(u, q))}">${esc(name)} ↗</a>${id ? `<button class="xt-del" data-del="${id}" title="Remove this button">✕</button>` : ''}</span>`;
  return `${built.map(([n, u]) => b(n, u)).join('')}${own.map(l => b(l.name, l.url, l.id)).join('')}`;
};

XT.toolView = function (body, cur) {
  const C = XT.cat(cur), own = !XT.CATS.some(c => c[0] === cur);
  const st = (S.xtIn = S.xtIn || {}), val = st[cur] || '';
  const isHdr = cur === 'email';
  body.innerHTML = `<div class="card xt-head" style="--sc:${C[2]}"><div><h3>${esc(C[1])}</h3><div class="sub">${esc(C[3])}</div></div><button class="btn" id="xtAddHere">➕ Add web link to ${esc(C[1])}</button></div>
    ${own ? '' : `<div class="card"><h3>${isHdr ? 'Paste the full e-mail header' : 'Check'}</h3><div class="sub">${isHdr ? 'Gmail: ⋮ → Show original. Outlook: File → Properties → Internet headers. Paste everything here.' : 'Type or paste one or more values (one per line, or separated by commas). Checked on this computer only.'}</div>
      <textarea id="xtIn" rows="${isHdr ? 9 : 3}" style="width:100%" placeholder="${esc({ ip: '49.36.12.10\n2401:4900:1c2a::1', mnp: '98xxxxxxxx  or  +1 415 xxx xxxx', imei: '35xxxxxxxxxxxxx', mac: 'A4:5E:60:xx:xx:xx', email: 'Received: from …\nFrom: …\nAuthentication-Results: …', whois: 'example.xyz  or  https://sbi-kyc-update.example/login' }[cur] || '')}">${esc(val)}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="xtGo">Check</button>${cur === 'ip' ? '<button class="btn" id="xtNet" title="Sends the IP addresses to free IP-location services (ipwho.is, ipinfo.io, ipapi.co, db-ip.com)">🌐 Fetch location & ISP online</button>' : cur === 'mac' ? '<button class="btn" id="xtMac" title="Sends only the first half (vendor prefix) of each MAC to maclookup.app">🌐 Fetch vendor online</button>' : ''}<button class="btn" id="xtClr">Clear</button></div><div id="xtOut"></div><div id="xtNetOut"></div></div>`}
    <div class="card"><h3>Lookup websites</h3><div class="sub">${own ? 'Your saved buttons for this section.' : 'Opens in a new tab with the first value from the box. Sites that cannot take the value in the link (bulk lookups) get it copied, so just paste it there. Buttons with ✕ are the ones you added.'}</div><div class="xt-sites" id="xtSites"></div></div>`;
  const first = () => { if (isHdr) { const h = XT.header(st[cur] || ''); return h.origin || ''; } const v = XT.vals(st[cur], cur)[0] || ''; return cur === 'whois' ? (XT.whois(v)._q || v) : cur === 'mac' ? v.replace(/[^0-9a-f]/gi, '').replace(/(..)(?=.)/g, '$1:') : cur === 'mnp' ? v.replace(/\D/g, '').slice(-10) : v; };
  const sites = () => { $('#xtSites', body).innerHTML = XT.siteBtns(cur, first()) || '<div class="muted">No buttons yet. Use ➕ Add web link.</div>';
    $$('[data-copy]', body).forEach(a => a.addEventListener('click', () => { const v = isHdr ? (st[cur] || '') : XT.vals(st[cur], cur).join('\n'); if (v && navigator.clipboard) navigator.clipboard.writeText(v).then(() => UI.toast((isHdr ? 'Header' : 'Values') + ' copied – paste them on the website'), () => { }); }));
    $$('[data-del]', body).forEach(b => b.onclick = async () => { const l = XT.links.find(x => x.id === b.dataset.del); if (!UI.confirm(`Remove the "${l.name}" button?`)) return; XT.links = XT.links.filter(x => x.id !== l.id); if (own && !XT.links.some(x => x.cat === cur)) { XT.cats = XT.cats.filter(c => c.id !== cur); S.sub.tools = 'ip'; } await XT.save(); XT.side(); render(); }); };
  $('#xtAddHere', body).onclick = () => { S.xtCat = cur; S.sub.tools = 'addlink'; render(); };
  sites();
  if (own) return;
  const run = () => {
    const out = $('#xtOut', body), text = st[cur] || '';
    if (!text.trim()) { out.innerHTML = ''; sites(); return; }
    if (isHdr) out.innerHTML = XT.hdrHtml(XT.header(text));
    else {
      const vs = XT.vals(text, cur).slice(0, 200), rows = vs.map(v => XT[cur](v));
      const hit = XT.inCase(cur === 'whois' ? rows.map(r => r._q).filter(Boolean) : cur === 'mnp' ? vs.map(v => v.replace(/\D/g, '').slice(-10)) : cur === 'mac' ? [] : vs);
      out.innerHTML = `<div class="xt-res">${rows.map(r => `<div class="xt-r"><dl class="kv">${Object.entries(r).filter(([k]) => k[0] !== '_').map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl></div>`).join('')}</div>`
        + (S.data ? `<div class="xt-case">${hit.length ? `<b>Found in this case (${hit.length}):</b> ${uniq(hit.map(i => `${esc(i.value)} – ${esc(i.label || i.section)}${i.ref ? ' · ' + esc(i.ref) : ''}`)).slice(0, 30).join('<br>')}` : '<span class="muted">Not found in the data of this case.</span>'}</div>` : '');
    }
    sites();
  };
  const ta = $('#xtIn', body); ta.oninput = () => { st[cur] = ta.value; clearTimeout(ta._t); ta._t = setTimeout(sites, 300); };
  $('#xtGo', body).onclick = () => { st[cur] = ta.value; run(); };
  $('#xtClr', body).onclick = () => { st[cur] = ''; ta.value = ''; run(); };
  if (val) run();
  const nb = $('#xtNet', body); if (nb) nb.onclick = () => { st[cur] = ta.value; XT.fetchIPs(XT.vals(st[cur], cur).filter(v => XT.isIP(v)), $('#xtNetOut', body), nb); };
  if (cur === 'ip' && XT.net) XT.netShow($('#xtNetOut', body));
  const mb = $('#xtMac', body); if (mb) mb.onclick = () => { st[cur] = ta.value; XT.fetchMacs(XT.vals(st[cur], cur), $('#xtNetOut', body), mb); };
  if (cur === 'mac' && XT.macNet) XT.macShow($('#xtNetOut', body));
};

/* online MAC vendor - sends only the 6-digit vendor prefix (OUI), never the full MAC */
XT.fetchMacs = async function (macs, out, btn) {
  const ou = uniq(macs.map(m => String(m).replace(/[^0-9a-f]/gi, '').toUpperCase()).filter(h => h.length === 12)).slice(0, 50);
  if (!ou.length) return UI.toast('No valid MAC address in the box');
  if (!navigator.onLine) return UI.toast('This computer is offline');
  if (!XT.macOk && !UI.confirm('This sends the vendor prefix (first 6 digits) of each MAC to maclookup.app to get the maker name. The full MAC is not sent. Continue?')) return;
  XT.macOk = true; btn.disabled = true;
  const res = XT.macNet = XT.macNet || new Map(), cache = {};
  for (let i = 0; i < ou.length; i++) {
    const h = ou[i], pre = h.slice(0, 6); btn.textContent = `Fetching ${i + 1} / ${ou.length}…`;
    if (res.has(h) && !res.get(h).err) continue;
    if (parseInt(h.slice(0, 2), 16) & 2) { res.set(h, { err: 'Random / private MAC – no maker (set by the phone)' }); continue; }
    if (!cache[pre]) {
      let got = null;
      try {
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch('https://api.maclookup.app/v2/macs/' + pre, { signal: ctl.signal, referrerPolicy: 'no-referrer', credentials: 'omit' }); clearTimeout(tm);
        if (r.ok) { const j = await r.json(); got = j.found ? { vendor: j.company, address: j.address, country: j.country, block: j.blockStart ? j.blockStart + (j.blockSize ? ' (' + j.blockSize + ')' : '') : '', updated: j.updated } : { err: 'Prefix not registered (often a random / virtual MAC)' }; }
      } catch (e) { }
      cache[pre] = got || { err: 'No answer (site blocked, limit reached, or no internet)' };
    }
    res.set(h, cache[pre]); XT.macShow(out);
  }
  btn.disabled = false; btn.textContent = '🌐 Fetch vendor online'; XT.macShow(out);
};
XT.macShow = function (out) {
  if (!out || !XT.macNet || !XT.macNet.size) return;
  const R = [...XT.macNet].map(([h, x]) => Object.assign({ mac: h.match(/../g).join(':') }, x));
  out.innerHTML = `<h3 style="margin-top:16px">Vendor details <span class="muted small">(${R.filter(r => !r.err).length} of ${R.length} found)</span></h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>MAC</th><th>Maker / vendor</th><th>Country</th><th>Address</th></tr></thead><tbody>
    ${R.map(r => `<tr><td class="mono">${esc(r.mac)}</td>${r.err ? `<td colspan="3" class="muted">${esc(r.err)}</td>` : `<td><b>${esc(r.vendor || '')}</b></td><td>${esc(r.country || '')}</td><td class="small">${esc(r.address || '')}</td>`}</tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:8px"><button class="btn" id="xtMacCsv">Download CSV</button></div>`;
  $('#xtMacCsv', out).onclick = () => UI.download('mac_lookup_' + today() + '.csv', UI.toCSV(['mac', 'vendor', 'country', 'address', 'err'].map(k => ({ key: k, label: k })), R), 'text/csv');
};

/* online IP details - only when the officer clicks the button; tries several free services */
XT.SRC = [
  ['ipwho.is', ip => `https://ipwho.is/${ip}`, j => j.success === false ? null : { country: j.country, region: j.region, city: j.city, isp: (j.connection || {}).isp, org: (j.connection || {}).org, asn: (j.connection || {}).asn ? 'AS' + j.connection.asn : '', lat: j.latitude, lon: j.longitude, tz: (j.timezone || {}).id, type: j.type }],
  ['ipinfo.io', ip => `https://ipinfo.io/${ip}/json`, j => j.bogon || j.error ? null : { country: j.country, region: j.region, city: j.city, org: String(j.org || '').replace(/^AS\d+\s*/, ''), asn: (String(j.org || '').match(/^AS\d+/) || [''])[0], lat: (j.loc || '').split(',')[0], lon: (j.loc || '').split(',')[1], tz: j.timezone, host: j.hostname }],
  ['ipapi.co', ip => `https://ipapi.co/${ip}/json/`, j => j.error ? null : { country: j.country_name, region: j.region, city: j.city, org: j.org, asn: j.asn, lat: j.latitude, lon: j.longitude, tz: j.timezone }],
  ['db-ip.com', ip => `https://api.db-ip.com/v2/free/${ip}`, j => j.errorCode ? null : { country: j.countryName, region: j.stateProv, city: j.city }]
];
XT.fetchIPs = async function (ips, out, btn) {
  ips = uniq(ips).filter(ip => /public/.test(V.ipKind(ip))).slice(0, 50);
  if (!ips.length) return UI.toast('No public IP address in the box (private / CGNAT IPs cannot be looked up online)');
  if (!navigator.onLine) return UI.toast('This computer is offline');
  if (!XT.netOk && !UI.confirm(`This sends ${ips.length} IP address${ips.length > 1 ? 'es' : ''} to free IP-location websites (ipwho.is, ipinfo.io, ipapi.co, db-ip.com) to get country, city and ISP.\n\nNo other case data is sent. Continue?`)) return;
  XT.netOk = true; btn.disabled = true;
  const res = XT.net = XT.net || new Map();
  for (let i = 0; i < ips.length; i++) {
    const ip = ips[i]; btn.textContent = `Fetching ${i + 1} / ${ips.length}…`;
    if (res.has(ip) && res.get(ip).src) continue;
    let got = null;
    for (const [name, u, map] of XT.SRC) {
      try {
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(u(ip), { signal: ctl.signal, referrerPolicy: 'no-referrer', credentials: 'omit' }); clearTimeout(tm);
        if (!r.ok) continue;
        const m = map(await r.json()); if (m && (m.country || m.isp || m.org)) { got = Object.assign(m, { src: name }); break; }
      } catch (e) { }
    }
    res.set(ip, got || { err: 'No answer (site blocked, limit reached, or no internet)' });
    XT.netShow(out);
  }
  btn.disabled = false; btn.textContent = '🌐 Fetch location & ISP online';
  XT.netShow(out);
};
XT.netShow = function (out) {
  if (!out || !XT.net || !XT.net.size) return;
  const R = [...XT.net].map(([ip, x]) => Object.assign({ ip }, x));
  const ok = R.filter(r => !r.err), isp = groupBy(ok, r => r.isp || r.org || '—'), cty = groupBy(ok, r => [r.city, r.country].filter(Boolean).join(', ') || '—');
  const top = m => [...m].sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([k, v]) => `<span class="badge">${esc(k)} · ${v.length}</span>`).join(' ');
  out.innerHTML = `<h3 style="margin-top:16px">Online details <span class="muted small">(${ok.length} of ${R.length} found)</span></h3>
    ${ok.length > 1 ? `<div class="small" style="margin:6px 0">ISP: ${top(isp)}<br>Place: ${top(cty)}</div>` : ''}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>IP</th><th>Country</th><th>State / region</th><th>City</th><th>ISP / organisation</th><th>ASN</th><th>Lat, Long</th><th>Source</th></tr></thead><tbody>
    ${R.map(r => r.err ? `<tr><td class="mono ipv">${esc(r.ip)}</td><td colspan="7" class="muted">${esc(r.err)}</td></tr>` : `<tr><td class="mono ipv">${esc(r.ip)}</td><td>${esc(r.country || '')}</td><td>${esc(r.region || '')}</td><td>${esc(r.city || '')}</td><td>${esc(r.isp || r.org || '')}${r.isp && r.org && r.org !== r.isp ? `<div class="muted small">${esc(r.org)}</div>` : ''}</td><td class="mono">${esc(r.asn || '')}</td><td class="small">${r.lat && r.lon ? `<a href="https://www.google.com/maps?q=${esc(r.lat)},${esc(r.lon)}" target="_blank" rel="noopener noreferrer">${esc((+r.lat).toFixed(3))}, ${esc((+r.lon).toFixed(3))}</a>` : ''}</td><td class="small muted">${esc(r.src)}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:8px"><button class="btn" id="xtNetCsv">Download CSV</button><span class="muted small">IP location is approximate (city level). For the subscriber, send the IP with port and time to the ISP.</span></div>`;
  $('#xtNetCsv', out).onclick = () => UI.download('ip_lookup_' + today() + '.csv', UI.toCSV(['ip', 'country', 'region', 'city', 'isp', 'org', 'asn', 'lat', 'lon', 'tz', 'src', 'err'].map(k => ({ key: k, label: k })), R), 'text/csv');
};

XT.hdrHtml = function (h) {
  if (!h.n) return '<div class="muted" style="margin-top:10px">No header lines found. Paste the full header (lines like "Received: from …").</div>';
  const badge = v => v ? `<span class="badge ${v === 'pass' ? 'good' : /fail|softfail|none|neutral|temperror|permerror/.test(v) ? 'bad' : 'warn'}">${esc(v)}</span>` : '<span class="muted">not given</span>';
  const fl = [];
  const fd = h.dom(h.from), rd = h.dom(h.replyTo), pd = h.dom(h.returnPath);
  if (rd && fd && rd !== fd) fl.push(`<span class="badge bad">Reply-To (${esc(rd)}) differs from From (${esc(fd)})</span> – replies go to someone else`);
  if (pd && fd && pd !== fd && !pd.endsWith('.' + fd)) fl.push(`<span class="badge warn">Return-Path domain ${esc(pd)} ≠ From domain ${esc(fd)}</span>`);
  if (/fail/.test(h.spf + h.dmarc)) fl.push('<span class="badge bad">SPF / DMARC failed – sender may be spoofed</span>');
  const kv = { From: esc(h.from), To: esc(h.to), Subject: esc(h.subject), Date: esc(h.date), 'Reply-To': esc(h.replyTo), 'Return-Path': esc(h.returnPath), 'Message-ID': `<span class="mono ipv">${esc(h.msgid)}</span>`, 'Sent with': esc(h.xmailer),
    'SPF / DKIM / DMARC': `${badge(h.spf)} ${badge(h.dkim)} ${badge(h.dmarc)}`,
    'Sender IP': h.origin ? `<b class="mono">${esc(h.origin)}</b> <span class="badge ${/public/.test(V.ipKind(h.origin)) ? 'good' : 'warn'}">${esc(V.ipKind(h.origin))}</span> <span class="muted small">from ${esc(h.originFrom)}</span>` : '<span class="muted">Not found – big webmail (Gmail) hides the sender IP; ask the provider for the login IP.</span>',
    Warnings: fl.join('<br>') || '<span class="muted">None found</span>' };
  const hop = h.hops.map((x, i) => { const prev = i && h.hops[i - 1].t, dl = prev && x.t ? Math.round((x.t - prev) / 1000) : null; return `<tr><td>${i + 1}</td><td class="mono ipv">${esc(x.from)}</td><td class="mono ipv">${esc(x.ip)}</td><td class="mono ipv">${esc(x.by)}</td><td class="small">${esc(x.when)}${dl != null ? ` <span class="muted">(+${dl}s)</span>` : ''}</td></tr>`; }).join('');
  return `<div class="xt-res xt-one"><div class="xt-r"><dl class="kv">${Object.entries(kv).filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl></div></div>
    ${hop ? `<h3 style="margin-top:14px">Mail route (first server → last)</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>From</th><th>IP</th><th>By</th><th>Time</th></tr></thead><tbody>${hop}</tbody></table></div>` : ''}`;
};

XT.addView = function (body) {
  const pre = S.xtCat || '';
  body.innerHTML = `<div class="card"><h3>Add web link</h3><div class="sub">Save a lookup website as a new button under one of the sections. Put <b class="mono">{q}</b> in the link where the value should go, e.g. <span class="mono">https://ipinfo.io/{q}</span>. Without {q} the button just opens the site.</div>
    <div class="sop-form">
      <label class="sop-wide">Section<select id="xtCat"><option value="">— choose section —</option>${XT.all().map(c => `<option value="${c[0]}" ${c[0] === pre ? 'selected' : ''}>${esc(c[1])}</option>`).join('')}<option value="_new">➕ New section…</option></select></label>
      <label class="sop-wide" id="xtNewW" hidden>New section name<input id="xtNew" placeholder="e.g. UPI / Crypto / Vehicle"></label>
      <label>Button name<input id="xtName" placeholder="e.g. IPinfo"></label>
      <label>Web link (URL)<input id="xtUrl" placeholder="https://site.com/search?q={q}"></label>
    </div><div class="row"><button class="btn primary" id="xtSave">Save button</button><span class="muted small">Saved in this browser on this computer.</span></div></div>
    <div class="card"><h3>Your saved buttons <span class="muted small">(${XT.links.length})</span></h3>${XT.links.length ? `<div class="sop-list">${XT.links.map(l => { const c = XT.cat(l.cat) || ['', '?', '#64748b']; return `<div class="sop-item" style="--sc:${c[2]}"><span class="sop-kind">${esc(c[1].split(' ')[0])}</span><div class="sop-txt"><b>${esc(l.name)}</b><div class="muted small mono ipv">${esc(l.url)}</div></div><div class="sop-acts"><a class="btn" href="${esc(XT.url(l.url, ''))}" target="_blank" rel="noopener noreferrer">Open ↗</a><button class="btn danger" data-del="${l.id}">✕</button></div></div>`; }).join('')}</div>` : '<div class="muted">None yet.</div>'}</div>`;
  const sel = $('#xtCat', body); sel.onchange = () => { $('#xtNewW', body).hidden = sel.value !== '_new'; };
  $('#xtSave', body).onclick = async () => {
    let cat = sel.value; const name = $('#xtName', body).value.trim(), url = $('#xtUrl', body).value.trim();
    if (!cat) return UI.toast('Choose the section first');
    if (!name || !url) return UI.toast('Give the button a name and a web link');
    if (!/^(https?:\/\/)?[^\s.]+\.[^\s]+$/i.test(url)) return UI.toast('That does not look like a web link');
    if (cat === '_new') {
      const nn = $('#xtNew', body).value.trim(); if (!nn) return UI.toast('Type the new section name');
      const ex = XT.all().find(c => c[1].toLowerCase() === nn.toLowerCase());
      if (ex) cat = ex[0]; else { const pal = ['#14b8a6', '#6366f1', '#f43f5e', '#84cc16', '#0ea5e9', '#a855f7']; cat = 'u' + uid(); XT.cats.push({ id: cat, name: nn, color: pal[XT.cats.length % pal.length] }); }
    }
    XT.links.push({ id: uid(), cat, name, url: /^https?:\/\//i.test(url) ? url : 'https://' + url, added: new Date().toISOString() });
    await XT.save(); XT.side(); UI.toast(`"${name}" added to ${XT.cat(cat)[1]}`); S.xtCat = cat; S.sub.tools = cat; render();
  };
  $$('[data-del]', body).forEach(b => b.onclick = async () => { const l = XT.links.find(x => x.id === b.dataset.del); if (!UI.confirm(`Remove the "${l.name}" button?`)) return; XT.links = XT.links.filter(x => x.id !== l.id); XT.cats = XT.cats.filter(c => XT.links.some(x => x.cat === c.id)); await XT.save(); XT.side(); render(); });
};

/* sidebar: Tools under Analysis, with a drop-down of the tools and Add web link */
(() => {
  const nav = $('#sidebar'), it = $('.nav-item[data-page="tools"]', nav); if (!it) return;
  it.insertAdjacentHTML('beforeend', '<span class="nav-chev" title="Show / hide tools">▾</span>');
  it.insertAdjacentHTML('afterend', '<div class="nav-subs xt-subs"></div>');
  const subs = $('.xt-subs', nav), setOpen = on => { S.xtOpen = on; subs.classList.toggle('open', on); it.classList.toggle('open', on); };
  XT.side = () => {
    subs.innerHTML = XT.all().map(c => `<div class="nav-sub" data-xt="${c[0]}" style="--pc:${c[2]}" title="Tools · ${esc(c[1])}"><i></i><span>${esc(c[1])}</span></div>` + (c[0] === 'whois' && Pages.ifsc ? '<div class="nav-sub" data-ifsc="1" style="--pc:#0ea5e9" title="Bank, branch, district and state for any IFSC"><i></i><span>IFSC Lookup</span></div>' : '')).join('') + '<div class="nav-sub sop-upl xt-upl" data-xt="addlink" title="Save a lookup website as a new button"><span>➕ Add web link</span></div>';
    $$('.nav-sub[data-xt]', subs).forEach(n => n.onclick = () => { if (n.dataset.xt === 'addlink') S.xtCat = S.page === 'tools' && XT.cat(S.sub.tools) ? S.sub.tools : S.xtCat; go('tools', n.dataset.xt); });
    $$('.nav-sub[data-xt]', subs).forEach(n => n.classList.toggle('active', S.page === 'tools' && S.sub.tools === n.dataset.xt));
    const fi = $('.nav-sub[data-ifsc]', subs); if (fi) { fi.onclick = () => go('ifsc'); fi.classList.toggle('active', S.page === 'ifsc'); }
  };
  XT.side(); setOpen(false);
  let loaded = false;
  $('.nav-chev', it).addEventListener('click', e => { e.stopPropagation(); setOpen(!S.xtOpen); });
  it.addEventListener('click', e => { if (e.target.closest('.nav-chev')) return; setOpen(S.page === 'tools' ? !S.xtOpen : true); }, true);
  const orig = render;
  render = function () {
    orig();
    if (!loaded && DB.db) { loaded = true; XT.load().then(() => XT.side()); }
    $$('.nav-sub[data-xt]').forEach(n => n.classList.toggle('active', S.page === 'tools' && S.sub.tools === n.dataset.xt));
    const fi = $('.nav-sub[data-ifsc]'); if (fi) fi.classList.toggle('active', S.page === 'ifsc');
    if (S.page === 'ifsc') it.classList.add('active');
    if ((S.page === 'tools' || S.page === 'ifsc') && !S.xtOpen) setOpen(true);
  };
})();
