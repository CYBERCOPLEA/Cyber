/* crossmatch.js – Cross-match: pick 2, 3 or more numbers / files from the CDR, IPDR, TDR and SMS of this case and see
   everything they share – mobile, B-party, IMEI, IMSI, MAC, cell ID, address, lat-long, SMS sender, IPs, ports, apps,
   websites – with which number / file it was found in, and the pairs that share the most. Runs on this computer only. */
'use strict';
const XM = {
  BIG: /meta|facebook|google|apple|akamai|amazon|microsoft|cloudflare|whatsapp|instagram|youtube|netflix|bharti|airtel|jio|reliance|vodafone|idea|bsnl|tata|truecaller|snapchat|telegram|x corp|twitter/i,
  KC: { CDR: '#3b82f6', IPDR: '#06b6d4', TDR: '#f97316', SMS: '#ec4899' },
  _h: new Map(),
  hdr(o) { let x = this._h.get(o); if (x === undefined) { const h = Tel.hdrInfo(o); x = h ? h.ent : o.replace(/^[A-Z]{2}-/, '').replace(/-[A-Z]$/, ''); this._h.set(o, x); } return x; },
  /* id, label, icon, on by default, value(s) of a record */
  F: [
    ['mob', 'Mobile number (A / B party)', '📱', 1, r => { const a = []; if (Tel.isMob(r.target)) a.push(r.target); if (r.other && Tel.isMob(r.other)) a.push(r.other); return a; }],
    ['bp', 'Other B-party (landline / service / foreign)', '☎', 1, r => r.other && !/[A-Z]/.test(r.other) && !Tel.isMob(r.other) && String(r.other).replace(/\D/g, '').length >= 5 ? r.other : ''],
    ['imei', 'IMEI', '📲', 1, r => r.imei && !/^0+$/.test(r.imei) ? r.imei : ''],
    ['imsi', 'IMSI', '💳', 1, r => r.imsi || ''],
    ['mac', 'MAC ID', '🖧', 1, r => r.mac || ''],
    ['cell', 'Cell ID', '📡', 1, r => r.cell || ''],
    ['addr', 'Tower address', '🏠', 0, r => r.addr || ''],
    ['ll', 'Latitude-Longitude', '📍', 1, r => r.lat && r.lon ? (+r.lat).toFixed(3) + ', ' + (+r.lon).toFixed(3) : ''],
    ['sms', 'SMS sender (bank, courier, service…)', '✉', 1, r => r.other && /[A-Z]/.test(r.other) ? XM.hdr(r.other) : ''],
    ['xip', 'Public IP', '🌐', 1, r => r.xip || ''],
    ['pip', 'Source / private IP', '🔌', 0, r => r.pip || ''],
    ['pport', 'Source port', '🔢', 0, r => r.pport || ''],
    ['dip', 'Destination IP', '🎯', 1, r => r.dip && !(XM.st().big && XM.BIG.test(IPX.org(r))) ? r.dip : ''],
    ['dport', 'Destination port', '🚪', 0, r => r.dport && !(XM.st().big && /^(80|443|53|8080)$/.test(r.dport)) ? r.dport : ''],
    ['app', 'App / service used', '🧩', 1, r => r.kind === 'IPDR' ? IPX.app(r) : ''],
    ['dom', 'Website / domain', '🔗', 1, r => r.ddom && !(XM.st().big && XM.BIG.test(r.ddom)) ? r.ddom : '']
  ],
  NB: [['any', 'Any field'], ['mob', 'Mobile / B-party'], ['loc', 'Location (cell / address)'], ['ip', 'IP address'], ['imei', 'IMEI / IMSI / MAC'], ['app', 'App / website']],
  st() { const s = S.xm = S.xm || {}; if (!s.f) s.f = this.F.filter(f => f[3]).map(f => f[0]); if (!s.min) s.min = 2; if (s.big === undefined) s.big = true; if (s._case !== S.caseId) { s._case = S.caseId; s.sel = null; s.q = ''; s.ff = ''; } return s; },
  side: r => r.kind === 'TDR' ? 'TDR|' + r._src : r.kind + '|' + (r.target || r.mac || ''),
  sname(k) { const [K, id] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)]; if (K !== 'TDR') return id; return id.replace(/^.*›\s*/, '').replace(/\.(xlsx?|csv|txt)$/i, ''); },
  sid: k => k.slice(k.indexOf('|') + 1),
  chip(k, n) { const K = k.slice(0, k.indexOf('|')), id = this.sname(k); return `<span class="xm-s" style="--kc:${this.KC[K] || '#64748b'}"><i>${K}</i><span class="mono">${esc(id)}</span>${K !== 'TDR' ? TSC.opb(id) : ''}${n != null ? `<b>${fmtNum(n)}</b>` : ''}</span>`; },
  recs() { const t = TSC.tm(); let d = Tel.all().filter(r => r.kind); if (t.from || t.to) d = d.filter(r => { const x = String(r.ts || '').slice(0, 10); return (!t.from || x >= t.from) && (!t.to || x <= t.to); }); return d; },
  sides() { return Analysis.cached('tel:xmsides', () => { const m = new Map(); for (const r of this.recs()) { const k = this.side(r); if (k.endsWith('|')) continue; m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); }); },
  narrow(r, how, q) {
    if (!q) return true; const has = v => v && String(v).toLowerCase().includes(q);
    if (how === 'mob') return has(r.target) || has(r.other);
    if (how === 'loc') return has(r.cell) || has(r.addr) || has(r.roam);
    if (how === 'ip') return has(r.xip) || has(r.pip) || has(r.dip) || has(r.qip);
    if (how === 'imei') return has(r.imei) || has(r.imsi) || has(r.mac);
    if (how === 'app') return has(r.app) || has(r.ddom) || has(r.dorg) || has(IPX.app(r));
    return has(r.target) || has(r.other) || has(r.cell) || has(r.addr) || has(r.imei) || has(r.imsi) || has(r.mac) || has(r.xip) || has(r.pip) || has(r.dip) || has(r.ddom) || has(r.app);
  },
  run() {
    const s = this.st(), sel = new Set(s.sel || this.sides().map(x => x[0])), F = this.F.filter(f => s.f.includes(f[0])), q = (s.q || '').trim().toLowerCase();
    const sig = [[...sel].sort().join(','), s.f.join(','), s.big, s.qh, q].join('#');
    return Analysis.cached('tel:xm:' + sig.length + ':' + this.hash(sig), () => {
      const M = new Map();
      for (const r of this.recs()) {
        const k = this.side(r); if (!sel.has(k) || !this.narrow(r, s.qh, q)) continue;
        for (const f of F) { let v = f[4](r); if (!v) continue; if (!Array.isArray(v)) v = [v];
          for (const x of v) { const key = f[0] + '\u0001' + x; let o = M.get(key); if (!o) M.set(key, o = { f: f[0], v: x, by: new Map(), n: 0, first: r.ts, last: r.ts });
            o.by.set(k, (o.by.get(k) || 0) + 1); o.n++; if (r.ts < o.first) o.first = r.ts; if (r.ts > o.last) o.last = r.ts; } }
      }
      const out = []; for (const o of M.values()) if (o.by.size >= 2 && new Set([...o.by.keys()].map(XM.sid)).size >= 2) { o.sN = o.by.size; o.sides = [...o.by].sort((a, b) => b[1] - a[1]); out.push(o); }
      return out;
    });
  },
  hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; },
  info(o) {
    const op = n => TSC.op(n) ? `<span class="opb" style="--oc:${TSC.OPC[TSC.op(n)]}">${TSC.op(n)}</span>` : '';
    if (o.f === 'mob') return Tel.alsoB('mobile', o.v);
    if (o.f === 'imei') return `<span class="small muted">TAC ${esc(o.v.slice(0, 8))}</span> ` + Tel.alsoB('imei', o.v);
    if (o.f === 'imsi') { const m = TSC.mncOp(o.v); return m ? `<span class="opb" style="--oc:${TSC.OPC[m]}">${m}</span>` : `<span class="small muted">MCC-MNC ${esc(o.v.slice(0, 5))}</span>`; }
    if (o.f === 'll') return CDRX.map(...o.v.split(', '));
    if (o.f === 'xip' || o.f === 'pip') return Tel.alsoB('ip', o.v);
    return '';
  },
  /* records behind one common value, from the chosen numbers / files */
  recsOf(o, only) { const s = this.st(), sel = new Set(only || s.sel || this.sides().map(x => x[0])), f = this.F.find(x => x[0] === o.f), q = (s.q || '').trim().toLowerCase();
    return this.recs().filter(r => sel.has(this.side(r)) && this.narrow(r, s.qh, q) && [].concat(f[4](r) || []).includes(o.v)); }
};

