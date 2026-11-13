/* ui.js - toast, modal, drawer, tables, charts, import wizard */
'use strict';

const UI = {
  toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms); },
  modal(title, bodyHtml, buttons = []) {
    $('#mdTitle').textContent = title; $('#mdBody').innerHTML = bodyHtml; const f = $('#mdFoot'); f.innerHTML = '';
    for (const b of buttons) { const el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.label; el.onclick = b.onClick; f.appendChild(el); }
    $('#modal').classList.remove('hidden'); return $('#mdBody');
  },
  closeModal() { $('#modal').classList.add('hidden'); $('#mdBody').innerHTML = ''; },
  drawer(title, html) { $('#drTitle').textContent = title; $('#drBody').innerHTML = html; $('#drawer').classList.add('open'); return $('#drBody'); },
  closeDrawer() { $('#drawer').classList.remove('open'); },
  confirm(msg) { return window.confirm(msg); },
  download(name, content, mime = 'text/plain') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },
  toCSV(columns, rows) {
    const q = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '﻿' + columns.map(c => q(c.label)).join(',') + '\n' + rows.map(r => columns.map(c => q(c.csv ? c.csv(r) : r[c.key])).join(',')).join('\n');
  },
  kv(obj) { return '<dl class="kv">' + Object.entries(obj).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('') + '</dl>'; },
  kpis(list) { return '<div class="kpis">' + list.map(k => `<div class="kpi ${k[3] || ''}"><div class="label">${esc(k[0])}</div><div class="value">${k[1]}</div>${k[2] ? `<div class="hint">${esc(k[2])}</div>` : ''}</div>`).join('') + '</div>'; },
  empty(msg, btn) { return `<div class="card" style="text-align:center;padding:40px"><div class="muted" style="font-size:15px;margin-bottom:12px">${msg}</div>${btn || ''}</div>`; }
};

