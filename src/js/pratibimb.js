/* pratibimb.js – Analysis › Pratibimb Cases: the Excel sheets that I4C Pratibimb (JCCT portal) generates –
   Suspect Locations, Cheque Withdrawal Locations, ATM Withdrawal Locations, Suspect Bank Branches, Suspect SIM – POS.
   Imported on this computer only, matched with Target and every case (common targets), joined into gangs / groups,
   with at-a-glance rings / bars, an offline point map, hover and click, and one-click Arrest / Notice and Crime Data. */
'use strict';
const PRB = {
  K: [['loc', '📍', 'Suspect Locations', '#dc2626', 'https://jcct-i4c.mha.gov.in/'], ['chq', '🧾', 'Cheque Withdrawal Locations', '#ea580c', 'https://jcct-i4c.mha.gov.in/pages/map_cheque_with.aspx'],
    ['atm', '🏧', 'ATM Withdrawal Locations', '#7c3aed', 'https://jcct-i4c.mha.gov.in/pages/mapping_atm.aspx'], ['branch', '🏦', 'Suspect Bank Branches', '#2563eb', 'https://jcct-i4c.mha.gov.in/pages/bank_mapping.aspx'],
    ['pos', '📶', 'Suspect SIM – POS', '#0891b2', 'https://jcct-i4c.mha.gov.in/pages/viewmap.aspx']],
  k(x) { return this.K.find(y => y[0] === x) || this.K[0]; },
  /* column heading → field (first that fits, most specific first) */
  F: [['imei', /imei/], ['ifsc', /ifsc/], ['ncrp', /ncrp|^ack|acknowledg/], ['coord', /coordinat|latlong|latlng/], ['lat', /^lat/], ['lng', /^lon|^lng/], ['branch', /branch/], ['atm', /atm|terminal/], ['chq', /cheque|chq/],
    ['pos', /pos|retailer|dealer|agent/], ['bank', /bank/], ['acc', /account|^acno|accno|^ac$/], ['mobile', /mobile|msisdn|phone|^sim/], ['addr', /address|addr|^location$|place/], ['time', /time|date/], ['total', /total|noofcomp|^comp/],
    ['amt', /amount|amt/], ['state', /state/], ['district', /district/], ['ps', /policestation|^ps$|thana/], ['name', /name|holder/]],
  L: { mobile: 'Mobile', imei: 'IMEI', acc: 'Account', name: 'Name', bank: 'Bank', ifsc: 'IFSC', branch: 'Branch', atm: 'ATM', chq: 'Cheque', pos: 'POS / Agent', amt: 'Amount', addr: 'Address / Location', time: 'Fetch / Txn Time', total: 'Total Complaints', ncrp: 'NCRP Complaints', state: 'State', district: 'District', ps: 'Police Station' },
  GCAT: ['Group Calling (Same Location)', 'Many SIMs In One Phone (Same IMEI)', 'Mule Account Gang', 'Cash Withdrawal Gang (ATM / Cheque)', 'SIM Seller / POS Gang', 'Sextortion Gang', 'Investment / Task Fraud Gang', 'Other'],
  st() { return this._s || (this._s = { f: null, q: '' }); },
  nm: v => String(v || '').replace(/\D/g, '').slice(-10), ni: v => String(v || '').replace(/\D/g, '').slice(0, 15), na: v => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, ''),
  async data() { return Off.get('prb', []); },
  ts(v) { if (v == null || v === '') return 0; if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v).trim())) return Math.round((+v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4; const t = Trend.ts(v); if (t) return t; const d = Date.parse(String(v).replace(/,/g, ' ')); return isNaN(d) ? 0 : d; },
  /* one sheet → rows */
  rows(A, kind, file) {
    const hi = A.findIndex(r => r.filter(c => this.F.some(([, re]) => re.test(String(c).toLowerCase().replace(/[^a-z0-9]/g, '')))).length >= 2); if (hi < 0) return [];
    const H = A[hi].map(h => String(h).trim()), M = {}; H.forEach((h, i) => { const n = h.toLowerCase().replace(/[^a-z0-9]/g, ''); const f = this.F.find(([k, re]) => !(k in M) && re.test(n)); if (f) M[f[0]] = i; });
    /* the sheet's own columns decide its kind; the open tab is used only when the columns don't tell */
    const auto = 'pos' in M ? 'pos' : 'chq' in M ? 'chq' : 'atm' in M ? 'atm' : 'imei' in M || 'coord' in M ? 'loc' : 'branch' in M || 'ifsc' in M ? 'branch' : ''; kind = auto || kind || 'loc';
    const out = [];
    for (const r of A.slice(hi + 1)) { if (!r.some(c => String(c).trim())) continue; const g = k => M[k] != null ? String(r[M[k]] == null ? '' : r[M[k]]).trim() : '';
      const raw = {}; H.forEach((h, i) => { if (h) raw[h] = String(r[i] == null ? '' : r[i]).trim(); });
      let lat = parseFloat(g('lat')), lng = parseFloat(g('lng')); const cm = (g('coord') || g('addr')).match(/(-?\d{1,2}\.\d{3,})\s*(?:,|%2C)\s*(-?\d{2,3}\.\d{3,})/i); if ((isNaN(lat) || isNaN(lng)) && cm) { lat = +cm[1]; lng = +cm[2]; }
      const x = { k: kind, mobile: this.nm(g('mobile')), imei: this.ni(g('imei')), acc: this.na(g('acc')), name: g('name'), bank: g('bank'), ifsc: g('ifsc').toUpperCase(), branch: g('branch'), atm: g('atm'), chq: g('chq'), pos: g('pos'), amt: +g('amt').replace(/[^\d.]/g, '') || 0,
        addr: g('addr'), time: this.ts(M.time != null ? r[M.time] : ''), total: parseInt(g('total')) || 0, acks: (g('ncrp').match(/\d{10,}/g) || []), state: g('state'), district: g('district'), ps: g('ps'), lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng, raw, file };
      if (x.mobile.length < 10) x.mobile = ''; if (x.imei.length < 14) x.imei = ''; if (x.acc.length < 6) x.acc = '';
      if (!x.mobile && !x.imei && !x.acc && !x.atm && !x.branch && !x.pos && x.lat == null) continue;
      if (!x.total && x.acks.length) x.total = x.acks.length;
      x.h = sha256(unescape(encodeURIComponent(kind + '|' + JSON.stringify(raw)))).slice(0, 20); out.push(x); }
    return out;
  },
  async imp(kind, done) {
    const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = '.xlsx,.xls,.csv,.ods';
    i.onchange = async () => { const D = await this.data(); let a = 0, s = 0; const by = {};
      for (const f of i.files) { try { const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), { type: 'string', raw: true }) : XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
        for (const sn of wb.SheetNames) for (const x of this.rows(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true }), kind, f.name)) {
          if (D.some(y => y.h === x.h)) { s++; continue; } D.push({ id: uid(), at: new Date().toISOString(), ...x }); a++; by[x.k] = (by[x.k] || 0) + 1; } } catch (e) { UI.toast('Could not read ' + f.name + ': ' + e.message, 6000); } }
      await Off.put('prb'); this._ix = null;
      UI.toast(a ? `🛰 ${a} row(s) imported – ${Object.entries(by).map(([k, n]) => this.k(k)[2] + ' ' + n).join(', ')}${s ? ` · ${s} already there` : ''}` : s ? 'All rows were already imported' : 'No Pratibimb rows found – check the sheet has Mobile / IMEI / Account / Coordinates columns', 6000); done && done(); };
    i.click();
  },
  ids(r) { const o = []; if (r.mobile) o.push(['📱', 'm:' + r.mobile, r.mobile]); if (r.imei) o.push(['📟', 'i:' + r.imei.slice(0, 14), r.imei]); if (r.acc) o.push(['🏦', 'a:' + r.acc, r.acc]); (r.acks || []).forEach(k => o.push(['🧾', 'k:' + k, k])); return o; },
  /* links: Target (all cases) and NCRP complaints in cases */
  async ix(force) {
    if (this._ix && !force && Date.now() - this._ixt < 60000) return this._ix;
    const V = new Map(), add = (k, v) => { if (!k) return; const a = V.get(k) || V.set(k, []).get(k); if (!a.some(y => y.key === v.key)) a.push(v); };
    try { for (const t of await Target.collect()) { const v = { key: 'T|' + t.key, l: '🎯 ' + t.acc, cases: t.cases, t };
      if (t.type === 'account') add('a:' + this.na(t.acc), v); t.mobile.forEach(m => add('m:' + this.nm(m), v)); (t.imei || []).forEach(m => add('i:' + this.ni(m).slice(0, 14), v)); if (t.type === 'mobile') add('m:' + this.nm(t.acc), v); } } catch (e) { }
    try { for (const r of await Trend.collect()) { if (r.ack) String(r.ack).split(/[,;\s]+/).filter(Boolean).forEach(k => add('k:' + k, { key: 'C|' + r.caseId + '|' + k, l: '📁 ' + (r.case || 'Case'), cases: [{ id: r.caseId, name: r.case }] }));
      (r.ids || []).forEach(i => { const v = { key: 'C|' + r.caseId, l: '📁 ' + (r.case || 'Case'), cases: [{ id: r.caseId, name: r.case }] }; if (/^\d{10,12}$/.test(String(i.v).replace(/\D/g, ''))) add('m:' + this.nm(i.v), v); }); } } catch (e) { }
    this._ixt = Date.now(); return (this._ix = V);
  },
  hits(r, V) { const s = new Map(); this.ids(r).forEach(([, k]) => (V.get(k) || []).forEach(v => s.set(v.key, v))); return [...s.values()]; },
  /* gangs: rows joined by the same mobile, IMEI, account, NCRP complaint or the same spot (~100 m) */
  /* gangs: rows joined by the same mobile, IMEI, account, NCRP complaint, ATM – or standing within F.m metres of each other (group calling) */
  dist(a, b) { const R = 6371000, x = (b.lng - a.lng) * Math.PI / 180 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180), y = (b.lat - a.lat) * Math.PI / 180; return Math.sqrt(x * x + y * y) * R; },
  gangs(D, mm) {
    mm = mm == null ? this.flt().m : +mm || 0;
    const P = D.map((_, i) => i), f = i => { while (P[i] !== i) { P[i] = P[P[i]]; i = P[i]; } return i; }, u = (a, b) => { a = f(a); b = f(b); if (a !== b) P[a] = b; }, K = new Map(), why = new Map(), near = new Set();
    const keys = r => { const a = this.ids(r).map(x => x[1]); if (r.atm) a.push('t:' + this.na(r.atm)); return a; };
    D.forEach((r, i) => keys(r).forEach(k => { if (K.has(k)) { u(i, K.get(k)); why.set(k, (why.get(k) || 1) + 1); } else K.set(k, i); }));
    if (mm > 0) { const deg = mm / 111320, C = new Map(), pts = D.map((r, i) => [r, i]).filter(([r]) => r.lat != null && (r.k === 'loc' || r.k === 'pos'));
      const ck = (a, b) => a + ',' + b; pts.forEach(([r, i]) => { const a = Math.floor(r.lat / deg), b = Math.floor(r.lng / deg); (C.get(ck(a, b)) || C.set(ck(a, b), []).get(ck(a, b))).push(i); });
      pts.forEach(([r, i]) => { const a = Math.floor(r.lat / deg), b = Math.floor(r.lng / deg); for (let da = -1; da <= 1; da++) for (let db = -2; db <= 2; db++) for (const j of C.get(ck(a + da, b + db)) || []) if (j > i && this.dist(r, D[j]) <= mm && (D[j].mobile !== r.mobile || !r.mobile)) { u(i, j); near.add(i); near.add(j); } }); }
    const G = new Map(); D.forEach((r, i) => { const g = f(i); (G.get(g) || G.set(g, []).get(g)).push(i); });
    return [...G.values()].map(I => { const R = I.map(i => D[i]), m = [...new Set(R.map(r => r.mobile).filter(Boolean))], im = [...new Set(R.map(r => r.imei).filter(Boolean))], ac = [...new Set(R.map(r => r.acc).filter(Boolean))], ak = [...new Set(R.flatMap(r => r.acks))];
      if (m.length + ac.length < 2 && !(im.length && m.length > 1)) return null;
      const ks = new Set(R.flatMap(keys).filter(k => (why.get(k) || 0) > 1)), rs = [...new Set([...ks].map(k => ({ m: '📱 Same Mobile', i: '📟 Same IMEI (Many SIMs)', a: '🏦 Same Account', k: '🧾 Same Complaint', t: '🏧 Same ATM' }[k[0]])))];
      if (I.some(i => near.has(i))) rs.push(`📍 Within ${mm} m (Group Calling)`);
      const key = [...m, ...ac].sort()[0], auto = rs.some(x => /IMEI/.test(x)) ? this.GCAT[1] : rs.some(x => /Within/.test(x)) ? this.GCAT[0] : rs.some(x => /ATM/.test(x)) || R.some(r => r.k === 'atm' || r.k === 'chq') ? this.GCAT[3] : R.some(r => r.k === 'pos') ? this.GCAT[4] : ac.length ? this.GCAT[2] : this.GCAT[7];
      const P2 = R.filter(r => r.lat != null), span = P2.length > 1 ? Math.round(Math.max(...P2.map(a => Math.max(...P2.map(b => this.dist(a, b)))))) : 0;
      return { key, R, m, im, ac, ak, rs, auto, span, comp: R.reduce((s, r) => s + (r.total || 0), 0), kinds: [...new Set(R.map(r => r.k))] }; }).filter(Boolean).sort((a, b) => b.R.length - a.R.length || b.comp - a.comp);
  },
  /* view filters – date, time of day, day / night, weekdays, complaints, gang distance (kept on this computer) */
  FD: { from: '', to: '', tod: 'all', h1: '', h2: '', dow: [], minc: 0, m: 100 },
  flt() { if (!this._f) { try { this._f = Object.assign({}, this.FD, JSON.parse(localStorage.getItem('sud-prbf') || '{}')); } catch (e) { this._f = Object.assign({}, this.FD); } } return this._f; },
  fset(o) { Object.assign(this.flt(), o); try { localStorage.setItem('sud-prbf', JSON.stringify(this._f)); } catch (e) { } render(); },
  timed(F) { return !!(F.from || F.to || F.tod !== 'all' || F.dow.length); },
  pass(r, F) {
    if (F.minc && (r.total || 0) < F.minc) return false; if (!this.timed(F)) return true; if (!r.time) return false;
    const d = new Date(r.time), h = d.getHours() + d.getMinutes() / 60, ymd = this.ymd(r.time);
    if (F.from && ymd < F.from) return false; if (F.to && ymd > F.to) return false; if (F.dow.length && !F.dow.includes(d.getDay())) return false;
    if (F.tod === 'day' && !(h >= 6 && h < 18)) return false; if (F.tod === 'night' && h >= 6 && h < 18) return false;
    if (F.tod === 'hrs' && F.h1 !== '' && F.h2 !== '') { const a = +F.h1, b = +F.h2; if (a <= b ? !(h >= a && h < b) : !(h >= a || h < b)) return false; }
    return true; },
  ymd(t) { const d = new Date(t), q = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`; },
  fbar(n, tot, cur) { const F = this.flt(), DW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], hrs = [...Array(24)].map((_, i) => i);
    return `<div class="card pb-flt"><div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
      <label>From<input type="date" id="pfF" value="${esc(F.from)}"></label><label>To<input type="date" id="pfT" value="${esc(F.to)}"></label>
      <div class="pf-g"><span class="small">Time</span><div class="pf-seg">${[['all', '🕒 All'], ['day', '☀️ Day 6–18'], ['night', '🌙 Night 18–6'], ['hrs', '⏱ Hours']].map(([k, l]) => `<button class="${F.tod === k ? 'on' : ''}" data-pft="${k}">${l}</button>`).join('')}</div></div>
      ${F.tod === 'hrs' ? `<label>From Hour<select id="pfH1">${hrs.map(h => `<option ${String(F.h1) === String(h) ? 'selected' : ''}>${h}</option>`).join('')}</select></label><label>To Hour<select id="pfH2">${hrs.map(h => `<option ${String(F.h2) === String(h) ? 'selected' : ''}>${h}</option>`).join('')}</select></label>` : ''}
      <div class="pf-g"><span class="small">Days</span><div class="pf-seg">${DW.map((d, i) => `<button class="${F.dow.includes(i) ? 'on' : ''}" data-pfd="${i}">${d}</button>`).join('')}</div></div>
      <label>Min. Complaints<input type="number" id="pfC" min="0" value="${F.minc || ''}" style="width:80px" placeholder="0"></label>
      <label title="Suspect points standing this close are joined into one gang / group (group calling)">👥 Gang Distance <b id="pfMv">${F.m} m</b><input type="range" id="pfM" min="0" max="800" step="25" value="${F.m}" style="width:160px"></label>
      <button class="btn sm" id="pfX">✖ Reset</button><span class="small muted grow" style="text-align:right">Showing <b>${fmtNum(n)}</b> of ${fmtNum(tot)} rows${this.timed(F) ? ' · rows without a date / time are hidden while a time filter is on' : ''}</span></div></div>`; },
  fbind(el) {
    const F = this.flt(), v = id => $('#' + id, el);
    v('pfF').onchange = e => this.fset({ from: e.target.value }); v('pfT').onchange = e => this.fset({ to: e.target.value });
    $$('[data-pft]', el).forEach(b => b.onclick = () => this.fset({ tod: b.dataset.pft, h1: F.h1 === '' ? 22 : F.h1, h2: F.h2 === '' ? 4 : F.h2 }));
    $$('[data-pfd]', el).forEach(b => b.onclick = () => { const d = +b.dataset.pfd, a = F.dow.includes(d) ? F.dow.filter(x => x !== d) : [...F.dow, d]; this.fset({ dow: a }); });
    if (v('pfH1')) { v('pfH1').onchange = e => this.fset({ h1: +e.target.value }); v('pfH2').onchange = e => this.fset({ h2: +e.target.value }); }
    v('pfC').onchange = e => this.fset({ minc: Math.max(0, +e.target.value || 0) });
    v('pfM').oninput = e => { v('pfMv').textContent = e.target.value + ' m'; }; v('pfM').onchange = e => this.fset({ m: +e.target.value });
    v('pfX').onclick = () => { this._f = Object.assign({}, this.FD, { dow: [] }); try { localStorage.removeItem('sud-prbf'); } catch (e) { } render(); };
  },
  async meta() { return Off.get('prbGang', {}); },
  gl(g, M) { const o = M[g.key] || {}; return { cat: o.cat || g.auto, name: o.name || '', note: o.note || '' }; },
  /* ---------- page ---------- */
  async page(main) {
    let { cur, body } = tabs(main, 'prb', [['glance', '📊 At A Glance'], ...this.K.map(([k, ic, l]) => [k, ic + ' ' + l]), ['gang', '👥 Gangs / Groups']], '🛰 Pratibimb Cases');
    body.innerHTML = '<div class="card muted">Reading Pratibimb data and matching with every case…</div>';
    const D0 = await this.data(), F = this.flt(), D = D0.filter(r => this.pass(r, F)), V = await this.ix(), G = this.gangs(D), M = await this.meta(); if (S.page !== 'prb') return;
    if (D0.length) { body.innerHTML = this.fbar(cur === 'glance' || cur === 'gang' ? D.length : D.filter(r => r.k === cur).length, cur === 'glance' || cur === 'gang' ? D0.length : D0.filter(r => r.k === cur).length, cur) + '<div id="pbBody"></div>'; this.fbind(body); body = $('#pbBody', body); }
    D.forEach(r => { r._h = this.hits(r, V); }); const gOf = new Map(); G.forEach((g, i) => g.R.forEach(r => gOf.set(r.id, i))); this._G = G; this._gOf = gOf;
    if (cur === 'glance') return this.glance(body, D, G, M);
    if (cur === 'gang') return this.gangPage(body, G, M);
    return this.kind(body, cur, D.filter(r => r.k === cur), G, M);
  },
  bar(list, attr, col) { const mx = Math.max(1, ...list.map(x => x.n)); return `<div class="jm-bars">${list.map(x => `<button class="jm-bar" ${attr}="${esc(x.k)}"><span class="jm-bn">${esc(x.l || x.k)}</span><span class="jm-bt" style="width:${x.n / mx * 100}%"><i class="u" style="flex:1;${col ? 'background:' + col : ''}"></i></span><b>${x.n}</b></button>`).join('') || '<div class="small muted">—</div>'}</div>`; },
  cnt(R, f) { const m = new Map(); R.forEach(r => [].concat(f(r)).filter(Boolean).forEach(v => m.set(v, (m.get(v) || 0) + 1))); return [...m].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n); },
  area(r) { return r.district || r.state || (r.lat != null ? 'Grid ' + r.lat.toFixed(2) + ', ' + r.lng.toFixed(2) : '') || '—'; },
  glance(el, D, G, M) {
    const st = this.st(), com = this.common(D);
    el.innerHTML = `<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">📊 Pratibimb At A Glance <span class="small muted">imported on this computer only</span></h3><button class="btn primary" id="pbImp" title="Any Pratibimb Excel – the kind is found from its columns">📥 Import Pratibimb Excel</button></div>
      <div class="lr-ks" style="margin-top:12px">${this.K.map(([k, ic, l, c]) => `<button class="lr-k" data-pbk="${k}" style="--c:${c}"><span>${ic}</span><b>${fmtNum(D.filter(r => r.k === k).length)}</b><small>${l}</small></button>`).join('')}
        <button class="lr-k" data-pbk="common" style="--c:#be123c"><span>🎯</span><b>${fmtNum(com.length)}</b><small>Common Targets (In Cases / 2+ Sheets)</small></button><button class="lr-k" data-pbk="gang" style="--c:#0f766e"><span>👥</span><b>${fmtNum(G.length)}</b><small>Gangs / Groups</small></button></div></div>
      ${D.length ? `<div class="grid g2"><div class="card"><h3>🗂 Rows By Sheet</h3>${Trend.ring(this.K.map(([k, , l]) => ({ k: l, n: D.filter(r => r.k === k).length })).filter(x => x.n), '', 'data-pbr', D.length, 'rows')}</div>
        <div class="card"><h3>🗺 By District / Area <span class="small muted">hover · click</span></h3>${Trend.ring(this.cnt(D, r => this.area(r)), '', 'data-pba', D.length, 'rows')}</div>
        <div class="card"><h3>📱 Most Repeated Mobile / IMEI / Account</h3>${this.bar(this.cnt(D, r => this.ids(r).filter(x => x[0] !== '🧾').map(x => x[0] + ' ' + x[2])).filter(x => x.n > 1).slice(0, 12), 'data-pbi', '#dc2626')}</div>
        <div class="card"><h3>👥 Gangs By Category</h3>${this.bar(this.cnt(G, g => this.gl(g, M).cat).slice(0, 10), 'data-pbg', '#0f766e')}</div></div>
      <div class="card"><h3>🎯 Common Targets <span class="badge">${com.length}</span> <span class="small muted">in your cases / Target, or in 2+ Pratibimb sheets – act on these first</span></h3><div id="pbCom"></div></div>` : '<div class="card muted">No Pratibimb sheet yet. On the I4C Pratibimb page press the Excel button, then import the file here (or in its own tab above).</div>'}`;
    $('#pbImp', el).onclick = () => this.imp('', () => render());
    $$('[data-pbk]', el).forEach(b => b.onclick = () => { if (b.dataset.pbk === 'common') { $('#pbCom', el) && $('#pbCom', el).scrollIntoView({ behavior: 'smooth' }); return; } S.sub.prb = b.dataset.pbk; render(); });
    const R = k => D.filter(r => r.k === (this.K.find(x => x[2] === k) || [])[0]);
    this.hov(el, '[data-pbr]', b => R(b.dataset.pbr), b => { S.sub.prb = this.K.find(x => x[2] === b.dataset.pbr)[0]; render(); });
    this.hov(el, '[data-pba]', b => D.filter(r => this.area(r) === b.dataset.pba), b => { const r = D.find(r => this.area(r) === b.dataset.pba); this.st().f = { t: 'area', v: b.dataset.pba }; S.sub.prb = r ? r.k : 'loc'; render(); });
    this.hov(el, '[data-pbi]', b => D.filter(r => this.ids(r).some(x => x[0] + ' ' + x[2] === b.dataset.pbi)), b => this.who(b.dataset.pbi.replace(/^\S+\s/, ''), D));
    this.hov(el, '[data-pbg]', b => G.filter(g => this.gl(g, M).cat === b.dataset.pbg).flatMap(g => g.R), b => { st.gc = b.dataset.pbg; S.sub.prb = 'gang'; render(); });
    if ($('#pbCom', el)) this.comTable($('#pbCom', el), com, D);
  },
  common(D) { const m = new Map(); D.forEach(r => this.ids(r).filter(x => x[0] !== '🧾').forEach(([ic, k, v]) => { const o = m.get(k) || m.set(k, { k, ic, v, R: [], kinds: new Set(), hits: new Map() }).get(k); o.R.push(r); o.kinds.add(r.k); r._h.forEach(h => o.hits.set(h.key, h)); }));
    return [...m.values()].filter(o => o.hits.size || o.kinds.size > 1).map(o => ({ ...o, kinds: [...o.kinds], hits: [...o.hits.values()], comp: o.R.reduce((s, r) => s + (r.total || 0), 0) })).sort((a, b) => b.hits.length - a.hits.length || b.kinds.length - a.kinds.length || b.comp - a.comp); },
  comTable(el, com, D) {
    Table(el, { rows: com, pageSize: 25, exportName: 'pratibimb_common_targets', noNd: true, onRow: o => this.who(o.v, D), columns: [
      { key: 'v', label: 'Target', render: o => `${o.ic} <b class="mono">${esc(o.v)}</b>` }, { key: 'kinds', label: 'Found In Sheets', sortVal: o => o.kinds.length, csv: o => o.kinds.map(k => this.k(k)[2]).join(', '), render: o => o.kinds.map(k => { const x = this.k(k); return `<span class="tg-sp" style="--c:${x[3]}">${x[1]} ${esc(x[2])}</span>`; }).join(' ') },
      { key: 'hits', label: 'In Your Cases / Target', sortVal: o => o.hits.length, csv: o => o.hits.map(h => h.l).join('; '), render: o => o.hits.length ? o.hits.slice(0, 4).map(h => `<div class="small">${esc(h.l)}${h.cases ? ' · ' + esc(h.cases.map(c => c.name).slice(0, 2).join(', ')) : ''}</div>`).join('') : '<span class="muted">—</span>' },
      { key: 'R', label: 'Rows', sortVal: o => o.R.length, csv: o => o.R.length, render: o => o.R.length }, { key: 'comp', label: 'Complaints', num: true }] });
  },
  /* hover = preview list, click = action */
  hov(el, sel, rows, click) { $$(sel, el).forEach(b => { b.onmouseenter = () => this.tip(b, rows(b)); b.onmouseleave = () => this.tip(null); b.onclick = e => { e.stopPropagation(); this.tip(null); click(b); }; }); },
  line(r) { return [r.mobile && '📱 ' + r.mobile, r.imei && '📟 ' + r.imei, r.acc && '🏦 ' + r.acc, r.atm && '🏧 ' + r.atm, r.branch && '🏛 ' + r.branch, r.pos && '📶 ' + r.pos].filter(Boolean).join(' · ') || (r.lat != null ? r.lat + ', ' + r.lng : ''); },
  tip(b, R, title) {
    let t = $('#pbTip'); if (!b) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement('div'); t.id = 'pbTip'; t.className = 'jm-tip'; document.body.appendChild(t); }
    t.innerHTML = `<b>${esc(title || (b.getAttribute && (b.querySelector('span:not(.jm-bt)') || b).textContent.trim().slice(0, 60)) || '')} · ${R.length} row(s)</b>${R.length ? `<table>${R.slice(0, 8).map(r => `<tr><td>${this.k(r.k)[1]}</td><td>${esc(this.line(r))}</td><td>${r.total ? r.total + ' comp.' : ''}</td><td>${esc(this.area(r))}</td></tr>`).join('')}</table>${R.length > 8 ? `<div class="small">+ ${R.length - 8} more – click to see all</div>` : '<div class="small">Click to open</div>'}` : ''}`;
    const r = b.getBoundingClientRect(); t.style.left = Math.max(8, Math.min(innerWidth - 540, r.left)) + 'px'; const h = t.offsetHeight; t.style.top = (r.bottom + 6 + h > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  },
  /* one sheet kind */
  kind(el, k, R0, G, M) {
    const st = this.st(), [, ic, l, c, url] = this.k(k), f = st.f && st.f.k === k ? st.f : (st.f = null);
    const R = f ? R0.filter(r => f.t === 'area' ? this.area(r) === f.v : f.t === 'id' ? this.ids(r).some(x => x[2] === f.v) : f.t === 'cell' ? r.lat != null && r.lat.toFixed(2) + ',' + r.lng.toFixed(2) === f.v : true) : R0;
    const has = fk => R0.some(r => fk === 'ncrp' ? r.acks.length : r[fk]), um = new Set(R.map(r => r.mobile).filter(Boolean)).size, ui = new Set(R.map(r => r.imei).filter(Boolean)).size, ua = new Set(R.map(r => r.acc).filter(Boolean)).size;
    const comp = R.reduce((s, r) => s + (r.total || 0), 0), hit = R.filter(r => r._h.length).length, ing = R.filter(r => this._gOf.has(r.id)).length;
    el.innerHTML = `<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">${ic} ${esc(l)} <span class="badge">${fmtNum(R.length)}</span></h3>
        <a class="btn" href="${url}" target="_blank" rel="noopener" title="Opens the I4C Pratibimb page (your JCCT login) – press its Excel button, then import the file here">🌐 Open In I4C Pratibimb ↗</a><button class="btn primary" id="pbImp">📥 Import ${esc(l)} Excel</button>${R0.length ? '<button class="btn danger" id="pbClr" title="Remove this sheet\'s rows from this computer">🗑 Clear</button>' : ''}</div>
      ${f ? `<div class="row" style="gap:6px;margin-top:8px"><span class="tg-sp" style="--c:${c}">Showing: ${esc(f.t === 'cell' ? 'Spot ' + f.v : f.v)}</span><button class="btn sm" id="pbFx">✖ Show All</button></div>` : ''}
      <div class="lr-ks" style="margin-top:12px">${[['📄', R.length, 'Rows', c], ['📱', um, 'Unique Mobiles', '#dc2626'], ['📟', ui, 'Unique IMEIs', '#7c3aed'], ['🏦', ua, 'Unique Accounts', '#2563eb'], ['🧾', comp, 'Complaints Linked', '#ea580c'], ['🎯', hit, 'Matched In Your Cases / Target', '#be123c'], ['👥', ing, 'In A Gang / Group', '#0f766e']].filter((x, i) => i < 1 || x[1] || i >= 4).map(([i, n, t, cc]) => `<div class="lr-k" style="--c:${cc};cursor:default"><span>${i}</span><b>${fmtNum(n)}</b><small>${t}</small></div>`).join('')}</div></div>
      ${R0.length ? `<div class="grid g2"><div class="card"><h3>🗺 Point Map <span class="small muted">offline · hover a point · click for actions · bigger = more complaints</span></h3><div id="pbMap"></div></div>
        <div class="card"><h3>🔥 Hotspots <span class="small muted">same ~1 km area – click to filter</span></h3>${this.bar(this.cnt(R0.filter(r => r.lat != null), r => r.lat.toFixed(2) + ',' + r.lng.toFixed(2)).slice(0, 10).map(x => ({ ...x, l: this.spot(R0, x.k) })), 'data-pbc', c)}</div>
        <div class="card"><h3>🗂 By District / Area</h3>${Trend.ring(this.cnt(R0, r => this.area(r)), f && f.t === 'area' ? f.v : '', 'data-pba', R0.length, 'rows')}</div>
        <div class="card"><h3>🔁 Repeated Mobile / IMEI / Account</h3>${this.bar(this.cnt(R0, r => this.ids(r).filter(x => x[0] !== '🧾').map(x => x[2])).filter(x => x.n > 1).slice(0, 12), 'data-pbi', '#dc2626')}</div></div>
      <div class="card"><div id="pbTb"></div></div>` : `<div class="card muted">No ${esc(l)} sheet yet. Press <b>🌐 Open In I4C Pratibimb</b>, set the dates / State / District, press its Excel button, then <b>📥 Import</b> the file here.</div>`}`;
    $('#pbImp', el).onclick = () => this.imp(k, () => render());
    if ($('#pbClr', el)) $('#pbClr', el).onclick = async () => { if (!UI.confirm(`Remove all ${R0.length} ${l} rows from this computer?`)) return; const D = await this.data(); Off.D.prb = D.filter(r => r.k !== k); await Off.put('prb'); st.f = null; render(); };
    if ($('#pbFx', el)) $('#pbFx', el).onclick = () => { st.f = null; render(); };
    if (!R0.length) return;
    this.hov(el, '[data-pbc]', b => R0.filter(r => r.lat != null && r.lat.toFixed(2) + ',' + r.lng.toFixed(2) === b.dataset.pbc), b => { st.f = { k, t: 'cell', v: b.dataset.pbc }; render(); });
    this.hov(el, '[data-pba]', b => R0.filter(r => this.area(r) === b.dataset.pba), b => { st.f = f && f.v === b.dataset.pba ? null : { k, t: 'area', v: b.dataset.pba }; render(); });
    this.hov(el, '[data-pbi]', b => R0.filter(r => this.ids(r).some(x => x[2] === b.dataset.pbi)), b => { st.f = { k, t: 'id', v: b.dataset.pbi }; render(); });
    this.map($('#pbMap', el), R, c);
    const F = ['mobile', 'imei', 'acc', 'name', 'bank', 'ifsc', 'branch', 'atm', 'chq', 'pos', 'amt'].filter(has);
    Table($('#pbTb', el), { rows: R, pageSize: 50, exportName: 'pratibimb_' + k, noNd: true, onRow: r => this.card(r), columns: [
      ...F.map(fk => ({ key: fk, label: this.L[fk], num: fk === 'amt', render: r => fk === 'amt' ? (r.amt ? fmtINR(r.amt) : '') : `<span class="${/mobile|imei|acc|ifsc/.test(fk) ? 'mono' : ''}">${esc(r[fk] || '')}</span>` })),
      { key: 'addr', label: 'Location', csv: r => [r.lat != null ? r.lat + ',' + r.lng : '', r.addr].filter(Boolean).join(' '), render: r => `${r.lat != null ? `<a href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank" rel="noopener" onclick="event.stopPropagation()">📍 ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</a>` : ''}${r.addr && !/^https?:/i.test(r.addr) ? `<div class="small">${esc(r.addr.slice(0, 90))}</div>` : ''}${r.district || r.state ? `<div class="small muted">${esc([r.district, r.state].filter(Boolean).join(', '))}</div>` : ''}` },
      { key: 'time', label: 'Fetch / Txn Time', sortVal: r => r.time, csv: r => r.time ? new Date(r.time).toLocaleString('en-IN') : '', render: r => r.time ? esc(new Date(r.time).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : '' },
      { key: 'total', label: 'Complaints', num: true, render: r => `<b>${r.total || ''}</b>${(r.acks || []).length ? `<div class="small mono">${esc((r.acks || []).slice(0, 2).join(', '))}${(r.acks || []).length > 2 ? ' +' + ((r.acks || []).length - 2) : ''}</div>` : ''}` },
      { key: 'hit', label: 'In Your Cases', sortVal: r => r._h.length, csv: r => r._h.map(h => h.l).join('; '), render: r => r._h.length ? r._h.slice(0, 2).map(h => `<div class="small"><b>${esc(h.l)}</b></div>`).join('') : '<span class="muted">—</span>' },
      { key: 'gang', label: 'Gang / Group', sortVal: r => this._gOf.has(r.id) ? 1 : 0, csv: r => this._gOf.has(r.id) ? 'G' + (this._gOf.get(r.id) + 1) : '', render: r => this._gOf.has(r.id) ? `<span class="tg-sp" style="--c:#0f766e">👥 G${this._gOf.get(r.id) + 1} · ${esc(this.gl(this._G[this._gOf.get(r.id)], M).cat.split(' (')[0])}</span>` : '' }] });
  },
  spot(R, cell) { const r = R.find(r => r.lat != null && r.lat.toFixed(2) + ',' + r.lng.toFixed(2) === cell); return (r && (r.district || (r.addr && !/^https?:/i.test(r.addr) ? r.addr.slice(0, 40) : ''))) || '📍 ' + cell; },
  /* offline point map: no map tiles are fetched, nothing leaves the computer */
  map(el, R, col) {
    const P = R.filter(r => r.lat != null && Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180); if (!P.length) { el.innerHTML = '<div class="small muted">No coordinates in these rows.</div>'; return; }
    const W = 640, H = 380, pad = 18, la = P.map(r => r.lat), lo = P.map(r => r.lng), y0 = Math.min(...la), y1 = Math.max(...la), x0 = Math.min(...lo), x1 = Math.max(...lo), sp = Math.max(y1 - y0, (x1 - x0) * H / W, 0.002);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = (H - 2 * pad) / sp, X = v => W / 2 + (v - cx) * k, Y = v => H / 2 - (v - cy) * k;
    const cell = 0.01, Gd = new Map(); P.forEach(r => { const g = Math.floor(r.lat / cell) + ',' + Math.floor(r.lng / cell); Gd.set(g, (Gd.get(g) || 0) + 1); }); const gm = Math.max(1, ...Gd.values());
    const heat = [...Gd].map(([g, n]) => { const [a, b] = g.split(',').map(Number), s = cell * k; return s > 3 ? `<rect x="${X(b * cell).toFixed(1)}" y="${Y((a + 1) * cell).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="${col}" opacity="${(0.06 + 0.3 * n / gm).toFixed(2)}"/>` : ''; }).join('');
    const grid = [...Array(5)].map((_, i) => { const yy = pad + i * (H - 2 * pad) / 4, xx = pad + i * (W - 2 * pad) / 4; return `<line x1="0" x2="${W}" y1="${yy}" y2="${yy}"/><line y1="0" y2="${H}" x1="${xx}" x2="${xx}"/>`; }).join('');
    el.innerHTML = `<svg class="pb-map" viewBox="0 0 ${W} ${H}" width="100%"><g class="pb-grid">${grid}</g>${heat}${P.map(r => `<circle data-pbp="${r.id}" cx="${X(r.lng).toFixed(1)}" cy="${Y(r.lat).toFixed(1)}" r="${(3 + Math.min(6, Math.log2(1 + (r.total || 1)) * 1.6)).toFixed(1)}" fill="${r._h.length ? '#be123c' : this._gOf.has(r.id) ? '#0f766e' : col}" class="${r._h.length ? 'hit' : ''}"/>`).join('')}
      <text x="${W - 6}" y="${H - 6}" text-anchor="end" class="pb-sc">${(sp * 111).toFixed(sp * 111 < 10 ? 1 : 0)} km tall · ${P.length} points</text></svg>
      <div class="small muted" style="margin-top:4px"><span style="color:#be123c">●</span> in your cases / Target · <span style="color:#0f766e">●</span> in a gang / group · <span style="color:${col}">●</span> other · darker squares = more points in that ~1 km</div>`;
    const I = new Map(P.map(r => [r.id, r]));
    $$('[data-pbp]', el).forEach(c => { const r = I.get(c.dataset.pbp); c.onmouseenter = () => this.pt(c, r); c.onmouseleave = () => this.tip(null); c.onclick = () => { this.tip(null); this.card(r); }; });
  },
  pt(b, r) { this.tip(b, [], ''); const t = $('#pbTip'); if (!t) return;
    t.innerHTML = `<b>${this.k(r.k)[1]} ${esc(this.k(r.k)[2])}</b><table>${Object.entries(r.raw).slice(0, 12).map(([h, v]) => `<tr><td>${esc(h)}</td><td>${esc(String(v).slice(0, 80))}</td></tr>`).join('')}</table>${r._h.length ? `<div>${esc(r._h.map(h => h.l).slice(0, 3).join(' · '))}</div>` : ''}${this._gOf.has(r.id) ? `<div>👥 Gang / Group G${this._gOf.get(r.id) + 1}</div>` : ''}<div class="small">Click for actions</div>`; },
  /* everything about one identifier across all sheets */
  who(v, D) { const R = D.filter(r => this.ids(r).some(x => x[2] === v)); if (R.length === 1) return this.card(R[0]);
    const m = UI.modal('🔎 ' + v + ' – in Pratibimb', `<div id="pbW"></div>`, [{ label: '🔎 Track Everywhere', onClick: () => { UI.closeModal(); typeof Dash2 !== 'undefined' && Dash2.track(v); } }, { label: 'Close', onClick: UI.closeModal }]);
    Table($('#pbW', m), { rows: R, pageSize: 20, noNd: true, onRow: r => this.card(r), columns: [{ key: 'k', label: 'Sheet', render: r => `${this.k(r.k)[1]} ${esc(this.k(r.k)[2])}` }, { key: 'line', label: 'Details', render: r => esc(this.line(r)) }, { key: 'area', label: 'Area', render: r => esc(this.area(r)) }, { key: 'total', label: 'Complaints', num: true }] }); },
  card(r) {
    const gi = this._gOf && this._gOf.get(r.id), g = gi != null ? this._G[gi] : null;
    UI.modal(`${this.k(r.k)[1]} ${this.k(r.k)[2]} – ${this.line(r).slice(0, 60)}`, `<table class="tg-kv">${Object.entries(r.raw).map(([h, v]) => `<tr><th>${esc(h)}</th><td>${/^https?:\/\//i.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.slice(0, 80))} ↗</a>` : esc(v)}</td></tr>`).join('')}</table>
      ${r._h.length ? `<h4>🎯 In Your Cases / Target</h4>${r._h.map(h => `<div class="small">• <b>${esc(h.l)}</b>${h.cases ? ' – ' + esc(h.cases.map(c => c.name).join(', ')) : ''}</div>`).join('')}` : '<div class="small muted" style="margin-top:8px">Not seen in your cases yet.</div>'}
      ${g ? `<h4>👥 Gang / Group G${gi + 1} – ${esc(g.rs.join(', '))}</h4><div class="small">${g.m.length} mobile(s) · ${g.im.length} IMEI · ${g.ac.length} account(s) · ${g.comp} complaint(s)</div>` : ''}`,
      [{ label: '🚔 Add To Arrest / Notice', cls: 'primary', onClick: () => this.toArrest([r], g) }, { label: '🗃 Add To Master Crime Data', onClick: () => this.toCrime([r]) },
        ...(r.mobile || r.acc ? [{ label: '🔎 Track Everywhere', onClick: () => { UI.closeModal(); typeof Dash2 !== 'undefined' && Dash2.track(r.mobile || r.acc); } }] : []),
        ...(r.lat != null ? [{ label: '🗺 Google Maps ↗', onClick: () => open(`https://www.google.com/maps?q=${r.lat},${r.lng}`, '_blank', 'noopener') }] : []), { label: 'Close', onClick: UI.closeModal }]);
  },
  async toArrest(R, g) {
    const L = await Arrest.list(), r = R[0], mob = R.map(x => x.mobile).filter(Boolean), dup = mob.length && L.find(a => [a.mobile, a.mobile2].map(this.nm).some(m => m && mob.includes(m)));
    if (dup) { UI.closeModal(); UI.toast('Already in Arrest / Notice as ' + dup.name); return Arrest.edit(dup, () => render()); }
    const cs = (r._h.find(h => h.cases && h.cases.length) || {}).cases, x = { id: 'A' + uid(), added: new Date().toISOString(), upd: new Date().toISOString(), sr: String(Math.max(0, ...L.map(y => +y.sr || 0)) + 1), rel: 'S/O', status: 'wanted',
      name: 'Unknown – Pratibimb ' + (r.mobile || r.acc || r.imei || ''), mobile: mob[0] || '', mobile2: mob[1] || '', presAddr: [r.addr && !/^https?:/i.test(r.addr) ? r.addr : '', r.lat != null ? 'Location ' + r.lat + ', ' + r.lng : ''].filter(Boolean).join(' · '), state: r.state, district: r.district,
      caseId: cs && cs[0] && cs[0].id || '', role: g ? 'Gang member – ' + this.gl(g, await this.meta()).cat : this.k(r.k)[2], social: [r.acc && 'A/c ' + r.acc + (r.ifsc ? ' ' + r.ifsc : ''), r.imei && 'IMEI ' + r.imei].filter(Boolean).join('\n'),
      notes: 'From I4C Pratibimb (' + this.k(r.k)[2] + ')' + (r.acks.length ? ' · NCRP ' + r.acks.join(', ') : '') + (r.time ? ' · seen ' + new Date(r.time).toLocaleString('en-IN') : ''), recovery: [] };
    L.push(x); await Off.put('accused'); UI.closeModal(); UI.toast('🚔 Added to Arrest / Notice – fill the name and details'); Arrest.edit(x, () => render());
  },
  async toCrime(R) { const C = await Off.get('crime', []); let n = 0;
    for (const r of R) for (const [t, v] of [['mobile', r.mobile], ['imei', r.imei], ['account', r.acc]]) if (v && !C.some(c => c.type === t && String(c.value) === v)) { C.push({ id: uid(), type: t, value: v, name: r.name || '', source: 'I4C Pratibimb – ' + this.k(r.k)[2], added: new Date().toISOString(), amount: r.amt || '', remarks: [r.acks.length && 'NCRP ' + r.acks.join(', '), r.lat != null && r.lat + ',' + r.lng].filter(Boolean).join(' · ') }); n++; }
    await Off.put('crime'); UI.closeModal(); UI.toast(n ? `🗃 ${n} added to Master Crime Data` : 'Already in Master Crime Data'); },
  /* gangs / groups */
  async gangPage(el, G, M) {
    const st = this.st(), cats = EditList.items('prb-gcat', this.GCAT), V = st.gc ? G.filter(g => this.gl(g, M).cat === st.gc) : G;
    el.innerHTML = `<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><h3 class="grow" style="margin:0">👥 Gangs / Groups <span class="badge">${V.length}</span></h3>${st.gc ? `<span class="tg-sp" style="--c:#0f766e">${esc(st.gc)}</span><button class="btn sm" id="pbGx">✖ All Categories</button>` : ''}</div>
      <p class="small muted" style="margin:6px 0 0">Rows that share a mobile, IMEI (many SIMs in one phone), account, NCRP complaint, ATM, or stand within <b>${this.flt().m} m</b> of each other (group calling – change it with 👥 Gang Distance above) are joined into one group. Give each a category and a name; the categories list is yours to edit.</p>
      ${G.length ? `<div class="grid g2" style="margin-top:10px"><div>${Trend.ring(this.cnt(G, g => this.gl(g, M).cat), st.gc || '', 'data-pbg', G.length, 'groups')}</div><div>${this.bar(this.cnt(G, g => g.rs).slice(0, 8), 'data-pbw', '#0f766e')}</div></div>` : ''}</div>
      <div class="card"><div id="pbGT"></div></div>`;
    if ($('#pbGx', el)) $('#pbGx', el).onclick = () => { st.gc = ''; render(); };
    this.hov(el, '[data-pbg]', b => G.filter(g => this.gl(g, M).cat === b.dataset.pbg).flatMap(g => g.R), b => { st.gc = st.gc === b.dataset.pbg ? '' : b.dataset.pbg; render(); });
    this.hov(el, '[data-pbw]', b => G.filter(g => g.rs.includes(b.dataset.pbw)).flatMap(g => g.R), () => { });
    Table($('#pbGT', el), { rows: V, pageSize: 25, exportName: 'pratibimb_gangs', noNd: true, onRow: g => this.gang(g, M, cats), columns: [
      { key: 'id', label: 'Group', sortVal: g => G.indexOf(g), csv: g => 'G' + (G.indexOf(g) + 1), render: g => { const o = this.gl(g, M); return `<b>👥 G${G.indexOf(g) + 1}</b>${o.name ? ' ' + esc(o.name) : ''}<div><span class="tg-sp" style="--c:#0f766e">${esc(o.cat)}</span></div>`; } },
      { key: 'rs', label: 'Joined By', csv: g => g.rs.join(', '), render: g => g.rs.map(x => `<div class="small">${esc(x)}</div>`).join('') },
      { key: 'span', label: 'Spread', num: true, csv: g => g.span ? g.span + ' m' : '', render: g => g.span ? (g.span >= 1000 ? (g.span / 1000).toFixed(1) + ' km' : g.span + ' m') : '' },
      { key: 'm', label: 'Mobiles', sortVal: g => g.m.length, csv: g => g.m.join(' '), render: g => `<b>${g.m.length}</b> <span class="small mono">${esc(g.m.slice(0, 4).join(', '))}${g.m.length > 4 ? ' …' : ''}</span>` },
      { key: 'im', label: 'IMEIs', sortVal: g => g.im.length, csv: g => g.im.join(' '), render: g => g.im.length ? `<b>${g.im.length}</b> <span class="small mono">${esc(g.im.slice(0, 2).join(', '))}</span>` : '' },
      { key: 'ac', label: 'Accounts', sortVal: g => g.ac.length, csv: g => g.ac.join(' '), render: g => g.ac.length ? `<b>${g.ac.length}</b> <span class="small mono">${esc(g.ac.slice(0, 2).join(', '))}</span>` : '' },
      { key: 'kinds', label: 'Sheets', csv: g => g.kinds.map(k => this.k(k)[2]).join(', '), render: g => g.kinds.map(k => this.k(k)[1]).join(' ') }, { key: 'comp', label: 'Complaints', num: true },
      { key: 'hit', label: 'In Your Cases', sortVal: g => g.R.filter(r => r._h.length).length, csv: g => [...new Set(g.R.flatMap(r => r._h.map(h => h.l)))].join('; '), render: g => { const h = [...new Set(g.R.flatMap(r => r._h.map(h => h.l)))]; return h.length ? `<span class="small"><b>${esc(h.slice(0, 2).join(', '))}</b>${h.length > 2 ? ' +' + (h.length - 2) : ''}</span>` : '<span class="muted">—</span>'; } }] });
  },
  gang(g, M, cats) {
    const o = this.gl(g, M), i = this._G.indexOf(g);
    const m = UI.modal(`👥 Gang / Group G${i + 1}`, `<div class="map-grid" style="grid-template-columns:1fr 1fr"><label>Category<select id="pbGc">${[...new Set([...cats, o.cat])].map(c => `<option ${c === o.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label>Gang Name<input id="pbGn" value="${esc(o.name)}" placeholder="e.g. Loni Group Calling Gang"></label><label style="grid-column:1/-1">Note<input id="pbGo" value="${esc(o.note)}" placeholder="kingpin, hideout, modus operandi…"></label></div>
      <div class="small" style="margin:6px 0">Joined by: <b>${esc(g.rs.join(', '))}</b> · ${g.comp} complaint(s)</div><div id="pbGR"></div>`,
      [{ label: '🚔 Add All To Arrest / Notice', onClick: async () => { for (const mo of g.m.length ? g.m : [g.ac[0]]) { const r = g.R.find(x => x.mobile === mo || x.acc === mo); if (r) { const L = await Arrest.list(); if (!L.some(a => this.nm(a.mobile) === r.mobile && r.mobile)) { await this.toArrest([r], g); UI.closeModal(); } } } UI.toast('🚔 Gang members added to Arrest / Notice'); go('arrest'); } },
        { label: '🗃 All To Master Crime Data', onClick: () => this.toCrime(g.R) }, { label: 'Close', onClick: UI.closeModal },
        { label: '💾 Save', cls: 'primary', onClick: async () => { M[g.key] = { cat: $('#pbGc', m).value, name: $('#pbGn', m).value.trim(), note: $('#pbGo', m).value.trim() }; await Off.put('prbGang'); UI.closeModal(); UI.toast('👥 Saved'); render(); } }]);
    EditList.attach($('#pbGc', m), 'prb-gcat', this.GCAT, 'Gang Categories');
    Table($('#pbGR', m), { rows: g.R, pageSize: 15, noNd: true, onRow: r => this.card(r), columns: [{ key: 'k', label: 'Sheet', render: r => this.k(r.k)[1] + ' ' + esc(this.k(r.k)[2]) }, { key: 'line', label: 'Mobile / IMEI / Account', render: r => esc(this.line(r)) }, { key: 'area', label: 'Area', render: r => esc(this.area(r)) }, { key: 'total', label: 'Complaints', num: true }] });
  }
};
PAGE_META.prb = { group: 'Analysis', title: 'Pratibimb Cases', desc: 'I4C Pratibimb sheets – suspect locations, cheque / ATM withdrawal locations, suspect bank branches and SIM – POS – matched with every case, joined into gangs, kept on this computer.', order: ['glance', ...PRB.K.map(x => x[0]), 'gang'], names: Object.fromEntries([['glance', '📊 At A Glance'], ...PRB.K.map(x => [x[0], x[1] + ' ' + x[2]]), ['gang', '👥 Gangs / Groups']]) };
Pages.prb = main => PRB.page(main);
addEventListener('scroll', () => PRB.tip(null), true);
/* Analytics drop-down: "Pratibimb Cases" (with its 5 sheets) just above Target */
(() => {
  const subs = $('.tel-subs'), tg = subs && $('[data-tx="target"]', subs); if (!tg) return;
  tg.insertAdjacentHTML('beforebegin', `<div class="nav-sub pb-h" data-tx="prb" style="--pc:#dc2626" title="I4C Pratibimb: suspect locations, cheque / ATM withdrawals, bank branches, SIM – POS"><i></i><span>Pratibimb Cases</span></div>${PRB.K.map(([k, , l, c]) => `<div class="nav-sub pb-n" data-pbn="${k}" style="--pc:${c}"><i></i><span>${l}</span></div>`).join('')}`);
  const num = () => { let i = 0; $$('.nav-sub', subs).forEach(n => { const s = $('span', n); if (!s || n.classList.contains('pb-n') || n.classList.contains('nc-edit')) return; s.textContent = (++i) + '. ' + s.textContent.replace(/^\d+\.\s*/, ''); }); }; num();
  const h = $('.pb-h', subs), show = on => { S.pbOpen = on; $$('.pb-n', subs).forEach(n => n.classList.toggle('pb-off', !on)); }; show(false);
  h.onclick = e => { e.stopPropagation(); if (S.page === 'prb') show(!S.pbOpen); else { show(true); S.sub.prb = 'glance'; go('prb'); } };
  $$('.pb-n', subs).forEach(n => n.onclick = e => { e.stopPropagation(); S.sub.prb = n.dataset.pbn; go('prb', n.dataset.pbn); });
  /* the menu keeps its items in their first-seen order: give every item its place as it now stands, so the 5 sheets stay under Pratibimb Cases */
  const keep = () => { let at = h; $$('.pb-n', subs).forEach(n => { if (at.nextElementSibling !== n) at.after(n); at = n; }); $$('.nav-sub', subs).forEach((n, i) => { n.dataset.ncI = i; }); }; keep();
  const r0 = render; render = function () { const r = r0.apply(this, arguments); const on = S.page === 'prb'; if ($$('.pb-n', subs).some((n, i, a) => (i ? a[i - 1] : h).nextElementSibling !== n)) keep();
    h.classList.toggle('active', on); $$('.pb-n', subs).forEach(n => n.classList.toggle('active', on && S.sub.prb === n.dataset.pbn)); if (on && !S.pbOpen) show(true);
    if (on) { const it = $('.nav-item[data-page="analytics"]'); if (it) it.classList.add('active'); if (!subs.classList.contains('open')) { subs.classList.add('open'); it && it.classList.add('open'); S.telOpen = true; } } return r; };
})();
