/* target.js – Analytics › Target: suspect accounts / persons across ALL cases, in working order:
   JMIS notice status → account, IFSC, bank, holder → mobile, email, Aadhaar, PAN, KYC, CKYC → state, district →
   ATM location, cheque branch → UTR trail. Common targets (2+ cases / complaints) first. Read on this computer only. */
'use strict';
const Target = {
  JS: { P: ['⏳', 'Pending', '#f59e0b'], ST: ['✅', 'Served ~ Trace', '#16a34a'], SNT: ['🟠', 'Served ~ Not Trace', '#ea580c'], NSW: ['❌', 'Not Served ~ Wrong Address', '#dc2626'] },
  ok: a => { a = String(a || '').trim(); return a.length >= 6 && !/^(VICTIM|CASH|ATM|NA|N\/A|NIL)/i.test(a) && !(typeof isSynthetic === 'function' && isSynthetic(a)); },
  one(c, d) {
    const M = new Map(), lab = AllMode && AllMode.caseLabel ? AllMode.caseLabel(c) : c.name;
    const get = acc => { let t = M.get(acc); if (!t) M.set(acc, t = { acc, caseId: c.id, case: lab, names: [], banks: [], ifsc: [], branch: [], mobile: [], email: [], pan: [], aadhaar: [], kyc: [], ckyc: [], address: [], state: [], district: [], atm: [], chq: [], utr: [], acks: [], layers: [], amt: 0 }); return t; };
    const put = (t, k, v) => { v = String(v || '').trim(); if (v && v !== '-' && !t[k].includes(v)) t[k].push(v); };
    for (const x of d.txns || []) {
      if (!this.ok(x.to_acc)) continue; const t = get(String(x.to_acc).trim()), how = [x.mode, x.action, x.remarks].join(' ');
      put(t, 'names', x.to_name); put(t, 'banks', x.to_bank); put(t, 'ifsc', x.to_ifsc); ['mobile', 'email', 'pan', 'aadhaar', 'state', 'district'].forEach(k => put(t, k, x[k])); put(t, 'acks', x.ack_no); if (x.layer != null) put(t, 'layers', 'L' + x.layer);
      t.amt += Math.abs(+x.amount || 0);
      if (x.txn_id) t.utr.push({ utr: String(x.txn_id), date: [x.date, x.time].filter(Boolean).join(' '), amt: +x.amount || 0, from: x.from_acc || '', mode: x.mode || '', act: x.action || '' });
      if (x.atm_loc || /\batm\b|cash withdraw/i.test(how)) put(t, 'atm', x.atm_loc || (how.match(/atm[^,;|]{0,60}/i) || [''])[0]);
      if (/che(que|ck)|\bchq\b|clearing/i.test(how)) put(t, 'chq', x.atm_loc || (how.match(/(?:branch|br\.?)\s*[:\-]?\s*[^,;|]{2,50}/i) || [''])[0] || x.to_bank);
    }
    for (const k of d.kyc || []) {
      if (!this.ok(k.acc)) continue; const t = get(String(k.acc).trim());
      put(t, 'names', k.name); put(t, 'banks', k.bank); put(t, 'ifsc', k.ifsc); put(t, 'branch', k.branch); ['mobile', 'email', 'pan', 'aadhaar', 'address', 'state', 'district'].forEach(f => put(t, f, k[f]));
      put(t, 'kyc', k.kyc_doc || k.id_type || k.acc_type || k.type || 'KYC received'); const ck = k.ckyc || (String(k.remarks || '').match(/ckyc\s*(?:no\.?|number)?\s*[:\-]?\s*(\d{14})/i) || [])[1]; put(t, 'ckyc', ck);
    }
    return [...M.values()];
  },
  async collect(force) {
    if (this._d && !force && Date.now() - this._t < 60000) return this._d;
    const all = new Map();
    for (const c of S.cases) {
      const L = c.id === S.caseId && S.data && !isScope(S.caseId) ? this.one(c, S.data) : await Vault.sum(c.id, 'tgt', 'v1|' + JSON.stringify(c), async () => { const d = await DB.get('case:' + c.id); return d ? this.one(c, Object.assign(emptyCase(), d)) : []; });
      for (const t of L) { const g = all.get(t.acc); if (!g) { all.set(t.acc, { ...t, cases: [{ id: t.caseId, name: t.case }] }); continue; }
        for (const k of ['names', 'banks', 'ifsc', 'branch', 'mobile', 'email', 'pan', 'aadhaar', 'kyc', 'ckyc', 'address', 'state', 'district', 'atm', 'chq', 'acks', 'layers']) t[k].forEach(v => { if (!g[k].includes(v)) g[k].push(v); });
        g.utr.push(...t.utr); g.amt += t.amt; if (!g.cases.some(x => x.id === t.caseId)) g.cases.push({ id: t.caseId, name: t.case }); }
      await new Promise(r => setTimeout(r, 0));
    }
    const T = [...all.values()];
    // same person: other accounts sharing PAN / Aadhaar / mobile / email
    const idx = new Map(); T.forEach(t => ['pan', 'aadhaar', 'mobile', 'email'].forEach(k => t[k].forEach(v => { const K = k + '|' + v.toLowerCase(); (idx.get(K) || idx.set(K, []).get(K)).push(t); })));
    T.forEach(t => { const s = new Set(); ['pan', 'aadhaar', 'mobile', 'email'].forEach(k => t[k].forEach(v => (idx.get(k + '|' + v.toLowerCase()) || []).forEach(o => { if (o !== t) s.add(o.acc); }))); t.links = [...s]; t.utr.sort((a, b) => String(a.date).localeCompare(String(b.date))); t.score = t.cases.length * 10 + t.acks.length * 3 + t.links.length * 2 + (t.layers.includes('L1') ? 2 : 0); });
    this._t = Date.now(); return (this._d = T.sort((a, b) => b.score - a.score));
  },
  jm() { return Off.get('tgt', {}); },
  st() { return this._s || (this._s = { f: '', c: false, q: '' }); },
  async page(main) {
    main.innerHTML = `<div class="page-head"><div class="ph-text"><div class="crumb">Analysis <span>›</span> Target</div><h2>🎯 Target</h2><div class="ph-desc">Suspect accounts and persons across all cases, in working order: JMIS notice status → account, IFSC, bank, holder → mobile, email, Aadhaar, PAN, KYC, CKYC → state, district → ATM location, cheque branch → UTR trail.</div></div></div><div id="tgB"><div class="card muted">Reading all cases…</div></div>`;
    const [T, J] = [await this.collect(), await this.jm()]; if (S.page !== 'target') return; this.draw($('#tgB', main), T, J);
  },
  sOf(J, t) { return (J[t.acc] && J[t.acc].st) || 'P'; },
  draw(el, T, J) {
    this.tip(null);
    const st = this.st(), q = st.q.toLowerCase(), common = t => t.cases.length >= 2 || t.acks.length >= 2 || t.links.length > 0;
    const F = T.filter(t => (!st.f || this.sOf(J, t) === st.f) && (!st.c || common(t)) && (!q || [t.acc, ...t.names, ...t.mobile, ...t.email, ...t.pan, ...t.aadhaar, ...t.ifsc, ...t.banks, ...t.district, ...t.state, ...t.utr.map(u => u.utr)].join(' ').toLowerCase().includes(q)));
    const n = k => T.filter(t => this.sOf(J, t) === k).length, j = (a, m = 2) => esc(a.slice(0, m).join(', ')) + (a.length > m ? ` <small class="muted">+${a.length - m}</small>` : '');
    el.innerHTML = `<div class="card"><div class="ag-k tg-k"><button class="ag-kb ${!st.f && !st.c ? 'on' : ''}" data-tgf="" style="--c:#6366f1"><span>🎯</span><b>${fmtNum(T.length)}</b><small>All Targets</small></button><button class="ag-kb ${st.c ? 'on' : ''}" data-tgc="1" style="--c:#be123c"><span>🔗</span><b>${fmtNum(T.filter(common).length)}</b><small>Common (2+ Cases / Complaints / Same Person)</small></button>${Object.entries(this.JS).map(([k, [i, l, c]]) => `<button class="ag-kb ${st.f === k ? 'on' : ''}" data-tgf="${k}" style="--c:${c}"><span>${i}</span><b>${fmtNum(n(k))}</b><small>JMIS: ${l}</small></button>`).join('')}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px"><h3 class="grow" style="margin:0">🎯 Targets <span class="badge">${fmtNum(F.length)}</span></h3><input id="tgQ" placeholder="Find account, name, mobile, PAN, UTR…" value="${esc(st.q)}" style="max-width:280px"><button class="btn" id="tgImp" title="Excel / CSV from JMIS with account number and notice status">📥 Import JMIS Status</button><button class="btn" id="tgRe">🔄 Read All Cases Again</button></div>
      <div id="tgT" style="margin-top:10px"></div></div>`;
    Table($('#tgT', el), { rows: F, pageSize: 25, exportName: 'targets', onRow: t => this.open(t, J, () => this.draw(el, T, J)), columns: [
      { key: 'jm', label: 'JMIS Notice', sortVal: t => this.sOf(J, t), csv: t => this.JS[this.sOf(J, t)][1] + (J[t.acc] && J[t.acc].date ? ' · ' + J[t.acc].date : ''), render: t => { const s = this.JS[this.sOf(J, t)]; return `<span class="eo-st" style="--c:${s[2]}">${s[0]} ${s[1]}</span>${J[t.acc] && J[t.acc].date ? `<div class="small muted">${esc(EO.dmy(J[t.acc].date))}</div>` : ''}`; } },
      { key: 'acc', label: 'Account', render: t => `<b class="mono">${esc(t.acc)}</b>${common(t) ? ' <span class="tg-c" title="Common target">🔗</span>' : ''}<div class="small muted">${esc(t.layers.join(' '))}</div>` },
      { key: 'ifsc', label: 'IFSC', csv: t => t.ifsc.join('; '), render: t => `<span class="mono small">${j(t.ifsc, 1)}</span>` },
      { key: 'bank', label: 'Bank', csv: t => t.banks.join('; '), render: t => j(t.banks, 1) },
      { key: 'name', label: 'Holder', csv: t => t.names.join('; '), sortVal: t => t.names[0] || '', render: t => `<b>${j(t.names, 1)}</b>` },
      { key: 'mobile', label: 'Mobile', csv: t => t.mobile.join('; '), render: t => j(t.mobile) },
      { key: 'email', label: 'Email', csv: t => t.email.join('; '), render: t => `<span class="small">${j(t.email, 1)}</span>` },
      { key: 'aadhaar', label: 'Aadhaar', csv: t => t.aadhaar.join('; '), render: t => j(t.aadhaar, 1) },
      { key: 'pan', label: 'PAN', csv: t => t.pan.join('; '), render: t => j(t.pan, 1) },
      { key: 'kyc', label: 'KYC', csv: t => t.kyc.join('; '), render: t => t.kyc.length ? '✔ ' + j(t.kyc, 1) : '<span class="muted">—</span>' },
      { key: 'ckyc', label: 'CKYC', csv: t => t.ckyc.join('; '), render: t => j(t.ckyc, 1) },
      { key: 'state', label: 'State', csv: t => t.state.join('; '), render: t => j(t.state, 1) },
      { key: 'district', label: 'District', csv: t => t.district.join('; '), render: t => j(t.district, 1) },
      { key: 'atm', label: 'ATM Location', csv: t => t.atm.join('; '), render: t => `<span class="small">${j(t.atm, 1)}</span>` },
      { key: 'chq', label: 'Cheque Branch', csv: t => t.chq.join('; '), render: t => `<span class="small">${j(t.chq, 1)}</span>` },
      { key: 'utr', label: 'UTR Trail', sortVal: t => t.utr.length, csv: t => t.utr.map(u => u.utr).join('; '), render: t => t.utr.length ? `<b>${t.utr.length}</b> <span class="small muted mono">${esc(t.utr[0].utr)}${t.utr.length > 1 ? ' …' : ''}</span>` : '' },
      { key: 'cases', label: 'Cases / Complaints', sortVal: t => t.score, csv: t => t.cases.map(c => c.name).join('; ') + ' | ' + t.acks.join('; '), render: t => `<b class="${t.cases.length > 1 ? 'bad-t' : ''}">${t.cases.length}</b> case${t.cases.length > 1 ? 's' : ''} · <b>${t.acks.length}</b> compl.${t.links.length ? `<div class="small">👤 ${t.links.length} linked A/C</div>` : ''}` },
      { key: 'amt', label: 'Amount', num: true, render: t => t.amt ? fmtINR(t.amt) : '' }] });
    const re = () => this.draw(el, T, J);
    $$('[data-tgf]', el).forEach(b => { b.onclick = () => { st.f = b.dataset.tgf; st.c = false; re(); }; b.onmouseenter = () => this.tip(b, T.filter(t => !b.dataset.tgf || this.sOf(J, t) === b.dataset.tgf)); b.onmouseleave = () => this.tip(null); });
    $$('[data-tgc]', el).forEach(b => { b.onclick = () => { st.c = !st.c; st.f = ''; re(); }; b.onmouseenter = () => this.tip(b, T.filter(common)); b.onmouseleave = () => this.tip(null); });
    const qi = $('#tgQ', el); qi.onchange = () => { st.q = qi.value; re(); };
    $('#tgRe', el).onclick = async () => { $('#tgRe', el).disabled = true; const T2 = await this.collect(true); this.draw(el, T2, J); };
    $('#tgImp', el).onclick = () => this.imp(J, re);
  },
  tip(el, list) {
    let t = $('#agTip'); if (!el) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement('div'); t.id = 'agTip'; t.className = 'ag-tip'; document.body.appendChild(t); }
    t.innerHTML = `<b>${list.length} target${list.length === 1 ? '' : 's'}</b>${list.slice(0, 8).map(x => `<div><span class="mono">${esc(x.acc)}</span> · ${esc(x.names[0] || '')} · ${esc(x.banks[0] || '')} <i>${x.cases.length} case</i></div>`).join('')}${list.length > 8 ? `<div class="muted">+ ${list.length - 8} more – click</div>` : ''}`;
    const r = el.getBoundingClientRect(); t.style.left = Math.min(innerWidth - 440, Math.max(8, r.left)) + 'px'; t.style.top = (r.bottom + 6) + 'px';
  },
  open(t, J, done) {
    const s = J[t.acc] || { st: 'P', date: '', note: '' }, row = (k, v) => v && v.length ? `<tr><th>${k}</th><td>${esc(Array.isArray(v) ? v.join(', ') : v)}</td></tr>` : '';
    const m = UI.modal('🎯 ' + t.acc + (t.names[0] ? ' · ' + t.names[0] : ''), `<div class="tg-jm"><b>📮 JMIS Notice Status</b><div class="map-grid"><label>Status<select id="tjS">${Object.entries(this.JS).map(([k, [i, l]]) => `<option value="${k}" ${s.st === k ? 'selected' : ''}>${i} ${l}</option>`).join('')}</select></label><label>Date<input type="date" id="tjD" value="${esc(s.date || '')}"></label><label>Note<input id="tjN" value="${esc(s.note || '')}" placeholder="Address found / police station / remarks"></label></div></div>
      <table class="tg-tb">${row('Account', t.acc)}${row('IFSC', t.ifsc)}${row('Bank', t.banks)}${row('Branch', t.branch)}${row('Holder', t.names)}${row('Mobile', t.mobile)}${row('Email', t.email)}${row('Aadhaar', t.aadhaar)}${row('PAN', t.pan)}${row('KYC', t.kyc)}${row('CKYC', t.ckyc)}${row('Address', t.address)}${row('State', t.state)}${row('District', t.district)}${row('ATM Location', t.atm)}${row('Cheque Branch', t.chq)}${row('Layers', t.layers)}${row('Complaints (Ack)', t.acks)}${row('Cases', t.cases.map(c => c.name))}${row('Same Person – Linked A/C', t.links)}${row('Amount Received', t.amt ? fmtINR(t.amt) : '')}</table>
      ${t.utr.length ? `<h4 style="margin:12px 0 6px">🔗 UTR Trail (${t.utr.length})</h4><div class="tg-utr">${t.utr.map((u, i) => `<div><span class="tg-un">${i + 1}</span><b class="mono">${esc(u.utr)}</b><span class="small muted">${esc(u.date)}</span><span>${u.amt ? fmtINR(u.amt) : ''}</span><span class="small">${esc([u.from && 'from ' + u.from, u.mode, u.act].filter(Boolean).join(' · '))}</span></div>`).join('')}</div>` : ''}`,
      [{ label: '🔎 Track Everywhere', onClick: () => { UI.closeModal(); if (typeof Dash2 !== 'undefined' && Dash2.track) Dash2.track(t.acc); } }, { label: 'Close', onClick: UI.closeModal }, { label: 'Save Status', cls: 'primary', onClick: async () => { J[t.acc] = { st: $('#tjS', m).value, date: $('#tjD', m).value, note: $('#tjN', m).value.trim() }; await Off.put('tgt'); UI.closeModal(); UI.toast('JMIS status saved'); done(); } }]);
  },
  imp(J, done) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv';
    i.onchange = async () => { const f = i.files[0]; if (!f) return; try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }); let n = 0;
      for (const r of rows) { const ks = Object.keys(r), ak = ks.find(k => /a\/?c|account/i.test(k)), sk = ks.find(k => /status|served|trace/i.test(k)), dk = ks.find(k => /date/i.test(k)); if (!ak || !sk) continue;
        const a = String(r[ak]).replace(/\s/g, ''), v = String(r[sk]); if (!this.ok(a) || !v.trim()) continue;
        const code = /not\s*served|wrong|address/i.test(v) ? 'NSW' : /not\s*trace|untrace/i.test(v) ? 'SNT' : /trace|served/i.test(v) ? 'ST' : 'P';
        J[a] = { st: code, date: dk && Trend.ts(r[dk]) ? new Date(Trend.ts(r[dk]) + 432e5).toISOString().slice(0, 10) : '', note: v.slice(0, 120) }; n++; }
      await Off.put('tgt'); UI.toast(n ? n + ' JMIS status rows taken' : 'No rows with account + status found', 5000); done(); } catch (e) { UI.toast('Could not read the file: ' + e.message, 5000); } };
    i.click();
  }
};
Pages.target = main => Target.page(main);