TelUI.xm_view = function (el) {
  const s = XM.st(), SD = XM.sides(), sel = new Set(s.sel || SD.map(x => x[0])), FL = Object.fromEntries(XM.F.map(f => [f[0], f]));
  const kinds = uniq(SD.map(x => x[0].split('|')[0]));
  el.innerHTML = `<div class="card xm-pick"><h3>🔀 Cross-match – what do these numbers / files share?</h3>
    <div class="sub">Tick <b>2, 3 or more</b> numbers (CDR / IPDR / SMS) or tower dumps (TDR) from this case. Every common IMEI, IMSI, MAC, mobile, B-party, cell ID, lat-long, SMS sender, IP, port, app and website is listed with <b>which number / file it was found in</b>. Works across CDR ↔ IPDR ↔ TDR ↔ SMS.</div>
    <div class="xm-bar"><input id="xmF" placeholder="Find a number / file…" value="${esc(s.find || '')}">
      <button class="btn sm" data-xa="all">All (${SD.length})</button><button class="btn sm" data-xa="none">None</button>${kinds.map(K => `<button class="btn sm" data-xa="k:${K}" style="border-color:${XM.KC[K]}">Only ${K}</button>`).join('')}
      <span class="xm-cnt"><b>${sel.size}</b> chosen</span></div>
    <div class="xm-sides">${SD.filter(([k]) => !s.find || k.toLowerCase().includes(s.find.toLowerCase()) || XM.sname(k).toLowerCase().includes(s.find.toLowerCase())).slice(0, 400).map(([k, n]) => `<label class="xm-sd${sel.has(k) ? ' on' : ''}"><input type="checkbox" data-xs="${esc(k)}"${sel.has(k) ? ' checked' : ''}>${XM.chip(k, n)}</label>`).join('')}${SD.length > 400 ? '<span class="muted small">… type in Find to see more</span>' : ''}</div>
    <div class="xm-bar"><span class="xm-l">Match on</span>${XM.F.map(f => `<label class="xm-f${s.f.includes(f[0]) ? ' on' : ''}"><input type="checkbox" data-xf="${f[0]}"${s.f.includes(f[0]) ? ' checked' : ''}>${f[2]} ${esc(f[1])}</label>`).join('')}</div>
    <div class="xm-bar"><span class="xm-l">Only records where</span><select id="xmQH">${XM.NB.map(([v, l]) => `<option value="${v}"${(s.qh || 'any') === v ? ' selected' : ''}>${l}</option>`).join('')}</select><input id="xmQ" placeholder="contains… e.g. a B-party, Noida, 49.36., an IMEI" value="${esc(s.q || '')}">
      <span class="xm-l">Shared by at least</span><select id="xmMin">${[2, 3, 4, 5, 10].map(n => `<option${s.min === n ? ' selected' : ''} value="${n}">${n} numbers / files</option>`).join('')}</select>
      <label class="xm-f${s.big ? ' on' : ''}"><input type="checkbox" id="xmBig"${s.big ? ' checked' : ''}>Skip big platforms &amp; common ports (Google, Meta, Jio servers, 443…)</label>
      <button class="btn sm primary" id="xmGo">🔀 Cross-match</button></div></div><div id="xmOut"><div class="muted">Working…</div></div>`;
  const again = () => TelUI.xm_view(el);
  $$('[data-xs]', el).forEach(c => c.onchange = () => { const S2 = new Set(s.sel || SD.map(x => x[0])); c.checked ? S2.add(c.dataset.xs) : S2.delete(c.dataset.xs); s.sel = [...S2]; c.closest('.xm-sd').classList.toggle('on', c.checked); $('.xm-cnt b', el).textContent = S2.size; });
  $$('[data-xa]', el).forEach(b => b.onclick = () => { const a = b.dataset.xa; s.sel = a === 'all' ? null : a === 'none' ? [] : SD.filter(x => x[0].startsWith(a.slice(2) + '|')).map(x => x[0]); again(); });
  $$('[data-xf]', el).forEach(c => c.onchange = () => { s.f = $$('[data-xf]', el).filter(x => x.checked).map(x => x.dataset.xf); c.closest('.xm-f').classList.toggle('on', c.checked); });
  $('#xmF', el).onkeydown = e => { if (e.key === 'Enter') { s.find = e.target.value.trim(); again(); } };
  $('#xmF', el).onchange = e => { s.find = e.target.value.trim(); again(); };
  const go = () => { s.q = $('#xmQ', el).value.trim(); s.qh = $('#xmQH', el).value; s.min = +$('#xmMin', el).value; s.big = $('#xmBig', el).checked; s.ff = ''; again(); };
  $('#xmGo', el).onclick = go; $('#xmQ', el).onkeydown = e => { if (e.key === 'Enter') go(); };
  setTimeout(() => { try { TelUI.xm_out($('#xmOut', el), FL); } catch (e) { console.error(e); $('#xmOut', el).innerHTML = `<div class="card err">Error: ${esc(e.message)}</div>`; } }, 30);
};
TelUI.xm_out = function (out, FL) {
  const s = XM.st(), sel = s.sel || XM.sides().map(x => x[0]);
  if (sel.length < 2) { out.innerHTML = '<div class="card muted">Tick at least two numbers / files above.</div>'; return; }
  if (!s.f.length) { out.innerHTML = '<div class="card muted">Tick at least one field under “Match on”.</div>'; return; }
  const all = XM.run().filter(o => o.sN >= s.min), cnt = f => all.filter(o => o.f === f).length, rows = s.ff ? all.filter(o => o.f === s.ff) : all;
  /* pairs that share the most */
  const P = new Map(); for (const o of all) { const k = o.sides.map(x => x[0]); if (k.length > 30) continue; for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { if (XM.sid(k[i]) === XM.sid(k[j])) continue; const a = k[i] < k[j] ? k[i] + '\u0002' + k[j] : k[j] + '\u0002' + k[i]; let p = P.get(a); if (!p) P.set(a, p = { a: a.split('\u0002')[0], b: a.split('\u0002')[1], n: 0, by: {} }); p.n++; p.by[o.f] = (p.by[o.f] || 0) + 1; } }
  const PP = [...P.values()].sort((a, b) => b.n - a.n).slice(0, 500);
  out.innerHTML = UI.kpis([['Numbers / files compared', fmtNum(sel.length), '', 'c5'], ['Common items', fmtNum(all.length), 'shared by ' + s.min + '+', 'c2'], ['Linked pairs', fmtNum(P.size), 'share at least one item', 'c1'], ['Top pair shares', PP[0] ? fmtNum(PP[0].n) : '0', PP[0] ? XM.sname(PP[0].a) + ' ↔ ' + XM.sname(PP[0].b) : '', 'c3']])
    + `<div class="card"><h3>Common items by type</h3><div class="sub">Click a box to list only that type. Hover a row for details, click it for every record.</div><div class="xm-ft">${[['', 'All', '⚑', all.length], ...s.f.map(f => [f, FL[f][1], FL[f][2], cnt(f)])].map(([f, l, i, n]) => `<button class="xm-fb${(s.ff || '') === f ? ' on' : ''}${n ? '' : ' zero'}" data-xff="${f}"><span>${i}</span><b>${fmtNum(n)}</b><small>${esc(l)}</small></button>`).join('')}</div><div id="xmT"></div></div>
    <div class="card"><h3>🤝 Pairs that share the most</h3><div class="sub">Each row is two numbers / files and how many items they have in common. Click a row to cross-match only those two.</div><div id="xmP"></div></div>`;
  $$('[data-xff]', out).forEach(b => b.onclick = () => { s.ff = b.dataset.xff; TelUI.xm_out(out, FL); });
  Table($('#xmT', out), { rows, sortKey: 'sN', sortDir: -1, pageSize: 25, exportName: 'cross_match', onRow: o => this.recDrawer(FL[o.f][1] + ' · ' + o.v, XM.recsOf(o)), columns: [
    { key: 'f', label: 'Type', render: o => `<span class="badge">${FL[o.f][2]} ${esc(FL[o.f][1])}</span>`, csv: o => FL[o.f][1] },
    { key: 'v', label: 'Common item', render: o => `<b class="mono">${esc(o.v)}</b> ${XM.info(o)}` },
    { key: 'sN', label: 'Shared by', num: true, render: o => `<span class="badge ${o.sN > 2 ? 'bad' : 'warn'}">${o.sN}</span>` },
    { key: 'sides', label: 'Found in (records)', sortVal: o => o.sN, csv: o => o.sides.map(([k, n]) => k.replace('|', ' ') + ' (' + n + ')').join('; '), render: o => `<div class="xm-in">${o.sides.slice(0, 6).map(([k, n]) => XM.chip(k, n)).join('')}${o.sides.length > 6 ? `<span class="muted small">+${o.sides.length - 6} more</span>` : ''}</div>` },
    CX.col(o => o.v), { key: 'n', label: 'Records', num: true }, { key: 'first', label: 'First', render: o => esc(Tel.dd(o.first)) }, { key: 'last', label: 'Last', render: o => esc(Tel.dd(o.last)) }] });
  if (!PP.length) $('#xmP', out).innerHTML = '<div class="muted">No two of the chosen numbers / files share anything with these settings.</div>';
  else Table($('#xmP', out), { rows: PP, sortKey: 'n', sortDir: -1, pageSize: 10, exportName: 'cross_match_pairs', onRow: p => { s.sel = [p.a, p.b]; s.ff = ''; const v = out.closest('[data-xmv]') || out.parentElement; TelUI.xm_view(v); v.scrollIntoView && v.scrollIntoView({ block: 'start' }); }, columns: [
    { key: 'a', label: 'Number / file 1', render: p => XM.chip(p.a) }, { key: 'b', label: 'Number / file 2', render: p => XM.chip(p.b) },
    { key: 'n', label: 'Items shared', num: true, render: p => `<b>${fmtNum(p.n)}</b>` },
    { key: 'by', label: 'What they share', sortVal: p => Object.keys(p.by).length, csv: p => Object.entries(p.by).map(([f, n]) => FL[f][1] + ' ' + n).join('; '), render: p => Object.entries(p.by).sort((a, b) => b[1] - a[1]).map(([f, n]) => `<span class="tf-chip">${FL[f][2]} ${esc(FL[f][1].split(' (')[0])} <b>${n}</b></span>`).join(' ') }] });
};
/* a Cross-match tab in CDR, IPDR, TDR and SMS */
for (const k of ['cdr', 'ipdr', 'tdr', 'sms']) { const T = TelUI.TABS[k]; if (T && !T.some(x => x[0] === 'xm')) T.splice(1, 0, ['xm', '🔀 Cross-match']); TelUI[k + '_xm'] = function (el) { el.setAttribute('data-xmv', '1'); TelUI.xm_view(el); }; }
