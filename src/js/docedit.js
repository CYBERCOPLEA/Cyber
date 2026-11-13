/* docedit.js – ONE editing / formatting bar for every document in the tool:
   EO Enquiry Report, Criminal Dossier, Case One File and every Print / PDF window (notices, letters, case file
   drafts, press note, duty chart, case diary, dossiers …). Edits made in a Print window go to Print, Word and HTML. */
'use strict';
const DocEdit = {
  T: [['bold', '<b>B</b>', 'Bold'], ['italic', '<i>I</i>', 'Italic'], ['underline', '<u>U</u>', 'Underline'], ['dline', '<span style="border-bottom:3px double currentColor">U̳</span>', 'Double Underline'], ['strikeThrough', '<s>S</s>', 'Strike Through'], ['|'],
    ['hr', '―', 'Insert Line'], ['box', '▭', 'Put In A Box (Border)'], ['shade', '▦', 'Shaded Box'], ['|'],
    ['justifyLeft', '⯇', 'Align Left'], ['justifyCenter', '≡', 'Align Center'], ['justifyRight', '⯈', 'Align Right'], ['justifyFull', '☰', 'Justify'], ['|'],
    ['insertUnorderedList', '• List', 'Bullets'], ['insertOrderedList', '1. List', 'Numbering'], ['indent', '→', 'Indent'], ['outdent', '←', 'Outdent'], ['|'],
    ['h', 'H', 'Heading'], ['bigger', 'A+', 'Bigger Text'], ['smaller', 'A−', 'Smaller Text'], ['row', '+ Row', 'Add A Table Row Below (click in a table first)'], ['delrow', '− Row', 'Delete This Table Row'], ['removeFormat', '⌫', 'Clear Formatting'], ['undo', '↶', 'Undo'], ['redo', '↷', 'Redo']],
  FONTS: ['Arial', 'Arial Narrow', 'Times New Roman', 'Calibri', 'Cambria', 'Georgia', 'Verdana', 'Tahoma', 'Mangal', 'Kokila', 'Nirmala UI'],
  CSS: '.de-tb{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:0 0 8px;padding:6px;border:1px solid var(--border,#cbd5e1);border-radius:8px}.de-tb .btn.sm,.de-tb button{min-width:30px;justify-content:center}.de-sep{width:1px;height:22px;background:var(--border,#cbd5e1);margin:0 3px}.de-col{display:inline-flex;align-items:center;gap:3px;font-size:12px;flex-direction:row}.de-col input{width:26px;height:22px;padding:0;border:0;background:none}.de-tb select{max-width:130px;height:28px}',
  /* o: { root: () => element being edited, doc: document (default this page), changed(), reset(), only: [keys], noFont } */
  bar(tb, o = {}) {
    const d = o.doc || document, root = o.root, changed = o.changed || (() => { }), T = o.only ? this.T.filter(([k]) => o.only.includes(k)) : this.T;
    tb.classList.add('de-tb');
    tb.innerHTML = (o.noFont ? '' : `<select data-de="font" title="Font of the selected text"><option value="">Font…</option>${this.FONTS.map(f => `<option style="font-family:'${f}'">${f}</option>`).join('')}</select><select data-de="size" title="Size of the selected text"><option value="">Size…</option>${[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28].map(n => `<option value="${n}">${n} pt</option>`).join('')}</select>`) +
      T.map(([k, l, t]) => k === '|' ? '<span class="de-sep"></span>' : `<button type="button" class="btn sm" data-ex="${k}" title="${t}" data-nov>${l}</button>`).join('') +
      (o.only ? '' : '<label class="de-col" title="Text Colour">A <input type="color" data-col="foreColor" value="#c00000"></label><label class="de-col" title="Highlight">🖍 <input type="color" data-col="hiliteColor" value="#ffff00"></label>') +
      (o.reset ? '<button type="button" class="btn sm" data-ex="reset" title="Throw away edits and make it again" data-nov>↺ Fresh Copy</button>' : '') + (o.tail || '');
    let rng = null; const R = () => root && root();
    const keep = () => { const s = d.getSelection(); if (s && s.rangeCount && R() && R().contains(s.anchorNode)) rng = s.getRangeAt(0).cloneRange(); };
    d.addEventListener('selectionchange', keep);
    const back = () => { const s = d.getSelection(); if (rng && s && !(s.rangeCount && R() && R().contains(s.anchorNode))) { s.removeAllRanges(); s.addRange(rng); } };
    const sel = () => { back(); const s = d.getSelection(); return s && s.rangeCount && R() && R().contains(s.anchorNode) ? s : null; };
    const toast = m => (typeof UI !== 'undefined' ? UI.toast(m) : alert(m));
    const wrap = (tag, css) => { const s = sel(); if (!s) return toast('Select some text in the document first'); const r = s.getRangeAt(0), x = d.createElement(tag); x.setAttribute('style', css); x.appendChild(r.extractContents()); if (!x.textContent.trim()) x.textContent = 'Text'; r.insertNode(x); s.removeAllRanges(); rng = null; changed(); };
    const ex = (c, v = null) => { back(); try { d.execCommand('styleWithCSS', false, true); } catch (e) { } d.execCommand(c, false, v); };
    const tr = () => { const s = d.getSelection(); let n = s && s.anchorNode; while (n && n !== R() && n.nodeName !== 'TR') n = n.parentNode; return n && n.nodeName === 'TR' ? n : null; };
    tb.addEventListener('mousedown', e => { if (e.target.closest('[data-ex]')) e.preventDefault(); });
    tb.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { const k = b.dataset.ex;
      if (k === 'reset') return o.reset();
      if (k === 'hr') ex('insertHTML', '<hr style="border:0;border-top:1.5px solid #000;margin:8px 0">');
      else if (k === 'dline') return wrap('span', 'border-bottom:3px double #000');
      else if (k === 'box') return wrap('div', 'border:1.5px solid #000;padding:6px 8px;margin:6px 0');
      else if (k === 'shade') return wrap('div', 'border:1px solid #000;background:#eef1f7;padding:6px 8px;margin:6px 0');
      else if (k === 'bigger' || k === 'smaller') return wrap('span', 'font-size:' + (k === 'bigger' ? '1.2em' : '.85em'));
      else if (k === 'h') ex('formatBlock', 'h4');
      else if (k === 'row' || k === 'delrow') { back(); const t = tr(); if (!t) return toast('Click inside a table row first'); if (k === 'delrow') t.remove(); else { const n = t.cloneNode(true); [...n.cells].forEach(c => c.innerHTML = '&nbsp;'); t.after(n); } }
      else ex(k);
      changed(); });
    tb.querySelectorAll('[data-col]').forEach(i => i.onchange = () => { if (!sel()) return toast('Select some text in the document first'); ex(i.dataset.col, i.value); changed(); });
    const fs = tb.querySelector('[data-de="font"]'), sz = tb.querySelector('[data-de="size"]');
    if (fs) fs.onchange = () => { const v = fs.value; fs.value = ''; if (v && sel()) { ex('fontName', v); changed(); } };
    if (sz) sz.onchange = () => { const v = sz.value; sz.value = ''; if (v) wrap('span', 'font-size:' + v + 'pt'); };
  },
  /* ---------- every Print / PDF window: Edit, formatting, Print, Word, HTML ---------- */
  popup(w) {
    let d; try { d = w.document; } catch (e) { return; } if (!d || !d.body || d.getElementById('deBar')) return;
    const doc = d.createElement('div'); doc.id = 'deDoc'; [...d.body.childNodes].forEach(n => { if (!(n.nodeType === 1 && n.matches('script'))) doc.appendChild(n); }); d.body.appendChild(doc);
    d.head.insertAdjacentHTML('beforeend', `<style id="deCss">${this.CSS}#deBar{position:sticky;top:0;z-index:99;background:#f8fafc;border-bottom:1px solid #cbd5e1;padding:6px 8px;font:13px Arial,sans-serif;color:#111;margin:-8px -8px 10px}#deBar button,#deBar select{font:13px Arial,sans-serif;padding:4px 8px;border:1px solid #94a3b8;border-radius:6px;background:#fff;cursor:pointer}#deBar .pri{background:#2563eb;color:#fff;border-color:#2563eb}#deBar .on{background:#f59e0b;color:#111}#deDoc[contenteditable=true]{outline:2px dashed #3b82f6;outline-offset:4px}#deDoc .np{display:none!important}@media print{#deBar{display:none!important}#deDoc{outline:0!important}}</style>`);
    const bar = d.createElement('div'); bar.id = 'deBar'; bar.className = 'np'; bar.contentEditable = 'false';
    bar.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button id="deEd" title="Change any text, header or table before printing / saving">✏ Edit</button><button class="pri" id="dePr">🖨 Print / Save as PDF</button><button id="deW">📘 Word</button><button id="deH">🌐 HTML</button><span style="opacity:.7">Edits made here go to Print, Word and HTML.</span></div><div id="deTb" style="display:none;margin-top:6px"></div>`;
    d.body.insertBefore(bar, doc);
    this.bar(d.getElementById('deTb'), { doc: d, root: () => doc });
    const ed = on => { doc.contentEditable = on ? 'true' : 'false'; d.getElementById('deTb').style.display = on ? '' : 'none'; const b = d.getElementById('deEd'); b.className = on ? 'on' : ''; b.textContent = on ? '✔ Done Editing' : '✏ Edit'; if (on) doc.focus(); };
    d.getElementById('deEd').onclick = () => ed(doc.contentEditable !== 'true');
    d.getElementById('dePr').onclick = () => { ed(false); w.focus(); w.print(); };
    const out = () => { const h = d.documentElement.cloneNode(true); h.querySelectorAll('#deBar,#deCss,.np').forEach(x => x.remove()); const dd = h.querySelector('#deDoc'); if (dd) { dd.removeAttribute('contenteditable'); dd.removeAttribute('id'); } return '<!DOCTYPE html>' + h.outerHTML; };
    const name = () => (d.title || 'document').replace(/[^\w\- ]+/g, ' ').trim().replace(/\s+/g, '_').slice(0, 80) || 'document';
    d.getElementById('deW').onclick = () => UI.download(name() + '.doc', out().replace('<html', '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"'), 'application/msword');
    d.getElementById('deH').onclick = () => UI.download(name() + '.html', out(), 'text/html');
  }
};

/* every blank window the tool opens for printing gets the bar once its page is written */
(() => {
  const wo = window.open;
  window.open = function (u, ...a) {
    const w = wo.call(window, u, ...a);
    if (w && (!u || u === 'about:blank')) { try { const d = w.document, oc = d.close.bind(d); d.close = function () { const r = oc(); setTimeout(() => DocEdit.popup(w), 0); return r; }; } catch (e) { } }
    return w;
  };
  if (!document.getElementById('deCssMain')) document.head.insertAdjacentHTML('beforeend', `<style id="deCssMain">${DocEdit.CSS}</style>`);

  /* EO report uses the shared bar */
  if (typeof EO !== 'undefined') EO.editBar = function (tb, root, changed, reset) { DocEdit.bar(tb, { root, changed, reset }); };

  /* Criminal Dossier: the same full bar in place of its short one */
  if (typeof Arrest !== 'undefined' && Arrest.dossier) {
    const od = Arrest.dossier;
    Arrest.dossier = async function (el) { const r = await od.apply(this, arguments); const g = $('.dz-grp', el), doc = $('#dzDoc', el);
      if (g && doc) { const tb = document.createElement('div'); tb.className = 'dz-de'; g.replaceWith(tb); DocEdit.bar(tb, { root: () => doc }); } return r; };
  }
  /* Case One File: add the tools its bar does not have */
  if (typeof OneFile !== 'undefined' && OneFile.edit) {
    const oe = OneFile.edit;
    OneFile.edit = function (el, on) { const r = oe.apply(this, arguments); const bar = $('#ofFmt', el), doc = $('#ofDoc .of', el);
      if (on && bar && doc && !$('.of-de', bar)) { const x = document.createElement('div'); x.className = 'of-de'; x.style.cssText = 'flex-basis:100%;margin:4px 0 0'; bar.appendChild(x); DocEdit.bar(x, { root: () => doc, only: ['dline', 'hr', 'box', 'shade', 'indent', 'outdent', 'bigger', 'smaller'], noFont: true }); x.style.border = '0'; x.style.padding = '0'; }
      return r; };
  }
})();
