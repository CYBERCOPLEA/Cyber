/* notgen.js – 📨 Generate Notices: one button on every investigation page.
   Choose whom the notice goes to (Bank / TSP / ISP / Google / Others), pick the template and the recipient, and the draft is
   filled from this case (FIR, PS, IO, accounts, mobiles, profiles). Print / PDF goes to the Letter Register like every other letter;
   Save keeps it in Case File › Notice Drafts. */
'use strict';
const NotGen = {
  CAT: [
    ['bank', '🏦 Bank', ['bank_kyc', 'bank_freeze', 'atm_cctv', 'lift_lien', 'unfreeze', 'sec107']],
    ['tsp', '📶 TSP (Telecom)', ['telecom', 'tel_cdr', 'tel_ipdr', 'tel_tower', 'tel_imei']],
    ['isp', '🌐 ISP / Internet', ['tel_ipdr', 'domain', 'email', 'preserve']],
    ['google', 'Google', ['intermediary', 'email', 'preserve', 'takedown']],
    ['others', '📱 Others (Social media / UPI / Wallet / E-com / Crypto)', ['intermediary', 'takedown', 'preserve', 'upi', 'pg', 'ecom', 'crypto']]
  ],
  TSP: ['Reliance Jio Infocomm Ltd', 'Bharti Airtel Ltd', 'Vodafone Idea Ltd (Vi)', 'Bharat Sanchar Nigam Ltd (BSNL)'],
  ISP: ['Reliance Jio Infocomm Ltd (JioFiber)', 'Bharti Airtel Ltd (Xstream Fiber)', 'ACT Fibernet', 'Hathway', 'Tata Play Fiber', 'Excitel', 'BSNL Broadband'],
  NO: /^(dashboard|settings|others|formats|letters|home|addlink|trend|users|plans|help|guide)$/,
  guess() {
    const t = (S.page || '') + ' ' + (($('#main .page-head h2') || {}).textContent || '') + ' ' + (($('#main .page-head .crumb') || {}).textContent || '');
    if (/google|gmail|android/i.test(t)) return 'google';
    if (/ipdr|\bip\b|isp|internet|domain|e-?mail/i.test(t)) return 'isp';
    if (/cdr|tdr|caf|sms|telecom|tower|imei|\bsim\b|mobile/i.test(t)) return 'tsp';
    if (/bank|financ|trail|ncrp|complaint|money|kyc|statement|nodal|account|target/i.test(t)) return 'bank';
    return 'others';
  },
  banks() { try { return uniq(Analysis.accountRows().filter(a => a.layer > 0 && !isSynthetic(a.acc)).map(a => String(a.bank || '').split(' / ')[0]).filter(Boolean)).sort(); } catch (e) { return []; } },
  plats() { try { return uniq([...S.data.social.map(s => s.platform), ...(typeof PLATFORMS !== 'undefined' ? PLATFORMS : [])]).filter(Boolean); } catch (e) { return []; } },
  open(cat) {
    cat = cat || this.guess(); const self = this;
    const m = UI.modal('📨 Generate Notices', `<div class="ng">
      <div class="ng-h">1 · Notice to</div><div class="ng-cats">${this.CAT.map(([k, l]) => `<button type="button" class="ng-c${k === cat ? ' on' : ''}" data-ng="${k}">${k === 'google' && typeof FX !== 'undefined' && FX.brand ? FX.brand('google', 'ng-g') : ''}${esc(l)}</button>`).join('')}</div>
      <div class="ng-h">2 · Template and recipient</div>
      <div class="ng-f"><label>Template<select id="ngT"></select></label><label id="ngRL">Recipient<select id="ngR"></select></label><label id="ngCL">Name (if not in the list)<input id="ngC" placeholder="Bank / company / platform name"></label><label>Ref No<input id="ngRef" placeholder="optional"></label></div>
      <div class="row" style="gap:8px;margin:10px 0"><button class="btn primary" id="ngGo">✨ Generate</button><span class="small muted">Filled from this case: FIR, PS, IO, accounts, mobiles and profiles. Check the wording before signing.</span></div>
      <textarea id="ngOut" spellcheck="true" style="width:100%;min-height:300px;font-family:Georgia,serif;font-size:14px" placeholder="The notice appears here – you can edit it."></textarea>
      <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn primary" id="ngPr">🖨 Print / PDF</button><button class="btn" id="ngDoc">⬇ Word (.doc)</button><button class="btn" id="ngSv">💾 Save to Notice Drafts</button><button class="btn" id="ngCp">📋 Copy</button><span class="grow"></span><button class="btn" id="ngAll">📂 All notice formats</button></div></div>`);
    const b = m && m.querySelector ? m : $('#mdBody'), T = Notices.T;
    const draw = () => {
      const C = this.CAT.find(x => x[0] === cat) || this.CAT[0];
      $$('.ng-c', b).forEach(x => x.classList.toggle('on', x.dataset.ng === cat));
      $('#ngT', b).innerHTML = C[2].filter(k => T[k]).map(k => `<option value="${k}">${esc(T[k].name)}</option>`).join('') + this.fmts(cat);
      const R = cat === 'bank' ? this.banks() : cat === 'tsp' ? this.TSP : cat === 'isp' ? this.ISP : cat === 'google' ? ['Google LLC'] : this.plats();
      $('#ngR', b).innerHTML = (cat === 'google' ? '' : '<option value="">— choose —</option>') + R.map(x => `<option>${esc(x)}</option>`).join('');
      $('#ngRL', b).firstChild.data = cat === 'bank' ? 'Bank (from this case)' : cat === 'tsp' ? 'Telecom operator' : cat === 'isp' ? 'Internet provider' : cat === 'google' ? 'Recipient' : 'Platform / company';
      gen();
    };
    const gen = () => { const k = $('#ngT', b).value, r = $('#ngC', b).value.trim() || $('#ngR', b).value, ref = $('#ngRef', b).value; if (!k) return;
      try { $('#ngOut', b).value = Notices.fill(k, cat === 'bank' ? r : '', cat === 'bank' || cat === 'tsp' || cat === 'isp' ? '' : r, ref, cat === 'tsp' || cat === 'isp' ? r : (cat === 'google' ? 'Google LLC' : r)).replace(/____________ \(Jio \/ Airtel \/ Vi \/ BSNL\)/, r || '$&'); } catch (e) { console.warn(e); $('#ngOut', b).value = ''; } };
    $$('.ng-c', b).forEach(x => x.onclick = () => { cat = x.dataset.ng; $('#ngC', b).value = ''; draw(); });
    $('#ngGo', b).onclick = gen; $('#ngT', b).onchange = gen; $('#ngR', b).onchange = gen;
    $('#ngPr', b).onclick = () => { const t = $('#ngOut', b).value; if (t.trim()) Reports.printText(t); };
    $('#ngDoc', b).onclick = () => { const t = $('#ngOut', b).value; if (!t.trim()) return; UI.download('notice_' + cat + '.doc', `<html><head><meta charset="utf-8"></head><body style="font-family:Times New Roman;font-size:12pt;white-space:pre-wrap">${esc(t)}</body></html>`, 'application/msword'); };
    $('#ngCp', b).onclick = () => { try { navigator.clipboard.writeText($('#ngOut', b).value); UI.toast('Copied'); } catch (e) { } };
    $('#ngSv', b).onclick = () => { const t = $('#ngOut', b).value; if (!t.trim()) return UI.toast('Nothing to save'); const D = S.data.drafts || (S.data.drafts = []), k = $('#ngT', b).value, tn = (T[k] || {}).name || ($('#ngT', b).selectedOptions[0] || {}).textContent || 'Notice', r = $('#ngC', b).value.trim() || $('#ngR', b).value, now = new Date().toISOString();
      D.push({ id: uid() + '', name: tn.split(' – ')[0] + (r ? ' – ' + r : ''), tpl: k, tplName: tn, text: t, created: now, updated: now }); saveCase(); UI.toast('Saved in Case File › Notice Drafts'); };
    $('#ngAll', b).onclick = () => { UI.closeModal(); go('others'); };
    draw();
  },
  /* the notice formats Vijay added (Notice Format library) for this kind of recipient */
  fmts(cat) { try { if (typeof Formats === 'undefined') return ''; const RX = { bank: /bank|nodal|freeze|lien|atm/i, tsp: /tsp|telecom|cdr|caf|sim|mobile|jio|airtel|vi\b|bsnl/i, isp: /isp|ip\b|internet|domain|e-?mail/i, google: /google|gmail|android|youtube/i, others: /whatsapp|facebook|meta|instagram|telegram|upi|wallet|paytm|phonepe|amazon|flipkart|crypto|social|intermediar/i }[cat];
      const out = []; for (const [cid, cn] of Formats.cats('notice')) for (const x of Formats.items('notice', cid)) if (RX.test(cn + ' ' + (x.name || x.title || ''))) out.push(`<option value="${esc(x.id)}">${esc('Format · ' + (x.name || x.title || cn))}</option>`);
      return out.length ? `<optgroup label="My notice formats">${out.join('')}</optgroup>` : ''; } catch (e) { return ''; } },
  btn() {
    if (this.NO.test(S.page || '') || $('#ngBtn')) return; const h = $('#main .page-head'); if (!h) return;
    let a = $('.ph-actions', h); if (!a) { a = document.createElement('div'); a.className = 'ph-actions'; h.appendChild(a); }
    a.insertAdjacentHTML('beforeend', `<button class="btn ng-btn" id="ngBtn" type="button" title="Make a notice for a Bank, TSP, ISP, Google or other platform, filled from this case">📨 Generate Notices</button>`);
    $('#ngBtn').onclick = () => this.open();
  }
};
(() => { const r0 = render; render = function () { const r = r0.apply(this, arguments); try { NotGen.btn(); } catch (e) { console.warn('notgen', e); } return r; }; })();
