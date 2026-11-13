/* livecell.js – one shared hover + click behaviour for any number, chip, box or table cell in the whole tool.
   Mark an element with data-lv="<name>" (and any data-* it needs) and register LiveCell.fn[name] = el => def,
   where def = { title, rows: () => [...], cols, pv, sort, onRow, total }. Hover = live preview of the top records,
   click = the complete records in the side panel (search, sort, CSV, export). Works after paging / sorting
   because it listens once on the whole page. */
'use strict';
const LiveCell = {
  fn: {},
  def(el) { const f = this.fn[el.dataset.lv]; if (!f) return null; try { return f(el); } catch (e) { console.warn('livecell', e); return null; } },
  cols(R) {
    const seen = new Set(); R.slice(0, 200).forEach(r => Object.keys(r).forEach(k => { if (!k.startsWith('_') && r[k] != null && r[k] !== '' && typeof r[k] !== 'object') seen.add(k); }));
    return [...seen].slice(0, 10).map(k => ({ key: k, label: Records.label(k), num: typeof (R.find(r => r[k] != null) || {})[k] === 'number' }));
  },
  norm(d) { if (!d) return null; const rows = typeof d.rows === 'function' ? d.rows : () => d.rows || []; const o = Object.assign({}, d, { rows }); if (!o.cols) o.cols = this.cols(rows() || []); if (!o.pv) { const k = (o.cols[0] || {}).key, k2 = (o.cols[1] || {}).key; o.pv = r => [r[k], k2 ? r[k2] : '']; } return o; }
};
(() => {
  let cur = null;
  document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest('[data-lv]'); if (el === cur) return; cur = el;
    if (!el) return DashX.tip(null, null); const d = LiveCell.norm(LiveCell.def(el)); if (d) DashX.tip(el, d);
  });
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-lv]'); if (!el || e.target.closest('a[href],input,select,textarea')) return;
    const d = LiveCell.norm(LiveCell.def(el)); if (!d) return;
    e.stopPropagation(); e.preventDefault(); cur = null; DashX.open(d);
  }, true);
  const or = render; render = function () { cur = null; return or.apply(this, arguments); };
})();

