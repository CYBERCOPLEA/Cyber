/* cdx.js – CCTNS case import (zip / folder), case-diary reader, Case At A Glance (FIR gist, victim statement,
   required / received / pending from whom, suggestions), FIR section check, one-page Hindi A4 report and
   common analysis across cases. Everything runs on this computer; scanned PDFs are read with the built-in OCR. */
'use strict';
const CDX = {
  dg: s => String(s || '').replace(/[०-९]/g, d => '०१२३४५६७८९'.indexOf(d)),
  /* identifiers in one sentence: mobile, account, IFSC, e-mail, UPI, IP, IMEI, PAN, URL, Ack No. */
  IDT: { Mobile: '📱', Account: '🏦', IFSC: '🏛', Email: '✉', UPI: '💳', IP: '🌐', IMEI: '📟', PAN: '🪪', URL: '🔗', 'Ack No': '🧾' },
  idsOf(s) {
    s = this.dg(s); const out = [], seen = new Set(), add = (t, v) => { v = String(v).trim(); const k = t + v.toLowerCase(); if (v && !seen.has(k)) { seen.add(k); out.push({ t, v }); } };
    (s.match(/https?:\/\/[^\s,;'"()<>]+/gi) || []).forEach(u => add('URL', u.replace(/[.।]+$/, '')));
    (s.match(/[\w.+\-]+@[\w\-]+\.[\w.\-]+/g) || []).forEach(e => add('Email', e.replace(/[.]+$/, '')));
    (s.match(/(?<![\w.@])[\w.\-]{2,}@(?:ok\w+|ybl|ibl|axl|upi|paytm|apl|yapl|ptyes|ptsbi|pthdfc|ptaxis|kotak|sbi|icici|hdfcbank|axisbank|airtel|jio|fbl|idfcbank|waicici|wahdfcbank|waaxis|wasbi)\b(?!\.)/gi) || []).forEach(u => add('UPI', u));
    (s.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g) || []).forEach(v => add('IFSC', v));
    (s.match(/\b[A-Z]{5}\d{4}[A-Z]\b/g) || []).forEach(v => add('PAN', v));
    (s.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).filter(v => v.split('.').every(n => +n < 256)).forEach(v => add('IP', v));
    const re = /(?<![\d.\/\-])(?:\+?91[\s\-]?)?(\d{9,18})(?![\d.\/\-])/g; let m;
    while ((m = re.exec(s))) { const v = m[1], pre = s.slice(Math.max(0, m.index - 30), m.index);
      if (v.length === 10 && /^[6-9]/.test(v) && !/खाता|a\/c|account|acc\.?\s*no/i.test(pre.slice(-14))) add('Mobile', v);
      else if (/imei/i.test(pre) && v.length >= 14 && v.length <= 16) add('IMEI', v);
      else if (/ack|acknow|शिकायत/i.test(pre) && v.length >= 12) add('Ack No', v);
      else if (v.length >= 9) add('Account', v); }
    return out.slice(0, 40);
  },
  iso(d) { const m = String(d || '').match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/); if (!m) return /^\d{4}-\d\d-\d\d/.test(d || '') ? d.slice(0, 10) : ''; const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; },
  dmy(iso) { return iso && /^\d{4}-\d\d-\d\d/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : (iso || ''); },
  days(iso) { if (!iso) return 0; return Math.max(0, Math.round((Date.now() - new Date(iso + 'T00:00:00')) / 864e5)); },
  lastDate(cd) { const L = (cd || []).map(x => this.iso(x.date) || (x.when || '').slice(0, 10)).filter(Boolean).sort(); return L.length ? this.dmy(L[L.length - 1]) : ''; },
  firKey(s) { const m = this.dg(s).match(/0*(\d{1,5})\s*[\/\-]\s*(20\d\d|\d\d)\b/); return m ? m[1] + '/' + (m[2].length === 2 ? '20' + m[2] : m[2]) : ''; },
  cut(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).replace(/\s\S*$/, '') + ' …' : s; },

  /* ---------- files ---------- */
  async unzip(buf, pre = '') {
    const dv = new DataView(buf); let e = buf.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Not a valid ZIP file');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nl)); p += 46 + nl + xl + cl;
      if (name.endsWith('/') || /__MACOSX|\.DS_Store|Thumbs\.db/i.test(name)) continue;
      const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), data = new Uint8Array(buf, off + 30 + lnl + lxl, csize);
      let bytes; if (method === 0) bytes = data; else if (method === 8) bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); else continue;
      const path = pre + '/' + name, base = name.split('/').pop();
      if (/\.zip$/i.test(base)) out.push(...await this.unzip(bytes.slice().buffer, path.replace(/\.zip$/i, '')));
      else out.push({ path, file: new File([bytes], base) });
    }
    return out;
  },
  meta(p) {
    const m = this.dg(p).toUpperCase().match(/FIR[\s_\-.]*0*(\d{1,5})[\s_\-.\/]+(20\d\d)(?:[\s_\-]+PS[\s_\-]+([A-Z0-9]+))?(?:[\s_\-]+([A-Z]{2,5}))?(?:[\s_\-]+(CS[\s_\-]*PPI|PPI|CS|FR))?/);
    if (!m) return null; let fin = m[5] ? (/PPI/.test(m[5]) ? 'PPI' : m[5]) : ''; let dist = m[4] || '';
    if (!fin && /^(CS|FR|PPI)$/.test(dist)) { fin = dist; dist = ''; }
    return { no: m[1].padStart(4, '0'), year: m[2], fir: m[1].padStart(4, '0') + '/' + m[2], ps: m[3] || '', dist, fin };
  },
  async readFile(f, prog) {
    const key = 'ocrc:' + f.name + ':' + f.size;
    try { const c = await DB.get(key); if (c && c.t) return c.t; } catch (e) { }
    let t = '';
    if (/\.pdf$/i.test(f.name) && window.pdfjsLib) {
      try {
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise; const parts = [];
        for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i), tc = await pg.getTextContent(); parts.push(tc.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('')); try { pg.cleanup(); } catch (e) { } }
        // pages with a real text layer are kept; only scanned pages (little or no text) go to OCR
        const need = parts.map((p, i) => p.replace(/\s/g, '').length < 40 ? i + 1 : 0).filter(Boolean);
        if (need.length && typeof OCR !== 'undefined') { try { const o = await OCR.pages(doc, need, prog); need.forEach(i => { parts[i - 1] = o[i] || parts[i - 1]; }); } catch (e) { } }
        t = parts.join('\n\f\n'); try { doc.destroy(); } catch (e) { }
      } catch (e) { t = ''; }
      if (!t.replace(/\s/g, '') && (typeof OCR !== 'undefined')) t = await OCR.read(f, prog);
    } else if (/\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name) && (typeof OCR !== 'undefined')) t = await OCR.read(f, prog);
    else t = await this.orig.text.call(CCTNS, f);
    t = this.dg(t || '');
    if (t.trim()) try { await DB.set(key, { t, at: Date.now() }); } catch (e) { }
    return t;
  },
  readMany(files, onDone) {
    const n = Math.max(2, typeof OCR !== 'undefined' ? OCR.size() : 2), P = new Array(files.length); let k = 0, done = 0;
    const R = files.map(() => { let r; const p = new Promise(x => r = x); p.r = r; return p; });
    const run = async () => { while (k < files.length) { const i = k++; let t = '', err = ''; try { t = await this.readFile(files[i]); } catch (e) { err = e.message || String(e); } done++; onDone && onDone(done, files.length, files[i]); R[i].r({ t, err }); } };
    for (let j = 0; j < Math.min(n, files.length); j++) run();
    return R;
  },
  bar(done, tot, t0) { const left = done ? Math.max(1, Math.round((Date.now() - t0) / done * (tot - done) / 60000)) : 0;
    return `<div class="rd-bar"><i style="width:${Math.round(done / tot * 100)}%"></i></div><div class="rd-t">⏳ Reading files: <b>${done} of ${tot}</b> done${done && done < tot ? ` · about ${left} min left` : ''}${done < tot ? ' · several files read at once' : ''}</div>`; },
  kind(name, t, folderFin) {
    const n = name.replace(/\.[^.]+$/, '').trim(), h = String(t || '').slice(0, 900);
    if (/^\s*(FR|F\.R\.?)\b|final\s*report/i.test(n)) return { k: 'fin', type: 'FR' };
    if (/^\s*(CS|C\.S\.?)\b|charge\s*sheet|ppi/i.test(n)) return { k: 'fin', type: folderFin === 'PPI' || /ppi/i.test(n) ? 'PPI' : 'CS' };
    if (/^\s*C\.?\s*D\b|^\s*CD\s*\d|case\s*diary|parcha|पर्चा/i.test(n)) return { k: 'cd' };
    if (/FINAL\s*FORM|अंतिम\s*फार्म/i.test(h)) return { k: 'fin', type: /Charge\s*Sheet\s*\/|आरोप\s*पत्र\s*\(/.test(h) ? (folderFin === 'PPI' ? 'PPI' : 'CS') : (folderFin || 'FR') };
    if (/Case\s*Diary|प्रकरण\s*दैनिकी/i.test(h)) return { k: 'cd' };
    if (/^\s*FIR\b|F\.I\.R/i.test(n) || /FIRST\s*INFORMATION\s*REPORT|प्रथम\s*सूचना\s*रिपोर्ट/i.test(h)) return { k: 'fir' };
    return { k: 'doc' };
  },

  /* ---------- reading a case diary ---------- */
  cdNo(t, name) {
    const h = this.dg(String(t || '').slice(0, 1500));
    const m = h.match(/प्रकरण\s*दैनिकी\s*सं[^:\n]{0,6}:\s*(?:C\.?\s*D\.?)?\s*0*(\d{1,3})\b/i) || h.match(/Case\s*Diary\s*(?:No\.?)?[^\n:]{0,30}:\s*(?:C\.?\s*D\.?)?\s*0*(\d{1,3})\b/i);
    const fn = (this.dg(name || '').match(/C\.?\s*D[\s_\-.]*0*(\d{1,3})/i) || this.dg(name || '').match(/(?:parcha|part|पर्चा)[\s_\-]*0*(\d{1,3})/i) || [])[1] || '';
    const no = m ? m[1] : fn; return { no, fileNo: fn, mismatch: !!(m && fn && m[1] !== fn) };
  },
  prep(t) { const m = this.dg(t).match(/Date\s*of\s*Preparing[\s\S]{0,140}?(\d{1,2}\/\d{1,2}\/20\d\d)/i) || this.dg(t).match(/तैयार\s*करने\s*की\s*दिनांक[\s\S]{0,60}?(\d{1,2}\/\d{1,2}\/20\d\d)/); return m ? m[1] : ''; },
  JUNK: /^\s*(?:S\.No\.|5\.10\.|\d\.\d+\.\s*\(क्र|\(क्र\.सं\.\)|a\)\s*Major|b\)\s*Witness|c\)\s*Relative|d\)\s*Age|e\)\s*Address|House\s*No|\(मकान|Colony|a\s*\(कॉलोनी|Tehsil|\(तहसील|District\s*\(|Pincode|Police\s*Station|Country|f\)\s*Description|Case\s*Diary|प्रकरण\s*[टद]ैनिकी|FIR\s*\||District\/Unit|\S{0,4}\s*\(थाना\)|P\.S\.|Places\s*Visited|c\)\s*Start|d\)\s*End|b\)\s*Date|दैनिकी\s*तैयार|1\.\s*a\)\s*General|2\.\s*Major|\d{1,2}\s*$|N\.C\.R\.B|I\.I\.F)/i,
  body(t) {
    t = this.dg(t); let s = t.search(/f\)\s*Description|Description\s*\(/i); if (s < 0) s = t.search(/2\.\s*Major\s*Task/i); if (s < 0) s = 0;
    let e = t.search(/3\.\s*Evidence\s*Details|Evidence\s*Details\s*\(साक्ष्य/i); if (e < s) e = t.length;
    let b = t.slice(s, e).split(/\n/).filter(l => !this.JUNK.test(l)).join(' ').replace(/\f/g, ' ').replace(/\s+/g, ' ');
    b = b.replace(/^[\s\S]{0,420}?मसरूफ\s*(?:ए\s*)?विवेचना\s*(?:होता|हुआ)\s*(?:हूँ|हूं|हु|हॅू)\s*[|।]?/, '').replace(/^\W*\.{2,}\s*-*\s*/, '');
    b = b.replace(/श्रीमान\s*जी\s*अब\s*मुझ\s*विवेचक[\s\S]*$/, '').replace(/साक्ष्य\s*संकलन\s*जारी\s*है[\s\S]{0,40}$/, '').trim();
    return b;
  },
  brief(t) { t = this.dg(t); const s = t.search(/जांच\s*संक्षिप्त\)?\s*:|Investigation\s*Brief/i); if (s < 0) return ''; const r = t.slice(s).replace(/^[^:]*:\s*/, ''); const e = r.search(/2\.\s*Major\s*Task|Major\s*Task\s*Performed/i); return (e > 0 ? r.slice(0, e) : r.slice(0, 3000)).replace(/\s+/g, ' ').trim(); },
  secNorm(s) {
    s = this.dg(s).toUpperCase().replace(/\b66\s*(?:D|डी)(?![A-Z0-9])|\b660\b/g, '66D').replace(/\b66\s*(?:C|सी)(?![A-Z0-9])/g, '66C').replace(/\b67\s*(?:A|ए)(?![A-Z0-9])/g, '67A');
    const out = [], pend = []; const rx = /(\d{1,3}[A-Z]?(?:\s*\(\s*\d+\s*\))*)|(बीएनएस|B\.?\s*N\.?\s*S\b|भा\.?\s*न्या\.?\s*सं|भारतीय\s*न्याय\s*संहिता)|(आई\.?\s*टी\.?\s*(?:एक्ट|अधिनियम)|I\.?\s*T\.?\s*ACT|आईटी\s*एक्ट|आई0\s*टी0|सूचना\s*प्रो\S*)|(IPC|भा\.?\s*द\.?\s*वि)/g; let m;
    while ((m = rx.exec(s))) { if (m[1]) pend.push(m[1].replace(/\s+/g, '')); else { const act = m[2] ? 'BNS' : m[3] ? 'IT Act' : 'IPC'; while (pend.length) out.push(pend.shift() + ' ' + act); } }
    return uniq(out.filter(x => !/^(19|20)\d\d /.test(x)));
  },
  firFromBrief(b) {
    b = this.dg(b); const one = re => { const m = b.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
    const secTxt = one(/धारा\s*([\s\S]{3,140}?)(?=,?\s*थाना|\s*दिनांक|\s*बनाम|\s*बावत|$)/);
    const vi = b.search(/वादी/), vt = vi >= 0 ? b.slice(vi, vi + 320) : '';
    const comp = (vt.match(/वादी\s*(?:श्री|श्रीमती|सुश्री|कु0?|मो0)?\s*([^\n,]{2,60}?)\s*(?:पुत्र|पत्नी|पुत्री|निवासी|उम्र|W\/O|S\/O|D\/O)/) || [])[1] || '';
    const mob = (vt.match(/मो0?\s*नं0?\s*[:\-]?\s*([6-9]\d{9})/) || [])[1] || '';
    const after = b.slice(Math.max(0, b.search(/बावत|बाबत|बनाम/)));
    const items = after.split(/\s(?=\d{1,2}\s*\.\s)/).slice(1).map(x => x.replace(/^\d{1,2}\s*\.\s*/, '').replace(/(?:धारक|संचालक|स्वामी)?\s*नाम\s*(?:व\s*)?पता\s*अ\S*त\S*/g, '').trim()).filter(x => x.length > 4).map(x => {
      const mob = x.match(/मो\S*\s*न\S*\s*([+\d()\s\-]{8,22})/), acc = x.match(/खाता\s*(?:संख्या|सं\S?|नं0?|न0|[A-Z]{2}|\S{1,3})?\s*[:\-]?\s*(\d[\d\s]{5,24})/), url = x.match(/(https?:\/\/\S+|www\.\S+|\b[\w\-]+\.(?:com|in|cc|net|org|xyz|top|vip|io|app|live|club)\S*)/i), upi = x.match(/\b[\w.\-]{2,}@[a-z]{2,}\b/i);
      if (acc) return { type: 'account', value: acc[1].replace(/\D/g, ''), raw: x }; if (url) return { type: 'url', value: url[1], raw: x }; if (upi) return { type: 'upi', value: upi[0], raw: x };
      if (mob) { const d = mob[1].replace(/\D/g, ''); return { type: 'mobile', value: d.length === 12 && d.startsWith('91') ? d.slice(2) : d, raw: x }; }
      return { type: 'other', value: this.cut(x, 60), raw: x };
    });
    return { sections: this.secNorm(secTxt), secTxt, complainant: comp, mobile: mob, incident: one(/दिनांक\s*घटना\S?\s*:?\s*([\d.\/\-]{6,10}(?:\s*(?:से|to)\s*[\d.\/\-]{6,10})?)/), info: one(/दिनांक\s*सूचना\S?\s*:?\s*([\d.\/\-]{6,10})/), items };
  },
  tahrir(body) { const s = body.search(/नकल\s*तहरीर/); if (s < 0) return ''; let r = body.slice(s).replace(/^नकल\s*तहरीर[^\S]*(?:हिन्दी|अंग्रेजी)?\s*\S*\s*(?:टाइपशुदा|हस्तलिखित)?[.\-\s]*/, ''); const e = r.search(/हस्ता0|सादर\s*धन्यवाद|भवदीय|प्रार्थी\s*[:\-]|आपका\s*विश्वासी/); return (e > 60 ? r.slice(0, e) : r.slice(0, 2500)).trim(); },
  statements(body) {
    const rx = /बयान\s+(वादी|पीड़ित\S*|गवाह[\u0900-\u097F]*|अभियुक्त[\u0900-\u097F]*|आरोपी|कायमी\s*कर्ता[\u0900-\u097F]*|श्री|श्रीमती)(?![,\u0900-\u097F])\s*[.\-…]*\s*/g, at = []; let m;
    while ((m = rx.exec(body))) at.push({ i: m.index, j: rx.lastIndex, who: m[1] });
    return at.map((a, k) => ({ who: a.who, text: body.slice(a.j, Math.min(k + 1 < at.length ? at[k + 1].i : body.length, a.j + 2200)).trim() })).filter(x => x.text.length > 80 && !/^कायमी/.test(x.who));
  },
  amount(t) {
    t = this.dg(t); const v = [], best = L => { const ok = L.filter(x => x >= 100 && x < 1e10); return ok.length ? Math.max(...ok) : 0; };
    const c1 = [...t.matchAll(/(?<![\d,])(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?)\s*\/?-?\s*(?:\(|रु|रू|₹|Rs|रुपये|रूपये)/g)].map(m => +m[1].replace(/,/g, '')); if (best(c1)) return best(c1);
    for (const m of t.matchAll(/(?<![\d,])(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?)\s*\/?-?\s*(?:\(|रु|रू|₹|Rs|रुपये|रूपये)/g)) v.push(+m[1].replace(/,/g, ''));
    for (const m of t.matchAll(/(?<![\d,])(\d{3,9}(?:\.\d\d)?)\s*\/?-?\s*(?:रु|रू|₹|Rs|रुपये|रूपये)/g)) v.push(+m[1]);
    for (const m of t.matchAll(/(?:Rs\.?|₹|INR|रु\.?|रुपये)\s*([\d,]{3,}(?:\.\d+)?)/gi)) v.push(+m[1].replace(/,/g, ''));
    for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*लाख/g)) v.push(+m[1] * 1e5);
    const ok = v.filter(x => x >= 100 && x < 1e10); return ok.length ? Math.max(...ok) : 0;
  },
  io(texts) {
    for (const t of texts) { const m = t.match(/Name\s*of\s*[I1l]\.?\s*[O0]\.?[^\n]*?\s{2,}([A-Z][A-Z .]{3,40})\s*$/m); if (m) return m[1].trim(); }
    for (const t of texts) { const m = t.match(/(?:विवेचना|विवेचक)\s*(?:मुझ\s*)?(निरीक्षक|उ0?\s*नि0?|उपनिरीक्षक)\s*श्री\s*([^\s,।|0-9]+(?:\s+[^\s,।|0-9]+)?)/); if (m) return m[1] + ' श्री ' + m[2]; }
    return '';
  },
  finInfo(t, type) {
    t = this.dg(t); const no = (t.match(/Charge\s*Sheet\s*No\.?[^:\n]*:\s*([\w\/\-]+)/i) || [])[1] || '', date = (t.match(/\b3\s*\.\s*Date[^:\n]*:\s*(\d{1,2}\/\d{1,2}\/20\d\d)/i) || [])[1] || '';
    const fr = (t.match(/\b(Unoccurred|Untraced|Undetected|Mistake\s*of\s*(?:fact|law)|False|Civil\s*nature|अदम\s*पता|अघटित)\b/i) || [])[1] || '';
    return { no, date: this.iso(date), frType: fr && /untraced|undetected|अदम/i.test(fr) ? 'Untraced (accused not found)' : fr && /false/i.test(fr) ? 'False case' : fr && /fact/i.test(fr) ? 'Mistake of fact' : fr && /law/i.test(fr) ? 'Mistake of law' : fr && /civil/i.test(fr) ? 'Civil nature' : fr ? 'Untraced (accused not found)' : '' };
  },

  accused(t) {
    t = this.dg(t); const a = t.search(/11\s*\.\s*Particulars\s*of\s*accused/i), b = t.search(/12\s*\.\s*Particulars\s*of\s*accused/i), e = t.search(/13\s*\.\s*Particulars/i);
    const names = s => [...String(s).matchAll(/\(i\)\s*Name\s*(?:\(नाम\))?\s*[:\-]?\s*([^\n(|]{2,60})/g)].map(m => m[1].replace(/[^\u0900-\u097FA-Za-z .]/g, ' ').replace(/\s+/g, ' ').trim()).filter(x => x.length > 2 && !/^(मो0?|whether|name)/i.test(x));
    return { cs: a >= 0 ? names(t.slice(a, b > a ? b : e > a ? e : a + 20000)) : [], not: b >= 0 ? names(t.slice(b, e > b ? e : b + 20000)) : [] };
  },

  /* ---------- agencies: asked / received ---------- */
  AG: [
    ['wa', 'WhatsApp (Meta)', 'व्हाट्सएप (मेटा)', /whats\s*app|व्हाट्स\s*ऐप|व्हाट्सएप|व्हाटसएप|व्हाट्सअप/i, 'intermediary'],
    ['fb', 'Facebook / Instagram (Meta)', 'फेसबुक / इंस्टाग्राम', /facebook|फेसबुक|instagram|इंस्टाग्राम|इन्स्टाग्राम/i, 'intermediary'],
    ['tg', 'Telegram', 'टेलीग्राम', /telegram|टेलीग्राम|टेलिग्राम/i, 'intermediary'],
    ['gg', 'Google / Gmail / YouTube', 'गूगल / जीमेल', /google|gmail|गूगल|जीमेल|youtube|यूट्यूब/i, 'intermediary'],
    ['tel', 'Telecom (Airtel / Jio / Vi / BSNL)', 'दूरसंचार कंपनी (एयरटेल / जियो / वीआई / बीएसएनएल)', /airtel|एयरटेल|\bjio\b|जियो|vodafone|वोडाफोन|bsnl|बीएसएनएल|सीडीआर|\bcdr\b|\bcaf\b|सीएएफ|टेलीकॉम|telecom|सिम\s*(?:धारक|कार्ड)|आईएमईआई|imei/i, 'telecom'],
    ['bank', 'Bank', 'बैंक', /बैंक|\bbank\b|ifsc|आईएफएससी|खाता\s*धारक|स्टेटमेंट|statement|kyc|केवाईसी|\b[A-Z]{4}[0O][A-Z0-9]{6}\b/i, 'bank_kyc'],
    ['i4c', 'I4C / Samanvaya / NCRP Portal', 'I4C / समन्वय / NCRP पोर्टल', /samanva|समन्वय|i4c|ncrp|1930|cybercrime\.gov|jmis|प्रतिबिम्ब|pratibimb/i, ''],
    ['npci', 'NPCI / UPI / Payment App', 'NPCI / UPI / पेमेंट ऐप', /npci|phone\s*pe|फोन\s*पे|फोनपे|paytm|पेटीएम|google\s*pay|gpay|razorpay|cashfree|payu|\bupi\b|यूपीआई/i, 'intermediary'],
    ['web', 'Website / Domain / Hosting', 'वेबसाइट / डोमेन / होस्टिंग', /वेब\s*लिंक|website|वेबसाइट|domain|डोमेन|whois|hosting|godaddy|hostinger|cloudflare|namecheap|https?:\/\//i, 'intermediary'],
    ['crypto', 'Crypto Exchange', 'क्रिप्टो एक्सचेंज', /binance|wazirx|coindcx|usdt|crypto|क्रिप्टो|bitcoin|बिटकॉइन/i, 'intermediary'],
    ['nic', 'Govt / NIC Email', 'सरकारी / NIC ईमेल', /nic\.in|gov\.in|एनआईसी|\bnic\b/i, ''],
    ['deliv', 'Delivery / E-commerce', 'डिलीवरी / ई-कॉमर्स', /amazon|flipkart|meesho|delhivery|blue\s*dart|dtdc|courier|कूरियर|डिलीवरी|swiggy|zomato|अमेजन|फ्लिपकार्ट/i, 'intermediary'],
    ['sub', 'Subordinates (SI / HC / Constable)', 'अधीनस्थ (उ0नि0 / हे0का0 / का0)', /उ0\s*नि0|उपनिरीक्षक|सहविवेचक|हे0\s*का0|मुख्य\s*आरक्षी|आरक्षी|कांस्टेबल|का0\s*\d|टीम\s*गठित|रवाना\s*कि/i, ''],
  ],
  GOT: /प्राप्त\s*(?:हु[आई]|हो\s*(?:गय|चुक)|की\s*गय|किया\s*गया|कर\s*लिय)|प्रा\S{0,3}\s*हु[आई]|प्रामत|उपलब्ध\s*करा|प्रदान\s*(?:कि|की)|जवाब\s*(?:प्राप्त|आया)|reply\s*received|received|अवगत\s*करा|पाई\s*गई|पाया\s*गया|पाये\s*गये|खाता\s*धारक\s*[A-Z]|डिटेल\s*प्रा/i,
  ASK: /पत्राचार|नोटिस|notice|प्रेषित\s*(?:कि|की)|भेजा|भेजी|भेजे|ई-?\s*मेल\s*(?:कि|द्वारा|के\s*माध्यम)|मेल\s*किया|अनुरोध|मांग|request|अपलोड|upload|सम्पर्क|संपर्क|लिखा\s*गया|रवाना/i,
  ifscBanks(s) { const out = []; for (const m of String(s).toUpperCase().matchAll(/\b([A-Z]{4})[0O]([A-Z0-9]{6})\b/g)) { const b = bankFromIfsc(m[1] + '0' + m[2]); if (b) out.push(b); } for (const m of String(s).matchAll(/(स्टेट\s*बैंक|State\s*Bank|SBI|HDFC|ICICI|Axis|एक्सिस|Kotak|कोटक|Yes\s*Bank|यस\s*बैंक|Punjab\s*National|PNB|पंजाब\s*नेशनल|Bank\s*of\s*Baroda|बैंक\s*ऑफ\s*बड़ौदा|Canara|केनरा|Union\s*Bank|यूनियन\s*बैंक|IndusInd|Federal|IDFC|AU\s*Small|Jio\s*Payments|Airtel\s*Payments|Paytm\s*Payments|Bank\s*of\s*Maharashtra|Indian\s*Bank|Central\s*Bank|UCO|IDBI|Bandhan|RBL)/gi)) out.push(m[1].replace(/\s+/g, ' ')); return uniq(out); },
  sentences(b) { return String(b).split(/[।|]+|\s(?=\d{1,2}\s*\.\s*(?:मो|खाता|वेब|[A-Z]))/).map(s => s.trim()).filter(s => s.length > 12).map(s => s.length > 700 ? s.slice(0, 700) : s); },

  /* ---------- whole-case analysis (memoised) ---------- */
  _m: null,
  analyse(d = S.data, c = activeCase()) {
    const st = (d && d.cctns) || {}, cd = st.cd || [];
    const sig = [c.id, cd.length, cd.map(x => x.id).join(','), st.fir && st.fir.file, (st.docs || []).length, c.section, c.final && c.final.type].join('|');
    if (this._m && this._m.sig === sig) return this._m.r;
    const L = cd.map((x, i) => { const n = this.cdNo(x.text, x.file); return { x, i, no: +(x.no || n.no) || 0, fileNo: +n.fileNo || 0, prep: this.iso(this.prep(x.text) || x.date), body: x.file === 'Typed entry' ? x.text : this.body(x.text) }; }).sort((a, b) => a.no - b.no || (a.prep < b.prep ? -1 : 1));
    const BR = L.map(l => [l, this.brief(l.x.text)]).filter(x => x[1]), first = BR.length ? BR[0][0] : L[0], brief = BR.length ? BR.map(x => x[1]).sort((a, b) => b.length - a.length)[0] : '';
    const B = this.firFromBrief(brief || (st.fir ? st.fir.text : '')); BR.slice(0, 3).forEach(x => { B.sections = uniq([...B.sections, ...this.firFromBrief(x[1]).sections]); });
    const firText = st.fir && !st.fir.auto ? this.dg(st.fir.text) : '';
    const tl = L.find(l => this.tahrir(l.body)), tah = (tl && this.tahrir(tl.body)) || (firText ? this.cut(firText.replace(/[\s\S]*?(?:Contents|विवरण|First\s*Information\s*contents)[^:]*:/i, ''), 3000) : '');
    const stm = []; L.forEach(l => this.statements(l.body).forEach(s => stm.push({ ...s, cd: l.no })));
    let vic = stm.find(s => /वादी|पीड़ित/.test(s.who)) || null;
    if (!vic) for (const l of L) { const m = l.body.match(/वादी\s*(?:मुकदमा\s*)?(?:श्री|श्रीमती)?[^।|]{0,160}?(?:ने\s*)?पूछने\s*पर\s*(?:बताया|बयान\s*किया)([\s\S]{80,2200})/); if (m) { vic = { who: 'वादी', text: m[1].trim(), cd: l.no }; break; } }
    const F = CCTNS.facts([brief, firText, tah].join('\n'));
    const fir = { no: c.fir || F.fir || '', date: (first && (this.dg(first.x.text).match(/प्र\.?\s*सू\.?\s*रि\.?\s*सं[\s\S]{0,40}?Date\s*\(दिनांक\)\s*:\s*(\d{1,2}\/\d{1,2}\/20\d\d)/) || [])[1]) || F.date || '',
      sections: uniq([...B.sections, ...this.secNorm(c.section || ''), ...(B.sections.length ? [] : this.secNorm(F.sections.join(', ')))]), complainant: B.complainant || F.complainant || '', mobile: B.mobile, incident: B.incident, info: B.info,
      amount: this.amount(tah) || this.amount(brief) || F.amount || 0, items: B.items, tahrir: tah, brief };
    // events: who was asked, who replied
    const ev = [];
    L.forEach((l, li) => this.sentences(l === tl ? l.body.replace(/नकल\s*तहरीर[\s\S]*?(?:हस्ता0|सादर\s*धन्यवाद|$)/, ' ') : l.body).forEach(s => {
      const got = this.GOT.test(s), ask = this.ASK.test(s); if (!got && !ask) return;
      for (const [k, en, hi, rx, nt] of this.AG) { if (!rx.test(s)) continue; if (k === 'sub' && !ask && !got) continue;
        const banks = k === 'bank' ? this.ifscBanks(s) : [];
        (banks.length ? banks : ['']).forEach(bk => ev.push({ k, en: bk ? en + ' · ' + bk : en, hi: bk ? hi + ' · ' + bk : hi, nt, bank: bk, act: got ? 'got' : 'ask', cd: l.no, date: l.prep, s: this.cut(s, 260), ids: this.idsOf(s) })); }
    }));
    const ag = new Map(); for (const e of ev) { const key = e.k + '|' + e.bank; const a = ag.get(key) || { key, k: e.k, en: e.en, hi: e.hi, nt: e.nt, bank: e.bank, ask: [], got: [] }; a[e.act].push(e); ag.set(key, a); }
    ag.forEach(a => { const M = new Map(); [...a.ask, ...a.got].forEach(e => (e.ids || []).forEach(i => { const k = i.t + '|' + i.v; (M.get(k) || M.set(k, { ...i, ev: [] }).get(k)).ev.push(e); })); a.ids = [...M.values()].sort((x, y) => y.ev.length - x.ev.length); });
    const agencies = [...ag.values()].map(a => { const la = a.ask.slice(-1)[0], lg = a.got.slice(-1)[0]; const status = lg && (!la || lg.cd >= la.cd) ? 'Received' : la ? 'Pending' : 'Received'; return { ...a, status, since: status === 'Pending' ? la.date : '', age: status === 'Pending' ? this.days(la.date) : 0, last: (lg && (!la || lg.cd >= la.cd) ? lg : la || lg) }; })
      .sort((a, b) => (a.status === 'Pending' ? 0 : 1) - (b.status === 'Pending' ? 0 : 1) || b.age - a.age);
    // each identifier named in the FIR: required → received / asked / not asked
    const later = L.slice(brief ? 0 : 0).map(l => ({ no: l.no, date: l.prep, b: (l === tl ? l.body.replace(/नकल\s*तहरीर[\s\S]*?(?:हस्ता0|सादर\s*धन्यवाद|$)/, ' ') : l.body).replace(/(\d)\s+(?=\d)/g, '$1') }));
    const NEED = { mobile: ['CDR / CAF / IPDR, WhatsApp / Telegram IP Logs', 'Telecom + WhatsApp', 'telecom', 'टेलीकॉम / व्हाट्सएप'], account: ['KYC, Statement, Linked Mobile / IP, Hold / Lien', 'Bank', 'bank_kyc', 'बैंक'], url: ['WHOIS, Hosting, Payment Gateway, Server IP', 'Domain Registrar / Hosting', 'intermediary', 'डोमेन रजिस्ट्रार / होस्टिंग'], upi: ['UPI KYC & Linked Account', 'NPCI / PSP App', 'intermediary', 'NPCI / पेमेंट ऐप'], other: ['Details', '—', '', '—'] };
    const items = fir.items.map(it => {
      const v = it.type === 'url' ? it.value.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : it.value; let got = null, ask = null, kyc = '', ip = '', bank = '';
      if (v && v.length >= 5) for (const l of later) { let p = -1; while ((p = l.b.indexOf(v, p + 1)) >= 0) { const w = l.b.slice(p, p + 260), pre = l.b.slice(Math.max(0, p - 160), p);
        const h = w.slice(0, v.length + 110).match(/खाता\s*धारक\s*(?:का\s*नाम\s*)?[:\-]?\s*([A-Z][A-Za-z .\/&]{3,70}?)(?=\s*(?:W\/O|S\/O|D\/O|C\/O|R\/O|पता|पुत्र|निवासी|,|\d)|$)/), i = w.slice(v.length, v.length + 40).match(/^\s*(?:की|का|के)\s*आईपी\s*([\d.]{7,15}|[0-9a-f:]{8,})/i);
        if (h && !kyc) kyc = h[1].trim(); if (i && !ip) ip = i[1]; if (!bank) bank = this.ifscBanks(w.slice(0, 60))[0] || '';
        const sent = (pre.split(/[।|]/).pop() + w.split(/[।|]/)[0]);
        if (h || i || this.GOT.test(sent)) { if (!got) got = { cd: l.no, date: l.date, s: this.cut(sent, 220) }; } else if (this.ASK.test(sent) && !ask) ask = { cd: l.no, date: l.date, s: this.cut(sent, 220) };
      } }
      const n = NEED[it.type] || NEED.other; const status = got ? 'Received' : ask ? 'Asked' : 'Not Asked';
      return { ...it, need: n[0], from: bank ? 'Bank · ' + bank : n[1], fromHi: bank ? 'बैंक · ' + bank : n[3], nt: n[2], bank, status, got, ask, kyc, ip, age: !got && ask ? this.days(ask.date) : 0 };
    });
    // CD numbering
    const nos = L.map(l => l.no).filter(Boolean), max = nos.length ? Math.max(...nos) : 0, cnt = {}; nos.forEach(n => cnt[n] = (cnt[n] || 0) + 1);
    const missing = []; for (let i = 1; i <= max; i++) if (!cnt[i]) missing.push(i);
    const firIso = this.iso(fir.date), bad = L.filter(l => l.prep && (firIso && l.prep < firIso || l.prep > new Date().toISOString().slice(0, 10)));
    const seq = []; for (let i = 1; i < L.length; i++) if (L[i].prep && L[i - 1].prep && L[i].prep < L[i - 1].prep && L[i].no !== L[i - 1].no) seq.push(L[i]);
    const cdc = { nos, max, missing, dup: Object.keys(cnt).filter(k => cnt[k] > 1).map(Number), mismatch: L.filter(l => l.fileNo && l.no && l.fileNo !== l.no), bad, seq, last: L.length ? L[L.length - 1] : null };
    const allBody = L.map(l => l.body).join(' \n ');
    const foreign = [...allBody.matchAll(/कम्बोडिया|कंबोडिया|\bCambodia\b|चीन|\bChina\b|दुबई|\bDubai\b|वियतनाम|\bVietnam\b|म्यांमार|\bMyanmar\b|थाईलैंड|\bThailand\b|हांगकांग|\bHong\s*Kong\b|सिंगापुर|\bSingapore\b|मलेशिया|\bMalaysia\b|फिलीपींस|\bPhilippines\b|लाओस|\bLaos\b|नेपाल|\bNepal\b|पाकिस्तान|\bPakistan\b|विदेश|\bforeign\b/gi)].filter(m => /आईपी|\bIP\b|लोकेशन|location|सर्वर|server|लुक\s*अप|lookup|देश|country|वीपीएन|VPN/i.test(allBody.slice(Math.max(0, m.index - 140), m.index + 60))).map(m => m[0].trim());
    const acc = { cs: [], not: [] }; (st.docs || []).filter(x => /Charge Sheet|Final Report/.test(x.kind || '')).forEach(x => { const A = this.accused(x.text || ''); acc.cs = uniq([...acc.cs, ...A.cs]); acc.not = uniq([...acc.not, ...A.not]); });
    const r = { L, fir, vic, stm, acc, ev, agencies, items, cdc, foreign: uniq(foreign), io: this.io([...(st.docs || []).map(x => x.text || ''), ...L.map(l => l.x.text)]), allBody, final: c.final || null };
    r.secs = this.secCheck(r); r.sugg = this.suggest(r, c, st);
    this._m = { sig, r }; return r;
  },

  /* ---------- section check (advisory) ---------- */
  RULES: [
    ['318(4) BNS', 'धोखाधड़ी (Cheating)', /धोखा|ठग|cheat|fraud|फ्रॉड|फ्राड|निवेश|invest|ट्रेडिंग|trading|लालच|झांसा|झाँसा/i],
    ['319(2) BNS', 'प्रतिरूपण द्वारा छल (Cheating by personation)', /(?:खुद|स्वयं|अपने)\s*को\s*\S+(?:\s*\S+)?\s*(?:अधिकारी|बताकर|बताया|बताते)|बनकर|posing|impersonat|सीबीआई|\bcbi\b|customs|कस्टम|पुलिस\s*अधिकारी\s*बन|डिजिटल\s*अरेस्ट|digital\s*arrest|फर्जी\s*(?:अधिकारी|पहचान|प्रोफाइल|आईडी)|प्रतिनिधि\s*बता|सलाहकार|advisor|एडवाइजर/i],
    ['66D IT Act', 'कम्प्यूटर संसाधन से प्रतिरूपण द्वारा छल', null],
    ['66C IT Act', 'पहचान की चोरी / OTP-पासवर्ड का दुरुपयोग', /\botp\b|ओटीपी|password|पासवर्ड|पहचान\s*(?:की\s*)?चोरी|identity\s*theft|आधार\s*(?:का\s*)?दुरुपयोग|sim\s*swap|ई-?\s*सिम|e-?sim|स्क्रीन\s*शेयर|screen\s*shar|anydesk|teamviewer|remote\s*access|आईडी\s*का\s*दुरुपयोग/i],
    ['66 IT Act', 'कम्प्यूटर में अनधिकृत प्रवेश / हैकिंग (धारा 43 सहपठित)', /hack|हैक|unauthori|anydesk|teamviewer|\bapk\b|एपीके|remote\s*access|malware|मैलवेयर/i],
    ['61(2) BNS', 'आपराधिक षड्यंत्र (एक से अधिक अभियुक्त)', /गिरोह|gang|गैंग|साजिश|षड्यंत्र|षडयंत्र|conspir|मिलीभगत/i],
    ['3(5) BNS', 'सामान्य आशय (एक से अधिक अभियुक्त)', null],
    ['336(3) BNS', 'छल हेतु कूटरचना (फर्जी वेबसाइट / दस्तावेज)', /फर्जी\s*(?:दस्तावेज|वेबसाइट|ऐप|एप|app|सर्टिफिकेट|certificate|लेटर|letter|पत्र|रसीद|receipt|आईडी\s*कार्ड|ट्रेडिंग)|fake\s*(?:website|app|document|certificate|letter|receipt|trading)|forged|कूटरचित|कूट\s*रचित/i],
    ['340(2) BNS', 'कूटरचित दस्तावेज / इलेक्ट्रॉनिक अभिलेख का असली के रूप में प्रयोग', null],
    ['308(2) BNS', 'उद्दापन (Extortion / Blackmail)', /blackmail|ब्लैकमेल|extort|उगाही|sextortion|वीडियो\s*वायरल|वायरल\s*करने\s*की\s*धमकी|गिरफ्तार\s*(?:कर|करने)\s*की\s*धमकी/i],
    ['351(2) BNS', 'आपराधिक अभित्रास (धमकी)', /धमकी|धमका|threat|जान\s*से\s*मार/i],
    ['67 IT Act', 'अश्लील सामग्री का प्रसारण', /अश्लील|obscene|nude|न्यूड|सेक्स|\bsex\b|नग्न/i],
    ['317(2) BNS', 'चोरी / ठगी की सम्पत्ति बेईमानी से प्राप्त करना (म्यूल खाताधारक)', null],
    ['111 BNS', 'संगठित अपराध (सिंडिकेट)', null]
  ],
  secCheck(r) {
    const T = [r.fir.tahrir, r.vic ? r.vic.text : '', r.fir.brief, r.L.length ? r.L[0].body : ''].join(' '), kw = rx => { const m = rx && T.match(rx); return m ? m[0] : ''; };
    const has = s => r.fir.sections.some(x => x.replace(/\s+/g, '').toUpperCase() === s.replace(/\s+/g, '').toUpperCase());
    const nAcc = r.fir.items.length, nBank = r.fir.items.filter(i => i.type === 'account').length, web = r.fir.items.find(i => i.type === 'url');
    const states = uniq((r.allBody.match(/ODISHA|MAHARASHTRA|ASSAM|BIHAR|JHARKHAND|RAJASTHAN|GUJARAT|KARNATAKA|TAMIL|TELANGANA|ANDHRA|KERALA|PUNJAB|HARYANA|DELHI|UTTAR PRADESH|M\.P|MADHYA PRADESH|WEST BENGAL|तमिलनाडू|तमिलनाडु|उड़ीसा|ओडिशा|महाराष्ट्र|असम|बिहार|राजस्थान|गुजरात|कर्नाटक|तेलंगाना|केरल|पंजाब|हरियाणा|दिल्ली|पश्चिम बंगाल/gi) || []).map(s => s.toUpperCase()));
    const comm = kw(/whats\s*app|व्हाट्स\s*ऐप|व्हाट्सएप|telegram|टेलीग्राम|website|वेबसाइट|वेब\s*लिंक|\bapp\b|ऐप|एप्लीकेशन|ऑनलाइन|online|लिंक|link|कॉल|call|मैसेज|message|ग्रुप|group/i);
    const out = [];
    for (const [sec, hi, rx] of this.RULES) {
      let why = '';
      if (sec === '66D IT Act') { const p = kw(this.RULES[1][2]) || kw(/फर्जी|fake|झांसा|ठग|धोखा/i); why = p && comm ? `"${p}" + "${comm}" – छल ऑनलाइन / संचार माध्यम से` : ''; }
      else if (sec === '3(5) BNS' || sec === '61(2) BNS') { const k = rx ? kw(rx) : ''; why = k ? `"${k}"` : nAcc >= 2 ? `FIR में ${nAcc} मोबाइल / खाते / लिंक नामित – एक से अधिक व्यक्ति` : ''; }
      else if (sec === '340(2) BNS') { const k = kw(this.RULES[7][2]); why = k ? `"${k}" का प्रयोग असली के रूप में` : web ? `फर्जी वेब लिंक ${this.cut(web.value, 40)} से ठगी` : ''; }
      else if (sec === '336(3) BNS') { const k = kw(rx); why = k ? `"${k}"` : web ? `फर्जी वेब लिंक ${this.cut(web.value, 40)} (इलेक्ट्रॉनिक अभिलेख)` : ''; }
      else if (sec === '317(2) BNS') why = nBank ? `${nBank} खातों में ठगी की रकम गई – पहचान होने पर खाताधारकों पर` : '';
      else if (sec === '111 BNS') why = nBank >= 5 && (r.foreign.length || states.length >= 3) ? `${nBank} म्यूल खाते${states.length ? ', ' + states.length + ' राज्य' : ''}${r.foreign.length ? ', विदेश (' + r.foreign.slice(0, 2).join(', ') + ')' : ''} – सिंडिकेट / निरंतर विधिविरुद्ध क्रियाकलाप सिद्ध होने पर ही` : '';
      else { const k = kw(rx); why = k ? `"${k}"` : ''; }
      const inF = has(sec);
      if (inF) out.push({ sec, hi, state: why || /^(317|111)/.test(sec) ? 'ok' : 'review', why: why || 'FIR / बयान में इसके समर्थन के शब्द नहीं मिले – जाँच लें' });
      else if (why) out.push({ sec, hi, state: 'add', why });
    }
    r.fir.sections.filter(s => !out.some(o => o.sec.replace(/\s+/g, '').toUpperCase() === s.replace(/\s+/g, '').toUpperCase())).forEach(s => out.push({ sec: s, hi: '', state: 'ok', why: 'FIR में दर्ज' }));
    return out.sort((a, b) => ({ ok: 0, review: 1, add: 2 })[a.state] - ({ ok: 0, review: 1, add: 2 })[b.state]);
  },

  /* ---------- suggestions to the IO ---------- */
  suggest(r, c, st) {
    const S2 = [], add = (en, hi, act) => S2.push({ en, hi, act });
    const txt = r.allBody;
    if (!r.vic && r.cdc.max && !r.cdc.nos.includes(1)) add('CD 1 is not among the uploaded parts – it carries the FIR copy (नकल तहरीर) and usually the complainant\'s statement. Upload CD 1.', 'पर्चा 1 अपलोड भागों में नहीं है – इसमें नकल तहरीर व वादी का बयान होता है, पर्चा 1 अपलोड करें।');
    else if (!r.vic) add('Record the complainant\'s statement (Sec 180 BNSS) and attach it to the CD.', 'वादी का बयान (धारा 180 बीएनएसएस) अंकित कर पर्चे में संलग्न करें।');
    const na = r.items.filter(i => i.status === 'Not Asked' && i.nt);
    if (na.length) { const g = groupBy(na, i => i.from); for (const [from, L] of g) add(`Not yet asked: ${L.length} ${L[0].type === 'account' ? 'account(s)' : L[0].type === 'mobile' ? 'mobile(s)' : 'item(s)'} named in the FIR – send a Sec 94 BNSS notice to ${from} (${L.slice(0, 3).map(i => i.value).join(', ')}${L.length > 3 ? '…' : ''}).`, `FIR में नामित ${L.length} ${L[0].type === 'account' ? 'खातों' : L[0].type === 'mobile' ? 'मोबाइल नम्बरों' : 'बिन्दुओं'} हेतु ${L[0].fromHi} को धारा 94 बीएनएसएस का नोटिस भेजें।`, { type: L[0].nt, items: L.map(i => ({ what: i.value, who: i.bank || from, name: i.need })) }); }
    r.agencies.filter(a => a.status === 'Pending' && a.age >= 7).forEach(a => add(`Reminder to ${a.en}: asked in CD ${a.last.cd} (${a.age} days ago), reply not yet recorded.`, `${a.hi} को अनुस्मारक भेजें – पर्चा ${a.last.cd} में पत्राचार (${a.age} दिन पूर्व), जवाब अप्राप्त।`, a.nt ? { type: a.nt, items: [{ what: a.en, who: a.bank || a.en, name: '' }] } : null));
    r.items.filter(i => i.status === 'Asked' && i.age >= 7).slice(0, 4).forEach(i => add(`Follow up ${i.value} (${i.from}) – asked in CD ${i.ask.cd}, ${i.age} days ago.`, `${i.value} (${i.fromHi}) – पर्चा ${i.ask.cd} में माँगा गया, ${i.age} दिन से लंबित।`, i.nt ? { type: i.nt, items: [{ what: i.value, who: i.bank || i.from, name: i.need }] } : null));
    const kyc = r.items.filter(i => i.kyc), served = /35\s*\(\s*3\s*\)|35\(3\)|धारा\s*35/.test(txt);
    if (kyc.length && !served) add(`${kyc.length} account holder(s) identified by KYC (${kyc.slice(0, 2).map(i => i.kyc).join(', ')}${kyc.length > 2 ? '…' : ''}) – verify the address, then serve Sec 35(3) BNSS notice / arrest as the evidence allows.`, `KYC से ${kyc.length} खाताधारक ज्ञात (${kyc.slice(0, 2).map(i => i.kyc).join(', ')}${kyc.length > 2 ? '…' : ''}) – पते का सत्यापन कर धारा 35(3) बीएनएसएस का नोटिस / गिरफ्तारी की कार्यवाही करें।`, { type: 'n353', items: kyc.map(i => ({ what: i.kyc, who: i.bank, name: i.value })) });
    if (r.fir.items.some(i => i.type === 'account') && !/होल्ड|hold|lien|लियन|फ्रीज|freeze|फ्रीज़/i.test(txt)) add('Ask the banks to put a hold / lien on the fraud amount, then apply to the court for release to the victim (Sec 503 BNSS).', 'बैंकों से ठगी की राशि पर होल्ड / लियन लगवाएँ और वादी को धनराशि वापसी हेतु न्यायालय में धारा 503 बीएनएसएस के तहत प्रार्थना पत्र दें।', { type: 'bank_freeze', items: r.fir.items.filter(i => i.type === 'account').map(i => ({ what: i.value, who: i.bank || '', name: '' })) });
    if (r.foreign.length) add(`IPs / links traced abroad (${r.foreign.slice(0, 3).join(', ')}) – check VPN / proxy, and route the request through I4C / MHA (MLAT) if needed.`, `आईपी / लिंक विदेश (${r.foreign.slice(0, 3).join(', ')}) के पाए गए – VPN / प्रॉक्सी की जाँच करें, आवश्यकता पर I4C / गृह मंत्रालय (MLAT) के माध्यम से अनुरोध भेजें।`);
    const web = r.fir.items.filter(i => i.type === 'url'); if (web.length && !/whois|हूइज|डोमेन|domain|hosting|होस्टिंग/i.test(txt)) add(`Website named in the FIR (${web[0].value}) – get WHOIS, hosting and payment gateway details, and request blocking through I4C.`, `FIR में दर्ज वेबसाइट (${web[0].value}) का WHOIS, होस्टिंग व पेमेंट गेटवे विवरण प्राप्त करें तथा I4C के माध्यम से ब्लॉक कराएँ।`, { type: 'intermediary', items: web.map(i => ({ what: i.value, who: 'Domain registrar / Hosting', name: 'WHOIS, hosting, payment gateway' })) });
    const cc = r.cdc; if (cc.missing.length) add(`Case diary numbering: CD ${cc.missing.join(', ')} not found among the uploaded parts – add or check them.`, `पर्चा क्रमांक ${cc.missing.join(', ')} अपलोड भागों में नहीं मिले – जोड़ें / जाँच करें।`);
    cc.mismatch.forEach(l => add(`File "${l.x.file}" says CD ${l.fileNo} in its name but CD ${l.no} inside – rename or check.`, `फाइल "${l.x.file}" के नाम में पर्चा ${l.fileNo}, परन्तु अन्दर पर्चा ${l.no} – जाँच लें।`));
    cc.bad.forEach(l => add(`CD ${l.no} shows date ${this.dmy(l.prep)}, which is ${l.prep < this.iso(r.fir.date) ? 'before the FIR date' : 'in the future'} – check the date.`, `पर्चा ${l.no} की दिनांक ${this.dmy(l.prep)} ${l.prep < this.iso(r.fir.date) ? 'FIR से पूर्व की' : 'भविष्य की'} है – जाँच लें।`));
    const fin = c.final && c.final.type;
    if (!fin && cc.last && cc.last.prep && this.days(cc.last.prep) > 15) add(`Last case diary (CD ${cc.last.no}) was ${this.days(cc.last.prep)} days ago – write the next CD.`, `अन्तिम पर्चा (${cc.last.no}) ${this.days(cc.last.prep)} दिन पूर्व – अगला पर्चा लिखें।`);
    if (fin === 'FR' && kyc.length) add(`Final Report filed although ${kyc.length} account holder(s) are identified – review whether further investigation / CS is possible.`, `${kyc.length} खाताधारक ज्ञात होने के बावजूद अंतिम रिपोर्ट – अग्रिम विवेचना / आरोप पत्र की सम्भावना पर पुनर्विचार करें।`);
    if (fin === 'PPI') add('CS-PPI: list the pending points (absconding accused, bank / telecom replies) and file the supplementary charge sheet (Sec 193(9) BNSS).', 'सीएस-पीपीआई: लंबित बिन्दु (फरार अभियुक्त, बैंक / टेलीकॉम जवाब) पूर्ण कर धारा 193(9) बीएनएसएस के तहत पूरक आरोप पत्र प्रेषित करें।');
    r.secs.filter(s => s.state === 'add').slice(0, 3).forEach(s => add(`Consider adding Sec ${s.sec} – ${s.why}.`, `धारा ${s.sec} (${s.hi}) बढ़ाने पर विचार करें – ${s.why}।`));
    return S2;
  },

  /* ---------- page: Case At A Glance ---------- */
  ST: { Received: ['good', '✔ Received'], Pending: ['bad', '⏳ Pending'], Asked: ['warn', '⏳ Asked'], 'Not Asked': ['bad', '✖ Not Asked'] },
  chip(s) { const x = this.ST[s] || ['', s]; return `<span class="cdx-st ${x[0]}">${x[1]}</span>`; },
  /* From Whom – Asked & Received: live summary, CD chips with hover preview, click for the full record in place */
  agTable(r, g, el) {
    this.agTip(null);
    const A = r.agencies, box = $('#cdxA', g), pend = A.filter(a => a.status === 'Pending'), old = pend.filter(a => a.age >= 30), cds = a => [...new Set(a.map(e => e.cd))];
    const sum = [['all', '🏢', 'Agencies / Persons', A.length, '#6366f1'], ['Pending', '⏳', 'Reply Pending', pend.length, '#d97706'], ['old', '🔴', 'Pending 30+ Days', old.length, '#dc2626'], ['Received', '✅', 'Reply Received', A.length - pend.length, '#16a34a'],
      ['asks', '📨', 'Requests Sent', A.reduce((n, a) => n + a.ask.length, 0), '#0891b2'], ['gots', '📥', 'Replies Recorded', A.reduce((n, a) => n + a.got.length, 0), '#7c3aed']];
    const st = this._ag || (this._ag = { f: 'all' });
    box.innerHTML = `<div class="ag-k">${sum.map(([k, i, t, n, c]) => `<button class="ag-kb ${st.f === k ? 'on' : ''}" data-agf="${k}" style="--c:${c}"><span>${i}</span><b>${fmtNum(n)}</b><small>${t}</small></button>`).join('')}</div><div id="cdxAT"></div>`;
    const rows = A.filter(a => st.f === 'Pending' ? a.status === 'Pending' : st.f === 'Received' ? a.status === 'Received' : st.f === 'old' ? a.status === 'Pending' && a.age >= 30 : true);
    const chips = (a, act) => cds(a[act]).map(cd => `<span class="ag-cd ${act}" data-agk="${esc(a.key)}" data-act="${act}" data-cd="${cd}">CD ${cd}</span>`).join('') || '<span class="muted">—</span>';
    Table($('#cdxAT', box), { rows, pageSize: 10, exportName: 'agency_status', onRow: a => this.agOne(a, el), columns: [{ key: 'en', label: 'Agency / Person', csv: a => a.en + (a.ids.length ? ' | ' + a.ids.map(i => i.t + ': ' + i.v).join('; ') : ''), render: a => `<b>${esc(a.en)}</b><div class="small muted">${esc(a.hi)}</div>${a.ids.length ? `<div class="ag-ids">${a.ids.slice(0, 4).map((i, n) => `<span class="ag-id" data-agk="${esc(a.key)}" data-idn="${n}">${this.IDT[i.t] || ''} ${esc(i.v.length > 26 ? i.v.slice(0, 24) + '…' : i.v)}</span>`).join('')}${a.ids.length > 4 ? `<span class="ag-id more" data-agk="${esc(a.key)}" data-idm="1">+${a.ids.length - 4} more</span>` : ''}</div>` : ''}` }, { key: 'status', label: 'Status', sortVal: a => a.status === 'Pending' ? -a.age : 1, render: a => this.chip(a.status) + (a.age ? ` <small class="bad-t">${a.age} days</small>` : '') }, { key: 'ask', label: 'Asked (CD)', sortVal: a => a.ask.length, render: a => `<div class="ag-cds">${chips(a, 'ask')}</div>` }, { key: 'got', label: 'Received (CD)', sortVal: a => a.got.length, render: a => `<div class="ag-cds">${chips(a, 'got')}</div>` }, { key: 'last', label: 'Latest Entry', render: a => `<span class="small">${esc(a.last ? a.last.s : '')}</span>` }],
      after: c => { $$('.ag-id', c).forEach(x => { const a = A.find(y => y.key === x.dataset.agk); if (!a) return; if (x.dataset.idm) { x.onclick = ev => { ev.stopPropagation(); this.agOne(a, el); }; return; } const i = a.ids[+x.dataset.idn];
        x.onmouseenter = () => this.idTip(x, i, a); x.onmouseleave = () => this.agTip(null); x.onclick = ev => { ev.stopPropagation(); this.agTip(null); this.idOne(i, A, el); }; });
        $$('.ag-cd', c).forEach(x => { const a = A.find(y => y.key === x.dataset.agk), E = a ? a[x.dataset.act].filter(e => String(e.cd) === x.dataset.cd) : [];
        x.onmouseenter = () => this.agTip(x, a, E); x.onmouseleave = () => this.agTip(null); x.onclick = ev => { ev.stopPropagation(); this.agTip(null); this.agOne(a, el, x.dataset.act + x.dataset.cd); }; }); } });
    $$('[data-agf]', box).forEach(b => b.onclick = () => { st.f = b.dataset.agf === 'asks' || b.dataset.agf === 'gots' ? 'all' : b.dataset.agf; this.agTable(r, g, el); });
    $$('[data-agf]', box).forEach(b => { const k = b.dataset.agf, L = k === 'all' || k === 'asks' || k === 'gots' ? A : A.filter(a => k === 'old' ? a.status === 'Pending' && a.age >= 30 : a.status === k);
      b.onmouseenter = () => this.agTip(b, null, null, L); b.onmouseleave = () => this.agTip(null); });
  },
  agTip(el, a, E, list) {
    let t = $('#agTip'); if (!el) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement('div'); t.id = 'agTip'; t.className = 'ag-tip'; document.body.appendChild(t); }
    t.innerHTML = list ? `<b>${list.length} agencies / persons</b>${list.slice(0, 8).map(a => `<div>${a.status === 'Pending' ? '⏳' : '✅'} ${esc(a.en)}${a.age ? ` <i>${a.age} d</i>` : ''}</div>`).join('')}${list.length > 8 ? `<div class="muted">+ ${list.length - 8} more – click</div>` : ''}`
      : `<b>${esc(a.en)}</b> · ${E[0].act === 'ask' ? '📨 Asked' : '📥 Received'} in CD ${E[0].cd}${E[0].date ? ' · ' + esc(this.dmy(E[0].date)) : ''}${E.map(e => `<div class="ag-tx">${esc(e.s)}</div>`).join('')}<div class="muted">Click for the full record</div>`;
    const r = el.getBoundingClientRect(); t.style.left = Math.min(innerWidth - 440, Math.max(8, r.left)) + 'px'; t.style.top = (r.bottom + 6 + 260 > innerHeight ? Math.max(8, r.top - 6 - t.offsetHeight) : r.bottom + 6) + 'px';
  },
  hl(s, v) { const t = esc(s); if (!v) return t; const e = esc(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return t.replace(new RegExp(e, 'gi'), x => `<mark>${x}</mark>`); },
  idTip(x, i, a) {
    this.agTip(x, a, [{ act: 'ask', cd: '', s: '' }]); const t = $('#agTip'); if (!t) return;
    const ask = [...new Set(i.ev.filter(e => e.act === 'ask').map(e => e.cd))], got = [...new Set(i.ev.filter(e => e.act === 'got').map(e => e.cd))];
    t.innerHTML = `<b>${this.IDT[i.t] || ''} ${esc(i.t)}: <span class="mono">${esc(i.v)}</span></b><div>🏢 ${esc(a.en)}</div><div>📨 Asked in ${ask.length ? 'CD ' + ask.join(', ') : '—'} · 📥 Received in ${got.length ? 'CD ' + got.join(', ') : '—'}</div><div class="ag-tx">${this.hl(i.ev[0].s, i.v)}</div><div class="muted">Click for every entry with this ${esc(i.t.toLowerCase())}</div>`;
  },
  idOne(i, A, el) {
    const E = []; A.forEach(a => [...a.ask, ...a.got].forEach(e => { if ((e.ids || []).some(x => x.v.toLowerCase() === i.v.toLowerCase())) E.push({ ...e, ag: a.en }); }));
    E.sort((x, y) => x.cd - y.cd || (x.act === 'ask' ? -1 : 1));
    const ags = [...new Set(E.map(e => e.ag))];
    const b = UI.modal(`${this.IDT[i.t] || ''} ${i.t}: ${i.v}`, `<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><span class="small">Found in <b>${E.length}</b> entr${E.length === 1 ? 'y' : 'ies'} · <b>${ags.length}</b> agenc${ags.length === 1 ? 'y' : 'ies'}: ${esc(ags.join(', '))}</span><span class="spacer"></span><button class="btn sm primary" id="idTrk">🔎 Track Everywhere</button><button class="btn sm" id="idCp">📋 Copy</button></div>
      <div class="ag-tl">${E.map(e => `<div class="ag-ev ${e.act}"><div class="ag-evh"><span class="ag-cd ${e.act}">CD ${e.cd}</span><b>${e.act === 'ask' ? '📨 Asked / Sent' : '📥 Reply Received'}</b><span class="small">🏢 ${esc(e.ag)}</span><span class="small muted">${esc(this.dmy(e.date) || '')}</span><span class="spacer"></span><button class="btn sm" data-ocd="${e.cd}">📖 Open CD ${e.cd}</button></div><div class="ag-evt">${this.hl(e.s, i.v)}</div></div>`).join('')}</div>`, [{ label: 'Close', onClick: UI.closeModal }]);
    $('#idTrk', b).onclick = () => { UI.closeModal(); if (typeof Dash2 !== 'undefined' && Dash2.track) Dash2.track(i.v); };
    $('#idCp', b).onclick = () => { navigator.clipboard && navigator.clipboard.writeText(i.v); UI.toast('Copied'); };
    $$('[data-ocd]', b).forEach(x => x.onclick = () => { const l = (this._m && this._m.r.L || []).find(l => String(l.no) === x.dataset.ocd), sel = $('#ccDoc', el); UI.closeModal(); if (l && sel) { sel.value = 'cd' + l.i; sel.dispatchEvent(new Event('change')); sel.scrollIntoView({ block: 'center' }); } });
  },
  agOne(a, el, mark) {
    if (!a) return; const E = [...a.ask, ...a.got].sort((x, y) => x.cd - y.cd || (x.act === 'ask' ? -1 : 1));
    const b = UI.modal('🏢 ' + a.en, `<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">${this.chip(a.status)}${a.age ? `<b class="bad-t">${a.age} days pending</b>` : ''}<span class="small muted">${esc(a.hi)}</span><span class="spacer"></span><span class="small">📨 Asked <b>${a.ask.length}</b> · 📥 Received <b>${a.got.length}</b></span></div>
      <div class="ag-tl">${E.map(e => `<div class="ag-ev ${e.act} ${mark === e.act + e.cd ? 'mark' : ''}"><div class="ag-evh"><span class="ag-cd ${e.act}">CD ${e.cd}</span><b>${e.act === 'ask' ? '📨 Asked / Sent' : '📥 Reply Received'}</b><span class="small muted">${esc(this.dmy(e.date) || '')}</span><span class="spacer"></span><button class="btn sm" data-ocd="${e.cd}">📖 Open CD ${e.cd}</button></div><div class="ag-evt">${esc(e.s)}</div></div>`).join('')}</div>
      ${a.status === 'Pending' && a.nt ? '<p class="small muted">Reply still pending – draft a reminder from 💡 Suggestions To IO.</p>' : ''}`, [{ label: 'Close', onClick: UI.closeModal }]);
    const m = $('.ag-ev.mark', b); if (m) setTimeout(() => m.scrollIntoView({ block: 'center' }), 50);
    $$('[data-ocd]', b).forEach(x => x.onclick = () => { const l = (this._m && this._m.r.L || []).find(l => String(l.no) === x.dataset.ocd), sel = $('#ccDoc', el); UI.closeModal(); if (l && sel) { sel.value = 'cd' + l.i; sel.dispatchEvent(new Event('change')); sel.scrollIntoView({ block: 'center' }); } });
  },
  glance(el) {
    const st = CCTNS.st(), c = activeCase(), r = this.analyse();
    const at = $('.cc-case', el); if (!at) return;
    const has = r.L.length || st.fir;
    const kp = [['FIR', [r.fir.no, r.fir.date].filter(Boolean).join(' · ')], ['Sections', r.fir.sections.join(', ')], ['Complainant', [r.fir.complainant, r.fir.mobile].filter(Boolean).join(' · ')], ['Incident', r.fir.incident], ['Amount', r.fir.amount ? fmtINR(r.fir.amount) : ''], ['Case Diary', r.L.length ? `${r.L.length} parts · Last CD ${r.cdc.last ? r.cdc.last.no : ''}${r.cdc.last && r.cdc.last.prep ? ' · ' + this.dmy(r.cdc.last.prep) : ''}` : ''], ['IO', c.io || r.io], ['Status', c.final ? (c.final.type === 'PPI' ? 'CS-PPI' : c.final.type) + (c.final.no ? ' No. ' + c.final.no : '') + (c.final.date ? ' · ' + this.dmy(c.final.date) : '') : (r.L.length ? 'Under Investigation' : '')]].filter(x => x[1]);
    const pendA = r.agencies.filter(a => a.status === 'Pending').length + r.items.filter(i => i.status !== 'Received').length, gotA = r.agencies.filter(a => a.status === 'Received').length + r.items.filter(i => i.status === 'Received').length;
    at.insertAdjacentHTML('afterend', `<div class="card cdx" id="cdxG"><div class="d2-hd"><h3>🧭 Case At A Glance</h3><span class="sub">Read from the FIR and every case-diary part of this case. What is required, what is received, what is pending and from whom – with suggestions for the IO.</span>
      <div class="cdx-bt">${has ? '<button class="btn" id="cdxOne" title="The whole case in one document – FIR, case details, what to do, intermediaries, received / pending, CD-wise work, suggestions">📘 Case One File</button> ' : ''}${has ? '<button class="btn cdx-deep" id="cdxExp" title="Hindi Short / Deep Brief Report as PDF, Word, HTML – and Excel">⬇ Export Report ▾</button>' : ''}</div></div>
      ${has ? `<div class="cdx-kp">${kp.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
      <div class="cdx-sum"><span class="good-t">✔ <b>${gotA}</b> Received</span><span class="bad-t">⏳ <b>${pendA}</b> Pending</span><span>💡 <b>${r.sugg.length}</b> Suggestions</span><span>⚖ <b>${r.secs.filter(s => s.state !== 'ok').length}</b> Section Points</span></div>
      <div class="cdx-g2"><div class="cdx-box"><h4>📄 FIR Content (Gist)</h4><div class="cdx-tx">${esc(this.cut(r.fir.tahrir || r.fir.brief || (st.fir && st.fir.text) || '', 1600)) || '<span class="muted">FIR text not found.</span>'}</div></div>
        <div class="cdx-box"><h4>🗣 Victim Statement (बयान वादी)${r.vic ? ` <small class="muted">CD ${r.vic.cd}</small>` : ''}</h4><div class="cdx-tx">${r.vic ? esc(this.cut(r.vic.text, 1600)) : '<span class="bad-t">Statement of the complainant not found in the case diary.</span>'}</div></div></div>
      ${r.acc.cs.length || r.acc.not.length || r.stm.length ? `<div class="cdx-acc">${r.acc.cs.length ? `<div><span>👤 Accused Charge-Sheeted</span><b>${r.acc.cs.map(esc).join(', ')}</b></div>` : ''}${r.acc.not.length ? `<div><span>❔ Not Charge-Sheeted / Suspects</span><b>${r.acc.not.length}</b></div>` : ''}${r.stm.length ? `<div><span>🗣 Statements Recorded</span><b>${uniq(r.stm.map(x => x.who + ' (CD ' + x.cd + ')')).slice(0, 12).map(esc).join(', ')}</b></div>` : ''}</div>` : ''}
      <h4 class="cdx-h">🎯 Named In The FIR – Required · Received · Pending</h4><div id="cdxI"></div>
      <h4 class="cdx-h">🏢 From Whom – Asked & Received (Bank, Telecom, WhatsApp, Google, I4C, NIC Email, Subordinates…)</h4><div id="cdxA"></div>
      <div class="cdx-g2"><div class="cdx-box"><h4>💡 Suggestions To IO</h4><div id="cdxS"></div></div><div class="cdx-box"><h4>⚖ Section Check <small class="muted">(advisory – IO decides on law & facts)</small></h4><div id="cdxSec"></div></div></div>
      <h4 class="cdx-h">🔢 Case Diary Numbering & Work Done</h4><div class="cdx-nos">${this.nosHtml(r)}</div><div id="cdxT"></div>`
      : `<div class="row" style="gap:10px;margin-top:8px;align-items:center"><span class="muted small">Click <b>📥 Import / Upload</b> above and add the CCTNS case zip / folder or the FIR, case-diary parts and CS / FR. Scanned PDFs are read on this computer (Hindi + English) – nothing is uploaded.</span></div>`}</div>`);
    const g = $('#cdxG', el);
    if (!has) return;
    $('#cdxExp', g).onclick = e => this.exportMenu(e.currentTarget); { const o = $('#cdxOne', g); if (o) o.onclick = () => go('others', 'onefile'); }
    Table($('#cdxI', g), { rows: r.items, pageSize: 10, exportName: 'fir_items_status', columns: [{ key: 'type', label: 'Type', render: x => esc(({ mobile: '📱 Mobile', account: '🏦 Account', url: '🌐 Web Link', upi: '💸 UPI', other: '• Other' })[x.type]) }, { key: 'value', label: 'Named In FIR', render: x => `<b class="mono">${esc(x.value)}</b>` }, { key: 'need', label: 'Required' }, { key: 'from', label: 'From Whom' },
      { key: 'status', label: 'Status', render: x => this.chip(x.status) + (x.age ? ` <small class="bad-t">${x.age} days</small>` : '') }, { key: 'kyc', label: 'Received Details', render: x => esc([x.kyc && 'Holder: ' + x.kyc, x.ip && 'IP: ' + x.ip].filter(Boolean).join(' · ') || (x.got ? x.got.s : x.ask ? 'Asked: ' + x.ask.s : '')) }, { key: 'cd', label: 'CD', render: x => x.got ? 'CD ' + x.got.cd : x.ask ? 'CD ' + x.ask.cd : '' },
      { key: 'act', label: '', render: (x, i) => x.status !== 'Received' && x.nt ? `<button class="btn sm srch" data-ni="${esc(x.value)}">Draft Notice</button>` : '' }], onRow: x => typeof Dash2 !== 'undefined' && Dash2.track(x.value) });
    this.agTable(r, g, el);
    $('#cdxS', g).innerHTML = r.sugg.length ? r.sugg.map((s, i) => `<div class="cdx-sg"><span>${i + 1}.</span><div class="grow">${esc(s.en)}<div class="small muted">${esc(s.hi)}</div></div>${s.act && s.act.type ? `<button class="btn sm srch" data-sg="${i}">Draft Notice</button>` : ''}</div>`).join('') : '<div class="good-t small">No pending suggestion.</div>';
    $('#cdxSec', g).innerHTML = `<table class="tbl cdx-sec"><thead><tr><th>Section</th><th>Check</th><th>Reason</th></tr></thead><tbody>${r.secs.map(s => `<tr><td><b>${esc(s.sec)}</b>${s.hi ? `<div class="small muted">${esc(s.hi)}</div>` : ''}</td><td>${s.state === 'ok' ? '<span class="cdx-st good">✔ In FIR</span>' : s.state === 'review' ? '<span class="cdx-st warn">? Review</span>' : '<span class="cdx-st bad">＋ Consider Adding</span>'}</td><td class="small">${esc(s.why)}</td></tr>`).join('')}</tbody></table>`;
    Table($('#cdxT', g), { rows: r.L.map(l => ({ l, no: l.no, date: this.dmy(l.prep), file: l.x.file, work: this.cut(l.body, 260) })), pageSize: 10, sortKey: 'no', exportName: 'case_diary_work', columns: [{ key: 'no', label: 'CD No.', num: true, render: x => `<b>${x.no || '?'}</b>${x.l.fileNo && x.l.fileNo !== x.no ? ` <span class="cdx-st warn" title="File name says CD ${x.l.fileNo}">file: ${x.l.fileNo}</span>` : ''}` }, { key: 'date', label: 'Date' }, { key: 'work', label: 'Work Done', render: x => `<span class="small">${esc(x.work)}</span>` }, { key: 'file', label: 'File' }],
      onRow: x => { const sel = $('#ccDoc', el); if (sel) { sel.value = 'cd' + x.l.i; sel.dispatchEvent(new Event('change')); sel.scrollIntoView({ block: 'center' }); } } });
    $$('[data-ni]', g).forEach(b => b.onclick = e => { e.stopPropagation(); const x = r.items.find(i => i.value === b.dataset.ni); CCTNS.openNotice(x.nt, { items: [{ what: x.value, who: x.bank || x.from, name: x.need }] }); });
    $$('[data-sg]', g).forEach(b => b.onclick = () => { const s = r.sugg[+b.dataset.sg]; CCTNS.openNotice(s.act.type, { items: s.act.items }); });
  },
  nosHtml(r) {
    const c = r.cdc; if (!c.max) return '<span class="muted small">No CD number found.</span>'; const out = [];
    for (let i = 1; i <= c.max; i++) { const mm = c.mismatch.find(l => l.no === i), b = c.bad.find(l => l.no === i); out.push(`<span class="cdx-no ${!c.nos.includes(i) ? 'miss' : c.dup.includes(i) ? 'dup' : mm || b ? 'warn' : ''}" title="${!c.nos.includes(i) ? 'Missing' : c.dup.includes(i) ? 'Uploaded twice' : mm ? 'File name says CD ' + mm.fileNo : b ? 'Date looks wrong: ' + this.dmy(b.prep) : 'OK'}">${i}</span>`); }
    return out.join('') + `<span class="small muted" style="margin-left:8px">${c.missing.length ? `<b class="bad-t">Missing: ${c.missing.join(', ')}</b> · ` : '<b class="good-t">No gap</b> · '}${c.dup.length ? `Twice: ${c.dup.join(', ')} · ` : ''}${c.mismatch.length ? `Name ≠ content: ${c.mismatch.map(l => l.x.file).join('; ')} · ` : ''}${c.bad.length ? `Date check: CD ${c.bad.map(l => l.no).join(', ')}` : ''}</span>`;
  },

  /* ---------- one-page Hindi report (A4) ---------- */
  report(mode) {
    const c = activeCase(), r = this.analyse(), f = r.fir;
    const got = [...r.items.filter(i => i.status === 'Received').map(i => `${i.value}: ${[i.kyc && 'खाताधारक ' + i.kyc, i.ip && 'आईपी ' + i.ip].filter(Boolean).join(', ') || (i.bank ? i.bank + ' से विवरण प्राप्त' : 'विवरण प्राप्त')} (पर्चा ${i.got.cd})`), ...r.agencies.filter(a => a.status === 'Received' && a.k !== 'bank').map(a => `${a.hi}: ${this.cut(a.last.s, 110)} (पर्चा ${a.last.cd})`)];
    const pend = [...r.items.filter(i => i.status !== 'Received').map(i => `${i.value} – ${i.status === 'Asked' ? `माँगा गया (पर्चा ${i.ask.cd}), ${i.age} दिन से लंबित` : 'अभी माँगा नहीं गया'} – ${i.fromHi}`), ...r.agencies.filter(a => a.status === 'Pending').map(a => `${a.hi} – पर्चा ${a.last.cd} से जवाब लंबित (${a.age} दिन)`)];
    const cur = r.L.slice(-2).map(l => `पर्चा ${l.no}${l.prep ? ' (' + this.dmy(l.prep) + ')' : ''}: ${this.cut(l.body, 230)}`);
    const fin = c.final ? ({ CS: 'आरोप पत्र', PPI: 'आरोप पत्र (अग्रिम विवेचना लंबित – PPI)', FR: 'अंतिम रिपोर्ट' })[c.final.type] + (c.final.no ? ' सं0 ' + c.final.no : '') + (c.final.date ? ' दिनांक ' + this.dmy(c.final.date) : '') : 'विवेचनाधीन';
    const li = (L, n) => L.length ? '<ol>' + L.slice(0, n).map(x => `<li>${esc(x)}</li>`).join('') + (L.length > n ? `<li class="m">… ${L.length - n} और</li>` : '') + '</ol>' : '<p class="m">—</p>';
    const sec = r.secs.filter(s => s.state !== 'ok');
    const html = `<div class="pg"><div class="hd"><div class="t">संक्षिप्त प्रकरण आख्या</div><div class="s">थाना ${esc(c.ps || 'साइबर क्राइम')}${c.district ? ', ' + esc(c.district) : ''} · दिनांक ${new Date().toLocaleDateString('en-IN')}</div></div>
      <table class="k"><tr><th>मु0अ0सं0</th><td>${esc(f.no)}${f.date ? ' दिनांक ' + esc(f.date) : ''}</td><th>धारा</th><td>${esc(f.sections.join(', ') || c.section || '')}</td></tr>
      <tr><th>वादी</th><td>${esc(f.complainant || '')}${f.mobile ? ' (मो0 ' + esc(f.mobile) + ')' : ''}</td><th>घटना दिनांक</th><td>${esc(f.incident || '')}</td></tr>
      <tr><th>ठगी की धनराशि</th><td>${f.amount ? '₹ ' + Number(f.amount).toLocaleString('en-IN') : '—'}</td><th>विवेचक</th><td>${esc(c.io || r.io || '')}</td></tr>
      <tr><th>पर्चे</th><td>${r.L.length} (अन्तिम पर्चा ${r.cdc.last ? r.cdc.last.no + (r.cdc.last.prep ? ' दि0 ' + this.dmy(r.cdc.last.prep) : '') : '—'})${r.cdc.missing.length ? ' · अनुपलब्ध: ' + r.cdc.missing.join(', ') : ''}</td><th>स्थिति</th><td><b>${esc(fin)}</b></td></tr></table>
      <h2>1. एफआईआर का सार</h2><p>${esc(this.cut(f.tahrir || f.brief, 620))}</p>
      <h2>2. वादी का बयान</h2><p>${r.vic ? esc(this.cut(r.vic.text, 420)) + ` <span class="m">(पर्चा ${r.vic.cd})</span>` : '<span class="m">वादी का बयान पर्चों में नहीं मिला।</span>'}</p>
      <div class="two"><div><h2>3. प्राप्त विवरण (बैंक / टेलीकॉम / इंटरमीडियरी / अधीनस्थ)</h2>${li(got, 7)}</div><div><h2>4. लंबित बिन्दु</h2>${li(pend, 7)}</div></div>
      ${r.acc.cs.length ? `<p><b>आरोप पत्रित अभियुक्त:</b> ${r.acc.cs.map(esc).join(', ')}${r.acc.not.length ? ` · <b>संदिग्ध (आरोप पत्रित नहीं):</b> ${r.acc.not.length}` : ''}</p>` : ''}
      <h2>5. वर्तमान कार्यवाही</h2>${li(cur, 2)}
      <div class="two"><div><h2>6. आगामी कार्यवाही हेतु सुझाव</h2>${li(r.sugg.map(s => s.hi), 6)}</div><div><h2>7. धारा समीक्षा</h2>${sec.length ? '<ol>' + sec.slice(0, 5).map(s => `<li><b>${esc(s.sec)}</b> ${s.state === 'add' ? '(बढ़ाने पर विचार)' : '(पुनः जाँच)'} – ${esc(this.cut(s.why, 90))}</li>`).join('') + '</ol>' : '<p class="m">FIR की धाराएँ तथ्यों के अनुरूप प्रतीत होती हैं।</p>'}</div></div>
      <div class="sg"><div>दिनांक: ${new Date().toLocaleDateString('en-IN')}</div><div>(${esc(c.io || r.io || 'विवेचक')})<br>विवेचक, थाना ${esc(c.ps || 'साइबर क्राइम')}</div></div>
      <div class="ft">यह सारांश SudarshanAshtra द्वारा इसी कम्प्यूटर पर पर्चों से तैयार किया गया है – प्रस्तुत करने से पूर्व विवेचक द्वारा जाँच लें। धारा सुझाव केवल परामर्श हेतु।</div></div>`;
    const full = `<!DOCTYPE html><html lang="hi"><head><meta charset="utf-8"><title>संक्षिप्त प्रकरण आख्या – ${esc(f.no)}</title><style>
      @page{size:A4;margin:10mm 11mm} *{box-sizing:border-box} body{margin:0;font:10.6px/1.42 "Nirmala UI","Mangal","Noto Sans Devanagari","Segoe UI",Arial,sans-serif;color:#111;background:#e5e7eb}
      .pg{width:210mm;min-height:297mm;margin:10px auto;background:#fff;padding:10mm 11mm;box-shadow:0 2px 12px rgba(0,0,0,.2)} .hd{text-align:center;border-bottom:2.5px solid #1e3a8a;padding-bottom:4px;margin-bottom:6px}
      .hd .t{font-size:17px;font-weight:800;color:#1e3a8a;letter-spacing:.3px} .hd .s{font-size:11px;color:#333}
      table.k{width:100%;border-collapse:collapse;margin:4px 0 2px} .k th,.k td{border:1px solid #9ca3af;padding:2.5px 5px;text-align:left;vertical-align:top} .k th{background:#eef2ff;width:13%;white-space:nowrap;font-weight:700}
      h2{font-size:11.6px;margin:7px 0 2px;color:#1e3a8a;border-bottom:1px solid #c7d2fe;padding-bottom:1px} p{margin:2px 0;text-align:justify} ol{margin:2px 0 2px 16px;padding:0} li{margin:1px 0}
      .two{display:grid;grid-template-columns:1fr 1fr;gap:10px} .m{color:#666} .sg{display:flex;justify-content:space-between;margin-top:14px;font-weight:700} .sg div:last-child{text-align:center}
      .ft{margin-top:8px;font-size:9px;color:#666;border-top:1px dashed #bbb;padding-top:3px} .np{text-align:center;margin:8px} .np button{font-size:14px;padding:6px 16px}
      @media print{body{background:#fff}.pg{margin:0;box-shadow:none;width:auto;min-height:0;padding:0}.np{display:none}}</style></head><body><div class="np"><button onclick="print()">🖨 Print / Save As PDF (A4)</button></div>${html}</body></html>`;
    this.out(full, mode, 'Short_Report');
  },
  /* view / pdf (print → Save as PDF) / word / html */
  out(full, mode, nm, w) {
    const clean = () => full.replace(/<div class="np">[\s\S]*?<\/div>/, '');
    if (mode === 'doc') return this.save(clean().replace('.pg{width:210mm;', '.pg{').replace(/min-height:297mm;?/, ''), 'application/msword', nm + '.doc');
    if (mode === 'html') return this.save(full, 'text/html', nm + '.html');
    w = w || window.open('', '_blank'); if (!w) { UI.toast('Pop-up blocked. Allow pop-ups for this page.'); return; }
    w.document.open(); w.document.write(mode === 'pdf' ? full.replace('<div class="np">', '<div class="np"><b style="display:block;margin-bottom:6px">In the print box choose “Save as PDF”, paper A4.</b>') : full); w.document.close();
    if (mode === 'pdf') setTimeout(() => { try { w.focus(); w.print(); } catch (e) { } }, 700);
  },

  /* ---------- deep brief report (Hindi, A4, several pages) ---------- */
  HI: { Received: 'प्राप्त', Asked: 'माँगा गया', 'Not Asked': 'नहीं माँगा', Pending: 'लंबित' },
  TH: { mobile: 'मोबाइल', account: 'बैंक खाता', url: 'वेब लिंक', upi: 'यूपीआई', other: 'अन्य' },
  NH: { mobile: 'सीडीआर / सीएएफ / आईपीडीआर, व्हाट्सएप / टेलीग्राम आईपी लॉग', account: 'केवाईसी, स्टेटमेंट, लिंक्ड मोबाइल / आईपी, होल्ड / लियन', url: 'WHOIS, होस्टिंग, पेमेंट गेटवे, सर्वर आईपी', upi: 'यूपीआई केवाईसी व लिंक्ड खाता', other: 'विवरण' },
  async deep(mode) {
    const w = mode === 'doc' || mode === 'html' ? null : window.open('', '_blank'); if (!w && mode !== 'doc' && mode !== 'html') { UI.toast('Pop-up blocked. Allow pop-ups for this page.'); return; }
    if (w) w.document.write('<p style="font:16px sans-serif;padding:30px">विस्तृत आख्या तैयार हो रही है…</p>');
    const c = activeCase(), r = this.analyse(), f = r.fir, E = esc, today = new Date().toLocaleDateString('en-IN');
    const sc = s => `<span class="st ${s === 'Received' ? 'g' : s === 'Asked' ? 'w' : 'b'}">${this.HI[s] || s}</span>`;
    const fin = c.final ? ({ CS: 'आरोप पत्र', PPI: 'आरोप पत्र – अग्रिम विवेचना लंबित (PPI)', FR: 'अंतिम रिपोर्ट' })[c.final.type] + (c.final.no ? ' सं0 ' + c.final.no : '') + (c.final.date ? ' दिनांक ' + this.dmy(c.final.date) : '') + (c.final.frType ? ' (' + c.final.frType + ')' : '') : 'विवेचनाधीन';
    const nAcc = f.items.filter(i => i.type === 'account').length, nMob = f.items.filter(i => i.type === 'mobile').length, nWeb = f.items.filter(i => i.type === 'url').length;
    const got = r.items.filter(i => i.status === 'Received'), ask = r.items.filter(i => i.status === 'Asked'), nas = r.items.filter(i => i.status === 'Not Asked' && i.nt), kyc = r.items.filter(i => i.kyc), ips = r.items.filter(i => i.ip);
    const pA = r.agencies.filter(a => a.status === 'Pending');
    // cross-case links
    let cross = [];
    try { if (S.cases.length > 1 && typeof Dash2 !== 'undefined') { await Dash2.others(() => { }); for (const g of Dash2.groups().values()) { const oc = Dash2.inOthers(g.key); if (oc.length) cross.push({ type: g.type, value: g.value, cases: oc.map(x => x.c.name) }); } } } catch (e) { }
    cross = cross.sort((a, b) => b.cases.length - a.cases.length).slice(0, 25);
    const sum = [
      `यह अभियोग ${f.incident ? 'दिनांक ' + f.incident + ' के मध्य घटित ' : ''}${f.amount ? '₹ ' + Number(f.amount).toLocaleString('en-IN') + ' की ' : ''}साइबर ठगी से सम्बन्धित है, जो ${f.complainant ? 'वादी ' + f.complainant + ' की ' : ''}तहरीर पर धारा ${f.sections.join(', ') || c.section || '—'} में पंजीकृत है।`,
      `एफआईआर में ${f.items.length} बिन्दु नामित हैं${f.items.length ? ` (${[nMob && nMob + ' मोबाइल', nAcc && nAcc + ' बैंक खाते', nWeb && nWeb + ' वेब लिंक'].filter(Boolean).join(', ')})` : ''}; इनमें से ${got.length} का विवरण प्राप्त, ${ask.length} माँगे गए (जवाब लंबित) तथा ${nas.length} अभी माँगे नहीं गए हैं।`,
      kyc.length ? `केवाईसी से ${kyc.length} खाताधारक ज्ञात हुए: ${kyc.slice(0, 6).map(i => i.kyc).join(', ')}${kyc.length > 6 ? ' आदि' : ''}।` : '',
      ips.length ? `${ips.length} मोबाइल नम्बरों के आईपी प्राप्त${r.foreign.length ? ', जो विदेश (' + r.foreign.slice(0, 3).join(', ') + ') के पाए गए' : ''}।` : '',
      r.acc.cs.length ? `आरोप पत्रित अभियुक्त: ${r.acc.cs.join(', ')}${r.acc.not.length ? '; संदिग्ध (आरोप पत्रित नहीं): ' + r.acc.not.length : ''}।` : '',
      `अब तक ${r.L.length} पर्चे काटे गए${r.cdc.last ? ', अन्तिम पर्चा ' + r.cdc.last.no + (r.cdc.last.prep ? ' दिनांक ' + this.dmy(r.cdc.last.prep) : '') : ''}। वर्तमान स्थिति: ${fin}।`,
      pA.length ? `${pA.length} संस्थाओं से जवाब लंबित है (${pA.slice(0, 4).map(a => a.hi).join(', ')}${pA.length > 4 ? ' आदि' : ''})।` : '',
      cross.length ? `इस प्रकरण के ${cross.length} पहचानकर्ता (मोबाइल / खाता / आईपी आदि) आपके अन्य प्रकरणों में भी मिले हैं – संयुक्त विवेचना हेतु देखें।` : ''
    ].filter(Boolean);
    const tbl = (head, rows, cls = '') => rows.length ? `<table class="t ${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="m">—</p>';
    const H = [];
    H.push(`<div class="hd"><div class="t">विस्तृत प्रकरण आख्या (डीप ब्रीफ)</div><div class="s">थाना ${E(c.ps || 'साइबर क्राइम')}${c.district ? ', ' + E(c.district) : ''} · मु0अ0सं0 ${E(f.no)} · दिनांक ${today}</div></div>`);
    H.push(`<table class="k"><tr><th>मु0अ0सं0 / दिनांक</th><td>${E(f.no)}${f.date ? ' · ' + E(f.date) : ''}</td><th>धारा</th><td>${E(f.sections.join(', ') || c.section || '')}</td></tr>
      <tr><th>वादी</th><td>${E(f.complainant || '')}${f.mobile ? ' (मो0 ' + E(f.mobile) + ')' : ''}</td><th>घटना / सूचना दिनांक</th><td>${E(f.incident || '—')}${f.info ? ' / ' + E(f.info) : ''}</td></tr>
      <tr><th>ठगी की धनराशि</th><td>${f.amount ? '₹ ' + Number(f.amount).toLocaleString('en-IN') : '—'}</td><th>विवेचक</th><td>${E(c.io || r.io || '')}</td></tr>
      <tr><th>पर्चे</th><td>${r.L.length} · अन्तिम ${r.cdc.last ? r.cdc.last.no + (r.cdc.last.prep ? ' (' + this.dmy(r.cdc.last.prep) + ')' : '') : '—'}${r.cdc.missing.length ? ' · <b class="r">अनुपलब्ध: ' + r.cdc.missing.join(', ') + '</b>' : ''}</td><th>स्थिति</th><td><b>${E(fin)}</b></td></tr></table>`);
    H.push(`<div class="kp"><div><b>${f.items.length}</b>एफआईआर में नामित</div><div class="g"><b>${got.length}</b>विवरण प्राप्त</div><div class="w"><b>${ask.length}</b>जवाब लंबित</div><div class="b"><b>${nas.length}</b>अभी नहीं माँगे</div><div><b>${kyc.length}</b>खाताधारक ज्ञात</div><div><b>${r.sugg.length}</b>सुझाव</div></div>`);
    H.push(`<h2>1. कार्यकारी सारांश</h2><ol>${sum.map(x => `<li>${E(x)}</li>`).join('')}</ol>`);
    H.push(`<h2>2. एफआईआर का सार (नकल तहरीर)</h2><p class="j">${E(this.cut(f.tahrir || f.brief, 3200)) || '<span class="m">एफआईआर की नकल तहरीर उपलब्ध पर्चों में नहीं मिली।</span>'}</p>`);
    H.push(`<h2>3. वादी का बयान${r.vic ? ` <small>(पर्चा ${r.vic.cd})</small>` : ''}</h2><p class="j">${r.vic ? E(this.cut(r.vic.text, 2200)) : '<span class="m">वादी का बयान उपलब्ध पर्चों में नहीं मिला।</span>'}</p>`);
    H.push(`<h2>4. एफआईआर में नामित बिन्दु – आवश्यक / प्राप्त / लंबित</h2>` + tbl(['क्र0', 'प्रकार', 'विवरण', 'आवश्यक', 'किससे', 'स्थिति', 'प्राप्त विवरण', 'पर्चा'],
      r.items.map((i, k) => [k + 1, this.TH[i.type] || i.type, `<b class="mo">${E(i.value)}</b>`, E(this.NH[i.type] || ''), E(i.fromHi || i.from), sc(i.status) + (i.age ? `<br><small class="r">${i.age} दिन</small>` : ''), E([i.kyc && 'खाताधारक: ' + i.kyc, i.ip && 'आईपी: ' + i.ip].filter(Boolean).join(' · ') || (i.got ? this.cut(i.got.s, 110) : i.ask ? 'माँगा: ' + this.cut(i.ask.s, 90) : '—')), i.got ? i.got.cd : i.ask ? i.ask.cd : '—']), 'sm'));
    if (kyc.length) H.push(`<h2>5. मनी ट्रेल – ज्ञात खाताधारक</h2>` + tbl(['क्र0', 'खाता संख्या', 'बैंक', 'खाताधारक', 'पर्चा', 'आगामी कार्यवाही'], kyc.map((i, k) => [k + 1, `<b class="mo">${E(i.value)}</b>`, E(i.bank || '—'), `<b>${E(i.kyc)}</b>`, i.got ? i.got.cd : '', 'पते का सत्यापन, धारा 35(3) बीएनएसएस नोटिस / गिरफ्तारी, स्टेटमेंट से आगे की लेयर'])));
    H.push(`<h2>${kyc.length ? 6 : 5}. संस्थावार पत्राचार (बैंक / टेलीकॉम / इंटरमीडियरी / I4C / अधीनस्थ)</h2>` + tbl(['संस्था / व्यक्ति', 'स्थिति', 'माँगा (पर्चा)', 'प्राप्त (पर्चा)', 'लंबित', 'अन्तिम प्रविष्टि'],
      r.agencies.map(a => [`<b>${E(a.hi)}</b>`, sc(a.status), E(uniq(a.ask.map(e => e.cd)).join(', ') || '—'), E(uniq(a.got.map(e => e.cd)).join(', ') || '—'), a.age ? `<b class="r">${a.age} दिन</b>` : '—', E(a.last ? this.cut(a.last.s, 150) : '')]), 'sm'));
    let n = kyc.length ? 7 : 6;
    if (r.acc.cs.length || r.acc.not.length || r.stm.length) H.push(`<h2>${n++}. अभियुक्त व अंकित बयान</h2>${r.acc.cs.length ? `<p><b>आरोप पत्रित अभियुक्त:</b> ${r.acc.cs.map(E).join(', ')}</p>` : ''}${r.acc.not.length ? `<p><b>संदिग्ध (आरोप पत्रित नहीं):</b> ${r.acc.not.length} – ${r.acc.not.slice(0, 8).map(E).join('; ')}</p>` : ''}` + (r.stm.length ? tbl(['पर्चा', 'बयान', 'सार'], r.stm.map(x => [x.cd, E(x.who), E(this.cut(x.text, 220))]), 'sm') : ''));
    H.push(`<h2>${n++}. पर्चावार कार्यवाही</h2>` + tbl(['पर्चा', 'दिनांक', 'की गई कार्यवाही'], r.L.map(l => [`<b>${l.no || '?'}</b>${l.fileNo && l.fileNo !== l.no ? `<br><small class="r">फाइल: ${l.fileNo}</small>` : ''}`, this.dmy(l.prep) || '—', E(this.cut(l.body, 420))]), 'sm cd'));
    const cc = r.cdc; H.push(`<h2>${n++}. पर्चा क्रमांक जाँच</h2><p>${cc.max ? `पर्चा 1 से ${cc.max}: ${cc.missing.length ? `<b class="r">अनुपलब्ध – ${cc.missing.join(', ')}</b>` : '<b class="gt">कोई अन्तर नहीं</b>'}${cc.dup.length ? ` · दो बार – ${cc.dup.join(', ')}` : ''}${cc.mismatch.length ? ` · फाइल नाम व अन्दर का क्रमांक भिन्न – ${cc.mismatch.map(l => E(l.x.file) + ' (अन्दर ' + l.no + ')').join('; ')}` : ''}${cc.bad.length ? ` · दिनांक जाँचें – पर्चा ${cc.bad.map(l => l.no + ' (' + this.dmy(l.prep) + ')').join(', ')}` : ''}` : '—'}</p>`);
    H.push(`<h2>${n++}. धारा समीक्षा <small>(परामर्श मात्र – अंतिम निर्णय विवेचक / अभियोजन का)</small></h2>` + tbl(['धारा', 'विवरण', 'स्थिति', 'आधार'], r.secs.map(x => [`<b>${E(x.sec)}</b>`, E(x.hi), x.state === 'ok' ? '<span class="st g">एफआईआर में दर्ज</span>' : x.state === 'review' ? '<span class="st w">पुनः जाँचें</span>' : '<span class="st b">बढ़ाने पर विचार</span>', E(x.why)]), 'sm'));
    const pend = [...nas.map(i => `${i.value} (${this.TH[i.type]}) – अभी माँगा नहीं गया – ${i.fromHi || i.from}`), ...ask.map(i => `${i.value} – पर्चा ${i.ask.cd} में माँगा, ${i.age} दिन से लंबित – ${i.fromHi || i.from}`), ...pA.map(a => `${a.hi} – पर्चा ${a.last.cd} से जवाब लंबित (${a.age} दिन)`)];
    H.push(`<h2>${n++}. लंबित बिन्दु</h2>${pend.length ? '<ol>' + pend.map(x => `<li>${E(x)}</li>`).join('') + '</ol>' : '<p class="gt">कोई बिन्दु लंबित नहीं।</p>'}`);
    if (cross.length) H.push(`<h2>${n++}. अन्य प्रकरणों से सम्बन्ध (कॉमन संदिग्ध)</h2>` + tbl(['प्रकार', 'पहचानकर्ता', 'अन्य प्रकरण'], cross.map(x => [E(x.type), `<b class="mo">${E(x.value)}</b>`, E(x.cases.join(', '))]), 'sm'));
    H.push(`<h2>${n++}. आगामी कार्यवाही हेतु सुझाव</h2>${r.sugg.length ? '<ol>' + r.sugg.map(x => `<li>${E(x.hi)}</li>`).join('') + '</ol>' : '<p class="m">—</p>'}`);
    H.push(`<div class="sg"><div>दिनांक: ${today}</div><div>(${E(c.io || r.io || 'विवेचक')})<br>विवेचक, थाना ${E(c.ps || 'साइबर क्राइम')}</div></div><div class="ft">यह आख्या SudarshanAshtra द्वारा इसी कम्प्यूटर पर पर्चों, एफआईआर व आरोप पत्र / अंतिम रिपोर्ट से तैयार की गई है – प्रस्तुत करने से पूर्व विवेचक द्वारा जाँच लें। धारा सुझाव केवल परामर्श हेतु।</div>`);
    const full = `<!DOCTYPE html><html lang="hi"><head><meta charset="utf-8"><title>विस्तृत प्रकरण आख्या – ${E(f.no)}</title><style>
      @page{size:A4;margin:11mm 10mm 12mm} *{box-sizing:border-box} body{margin:0;font:10.8px/1.5 "Nirmala UI","Mangal","Noto Sans Devanagari","Segoe UI",Arial,sans-serif;color:#111;background:#e5e7eb}
      .pg{width:210mm;margin:10px auto;background:#fff;padding:11mm 10mm;box-shadow:0 2px 12px rgba(0,0,0,.2)}
      .hd{text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:5px;margin-bottom:7px}.hd .t{font-size:18px;font-weight:800;color:#1e3a8a}.hd .s{font-size:11.5px;color:#333}
      table{width:100%;border-collapse:collapse;margin:4px 0} th,td{border:1px solid #9ca3af;padding:3px 5px;text-align:left;vertical-align:top} .k th{background:#eef2ff;width:15%;white-space:nowrap}
      .t th{background:#1e3a8a;color:#fff;font-weight:700;font-size:10.5px} .t tr:nth-child(even) td{background:#f8fafc} .sm td{font-size:10px} .cd td:first-child,.cd td:nth-child(2){white-space:nowrap}
      thead{display:table-header-group} tr{break-inside:avoid} h2{font-size:12.5px;margin:11px 0 3px;color:#fff;background:#1e3a8a;padding:3px 8px;border-radius:3px;break-after:avoid} h2 small{font-weight:400;opacity:.85}
      p{margin:3px 0} .j{text-align:justify;border-left:3px solid #c7d2fe;padding-left:7px} ol{margin:3px 0 3px 18px;padding:0} li{margin:2px 0}
      .kp{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin:7px 0}.kp div{border:1px solid #c7d2fe;border-radius:6px;text-align:center;padding:4px;font-size:10px;background:#f5f7ff}.kp b{display:block;font-size:17px;color:#1e3a8a}
      .kp .g b{color:#047857}.kp .w b{color:#b45309}.kp .b b{color:#b91c1c}
      .st{display:inline-block;padding:0 6px;border-radius:9px;font-weight:700;font-size:9.5px;white-space:nowrap}.st.g{background:#d1fae5;color:#065f46}.st.w{background:#fef3c7;color:#92400e}.st.b{background:#fee2e2;color:#991b1b}
      .r{color:#b91c1c}.gt{color:#047857}.m{color:#666}.mo{font-family:Consolas,monospace;word-break:break-all}
      .sg{display:flex;justify-content:space-between;margin-top:22px;font-weight:700;break-inside:avoid}.sg div:last-child{text-align:center}.ft{margin-top:8px;font-size:9px;color:#666;border-top:1px dashed #bbb;padding-top:3px}
      .np{text-align:center;margin:8px}.np button{font-size:14px;padding:6px 16px}
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact} @media print{body{background:#fff}.pg{margin:0;box-shadow:none;width:auto;padding:0}.np{display:none}}</style></head><body><div class="np"><button onclick="print()">🖨 Print / Save As PDF (A4)</button></div><div class="pg">${H.join('\n')}</div></body></html>`;
    this.out(full, mode, 'Deep_Brief_Report', w);
  },

  fname(ext) { const c = activeCase(); return ('FIR_' + (this.analyse().fir.no || c.name || 'case')).replace(/[^\w\-]+/g, '_') + '_' + ext; },
  save(data, type, ext) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff', data], { type })); a.download = this.fname(ext); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); UI.toast('Saved ' + a.download); },
  excel() {
    if (typeof XLSX === 'undefined') return UI.toast('Excel library not loaded');
    const c = activeCase(), r = this.analyse(), f = r.fir, wb = XLSX.utils.book_new(), add = (n, rows) => { if (rows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), n); };
    add('Case Summary', [['FIR No.', f.no], ['FIR Date', f.date], ['Sections', f.sections.join(', ') || c.section || ''], ['Complainant', f.complainant], ['Complainant Mobile', f.mobile], ['Incident', f.incident], ['Amount', f.amount || ''], ['IO', c.io || r.io], ['Status', c.final ? (c.final.type === 'PPI' ? 'CS-PPI' : c.final.type) + ' ' + (c.final.no || '') + ' ' + this.dmy(c.final.date || '') : 'Under Investigation'], ['CD Parts', r.L.length], ['Last CD', r.cdc.last ? r.cdc.last.no : ''], ['Missing CD', r.cdc.missing.join(', ')], ['Accused Charge-Sheeted', r.acc.cs.join(', ')]].map(([Field, Value]) => ({ Field, Value })));
    add('FIR Items', r.items.map((i, k) => ({ 'S.No.': k + 1, Type: i.type, 'Named In FIR': i.value, Required: i.need, 'From Whom': i.from, Status: i.status, 'Pending Days': i.age || '', 'Account Holder (KYC)': i.kyc, IP: i.ip, 'CD': i.got ? i.got.cd : i.ask ? i.ask.cd : '', Detail: i.got ? i.got.s : i.ask ? i.ask.s : '' })));
    add('Agencies', r.agencies.map(a => ({ 'Agency / Person': a.en, Status: a.status, 'Asked In CD': uniq(a.ask.map(e => e.cd)).join(', '), 'Received In CD': uniq(a.got.map(e => e.cd)).join(', '), 'Pending Days': a.age || '', 'Latest Entry': a.last ? a.last.s : '' })));
    add('Case Diary', r.L.map(l => ({ 'CD No.': l.no, 'File Says CD': l.fileNo || '', Date: this.dmy(l.prep), 'Work Done': this.cut(l.body, 3000), File: l.x.file })));
    add('Section Check', r.secs.map(x => ({ Section: x.sec, Meaning: x.hi, Check: x.state === 'ok' ? 'In FIR' : x.state === 'review' ? 'Review' : 'Consider Adding', Reason: x.why })));
    add('Suggestions', r.sugg.map((x, k) => ({ 'S.No.': k + 1, Suggestion: x.en, 'सुझाव': x.hi })));
    add('Statements', r.stm.map(x => ({ CD: x.cd, Statement: x.who, Text: this.cut(x.text, 3000) })));
    XLSX.writeFile(wb, this.fname('Case_Analysis.xlsx')); UI.toast('Excel saved');
  },
  exportMenu(btn) {
    const old = $('.cdx-menu'); if (old) { old.remove(); return; }
    const m = document.createElement('div'); m.className = 'cdx-menu';
    const F = [['pdf', '📕 PDF'], ['doc', '📝 Word'], ['html', '🌐 HTML'], ['view', '👁 View']];
    m.innerHTML = [['short', '🖨', 'Hindi Case Short Report', 'One A4 page for senior officers'], ['deep', '🖨', 'Hindi Case Deep Brief Report', 'Full brief – every identifier, agency, CD and section']]
      .map(([k, i, t, d]) => `<div class="cdx-mr"><span class="ic">${i}</span><div class="grow"><b>${t}</b><small>${d}</small><div class="cdx-fm">${F.map(([f, l]) => `<button data-ex="${k}" data-f="${f}">${l}</button>`).join('')}</div></div></div>`).join('')
      + `<div class="cdx-mr"><span class="ic">📊</span><div class="grow"><b>Case Analysis Excel</b><small>FIR items, agencies, CD-wise work, sections, suggestions</small><div class="cdx-fm"><button data-ex="xls" data-f="xlsx">📊 Excel (XLSX)</button></div></div></div>`;
    document.body.appendChild(m); const b = btn.getBoundingClientRect(); m.style.top = (b.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(b.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
    const close = e => { if (!m.contains(e.target) && e.target !== btn) { m.remove(); document.removeEventListener('mousedown', close); } }; setTimeout(() => document.addEventListener('mousedown', close));
    $$('[data-ex]', m).forEach(x => x.onclick = () => { m.remove(); document.removeEventListener('mousedown', close); const k = x.dataset.ex, f = x.dataset.f; if (k === 'short') this.report(f); else if (k === 'deep') this.deep(f); else this.excel(); });
  },

  /* ---------- import ---------- */
  importUI() {
    const b = UI.modal('📦 Import CCTNS Case (Zip / Folder)', `<p>Choose the CCTNS case <b>zip</b> (e.g. <span class="mono">FIR-0123-2026-PS-CCPS-GZB-FR.zip</span>) or the case <b>folder</b>. You can pick many zips at once – each FIR goes into its own case.</p>
      <ul class="small"><li>Reads the FIR, every case-diary part (CD 1, CD 2 …), CS / CS-PPI / FR and other documents.</li><li>Scanned PDFs are read with the built-in Hindi + English OCR, on this computer (about 2 seconds a page). Nothing is uploaded.</li><li>CD numbers are taken from inside the CD and checked against the file name.</li><li>The case is found by its FIR number, or a new case is created.</li></ul>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn primary" id="cxZ">📦 Choose Zip File(s)</button><button class="btn" id="cxF">📁 Choose Folder</button><button class="btn" id="cxP">📄 Choose PDFs</button></div>
      <input type="file" id="cxZi" class="hidden" multiple accept=".zip"><input type="file" id="cxFi" class="hidden" webkitdirectory multiple><input type="file" id="cxPi" class="hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx">`, [{ label: 'Close', onClick: UI.closeModal }]);
    const go = async (files, folder) => { const E = []; try { for (const f of files) { if (/\.zip$/i.test(f.name)) E.push(...await this.unzip(await f.arrayBuffer(), f.name.replace(/\.zip$/i, ''))); else E.push({ path: folder ? (f.webkitRelativePath || f.name) : f.name, file: f }); } } catch (e) { UI.toast('Could not open: ' + e.message, 6000); return; } UI.closeModal(); this.run(E); };
    [['#cxZ', '#cxZi', 0], ['#cxF', '#cxFi', 1], ['#cxP', '#cxPi', 0]].forEach(([bt, inp, fo]) => { const i = $(inp, b); $(bt, b).onclick = () => { i.value = ''; i.click(); }; i.onchange = () => go([...i.files], fo); });
  },
  async run(E) {
    E = E.filter(e => /\.(pdf|png|jpe?g|webp|bmp|txt|docx?|odt|rtf)$/i.test(e.file.name));
    if (!E.length) return UI.toast('No PDF / document found in what you chose', 5000);
    const G = new Map(); for (const e of E) { const m = this.meta(e.path); const k = m ? m.fir : '_'; if (!G.has(k)) G.set(k, { m, E: [] }); G.get(k).E.push(e); }
    let stop = false, done = 0; const tot = E.length, t0 = Date.now();
    const b = UI.modal('Reading CCTNS case files…', `<div id="cxM" class="small"></div><div class="cc-bar" style="margin:10px 0"><i id="cxB" style="width:0%"></i></div><div id="cxL" class="small muted" style="max-height:180px;overflow:auto"></div>`, [{ label: 'Stop', cls: 'danger', onClick: () => { stop = true; } }]);
    const msg = (t, pg) => { const el = $('#cxM', b); if (el) el.innerHTML = t + (pg ? ` · page ${pg[0]} of ${pg[1]}` : ''); const bar = $('#cxB', b); if (bar) bar.style.width = Math.round(done / tot * 100) + '%'; };
    const log = t => { const el = $('#cxL', b); if (el) el.insertAdjacentHTML('afterbegin', `<div>${t}</div>`); };
    const res = []; let firstId = null;
    const ALL = [...G.values()].flatMap(g => g.E), RD = this.readMany(ALL.map(e => e.file), d => { const el = $('#cxM', b); if (el) el.innerHTML = this.bar(d, tot, t0); const bb = $('#cxB', b); if (bb) bb.parentElement.style.display = 'none'; }); let ri = 0;
    for (const [k, g] of G) {
      if (stop) break; const items = [];
      for (const e of g.E) { if (stop) break; const nm = e.file.name;
        const rr = await RD[ri++]; let t = rr.t || ''; if (rr.err) log('⚠ ' + esc(nm) + ': ' + esc(rr.err));
        done++; const kd = this.kind(nm, t, g.m && g.m.fin); items.push({ e, t, kd }); log(`${t.trim() ? '✔' : '⚠ no text'} ${esc(nm)} → ${kd.k === 'cd' ? 'CD ' + (this.cdNo(t, nm).no || '?') : kd.k === 'fin' ? kd.type : kd.k.toUpperCase()}`); }
      if (items.length && !g.m) { const cnt = {}; for (const it of items) { const f = this.firOf(it.t); if (f) cnt[f] = (cnt[f] || 0) + 1; } const best = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0];
        if (best) { const [no, year] = best.split('/'); const fk = items.find(it => it.kd.k === 'fin'); g.m = { no, year, fir: best, ps: (items.map(it => (it.t.match(/\(थाना\)\s*:\s*([^\n]{3,60})/) || [])[1]).find(Boolean) || '').trim(), dist: '', fin: fk ? fk.kd.type : '' }; } }
      if (items.length) { const id = await this.apply(g, items); firstId = firstId || id; res.push(id); }
    }
    await saveMeta(); typeof fillCaseSel === 'function' && fillCaseSel(); Analysis.invalidate(); this._m = null;
    UI.closeModal(); UI.toast(`${done} file(s) read into ${res.length} case(s)${stop ? ' (stopped)' : ''}`, 6000);
    if (firstId && firstId !== S.caseId) await switchCase(firstId); else render();
  },
  async apply(g, items, caseId) {
    const m = g.m; let c = caseId ? S.cases.find(x => x.id === caseId) : m ? S.cases.find(x => this.firKey(x.fir || x.name) === this.firKey(m.fir)) : activeCase();
    if (!c || !c.id) { c = { id: uid(), created: new Date().toISOString(), status: 'Under investigation', name: `FIR ${m.fir}${m.ps && m.ps.length <= 12 ? ' · PS ' + m.ps : /साइबर\s*क्राइम/.test(m.ps || '') ? ' · PS CCPS' : ''}${m.dist ? ' · ' + m.dist : ''}`, fir: m.fir, ps: m.ps, district: m.dist === 'GZB' ? 'Ghaziabad' : m.dist }; S.cases.push(c); await DB.set('case:' + c.id, emptyCase()); }
    const cur = c.id === S.caseId, d = cur ? S.data : Object.assign(emptyCase(), await DB.get('case:' + c.id) || {});
    const st = d.cctns = d.cctns || {}; st.cd = st.cd || []; st.docs = st.docs || []; st.notices = st.notices || []; st.flags = st.flags || {}; d.idents = d.idents || [];
    const have = new Set(d.idents.map(i => i.type + '|' + i.value + '|' + i.source));
    const ids = (t, src) => { for (const x of extractIdentifiers(t)) if (!have.has(x.type + '|' + x.value + '|' + src)) { have.add(x.type + '|' + x.value + '|' + src); d.idents.push({ id: uid(), ...x, source: src }); } };
    let fin = m && m.fin ? { type: m.fin } : null;
    for (const { e, t, kd } of items) {
      const nm = e.file.name, when = new Date().toISOString(); if (!t.trim()) { st.docs = st.docs.filter(x => x.file !== nm); st.docs.push({ id: uid(), file: nm, kind: 'Unreadable file', text: '', when }); continue; }
      if (kd.k === 'cd') { const n = this.cdNo(t, nm); st.cd = st.cd.filter(x => x.file !== nm); st.cd.push({ id: uid(), no: n.no, fileNo: n.fileNo, date: this.prep(t), file: nm, text: t, when, src: 'CCTNS' }); ids(t, 'Case diary · CD ' + (n.no || '?')); }
      else if (kd.k === 'fir') { st.fir = { file: nm, text: t, when }; ids(t, 'FIR · ' + nm); }
      else if (kd.k === 'fin') { st.docs = st.docs.filter(x => x.file !== nm); st.docs.push({ id: uid(), file: nm, kind: kd.type === 'FR' ? 'Final Report (FR)' : 'Charge Sheet (' + (kd.type === 'PPI' ? 'CS-PPI' : 'CS') + ')', text: t.slice(0, 2e6), when }); ids(t, (kd.type === 'FR' ? 'FR' : 'CS') + ' · ' + nm);
        const fi = this.finInfo(t, kd.type); if (!fin || !fin.no || kd.type === fin.type) fin = { ...(fin || {}), type: (fin && fin.type) || kd.type, ...Object.fromEntries(Object.entries(fi).filter(([k, v]) => v && !(fin && fin[k]))) }; }
      else { st.docs = st.docs.filter(x => x.file !== nm); st.docs.push({ id: uid(), file: nm, kind: 'Document', text: t.slice(0, 2e6), when }); ids(t, 'Document · ' + nm); }
    }
    st.cd.sort((a, b) => (+a.no || 999) - (+b.no || 999));
    const S0 = S.data, C0 = S.caseId; S.data = d; S.caseId = c.id; this._m = null; let r; try { r = this.analyse(d, c); } finally { S.data = S0; S.caseId = C0; this._m = null; }
    if (!st.fir || st.fir.auto) { const l = r.L[0]; if (l) st.fir = { file: 'From CD ' + (l.no || 1) + ' (नकल तहरीर)', text: [r.fir.brief, r.fir.tahrir].filter(Boolean).join('\n\n'), when: new Date().toISOString(), auto: true }; }
    if (!c.fir && r.fir.no) c.fir = r.fir.no; if (!c.section && r.fir.sections.length) c.section = r.fir.sections.join(', '); if (!c.io && r.io) c.io = r.io;
    if (fin && fin.type && (!c.final || c.final.auto)) { c.final = { type: fin.type, no: fin.no || '', date: fin.date || '', sections: c.section || '', frType: fin.type === 'FR' ? fin.frType || '' : '', auto: true, at: new Date().toISOString(), note: 'Read from the CCTNS files' }; c.status = fin.type === 'PPI' ? 'Charge-sheet filed (PPI)' : fin.type === 'CS' ? 'Charge-sheet filed' : 'Final report filed'; }
    if (cur) saveCase(); else await DB.set('case:' + c.id, d);
    return c.id;
  },
  firOf(t) { t = this.dg(t).slice(0, 2500); const m = t.match(/प्र\.?\s*सू\.?\s*रि\.?\s*सं[^:\n]{0,8}:\s*0*(\d{1,5})[\s\S]{0,60}?\d{1,2}\/\d{1,2}\/(20\d\d)/) || t.match(/मु0?\s*अ0?\s*सं0?\s*0*(\d{1,5})\s*\/\s*(20\d\d)/); return m ? m[1].padStart(4, '0') + '/' + m[2] : ''; },
  isPend(r) { return r.fin ? r.fin === 'PPI' : !/complet|closed|disposed|charge|final/i.test(r.status || ''); },
  gaps(cd) { const n = (cd || []).map(x => +x.no).filter(Boolean); if (!n.length) return ''; const mx = Math.max(...n), m = []; for (let i = 1; i <= mx; i++) if (!n.includes(i)) m.push(i); return m.join(', '); },
  lastNo(cd) { const n = (cd || []).map(x => +x.no).filter(Boolean); return n.length ? Math.max(...n) : ''; }
};

/* ---------- hook into the Case Diary page ---------- */
(() => {
  CDX.orig = { text: CCTNS.text, cdMeta: CCTNS.cdMeta, diary: CCTNS.diary };
  CCTNS.isPend = r => CDX.isPend(r);
  // scanned PDF / photo uploaded one by one → read with OCR
  CCTNS.text = async function (f) {
    let t = await CDX.orig.text.call(this, f);
    if (t.replace(/\s/g, '').length < 40 && /\.(pdf|png|jpe?g|webp|bmp)$/i.test(f.name) && (typeof OCR !== 'undefined')) { UI.toast('Scanned file – reading ' + f.name + ' with OCR on this computer…', 4000); try { t = await CDX.readFile(f); } catch (e) { } }
    return CDX.dg(t);
  };
  CCTNS.cdMeta = function (t, name) { const o = CDX.orig.cdMeta.call(this, t, name), n = CDX.cdNo(t, name), p = CDX.prep(t); return { no: n.no || o.no, date: p || o.date }; };
  CCTNS.diary = function (el) {
    const r = CDX.orig.diary.apply(this, arguments);
    try {
      CDX._m = null; CDX.glance(el);
      const bt = $('.cc-btns', el); if (bt && !$('#ccImpX', bt)) { ['#ccFir', '#ccCd', '#ccUp'].forEach(s => { const x = $(s, bt); if (x) x.remove(); }); bt.insertAdjacentHTML('afterbegin', '<button class="btn primary" id="ccImpX" title="One place for every file: CCTNS zip / folder, FIR, case-diary parts, CS / CS-PPI / FR, bank / telecom / NIC e-mail replies, statements, photos, money trail, CDR …">📥 Import / Upload</button>'); }
      if (typeof Dash2 !== 'undefined') {
        el.insertAdjacentHTML('beforeend', Dash2.commonHtml().replace('🔗 Common with your other cases', '🔗 Common Across Your Cases – FIR, NCRP, Money Trail, Bank, Telecom, Google, Email & Others').replace('Identifiers of this case that also appear in another case on this computer.', 'Every mobile, account, UPI, email, IP and link of this case (FIR, case diary, NCRP, money trail, bank / telecom / Google / NIC email replies, subordinates\' reports) that also appears in another of your cases – the common suspects.'));
        if (S.cases.length > 1) Dash2.others((i, t) => { const x = $('#d2Cc', el); if (x && x.classList.contains('muted')) x.textContent = `Checking your other cases… ${i} of ${t}`; }).then(() => { if (document.body.contains(el)) Dash2.drawCommon(el); }).catch(() => { });
      }
    } catch (e) { console.error(e); }
    return r;
  };
})();
