/* ipdrplus.js – more IPDR reports: users of an IP (IP-based IPDR), destinations with owner / app / country, VPN-proxy use,
   geo, home / work towers, IMEI & IMSI periods, off periods, common items & possible app calls between targets,
   platform requisition list (own IP + port + time for WhatsApp / Meta / Google …) and the shared watchlist.
   Works for mobile-number, MAC-ID and IP-address based IPDR. Everything runs on this computer. */
'use strict';
const IPX = {
  app: r => r.app || (Tel.portHint(r.dport) || '').split(' – ')[0] || (r.dport ? 'Port ' + r.dport : ''),
  org: r => String(r.dorg || '').replace(/[,/]\s*$/, ''),
  vpn: r => !!(r.vpn && !/^(no|false|0|-)$/i.test(r.vpn)) || Tel.risky(r.dport) || /vpn|proxy|tor\b|remote/i.test((r.pcat || '') + ' ' + (r.app || '')),
  voip: r => [3478, 3479, 3480, 3481].includes(+r.dport) || (+r.dport >= 19302 && +r.dport <= 19309) || /voip|stun|turn|call/i.test((r.pcat || '') + ' ' + (r.pinfo || '')),
  end: r => r.end ? CDRX.ms({ ts: r.end }) : CDRX.ms(r) + (r.dur || 0) * 1000,
  user: r => r.target || r.mac || '',
  span(v) { return { first: v.reduce((a, r) => !a || r.ts < a ? r.ts : a, ''), last: v.reduce((a, r) => r.ts > a ? r.ts : a, '') }; },
  first: x => esc(Tel.dd(x.first)), last: x => esc(Tel.dd(x.last)),
  utc(ts) { const t = CDRX.ms({ ts }); return isNaN(t) ? '' : new Date(t - 5.5 * 3600e3).toISOString().replace('T', ' ').slice(0, 19); }
};

TelUI.TABS.ipdr = [['sum', '📊 Smart OverView'], ['ses', '🔗 Sessions'], ['find', '🔎 Find IP at a time'], ['num', '👥 Users of the IP'], ['dst', '🎯 Destinations, apps & owner'], ['vpn', '🛡 VPN / proxy / remote'],
  ['geo', '🌍 Country & geo'], ['loc', '🏠 Home, Work & Towers'], ['dev', '📱 IMEI & IMSI periods'], ['off', '⏸ Off / unused periods'], ['com', '⚑ Common & app calls'], ['req', '📝 Platform requisition'], ['watch', '👁 Watchlist'], ['time', '🕐 Date & Time'], ['files', '📁 Files']];

TelUI.ipdr_loc = function (el, d) { this.cdr_loc(el, d); };
TelUI.ipdr_dev = function (el, d) { this.cdr_dev(el, d); };
TelUI.ipdr_off = function (el, d) { this.cdr_off(el, d); };
TelUI.ipdr_watch = function (el, d) { this.cdr_watch(el, d); };