/* ---------- CCTNS: number boxes, All Cases table cells, Case At A Glance ---------- */
(() => {
  if (typeof CCTNS === 'undefined') return;
  const C = () => CCTNS._all || [], byId = id => C().find(r => r.id === id) || {};
  const open = r => { UI.closeDrawer(); if (r._id && r._id !== S.caseId) switchCase(r._id); };
  const cdCols = [{ key: '_case', label: 'Case' }, { key: 'no', label: 'CD No.', num: true }, { key: 'date', label: 'Date' }, { key: 'file', label: 'File' }, { key: 'text', label: 'Short Summary', render: r => `<span class="small">${esc(r.text || '')}</span>` }];
  const cdRows = L => L.flatMap(r => (r.cdList || []).map(x => ({ ...x, _case: r.name, _id: r.id })));
  const showCd = x => { UI.closeDrawer(); Promise.resolve(x._id === S.caseId ? S.data : DB.get('case:' + x._id)).then(d => { const cd = ((d && d.cctns && d.cctns.cd) || []).find(c => String(c.no) === String(x.no) && (c.file === x.file || !x.file)); UI.drawer(`CD ${x.no || '?'} – ${x._case}`, `<div class="small muted">${esc([x.date, x.file].filter(Boolean).join(' · '))}</div><div class="ad-full" style="white-space:pre-wrap;margin-top:8px">${esc((cd && cd.text) || x.text || '')}</div>`); }); };
  const pendRows = L => L.flatMap(r => (r.pendItems || []).map(w => ({ what: w.title, from: w.from || '', _case: r.name, _id: r.id })));
  const pendCols = [{ key: '_case', label: 'Case' }, { key: 'what', label: 'Demand / Notice To Do' }, { key: 'from', label: 'From Whom' }];
  const ntRows = L => L.flatMap(r => (r.noticeList || []).map(n => ({ ...n, _case: r.name, _id: r.id })));
  const ntCols = [{ key: '_case', label: 'Case' }, { key: 'when', label: 'When' }, { key: 'name', label: 'Notice' }, { key: 'to', label: 'To' }];
  const gapRows = L => L.filter(r => r.cdGap).flatMap(r => String(r.cdGap).split(/\s*,\s*/).map(n => ({ missing: 'CD ' + n, last: r.cdLast, _case: r.name, _id: r.id })));
  const D = {
    cd: L => ({ title: 'Case Diary Parts', rows: () => cdRows(L), cols: cdCols, sort: 'no', pv: x => ['CD ' + (x.no || '?') + ' · ' + x._case, x.date], onRow: showCd }),
    gap: L => ({ title: 'Missing CD Numbers', rows: () => gapRows(L), cols: [{ key: '_case', label: 'Case' }, { key: 'missing', label: 'Missing', render: r => `<b class="bad-t">${esc(r.missing)}</b>` }, { key: 'last', label: 'Last CD No.' }], pv: x => [x.missing + ' · ' + x._case, 'last CD ' + x.last], onRow: open }),
    pend: L => ({ title: 'Pending Demands / Work', rows: () => pendRows(L), cols: pendCols, pv: x => [x.what, x._case], onRow: open }),
    done: L => ({ title: 'Work Done', rows: () => L.flatMap(r => (r.doneItems || []).map(w => ({ what: w.title, _case: r.name, _id: r.id }))), cols: [{ key: '_case', label: 'Case' }, { key: 'what', label: 'Done' }], pv: x => [x.what, x._case], onRow: open }),
    notices: L => ({ title: 'Notices Drafted', rows: () => ntRows(L), cols: ntCols, pv: x => [x.name + (x.to ? ' → ' + x.to : ''), x._case], onRow: open })
  };
  CCTNS.LV = D;
  LiveCell.fn.cc = el => { const k = el.dataset.k, r = byId(el.dataset.id); return D[k] ? Object.assign(D[k]([r]), { title: D[k]([r]).title + ' – ' + (r.name || '') }) : null; };
  /* Case At A Glance: boxes and the Received / Pending / Suggestions / Section chips */
  LiveCell.fn.cdx = el => {
    const r = CDX.analyse(), k = el.dataset.k, kv = (a, b) => ({ item: a, value: b });
    const its = r.items.map(i => ({ what: [i.need || i.type, i.value].filter(Boolean).join(' · '), from: i.from || '', status: i.status, age: i.age || '', cd: i.got ? 'CD ' + i.got.cd : i.ask ? 'CD ' + i.ask.cd : '' }));
    const ags = r.agencies.map(a => ({ what: a.en + (a.bank ? ' · ' + a.bank : ''), from: a.bank || a.en || '', status: a.status, age: a.age || '', cd: a.cd ? 'CD ' + a.cd : '' }));
    const cdL = r.L.map(l => ({ no: l.no, date: CDX.dmy(l.prep), file: l.x.file, text: CDX.cut(l.body, 240), _case: activeCase().name, _id: S.caseId }));
    const T = {
      received: () => ({ title: 'Received', rows: () => [...its, ...ags].filter(x => x.status === 'Received'), pv: x => [x.what, x.cd] }),
      pending: () => ({ title: 'Pending – From Whom', rows: () => [...its, ...ags].filter(x => x.status !== 'Received'), pv: x => [x.what, x.age ? x.age + ' days' : x.from], sort: 'age' }),
      sugg: () => ({ title: 'Suggestions To IO', rows: () => r.sugg.map((s, i) => ({ no: i + 1, suggestion: s.en, hindi: s.hi })), pv: x => [x.suggestion, ''] }),
      secs: () => ({ title: 'Section Points', rows: () => r.secs.filter(s => s.state !== 'ok').map(s => ({ section: s.sec, check: s.state === 'review' ? 'Review' : 'Consider Adding', reason: s.why || s.reason || s.hi || '' })), pv: x => [x.section, x.check] }),
      'Case Diary': () => ({ title: 'Case Diary Parts', rows: () => cdL, cols: cdCols.slice(1), sort: 'no', pv: x => ['CD ' + (x.no || '?'), x.date], onRow: showCd }),
      FIR: () => ({ title: 'FIR', rows: () => [kv('FIR No.', r.fir.no), kv('Date', r.fir.date), kv('Sections', r.fir.sections.join(', ')), kv('Complainant', r.fir.complainant), kv('Mobile', r.fir.mobile), kv('Incident', r.fir.incident), kv('Amount', r.fir.amount ? fmtINR(r.fir.amount) : '')].filter(x => x.value) }),
      Sections: () => ({ title: 'Sections', rows: () => r.fir.sections.map(s => ({ section: s, check: (r.secs.find(x => x.sec === s) || {}).state === 'ok' ? 'In FIR' : '' })) }),
      Complainant: () => ({ title: 'Complainant', rows: () => [kv('Name', r.fir.complainant), kv('Mobile', r.fir.mobile), kv('Statement', r.vic ? 'CD ' + r.vic.cd : 'Not found in the case diary')].filter(x => x.value) }),
      Incident: () => ({ title: 'Incident', rows: () => [kv('Incident', r.fir.incident), kv('FIR Date', r.fir.date)].filter(x => x.value) }),
      Amount: () => ({ title: 'Amount', rows: () => [kv('Amount In FIR', r.fir.amount ? fmtINR(r.fir.amount) : '')].filter(x => x.value) }),
      IO: () => ({ title: 'IO', rows: () => [kv('IO', r.io || activeCase().io), kv('Case', activeCase().name)].filter(x => x.value) }),
      Status: () => { const c = activeCase(); return { title: 'Status', rows: () => [kv('Status', c.status), kv('CS / FR', c.final ? CCTNS.finTxt(c.final) : 'Not filed yet')].filter(x => x.value) }; }
    };
    return T[k] ? T[k]() : null;
  };
  const od = CCTNS.diary; CCTNS.diary = function (el) {
    const r = od.apply(this, arguments);
    try { const g = $('#cdxG', el); if (g) { $$('.cdx-kp > div', g).forEach(d => { const k = ($('span', d) || {}).textContent; if (k) { d.dataset.lv = 'cdx'; d.dataset.k = k.trim(); } });
      const S4 = ['received', 'pending', 'sugg', 'secs']; $$('.cdx-sum > span', g).forEach((s, i) => { if (S4[i]) { s.dataset.lv = 'cdx'; s.dataset.k = S4[i]; } }); } } catch (e) { }
    return r;
  };
})();