/* ---------- Generic sortable / filterable / paged table ---------- */
function Table(container, opt) {
  const st = { sortKey: opt.sortKey || null, dir: opt.sortDir || 1, q: '', page: 0, size: opt.pageSize || 100 };
  const cols = opt.columns;
  const val = (r, c) => c.sortVal ? c.sortVal(r) : r[c.key];
  function rowsNow() {
    let rows = opt.rows;
    if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter(r => cols.some(c => String(c.csv ? c.csv(r) : r[c.key] ?? '').toLowerCase().includes(q))); }
    if (st.sortKey) {
      const c = cols.find(x => x.key === st.sortKey);
      const coll = Table.coll || (Table.coll = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }));
      rows = rows.map(r => [val(r, c), r]).sort(([x], [y]) => {
        const ex = x == null || x === '', ey = y == null || y === '';
        if (ex && ey) return 0; if (ex) return 1; if (ey) return -1;
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * st.dir;
        return coll.compare(String(x), String(y)) * st.dir;
      }).map(e => e[1]);
    }
    return rows;
  }
  function render() {
    const rows = rowsNow(); const pages = Math.max(1, Math.ceil(rows.length / st.size)); if (st.page >= pages) st.page = pages - 1;
    const slice = rows.slice(st.page * st.size, (st.page + 1) * st.size);
    container.innerHTML = `
      <div class="tbl-tools">
        <input type="search" placeholder="Type to find… then Search" value="${esc(st.q)}" data-r="q">
        <button class="btn sm srch" data-r="go" title="Show only the rows that contain this text">🔍 Search</button><button class="btn sm rst" data-r="reset" title="Clear the search and sorting, show all rows">Reset</button>
        <label class="small">Sort</label>
        <select data-r="sk"><option value="">—</option>${cols.filter(c => !c.nosort).map(c => `<option value="${c.key}" ${c.key === st.sortKey ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select>
        <span class="pill-group"><button data-r="az" class="${st.dir === 1 ? 'active' : ''}" title="Ascending">A → Z</button><button data-r="za" class="${st.dir === -1 ? 'active' : ''}" title="Descending">Z → A</button></span>
        <span class="spacer"></span>
        <span class="muted small">${fmtNum(rows.length)} ${rows.length === 1 ? 'row' : 'rows'}</span>
        <button class="btn sm" data-r="pv" title="See the whole table – then save as HTML, Word, PDF, Excel, Image or print">👁 Preview</button><button class="btn sm" data-r="csv">⬇ CSV</button>
        ${opt.tools || ''}
      </div>
      <div class="tbl-wrap" style="${opt.maxHeight ? 'max-height:' + opt.maxHeight : ''}"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}" data-k="${c.key}">${esc(c.label)}${st.sortKey === c.key ? (st.dir === 1 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${slice.map((r, i) => `<tr class="${opt.onRow ? 'clickable' : ''}" data-i="${st.page * st.size + i}">${cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.render ? c.render(r) : esc(c.fmt ? c.fmt(r[c.key], r) : r[c.key])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="muted" style="text-align:center;padding:20px">No rows</td></tr>`}</tbody></table></div>
      ${pages > 1 ? `<div class="pager"><button class="btn sm" data-r="prev" ${st.page === 0 ? 'disabled' : ''}>‹ Prev</button> Page ${st.page + 1} of ${pages} <button class="btn sm" data-r="next" ${st.page >= pages - 1 ? 'disabled' : ''}>Next ›</button></div>` : ''}`;
    const qi = $('[data-r=q]', container);
    // small tables filter while you type; big ones on Search / Enter so typing stays fast
    const apply = keep => { st.q = qi.value.trim(); st.page = 0; const pos = qi.selectionStart; render(); const n = $('[data-r=q]', container); if (keep) { n.focus(); n.setSelectionRange(pos, pos); } };
    qi.oninput = () => { if (opt.rows.length <= 3000) apply(true); };
    qi.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); apply(true); } };
    $('[data-r=go]', container).onclick = () => apply(false);
    $('[data-r=reset]', container).onclick = () => { st.q = ''; st.sortKey = opt.sortKey || null; st.dir = opt.sortDir || 1; st.page = 0; render(); };
    $('[data-r=sk]', container).onchange = e => { st.sortKey = e.target.value || null; render(); };
    $('[data-r=az]', container).onclick = () => { st.dir = 1; if (!st.sortKey) st.sortKey = cols[0].key; render(); };
    $('[data-r=za]', container).onclick = () => { st.dir = -1; if (!st.sortKey) st.sortKey = cols[0].key; render(); };
    $('[data-r=pv]', container).onclick = () => ExportAll.table(opt.exportName || ExportAll.title(), cols, rowsNow());
    $('[data-r=csv]', container).onclick = () => UI.download((opt.exportName || 'export') + '.csv', UI.toCSV(cols.filter(c => !c.noexport), rowsNow()), 'text/csv');
    const pv = $('[data-r=prev]', container), nx = $('[data-r=next]', container);
    if (pv) pv.onclick = () => { st.page--; render(); }; if (nx) nx.onclick = () => { st.page++; render(); };
    $$('th', container).forEach(th => th.onclick = () => { const k = th.dataset.k; if (cols.find(c => c.key === k).nosort) return; if (st.sortKey === k) st.dir = -st.dir; else { st.sortKey = k; st.dir = 1; } render(); });
    if (opt.onRow) $$('tbody tr', container).forEach(tr => tr.onclick = e => { if (e.target.closest('button,a,input')) return; const r = rows[+tr.dataset.i]; if (r) opt.onRow(r); });
    if (opt.after) opt.after(container, rows);
  }
  render();
  return { render, setRows(r) { opt.rows = r; render(); } };
}

/* ---------- Charts (SVG) ---------- */
const PALETTE = () => { const cs = getComputedStyle(document.documentElement); return [1, 2, 3, 4, 5, 6, 7, 8].map(i => cs.getPropertyValue('--s' + i).trim()); };
const Charts = {
  // bar colour by size: biggest = red, smallest = light yellow
  heat(v, mx, mn = 0) { const t = mx > mn ? Math.max(0, Math.min(1, (v - mn) / (mx - mn))) : 1; return `hsl(${Math.round(54 - 54 * t)},${Math.round(96 - 14 * t)}%,${Math.round(78 - 30 * t)}%)`; },
  // text that reads well on that bar colour
  ink(v, mx, mn = 0) { const t = mx > mn ? (v - mn) / (mx - mn) : 1; return t > .55 ? '#fff' : '#3b2600'; },
  tip(e, html) { const t = $('#chartTip'); if (!html) { t.style.display = 'none'; return; } t.innerHTML = html; t.style.display = 'block'; t.style.left = (e.clientX + 14) + 'px'; t.style.top = (e.clientY + 10) + 'px'; },
  bindTips(el) { $$('[data-tip]', el).forEach(n => { n.onmousemove = e => Charts.tip(e, n.dataset.tip); n.onmouseleave = e => Charts.tip(e, null); }); },
  // horizontal bars: data [{label, value, sub}]
  hbar(el, data, { fmt = fmtNum, max = 12, onClick } = {}) {
    data = data.slice(0, max);
    if (!data.length) { el.innerHTML = '<div class="muted small">No data</div>'; return; }
    const W = 560, rowH = 28, lw = 170, H = data.length * rowH + 6, mx = Math.max(...data.map(d => d.value)) || 1, mn = Math.min(...data.map(d => d.value));
    el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet">${data.map((d, i) => {
      const w = Math.max(2, (W - lw - 100) * d.value / mx), y = i * rowH + 4;
      return `<g data-tip="${esc(d.label)}<br><b>${esc(fmt(d.value))}</b>${d.sub ? '<br>' + esc(d.sub) : ''}" data-i="${i}" style="cursor:${onClick ? 'pointer' : 'default'}">
        <rect x="0" y="${y - 2}" width="${W}" height="${rowH}" fill="transparent"/>
        <text x="${lw - 8}" y="${y + 14}" text-anchor="end" style="fill:var(--text-primary)">${esc(String(d.label).slice(0, 26))}</text>
        <rect x="${lw}" y="${y + 2}" width="${w}" height="18" rx="4" fill="${Charts.heat(d.value, mx, mn)}" stroke="rgba(150,70,0,.45)" stroke-width=".8"/>
        ${(() => { const v = esc(fmt(d.value)), tw = v.length * 6.4 + 12; return w > tw ? `<text x="${lw + w - 6}" y="${y + 15}" text-anchor="end" style="fill:${Charts.ink(d.value, mx, mn)};font-weight:700">${v}</text>` : `<text x="${lw + w + 6}" y="${y + 15}" style="fill:var(--text-primary);font-weight:600">${v}</text>`; })()}</g>`;
    }).join('')}</svg>`;
    Charts.bindTips(el);
    if (onClick) $$('g[data-i]', el).forEach(g => g.onclick = () => onClick(data[+g.dataset.i]));
  },
  // vertical bars / columns: data [{label, value}]
  vbar(el, data, { fmt = fmtNum, color } = {}) {
    if (!data.length) { el.innerHTML = '<div class="muted small">No data</div>'; return; }
    const W = 560, H = 230, pl = 56, pb = 34, pt = 12, mx = Math.max(...data.map(d => d.value)) || 1;
    const bw = (W - pl - 10) / data.length, mn = Math.min(...data.map(d => d.value));
    const ticks = [0, .25, .5, .75, 1].map(t => mx * t);
    el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">
      ${ticks.map(t => { const y = H - pb - (H - pb - pt) * t / mx; return `<line class="gridline" x1="${pl}" x2="${W}" y1="${y}" y2="${y}"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end">${esc(Charts.short(t))}</text>`; }).join('')}
      ${data.map((d, i) => { const h = Math.max(1, (H - pb - pt) * d.value / mx), x = pl + i * bw + bw * .15, w = Math.max(2, bw * .7 - 2);
        return `<g data-tip="${esc(d.label)}<br><b>${esc(fmt(d.value))}</b>${d.sub ? '<br>' + esc(d.sub) : ''}"><rect x="${pl + i * bw}" y="${pt}" width="${bw}" height="${H - pb - pt}" fill="transparent"/>
        <path d="M${x},${H - pb} v${-(h - 4)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${h - 4} z" fill="${Charts.heat(d.value, mx, mn)}"/>
        ${data.length <= 16 || i % Math.ceil(data.length / 12) === 0 ? `<text x="${x + w / 2}" y="${H - pb + 15}" text-anchor="middle">${esc(String(d.label).slice(0, 10))}</text>` : ''}</g>`; }).join('')}
      <line x1="${pl}" x2="${W}" y1="${H - pb}" y2="${H - pb}" stroke="var(--grid)"/></svg>`;
    Charts.bindTips(el);
  },
  // line over time: data [{label(date), value}]
  line(el, data, { fmt = fmtNum } = {}) {
    if (data.length < 2) { return Charts.vbar(el, data, { fmt }); }
    const W = 560, H = 230, pl = 56, pb = 34, pt = 12, mx = Math.max(...data.map(d => d.value)) || 1, col = PALETTE()[0];
    const x = i => pl + (W - pl - 12) * i / (data.length - 1), y = v => H - pb - (H - pb - pt) * v / mx;
    const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
    const step = Math.ceil(data.length / 8);
    el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">
      ${[0, .5, 1].map(t => `<line class="gridline" x1="${pl}" x2="${W}" y1="${y(mx * t)}" y2="${y(mx * t)}"/><text x="${pl - 6}" y="${y(mx * t) + 4}" text-anchor="end">${esc(Charts.short(mx * t))}</text>`).join('')}
      <path d="${path} L${x(data.length - 1)},${H - pb} L${pl},${H - pb} Z" fill="${col}" opacity=".12"/>
      <path d="${path}" fill="none" stroke="${col}" stroke-width="2"/>
      ${data.map((d, i) => `<g data-tip="${esc(d.label)}<br><b>${esc(fmt(d.value))}</b>"><rect x="${x(i) - (W / data.length) / 2}" y="${pt}" width="${W / data.length}" height="${H - pb - pt}" fill="transparent"/>${data.length < 60 || d.value >= mx * .5 ? `<circle cx="${x(i)}" cy="${y(d.value)}" r="${d.value >= mx * .5 ? 4.5 : 3.5}" fill="${Charts.heat(d.value, mx)}" stroke="var(--surface-1)" stroke-width="2"/>` : ''}${i % step === 0 ? `<text x="${x(i)}" y="${H - pb + 15}" text-anchor="middle">${esc(String(d.label).slice(5, 10) || d.label)}</text>` : ''}</g>`).join('')}
      <line x1="${pl}" x2="${W}" y1="${H - pb}" y2="${H - pb}" stroke="var(--grid)"/></svg>`;
    Charts.bindTips(el);
  },
  short(n) { n = Number(n); if (n >= 1e7) return (n / 1e7).toFixed(1).replace(/\.0$/, '') + ' Cr'; if (n >= 1e5) return (n / 1e5).toFixed(1).replace(/\.0$/, '') + ' L'; if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'; return String(Math.round(n)); }
};

