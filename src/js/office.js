/* office.js - Office › SOP: keep SOPs and guidelines by authority (TRAI & DoT, RBI, MHA-I4C, UP-DGP & S4C, Comm. GZB).
   Files stay in this browser (IndexedDB), apart from the case data. */
'use strict';

const SOP = {
  CATS: [
    ['tele', 'TRAI & DOT-Telecom', '#0ea5e9', 'Telecom: TRAI, DoT, SIM / CAF, CDR, bulk SMS'],
    ['rbi', 'RBI-Financial', '#10b981', 'Banks, payment apps, lien / freeze, refund'],
    ['i4c', 'MHA-I4C', '#f97316', 'NCRP, CFCFRMS, Sahyog, I4C advisories'],
    ['dgp', 'UP-DGP & S4C', '#8b5cf6', 'UP Police HQ and State Cyber Crime Coordination Centre'],
    ['gzb', 'Comm. GZB', '#ec4899', 'Commissionerate Ghaziabad orders and circulars']
  ],
  list: null,
  cat(id) { return this.CATS.find(c => c[0] === id); },
  async load() { if (!this.list) { try { this.list = (await DB.get('sop:list')) || []; } catch (e) { this.list = []; } } return this.list; },
  async saveList() { await DB.set('sop:list', this.list); },
  size(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; },
  kind(name) { const e = (String(name).split('.').pop() || '').toLowerCase(); return e === 'pdf' ? 'PDF' : /^(docx?|odt|rtf)$/.test(e) ? 'Word' : /^(xlsx?|csv|ods)$/.test(e) ? 'Excel' : /^(pptx?)$/.test(e) ? 'PPT' : /^(jpe?g|png|gif|webp|bmp)$/.test(e) ? 'Image' : /^(txt|html?)$/.test(e) ? 'Text' : (e || 'File').toUpperCase(); },
  async add(cat, files, meta) {
    await this.load();
    for (const f of files) {
      const id = uid();
      await DB.set('sopf:' + id, f);
      this.list.push({ id, cat, title: (files.length === 1 && meta.title) || f.name.replace(/\.[^.]+$/, ''), name: f.name, type: f.type, size: f.size, ref: meta.ref || '', date: meta.date || '', note: meta.note || '', added: new Date().toISOString() });
    }
    await this.saveList();
  },
  async remove(id) { await this.load(); this.list = this.list.filter(x => x.id !== id); await DB.del('sopf:' + id); await this.saveList(); },
  async file(id) { return DB.get('sopf:' + id); },
  async open(id) {
    const x = this.list.find(r => r.id === id), f = await this.file(id); if (!f) return UI.toast('File not found');
    const w = window.open(URL.createObjectURL(f instanceof Blob ? f : new Blob([f], { type: x.type })), '_blank');
    if (!w) UI.toast('Allow pop-ups to open the file, or use Download');
  },
  async download(id) { const x = this.list.find(r => r.id === id), f = await this.file(id); if (!f) return UI.toast('File not found'); UI.download(x.name, f instanceof Blob ? f : new Blob([f], { type: x.type })); }
};

PAGE_META.office = { group: 'Office', title: 'SOP', desc: 'Standard Operating Procedures, guidelines and circulars, kept by authority. Upload once, then open or download any time. Files stay on this computer.',
  order: ['all', ...SOP.CATS.map(c => c[0]), 'upload'], names: { all: 'All SOPs', upload: '⬆ Upload SOP' } };

Pages.office = function (main) {
  if (!SOP.list) { main.innerHTML = '<div class="card muted">Loading SOPs…</div>'; SOP.load().then(() => { if (S.page === 'office') render(); }); return; }
  const L = SOP.list, cnt = id => L.filter(x => x.cat === id).length;
  const { cur, body } = tabs(main, 'office', [['all', `All SOPs (${L.length})`], ...SOP.CATS.map(c => [c[0], `${c[1]}${cnt(c[0]) ? ` (${cnt(c[0])})` : ''}`]), ['upload', 'Upload SOP']], 'SOP',
    `<button class="btn primary" id="sopUp">⬆ Upload SOP</button>`);
  $('#sopUp', main).onclick = () => { S.sopCat = SOP.cat(cur) ? cur : S.sopCat; S.sub.office = 'upload'; render(); };
  if (cur === 'upload') return SOP.uploadView(body);
  SOP.listView(body, cur);
};

