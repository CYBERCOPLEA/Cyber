/* main.js - login, routing, cases, notices, reports, backup */
'use strict';

/* ---------- Notices ---------- */
const Notices = {
  T: {
    bank_kyc: {
      name: 'Bank – KYC, statement & logs (Sec 94 BNSS)', to: 'The Nodal Officer / Branch Manager\n{{bank}}',
      subject: 'Notice under Section 94 of the Bharatiya Nagarik Suraksha Sanhita, 2023 – furnishing of account details in {{fir}}',
      body: `With reference to the above case registered at Police Station {{ps}}, {{juris}}, under {{section}}, investigation has revealed that proceeds of cyber fraud (NCRP Ack No. {{ack}}) were credited to / routed through the following account(s) maintained with your bank:\n\n{{accounts}}\n\nYou are requested to furnish the following, for the period from account opening till date, at the earliest:\n1. Account opening form, complete KYC documents (photo, ID & address proof, PAN, Aadhaar) and introducer details.\n2. Detailed account statement with counter-party account number, IFSC, UTR/RRN and narration.\n3. Registered mobile number, e-mail ID and any change history.\n4. Net-banking / mobile-banking login IP addresses with date-time stamp (with time zone and port) and device IDs.\n5. Linked UPI IDs / VPAs, debit cards, ATM withdrawal details with ATM ID & location and CCTV footage where available.\n6. Details of other accounts linked to the same customer ID, PAN, mobile or e-mail.\n7. Current balance and any amount on hold / lien.\n\nThe information may be sent to the undersigned at {{io_email}}.`
    },
    bank_freeze: {
      name: 'Bank – debit freeze / lien (Sec 106 BNSS)', to: 'The Nodal Officer / Branch Manager\n{{bank}}',
      subject: 'Request for debit freeze / lien on account(s) involved in cyber fraud – {{fir}}',
      body: `In connection with the above case under {{section}} at PS {{ps}}, {{juris}} (NCRP Ack No. {{ack}}), the following account(s) have been found to have received the proceeds of crime:\n\n{{accounts}}\n\nIn exercise of powers under Section 106 of the Bharatiya Nagarik Suraksha Sanhita, 2023, you are requested to immediately mark a debit freeze / lien on the above account(s) to the extent of the disputed amount, and not to allow any debit without the written permission of the undersigned or the competent court. Kindly confirm the action taken along with the available balance and amount put on hold.`
    },
    intermediary: {
      name: 'Social media / intermediary – subscriber info & IP logs', to: 'The Grievance / Law Enforcement Response Officer\n{{platform}}',
      subject: 'Notice under Section 94 BNSS, 2023 read with Rule 3(1)(j) of the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 – {{fir}}',
      body: `The undersigned is investigating the above case under {{section}} registered at PS {{ps}}, {{juris}}. The following account(s) / profile(s) on your platform have been used in the commission of the offence:\n\n{{profiles}}\n\nYou are requested to provide, at the earliest and in any case within the time prescribed under the Rules:\n1. Subscriber / registration details – name, registered mobile number(s), e-mail ID(s), date and IP of account creation.\n2. Login / IP logs with date, time (with time zone) and source port for the last 6 months / available period.\n3. Device details (model, IMEI / device ID) used to access the account.\n4. Linked accounts, groups and payment details, if any.\n5. Preserve all data related to the above account(s) pending legal process.\n\nPlease send the information to {{io_email}}.`
    },
    telecom: {
      name: 'Telecom – CAF / CDR / IPDR', to: 'The Nodal Officer\n{{tsp}}',
      subject: 'Request for subscriber details and call / IP records – {{fir}}',
      body: `In connection with the investigation of the above case under {{section}} at PS {{ps}}, {{juris}}, you are requested under Section 94 of the Bharatiya Nagarik Suraksha Sanhita, 2023 to furnish the following in respect of the mobile number(s):\n\n{{mobiles}}\n\n1. Customer Application Form (CAF) with ID / address proof and Point-of-Sale details.\n2. Call Detail Records with cell-ID / tower location for the period ____ to ____.\n3. IPDR / internet session records with public IP, port and time.\n4. IMEI(s) used with the number and other numbers used in the same handset(s).\n\nKindly send the details to {{io_email}}.`
    },
    atm_cctv: {
      name: 'Bank – ATM CCTV footage', to: 'The Nodal Officer / Branch Manager\n{{bank}}',
      subject: 'Request for preservation and supply of ATM CCTV footage – {{fir}}',
      body: `In connection with the above case under {{section}} at PS {{ps}}, cash withdrawals of proceeds of crime were made from the following ATM(s) / account(s):\n\n{{accounts}}\n\nYou are requested to preserve and provide the CCTV footage of the ATM(s) concerned for the time of the transactions (±30 minutes), along with ATM ID, location address and journal print.`
    }
  },
  render(el) {
    const banks = uniq(Analysis.accountRows().filter(a => a.layer > 0 && !isSynthetic(a.acc)).map(a => a.bank.split(' / ')[0])).sort();
    const plats = uniq(S.data.social.map(s => s.platform)).sort();
    el.innerHTML = `<div class="note warn">Templates are drafts to save typing. Check the sections of law, period and wording as per current law and your department's format before signing.</div>
      <div class="card"><div class="row"><label>Template</label><select id="ntT">${Object.entries(this.T).map(([k, t]) => `<option value="${k}">${esc(t.name)}</option>`).join('')}</select>
      <label>Bank</label><select id="ntB"><option value="">— choose —</option>${banks.map(b => `<option>${esc(b)}</option>`).join('')}</select>
      <label>Platform</label><select id="ntP"><option value="">— choose —</option>${[...new Set([...plats, ...PLATFORMS])].map(b => `<option>${esc(b)}</option>`).join('')}</select>
      <label>Ref No</label><input id="ntRef" style="width:150px"><button class="btn primary" id="ntGo">Generate</button></div></div>
      <div class="card"><textarea id="ntOut" style="min-height:420px;font-family:Georgia,serif;font-size:14px"></textarea><div class="row" style="margin-top:8px"><button class="btn" id="ntPrint">🖨 Print</button><button class="btn" id="ntCopy">Copy</button><button class="btn" id="ntDoc">⬇ Word (.doc)</button><button class="btn" id="ntTask">+ Add follow-up task</button></div></div>`;
    $('#ntGo', el).onclick = () => $('#ntOut', el).value = this.fill($('#ntT', el).value, $('#ntB', el).value, $('#ntP', el).value, $('#ntRef', el).value);
    $('#ntPrint', el).onclick = () => Reports.printText($('#ntOut', el).value);
    $('#ntCopy', el).onclick = () => { navigator.clipboard?.writeText($('#ntOut', el).value); UI.toast('Copied'); };
    $('#ntDoc', el).onclick = () => UI.download('notice.doc', `<html><head><meta charset="utf-8"></head><body style="font-family:Times New Roman;font-size:12pt;white-space:pre-wrap">${esc($('#ntOut', el).value)}</body></html>`, 'application/msword');
    $('#ntTask', el).onclick = () => { const t = this.T[$('#ntT', el).value]; S.data.tasks.push({ id: uid(), text: 'Follow up: ' + t.name + ' – ' + ($('#ntB', el).value || $('#ntP', el).value || ''), due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), done: false }); saveCase(); UI.toast('Task added (due in 7 days)'); };
    $('#ntGo', el).click();
  },
  fill(key, bank, platform, ref) {
    const t = this.T[key], c = activeCase();
    const accs = Analysis.accountRows().filter(a => a.layer > 0 && !isSynthetic(a.acc) && (!bank || a.bank.includes(bank)));
    const accLines = accs.slice(0, 60).map((a, i) => `${i + 1}. A/c ${a.acc}${a.name ? ' – ' + a.name : ''}${a.ifsc ? ' – IFSC ' + a.ifsc : ''} – amount received ${fmtINR(a.inAmt)}${a.ackList ? ' (Ack ' + a.ackList + ')' : ''}`).join('\n') || '1. A/c ____________ IFSC ________ amount ₹________';
    const profs = S.data.social.filter(s => !platform || s.platform === platform);
    const profLines = uniq(profs.map(s => s.profile || s.mobile)).slice(0, 40).map((p, i) => `${i + 1}. ${p}`).join('\n') || '1. ____________ (profile URL / username / phone number)';
    const mobs = uniq([...S.data.kyc.map(k => k.mobile), ...S.data.ncrp.map(n => n.suspect_mobile), ...S.data.social.map(s => s.mobile)]).slice(0, 40).map((m, i) => `${i + 1}. ${m}`).join('\n') || '1. __________';
    const v = { bank: bank || '____________ Bank', platform: platform || '____________', tsp: '____________ (Jio / Airtel / Vi / BSNL)', ps: c.ps || '________', fir: c.fir ? 'FIR No. ' + c.fir : 'Case No. ________', section: c.section || '________', district: c.district || 'Ghaziabad', juris: juris(c.district), ack: c.ack || uniq(S.data.txns.map(x => x.ack_no)).slice(0, 5).join(', ') || '________', io_email: c.io_email || '________', accounts: accLines, profiles: profLines, mobiles: mobs };
    const f = s => s.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? '');
    return `${ref ? 'Ref. No.: ' + ref + '\n' : ''}Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}\n\nTo,\n${f(t.to)}\n\nSubject: ${f(t.subject)}\n\nSir / Madam,\n\n${f(t.body)}\n\nThis is a matter of urgency as it relates to the proceeds of crime and loss to the victim(s).\n\n\n(${c.io || 'Name of IO'})\n${c.io_rank || 'Designation'}\nPolice Station ${c.ps || '________'}, ${v.juris}\nMobile: ${c.io_mobile || '________'}  E-mail: ${c.io_email || '________'}`;
  }
};

