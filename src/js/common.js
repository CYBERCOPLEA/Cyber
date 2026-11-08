/* Analytics → Common Suspect: import many NCRP bank-action files at once,
   then find values (account, IFSC, mobile, e-mail, state, district, ATM, cheque…) shared by several complaints. */
const CommonSus = {
  FIELDS: [
    ['acc', 'Account'], ['ifsc', 'IFSC'], ['mobile', 'Mobile'], ['email', 'Email'], ['state', 'State'], ['district', 'District'],
    ['atm', 'ATM location'], ['cheque', 'Cheque withdrawal'], ['bank', 'Bank'], ['name', 'Account holder name'], ['pan', 'PAN'], ['aadhaar', 'Aadhaar'], ['utr', 'UTR / Txn ID']
  ],
  file: t => String(t._src || '').replace(/\s*\[[^\]]*\]\s*$/, '') || '(manual)',
  isCheque(t) { if (/cheque|chq/i.test(t._src || '') || /cheque|chq/i.test(t.action || '') || /cheque|chq/i.test(t.mode || '')) return true; const r = t._raw; return !!(r && Object.keys(r).some(k => /cheque|chq/i.test(k) && r[k])); },
  isAtm(t) { return !!t.atm_loc || /atm/i.test(t._src || '') || /atm/i.test(t.action || '') || /atm/i.test(t.mode || ''); },
  BADBANK: /withdraw|transfer|hold|action|cheque|freez|lien|debit|credit/i,
  bankOf(t) { const b = String(t.to_bank || '').split(' / ')[0]; return b && !this.BADBANK.test(b) ? b : this.rawBy(t, /^bank/i, this.BADBANK); },
  rawBy(t, re, bad) { const r = t._raw; if (!r) return ''; const k = Object.keys(r).find(k => re.test(k) && r[k] && !(bad && bad.test(String(r[k])))); return k ? String(r[k]) : ''; },
  // values a transaction row gives for a field (suspect side only: the victim's own account at layer 1 is left out)
  vals(t, f) {
    const sus = (t.layer || 0) > 1, out = [];
    const add = v => { v = String(v ?? '').trim(); if (v && !/^(na|n\/a|nil|null|none|-|0)$/i.test(v)) out.push(v); };
    switch (f) {
      case 'acc': add(t.to_acc); if (sus) add(t.from_acc); break;
      case 'ifsc': add(N.ifsc(t.to_ifsc)); if (sus) add(N.ifsc(t.from_ifsc)); break;
      case 'mobile': String(t.mobile || '').split(/[,;\/]/).forEach(m => { const v = N.mobile(m); if (v.length === 10) add(v); }); break;
      case 'email': String(t.email || '').split(/[,;\s]+/).filter(x => x.includes('@')).forEach(e => add(N.email(e))); break;
      case 'state': add(N.upper(t.state)); break;
      case 'district': add(N.upper(t.district)); break;
      case 'atm': if (this.isAtm(t)) add(N.upper(this.rawBy(t, /place|location|address/i) || t.atm_loc || this.rawBy(t, /atm/i))); break;
      case 'cheque': if (this.isCheque(t)) add(t.to_acc || t.from_acc); break;
      case 'bank': add(N.upper(this.bankOf(t))); break;
      case 'name': add(N.upper(t.to_name)); break;
      case 'pan': add(N.pan(t.pan)); break;
      case 'aadhaar': { const a = N.aadhaar(t.aadhaar); if (a.length >= 8) add(a); break; }
      case 'utr': add(t.txn_id); break;
    }
    return out;
  },
  groups(f) {
    return Analysis.cached('cs:' + f, () => {
      const G = new Map();
      for (const t of S.data.txns) for (const v of this.vals(t, f)) {
        let g = G.get(v); if (!g) G.set(v, g = { value: v, acks: new Set(), files: new Set(), banks: new Set(), names: new Set(), layers: new Set(), places: new Set(), chq: new Set(), rows: [], amount: 0, dates: [] });
        if (t.ack_no) g.acks.add(t.ack_no); g.files.add(this.file(t)); g.rows.push(t); g.amount += Math.abs(+t.amount || 0);
        { const bk = this.bankOf(t); if (bk) g.banks.add(bk); } if (t.to_name) g.names.add(N.upper(t.to_name)); if (t.layer) g.layers.add(t.layer);
        { const pl = this.rawBy(t, /place|location|address/i), id = this.rawBy(t, /atm\s*id|terminal|tid/i) || t.atm_loc; const v = [pl, id && id !== pl ? id : ''].filter(Boolean).join(' · '); if (v) g.places.add(v); } if (f === 'cheque') { const c = this.rawBy(t, /cheque|chq/i); if (c) g.chq.add(c); }
        if (t.date) g.dates.push(String(t.date));
      }
      return [...G.values()].map(g => { g.dates.sort(); return {
        value: g.value, complaints: g.acks.size, ackList: [...g.acks].join(', '), files: g.files.size, fileList: [...g.files].join(', '), n: g.rows.length, amount: g.amount,
        banks: [...g.banks].slice(0, 4).join(', '), names: [...g.names].slice(0, 4).join(', '), layers: [...g.layers].sort((a, b) => a - b).join(', '),
        places: [...g.places].slice(0, 4).join(', '), chq: [...g.chq].slice(0, 6).join(', '), first: g.dates[0] || '', last: g.dates[g.dates.length - 1] || '', rows: g.rows }; });
    });
  },

  /* read many files; every sheet that looks like NCRP bank-action rows is added */
  async importMany(files, report) {
    const key = t => [t.ack_no, t.layer, t.from_acc, t.to_acc, t.txn_id, t.amount, t.date, t.action].join('|');
    const have = new Set(S.data.txns.map(key));
    const out = [];
    for (const [k, file] of [...files].entries()) {
      report(`Reading ${k + 1} of ${files.length}: ${file.name}`);
      await new Promise(r => setTimeout(r, 0));
      let parsed; try { parsed = await Parsers.readFile(file, () => null); } catch (e) { out.push({ file: file.name, err: e.message || String(e) }); continue; }
      const res = { file: file.name, sheets: [], added: 0, dup: 0, acks: new Set() };
      parsed.sheets.forEach(sh => {
        const rows = sh.rows; if (!rows || rows.length < 2) return;
        const h = Parsers.detectHeader(rows, 'txn'), map = Parsers.autoMap(rows[h] || [], 'txn');
        if (Object.keys(map).length < 3 || (map.to_acc == null && map.from_acc == null)) return;
        const src = parsed.name + (parsed.sheets.length > 1 ? ' [' + sh.name + ']' : '');
        const recs = Parsers.build('txn', rows, h, map).map(o => Parsers.normTxn(o, src)).filter(r => r.from_acc || r.to_acc || r.amount);
        let add = 0;
        for (const r of recs) { const kk = key(r); if (have.has(kk)) { res.dup++; continue; } have.add(kk); S.data.txns.push(r); add++; if (r.ack_no) res.acks.add(r.ack_no); }
        if (add) S.data.imports.push({ id: uid(), when: new Date().toISOString(), file: src, type: 'txn', count: add });
        res.sheets.push(`${sh.name} (${add})`); res.added += add;
      });
      out.push(res);
    }
    Analysis.invalidate(); await saveCase();
    return out;
  }
};