/* ---------- Import wizard ---------- */
const TYPE_INFO = {
  txn: { label: 'Money trail / Transaction list (NCRP layer-wise trail, bank transaction details)', store: 'txns' },
  stmt: { label: 'Bank account statement (one account)', store: 'txns' },
  kyc: { label: 'Beneficiary / KYC / account details from bank', store: 'kyc' },
  social: { label: 'Social media / platform response (WhatsApp, FB, Insta, X, Telegram…)', store: 'social' },
  ncrp: { label: 'NCRP complaint list / export', store: 'ncrp' }
};

function openImport(allowed, onDone, presetFiles) {
  const body = UI.modal('Import data', `
    <div class="ip-case"><div class="ip-hd"><span class="ip-ic">📥</span><b>Import into case</b><span class="ip-st" id="ipSt"></span></div>
      <div class="map-grid cb-grid ip-grid"><label>Data Type<select id="impType">${allowed.map(t => `<option value="${t}">${esc(TYPE_INFO[t].label)}</option>`).join('')}</select></label><label>Existing FIR / Complaint No.<select id="ipCase"></select></label><div id="ipF" style="display:contents"></div></div>
      <div class="row ip-btns"><button class="btn primary sm" id="ipOk">✔ OK</button><button class="btn sm" id="ipEd">✏ Edit</button><button class="btn sm" id="ipAdd">➕ Add</button><button class="btn sm danger" id="ipDel">➖ Remove</button><span class="small" id="ipErr" style="color:var(--bad)"></span></div></div>
    <div class="drop ip-drop" id="impDrop"><div class="ip-dic">⬆</div><b>Click to choose file(s)</b> or drag &amp; drop here<div class="small muted" style="margin-top:6px">CSV, XLSX, XLS, ODS, HTML-Excel, TXT and digital PDF (password-protected PDFs work; scanned PDFs need OCR first). Files are read only inside this browser.</div></div>
    <div id="impStage" class="hidden" style="margin-top:14px"></div>`, [{ label: 'Close', onClick: UI.closeModal }]);
  const drop = $('#impDrop', body);
  const queue = [];
  const pick = () => { const fp = $('#filePick'); fp.value = ''; fp.onchange = () => { queue.push(...fp.files); next(); }; fp.click(); };
  /* case chosen at the top – files always go into that case */
  const IF = [['ctype', 'Case Type', 'ct'], ['fir', 'FIR / Complaint No.'], ['year', 'Year'], ['ps', 'Police Station'], ['district', 'District / Commissionerate'], ['io', 'IO Name'], ['io_mobile', 'IO Mobile'], ['io_posting', 'IO Posting']];
  const box = $('.ip-case', body); let sel = isScope(S.caseId) ? (S.prevCase && S.cases.some(x => x.id === S.prevCase) ? S.prevCase : S.cases[0].id) : S.caseId, editing = false;
  const fillSel = () => { $('#ipCase', body).innerHTML = S.cases.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.fir ? x.fir + ' – ' + x.name : x.name)}</option>`).join('') + `<option value="new" ${sel === 'new' ? 'selected' : ''}>➕ New case (type FIR / Complaint No. below)</option>`; };
  const drawF = () => { const c = sel === 'new' ? { year: String(new Date().getFullYear()), ps: activeCase().ps || '', district: activeCase().district || '' } : S.cases.find(x => x.id === sel) || {}, open = editing || sel === 'new';
    $('#ipF', body).innerHTML = IF.map(([k, l, t]) => CaseBox.field(k, l, t, k === 'year' ? CaseBox.yearOf(c) : c[k])).join(''); CaseBox.wire(box);
    $$('#ipF [data-cb]', body).forEach(i => i.disabled = !open); box.classList.toggle('ip-open', open);
    $('#ipEd', body).textContent = editing ? '✖ Cancel edit' : '✏ Edit'; $('#ipEd', body).disabled = sel === 'new'; $('#ipDel', body).disabled = sel === 'new';
    $('#ipSt', body).innerHTML = sel === 'new' ? 'New case – fill the details and press <b>OK</b>' : `Files go into: <b>${esc(c.name || '')}</b>${sel === S.caseId ? ' (open now)' : ' – press OK to open it'}`; $('#ipErr', body).textContent = ''; };
  const ok = async () => { const o = CaseBox.read($('#ipF', body)), err = (sel === 'new' || editing) ? CaseBox.check(o) : ''; if (err) { $('#ipErr', body).textContent = err; return false; }
    if (sel === 'new') { if (!o.fir && !o.ctype) { $('#ipErr', body).textContent = 'Type the FIR / Complaint No. (or choose a Case Type) for the new case'; return false; }
      const c = { id: uid(), created: new Date().toISOString(), status: 'Under investigation', ...o }; c.name = CaseBox.autoName(c); S.cases.push(c); await DB.set('case:' + c.id, emptyCase()); sel = c.id; editing = false; await switchCase(c.id); UI.toast('New case saved: ' + c.name); }
    else { const c = S.cases.find(x => x.id === sel); if (!c) return false; if (editing) { const auto = !c.name || c.name === CaseBox.autoName(c) || /^Case \d+$/.test(c.name); Object.assign(c, o); if (auto) c.name = CaseBox.autoName(c); editing = false; await saveMeta(); fillCaseSel(); UI.toast('Case details saved'); }
      if (sel !== S.caseId) { await switchCase(sel); UI.toast('Opened ' + c.name); } else render(); }
    fillSel(); drawF(); return true; };
  const ensure = async () => (sel === 'new' || editing || sel !== S.caseId) ? ok() : true;
  fillSel(); drawF();
  $('#ipCase', body).onchange = e => { sel = e.target.value; editing = false; drawF(); };
  $('#ipOk', body).onclick = () => ok();
  $('#ipEd', body).onclick = () => { editing = !editing; drawF(); };
  $('#ipAdd', body).onclick = () => { sel = 'new'; editing = false; fillSel(); drawF(); $('[data-cb="fir"]', body).focus(); };
  $('#ipDel', body).onclick = async () => { const n = S.cases.length; await deleteCase(sel); if (S.cases.length < n || !S.cases.some(x => x.id === sel)) { sel = S.caseId; editing = false; fillSel(); drawF(); } };
  drop.onclick = async () => { if (await ensure()) pick(); };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = async e => { e.preventDefault(); drop.classList.remove('over'); const fs = [...e.dataTransfer.files]; if (!(await ensure())) return; queue.push(...fs); next(); };
  let busy = false;
  async function next() {
    if (busy || !queue.length) return; busy = true;
    const file = queue.shift();
    const stage = $('#impStage', body); stage.classList.remove('hidden'); stage.innerHTML = `<div class="muted">Reading <b>${esc(file.name)}</b>…</div>`;
    try {
      const parsed = await Parsers.readFile(file, msg => window.prompt(msg));
      mapStage(parsed);
    } catch (e) { stage.innerHTML = `<div class="err">Could not read ${esc(file.name)}: ${esc(e.message || e)}</div>`; busy = false; next(); }
  }
  if (presetFiles) { queue.push(...presetFiles); next(); }

  function mapStage(parsed) {
    const stage = $('#impStage', body);
    const multi = parsed.sheets.length > 1;
    const score = (rows, t) => { const h = Parsers.detectHeader(rows, t); const m = Parsers.autoMap(rows[h] || [], t); return Object.keys(m).length / FIELDS[t].length + (t === 'stmt' && m.narration != null && (m.debit != null || m.credit != null) ? .5 : 0) + (t === 'kyc' && (m.pan != null || m.aadhaar != null || m.address != null) && m.amount == null ? .3 : 0) + (t === 'social' && (m.imei != null || m.ip != null) ? .4 : 0) + (t === 'ncrp' && (m.category != null || m.victim_name != null) ? .4 : 0) + (t === 'txn' && m.layer != null ? .5 : 0); };
    const setup = (c, i) => { const rows = parsed.sheets[i].rows; c.hIdx = Parsers.detectHeader(rows, c.type); c.map = Parsers.autoMap(rows[c.hIdx] || [], c.type); };
    // one settings object per sheet: detected type, header row, column mapping
    const cfg = parsed.sheets.map((sh, i) => {
      let type = $('#impType', body).value;
      if (allowed.length > 1) { let bs = -1; for (const t of allowed) { const sc = score(sh.rows, t); if (sc > bs) { bs = sc; type = t; } } }
      const c = { type, holder: { acc: '', name: '', ifsc: '', ack: '' } }; setup(c, i);
      c.include = sh.rows.length > 1 && Object.keys(c.map).length >= 2;
      return c;
    });
    const srcName = i => parsed.name + (multi ? ' [' + parsed.sheets[i].name + ']' : '');
    function makeRecs(i) {
      const c = cfg[i], rows = parsed.sheets[i].rows, src = srcName(i), raw = Parsers.build(c.type, rows, c.hIdx, c.map);
      if (c.type === 'stmt') return Parsers.stmtToTxns(raw, { acc: c.holder.acc, name: c.holder.name, ifsc: c.holder.ifsc, ack_no: c.holder.ack }, src);
      if (c.type === 'txn') return raw.map(o => Parsers.normTxn(o, src)).filter(r => r.from_acc || r.to_acc || r.amount);
      if (c.type === 'kyc') return raw.map(o => Parsers.normKyc(o, src)).filter(r => r.acc || r.name || r.mobile);
      if (c.type === 'social') return raw.map(o => Parsers.normSocial(o, src));
      return raw.map(o => Parsers.normNcrp(o, src)).filter(r => r.ack_no || r.amount || r.victim_name);
    }
    function importSheets(list) {
      const bad = list.filter(i => cfg[i].type === 'stmt' && !cfg[i].holder.acc.trim());
      if (bad.length) { UI.toast('Enter the account number for statement sheet: ' + bad.map(i => parsed.sheets[i].name).join(', '), 5000); return; }
      let total = 0; const done = [];
      for (const i of list) {
        const c = cfg[i], recs = makeRecs(i); if (!recs.length) continue;
        S.data[TYPE_INFO[c.type].store].push(...recs);
        S.data.imports.push({ id: uid(), when: new Date().toISOString(), file: srcName(i), type: c.type, count: recs.length });
        total += recs.length; done.push(`${esc(parsed.sheets[i].name)}: ${recs.length} ${esc(TYPE_INFO[c.type].label.split('(')[0].trim())}`);
      }
      saveCase(); UI.toast(`Imported ${total} records from ${parsed.name}`);
      $('#impType', body).closest('.ip-case').classList.remove('hidden');
      busy = false; stage.innerHTML = `<div class="note">✔ Imported <b>${total}</b> records from ${esc(parsed.name)}${multi ? '<br>' + done.join('<br>') : ''}<br>Choose another file or close.</div>`;
      if (onDone) onDone();
      next();
    }
    const typeOpts = sel => allowed.map(t => `<option value="${t}" ${t === sel ? 'selected' : ''}>${esc(TYPE_INFO[t].label.split('(')[0].trim())}</option>`).join('');

    function drawAll() {
      $('#impType', body).closest('.ip-case').classList.add('hidden');
      const n = cfg.filter(c => c.include).length;
      stage.innerHTML = `<div class="card" style="margin:0">
        <div class="row"><b>${esc(parsed.name)}</b><span class="badge">${parsed.sheets.length} sheets</span><span class="muted small">Every sheet is read. Each sheet's data type and columns are detected on its own – change the type or click "Columns" to check the mapping.</span></div>
        <div class="tbl-wrap" style="margin-top:10px;max-height:none"><table class="tbl"><thead><tr><th>Use</th><th>Sheet</th><th class="num">Rows</th><th>Data type</th><th class="num">Header row</th><th class="num">Columns matched</th><th class="num">Records</th><th>Statement account no.</th><th></th></tr></thead><tbody>
        ${cfg.map((c, i) => { let cnt = 0; try { cnt = c.include ? makeRecs(i).length : ''; } catch (e) { cnt = '?'; }
          return `<tr><td><input type="checkbox" data-inc="${i}" ${c.include ? 'checked' : ''}></td><td style="white-space:nowrap"><b>${esc(parsed.sheets[i].name)}</b></td><td class="num">${parsed.sheets[i].rows.length}</td>
          <td><select data-ty="${i}" style="max-width:220px">${typeOpts(c.type)}</select></td><td class="num"><input type="number" min="1" data-hd="${i}" value="${c.hIdx + 1}" style="width:64px"></td>
          <td class="num">${Object.keys(c.map).length} / ${FIELDS[c.type].length}</td><td class="num">${cnt}</td>
          <td>${c.type === 'stmt' ? `<input data-acc="${i}" value="${esc(c.holder.acc)}" placeholder="required" style="width:150px">` : ''}</td>
          <td><button class="btn sm" data-ed="${i}">Columns…</button></td></tr>`; }).join('')}
        </tbody></table></div>
        <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn" id="impSkip">Skip this file</button><button class="btn primary" id="impAll" ${n ? '' : 'disabled'}>Import ${n} selected sheet${n === 1 ? '' : 's'}</button></div></div>`;
      $$('[data-inc]', stage).forEach(x => x.onchange = () => { cfg[+x.dataset.inc].include = x.checked; drawAll(); });
      $$('[data-ty]', stage).forEach(x => x.onchange = () => { const c = cfg[+x.dataset.ty]; c.type = x.value; setup(c, +x.dataset.ty); c.include = true; drawAll(); });
      $$('[data-hd]', stage).forEach(x => x.onchange = () => { const i = +x.dataset.hd, c = cfg[i]; c.hIdx = Math.max(0, +x.value - 1); c.map = Parsers.autoMap(parsed.sheets[i].rows[c.hIdx] || [], c.type); drawAll(); });
      $$('[data-acc]', stage).forEach(x => x.oninput = () => { cfg[+x.dataset.acc].holder.acc = x.value.trim(); });
      $$('[data-ed]', stage).forEach(x => x.onclick = () => drawOne(+x.dataset.ed));
      $('#impSkip', stage).onclick = () => { busy = false; stage.innerHTML = ''; $('#impType', body).closest('.ip-case').classList.remove('hidden'); next(); };
      $('#impAll', stage).onclick = () => importSheets(cfg.map((c, i) => c.include ? i : -1).filter(i => i >= 0));
    }

    function drawOne(sheetIdx) {
      const c = cfg[sheetIdx], type = c.type, rows = parsed.sheets[sheetIdx].rows, headers = rows[c.hIdx] || [], map = c.map;
      const opts = sel => `<option value="">— not in file —</option>` + headers.map((h, i) => `<option value="${i}" ${String(sel) === String(i) ? 'selected' : ''}>${esc(h || 'Column ' + (i + 1))}</option>`).join('');
      const recs = Parsers.build(type, rows, c.hIdx, map).slice(0, 6);
      stage.innerHTML = `
        <div class="card" style="margin:0">
        <div class="row"><b>${esc(parsed.name)}</b><span class="badge">${parsed.kind.toUpperCase()}</span>
          ${multi ? `<label>Sheet</label><b>${esc(parsed.sheets[sheetIdx].name)}</b><label>Data type</label><select id="impTy1">${typeOpts(type)}</select>` : ''}
          <label>Header row</label><input id="impHdr" type="number" min="1" value="${c.hIdx + 1}" style="width:80px">
          <span class="muted small">${rows.length} rows in sheet</span></div>
        <p class="small muted">Check the column mapping below (green = mapped). Fix anything the auto-detection got wrong.</p>
        ${type === 'stmt' ? `<div class="note">Statement belongs to which account? <div class="map-grid" style="margin-top:8px">
          <div class="f"><label>Account number *</label><input id="hAcc" placeholder="e.g. 50100123456789" value="${esc(c.holder.acc)}"></div>
          <div class="f"><label>Account holder name</label><input id="hName" value="${esc(c.holder.name)}"></div>
          <div class="f"><label>IFSC</label><input id="hIfsc" value="${esc(c.holder.ifsc)}"></div>
          <div class="f"><label>Linked NCRP Ack No (optional)</label><input id="hAck" value="${esc(c.holder.ack)}"></div></div></div>` : ''}
        <div class="map-grid">${FIELDS[type].map(([k, l]) => `<div class="f"><label>${esc(l)}</label><select data-f="${k}" class="${map[k] != null ? 'set' : ''}">${opts(map[k])}</select></div>`).join('')}</div>
        <h4 style="margin:16px 0 6px">Preview (first rows after mapping)</h4>
        <div class="tbl-wrap" style="max-height:220px"><table class="tbl"><thead><tr>${FIELDS[type].filter(f => map[f[0]] != null).map(f => `<th>${esc(f[1])}</th>`).join('')}</tr></thead>
        <tbody>${recs.map(r => `<tr>${FIELDS[type].filter(f => map[f[0]] != null).map(f => `<td>${esc(r[f[0]] instanceof Date ? N.date(r[f[0]]) : r[f[0]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="row" style="margin-top:12px"><span class="spacer"></span>${multi ? '<button class="btn primary" id="impBack">✔ Done – back to all sheets</button>' : `<button class="btn" id="impSkip">Skip this file</button><button class="btn primary" id="impGo">Import ${esc(TYPE_INFO[type].label.split('(')[0])}</button>`}</div>
        </div>`;
      const keepHolder = () => { if (type === 'stmt') c.holder = { acc: $('#hAcc', stage).value.trim(), name: $('#hName', stage).value, ifsc: $('#hIfsc', stage).value, ack: $('#hAck', stage).value.trim() }; };
      $('#impHdr', stage).onchange = e => { keepHolder(); c.hIdx = Math.max(0, +e.target.value - 1); c.map = Parsers.autoMap(rows[c.hIdx] || [], type); drawOne(sheetIdx); };
      $$('select[data-f]', stage).forEach(s => s.onchange = () => { keepHolder(); if (s.value === '') delete map[s.dataset.f]; else map[s.dataset.f] = +s.value; drawOne(sheetIdx); });
      const changeType = t => { keepHolder(); c.type = t; setup(c, sheetIdx); drawOne(sheetIdx); };
      if (multi) {
        $('#impTy1', stage).onchange = e => changeType(e.target.value);
        $('#impBack', stage).onclick = () => { keepHolder(); c.include = true; drawAll(); };
      } else {
        $('#impType', body).value = type; $('#impType', body).onchange = e => changeType(e.target.value);
        $('#impSkip', stage).onclick = () => { busy = false; stage.innerHTML = ''; next(); };
        $('#impGo', stage).onclick = () => { keepHolder(); importSheets([0]); };
      }
    }
    if (multi) drawAll(); else drawOne(0);
  }
}
