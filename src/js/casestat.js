/* casestat.js – Dashboard: Total / Completed / Pending case boxes, each opens the list of those cases */
'use strict';
const CaseStat = {
  done: c => /complet|closed|charge\s*-?sheet|final report|disposed|solved|\bdone\b/i.test((c && c.status) || ''),
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
    const box = (k, ic, n, l, sub) => `<button class="cs-box cs-${k}" data-cs="${k}"><span class="cs-ic">${ic}</span><span class="cs-t"><b>${fmtNum(n)}</b><span>${l}</span><small>${sub}</small></span><span class="cs-go">View list ›</span></button>`;
    return `<div class="cs-row">${box('all', '📁', all, 'Total cases', 'all cases on this computer')}${box('done', '✅', done, 'Completed', pct + '% of all cases')}${box('pend', '⏳', pend, 'Pending', 'still under investigation')}
      <div class="cs-now"><div class="small muted">This case</div><b>${esc(cur.name || '')}</b><span class="cs-st ${this.done(cur) ? 'd' : 'p'}">${esc(cur.status || 'Pending')}</span><button class="btn sm ${this.done(cur) ? 'rst' : 'srch'}" id="csFlip">${this.done(cur) ? '↺ Mark pending' : '✔ Mark completed'}</button></div></div>`;
  }
};
(() => {
  const og = Pages.dashboard;
  Pages.dashboard = function (main) {
    const r = og.apply(this, arguments);
    const h = main.querySelector('.hero-card'); if (!h) return r;
    h.insertAdjacentHTML('afterend', CaseStat.html());
    $$('[data-cs]', main).forEach(b => b.onclick = () => CaseStat.list(b.dataset.cs));
    $('#csFlip', main).onclick = () => CaseStat.flip(S.caseId);
    return r;
  };
})();