/* users of the IP – the key report for IP-address based IPDR (CGNAT: many numbers share one public IP) */
TelUI.ipdr_num = function (el, d) {
  const Q = uniq(d.map(r => r.qip || r.xip).filter(Boolean));
  const U = [...groupBy(d.filter(IPX.user), IPX.user)].map(([n, v]) => { const s = IPX.span(v), ic = (v.find(r => r.icircle) || {}).icircle || '', sc = (v.find(r => r.roam) || {}).roam || '';
    return { n, s: v.length, ips: uniq(v.map(r => r.qip || r.xip).filter(Boolean)), imeis: uniq(v.map(r => r.imei).filter(Boolean)), imsi: (v.find(r => r.imsi) || {}).imsi || '', ic, sc, roam: ic && sc && ic.toUpperCase() !== sc.toUpperCase(), op: (v.find(r => r.iop) || {}).iop || '', vol: Tel.vol(v), apps: uniq(v.map(IPX.app).filter(Boolean)).slice(0, 6), vpn: v.filter(IPX.vpn).length, name: (v.find(r => r.pname) || {}).pname || '', first: s.first, last: s.last, recs: v }; });
  const multiIP = U.filter(u => u.ips.length > 1), roam = U.filter(u => u.roam);
  el.innerHTML = UI.kpis([['Users (numbers / IDs)', fmtNum(U.length), Q.length + ' IP(s) asked', 'c2'], ['Used 2+ of the IPs', fmtNum(multiIP.length), Q.length > 1 ? 'common users' : 'load more IPs to compare', 'c1'], ['Roaming users', fmtNum(roam.length), 'SIM circle ≠ serving circle', 'c5'], ['Used VPN / remote app', fmtNum(U.filter(u => u.vpn).length), '', 'c3'], ['Handsets', fmtNum(uniq(d.map(r => r.imei).filter(Boolean)).length), '', 'c4']])
    + `<div class="card"><h3>Who used the IP(s)</h3><div class="sub">With CGNAT one public IP is shared by hundreds of phones. Use <b>Find IP at a time</b> with the port and exact time from the platform reply to pick the one user; this list helps rank the rest. ⚑ = also in other data of this case.</div><div id="ixU"></div></div>
    <div class="grid g2"><div class="card"><h3>Users by SIM circle</h3><div id="ixC"></div></div><div class="card"><h3>Users by operator</h3><div id="ixO"></div></div></div>
    ${Q.length > 1 ? '<div class="card"><h3>Common and uncommon users across the IPs</h3><div class="sub">Users on several of the asked IPs are the strongest leads; a user on one IP only is uncommon.</div><div id="ixQ"></div></div>' : ''}`;
  Table($('#ixU', el), { rows: U, sortKey: 's', sortDir: -1, exportName: 'ipdr_users', onRow: x => this.recDrawer(x.n, x.recs), columns: [{ key: 'n', label: 'Number / ID', render: x => `<b class="mono">${esc(x.n)}</b> ${Tel.isMob(x.n) ? Tel.alsoB('mobile', x.n) : ''}${x.name ? `<div class="small muted">${esc(x.name)}</div>` : ''}` }, { key: 's', label: 'Sessions', num: true }, { key: 'ips', label: 'IPs', num: true, sortVal: x => x.ips.length, csv: x => x.ips.join(' '), render: x => x.ips.length > 1 ? `<span class="badge warn">${x.ips.length}</span>` : '1' },
    { key: 'imeis', label: 'IMEI', csv: x => x.imeis.join(' '), sortVal: x => x.imeis.length, render: x => `<span class="mono small">${x.imeis.slice(0, 2).map(esc).join('<br>')}</span>${x.imeis.length > 2 ? ' …' : ''}` }, { key: 'ic', label: 'SIM circle', render: x => esc(x.ic) + (x.roam ? ` <span class="badge warn" title="Serving circle ${esc(x.sc)}">roaming</span>` : '') }, { key: 'op', label: 'Operator' },
    { key: 'apps', label: 'Apps', csv: x => x.apps.join(' '), render: x => `<span class="small">${x.apps.map(esc).join(', ')}</span>` }, { key: 'vpn', label: 'VPN', num: true, render: x => x.vpn ? `<span class="badge bad">${x.vpn}</span>` : '' }, { key: 'vol', label: 'Data', num: true, render: x => Tel.bytes(x.vol) }, { key: 'first', label: 'First', render: IPX.first }, { key: 'last', label: 'Last', render: IPX.last }] });
  Charts.hbar($('#ixC', el), [...groupBy(U.filter(u => u.ic), u => u.ic)].map(([k, v]) => ({ label: k, value: v.length, recs: v.flatMap(u => u.recs) })).sort((a, b) => b.value - a.value), { onClick: x => this.recDrawer('SIM circle ' + x.label, x.recs) });
  const ops = [...groupBy(U.filter(u => u.op), u => u.op)].map(([k, v]) => ({ label: k, value: v.length })).sort((a, b) => b.value - a.value); if (ops.length) Charts.donut($('#ixO', el), ops); else $('#ixO', el).innerHTML = '<div class="muted">No operator column.</div>';
  if (Q.length > 1) Table($('#ixQ', el), { rows: U.slice().sort((a, b) => b.ips.length - a.ips.length), sortKey: 'ips', sortDir: -1, exportName: 'ipdr_common_users', onRow: x => this.recDrawer(x.n, x.recs), columns: [{ key: 'n', label: 'Number / ID', render: x => `<b class="mono">${esc(x.n)}</b>` }, { key: 'ips', label: 'Seen on IPs', sortVal: x => x.ips.length, csv: x => x.ips.join(' '), render: x => `<span class="badge ${x.ips.length > 1 ? 'warn' : ''}">${x.ips.length}</span> <span class="mono small">${x.ips.map(esc).join(', ')}</span>` }, { key: 's', label: 'Sessions', num: true }] });
};

