/* Search in Local Drive: pick a folder or files on this computer and search inside them.
   Files are read in this browser only. Nothing is uploaded or saved. */
const LocalSearch = (() => {
  const TEXT = /\.(txt|csv|tsv|log|json|xml|html?|eml|md|sql|vcf|ini|cfg|ya?ml)$/i, SHEET = /\.(xlsx|xlsm|xls|xlsb|ods)$/i, PDF = /\.pdf$/i, DOCX = /\.docx$/i;
  const MAXB = 100 * 1024 * 1024;
  let files = [], results = [], skipped = [], stop = false, busy = false;
  const h = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const size = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
  const pathOf = f => f.webkitRelativePath || f.name;
  const tick = () => new Promise(r => setTimeout(r, 0));

  function el() {
    let w = document.getElementById('lsWrap'); if (w) return w;
    w = document.createElement('div'); w.id = 'lsWrap'; w.className = 'ls-wrap';
    w.innerHTML = `<div class="ls-box" role="dialog" aria-label="Search in Local Drive">
      <header class="ls-head"><div><h2>🔎 Search in Local Drive</h2><div class="ls-sub">Choose a folder or files on this computer, then search inside them for a mobile, account, UTR, e-mail, IP, name or any text.</div></div><button class="lg-x" data-x title="Close">✕</button></header>
      <div class="ls-body">
        <div class="ls-pick">
          <label class="btn primary">📁 Choose folder<input type="file" data-dir webkitdirectory directory multiple hidden></label>
          <label class="btn">📄 Choose files<input type="file" data-files multiple hidden></label>
          <span data-chosen class="muted small">No folder or files chosen yet.</span>
        </div>
        <div class="ls-q">
          <textarea data-q rows="2" placeholder="What to search: one or more values, separated by comma or new line. e.g. 9876543210, 50100123456789, abc@ybl"></textarea>
          <div class="ls-opts">
            <label><input type="checkbox" data-dig checked> Numbers: ignore spaces, dashes and +91</label>
            <label><input type="checkbox" data-case> Match capital / small letters exactly</label>
            <span class="spacer"></span>
            <button class="btn primary" data-go>🔍 Search</button><button class="btn hidden" data-stop>■ Stop</button>
          </div>
        </div>
        <div class="ls-prog hidden" data-prog><div class="ls-bar"><i data-bar></i></div><span data-ptxt class="small muted"></span></div>
        <div data-sum></div>
        <div data-res class="ls-res"></div>
        <div class="ls-note small muted">Reads text, CSV, Excel (xlsx / xls), Word (docx), PDF (with text), JSON, XML, HTML and e-mail (.eml) files. Files are read inside this browser only. Nothing is uploaded or saved.</div>
      </div></div>`;
    document.body.appendChild(w);
    const q = s => w.querySelector(s);
    w.onclick = e => { if (e.target === w || e.target.closest('[data-x]')) close(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && w.classList.contains('open')) close(); });
    const take = inp => { files = [...inp.files]; inp.value = ''; const tot = files.reduce((a, f) => a + f.size, 0); const ok = files.filter(f => TEXT.test(f.name) || SHEET.test(f.name) || PDF.test(f.name) || DOCX.test(f.name)).length;
      q('[data-chosen]').innerHTML = `<b>${files.length}</b> files chosen (${size(tot)}), <b>${ok}</b> can be searched${files[0] && files[0].webkitRelativePath ? ' · folder <b>' + h(files[0].webkitRelativePath.split('/')[0]) + '</b>' : ''}`; };
    q('[data-dir]').onchange = e => take(e.target);
    q('[data-files]').onchange = e => take(e.target);
    q('[data-go]').onclick = run;
    q('[data-q]').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || !e.shiftKey)) { e.preventDefault(); run(); } };
    q('[data-stop]').onclick = () => { stop = true; };
    return w;
  }
  function open() { const w = el(); w.classList.add('open'); setTimeout(() => w.querySelector('[data-q]').focus(), 50); }
  function close() { const w = document.getElementById('lsWrap'); if (w) w.classList.remove('open'); stop = true; }

  function matchers(raw, dig, cs) {
    return raw.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean).map(t => {
      let d = t.replace(/\D/g, '');
      const numeric = dig && /^[\d\s\-+().\/]+$/.test(t) && d.length >= 4;
      if (numeric && d.length === 12 && d.startsWith('91')) d = d.slice(2);
      if (numeric && d.length === 11 && d.startsWith('0')) d = d.slice(1);
      const low = cs ? t : t.toLowerCase();
      return { term: t, test: line => numeric ? line.replace(/\D/g, '').includes(d) : (cs ? line : line.toLowerCase()).includes(low), re: numeric ? new RegExp(d.split('').join('[\\s\\-().\\/]*')) : null, find(line) { if (this.re) { const x = this.re.exec(line); return x ? [x.index, x[0].length] : null; } const i = (cs ? line : line.toLowerCase()).indexOf(low); return i < 0 ? null : [i, t.length]; } };
    });
  }
  function snippet(line, m) {
    line = String(line).replace(/\s+/g, ' ').trim();
    const f = m.find(line);
    if (!f) return h(line.length > 220 ? line.slice(0, 220) + '…' : line);
    const [i, n] = f, a = Math.max(0, i - 90), b = Math.min(line.length, i + n + 90);
    return (a ? '…' : '') + h(line.slice(a, i)) + '<mark>' + h(line.slice(i, i + n)) + '</mark>' + h(line.slice(i + n, b)) + (b < line.length ? '…' : '');
  }

  async function units(f) {   // yields [where, text] pieces of a file
    const n = f.name;
    if (TEXT.test(n)) { const t = await f.text(); return t.split(/\r?\n/).map((l, i) => ['Line ' + (i + 1), l]); }
    if (SHEET.test(n)) {
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true, raw: false }); const out = [];
      for (const sn of wb.SheetNames) XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' }).forEach((r, i) => { const t = r.filter(c => c !== '').join(' | '); if (t) out.push([`Sheet "${sn}" · row ${i + 1}`, t]); });
      return out;
    }
    if (DOCX.test(n)) {
      const z = XLSX.CFB.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }); const e = (XLSX.CFB.find(z, '/word/document.xml') || XLSX.CFB.find(z, 'word/document.xml')); if (!e) throw new Error('not a Word file');
      const xml = new TextDecoder().decode(e.content);
      return xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").split('\n').map((l, i) => ['Paragraph ' + (i + 1), l]).filter(x => x[1].trim());
    }
    if (PDF.test(n)) {
      if (!window.pdfjsLib) throw new Error('PDF reader not available');
      const task = pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false });
      task.onPassword = () => { task.destroy(); };
      let pdf; try { pdf = await task.promise; } catch (e) { throw new Error(/password/i.test(e && (e.name + e.message)) ? 'password protected' : 'could not open PDF'); }
      const out = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const tc = await (await pdf.getPage(p)).getTextContent(); const rows = [];
        for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const y = it.transform[5]; let r = rows.find(r => Math.abs(r.y - y) < 3); if (!r) rows.push(r = { y, it: [] }); r.it.push(it); }
        rows.sort((a, b) => b.y - a.y).forEach(r => out.push(['Page ' + p, r.it.sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(' ')]));
      }
      if (!out.length) throw new Error('no text (scanned PDF)');
      return out;
    }
    return null;
  }

  async function run() {
    if (busy) return;
    const w = el(), q = s => w.querySelector(s);
    const ms = matchers(q('[data-q]').value, q('[data-dig]').checked, q('[data-case]').checked);
    if (!ms.length) { q('[data-q]').focus(); q('[data-sum]').innerHTML = '<div class="ls-warn">Type what to search first.</div>'; return; }
    if (!files.length) { q('[data-sum]').innerHTML = '<div class="ls-warn">Choose a folder or files first.</div>'; return; }
    busy = true; stop = false; results = []; skipped = [];
    q('[data-go]').classList.add('hidden'); q('[data-stop]').classList.remove('hidden'); q('[data-prog]').classList.remove('hidden'); q('[data-res]').innerHTML = '';
    let done = 0, read = 0; const t0 = Date.now();
    for (const f of files) {
      if (stop) break;
      done++; q('[data-bar]').style.width = (100 * done / files.length) + '%'; q('[data-ptxt]').textContent = `Reading ${done} of ${files.length} · ${pathOf(f)}`;
      await tick();
      if (f.size > MAXB) { skipped.push([pathOf(f), 'larger than 100 MB']); continue; }
      let u; try { u = await units(f); } catch (e) { skipped.push([pathOf(f), e.message || 'could not read']); continue; }
      if (!u) { skipped.push([pathOf(f), 'file type not supported']); continue; }
      read++;
      for (const [where, line] of u) for (const m of ms) if (line && m.test(line)) results.push({ term: m.term, file: pathOf(f), where, text: line, snip: snippet(line, m) });
      if (results.length > 20000) { skipped.push(['…', 'stopped after 20,000 matches; make the search more specific']); break; }
    }
    busy = false; q('[data-go]').classList.remove('hidden'); q('[data-stop]').classList.add('hidden'); q('[data-prog]').classList.add('hidden');
    show(ms, read, (Date.now() - t0) / 1000);
  }

  function show(ms, read, secs) {
    const w = el(), q = s => w.querySelector(s);
    const per = ms.map(m => { const r = results.filter(x => x.term === m.term); return `<span class="ls-chip ${r.length ? 'hit' : ''}"><b>${h(m.term)}</b> ${r.length ? `${r.length} matches in ${new Set(r.map(x => x.file)).size} files` : 'not found'}</span>`; }).join('');
    q('[data-sum]').innerHTML = `<div class="ls-sum"><div>${per}</div><div class="small muted">${read} files searched in ${secs.toFixed(1)} s${stop ? ' · stopped' : ''}${skipped.length ? ` · <a href="#" data-sk>${skipped.length} skipped</a>` : ''}</div>
      ${results.length ? '<button class="btn sm" data-csv>⬇ CSV of matches</button>' : ''}</div><div class="ls-skip hidden" data-skl>${skipped.map(([p, r]) => `<div><span class="mono">${h(p)}</span> – ${h(r)}</div>`).join('')}</div>`;
    const sk = q('[data-sk]'); if (sk) sk.onclick = e => { e.preventDefault(); q('[data-skl]').classList.toggle('hidden'); };
    const cv = q('[data-csv]'); if (cv) cv.onclick = () => {
      const c = v => '"' + String(v).replace(/"/g, '""') + '"';
      const csv = '﻿' + [['Searched for', 'File', 'Where', 'Text'], ...results.map(r => [r.term, r.file, r.where, r.text])].map(r => r.map(c).join(',')).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'local_drive_search.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    const shown = results.slice(0, 1000);
    q('[data-res]').innerHTML = results.length ? `<table class="ls-tbl"><thead><tr><th>Searched for</th><th>File</th><th>Where</th><th>Text</th></tr></thead><tbody>${shown.map(r => `<tr><td class="mono">${h(r.term)}</td><td class="ls-file">${h(r.file)}</td><td class="nowrap">${h(r.where)}</td><td>${r.snip}</td></tr>`).join('')}</tbody></table>${results.length > shown.length ? `<div class="small muted" style="padding:8px">Showing the first 1,000 of ${results.length.toLocaleString('en-IN')} matches. Download the CSV for all.</div>` : ''}`
      : '<div class="ls-empty">No matches found.</div>';
  }
  return { open, close };
})();
document.querySelectorAll('[data-lsearch]').forEach(b => b.onclick = () => LocalSearch.open());
