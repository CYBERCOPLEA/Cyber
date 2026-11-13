/* rescue.js
   1. 🩺 Find Lost Data – reads every case record kept in this browser (also records no longer in the case list)
      and names other stores of this tool, so data imported earlier can be found and put back. Nothing is deleted.
   2. Money trail graph – with no trail sheet, draws the documents and the identifiers they name. */
'use strict';
DataFind.rescue = async function () {
  const body = UI.modal('🩺 Find Lost Data On This Computer', '<div class="muted">Reading every record kept in this browser…</div>', [{ label: 'Close', onClick: UI.closeModal }]);
  const keys = (await DB.keys()).filter(k => typeof k === 'string' && /^case:/.test(k)), R = [];
  for (const k of keys) { let d = null; try { d = await DB.get(k); } catch (e) { } const id = k.slice(5), c = S.cases.find(x => x.id === id); R.push({ id, c, n: this.counts(d), lost: !c }); await new Promise(r => setTimeout(r, 0)); }
  let other = []; try { other = (await indexedDB.databases()).map(x => x.name).filter(n => n && /sudarshan/i.test(n) && n !== (SUD_ED === 'user' ? 'sudarshanastra-user' : 'sudarshanastra')); } catch (e) { }
  const has = r => Object.values(r.n).some(v => v), lost = R.filter(r => r.lost && has(r)), cols = this.COLS.filter(c => c[0] !== 'files');
  body.innerHTML = `<div class="small" style="margin-bottom:8px">This browser holds <b>${R.length}</b> case record(s). ${lost.length ? `<b class="bad-t">${lost.length} record(s) with data are not in your case list</b> – press ♻ Restore to bring them back as a case.` : '<b class="good-t">No lost case record found</b> – every record here is already in your case list.'}</div>
    <div class="tbl-wrap"><table class="tbl df-t"><thead><tr><th>Case</th>${cols.map(c => `<th class="num">${esc(c[1])}</th>`).join('')}<th></th></tr></thead><tbody>
    ${R.map(r => `<tr><td>${r.c ? `<b>${esc(AllMode.caseLabel(r.c))}</b>` : `<b class="bad-t">Not in case list</b><div class="small muted mono">${esc(r.id)}</div>`}</td>${cols.map(c => `<td class="num">${c[0] === 'fir' ? (r.n.fir ? 'Yes' : 'No') : fmtNum(r.n[c[0]] || 0)}</td>`).join('')}<td>${r.lost && has(r) ? `<button class="btn sm primary" data-rs="${esc(r.id)}">♻ Restore</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <div class="note" style="margin-top:10px;font-size:12.5px"><b>Data is kept per link and per browser.</b> Data imported on the <b>User link</b>, in another browser (Chrome / Edge), another Windows login, a private / incognito window, or a downloaded copy of the tool opened as a file is stored there – not here. Open the tool the same way as before to see it, or use <b>⚙ Settings › Backup</b> there and <b>Restore</b> here.${other.length ? `<br>Another store of this tool is in this browser: <b>${other.map(esc).join(', ')}</b> (User link) – log in on that link to see its data.` : ''}</div>`;
  $$('[data-rs]', body).forEach(b => b.onclick = async () => { const id = b.dataset.rs; if (S.cases.some(c => c.id === id)) return; S.cases.push({ id, name: 'Restored Case ' + new Date().toLocaleDateString('en-IN'), created: new Date().toISOString(), status: 'Under investigation' }); await saveMeta(); fillCaseSel(); UI.closeModal(); UI.toast('♻ Case restored – rename it from Case Details', 6000); await switchCase(id); });
};
(() => { const oc = DataFind.check; DataFind.check = async function (el) { await oc.apply(this, arguments); const box = el && $('#dfChk', el); if (box && !$('#dfRs', box)) { const h = $('.d2-hd', box); if (h) { h.insertAdjacentHTML('beforeend', '<button class="btn sm" id="dfRs" title="Look for case data kept in this browser that is not in your case list">🩺 Find Lost Data</button>'); $('#dfRs', box).onclick = () => DataFind.rescue(); } } }; })();

DataFind.docGraph = function () {
  const R = this.rows(['account', 'upi', 'mobile', 'ifsc', 'email', 'pan', 'imei', 'ip', 'url']).sort((a, b) => b.n - a.n).slice(0, 250); if (!R.length) return null;
  const docs = new Map(), nodes = [], edges = [], K = { account: 'account', upi: 'account', ifsc: 'nodal', mobile: 'profile', email: 'ident', pan: 'ident', imei: 'risk', ip: 'other', url: 'other' };
  R.forEach(r => { const id = r.type + ':' + r.value; nodes.push({ id, label: r.value, sub: this.tl(r.type), det: r.n + ' file(s)', kind: r.n > 1 ? 'risk' : K[r.type] || 'ident', value: r.n, layer: 2, title: `${this.tl(r.type)} ${r.value}\nFound in: ${r.srcs.join(', ')}` });
    r.srcs.forEach(s => { if (!docs.has(s)) docs.set(s, { id: 'doc:' + s, label: s, sub: 'Document', kind: 'victim', value: 0, layer: 1, title: s }); docs.get(s).value++; edges.push({ from: 'doc:' + s, to: id, amount: 0, count: 1 }); }); });
  return { nodes: [...docs.values(), ...nodes], edges, nd: docs.size, ni: R.length };
};
(() => {
  if (typeof FinTabs === 'undefined' || !FinTabs.graph) return;
  const og = FinTabs.graph; FinTabs.graph = function (el) {
    const r = og.apply(this, arguments);
    try { const box = $('#gBox', el); if (box && /No transactions to draw/.test(box.textContent)) { const G = DataFind.docGraph(); if (G) { const o = S.graphOpt || {};
      box.insertAdjacentHTML('beforebegin', '<div class="df-why" id="dfGn">No money-trail sheet in this case yet – showing <b>the documents (case diary, FIR) and the accounts, mobiles, UPI and other identifiers they name</b>. Red = found in 2+ documents. Import the NCRP / bank-action sheet for the full money trail.</div>');
      const g = Graph.mount(box, G.nodes, G.edges, { mode: o.mode || 'flow', tag: n => n.layer === 1 ? 'D' : 'I', ringName: k => k === 1 ? 'Documents' : 'Identifiers', live: G.edges.length <= 800, labels: G.edges.length > 160 ? true : 'full' });
      $('#gInfo', el).textContent = `${G.ni} identifiers from ${G.nd} documents.`;
      $('#gSvg', el).onclick = () => g.download('documents_' + (o.mode || 'flow')); $('#gPng', el).onclick = () => g.download('documents_' + (o.mode || 'flow'), true); } } } catch (e) { console.warn('docGraph', e); }
    return r;
  };
})();
