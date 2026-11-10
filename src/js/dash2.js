/* dash2.js – Dashboard redesign: one place to find and track suspects.
   ① Track a suspect (search any mobile / account / UPI / email / IP / IMEI / name across this case and all other cases)
   ② Case at a glance – every section and its tabs with counts, one click to open
   ③ Linked suspects – identifiers that show up in 2+ sections, many places, or in other cases, ranked
   ④ Common with other cases – what this case shares with your other cases
   Everything is worked out on this computer. */
'use strict';
const Dash2 = {
  SEC: { Financial: ['#10b981', '🏦'], NCRP: ['#f97316', '📋'], 'Social Media': ['#ec4899', '💬'], Telecom: ['#06b6d4', '📞'], CAF: ['#84cc16', '🪪'], Others: ['#94a3b8', '🧩'] },
  TYPE: { mobile: ['📱', 'Mobile'], account: ['🏦', 'Account'], upi: ['💸', 'UPI ID'], email: ['✉️', 'Email'], ip: ['🌐', 'IP address'], imei: ['📲', 'IMEI'], pan: ['🪪', 'PAN'], aadhaar: ['🆔', 'Aadhaar'], url: ['🔗', 'URL'], username: ['👤', 'Username'] },
  sec(s) { s = String(s || ''); return /^social/i.test(s) ? 'Social Media' : this.SEC[s] ? s : s === 'Telecom' ? s : 'Others'; },
  nk(t, v) {
    v = String(v ?? '').trim(); if (!v) return '';
    switch (t) {
      case 'mobile': { const d = N.mobile(v); return /^[6-9]\d{9}$/.test(d) ? d : d.length >= 8 ? d : ''; }
      case 'account': { const a = N.acc(v); return a.length >= 6 ? a : ''; }
      case 'imei': { const d = N.imei(v); return d.length >= 14 ? d.slice(0, 14) : ''; }
      case 'ip': return N.ip(v).toLowerCase();
      case 'pan': return N.pan(v);
      case 'aadhaar': { const d = v.replace(/[^\dxX*]/g, '').toUpperCase(); return d.length >= 12 ? d : ''; }
      default: return v.toLowerCase().replace(/\s+/g, '');
    }
  },
  /* identifiers of the open case, grouped so that "+91 98…" and "98…" meet */
  groups() {
    return Analysis.cached('d2:g', () => {
      const G = new Map(); let ids = []; try { ids = Analysis.idents(); } catch (e) { }
      for (const i of ids) {
        const k = this.nk(i.type, i.value); if (!k) continue; const key = i.type + '|' + k;
        let g = G.get(key); if (!g) G.set(key, g = { key, type: i.type, value: String(i.value), items: [], secs: new Set(), refs: new Set(), victim: 0, suspect: 0 });
        g.items.push(i); g.secs.add(this.sec(i.section)); g.refs.add(i.ref || i.section);
        if (/\(victim\)/.test(i.ref || '')) g.victim++; if (/\(suspect\)/.test(i.ref || '')) g.suspect++;
      }
      let risk = new Map(); try { for (const a of Analysis.accountRows()) risk.set(N.acc(a.acc), a); } catch (e) { }
      for (const g of G.values()) { const a = g.type === 'account' ? risk.get(g.key.split('|')[1]) : null; g.risk = a ? a.score || 0 : 0; g.acc = a; }
      return G;
    });
  },
  score(g, oc) { return (g.secs.size - 1) * 12 + Math.min(g.refs.size, 25) + oc * 15 + g.suspect * 4 + Math.round(g.risk / 8) - (g.victim && !g.suspect ? 12 : 0); },

  /* ---------- other cases: their identifiers, read once and remembered ---------- */
  X: new Map(), xBusy: null,
  async others(onProgress) {
    if (this.xBusy) return this.xBusy;
    this.X.delete(S.caseId);
    this.xBusy = (async () => {
      const list = S.cases.filter(c => c.id !== S.caseId);
      for (let n = 0; n < list.length; n++) {
        const c = list[n]; if (this.X.has(c.id)) continue;
        onProgress && onProgress(n + 1, list.length, c.name);
        let raw = null; try { raw = await DB.get('case:' + c.id); } catch (e) { }
        const M = new Map();
        if (raw && S.data) {
          const cur = S.data; S.data = Object.assign(emptyCase(), raw); Analysis.invalidate();
          try { for (const i of Analysis.idents()) { const k = this.nk(i.type, i.value); if (!k) continue; const key = i.type + '|' + k; let e = M.get(key); if (!e) M.set(key, e = { secs: new Set(), refs: [] }); e.secs.add(this.sec(i.section)); if (e.refs.length < 4 && !e.refs.includes(i.ref)) e.refs.push(i.ref || i.section); } } catch (e) { }
          finally { S.data = cur; Analysis.invalidate(); }
        }
        this.X.set(c.id, M);
        await new Promise(r => setTimeout(r, 0));
      }
      this.xBusy = null;
    })();
    return this.xBusy;
  },
  inOthers(key) { const out = []; for (const c of S.cases) { if (c.id === S.caseId) continue; const M = this.X.get(c.id), e = M && M.get(key); if (e) out.push({ c, e }); } return out; },

  /* ---------- where a record lives in the app ---------- */
  goRef(i) {
    UI.closeDrawer(); const s = this.sec(i.section), r = String(i.ref || '');
    if (s === 'NCRP') return go('ncrp');
    if (s === 'Financial') return /^Money trail/.test(r) ? go('trail') : go('financial');
    if (s === 'Social Media') { const p = Analysis.SOC_PLAT.find(x => x[3].test(r)); S.socPlat = p ? p[0] : ''; return go('social'); }
    if (s === 'Telecom') { S.telKind = /^IPDR/.test(r) ? 'ipdr' : /^Tower/.test(r) ? 'tdr' : /^SMS/.test(r) ? 'sms' : 'cdr'; return go('tele'); }
    if (s === 'CAF') return go('caf');
    go('analytics', 'cross');
  },
  chips(secs) { return [...secs].map(s => `<span class="d2-sec" style="--sc:${(this.SEC[s] || this.SEC.Others)[0]}">${(this.SEC[s] || this.SEC.Others)[1]} ${esc(s)}</span>`).join(''); },
  tico(t) { return (this.TYPE[t] || ['🔹', t])[0]; },

  /* ---------- one suspect in full ---------- */
  detail(key) {
    const g = this.groups().get(key); const oc = this.inOthers(key);
    const t = g ? g.type : key.split('|')[0], v = g ? g.value : key.split('|')[1];
    const body = UI.drawer(`${this.tico(t)} ${(this.TYPE[t] || [0, t])[1]} · ${v}`, `<div class="dx-head"><div><b>${g ? g.secs.size : 0}</b><span>sections</span></div><div><b>${g ? g.refs.size : 0}</b><span>places in this case</span></div><div><b>${oc.length}</b><span>other cases</span></div>${g && g.acc ? `<div><b>${riskBadge(g.acc.score)}</b><span>risk</span></div>` : ''}<button class="btn sm" id="d2Copy">📋 Copy</button></div>
      ${g ? `<div class="d2-chips">${this.chips(g.secs)}${g.victim ? '<span class="d2-tag v">victim number</span>' : ''}${g.suspect ? '<span class="d2-tag s">named as suspect in NCRP</span>' : ''}</div>` : ''}
      ${oc.length ? `<h4 class="d2-h">Also in your other cases</h4><div class="d2-oc">${oc.map(({ c, e }) => `<div class="list-item"><div class="grow small"><b>${esc(c.name)}</b>${c.fir ? ' · FIR ' + esc(c.fir) : ''}<br><span class="muted">${esc(e.refs.join(' | '))}</span></div><div>${this.chips(e.secs)}</div><button class="btn sm srch" data-case="${esc(c.id)}">Open case ›</button></div>`).join('')}</div>` : ''}
      <h4 class="d2-h">In this case</h4><div id="d2Rows"></div>`);
    $('#drawer').classList.add('dx-wide');
    $('#d2Copy', body).onclick = () => { navigator.clipboard && navigator.clipboard.writeText(v); UI.toast('Copied ' + v); };
    $$('[data-case]', body).forEach(b => b.onclick = () => { UI.closeDrawer(); switchCase(b.dataset.case); });
    if (g) Table($('#d2Rows', body), { rows: g.items.map(i => ({ sec: this.sec(i.section), ref: i.ref || '', raw: i.value, i })), pageSize: 50, exportName: 'suspect_' + String(v).replace(/\W+/g, '_'), sortKey: 'sec', sortDir: 1, onRow: r => this.goRef(r.i),
      columns: [{ key: 'sec', label: 'Section', render: r => this.chips([r.sec]) }, { key: 'ref', label: 'Where (click to open)' }, { key: 'raw', label: 'As written', render: r => `<span class="mono">${esc(r.raw)}</span>` }] });
  },

  /* ---------- ① track: search everything ---------- */
  async track(q) {
    q = String(q || '').trim(); if (q.length < 3) return UI.toast('Type at least 3 letters or digits');
    const ql = q.toLowerCase().replace(/\s+/g, ''), qd = q.replace(/\D/g, ''), G = this.groups();
    const hit = k => k.includes(ql) || (qd.length >= 5 && k.replace(/\D/g, '').includes(qd.slice(-10)));
    const mine = [...G.values()].filter(g => hit(g.key.split('|')[1]) || g.value.toLowerCase().includes(q.toLowerCase()));
    let text = []; try { text = Analysis.search(q).slice(0, 500); } catch (e) { }
    const body = UI.drawer(`Track: ${q}`, `<div class="dx-head"><div><b>${fmtNum(mine.length)}</b><span>identifiers</span></div><div><b>${fmtNum(text.length)}</b><span>text matches</span></div><div><b id="d2Oc">…</b><span>other cases</span></div></div>
      <h4 class="d2-h">Identifiers in this case</h4><div id="d2Ids">${mine.length ? '' : '<div class="muted small">No mobile / account / UPI / email / IP / IMEI in this case matches.</div>'}</div>
      <h4 class="d2-h">Other cases</h4><div id="d2Ot" class="muted small">Checking your other cases…</div>
      <h4 class="d2-h">Anywhere in the records (names, notes, any field)</h4><div id="d2Tx">${text.length ? '' : '<div class="muted small">No other matches.</div>'}</div>`);
    $('#drawer').classList.add('dx-wide');
    if (mine.length) Table($('#d2Ids', body), { rows: mine.map(g => ({ g, type: g.type, value: g.value, secs: g.secs.size, refs: g.refs.size })), pageSize: 25, sortKey: 'refs', sortDir: -1, exportName: 'track', onRow: r => this.detail(r.g.key),
      columns: [{ key: 'type', label: 'Type', render: r => `<span class="d2-tc" title="${esc((this.TYPE[r.type] || [0, r.type])[1])}">${this.tico(r.type)}<small>${esc((this.TYPE[r.type] || [0, r.type])[1])}</small></span>` }, { key: 'value', label: 'Identifier', render: r => `<b class="mono">${esc(r.value)}</b>` }, { key: 'secs', label: 'Sections', render: r => this.chips(r.g.secs) }, { key: 'refs', label: 'Places', num: true }] });
    if (text.length) Table($('#d2Tx', body), { rows: text, pageSize: 20, exportName: 'track_text', columns: [{ key: 'section', label: 'Section' }, { key: 'label', label: 'Record' }, { key: 'field', label: 'Field' }, { key: 'value', label: 'Value' }] });
    await this.others();
    if (!document.body.contains(body) || !$('#d2Ot', body)) return;
    const oc = [];
    for (const c of S.cases) { if (c.id === S.caseId) continue; const M = this.X.get(c.id); if (!M) continue; for (const [k, e] of M) if (hit(k.split('|')[1])) oc.push({ c, k, e }); }
    $('#d2Oc', body).textContent = fmtNum(uniq(oc.map(x => x.c.id)).length);
    $('#d2Ot', body).classList.remove('muted', 'small');
    $('#d2Ot', body).innerHTML = oc.length ? oc.slice(0, 200).map(({ c, k, e }) => `<div class="list-item"><div class="grow small">${this.tico(k.split('|')[0])} <b class="mono">${esc(k.split('|')[1])}</b> in <b>${esc(c.name)}</b><br><span class="muted">${esc(e.refs.join(' | '))}</span></div><button class="btn sm srch" data-case="${esc(c.id)}">Open case ›</button></div>`).join('') : `<div class="muted small">Not found in your ${S.cases.length - 1} other case${S.cases.length === 2 ? '' : 's'}.</div>`;
    $$('[data-case]', $('#d2Ot', body)).forEach(b => b.onclick = () => { UI.closeDrawer(); switchCase(b.dataset.case); });
  },

  /* ---------- ② every section and its tabs ---------- */
  glance() {
    const d = S.data, n = a => (a || []).length, f = fmtNum;
    let comps = [], acc = [], tel = {}; try { comps = Trail.complaints(); } catch (e) { } try { acc = Analysis.accountRows().filter(a => !isSynthetic(a.acc)); } catch (e) { }
    try { for (const k of ['cdr', 'ipdr', 'tdr', 'sms']) tel[k] = Tel.of(k).length; } catch (e) { }
    const soc = {}; for (const [id] of Analysis.SOC_PLAT) soc[id] = d.social.filter(r => Analysis.platOf(r) === id).length;
    soc.whatsapp += n(d.whatsapp); soc.telegram += n(d.telegram); soc.google += n(d.google);
    for (const r of d.meta || []) if (soc[r.platform] != null) soc[r.platform]++;
    const cafN = (window.CAF ? CAF.list() : d.caf || []).length;
    const tile = (k, ic, title, col, big, bigL, links) => `<div class="d2-tile" style="--tc:${col}"><div class="d2-th"><span class="d2-ic">${ic}</span><b>${title}</b><span class="d2-big">${big}<small>${bigL}</small></span></div><div class="d2-links">${links.map(([l, v, act, sub]) => `<button class="d2-lk ${v ? '' : 'z'}" data-act="${act}" data-sub="${sub || ''}"><span>${l}</span><b>${v}</b></button>`).join('')}</div></div>`;
    return `<div class="card d2-glance"><div class="d2-hd"><h3>Case at a glance</h3><span class="sub">Every section and its tabs – click any line to open it.</span></div><div class="d2-tiles">
      ${tile('fin', '🏦', 'Financial Trail', '#10b981', f(comps.length), 'complaints', [['Complaints (NCRP)', f(comps.length || n(d.ncrp)), 'ncrp'], ['Money Trail – transactions', f(n(d.txns)), 'trail'], ['Accounts in trail', f(acc.length), 'financial', 'suspects'], ['High-risk / mule accounts', f(acc.filter(a => a.score >= 60).length), 'financial', 'suspects'], ['KYC records', f(n(d.kyc)), 'financial'], ['Amount on hold', fmtINR(sum(acc, a => a.hold) || sum(d.ncrp, r => r.hold_amount)), 'financial', 'suspects']])}
      ${tile('soc', '💬', 'Social Media', '#ec4899', f(Object.values(soc).reduce((a, b) => a + b, 0)), 'records', [...Analysis.SOC_PLAT.map(([id, l]) => [l, f(soc[id] || 0), 'soc:' + id]), ['Other social records', f(d.social.filter(r => !Analysis.platOf(r)).length), 'soc:']])}
      ${tile('tel', '📞', 'Analytics', '#06b6d4', f((tel.cdr || 0) + (tel.ipdr || 0) + (tel.tdr || 0) + cafN), 'records', [['1. CDR Analysis', f(tel.cdr || 0), 'tel:cdr'], ['2. IPDR Analysis', f(tel.ipdr || 0), 'tel:ipdr'], ['3. TDR Analysis', f(tel.tdr || 0), 'tel:tdr'], ['4. CAF Analysis', f(cafN), 'caf'], ['5. SMS Analysis', f(tel.sms || 0), 'tel:sms'], ['Cross-section links', f([...this.groups().values()].filter(g => g.secs.size >= 2).length), 'analytics', 'cross']])}
      ${tile('case', '📁', 'Case work', '#eab308', f(n(d.imports)), 'files imported', [['Imported files', f(n(d.imports)), 'financial', 'data'], ['Notes', f(n(d.notes)), 'others'], ['Tasks open', f(d.tasks.filter(t => !t.done).length), 'others'], ['Banks to write to', f(uniq(acc.filter(a => a.layer > 0 && a.bank).map(a => a.bank.split(' / ')[0])).length), 'others', 'notices'], ['Extracted identifiers', f(n(d.idents)), 'analytics', 'cross'], ['All cases on this computer', f(S.cases.length), 'cases']])}
    </div></div>`;
  },
  bindGlance(el) {
    $$('.d2-lk', el).forEach(b => b.onclick = () => {
      const a = b.dataset.act, s = b.dataset.sub || undefined;
      if (a.startsWith('soc:')) { S.socPlat = a.slice(4); return go('social'); }
      if (a.startsWith('tel:')) { S.telKind = a.slice(4); return go('tele'); }
      if (a === 'cases') return CaseStat.list('all');
      go(a, s);
    });
  },

  /* ---------- ③ ranked suspects ---------- */
  ranked() {
    const R = [];
    for (const g of this.groups().values()) {
      const oc = this.inOthers(g.key).length;
      if (g.secs.size < 2 && g.refs.size < 3 && !oc) continue;
      R.push({ g, key: g.key, type: g.type, value: g.value, secs: g.secs.size, refs: g.refs.size, oc, score: this.score(g, oc) });
    }
    return R.sort((a, b) => b.score - a.score);
  },
  suspectsHtml() { return `<div class="card d2-sus"><div class="d2-hd"><h3>🎯 Linked suspects</h3><span class="sub">Numbers, accounts, UPI, emails, IPs and IMEIs found in 2+ sections, in many places, or in your other cases – the strongest links first. Click a row to see every place it appears.</span></div><div class="d2-types" id="d2Types"></div><div id="d2Sus"></div></div>`; },
  drawSuspects(main) {
    const el = $('#d2Sus', main); if (!el) return; const R = this.ranked(), ty = groupBy(R, r => r.type);
    $('#d2Types', main).innerHTML = `<button class="d2-ty on" data-ty="">All <b>${fmtNum(R.length)}</b></button>` + [...ty].sort((a, b) => b[1].length - a[1].length).map(([t, v]) => `<button class="d2-ty" data-ty="${esc(t)}">${this.tico(t)} ${esc((this.TYPE[t] || [0, t])[1])} <b>${fmtNum(v.length)}</b></button>`).join('');
    const draw = t => {
      $$('.d2-ty', main).forEach(b => b.classList.toggle('on', b.dataset.ty === t));
      Table(el, { rows: t ? R.filter(r => r.type === t) : R, pageSize: 12, sortKey: 'score', sortDir: -1, exportName: 'linked_suspects', onRow: r => this.detail(r.key),
        columns: [{ key: 'type', label: 'Type', render: r => `<span class="d2-tc" title="${esc((this.TYPE[r.type] || [0, r.type])[1])}">${this.tico(r.type)}<small>${esc((this.TYPE[r.type] || [0, r.type])[1])}</small></span>` },
          { key: 'value', label: 'Identifier', render: r => `<b class="mono">${esc(r.value)}</b>${r.g.acc && r.g.acc.name ? `<div class="small muted">${esc(r.g.acc.name.split(' / ')[0])}</div>` : ''}${r.g.victim && !r.g.suspect ? ' <span class="d2-tag v">victim</span>' : ''}` },
          { key: 'secs', label: 'Found in', render: r => this.chips(r.g.secs), csv: r => [...r.g.secs].join(', ') },
          { key: 'refs', label: 'Places', num: true },
          { key: 'oc', label: 'Other cases', num: true, render: r => r.oc ? `<b class="d2-ocn">${r.oc}</b>` : '–' },
          { key: 'score', label: 'Link score', num: true, render: r => `<span class="d2-score" style="--w:${Math.min(100, r.score * 2)}%"><i></i>${r.score}</span>` }] });
    };
    $$('.d2-ty', main).forEach(b => b.onclick = () => draw(b.dataset.ty)); draw('');
  },

  /* ---------- ④ common with other cases ---------- */
  commonHtml() { return `<div class="card d2-cc"><div class="d2-hd"><h3>🔗 Common with your other cases</h3><span class="sub">Identifiers of this case that also appear in another case on this computer.</span></div><div id="d2Cc" class="muted small">${S.cases.length > 1 ? 'Checking your other cases…' : 'Only one case on this computer – nothing to compare yet.'}</div></div>`; },
  drawCommon(main) {
    const el = $('#d2Cc', main); if (!el || S.cases.length < 2) return;
    const rows = [];
    for (const g of this.groups().values()) { const oc = this.inOthers(g.key); if (oc.length) rows.push({ g, key: g.key, type: g.type, value: g.value, n: oc.length, cases: oc.map(x => x.c.name).join(', '), here: g.refs.size }); }
    el.classList.remove('muted', 'small');
    if (!rows.length) { el.innerHTML = `<div class="muted small">Nothing in common with your other ${S.cases.length - 1} case${S.cases.length === 2 ? '' : 's'}.</div>`; return; }
    Table(el, { rows, pageSize: 10, sortKey: 'n', sortDir: -1, exportName: 'common_with_other_cases', onRow: r => this.detail(r.key),
      columns: [{ key: 'type', label: 'Type', render: r => `<span class="d2-tc" title="${esc((this.TYPE[r.type] || [0, r.type])[1])}">${this.tico(r.type)}<small>${esc((this.TYPE[r.type] || [0, r.type])[1])}</small></span>` }, { key: 'value', label: 'Identifier', render: r => `<b class="mono">${esc(r.value)}</b>` }, { key: 'n', label: 'Cases', num: true }, { key: 'cases', label: 'Other cases' }, { key: 'here', label: 'Places here', num: true }] });
  },

  html() {
    return `<div class="card d2-track"><div class="d2-tk"><span class="d2-tki">🔎</span><div class="grow"><b>Track a suspect</b><div class="small muted">Mobile, account, UPI, email, IP, IMEI, PAN or a name – searched in every section of this case and in all your other cases.</div></div>
      <input id="d2Q" placeholder="e.g. 98xxxxxxxx, account no., name@upi, 103.x.x.x" autocomplete="off"><button class="btn primary" id="d2Go">Track</button></div></div>
      ${this.glance()}<div class="d2-two">${this.suspectsHtml()}${this.commonHtml()}</div>`;
  }
};

