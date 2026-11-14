/* mirror.js – Dashboard › 🪞 Case Mirror (Vijay, 14-11-2026): one view that mirrors every case –
   the case open in the CASE box, or All / FIR / NCRP cases – with money (fraud, hold, refund), work (done / pending),
   and every target found anywhere in the cases: state, district, mobile, alternate number, e-mail, account, IFSC, UPI,
   Aadhaar, PAN, CKYC, IMEI, IP, relation (S/O, D/O, W/O, C/O), POS name / code / unique ID / mobile, POS agent,
   bank staff who opened the account, photos. "Cross-Case" = the same value in 2 or more cases.
   Hover a box for its top values, click it for all of them; click a value to track it everywhere. Read on this computer only. */
'use strict';
const Mirror = {
  T: [
    ['state', '🗺', 'State'], ['district', '📍', 'District'], ['mobile', '📱', 'Mobile'], ['alt', '📞', 'Alternate Number'], ['email', '✉️', 'E-mail'],
    ['account', '🏦', 'Account'], ['ifsc', '🏛', 'IFSC'], ['upi', '💸', 'UPI ID'], ['aadhaar', '🆔', 'Aadhaar'], ['pan', '🪪', 'PAN'], ['ckyc', '🧾', 'CKYC'],
    ['imei', '📟', 'IMEI'], ['ip', '🖧', 'IP Address'], ['rel', '👪', 'S/O · D/O · W/O · C/O'], ['pos', '🏪', 'POS Name / Code'], ['posu', '🔢', 'POS Unique Code'],
    ['posm', '☎', 'POS Number'], ['agent', '🧑‍💼', 'POS Agent'], ['staff', '🏢', 'Bank Staff (A/c Opening)'], ['photo', '🖼', 'Photos (CAF)'], ['url', '🌐', 'URL / APK']
  ],
  st() { return this._s || (this._s = { cross: false }); },
  /* one case → records { t, v, n (name), s (source) } */
  one(c, d) {
    const out = [], put = (t, v, s, n) => { v = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); if (!v || v.length < 2 || /^(na|n\/a|nil|null|none|-+|_+|0)$/i.test(v)) return; out.push({ t, v, s: s || '', n: n || '' }); };
    try { for (const r of Off.harvest(d, c)) { const t = r.type === 'whatsapp' ? 'mobile' : r.type === 'apk' ? 'url' : r.type; if (this.T.some(x => x[0] === t)) put(t, r.value, r.source, r.name); } } catch (e) { }
    for (const k of d.kyc || []) { put('state', String(k.state || '').toUpperCase(), 'KYC', k.name); put('district', String(k.district || '').toUpperCase(), 'KYC', k.name); put('ckyc', k.ckyc, 'KYC', k.name);
      for (const [key, val] of Object.entries(k)) if (/open(ed|ing)?_?by|employee|staff|\brm\b|relationship_?manager|sourced_?by|introduc/i.test(key)) put('staff', val, 'KYC ' + (k.bank || ''), k.name);
      const rel = String(k.father || k.relation || ''); if (rel) put('rel', rel, 'KYC', k.name); }
    for (const t of d.txns || []) { if (t._type === 'stmt') continue; put('state', String(t.state || '').toUpperCase(), 'Money trail'); put('district', String(t.district || '').toUpperCase(), 'Money trail'); }
    for (const f of d.caf || []) { const n = f.name || '';
      put('mobile', f.mobile, 'CAF', n); put('alt', f.alt, 'CAF', n); put('aadhaar', f.aadhaar, 'CAF', n); put('email', f.email, 'CAF', n);
      if (f.father) put('rel', (f.relation || f.rel_type || (/\b(w\/o|wife)\b/i.test(f.father) ? 'W/O' : /\bd\/o\b/i.test(f.father) ? 'D/O' : /\bc\/o\b/i.test(f.father) ? 'C/O' : 'S/O')) + ' ' + String(f.father).replace(/^(s|d|w|c)\/o\s*/i, ''), 'CAF', n);
      if (f.pos_name || f.pos_code) put('pos', [f.pos_name, f.pos_code && '(' + f.pos_code + ')'].filter(Boolean).join(' '), 'CAF', n);
      put('posu', f.pos_ucode, 'CAF', f.pos_name); put('posm', f.pos_mobile, 'CAF', f.pos_name); put('agent', f.pos_agent, 'CAF', f.pos_name);
      for (const p of f.photos || []) if (p && p.hash && p.kind !== 'scan') out.push({ t: 'photo', v: p.hash, s: 'CAF ' + (f.mobile || ''), n, th: p.thumb || '' });
      const st = String(f.address || '').match(/\b(UTTAR PRADESH|BIHAR|RAJASTHAN|JHARKHAND|WEST BENGAL|HARYANA|DELHI|MAHARASHTRA|GUJARAT|MADHYA PRADESH|ODISHA|ASSAM|PUNJAB|KARNATAKA|TAMIL NADU|TELANGANA|ANDHRA PRADESH|KERALA|UTTARAKHAND|CHHATTISGARH|HIMACHAL PRADESH|JAMMU|GOA|TRIPURA|MANIPUR|MEGHALAYA|NAGALAND|MIZORAM|SIKKIM|ARUNACHAL PRADESH)\b/i);
      if (st) put('state', st[1].toUpperCase(), 'CAF', n); }
    for (const n of d.ncrp || []) for (const [k, v] of Object.entries(n)) { if (/suspect.*state|accused.*state/i.test(k)) put('state', String(v).toUpperCase(), 'NCRP'); if (/suspect.*district|accused.*district/i.test(k)) put('district', String(v).toUpperCase(), 'NCRP'); }
    let amount = 0, hold = 0, comps = 0;
    try { const keep = S.data; S.data = d; Analysis.invalidate(); const L = Trail.complaints(); comps = L.length || (d.ncrp || []).length; amount = sum(d.ncrp || [], r => +r.amount || 0) || sum(L, x => +x.amount || 0); hold = sum(L, x => +x.hold || 0); S.data = keep; Analysis.invalidate(); } catch (e) { }
    const seen = new Set(); return { R: out.filter(r => { const k = r.t + '|' + r.v.toLowerCase() + '|' + r.s; if (seen.has(k)) return false; seen.add(k); return true; }), amount, hold, comps };
  },
  async collect() {
    const key = S.cases.map(c => c.id + ':' + c.name + ':' + (c.final ? 1 : 0)).join(',');
    if (this._d && this._d.key === key && Date.now() - this._d.t < 30000) return this._d;
    const C = [];
    for (const c of S.cases) {
      let r = null;
      try { r = c.id === S.caseId && S.data && !isScope(S.caseId) ? this.one(c, S.data) : await Vault.sum(c.id, 'mir', 'v1|' + JSON.stringify(c), async () => { const d = await DB.get('case:' + c.id); return d ? this.one(c, Object.assign(emptyCase(), d)) : { R: [], amount: 0, hold: 0, comps: 0 }; }); } catch (e) { r = { R: [], amount: 0, hold: 0, comps: 0 }; }
      C.push({ c, ...r }); await new Promise(z => setTimeout(z, 0));
    }
    let good = []; try { good = await Off.get('good', []); } catch (e) { }
    const nf = f => String(f || '').toUpperCase().replace(/\s+/g, '').replace(/^FIR(NO\.?)?/, ''), refundOf = c => c.fir ? sum(good.filter(g => g.fir && nf(g.fir) === nf(c.fir)), g => +g.refunded || 0) : 0;
    C.forEach(x => { x.refund = refundOf(x.c); x.pend = typeof AllDash !== 'undefined' ? AllDash.pend(x.c) : true; x.fin = typeof AllDash !== 'undefined' ? AllDash.fin(x.c) : ''; });
    /* value index across every case */
    const V = new Map();
    for (const x of C) for (const r of x.R) { const k = r.t + '|' + r.v.toLowerCase(); let g = V.get(k); if (!g) V.set(k, g = { t: r.t, v: r.v, cases: new Set(), names: new Set(), srcs: new Set(), th: r.th || '' }); g.cases.add(x.c.id); if (r.n) g.names.add(r.n); if (r.s) g.srcs.add(r.s); }
    return (this._d = { key, t: Date.now(), C, V: [...V.values()] });
  },
  ids() { return isScope(S.caseId) ? new Set((typeof AllMode !== 'undefined' ? AllMode.list() : S.cases).map(c => c.id)) : new Set([S.caseId]); },
  nameOf: id => { const c = S.cases.find(x => x.id === id) || {}; return (typeof AllMode !== 'undefined' && AllMode.caseLabel ? AllMode.caseLabel(c) : c.name) || id; },
  async mount(main) {
    const host = $('#main .dash-hero, #main .hero-card'); if (!host || $('#mirBox')) return;
    host.insertAdjacentHTML('afterend', `<div class="card mir" id="mirBox"><div class="mir-h"><h3>🪞 Case Mirror</h3><span class="muted small" id="mirSc"></span><span class="grow"></span><label class="mir-x"><input type="checkbox" id="mirCross" ${this.st().cross ? 'checked' : ''}> Only Cross-Case (same value in 2+ cases)</label></div><div id="mirB"><div class="muted">Reading every case…</div></div></div>`);
    $('#mirCross').onchange = e => { this.st().cross = e.target.checked; this.draw(); };
    this._tok = {}; const tok = this._tok; const D = await this.collect(); if (tok !== this._tok || !$('#mirB')) return; this.draw(D);
  },
  draw(D) {
    D = D || this._d; const el = $('#mirB'); if (!el || !D) return;
    const ids = this.ids(), cross = this.st().cross, X = D.C.filter(x => ids.has(x.c.id));
    const vals = D.V.filter(g => [...g.cases].some(id => ids.has(id)) && (!cross || g.cases.size >= 2));
    $('#mirSc').textContent = ids.size === 1 ? '· this case, compared with all ' + D.C.length + ' cases' : '· ' + X.length + ' cases';
    const done = X.filter(x => !x.pend).length, money = (k) => sum(X, x => x[k] || 0), byT = groupBy(vals, g => g.t);
    const K = [['📁', 'Cases', fmtNum(X.length), () => this.cases(X)], ['✅', 'Done', fmtNum(done), () => this.cases(X.filter(x => !x.pend))], ['⏳', 'Pending', fmtNum(X.length - done), () => this.cases(X.filter(x => x.pend))],
      ['🧾', 'Complaints', fmtNum(sum(X, x => x.comps || 0)), () => this.cases(X)], ['💰', 'Fraud Amount', fmtINR(money('amount')), () => this.cases(X, 'amount')], ['🔒', 'On Hold', fmtINR(money('hold')), () => this.cases(X, 'hold')],
      ['↩', 'Refunded', fmtINR(money('refund')), () => this.cases(X, 'refund')], ['🎯', cross ? 'Cross-Case Targets' : 'Targets Found', fmtNum(vals.length), () => this.list('All targets', vals)], ['🔗', 'In 2+ Cases', fmtNum(vals.filter(g => g.cases.size >= 2).length), () => this.list('Cross-case targets', vals.filter(g => g.cases.size >= 2))]];
    el.innerHTML = `<div class="mir-k">${K.map((k, i) => `<button type="button" class="mir-kb" data-mk="${i}"><span>${k[0]}</span><small>${k[1]}</small><b>${k[2]}</b></button>`).join('')}</div>
      <div class="mir-g">${this.T.map(([t, ic, l]) => { const L = (byT.get(t) || []).sort((a, b) => b.cases.size - a.cases.size || b.names.size - a.names.size), cc = L.filter(g => g.cases.size >= 2).length;
        const tip = L.length ? L.slice(0, 6).map(g => (t === 'photo' ? 'Photo ' + g.v.slice(0, 8) : g.v) + (g.cases.size > 1 ? '  · ' + g.cases.size + ' cases' : '')).join('\n') + (L.length > 6 ? '\n… ' + (L.length - 6) + ' more – click' : '') : 'None found yet';
        return `<button type="button" class="mir-t${L.length ? '' : ' none'}${cc ? ' hot' : ''}" data-mt="${t}" title="${esc(l + '\n' + tip)}"><span class="mir-ic">${ic}</span><span class="mir-l">${esc(l)}</span><b>${fmtNum(L.length)}</b>${cc ? `<em title="Same value in 2+ cases">🔗 ${cc}</em>` : ''}</button>`; }).join('')}</div>
      <div class="mir-2"><div><h4>Targets by State</h4><div id="mirSt"></div></div><div><h4>Targets by District</h4><div id="mirDi"></div></div><div><h4>Fraud Amount by Case</h4><div id="mirAm"></div></div></div>
      <div class="mir-net-h"><h4>🕸 Case Network <span class="muted small">cases joined by the same mobile, account, UPI, PAN, Aadhaar, POS…</span></h4></div><div class="graph-box" id="mirNet" style="height:430px"></div>`;
    $$('[data-mk]', el).forEach(b => b.onclick = () => K[+b.dataset.mk][3]());
    $$('[data-mt]', el).forEach(b => b.onclick = () => { const t = b.dataset.mt, L = byT.get(t) || []; this.list((this.T.find(x => x[0] === t) || [])[2], L); });
    const hb = (id, rows, o) => { const box = $(id, el); if (!rows.length) { box.innerHTML = '<div class="muted small">None found yet</div>'; return; } Charts.hbar(box, rows.slice(0, 12), o); };
    hb('#mirSt', (byT.get('state') || []).map(g => ({ label: g.v, value: g.cases.size, sub: g.cases.size + ' case(s)', g })).sort((a, b) => b.value - a.value), { fmt: v => v + ' case(s)', onClick: d => this.list('State ' + d.label, [d.g]) });
    hb('#mirDi', (byT.get('district') || []).map(g => ({ label: g.v, value: g.cases.size, sub: g.cases.size + ' case(s)', g })).sort((a, b) => b.value - a.value), { fmt: v => v + ' case(s)', onClick: d => this.list('District ' + d.label, [d.g]) });
    hb('#mirAm', X.filter(x => x.amount).map(x => ({ label: this.nameOf(x.c.id), value: x.amount, sub: 'Hold ' + fmtINR(x.hold || 0), x })).sort((a, b) => b.value - a.value), { fmt: fmtINR, onClick: d => this.open(d.x.c.id) });
    this.net(D, ids);
  },
  net(D, ids) {
    const box = $('#mirNet'); if (!box) return;
    const link = D.V.filter(g => g.cases.size >= 2 && !/^(state|district|ifsc)$/.test(g.t) && [...g.cases].some(id => ids.has(id))).sort((a, b) => b.cases.size - a.cases.size).slice(0, 120);
    if (!link.length) { box.style.height = 'auto'; box.innerHTML = `<div class="muted small" style="padding:14px">No mobile, account, UPI, PAN, Aadhaar or POS is shared between ${ids.size === 1 ? 'this case and another case' : 'these cases'} yet. When one appears it is drawn here and marked 🔗 on the boxes above.</div>`; return; }
    const cs = new Set(link.flatMap(g => [...g.cases])), nodes = [...[...cs].map(id => ({ id: 'C:' + id, label: this.nameOf(id), sub: 'Case', kind: ids.has(id) ? 'victim' : 'account', value: 10 })),
      ...link.map(g => ({ id: 'V:' + g.t + ':' + g.v, label: g.t === 'photo' ? 'Same photo' : g.v, sub: (this.T.find(x => x[0] === g.t) || [])[2] || g.t, kind: 'risk', value: g.cases.size * 3 }))];
    const edges = link.flatMap(g => [...g.cases].map(id => ({ from: 'C:' + id, to: 'V:' + g.t + ':' + g.v, amount: 1, count: 1, txns: [] })));
    try { Graph.mount(box, nodes, edges, { mode: 'net', labels: true, onNode: n => { if (n.id.startsWith('C:')) this.open(n.id.slice(2)); else { const g = link.find(x => 'V:' + x.t + ':' + x.v === n.id); if (g) this.list(g.v, [g]); } } }); } catch (e) { box.innerHTML = `<div class="muted">Network could not be drawn: ${esc(e.message)}</div>`; }
  },
  open(id) { if (id === S.caseId) return; if (typeof switchCase === 'function') switchCase(id).then(() => go('dashboard')); },
  cases(X, k) {
    const b = UI.drawer('Cases', '<div id="mirC"></div>');
    Table($('#mirC', b), { rows: X.map(x => ({ id: x.c.id, name: this.nameOf(x.c.id), fir: x.c.fir || '', ps: x.c.ps || '', io: x.c.io || '', st: x.pend ? 'Pending' : 'Done', fin: x.fin || '', comps: x.comps || 0, amount: x.amount || 0, hold: x.hold || 0, refund: x.refund || 0, tg: x.R.length })), sortKey: k || 'amount', sortDir: -1, exportName: 'mirror_cases',
      onRow: r => this.open(r.id), columns: [{ key: 'name', label: 'Case', render: r => `<b>${esc(r.name)}</b>` }, { key: 'ps', label: 'PS' }, { key: 'io', label: 'IO' }, { key: 'st', label: 'Status', render: r => `<span class="badge ${r.st === 'Done' ? 'ok' : 'warn'}">${r.st}${r.fin ? ' · ' + esc(r.fin) : ''}</span>` },
        { key: 'comps', label: 'Complaints', num: true }, { key: 'amount', label: 'Fraud', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'hold', label: 'Hold', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'refund', label: 'Refund', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'tg', label: 'Targets', num: true }] });
  },
  list(title, L) {
    const b = UI.drawer(title + ' (' + L.length + ')', '<div class="muted small">Click a value to track it in every case, page and file.</div><div id="mirL"></div>');
    Table($('#mirL', b), { rows: L.map(g => ({ g, type: (this.T.find(x => x[0] === g.t) || [])[2] || g.t, v: g.v, n: g.cases.size, cases: [...g.cases].map(id => this.nameOf(id)).join(', '), names: [...g.names].slice(0, 4).join(', '), srcs: [...g.srcs].slice(0, 4).join(', ') })), sortKey: 'n', sortDir: -1, exportName: 'mirror_targets', pageSize: 50,
      onRow: r => { if (r.g.t === 'photo') return; if (typeof Dash2 !== 'undefined' && Dash2.track) { $('#drawer').classList.remove('open'); Dash2.track(r.v); } },
      columns: [{ key: 'v', label: 'Value', render: r => r.g.t === 'photo' && r.g.th ? `<img src="${r.g.th}" alt="" style="height:46px;border-radius:6px">` : `<b class="mono">${esc(r.v)}</b>` }, { key: 'type', label: 'Type' }, { key: 'n', label: 'Cases', num: true, render: r => r.n > 1 ? `<span class="badge bad">🔗 ${r.n}</span>` : r.n }, { key: 'cases', label: 'Case Names' }, { key: 'names', label: 'Names' }, { key: 'srcs', label: 'Found In' }] });
  }
};
(() => { const pd = Pages.dashboard; Pages.dashboard = function (main) { const r = pd.apply(this, arguments); let n = 0; const t = () => { if (S.page !== 'dashboard') return; if ($('#main .dash-hero, #main .hero-card')) { try { Mirror.mount(main); } catch (e) { console.warn('mirror', e); } } else if (n++ < 40) setTimeout(t, 250); }; setTimeout(t, 0); return r; }; })();
