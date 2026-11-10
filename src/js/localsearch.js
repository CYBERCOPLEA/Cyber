/* Search in Local Drive
   Add drives, folders or files from this computer and search inside them:
   1) Find specific values (any text, or typed: mobile, account, IFSC, IP, IMEI, MAC, e-mail, UPI, PAN, name)
   2) Common values: every mobile / account / IFSC / IP / IMEI / MAC / e-mail / UPI / PAN found, and which files share them.
   Files are read in this browser only. Nothing is uploaded or saved. */
const LocalSearch = (() => {
  /* ---------- file types ---------- */
  const FT = [
    ['pdf', 'PDF', /\.pdf$/i], ['word', 'Word (.docx)', /\.docx$/i], ['excel', 'Excel (.xlsx / .xls)', /\.(xlsx|xlsm|xls|xlsb|ods)$/i],
    ['csv', 'CSV', /\.(csv|tsv)$/i], ['text', 'Text / Log', /\.(txt|log|md|ini|cfg|sql)$/i], ['mail', 'E-mail (.eml)', /\.eml$/i],
    ['web', 'HTML / JSON / XML', /\.(html?|json|xml|ya?ml|vcf)$/i]
  ];
  const TEXTLIKE = /\.(txt|log|md|ini|cfg|sql|csv|tsv|eml|html?|json|xml|ya?ml|vcf)$/i, SHEET = /\.(xlsx|xlsm|xls|xlsb|ods)$/i, PDF = /\.pdf$/i, DOCX = /\.docx$/i;
  const SKIPDIR = /^(\$recycle\.bin|system volume information|windows|program files( \(x86\))?|programdata|appdata|node_modules|\.git|\.svn|\$windows\.~bt|\$winreagent|recovery|msocache|perflogs|config\.msi|intel|amd|nvidia)$/i;

  /* ---------- value types: how to find them in text and how to compare them ---------- */
  const luhn = s => { let t = 0; for (let i = 0; i < s.length; i++) { let d = +s[s.length - 1 - i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } t += d; } return t % 10 === 0; };
  const T = {
    mobile: { label: 'Mobile', re: /(?<![\dA-Za-z])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\dA-Za-z])/g, norm: v => v.replace(/\D/g, '').slice(-10) },
    account: { label: 'Account / long number', re: /(?<![\dA-Za-z@.])\d{9,18}(?![\dA-Za-z@])/g, norm: v => v.replace(/^0+(?=\d{9})/, ''), ok: v => !(v.length === 10 && /^[6-9]/.test(v)) && !(v.length === 15 && luhn(v)) },
    ifsc: { label: 'IFSC', re: /\b[A-Za-z]{4}0[A-Za-z0-9]{6}\b/g, norm: v => v.toUpperCase(), ok: v => /\d/.test(v.slice(5)) },
    ip: { label: 'IP address', re: /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])|(?<![0-9a-f:])[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}(?![0-9a-f:])/gi, norm: v => v.toLowerCase(),
      ok: v => { if (!v.includes(':')) return !/^0\.|^255\.255/.test(v); const g = v.split(':'); if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(v) || /^\d{1,2}(:\d{1,2}){1,2}$/.test(v) || (v.match(/::/g) || []).length > 1) return false; return (v.includes('::') ? g.filter(Boolean).length >= 2 : g.length === 8) && g.every(x => x.length <= 4) && /[0-9a-f]{3,4}/.test(v); } },
    imei: { label: 'IMEI', re: /(?<!\d)\d{2}[\s-]?\d{6}[\s-]?\d{6}[\s-]?\d(?!\d)/g, norm: v => v.replace(/\D/g, ''), ok: v => v.length === 15 && luhn(v) && !/^0+$/.test(v) },
    mac: { label: 'MAC address', re: /\b[0-9A-Fa-f]{2}([:-])(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2}\b|\b[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\b/g, norm: v => v.replace(/[^0-9a-f]/gi, '').toUpperCase().match(/../g).join(':') },
    email: { label: 'E-mail', re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, norm: v => v.toLowerCase() },
    upi: { label: 'UPI ID', re: /\b[\w.-]{2,}@[a-zA-Z]{2,15}\b(?!\.[a-zA-Z])/g, norm: v => v.toLowerCase() },
    pan: { label: 'PAN', re: /\b[A-Za-z]{3}[PCHFATBLJGpchfatbljg][A-Za-z]\d{4}[A-Za-z]\b/g, norm: v => v.toUpperCase(), ok: v => /^[A-Z]{5}\d{4}[A-Z]$/.test(v) }
  };
  const TYPES = Object.keys(T);
  function extract(line, types) {
    const out = [];
    for (const k of types) { const t = T[k]; t.re.lastIndex = 0; let m; while ((m = t.re.exec(line))) { const v = t.norm(m[0]); if (!v || (t.ok && !t.ok(v))) continue; out.push({ type: k, value: v, i: m.index, n: m[0].length }); } }
    return out;
  }

  /* ---------- state ---------- */
  let sources = [], busy = false, stop = false, mode = 'find', last = null;
  const types = new Set(FT.map(f => f[0])), commonTypes = new Set(['mobile', 'account', 'ifsc', 'ip', 'imei', 'mac', 'email', 'upi', 'pan']);
  const h = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const size = n => n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
  const num = n => Number(n).toLocaleString('en-IN');
  const tick = () => new Promise(r => setTimeout(r, 0));
  const wantFile = name => FT.some(([k, , re]) => types.has(k) && re.test(name));

  /* ---------- speed: quick "can this file match?" check, and a memory of already-read files ---------- */
  const fold = v => String(v || '').toLowerCase().replace(/[\s\-.()+,_\/:|'"\\]/g, '');
  const ent = t => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  function prefilter(ms) {
    if (!ms) return null; const keys = ms.map(m => m.key || ''); if (keys.some(k => k.length < 3)) return null;
    const numeric = ms.some(m => /^\d+$/.test(m.key));
    return text => { const f = fold(text); return keys.some(k => f.includes(k)) || (numeric && /\d\.\d+e\+?\d+/i.test(text)); };
  }
  /* text inside an .xlsx / .docx / .ods (they are zip files) without building the whole table */
  async function zipText(f) {
    try { const z = XLSX.CFB.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }); let t = '';
      for (let i = 0; i < z.FileIndex.length; i++) { const e = z.FileIndex[i], n = z.FullPaths[i] || e.name || ''; if (!e.content || !/(sharedStrings|sheet\d*|document|content|header\d*|footer\d*)\.xml$/i.test(n)) continue; t += ent(new TextDecoder().decode(e.content).replace(/<[^>]+>/g, '')) + '\n'; }
      return t; } catch (e) { return null; }
  }
  const Mem = {
    db: null, on: true,
    open() { if (this.db || !window.indexedDB) return Promise.resolve(this.db); return new Promise(res => { const r = indexedDB.open('sud-lsc', 1); r.onupgradeneeded = () => r.result.createObjectStore('u'); r.onsuccess = () => res(this.db = r.result); r.onerror = () => res(null); }); },
    async get(k) { if (!this.on) return null; const db = await this.open(); if (!db) return null; return new Promise(res => { try { const q = db.transaction('u').objectStore('u').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); },
    async put(k, u) { if (!this.on) return; const db = await this.open(); if (!db) return; let n = 0; for (const x of u) n += x[1].length; if (n > 30e6) return; try { db.transaction('u', 'readwrite').objectStore('u').put(u, k); } catch (e) { } },
    async clear() { const db = await this.open(); if (db) try { db.transaction('u', 'readwrite').objectStore('u').clear(); } catch (e) { } }
  };

  /* ---------- reading one file into [where, text] pieces ---------- */
  async function units(f) {
    const n = f.name;
    if (SHEET.test(n)) {
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true, raw: false }); const out = [];
      for (const sn of wb.SheetNames) XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' }).forEach((r, i) => { const t = r.filter(c => c !== '').join(' | '); if (t) out.push([`Sheet "${sn}" · row ${i + 1}`, t]); });
      return out;
    }
    if (DOCX.test(n)) {
      const z = XLSX.CFB.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }); const e = XLSX.CFB.find(z, '/word/document.xml') || XLSX.CFB.find(z, 'word/document.xml'); if (!e) throw new Error('not a Word file');
      const xml = new TextDecoder().decode(e.content);
      return xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").split('\n').map((l, i) => ['Paragraph ' + (i + 1), l]).filter(x => x[1].trim());
    }
    if (PDF.test(n)) {
      if (!window.pdfjsLib) throw new Error('PDF reader not available');
      const task = pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false });
      task.onPassword = () => { task.destroy(); };
      let pdf; try { pdf = await task.promise; } catch (e) { throw new Error(/password/i.test(e && (e.name + e.message)) ? 'password protected PDF' : 'could not open PDF'); }
      const out = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const tc = await (await pdf.getPage(p)).getTextContent(); const rows = [];
        const byY = new Map(); for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const y = it.transform[5], k = Math.round(y / 3); let r = byY.get(k) || byY.get(k - 1) || byY.get(k + 1); if (!r) { byY.set(k, r = { y, it: [] }); rows.push(r); } r.it.push(it); }
        rows.sort((a, b) => b.y - a.y).forEach(r => out.push(['Page ' + p, r.it.sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(' ')]));
      }
      try { pdf.destroy(); } catch (e) { }
      if (!out.length) throw new Error('scanned PDF (no text)');
      return out;
    }
    if (TEXTLIKE.test(n)) { let t = await f.text(); if (/\.html?$/i.test(n)) t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' '); return t.split(/\r?\n/).map((l, i) => ['Line ' + (i + 1), l]); }
    return null;
  }

  /* ---------- walking the chosen places ---------- */
  async function* walk(src, ctr, skipSys) {
    if (src.kind === 'files') { for (const f of src.files) { if (stop) return; ctr.seen++; yield { file: () => f, name: f.name, path: (f.webkitRelativePath || f.name) }; } return; }
    const stack = [[src.handle, src.name]];
    while (stack.length) {
      if (stop) return;
      const [dir, path] = stack.pop(); ctr.folders++;
      try {
        for await (const e of dir.values()) {
          if (stop) return;
          if (e.kind === 'directory') { if (!(skipSys && SKIPDIR.test(e.name))) stack.push([e, path + '/' + e.name]); else ctr.skipDirs++; }
          else { ctr.seen++; yield { file: () => e.getFile(), name: e.name, path: path + '/' + e.name }; }
          if (ctr.seen % 400 === 0) await tick();
        }
      } catch (err) { ctr.denied.push(path); }
    }
  }

  /* ---------- the window ---------- */
  function el() {
    let w = document.getElementById('lsWrap'); if (w) return w;
    w = document.createElement('div'); w.id = 'lsWrap'; w.className = 'ls-wrap';
    w.innerHTML = `<div class="ls-box" role="dialog" aria-label="Search in Local Drive">
      <header class="ls-head"><span class="ls-hico">🔎</span><div><h2>Search in Local Drive</h2><div class="ls-sub">Search inside the files on this computer. Files are read in this browser only – nothing is uploaded.</div></div><button class="lg-x" data-x title="Close (Esc)">✕</button></header>
      <div class="ls-body">
        <section class="ls-step"><div class="ls-num">1</div><div class="ls-sec">
          <div class="ls-t">Where to search</div>
          <div class="ls-drives"><span class="ls-dl">Select hard drive</span>
            <label class="ls-drv on" data-dlab="pc"><input type="checkbox" data-pc checked><span class="ls-dbox"></span><span class="ls-dic">🖥️</span><span><b>Whole PC</b><small>Every drive you add (C:, D:, E:…) · remembered for next time</small></span></label>
          </div>
          <div class="ls-guide hidden" data-guide></div>
          <div class="ls-drop" data-drop>
            <button class="btn primary" data-adddir>💽 Add drive / folder</button>
            <button class="btn" data-addfiles>📄 Add files</button>
            <span class="small muted">or drag folders and files here · add as many as you need</span>
            <input type="file" data-dirin webkitdirectory directory multiple hidden><input type="file" data-filein multiple hidden>
          </div>
          <div class="ls-srcs" data-srcs></div>
          <details class="ls-help"><summary>How to add a drive</summary>
            <div>Click <i>Add drive / folder</i> → <b>This PC</b> → pick the drive (e.g. <b>OFFICE (D:)</b>) → <b>Select folder</b>. Windows does not let a browser open the whole C: drive: add <b>Desktop, Documents, Downloads</b> instead. Press <b>Stop</b> any time to see what was found so far.</div></details>
          <div class="ls-opts"><label><input type="checkbox" data-skipsys checked> Skip system & program folders (Windows, Program Files, AppData…)</label>
            <label title="The text of PDF, Excel and Word files is kept in this browser on this computer, so the next search skips re-reading them. Changed files are read again."><input type="checkbox" data-mem checked> ⚡ Fast repeat search (remember file text on this computer)</label> <a href="#" data-memclr class="small">Clear memory</a>
            <label>Skip files bigger than <select data-max><option value="10">10 MB</option><option value="50">50 MB</option><option value="100" selected>100 MB</option><option value="500">500 MB</option></select></label></div>
        </div></section>
        <section class="ls-step"><div class="ls-num">2</div><div class="ls-sec">
          <div class="ls-t">File types</div>
          <div class="ls-chips" data-types><button class="ls-chip on" data-all>All types</button>${FT.map(([k, l]) => `<button class="ls-chip on" data-ft="${k}">${l}</button>`).join('')}</div>
        </div></section>
        <section class="ls-step"><div class="ls-num">3</div><div class="ls-sec">
          <div class="ls-t">What to search</div>
          <div class="ls-modes"><button class="ls-mode on" data-mode="find"><b>Find specific values</b><span>Numbers, accounts, names or any text you type</span></button><button class="ls-mode" data-mode="common"><b>Common values across files</b><span>Every mobile, account, IFSC, IP, IMEI, MAC… and which files share them</span></button></div>
          <div data-pfind>
            <div class="ls-findrow"><label>Search as</label><select data-qtype><option value="any">Any text</option>${TYPES.map(k => `<option value="${k}">${T[k].label}</option>`).join('')}<option value="name">Name / words</option></select>
              <span class="small muted" data-qhelp></span></div>
            <textarea data-q rows="3" placeholder="Type one or more values – one per line or separated by commas.&#10;e.g. 9876543210, 50100123456789, SBIN0001234, 49.36.1.2, Ravi Kumar"></textarea>
            <div class="ls-opts"><label><input type="checkbox" data-case> Match capital / small letters exactly (Any text only)</label></div>
          </div>
          <div data-pcommon class="hidden">
            <div class="ls-chips" data-ctypes>${TYPES.map(k => `<button class="ls-chip on" data-ct="${k}">${T[k].label}</button>`).join('')}</div>
            <div class="ls-opts"><label>Show values found in at least <select data-cmin><option value="1">1 file (everything)</option><option value="2" selected>2 files (common)</option><option value="3">3 files</option><option value="5">5 files</option></select></label></div>
          </div>
          <div class="ls-go"><button class="btn primary big" data-go>🔍 Start search</button><button class="btn big hidden" data-stop>■ Stop</button><span class="small muted" data-hint></span></div>
        </div></section>
        <div class="ls-prog hidden" data-prog><div class="ls-bar"><i data-bar></i></div><div class="small" data-ptxt></div><div class="small muted ls-cur" data-pcur></div></div>
        <div data-sum></div>
        <div data-res></div>
        <div data-det></div>
      </div></div>`;
    document.body.appendChild(w);
    const q = s => w.querySelector(s);
    w.onclick = e => { if (e.target === w || e.target.closest('[data-x]')) close(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && w.classList.contains('open')) close(); });
    // places
    q('[data-adddir]').onclick = async () => {
      if (window.showDirectoryPicker) {
        try { const hd = await window.showDirectoryPicker({ id: 'lsearch', mode: 'read' }); addSrc({ kind: 'dir', handle: hd, name: hd.name || 'Drive' }); if (q('[data-pc]').checked) putH('pc-' + hd.name, hd); }
        catch (e) { if (e && e.name !== 'AbortError') note(`The browser did not allow that folder${e.message ? ' (' + h(e.message) + ')' : ''}. This happens for the whole C: drive and Windows system folders – add the folders inside it instead (Desktop, Documents, Downloads…).`); }
      } else q('[data-dirin]').click();
    };
    q('[data-addfiles]').onclick = () => q('[data-filein]').click();
    // each drive is remembered on this computer (IndexedDB), so the next time it opens straight away – no window
    const idb = (mode, fn) => new Promise((res, rej) => {
      const r = indexedDB.open('sud-ls', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('h');
      r.onerror = () => rej(r.error);
      r.onsuccess = () => { const db = r.result; let tx, rq; try { tx = db.transaction('h', mode); rq = fn(tx.objectStore('h')); } catch (e) { db.close(); rej(e); return; } tx.oncomplete = () => { db.close(); res(rq ? rq.result : undefined); }; tx.onerror = () => { db.close(); rej(tx.error); }; };
    });
    const getH = L => window.indexedDB ? idb('readonly', st => st.get('drive-' + L)).catch(() => null) : Promise.resolve(null);
    const putH = (L, hd) => window.indexedDB ? idb('readwrite', st => { st.put(hd, 'drive-' + L); }).catch(() => { }) : Promise.resolve();
    const guide = (html, kind = 'info') => { const g = q('[data-guide]'); if (!html) { g.classList.add('hidden'); return; } g.className = 'ls-guide ' + kind; g.innerHTML = html; };
    // Whole PC: reuse every drive / folder remembered on this computer, else ask for one
    const wholePc = async () => {
      let hs = []; try { hs = window.indexedDB ? await idb('readonly', st => st.getAll()) : []; } catch (e) { }
      const seen = new Set();
      for (const hd of hs || []) {
        if (!hd || hd.kind !== 'directory' || seen.has(hd.name)) continue; seen.add(hd.name);
        try { let pm = await hd.queryPermission({ mode: 'read' }); if (pm !== 'granted') pm = await hd.requestPermission({ mode: 'read' }); if (pm === 'granted') addSrc({ kind: 'dir', handle: hd, name: (hd.name || 'Drive') + ' · remembered', drive: 'pc' }); } catch (e) { }
      }
      if (sources.length) { guide(`✔ Searching ${sources.length} remembered drive(s) / folder(s). Add more with <b>Add drive / folder</b>.`, 'ok'); return; }
      guide('<b>Pick a drive:</b> in the window click <b>This PC</b> → a drive (e.g. <b>OFFICE (D:)</b>) → <b>Select Folder</b>. Each drive you add is remembered, so next time the whole PC is searched straight away.');
      if (window.showDirectoryPicker) { try { const hd = await window.showDirectoryPicker({ id: 'lsearch', mode: 'read' }); addSrc({ kind: 'dir', handle: hd, name: hd.name || 'Drive', drive: 'pc' }); putH('pc-' + hd.name, hd); } catch (e) { } }
      else q('[data-dirin]').click();
    };
    q('[data-pc]').onchange = () => syncDrives();
    const fromInput = inp => { const fs = [...inp.files], pt = pendingTag; pendingTag = null; inp.value = ''; if (!fs.length) return; const root = fs[0].webkitRelativePath ? fs[0].webkitRelativePath.split('/')[0] : (fs.length === 1 ? fs[0].name : fs.length + ' files'); addSrc({ kind: 'files', files: fs, name: (pt && pt.label ? pt.label + ' · ' : '') + root, count: fs.length, bytes: fs.reduce((a, f) => a + f.size, 0), drive: pt ? pt.tag : undefined }); syncDrives(); };
    q('[data-dirin]').onchange = e => fromInput(e.target);
    q('[data-filein]').onchange = e => fromInput(e.target);
    const dz = q('[data-drop]');
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
    dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = async e => {
      e.preventDefault(); dz.classList.remove('over');
      const items = [...(e.dataTransfer.items || [])], loose = [];
      for (const it of items) {
        if (it.kind !== 'file') continue;
        if (it.getAsFileSystemHandle) { try { const hd = await it.getAsFileSystemHandle(); if (hd && hd.kind === 'directory') { addSrc({ kind: 'dir', handle: hd, name: hd.name }); continue; } } catch (err) { } }
        const f = it.getAsFile(); if (f) loose.push(f);
      }
      if (loose.length) addSrc({ kind: 'files', files: loose, name: loose.length === 1 ? loose[0].name : loose.length + ' files', count: loose.length, bytes: loose.reduce((a, f) => a + f.size, 0) });
    };
    // types
    q('[data-all]').onclick = () => { const on = types.size !== FT.length; FT.forEach(([k]) => on ? types.add(k) : types.delete(k)); syncTypes(); };
    w.querySelectorAll('[data-ft]').forEach(b => b.onclick = () => { const k = b.dataset.ft; types.has(k) ? types.delete(k) : types.add(k); syncTypes(); });
    w.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { const k = b.dataset.ct; commonTypes.has(k) ? commonTypes.delete(k) : commonTypes.add(k); b.classList.toggle('on', commonTypes.has(k)); });
    // modes
    w.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; w.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b)); q('[data-pfind]').classList.toggle('hidden', mode !== 'find'); q('[data-pcommon]').classList.toggle('hidden', mode !== 'common'); });
    const HELP = { any: 'Finds the text anywhere. Numbers are matched even with spaces or dashes.', mobile: 'Matches +91 98765-43210, 098765 43210 …', account: 'Digits only; leading zeros ignored.', ifsc: 'e.g. SBIN0001234', ip: 'IPv4 or IPv6, exact address', imei: '15 digits, spaces allowed', mac: 'AA:BB:CC:DD:EE:FF, AA-BB-…, aabb.ccdd.eeff', email: 'Exact e-mail address', upi: 'e.g. name@ybl', pan: 'e.g. ABCDE1234F', name: 'All words in this order, any spacing or case' };
    const qt = q('[data-qtype]'); qt.onchange = () => q('[data-qhelp]').textContent = HELP[qt.value] || ''; qt.onchange();
    q('[data-memclr]').onclick = async e => { e.preventDefault(); await Mem.clear(); note('Search memory cleared.', false); };
    q('[data-go]').onclick = async () => { if (!sources.length && q('[data-pc]').checked) await wholePc(); run(); };
    q('[data-stop]').onclick = () => { stop = true; };
    q('[data-q]').onkeydown = e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); run(); } };
    drawSrcs(); syncTypes();
    return w;
  }
  function note(html, bad = true) { const w = el(); w.querySelector('[data-hint]').innerHTML = `<span class="${bad ? 'err' : ''}">${html}</span>`; }
  function addSrc(s) { sources.push(s); drawSrcs(); note('', false); }
  let pendingTag = null;
  const hasDrive = d => sources.some(s => s.drive && s.drive.startsWith(d));
  function dropDrive(d) { sources = sources.filter(s => !(s.drive && s.drive.startsWith(d))); drawSrcs(); }
  function syncDrives() { const cb = el().querySelector('[data-pc]'); if (cb) cb.parentElement.classList.toggle('on', cb.checked); }
  function drawSrcs() {
    const box = el().querySelector('[data-srcs]');
    box.innerHTML = sources.length ? sources.map((s, i) => `<span class="ls-src">${s.kind === 'dir' ? '💽' : '📄'} <b>${h(s.name)}</b>${s.kind === 'files' ? ` <span class="muted">${num(s.count)} files · ${size(s.bytes)}</span>` : ' <span class="muted">folder · all sub-folders</span>'}<button data-rm="${i}" title="Remove">✕</button></span>`).join('') + '<button class="btn sm" data-clr>Clear all</button>'
      : '<span class="small muted">Nothing added yet.</span>';
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { sources.splice(+b.dataset.rm, 1); drawSrcs(); syncDrives(); });
    const c = box.querySelector('[data-clr]'); if (c) c.onclick = () => { sources = []; drawSrcs(); syncDrives(); };
  }
  function syncTypes() { const w = el(); w.querySelectorAll('[data-ft]').forEach(b => b.classList.toggle('on', types.has(b.dataset.ft))); w.querySelector('[data-all]').classList.toggle('on', types.size === FT.length); }
  function open() { el().classList.add('open'); }
  function close() { const w = document.getElementById('lsWrap'); if (w) w.classList.remove('open'); }

  /* ---------- matchers for "Find specific values" ---------- */
  function matchers(raw, qtype, cs) {
    const vals = raw.split(qtype === 'name' || qtype === 'any' ? /[\n;]+|,(?!\d{3})/ : /[\n,;]+/).map(s => s.trim()).filter(Boolean);
    return vals.map(t => {
      if (qtype !== 'any' && qtype !== 'name') {
        const want = T[qtype].norm(t.trim()) || t;
        return { term: t, key: fold(want), find: line => { const hit = extract(line, [qtype]).find(x => x.value === want); return hit ? [hit.i, hit.n] : null; } };
      }
      if (qtype === 'name') { const re = new RegExp(t.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s.,_-]+'), 'i'); return { term: t, key: fold(t), find: line => { const m = re.exec(line); return m ? [m.index, m[0].length] : null; } }; }
      const d = t.replace(/\D/g, ''), numeric = /^[\d\s\-+().\/]+$/.test(t) && d.length >= 4;
      if (numeric) { let dd = d; if (dd.length === 12 && dd.startsWith('91')) dd = dd.slice(2); const re = new RegExp('(?<!\\d)' + dd.split('').join('[\\s\\-().\\/]*') + '(?!\\d)'); return { term: t, key: dd, num: 1, find: line => { const m = re.exec(line); return m ? [m.index, m[0].length] : null; } }; }
      const low = cs ? t : t.toLowerCase();
      return { term: t, key: fold(t), find: line => { const i = (cs ? line : line.toLowerCase()).indexOf(low); return i < 0 ? null : [i, t.length]; } };
    });
  }
  function snip(line, i, n) {
    line = String(line); const a = Math.max(0, i - 90), b = Math.min(line.length, i + n + 90);
    return (a ? '…' : '') + h(line.slice(a, i)).replace(/\s+/g, ' ') + '<mark>' + h(line.slice(i, i + n)) + '</mark>' + h(line.slice(i + n, b)).replace(/\s+/g, ' ') + (b < line.length ? '…' : '');
  }

  /* ---------- the search ---------- */
  async function run() {
    if (busy) return;
    const w = el(), q = s => w.querySelector(s);
    if (!sources.length) return note('Add a drive, folder or files first (step 1).');
    if (!types.size) return note('Pick at least one file type (step 2).');
    let ms = null, ctypes = null;
    if (mode === 'find') { ms = matchers(q('[data-q]').value, q('[data-qtype]').value, q('[data-case]').checked); if (!ms.length) { q('[data-q]').focus(); return note('Type what to search (step 3).'); } }
    else { ctypes = [...commonTypes]; if (!ctypes.length) return note('Pick at least one value type.'); }
    note('', false);
    busy = true; stop = false;
    const maxB = +q('[data-max]').value * 1024 * 1024, skipSys = q('[data-skipsys]').checked;
    const ctr = { seen: 0, folders: 0, skipDirs: 0, denied: [], read: 0, skipped: [], bytes: 0, mem: 0, quick: 0 };
    const hits = [], V = new Map(), t0 = Date.now();
    q('[data-go]').classList.add('hidden'); q('[data-stop]').classList.remove('hidden'); q('[data-prog]').classList.remove('hidden');
    q('[data-res]').innerHTML = ''; q('[data-det]').innerHTML = ''; q('[data-sum]').innerHTML = '';
    let lastPaint = 0;
    const paint = (cur, force) => { const now = Date.now(); if (!force && now - lastPaint < 150) return; lastPaint = now;
      q('[data-ptxt]').innerHTML = `<b>${num(ctr.read)}</b> files searched · ${num(ctr.seen)} files looked at · ${num(ctr.folders)} folders · ${mode === 'find' ? `<b>${num(hits.length)}</b> matches` : `<b>${num(V.size)}</b> values found`} · ${((now - t0) / 1000).toFixed(0)} s`;
      q('[data-pcur]').textContent = cur || ''; q('[data-bar]').style.width = (Math.min(98, 8 + Math.log10(1 + ctr.read) * 25)) + '%'; };
    const pre = prefilter(ms), HEAVY = /\.(pdf|docx|xlsx|xlsm|xls|xlsb|ods)$/i, ZIP = /\.(xlsx|xlsm|docx|ods)$/i;
    Mem.on = q('[data-mem]').checked;
    const scan = (it, u) => {
      for (const [where, line] of u) {
        if (!line) continue;
        if (ms) { for (const m of ms) { const r = m.find(line); if (r) hits.push({ term: m.term, file: it.path, where, text: String(line).replace(/\s+/g, ' ').trim(), snip: snip(line, r[0], r[1]) }); } }
        else for (const x of extract(line, ctypes)) {
          const k = x.type + '|' + x.value; let g = V.get(k); if (!g) V.set(k, g = { type: x.type, value: x.value, n: 0, files: new Set(), occ: [] });
          g.n++; g.files.add(it.path); if (g.occ.length < 60) g.occ.push({ file: it.path, where, snip: snip(line, x.i, x.n) });
        }
        if ((ms && hits.length > 50000) || V.size > 300000) { ctr.skipped.push(['…', 'stopped early: too many results – make the search narrower']); stop = true; return; }
      }
    };
    const one = async it => {
      let f; try { f = await it.file(); } catch (e) { ctr.skipped.push([it.path, 'cannot open']); return; }
      if (f.size > maxB) { ctr.skipped.push([it.path, 'bigger than ' + size(maxB)]); return; }
      const n = it.name, key = it.path + '|' + f.size + '|' + f.lastModified, done = () => { ctr.read++; ctr.bytes += f.size; };
      let u = HEAVY.test(n) ? await Mem.get(key) : null;
      if (u) { ctr.mem++; if (pre && !pre(u.map(x => x[1]).join('\n'))) return done(); }
      else {
        if (pre && ZIP.test(n)) { const t = await zipText(f); if (t != null && !pre(t)) { ctr.quick++; return done(); } }
        if (pre && TEXTLIKE.test(n)) { const t = await f.text(); if (!pre(t)) { ctr.quick++; return done(); } }
        try { u = await units(f); } catch (e) { ctr.skipped.push([it.path, e.message || 'could not read']); return; }
        if (!u) return;
        if (HEAVY.test(n)) Mem.put(key, u);
      }
      done(); scan(it, u);
    };
    const live = new Set(); let yieldAt = Date.now();
    outer: for (const src of sources) {
      for await (const it of walk(src, ctr, skipSys)) {
        if (stop) break outer;
        if (!wantFile(it.name)) continue;
        paint(it.path);
        const pr = one(it).catch(() => { }).finally(() => live.delete(pr)); live.add(pr);
        if (live.size >= 6) await Promise.race(live);
        if (Date.now() - yieldAt > 60) { await tick(); yieldAt = Date.now(); }
      }
    }
    await Promise.all(live);
    paint('', true);
    busy = false; q('[data-go]').classList.remove('hidden'); q('[data-stop]').classList.add('hidden');
    q('[data-bar]').style.width = '100%'; q('[data-pcur]').textContent = stop ? 'Stopped. Results so far are shown below.' : 'Finished.';
    last = { mode, ms, hits, V, ctr, secs: (Date.now() - t0) / 1000 };
    show();
  }

  function table(host, rows, cols, name, onRow) {
    if (typeof Table === 'function') return Table(host, { rows, columns: cols, exportName: name, pageSize: 100, sortKey: cols.find(c => c.num) ? cols.find(c => c.num).key : null, sortDir: -1, onRow });
    host.innerHTML = '<table class="ls-tbl"><tbody>' + rows.slice(0, 500).map(r => '<tr>' + cols.map(c => `<td>${c.render ? c.render(r) : h(r[c.key])}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
  }
  function show() {
    const w = el(), q = s => w.querySelector(s), L = last, c = L.ctr;
    const extra = `${num(c.read)} files searched (${size(c.bytes)}) in ${L.secs.toFixed(1)} s${c.mem ? ` · ⚡ ${num(c.mem)} from memory` : ''}${c.quick ? ` · ${num(c.quick)} ruled out by a quick check` : ''}${stop ? ' · stopped' : ''}${c.skipDirs ? ` · ${num(c.skipDirs)} system folders skipped` : ''}${c.skipped.length ? ` · <a href="#" data-sk>${num(c.skipped.length)} files not read</a>` : ''}${c.denied.length ? ` · <a href="#" data-dn>${num(c.denied.length)} folders not allowed</a>` : ''}`;
    const skl = `<div class="ls-skip hidden" data-skl>${c.skipped.slice(0, 2000).map(([p, r]) => `<div><span class="mono">${h(p)}</span> – ${h(r)}</div>`).join('')}</div><div class="ls-skip hidden" data-dnl>${c.denied.slice(0, 500).map(p => `<div class="mono">${h(p)}</div>`).join('')}</div>`;
    if (L.mode === 'find') {
      const per = L.ms.map(m => { const r = L.hits.filter(x => x.term === m.term); return `<span class="ls-pill ${r.length ? 'hit' : ''}"><b>${h(m.term)}</b> ${r.length ? `${num(r.length)} matches · ${num(new Set(r.map(x => x.file)).size)} files` : 'not found'}</span>`; }).join('');
      q('[data-sum]').innerHTML = `<div class="ls-sum"><div>${per}</div><div class="small muted">${extra}</div></div>${skl}`;
      if (L.hits.length) table(q('[data-res]'), L.hits, [{ key: 'term', label: 'Searched for', render: r => `<span class="mono">${h(r.term)}</span>` }, { key: 'file', label: 'File', render: r => `<span class="ls-file">${h(r.file)}</span>` }, { key: 'where', label: 'Where' }, { key: 'text', label: 'Text', render: r => r.snip }], 'local_drive_search');
      else q('[data-res]').innerHTML = '<div class="ls-empty">No matches found.</div>';
    } else {
      const min = +q('[data-cmin]').value;
      const rows = [...L.V.values()].filter(g => g.files.size >= min).map(g => ({ type: T[g.type].label, value: g.value, files: g.files.size, n: g.n, fileList: [...g.files].join(' | '), g }));
      const byType = {}; rows.forEach(r => byType[r.type] = (byType[r.type] || 0) + 1);
      q('[data-sum]').innerHTML = `<div class="ls-sum"><div>${Object.entries(byType).map(([t, n]) => `<span class="ls-pill hit"><b>${num(n)}</b> ${h(t)}</span>`).join('') || '<span class="ls-pill">nothing common found</span>'}</div><div class="small muted">${num(L.V.size)} different values found · showing those in ≥ ${min} file${min > 1 ? 's' : ''} · ${extra}</div></div>${skl}`;
      if (rows.length) table(q('[data-res]'), rows, [{ key: 'value', label: 'Value', render: r => `<b class="mono">${h(r.value)}</b>` }, { key: 'type', label: 'Type' }, { key: 'files', label: 'Files', num: true }, { key: 'n', label: 'Times', num: true }, { key: 'fileList', label: 'Found in', render: r => `<span class="small ls-file">${h(r.fileList.slice(0, 220))}${r.fileList.length > 220 ? '…' : ''}</span>` }], 'local_drive_common',
        r => { q('[data-det]').innerHTML = `<div class="ls-detail"><div class="row"><h3 class="grow">${h(r.type)} <span class="mono">${h(r.value)}</span> · ${num(r.files)} files · ${num(r.n)} times</h3><button class="btn sm" data-dclose>✕</button></div><table class="ls-tbl"><thead><tr><th>File</th><th>Where</th><th>Text</th></tr></thead><tbody>${r.g.occ.map(o => `<tr><td class="ls-file">${h(o.file)}</td><td class="nowrap">${h(o.where)}</td><td>${o.snip}</td></tr>`).join('')}</tbody></table>${r.n > r.g.occ.length ? `<div class="small muted">First ${r.g.occ.length} of ${num(r.n)} shown.</div>` : ''}</div>`; q('[data-dclose]').onclick = () => q('[data-det]').innerHTML = ''; q('[data-det]').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      else q('[data-res]').innerHTML = '<div class="ls-empty">No value is common to that many files. Try "at least 1 file".</div>';
      q('[data-cmin]').onchange = () => last && last.mode === 'common' && show();
    }
    const sk = q('[data-sk]'); if (sk) sk.onclick = e => { e.preventDefault(); q('[data-skl]').classList.toggle('hidden'); };
    const dn = q('[data-dn]'); if (dn) dn.onclick = e => { e.preventDefault(); q('[data-dnl]').classList.toggle('hidden'); };
  }
  return { open, close, _add: addSrc, _T: T, _extract: extract };
})();
