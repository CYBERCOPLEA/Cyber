/* layout.js - menu in investigation order, consistent page headers and tab order for every section.
   Page ids are unchanged, so saved cases and links keep working. */
'use strict';

const ICON = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  complaint: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M12 12v4"/><path d="M12 18.5v.5"/>',
  trail: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 11l9-4"/><path d="M7.5 13l9 4"/>',
  bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18"/>',
  social: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16 14.2c2.9.3 5 2.6 5 5.8"/>',
  analytics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  theme: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
};
const ico = (k, s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`;

/* each menu button has its own colour */
const NAVC = { dashboard: '#3b82f6', ncrp: '#f97316', trail: '#8b5cf6', financial: '#10b981', social: '#ec4899', analytics: '#06b6d4', others: '#eab308', settings: '#94a3b8' };

/* menu: in the order an investigation is done */
const MENU = [
  ['Overview', [['dashboard', 'home', 'Dashboard', 'Case summary and next steps']]],
  ['Investigation', [
    ['ncrp', 'complaint', 'Complaints (NCRP)', 'Start here: pick a complaint by Acknowledgement No'],
    ['trail', 'trail', 'Money Trail', 'Victim → Layer 1 → Layer 2 … cards'],
    ['financial', 'bank', 'Bank & Financial', 'Statements, KYC, suspects, charts'],
    ['social', 'social', 'Social Media', 'Platform replies, IP logs, links']]],
  ['Analysis', [['analytics', 'analytics', 'Analytics', 'Mule flags, cross-links, timeline, hotspots']]],
  ['Action', [['others', 'file', 'Case File & Notices', 'Notes, notices, reports, tools']]]
];

/* every page: group, title, one-line purpose, and tabs in working order */
const PAGE_META = {
  ncrp: { group: 'Investigation', title: 'Complaints (NCRP)', desc: 'Pick a complaint and see where the money went, layer by layer, with flagged mule and nodal accounts.',
    order: ['case', 'data', 'link', 'common', 'summary'],
    names: { case: 'Complaint Analysis', link: 'Complaint ↔ Trail', common: 'Common Suspects', summary: 'Summary & Charts' } },
  financial: { group: 'Investigation', title: 'Bank & Financial', desc: 'Import bank trail, statements and KYC. Find suspect accounts and common details, and prepare bank notices.',
    order: ['data', 'trail', 'graph', 'suspects', 'common', 'kyc', 'banks'],
    names: { data: 'Import & Data', trail: 'Layer-wise Trail', graph: 'Flow Chart / Mind Map', suspects: 'Suspect Accounts', common: 'Common Details', kyc: 'KYC / Beneficiary', banks: 'Bank-wise (for notices)' } },
  social: { group: 'Investigation', title: 'Social Media', desc: 'Replies from WhatsApp, Facebook, Instagram, Telegram, X, Google etc. Common numbers, emails, devices and IPs.',
    order: ['data', 'common', 'ip', 'graph'], names: { common: 'Common Details' } },
  analytics: { group: 'Analysis', title: 'Analytics', desc: 'Mule behaviour across all complaints, and the same identifier appearing in bank, social media and NCRP data.',
    order: ['flags', 'velocity', 'cross', 'entity', 'time', 'geo', 'round'],
    names: { flags: 'Bulk Split & Rapid', velocity: 'Fast Movement', cross: 'Cross-Link', entity: 'Entity Graph', time: 'Timeline', geo: 'Hotspots', round: 'Patterns' } },
  others: { group: 'Action', title: 'Case File & Notices', desc: 'Case details, notes and tasks, notice drafts, reports and export, and helper tools.',
    order: ['cases', 'notes', 'notices', 'reports', 'extract', 'tools'],
    names: { cases: 'Case Details', notes: 'Notes & Tasks', notices: 'Notice Drafts', reports: 'Reports & Export', extract: 'Identifier Extractor', tools: 'Validators & Lookup' } }
};

/* replace the page header + tabs helper used by every section */
tabs = function (main, page, list, title, actions = '') {
  const M = PAGE_META[page];
  if (M) {
    const by = new Map(list.map(t => [t[0], t]));
    const ordered = [...M.order.filter(k => by.has(k)).map(k => by.get(k)), ...list.filter(t => !M.order.includes(t[0]))];
    // keep counts like "Complaints (12)" from the original label
    list = ordered.map(([k, l]) => { const cnt = (String(l).match(/\((\d[\d,]*)\)\s*$/) || [])[1]; const name = (M.names || {})[k] || l.replace(/\s*\(\d[\d,]*\)\s*$/, ''); return [k, name, cnt]; });
  } else list = list.map(([k, l]) => [k, l]);
  const cur = S.sub[page] && list.some(t => t[0] === S.sub[page]) ? S.sub[page] : list[0][0];
  const tt = M ? M.title : String(title).replace(/^\d+\s*·\s*/, '');
  main.innerHTML = `<div class="page-head"><div class="ph-text"><div class="crumb">${esc(M ? M.group : '')}${M ? ' <span>›</span> ' : ''}${esc(tt)}</div><h2>${esc(tt)}</h2>${M ? `<div class="ph-desc">${esc(M.desc)}</div>` : ''}</div><div class="ph-actions">${actions}</div></div>
    <div class="tabs">${list.map(t => `<div class="tab ${t[0] === cur ? 'active' : ''}" data-t="${t[0]}">${esc(t[1])}${t[2] ? `<span class="tcount">${t[2]}</span>` : ''}</div>`).join('')}</div><div id="tabBody"></div>`;
  $$('.tab', main).forEach(t => t.onclick = () => { S.sub[page] = t.dataset.t; render(); });
  return { cur, body: $('#tabBody', main) };
};

/* build the sidebar menu */
(() => {
  const nav = $('#sidebar'), info = $('#sideInfo');
  nav.innerHTML = MENU.map(([g, items]) => `<div class="nav-group">${esc(g)}</div>` + items.map(([id, ic, label, tip]) => `<div class="nav-item" data-page="${id}" title="${esc(tip)}" style="--c:${NAVC[id] || '#64748b'}"><span class="nib">${ico(ic)}</span><span>${esc(label)}</span></div>`).join('')).join('') +
    `<div class="nav-bottom"><div class="nav-item" data-page="settings" title="Login, password recovery, preferences" style="--c:${NAVC.settings}"><span class="nib">${ico('settings')}</span><span>Settings</span></div></div>`;
  nav.appendChild(info);
  // top bar icons
  const lockB = $('#btnLock'), thB = $('#btnTheme');
  lockB.innerHTML = ico('lock', 16) + 'Lock'; thB.innerHTML = ico('theme', 16); thB.title = 'Light / dark theme';
  const gs = $('#gsearch'); const wrap = document.createElement('div'); wrap.className = 'gsearch'; gs.parentNode.insertBefore(wrap, gs); wrap.innerHTML = ico('search', 16); wrap.appendChild(gs);
  gs.placeholder = 'Search account, mobile, email, UTR, IP…  (Enter)';
  // status bar
  const sb = document.createElement('footer'); sb.id = 'statusbar'; $('#app').appendChild(sb);
})();

/* status bar + side info refresh after every page render */
(() => {
  const orig = render;
  render = function () {
    orig();
    const d = S.data; if (!d) return;
    const c = typeof activeCase === 'function' ? activeCase() : {};
    const n = Trail.complaints().length;
    $('#sideInfo').innerHTML = `<div class="si-case">${esc(c.name || '')}</div><div class="si-row"><span>Complaints</span><b>${fmtNum(n)}</b></div><div class="si-row"><span>Transactions</span><b>${fmtNum(d.txns.length)}</b></div><div class="si-row"><span>KYC records</span><b>${fmtNum(d.kyc.length)}</b></div><div class="si-row"><span>Social records</span><b>${fmtNum(d.social.length)}</b></div>`;
    $('#statusbar').innerHTML = `<span class="dot"></span><span>Offline · data stays on this computer</span><span class="sep">|</span><span>Case: <b>${esc(c.name || '')}</b>${c.status ? ' · ' + esc(c.status) : ''}</span><span class="sep">|</span><span>${fmtNum(n)} complaints · ${fmtNum(d.txns.length)} txns · ${fmtNum(d.kyc.length)} KYC · ${fmtNum(d.social.length)} social</span><span class="spacer"></span><span>Signed in as <b>${esc(S.settings.user)}</b></span><span class="sep">|</span><span>Sudarshanastra v2.0</span>`;
  };
})();

/* every card gets its own colour so boxes are easy to tell apart */
(() => {
  const CC = ['#3b82f6', '#10b981', '#8b5cf6', '#f97316', '#ec4899', '#06b6d4', '#eab308', '#14b8a6', '#a855f7', '#84cc16', '#6366f1', '#f43f5e'];
  let busy = false;
  const paint = () => { busy = false; $$('#main .card').forEach((c, i) => { if (!c.classList.contains('cc')) c.classList.add('cc'); c.style.setProperty('--cc', CC[i % CC.length]); }); };
  new MutationObserver(() => { if (!busy) { busy = true; requestAnimationFrame(paint); } }).observe($('#main'), { childList: true, subtree: true });
})();