/* destinations with owner, domain, app and country */
TelUI.ipdr_dst = function (el, d) {
  const D = [...groupBy(d.filter(r => r.dip), r => r.dip)].map(([ip, v]) => { const s = IPX.span(v), r0 = v.find(r => r.dorg || r.app || r.dcty) || v[0]; return { ip, org: IPX.org(r0), dom: r0.ddom || '', app: IPX.app(r0), cty: r0.dcty || '', ports: uniq(v.map(r => r.dport).filter(Boolean)), users: uniq(v.map(IPX.user)).length, n: v.length, vol: Tel.vol(v), vpn: v.some(IPX.vpn), first: s.first, last: s.last, recs: v }; });
  const A = [...groupBy(d.filter(IPX.app), IPX.app)].map(([k, v]) => ({ label: k, value: v.length, sub: uniq(v.map(IPX.user)).length + ' user(s) · ' + Tel.bytes(Tel.vol(v)), recs: v })).sort((a, b) => b.value - a.value);
  const O = [...groupBy(d.filter(IPX.org), IPX.org)].map(([k, v]) => ({ label: k, value: v.length, sub: uniq(v.map(r => r.dip)).length + ' IPs', recs: v })).sort((a, b) => b.value - a.value);
  el.innerHTML = `<div class="grid g2"><div class="card"><h3>Apps used</h3><div class="sub">From the app / host column, else guessed from the port. Click for sessions.</div><div id="ixA"></div></div><div class="card"><h3>Server owners (ISP / organisation)</h3><div id="ixOr"></div></div></div>
    <div class="card"><h3>Destination servers</h3><div class="sub">Owner, domain and country come from the IPDR file where given; else use Tools › IP Lookup → 🌐 Fetch online. A small company / hosting owner (not Meta / Google) is worth a notice.</div><div id="id1"></div></div>`;
  Charts.hbar($('#ixA', el), A.slice(0, 20), { onClick: x => this.recDrawer('App ' + x.label, x.recs) });
  if (O.length) Charts.hbar($('#ixOr', el), O.slice(0, 20), { onClick: x => this.recDrawer(x.label, x.recs) }); else $('#ixOr', el).innerHTML = '<div class="muted">No owner column in these IPDRs – use IP Lookup.</div>';
  Table($('#id1', el), { rows: D, sortKey: 'n', sortDir: -1, exportName: 'ipdr_destinations', onRow: x => this.recDrawer(x.ip, x.recs), columns: [{ key: 'ip', label: 'Destination IP', render: x => `<span class="mono ipv">${esc(x.ip)}</span> ${Tel.alsoB('ip', x.ip)}${x.vpn ? ' <span class="badge bad">VPN / remote</span>' : ''}` }, { key: 'org', label: 'Owner', render: x => `<span class="small">${esc(x.org)}</span>${x.dom ? `<div class="muted small">${esc(x.dom)}</div>` : ''}`, csv: x => x.org + ' ' + x.dom }, { key: 'app', label: 'App' }, { key: 'cty', label: 'Country' },
    { key: 'ports', label: 'Ports', csv: x => x.ports.join(' '), render: x => x.ports.slice(0, 5).map(p => `<span class="${Tel.risky(p) ? 'badge bad' : 'badge'}" title="${esc(Tel.portHint(p))}">${esc(p)}</span>`).join(' ') }, { key: 'users', label: 'Users', num: true }, { key: 'n', label: 'Sessions', num: true }, { key: 'vol', label: 'Data', num: true, render: x => Tel.bytes(x.vol) }, { key: 'first', label: 'First', render: IPX.first }, { key: 'last', label: 'Last', render: IPX.last }] });
};

