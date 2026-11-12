/* valid.js – mandatory input checks with error popups, for the whole tool (both editions),
   the Offline Data Form file and the Live Data Form page.
   FIR / Complaint No. = exactly 4 digits · NCRP (without FIR) Ack No. = exactly 14 digits
   Mobile = exactly 10 digits (6-9 first), no digit 7+ times in a row, no 7-digit straight run (1234567)
   Year = 4 digits · Note on the staff forms = max 50 characters, no , . or space 4+ times in a row.
   VCK / VPOP / VFORM are plain ES5 so the same code is copied into the staff forms. */
function VCK(k, v, o) {
  v = String(v == null ? '' : v).trim(); if (!v) return '';
  if (k === 'case') {
    var s = v.replace(/\s*\/\s*(19|20)\d\d$/, '');
    var nc = o === 'NCRP' || (o !== 'FIR' && o !== 'COMP' && s.replace(/\D/g, '').length > 6);
    if (nc) return /^\d{14}$/.test(s) ? '' : 'Please enter complete 14 digits Cyber Crime Complaint Acknowledgement No.';
    return /^\d{4}$/.test(s) ? '' : 'Please enter correct 4 digit Complaint / FIR No. (e.g. 1234, 0012, 4590)';
  }
  if (k === 'mobile') {
    var bad = !/^[6-9]\d{9}$/.test(v) || /(\d)\1{6}/.test(v);
    for (var i = 0; !bad && i + 7 <= v.length; i++) { var up = 1, dn = 1; for (var j = i + 1; j < i + 7; j++) { var d = +v[j] - +v[j - 1]; if (d !== 1) up = 0; if (d !== -1) dn = 0; } if (up || dn) bad = true; }
    return bad ? 'Please enter correct Mobile No. (10 digits, numbers only)' : '';
  }
  if (k === 'year') return /^(19|20)\d\d$/.test(v) ? '' : 'Please enter complete Year e.g. 2026';
  if (k === 'note') {
    if (v.length > 50) return 'Note can have at most 50 characters (now ' + v.length + ')';
    if (/([,. ])\1{3,}/.test(v)) return "You can't repeatedly use special characters ( , . or space )";
  }
  return '';
}
function VPOP(E, title) {
  var o = document.getElementById('vPop'); if (o) o.parentNode.removeChild(o);
  if (!document.getElementById('vPopCss')) { var c = document.createElement('style'); c.id = 'vPopCss'; c.textContent = '#vPop{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147483000;display:flex;align-items:center;justify-content:center;font:14px/1.45 Arial,sans-serif}#vPop .vb{background:#fff;color:#0f172a;border-radius:12px;max-width:520px;width:92%;box-shadow:0 20px 50px rgba(0,0,0,.35);overflow:hidden;border-top:6px solid #dc2626}#vPop h3{margin:0;padding:14px 18px 6px;color:#b91c1c;font-size:17px}#vPop ul{margin:0;padding:6px 18px 6px 36px;max-height:50vh;overflow:auto}#vPop li{margin:5px 0}#vPop li b{color:#334155}#vPop .vf{padding:12px 18px;text-align:right;background:#f8fafc}#vPop button{font:inherit;font-weight:bold;padding:8px 22px;border-radius:7px;border:0;background:#dc2626;color:#fff;cursor:pointer}.v-bad,input.v-bad{border-color:#dc2626!important;background:#fef2f2!important;color:#7f1d1d!important;box-shadow:0 0 0 2px rgba(220,38,38,.35)!important}'; document.head.appendChild(c); }
  var q = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  o = document.createElement('div'); o.id = 'vPop';
  o.innerHTML = '<div class="vb" role="alertdialog"><h3>⚠ ' + q(title || 'Please correct before saving') + '</h3><ul>' + E.slice(0, 12).map(function (e) { return '<li>' + (e.where ? '<b>' + q(e.where) + ':</b> ' : '') + q(e.msg) + '</li>'; }).join('') + (E.length > 12 ? '<li>… and ' + (E.length - 12) + ' more</li>' : '') + '</ul><div class="vf"><button type="button">OK</button></div></div>';
  document.body.appendChild(o);
  var close = function () { if (o.parentNode) o.parentNode.removeChild(o); var f = E[0] && E[0].el; if (f && f.focus) { try { f.focus(); f.select && f.select(); } catch (x) { } } };
  o.querySelector('button').onclick = close; o.onclick = function (ev) { if (ev.target === o) close(); };
  o.querySelector('button').focus();
}
/* staff forms: rows carry inputs with data-k = fir / year / type / value / note; the send / submit button is #sb */
function VFORM() {
  if (window.__vform) return; window.__vform = 1;
  var NM = { fir: 'FIR / Case No.', year: 'Year', note: 'Note', value: 'Mobile' };
  function one(el, k, o) { var m = VCK(k, el.value, o); el.classList.toggle('v-bad', !!m); el.title = m; return m; }
  function rowOf(el) { return el.closest('.en') || el.closest('tr'); }
  function kindOf(el) { var k = el.getAttribute('data-k'), r = rowOf(el); if (k === 'fir') return 'case'; if (k === 'year' || k === 'note') return k;
    if (k === 'value' && r) { var t = r.querySelector('[data-k=type]'); if (t && (t.value === 'mobile' || t.value === 'whatsapp')) return 'mobile'; } if (el.id === 'sm') return 'mobile'; return ''; }
  function check() { var E = [], n = 0;
    var sm = document.getElementById('sm'); if (sm && !sm.disabled) { var m0 = one(sm, 'mobile'); if (m0) E.push({ el: sm, where: 'Your Mobile', msg: m0 }); }
    [].slice.call(document.querySelectorAll('[data-k=value]')).forEach(function (vi) { var r = rowOf(vi); n++; if (!r || !String(vi.value || '').trim()) return;
      ['fir', 'year', 'value', 'note'].forEach(function (k) { var el = r.querySelector('input[data-k=' + k + ']'); if (!el) return; var kd = kindOf(el); if (!kd) { el.classList.remove('v-bad'); return; } var m = one(el, kd); if (m) E.push({ el: el, where: 'Entry ' + n + ' – ' + NM[k], msg: m }); }); });
    return E; }
  document.addEventListener('click', function (ev) { var b = ev.target && ev.target.closest && ev.target.closest('#sb'); if (!b) return; var E = check(); if (E.length) { ev.preventDefault(); ev.stopImmediatePropagation(); VPOP(E, 'Please correct ' + E.length + ' entr' + (E.length > 1 ? 'ies' : 'y') + ' before sending'); } }, true);
  document.addEventListener('focusout', function (ev) { var el = ev.target; if (!el || el.tagName !== 'INPUT') return; var k = kindOf(el); if (k) one(el, k); }, true);
  document.addEventListener('input', function (ev) { var el = ev.target; if (el && el.classList && el.classList.contains('v-bad')) { var k = kindOf(el); if (k && !VCK(k, el.value)) { el.classList.remove('v-bad'); el.title = ''; } } }, true);
  document.addEventListener('change', function (ev) { var el = ev.target; if (el && el.getAttribute && el.getAttribute('data-k') === 'type') { var r = rowOf(el), v = r && r.querySelector('input[data-k=value]'); if (v) { var k = kindOf(v); if (k) one(v, k); else { v.classList.remove('v-bad'); v.title = ''; } } } }, true);
}

