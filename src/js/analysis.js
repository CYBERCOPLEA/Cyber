/* analysis.js - money trail, layers, risk scoring, commonality, cross-linking */
'use strict';

const isSynthetic = a => !a || /^(CASH-OUT|UNIDENTIFIED|NAME:)/.test(a);
const accLabel = a => a.startsWith('NAME:') ? a.slice(5) : a;

const Analysis = {
  _c: {},
  invalidate() { this._c = {}; },
  cached(k, f) { if (!(k in this._c)) this._c[k] = f(); return this._c[k]; },

  /* ---------- Money trail graph ---------- */
  fin() {
    return this.cached('fin', () => {
      const txns = S.data.txns, kyc = S.data.kyc;
      const A = new Map(), E = new Map();
      const node = acc => {
        if (!A.has(acc)) A.set(acc, { acc, names: new Set(), banks: new Set(), ifscs: new Set(), inAmt: 0, outAmt: 0, inCnt: 0, outCnt: 0, senders: new Set(), receivers: new Set(), acks: new Set(), layers: new Set(), hold: 0, firstIn: '', firstOut: '', lastOut: '', cashOut: 0, kyc: [], srcs: new Set(), victim: false });
        return A.get(acc);
      };
      // statements overlap with the trail: skip statement rows whose UTR is already in the trail,
      // and resolve "NAME:xyz" counterparties to a known account with that holder name
      const trailUtr = new Set(txns.filter(t => t._type !== 'stmt' && t.txn_id).map(t => t.txn_id));
      const nameAcc = new Map(); const cleanNm = s => String(s || '').replace(/\(.*?\)/g, '').replace(/[^A-Z ]/g, '').trim();
      for (const t of txns) if (t._type !== 'stmt') { if (t.to_name && !isSynthetic(t.to_acc)) nameAcc.set(cleanNm(t.to_name), t.to_acc); if (t.from_name && t.from_acc) nameAcc.set(cleanNm(t.from_name), t.from_acc); }
      for (const k of kyc) if (k.name && k.acc) nameAcc.set(cleanNm(k.name), k.acc);
      const resolve = a => a && a.startsWith('NAME:') ? (nameAcc.get(cleanNm(a.slice(5))) || a) : a;
      const day = d => String(d || '').slice(0, 10), trailKey = new Set();
      for (const t of txns) if (t._type !== 'stmt' && t.amount) { trailKey.add(t.from_acc + '|' + t.amount + '|' + day(t.date)); trailKey.add(t.to_acc + '|' + t.amount + '|' + day(t.date)); }
      for (const t0 of txns) {
        if (t0._type === 'stmt' && t0.txn_id && trailUtr.has(t0.txn_id)) continue;
        if (t0._type === 'stmt' && trailKey.has((t0.action === 'Debit' ? t0.from_acc : t0.to_acc) + '|' + t0.amount + '|' + day(t0.date))) continue;
        const t = t0._type === 'stmt' ? { ...t0, from_acc: resolve(t0.from_acc), to_acc: resolve(t0.to_acc) } : t0;
        const f = t.from_acc || (t.layer === 1 || t._type === 'trail' ? 'VICTIM:' + (t.ack_no || 'UNKNOWN') : 'UNIDENTIFIED');
        const to = t.to_acc || 'UNIDENTIFIED';
        if (t.holdOnly) { const h = node(to); h.hold += Math.abs(t.hold || t.amount || 0); if (t.ack_no) h.acks.add(t.ack_no); if (t.layer) h.layers.add(t.layer - 1 || 1); continue; }
        const a = node(f), b = node(to), amt = Math.abs(t.amount || 0);
        if (t.from_name) a.names.add(t.from_name); if (t.from_bank) a.banks.add(t.from_bank); if (t.from_ifsc) a.ifscs.add(t.from_ifsc);
        if (t.to_name) b.names.add(t.to_name); if (t.to_bank) b.banks.add(t.to_bank); if (t.to_ifsc) b.ifscs.add(t.to_ifsc);
        a.outAmt += amt; a.outCnt++; a.receivers.add(to); b.inAmt += amt; b.inCnt++; b.senders.add(f);
        if (t.ack_no) { a.acks.add(t.ack_no); b.acks.add(t.ack_no); }
        if (t.layer) { b.layers.add(t.layer); if (t.layer > 1) a.layers.add(t.layer - 1); else a.victim = true; }
        if (t.hold) b.hold += Math.abs(t.hold);
        if (t.date) { if (!b.firstIn || t.date < b.firstIn) b.firstIn = t.date; if (!a.firstOut || t.date < a.firstOut) a.firstOut = t.date; if (!a.lastOut || t.date > a.lastOut) a.lastOut = t.date; }
        if (/^CASH-OUT/.test(to) || /atm|cash|withdraw|aeps|pos/i.test(t.action + ' ' + t.mode) && t._type === 'trail') a.cashOut += amt;
        a.srcs.add(t._src); b.srcs.add(t._src);
        const k = f + '→' + to;
        if (!E.has(k)) E.set(k, { from: f, to, amount: 0, count: 0, txns: [] });
        const e = E.get(k); e.amount += amt; e.count++; e.txns.push(t);
      }
      for (const k of kyc) { if (!k.acc) continue; const n = A.get(k.acc); if (n) { n.kyc.push(k); if (k.name) n.names.add(k.name); if (k.bank) n.banks.add(k.bank); if (k.ifsc) n.ifscs.add(k.ifsc); } }
      // Layer inference (BFS from roots) when no explicit layer
      const inE = new Map(), outE = new Map();
      for (const e of E.values()) { (outE.get(e.from) || outE.set(e.from, []).get(e.from)).push(e); (inE.get(e.to) || inE.set(e.to, []).get(e.to)).push(e); }
      for (const n of A.values()) n.layer = n.layers.size ? Math.min(...n.layers) : null;
      const roots = [...A.values()].filter(n => n.victim || n.acc.startsWith('VICTIM:') || (!inE.has(n.acc) && n.layer == null));
      roots.forEach(r => { if (r.layer == null) r.layer = 0; });
      const q = [...A.values()].filter(n => n.layer != null);
      while (q.length) {
        const n = q.shift();
        for (const e of outE.get(n.acc) || []) { const m = A.get(e.to); if (m.layer == null || (m.layers.size === 0 && m.layer > n.layer + 1)) { m.layer = n.layer + 1; q.push(m); } }
      }
      for (const n of A.values()) if (n.layer == null) n.layer = 0;
      // shared KYC identifiers across different accounts
      const share = new Map();
      for (const k of kyc) for (const f of ['mobile', 'email', 'pan', 'aadhaar']) if (k[f] && k.acc) { const key = f + ':' + k[f]; if (!share.has(key)) share.set(key, new Set()); share.get(key).add(k.acc); }
      for (const t of txns) for (const f of ['mobile', 'email', 'pan', 'aadhaar']) if (t[f] && t.to_acc) { const key = f + ':' + t[f]; if (!share.has(key)) share.set(key, new Set()); share.get(key).add(t.to_acc); }
      const sharedBy = new Map();
      for (const [key, set] of share) if (set.size > 1) for (const acc of set) { if (!sharedBy.has(acc)) sharedBy.set(acc, []); sharedBy.get(acc).push(key); }
      // risk scoring
      for (const n of A.values()) {
        const flags = []; let score = 0;
        if (isSynthetic(n.acc) || n.acc.startsWith('VICTIM:')) { n.score = 0; n.flags = []; continue; }
        if (n.acks.size >= 2) { score += Math.min(40, 15 * n.acks.size); flags.push(`In ${n.acks.size} complaints`); }
        if (n.senders.size >= 3) { score += 15; flags.push(`${n.senders.size} senders`); }
        if (n.inAmt > 0 && n.outAmt / n.inAmt >= 0.8) { score += 20; flags.push('Pass-through (money out ≥ 80% of in)'); }
        if (n.firstIn && n.firstOut && n.firstOut >= n.firstIn && (new Date(n.firstOut.replace(' ', 'T')) - new Date(n.firstIn.replace(' ', 'T'))) <= 86400000) { score += 15; flags.push('Moved out within 24h'); }
        if (n.cashOut > 0) { score += 15; flags.push('Cash / ATM withdrawal'); }
        if (sharedBy.has(n.acc)) { score += 20; flags.push('Shares KYC ' + uniq(sharedBy.get(n.acc).map(s => s.split(':')[0])).join('/') + ' with other accounts'); }
        if (n.layer >= 1 && n.inAmt >= 100000) { score += 10; flags.push('Received ≥ ₹1 lakh'); }
        n.score = Math.min(100, score); n.flags = flags;
      }
      return { A, E, inE, outE, sharedBy };
    });
  },

  accountRows() {
    const { A } = this.fin();
    return [...A.values()].filter(n => !n.acc.startsWith('VICTIM:') && n.acc !== 'UNIDENTIFIED').map(n => ({
      acc: n.acc, label: accLabel(n.acc), name: [...n.names].join(' / '), bank: [...n.banks].join(' / '), ifsc: [...n.ifscs].join(' / '), layer: n.layer,
      inAmt: n.inAmt, outAmt: n.outAmt, inCnt: n.inCnt, outCnt: n.outCnt, senders: n.senders.size, receivers: n.receivers.size, acks: n.acks.size, ackList: [...n.acks].join(', '),
      hold: n.hold, cashOut: n.cashOut, score: n.score, flags: n.flags, firstIn: n.firstIn, lastOut: n.lastOut, kyc: n.kyc.length
    }));
  },

  /* ---------- Commonality ---------- */
  FIN_COMMON: {
    account: { label: 'Account number (any role)', get: t => [[t.from_acc, 'sender'], [t.to_acc, 'beneficiary']], kyc: k => [[k.acc, 'kyc']] },
    beneficiary: { label: 'Beneficiary account (receiving)', get: t => [[t.to_acc, 'beneficiary']], kyc: () => [] },
    ifsc: { label: 'IFSC', get: t => [[t.from_ifsc, 'sender'], [t.to_ifsc, 'beneficiary']], kyc: k => [[k.ifsc, 'kyc']] },
    bank: { label: 'Bank', get: t => [[t.to_bank, 'beneficiary']], kyc: k => [[k.bank, 'kyc']] },
    name: { label: 'Beneficiary / holder name', get: t => [[t.to_name, 'beneficiary'], [t.from_name, 'sender']], kyc: k => [[k.name, 'kyc']] },
    mobile: { label: 'Mobile number', get: t => [[t.mobile, 'txn']], kyc: k => [[k.mobile, 'kyc']] },
    email: { label: 'Email', get: t => [[t.email, 'txn']], kyc: k => [[k.email, 'kyc']] },
    pan: { label: 'PAN', get: t => [[t.pan, 'txn']], kyc: k => [[k.pan, 'kyc']] },
    aadhaar: { label: 'Aadhaar', get: t => [[t.aadhaar, 'txn']], kyc: k => [[k.aadhaar, 'kyc']] },
    state: { label: 'State', get: t => [[t.state, 'txn']], kyc: k => [[k.state, 'kyc']] },
    district: { label: 'District', get: t => [[t.district, 'txn']], kyc: k => [[k.district, 'kyc']] },
    address: { label: 'Address (KYC)', get: () => [], kyc: k => [[k.address, 'kyc']] },
    ip: { label: 'IP address (KYC)', get: () => [], kyc: k => [[k.ip, 'kyc']] },
    utr: { label: 'UTR / Transaction ID', get: t => [[t.txn_id, 'txn']], kyc: () => [] },
    upi: { label: 'UPI ID (from statements)', get: t => [[t.cp_upi, 'txn']], kyc: k => (k.linked || '').split(/[,;\s]+/).filter(x => x.includes('@')).map(x => [x.toLowerCase(), 'kyc']) }
  },
  finCommon(field) {
    return this.cached('fc:' + field, () => {
      const def = this.FIN_COMMON[field]; const G = new Map();
      const add = (v, role, rec, kind) => {
        if (v == null || v === '' || isSynthetic(String(v))) return;
        v = String(v); if (!G.has(v)) G.set(v, { value: v, n: 0, acks: new Set(), accs: new Set(), amount: 0, srcs: new Set(), roles: new Set(), recs: [] });
        const g = G.get(v); g.n++; g.roles.add(role); g.srcs.add(rec._src); g.recs.push({ kind, rec });
        if (rec.ack_no) g.acks.add(rec.ack_no);
        const acc = kind === 'kyc' ? rec.acc : (role === 'sender' ? rec.from_acc : rec.to_acc);
        if (acc && !isSynthetic(acc)) g.accs.add(acc);
        if (kind === 'txn') g.amount += Math.abs(rec.amount || 0);
      };
      for (const t of S.data.txns) for (const [v, role] of def.get(t)) add(v, role, t, 'txn');
      for (const k of S.data.kyc) for (const [v, role] of def.kyc(k)) add(v, role, k, 'kyc');
      return [...G.values()].map(g => ({ value: g.value, n: g.n, acks: g.acks.size, ackList: [...g.acks].join(', '), accs: g.accs.size, accList: [...g.accs].join(', '), amount: g.amount, srcs: g.srcs.size, roles: [...g.roles].join(', '), recs: g.recs }));
    });
  },

  /* social media platforms shown as sub-links under Social Media */
  SOC_PLAT: [['whatsapp', 'WhatsApp', '#25D366', /whats\s*app|\bwa\b/i], ['telegram', 'Telegram', '#229ED9', /telegram/i], ['facebook', 'Facebook', '#1877F2', /facebook|\bfb\b|\bmeta\b/i], ['instagram', 'Instagram', '#E1306C', /insta/i], ['google', 'Google (Gmail)', '#EA4335', /google|gmail|youtube/i]],
  platOf(r) {
    const by = t => { for (const id of ['instagram', 'whatsapp', 'telegram', 'google', 'facebook']) if (this.SOC_PLAT.find(p => p[0] === id)[3].test(t)) return id; return ''; };
    return (r.platform ? by(String(r.platform)) : '') || (!r.platform ? by(String(r._src || '')) : '') || '';
  },
  socRows() { return S.socPlat ? S.data.social.filter(r => this.platOf(r) === S.socPlat) : S.data.social; },
  SOC_COMMON: { mobile: 'Mobile', email: 'Email', imei: 'IMEI', ip: 'IP address', device: 'Device', name: 'Name', address: 'Address / location', profile: 'Profile / username' },
  socCommon(field) {
    return this.cached('sc:' + (S.socPlat || '') + ':' + field, () => {
      const G = new Map();
      for (const r of this.socRows()) {
        const vals = String(r[field] || '').split(field === 'name' || field === 'address' || field === 'device' ? /\n/ : /[,;\n]+/).map(s => s.trim()).filter(Boolean);
        for (let v of vals) {
          if (field === 'mobile') v = N.mobile(v); if (field === 'email') v = v.toLowerCase(); if (field === 'name') v = v.toUpperCase();
          if (!G.has(v)) G.set(v, { value: v, n: 0, profiles: new Set(), platforms: new Set(), srcs: new Set(), recs: [], times: [] });
          const g = G.get(v); g.n++; if (r.profile) g.profiles.add(r.profile); if (r.platform) g.platforms.add(r.platform); g.srcs.add(r._src); g.recs.push(r); if (r.ip_time) g.times.push(r.ip_time);
        }
      }
      return [...G.values()].map(g => ({ value: g.value, n: g.n, profiles: g.profiles.size, profileList: [...g.profiles].join(', '), platforms: g.platforms.size, platformList: [...g.platforms].join(', '), srcs: g.srcs.size, first: g.times.sort()[0] || '', last: g.times.sort().slice(-1)[0] || '', recs: g.recs }));
    });
  },

  /* ---------- Cross-section identifier index ---------- */
  idents() {
    return this.cached('idents', () => {
      const out = [];
      const push = (type, value, section, ref, rec) => { if (value && !isSynthetic(String(value))) out.push({ type, value: String(value), section, ref, rec }); };
      for (const t of S.data.txns) {
        const ref = (t._type === 'stmt' ? 'Statement' : 'Money trail') + (t.ack_no ? ' · ' + t.ack_no : '');
        push('account', t.from_acc, 'Financial', ref, t); push('account', t.to_acc, 'Financial', ref, t);
        push('mobile', t.mobile, 'Financial', ref, t); push('email', t.email, 'Financial', ref, t); push('pan', t.pan, 'Financial', ref, t); push('aadhaar', t.aadhaar, 'Financial', ref, t);
        push('upi', t.cp_upi, 'Financial', ref, t);
        if (t.from_acc && t.from_acc.includes('@')) push('upi', t.from_acc.toLowerCase(), 'Financial', ref, t);
        if (t.to_acc && t.to_acc.includes('@')) push('upi', t.to_acc.toLowerCase(), 'Financial', ref, t);
      }
      for (const k of S.data.kyc) {
        const ref = 'KYC · ' + (k.acc || k.name);
        push('account', k.acc, 'Financial', ref, k); push('mobile', k.mobile, 'Financial', ref, k); push('email', k.email, 'Financial', ref, k);
        push('pan', k.pan, 'Financial', ref, k); push('aadhaar', k.aadhaar, 'Financial', ref, k); push('ip', k.ip, 'Financial', ref, k);
        const im = String(k.device || '').match(/\b\d{15}\b/); if (im) push('imei', im[0], 'Financial', ref, k);
        String(k.linked || '').split(/[,;\s]+/).filter(x => x.includes('@')).forEach(u => push('upi', u.toLowerCase(), 'Financial', ref, k));
      }
      for (const r of S.data.social) {
        const ref = (r.platform || 'Social') + ' · ' + (r.profile || r.name || '');
        String(r.mobile || '').split(/[,;]/).forEach(m => push('mobile', N.mobile(m), 'Social Media', ref, r));
        String(r.email || '').split(/[,;]/).forEach(m => push('email', m.trim().toLowerCase(), 'Social Media', ref, r));
        push('imei', r.imei, 'Social Media', ref, r); push('ip', r.ip, 'Social Media', ref, r);
      }
      for (const c of S.data.ncrp) {
        const ref = 'NCRP · ' + (c.ack_no || '');
        push('mobile', c.suspect_mobile, 'NCRP', ref + ' (suspect)', c); push('account', c.suspect_acc, 'NCRP', ref + ' (suspect)', c);
        push('upi', c.suspect_upi, 'NCRP', ref + ' (suspect)', c); push('email', c.suspect_email, 'NCRP', ref + ' (suspect)', c); push('url', c.suspect_url, 'NCRP', ref + ' (suspect)', c);
        push('mobile', c.victim_mobile, 'NCRP', ref + ' (victim)', c);
      }
      for (const i of S.data.idents) push(i.type, i.value, 'Others', 'Extracted · ' + (i.source || ''), i);
      return out;
    });
  },
  crossLinks() {
    return this.cached('xl', () => {
      const G = groupBy(this.idents(), i => i.type + '|' + i.value);
      return [...G.values()].map(list => {
        const secs = uniq(list.map(i => i.section)), refs = uniq(list.map(i => i.ref));
        return { type: list[0].type, value: list[0].value, n: list.length, sections: secs.length, sectionList: secs.join(', '), refs: refs.length, refList: refs.slice(0, 12).join(' | ') + (refs.length > 12 ? ' …' : ''), items: list };
      });
    });
  },

  search(q) {
    q = q.trim().toLowerCase(); if (q.length < 3) return [];
    const res = [];
    const scan = (arr, section, label) => { for (const r of arr) { for (const [k, v] of Object.entries(r)) { if (k.startsWith('_') || k === 'id' || v == null || typeof v === 'object') continue; if (String(v).toLowerCase().includes(q)) { res.push({ section, label: label(r), field: k, value: String(v), rec: r }); break; } } if (res.length > 500) return; } };
    scan(S.data.txns, 'Financial · transaction', r => `${r.from_acc || '?'} → ${r.to_acc || '?'} ${fmtINR(r.amount)} ${r.date || ''}`);
    scan(S.data.kyc, 'Financial · KYC', r => `${r.acc} ${r.name}`);
    scan(S.data.social, 'Social Media', r => `${r.platform} ${r.profile}`);
    scan(S.data.ncrp, 'NCRP', r => `${r.ack_no} ${r.victim_name}`);
    scan(S.data.notes, 'Case notes', r => r.title || '');
    scan(S.data.idents, 'Extracted identifiers', r => `${r.type} ${r.value}`);
    return res;
  }
};