SOP.uploadView = function (body) {
  const pre = S.sopCat || '';
  body.innerHTML = `<div class="card sop-up"><h3>Upload SOP</h3><div class="sub">Choose the section, then pick one or more files (PDF, Word, Excel, image…). They are saved in this browser only.</div>
    <div class="sop-form">
      <label class="sop-wide">Section<select id="sopCat"><option value="">— choose section —</option>${SOP.CATS.map(c => `<option value="${c[0]}" ${c[0] === pre ? 'selected' : ''}>${esc(c[1])}</option>`).join('')}</select></label>
      <label class="sop-wide">Title<input id="sopTitle" placeholder="e.g. SOP for blocking of mobile numbers (leave blank to use the file name)"></label>
      <label>Letter / Ref No<input id="sopRef" placeholder="optional"></label>
      <label>Dated<input id="sopDate" type="date"></label>
      <label class="sop-wide">Note<input id="sopNote" placeholder="optional – what it covers"></label>
      <label class="sop-wide sop-drop" id="sopDrop"><input id="sopFile" type="file" multiple hidden><b>Click to choose files</b> or drop them here<span id="sopPicked" class="muted"></span></label>
    </div>
    <div class="row"><button class="btn primary" id="sopSave">Save SOP</button><span class="muted small">Tip: SOPs are kept apart from case data, so they stay when you switch or delete a case.</span></div></div>
    <div class="sop-cats">${SOP.CATS.map(c => `<div class="sop-cat" data-c="${c[0]}" style="--sc:${c[2]}"><b>${esc(c[1])}</b><span>${esc(c[3])}</span><i>${SOP.list.filter(x => x.cat === c[0]).length} files</i></div>`).join('')}</div>`;
  let picked = [];
  const fi = $('#sopFile', body), show = () => { $('#sopPicked', body).textContent = picked.length ? ' · ' + picked.map(f => f.name).join(', ') : ''; };
  fi.onchange = () => { picked = [...fi.files]; show(); };
  const dr = $('#sopDrop', body);
  dr.ondragover = e => { e.preventDefault(); dr.classList.add('on'); }; dr.ondragleave = () => dr.classList.remove('on');
  dr.ondrop = e => { e.preventDefault(); dr.classList.remove('on'); picked = [...e.dataTransfer.files]; show(); };
  $$('.sop-cat', body).forEach(c => c.onclick = () => { $('#sopCat', body).value = c.dataset.c; });
  $('#sopSave', body).onclick = async () => {
    const cat = $('#sopCat', body).value;
    if (!cat) return UI.toast('Choose the section first');
    if (!picked.length) return UI.toast('Choose a file to upload');
    try {
      await SOP.add(cat, picked, { title: $('#sopTitle', body).value.trim(), ref: $('#sopRef', body).value.trim(), date: $('#sopDate', body).value, note: $('#sopNote', body).value.trim() });
      UI.toast(`${picked.length} file${picked.length > 1 ? 's' : ''} saved in ${SOP.cat(cat)[1]}`);
      S.sopCat = cat; S.sub.office = cat; render();
    } catch (e) { UI.toast('Could not save: ' + e.message, 5000); }
  };
};

