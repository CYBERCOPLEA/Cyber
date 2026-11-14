/* bankstmt.js – Money Trail & Bank › 1 Import Data › 🏦 Bank Statements (Vijay, 14-11-2026).
   Two sources: 📁 From Case File (statements already imported – this case or all cases) or ⬆ New Import received from the bank.
   Reads every statement row's description / narration (UPI id, account, IFSC, name, mode) and shows: at a glance, each statement
   account, every beneficiary / counterparty, common beneficiaries (in 2+ statements or 2+ cases), charts, network and all rows.
   Every number and row opens its transactions. Data stays on this computer. */
'use strict';
const BankStmt = {
  st() { return this._s || (this._s = { src: 'case', scope: 'one', v: 'glance', q: '' }); },
  _all: null,
  async allRows() {
    const key = S.cases.map(c => c.id + ':' + c.name).join(',') + '|' + (S.data && S.data.txns ? S.data.txns.length : 0);
    if (this._all && this._all.key === key) return this._all.rows;
    const R = [];
    for (const c of S.cases) { let d = null;
      try { d = c.id === S.caseId && S.data && !isScope(S.caseId) ? S.data : await DB.get('case:' + c.id); } catch (e) { d = null; }
      for (const t of ((d && d.txns) || [])) if (t._type === 'stmt') R.push(Object.assign({}, t, { _case: c.name || c.fir || c.id, _caseId: c.id })); }
    this._all = { key, rows: R }; return R;
  },
  oneRows() { const c = activeCase() || {}; return ((S.data && S.data.txns) || []).filter(t => t._type === 'stmt').map(t => t._case ? t : Object.assign({}, t, { _case: c.name || c.fir || '' })); },
  holder: t => t.action === 'Debit' ? t.from_acc : t.to_acc,
  cp: t => t.action === 'Debit' ? t.to_acc : t.from_acc,
  kindOf(cp) { return !cp || cp === 'UNIDENTIFIED' ? 'none' : /^CASH-OUT/.test(cp) ? 'cash' : /@/.test(cp) ? 'upi' : /^NAME:/.test(cp) ? 'name' : 'acc'; },
  model(R) {
    const H = new Map(), C = new Map(), D = new Map(), M = new Map();
    const ncrp = new Set(); for (const t of ((S.data && S.data.txns) || [])) if (t._type !== 'stmt') { if (t.to_acc) ncrp.add(t.to_acc); if (t.from_acc) ncrp.add(t.from_acc); }
    const kyc = new Map(((S.data && S.data.kyc) || []).filter(k => k.acc).map(k => [k.acc, k]));
    for (const t of R) {
      const h = this.holder(t) || '?', cp = this.cp(t) || 'UNIDENTIFIED', cr = t.action === 'Credit', a = Math.abs(t.amount || 0), d = String(t.date || '').slice(0, 10);
      if (!H.has(h)) H.set(h, { acc: h, name: '', bank: '', ifsc: '', n: 0, cr: 0, dr: 0, cash: 0, first: '', last: '', cps: new Set(), cases: new Set(), files: new Set(), recs: [] });
      const x = H.get(h); x.n++; x[cr ? 'cr' : 'dr'] += a; if (/^CASH-OUT/.test(cp)) x.cash += a; x.cps.add(cp); x.cases.add(t._case || ''); x.files.add(t._src || ''); x.recs.push(t);
      x.name = x.name || (cr ? t.to_name : t.from_name) || ''; x.bank = x.bank || (cr ? t.to_bank : t.from_bank) || ''; x.ifsc = x.ifsc || (cr ? t.to_ifsc : t.from_ifsc) || '';
      if (d && (!x.first || d < x.first)) x.first = d; if (d && d > x.last) x.last = d;
      if (!C.has(cp)) C.set(cp, { cp, kind: this.kindOf(cp), name: '', bank: '', ifsc: '', n: 0, cr: 0, dr: 0, holders: new Set(), cases: new Set(), first: '', last: '', recs: [], narr: '' });
      const y = C.get(cp); y.n++; y[cr ? 'cr' : 'dr'] += a; y.holders.add(h); y.cases.add(t._case || ''); y.recs.push(t);
      y.name = y.name || (cr ? t.from_name : t.to_name) || ''; y.bank = y.bank || (cr ? t.from_bank : t.to_bank) || ''; y.ifsc = y.ifsc || (cr ? t.from_ifsc : t.to_ifsc) || ''; y.narr = y.narr || t.remarks || '';
      if (d && (!y.first || d < y.first)) y.first = d; if (d && d > y.last) y.last = d;
      if (d) { if (!D.has(d)) D.set(d, { d, cr: 0, dr: 0, n: 0, recs: [] }); const z = D.get(d); z[cr ? 'cr' : 'dr'] += a; z.n++; z.recs.push(t); }
      const md = t.mode || 'Other'; if (!M.has(md)) M.set(md, { mode: md, n: 0, amt: 0, recs: [] }); const m = M.get(md); m.n++; m.amt += a; m.recs.push(t);
    }
    for (const y of C.values()) { const k = kyc.get(y.cp); y.ncrp = ncrp.has(y.cp); y.kyc = k ? [k.name, k.mobile, k.pan].filter(Boolean).join(' · ') : ''; if (k && !y.name) y.name = k.name || ''; }
    for (const x of H.values()) { const k = kyc.get(x.acc); x.kyc = k ? [k.name, k.mobile, k.pan, k.address].filter(Boolean).join(' · ') : ''; x.ncrp = ncrp.has(x.acc); }
    const cps = [...C.values()].filter(y => y.kind !== 'none');
    const common = cps.filter(y => y.kind !== 'cash' && (y.holders.size >= 2 || [...y.cases].filter(Boolean).length >= 2));
    return { R, H: [...H.values()], C: cps, none: C.get('UNIDENTIFIED'), common, D: [...D.values()].sort((a, b) => a.d.localeCompare(b.d)), M: [...M.values()].sort((a, b) => b.amt - a.amt),
      cr: sum(R.filter(t => t.action === 'Credit'), t => Math.abs(t.amount || 0)), dr: sum(R.filter(t => t.action !== 'Credit'), t => Math.abs(t.amount || 0)), cash: sum(cps.filter(y => y.kind === 'cash'), y => y.dr) };
  },
  recs(title, rows) { const b = UI.drawer(title, `<p class="muted small">${fmtNum(rows.length)} rows · ${fmtINR(sum(rows, t => Math.abs(t.amount || 0)))}</p><div id="bsDr"></div>`); txnTable($('#bsDr', b), rows, 200); },
  cpLabel: y => y.kind === 'cash' ? '💵 ' + y.cp.replace(/^CASH-OUT:/, 'Cash / ') : y.kind === 'upi' ? '📱 ' + y.cp : y.kind === 'name' ? '👤 ' + y.cp.slice(5) : y.cp,
  async render(el) {
    const st = this.st(), all = st.src === 'case' && st.scope === 'all';
    el.innerHTML = `<div class="card bs-src"><div class="bs-src-row"><b>Statements from</b>
        <button type="button" class="bs-o${st.src === 'case' ? ' on' : ''}" data-src="case">📁 Case File <small>statements already imported</small></button>
        <button type="button" class="bs-o${st.src === 'new' ? ' on' : ''}" data-src="new">⬆ New Import <small>statement received from the bank</small></button>
        ${st.src === 'case' ? `<span class="bs-scope"><label><input type="radio" name="bsSc" value="one" ${!all ? 'checked' : ''}> This case</label><label><input type="radio" name="bsSc" value="all" ${all ? 'checked' : ''}> All cases (${S.cases.length})</label></span>` : ''}</div>
        ${st.src === 'new' ? `<div class="bs-new"><div>Import the statement (CSV / Excel / PDF from any bank) and the beneficiary / KYC details sent by the bank. Columns are matched automatically and every narration is read for UPI ID, account, IFSC, name and mode. The statement is saved in this case.</div><button class="btn primary" id="bsImp">⬆ Import Bank Statement / KYC</button></div>` : ''}</div>
      <div id="bsBody"><div class="card muted">Reading statements…</div></div>`;
    $$('[data-src]', el).forEach(b => b.onclick = () => { st.src = b.dataset.src; this.render(el); });
    $$('input[name=bsSc]', el).forEach(r => r.onchange = () => { st.scope = r.value; this.render(el); });
    const imp = $('#bsImp', el); if (imp) imp.onclick = () => openImport(['stmt', 'kyc'], () => { st.src = 'case'; st.scope = 'one'; render(); });
    const R = all || isScope(S.caseId) ? await this.allRows().catch(() => this.oneRows()) : this.oneRows();
    this.body($('#bsBody', el), this.model(R), all || isScope(S.caseId));
  },
  body(el, m, multi) {
    const st = this.st();
    if (!m.R.length) { el.innerHTML = `<div class="card bs-empty"><h3>No bank statement ${multi ? 'in any case' : 'in this case'} yet</h3><div class="sub">Choose <b>⬆ New Import</b> above and add the statement the bank sent (CSV / Excel / PDF). ${multi ? '' : 'Or choose <b>All cases</b> to see statements of your other cases.'}</div></div>`; return; }
    const V = [['glance', '📊 At a Glance'], ['acc', '🏦 Statement Accounts', m.H.length], ['cp', '👥 Beneficiaries / Counterparties', m.C.length], ['common', '🔗 Common Beneficiaries', m.common.length], ['charts', '📈 Charts'], ['net', '🕸 Network'], ['rows', '📄 All Rows', m.R.length]];
    if (!V.some(v => v[0] === st.v)) st.v = 'glance';
    el.innerHTML = `<div class="bs-views">${V.map(([k, l, n]) => `<button type="button" class="bs-v${k === st.v ? ' on' : ''}" data-v="${k}">${l}${n != null ? ` <span class="tcount">${fmtNum(n)}</span>` : ''}</button>`).join('')}</div><div id="bsV"></div>`;
    $$('[data-v]', el).forEach(b => b.onclick = () => { st.v = b.dataset.v; this.body(el, m, multi); });
    this.V[st.v].call(this, $('#bsV', el), m, multi, v => { st.v = v; this.body(el, m, multi); });
  },
  V: {
    glance(el, m, multi, to) {
      const named = m.C.filter(y => y.kind !== 'cash'), ncrp = m.C.filter(y => y.ncrp), top = named.slice().sort((a, b) => b.dr - a.dr).slice(0, 8), topIn = named.slice().sort((a, b) => b.cr - a.cr).slice(0, 8);
      const K = [['Statement Accounts', fmtNum(m.H.length), 'acc', () => to('acc')], ['Rows Read', fmtNum(m.R.length), 'rows', () => to('rows')], ['Money In (Credit)', fmtINR(m.cr), 'cr', () => this.recs('Credits', m.R.filter(t => t.action === 'Credit'))], ['Money Out (Debit)', fmtINR(m.dr), 'dr', () => this.recs('Debits', m.R.filter(t => t.action !== 'Credit'))],
        ['Cash / ATM Out', fmtINR(m.cash), 'cash', () => this.recs('Cash / ATM withdrawals', m.C.filter(y => y.kind === 'cash').flatMap(y => y.recs))], ['Beneficiaries Found', fmtNum(named.length), 'cp', () => to('cp')], ['Common Beneficiaries', fmtNum(m.common.length), 'common', () => to('common')], ['Also In NCRP Trail', fmtNum(ncrp.length), 'ncrp', () => this.recs('Counterparties also in the NCRP trail', ncrp.flatMap(y => y.recs))]];
      el.innerHTML = `<div class="bs-kpis">${K.map((k, i) => `<button type="button" class="bs-k bs-k-${k[2]}" data-k="${i}" title="Click to see the rows"><small>${k[0]}</small><b>${k[1]}</b></button>`).join('')}</div>
        ${m.none ? `<div class="note small">${fmtNum(m.none.n)} row(s) had no UPI ID, account or name in the narration (${fmtINR(m.none.cr + m.none.dr)}). <a href="#" id="bsNone">See them</a></div>` : ''}
        <div class="bs-2"><div class="card"><h3>💸 Top Money Sent To</h3><div id="bsTo"></div></div><div class="card"><h3>💰 Top Money Received From</h3><div id="bsFrom"></div></div></div>
        <div class="bs-2"><div class="card"><h3>Payment Mode</h3><div id="bsMode"></div></div><div class="card"><h3>Statement Accounts</h3><div id="bsAccs"></div></div></div>`;
      $$('[data-k]', el).forEach(b => b.onclick = () => K[+b.dataset.k][3]());
      const nn = $('#bsNone', el); if (nn) nn.onclick = e => { e.preventDefault(); this.recs('Narration not readable', m.none.recs); };
      Charts.hbar($('#bsTo', el), top.map(y => ({ label: this.cpLabel(y), value: y.dr, sub: y.n + ' txns', recs: y.recs })), { fmt: fmtINR, onClick: d => this.recs('Sent to ' + d.label, d.recs) });
      Charts.hbar($('#bsFrom', el), topIn.filter(y => y.cr).map(y => ({ label: this.cpLabel(y), value: y.cr, sub: y.n + ' txns', recs: y.recs })), { fmt: fmtINR, onClick: d => this.recs('Received from ' + d.label, d.recs) });
      Charts.donut($('#bsMode', el), m.M.map(x => ({ label: x.mode, value: x.amt, sub: x.n + ' txns', recs: x.recs })), { fmt: fmtINR, onClick: d => this.recs('Mode ' + d.label, d.recs) });
      Charts.hbar($('#bsAccs', el), m.H.map(x => ({ label: x.acc + (x.name ? ' · ' + x.name : ''), value: x.cr + x.dr, sub: x.n + ' rows', recs: x.recs })), { fmt: fmtINR, onClick: d => this.recs(d.label, d.recs) });
    },
    acc(el, m, multi) {
      el.innerHTML = `<div class="card"><h3>Statement Accounts</h3><div class="sub">One row per account whose statement was imported. Click a row for its transactions.</div><div id="bsT"></div></div>`;
      Table($('#bsT', el), { rows: m.H.map(x => ({ ...x, ncps: x.cps.size, case: [...x.cases].filter(Boolean).join(', ') })), exportName: 'statement_accounts', sortKey: 'dr', sortDir: -1, onRow: r => this.recs('Statement ' + r.acc, r.recs), columns: [
        { key: 'acc', label: 'Account', render: r => accLink(r.acc) }, { key: 'name', label: 'Holder' }, { key: 'bank', label: 'Bank' }, { key: 'ifsc', label: 'IFSC' },
        { key: 'first', label: 'From' }, { key: 'last', label: 'To' }, { key: 'n', label: 'Rows', num: true }, { key: 'cr', label: 'Credit', num: true, fmt: fmtINR }, { key: 'dr', label: 'Debit', num: true, fmt: fmtINR },
        { key: 'cash', label: 'Cash / ATM', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'ncps', label: 'Counterparties', num: true },
        { key: 'kyc', label: 'KYC (Bank)', render: r => r.kyc ? `<span class="small">${esc(r.kyc)}</span>` : '<span class="badge warn">No KYC</span>' }, { key: 'ncrp', label: 'In NCRP', render: r => r.ncrp ? '<span class="badge bad">Yes</span>' : '' },
        ...(multi ? [{ key: 'case', label: 'Case' }] : [])], after: typeof bindAccLinks === 'function' ? bindAccLinks : undefined });
    },
    cp(el, m, multi, to, only) {
      const L = only || m.C;
      el.innerHTML = `<div class="card"><h3>${only ? '🔗 Common Beneficiaries' : '👥 Beneficiaries / Counterparties'}</h3><div class="sub">${only ? 'The same UPI ID, account or name in 2 or more statements' + (multi ? ' or cases' : '') + ' – the strongest link between suspects.' : 'Read from each row\'s description / narration: UPI ID, account number, IFSC and name. "Sent" = money that left the statement account to them; "Received" = money that came from them.'} Click a row for every transaction.</div><div id="bsT"></div></div>`;
      Table($('#bsT', el), { rows: L.map(y => ({ ...y, label: this.cpLabel(y), nh: y.holders.size, nc: [...y.cases].filter(Boolean).length, case: [...y.cases].filter(Boolean).join(', ') })), exportName: only ? 'common_beneficiaries' : 'statement_counterparties', sortKey: only ? 'nh' : 'dr', sortDir: -1, onRow: r => this.recs(r.label, r.recs), columns: [
        { key: 'label', label: 'Beneficiary (UPI / Account / Name)', render: r => r.kind === 'acc' ? accLink(r.cp) : `<b>${esc(r.label)}</b>` }, { key: 'name', label: 'Name' }, { key: 'bank', label: 'Bank' }, { key: 'ifsc', label: 'IFSC' },
        { key: 'dr', label: 'Sent', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'cr', label: 'Received', num: true, fmt: v => v ? fmtINR(v) : '' }, { key: 'n', label: 'Txns', num: true },
        { key: 'nh', label: 'Statements', num: true, render: r => r.nh > 1 ? `<span class="badge bad">${r.nh}</span>` : r.nh }, ...(multi ? [{ key: 'nc', label: 'Cases', num: true, render: r => r.nc > 1 ? `<span class="badge bad">${r.nc}</span>` : r.nc }, { key: 'case', label: 'Case Names' }] : []),
        { key: 'first', label: 'First' }, { key: 'last', label: 'Last' },
        { key: 'kyc', label: 'KYC (Bank)', render: r => r.kyc ? `<span class="small">${esc(r.kyc)}</span>` : '' }, { key: 'ncrp', label: 'In NCRP', render: r => r.ncrp ? '<span class="badge bad">Yes</span>' : '' },
        { key: 'narr', label: 'Sample Narration', render: r => `<span class="small muted">${esc(String(r.narr).slice(0, 70))}</span>` }], after: typeof bindAccLinks === 'function' ? bindAccLinks : undefined });
    },
    common(el, m, multi, to) {
      if (!m.common.length) { el.innerHTML = `<div class="card"><h3>🔗 Common Beneficiaries</h3><div class="sub">No beneficiary appears in 2 or more statements${multi ? ' or cases' : ''} yet. ${multi ? '' : 'Choose <b>All cases</b> above to compare with your other cases.'}</div></div>`; return; }
      BankStmt.V.cp.call(this, el, m, multi, to, m.common);
    },
    charts(el, m) {
      el.innerHTML = `<div class="card"><h3>Money In and Out per Day</h3><div id="bsDay" class="bs-ch"></div></div><div class="bs-2"><div class="card"><h3>Credit by Statement Account</h3><div id="bsC1"></div></div><div class="card"><h3>Debit by Statement Account</h3><div id="bsC2"></div></div></div>`;
      Charts.vbar($('#bsDay', el), m.D.map(z => ({ label: z.d.slice(5), value: z.cr + z.dr, sub: `In ${fmtINR(z.cr)} · Out ${fmtINR(z.dr)} · ${z.n} txns`, recs: z.recs })), { fmt: fmtINR, onClick: d => this.recs('Day ' + d.label, d.recs) });
      Charts.hbar($('#bsC1', el), m.H.filter(x => x.cr).map(x => ({ label: x.acc, value: x.cr, recs: x.recs.filter(t => t.action === 'Credit') })), { fmt: fmtINR, onClick: d => this.recs('Credits ' + d.label, d.recs) });
      Charts.hbar($('#bsC2', el), m.H.filter(x => x.dr).map(x => ({ label: x.acc, value: x.dr, recs: x.recs.filter(t => t.action !== 'Credit') })), { fmt: fmtINR, onClick: d => this.recs('Debits ' + d.label, d.recs) });
    },
    net(el, m) {
      const cps = m.C.slice().sort((a, b) => (b.holders.size - a.holders.size) || (b.cr + b.dr - a.cr - a.dr)).slice(0, 160), keep = new Set(cps.map(y => y.cp));
      const nodes = [...m.H.map(x => ({ id: x.acc, label: x.acc, sub: [x.name, x.bank].filter(Boolean).join(' · '), kind: x.ncrp ? 'risk' : 'victim', value: x.cr + x.dr, title: `Statement account ${x.acc}\n${x.name || ''}` })),
        ...cps.filter(y => !m.H.some(x => x.acc === y.cp)).map(y => ({ id: y.cp, label: this.cpLabel(y).replace(/^\S+ /, ''), sub: y.name || y.bank || '', kind: y.kind === 'cash' ? 'cash' : y.holders.size > 1 ? 'risk' : y.ncrp ? 'hold' : 'account', value: y.cr + y.dr, title: `${y.cp}\nSent ${fmtINR(y.dr)} · Received ${fmtINR(y.cr)}` }))];
      const E = new Map(); for (const t of m.R) { const h = this.holder(t), c = this.cp(t); if (!keep.has(c) && !m.H.some(x => x.acc === c)) continue; const [f, to] = t.action === 'Credit' ? [c, h] : [h, c], k = f + '>' + to; if (!E.has(k)) E.set(k, { from: f, to, amount: 0, count: 0, txns: [] }); const e = E.get(k); e.amount += Math.abs(t.amount || 0); e.count++; e.txns.push(t); }
      el.innerHTML = `<div class="card"><h3>🕸 Statement Network</h3><div class="sub">Statement accounts in the middle, every beneficiary around them. <b>Red</b> = in 2+ statements (common) or also in the NCRP trail; <b>orange</b> = cash / ATM. Click a dot for its transactions.${m.C.length > 160 ? ' Showing the 160 biggest of ' + m.C.length + '.' : ''}</div><div class="graph-box" id="bsNet" style="height:560px"></div></div>`;
      try { Graph.mount($('#bsNet', el), nodes, [...E.values()], { mode: 'net', labels: true, onNode: n => { const y = m.C.find(z => z.cp === n.id), x = m.H.find(z => z.acc === n.id); this.recs(n.id, (x || y || { recs: [] }).recs); } }); } catch (e) { $('#bsNet', el).innerHTML = `<div class="muted">Network could not be drawn: ${esc(e.message)}</div>`; }
    },
    rows(el, m, multi) {
      const st = this.st();
      el.innerHTML = `<div class="card"><div class="row"><h3 class="grow">All Statement Rows</h3><input id="bsQ" placeholder="Find in narration, UPI, account, name, UTR…" value="${esc(st.q)}" style="width:320px"></div><div id="bsT"></div></div>`;
      const draw = () => { const q = st.q.trim().toLowerCase(); txnTable($('#bsT', el), q ? m.R.filter(t => [t.remarks, t.to_acc, t.from_acc, t.to_name, t.from_name, t.txn_id, t.cp_upi, t._case].join(' ').toLowerCase().includes(q)) : m.R, 200); };
      $('#bsQ', el).oninput = e => { st.q = e.target.value; clearTimeout(this._qt); this._qt = setTimeout(draw, 250); }; draw();
    }
  }
};
/* Step 1 of Money Trail & Bank: All Transactions & Files · 🏦 Bank Statements · KYC / Beneficiary */
(() => { if (typeof FinFlow === 'undefined') return; const s = FinFlow.STEPS.find(x => x[0] === 'import'); if (!s) return;
  s[4].splice(1, 0, ['stmt', '🏦 Bank Statements', el => BankStmt.render(el)]); FinFlow.OLD.stmt = 'stmt'; FinFlow.OLD.statements = 'stmt';
  s[3] = 'NCRP bank action sheet, bank statements (analysed from the narration), money trail made in Excel by EO / IO, KYC'; })();