/* ---------- Reports ---------- */
const Reports = {
  win(title, html) {
    const w = window.open('', '_blank'); if (!w) { UI.toast('Pop-up blocked. Allow pop-ups for this page.'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font:12.5px/1.45 "Segoe UI",Arial,sans-serif;color:#111;margin:28px} h1{font-size:20px;margin:0} h2{font-size:15px;border-bottom:2px solid #2a78d6;padding-bottom:3px;margin-top:26px}
      table{border-collapse:collapse;width:100%;margin:6px 0;font-size:11.5px} th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top} th{background:#eef3fb}
      td.n{text-align:right} .kp{display:inline-block;border:1px solid #ccc;border-radius:6px;padding:6px 12px;margin:4px 6px 4px 0} .kp b{display:block;font-size:16px}
      .muted{color:#666} svg{max-width:100%;height:auto;border:1px solid #ddd} @media print{.noprint{display:none} h2{break-after:avoid} tr{break-inside:avoid}}</style></head><body>
      <div class="noprint" style="margin-bottom:14px"><button onclick="print()">🖨 Print / Save as PDF</button></div>${html}</body></html>`);
    w.document.close();
  },
  printText(t) { this.win('Notice', `<div style="white-space:pre-wrap;font-family:Georgia,serif;font-size:14px;max-width:760px">${esc(t)}</div>`); },
  tbl(cols, rows, max = 200) { return `<table><tr>${cols.map(c => `<th>${esc(c[1])}</th>`).join('')}</tr>${rows.slice(0, max).map(r => `<tr>${cols.map(c => `<td class="${c[2] ? 'n' : ''}">${esc(c[2] ? c[2](r[c[0]]) : r[c[0]])}</td>`).join('')}</tr>`).join('')}</table>${rows.length > max ? `<p class="muted">… ${rows.length - max} more rows (see Excel export)</p>` : ''}`; },
  caseReport() {
    const c = activeCase(), d = S.data, acc = Analysis.accountRows().filter(a => !isSynthetic(a.acc));
    // render flow graph offscreen
    let svg = '';
    try { const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-9999px;width:1200px;height:800px'; document.body.appendChild(box);
      const { nodes, edges } = finGraphData({ mode: 'flow', min: 0 }); if (nodes.length) { svg = Graph.mount(box, nodes, edges, { mode: 'flow' }).exportSVG().str; } box.remove(); } catch (e) { }
    const common = ['account', 'mobile', 'email', 'pan', 'aadhaar', 'ifsc'].map(f => [f, Analysis.finCommon(f).filter(g => g.n >= 2 && (g.accs >= 2 || g.acks >= 2)).sort((a, b) => b.n - a.n)]).filter(x => x[1].length);
    const xl = Analysis.crossLinks().filter(x => x.sections >= 2 || x.refs >= 2).sort((a, b) => b.sections - a.sections || b.refs - a.refs);
    const socC = ['mobile', 'email', 'imei', 'ip'].map(f => [f, Analysis.socCommon(f).filter(g => g.profiles >= 2)]).filter(x => x[1].length);
    const html = `<h1>Case Analysis Report</h1><div class="muted">Generated ${new Date().toLocaleString('en-IN')} · SudarshanAshtra</div>
      <h2>Case details</h2><table>${[['Case', c.name], ['FIR / Case No', c.fir], ['Sections', c.section], ['Police Station', c.ps], ['Police Commissionerate', juris(c.district)], ['IO', [c.io, c.io_rank].filter(Boolean).join(', ')], ['NCRP Ack', c.ack], ['Status', c.status], ['Brief facts', c.desc]].filter(r => r[1]).map(r => `<tr><th style="width:180px">${r[0]}</th><td style="white-space:pre-wrap">${esc(r[1])}</td></tr>`).join('')}</table>
      <h2>Summary</h2>${[['Complaints', d.ncrp.length], ['Reported loss', fmtINR(sum(d.ncrp, r => r.amount))], ['Transactions analysed', d.txns.length], ['Accounts in trail', acc.length], ['Max layer', Math.max(0, ...acc.map(a => a.layer))], ['Amount on hold', fmtINR(sum(acc, a => a.hold))], ['High-risk accounts', acc.filter(a => a.score >= 60).length], ['Social profiles', d.social.length]].map(k => `<span class="kp">${k[0]}<b>${k[1]}</b></span>`).join('')}
      ${d.ncrp.length ? '<h2>NCRP complaints</h2>' + this.tbl([['ack_no', 'Ack No'], ['date', 'Date'], ['victim_name', 'Victim'], ['district', 'District'], ['category', 'Category'], ['amount', 'Amount', fmtINR], ['hold_amount', 'Hold', fmtINR], ['status', 'Status']], d.ncrp) : ''}
      ${svg ? '<h2>Money trail flow chart</h2>' + svg : ''}
      ${acc.length ? '<h2>Suspect accounts (by risk)</h2>' + this.tbl([['acc', 'Account'], ['name', 'Name'], ['bank', 'Bank'], ['ifsc', 'IFSC'], ['layer', 'Layer'], ['inAmt', 'Received', fmtINR], ['outAmt', 'Sent', fmtINR], ['hold', 'Hold', fmtINR], ['acks', 'Complaints'], ['score', 'Risk'], ['flagsT', 'Why']], acc.map(a => ({ ...a, flagsT: a.flags.join('; ') })).sort((a, b) => b.score - a.score), 100) : ''}
      ${d.txns.length ? '<h2>Layer-wise transactions</h2>' + this.tbl([['layer', 'Layer'], ['ack_no', 'Ack'], ['from_acc', 'From'], ['to_acc', 'To'], ['to_bank', 'Bank'], ['amount', 'Amount', fmtINR], ['date', 'Date'], ['txn_id', 'UTR'], ['action', 'Action']], d.txns.slice().sort((a, b) => (a.layer || 99) - (b.layer || 99) || String(a.date).localeCompare(b.date)), 300) : ''}
      ${common.map(([f, rows]) => `<h2>Common ${esc(Analysis.FIN_COMMON[f].label)}</h2>` + this.tbl([['value', 'Value'], ['n', 'Times'], ['accs', 'Accounts'], ['acks', 'Complaints'], ['amount', 'Amount', fmtINR], ['accList', 'Account list']], rows, 50)).join('')}
      ${socC.map(([f, rows]) => `<h2>Social media – common ${f}</h2>` + this.tbl([['value', 'Value'], ['profiles', 'Profiles'], ['platformList', 'Platforms'], ['profileList', 'Profile list']], rows, 50)).join('')}
      ${xl.length ? '<h2>Cross-linked identifiers (across sources)</h2>' + this.tbl([['type', 'Type'], ['value', 'Value'], ['sectionList', 'Sections'], ['refList', 'Where found']], xl, 100) : ''}
      ${d.notes.length ? '<h2>Case notes</h2>' + d.notes.map(n => `<p><b>${esc(n.when.slice(0, 10))} · ${esc(n.title || n.tag)}</b><br>${esc(n.text)}</p>`).join('') : ''}
      ${d.tasks.filter(t => !t.done).length ? '<h2>Pending tasks</h2><ul>' + d.tasks.filter(t => !t.done).map(t => `<li>${esc(t.text)} ${t.due ? '(due ' + esc(t.due) + ')' : ''}</li>`).join('') + '</ul>' : ''}`;
    this.win('Case report – ' + (c.name || ''), html);
  },
  excel() {
    const d = S.data, wb = XLSX.utils.book_new();
    const add = (name, rows) => { if (rows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31)); };
    const strip = arr => arr.map(r => Object.fromEntries(Object.entries(r).filter(([k, v]) => !k.startsWith('_') && k !== 'id' && typeof v !== 'object' || k === '_src')));
    add('Transactions', strip(d.txns)); add('KYC', strip(d.kyc)); add('Social', strip(d.social)); add('NCRP', strip(d.ncrp));
    add('Accounts & risk', Analysis.accountRows().map(a => ({ ...a, flags: a.flags.join('; ') })));
    for (const f of ['account', 'beneficiary', 'mobile', 'email', 'pan', 'aadhaar', 'ifsc', 'state', 'district']) add('Common ' + f, Analysis.finCommon(f).filter(g => g.n >= 2).map(({ recs, ...g }) => g));
    for (const f of ['mobile', 'email', 'imei', 'ip']) add('Social common ' + f, Analysis.socCommon(f).filter(g => g.profiles >= 2).map(({ recs, ...g }) => g));
    add('Cross links', Analysis.crossLinks().filter(x => x.refs >= 2).map(({ items, ...x }) => x));
    add('Notes', d.notes); add('Tasks', d.tasks);
    if (!wb.SheetNames.length) { UI.toast('No data to export'); return; }
    XLSX.writeFile(wb, (activeCase().name || 'case').replace(/[^\w\- ]/g, '_') + '_analysis.xlsx');
  },
  async backup() {
    if (S.caseId) await DB.set('case:' + S.caseId, S.data);
    const data = {}; for (const c of S.cases) data[c.id] = await DB.get('case:' + c.id) || emptyCase();
    UI.download('sudarshanastra_backup_' + today() + '.json', JSON.stringify({ app: 'sudarshanastra', version: 1, exported: new Date().toISOString(), cases: S.cases, data }), 'application/json');
  },
  restore() {
    const fp = $('#filePick'); fp.value = ''; fp.onchange = async () => {
      try {
        const j = JSON.parse(await fp.files[0].text()); if (j.app !== 'sudarshanastra') throw new Error('Not a SudarshanAshtra backup');
        const mode = prompt('Type MERGE to add these cases to existing ones, or REPLACE to delete current cases and restore only the backup:', 'MERGE'); if (!mode) return;
        if (mode.toUpperCase() === 'REPLACE') { for (const c of S.cases) await DB.del('case:' + c.id); S.cases = []; }
        for (const c of j.cases) { if (S.cases.some(x => x.id === c.id)) c.id = uid() + '', c.name += ' (restored)'; S.cases.push(c); await DB.set('case:' + c.id, j.data[c.id] || j.data[Object.keys(j.data)[j.cases.indexOf(c)]] || emptyCase()); }
        await saveMeta(); await switchCase(S.cases[S.cases.length - 1].id); UI.toast('Backup restored');
      } catch (e) { UI.toast('Restore failed: ' + e.message, 5000); }
    }; fp.click();
  }
};

/* ---------- Routing ---------- */
function go(page, sub) { S.page = page; if (sub) S.sub[page] = sub; UI.closeDrawer(); render(); }
function render() {
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === S.page));
  const main = $('#main'); main.scrollTop = 0;
  try { (Pages[S.page] || Pages.dashboard)(main); } catch (e) { console.error(e); main.innerHTML = `<div class="card err">Error: ${esc(e.message)}</div>`; }
  const d = S.data; $('#sideInfo').innerHTML = `<b>${esc(activeCase().name || '')}</b><br>${d.txns.length} txns · ${d.kyc.length} KYC<br>${d.social.length} social · ${typeof Trail !== 'undefined' ? Trail.complaints().length : d.ncrp.length} complaints<br><br>🔒 Data stays on this computer.`;
}
function applyTheme() { document.documentElement.dataset.theme = S.settings.theme === 'light' ? 'light' : 'dark'; try { DocFont.apply(); } catch (e) { } }

/* ---------- Cases ---------- */
function fillCaseSel() { $('#caseSel').innerHTML = S.cases.map(c => `<option value="${c.id}" ${c.id === S.caseId ? 'selected' : ''}>${esc(c.name)}${c.fir ? ' · ' + esc(c.fir) : ''}</option>`).join(''); }
async function switchCase(id) {
  if (S.caseId && S.data) { clearTimeout(saveTimer); await DB.set('case:' + S.caseId, S.data); }
  S.caseId = id; S.data = Object.assign(emptyCase(), await DB.get('case:' + id) || {}); Analysis.invalidate(); S.graphOpt = null; S.filterBank = null; S.trailAck = '';
  await saveMeta(); fillCaseSel(); render();
}
async function newCase(name) {
  name = name || prompt('Name of the new case (e.g. "FIR 123/2026 – Investment fraud"):'); if (!name) return;
  const c = { id: uid(), name, created: new Date().toISOString(), status: 'Under investigation' };
  S.cases.push(c); await DB.set('case:' + c.id, emptyCase()); await switchCase(c.id); UI.toast('Case created');
}
/* ---------- Case box: one form to select / create a case and fill its main details (used on Dashboard and top bar) ---------- */
const CaseBox = {
  F: [['ctype', 'Case Type', 'ct'], ['fir', 'FIR No.'], ['year', 'Year'], ['ps', 'Police Station'], ['district', 'District / Commissionerate'], ['state', 'State', 'st'], ['io', 'IO Name'], ['io_mobile', 'IO Mobile'], ['io_posting', 'IO Posting'], ['section', 'Sections of law']],
  states() { try { return Off.INST; } catch (e) { return []; } },
  types() { try { return Off.ctList(); } catch (e) { return ['Investment Fraud', 'Mobile Hacking (APK)', 'Social Media']; } },
  yearOf(c) { return c.year || ((String(c.fir || '').match(/\/\s*(20\d\d)\b/) || [])[1]) || ''; },
  autoName(o) { const f = String(o.fir || '').replace(/^\s*FIR\s*(No\.?)?\s*/i, ''); return [o.ctype || 'Case', f ? 'FIR ' + f + (o.year && !f.includes(o.year) ? '/' + o.year : '') : ''].filter(Boolean).join(' · '); },
  field(k, l, t, v) { const opts = (L, add) => `<option value="">— select —</option>${[...L, ...(v && !L.includes(v) ? [v] : [])].map(s => `<option ${s === v ? 'selected' : ''}>${esc(s)}</option>`).join('')}${add ? '<option value="__new">➕ Add new…</option>' : ''}`;
    return `<label>${l}${t === 'ct' ? `<select data-cb="${k}">${opts(this.types(), true)}</select>` : t === 'st' ? `<select data-cb="${k}">${opts(this.states())}</select>` : `<input data-cb="${k}" value="${esc(v || '')}"${k === 'year' ? ' inputmode="numeric" maxlength="4"' : k === 'io_mobile' ? ' inputmode="tel" maxlength="14"' : ''}>`}</label>`; },
  wire(box) { const ct = $('[data-cb="ctype"]', box); if (ct) ct.onchange = () => { if (ct.value !== '__new') return; const n = (prompt('New case type:') || '').trim(); if (!n) { ct.value = ''; return; } try { const L = Off.ctList(); if (!L.includes(n)) { L.push(n); EditList.save('cd-ctype', L); } } catch (e) { } ct.insertAdjacentHTML('afterbegin', `<option>${esc(n)}</option>`); ct.value = n; }; },
  read(box) { const o = {}; $$('[data-cb]', box).forEach(i => o[i.dataset.cb] = i.value === '__new' ? '' : i.value.trim()); return o; },
  check(o) { if (o.year && !/^(19|20)\d\d$/.test(o.year)) return 'Year should be 4 digits, e.g. 2026'; if (o.io_mobile && !/^(\+?91)?[6-9]\d{9}$/.test(o.io_mobile.replace(/[\s-]/g, ''))) return 'IO mobile should be a 10-digit mobile number'; return ''; },
  // modal: Select case (or new) → fill details → Save / Close
  open(id) {
    let sel = id === 'new' ? 'new' : (id || S.caseId);
    const draw = () => { const c = sel === 'new' ? { year: String(new Date().getFullYear()), ps: activeCase().ps || '', district: activeCase().district || '', state: activeCase().state || 'UP – Uttar Pradesh' } : S.cases.find(x => x.id === sel) || {};
      const m = UI.modal(sel === 'new' ? '➕ New case' : '📁 Case details', `<div class="cb-sel"><label>Select case<select id="cbSel"><option value="new" ${sel === 'new' ? 'selected' : ''}>➕ New case</option>${S.cases.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}${x.fir ? ' · ' + esc(x.fir) : ''}</option>`).join('')}</select></label></div>
        <div class="map-grid cb-grid">${this.F.map(([k, l, t]) => this.field(k, l, t, k === 'year' ? this.yearOf(c) : c[k])).join('')}<label style="grid-column:1/-1">Case name <span class="small muted">(blank = made from Case Type and FIR)</span><input data-cb="name" value="${esc(sel === 'new' ? '' : c.name || '')}" placeholder="${esc(this.autoName(c))}"></label></div><div class="small" id="cbErr" style="color:var(--bad);min-height:1.2em"></div>`,
        [{ label: 'Close', onClick: UI.closeModal }, { label: sel === 'new' ? '💾 Save new case' : '💾 Save', cls: 'primary', onClick: () => this.save(sel, m) }]);
      this.wire(m); $('#cbSel', m).onchange = e => { sel = e.target.value; draw(); }; };
    draw();
  },
  async save(sel, box) { const o = this.read(box), err = this.check(o); if (err) { $('#cbErr', box).textContent = err; return; }
    o.name = o.name || this.autoName(o);
    if (sel === 'new') { const c = { id: uid(), created: new Date().toISOString(), status: 'Under investigation', ...o }; S.cases.push(c); await DB.set('case:' + c.id, emptyCase()); UI.closeModal(); await switchCase(c.id); UI.toast('Case saved – now import its data'); return; }
    const c = S.cases.find(x => x.id === sel); if (!c) return; Object.assign(c, o); UI.closeModal();
    if (sel !== S.caseId) await switchCase(sel); else { await saveMeta(); fillCaseSel(); render(); } UI.toast('Case details saved');
  },
  // strip on the Dashboard: shows the details, ✏ edit in place, ➕ new, ➖ delete
  strip(el) { const c = activeCase(), V = k => k === 'year' ? this.yearOf(c) : c[k];
    const filled = this.F.filter(([k]) => V(k)).length;
    el.innerHTML = `<div class="cb-strip"><div class="cb-hd"><span class="cb-ic">📁</span><b>Case details</b><span class="cb-sub">${esc(c.name || '')}</span><span class="grow"></span><button class="btn sm cb-b" id="cbEd">✏ Edit</button><button class="btn sm cb-b" id="cbNew" title="New case">➕</button><button class="btn sm cb-b cb-x" id="cbDel" title="Delete this case">➖</button><span class="cb-big">${filled}/${this.F.length}<small>fields filled</small></span></div>
      <div class="cb-chips">${this.F.map(([k, l]) => `<div class="cb-chip ${V(k) ? '' : 'empty'}"><span>${l}</span><b>${esc(V(k) || '—')}</b></div>`).join('')}</div></div>`;
    $('#cbNew', el).onclick = () => this.open('new'); $('#cbDel', el).onclick = () => deleteCase(c.id);
    $('#cbEd', el).onclick = () => { $('.cb-chips', el).outerHTML = `<div class="map-grid cb-grid cb-inl">${this.F.map(([k, l, t]) => this.field(k, l, t, V(k))).join('')}</div><div class="row" style="gap:6px;margin-top:8px;align-items:center"><button class="btn primary sm" id="cbSv">💾 Save</button><button class="btn sm" id="cbCx">Cancel</button><span class="small" id="cbErr" style="color:var(--bad)"></span></div>`;
      $('#cbEd', el).style.display = 'none'; this.wire(el);
      $('#cbCx', el).onclick = () => this.strip(el);
      $('#cbSv', el).onclick = async () => { const o = this.read(el), err = this.check(o); if (err) return $('#cbErr', el).textContent = err; const auto = !c.name || c.name === this.autoName(c) || /^Case \d+$/.test(c.name); Object.assign(c, o); if (auto) c.name = this.autoName(c); await saveMeta(); fillCaseSel(); render(); UI.toast('Case details saved'); }; };
  }
};
async function deleteCase(id) {
  const c = S.cases.find(x => x.id === id); if (!c || !UI.confirm(`Delete case "${c.name}" and ALL its data? Download a backup first if unsure.`)) return;
  await DB.del('case:' + id); S.cases = S.cases.filter(x => x.id !== id);
  if (!S.cases.length) { S.caseId = null; await newCase('Case 1'); return; }
  if (S.caseId === id) { S.caseId = null; await switchCase(S.cases[0].id); } else { await saveMeta(); render(); }
}

/* ---------- Login & lock ---------- */
let lastAct = Date.now();
/* home page: the Login buttons open the login box */
function showLogin(on = true) { $('#lgWrap').classList.toggle('open', on); $('#lgWrap').setAttribute('aria-hidden', on ? 'false' : 'true'); if (on) setTimeout(() => $('#lgUser').value ? $('#lgPass').focus() : $('#lgUser').focus(), 60); }
$$('[data-login]').forEach(b => b.onclick = () => showLogin());
$('#lgClose').onclick = () => showLogin(false);
$('#lgWrap').onclick = e => { if (e.target.id === 'lgWrap') showLogin(false); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#lgWrap').classList.contains('open') && $('#modal').classList.contains('hidden')) showLogin(false); });
/* stay signed in across a page refresh: the sign-in is kept for this browser tab only (sessionStorage) and ends
   when the tab or browser is closed, on Lock, on auto-lock, or when the password changes */
const Sess = {
  K: 'sud-session',
  sig: tok => sha256(tok + '|' + S.settings.user + '|' + S.settings.hash),
  save() { try { const tok = uid() + uid(); sessionStorage.setItem(this.K, JSON.stringify({ tok, sig: this.sig(tok), at: Date.now() })); } catch (e) { } },
  touch(active = true) { try { const o = JSON.parse(sessionStorage.getItem(this.K) || 'null'); if (o) { if (active) o.at = Date.now(); o.page = S.page; o.sub = S.sub; sessionStorage.setItem(this.K, JSON.stringify(o)); } } catch (e) { } },
  clear() { try { sessionStorage.removeItem(this.K); } catch (e) { } },
  valid() {
    try {
      const o = JSON.parse(sessionStorage.getItem(this.K) || 'null'); if (!o || !o.tok || o.sig !== this.sig(o.tok)) return null;
      if (S.settings.lockMins > 0 && Date.now() - (o.at || 0) > S.settings.lockMins * 60000) { this.clear(); return null; }
      return o;
    } catch (e) { return null; }
  }
};
function lock() { Sess.clear(); $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); showLogin(); $('#lgPass').value = ''; $('#lgErr').textContent = ''; UI.closeDrawer(); UI.closeModal(); $('#lgUser').focus(); }
async function boot() {
  await DB.open();
  S.settings = await DB.get('settings');
  if (!S.settings) { const salt = uid(); S.settings = { user: 'admin', salt, hash: hashPass('admin@123', salt), theme: 'dark', lockMins: 15, mustChange: true }; await DB.set('settings', S.settings); }
  applyTheme();
  if (S.settings.mustChange) $('#lgFirst').innerHTML = 'First time? Default login ID <b>admin</b>, password <b>admin@123</b>. You will be asked to change it.';
  const back = Sess.valid();
  if (back && !S.settings.mustChange) { // page was refreshed while signed in: go straight back to where you were
    if (back.sub && typeof back.sub === 'object') S.sub = Object.assign(S.sub || {}, back.sub);
    if (back.page && back.page !== 'search') S.page = back.page;
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); lastAct = Date.now(); Sess.save(); await start();
  }
  $('#loginForm').onsubmit = async e => {
    e.preventDefault();
    if ($('#lgUser').value.trim() !== S.settings.user || hashPass($('#lgPass').value, S.settings.salt) !== S.settings.hash) { $('#lgErr').textContent = 'Wrong login ID or password'; return; }
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); showLogin(false); lastAct = Date.now(); Sess.save();
    if (!S.data) await start();
    if (S.settings.mustChange) { go('settings'); UI.toast('Please set your own login ID and password now', 5000); }
  };
}
async function start() {
  S.cases = await DB.get('cases') || []; S.caseId = await DB.get('caseId');
  if (!S.cases.length) { const c = { id: uid(), name: 'Case 1', created: new Date().toISOString(), status: 'Under investigation' }; S.cases.push(c); await DB.set('case:' + c.id, emptyCase()); S.caseId = c.id; }
  if (!S.cases.some(c => c.id === S.caseId)) S.caseId = S.cases[0].id;
  S.data = Object.assign(emptyCase(), await DB.get('case:' + S.caseId) || {});
  await saveMeta(); fillCaseSel();
  $$('.nav-item').forEach(n => n.onclick = () => go(n.dataset.page));
  $('#caseSel').onchange = e => switchCase(e.target.value);
  $('#btnNewCase').onclick = () => CaseBox.open('new');
  $('#btnLock').onclick = lock;
  $('#btnTheme').onclick = async () => { S.settings.theme = S.settings.theme === 'light' ? 'dark' : 'light'; applyTheme(); await saveMeta(); render(); };
  $('#drClose').onclick = UI.closeDrawer; $('#mdClose').onclick = UI.closeModal;
  $('#gsearch').onkeydown = e => { if (e.key === 'Enter') { S.searchQ = e.target.value; go('search'); } };
  let tT = 0; ['mousemove', 'keydown', 'click', 'wheel'].forEach(ev => document.addEventListener(ev, () => { lastAct = Date.now(); if (Date.now() - tT > 20000 && !$('#app').classList.contains('hidden')) { tT = Date.now(); Sess.touch(); } }, { passive: true }));
  setInterval(() => { if (S.settings.lockMins > 0 && !$('#app').classList.contains('hidden') && Date.now() - lastAct > S.settings.lockMins * 60000) lock(); }, 15000);
  window.addEventListener('beforeunload', () => { if (S.caseId) DB.set('case:' + S.caseId, S.data); if (!$('#app').classList.contains('hidden')) Sess.touch(Date.now() - lastAct < 60000); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { UI.closeDrawer(); } });
  render();
}
boot().catch(e => { document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif">Could not start: ${esc(e.message)}<br>Use Google Chrome or Microsoft Edge. If you opened the file from inside a ZIP, extract the folder first.</div>`; });