SOP.listView = function (body, cur) {
  const C = SOP.cat(cur), q = (S.sopQ || '').toLowerCase();
  const rows = SOP.list.filter(x => (!C || x.cat === cur) && (!q || [x.title, x.name, x.ref, x.note].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => (b.date || b.added).localeCompare(a.date || a.added));
  const head = C ? `<div class="card sop-head" style="--sc:${C[2]}"><div><h3>${esc(C[1])}</h3><div class="sub">${esc(C[3])}</div></div><button class="btn" id="sopAddHere">⬆ Upload to ${esc(C[1])}</button></div>`
    : `<div class="sop-cats">${SOP.CATS.map(c => `<div class="sop-cat" data-c="${c[0]}" style="--sc:${c[2]}"><b>${esc(c[1])}</b><span>${esc(c[3])}</span><i>${SOP.list.filter(x => x.cat === c[0]).length} files</i></div>`).join('')}</div>`;
  const item = x => { const c = SOP.cat(x.cat) || ['', '', '#64748b']; return `<div class="sop-item" style="--sc:${c[2]}"><span class="sop-kind">${esc(SOP.kind(x.name))}</span>
    <div class="sop-txt"><b>${esc(x.title)}</b><div class="muted small">${C ? '' : `<span class="sop-tag">${esc(c[1])}</span> `}${x.ref ? 'Ref ' + esc(x.ref) + ' · ' : ''}${x.date ? 'Dated ' + esc(x.date.split('-').reverse().join('-')) + ' · ' : ''}${esc(x.name)} · ${SOP.size(x.size)} · added ${esc(x.added.slice(0, 10).split('-').reverse().join('-'))}</div>${x.note ? `<div class="small">${esc(x.note)}</div>` : ''}</div>
    <div class="sop-acts"><button class="btn" data-o="${x.id}">Open</button><button class="btn" data-d="${x.id}">Download</button><button class="btn danger" data-x="${x.id}" title="Delete">✕</button></div></div>`; };
  body.innerHTML = head + `<div class="card"><div class="row"><h3 class="grow">${C ? 'Files' : 'All SOPs'} <span class="muted small">(${rows.length})</span></h3><input id="sopQ" placeholder="Search title, ref no, file name…" value="${esc(S.sopQ || '')}"></div>
    ${rows.length ? `<div class="sop-list">${rows.map(item).join('')}</div>` : `<div class="muted" style="padding:24px;text-align:center">${q ? 'No SOP matches the search.' : `No SOP uploaded${C ? ' in ' + esc(C[1]) : ''} yet. Use <b>Upload SOP</b> to add one.`}</div>`}</div>`;
  $$('.sop-cat', body).forEach(c => c.onclick = () => { S.sub.office = c.dataset.c; render(); });
  const add = $('#sopAddHere', body); if (add) add.onclick = () => { S.sopCat = cur; S.sub.office = 'upload'; render(); };
  const qi = $('#sopQ', body); qi.oninput = () => { S.sopQ = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { render(); const n = $('#sopQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
  $$('[data-o]', body).forEach(b => b.onclick = () => SOP.open(b.dataset.o));
  $$('[data-d]', body).forEach(b => b.onclick = () => SOP.download(b.dataset.d));
  $$('[data-x]', body).forEach(b => b.onclick = async () => { const x = SOP.list.find(r => r.id === b.dataset.x); if (!UI.confirm(`Delete "${x.title}"?`)) return; await SOP.remove(x.id); UI.toast('Deleted'); render(); });
};

/* sidebar: SOP opens a drop-down with the five sections and Upload SOP */
(() => {
  const nav = $('#sidebar'), it = $('.nav-item[data-page="office"]', nav); if (!it) return;
  it.insertAdjacentHTML('beforeend', '<span class="nav-chev" title="Show / hide sections">▾</span>');
  it.insertAdjacentHTML('afterend', `<div class="nav-subs sop-subs">${SOP.CATS.map(c => `<div class="nav-sub" data-sop="${c[0]}" style="--pc:${c[2]}" title="SOP · ${esc(c[1])}"><i></i><span>${esc(c[1])}</span></div>`).join('')}<div class="nav-sub sop-upl" data-sop="upload" title="Upload an SOP into one of the sections above"><span>⬆ Upload SOP</span></div></div>`);
  const subs = $('.sop-subs', nav), setOpen = on => { S.sopOpen = on; subs.classList.toggle('open', on); it.classList.toggle('open', on); };
  setOpen(false);
  $('.nav-chev', it).addEventListener('click', e => { e.stopPropagation(); setOpen(!S.sopOpen); });
  it.addEventListener('click', e => { if (e.target.closest('.nav-chev')) return; const here = S.page === 'office' && S.sub.office === 'all'; S.sub.office = 'all'; setOpen(here ? !S.sopOpen : true); }, true);
  $$('.nav-sub[data-sop]', nav).forEach(n => n.onclick = () => { if (n.dataset.sop === 'upload') S.sopCat = S.page === 'office' && SOP.cat(S.sub.office) ? S.sub.office : S.sopCat; go('office', n.dataset.sop); });
  const orig = render;
  render = function () {
    orig();
    $$('.nav-sub[data-sop]').forEach(n => n.classList.toggle('active', S.page === 'office' && S.sub.office === n.dataset.sop));
    if (S.page === 'office' && S.sub.office && S.sub.office !== 'all' && !S.sopOpen) setOpen(true);
  };
})();