/* VPN / proxy / Tor / remote-access use */
TelUI.ipdr_vpn = function (el, d) {
  const V0 = d.filter(IPX.vpn), G = [...groupBy(V0, r => IPX.user(r) + '|' + IPX.app(r))].map(([k, v]) => { const s = IPX.span(v); return { u: IPX.user(v[0]), app: IPX.app(v[0]), org: IPX.org(v[0]), flag: uniq(v.map(r => r.vpn || Tel.portHint(r.dport)).filter(Boolean)).slice(0, 3).join(', '), n: v.length, ips: uniq(v.map(r => r.dip)).length, vol: Tel.vol(v), first: s.first, last: s.last, recs: v }; });
  el.innerHTML = UI.kpis([['VPN / proxy / remote sessions', fmtNum(V0.length), '', 'c1'], ['Users', fmtNum(uniq(V0.map(IPX.user)).length), '', 'c2'], ['Apps / services', fmtNum(uniq(V0.map(IPX.app)).length), '', 'c5']])
    + `<div class="card"><h3>VPN, proxy, Tor and remote-access use</h3><div class="sub">Hiding the real IP or screen-sharing apps (AnyDesk, TeamViewer, RDP) are common in investment, digital-arrest and remote-access frauds. Their time can be matched with the victim's complaint.</div><div id="ixV"></div></div>`;
  if (!G.length) { $('#ixV', el).innerHTML = '<div class="muted">No VPN / proxy / remote-access session found.</div>'; return; }
  Table($('#ixV', el), { rows: G, sortKey: 'n', sortDir: -1, exportName: 'ipdr_vpn', onRow: x => this.recDrawer(x.u + ' · ' + x.app, x.recs), columns: [{ key: 'u', label: 'Number / ID', render: x => `<b class="mono">${esc(x.u)}</b>` }, { key: 'app', label: 'App / service' }, { key: 'flag', label: 'Flag', render: x => `<span class="badge bad">${esc(x.flag || 'VPN')}</span>` }, { key: 'org', label: 'Server owner', render: x => `<span class="small">${esc(x.org)}</span>` }, { key: 'n', label: 'Sessions', num: true }, { key: 'ips', label: 'Server IPs', num: true }, { key: 'vol', label: 'Data', num: true, render: x => Tel.bytes(x.vol) }, { key: 'first', label: 'First', render: IPX.first }, { key: 'last', label: 'Last', render: IPX.last }] });
};

/* countries of the servers + where the phone was */
TelUI.ipdr_geo = function (el, d) {
  const C = [...groupBy(d.filter(r => r.dcty), r => r.dcty)].map(([k, v]) => ({ label: k, value: v.length, sub: uniq(v.map(r => r.dip)).length + ' IPs · ' + uniq(v.map(IPX.user)).length + ' user(s)', recs: v })).sort((a, b) => b.value - a.value);
  const F = C.filter(c => !/^india$/i.test(c.label));
  const T = CDRX.towers(CDRX.sorted(d)), R = [...groupBy(d.filter(r => r.roam), r => String(r.roam).toUpperCase())].map(([k, v]) => ({ label: k, value: v.length, sub: uniq(v.map(IPX.user)).length + ' user(s)', recs: v })).sort((a, b) => b.value - a.value);
  el.innerHTML = UI.kpis([['Server countries', fmtNum(C.length), '', 'c2'], ['Foreign-server sessions', fmtNum(sum(F, c => c.value)), F.slice(0, 3).map(c => c.label).join(', '), 'c1'], ['Towers', fmtNum(T.length), '', 'c5'], ['Serving circles', fmtNum(R.length), '', 'c3']])
    + `<div class="grid g2"><div class="card"><h3>Server country</h3><div class="sub">Foreign servers other than big platforms (Meta, Google, Apple) – e.g. Chinese / Cambodian app servers – point to scam apps.</div><div id="ixG1"></div></div><div class="card"><h3>Serving circle (where the phone was)</h3><div id="ixG2"></div></div></div>
    <div class="card"><h3>Towers with map</h3><div id="ixG3"></div></div>`;
  if (C.length) Charts.hbar($('#ixG1', el), C.slice(0, 20), { onClick: x => this.recDrawer('Country ' + x.label, x.recs) }); else $('#ixG1', el).innerHTML = '<div class="muted">No country column – use IP Lookup → Fetch online.</div>';
  Charts.hbar($('#ixG2', el), R, { onClick: x => this.recDrawer(x.label, x.recs) });
  Table($('#ixG3', el), { rows: T, sortKey: 'n', sortDir: -1, exportName: 'ipdr_towers', onRow: x => this.recDrawer(x.addr || x.t, x.recs), columns: [{ key: 't', label: 'Tower', render: x => `<span class="small">${esc(x.addr || x.t)}</span>${CDRX.map(x.lat, x.lon)}<div class="muted small mono">${esc(x.t)}</div>` }, { key: 'roam', label: 'Circle' }, { key: 'n', label: 'Sessions', num: true }, { key: 'days', label: 'Days', num: true }, { key: 'first', label: 'First', render: IPX.first }, { key: 'last', label: 'Last', render: IPX.last }] });
};