AnaTabs.common = el => {
  const f = S.csField || 'acc', minC = S.csMin == null ? 2 : S.csMin, by = S.csBy || 'complaints';
  const L = Object.fromEntries(CommonSus.FIELDS);
  const nAck = uniq(S.data.txns.map(t => t.ack_no).filter(Boolean)).length, nFiles = uniq(S.data.txns.map(CommonSus.file)).length;
  const keep = g => (by === 'files' ? g.files : g.complaints) >= minC;
  el.innerHTML = `<div class="card cs-imp"><div class="row" style="align-items:center;gap:14px">
      <button class="btn primary big" id="csImp">⬆ Import multiple NCRP bank action sheets</button>
      <div class="grow small muted">Choose many NCRP bank-action files at once (Excel / CSV). Every sheet is read: Money Transfer, ATM withdrawal, Cheque withdrawal, Put on hold, Others. Rows already imported are skipped.</div>
      <input type="file" id="csPick" multiple accept=".xlsx,.xls,.xlsb,.ods,.csv,.txt,.html,.htm" class="hidden"></div>
      <div class="cs-stat"><span><b>${fmtNum(nAck)}</b> complaints</span><span><b>${fmtNum(nFiles)}</b> files</span><span><b>${fmtNum(S.data.txns.length)}</b> bank-action rows</span></div>
      <div id="csMsg"></div></div>
    <div class="card"><h3>Common Suspect</h3><div class="sub">Values found in two or more complaints point to the same suspect, mule account or cash-out point. Pick what to compare:</div>
      <div class="cs-fields">${CommonSus.FIELDS.map(([k, l]) => `<button class="btn sm ${k === f ? 'primary' : ''}" data-cf="${k}">${l} <span class="badge">${CommonSus.groups(k).filter(keep).length}</span></button>`).join('')}</div>
      <div class="row" style="margin-top:10px"><label>Common in at least</label><select id="csMin">${[1, 2, 3, 4, 5, 10].map(n => `<option ${n === minC ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select id="csBy"><option value="complaints" ${by === 'complaints' ? 'selected' : ''}>complaints</option><option value="files" ${by === 'files' ? 'selected' : ''}>files</option></select></div></div>
    <div class="card"><h3>Common ${esc(L[f])}</h3><div class="sub">Click a row to see every transaction behind it. Use the filter box, sort A → Z / Z → A, or download CSV.</div><div id="csT"></div></div>`;
  $$('[data-cf]', el).forEach(b => b.onclick = () => { S.csField = b.dataset.cf; AnaTabs.common(el); });
  $('#csMin', el).onchange = e => { S.csMin = +e.target.value; AnaTabs.common(el); };
  $('#csBy', el).onchange = e => { S.csBy = e.target.value; AnaTabs.common(el); };
  const pick = $('#csPick', el);
  $('#csImp', el).onclick = () => { pick.value = ''; pick.click(); };
  pick.onchange = async () => {
    if (!pick.files.length) return;
    const msg = $('#csMsg', el), btn = $('#csImp', el); btn.disabled = true;
    const res = await CommonSus.importMany(pick.files, t => msg.innerHTML = `<div class="note">${esc(t)}</div>`);
    const tot = res.reduce((a, r) => a + (r.added || 0), 0), dup = res.reduce((a, r) => a + (r.dup || 0), 0);
    UI.toast(`Imported ${fmtNum(tot)} rows from ${res.length} files`);
    render();
    const m2 = $('#csMsg'); if (m2) m2.innerHTML = `<div class="note">✔ Imported <b>${fmtNum(tot)}</b> rows from <b>${res.length}</b> files${dup ? ` · ${fmtNum(dup)} rows were already there and skipped` : ''}.<br>${res.map(r => r.err ? `<span class="err">✖ ${esc(r.file)}: ${esc(r.err)}</span>` : `${esc(r.file)}: ${fmtNum(r.added)} rows, ${r.acks.size} complaints${r.sheets.length ? ' · sheets ' + esc(r.sheets.join(', ')) : ' · no bank-action sheet found'}`).join('<br>')}</div>`;
  };
  const isAcc = f === 'acc' || f === 'cheque';
  const extra = f === 'atm' ? [] : f === 'cheque' ? [{ key: 'chq', label: 'Cheque no.' }, { key: 'places', label: 'Place' }] : [{ key: 'places', label: 'ATM / place' }];
  Table($('#csT', el), {
    rows: CommonSus.groups(f).filter(keep), exportName: 'common_suspect_' + f, sortKey: by === 'files' ? 'files' : 'complaints', sortDir: -1, pageSize: 50,
    columns: [
      { key: 'value', label: L[f], render: r => isAcc ? accLink(r.value) : `<span class="mono">${esc(r.value)}</span>` },
      { key: 'complaints', label: 'Complaints', num: true }, { key: 'files', label: 'Files', num: true }, { key: 'n', label: 'Rows', num: true },
      { key: 'amount', label: 'Amount', num: true, render: r => fmtINR(r.amount) },
      ...(f === 'bank' ? [] : [{ key: 'banks', label: 'Bank' }]), ...(f === 'name' ? [] : [{ key: 'names', label: 'Name' }]), { key: 'layers', label: 'Layers' }, ...extra,
      { key: 'ackList', label: 'Complaint numbers', render: r => `<span class="small">${esc(r.ackList.slice(0, 160))}${r.ackList.length > 160 ? '…' : ''}</span>` },
      { key: 'fileList', label: 'Files list', render: r => `<span class="small muted">${esc(r.fileList.slice(0, 120))}${r.fileList.length > 120 ? '…' : ''}</span>` },
      { key: 'first', label: 'First' }, { key: 'last', label: 'Last' }
    ],
    after: bindAccLinks,
    onRow: r => UI.drawer(`${L[f]}: ${r.value}`, `<div class="small muted" style="margin-bottom:8px">${r.complaints} complaints · ${r.files} files · ${r.n} rows · ${fmtINR(r.amount)}</div>` + r.rows.slice(0, 300).map(t => `<div class="list-item"><div class="grow small"><b class="mono">${esc(t.ack_no || '')}</b> · Layer ${esc(t.layer || '')} · ${fmtINR(Math.abs(+t.amount || 0))} · ${esc(t.date || '')}<br>${esc(t.from_acc || '')} → <b>${esc(t.to_acc || '')}</b> ${esc([t.to_name, t.to_bank, t.to_ifsc].filter(Boolean).join(' · '))}<br>${esc([t.action, t.atm_loc, t.mobile, t.email, t.state, t.district].filter(Boolean).join(' · '))}<br><span class="muted">${esc(t._src || '')}</span></div></div>`).join('') + (r.rows.length > 300 ? `<div class="muted small">…and ${r.rows.length - 300} more (download CSV from the table)</div>` : ''))
  });
};