/* ---------- inside the tool ---------- */
const Valid = {
  formSrc() { return VCK.toString() + '\n' + VPOP.toString() + '\n' + VFORM.toString() + '\nVFORM();'; },
  label(inp) { let L = inp.closest('label'); if (!L && inp.id) L = document.querySelector(`label[for="${CSS.escape(inp.id)}"]`);
    if (!L) { const p = inp.previousElementSibling; if (p && p.tagName === 'LABEL') L = p; }
    return L ? [...L.childNodes].filter(n => n.nodeType === 3 || (n.tagName && !/^(INPUT|SELECT|TEXTAREA|BUTTON|DATALIST)$/.test(n.tagName))).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim() : ''; },
  /* returns [kind, option] for an input, or null */
  kind(inp) {
    if (!inp || inp.tagName !== 'INPUT' || inp.disabled || inp.readOnly || !/^(text|tel|number|)$/.test(inp.type || '') || inp.dataset.nov != null) return null;
    if (inp.closest('#vPop')) return null;
    const id = inp.id, sel = s => (document.getElementById(s) || {}).value || '';
    if (inp.dataset.vk) return [inp.dataset.vk, inp.dataset.vo || ''];
    if (id === 'eNo') return ['case', sel('eTy')];
    if (id === 'eFn') return ['case', 'FIR'];
    if (id === 'cxV') return /^(mobile|whatsapp)$/.test(sel('cxT')) ? ['mobile'] : null;
    if (inp.dataset.cb === 'fir') return ['case', /ncrp|without fir/i.test(((inp.closest('.cb-grid, .map-grid') || document).querySelector('[data-cb=ctype]') || {}).value || '') ? 'NCRP' : ''];
    const L = this.label(inp); if (!L || L.length > 60) return null;
    if (/mobile|मोबाइल/i.test(L) && !/imei|search|find|e-?mail|\/\s*whats|count|how many/i.test(L)) return ['mobile'];
    if (/^(year|वर्ष)\b|\byear\s*\*?$/i.test(L) && !/financial|from|to\b/i.test(L)) return ['year'];
    if (/\b(fir|complaint|comp|ncrp|ack(nowledge?ment)?)\b\.?\s*(no|number|सं)/i.test(L) || /case\s*\/\s*complaint\s*no/i.test(L)) return ['case', /ncrp|ack/i.test(L) && !/fir|complaint/i.test(L) ? 'NCRP' : /^fir\b/i.test(L) ? 'FIR' : ''];
    return null;
  },
  shown(inp) { return !!(inp.offsetWidth || inp.offsetHeight || inp.getClientRects().length); },
  mark(inp) { const k = this.kind(inp); if (!k) return ''; const m = VCK(k[0], inp.value, k[1]); inp.classList.toggle('v-bad', !!m); inp.title = m; return m; },
  check(box) { const E = []; if (!box) return E;
    $$('input', box).forEach(inp => { if (!this.shown(inp)) return; const m = this.mark(inp); if (m) E.push({ el: inp, where: this.label(inp) || 'Field', msg: m }); });
    return E; },
  pop(E, title) { VPOP(E, title); },
  /* imported rows: year must be 4 digits */
  yearAudit(rows, where, quiet) {
    const bad = rows.filter(r => r && String(r.year || '').trim() && VCK('year', r.year));
    if (!bad.length) return 0;
    const E = bad.slice(0, 12).map(r => ({ where: (r.value || r.no || r.name || 'Entry') + (r.by ? ' (' + r.by + ')' : ''), msg: 'Year "' + r.year + '" – please enter complete Year e.g. 2026' }));
    if (bad.length > 12) E.push({ msg: '… ' + (bad.length - 12) + ' more' });
    if (quiet) UI.toast(`⚠ ${bad.length} imported entr${bad.length > 1 ? 'ies have' : 'y has'} a wrong Year (not 4 digits) – ${where}`, 7000);
    else this.pop(E, `${bad.length} imported entr${bad.length > 1 ? 'ies have' : 'y has'} a wrong Year – ${where}`);
    return bad.length;
  },
  init() {
    /* Save / Add / Submit (any primary button) is stopped while a field on its form is wrong */
    document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('button.primary, .btn.primary, button[type=submit]'); if (!b || b.dataset.nov != null || b.closest('#vPop')) return;
      const box = b.closest('#modal') ? $('#mdBody') : b.closest('form, .ip-case, .cbm, .card, .hub-f, .panel'); if (!box) return;
      const E = this.check(box); if (E.length) { ev.preventDefault(); ev.stopImmediatePropagation(); this.pop(E); } }, true);
    document.addEventListener('focusout', ev => { const t = ev.target; if (t && t.tagName === 'INPUT') this.mark(t); }, true);
    document.addEventListener('input', ev => { const t = ev.target; if (t && t.classList && t.classList.contains('v-bad')) this.mark(t); }, true);
    document.addEventListener('change', ev => { const t = ev.target; if (!t || !t.id) return; const x = { eTy: 'eNo', cxT: 'cxV' }[t.id]; if (x && $('#' + x)) { const i = $('#' + x); if (i.value.trim()) this.mark(i); else i.classList.remove('v-bad'); if (!this.kind(i)) { i.classList.remove('v-bad'); i.title = ''; } } }, true);
  }
};
Valid.init();
