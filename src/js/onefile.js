/* onefile.js – "Case One File": the whole case from start to end in one document, for every FIR / NCRP case.
   Header › FIR details › case details › what to do › intermediaries › case credentials (received / pending) ›
   CCTNS work CD-wise › pending from subordinates / concerns › suggestions to IO.
   Shown in Case File & Notices (first tab), exported as PDF / Word / HTML, and saved on this computer into a folder
   you choose (FIR Cases / NCRP Without FIR sub-folders) – kept up to date automatically. Nothing goes online. */
'use strict';
const OneFile = {
  CSS: `.of{font-family:var(--doc-font,"Segoe UI","Noto Sans Devanagari","Nirmala UI",Arial,sans-serif);font-size:var(--doc-size,11pt);line-height:var(--doc-lh,1.45);color:#0f172a;background:#fff;max-width:1100px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px -12px rgba(0,0,0,.4)}
.of *{box-sizing:border-box}.of-hd{display:flex;gap:16px;align-items:center;padding:18px 22px;background:linear-gradient(120deg,#0b1f4b,#1e3a8a 60%,#7c2d12);color:#fff}
.of-hd img{width:74px;height:74px;object-fit:contain;flex:none}.of-hd .t{font-size:12px;letter-spacing:.14em;opacity:.85}.of-hd h1{margin:2px 0 4px;font-size:22px;line-height:1.25}
.of-hd .m{font-size:13px;opacity:.92}.of-hd .r{margin-left:auto;text-align:right;font-size:12px;opacity:.9}
.of-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.of-chip{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35)}
.of-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;padding:12px 18px;background:#f1f5f9;border-bottom:1px solid #e2e8f0}
.of-k div{background:#fff;border:1px solid #e2e8f0;border-left:4px solid var(--c,#3b82f6);border-radius:10px;padding:6px 10px}.of-k span{display:block;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.of-k b{font-size:17px}
.of details.s{border-bottom:1px solid #e2e8f0}.of details.s>summary{list-style:none;cursor:pointer;padding:12px 18px;font-weight:700;font-size:16px;display:flex;align-items:center;gap:10px;background:#fafafa}
.of details.s>summary::-webkit-details-marker{display:none}.of details.s>summary:before{content:"▸";color:#64748b;transition:.15s}.of details.s[open]>summary:before{transform:rotate(90deg)}
.of details.s>summary .n{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:#1e3a8a;color:#fff;font-size:13px}
.of details.s>summary .c{margin-left:auto;font-size:12px;font-weight:600;color:#64748b}.of .b{padding:10px 18px 16px}
.of table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:.95em}.of th,.of td{border:1px solid #e2e8f0;padding:5px 8px;text-align:left;vertical-align:top}.of th{background:#eef2ff;color:#1e3a8a;font-weight:700}
.of table.kv th{width:190px;background:#f8fafc;color:#334155}.of h4{margin:12px 0 4px;font-size:14px;color:#1e3a8a}.of .tx{white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;max-height:340px;overflow:auto;font-size:.95em}
.of[contenteditable=true]{outline:3px dashed #f59e0b;outline-offset:4px}.of[contenteditable=true] .tx{max-height:none}
.of .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.of .box{border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px}.of .box.g{border-color:#86efac;background:#f0fdf4}.of .box.r{border-color:#fca5a5;background:#fef2f2}
.of .st{display:inline-block;padding:1px 8px;border-radius:99px;font-size:11px;font-weight:700}.of .st.g{background:#dcfce7;color:#166534}.of .st.w{background:#fef3c7;color:#92400e}.of .st.b{background:#fee2e2;color:#991b1b}.of .st.i{background:#e0e7ff;color:#3730a3}
.of .mono{font-family:Consolas,monospace}.of .mu{color:#64748b;font-size:12px}.of ul.ck{list-style:none;padding:0;margin:4px 0}.of ul.ck li{padding:4px 0;border-bottom:1px dashed #e2e8f0}
.of details.cd{border:1px solid #e2e8f0;border-radius:10px;margin:6px 0}.of details.cd>summary{cursor:pointer;padding:7px 10px;display:flex;gap:10px;align-items:baseline}.of details.cd>summary b{min-width:58px}.of details.cd .in{padding:4px 12px 10px}
.of .nos{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 8px}.of .nos span{min-width:30px;text-align:center;padding:2px 6px;border-radius:6px;font-size:12px;font-weight:700;background:#dcfce7;color:#166534}.of .nos span.x{background:#fee2e2;color:#991b1b}
.of .ft{padding:10px 18px;font-size:11px;color:#64748b;background:#f8fafc}
@media print{.of{box-shadow:none;max-width:none;border-radius:0}.of details.s,.of details.cd{break-inside:auto}.of .tx{max-height:none;overflow:visible}.np{display:none}}
@media(max-width:800px){.of .g2{grid-template-columns:1fr}}`,
  dir: null, _t: 0, _last: '',
  logo() { if (this._logo != null) return this._logo; const e = document.querySelector('.emblem-sm,.emblem'); const m = e && getComputedStyle(e).backgroundImage.match(/url\("?(data:[^")]+)"?\)/); return (this._logo = m ? m[1] : ''); },
  cat: c => (typeof AllMode !== 'undefined' ? AllMode.cat(c) : (c.fir ? 'fir' : 'ncrp')),
  /* run fn with case c loaded as the open case (other cases are read from this computer) */
  async withCase(c, fn) {
    if (c.id === S.caseId) return fn(S.data, c);
    const d = Object.assign(emptyCase(), await DB.get('case:' + c.id) || {}), D0 = S.data, C0 = S.caseId;
    S.data = d; S.caseId = c.id; Analysis.invalidate(); if (typeof CDX !== 'undefined') CDX._m = null;
    try { return fn(d, c); } finally { S.data = D0; S.caseId = C0; Analysis.invalidate(); if (typeof CDX !== 'undefined') CDX._m = null; }
  },
  st: s => `<span class="st ${s === 'Received' || s === 'Done' ? 'g' : s === 'Asked' || s === 'Pending' ? 'w' : s === 'n/a' ? 'i' : 'b'}">${esc(s === 'Not Asked' ? 'Not Asked Yet' : s)}</span>`,
  tbl(cols, rows, empty) { return rows.length ? `<table><thead><tr>${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : `<div class="mu">${esc(empty || '—')}</div>`; },
  kv(L) { L = L.filter(x => x[1] !== '' && x[1] != null); return L.length ? `<table class="kv"><tbody>${L.map(([k, v, raw]) => `<tr><th>${esc(k)}</th><td>${raw ? v : esc(v)}</td></tr>`).join('')}</tbody></table>` : ''; },
  sec(n, ic, t, body, cnt, open = true) { return `<details class="s"${open ? ' open' : ''}><summary><span class="n">${n}</span>${ic} ${esc(t)}${cnt ? `<span class="c">${esc(cnt)}</span>` : ''}</summary><div class="b">${body}</div></details>`; },
  /* the document body for the open case */
  body(d, c) {
    const E = esc, X = typeof CDX !== 'undefined' ? CDX : null, isN = this.cat(c) === 'ncrp';
    let r = null; try { if (X && ((d.cctns || {}).fir || ((d.cctns || {}).cd || []).length)) r = X.analyse(d, c); } catch (e) { console.warn('onefile', e); }
    const f = r ? r.fir : { sections: [] }, dmy = v => X ? X.dmy(v) : v, cut = (t, n) => X ? X.cut(t, n) : String(t || '').slice(0, n);
    let comps = [], acc = [], W = [], ids = []; try { comps = Trail.complaints(); } catch (e) { } try { acc = Analysis.accountRows().filter(a => !isSynthetic(a.acc)); } catch (e) { } try { W = CCTNS.work(d, c); } catch (e) { } try { ids = Analysis.idents(); } catch (e) { }
    const amount = sum(d.ncrp || [], x => +x.amount || 0) || sum(comps, x => +x.amount || 0) || (f.amount || 0), hold = Math.max(sum(acc, a => a.hold || 0), sum(comps, x => +x.hold || 0)), mule = acc.filter(a => a.score >= 60);
    const items = r ? r.items : [], ag = r ? r.agencies : [], got = items.filter(i => i.status === 'Received').length + ag.filter(a => a.status === 'Received').length, pend = items.filter(i => i.status !== 'Received').length + ag.filter(a => a.status === 'Pending').length;
    const acks = uniq([...comps.map(x => String(x.ack)), ...String(c.ack || '').split(/[,;\s]+/).filter(Boolean)]);
    const fin = c.final ? ({ CS: 'Charge Sheet', PPI: 'CS-PPI (further investigation pending)', FR: 'Final Report' })[c.final.type] + (c.final.no ? ' No. ' + c.final.no : '') + (c.final.date ? ' · ' + dmy(c.final.date) : '') : (c.status || 'Under investigation');
    const L = r ? r.L : [], sugg = r ? r.sugg : [], WP = W.filter(w => w.status === 'Pending');
    const K = [['Amount', amount ? fmtINR(amount) : '—', '#ef4444'], ['On Hold / Lien', hold ? fmtINR(hold) : '—', '#10b981'], ['Accounts', fmtNum(acc.length), '#3b82f6'], ['Mule A/C (≥60)', fmtNum(mule.length), '#f97316'], ['Case Diary', L.length ? `${L.length} · last ${r.cdc.last ? r.cdc.last.no : ''}` : '0', '#8b5cf6'], ['Received', fmtNum(got), '#16a34a'], ['Pending', fmtNum(pend + WP.length), '#dc2626'], ['Suggestions', fmtNum(sugg.length + WP.length), '#eab308']];
    let n = 0, h = `<div class="of-k">${K.map(([k, v, col]) => `<div style="--c:${col}"><span>${k}</span><b>${E(v)}</b></div>`).join('')}</div>`;
    /* 1 · FIR / complaint */
    const ncrpT = this.tbl([['Ack No.', x => `<b class="mono">${E(x.ack)}</b>`], ['Date', x => E(x.date || '')], ['Victim', x => E(x.victim || '')], ['Category', x => E(x.category || '')], ['Amount', x => x.amount ? fmtINR(x.amount) : ''], ['On Hold', x => x.hold ? fmtINR(x.hold) : ''], ['Layers', x => x.layers || ''], ['Accounts', x => x.accounts || '']], comps, 'No NCRP complaint imported.');
    h += this.sec(++n, '📄', isN ? 'Complaint Details (NCRP – No FIR Yet)' : 'FIR Details', (isN ? `<div class="box ${amount >= 500000 ? 'r' : ''}">${amount >= 500000 ? '⚖ <b>₹5 lakh or more – register FIR / e-Zero FIR.</b> ' : ''}Acknowledgement No. <b class="mono">${E(acks.join(', ') || '—')}</b></div>` : '') +
      this.kv([['FIR No. / Date', [f.no || c.fir, f.date].filter(Boolean).join(' · ')], ['Sections Of Law', (f.sections || []).join(', ') || c.section || ''], ['Complainant', [f.complainant, f.mobile].filter(Boolean).join(' · ')], ['Incident', f.incident || ''], ['Amount Defrauded', amount ? fmtINR(amount) : ''], ['Police Station', c.ps || ''], ['IO', c.io || (r && r.io) || '']]) +
      (r && (f.tahrir || f.brief) ? `<h4>FIR Content (Gist)</h4><div class="tx">${E(cut(f.tahrir || f.brief, 2200))}</div>` : '') +
      (items.length ? `<h4>🎯 Named In The FIR</h4>` + this.tbl([['Type', x => E(x.type)], ['Value', x => `<b class="mono">${E(x.value)}</b>`], ['Required', x => E(x.need || '')], ['Status', x => this.st(x.status)]], items) : '') +
      (comps.length ? `<h4>🧾 NCRP Complaints (Acknowledgement No.)</h4>` + ncrpT : ''), isN ? acks.length + ' Ack No.' : (f.no || c.fir ? 'FIR ' + (f.no || c.fir) : ''));
    /* 2 · case details */
    const cnt = [['Complaints', comps.length || (d.ncrp || []).length], ['Transactions', (d.txns || []).length], ['KYC Records', (d.kyc || []).length], ['Social Media Records', (d.social || []).length], ['CAF', (d.caf || []).length], ['Telecom Records', ((d.tele || d.cdr || [])).length || ''], ['Notes', (d.notes || []).length], ['Tasks', (d.tasks || []).length], ['Identifiers', ids.length]].filter(x => x[1]);
    h += this.sec(++n, '🗂', 'Case Details', `<div class="g2"><div>${this.kv([['Case Name', c.name || ''], ['Case Type', c.ctype || ''], ['Category', isN ? 'NCRP – no FIR yet' : 'FIR case'], ['Police Station', c.ps || ''], ['District', c.district || ''], ['State', c.state || ''], ['IO Name', c.io || (r && r.io) || ''], ['IO Mobile', c.io_mobile || ''], ['IO Posting', c.io_posting || ''], ['Status', fin], ['Accused (Charge-Sheeted)', r && r.acc.cs.length ? r.acc.cs.join(', ') : ''], ['Created', c.created ? new Date(c.created).toLocaleDateString('en-IN') : '']])}</div>
      <div><h4>📦 Data In This Case</h4>${this.kv(cnt.map(([k, v]) => [k, fmtNum(v)]))}<h4>💰 Money</h4>${this.kv([['Amount Defrauded', amount ? fmtINR(amount) : ''], ['On Hold / Lien', hold ? fmtINR(hold) : ''], ['Accounts In Trail', acc.length ? fmtNum(acc.length) : ''], ['Mule Accounts (≥60)', mule.length ? fmtNum(mule.length) : ''], ['Layers', comps.length ? Math.max(0, ...comps.map(x => x.layers || 0)) || '' : '']])}</div></div>`);
    /* 3 · what to do */
    const top = acc.slice().sort((a, b) => b.score - a.score || b.inAmt - a.inAmt).slice(0, 10);
    h += this.sec(++n, '🧭', 'What To Do – Investigation & Analysis', `<ul class="ck">${W.map(w => `<li>${w.status === 'Done' ? '✅' : w.status === 'n/a' ? '➖' : '⏳'} <b>${E(w.title)}</b> ${this.st(w.status)}<div class="mu">${E(w.detail || '')}${w.demand ? ' · From: ' + E(w.demand) : ''}</div></li>`).join('') || '<li class="mu">Import the FIR, case diary and money trail to build the work list.</li>'}</ul>` +
      (top.length ? `<h4>🎯 Suspect Accounts To Act On First</h4>` + this.tbl([['Account', a => `<b class="mono">${E(a.acc)}</b>`], ['Bank', a => E(String(a.bank || '').split(' / ')[0])], ['Name', a => E(String(a.name || '').split(' / ')[0])], ['Layer', a => a.layer || ''], ['Received', a => a.inAmt ? fmtINR(a.inAmt) : ''], ['On Hold', a => a.hold ? fmtINR(a.hold) : ''], ['Risk', a => `<b>${a.score}</b>`]], top) : ''), WP.length ? WP.length + ' pending' : '');
    /* 4 · intermediaries */
    const byBank = [...groupBy(acc, a => (String(a.bank || '').split(' / ')[0] || 'Bank not known').toUpperCase())].map(([b, L2]) => ({ b, n: L2.length, amt: sum(L2, a => a.inAmt || 0), hold: sum(L2, a => a.hold || 0), kyc: L2.filter(a => !(d.kyc || []).some(k => N.acc(k.acc) === N.acc(a.acc))).length })).sort((a, b) => b.amt - a.amt);
    const plat = uniq([...(d.social || []).map(s => s.platform || s.source || '').filter(Boolean), ...ids.filter(i => /^(email|url|upi|ip)$/.test(i.type)).map(i => ({ email: 'E-mail provider', url: 'Website / hosting', upi: 'UPI / NPCI', ip: 'ISP (IP owner)' })[i.type])]);
    h += this.sec(++n, '🏢', 'Intermediaries To Contact', (ag.length ? `<h4>From The Case Diary – Asked & Received</h4>` + this.tbl([['Agency / Person', a => `<b>${E(a.en)}</b>`], ['Status', a => this.st(a.status) + (a.age ? ` <span class="mu">${a.age} days</span>` : '')], ['Asked (CD)', a => E(uniq(a.ask.map(e => e.cd)).join(', '))], ['Received (CD)', a => E(uniq(a.got.map(e => e.cd)).join(', '))], ['Latest Entry', a => `<span class="mu">${E(a.last ? cut(a.last.s, 160) : '')}</span>`]], ag) : '') +
      (byBank.length ? `<h4>🏦 Banks – Suspect Accounts</h4>` + this.tbl([['Bank', x => `<b>${E(x.b)}</b>`], ['Accounts', x => x.n], ['Amount Received', x => fmtINR(x.amt)], ['On Hold', x => x.hold ? fmtINR(x.hold) : ''], ['KYC Not Received', x => x.kyc ? `<b style="color:#b91c1c">${x.kyc}</b>` : '✔']], byBank) : '') +
      (plat.length ? `<h4>🌐 Platforms / Others</h4><div>${plat.map(p => `<span class="st i" style="margin:2px">${E(p)}</span>`).join(' ')}</div>` : '') + (!ag.length && !byBank.length && !plat.length ? '<div class="mu">No intermediary found yet.</div>' : ''), ag.filter(a => a.status === 'Pending').length ? ag.filter(a => a.status === 'Pending').length + ' awaiting reply' : '');
    /* 5 · credentials */
    const recv = [...items.filter(i => i.status === 'Received').map(i => [i.value, [i.kyc && 'Holder: ' + i.kyc, i.ip && 'IP: ' + i.ip, i.bank].filter(Boolean).join(' · ') || (i.got ? cut(i.got.s, 120) : 'received'), i.got ? 'CD ' + i.got.cd : '']), ...ag.filter(a => a.status === 'Received').map(a => [a.en, cut(a.last.s, 120), 'CD ' + a.last.cd])];
    const pnd = [...items.filter(i => i.status !== 'Received').map(i => [i.value, (i.status === 'Asked' ? `Asked in CD ${i.ask.cd} · ${i.age} days` : 'Not asked yet') + ' – ' + (i.from || ''), i.need || '']), ...ag.filter(a => a.status === 'Pending').map(a => [a.en, `Reply pending since CD ${a.last.cd} · ${a.age} days`, ''])];
    const T = groupBy(ids, i => i.type), TN = { mobile: '📱 Mobile', account: '🏦 Account', email: '✉ Email', upi: '💸 UPI', ip: '🌐 IP', imei: '📟 IMEI', url: '🔗 URL', pan: '🪪 PAN', aadhaar: '🪪 Aadhaar', ifsc: '🏛 IFSC' };
    h += this.sec(++n, '🔐', 'Case Credentials – Received & Pending', `<div class="g2"><div class="box g"><h4>✅ Received (${recv.length})</h4>${this.tbl([['Item', x => `<b class="mono">${E(x[0])}</b>`], ['Details', x => E(x[1])], ['CD', x => E(x[2])]], recv, 'Nothing received yet.')}</div><div class="box r"><h4>⏳ Pending (${pnd.length})</h4>${this.tbl([['Item', x => `<b class="mono">${E(x[0])}</b>`], ['Status', x => E(x[1])], ['Required', x => E(x[2])]], pnd, 'Nothing pending.')}</div></div>
      ${T.size ? `<h4>🧾 All Identifiers In This Case (${ids.length})</h4>${this.tbl([['Type', x => E(TN[x[0]] || x[0])], ['Count', x => x[1].length], ['Values', x => `<span class="mono mu">${E(uniq(x[1].map(i => String(i.value))).slice(0, 12).join(', '))}${uniq(x[1].map(i => String(i.value))).length > 12 ? ' …' : ''}</span>`]], [...T].sort((a, b) => b[1].length - a[1].length))}` : ''}`, `${recv.length} received · ${pnd.length} pending`);
    /* 6 · CCTNS CD-wise */
    const nos = L.map(l => +l.no).filter(Boolean), mx = nos.length ? Math.max(...nos) : 0, miss = []; for (let i = 1; i <= mx; i++) if (!nos.includes(i)) miss.push(i);
    const pendIn = no => [...items.filter(i => i.status !== 'Received' && i.ask && String(i.ask.cd) === String(no)).map(i => i.value + ' – ' + (i.from || '')), ...ag.filter(a => a.status === 'Pending' && a.ask.some(e => String(e.cd) === String(no))).map(a => a.en)];
    const gotIn = no => [...items.filter(i => i.got && String(i.got.cd) === String(no)).map(i => i.value), ...ag.filter(a => a.got.some(e => String(e.cd) === String(no))).map(a => a.en)];
    h += this.sec(++n, '📒', 'CCTNS Work – Case Diary (CD-Wise)', L.length ? `<div class="mu">CD numbering (green = uploaded, red = missing):</div><div class="nos">${Array.from({ length: mx }, (_, i) => `<span class="${nos.includes(i + 1) ? '' : 'x'}">${i + 1}</span>`).join('')}</div>${miss.length ? `<div class="box r">⚠ Missing CD: <b>${miss.join(', ')}</b></div>` : ''}
      ${L.slice().sort((a, b) => (+a.no || 0) - (+b.no || 0)).map(l => { const P = pendIn(l.no), G = gotIn(l.no); return `<details class="cd"><summary><b>CD ${E(l.no || '?')}</b><span class="mu">${E(dmy(l.prep) || '')}</span><span>${E(cut(l.body, 170))}</span>${P.length ? `<span class="st w">⏳ ${P.length}</span>` : ''}${G.length ? `<span class="st g">✔ ${G.length}</span>` : ''}</summary><div class="in">${G.length ? `<div><b>✔ Received in this CD:</b> ${E(G.join(', '))}</div>` : ''}${P.length ? `<div><b>⏳ Asked in this CD – still pending:</b> ${E(P.join(', '))}</div>` : ''}<h4>Full Entry</h4><div class="tx">${E(l.body || '')}</div><div class="mu">File: ${E((l.x && l.x.file) || '')}</div></div></details>`; }).join('')}` : '<div class="mu">No case-diary part yet. Import the CCTNS zip / CD PDFs with 📥 Import / Upload.</div>', L.length ? `${L.length} CD parts${miss.length ? ' · ' + miss.length + ' missing' : ''}` : '', false);
    /* 7 · pending from subordinates / concerns */
    const PS = [...ag.filter(a => a.status === 'Pending').map(a => ({ who: a.en, what: cut(a.last.s, 140), since: 'CD ' + a.last.cd, days: a.age })), ...items.filter(i => i.status === 'Asked').map(i => ({ who: i.from || '', what: i.value + ' – ' + (i.need || ''), since: 'CD ' + i.ask.cd, days: i.age })),
      ...WP.map(w => ({ who: w.demand || 'IO', what: w.title + (w.detail ? ' – ' + w.detail : ''), since: '', days: '' })), ...(d.tasks || []).filter(t => !t.done).map(t => ({ who: t.who || t.assignee || 'Team', what: t.text || '', since: t.due || '', days: '' }))].sort((a, b) => (+b.days || 0) - (+a.days || 0));
    h += this.sec(++n, '⏳', 'Pending From Subordinates / Concerns', this.tbl([['From', x => `<b>${E(x.who)}</b>`], ['What Is Pending', x => E(x.what)], ['Since', x => E(x.since)], ['Days', x => x.days ? `<b style="color:#b91c1c">${x.days}</b>` : '']], PS, 'Nothing pending.'), PS.length ? PS.length + ' items' : '');
    /* 8 · suggestions */
    const SG = [...sugg.map(s => [s.en, s.hi]), ...(r ? r.secs.filter(s => s.state !== 'ok').map(s => [`Section ${s.sec}: ${s.state === 'review' ? 'review' : 'consider adding'} – ${s.why}`, s.hi || '']) : []), ...(miss.length ? [[`Upload / write the missing CD: ${miss.join(', ')}`, `छूटे हुए पर्चे: ${miss.join(', ')}`]] : []), ...(isN && amount >= 500000 ? [['Amount is ₹5 lakh or more – register the FIR (e-Zero FIR) and add the FIR No. in Case Details.', '₹5 लाख या अधिक – एफआईआर पंजीकृत करें।']] : []), ...WP.slice(0, 6).map(w => [w.title + (w.demand ? ' – ask ' + w.demand : ''), ''])];
    h += this.sec(++n, '💡', 'Suggestions For IO – Next Steps', SG.length ? `<ol>${SG.map(([en, hi]) => `<li>${E(en)}${hi ? `<div class="mu">${E(hi)}</div>` : ''}</li>`).join('')}</ol><div class="mu">Advisory only – the IO decides on law and facts.</div>` : '<div class="mu">No suggestion – all clear.</div>', SG.length ? SG.length + '' : '');
    return { h, isN, acks, fin, f };
  },
  head(c, B) {
    const chips = [B.isN ? '🧾 NCRP – No FIR Yet' : '📁 FIR ' + (B.f.no || c.fir || ''), B.isN && B.acks.length ? 'Ack ' + B.acks[0] + (B.acks.length > 1 ? ' +' + (B.acks.length - 1) : '') : '', c.ps && 'PS ' + c.ps, c.district, c.io && 'IO ' + c.io, B.fin].filter(Boolean);
    return `<div class="of-hd">${this.logo() ? `<img src="${this.logo()}" alt="">` : ''}<div><div class="t">CASE ONE FILE · केस वन फाइल</div><h1>${esc(c.name || '')}</h1><div class="of-chips">${chips.map(x => `<span class="of-chip">${esc(x)}</span>`).join('')}</div></div><div class="r">SudarshanAshtra<br>Cyber Crime Analysis &amp; Tracking<br>Updated ${new Date().toLocaleString('en-IN')}</div></div>`;
  },
  html(c) { const E = (S.data || {}).oneFile; if (E && E.html) return `<div class="of no-tc">${E.html}</div>`; return this.gen(c); },
  gen(c) { const B = this.body(S.data, c); return `<div class="of no-tc">${this.head(c, B)}${B.h}<div class="ft">Made on this computer by SudarshanAshtra from the FIR, case diary and imported data. Restricted – for official use only.</div></div>`; },
  full(inner, c) { const F = typeof DocFont !== 'undefined' ? DocFont.get() : { s: 11, lh: 1.4 }; return `<!DOCTYPE html><html lang="hi"><head><meta charset="utf-8"><title>Case One File – ${esc(c.name || '')}</title><style>body{margin:0;padding:16px;background:#e2e8f0}:root{--doc-font:${typeof DocFont !== 'undefined' ? DocFont.css(F.f) : 'Arial'};--doc-size:${F.s}pt;--doc-lh:${F.lh}}${this.CSS}</style></head><body><div class="np" style="max-width:1100px;margin:0 auto 10px;font:13px sans-serif"><button onclick="document.querySelectorAll('details').forEach(d=>d.open=true);print()">🖨 Print / Save As PDF</button> <button onclick="document.querySelectorAll('details').forEach(d=>d.open=true)">Open All</button> <button onclick="document.querySelectorAll('details').forEach(d=>d.open=false)">Close All</button></div>${inner}</body></html>`; },
  fname(c) { const id = c.fir ? 'FIR_' + c.fir : 'NCRP_' + (String(c.ack || '').split(/[,;\s]+/)[0] || ''); const k = String(c.fir || c.ack || '').split(/[,;\s]+/)[0]; return ('Case_One_File_' + id + (k && String(c.name || '').includes(k) ? '' : '_' + (c.name || ''))).replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 90); },
  async docFor(c) { return this.withCase(c, () => this.full(this.html(c).replace('<details class="s"', '<details class="s"'), c)); },
  /* ---------- in the app ---------- */
  view(el) {
    if (this.dir === null && !this._ld) { this._ld = 1; DB.get('ofDir').then(h => { this.dir = h || null; }).catch(() => { }); }
    if (!$('#ofCss')) document.head.insertAdjacentHTML('beforeend', `<style id="ofCss">${this.CSS}</style>`);
    const c = activeCase(), E = S.data.oneFile;
    el.innerHTML = `<div class="of-bar"><button class="btn primary" id="ofExp">⬇ Export Report ▾</button><button class="btn" id="ofEd" title="Edit the text, tables and formatting – then Save">✏ Edit</button><button class="btn" id="ofAll">⤢ Open All</button><button class="btn" id="ofNone">⤡ Close All</button><span class="spacer"></span><button class="btn" id="ofDir" title="Save the Case One File of every case into a folder on this computer – FIR Cases and NCRP Without FIR sub-folders. Kept up to date automatically.">📁 ${this.dir ? 'Save All Cases Now' : 'Save All Cases To A Folder'}</button><span class="small muted" id="ofSt">${esc(this._last)}</span></div>
      <div id="ofFmt" class="of-fmt hidden"></div>
      ${E && E.html ? `<div class="of-ed">✏ <b>Edited by IO</b> on ${esc(new Date(E.when).toLocaleString('en-IN'))} – this copy is used for export and the folder. New data imported later is not added to it. <button class="btn sm" id="ofRe">↺ Rebuild From Latest Data</button></div>` : ''}
      <div id="ofDoc">${this.html(c)}</div>`;
    $('#ofAll', el).onclick = () => $$('#ofDoc details', el).forEach(d => d.open = true); $('#ofNone', el).onclick = () => $$('#ofDoc details', el).forEach(d => d.open = false);
    $('#ofDir', el).onclick = () => this.saveAll(true);
    $('#ofExp', el).onclick = e => this.menu(e.currentTarget, c);
    $('#ofEd', el).onclick = () => this.edit(el, true);
    const re = $('#ofRe', el); if (re) re.onclick = () => { if (!confirm('Rebuild the Case One File from the latest data? Your edits will be removed.')) return; delete S.data.oneFile; saveCase(); this.view(el); UI.toast('Case One File rebuilt from the latest data'); };
  },
  /* ---------- edit like a document: font, size, bold, colour, alignment, lists, table rows ---------- */
  edit(el, on) {
    const doc = $('#ofDoc .of', el), bar = $('#ofFmt', el), F = typeof DocFont !== 'undefined' ? DocFont.FONTS : [['', ['Arial', 'Times New Roman', 'Mangal']]];
    if (!on) { doc.removeAttribute('contenteditable'); bar.classList.add('hidden'); $('#ofEd', el).classList.remove('hidden'); return; }
    this._undo = doc.innerHTML; $$('details', doc).forEach(d => d.open = true);
    doc.setAttribute('contenteditable', 'true'); $('#ofEd', el).classList.add('hidden'); bar.classList.remove('hidden');
    const B = (k, t, tip) => `<button class="btn sm" data-fx="${k}" title="${tip}">${t}</button>`;
    bar.innerHTML = `<select id="ofFn" title="Font of the selected text"><option value="">Font…</option>${F.map(([g, L]) => `<optgroup label="${esc(g)}">${L.map(f => `<option value="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</option>`).join('')}</optgroup>`).join('')}</select>
      <select id="ofFs" title="Size of the selected text"><option value="">Size…</option>${[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28].map(n => `<option value="${n}">${n} pt</option>`).join('')}</select>
      ${B('bold', '<b>B</b>', 'Bold')}${B('italic', '<i>I</i>', 'Italic')}${B('underline', '<u>U</u>', 'Underline')}${B('strikeThrough', '<s>S</s>', 'Strike')}
      <label class="of-col" title="Text colour">A<input type="color" id="ofFc" value="#b91c1c"></label><label class="of-col" title="Highlight">🖍<input type="color" id="ofBc" value="#fde047"></label>
      ${B('justifyLeft', '⯇', 'Align left')}${B('justifyCenter', '≡', 'Centre')}${B('justifyRight', '⯈', 'Align right')}${B('justifyFull', '☰', 'Justify')}
      ${B('insertUnorderedList', '• List', 'Bullet list')}${B('insertOrderedList', '1. List', 'Numbered list')}${B('h4', 'Heading', 'Make a heading')}${B('row', '+ Row', 'Add a row below (click inside a table first)')}${B('delrow', '− Row', 'Delete this table row')}${B('removeFormat', '⌫ Clear', 'Clear formatting')}${B('undo', '↶', 'Undo')}${B('redo', '↷', 'Redo')}
      <span class="spacer"></span><button class="btn primary sm" id="ofSv">💾 Save</button><button class="btn sm" id="ofCx">✖ Cancel</button>`;
    let rng = null; const keep = () => { const s = getSelection(); if (s.rangeCount && doc.contains(s.anchorNode)) rng = s.getRangeAt(0).cloneRange(); };
    doc.onkeyup = doc.onmouseup = keep; const back = () => { if (rng) { const s = getSelection(); s.removeAllRanges(); s.addRange(rng); } doc.focus(); };
    try { document.execCommand('styleWithCSS', false, true); } catch (e) { }
    const cellOf = () => { const s = getSelection(); let n = s.anchorNode; while (n && n !== doc && n.nodeName !== 'TR') n = n.parentNode; return n && n.nodeName === 'TR' ? n : null; };
    $$('[data-fx]', bar).forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { back(); const k = b.dataset.fx;
      if (k === 'h4') document.execCommand('formatBlock', false, 'h4');
      else if (k === 'row' || k === 'delrow') { const tr = cellOf(); if (!tr) return UI.toast('Click inside a table row first'); if (k === 'delrow') tr.remove(); else { const n = tr.cloneNode(true); [...n.cells].forEach(td => td.innerHTML = '&nbsp;'); tr.after(n); } }
      else document.execCommand(k, false, null); keep(); }; });
    $('#ofFn', bar).onchange = e => { back(); if (e.target.value) document.execCommand('fontName', false, e.target.value); e.target.value = ''; keep(); };
    $('#ofFs', bar).onchange = e => { const v = e.target.value; e.target.value = ''; if (!v) return; back(); document.execCommand('fontSize', false, 7);
      $$('font[size="7"]', doc).forEach(x => { x.removeAttribute('size'); x.style.fontSize = v + 'pt'; }); $$('[style*="xxx-large"]', doc).forEach(x => x.style.fontSize = v + 'pt'); keep(); };
    $('#ofFc', bar).oninput = e => { back(); document.execCommand('foreColor', false, e.target.value); keep(); };
    $('#ofBc', bar).oninput = e => { back(); document.execCommand('hiliteColor', false, e.target.value); keep(); };
    $('#ofSv', bar).onclick = () => { doc.removeAttribute('contenteditable'); S.data.oneFile = { html: doc.innerHTML, when: new Date().toISOString() }; saveCase(); UI.toast('Case One File saved – used for export and the folder'); this.view(el); };
    $('#ofCx', bar).onclick = () => { doc.innerHTML = this._undo; this.edit(el, false); };
  },
  /* Excel: one sheet per section, every table and text block of the file (edits included) */
  excel(c, html) {
    if (typeof XLSX === 'undefined') return UI.toast('Excel library not loaded');
    const box = document.createElement('div'); box.innerHTML = html; const wb = XLSX.utils.book_new(), T = x => (x.innerText || x.textContent || '').replace(/\s+\n/g, '\n').trim(), used = new Set();
    const sum = [['CASE ONE FILE', c.name || ''], ...$$('.of-chip', box).map(x => ['', T(x)]), [], ...$$('.of-k div', box).map(x => [T($('span', x)), T($('b', x))])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), 'Summary');
    $$('details.s', box).forEach((d, i) => { const rows = [], sm = $('summary', d).cloneNode(true); $$('.n, .c', sm).forEach(x => x.parentNode.removeChild(x)); const t = T(sm).replace(/\s+/g, ' ').trim(), cn = $('summary .c', d);
      rows.push([t, cn ? T(cn) : '']); rows.push([]);
      $$('h4, table, .tx, .box > div:not(.g2), ul.ck > li, ol > li, details.cd > summary, .in > div', $('.b', d)).forEach(x => {
        if (x.closest('table') && x.tagName !== 'TABLE') return;
        if (x.tagName === 'TABLE') { $$('tr', x).forEach(tr => rows.push([...tr.cells].map(td => T(td)))); rows.push([]); }
        else if (x.tagName === 'H4') rows.push([T(x).toUpperCase()]);
        else rows.push([T(x).replace(/\s+/g, ' ').slice(0, 32000)]); });
      let nm = (i + 1) + ' ' + t.replace(/[\\\/\?\*\[\]:]/g, ' ').replace(/[^\w\s\-&()]/g, '').replace(/\s+/g, ' ').trim(); nm = nm.slice(0, 31); while (used.has(nm)) nm = nm.slice(0, 29) + '_' + i; used.add(nm);
      const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 28 }, { wch: 40 }, { wch: 30 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }]; XLSX.utils.book_append_sheet(wb, ws, nm); });
    XLSX.writeFile(wb, this.fname(c) + '.xlsx');
  },
  menu(btn, c) {
    const old = $('.cdx-menu'); if (old) { old.remove(); return; }
    const m = document.createElement('div'); m.className = 'cdx-menu';
    m.innerHTML = [['pdf', '🖨', 'PDF', 'Print box → Save as PDF'], ['doc', '📝', 'Word (DOC)', 'Opens in MS Word'], ['html', '🌐', 'HTML', 'One file – opens in any browser'], ['xlsx', '📊', 'Excel (XLSX)', 'One sheet per section'], ['view', '👁', 'View In New Tab', '']].map(([k, i, t, s]) => `<button data-of="${k}"><span class="ic">${i}</span><span><b>Case One File – ${t}</b><small>${s}</small></span></button>`).join('');
    document.body.appendChild(m); const r = btn.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
    $$('[data-of]', m).forEach(x => x.onclick = async () => { m.remove(); const k = x.dataset.of; if (k === 'xlsx') return this.withCase(c, () => this.excel(c, this.html(c))); const full = (await this.docFor(c)).replace(/<details class="(s|cd)"/g, '<details open class="$1"'), nm = this.fname(c);
      if (k === 'doc') return this.save(full.replace(/<div class="np"[\s\S]*?<\/div>/, ''), 'application/msword', nm + '.doc'); if (k === 'html') return this.save(full, 'text/html', nm + '.html');
      const w = window.open('', '_blank'); if (!w) return UI.toast('Pop-up blocked. Allow pop-ups for this page.'); w.document.open(); w.document.write(full); w.document.close(); if (k === 'pdf') setTimeout(() => { try { w.focus(); w.print(); } catch (e) { } }, 700); });
    setTimeout(() => document.addEventListener('mousedown', function cl(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', cl); } }));
  },
  save(data, type, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿', data], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); },
  /* ---------- folder on this computer (kept up to date) ---------- */
  async perm(ask) { const h = this.dir; if (!h || !h.queryPermission) return false; const o = { mode: 'readwrite' }; if ((await h.queryPermission(o)) === 'granted') return true; return ask ? (await h.requestPermission(o)) === 'granted' : false; },
  async write(c) {
    const sub = await this.dir.getDirectoryHandle(this.cat(c) === 'fir' ? 'FIR Cases' : 'NCRP Without FIR', { create: true });
    const nm = this.fname(c) + '.html', other = await this.dir.getDirectoryHandle(this.cat(c) === 'fir' ? 'NCRP Without FIR' : 'FIR Cases', { create: true });
    try { await other.removeEntry(nm); } catch (e) { }
    if (c._ofName && c._ofName !== nm) { try { await sub.removeEntry(c._ofName); } catch (e) { } }
    const fh = await sub.getFileHandle(nm, { create: true }), w = await fh.createWritable(); await w.write(await this.docFor(c)); await w.close(); c._ofName = nm;
  },
  async saveAll(ask) {
    if (!window.showDirectoryPicker) return UI.toast('This browser cannot save into a folder – use Export Report › HTML instead (Chrome / Edge can).', 6000);
    if (ask && (!this.dir || !(await this.perm(true)))) { try { this.dir = await window.showDirectoryPicker({ id: 'onefile', mode: 'readwrite' }); await DB.set('ofDir', this.dir); } catch (e) { return; } }
    if (!(await this.perm(false))) return;
    let n = 0; for (const c of S.cases) { try { await this.write(c); n++; } catch (e) { console.warn('onefile save', e); } }
    this._last = `✔ ${n} Case One File(s) saved in "${this.dir.name}" · ${new Date().toLocaleTimeString('en-IN')}`; const s = $('#ofSt'); if (s) s.textContent = this._last; UI.toast(this._last, 5000);
  },
  /* after a change to the open case, rewrite its file (quietly, at most every 20 s) */
  auto() { if (!this.dir || isScope(S.caseId)) return; clearTimeout(this._t); const id = S.caseId; this._t = setTimeout(async () => { const c = S.cases.find(x => x.id === id); if (!c || !(await this.perm(false))) return; try { await this.write(c); this._last = `✔ Auto-saved in "${this.dir.name}" · ${new Date().toLocaleTimeString('en-IN')}`; const s = $('#ofSt'); if (s) s.textContent = this._last; } catch (e) { } }, 20000); }
};
(() => {
  const M = PAGE_META.others; if (M) { M.order = ['onefile', ...M.order.filter(k => k !== 'onefile')]; M.names = Object.assign({}, M.names, { onefile: '📘 Case One File' }); M.extra = [...(M.extra || []), ['onefile', 'Case One File']]; M.desc = 'Case One File (the whole case in one document), case details, notes and tasks, notice drafts, reports and export, and helper tools.'; }
  OthTabs.onefile = el => { try { OneFile.view(el); } catch (e) { console.error(e); el.innerHTML = `<div class="card err">Case One File: ${esc(e.message)}</div>`; } };
  if (!S.sub.others) S.sub.others = 'onefile';
  const sc = saveCase; saveCase = function () { const r = sc.apply(this, arguments); try { OneFile.auto(); } catch (e) { } return r; };
  setTimeout(async () => { try { OneFile.dir = await DB.get('ofDir') || null; } catch (e) { } }, 1500);
})();
