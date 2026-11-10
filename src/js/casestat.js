/* casestat.js – Dashboard: Total / Completed / Pending case boxes, each opens the list of those cases */
'use strict';
const CaseStat = {
  done: c => /complet|closed|charge\s*-?sheet|final report|disposed|solved|\bdone\b/i.test((c && c.status) || ''),
  fin: c => (c && c.final && c.final.type) || (/\bppi\b/i.test((c && c.status) || '') ? 'PPI' : /charge\s*-?sheet/i.test((c && c.status) || '') ? 'CS' : /final report/i.test((c && c.status) || '') ? 'FR' : ''),
  pick(kind) { return S.cases.filter(c => kind === 'all' || (kind === 'cs' ? this.fin(c) === 'CS' : kind === 'ppi' ? this.fin(c) === 'PPI' : kind === 'fr' ? this.fin(c) === 'FR' : (kind === 'done') === this.done(c))); },
  def(kind) {
    const T = { all: '📁 All cases', cs: '📗 CS – Charge Sheet', ppi: '📘 CS-PPI – further investigation pending', fr: '📕 FR – Final Report', pend: '⏳ Pending cases', done: '✅ Completed cases' }[kind];
    return { title: T, rows: () => this.pick(kind).map(c => ({ id: c.id, name: c.name || '', fir: c.fir || '', ps: c.ps || '', io: c.io || '', status: c.status || 'Under investigation', fin: this.fin(c), no: (c.final || {}).no || '', date: (c.final || {}).date ? c.final.date.split('-').reverse().join('-') : '', court: (c.final || {}).court || '', created: String(c.created || '').slice(0, 10) })),
      cols: [{ key: 'name', label: 'Case' }, { key: 'fir', label: 'FIR' }, { key: 'io', label: 'IO' }, { key: 'status', label: 'Status' }, ...(kind === 'pend' ? [{ key: 'created', label: 'Created' }] : [{ key: 'no', label: 'CS / FR No.' }, { key: 'date', label: 'Date' }, { key: 'court', label: 'Court' }])],
      sort: 'name', pv: r => [r.name, [r.fin, r.no, r.date].filter(Boolean).join(' · ') || r.status], onRow: async r => { UI.closeDrawer(); if (r.id !== S.caseId) await switchCase(r.id); go('dashboard'); } };
  },
  list(kind) {
    const L = S.cases.filter(c => kind === 'all' || (kind === 'done') === this.done(c));
    const T = { all: '📁 All cases', done: '✅ Completed cases', pend: '⏳ Pending cases' }[kind];
    const body = UI.modal(`${T} (${L.length})`, L.length ? `<div class="tbl-wrap"><table class="tbl cs-tbl"><thead><tr><th>Case</th><th>FIR</th><th>PS</th><th>IO</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>${L.map(c => `<tr>
        <td><b>${esc(c.name)}</b>${c.id === S.caseId ? ' <span class="badge info">open</span>' : ''}</td><td>${esc(c.fir || '')}</td><td>${esc(c.ps || '')}</td><td>${esc(c.io || '')}</td>
        <td><span class="cs-st ${this.done(c) ? 'd' : 'p'}">${esc(c.status || 'Pending')}</span></td><td class="small">${esc(String(c.created || '').slice(0, 10))}</td>
        <td style="white-space:nowrap"><button class="btn sm srch" data-open="${c.id}">Open</button> <button class="btn sm rst" data-flip="${c.id}">${this.done(c) ? 'Mark pending' : 'Mark completed'}</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">No cases here yet.</p>', [{ label: 'Close', onClick: () => UI.closeModal() }]);
    $$('[data-open]', body).forEach(b => b.onclick = async () => { UI.closeModal(); await switchCase(S.cases.find(c => String(c.id) === b.dataset.open).id); go('dashboard'); });
    $$('[data-flip]', body).forEach(b => b.onclick = async () => { await this.flip(b.dataset.flip); this.list(kind); });
  },
  async flip(id) {
    const c = S.cases.find(x => String(x.id) === String(id)); if (!c) return;
    c.status = this.done(c) ? 'Under investigation' : 'Completed'; await saveMeta(); fillCaseSel(); render();
    UI.toast(`"${c.name}" marked ${this.done(c) ? 'completed' : 'pending'}`);
  },
  html() {
    const all = S.cases.length, done = S.cases.filter(c => this.done(c)).length, pend = all - done, cur = activeCase() || {}, pct = all ? Math.round(done / all * 100) : 0;
    const cs = S.cases.filter(c => this.fin(c) === 'CS').length, ppi = S.cases.filter(c => this.fin(c) === 'PPI').length, fr = S.cases.filter(c => this.fin(c) === 'FR').length, oth = Math.max(0, done - cs - ppi - fr), P = n => all ? Math.round(n / all * 100) : 0;
    const box = (k, ic, n, l, sub, bar) => `<button class="cs-box cs-${k}" data-cs="${k}"><span class="cs-ic">${ic}</span><span class="cs-t"><b>${fmtNum(n)}${k !== 'all' ? `<em class="cs-pc">${P(n)}%</em>` : ''}</b><span>${l}</span><small>${sub}</small></span><span class="cs-go">View list ›</span>${bar}</button>`;
    const pb = n => `<i class="cs-pb"><b style="width:${P(n)}%"></b></i>`;
    const stack = `<i class="cs-stack" title="CS ${cs} · CS-PPI ${ppi} · FR ${fr}${oth ? ' · other closed ' + oth : ''} · pending ${pend}"><b class="s-cs" style="width:${P(cs)}%"></b><b class="s-pp" style="width:${P(ppi)}%"></b><b class="s-fr" style="width:${P(fr)}%"></b><b class="s-ot" style="width:${P(oth)}%"></b><b class="s-pd" style="width:${P(pend)}%"></b></i>`;
    return `<div class="cs-row cs-row5 cs-row6">${box('all', '📁', all, 'All cases', `CS ${P(cs)}% · PPI ${P(ppi)}% · FR ${P(fr)}%`, stack)}${box('cs', '📗', cs, 'CS', 'Charge Sheet', pb(cs))}${box('ppi', '📘', ppi, 'CS-PPI', 'Further inv. pending', pb(ppi))}${box('fr', '📕', fr, 'FR', 'Final Report', pb(fr))}${box('pend', '⏳', pend, 'Pending', 'Under investigation', pb(pend))}
      <div class="cs-now"><div class="small muted">This case</div><b>${esc(cur.name || '')}</b><span class="cs-st ${this.done(cur) ? 'd' : 'p'}">${esc(cur.status || 'Pending')}</span><div class="cs-acts"><button class="btn sm cc-cs ${this.fin(cur) === 'CS' ? 'on' : ''}" id="csCS" title="Record Charge Sheet">📗 CS</button><button class="btn sm cc-ppi ${this.fin(cur) === 'PPI' ? 'on' : ''}" id="csPPI" title="Charge Sheet, further investigation pending">📘 CS-PPI</button><button class="btn sm cc-fr ${this.fin(cur) === 'FR' ? 'on' : ''}" id="csFR" title="Record Final Report">📕 FR</button><button class="btn sm ${this.done(cur) ? 'rst' : 'srch'}" id="csFlip">${this.done(cur) ? '↺ Mark pending' : '✔ Completed'}</button></div></div></div>`;
  }
};
(() => {
  const og = Pages.dashboard;
  Pages.dashboard = function (main) {
    const r = og.apply(this, arguments);
    const h = main.querySelector('.hero-card'); if (!h) return r;
    h.insertAdjacentHTML('afterend', CaseStat.html());
    $$('[data-cs]', main).forEach(b => typeof DashX !== 'undefined' ? DashX.bind(b, CaseStat.def(b.dataset.cs)) : (b.onclick = () => CaseStat.list(b.dataset.cs)));
    $('#csCS', main).onclick = () => CCTNS.finEdit('CS'); $('#csPPI', main).onclick = () => CCTNS.finEdit('PPI'); $('#csFR', main).onclick = () => CCTNS.finEdit('FR');
    $('#csFlip', main).onclick = () => CaseStat.flip(S.caseId);
    return r;
  };
})();