/* common items between users / targets, and possible app calls between them */
TelUI.ipdr_com = function (el, d) {
  const ofU = (key, min = 2) => [...groupBy(d.filter(key), key)].map(([k, v]) => ({ k, u: uniq(v.map(IPX.user)), n: v.length, recs: v })).filter(x => x.u.length >= min).sort((a, b) => b.u.length - a.u.length);
  const big = /meta|facebook|google|apple|akamai|amazon|microsoft|cloudflare|whatsapp|instagram|youtube|netflix|bharti|airtel|jio|reliance|vodafone|idea|bsnl|tata|truecaller|snapchat|telegram|x corp|twitter/i;
  const D = ofU(r => r.dip).filter(x => !big.test(IPX.org(x.recs[0]))), I = ofU(r => r.imei), Tw = ofU(Tel.tower);
  const P = [], v = d.filter(IPX.voip).map(r => [CDRX.ms(r), IPX.end(r), r]).sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < v.length && P.length < 3000; i++) for (let j = i + 1; j < v.length && v[j][0] - v[i][0] <= 60e3; j++) { const a = v[i][2], b = v[j][2]; if (IPX.user(a) === IPX.user(b) || a.dip !== b.dip) continue; P.push({ pair: [IPX.user(a), IPX.user(b)].sort().join(' ↔ '), ip: a.dip, port: a.dport, ta: a.ts, tb: b.ts, app: IPX.app(a), recs: [a, b] }); }
  const PP = [...groupBy(P, x => x.pair)].map(([k, w]) => ({ k, n: w.length, days: uniq(w.map(x => x.ta.slice(0, 10))).length, apps: uniq(w.map(x => x.app)).join(', '), first: w[0].ta, last: w[w.length - 1].ta, recs: w.flatMap(x => x.recs) })).sort((a, b) => b.n - a.n);
  el.innerHTML = UI.kpis([['Possible app calls between users', fmtNum(PP.length), 'same call server, start within 1 min', 'c1'], ['Shared servers (not big platforms)', fmtNum(D.length), '', 'c2'], ['Shared handsets', fmtNum(I.length), '', 'c5'], ['Shared towers', fmtNum(Tw.length), '', 'c3']])
    + `<div class="card cx-hot"><h3>Possible WhatsApp / internet calls between users</h3><div class="sub">Two users reaching the same voice-call (STUN / VoIP) server and starting within one minute were probably on a call with each other – this finds the "B-party" of internet calls.</div><div id="ixP"></div></div>
    <div class="card"><h3>Servers used by 2+ users (excluding Meta, Google, Apple, Amazon, telecom operators …)</h3><div class="sub">A small shared server = same scam app / panel / gang.</div><div id="ixD"></div></div>
    <div class="grid g2"><div class="card"><h3>Handsets used by 2+ numbers</h3><div id="ixI"></div></div><div class="card"><h3>Towers shared by 2+ users</h3><div id="ixT"></div></div></div>`;
  const uc = { key: 'u', label: 'Users', sortVal: x => x.u.length, csv: x => x.u.join(' '), render: x => `<span class="badge warn">${x.u.length}</span> <span class="mono small">${x.u.slice(0, 6).map(esc).join(', ')}${x.u.length > 6 ? ' …' : ''}</span>` };
  if (PP.length) Table($('#ixP', el), { rows: PP, sortKey: 'n', sortDir: -1, exportName: 'ipdr_app_calls', onRow: x => this.recDrawer(x.k, x.recs), columns: [{ key: 'k', label: 'Users', render: x => `<b class="mono">${esc(x.k)}</b>` }, CX.col(x => x.k.split(' ↔ ')), { key: 'n', label: 'Calls', num: true }, { key: 'days', label: 'Days', num: true }, { key: 'apps', label: 'App' }, { key: 'first', label: 'First', render: x => esc(Tel.dd(x.first)) }, { key: 'last', label: 'Last', render: x => esc(Tel.dd(x.last)) }] }); else $('#ixP', el).innerHTML = '<div class="muted">No matching call sessions (needs IPDR of two or more users, or an IP-based IPDR).</div>';
  if (D.length) Table($('#ixD', el), { rows: D, sortKey: 'u', sortDir: -1, exportName: 'ipdr_shared_servers', onRow: x => this.recDrawer(x.k, x.recs), columns: [{ key: 'k', label: 'Server IP', render: x => `<span class="mono ipv">${esc(x.k)}</span>` }, { key: 'org', label: 'Owner', sortVal: x => IPX.org(x.recs[0]), csv: x => IPX.org(x.recs[0]), render: x => `<span class="small">${esc(IPX.org(x.recs[0]))}</span>` }, uc, CX.col(x => [x.k, ...x.u]), { key: 'n', label: 'Sessions', num: true }] }); else $('#ixD', el).innerHTML = '<div class="muted">None.</div>';
  if (I.length) Table($('#ixI', el), { rows: I, sortKey: 'u', sortDir: -1, pageSize: 10, exportName: 'ipdr_shared_imei', onRow: x => this.recDrawer(x.k, x.recs), columns: [{ key: 'k', label: 'IMEI', render: x => `<span class="mono">${esc(x.k)}</span>` }, uc, CX.col(x => [x.k, ...x.u])] }); else $('#ixI', el).innerHTML = '<div class="muted">None.</div>';
  if (Tw.length) Table($('#ixT', el), { rows: Tw, sortKey: 'u', sortDir: -1, pageSize: 10, exportName: 'ipdr_shared_towers', onRow: x => this.recDrawer(x.k, x.recs), columns: [{ key: 'k', label: 'Tower', render: x => `<span class="small">${esc(x.recs.find(r => r.addr)?.addr || x.k)}</span>` }, uc, CX.col(x => [x.k, ...x.u])] }); else $('#ixT', el).innerHTML = '<div class="muted">None.</div>';
};

