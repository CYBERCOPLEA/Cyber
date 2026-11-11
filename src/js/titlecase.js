/* titlecase.js – every heading, tab, button, label, column name, drop-down item, box title and badge in the whole tool is shown
   in Title Case ("Money by Layer", "Top Receiving Banks", "Draft Notice"). Short words (by, of, in, to, and…) stay small,
   acronyms (CDR, IPDR, IMEI, FIR) and data (numbers, IDs, e-mails, addresses in tables) are left as they are.
   Help sentences stay in normal sentence form. Works on every page as it is drawn. */
'use strict';
const TC = {
  SMALL: new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'up', 'via', 'vs', 'with', 'than', 'via', 'x']),
  KEEP: new Set(['am', 'pm', 'e.g.', 'i.e.', 'etc', 'etc.', 'km', 'kb', 'mb', 'gb', 'ms', 'px', 'rec', 'nos.', 'no.']),
  SEL: 'h1,h2,h3,h4,h5,h6,.tab,button,.btn,th,label,legend,summary,option,.kpi .label,.nav-item,.nav-sub,.nav-group,.tf-h,.cx-hl,.ap-p,.badge,.tf-chip,.xm-fb small,.tsc-f>span,.xm-l,.ti-step,.tel-k,.hp-feat b,.hp-kicker,.lg-head b,.crumb,.page-title,.ip-st,.tile-t,.dt-title,.d2-tt,.d2-th>b,[class*="title"],[class$="-tt"],[class$="-th"]>b,.card-h,[data-tc]',
  HARD: 'input,textarea,#caseSel,#tscCase,#tiCase,#tscNum,#cbSel,svg,code,pre,.mono,.no-tc,[contenteditable]',
  SKIP: 'input,textarea,#caseSel,#tscCase,#tiCase,#tscNum,#cbSel,svg,td,code,pre,.mono,.no-tc,[contenteditable],.value,.hint,.sub,.muted,.small,.ap-f,.ap-a,.tf-tx,.tf-sg,a[href^="http"]',
  STRONG: 'h1,h2,h3,h4,h5,h6,.tab,button,.btn,th,label,option,.badge,.tf-chip,.nav-item,.nav-sub,a.btn',
  NOSEL: new Set(['caseSel', 'tscCase', 'tiCase', 'tscNum', 'cbSel']),
  word(w, first) {
    if (w.includes('-') && !/[@_\d]|:\/\/|\w\.\w/.test(w)) { const P = w.split('-'); return P.map((x, i) => i && /^[a-z]{2,}/.test(x) && !/[A-Z]/.test(x) ? this.word(x, false) : i ? x : this.word(x, first)).join('-'); }
    if (!/^[a-z]/.test(w) || /[A-Z]/.test(w) || /\d/.test(w) || /[@_]|:\/\/|\w\.\w/.test(w) || this.KEEP.has(w.toLowerCase().replace(/[^a-z.]+$/, '')) || this.KEEP.has(w.toLowerCase().replace(/[^a-z]+$/, ''))) return w;
    if (!first && this.SMALL.has(w.replace(/[^a-z]/g, ''))) return w;
    return w.replace(/(^|[-/(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  },
  text(s) {
    const t = s.trim(); if (!t || t.length > 70 || !/[a-z]/.test(t)) return s;
    const W = t.split(/\s+/); if (W.length > 9 || /[.?!]$/.test(t) && !/\b(e\.g|i\.e|etc|no|nos)\.$/i.test(t) || /\.\s+[A-Za-z]/.test(t)) return s;
    let first = true;
    return s.replace(/\S+/g, w => { const lead = w.match(/^[^A-Za-z0-9]*/)[0], core = w.slice(lead.length); if (!core) return w; const r = lead + this.word(core, first || /[–:—|·]$/.test(lead)); first = false; return r; });
  },
  el(e) {
    if (e.closest(this.HARD) || (!e.matches(this.STRONG) && e.closest(this.SKIP))) return;
    if (e.tagName === 'OPTION') { const s = e.parentElement && e.parentElement.closest('select'); if (s && (this.NOSEL.has(s.id) || s.classList.contains('no-tc'))) return; }
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && n.parentElement !== e && n.parentElement.closest(this.SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = w.nextNode())) { const v = n.nodeValue, x = this.text(v); if (x !== v) n.nodeValue = x; }
    if (e.tagName === 'OPTGROUP' && e.label) e.label = this.text(e.label);
  },
  run(root) { if (!root || root.nodeType !== 1) return; if (root.matches(this.SEL)) this.el(root); root.querySelectorAll(this.SEL).forEach(e => this.el(e)); root.querySelectorAll('optgroup').forEach(g => { g.label = this.text(g.label); }); },
  _q: new Set(), _t: 0,
  init() {
    this.run(document.body);
    new MutationObserver(M => { for (const m of M) for (const n of m.addedNodes) { if (n.nodeType === 1) this._q.add(n); else if (n.nodeType === 3 && n.parentElement) this._q.add(n.parentElement); }
      if (!this._t) this._t = requestAnimationFrame(() => { this._t = 0; const q = [...this._q]; this._q.clear(); for (const e of q) if (e.isConnected) { const p = e.closest(this.SEL); if (p && p !== e) this.el(p); else this.run(e); } }); }).observe(document.body, { childList: true, subtree: true });
  }
};
TC.init();