(() => {
  // CAF numbers join the case-wide identifier index
  const oi = Analysis.idents;
  Analysis.idents = function () {
    const out = oi.apply(this, arguments);
    if (!out._caf && S.data.caf && S.data.caf.length) { out._caf = 1;
      for (const c of S.data.caf) { const ref = 'CAF · ' + (c.mobile || c.name || ''); const p = (t, v) => { if (v && !isSynthetic(String(v))) out.push({ type: t, value: String(v), section: 'CAF', ref, rec: c }); };
        p('mobile', c.mobile); p('mobile', c.alt); p('aadhaar', c.aadhaar); p('email', c.email); }
    }
    return out;
  };
  const og = Pages.dashboard;
  Pages.dashboard = function (main) {
    const r = og.apply(this, arguments);
    try {
      const at = $('.cs-row', main) || $('.hero-card', main); if (!at) return r;
      at.insertAdjacentHTML('afterend', `<div class="d2">${Dash2.html()}</div>`);
      const q = $('#d2Q', main); $('#d2Go', main).onclick = () => Dash2.track(q.value); q.onkeydown = e => { if (e.key === 'Enter') Dash2.track(q.value); };
      Dash2.bindGlance(main); Dash2.drawSuspects(main);
      if (S.cases.length > 1) Dash2.others((i, t, nm) => { const el = $('#d2Cc', main); if (el && el.classList.contains('muted')) el.textContent = `Checking your other cases… ${i} of ${t}`; })
        .then(() => { if (S.page !== 'dashboard' || !document.body.contains(main)) return; Dash2.drawCommon(main); Dash2.drawSuspects(main); });
    } catch (e) { console.error(e); }
    return r;
  };
  // a case that was open may have changed – read it again when it becomes "other"
  const os = window.switchCase; if (os) switchCase = async function (id) { const prev = S.caseId; const r = await os.apply(this, arguments); Dash2.X.delete(prev); Dash2.X.delete(id); return r; };
})();
