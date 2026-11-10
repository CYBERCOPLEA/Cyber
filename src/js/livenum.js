/* livenum.js – every number box in the whole tool is live.
   Hover = quick preview of the records behind the number. Click = all of them in the side panel (search, sort, CSV).
   Works on the number boxes of every page and on the "Case at a glance" lines of the Dashboard. */
'use strict';
const LiveNum = {
  /* what a page shows: its main list of records */
  ctx(el) {
    const a = el && el.dataset.act;
    if (a) { if (a.startsWith('soc:')) return { page: 'social', plat: a.slice(4), all: 1 }; if (a.startsWith('tel:')) return { page: 'tele', tel: a.slice(4), all: 1 }; return { page: a, sub: el.dataset.sub || '', all: 1 }; }
    return { page: S.page, sub: (S.sub || {})[S.page] || '', tel: S.telKind || 'cdr', plat: S.socPlat || '' };
  },
  acc() { try { return Analysis.accountRows().filter(a => !isSynthetic(a.acc)); } catch (e) { return []; } },
  txns(c) { const d = S.data, ack = c.all ? '' : c.page === 'ncrp' ? S.ncrpAck : c.page === 'trail' ? S.trailAck : ''; const t = d.txns || []; if (!ack) return t; const k = N.ack(ack); const f = t.filter(x => N.ack(x.ack_no) === k); return f.length ? f : t; },
  social(plat) {
    const d = S.data, csv = (d.social || []).filter(r => plat === undefined || !plat ? true : Analysis.platOf(r) === plat);
    if (plat === 'whatsapp') return [...(d.whatsapp || []), ...csv]; if (plat === 'telegram') return [...(d.telegram || []), ...csv]; if (plat === 'google') return [...(d.google || []), ...csv];
    if (plat === 'facebook' || plat === 'instagram') return [...(d.meta || []).filter(r => r.platform === plat), ...csv];
    return csv;
  },
  base(c) {
    const d = S.data;
    switch (c.page) {
      case 'tele': try { return Tel.of(c.tel || 'cdr'); } catch (e) { return []; }
      case 'social': return this.social(c.plat);
      case 'caf': return typeof CAF !== 'undefined' ? CAF.list() : d.caf || [];
      case 'ncrp': case 'trail': return this.txns(c);
      case 'financial': return c.sub === 'suspects' ? this.acc() : d.txns || [];
      case 'analytics': try { return Analysis.crossLinks().filter(x => x.refs >= 2); } catch (e) { return []; }
      case 'others': return [...(d.notes || []), ...(d.tasks || [])];
      default: return [];
    }
  },
  pick(R, keys) { for (const k of keys) if (R.some(r => r[k] != null && r[k] !== '' && !(Array.isArray(r[k]) && !r[k].length))) return k; return null; },
  /* one row per distinct value of a field */
  group(R, keys, label) {
    const k = this.pick(R, keys); if (!k) return null;
    const M = new Map();
    for (const r of R) { let v = r[k]; const vs = Array.isArray(v) ? v : String(v ?? '').split(/\s*[,;]\s*/); for (let x of vs) { x = String(x ?? '').trim(); if (!x) continue; let g = M.get(x); if (!g) M.set(x, g = { value: x, records: 0, first: '', last: '', files: new Set(), _r: [] }); g.records++; const t = r.ts || r.date || r.when || ''; if (t && (!g.first || t < g.first)) g.first = t; if (t && t > g.last) g.last = t; if (r._src) g.files.add(r._src); if (g._r.length < 5000) g._r.push(r); } }
    return { grouped: label || k, rows: [...M.values()].map(g => { const o = { value: g.value, records: g.records, first: g.first, last: g.last, files: [...g.files].join(', ') }; Object.defineProperty(o, '_r', { value: g._r }); return o; }).sort((a, b) => b.records - a.records) };
  },
  kind(R, re) { const f = R.filter(r => re.test(String(r.kind || r.type || ''))); return f.length ? f : null; },
  /* label of the box → its records */
  resolve(label, c) {
    const L = String(label || '').toLowerCase(), d = S.data, B = () => this.base(c), plain = rows => ({ rows: rows || [] });
    const g = (keys, lb, R) => this.group(R || B(), keys, lb);
    if (/all cases/.test(L)) return plain(S.cases);
    if (/also in case/.test(L) && c.page === 'tele' && c.tel === 'tdr' && typeof TelUI !== 'undefined') { const T = TelUI.tdrStats(Tel.of('tdr')); return { grouped: 'Number', rows: T.L.filter(x => Tel.isMob(x.n) && Tel.also('mobile', x.n)).map(x => { const o = { value: x.n, records: x.cnt, spots: x.sites.join(' | '), also: Tel.also('mobile', x.n), first: x.first, last: x.last }; Object.defineProperty(o, '_r', { value: x.recs }); return o; }) }; }
    if (/other social/.test(L)) return plain((d.social || []).filter(r => !Analysis.platOf(r)));
    if (/cross|common|linked|also in case|section links/.test(L)) { let X = []; try { X = Analysis.crossLinks().filter(x => x.refs >= 2); } catch (e) { } if (c.page === 'social' && c.plat) { const P = (Analysis.SOC_PLAT.find(p => p[0] === c.plat) || [])[3]; if (P) { const f = X.filter(x => P.test(x.refList)); if (f.length) X = f; } } return plain(X.map(({ items, ...x }) => x)); }
    if (/extracted identifier/.test(L)) return plain(d.idents);
    if (/complaint|ack no/.test(L) && c.page !== 'trail') { let C = []; try { C = Trail.complaints(); } catch (e) { } return plain(C.length ? C : d.ncrp); }
    if (/high.?risk|mule/.test(L)) return plain(this.acc().filter(a => a.score >= 60));
    if (/hold|lien|freez/.test(L)) { const t = this.txns(c).filter(x => +x.hold > 0 || x.holdOnly || /hold|lien|freez/i.test(x.action || '')); return plain(t.length ? t : this.acc().filter(a => a.hold > 0)); }
    if (/cash|atm/.test(L)) return plain(this.txns(c).filter(x => /atm|cash|withdraw/i.test([x.mode, x.action, x.atm_loc].join(' '))));
    if (/bulk|pass.?through|nodal|escrow/.test(L)) return plain(this.acc().filter(a => (a.flags || '').toLowerCase && new RegExp(/bulk/.test(L) ? 'bulk|split' : /pass/.test(L) ? 'pass|rapid' : 'nodal|escrow|pg', 'i').test(String(a.flags || ''))));
    if (/bank/.test(L) && !/^banks$/.test(L.trim()) && c.page !== 'tele') return g(['bank'], 'Bank', this.acc().filter(a => a.layer > 0 && a.bank).map(a => ({ ...a, bank: a.bank.split(' / ')[0] })));
    if (/beneficiary account|accounts? in trail|^accounts$/.test(L.trim()) && c.page !== 'social') return plain(this.acc());
    if (/^layers?$/.test(L.trim())) return g(['layer'], 'Layer', this.txns(c));
    if (/kyc/.test(L)) return plain(d.kyc);
    if (/statement/.test(L)) return plain((d.txns || []).filter(t => t._type === 'stmt'));
    if (/file|import/.test(L)) return plain(d.imports);
    if (/note/.test(L)) return plain(d.notes); if (/task/.test(L)) return plain((d.tasks || []).filter(t => !/open/.test(L) || !t.done));
    if (/transaction|txn|defrauded|disputed|money|trail/.test(L) && !/data/.test(L)) return plain(c.page === 'tele' ? B() : this.txns(c));
    // CAF
    if (c.page === 'caf' || /caf/.test(L)) { const R = typeof CAF !== 'undefined' ? CAF.list() : d.caf || [];
      if (/agent/.test(L)) return g(['pos_agent'], 'POS agent', R); if (/pos/.test(L)) return g(['pos_name', 'pos_code'], 'POS', R);
      if (/mobile/.test(L)) return g(['mobile'], 'Mobile', R); if (/photo/.test(L)) return plain(R.filter(x => x.photo || x.photos)); if (/scanned/.test(L)) return plain(R.filter(x => !x.text)); return plain(R); }
    // fields: telecom, social, anything with records
    const R = B();
    if (c.page === 'tele' && c.tel === 'tdr' && /present|spot/.test(L) && typeof TelUI !== 'undefined') {
      const T = TelUI.tdrStats(Tel.of('tdr')), row = (v, x) => { const o = { value: v, records: x.cnt, spots: x.sites.join(' | '), first: x.first, last: x.last }; Object.defineProperty(o, '_r', { value: x.recs }); return o; };
      if (/crime spot/.test(L)) return plain(T.sp.list.map(s => ({ spot: s.label || s.key, day: s.day, place: s.place, operators: (s.ops || []).join(', '), files: s.files.map(f => f.f).join(', '), from: s.from, to: s.to })));
      if (/handset/.test(L)) return { grouped: 'IMEI', rows: T.I.filter(x => x.sN >= 2).map(x => row(x.imei, x)) };
      if (/2\+|at 2/.test(L)) return { grouped: 'Number', rows: T.L.filter(x => x.sN >= 2).map(x => row(x.n, x)) };
      return { grouped: 'Number', rows: T.L.map(x => row(x.n, x)) };
    }
    if (/imei|handset|device/.test(L)) { if (c.page === 'social') { const k = this.kind(R, /device/i); if (k) return plain(k); } return g(['imei', 'device', 'device_id', 'android_id', 'model'], 'IMEI / device', R) || plain(R); }
    if (/tower|cell/.test(L)) return g(['cell', 'addr'], 'Tower / cell', R) || plain(R);
    if (/crime spot|spot/.test(L)) return g(['_src'], 'Spot (file)', R) || plain(R);
    if (/destination/.test(L)) return g(['dip'], 'Destination IP', R) || plain(R);
    if (/registration ip/.test(L)) return g(['reg_ip', 'reg_ip_only'], 'Registration IP', R) || plain(R);
    if (/\bip\b|ips\b|ip address|ip entr|ip event/.test(L)) { if (c.page === 'social') { const k = this.kind(R, /ip/i); if (k) return plain(k); } return g(['xip', 'ip', 'last_ip', 'pip'], 'IP address', R) || plain(R); }
    if (/e-?mail/.test(L)) return g(['email', 'emails', 'email_list'], 'E-mail', R) || plain(R);
    if (/target|msisdn/.test(L)) return g(['target'], 'Number', R) || plain(R);
    if (/contact|present|number|mobile|phone|person|sender|business|banks$|payment|loan/.test(L)) {
      if (c.page === 'tele') { let T = R; if (/business|banks$|payment|loan/.test(L)) T = R.filter(r => /[A-Z]/i.test(r.other || '')); if (/person/.test(L)) T = R.filter(r => /^\+?\d{10,}$/.test(String(r.other || '').replace(/\D/g, '')) && !/[A-Z]/i.test(r.other || '')); if (/banks$/.test(L) && typeof Tel !== 'undefined' && Tel.hdrInfo) T = T.filter(r => { const h = Tel.hdrInfo(r.other); return h && /Bank/.test(h.cat); }); if (/payment|loan/.test(L) && typeof Tel !== 'undefined' && Tel.hdrInfo) T = T.filter(r => { const h = Tel.hdrInfo(r.other); return h && /Payment|Loan/.test(h.cat); }); return g(['other'], /sender|business|bank|payment|loan/.test(L) ? 'Sender' : 'Number', T) || plain(T); }
      if (c.page === 'social') { if (/address-book|contact/.test(L)) { const k = this.kind(R, /contact/i); if (k) return plain(k); } return g(['mobile', 'phones', 'phone_list', 'target'], 'Mobile', R) || plain(R); }
      return g(['mobile', 'suspect_mobile', 'victim_mobile', 'target', 'other'], 'Mobile', R) || plain(R);
    }
    if (/message|call/.test(L) && c.page === 'social') return plain(this.kind(R, /message|call/i) || R);
    if (/change/.test(L)) return plain(this.kind(R, /change/i) || R);
    if (/not found/.test(L)) return plain(this.kind(R, /not found/i) || []);
    if (/repl/.test(L)) return plain(this.kind(R, /reply/i) || []);
    if (/account|user|profile/.test(L) && c.page === 'social') return plain(this.kind(R, /account|user/i) || R);
    if (/profile/.test(L)) return g(['profile'], 'Profile', R) || plain(R);
    if (/day|date|period/.test(L)) return g(['ts', 'date'].filter(k => R.some(r => r[k])).length ? ['_day'] : [], 'Day', R.map(r => ({ ...r, _day: String(r.ts || r.date || '').slice(0, 10) }))) || plain(R);
    return plain(R);
  },
  MAIN: ['value', 'ack', 'ack_no', 'acc', 'name', 'victim_name', 'username', 'acct', 'target', 'mobile', 'other', 'ip', 'xip', 'email', 'to_acc', 'to_name', 'from_acc', 'profile', 'kind', 'imei', 'cell', 'bank', 'title', 'file', 'type'],
  SIDE: ['amount', 'inAmt', 'hold', 'score', 'refs', 'count', 'ts', 'date', 'when', 'ist', 'status', 'kind'],
  label(el) { return el.dataset.lnl || (($('.label', el) || $('span', el) || el).textContent || '').trim(); },
  get(el) { const lb = this.label(el), c = this.ctx(el); let res = { rows: [] }; try { res = this.resolve(lb, c) || res; } catch (e) { console.error(e); } return { lb, c, res }; },
  /* hover: top five */
  tip(el) {
    let t = $('#dxTip'); if (!t) { document.body.insertAdjacentHTML('beforeend', '<div id="dxTip" class="dx-tip"></div>'); t = $('#dxTip'); }
    if (!el) { t.classList.remove('on'); return; }
    const { lb, res } = this.get(el), R = res.rows || [];
    const line = r => { if (res.grouped) return [r.value, fmtNum(r.records) + ' rec'];
      const ok = k => r[k] != null && r[k] !== '' && typeof r[k] !== 'object', ks = this.MAIN.filter(ok).slice(0, 2), sd = this.SIDE.find(ok);
      const fv = k => Records.ACC.has(k) ? accLabel(String(r[k])) : Records.MONEY.has(k) ? fmtINR(r[k]) : r[k];
      return [ks.map(fv).join(' · ') || r.kind || '', sd ? fv(sd) : '']; };
    t.innerHTML = `<div class="dx-th"><b>${esc(lb)}${res.grouped ? ` <small class="muted">by ${esc(res.grouped)}</small>` : ''}</b><span>${fmtNum(R.length)}</span></div>${R.length ? `<div class="dx-tl">${R.slice(0, 5).map(r => { const [a, b] = line(r); return `<div><span>${esc(String(a || '—').slice(0, 60))}</span><b>${esc(String(b || '').slice(0, 24))}</b></div>`; }).join('')}</div>` : '<div class="muted small">Nothing yet.</div>'}<div class="dx-tf">${R.length > 5 ? `+ ${fmtNum(R.length - 5)} more · ` : ''}${R.length ? 'Click to open all' : ''}</div>`;
    const b = el.getBoundingClientRect(), w = 320; t.style.width = w + 'px';
    t.style.left = Math.min(innerWidth - w - 10, Math.max(10, b.left + b.width / 2 - w / 2)) + 'px';
    t.classList.add('on'); const h = t.offsetHeight; t.style.top = (b.bottom + 8 + h > innerHeight ? Math.max(8, b.top - h - 8) : b.bottom + 8) + 'px';
  },
  /* click: everything in the side panel */
  open(el) {
    this.tip(null); const { lb, res } = this.get(el), R = res.rows || [];
    if (!R.length) return UI.toast('No records behind "' + lb + '" yet');
    if (!res.grouped) return Records.show(lb, R);
    const body = UI.drawer(`${lb} (${fmtNum(R.length)})`, `<div class="dx-head"><div><b>${fmtNum(R.length)}</b><span>${esc(res.grouped)}</span></div><div><b>${fmtNum(sum(R, r => r.records))}</b><span>records</span></div><span class="small muted">Click a row to see its records.</span></div><div id="lnT"></div>`);
    $('#drawer').classList.add('dx-wide');
    const cols = [{ key: 'value', label: res.grouped, render: r => `<b class="mono">${esc(r.value)}</b>${typeof Tel !== 'undefined' && Tel.hdrInfo && /sender/i.test(res.grouped) ? (h => h ? ` <span class="small muted">${esc(h.ent || '')}</span>` : '')(Tel.hdrInfo(r.value)) : ''}` }, { key: 'records', label: 'Records', num: true }];
    if (R.some(r => r.first)) cols.push({ key: 'first', label: 'First seen' }, { key: 'last', label: 'Last seen' });
    if (R.some(r => r.spots)) cols.push({ key: 'spots', label: 'Spots' });
    if (R.some(r => r.also)) cols.push({ key: 'also', label: 'Also in' });
    if (R.some(r => r.files)) cols.push({ key: 'files', label: 'File(s)' });
    Table($('#lnT', body), { rows: R, columns: cols, sortKey: 'records', sortDir: -1, pageSize: 50, exportName: lb.toLowerCase().replace(/\W+/g, '_'), onRow: r => Records.show(`${res.grouped}: ${r.value}`, r._r) });
  },
  bind(el) {
    if (el._ln) return; el._ln = 1; el.classList.add('dx-live', 'ln');
    el.addEventListener('mouseenter', () => this.tip(el)); el.addEventListener('mouseleave', () => this.tip(null));
    if (el.classList.contains('d2-lk')) { el.addEventListener('click', e => { if (e.target.closest('.ln-go')) return; e.stopImmediatePropagation(); e.preventDefault(); this.open(el); }, true); const go2 = document.createElement('span'); go2.className = 'ln-go'; go2.title = 'Open the page'; go2.textContent = '›'; el.appendChild(go2); go2.addEventListener('click', e => { e.stopPropagation(); this.tip(null); const a = el.dataset.act, s = el.dataset.sub || undefined; if (a.startsWith('soc:')) { S.socPlat = a.slice(4); return go('social'); } if (a.startsWith('tel:')) { S.telKind = a.slice(4); return go('tele'); } if (a === 'cases') return CaseStat.list('all'); go(a, s); }, true); return; }
    if (!el.onclick) { el.setAttribute('tabindex', '0'); el.addEventListener('click', e => { if (e.target.closest('a,button,input,select')) return; this.open(el); }); el.addEventListener('keydown', e => { if (e.key === 'Enter') this.open(el); }); }
  },
  scan() { const m = $('#main'); if (!m) return; $$('.kpi:not(.dx-live), .d2-lk', m).forEach(el => this.bind(el)); }
};
(() => {
  const m = $('#main'); if (!m) return;
  let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; LiveNum.scan(); }); }).observe(m, { childList: true, subtree: true });
  const or = render; render = function () { LiveNum.tip(null); const r = or.apply(this, arguments); LiveNum.scan(); return r; };
})();
