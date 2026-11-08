/* CAF Analysis: read SIM Customer Application Form PDFs (offline), turn them into a table,
   and find what many forms share: POS, POS agent, activation date, alternate number, user photo…
   Reads the Jio, Airtel and Vi (Vodafone Idea) e-KYC layouts, and simple "Label : Value" forms. */
const CAF = {
  // [key, label, label pattern for simple "Label : Value" forms] – first match wins, so specific labels come first
  F: [
    ['caf_no', 'CAF No', /\b(caf|application|form)\s*(no|number|id)\b/],
    ['pos_address', 'POS Address', /\b(pos|retailer|outlet|store|dealer|shop|point of sale)\b.*address/],
    ['pos_ucode', 'POS Unique ID', /\bpos\s*unique\s*(code|id)\b|global\s*id/],
    ['pos_mobile', 'POS Mobile', /\b(pos|retailer|dealer)\b.*\b(mobile|phone|contact)\b/],
    ['pos_code', 'POS Code', /\b(pos|retailer|outlet|store|dealer|shop|point of sale)\b.*\b(code|id|no)\b/],
    ['pos_name', 'POS Name', /\b(pos|retailer|outlet|store|dealer|shop|point of sale|distributor)\b/],
    ['pos_agent', 'POS Agent', /\b(agent|promoter|verifi\w*|sales\s*(person|executive)|fos|employee|staff|activated by|enrolled by)\b/],
    ['alt', 'Alternate Number', /\b(alternate|alternative|alt\.?|other|landline)\b.*\b(no|number|contact|mobile|phone)\b|\balternate\b/],
    ['mobile', 'Mobile', /\b(msisdn|mobile|allotted|connection|subscriber|cell|tel(ephone)?)\b.*\b(no|number)\b|^mobile$|^msisdn$/],
    ['act_time', 'Activation Time', /activation\s*time/],
    ['act_date', 'Activation Date', /activat|\bact\.?\s*date|date of (sale|issue)|\bsale date/],
    ['father', 'Father / Husband', /father|husband|guardian|\bs\s*\/\s*o\b|\bw\s*\/\s*o\b|\bd\s*\/\s*o\b|relative/],
    ['dob', 'Date of Birth', /birth|\bdob\b/],
    ['gender', 'Gender', /\b(gender|sex)\b/],
    ['email', 'Email', /e-?mail/],
    ['aadhaar', 'Aadhaar', /aadha?ar|\buid\b|\bvid\b/],
    ['poi_no', 'ID (POI) Number', /\b(poi|poa|id|identity|document|proof|pan|voter|epic|passport|licen[cs]e|dl)\b.*\b(no|number)\b/],
    ['poi_type', 'ID (POI) Type', /\b(poi|proof of identity|id proof|identity|document type|poa)\b/],
    ['address', 'Address', /address/],
    ['sim', 'SIM / ICCID', /iccid|\bsim\b/],
    ['imsi', 'IMSI', /\bimsi\b/],
    ['name', 'Customer Name', /\bname\b/]
  ],
  COMMON: [['pos_name', 'POS'], ['pos_code', 'POS code'], ['pos_ucode', 'POS unique ID'], ['pos_mobile', 'POS mobile'], ['pos_agent', 'POS agent'], ['act_date', 'Date of activation'], ['alt', 'Alternate number'], ['poi_no', 'ID number'], ['aadhaar', 'Aadhaar'], ['address', 'Address'], ['email', 'Email'], ['name', 'Customer name'], ['father', 'Father / Husband']],
  EDIT: ['mobile', 'name', 'father', 'alt', 'act_date', 'act_time', 'pos_name', 'pos_code', 'pos_ucode', 'pos_mobile', 'pos_agent', 'pos_address', 'dob', 'gender', 'address', 'aadhaar', 'poi_type', 'poi_no', 'email', 'caf_no', 'sim', 'imsi'],
  list() { return S.data.caf || (S.data.caf = []); },
  label(k) { return k === 'operator' ? 'Operator' : (this.F.find(f => f[0] === k) || [k, k])[1]; },
  norm(k, v) {
    v = String(v || '').replace(/\s+/g, ' ').trim();
    if (k === 'mobile' || k === 'alt' || k === 'pos_mobile') { const d = v.replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
    if (k === 'act_date' || k === 'dob') { const p = this.pdate(v); if (p) return p.d; const d = N.date(v.replace(/\s+\d{1,2}:\d{2}.*$/, '')); return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : ''; }
    if (k === 'email') { v = v.toLowerCase(); return /^[\w.+-]+@[\w-]+\.[\w.]+$/.test(v) && !/@(airtel|jio|vodafoneidea|myvi|vi|ril)\./.test(v) ? v : ''; }
    if (k === 'aadhaar') { const d = v.replace(/[^\dxX*]/g, ''); return d.length >= 4 ? d.toUpperCase() : ''; }
    return v.toUpperCase();
  },
  // a date written d/m/y, d-m-y, d:m:y, y-m-d or ddmmyyyy (box digits), with the time after it if any
  pdate(s) {
    s = String(s || ''); let m = s.match(/(?<!\d)(\d{1,2})[\/:.\-](\d{1,2})[\/:.\-]((?:19|20)\d{2})(?!\d)/), y, mo, d;
    if (m) [, d, mo, y] = m; else if ((m = s.match(/(?<!\d)((?:19|20)\d{2})-(\d{1,2})-(\d{1,2})(?!\d)/))) [, y, mo, d] = m; else if ((m = s.match(/(?<!\d)(\d{2})(\d{2})((?:19|20)\d{2})(?!\d)/))) [, d, mo, y] = m; else return null;
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
    const t = s.slice(m.index + m[0].length).match(/^\s*T?\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*([AP]M)?/i);
    return { d: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, t: t ? t[1] + (t[2] ? ' ' + t[2].toUpperCase() : '') : '' };
  },

  /* text lines of one page: items on the same row, with "  " where there is a visible gap */
  lines(tc) {
    const rows = [];
    for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const y = it.transform[5]; let r = rows.find(r => Math.abs(r.y - y) < 3); if (!r) rows.push(r = { y, it: [] }); r.it.push(it); }
    return rows.sort((a, b) => b.y - a.y).map(r => { r.it.sort((a, b) => a.transform[4] - b.transform[4]); let s = '', end = null; for (const i of r.it) { const x = i.transform[4]; if (end != null) s += x - end > 8 ? '  ' : x - end > 1.2 ? ' ' : ''; s += i.str; end = x + (i.width || i.str.length * 5); } return s.trim(); });
  },
  // forms print numbers in boxes: "9  8  1  1  …" → "9811…"
  prep(lines) { return lines.map(l => l.replace(/(?:\b[A-Z0-9] {1,3}){3,}[A-Z0-9]\b/g, m => { const t = m.replace(/ +/g, ''); return /\d.*\d/.test(t) || t.length >= 6 ? t : m; })); },

  /* the value after a label: rest of the same line, else the line(s) below (back: lines above).
     Only the first line with the label is used, unless all is set. */
  find(L, re, ok, o = {}) {
    for (let i = 0; i < L.length; i++) {
      const m = L[i].match(re); if (!m) continue;
      const c = [L[i].slice(m.index + m[0].length)];
      for (let b = 1; b <= (o.back || 0); b++) c.push(L[i - b] || '');
      for (let j = 1; j <= (o.look ?? 2); j++) c.push(L[i + j] || '');
      for (let k = 0; k < c.length; k++) {
        let s = c[k]; if (k > 0 && /\*/.test(s) && !o.star) continue;   // a line with "*" is another label
        s = s.replace(/^[\s*:：.\-–#]+/, ''); while (/^\(/.test(s)) s = s.replace(/^\([^)]*\)?\s*/, '').replace(/^[\s*:：.\-–#]+/, '');
        const v = ok(s); if (v) return v;
      }
      if (!o.all) break;
    }
    return '';
  },
  // an address block between two headings, without the printed field names
  block(L, start, end, max = 14) {
    const i = L.findIndex(l => start.test(l)); if (i < 0) return '';
    const LAB = /^(?:house|no|flat|building|apartment|street|streets|address|add|ress|village|road|name|ward|landmark|locality|tehsil|area|sector|city|district|town|state|ut|pin|code|pincode|co|do|so|wo|ho|of|customer|local|permanent|residential|installation|complete|the|as|received|from|uidai|within|service|for|individual|only|outstation|customers|ie|tick|applicable|relationship|place|pos|unique|response|date|time|and|details)+$/;
    const PRE = /^(?:house\s*no\.?\s*\/?\s*flat\s*no\.?(?:\s*\/\s*building\s*\/?\s*apartment)?|street\s*address\s*\/?\s*(?:village|road\s*name)?|locality\s*\/\s*tehsil|city\s*\/\s*district|area\s*\/\s*sector\s*\/\s*locality|village\s*\/\s*town\s*\/\s*city|landmark|state\s*\/\s*ut|district|pin\s*code)\s*/i;
    const out = [];
    for (let j = i + 1; j < Math.min(L.length, i + 1 + max); j++) {
      if (end.test(L[j])) return [...new Set(out)].join(', ').toUpperCase();
      for (const c of L[j].split(/\s{2,}/)) for (let p of (/^\d{4}-\d\d-\d\dT/.test(c) ? [] : c.split(/\s*:\s*/))) {
        p = p.replace(/\*/g, '').replace(PRE, '').trim();
        if (!p || /^[.,\-_]+$/.test(p) || /^\(.*\)$/.test(p) || /^\d{4}-\d\d-\d\dT/.test(p) || /^[0-9a-f]{32}$/i.test(p)) continue;
        const letters = p.toLowerCase().replace(/[^a-z]/g, ''); if (letters && LAB.test(letters)) continue;
        out.push(p);
      }
    }
    return '';
  },
  // Jio adds the UIDAI e-KYC reply (XML) to the PDF: name, birth date, gender, address, masked Aadhaar
  xml(t) {
    t = t.replace(/\n/g, ' '); const o = {}, at = s => { const r = {}; s.replace(/(\w+)\s*=\s*"([^"]*)"/g, (_, k, v) => { r[k] = v.trim(); }); return r; };
    let m = t.match(/<Poi\b([^>]*)>/); if (m) { const a = at(m[1]); if (a.name) o.name = a.name; if (a.dob) o.dob = a.dob; if (a.gender) o.gender = { M: 'MALE', F: 'FEMALE', T: 'TRANSGENDER' }[a.gender.toUpperCase()] || a.gender; }
    m = t.match(/<Poa\b([^>]*)>/); if (m) { const a = at(m[1]); const ad = ['co', 'house', 'street', 'lm', 'loc', 'vtc', 'po', 'subdist', 'dist', 'state', 'pc'].map(k => a[k]).filter(Boolean); if (ad.length) o.address = [...new Set(ad)].join(', '); }
    m = t.match(/<UidData\b[^>]*?\buid\s*=\s*"([^"]+)"/); if (m) o.aadhaar = m[1];
    return o;
  },
  operator(t) {
    const c = [['JIO', /reliance\s*jio|jio\.com/gi], ['AIRTEL', /bharti\s*airtel\s*limited|airtel\.(?:in|com)|bharti\s*hexacom/gi], ['VI', /vodafone\s*idea|myvi\.in|\bVIL\b/g], ['BSNL', /\bbsnl\b|bharat\s*sanchar/gi], ['MTNL', /\bmtnl\b/gi]]
      .map(([n, r]) => [n, (t.match(r) || []).length]).sort((a, b) => b[1] - a[1]);
    return c[0][1] ? c[0][0] : '';
  },

  /* fields of the operator e-KYC layouts (Jio, Airtel, Vi): label on the same line or the line above the value */
  smart(lines) {
    const L = this.prep(lines), o = {}, T = this, set = (k, v) => { if (v && !o[k]) o[k] = v; };
    const cell = s => s.split(/\s{2,}/)[0].trim();
    const txt = s => { s = cell(s).replace(/\s*\*.*$/, '').replace(/^(mr|mrs|ms|miss|shri|smt|kumari|km)\.?\s+/i, '').trim(); return /[a-z]{2}/i.test(s) && s.length <= 80 && !/received from|uidai|declaration|consent|applicable|if any|mandatory|unique|number|tick|designation/i.test(s) ? s.toUpperCase() : ''; };
    const code = s => { const t = cell(s).split(/\s+/)[0].replace(/[.,;]+$/, ''); return /^[A-Z0-9][A-Z0-9\/-]{3,}$/i.test(t) && /\d/.test(t) ? t.toUpperCase() : ''; };
    const mob = s => (s.match(/(?<!\d)(?:\+?91[\s-]?)?([6-9]\d{9})(?!\d)/) || [])[1] || '';
    const date = s => { const p = T.pdate(s); return p ? p.d : ''; };
    set('caf_no', T.find(L, /\bc\s?a\s?f\)?\s*no\b\.?/i, code));
    set('mobile', T.find(L, /mobile\s*(?:no\b|number\s*allo(?:t|c)\w*|number\s*[:*]|n(?:o|umber)\.?\s*\(msisdn)|\bmsisdn\b/i, mob));
    set('name', T.find(L, /c\s?u\s?s\s?t\s?o\s?m\s?e\s?r(?:[’'`]\s?s)?\s*(?:full\s*)?n\s?a\s?m\s?e/i, txt));
    set('father', T.find(L, /(?:name\s*of\s*)?father(?:[’'`]?s)?\s*\/\s*husband(?:[’'`]?s)?(?:\s*name)?|n\s?a\s?m\s?e\s*o\s?f(?=\s*\*)/i, txt));
    set('dob', T.find(L, /d\s?a\s?t\s?e\s*o\s?f\s*b\s?i\s?r\s?t\s?h|\bdob\b/i, date));
    set('gender', T.find(L, /\bg\s?e\s?n\s?d\s?e\s?r\b/i, s => { const m = s.match(/\b(male|female|transgender)\b/i); return m ? m[1].toUpperCase() : ''; }, { look: 1 }));
    set('alt', T.find(L, /a\s?l\s?t\s?e\s?r\s?n\s?a\s?t\s?e\s*(?:c\s?o\s?n\s?t\s?a\s?c\s?t|n\s?o|m\s?o\s?b\s?i\s?l\s?e|n\s?u\s?m\s?b\s?e\s?r|p\s?h\s?o\s?n\s?e)/i, mob));
    set('email', T.find(L, /e-?\s?mail/i, s => { const m = s.match(/[\w.+-]+@[\w-]+\.[\w.]+/); return m && !/@(airtel|jio|vodafoneidea|myvi|vi|ril)\./i.test(m[0]) ? m[0].toLowerCase() : ''; }, { all: true, look: 1 }));
    // POS: name ("98XXXXXXXX-SHOP NAME" = POS mobile + shop), code, DoT unique ID, agent
    const pn = T.find(L, /\bp\s?o\s?s\s*n\s?a\s?m\s?e\b/i, s => { const c = cell(s).replace(/\s*\*.*$/, ''); return /[a-z]/i.test(c) && c.length <= 80 && !/unique|received from/i.test(c) ? c.toUpperCase() : ''; });
    if (pn) { const m = pn.match(/^(?:\+?91)?([6-9]\d{9})\s*-\s*(.+)$/); if (m) { set('pos_mobile', m[1]); set('pos_name', m[2].trim()); } else set('pos_name', pn); }
    const pc = T.find(L, /\bp\s?o\s?s\s*c\s?o\s?d\s?e\b/i, code); set('pos_code', pc);
    set('pos_ucode', T.find(L, /\bpos\s*unique\s*(?:code|id)\b/i, code));
    set('pos_agent', T.find(L, /\bp\s?o\s?s\s*a\s?g\s?e\s?n\s?t\s*n\s?a\s?m\s?e\b/i, s => { const g = s.match(/global\s*id\s*:?\s*([A-Z0-9]{6,})/i); if (g) set('pos_ucode', g[1].toUpperCase()); return txt(s.replace(/,?\s*global\s*id.*$/i, '')); }));
    if (pc && /^\d{8}[A-Z]{4,}$/.test(pc)) set('pos_ucode', pc);   // Vi prints the DoT POS ID as "POS Code"
    if (pc && /^[6-9]\d{9}$/.test(pc)) set('pos_mobile', pc);       // Airtel prints the POS mobile as "PoS Code"
    // SIM activation date & time (Airtel prints the date on the line above the label)
    const ad = T.find(L, /s\s?i\s?m\s*a\s?c\s?t\s?i\s?v\s?a\s?t\s?i\s?o\s?n\s*d\s?a\s?t\s?e/i, s => T.pdate(s), { back: 1, look: 1, star: true });
    if (ad) { set('act_date', ad.d); set('act_time', ad.t); }
    set('act_time', T.find(L, /s\s?i\s?m\s*a\s?c\s?t\s?i\s?v\s?a\s?t\s?i\s?o\s?n\s*t\s?i\s?m\s?e/i, s => (s.match(/\b\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?/i) || [''])[0], { look: 1 }));
    const all = L.join('\n');
    set('sim', (all.match(/(?<!\d)(89\d{17,18})(?!\d)/) || [])[1]);
    set('imsi', (all.match(/(?<!\d)(40[45]\d{12})(?!\d)/) || [])[1]);
    // address blocks: Vi, Airtel, Jio
    set('address', this.block(L, /customer\s*local\s*address/i, /customer\s*permanent\s*address/i) || this.block(L, /complete\s*local\s*residential\s*address/i, /complete\s*permanent/i) || this.block(L, /l\s?o\s?c\s?a\s?l\s*r\s?e\s?s\s?i\s?d\s?e\s?n\s?t\s?i\s?a\s?l/i, /p\s?e\s?r\s?m\s?a\s?n\s?e\s?n\s?t\s*r\s?e\s?s\s?i\s?d/i) || this.block(L, /customer\s*permanent\s*address/i, /tariff|outstation/i));
    set('pos_address', this.block(L, /^\*?\s*pos\s*address\s*\*?$/i, /declaration\s*by|^pos\s*code/i, 10));
    return o;
  },

  /* "Label : Value" pairs (several per line allowed) and two-cell "Label  Value" rows – for simple forms */
  pairs(lines) {
    const out = [];
    const lab = /^[A-Za-z][A-Za-z0-9 .\/'()&_#-]{1,48}$/;
    for (const line of lines) {
      if (/[:：]/.test(line)) {
        const parts = line.split(/\s*[:：]\s*/);
        let key = parts[0];
        for (let i = 1; i < parts.length; i++) {
          let seg = parts[i], next = '';
          if (i < parts.length - 1) { const m = seg.match(/^(.*?)\s{2,}([A-Za-z][^\s].{0,48})$/); if (m) { seg = m[1]; next = m[2]; } else { const w = seg.split(/\s+/); next = w.length > 1 ? w.slice(-Math.min(3, w.length - 1)).join(' ') : ''; seg = next ? seg.slice(0, seg.length - next.length) : seg; } }
          if (lab.test(key.trim())) out.push([key.trim(), seg.trim()]);
          key = next;
        }
      } else {
        const cells = line.split(/\s{2,}/);
        if (cells.length === 2 && lab.test(cells[0]) && this.fieldOf(cells[0])) out.push([cells[0].trim(), cells[1].trim()]);
      }
    }
    return out.filter(([k, v]) => v && v.length < 300);
  },
  fieldOf(label) { const l = label.toLowerCase().replace(/\s+/g, ' ').trim(); if (/response|consent|declaration|acknowledg|registered|circle office|terms|corporate|\bcin\b/.test(l)) return ''; for (const [k, , re] of this.F) if (re.test(l)) return k; return ''; },
  fields(pairs) {
    const o = {};
    for (const [k, v] of pairs) { const f = this.fieldOf(k); if (f && !o[f]) { const n = this.norm(f, v); if (n) o[f] = n; } }
    if (o.alt && o.alt === o.mobile) delete o.alt;
    return o;
  },

  /* photos: embedded images → thumbnail + 64-bit difference hash. Logos and QR codes are skipped. */
  async photos(page, scanLike) {
    const out = [];
    let ops; try { ops = await page.getOperatorList(); } catch (e) { return out; }
    const O = pdfjsLib.OPS, seen = new Set();
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]; if (fn !== O.paintImageXObject && fn !== O.paintInlineImageXObject && fn !== O.paintJpegXObject) continue;
      let img = ops.argsArray[i][0];
      if (typeof img === 'string') { if (seen.has(img)) continue; seen.add(img); img = await new Promise(res => { const get = store => { try { if (store.has(img)) return res(store.get(img)); } catch (e) { } return null; }; if (get(page.objs) === null && get(page.commonObjs) === null) { try { page.objs.get(img, res); } catch (e) { res(null); } setTimeout(() => res(null), 3000); } }); }
      if (!img || !img.width || !img.height) continue;
      const w = img.width, h = img.height, ar = w / h;
      if (w * h < 9000 || w < 48 || h < 48 || ar > 2.2 || ar < 0.35) continue;      // logos, icons, lines
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      if (img.bitmap) x.drawImage(img.bitmap, 0, 0);
      else if (img.data) {
        const id = x.createImageData(w, h), d = id.data, s = img.data, n = w * h;
        if (img.kind === 3 || s.length === n * 4) d.set(s.subarray ? s.subarray(0, n * 4) : s.slice(0, n * 4));
        else if (img.kind === 2 || s.length === n * 3) for (let p = 0, q = 0; p < n; p++, q += 3) { d[p * 4] = s[q]; d[p * 4 + 1] = s[q + 1]; d[p * 4 + 2] = s[q + 2]; d[p * 4 + 3] = 255; }
        else if (img.kind === 1) { const rb = (w + 7) >> 3; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const v = (s[yy * rb + (xx >> 3)] >> (7 - (xx & 7))) & 1 ? 255 : 0, p = (yy * w + xx) * 4; d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255; } }
        else continue;
        x.putImageData(id, 0, 0);
      } else continue;
      // QR code: square, only black and white, no colour
      if (ar > .85 && ar < 1.18) { const D = x.getImageData(0, 0, w, h).data, st = Math.max(1, Math.floor(w * h / 6000)); let bw = 0, sat = 0, n = 0; for (let k = 0; k < w * h; k += st) { const a = k * 4, mx = Math.max(D[a], D[a + 1], D[a + 2]), mn = Math.min(D[a], D[a + 1], D[a + 2]); sat += mx - mn; if ((mx < 70 || mn > 185) && mx - mn < 30) bw++; n++; } if (bw / n > .8 && sat / n < 4) continue; }
      const kind = scanLike && Math.max(w, h) >= 1000 ? 'scan' : (Math.abs(ar - .8) < .06 && w >= 120 && w <= 240 ? 'uidai' : 'live');
      const shot = max => { const sc = Math.min(1, max / Math.max(w, h)), t = document.createElement('canvas'); t.width = Math.max(1, Math.round(w * sc)); t.height = Math.max(1, Math.round(h * sc)); const tx = t.getContext('2d'); tx.fillStyle = '#fff'; tx.fillRect(0, 0, t.width, t.height); tx.drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', .74); };
      const g = document.createElement('canvas'); g.width = 9; g.height = 8; const gx = g.getContext('2d'); gx.drawImage(c, 0, 0, 9, 8); const gd = gx.getImageData(0, 0, 9, 8).data;
      let hash = ''; for (let yy = 0; yy < 8; yy++) { let nib = 0; for (let xx = 0; xx < 8; xx++) { const a = (yy * 9 + xx) * 4, b = a + 4, la = gd[a] * .3 + gd[a + 1] * .59 + gd[a + 2] * .11, lb = gd[b] * .3 + gd[b + 1] * .59 + gd[b + 2] * .11; nib = (nib << 1) | (la > lb ? 1 : 0); } hash += nib.toString(16).padStart(2, '0'); }
      const q = document.createElement('canvas'); q.width = q.height = 8; const qx = q.getContext('2d'); qx.drawImage(c, 0, 0, 8, 8); const qd = qx.getImageData(0, 0, 8, 8).data;
      let sig = ''; for (let k = 0; k < 64; k++) sig += Math.round((qd[k * 4] * .3 + qd[k * 4 + 1] * .59 + qd[k * 4 + 2] * .11) / 16).toString(16);
      out.push({ thumb: shot(120), view: shot(kind === 'scan' ? 1100 : 420), hash, sig, w, h, kind });
    }
    return out;
  },
  KIND: { uidai: 'Aadhaar (UIDAI) photo', live: 'Live photo', scan: 'Scanned page' },
  face(c) { const P = (c.photos || []); return P.find(p => p.kind === 'uidai') || P.find(p => p.kind !== 'scan') || P[0]; },
  // same photo: similar shape (difference hash) and similar light/dark pattern
  same(a, b) { if (this.ham(a.hash, b.hash) > 5) return false; if (!a.sig || !b.sig) return this.ham(a.hash, b.hash) <= 4; let d = 0; for (let i = 0; i < 64; i++) d += Math.abs(parseInt(a.sig[i], 16) - parseInt(b.sig[i], 16)); return d / 64 <= 0.6; },
  ham(a, b) { let d = 0; for (let i = 0; i < 16; i += 2) { let x = parseInt(a.substr(i, 2), 16) ^ parseInt(b.substr(i, 2), 16); while (x) { d += x & 1; x >>= 1; } } return d; },

  async readPdf(file) {
    if (!window.pdfjsLib) throw new Error('PDF reader not available');
    const task = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, isOffscreenCanvasSupported: false });
    task.onPassword = (upd, reason) => { const pw = window.prompt((reason === 2 ? 'Wrong password. ' : '') + `"${file.name}" is password protected. Enter password (Cancel to skip):`); if (pw == null) task.destroy(); else upd(pw); };
    const pdf = await task.promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) { const pg = await pdf.getPage(p); const lines = this.lines(await pg.getTextContent()); pages.push({ p, lines, photos: await this.photos(pg, lines.join('').replace(/\s/g, '').length < 200) }); }
    // one CAF per page that brings a new mobile number; other pages belong to the CAF before them
    const recs = [];
    for (const pg of pages) {
      const pr = this.pairs(pg.lines), sm = this.smart(pg.lines), gen = this.fields(pr), mob = sm.mobile || gen.mobile;
      let cur = recs[recs.length - 1];
      if (!cur || (mob && cur.mob && mob !== cur.mob)) recs.push(cur = { pages: [], pairs: [], lines: [], photos: [], sm: {}, gen: {}, mob: '' });
      if (mob && !cur.mob) cur.mob = mob;
      cur.pages.push(pg.p); cur.pairs.push(...pr); cur.lines.push(`--- Page ${pg.p} ---`, ...pg.lines); pg.photos.forEach(ph => cur.photos.push({ ...ph, page: pg.p }));
      for (const k in sm) if (!cur.sm[k]) cur.sm[k] = sm[k];
      for (const k in gen) if (!cur.gen[k]) cur.gen[k] = gen[k];
    }
    const fileMob = (file.name.match(/(?<!\d)(?:91)?([6-9]\d{9})(?!\d)/) || [])[1];
    return recs.map((r, i) => {
      const text = r.lines.join('\n'), raw = r.lines.filter(l => !/^--- Page \d+ ---$/.test(l)).join('\n');
      const chars = raw.replace(/\s/g, '').length, readable = chars > 300 || (chars > 40 && Object.keys({ ...r.sm, ...r.gen }).length >= 2);
      // operator layout first, then the UIDAI XML (Jio), then simple "Label : Value" pairs
      const f = { ...r.gen, ...Object.fromEntries(Object.entries(r.sm).map(([k, v]) => [k, this.norm(k, v)]).filter(([, v]) => v)) };
      const x = this.xml(raw); for (const k in x) { const v = this.norm(k, x[k]); if (v && (!f[k] || k === 'aadhaar')) f[k] = v; }
      if (!f.mobile) { const m = raw.match(/(?:mobile|msisdn)[^0-9\n]{0,30}((?:\+?91[\s-]?)?[6-9]\d{9})(?!\d)/i); if (m) f.mobile = this.norm('mobile', m[1]); }
      if (!f.mobile && fileMob && recs.length === 1) { f.mobile = fileMob; f.mobile_src = 'file name'; }
      if (f.alt && f.alt === f.mobile) delete f.alt;
      const op = this.operator(raw); if (op) f.operator = op;
      const ct = raw.match(/\b(prepaid|postpaid|pre-paid|post-paid)\b/i); if (ct) f.conn = ct[1].toUpperCase().replace('-', '');
      if (!f.poi_type && /e-?\s?kyc/i.test(raw)) f.poi_type = 'AADHAAR E-KYC';
      const order = { uidai: 0, live: 1, scan: 2 };
      return { id: uid(), file: file.name + (recs.length > 1 ? ` (#${i + 1})` : ''), pages: r.pages.join(', '), readable, ...f, pairs: r.pairs, text, photos: r.photos.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, 8), added: new Date().toISOString() };
    });
  },
  async importFiles(files, report) {
    const L = this.list(), have = new Set(L.map(c => c.file + '|' + (c.mobile || '') + '|' + (c.caf_no || ''))), res = [];
    for (const [i, f] of [...files].entries()) {
      report(`Reading ${i + 1} of ${files.length}: ${f.name}`); await new Promise(r => setTimeout(r, 0));
      if (!/\.pdf$/i.test(f.name)) { res.push({ file: f.name, err: 'not a PDF' }); continue; }
      try {
        const recs = await this.readPdf(f); let add = 0, unread = 0, dup = 0;
        for (const r of recs) { const k = r.file + '|' + (r.mobile || '') + '|' + (r.caf_no || ''); if (have.has(k)) { dup++; continue; } have.add(k); L.push(r); add++; if (!r.readable) unread++; }
        res.push({ file: f.name, add, unread, dup, op: uniq(recs.map(r => r.operator).filter(Boolean)).join('/'), photos: recs.reduce((a, r) => a + r.photos.filter(p => p.kind !== 'scan').length, 0) });
      } catch (e) { res.push({ file: f.name, err: /password/i.test(e && (e.name + e.message)) ? 'password protected' : (e.message || 'could not read') }); }
    }
    Analysis.invalidate(); saveCase();
    return res;
  },
  groups(k) {
    return Analysis.cached('caf:' + k, () => {
      const G = new Map(), mob = new Set(this.list().map(c => c.mobile).filter(Boolean));
      for (const c of this.list()) { const v = c[k]; if (!v) continue; const key = k === 'address' ? v.replace(/[^A-Z0-9]/g, '').slice(0, 60) : v; let g = G.get(key); if (!g) G.set(key, g = { value: v, cafs: [] }); g.cafs.push(c); }
      return [...G.values()].map(g => ({ value: g.value, n: g.cafs.length, mobiles: uniq(g.cafs.map(c => c.mobile).filter(Boolean)).join(', '), names: uniq(g.cafs.map(c => c.name).filter(Boolean)).slice(0, 5).join(', '),
        pos: uniq(g.cafs.map(c => c.pos_name).filter(Boolean)).slice(0, 3).join(', '), dates: uniq(g.cafs.map(c => c.act_date).filter(Boolean)).sort().join(', '), files: uniq(g.cafs.map(c => c.file)).join(', '),
        isMob: k === 'alt' && mob.has(g.value) ? 'Yes – it is a CAF mobile here' : '', cafs: g.cafs }));
    });
  },
  photoGroups() {
    return Analysis.cached('caf:photo', () => {
      const P = []; this.list().forEach(c => (c.photos || []).forEach((ph, i) => { if (ph.kind !== 'scan') P.push({ c, ph, i }); }));
      const par = P.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (P[i].c !== P[j].c && this.same(P[i].ph, P[j].ph)) par[find(i)] = find(j);
      const G = new Map(); P.forEach((x, i) => { const r = find(i); if (!G.has(r)) G.set(r, []); G.get(r).push(x); });
      const total = this.list().length;
      return [...G.values()].map(l => { const cafs = uniq(l.map(x => x.c)); return { items: l, cafs, n: cafs.length, logo: total >= 4 && cafs.length >= total * .8 }; }).filter(g => g.n >= 2).sort((a, b) => b.n - a.n);
    });
  },
  show(c) {
    const ph = (c.photos || []).map((p, i) => `<figure class="caf-fig"><img src="${p.thumb}" class="caf-ph ${p.kind === 'scan' ? 'scan' : ''}" data-pi="${i}" title="Click to enlarge"><figcaption>${esc(this.KIND[p.kind] || 'Photo')} · p${p.page}</figcaption></figure>`).join('');
    const rows = [...this.F.map(([k, l]) => [k, l]), ['operator', 'Operator'], ['conn', 'Connection']];
    UI.drawer('CAF · ' + (c.mobile || c.file), `${ph ? `<div class="caf-phs">${ph}</div>` : ''}
      ${c.readable ? '' : '<div class="err" style="margin-bottom:10px">This PDF is a <b>scanned image</b> (no text inside), so fields cannot be read automatically. Click the scanned page to read it, then use <b>✎ Fill / edit fields</b>.</div>'}
      <div id="cafF"><table class="tbl small"><tbody>${rows.map(([k, l]) => c[k] ? `<tr><th style="width:38%">${esc(l)}</th><td>${esc(c[k])}${k === 'mobile' && c.mobile_src ? ' <span class="muted">(from file name)</span>' : ''}</td></tr>` : '').join('')}<tr><th>File</th><td>${esc(c.file)} · page ${esc(c.pages)}</td></tr></tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn sm primary" id="cafEd">✎ Fill / edit fields</button><button class="btn sm" id="cafTxt">⬇ Text (.txt)</button><button class="btn sm danger" id="cafDel">Remove this CAF</button></div>
      ${(c.pairs || []).length ? `<details style="margin-top:14px"><summary>All label : value pairs found (${c.pairs.length})</summary><table class="tbl small"><tbody>${c.pairs.map(([k, v]) => `<tr><td style="width:38%">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table></details>` : ''}
      ${c.readable ? `<details style="margin-top:10px"><summary>Text of the PDF</summary><pre class="caf-txt">${esc(c.text)}</pre></details>` : ''}`);
    $$('#drawer [data-pi]').forEach(im => im.onclick = () => { const p = c.photos[+im.dataset.pi]; UI.modal(`${this.KIND[p.kind] || 'Photo'} · page ${p.page}`, `<img src="${p.view || p.thumb}" style="max-width:100%;display:block;margin:auto">`); });
    $('#cafTxt').onclick = () => UI.download((c.mobile || 'caf') + '.txt', c.text || '', 'text/plain');
    $('#cafDel').onclick = () => { if (!UI.confirm('Remove this CAF from the case?')) return; S.data.caf = this.list().filter(x => x !== c); Analysis.invalidate(); saveCase(); UI.closeDrawer(); render(); };
    $('#cafEd').onclick = () => {
      $('#cafF').innerHTML = `<div class="caf-edit">${this.EDIT.map(k => `<label>${esc(this.label(k))}<input data-ek="${k}" value="${esc(c[k] || '')}" ${k === 'act_date' || k === 'dob' ? 'placeholder="DD/MM/YYYY"' : ''}></label>`).join('')}</div><div class="row" style="margin-top:8px"><button class="btn sm primary" id="cafSave">Save</button></div>`;
      $('#cafSave').onclick = () => { $$('#cafF [data-ek]').forEach(i => { const k = i.dataset.ek, v = i.value.trim(); if (!v) delete c[k]; else c[k] = this.norm(k, v) || v.toUpperCase(); if (k === 'mobile') delete c.mobile_src; }); c.edited = true; Analysis.invalidate(); saveCase(); render(); this.show(c); UI.toast('CAF saved'); };
    };
  }
};

Pages.caf = main => {
  const L = CAF.list();
  const { cur, body } = tabs(main, 'caf', [['data', 'Import & Table'], ['common', 'Common Analysis'], ['photo', 'Common Photo']], 'CAF Analysis',
    `<button class="btn primary" id="cafImp">⬆ Import Single / Multiple CAF</button><input type="file" id="cafPick" multiple accept=".pdf,application/pdf" class="hidden">`);
  const pick = $('#cafPick');
  $('#cafImp').onclick = () => { pick.value = ''; pick.click(); };
  const run = async files => {
    files = [...files]; if (!files.length) return;
    const host = $('#tabBody'); host.insertAdjacentHTML('afterbegin', '<div class="note" id="cafProg">Reading…</div>');
    const res = await CAF.importFiles(files, t => { const p = $('#cafProg'); if (p) p.textContent = t; });
    const add = res.reduce((a, r) => a + (r.add || 0), 0);
    UI.toast(`${add} CAF${add === 1 ? '' : 's'} imported from ${res.length} file${res.length === 1 ? '' : 's'}`);
    render();
    $('#tabBody').insertAdjacentHTML('afterbegin', `<div class="note">✔ <b>${add}</b> CAF${add === 1 ? '' : 's'} imported from <b>${res.length}</b> file${res.length === 1 ? '' : 's'}.<br>${res.map(r => r.err ? `<span class="err">✖ ${esc(r.file)}: ${esc(r.err)}</span>` : `${esc(r.file)}: ${r.add} CAF${r.add === 1 ? '' : 's'}${r.op ? ' · ' + esc(r.op) : ''}, ${r.photos} photo${r.photos === 1 ? '' : 's'}${r.dup ? ` · ${r.dup} already in the case` : ''}${r.unread ? ` · <span class="err">scanned image (no text) – open the row and fill the fields</span>` : ''}`).join('<br>')}</div>`);
  };
  pick.onchange = () => run(pick.files);
  CAF.run = run;
  CafTabs[cur](body, L);
};
const CafTabs = {
  data(el, L) {
    const unread = L.filter(c => !c.readable).length;
    el.innerHTML = `<div class="caf-drop" id="cafDrop"><div class="caf-drop-ic">📄</div><div class="grow"><b>Import Single / Multiple CAF</b><div class="small muted">Choose one or many CAF PDFs (Jio, Airtel, Vi, BSNL…) or drop them here. Everything is read inside this browser – nothing is uploaded.</div></div><button class="btn primary" id="cafImp2">⬆ Choose CAF PDF files</button></div>
      ${UI.kpis([['CAFs', fmtNum(L.length)], ['Distinct mobiles', fmtNum(uniq(L.map(c => c.mobile).filter(Boolean)).length)], ['POS', fmtNum(uniq(L.map(c => c.pos_name || c.pos_code).filter(Boolean)).length)], ['POS agents', fmtNum(uniq(L.map(c => c.pos_agent).filter(Boolean)).length)], ['Photos', fmtNum(L.reduce((a, c) => a + (c.photos || []).filter(p => p.kind !== 'scan').length, 0))], ['Scanned (no text)', fmtNum(unread)]])}
      <div class="card"><div class="row"><h3 class="grow">All CAFs</h3>${L.length ? '<button class="btn sm" id="cafAllTxt">⬇ All text (.txt)</button><button class="btn sm danger" id="cafClr">Remove all CAFs</button>' : ''}</div><div class="sub">Click a row to see the photos, every field found, and the full text. Scanned CAFs can be filled in by hand from the same window.</div><div id="cafT"></div></div>`;
    $('#cafImp2', el).onclick = () => $('#cafImp').click();
    const dz = $('#cafDrop', el);
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); CAF.run && CAF.run(e.dataTransfer.files); };
    if (L.length) {
      $('#cafAllTxt', el).onclick = () => UI.download('caf_text.txt', L.map(c => `===== ${c.file} =====\n${c.text}`).join('\n\n'), 'text/plain');
      $('#cafClr', el).onclick = () => { if (UI.confirm(`Remove all ${L.length} CAFs from this case?`)) { S.data.caf = []; Analysis.invalidate(); saveCase(); render(); } };
    }
    const cols = ['mobile', 'operator', 'name', 'father', 'alt', 'act_date', 'act_time', 'pos_name', 'pos_code', 'pos_ucode', 'pos_mobile', 'pos_agent', 'dob', 'gender', 'aadhaar', 'poi_type', 'poi_no', 'email', 'address', 'pos_address', 'sim', 'imsi', 'caf_no'];
    Table($('#cafT', el), { rows: L, exportName: 'caf_table', sortKey: 'act_date', sortDir: 1, pageSize: 50,
      columns: [{ key: '_ph', label: 'Photo', nosort: true, render: c => { const p = CAF.face(c); return p ? `<img src="${p.thumb}" class="caf-mini">` : ''; }, csv: c => (c.photos || []).length + ' images' },
        ...cols.map(k => ({ key: k, label: CAF.label(k), render: k === 'address' || k === 'pos_address' ? c => `<span class="small">${esc(String(c[k] || '').slice(0, 80))}</span>` : k === 'mobile' ? c => `<b class="mono">${esc(c.mobile || '')}</b>${c.readable ? '' : ' <span class="badge" style="background:#ef4444;color:#fff">scanned</span>'}${c.mobile_src ? ' <span class="small muted" title="Taken from the file name">(file)</span>' : ''}` : undefined })),
        { key: 'file', label: 'File' }],
      onRow: c => CAF.show(c) });
  },
  common(el, L) {
    const f = S.cafField || 'pos_name', min = S.cafMin || 2, M = Object.fromEntries(CAF.COMMON);
    el.innerHTML = `<div class="card"><h3>Common between CAFs</h3><div class="sub">The same POS, agent, activation date, alternate number or ID on many SIMs points to bulk / fake SIM issuing.</div>
      <div class="cs-fields">${CAF.COMMON.map(([k, l]) => `<button class="btn sm ${k === f ? 'primary' : ''}" data-cf="${k}">${l} <span class="badge">${CAF.groups(k).filter(g => g.n >= min).length}</span></button>`).join('')}
      <button class="btn sm" data-goph>Photo <span class="badge">${CAF.photoGroups().filter(g => !g.logo).length}</span></button></div>
      <div class="row" style="margin-top:10px"><label>Common in at least</label><select id="cafMin">${[1, 2, 3, 5, 10].map(n => `<option ${n === min ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="small muted">CAFs</span></div></div>
      <div class="card"><h3>Common ${esc(M[f])}</h3><div class="sub">Click a row to see the CAFs behind it.</div><div id="cafC"></div></div>`;
    $$('[data-cf]', el).forEach(b => b.onclick = () => { S.cafField = b.dataset.cf; CafTabs.common(el, L); });
    $('[data-goph]', el).onclick = () => go('caf', 'photo');
    $('#cafMin', el).onchange = e => { S.cafMin = +e.target.value; CafTabs.common(el, L); };
    Table($('#cafC', el), { rows: CAF.groups(f).filter(g => g.n >= min), exportName: 'caf_common_' + f, sortKey: 'n', sortDir: -1, pageSize: 50,
      columns: [{ key: 'value', label: M[f], render: g => `<b>${esc(g.value)}</b>` }, { key: 'n', label: 'CAFs', num: true }, { key: 'mobiles', label: 'Mobile numbers', render: g => `<span class="mono small">${esc(g.mobiles.slice(0, 200))}</span>` },
        ...(f === 'alt' ? [{ key: 'isMob', label: 'Also a CAF mobile?' }] : []), { key: 'names', label: 'Names' }, ...(f === 'pos_name' ? [] : [{ key: 'pos', label: 'POS' }]), ...(f === 'act_date' ? [] : [{ key: 'dates', label: 'Activation dates' }]), { key: 'files', label: 'Files', render: g => `<span class="small muted">${esc(g.files.slice(0, 120))}</span>` }],
      onRow: g => { UI.drawer(`${M[f]}: ${g.value}`, g.cafs.map((c, i) => { const p = CAF.face(c); return `<div class="list-item" data-ci="${i}" style="cursor:pointer">${p ? `<img src="${p.thumb}" class="caf-mini">` : ''}<div class="grow small"><b class="mono">${esc(c.mobile || '')}</b> · ${esc(c.name || '')}<br>${esc([c.pos_name, c.pos_agent, c.act_date, c.alt && 'Alt ' + c.alt].filter(Boolean).join(' · '))}<br><span class="muted">${esc(c.file)}</span></div></div>`; }).join('')); $$('#drawer [data-ci]').forEach(d => d.onclick = () => CAF.show(g.cafs[+d.dataset.ci])); } });
  },
  photo(el, L) {
    const all = CAF.photoGroups(), showLogo = !!S.cafLogo, G = all.filter(g => showLogo || !g.logo), hid = all.length - all.filter(g => !g.logo).length;
    const nph = L.reduce((a, c) => a + (c.photos || []).filter(p => p.kind !== 'scan').length, 0);
    el.innerHTML = `<div class="card"><h3>Common photo of user</h3><div class="sub">Photos taken out of the CAF PDFs (Aadhaar photo and live photo) are compared with each other. The same or nearly the same photo on different CAFs means one person (or one photo) was used for many SIMs. Always check by eye.</div>
      <div class="row small muted" style="margin-top:6px">${fmtNum(nph)} photos in ${fmtNum(L.length)} CAFs · ${G.length} groups${hid ? ` · <label><input type="checkbox" id="cafLogo" ${showLogo ? 'checked' : ''}> show ${hid} image${hid > 1 ? 's' : ''} found on almost every form (logo / stamp)</label>` : ''}</div></div>
      ${G.length ? G.map((g, gi) => `<div class="card caf-grp"><div class="row"><h3 class="grow">Same photo on ${g.n} CAFs${g.logo ? ' <span class="badge">probably a logo</span>' : ''}</h3></div>
        <div class="caf-grid">${g.cafs.map((c, i) => { const it = g.items.find(x => x.c === c); return `<div class="caf-card" data-g="${gi}" data-i="${i}"><img src="${it.ph.thumb}"><div><b class="mono">${esc(c.mobile || ('Scanned: ' + c.file))}</b><br><span class="small">${esc(c.name || '')}</span><br><span class="small muted">${esc([c.pos_name, c.act_date].filter(Boolean).join(' · '))}</span></div></div>`; }).join('')}</div></div>`).join('')
        : `<div class="card muted">${nph ? 'No photo is repeated on two or more CAFs.' : 'No photos found yet. Import CAF PDFs first.'}</div>`}`;
    const lg = $('#cafLogo', el); if (lg) lg.onchange = e => { S.cafLogo = e.target.checked; CafTabs.photo(el, L); };
    $$('.caf-card', el).forEach(d => d.onclick = () => CAF.show(G[+d.dataset.g].cafs[+d.dataset.i]));
  }
};
