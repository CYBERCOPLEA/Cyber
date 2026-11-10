/* cctns.js – Investigation › CCTNS
   1. Case Diary: all cases at a glance, pick one, read its FIR and case-diary parts, see work done and what is still
      pending (and from whom to demand it), and draft BNSS notices (94, 106, 35(3), 179) in one click.
   2. Upload File +: drop any file or folder – it is sorted to the right analysis automatically.
   Everything is read and kept on this computer. */
'use strict';
const CCTNS = {
  st() { const d = S.data; if (!d.cctns) d.cctns = {}; const c = d.cctns; c.fir = c.fir || null; c.cd = c.cd || []; c.docs = c.docs || []; c.notices = c.notices || []; c.flags = c.flags || {}; return c; },

  /* ---------- reading FIR / case diary text ---------- */
  async text(f) { try { return (await GReply.read(f)).text || ''; } catch (e) { return ''; } },
  facts(t) {
    t = String(t || ''); const one = re => { const m = t.match(re); return m ? m[1].trim() : ''; };
    const secs = uniq((t.match(/\b\d{2,3}[A-Z]?(?:\(\d+\))*(?:\s*(?:\/|,|&|and|व)\s*\d{2,3}[A-Z]?(?:\(\d+\))*)*\s*(?:BNS|IPC|IT\s*Act|BNSS|आईटी|बीएनएस)\b/gi) || []).map(s => s.replace(/\s+/g, ' ')));
    const amt = (t.match(/(?:Rs\.?|₹|INR|रु\.?|रुपये)\s*([\d,]{3,}(?:\.\d+)?)/gi) || []).map(x => +x.replace(/^\D+/, '').replace(/[^\d.]/g, '')).filter(Boolean);
    const ids = extractIdentifiers(t);
    return {
      fir: one(/(?:FIR|F\.I\.R\.?|Case|मु0?\s*अ0?\s*सं0?|मुकदमा)\s*(?:No\.?|Number|संख्या|नं0?)?\s*[:\-.]?\s*(\d{1,5}\s*\/\s*\d{2,4})/i),
      date: one(/(?:Date|दिनांक|Dated)\s*(?:of\s*(?:FIR|registration))?\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i),
      ps: one(/(?:P\.?S\.?|Police Station|थाना)\s*[:\-]?\s*([A-Za-zऀ-ॿ .]{3,40}?)(?:\s{2,}|,|\n|District|जनपद|$)/i),
      complainant: one(/(?:Complainant|Informant|वादी|शिकायतकर्ता)(?:'s)?\s*(?:Name|का नाम)?\s*[:\-]\s*([^\n,]{3,60})/i),
      accused: uniq((t.match(/(?:Accused|अभियुक्त|आरोपी)\s*(?:Name|का नाम)?\s*[:\-]\s*([^\n]{3,80})/gi) || []).map(x => x.replace(/^[^:\-]*[:\-]\s*/, '').trim())).slice(0, 20),
      sections: secs, amount: amt.length ? Math.max(...amt) : 0, ids
    };
  },
  saveIds(t, src) { const ids = extractIdentifiers(t); const have = new Set(S.data.idents.map(i => i.type + '|' + i.value + '|' + i.source)); for (const x of ids) if (!have.has(x.type + '|' + x.value + '|' + src)) S.data.idents.push({ id: uid(), ...x, source: src }); return ids.length; },
  cdMeta(t, name) { const no = (String(t).match(/(?:C\.?\s*D\.?|Case Diary|पर्चा|केस डायरी)\s*(?:No\.?|Part|संख्या|नं0?)?\s*[:\-.]?\s*(\d{1,3})/i) || String(name).match(/(?:cd|parcha|part)[\s_\-]*(\d{1,3})/i) || [])[1] || ''; const date = (String(t).match(/(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2})/) || [])[1] || ''; return { no, date }; },
  async addFir(f) { const t = await this.text(f); if (!t.trim()) { UI.toast('Could not read text from ' + f.name + ' (a scanned PDF needs OCR first)', 6000); return 0; } this.st().fir = { file: f.name, text: t, when: new Date().toISOString() }; this.saveIds(t, 'FIR · ' + f.name); this.fillCase(t); return 1; },
  async addCd(f) { const t = await this.text(f); if (!t.trim()) { UI.toast('Could not read text from ' + f.name, 6000); return 0; } const m = this.cdMeta(t, f.name); this.st().cd.push({ id: uid(), no: m.no, date: m.date, file: f.name, text: t, when: new Date().toISOString() }); this.saveIds(t, 'Case diary · ' + f.name); return 1; },
  async addDoc(f, kind) { const t = await this.text(f); this.st().docs.push({ id: uid(), file: f.name, kind: kind || 'Document', text: t.slice(0, 2e6), when: new Date().toISOString() }); return t ? this.saveIds(t, (kind || 'Document') + ' · ' + f.name) : 0; },
  fillCase(t) { const c = activeCase(), F = this.facts(t); let ch = 0; if (!c.fir && F.fir) { c.fir = F.fir; ch++; } if (!c.ps && F.ps) { c.ps = F.ps; ch++; } if (!c.section && F.sections.length) { c.section = F.sections.join(', '); ch++; } if (ch) saveMeta(); },

  /* ---------- what is done, what is pending, from whom ---------- */
  work(d = S.data, meta = activeCase()) {
    const c = d.cctns || {}, W = [], acc = (() => { try { return Analysis.accountRows().filter(a => !isSynthetic(a.acc)); } catch (e) { return []; } })();
    const add = (k, title, done, detail, demand, notice, items) => W.push({ k, title, status: done === null ? 'n/a' : done ? 'Done' : 'Pending', detail, demand: demand || '', notice: notice || '', items: items || [] });
    add('fir', 'FIR read into the tool', !!c.fir, c.fir ? 'FIR: ' + c.fir.file : 'Upload the FIR PDF / text under Case Diary', '', '');
    add('cd', 'Case diary written', (c.cd || []).length > 0, (c.cd || []).length ? `${c.cd.length} part(s), last ${(c.cd.slice(-1)[0].date || c.cd.slice(-1)[0].when.slice(0, 10))}` : 'No case-diary part uploaded yet', '', '');
    add('ncrp', 'NCRP complaint / money trail imported', (d.ncrp || []).length + (d.txns || []).length > 0, `${fmtNum((d.ncrp || []).length)} complaints · ${fmtNum((d.txns || []).length)} transactions`, 'NCRP / CFCFRMS portal', '');
    const lay = acc.filter(a => a.layer > 0), kycSet = new Set((d.kyc || []).map(k => N.acc(k.acc))), noKyc = lay.filter(a => !kycSet.has(N.acc(a.acc)));
    const byBank = b => uniq(b.map(a => (a.bank || 'Bank not known').split(' / ')[0]));
    if (lay.length) add('kyc', 'KYC, statement & logs from banks', !noKyc.length, noKyc.length ? `${noKyc.length} of ${lay.length} beneficiary accounts have no KYC yet` : `KYC for all ${lay.length} accounts`, byBank(noKyc).join(', '), 'bank_kyc', noKyc.map(a => ({ what: a.acc, who: (a.bank || '').split(' / ')[0], name: a.name || '' })));
    else add('kyc', 'KYC, statement & logs from banks', null, 'No beneficiary account yet', '', '');
    const held = sum(acc, a => a.hold) || sum(d.ncrp || [], r => r.hold_amount), toFreeze = lay.filter(a => !(a.hold > 0) && a.inAmt > 0 && a.score >= 30);
    if (lay.length) add('freeze', 'Debit freeze / lien on mule accounts', !toFreeze.length, `${fmtINR(held)} on hold${toFreeze.length ? ` · ${toFreeze.length} risky account(s) not on hold` : ''}`, byBank(toFreeze).join(', '), 'bank_freeze', toFreeze.map(a => ({ what: a.acc, who: (a.bank || '').split(' / ')[0], name: a.name || '' })));
    const atm = (d.txns || []).filter(t => /atm|cash|withdraw/i.test([t.mode, t.action, t.atm_loc].join(' ')));
    if (atm.length) add('atm', 'ATM CCTV footage', !!(c.flags || {}).atm, `${atm.length} cash / ATM withdrawal(s) in the trail`, uniq(atm.map(t => t.to_bank || t.from_bank).filter(Boolean)).join(', '), 'atm_cctv', atm.slice(0, 50).map(t => ({ what: t.atm_loc || t.from_acc, who: t.from_bank || t.to_bank || '', name: t.date || '' })));
    const telT = new Set((d.tel || []).filter(r => r.kind !== 'TDR').map(r => N.mobile(r.target))), cafT = new Set((d.caf || []).map(r => N.mobile(r.mobile)));
    const sus = uniq([...(d.ncrp || []).map(n => n.suspect_mobile), ...(d.kyc || []).map(k => k.mobile), ...(d.social || []).map(s => s.mobile), ...(d.idents || []).filter(i => i.type === 'mobile' && /FIR|Case diary/.test(i.source || '')).map(i => i.value)].map(N.mobile).filter(m => /^[6-9]\d{9}$/.test(m)));
    const victims = new Set((d.ncrp || []).map(n => N.mobile(n.victim_mobile)));
    const susM = sus.filter(m => !victims.has(m)), noCdr = susM.filter(m => !telT.has(m)), noCaf = susM.filter(m => !cafT.has(m));
    if (susM.length) { add('cdr', 'CDR / IPDR of suspect mobiles', !noCdr.length, noCdr.length ? `${noCdr.length} of ${susM.length} suspect numbers have no CDR yet` : `CDR for all ${susM.length} numbers`, 'Telecom operator (Jio / Airtel / Vi / BSNL)', 'telecom', noCdr.map(m => ({ what: m, who: 'TSP', name: '' })));
      add('caf', 'CAF (SIM application form) of suspect mobiles', !noCaf.length, noCaf.length ? `${noCaf.length} of ${susM.length} suspect numbers have no CAF yet` : 'CAF for all numbers', 'Telecom operator (Jio / Airtel / Vi / BSNL)', 'telecom', noCaf.map(m => ({ what: m, who: 'TSP', name: '' }))); }
    const plats = uniq((d.social || []).map(s => Analysis.platOf(s)).filter(Boolean)), got = new Set([...(d.whatsapp || []).length ? ['whatsapp'] : [], ...(d.google || []).length ? ['google'] : [], ...(d.telegram || []).length ? ['telegram'] : [], ...uniq((d.meta || []).map(r => r.platform))]);
    const emails = uniq([...(d.ncrp || []).map(n => n.suspect_email), ...(d.kyc || []).map(k => k.email)].filter(e => /@gmail\.com$/i.test(e || '')));
    if (emails.length) plats.push('google');
    const noRep = uniq(plats).filter(p => !got.has(p));
    if (plats.length) add('social', 'Replies from social media / intermediaries', !noRep.length, noRep.length ? 'No reply yet from: ' + noRep.map(p => (Analysis.SOC_PLAT.find(x => x[0] === p) || [0, p])[1]).join(', ') : 'Replies received', noRep.map(p => (Analysis.SOC_PLAT.find(x => x[0] === p) || [0, p])[1]).join(', '), 'intermediary', noRep.map(p => ({ what: p === 'google' ? emails.join(', ') : '', who: (Analysis.SOC_PLAT.find(x => x[0] === p) || [0, p])[1], name: '' })));
    const accused = this.accused(d);
    add('accused', 'Accused identified', accused.length > 0, accused.length ? `${accused.length} suspect person(s) from KYC / FIR / complaints` : 'No suspect person identified yet', '', '');
    const n353 = (c.notices || []).filter(n => n.type === 'n353').length;
    if (accused.length) add('n353', 'Notice u/s 35(3) BNSS to accused', n353 >= accused.length || !!(c.flags || {}).n353, `${n353} of ${accused.length} accused served`, 'Accused persons', 'n353', accused.filter(a => !(c.notices || []).some(n => n.type === 'n353' && n.to === a.name)).map(a => ({ what: a.name, who: a.addr || '', name: a.mobile || '' })));
    add('arrest', 'Arrest / appearance', !!(c.flags || {}).arrest, (c.flags || {}).arrest ? 'Marked done on ' + (c.flags.arrest || '') : 'Tick when the accused is arrested or has appeared', '', '', null);
    add('cs', 'Charge-sheet / final report', !!(c.flags || {}).cs, (c.flags || {}).cs ? 'Marked done on ' + (c.flags.cs || '') : 'Tick when the charge-sheet / FR is filed', '', '', null);
    return W;
  },
  accused(d = S.data) {
    let acc = []; try { acc = Analysis.accountRows().filter(a => !isSynthetic(a.acc) && (a.score >= 60 || a.acks >= 2)); } catch (e) { }
    const kyc = new Map((d.kyc || []).map(k => [N.acc(k.acc), k])), out = new Map();
    for (const a of acc) { const k = kyc.get(N.acc(a.acc)) || {}; const nm = (k.name || a.name || '').split(' / ')[0].trim(); if (!nm) continue; if (!out.has(nm)) out.set(nm, { name: nm, mobile: k.mobile || '', addr: [k.address, k.district, k.state].filter(Boolean).join(', '), acc: a.acc, bank: (a.bank || '').split(' / ')[0], from: 'Mule account (risk ' + a.score + ')' }); }
    const F = d.cctns && d.cctns.fir ? this.facts(d.cctns.fir.text) : null;
    if (F) for (const n of F.accused) if (!out.has(n)) out.set(n, { name: n, mobile: '', addr: '', acc: '', bank: '', from: 'FIR' });
    return [...out.values()];
  },

  /* ---------- BNSS notices ---------- */
  T: {
    n353: { name: 'Notice of appearance – Sec 35(3) BNSS (to accused)', subject: 'Notice under Section 35(3) of the Bharatiya Nagarik Suraksha Sanhita, 2023 – {{fir}}',
      body: `Whereas, during the investigation of the above case registered at Police Station {{ps}}, District {{district}}, under {{section}}, it has been found that there are reasonable grounds to question you in connection with the said offence.\n\nNow, therefore, in exercise of the powers conferred under Section 35(3) of the Bharatiya Nagarik Suraksha Sanhita, 2023, you are hereby directed to appear before the undersigned at {{place}} on ____ / ____ / ______ at ______ hrs.\n\nYou are directed to comply with the following conditions:\n1. You shall not commit any offence.\n2. You shall not tamper with the evidence in the case in any manner.\n3. You shall not make any threat, inducement or promise to any person acquainted with the facts of the case.\n4. You shall appear before the court as and when required.\n5. You shall join the investigation as and when required and cooperate fully.\n6. You shall bring along: identity proof, mobile phone(s) and SIM(s) in use, bank passbook / cheque book / debit cards and statements of the following, and any other relevant document:\n{{items}}\n\nPlease note that as per Section 35(5) and 35(6) BNSS, failure to comply with the terms of this notice may render you liable to be arrested for the offence mentioned in the notice, subject to orders of a competent court.` },
    n179: { name: 'Notice to witness – Sec 179 BNSS', subject: 'Notice under Section 179 of the Bharatiya Nagarik Suraksha Sanhita, 2023 – {{fir}}',
      body: `In connection with the investigation of the above case registered at Police Station {{ps}}, District {{district}}, under {{section}}, it appears that you are acquainted with the facts and circumstances of the case.\n\nYou are therefore required under Section 179 BNSS to attend before the undersigned at {{place}} on ____ / ____ / ______ at ______ hrs for examination, along with the following, if any:\n{{items}}` },
    n94: { name: 'Production of documents – Sec 94 BNSS (general)', subject: 'Notice under Section 94 of the Bharatiya Nagarik Suraksha Sanhita, 2023 – {{fir}}',
      body: `The undersigned is investigating the above case registered at Police Station {{ps}}, District {{district}}, under {{section}}. The production of the following document(s) / electronic record(s) in your possession is necessary for the purpose of the investigation:\n\n{{items}}\n\nYou are hereby directed under Section 94 BNSS to produce / furnish the same to the undersigned within 3 days of receipt of this notice, in certified form along with the certificate under Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 for electronic records.` }
  },
  notice(type, item, extra = {}) {
    const c = activeCase(), base = Notices.T[type], mine = this.T[type];
    const items = (extra.items || []).map((x, i) => `${i + 1}. ${[x.what, x.name].filter(Boolean).join(' – ')}`).join('\n');
    let text;
    if (base) { text = Notices.fill(type, extra.bank || (item && /bank/i.test(item.who) ? item.who : ''), extra.platform || '', '', extra.company || '');
      if (items && type === 'telecom') text = text.replace(/1\. _{6,}[^\n]*|(\d+\. \d{10}\n?)+/m, items + '\n'); }
    else { const v = { ps: c.ps || '________', fir: c.fir ? 'FIR No. ' + c.fir : 'Case No. ________', section: c.section || '________', district: c.district || 'Ghaziabad', place: 'Police Station ' + (c.ps || '________') + (c.district ? ', ' + c.district : ''), items: items || '1. ____________' };
      const f = s => s.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? '');
      text = `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}\n\nTo,\n${extra.to || '____________'}\n${extra.addr || ''}${extra.mobile ? '\nMobile: ' + extra.mobile : ''}\n\nSubject: ${f(mine.subject)}\n\n${f(mine.body)}\n\n\n(${c.io || 'Investigating Officer'})\nInvestigating Officer\nPolice Station ${c.ps || '________'}${c.district ? ', ' + c.district : ''}`; text = NoticeKit.head(text, f(mine.subject).split(' – ')[0]); }
    return text;
  },
  openNotice(type, row) {
    const all = { ...Object.fromEntries(Object.entries(Notices.T).map(([k, t]) => [k, t.name])), ...Object.fromEntries(Object.entries(this.T).map(([k, t]) => [k, t.name])) };
    const acc = this.accused(), items = row && row.items ? row.items : [];
    const whoList = uniq(items.map(x => x.who).filter(Boolean));
    const body = UI.drawer('Draft notice', `<div class="note warn">Draft to save typing – check sections, dates and wording against current law and your office format before signing.</div>
      <div class="row" style="flex-wrap:wrap;gap:8px"><label>Notice</label><select id="ccT">${Object.entries(all).map(([k, n]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <label>To</label><select id="ccTo"></select><button class="btn primary" id="ccGo">Make draft</button></div>
      <textarea id="ccOut" style="min-height:430px;margin-top:10px"></textarea>
      <div class="row" style="margin-top:8px;gap:8px"><button class="btn" id="ccPr">🖨 Print</button><button class="btn" id="ccWd">⬇ Word (.docx)</button><button class="btn" id="ccCp">Copy</button><span class="spacer"></span><button class="btn primary" id="ccSave">✔ Save as sent + follow-up task</button></div>`);
    $('#drawer').classList.add('dx-wide');
    const banks = NoticeKit.caseBanks(), plats = NoticeKit.casePlats();
    const toList = () => { const t = $('#ccT', body).value, k = NoticeKit.kindOf(t), sel = $('#ccTo', body);
      const opts = [...whoList.map(w => ['w:' + w, w])];
      if (k === 'bank') banks.filter(b => !whoList.includes(b)).forEach(b => opts.push(['w:' + b, b]));
      if (k === 'plat') plats.filter(b => !whoList.includes(b)).forEach(b => opts.push(['w:' + b, b]));
      if (k === 'person' || k === 'other') acc.forEach((a, i) => opts.push(['a:' + i, a.name + (a.mobile ? ' · ' + a.mobile : '')]));
      NoticeKit.recipients(sel, k === 'other' ? 'person' : k, opts, ''); };
    const make = () => { const t = $('#ccT', body).value, w = $('#ccTo', body).value; let ex = { items };
      if (w.startsWith('w:') || w.startsWith('s:')) { const who = w.slice(2), mine = items.filter(x => x.who === who); ex = { items: mine.length ? mine : items, bank: who, platform: who, company: who, to: who }; }
      if (w.startsWith('a:')) { const a = acc[+w.slice(2)]; ex = { to: a.name, addr: a.addr, mobile: a.mobile, items: [{ what: a.acc ? 'A/c ' + a.acc : '', name: a.bank }] }; }
      $('#ccOut', body).value = this.notice(t, row, ex); };
    toList(); $('#ccGo', body).onclick = make; $('#ccT', body).onchange = () => { toList(); make(); }; $('#ccTo', body).onchange = make; make();
    NoticeKit.tools($('#ccPr', body).parentNode, $('#ccOut', body), { vars: () => { const w = NoticeKit.nameOf($('#ccTo', body).value); return { bank: w, platform: w, company: w }; } });
    $('#ccPr', body).onclick = () => Reports.printText($('#ccOut', body).value);
    $('#ccCp', body).onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('#ccOut', body).value); UI.toast('Copied'); };
    $("#ccWd", body).onclick = () => NoticeKit.docx('notice_' + $('#ccT', body).value + '.docx', $('#ccOut', body).value);
    $('#ccSave', body).onclick = () => { const t = $('#ccT', body).value, w = $('#ccTo', body), to = w.value ? w.options[w.selectedIndex].text.split(' · ')[0] : '';
      this.st().notices.push({ id: uid(), type: t, name: all[t], to, when: new Date().toISOString(), text: $('#ccOut', body).value });
      S.data.tasks.push({ id: uid(), text: 'Follow up: ' + all[t] + (to ? ' – ' + to : ''), due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), done: false });
      saveCase(); UI.toast('Notice saved in the case, follow-up task added'); UI.closeDrawer(); render(); };
  },

  /* ---------- all cases ---------- */
  async allCases() {
    const out = [];
    for (const c of S.cases) {
      let d = c.id === S.caseId ? S.data : Object.assign(emptyCase(), await DB.get('case:' + c.id) || {});
      let W = [];
      if (c.id === S.caseId) W = this.work(); else { const cur = S.data; S.data = d; Analysis.invalidate(); try { W = this.work(d, c); } catch (e) { } finally { S.data = cur; Analysis.invalidate(); } }
      const cc = d.cctns || {}, pend = W.filter(w => w.status === 'Pending');
      out.push({ id: c.id, name: c.name, fir: c.fir || '', ps: c.ps || '', io: c.io || '', section: c.section || '', status: c.status || 'Pending', complaints: (d.ncrp || []).length, txns: (d.txns || []).length,
        amount: sum(d.ncrp || [], r => +r.amount || 0), cd: (cc.cd || []).length, lastCd: (cc.cd || []).map(x => x.date || x.when.slice(0, 10)).sort().slice(-1)[0] || '', firUp: cc.fir ? 'Yes' : 'No',
        done: W.filter(w => w.status === 'Done').length, pending: pend.length, pendList: pend.map(w => w.title).join('; '), notices: (cc.notices || []).length, cur: c.id === S.caseId });
      await new Promise(r => setTimeout(r, 0));
    }
    return out;
  },

  /* ---------- page ---------- */
  diary(el) {
    const st = this.st(), c = activeCase(), W = this.work(), F = st.fir ? this.facts(st.fir.text) : null;
    const pend = W.filter(w => w.status === 'Pending'), done = W.filter(w => w.status === 'Done');
    el.innerHTML = `<div class="card cc-all"><div class="d2-hd"><h3>📚 All cases</h3><span class="sub">Search any case, see its work done and pending. Click a row to open that case here.</span></div><div class="kpis kpis-sm" id="ccK"></div><div id="ccAll" class="muted small">Reading your cases…</div></div>
      <div class="cc-case card"><div class="cc-head"><div><div class="small muted">THIS CASE</div><h3 style="margin:2px 0">${esc(c.name || '')}</h3><div class="small">${[c.fir && 'FIR ' + c.fir, c.ps && 'PS ' + c.ps, c.section, c.io && 'IO ' + c.io].filter(Boolean).map(esc).join(' · ') || '<span class="muted">Add FIR, PS, sections in Case File & Notices › Case Details – or upload the FIR, they are read from it.</span>'}</div></div>
        <div class="cc-btns"><button class="btn primary" id="ccFir">📄 Upload FIR</button><button class="btn" id="ccCd">📒 Add case diary part</button><button class="btn" id="ccNew">✍ Type a CD entry</button><button class="btn srch" id="ccNt">⚖ Draft BNSS notice</button></div></div>
        <div class="cc-prog"><div class="cc-bar"><i style="width:${Math.round(done.length / Math.max(1, done.length + pend.length) * 100)}%"></i></div><span><b>${done.length}</b> done · <b class="bad-t">${pend.length}</b> pending</span></div></div>
      <div class="grid g2 cc-g">
        <div class="card cc-work"><h3>✅ Work done & ⏳ pending</h3><div class="sub">Worked out from this case's data. Pending items show from whom to demand – click <b>Draft notice</b>.</div><div id="ccW"></div></div>
        <div class="card cc-read"><h3>📖 FIR & case diary</h3><div class="row" style="gap:6px;flex-wrap:wrap"><select id="ccDoc">${st.fir ? `<option value="fir">FIR – ${esc(st.fir.file)}</option>` : ''}${st.cd.map((x, i) => `<option value="cd${i}">CD ${esc(x.no || i + 1)}${x.date ? ' · ' + esc(x.date) : ''}${x.cat ? ' · [' + esc(x.cat) + ']' : ''} – ${esc(x.file)}</option>`).join('')}${st.docs.map((x, i) => `<option value="doc${i}">${esc(x.kind)} – ${esc(x.file)}</option>`).join('')}</select><input id="ccQ" placeholder="Find in text…" style="flex:1;min-width:140px"><button class="btn sm danger" id="ccDel" title="Remove this document">🗑</button></div>
          ${F ? `<div class="cc-facts">${[['FIR', F.fir], ['Date', F.date], ['PS', F.ps], ['Complainant', F.complainant], ['Sections', F.sections.join(', ')], ['Amount', F.amount ? fmtINR(F.amount) : ''], ['Accused', F.accused.join('; ')], ['Identifiers', F.ids.length + ' (mobile, account, UPI, email, IP…)']].filter(x => x[1]).map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
          <div id="ccTxt" class="cc-txt">${st.fir || st.cd.length || st.docs.length ? '' : '<div class="muted">Upload the FIR and case-diary parts (PDF, Word, text). Their text shows here, and every mobile, account, UPI, email and IP in them joins the case for cross-linking.</div>'}</div></div>
      </div>
      <div class="card"><h3>📨 Notices in this case</h3><div id="ccN"></div></div>
      <input type="file" id="ccPick" class="hidden" multiple accept=".pdf,.txt,.doc,.docx,.htm,.html,.rtf,.odt">`;
    // work table
    const col = s => s === 'Done' ? 'good' : s === 'Pending' ? 'bad' : '';
    $('#ccW', el).innerHTML = W.map((w, i) => `<div class="cc-w ${col(w.status)}"><span class="cc-s">${w.status === 'Done' ? '✔' : w.status === 'Pending' ? '⏳' : '–'}</span><div class="grow"><b>${esc(w.title)}</b><div class="small muted">${esc(w.detail)}</div>${w.status === 'Pending' && w.demand ? `<div class="small cc-dm">Demand from: <b>${esc(w.demand)}</b></div>` : ''}</div>
      ${w.items && w.items.length ? `<button class="btn sm" data-wl="${i}">${w.items.length} ›</button>` : ''}${w.notice && w.status === 'Pending' ? `<button class="btn sm srch" data-wn="${i}">Draft notice</button>` : ''}${['arrest', 'cs', 'atm', 'n353'].includes(w.k) ? `<label class="small cc-tk"><input type="checkbox" data-wf="${w.k}" ${(st.flags[w.k]) ? 'checked' : ''}> done</label>` : ''}</div>`).join('');
    $$('[data-wn]', el).forEach(b => b.onclick = () => { const w = W[+b.dataset.wn]; this.openNotice(w.notice, w); });
    $$('[data-wl]', el).forEach(b => b.onclick = () => { const w = W[+b.dataset.wl]; Records.show(w.title + ' – pending', w.items.map(x => ({ value: x.what, bank: x.who, name: x.name }))); });
    $$('[data-wf]', el).forEach(b => b.onchange = () => { st.flags[b.dataset.wf] = b.checked ? new Date().toLocaleDateString('en-IN') : ''; saveCase(); render(); });
    // reader
    const docOf = v => v === 'fir' ? st.fir : v && v.startsWith('cd') ? st.cd[+v.slice(2)] : v && v.startsWith('doc') ? st.docs[+v.slice(3)] : null;
    const show = () => { const dsel = $('#ccDoc', el); if (!dsel || !dsel.value) return; const doc = docOf(dsel.value); if (!doc) return; const q = $('#ccQ', el).value.trim();
      let h = esc(doc.text.slice(0, 400000)); const ids = extractIdentifiers(doc.text).map(x => x.value).filter(v => v.length >= 5).sort((a, b) => b.length - a.length).slice(0, 300);
      const rx = v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (ids.length) h = h.replace(new RegExp(ids.map(v => rx(esc(v))).join('|'), 'g'), m => `<mark class="cc-id">${m}</mark>`);
      if (q.length >= 2) h = h.replace(new RegExp('(<[^>]*>)|(' + rx(esc(q)) + ')', 'gi'), (m, tag) => tag ? tag : `<mark class="cc-q">${m}</mark>`);
      $('#ccTxt', el).innerHTML = h; const fm = $('.cc-q', el); if (fm) fm.scrollIntoView({ block: 'center' }); };
    if ($('#ccDoc', el)) { $('#ccDoc', el).onchange = show; $('#ccQ', el).oninput = show; show(); }
    $('#ccDel', el).onclick = () => { const v = $('#ccDoc', el).value; if (!v || !UI.confirm('Remove this document from the case?')) return; if (v === 'fir') st.fir = null; else if (v.startsWith('cd')) st.cd.splice(+v.slice(2), 1); else st.docs.splice(+v.slice(3), 1); saveCase(); render(); };
    $$('#ccTxt .cc-id', el).forEach(m => m.onclick = () => typeof Dash2 !== 'undefined' && Dash2.track(m.textContent));
    // upload
    const pick = $('#ccPick', el); let mode = 'fir';
    $('#ccFir', el).onclick = () => { mode = 'fir'; pick.multiple = false; pick.value = ''; pick.click(); };
    $('#ccCd', el).onclick = () => { mode = 'cd'; pick.multiple = true; pick.value = ''; pick.click(); };
    pick.onchange = async () => { let n = 0; for (const f of pick.files) n += mode === 'fir' ? await this.addFir(f) : await this.addCd(f); Analysis.invalidate(); saveCase(); if (n) UI.toast(`${n} file(s) read · identifiers added to the case`); render(); };
    $('#ccNew', el).onclick = () => { const b = UI.modal('Case diary entry', `<div class="row"><label>CD No.</label><input id="cdN" style="width:80px" value="${st.cd.length + 1}"><label>Date</label><input id="cdD" type="date" value="${new Date().toISOString().slice(0, 10)}"><label>Category</label><select id="cdC">${this.CAT.map(c => `<option>${c}</option>`).join('')}</select></div><textarea id="cdT" style="min-height:260px;margin-top:8px" placeholder="Write the proceedings of the day…"></textarea>`,
      [{ label: 'Cancel', onClick: UI.closeModal }, { label: 'Save', cls: 'primary', onClick: () => { const t = $('#cdT', b).value.trim(); if (!t) return UI.toast('Write something first'); st.cd.push({ id: uid(), no: $('#cdN', b).value, date: $('#cdD', b).value.split('-').reverse().join('-'), cat: $('#cdC', b).value, file: 'Typed entry', text: t, when: new Date().toISOString() }); this.saveIds(t, 'Case diary · CD ' + $('#cdN', b).value); Analysis.invalidate(); saveCase(); UI.closeModal(); render(); } }]); EditList.attach($('#cdC', b), 'cd-cat', this.CAT, 'Case diary categories'); };
    $('#ccNt', el).onclick = () => this.openNotice('n353', null);
    // notices list
    if (st.notices.length) Table($('#ccN', el), { rows: st.notices.slice().reverse(), pageSize: 10, exportName: 'notices', columns: [{ key: 'when', label: 'When', render: r => esc(r.when.slice(0, 16).replace('T', ' ')) }, { key: 'name', label: 'Notice' }, { key: 'to', label: 'To' }], onRow: r => { const b = UI.drawer(r.name, `<textarea style="min-height:520px;font-family:Georgia,serif;font-size:14px">${esc(r.text)}</textarea><div class="row" style="margin-top:8px"><button class="btn" id="nP">🖨 Print</button></div>`); $('#nP', b).onclick = () => Reports.printText(r.text); } });
    else $('#ccN', el).innerHTML = '<div class="muted small">No notice saved yet. Use <b>Draft notice</b> on a pending item, or <b>Draft BNSS notice</b> above.</div>';
    // all cases (async)
    this.allCases().then(R => {
      if (!document.body.contains(el) || !$('#ccAll', el)) return;
      const tot = (k) => sum(R, r => r[k]);
      $('#ccK', el).innerHTML = UI.kpis([['Cases', fmtNum(R.length), '', 'c2'], ['Pending cases', fmtNum(R.filter(r => !/complet|closed|disposed|charge/i.test(r.status)).length), '', 'c5'], ['Case-diary parts', fmtNum(tot('cd')), '', 'c3'], ['Pending demands', fmtNum(tot('pending')), 'across all cases', 'c4'], ['Notices drafted', fmtNum(tot('notices')), '', 'c6']]).replace(/^<div class="kpis">|<\/div>$/g, '');
      const defs = [R, R.filter(r => !/complet|closed|disposed|charge/i.test(r.status)), R.filter(r => r.cd), R.filter(r => r.pending), R.filter(r => r.notices)];
      $$('#ccK .kpi', el).forEach((k, i) => DashX.bind(k, { title: $('.label', k).textContent, rows: () => defs[i], cols: [{ key: 'name', label: 'Case' }, { key: 'fir', label: 'FIR' }, { key: 'status', label: 'Status' }, { key: 'pending', label: 'Pending', num: true }, { key: 'pendList', label: 'Pending work' }], sort: 'pending', pv: r => [r.name, r.pending + ' pending'], onRow: r => { UI.closeDrawer(); if (!r.cur) switchCase(r.id); } }));
      $('#ccAll', el).classList.remove('muted', 'small');
      Table($('#ccAll', el), { rows: R, pageSize: 10, sortKey: 'pending', sortDir: -1, exportName: 'all_cases_cctns', onRow: r => { if (!r.cur) switchCase(r.id); },
        columns: [{ key: 'name', label: 'Case', render: r => `<b>${esc(r.name)}</b>${r.cur ? ' <span class="badge info">open</span>' : ''}<div class="small muted">${esc([r.fir && 'FIR ' + r.fir, r.ps, r.section].filter(Boolean).join(' · '))}</div>` },
          { key: 'status', label: 'Status' }, { key: 'complaints', label: 'Complaints', num: true }, { key: 'amount', label: 'Amount', num: true, render: r => r.amount ? fmtINR(r.amount) : '' }, { key: 'firUp', label: 'FIR read' }, { key: 'cd', label: 'CD parts', num: true }, { key: 'lastCd', label: 'Last CD' },
          { key: 'done', label: 'Done', num: true }, { key: 'pending', label: 'Pending', num: true, render: r => r.pending ? `<b class="bad-t" title="${esc(r.pendList)}">${r.pending}</b>` : '0' }, { key: 'notices', label: 'Notices', num: true }] });
    });
  },

  /* ---------- Upload File + ---------- */
  CAT: ['Reminder to Bank', 'Reminder to Telecom', 'Received data', 'Visit place', 'Others'],
  KIND: { fir: ['FIR', '📄'], cd: ['Case diary', '📒'], tele: ['CDR / IPDR / TDR / SMS', '📞'], caf: ['CAF (SIM form)', '🪪'], ncrp: ['NCRP / bank-action sheet', '📋'], fin: ['Bank statement / KYC / other sheet', '🏦'], wa: ['WhatsApp reply', '💬'], meta: ['Facebook / Instagram reply', '📘'], tg: ['Telegram reply', '✈️'], google: ['Google reply', '🔍'], doc: ['Other document (identifiers extracted)', '🗂️'], skip: ['Skip', '⏭'] },
  async classify(f) {
    const n = f.name.toLowerCase(), ext = n.split('.').pop();
    if (/\.(jpe?g|png|gif|bmp|mp4|mp3|wav|exe|dll|bin)$/.test(n)) return 'skip';
    if (/\bfir\b|first.?information/.test(n)) return 'fir';
    if (/case.?diary|parcha|\bcd[\s_\-]*\d/.test(n)) return 'cd';
    if (/\b(cdr|ipdr|tdr|tower|sms)\b|call.?detail|tower.?dump/.test(n)) return 'tele';
    if (/\bcaf\b/.test(n) && ext === 'pdf') return 'caf';
    if (/whats.?app/.test(n)) return 'wa'; if (/telegram/.test(n)) return 'tg'; if (/google|gmail/.test(n)) return 'google'; if (/facebook|instagram|\bfb\b|insta|meta/.test(n)) return 'meta';
    let t = ''; try { t = ['xlsx', 'xls', 'ods', 'xlsb'].includes(ext) ? (await GReply.read(f)).text.slice(0, 20000) : ext === 'pdf' ? (await GReply.read(f)).text.slice(0, 20000) : (await f.slice(0, 60000).text()); } catch (e) { }
    if (/FIRST INFORMATION REPORT|प्रथम सूचना रिपोर्ट/i.test(t)) return 'fir';
    if (/CASE DIARY|केस डायरी|पर्चा/i.test(t)) return 'cd';
    if (/customer application form|subscriber application|\bCAF\b/i.test(t) && ext === 'pdf') return 'caf';
    if (/User #\d+/.test(t) && /telegram/i.test(t)) return 'tg';
    if (/whatsapp/i.test(t) && /(Account Identifier|Service|Message Log|Call Log)/i.test(t)) return 'wa';
    if (/(facebook|instagram|threads)/i.test(t) && /(Account Identifier|Target|Registration Ip)/i.test(t)) return 'meta';
    if (/(google|gaia|subscriber information)/i.test(t) && /(account|e-?mail|ip)/i.test(t) && !/acknowledg/i.test(t)) return 'google';
    if (/acknowledg|ack\.?\s*no/i.test(t) && /(layer|utr|transaction)/i.test(t)) return 'ncrp';
    if (/(calling|called|b.?party|cell.?id|first cgi|msisdn|source ip|destination ip|imei)/i.test(t) && ['xlsx', 'xls', 'csv', 'txt', 'ods', 'xlsb'].includes(ext)) return 'tele';
    if (/(narration|debit|credit|ifsc|account holder|beneficiary)/i.test(t) && ['xlsx', 'xls', 'csv', 'ods', 'pdf', 'xlsb'].includes(ext)) return 'fin';
    return 'doc';
  },
  upload(el) {
    el.innerHTML = `<div class="g-drop cc-drop" id="ccDrop"><div class="g-dl">⬆</div><b>Drop any files or a whole folder here</b><span>FIR, case diary, NCRP / bank-action sheets, statements, KYC, CDR / IPDR / TDR / SMS, CAF PDFs, WhatsApp / Facebook / Instagram / Telegram / Google replies, .zip / .rar … – each is sorted to the right analysis. Read on this computer only.</span>
      <div class="row" style="gap:8px;justify-content:center;margin-top:10px"><button class="btn primary" id="ccUF">📄 Choose files</button><button class="btn" id="ccUD">📁 Choose folder</button></div></div>
      <input type="file" id="ccUP" class="hidden" multiple><input type="file" id="ccUDp" class="hidden" webkitdirectory multiple>
      <div id="ccQ2"></div>`;
    const Q = []; const drop = $('#ccDrop', el);
    const add = async files => { let list = [...files]; try { list = await GReply.files(list); } catch (e) { } for (const f of list) Q.push({ f, kind: '…' }); draw(); for (const q of Q) if (q.kind === '…') { q.kind = await this.classify(q.f); draw(); } };
    $('#ccUF', el).onclick = e => { e.stopPropagation(); const p = $('#ccUP', el); p.value = ''; p.click(); }; $('#ccUD', el).onclick = e => { e.stopPropagation(); const p = $('#ccUDp', el); p.value = ''; p.click(); };
    $('#ccUP', el).onchange = e => add(e.target.files); $('#ccUDp', el).onchange = e => add(e.target.files);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = async e => { e.preventDefault(); drop.classList.remove('over'); const fs = []; const walk = async en => { if (!en) return; if (en.isFile) fs.push(await new Promise(r => en.file(r))); else if (en.isDirectory) { const rd = en.createReader(); let b; do { b = await new Promise(r => rd.readEntries(r)); for (const x of b) await walk(x); } while (b.length); } };
      const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean); if (items.length) { for (const it of items) await walk(it); add(fs); } else add(e.dataTransfer.files); };
    const draw = () => {
      const box = $('#ccQ2', el); if (!Q.length) { box.innerHTML = ''; return; }
      const cnt = groupBy(Q, q => q.kind);
      box.innerHTML = `<div class="card"><div class="row"><h3 class="grow" style="margin:0">${Q.length} file(s) · ${[...cnt].filter(([k]) => k !== '…').map(([k, v]) => (this.KIND[k] || [k, ''])[1] + ' ' + v.length).join(' · ')}</h3><button class="btn" id="ccClr">Clear</button><button class="btn primary" id="ccRun" ${Q.some(q => q.kind === '…') ? 'disabled' : ''}>▶ Analyse all</button></div>
        <div class="sub">Check the type found for each file – change it if needed.</div><table class="tbl"><thead><tr><th>File</th><th>Size</th><th>Goes to</th><th>Result</th></tr></thead><tbody>${Q.map((q, i) => `<tr><td>${esc(q.f.webkitRelativePath || q.f.name)}</td><td class="small">${SOP.size(q.f.size)}</td><td>${q.kind === '…' ? '<span class="muted">checking…</span>' : `<select data-qk="${i}">${Object.entries(this.KIND).map(([k, v]) => `<option value="${k}" ${k === q.kind ? 'selected' : ''}>${v[1]} ${v[0]}</option>`).join('')}</select>`}</td><td class="small">${esc(q.res || '')}</td></tr>`).join('')}</tbody></table></div>`;
      $$('[data-qk]', box).forEach(s => s.onchange = () => { Q[+s.dataset.qk].kind = s.value; draw(); });
      $('#ccClr', box).onclick = () => { Q.length = 0; draw(); };
      $('#ccRun', box).onclick = () => this.run(Q, draw);
    };
  },
  async run(Q, draw) {
    const by = k => Q.filter(q => q.kind === k && !q.ok).map(q => q.f), mark = (files, res) => files.forEach((f, i) => { const q = Q.find(x => x.f === f); if (q) { q.ok = 1; q.res = Array.isArray(res) ? String(res[i] ?? '') : res; } });
    const btn = $('#ccRun'); if (btn) { btn.disabled = true; btn.textContent = '⏳ Working…'; }
    const step = async (k, fn) => { const f = by(k); if (!f.length) return; try { const r = await fn(f); mark(f, r || 'done'); } catch (e) { mark(f, 'Error: ' + (e.message || e)); } draw(); };
    const fmt = done => done.map(x => typeof x[1] === 'number' ? fmtNum(x[1]) + ' records' + (x[2] ? ' · ' + x[2] : '') : String(x[1] || x[2] || ''));
    await step('fir', async f => { for (const x of f.slice(0, 1)) await this.addFir(x); for (const x of f.slice(1)) await this.addDoc(x, 'FIR copy'); return 'read into Case Diary'; });
    await step('cd', async f => { for (const x of f) await this.addCd(x); return 'added to Case Diary'; });
    await step('doc', async f => { const out = []; for (const x of f) out.push((await this.addDoc(x)) + ' identifiers saved'); return out; });
    await step('tele', async f => fmt(await Tel.importFiles(f)));
    await step('wa', async f => fmt(await WData.importFiles(f)));
    await step('google', async f => fmt(await GData.importFiles(f)));
    await step('meta', async f => fmt(await MData.importFiles(f)));
    await step('tg', async f => fmt(await TData.importFiles(f)));
    await step('caf', async f => (await CAF.importFiles(f, () => { })).map(r => r.err ? 'Error: ' + r.err : (r.add != null ? r.add + ' CAF(s)' : 'read')));
    await step('ncrp', async f => (await CommonSus.importMany(f, () => { })).map(r => r.err ? 'Error: ' + r.err : fmtNum(r.added || 0) + ' rows' + (r.dup ? ` · ${r.dup} already there` : '')));
    Analysis.invalidate(); saveCase();
    const fin = by('fin'); if (fin.length) { mark(fin, 'opened in the import window'); draw(); openImport(['txn', 'stmt', 'kyc', 'ncrp', 'social'], () => { Analysis.invalidate(); }, fin); }
    Q.filter(q => q.kind === 'skip').forEach(q => { q.ok = 1; q.res = 'skipped'; }); draw();
    const b2 = $('#ccRun'); if (b2) { b2.textContent = '✔ Done – open Dashboard'; b2.disabled = false; b2.onclick = () => go('dashboard'); }
    UI.toast('Files analysed – every section is updated. See the Dashboard or CCTNS › Case Diary.', 6000);
  }
};

PAGE_META.cctns = { group: 'Investigation', title: 'CCTNS', desc: 'Case Diary for all cases – FIR and CD reader, work done and pending, BNSS notices – and Upload File + for any file.', order: ['diary', 'upload'], names: { diary: '📒 Case Diary', upload: '⬆ Upload File +' } };
Pages.cctns = main => { const { cur, body } = tabs(main, 'cctns', [['diary', '📒 Case Diary'], ['upload', '⬆ Upload File +']], 'CCTNS'); CCTNS[cur === 'upload' ? 'upload' : 'diary'](body); };

(() => {
  const nav = $('#sidebar'), lea = nav && $('.lea-subs', nav); if (!lea) return;
  lea.insertAdjacentHTML('afterend', `<div class="nav-item cctns-item" title="CCTNS – Case Diary, FIR, pending work, BNSS notices, Upload File +" style="--c:#a855f7"><span class="nib">🗂️</span><span>CCTNS</span><span class="nav-chev">▾</span></div><div class="nav-subs cctns-subs"><div class="nav-sub" data-cct="diary" style="--pc:#a855f7"><i></i><span>1. Case Diary</span></div><div class="nav-sub" data-cct="upload" style="--pc:#22c55e"><i></i><span>2. Upload File +</span></div></div>`);
  const it = $('.cctns-item', nav), subs = $('.cctns-subs', nav), setOpen = on => { S.ccOpen = on; subs.classList.toggle('open', on); it.classList.toggle('open', on); };
  setOpen(false);
  it.addEventListener('click', e => { e.stopImmediatePropagation(); setOpen(!S.ccOpen); }, true);
  $$('[data-cct]', subs).forEach(n => n.onclick = () => go('cctns', n.dataset.cct));
  const or = render; render = function () { const r = or.apply(this, arguments); $$('[data-cct]', subs).forEach(n => n.classList.toggle('active', S.page === 'cctns' && (S.sub.cctns || 'diary') === n.dataset.cct)); it.classList.toggle('active', S.page === 'cctns'); if (S.page === 'cctns' && !S.ccOpen) setOpen(true); return r; };
})();
