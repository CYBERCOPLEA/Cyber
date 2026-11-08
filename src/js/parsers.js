/* parsers.js - read CSV / Excel / PDF / text into rows, detect headers, map columns */
'use strict';

if (window.pdfjsLib) { try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/lib/pdf.worker.min.js'; } catch (e) { } }

const Parsers = {
  async readFile(file, askPassword) {
    const name = file.name, ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return Parsers.readPdf(file, askPassword);
    if (['txt', 'log'].includes(ext)) { const text = await file.text(); return { name, kind: 'text', text, sheets: [{ name: 'Text', rows: Parsers.textToRows(text) }] }; }
    const buf = await file.arrayBuffer();
    let wb;
    try { wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: false, dense: false }); }
    catch (e) {
      if (/password|encrypt/i.test(e.message)) throw new Error('This Excel file is password protected. Open it in Excel, remove the password (File > Info > Protect), save, and import again.');
      throw e;
    }
    const sheets = wb.SheetNames.map(sn => ({ name: sn, rows: XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '', blankrows: false }) }))
      .filter(s => s.rows.length);
    const text = sheets.map(s => s.rows.map(r => r.join(' \t ')).join('\n')).join('\n');
    return { name, kind: 'table', sheets, text };
  },

  textToRows(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const delim = ['\t', ',', '|', ';'].map(d => [d, lines.slice(0, 20).filter(l => l.includes(d)).length]).sort((a, b) => b[1] - a[1])[0];
    if (delim[1] >= Math.min(3, lines.length)) return Parsers.csv(text, delim[0]);
    return lines.map(l => l.split(/\s{2,}/).map(c => c.trim()));
  },

  csv(text, d = ',') {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"' && cell === '') q = true;
      else if (ch === d) { row.push(cell.trim()); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); cell = ''; if (row.some(c => c !== '')) rows.push(row); row = []; }
      else cell += ch;
    }
    row.push(cell.trim()); if (row.some(c => c !== '')) rows.push(row);
    return rows;
  },

  async readPdf(file, askPassword) {
    if (!window.pdfjsLib) throw new Error('PDF library not loaded');
    const data = new Uint8Array(await file.arrayBuffer());
    const task = pdfjsLib.getDocument({ data, isEvalSupported: false });
    task.onPassword = (update, reason) => {
      const pw = askPassword ? askPassword(reason === 2 ? 'Wrong password. Try again:' : 'This PDF is password protected (bank statements often use DOB / customer ID). Enter password:') : null;
      if (pw == null) { task.destroy(); return; }
      update(pw);
    };
    const pdf = await task.promise;
    const lines = []; let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || i.str.length * 4 }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const pl = [];
      for (const it of items) { const ln = pl.find(l => Math.abs(l.y - it.y) < 3); if (ln) ln.items.push(it); else pl.push({ y: it.y, items: [it] }); }
      pl.sort((a, b) => b.y - a.y);
      for (const ln of pl) { ln.items.sort((a, b) => a.x - b.x); lines.push(ln.items); text += ln.items.map(i => i.s).join('  ') + '\n'; }
    }
    if (!text.trim()) throw new Error('No text found in this PDF. It is probably a scanned image. Please get a digital (text) PDF or Excel/CSV copy from the bank, or OCR it first.');
    const merge = (items, gap) => { const cells = []; let cur = null; for (const it of items) { if (cur && it.x - (cur.x + cur.w) < gap) { cur.s += (it.x - (cur.x + cur.w) > 1.5 ? ' ' : '') + it.s; cur.w = it.x + it.w - cur.x; } else { cur = { ...it }; cells.push(cur); } } return cells; };
    // find a header line and use its cells as column anchors
    const KW = /date|narration|description|particular|debit|credit|withdraw|deposit|balance|amount|ref|cheque|chq|utr|details|remarks|account|transaction|mode|name|ifsc|mobile|email|layer/i;
    let hIdx = -1, hCells = null;
    let hBest = 2;
    for (let i = 0; i < Math.min(lines.length, 80); i++) {
      const c = merge(lines[i], 4); if (c.length < 3) continue;
      const sc = c.filter(x => KW.test(x.s) && x.s.length < 40).length - c.filter(x => /:|\d{4,}/.test(x.s)).length * 2;
      if (sc > hBest) { hBest = sc; hIdx = i; hCells = c; }
    }
    const rows = lines.map((items, i) => {
      if (!hCells || i <= hIdx) return merge(items, 6).map(c => c.s.trim());
      const row = new Array(hCells.length).fill('');
      for (const it of merge(items, 3)) {
        let best = 0, bs = -Infinity;
        hCells.forEach((h, k) => { const ov = Math.min(it.x + it.w, h.x + h.w) - Math.max(it.x, h.x); const sc = ov > 0 ? ov : -Math.min(Math.abs(it.x - (h.x + h.w)), Math.abs(h.x - (it.x + it.w))); if (sc > bs) { bs = sc; best = k; } });
        row[best] = (row[best] ? row[best] + ' ' : '') + it.s.trim();
      }
      return row;
    });
    return { name: file.name, kind: 'pdf', text, sheets: [{ name: 'PDF (' + pdf.numPages + ' pages)', rows, pdf: true }] };
  },

  // score each of first 40 rows for being the header row
  detectHeader(rows, type) {
    const pats = FIELDS[type].flatMap(f => f[2]);
    let best = 0, bestScore = -1;
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const cells = rows[i].map(c => N.hdr(c)).filter(Boolean);
      if (cells.length < 2) continue;
      let score = 0;
      for (const c of cells) if (pats.some(p => c.includes(p.toLowerCase()))) score++;
      if (cells.some(c => /^\d+$/.test(c))) score -= 1;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  },

  autoMap(headers, type) {
    const map = {}; const taken = new Set();
    const hs = headers.map(h => N.hdr(h));
    for (const [key, , pats] of FIELDS[type]) {
      outer: for (const p of pats) {
        const pl = p.toLowerCase();
        for (let i = 0; i < hs.length; i++) {
          if (taken.has(i) || !hs[i]) continue;
          if (pl.length <= 3 ? hs[i] === pl || hs[i].startsWith(pl) && hs[i].length <= pl.length + 3 : hs[i].includes(pl)) { map[key] = i; taken.add(i); break outer; }
        }
      }
    }
    return map;
  },

  // rows -> raw objects using header + mapping. Handles PDF multi-line narration for statements.
  build(type, rows, hIdx, map, extra = {}) {
    const headers = rows[hIdx] || [];
    const out = [];
    const body = rows.slice(hIdx + 1);
    for (const r of body) {
      if (!r || r.every(c => String(c ?? '').trim() === '')) continue;
      // skip repeated header rows (multi-page PDFs)
      if (r.map(N.hdr).join('|') === headers.map(N.hdr).join('|')) continue;
      const o = {};
      for (const [k, i] of Object.entries(map)) if (i !== '' && i != null && i >= 0) o[k] = r[i];
      if (type === 'stmt') {
        const hasDate = isDateLike(o.date) || o.date instanceof Date || typeof o.date === 'number';
        const hasAmt = [o.debit, o.credit, o.amount].some(v => N.amount(v) != null && N.amount(v) !== 0);
        if (!hasDate) { // continuation line of previous narration
          if (out.length && !hasAmt) { const t = r.filter(c => String(c).trim()).join(' '); if (t.length < 200) out[out.length - 1].narration = (out[out.length - 1].narration || '') + ' ' + t; }
          continue;
        }
        if (!hasAmt) continue;
      }
      o._raw = Object.fromEntries(headers.map((h, i) => [String(h || 'col' + (i + 1)), r[i] instanceof Date ? N.date(r[i]) : r[i]]).filter(([, v]) => v !== '' && v != null));
      Object.assign(o, extra);
      out.push(o);
    }
    return out;
  },

  /* ---------- normalise into stored records ---------- */
  normTxn(o, src) {
    const r = {
      id: uid(), _src: src, _type: 'trail',
      ack_no: N.ack(o.ack_no), layer: o.layer === '' || o.layer == null ? null : parseInt(String(o.layer).replace(/\D/g, '')) || null,
      from_acc: N.acc(o.from_acc), from_name: N.upper(o.from_name), from_bank: N.text(o.from_bank), from_ifsc: N.ifsc(o.from_ifsc),
      to_acc: N.acc(o.to_acc), to_name: N.upper(o.to_name), to_bank: N.text(o.to_bank), to_ifsc: N.ifsc(o.to_ifsc),
      amount: N.amount(o.amount), disputed: N.amount(o.disputed), hold: N.amount(o.hold), date: (d => { const tm = N.time(o.time); return d && tm && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + ' ' + tm : d; })(N.date(o.date)), txn_id: N.acc(o.txn_id),
      mode: N.upper(o.mode), action: N.text(o.action), atm_loc: N.text(o.atm_loc), mobile: N.mobile(o.mobile), email: N.email(o.email),
      pan: N.pan(o.pan), aadhaar: N.aadhaar(o.aadhaar), state: N.upper(o.state), district: N.upper(o.district), remarks: N.text(o.remarks), _raw: o._raw
    };
    if (!r.to_bank && r.to_ifsc) r.to_bank = bankFromIfsc(r.to_ifsc);
    if (!r.from_bank && r.from_ifsc) r.from_bank = bankFromIfsc(r.from_ifsc);
    const a = (r.action + ' ' + r.mode + ' ' + r.remarks).toLowerCase();
    if (!r.to_acc && /atm|cash|withdraw|aeps|pos|cheque/.test(a)) r.to_acc = 'CASH-OUT' + (r.atm_loc ? ':' + N.upper(r.atm_loc).slice(0, 30) : '');
    if (/hold|lien|freez/i.test(r.action) && (!r.to_acc || r.to_acc === r.from_acc)) { r.holdOnly = true; r.to_acc = r.to_acc || r.from_acc; r.hold = r.hold || r.amount; }
    return r;
  },

  parseNarration(n) {
    const s = String(n || '').toUpperCase();
    const res = { mode: '', cp_acc: '', cp_name: '', cp_ifsc: '', cp_upi: '', utr: '' };
    const modes = [['UPI', /\bUPI\b/], ['IMPS', /\bIMPS\b|\bMMT\b/], ['NEFT', /\bNEFT\b/], ['RTGS', /\bRTGS\b/], ['ATM', /\bATM\b|\bATW\b|\bNWD\b|\bAWD\b/], ['AEPS', /\bAEPS\b/], ['POS', /\bPOS\b|\bPCD\b/], ['CASH', /\bCASH\b|\bCSH\b|\bSELF\b/], ['CHEQUE', /\bCHQ\b|\bCHEQUE\b|\bCLG\b/], ['NACH', /\bNACH\b|\bACH\b|\bECS\b/], ['TRANSFER', /\bTRF\b|\bTRANSFER\b|\bFT\b/]];
    for (const [m, rx] of modes) if (rx.test(s)) { res.mode = m; break; }
    const upi = String(n || '').match(/[A-Za-z0-9._\-]{2,}@[A-Za-z]{2,}/); if (upi) res.cp_upi = upi[0].toLowerCase();
    const ifsc = s.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/); if (ifsc) res.cp_ifsc = ifsc[0];
    const toks = s.split(/[\/\-:|*]+/).map(t => t.trim()).filter(Boolean);
    const nums = toks.filter(t => /^\d{9,18}$/.test(t));
    if (res.mode === 'UPI' || res.mode === 'IMPS') { const u = nums.find(t => t.length === 12); if (u) res.utr = u; }
    if (res.mode === 'NEFT' || res.mode === 'RTGS') { const u = toks.find(t => /^[A-Z]{4}[A-Z0-9]{10,18}$/.test(t) && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(t)) || toks.find(t => /^[A-Z0-9]{12,22}$/.test(t) && /\d/.test(t)); if (u) res.utr = u; }
    const cand = nums.filter(t => t !== res.utr);
    const acc = cand.find(t => !(t.length === 10 && /^[6-9]/.test(t))) || (res.cp_ifsc ? cand[0] : ''); if (acc) res.cp_acc = acc;
    const stop = new Set(['UPI', 'DR', 'CR', 'IMPS', 'NEFT', 'RTGS', 'P2A', 'P2P', 'P2M', 'TRANSFER', 'PAYMENT', 'TO', 'FROM', 'BY', 'TRF', 'MMT', 'INB', 'MOB', 'IB', 'FT', 'ATM', 'CASH', 'WDL', 'NWD', 'POS', 'REV', 'PAY', 'SENT', 'RECEIVED', 'COLLECT', 'REQUEST', 'BANK', 'LTD', 'NA', 'NULL', 'OK', 'TXN', 'REF', 'NO', 'SELF', 'SBI', 'HDFC', 'ICICI', 'AXIS', 'PNB', 'BOB', 'YESB', 'PAYTM', 'YBL']);
    const nm = toks.find(t => /^[A-Z][A-Z .]{2,}$/.test(t) && !stop.has(t) && !(t.length <= 5 && BANKS[t.slice(0, 4)]) && !/^[A-Z]{4}0/.test(t) && t.split(' ').some(w => w.length > 1 && !stop.has(w)) && !t.split(' ').some(w => ['ATM', 'WDL', 'CASH', 'NWD', 'CHARGES', 'GST', 'INTEREST'].includes(w)));
    if (nm) res.cp_name = nm.trim();
    return res;
  },

  stmtToTxns(rows, holder, src) {
    const out = [];
    for (const o of rows) {
      let debit = N.amount(o.debit), credit = N.amount(o.credit);
      if (debit == null && credit == null && o.amount != null) {
        const amt = N.amount(o.amount); const ind = String(o.drcr || o.amount || '').toUpperCase();
        if (/D/.test(ind) && !/CR/.test(ind) || amt < 0) debit = Math.abs(amt); else credit = Math.abs(amt);
      }
      debit = debit ? Math.abs(debit) : 0; credit = credit ? Math.abs(credit) : 0;
      if (!debit && !credit) continue;
      const p = Parsers.parseNarration(o.narration);
      let cp = ['ATM', 'CASH', 'AEPS', 'POS'].includes(p.mode) && debit ? 'CASH-OUT:' + p.mode + (p.cp_name ? ' ' + p.cp_name : '') : (p.cp_acc || p.cp_upi || (p.cp_name ? 'NAME:' + p.cp_name : ''));
      if (!cp) cp = 'UNIDENTIFIED';
      const base = {
        id: uid(), _src: src, _type: 'stmt', ack_no: holder.ack_no || '', layer: null, amount: debit || credit, date: N.date(o.date),
        txn_id: N.acc(o.ref) || p.utr, mode: p.mode, action: debit ? 'Debit' : 'Credit', remarks: N.text(o.narration), balance: N.amount(o.balance),
        disputed: null, hold: null, atm_loc: '', mobile: '', email: '', pan: '', aadhaar: '', state: '', district: '', _raw: o._raw, cp_upi: p.cp_upi
      };
      const me = { acc: N.acc(holder.acc), name: N.upper(holder.name), bank: holder.bank || bankFromIfsc(holder.ifsc), ifsc: N.ifsc(holder.ifsc) };
      const them = { acc: cp, name: p.cp_name, bank: p.cp_ifsc ? bankFromIfsc(p.cp_ifsc) : '', ifsc: p.cp_ifsc };
      const [f, t] = debit ? [me, them] : [them, me];
      Object.assign(base, { from_acc: f.acc, from_name: f.name, from_bank: f.bank, from_ifsc: f.ifsc, to_acc: t.acc, to_name: t.name, to_bank: t.bank, to_ifsc: t.ifsc });
      out.push(base);
    }
    return out;
  },

  normKyc(o, src) {
    const r = { id: uid(), _src: src };
    for (const [k] of FIELDS.kyc) r[k] = o[k] == null ? '' : o[k];
    Object.assign(r, { acc: N.acc(r.acc), name: N.upper(r.name), ifsc: N.ifsc(r.ifsc), mobile: N.mobile(r.mobile), email: N.email(r.email), pan: N.pan(r.pan), aadhaar: N.aadhaar(r.aadhaar), state: N.upper(r.state), district: N.upper(r.district), open_date: N.date(r.open_date), balance: N.amount(r.balance), address: N.text(r.address), bank: N.text(r.bank) || bankFromIfsc(r.ifsc), ip: N.text(r.ip), device: N.text(r.device), linked: N.text(r.linked), ack_no: N.ack(r.ack_no), remarks: N.text(r.remarks), branch: N.text(r.branch), pincode: N.text(r.pincode) });
    r._raw = o._raw; return r;
  },
  normSocial(o, src) {
    const r = { id: uid(), _src: src };
    for (const [k] of FIELDS.social) r[k] = N.text(o[k]);
    Object.assign(r, { mobile: N.mobile(r.mobile), email: N.email(r.email), imei: N.imei(r.imei), ip: N.ip(r.ip), ip_time: N.date(o.ip_time) || r.ip_time, reg_date: N.date(o.reg_date) || r.reg_date, platform: r.platform || '' });
    r._raw = o._raw; return r;
  },
  normNcrp(o, src) {
    const r = { id: uid(), _src: src };
    for (const [k] of FIELDS.ncrp) r[k] = N.text(o[k]);
    Object.assign(r, { ack_no: N.ack(o.ack_no), date: N.date(o.date), amount: N.amount(o.amount), hold_amount: N.amount(o.hold_amount), victim_mobile: N.mobile(r.victim_mobile), suspect_mobile: N.mobile(r.suspect_mobile), suspect_acc: N.acc(r.suspect_acc), suspect_email: N.email(r.suspect_email), suspect_upi: r.suspect_upi.toLowerCase(), state: N.upper(r.state), district: N.upper(r.district) });
    r._raw = o._raw; return r;
  }
};