/* list for a notice to the platform: the user's own public IP + port + time for one app */
TelUI.ipdr_req = function (el, d) {
  const st = S.ipReq = S.ipReq || { u: '', app: '' };
  const users = [...groupBy(d.filter(IPX.user), IPX.user)].sort((a, b) => b[1].length - a[1].length).map(x => x[0]);
  if (!users.includes(st.u)) st.u = users[0] || '';
  const mine = d.filter(r => IPX.user(r) === st.u), apps = [...groupBy(mine.filter(IPX.app), IPX.app)].sort((a, b) => b[1].length - a[1].length).map(x => x[0]);
  if (st.app && !apps.includes(st.app)) st.app = '';
  const R = CDRX.sorted(mine.filter(r => (!st.app || IPX.app(r) === st.app) && (r.xip || r.pip))).slice(0, 500);
  el.innerHTML = `<div class="card"><h3>Platform requisition – IP, port and time</h3><div class="sub">To find the account on WhatsApp / Meta / Google / Telegram / a bank app, the platform needs the user's own public IP + port + exact time. Pick the number and the app; copy the list into the notice (Case File & Notices). UTC is given as platforms log in UTC.</div>
    <div class="row" style="margin:8px 0;gap:8px"><label class="small">Number / ID <select id="ixRu">${users.slice(0, 500).map(u => `<option${u === st.u ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select></label><label class="small">App <select id="ixRa"><option value="">All apps</option>${apps.map(a => `<option${a === st.app ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></label><button class="btn primary" id="ixRc">📋 Copy list for notice</button></div><div id="ixR"></div></div>`;
  $('#ixRu', el).onchange = e => { st.u = e.target.value; st.app = ''; this.ipdr_req(el, d); }; $('#ixRa', el).onchange = e => { st.app = e.target.value; this.ipdr_req(el, d); };
  const rows = R.map(r => ({ app: IPX.app(r), ip: r.xip || r.pip, port: r.xport || r.pport, dip: r.dip, dport: r.dport, ist: r.ts, end: r.end || '', utc: IPX.utc(r.ts), recs: [r] }));
  $('#ixRc', el).onclick = () => { const t = `Number / ID: ${st.u}${st.app ? ' · App: ' + st.app : ''}\nS.No | Public IP | Port | Destination IP:Port | Start (IST) | Start (UTC) | End (IST)\n` + rows.map((x, i) => `${i + 1} | ${x.ip} | ${x.port} | ${x.dip}:${x.dport} | ${Tel.dd(x.ist)} | ${x.utc} | ${Tel.dd(x.end)}`).join('\n'); navigator.clipboard && navigator.clipboard.writeText(t).then(() => UI.toast(rows.length + ' rows copied'), () => UI.toast('Copy blocked – use CSV')); };
  Table($('#ixR', el), { rows, sortKey: 'ist', exportName: 'ipdr_requisition', pageSize: 50, onRow: x => this.recDrawer(x.ip + ':' + x.port, x.recs), columns: [{ key: 'app', label: 'App' }, { key: 'ip', label: 'Public IP', render: x => `<span class="mono ipv">${esc(x.ip)}</span>` }, { key: 'port', label: 'Port' }, { key: 'dip', label: 'Destination', render: x => `<span class="mono small">${esc(x.dip)}:${esc(x.dport)}</span>` }, { key: 'ist', label: 'Start (IST)', render: x => esc(Tel.dd(x.ist)) }, { key: 'utc', label: 'Start (UTC)' }, { key: 'end', label: 'End (IST)', render: x => esc(Tel.dd(x.end)) }] });
};

/* more lines in the IPDR overview */
const _ipSum = TelUI.ipdr_sum;
TelUI.ipdr_sum = function (el, d) {
  _ipSum.call(this, el, d);
  const f = [], b = s => `<b>${esc(s)}</b>`;
  try {
    const U = uniq(d.map(IPX.user).filter(Boolean)), Q = uniq(d.map(r => r.qip).filter(Boolean));
    if (Q.length) f.push(`IP-based IPDR: ${b(Q.length + ' asked IP(s)')} used by ${b(U.length + ' numbers')} – see Users of the IP, then Find IP at a time with the platform's port & time.`);
    const vp = d.filter(IPX.vpn); if (vp.length) f.push(`${b(vp.length + ' VPN / proxy / remote sessions')} by ${uniq(vp.map(IPX.user)).length} user(s) – see VPN / proxy / remote.`);
    const fc = uniq(d.map(r => r.dcty).filter(c => c && !/^india$/i.test(c))); if (fc.length) f.push(`Servers in ${b(fc.length + ' foreign countries')}: ${fc.slice(0, 6).map(esc).join(', ')}.`);
    const ap = [...groupBy(d.filter(r => r.app), r => r.app)].sort((a, c) => c[1].length - a[1].length).slice(0, 5); if (ap.length) f.push(`Top apps: ${ap.map(([k, v]) => b(k) + ' ' + fmtNum(v.length)).join(', ')}.`);
    for (const [t, v] of CDRX.byT(d)) { if (!t || U.length > 5) break; const h = CDRX.home(v); if (h.home) f.push(`${b(t)}: night location ${b(h.home.addr || h.home.t)} – see Home, Work & Towers.`); }
  } catch (e) { console.error(e); }
  if (f.length) el.insertAdjacentHTML('afterbegin', this.insights(f).replace('Key findings', 'More findings'));
};