/* Analytics drop-down: Trending Crime above CDR Analysis, Target after SMS Analysis */
(() => {
  const subs = $('.tel-subs'); if (!subs) return;
  subs.insertAdjacentHTML('afterbegin', `<div class="nav-sub" data-tx="trend" style="--pc:#ef4444" title="Crime trends across all cases: fraud type, district, PS, identifier, delay"><i></i><span>Trending Crime</span></div>`);
  subs.insertAdjacentHTML('beforeend', `<div class="nav-sub" data-tx="target" style="--pc:#be123c" title="Common suspect accounts / persons across all cases with JMIS notice status"><i></i><span>Target</span></div>`);
  $$('.nav-sub span', subs).forEach((s, i) => s.textContent = (i + 1) + '. ' + s.textContent.replace(/^\d+\.\s*/, ''));
  $$('[data-tx]', subs).forEach(n => n.onclick = () => go(n.dataset.tx));
  const r0 = render; render = function () { const r = r0.apply(this, arguments);
    $$('[data-tx]', subs).forEach(n => n.classList.toggle('active', S.page === n.dataset.tx));
    if (/^(trend|target)$/.test(S.page)) { const it = $('.nav-item[data-page="analytics"]'); if (it) it.classList.add('active'); if (!subs.classList.contains('open')) { subs.classList.add('open'); it && it.classList.add('open'); S.telOpen = true; } } return r; };
})();
