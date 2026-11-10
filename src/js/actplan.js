/* actplan.js – Overview of CDR / IPDR / TDR: a suggestion under every finding box and an "Action plan" of what to do
   next (most urgent first) – each with records, Analyse, Watchlist and a ready notice draft (Sec 94 BNSS). */
'use strict';
const ACT = {
  CO: { Jio: 'Reliance Jio Infocomm Ltd', Airtel: 'Bharti Airtel Ltd', Vi: 'Vodafone Idea Ltd (Vi)', BSNL: 'Bharat Sanchar Nigam Ltd (BSNL)', MTNL: 'MTNL' },
  SG: {
    'Network – who is connected': 'Numbers in touch with 2+ targets are likely handlers – get their CAF + CDR and check the names in KYC / bank replies.',
    'Links to this case': 'A contact already in bank / KYC / NCRP data ties the phone to the money trail – note it in the case diary and verify the person.',
    'Devices': 'One handset with many SIMs = one person. Ask the operator for IMEI-based CDR to get every SIM used in it.',
    'Activity': 'Match off periods and night calls with the crime time. A gap with a handset change points to a second phone.',
    'Location': 'Verify the night (home) tower address on the ground – it is the best place for notice service / raid.',
    'Top contacts': 'Ask CAF + CDR of the top contacts; frequent night contacts are usually family or close associates.',
    'Contacts linked to this case': 'These contacts connect this number to the money trail – verify and add to the case diary.',
    'Handsets & SIM cards': 'Ask IMEI-based CDR for every handset – it lists the other SIMs the suspect used.',
    'Movement': 'The latest state / tower shows where the suspect is now – use it to plan the team.',
    'Apps used': 'Send notices to the apps used, with the own public IP + port + time list (Platform requisition tab).',
    'Hiding / remote access': 'VPN / remote-access use – ask the provider for logs; check the seized device for AnyDesk / TeamViewer / VPN apps.',
    'For platform notice': 'Use the Platform requisition tab: it gives IST + UTC time, IP and port ready for the notice.',
    'Present at crime spots': 'A number present at 2+ crime spots is a strong lead – get its CAF + CDR at once.'
  },
  _n: [],
  notice(i) { const x = this._n[i]; if (!x) return; go('others', 'notices');
    setTimeout(() => { const t = $('#ntT'); if (!t) return; t.value = x.tpl; t.dispatchEvent(new Event('change')); const c = $('#ntC'); if (c && x.op) c.value = this.CO[x.op] || x.op; const g = $('#ntGo'); if (g) g.click();
      const o = $('#ntOut'); if (o && x.list && x.list.length) { o.value += `\n\nAnnexure – details required for:\n${x.list.map((s, j) => `${j + 1}. ${s}`).join('\n')}${x.why ? `\nReason: ${x.why}` : ''}`; o.dispatchEvent(new Event('input')); }
      const n = $('#ntName'); if (n && !n.value) n.value = (x.name || 'Telecom notice'); UI.toast('Notice draft ready – check, then Save'); }, 350); },
  watch(n) { const W = S.data.cdrWatch = S.data.cdrWatch || []; if (W.includes(n)) return UI.toast('Already on the watchlist'); W.push(n); saveCase(); Analysis.invalidate(); UI.toast(n + ' added to the watchlist'); },
  nt(tpl, op, list, why, name) { return this._n.push({ tpl, op, list, why, name }) - 1; },
  /* the card */
  card(el, items, title) {
    items = items.filter(Boolean).sort((a, b) => 'hml'.indexOf(a.p) - 'hml'.indexOf(b.p)).slice(0, 12); if (!items.length) return;
    const N = new Set(TSC.nums(S.telKind).map(z => z[0])), P = { h: '🔴 Act now', m: '🟠 Next step', l: '🔵 Check' };
    const html = `<div class="card ap-card"><h3>🚨 ${esc(title || 'Action plan – what to do next')}</h3><div class="sub">Worked out from these files, most urgent first: what was found and the suggested next step. Hover a box for details, click it for the records, or use its buttons.</div>
      <div class="ap-grid">${items.map(x => `<div class="ap-it ap-${x.p}"${x.recs && x.recs.length ? ` data-ri="${TSC._r.push({ t: x.t || 'Action plan', recs: x.recs, gt: 'Action plan' }) - 1}" tabindex="0"` : ''}>
        <div class="ap-hd"><span class="ap-p">${P[x.p]}</span><span class="ap-i">${x.i || ''}</span></div><div class="ap-f">${x.h}</div><div class="ap-a">👉 ${x.a}</div>
        <div class="ap-b">${x.recs && x.recs.length ? `<span class="small muted">🔍 ${fmtNum(x.recs.length)} records</span>` : ''}${x.n && N.has(x.n) && x.n !== Tel._sn ? `<a href="#" class="btn sm" data-tsc="${esc(x.n)}">🎯 Analyse</a>` : ''}${x.w ? `<button class="btn sm" data-apw="${esc(x.w)}">👁 Watchlist</button>` : ''}${x.nt != null ? `<button class="btn sm primary" data-apn="${x.nt}">📝 Draft notice</button>` : ''}${x.go ? `<a href="#" class="btn sm" data-tgo="${x.go}">open tab →</a>` : ''}</div></div>`).join('')}</div></div>`;
    const at = $('.tf-grid', el) || $('.tf-sus', el) || $('.kpis', el);
    if (at) at.insertAdjacentHTML('afterend', html); else el.insertAdjacentHTML('beforeend', html);
    const card = at ? at.nextElementSibling : el.lastElementChild;
    card.addEventListener('click', e => { const w = e.target.closest('[data-apw]'), n = e.target.closest('[data-apn]'); if (!w && !n) return; e.preventDefault(); e.stopPropagation(); if (w) this.watch(w.dataset.apw); else this.notice(+n.dataset.apn); }, true);
    if (!el._tw) TSC.wire(card);
  },
  op: n => TSC.op(n),
  name: n => `${n}${TSC.op(n) ? ' (' + TSC.op(n) + ')' : ''}`,
  /* ---- CDR: all files ---- */
  cdrAll(d) {
    const I = [], { byOther } = TelUI.cdrStats(d), T = new Set(d.map(r => r.target).filter(Boolean)), W = TSC.watch(), R1 = v => v.flatMap(p => p.recs);
    const com = [...byOther].filter(([o, v]) => v.length >= 2 && Tel.isMob(o) && !T.has(o)).sort((a, b) => b[1].length - a[1].length || sum(b[1], p => p.n) - sum(a[1], p => p.n));
    com.slice(0, 3).forEach(([o, v]) => I.push({ p: v.length >= 3 || Tel.also('mobile', o) ? 'h' : 'm', i: '👥', t: o + ' · common contact', n: o, w: o, recs: R1(v), h: `<b class="mono">${esc(o)}</b> ${TSC.opb(o)} talks to <b>${v.length} targets</b> (${fmtNum(sum(v, p => p.n))} records)${Tel.also('mobile', o) ? ` <span class="tf-chip bad">in ${esc(Tel.also('mobile', o))}</span>` : ''}`, a: `Likely handler. Get CAF + CDR from ${esc(this.op(o) || 'the operator')} and check the name in KYC / bank replies.`, nt: this.nt('tel_cdr', this.op(o), [o + ' – CAF, CDR with cell ID and IMEI'], 'in touch with ' + v.length + ' suspect numbers', 'CDR + CAF – ' + o) }));
    const lk = [...byOther.keys()].filter(o => Tel.isMob(o) && !T.has(o) && Tel.also('mobile', o) && !com.slice(0, 3).some(c => c[0] === o)).sort((a, b) => sum(byOther.get(b), p => p.n) - sum(byOther.get(a), p => p.n));
    lk.slice(0, 2).forEach(o => I.push({ p: 'h', i: '🔗', t: o + ' · linked to case', n: o, w: o, recs: R1(byOther.get(o)), h: `<b class="mono">${esc(o)}</b> ${TSC.opb(o)} is also in <b>${esc(Tel.also('mobile', o))}</b>`, a: 'Ties the phones to the money trail – verify this person, get CAF, and record it in the case diary.', nt: this.nt('tel_cdr', this.op(o), [o + ' – CAF and CDR'], 'number found in ' + Tel.also('mobile', o), 'CAF – ' + o) }));
    const sh = [...groupBy(d.filter(r => r.imei), r => r.imei)].map(([m, v]) => [m, v, uniq(v.map(r => r.target))]).filter(x => x[2].length > 1).sort((a, b) => b[2].length - a[2].length);
    sh.slice(0, 2).forEach(([m, v, t]) => I.push({ p: 'h', i: '📱', t: 'IMEI ' + m, recs: v, w: m, h: `Handset <b class="mono">${esc(m)}</b> used with <b>${t.length}</b> numbers: <span class="mono">${t.slice(0, 4).map(esc).join(', ')}</span>`, a: 'Same person, many SIMs. Ask IMEI-based CDR to find every SIM used in this handset.', nt: this.nt('tel_imei', this.op(t[0]), [m + ' – all numbers used in this IMEI with CDR'], 'handset shared by suspect numbers', 'IMEI CDR – ' + m) }));
    for (const [t, v] of CDRX.byT(d)) { if (!t) continue; const s = CDRX.sorted(v), L = s[s.length - 1], c0 = CDRX.circle(CDRX.home(v).home ? CDRX.home(v).home.recs[0] : s[0]), cL = CDRX.circle(L);
      if (W.has(t)) I.push({ p: 'h', i: '👁', t: t + ' · watchlist', n: t, recs: v.slice(-50), h: `Watchlist number <b class="mono">${esc(t)}</b> ${TSC.opb(t)} is a target here`, a: 'Open its profile and act on the latest location / contacts.' });
      if (c0 && cL && c0 !== cL) I.push({ p: 'm', i: '🌍', t: t + ' · moved', n: t, recs: s.slice(-30), h: `<b class="mono">${esc(t)}</b> usually in <b>${esc(c0)}</b>, last seen in <b>${esc(cL)}</b> (${esc(Tel.dd(L.ts))})`, a: 'Suspect has moved – coordinate with the local police there / plan the team accordingly.', go: 'roam' }); }
    const G = CDRX.gaps(d, 48).sort((a, b) => b.h - a.h); if (G.length) { const x = G[0]; I.push({ p: x.devCh || x.simCh ? 'h' : 'm', i: '⏸', t: x.target + ' · off', n: x.target, recs: x.recs, h: `<b class="mono">${esc(x.target)}</b> off for <b>${CDRX.span(x.h)}</b> from ${esc(Tel.dd(x.from))}${x.devCh ? ' – <b>handset changed</b>' : ''}${x.simCh ? ' – <b>SIM changed</b>' : ''}`, a: 'Check if the gap covers the crime date. A second phone may have been used – ask IMEI-based CDR.', go: 'off' }); }
    const hm = [...CDRX.byT(d)].filter(([t]) => t).map(([t, v]) => [t, CDRX.home(v).home]).filter(x => x[1]).sort((a, b) => b[1].n - a[1].n)[0];
    if (hm) I.push({ p: 'm', i: '🏠', t: hm[0] + ' · home tower', n: hm[0], recs: hm[1].recs, h: `Night location of <b class="mono">${esc(hm[0])}</b>: <b>${esc(hm[1].addr || hm[1].t)}</b>${CDRX.map(hm[1].lat, hm[1].lon)}`, a: 'Verify this address on the ground – best place to serve notice / plan a raid.', go: 'loc' });
    const nc = [...byOther].filter(([o]) => Tel.isMob(o) && !T.has(o)).map(([o, v]) => [o, sum(v, p => p.night), v]).sort((a, b) => b[1] - a[1])[0];
    if (nc && nc[1] >= 10) I.push({ p: 'l', i: '🌙', t: nc[0] + ' · night contact', n: nc[0], w: nc[0], recs: R1(nc[2]).filter(Tel.night), h: `<b class="mono">${esc(nc[0])}</b> ${TSC.opb(nc[0])} – <b>${nc[1]}</b> late-night calls`, a: 'Night contact is usually family or a close associate – get CAF; useful for tracing the suspect.' });
    const bk = uniq(d.filter(r => r.other && /[A-Z]/.test(r.other)).map(r => Tel.hdrInfo(r.other)).filter(h => h && /Bank|Payment|Wallet|Loan|Trading|Crypto/i.test(h.cat)).map(h => h.ent));
    if (bk.length) I.push({ p: 'm', i: '🏦', t: 'Bank / payment SMS', recs: d.filter(r => r.other && /[A-Z]/.test(r.other) && bk.includes((Tel.hdrInfo(r.other) || {}).ent)), h: `SMS from <b>${bk.length}</b> banks / payment apps: ${bk.slice(0, 6).map(esc).join(', ')}`, a: 'The targets hold accounts / wallets here – send Sec 94 BNSS notices to these banks for accounts linked to the target numbers.', go: 'com' });
    return I;
  },
  /* ---- one number ---- */
  prof(d, k) {
    const n = Tel._sn, v = CDRX.sorted(d), I = [], L = v[v.length - 1]; if (!L) return I; const op = this.op(n);
    I.push({ p: 'h', i: '📍', t: n + ' · last seen', recs: v.slice(-30), h: `Last seen <b>${esc(CDRX.loc(L) || '—')}</b>${CDRX.map(L.lat, L.lon)} on <b>${esc(Tel.dd(L.ts))}</b>${L.imei ? ` · IMEI <span class="mono">${esc(L.imei)}</span>` : ''}`, a: 'Latest known location – verify / plan the team. If needed, ask the operator for the latest location and current CDR.', nt: this.nt(k === 'ipdr' ? 'tel_ipdr' : 'tel_cdr', op, [n + ' – CAF, latest CDR / IPDR with cell ID'], 'suspect number in FIR', 'CDR + CAF – ' + n) });
    const h = CDRX.home(v); if (h.home) I.push({ p: 'm', i: '🏠', t: n + ' · home', recs: h.home.recs, h: `Night (home) tower: <b>${esc(h.home.addr || h.home.t)}</b>${CDRX.map(h.home.lat, h.home.lon)} – ${fmtNum(h.home.n)} records, ${h.home.days} days`, a: 'Verify the address on the ground; serve notice / plan raid here.', go: 'loc' });
    const im = uniq(v.map(r => r.imei).filter(Boolean)); if (im.length > 1) I.push({ p: 'h', i: '📱', t: n + ' · handsets', recs: v.filter(r => r.imei), h: `Used in <b>${im.length} handsets</b>: <span class="mono">${im.slice(0, 3).map(esc).join(', ')}</span>`, a: 'Ask IMEI-based CDR of each handset – it shows the other SIMs the suspect used.', nt: this.nt('tel_imei', op, im.map(m => m + ' – all numbers used in this IMEI'), 'handsets used by suspect number ' + n, 'IMEI CDR – ' + n), go: 'dev' });
    const C = [...groupBy(v.filter(r => Tel.isMob(r.other)), r => r.other)].sort((a, b) => b[1].length - a[1].length);
    const lk = C.filter(([o]) => Tel.also('mobile', o)); lk.slice(0, 2).forEach(([o, w]) => I.push({ p: 'h', i: '🔗', t: n + ' ↔ ' + o, n: o, w: o, recs: w, h: `Contact <b class="mono">${esc(o)}</b> ${TSC.opb(o)} is in <b>${esc(Tel.also('mobile', o))}</b> – ${w.length} records`, a: 'Links this number to the money trail – verify and record.' }));
    if (C.length) I.push({ p: 'm', i: '👥', t: n + ' · top contacts', recs: C.slice(0, 3).flatMap(x => x[1]), h: `Top contacts: ${C.slice(0, 3).map(([o, w]) => `<b class="mono">${esc(o)}</b> ${TSC.opb(o)} (${w.length})`).join(', ')}`, a: 'Get CAF + CDR of the top contacts – they lead to associates and the real user.', nt: this.nt('tel_cdr', this.op(C[0][0]), C.slice(0, 3).map(([o]) => this.name(o) + ' – CAF and CDR'), 'frequent contacts of suspect ' + n, 'CDR + CAF – contacts of ' + n), go: 'con' });
    const G = CDRX.gaps(v, 24).sort((a, b) => b.h - a.h); if (G.length) I.push({ p: G[0].devCh ? 'h' : 'm', i: '⏸', t: n + ' · off', recs: G[0].recs, h: `Off for <b>${CDRX.span(G[0].h)}</b> from ${esc(Tel.dd(G[0].from))}${G[0].devCh ? ' – handset changed' : ''}`, a: 'Check against the crime date; a second phone may have been used.', go: 'off' });
    if (k === 'ipdr') { const vp = v.filter(IPX.vpn); if (vp.length) I.push({ p: 'h', i: '🛡', t: n + ' · VPN', recs: vp, h: `<b>${fmtNum(vp.length)}</b> VPN / proxy / remote sessions (${uniq(vp.map(IPX.app)).slice(0, 3).map(esc).join(', ')})`, a: 'Ask the VPN / remote-app provider for logs; look for these apps on the seized device.', go: 'vpn' });
      const A = [...groupBy(v.filter(r => IPX.app(r) && !/^(HTTPS?|DNS|Port \d+)$/i.test(IPX.app(r))), IPX.app)].sort((a, b) => b[1].length - a[1].length); if (A.length) I.push({ p: 'm', i: '📲', t: n + ' · apps', recs: A.slice(0, 3).flatMap(x => x[1]), h: `Main apps: ${A.slice(0, 4).map(([a, w]) => `<b>${esc(a)}</b> (${w.length})`).join(', ')}`, a: 'Send notices to these platforms with own public IP + port + time (Platform requisition tab).', go: 'req' }); }
    if (k === 'tdr') { const sp = uniq(v.map(r => r._src)); if (sp.length >= 2) I.push({ p: 'h', i: '📡', t: n + ' · at spots', recs: v, h: `Present in <b>${sp.length}</b> tower dumps (crime spots)`, a: 'Strong lead – get CAF + CDR of this number at once.', nt: this.nt('tel_cdr', op, [n + ' – CAF and CDR with cell ID'], 'present at ' + sp.length + ' crime spots', 'CDR + CAF – ' + n) }); }
    return I;
  },
  /* ---- IPDR all ---- */
  ipdrAll(d) {
    const I = [], U = [...groupBy(d.filter(IPX.user), IPX.user)];
    U.map(([u, v]) => [u, v, v.filter(IPX.vpn)]).filter(x => x[2].length).sort((a, b) => b[2].length - a[2].length).slice(0, 3).forEach(([u, v, vp]) => I.push({ p: 'h', i: '🛡', t: u + ' · VPN', n: u, recs: vp, h: `<b class="mono">${esc(u)}</b> ${TSC.opb(u)} – <b>${vp.length}</b> VPN / proxy / remote sessions`, a: 'Hiding identity – ask the VPN / remote provider for logs; check the device.', go: 'vpn' }));
    const fc = [...groupBy(d.filter(r => r.dcty && !/^india$/i.test(r.dcty)), r => r.dcty)].sort((a, b) => b[1].length - a[1].length);
    if (fc.length) I.push({ p: 'm', i: '🌍', t: 'Foreign servers', recs: fc.slice(0, 3).flatMap(x => x[1]), h: `Servers in ${fc.slice(0, 4).map(([c, w]) => `<b>${esc(c)}</b> (${w.length})`).join(', ')}`, a: 'Foreign app servers often mean scam / betting / loan apps – find the app (Destinations tab) and report / block.', go: 'geo' });
    const A = [...groupBy(d.filter(r => IPX.app(r) && !/^(HTTPS?|DNS|Port \d+)$/i.test(IPX.app(r))), IPX.app)].sort((a, b) => b[1].length - a[1].length);
    if (A.length) I.push({ p: 'm', i: '📲', t: 'Apps', recs: A.slice(0, 3).flatMap(x => x[1]), h: `Apps used most: ${A.slice(0, 4).map(([a, w]) => `<b>${esc(a)}</b> (${w.length})`).join(', ')}`, a: 'Send platform notices with own public IP + port + time list.', go: 'req' });
    const ip = [...groupBy(d.filter(r => r.xip), r => r.xip)].map(([x, v]) => [x, v, uniq(v.map(IPX.user))]).filter(x => x[2].length > 1).sort((a, b) => b[2].length - a[2].length);
    if (ip.length) I.push({ p: 'm', i: '🌐', t: 'Shared public IP', recs: ip[0][1], h: `Public IP <b class="mono">${esc(ip[0][0])}</b> used by <b>${ip[0][2].length}</b> numbers`, a: 'Several numbers behind one IP at the same time – same place / same router; check the users list.', go: 'num' });
    return I;
  },
  /* ---- TDR all ---- */
  tdrAll(d) {
    const I = []; let L = []; try { L = TelUI.tdrStats(d).L; } catch (e) { }
    const top = L.filter(x => x.sN >= 2).sort((a, b) => b.sN - a.sN || b.recs.length - a.recs.length);
    top.slice(0, 4).forEach(x => I.push({ p: 'h', i: '📡', t: x.n + ' · at spots', n: x.n, w: x.n, recs: x.recs, h: `<b class="mono">${esc(x.n)}</b> ${TSC.opb(x.n)} present at <b>${x.sN} crime spots</b>${Tel.also('mobile', x.n) ? ` <span class="tf-chip bad">in ${esc(Tel.also('mobile', x.n))}</span>` : ''}`, a: 'Strong lead – get CAF + CDR of this number.' }));
    if (top.length) I.push({ p: 'h', i: '📝', t: 'Numbers at 2+ spots', recs: top.flatMap(x => x.recs), h: `<b>${top.length}</b> numbers present at 2 or more spots`, a: 'One notice for all of them: CAF + CDR (by operator).', nt: this.nt('tel_cdr', '', top.slice(0, 50).map(x => this.name(x.n) + ' – CAF and CDR'), 'numbers present at several crime spots', 'CDR + CAF – numbers at crime spots') });
    const fr = L.filter(x => x.foreign).slice(0, 1); if (fr.length) I.push({ p: 'm', i: '🌍', t: 'Foreign SIM', recs: fr[0].recs, h: `Foreign / roaming SIM <b class="mono">${esc(fr[0].n)}</b> at the spot`, a: 'Foreign SIMs at a crime spot are rare – check the person and travel records.', go: 'roam' });
    return I;
  }
};
/* suggestion line at the bottom of every finding box */
TSC.groups = function (G) {
  G = G.filter(g => g.items.length); if (!G.length) return '';
  return `<div class="tf-grid">${G.map(g => { const sg = ACT.SG[g.t]; return `<div class="tf-card" style="--tc:${g.c}"><div class="tf-h">${g.i} ${esc(g.t)}</div><div class="tf-tiles">${g.items.slice(0, g.max || 6).map(x => this.tile(x, g)).join('')}</div>${sg ? `<div class="tf-sg">💡 ${esc(sg)}</div>` : ''}</div>`; }).join('')}</div>`;
};
/* add the action plan to each overview */
{ const _a = TelUI.cdrAll; TelUI.cdrAll = function (el, d) { _a.call(this, el, d); try { ACT.card(el, ACT.cdrAll(d)); } catch (e) { console.error(e); } }; }
{ const _p = TelUI.prof; TelUI.prof = function (el, d, k) { _p.call(this, el, d, k); try { ACT.card(el, ACT.prof(d, k), 'Action plan for ' + Tel._sn); } catch (e) { console.error(e); } }; }
{ const _i = TelUI.ipdr_sum; TelUI.ipdr_sum = function (el, d) { _i.call(this, el, d); if (!Tel._sn) try { ACT.card(el, ACT.ipdrAll(d)); } catch (e) { console.error(e); } }; }
{ const _t = TelUI.tdr_sum; TelUI.tdr_sum = function (el, d) { _t.call(this, el, d); if (!Tel._sn) try { ACT.card(el, ACT.tdrAll(d)); } catch (e) { console.error(e); } }; }
