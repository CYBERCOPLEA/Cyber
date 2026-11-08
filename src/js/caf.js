/* CAF Analysis: read SIM Customer Application Form PDFs (offline), turn them into a table,
   and find what many forms share: POS, POS agent, activation date, alternate number, user photo… */
const CAF = {
  // [key, label, label pattern]  – first match wins, so specific labels come first
  F: [
    ['caf_no', 'CAF No', /\b(caf|application|form)\s*(no|number|id)\b/],
    ['pos_address', 'POS Address', /\b(pos|retailer|outlet|store|dealer|shop|point of sale)\b.*address/],
    ['pos_code', 'POS Code', /\b(pos|retailer|outlet|store|dealer|shop|point of sale)\b.*\b(code|id|no)\b/],
    ['pos_name', 'POS Name', /\b(pos|retailer|outlet|store|dealer|shop|point of sale|distributor)\b/],
    ['pos_agent', 'POS Agent', /\b(agent|promoter|verifi\w*|sales\s*(person|executive)|fos|employee|staff|activated by|enrolled by)\b/],
    ['alt', 'Alternate Number', /\b(alternate|alternative|alt\.?|other|landline)\b.*\b(no|number|contact|mobile|phone)\b|\balternate\b/],
    ['mobile', 'Mobile', /\b(msisdn|mobile|allotted|connection|subscriber|cell|tel(ephone)?)\b.*\b(no|number)\b|^mobile$|^msisdn$/],
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
  COMMON: [['pos_name', 'POS'], ['pos_code', 'POS code'], ['pos_agent', 'POS agent'], ['act_date', 'Date of activation'], ['alt', 'Alternate number'], ['poi_no', 'ID number'], ['aadhaar', 'Aadhaar'], ['address', 'Address'], ['email', 'Email'], ['name', 'Customer name'], ['father', 'Father / Husband']],
  list() { return S.data.caf || (S.data.caf = []); },
  label(k) { return (this.F.find(f => f[0] === k) || [k, k])[1]; },
  norm(k, v) {
    v = String(v || '').replace(/\s+/g, ' ').trim();
    if (k === 'mobile' || k === 'alt') { const d = v.replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
    if (k === 'act_date' || k === 'dob') { const d = N.date(v.replace(/\s+\d{1,2}:\d{2}.*$/, '')); return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : v; }
    if (k === 'email') return v.toLowerCase();
    if (k === 'aadhaar') { const d = v.replace(/[^\dxX*]/g, ''); return d.length >= 4 ? d.toUpperCase() : ''; }
    return v.toUpperCase();
  },

  /* text lines of one page: items on the same row, with "  " where there is a visible gap */
  lines(tc) {
    const rows = [];
    for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const y = it.transform[5]; let r = rows.find(r => Math.abs(r.y - y) < 3); if (!r) rows.push(r = { y, it: [] }); r.it.push(it); }
    return rows.sort((a, b) => b.y - a.y).map(r => { r.it.sort((a, b) => a.transform[4] - b.transform[4]); let s = '', end = null; for (const i of r.it) { const x = i.transform[4]; if (end != null) s += x - end > 8 ? '  ' : x - end > 1.2 ? ' ' : ''; s += i.str; end = x + (i.width || i.str.length * 5); } return s.trim(); });
  },
  /* "Label : Value" pairs (several per line allowed) and two-cell "Label  Value" rows */
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
  fieldOf(label) { const l = label.toLowerCase().replace(/\s+/g, ' ').trim(); for (const [k, , re] of this.F) if (re.test(l)) return k; return ''; },
  fields(pairs, text) {
    const o = {};
    for (const [k, v] of pairs) { const f = this.fieldOf(k); if (f && !o[f]) { const n = this.norm(f, v); if (n) o[f] = n; } }
    if (!o.mobile) { const m = text.match(/(?:mobile|msisdn)[^0-9]{0,30}((?:\+?91[\s-]?)?[6-9]\d{9})/i); if (m) o.mobile = this.norm('mobile', m[1]); }
    if (!o.email) { const m = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/); if (m) o.email = m[0].toLowerCase(); }
    const op = text.match(/\b(reliance jio|jio|airtel|vodafone idea|vodafone|\bvi\b|idea|bsnl|mtnl)\b/i); if (op) o.operator = op[1].toUpperCase().replace('RELIANCE ', '');
    const ct = text.match(/\b(prepaid|postpaid|pre-paid|post-paid)\b/i); if (ct) o.conn = ct[1].toUpperCase().replace('-', '');
    if (o.alt && o.alt === o.mobile) delete o.alt;
    return o;
  },

  /* photos: embedded images → small thumbnail + 64-bit difference hash */
  async photos(page) {
    const out = [];
    let ops; try { ops = await page.getOperatorList(); } catch (e) { return out; }
    const O = pdfjsLib.OPS, seen = new Set();
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]; if (fn !== O.paintImageXObject && fn !== O.paintInlineImageXObject && fn !== O.paintJpegXObject) continue;
      let img = ops.argsArray[i][0];
      if (typeof img === 'string') { if (seen.has(img)) continue; seen.add(img); img = await new Promise(res => { const get = store => { try { if (store.has(img)) return res(store.get(img)); } catch (e) { } return null; }; if (get(page.objs) === null && get(page.commonObjs) === null) { try { page.objs.get(img, res); } catch (e) { res(null); } setTimeout(() => res(null), 3000); } }); }
      if (!img || !img.width || !img.height) continue;
      const w = img.width, h = img.height, ar = w / h;
      if (w < 48 || h < 48 || ar > 2.2 || ar < 0.35) continue;
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
      const sc = Math.min(1, 120 / Math.max(w, h)), t = document.createElement('canvas'); t.width = Math.max(1, Math.round(w * sc)); t.height = Math.max(1, Math.round(h * sc)); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
      const g = document.createElement('canvas'); g.width = 9; g.height = 8; const gx = g.getContext('2d'); gx.drawImage(c, 0, 0, 9, 8); const gd = gx.getImageData(0, 0, 9, 8).data;
      let hash = ''; for (let yy = 0; yy < 8; yy++) { let nib = 0; for (let xx = 0; xx < 8; xx++) { const a = (yy * 9 + xx) * 4, b = a + 4, la = gd[a] * .3 + gd[a + 1] * .59 + gd[a + 2] * .11, lb = gd[b] * .3 + gd[b + 1] * .59 + gd[b + 2] * .11; nib = (nib << 1) | (la > lb ? 1 : 0); } hash += nib.toString(16).padStart(2, '0'); }
      const q = document.createElement('canvas'); q.width = q.height = 8; const qx = q.getContext('2d'); qx.drawImage(c, 0, 0, 8, 8); const qd = qx.getImageData(0, 0, 8, 8).data;
      let sig = ''; for (let k = 0; k < 64; k++) sig += Math.round((qd[k * 4] * .3 + qd[k * 4 + 1] * .59 + qd[k * 4 + 2] * .11) / 16).toString(16);
      out.push({ thumb: t.toDataURL('image/jpeg', .72), hash, sig, w, h });
    }
    return out;
  },
  // same photo: similar shape (difference hash) and similar light/dark pattern
  same(a, b) { if (this.ham(a.hash, b.hash) > 5) return false; if (!a.sig || !b.sig) return this.ham(a.hash, b.hash) <= 4; let d = 0; for (let i = 0; i < 64; i++) d += Math.abs(parseInt(a.sig[i], 16) - parseInt(b.sig[i], 16)); return d / 64 <= 0.6; },
  ham(a, b) { let d = 0; for (let i = 0; i < 16; i += 2) { let x = parseInt(a.substr(i, 2), 16) ^ parseInt(b.substr(i, 2), 16); while (x) { d += x & 1; x >>= 1; } } return d; },

  async readPdf(file) {
    if (!window.pdfjsLib) throw new Error('PDF reader not available');
    const task = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, isOffscreenCanvasSupported: false });
    task.onPassword = (upd, reason) => { const pw = window.prompt((reason === 2 ? 'Wrong password. ' : '') + `"${file.name}" is password protected. Enter password (Cancel to skip):`); if (pw == null) task.destroy(); else upd(pw); };
    const pdf = await task.promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) { const pg = await pdf.getPage(p); const lines = this.lines(await pg.getTextContent()); pages.push({ p, lines, photos: await this.photos(pg) }); }
    // one CAF per page that brings a new mobile number; other pages belong to the CAF before them
    const recs = [];
    for (const pg of pages) {
      const text = pg.lines.join('\n'), pr = this.pairs(pg.lines), f = this.fields(pr, text);
      let cur = recs[recs.length - 1];
      if (!cur || (f.mobile && cur.f.mobile && f.mobile !== cur.f.mobile)) recs.push(cur = { pages: [], pairs: [], text: '', photos: [], f: {} });
      cur.pages.push(pg.p); cur.pairs.push(...pr); cur.text += (cur.text ? '\n\n' : '') + `--- Page ${pg.p} ---\n` + text; pg.photos.forEach(ph => cur.photos.push({ ...ph, page: pg.p }));
      for (const k in f) if (!cur.f[k]) cur.f[k] = f[k];
    }
    return recs.map((r, i) => ({ id: uid(), file: file.name + (recs.length > 1 ? ` (#${i + 1})` : ''), pages: r.pages.join(', '), readable: r.text.replace(/--- Page \d+ ---/g, '').trim().length > 20, ...r.f, pairs: r.pairs, text: r.text, photos: r.photos.slice(0, 8), added: new Date().toISOString() }));
  },
  async importFiles(files, report) {
    const L = this.list(), have = new Set(L.map(c => c.file + '|' + (c.mobile || '') + '|' + (c.caf_no || ''))), res = [];
    for (const [i, f] of [...files].entries()) {
      report(`Reading ${i + 1} of ${files.length}: ${f.name}`); await new Promise(r => setTimeout(r, 0));
      if (!/\.pdf$/i.test(f.name)) { res.push({ file: f.name, err: 'not a PDF' }); continue; }
      try {
        const recs = await this.readPdf(f); let add = 0, unread = 0;
        for (const r of recs) { const k = r.file + '|' + (r.mobile || '') + '|' + (r.caf_no || ''); if (have.has(k)) continue; have.add(k); L.push(r); add++; if (!r.readable) unread++; }
        res.push({ file: f.name, add, unread, photos: recs.reduce((a, r) => a + r.photos.length, 0) });
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
      const P = []; this.list().forEach(c => (c.photos || []).forEach((ph, i) => P.push({ c, ph, i })));
      const par = P.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (P[i].c !== P[j].c && this.same(P[i].ph, P[j].ph)) par[find(i)] = find(j);
      const G = new Map(); P.forEach((x, i) => { const r = find(i); if (!G.has(r)) G.set(r, []); G.get(r).push(x); });
      const total = this.list().length;
      return [...G.values()].map(l => { const cafs = uniq(l.map(x => x.c)); return { items: l, cafs, n: cafs.length, logo: total >= 4 && cafs.length >= total * .8 }; }).filter(g => g.n >= 2).sort((a, b) => b.n - a.n);
    });
  },
  show(c) {
    const ph = (c.photos || []).map(p => `<img src="${p.thumb}" class="caf-ph" title="Page ${p.page} · ${p.w}×${p.h}">`).join('');
    UI.drawer('CAF · ' + (c.mobile || c.file), `${ph ? `<div class="caf-phs">${ph}</div>` : ''}
      <table class="tbl small"><tbody>${this.F.map(([k, l]) => c[k] ? `<tr><th style="width:38%">${esc(l)}</th><td>${esc(c[k])}</td></tr>` : '').join('')}${c.operator ? `<tr><th>Operator</th><td>${esc(c.operator)}</td></tr>` : ''}${c.conn ? `<tr><th>Connection</th><td>${esc(c.conn)}</td></tr>` : ''}<tr><th>File</th><td>${esc(c.file)} · page ${esc(c.pages)}</td></tr></tbody></table>
      ${(c.pairs || []).length ? `<h4 style="margin:14px 0 6px">All label : value pairs found</h4><table class="tbl small"><tbody>${c.pairs.map(([k, v]) => `<tr><td style="width:38%">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : ''}
      <h4 style="margin:14px 0 6px">Text of the PDF</h4>${c.readable ? `<pre class="caf-txt">${esc(c.text)}</pre>` : '<div class="err">No text in this PDF – it is a scanned image. Fields cannot be read; get a digital copy or OCR it first. Photos are still compared.</div>'}
      <div class="row" style="margin-top:10px"><button class="btn sm" id="cafTxt">⬇ Text (.txt)</button><button class="btn sm danger" id="cafDel">Remove this CAF</button></div>`);
    $('#cafTxt').onclick = () => UI.download((c.mobile || 'caf') + '.txt', c.text || '', 'text/plain');
    $('#cafDel').onclick = () => { if (!UI.confirm('Remove this CAF from the case?')) return; S.data.caf = this.list().filter(x => x !== c); saveCase(); UI.closeDrawer(); render(); };
  }
};

Pages.caf = main => {
  const L = CAF.list();
  const { cur, body } = tabs(main, 'caf', [['data', 'Import & Table'], ['common', 'Common Analysis'], ['photo', 'Common Photo']], 'CAF Analysis',
    `<button class="btn primary" id="cafImp">⬆ Import CAF PDFs</button><input type="file" id="cafPick" multiple accept=".pdf,application/pdf" class="hidden">`);
  const pick = $('#cafPick');
  $('#cafImp').onclick = () => { pick.value = ''; pick.click(); };
  pick.onchange = async () => {
    if (!pick.files.length) return;
    const host = $('#tabBody'); host.insertAdjacentHTML('afterbegin', '<div class="note" id="cafProg">Reading…</div>');
    const res = await CAF.importFiles(pick.files, t => { const p = $('#cafProg'); if (p) p.textContent = t; });
    const add = res.reduce((a, r) => a + (r.add || 0), 0);
    UI.toast(`${add} CAFs imported from ${res.length} files`);
    render();
    $('#tabBody').insertAdjacentHTML('afterbegin', `<div class="note">✔ <b>${add}</b> CAFs imported from <b>${res.length}</b> files.<br>${res.map(r => r.err ? `<span class="err">✖ ${esc(r.file)}: ${esc(r.err)}</span>` : `${esc(r.file)}: ${r.add} CAF${r.add === 1 ? '' : 's'}, ${r.photos} photos${r.unread ? ` · <span class="err">${r.unread} scanned (no text – fields cannot be read)</span>` : ''}`).join('<br>')}</div>`);
  };
  CafTabs[cur](body, L);
};
const CafTabs = {
  data(el, L) {
    const unread = L.filter(c => !c.readable).length;
    el.innerHTML = `<div class="note">Import one or many CAF (Customer Application Form) PDFs received from the telecom operator. Text is read inside this browser and turned into one row per CAF. A PDF with several CAFs (one per page) is split automatically. <b>Scanned PDFs have no text</b>: their fields cannot be read, but their photos are still compared.</div>
      ${UI.kpis([['CAFs', fmtNum(L.length)], ['Distinct mobiles', fmtNum(uniq(L.map(c => c.mobile).filter(Boolean)).length)], ['POS', fmtNum(uniq(L.map(c => c.pos_name || c.pos_code).filter(Boolean)).length)], ['POS agents', fmtNum(uniq(L.map(c => c.pos_agent).filter(Boolean)).length)], ['Photos', fmtNum(L.reduce((a, c) => a + (c.photos || []).length, 0))], ['Scanned (no text)', fmtNum(unread)]])}
      <div class="card"><div class="row"><h3 class="grow">All CAFs</h3>${L.length ? '<button class="btn sm" id="cafAllTxt">⬇ All text (.txt)</button><button class="btn sm danger" id="cafClr">Remove all CAFs</button>' : ''}</div><div class="sub">Click a row to see the photo, every field found, and the full text of the PDF.</div><div id="cafT"></div></div>`;
    if (L.length) {
      $('#cafAllTxt', el).onclick = () => UI.download('caf_text.txt', L.map(c => `===== ${c.file} =====\n${c.text}`).join('\n\n'), 'text/plain');
      $('#cafClr', el).onclick = () => { if (UI.confirm(`Remove all ${L.length} CAFs from this case?`)) { S.data.caf = []; saveCase(); render(); } };
    }
    const cols = ['mobile', 'name', 'father', 'alt', 'act_date', 'pos_name', 'pos_code', 'pos_agent', 'poi_type', 'poi_no', 'aadhaar', 'dob', 'gender', 'email', 'address', 'sim', 'caf_no'];
    Table($('#cafT', el), { rows: L, exportName: 'caf_table', sortKey: 'act_date', sortDir: 1, pageSize: 50,
      columns: [{ key: '_ph', label: 'Photo', nosort: true, render: c => c.photos && c.photos[0] ? `<img src="${c.photos[0].thumb}" class="caf-mini">` : '', csv: c => (c.photos || []).length + ' photos' },
        ...cols.map(k => ({ key: k, label: CAF.label(k), render: k === 'address' ? c => `<span class="small">${esc(String(c.address || '').slice(0, 80))}</span>` : k === 'mobile' ? c => `<b class="mono">${esc(c.mobile || '')}</b>${c.readable ? '' : ' <span class="badge" style="background:#ef4444;color:#fff">scanned</span>'}` : undefined })),
        { key: 'operator', label: 'Operator' }, { key: 'file', label: 'File' }],
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
      onRow: g => { UI.drawer(`${M[f]}: ${g.value}`, g.cafs.map((c, i) => `<div class="list-item" data-ci="${i}" style="cursor:pointer">${c.photos && c.photos[0] ? `<img src="${c.photos[0].thumb}" class="caf-mini">` : ''}<div class="grow small"><b class="mono">${esc(c.mobile || '')}</b> · ${esc(c.name || '')}<br>${esc([c.pos_name, c.pos_agent, c.act_date, c.alt && 'Alt ' + c.alt].filter(Boolean).join(' · '))}<br><span class="muted">${esc(c.file)}</span></div></div>`).join('')); $$('#drawer [data-ci]').forEach(d => d.onclick = () => CAF.show(g.cafs[+d.dataset.ci])); } });
  },
  photo(el, L) {
    const all = CAF.photoGroups(), showLogo = !!S.cafLogo, G = all.filter(g => showLogo || !g.logo), hid = all.length - all.filter(g => !g.logo).length;
    const nph = L.reduce((a, c) => a + (c.photos || []).length, 0);
    el.innerHTML = `<div class="card"><h3>Common photo of user</h3><div class="sub">Photos taken out of the CAF PDFs are compared with each other. The same or nearly the same face photo on different CAFs means one person (or one photo) was used for many SIMs. Always check by eye.</div>
      <div class="row small muted" style="margin-top:6px">${fmtNum(nph)} photos in ${fmtNum(L.length)} CAFs · ${G.length} groups${hid ? ` · <label><input type="checkbox" id="cafLogo" ${showLogo ? 'checked' : ''}> show ${hid} image${hid > 1 ? 's' : ''} found on almost every form (logo / stamp)</label>` : ''}</div></div>
      ${G.length ? G.map((g, gi) => `<div class="card caf-grp"><div class="row"><h3 class="grow">Same photo on ${g.n} CAFs${g.logo ? ' <span class="badge">probably a logo</span>' : ''}</h3></div>
        <div class="caf-grid">${g.cafs.map((c, i) => { const it = g.items.find(x => x.c === c); return `<div class="caf-card" data-g="${gi}" data-i="${i}"><img src="${it.ph.thumb}"><div><b class="mono">${esc(c.mobile || ('Scanned: ' + c.file))}</b><br><span class="small">${esc(c.name || '')}</span><br><span class="small muted">${esc([c.pos_name, c.act_date].filter(Boolean).join(' · '))}</span></div></div>`; }).join('')}</div></div>`).join('')
        : `<div class="card muted">${nph ? 'No photo is repeated on two or more CAFs.' : 'No photos found yet. Import CAF PDFs first.'}</div>`}`;
    const lg = $('#cafLogo', el); if (lg) lg.onchange = e => { S.cafLogo = e.target.checked; CafTabs.photo(el, L); };
    $$('.caf-card', el).forEach(d => d.onclick = () => CAF.show(G[+d.dataset.g].cafs[+d.dataset.i]));
  }
};
