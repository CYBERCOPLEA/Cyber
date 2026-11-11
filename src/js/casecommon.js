/* casecommon.js – "Common Case Number": the same account, mobile, email, UPI, IP, POS… found in two or more
   different complaints (NCRP Acknowledgement No). Added as a button on every common-analysis view. */
'use strict';
const CaseCommon = {
  T: { account: 'Account', mobile: 'Mobile', email: 'Email', pan: 'PAN', aadhaar: 'Aadhaar', upi: 'UPI ID', url: 'URL / link', ip: 'IP address', imei: 'IMEI', victim: 'Victim mobile',
    pos: 'CAF POS', agent: 'CAF POS agent', alt: 'CAF alternate no.', poi: 'CAF ID number', father: 'CAF father / husband' },
  SCOPE: {
    financial: ['account', 'mobile', 'email', 'pan', 'aadhaar', 'upi', 'ip'],
    social: ['mobile', 'email', 'ip', 'imei'],
    ncrp: ['mobile', 'account', 'upi', 'url', 'email', 'victim'],
    caf: ['mobile', 'pos', 'agent', 'alt', 'poi', 'aadhaar', 'father'],
    analytics: null   // everything
  },
  key(t, v) {
    v = String(v ?? '').trim(); if (!v) return '';
    switch (t) {
      case 'mobile': case 'victim': case 'alt': { const d = N.mobile(v); return /^[6-9]\d{9}$/.test(d) ? d : ''; }
      case 'account': { const a = N.acc(v); return a.length >= 6 && /\d{4}/.test(a) ? a : ''; }
      case 'email': { const e = N.email(v); return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) ? e : ''; }
      case 'upi': { const u = v.toLowerCase().replace(/\s/g, ''); return /^[\w.\-]{2,}@[a-z]{2,}$/.test(u) ? u : ''; }
      case 'pan': { const p = N.pan(v); return /^[A-Z]{5}\d{4}[A-Z]$/.test(p) ? p : ''; }
      case 'aadhaar': { const d = v.replace(/[^\dxX*]/g, '').toUpperCase(); return /\d{4}$/.test(d) && d.length >= 12 ? d : ''; }
      case 'url': { const u = v.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, ''); return u.length > 4 && /\./.test(u) ? u : ''; }
      case 'ip': { const i = N.ip(v); return /^\d{1,3}(\.\d{1,3}){3}$/.test(i) || /:/.test(i) ? i : ''; }
      case 'imei': { const d = N.imei(v); return d.length >= 14 ? d : ''; }
      default: { const s = N.upper(v); return s.length >= 3 && !(window.CAF && CAF.junk(t === 'poi' ? 'poi_no' : t === 'agent' ? 'pos_agent' : t, s)) ? s : ''; }
    }
  },
  /* identifier → the complaint numbers it is linked to */
  index() {
    return Analysis.cached('cc:idx', () => {
      const D = S.data || {}, I = new Map(), acc = new Map(), mob = new Map();
      const ack = a => { const v = N.ack(a); return v && v.length >= 4 ? v : ''; };
      const put = (M, k, a) => { if (!k || !a) return; let s = M.get(k); if (!s) M.set(k, s = new Set()); s.add(a); };
      const add = (t, v, acks, src) => { const k = this.key(t, v); if (!k) return; for (const a of acks) { if (!a) continue; const id = t + '|' + k; let g = I.get(id); if (!g) I.set(id, g = { type: t, value: k, acks: new Set(), srcs: new Set() }); g.acks.add(a); g.srcs.add(src); } };
      // 1) what the complaints and the money trail tie to each Ack No
      for (const t of D.txns || []) { const a = ack(t.ack_no); if (!a) continue; put(acc, this.key('account', t.from_acc), a); put(acc, this.key('account', t.to_acc), a); put(mob, this.key('mobile', t.mobile), a); }
      for (const n of D.ncrp || []) { const a = ack(n.ack_no); if (!a) continue; put(acc, this.key('account', n.suspect_acc), a); put(mob, this.key('mobile', n.suspect_mobile), a); }
      const kycAcks = k => { const s = new Set(acc.get(this.key('account', k.acc)) || []); const a = ack(k.ack_no); if (a) s.add(a); return s; };
      for (const k of D.kyc || []) { const s = kycAcks(k), m = this.key('mobile', k.mobile); s.forEach(a => put(mob, m, a)); }
      // 2) identifiers, each with its complaints
      for (const t of D.txns || []) { const a = [ack(t.ack_no)]; if (!a[0]) continue;
        add('account', t.to_acc, a, 'Bank trail'); add('account', t.from_acc, a, 'Bank trail'); add('mobile', t.mobile, a, 'Bank trail'); add('email', t.email, a, 'Bank trail'); add('pan', t.pan, a, 'Bank trail'); add('aadhaar', t.aadhaar, a, 'Bank trail'); }
      for (const n of D.ncrp || []) { const a = [ack(n.ack_no)]; if (!a[0]) continue;
        add('mobile', n.suspect_mobile, a, 'NCRP'); add('account', n.suspect_acc, a, 'NCRP'); add('upi', n.suspect_upi, a, 'NCRP'); add('url', n.suspect_url, a, 'NCRP'); add('email', n.suspect_email, a, 'NCRP'); add('victim', n.victim_mobile, a, 'NCRP'); }
      for (const k of D.kyc || []) { const a = [...kycAcks(k)]; if (!a.length) continue;
        add('account', k.acc, a, 'KYC'); add('mobile', k.mobile, a, 'KYC'); add('email', k.email, a, 'KYC'); add('pan', k.pan, a, 'KYC'); add('aadhaar', k.aadhaar, a, 'KYC'); add('ip', k.ip, a, 'KYC'); if (/@/.test(k.linked || '')) add('upi', k.linked, a, 'KYC'); }
      for (const s of D.social || []) { const a = [...(mob.get(this.key('mobile', s.mobile)) || mob.get(this.key('mobile', s.profile)) || [])]; if (!a.length) continue;
        add('mobile', s.mobile, a, 'Social: ' + (s.platform || 'other')); add('email', s.email, a, 'Social: ' + (s.platform || 'other')); add('ip', s.ip, a, 'Social: ' + (s.platform || 'other')); add('imei', s.imei, a, 'Social: ' + (s.platform || 'other')); }
      for (const c of D.caf || []) { const a = [...(mob.get(this.key('mobile', c.mobile)) || [])]; if (!a.length) continue;
        add('mobile', c.mobile, a, 'CAF'); add('pos', c.pos_name, a, 'CAF'); add('agent', c.pos_agent, a, 'CAF'); add('alt', c.alt, a, 'CAF'); add('poi', c.poi_no, a, 'CAF'); add('aadhaar', c.aadhaar, a, 'CAF'); add('father', c.father, a, 'CAF'); }
      const info = new Map((D.ncrp || []).map(n => [ack(n.ack_no), n]));
      return [...I.values()].map(g => { const L = [...g.acks].sort(); return { type: g.type, label: this.T[g.type] || g.type, value: g.value, n: L.length, acks: L, ackList: L.join(', '), srcs: [...g.srcs].join(', '),
        loss: L.reduce((s, a) => s + (+(info.get(a) || {}).amount || 0), 0), districts: uniq(L.map(a => (info.get(a) || {}).district).filter(Boolean)).join(', ') }; });
    });
  },
  SRC: { financial: /Bank trail|KYC/, social: /Social/, ncrp: /NCRP/, caf: /CAF/ },
  rows(scope, min = 2) { const T = this.SCOPE[scope], F = this.SRC[scope]; return this.index().filter(r => r.n >= min && (!T || T.includes(r.type)) && (!F || F.test(r.srcs))).sort((a, b) => b.n - a.n || b.loss - a.loss); },

  /* the button bar + panel at the top of a common-analysis view */
  mount(host, scope) {
    if (!host || host.querySelector(':scope > .cc-bar')) return;
    const R = this.rows(scope), bar = document.createElement('div'); bar.className = 'card cc-bar';
    bar.innerHTML = `<div class="row"><button class="btn cc-btn ${S.ccOpen ? 'primary' : ''}" data-cc>🗂 Common Case Number <span class="badge">${R.length}</span></button>
      <span class="small muted grow">The same ${esc(this.label(scope))} found in two or more different complaints (NCRP Acknowledgement No).</span></div><div class="cc-panel"></div>`;
    host.prepend(bar);
    const btn = $('[data-cc]', bar), panel = $('.cc-panel', bar);
    const show = () => { btn.classList.toggle('primary', !!S.ccOpen); if (S.ccOpen) this.panel(panel, scope); else panel.innerHTML = ''; };
    btn.onclick = () => { S.ccOpen = !S.ccOpen; show(); };
    show();
  },
  label(scope) { const T = this.SCOPE[scope]; return T ? T.map(t => this.T[t].replace(/^CAF /, '')).join(', ').replace(/, ([^,]*)$/, ' or $1') : 'account, mobile, email, UPI, IP, POS …'; },
  panel(el, scope) {
    const min = S.ccMin || 2, all = this.rows(scope, min), types = uniq(all.map(r => r.type)), f = types.includes(S.ccType) ? S.ccType : '';
    const R = f ? all.filter(r => r.type === f) : all, cases = uniq((S.data.ncrp || []).map(n => n.ack_no).concat((S.data.txns || []).map(t => t.ack_no)).filter(Boolean)).length;
    el.innerHTML = `<div class="cc-head small muted">${fmtNum(cases)} complaint numbers in this case${(activeCase() || {}).fir ? ' · FIR ' + esc(activeCase().fir) : ''}</div>
      <div class="cs-fields"><button class="btn sm ${f ? '' : 'primary'}" data-ct="">All <span class="badge">${all.length}</span></button>${types.map(t => `<button class="btn sm ${t === f ? 'primary' : ''}" data-ct="${t}">${esc(this.T[t])} <span class="badge">${all.filter(r => r.type === t).length}</span></button>`).join('')}
      <label class="small" style="margin-left:8px">In at least <select data-cm>${[2, 3, 4, 5].map(n => `<option ${n === min ? 'selected' : ''}>${n}</option>`).join('')}</select> complaints</label></div><div class="cc-tbl"></div>`;
    $$('[data-ct]', el).forEach(b => b.onclick = () => { S.ccType = b.dataset.ct; this.panel(el, scope); });
    $('[data-cm]', el).onchange = e => { S.ccMin = +e.target.value; this.panel(el, scope); };
    if (!R.length) { $('.cc-tbl', el).innerHTML = `<div class="muted" style="padding:10px 2px">${cases < 2 ? 'Import complaints (NCRP) or a bank trail with two or more Acknowledgement Nos to compare complaints.' : 'Nothing here is shared by two or more complaints.'}</div>`; return; }
    Table($('.cc-tbl', el), { rows: R, exportName: 'common_case_number_' + scope, sortKey: 'n', sortDir: -1, pageSize: 25,
      columns: [{ key: 'value', label: 'Value', render: r => `<b class="mono">${esc(r.value)}</b>` }, { key: 'label', label: 'Type', render: r => `<span class="cc-type">${esc(r.label)}</span>` }, { key: 'n', label: 'Complaints', num: true },
        { key: 'ackList', label: 'Complaint numbers (Ack No)', render: r => `<span class="cc-acks">${r.acks.slice(0, 12).map(a => `<code>${esc(a)}</code>`).join('')}${r.acks.length > 12 ? `<span class="muted small">+${r.acks.length - 12} more</span>` : ''}</span>` }, { key: 'loss', label: 'Reported loss', num: true, render: r => r.loss ? fmtINR(r.loss) : '' },
        { key: 'districts', label: 'Districts', render: r => `<span class="small">${esc(r.districts)}</span>` }, { key: 'srcs', label: 'Found in', render: r => CX.chips(String(r.srcs).split(/,\s*/).filter(Boolean).map(x => [x, 0, '#f97316'])) }, CX.col(r => r.value)],
      onRow: r => this.detail(r) });
  },
  detail(r) {
    const by = new Map((S.data.ncrp || []).map(n => [N.ack(n.ack_no), n]));
    UI.drawer(`${r.label}: ${r.value}`, `<div class="small muted" style="margin-bottom:8px">Found in ${r.n} complaints · ${esc(r.srcs)}</div>` + r.acks.map(a => { const n = by.get(a) || {}, t = (S.data.txns || []).filter(x => N.ack(x.ack_no) === a);
      return `<div class="list-item" data-ack="${esc(a)}" style="cursor:pointer"><div class="grow small"><b class="mono">${esc(a)}</b>${n.date ? ' · ' + esc(n.date) : ''}${n.amount ? ' · ' + fmtINR(n.amount) : ''}<br>${esc([n.victim_name, n.sub_category || n.category, n.district, n.status].filter(Boolean).join(' · ') || (t.length ? t.length + ' trail rows' : 'From bank / CAF records'))}</div></div>`; }).join('') +
      '<div class="small muted" style="margin-top:8px">Click a complaint to open it in Complaint Analysis.</div>');
    $$('#drawer [data-ack]').forEach(d => d.onclick = () => { S.ncrpAck = d.dataset.ack; UI.closeDrawer(); go('ncrp', 'case'); });
  }
};
(() => {
  const AT = { 'financial/common': 'financial', 'social/common': 'social', 'ncrp/common': 'ncrp', 'analytics/common': 'analytics', 'analytics/cross': 'analytics', 'caf/common': 'caf' };
  const inject = page => { const tab = $('#main .tabs .tab.active'), sc = AT[page + '/' + (tab ? tab.dataset.t : '')]; if (sc) CaseCommon.mount($('#tabBody') || $('#main'), sc); };
  Object.keys(Pages).forEach(p => { const orig = Pages[p]; Pages[p] = function () { const r = orig.apply(this, arguments); try { inject(p); } catch (e) { console.warn('casecommon', e); } return r; }; });
  new MutationObserver(() => { const h = $('#tabBody') || $('#main'); if (S.page && h && !h.querySelector(':scope > .cc-bar')) { try { inject(S.page); } catch (e) { } } }).observe($('#main'), { childList: true, subtree: true });
})();