/* number boxes resolved by their label: Bulk-Split / Rapid Pass-Through (any page) and Trending Crime */
(() => {
  if (typeof LiveNum === 'undefined') return;
  const or = LiveNum.resolve;
  LiveNum.resolve = function (label, c) {
    const L = String(label || '').toLowerCase().trim();
    if (/bulk.?split|rapid|pass.?through|both flags/.test(L) && typeof Flags !== 'undefined') {
      let F = []; try { F = Flags.compute(this.txns(c)); } catch (e) { }
      return { rows: F.filter(r => /both/.test(L) ? r.bulk && r.rapid : /bulk/.test(L) ? r.bulk : r.rapid) };
    }
    if (S.page === 'trend' && typeof Trend !== 'undefined' && Trend._F) {
      const F = Trend._F;
      if (/^records/.test(L)) return { rows: F };
      if (/^amount/.test(L)) return { rows: F.filter(r => +r.amount > 0).sort((a, b) => b.amount - a.amount) };
      if (/district|ps\b|police station/.test(L)) return this.group(F.map(r => ({ ...r, _dps: [r.district, r.ps].filter(Boolean).join(' / ') })), ['_dps'], 'District / PS') || { rows: F };
      if (/fraud type|rising/.test(L)) return this.group(F, ['type'], 'Fraud Type') || { rows: F };
      if (/delay/.test(L)) return { rows: F.filter(r => r.rep && r.inc).map(r => ({ ...r, delay_days: Math.round((r.rep - r.inc) / 864e5) })).sort((a, b) => b.delay_days - a.delay_days) };
      return { rows: F };
    }
    return or.apply(this, arguments);
  };
})();
