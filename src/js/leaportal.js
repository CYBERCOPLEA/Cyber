/* leaportal.js – Investigation › "All LEA Portal" drop-down: one click opens each law-enforcement portal in a new tab.
   Links can be changed or added (kept in this browser only). */
'use strict';
const LEA = {
  LIST: [
    ['wa-rec', '🟢', 'Meta-WhatsApp Records', 'https://www.whatsapp.com/records/login'],
    ['fb-rec', '🔵', 'Meta-Facebook Records', 'https://www.facebook.com/records/login/'],
    ['th-rec', '🧵', 'Meta-Threads Records', 'https://www.facebook.com/records/login/'],
    ['wa', '💬', 'Meta-WhatsApp', 'https://www.whatsapp.com/records/login'],
    ['x', '✖️', 'X (Twitter) LEA Request', 'https://legalrequests.twitter.com/forms/landing_disclaimer'],
    ['snap', '👻', 'Snapchat LEA', 'https://less.snapchat.com/'],
    ['google', '🔍', 'Google LERS LEA', 'https://lers.google.com/u/1/v2/request'],
    ['ms', '🪟', 'Microsoft LEA', 'https://v2.leportal.microsoft.com/'],
    ['apple', '🍎', 'Apple LEA', 'https://lep.apple.com/leapp&rv=2'],
    ['phonepe', '🟣', 'PhonePe LEA', 'https://cybercell.phonepe.com/'],
    ['gpay', '💳', 'GPay Portal India', 'https://support.google.com/pay/india/contact/pay_india_requests'],
    ['amazon', '📦', 'Amazon LEA', 'https://apac.ler.amazon.com/in'],
    ['sahyog', '🤝', 'MHA-Sahyog Portal', 'https://sahyog.mha.gov.in/'],
    ['bharatpol', '🌐', 'MHA-BHARATPOL', 'https://bharatpol.cbi.gov.in/'],
    ['samanvaya', '🔗', 'MHA-SAMANVAYA JMIS', 'https://jcct-i4c.mha.gov.in/login.aspx'],
    ['mlat', '⚖️', 'MHA-MLAT', 'https://mlat.mha.gov.in/index.aspx'],
    ['cybersafe', '🛡️', 'MHA-Cyber Safe Portal', 'https://cybersafe.gov.in/'],
    ['mrm', '💰', 'MHA-MRM-Money Restoration Portal', 'https://mrm-ncrp.mha.gov.in/restoration/'],
    ['grm', '📝', 'MHA-GRM-Grievance Redressal Mechanism Portal', 'https://ncrp-grievanceredressal.mha.gov.in/'],
    ['ceir', '📵', 'MHA-CEIR-Mobile Lost', 'https://ceir.gov.in/General/index.jsp'],
    ['anveshak', '🕵️', 'MHA-Anveshak OSINT', 'https://anveshaktool.in/'],
    ['finnav', '📊', 'UP-FinNavigator Financial', 'https://finnavigatorai.com/'],
    ['jio', '📶', 'JIO SDR', 'https://subscriber.jio.com/#/auth/login'],
    ['airtel', '📡', 'Airtel SDR', 'https://transfer.icubesolution.com:12000/login'],
    ['vi', '📱', 'VI SDR', 'https://subs.vodafoneidea.com:8443/viportal/'],
    ['bsnl', '☎️', 'BSNL SDR', 'https://sdrinfo.bsnl.co.in/'],
    ['tower', '🗼', 'Tower Locator', ''],
    ['igot', '🎓', 'iGot-KARMYOGI', 'https://igotkarmayogi.gov.in/#/sadhana-saptah'],
    ['igrs', '🏛️', 'IGRS-Jansunwai UP LEA', 'https://jansunwai.up.nic.in/login'],
    // more portals
    ['nicmail', '✉️', 'NIC Mail (mail.gov.in)', 'https://mail.gov.in'],
    ['jansunwai', '🗳️', 'Jansunwai UP (public)', 'https://jansunwai.up.nic.in/'],
    ['ncrp', '🚨', 'NCRP – Cyber Police (cyberpolice.nic.in)', 'https://cyberpolice.nic.in/'],
    ['mrm-pub', 'ℹ️', 'MHA-MRM Public Info', 'https://mrm-ncrp.mha.gov.in/public-info'],
    ['cycord', '🧩', 'CyCord', 'https://cycord.gov.in/homepage/login/'],
    ['digipol', '👮', 'Digital Police', 'https://digitalpolice.gov.in/'],
    ['parichay', '🔐', 'Parichay (NIC sign-in)', 'https://parichay.nic.in/pnv1/assets/?sid=1234567899'],
    ['kodex', '🗂️', 'Kodex LE Portal', 'https://app.kodexglobal.com/signin'],
    ['pinterest', '📌', 'Pinterest LEA', 'https://help.pinterest.com/en/law-enforcement'],
    ['uber', '🚕', 'Uber LERT', 'https://lert.uber.com/s/login/?language=en_US'],
    ['razorpay', '💸', 'Razorpay Cyber Crime', 'https://razorpay.com/support/?cybercrime=true']
  ],
  KEY: 'sud-lea-links',
  saved() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch (e) { return {}; } },
  all() {
    const s = this.saved(), ov = s.urls || {}, ord = s.order || [], pos = id => { const i = ord.indexOf(id); return i < 0 ? 1e6 : i; };
    return [...this.LIST.filter(x => !(s.hidden || []).includes(x[0])).map(([id, ic, name, url]) => [id, ic, name, ov[id] != null ? ov[id] : url]), ...(s.extra || []).map(x => [x.id, x.ic || '🔗', x.name, x.url])].map((x, i) => [x, i]).sort((a, b) => pos(a[0][0]) - pos(b[0][0]) || a[1] - b[1]).map(x => x[0]);
  },
  store(s) { localStorage.setItem(this.KEY, JSON.stringify(s)); },
  open(id) {
    const p = this.all().find(x => x[0] === id); if (!p) return;
    if (!p[3]) { this.edit(id); return; }
    window.open(p[3], '_blank', 'noopener');
  },
  edit(focus) {
    const s = this.saved(); s.urls = s.urls || {}; s.extra = s.extra || [];
    const rows = this.all(), take = () => $$('[data-lid]', body).forEach(i => { const id = i.dataset.lid, v = i.value.trim(), ex = s.extra.find(x => x.id === id), def = this.LIST.find(x => x[0] === id);
      if (ex) ex.url = v; else if (def && v !== def[3]) s.urls[id] = v; else delete s.urls[id]; s.order = $$('[data-lid]', body).map(x => x.dataset.lid); });
    const body = UI.modal('All LEA Portal – links', `<div class="sub" style="margin-bottom:8px">Change any link or add a new portal. To change the order, drag <b>⠿</b> or use <b>▲ ▼</b>. Saved in this browser only.</div>
      <div class="lea-ed">${rows.map(([id, ic, name, url]) => `<div class="lea-row" data-row><span class="lea-drag" title="Drag to move">⠿</span><span>${ic} ${esc(name)}</span><input data-lid="${esc(id)}" value="${esc(url)}" placeholder="https://…"><span class="lea-mv"><button class="btn sm" data-up title="Move up">▲</button><button class="btn sm" data-dn title="Move down">▼</button></span></div>`).join('')}</div>
      <div class="lea-add"><input id="leaN" placeholder="New portal name"><input id="leaU" placeholder="https://…"><button class="btn sm" id="leaA">➕ Add</button></div>`,
      [{ label: 'Reset to default', onClick: () => { if (UI.confirm('Reset all LEA portal links to the default list?')) { localStorage.removeItem(this.KEY); UI.closeModal(); this.side(); } } },
       { label: 'Save', cls: 'primary', onClick: () => {
          take(); this.store(s); UI.closeModal(); this.side(); UI.toast('LEA portal links saved'); } }]);
    const ed = $('.lea-ed', body); let drag = null;
    const flash = r => { r.classList.remove('lea-moved'); void r.offsetWidth; r.classList.add('lea-moved'); };
    ed.addEventListener('click', e => { const b = e.target.closest('[data-up],[data-dn]'); if (!b) return; e.preventDefault(); const r = b.closest('[data-row]');
      if (b.hasAttribute('data-up') && r.previousElementSibling) ed.insertBefore(r, r.previousElementSibling);
      else if (b.hasAttribute('data-dn') && r.nextElementSibling) ed.insertBefore(r.nextElementSibling, r);
      flash(r); r.scrollIntoView({ block: 'nearest' }); });
    ed.addEventListener('mousedown', e => { const h = e.target.closest('.lea-drag'); if (h) h.parentElement.draggable = true; });
    ed.addEventListener('dragstart', e => { drag = e.target.closest('[data-row]'); if (!drag) return; drag.classList.add('lea-dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (x) { } });
    ed.addEventListener('dragover', e => { if (!drag) return; e.preventDefault(); const r = e.target.closest('[data-row]'); if (!r || r === drag) return; const b = r.getBoundingClientRect(); ed.insertBefore(drag, e.clientY > b.top + b.height / 2 ? r.nextElementSibling : r); });
    ed.addEventListener('drop', e => e.preventDefault());
    ed.addEventListener('dragend', () => { if (!drag) return; drag.classList.remove('lea-dragging'); drag.draggable = false; flash(drag); drag = null; });
    $('#leaA', body).onclick = () => { const n = $('#leaN', body).value.trim(), u = $('#leaU', body).value.trim(); if (!n || !/^https?:\/\//i.test(u)) return UI.toast('Give a name and a link starting with https://'); take(); s.extra.push({ id: 'x' + Date.now(), ic: '🔗', name: n, url: u }); this.store(s); UI.closeModal(); this.side(); this.edit(); };
    const f = focus && $(`[data-lid="${focus}"]`, body); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); }
  },
  side: () => { }
};

(() => {
  const nav = $('#sidebar'), soc = nav && $('.nav-item[data-page="social"]', nav); if (!soc) return;
  const after = soc.nextElementSibling && soc.nextElementSibling.classList.contains('nav-subs') ? soc.nextElementSibling : soc;
  after.insertAdjacentHTML('afterend', `<div class="nav-item lea-item" title="Open any law-enforcement portal (LERS, SDR, MHA…) in a new tab" style="--c:#0ea5e9"><span class="nib">🏛️</span><span>All LEA Portal</span><span class="nav-chev" title="Show / hide portals">▾</span></div><div class="nav-subs lea-subs"></div>`);
  const it = $('.lea-item', nav), subs = $('.lea-subs', nav), setOpen = on => { S.leaOpen = on; subs.classList.toggle('open', on); it.classList.toggle('open', on); if (on) { const f = $('.lea-find', subs); if (f) setTimeout(() => f.focus(), 50); } };
  LEA.side = () => {
    subs.innerHTML = `<input class="lea-find" placeholder="🔍 Find portal…">` + LEA.all().map(([id, ic, name, url]) => `<div class="nav-sub lea-sub" data-lea="${esc(id)}" title="${esc(url ? 'Open ' + url : 'No link yet – click to add one')}"><span class="lea-ic">${ic}</span><span>${esc(name)}</span>${url ? '<span class="lea-ext">↗</span>' : '<span class="lea-ext">✏️</span>'}</div>`).join('') + `<div class="nav-sub sop-upl lea-edit" data-leaedit="1"><span>✏️ Edit links / add portal</span></div>`;
    $$('[data-lea]', subs).forEach(n => n.onclick = () => LEA.open(n.dataset.lea));
    $('[data-leaedit]', subs).onclick = () => LEA.edit();
    const f = $('.lea-find', subs); f.onclick = e => e.stopPropagation();
    f.oninput = () => { const q = f.value.trim().toLowerCase(); $$('[data-lea]', subs).forEach(n => n.style.display = !q || n.textContent.toLowerCase().includes(q) ? '' : 'none'); };
  };
  LEA.side(); setOpen(false);
  it.addEventListener('click', e => { e.stopImmediatePropagation(); e.stopPropagation(); setOpen(!S.leaOpen); }, true);
})();
