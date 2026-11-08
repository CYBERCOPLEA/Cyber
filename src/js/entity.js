/* entity.js - Analytics → Entity Graph: accounts / profiles / complaints joined by the details they share.
   Works with money-trail sheets alone (mobile, email, PAN, Aadhaar, name, UPI, IFSC), plus KYC, social and NCRP data. */
'use strict';

AnaTabs.entity = el => {
  const T = S.entTypes || (S.entTypes = { mobile: 1, email: 1, pan: 1, aadhaar: 1, name: 1, upi: 1, imei: 1, ip: 1, ifsc: 0 });
  const top = S.entTop || 50;
  const M = new Map(), owners = new Map();
  const own = (id, label, sub, kind) => { if (!owners.has(id)) owners.set(id, { id, label, sub, kind, value: 0 }); return id; };
  const put = (type, v, ownerId) => {
    if (!T[type] || v == null) return; v = String(v).trim();
    if (type === 'name') v = v.toUpperCase().replace(/\s+/g, ' ');
    if (v.length < (type === 'name' ? 4 : 3) || isSynthetic(v)) return;
    const k = type + ':' + v; if (!M.has(k)) M.set(k, { type, value: v, owners: new Set() }); M.get(k).owners.add(ownerId);
  };
  for (const t of S.data.txns) {
    if (!t.to_acc || isSynthetic(t.to_acc)) continue;
    const o = own('A:' + t.to_acc, accLabel(t.to_acc), [t.to_name, t.to_bank].filter(Boolean).join(' · '), 'account');
    put('mobile', t.mobile, o); put('email', t.email, o); put('pan', t.pan, o); put('aadhaar', t.aadhaar, o); put('name', t.to_name, o); put('ifsc', t.to_ifsc, o);
    if (t.to_acc.includes('@')) put('upi', t.to_acc.toLowerCase(), o);
  }
  for (const k of S.data.kyc) {
    if (!k.acc) continue; const o = own('A:' + k.acc, accLabel(k.acc), [k.name, k.bank].filter(Boolean).join(' · '), 'account');
    put('mobile', k.mobile, o); put('email', k.email, o); put('pan', k.pan, o); put('aadhaar', k.aadhaar, o); put('name', k.name, o); put('ip', k.ip, o); put('ifsc', k.ifsc, o);
  }
  for (const r of S.data.social) {
    const o = own('P:' + (r.platform || '') + ':' + (r.profile || r.name || ''), r.profile || r.name || 'profile', r.platform || 'Social', 'profile');
    String(r.mobile || '').split(/[,;]/).forEach(m => put('mobile', N.mobile(m), o)); String(r.email || '').split(/[,;]/).forEach(m => put('email', m.trim().toLowerCase(), o));
    put('imei', r.imei, o); put('ip', r.ip, o); put('name', r.name, o);
  }
  for (const c of S.data.ncrp) { const o = own('C:' + c.ack_no, 'Complaint ' + c.ack_no, c.victim_name || 'NCRP', 'victim'); put('mobile', c.suspect_mobile, o); put('upi', c.suspect_upi, o); put('email', c.suspect_email, o); }

  const shared = [...M.values()].filter(x => x.owners.size >= 2).sort((a, b) => b.owners.size - a.owners.size);
  const shown = shared.slice(0, top);
  const nodes = new Map(), edges = [];
  for (const x of shown) {
    const id = 'I:' + x.type + ':' + x.value;
    nodes.set(id, { id, label: x.value, sub: x.type.toUpperCase() + ' · ' + x.owners.size, kind: 'ident', value: x.owners.size * 3, title: `${x.type.toUpperCase()}: ${x.value}\nshared by ${x.owners.size}` });
    for (const o of x.owners) { if (!nodes.has(o)) nodes.set(o, { ...owners.get(o), value: 0 }); nodes.get(o).value++; edges.push({ from: o, to: id, amount: 0, count: 1 }); }
  }
  const labels = { mobile: 'Mobile', email: 'Email', pan: 'PAN', aadhaar: 'Aadhaar', name: 'Same name', upi: 'UPI', imei: 'IMEI', ip: 'IP', ifsc: 'IFSC (branch)' };
  el.innerHTML = `<div class="card"><h3>Entity graph – who is linked to whom</h3><div class="sub">Accounts (blue), social profiles (pink) and complaints (orange) joined to the details they share (violet). Built from the money-trail sheet, KYC, social media and NCRP data. Click a violet detail to list everything that shares it; click an account to open it.</div>
    <div class="row" style="flex-wrap:wrap">${Object.entries(labels).map(([k, l]) => `<label class="small"><input type="checkbox" data-et="${k}" ${T[k] ? 'checked' : ''}> ${l}</label>`).join('')}
    <label style="margin-left:12px">Show</label><select id="eTop">${[50, 120, 250, 500].map(n => `<option ${n === top ? 'selected' : ''}>${n}</option>`).join('')}</select><label>biggest shared details</label>
    <span class="spacer"></span><span class="small muted">${shared.length} shared details · showing ${shown.length}</span><button class="btn sm" id="ePng">⬇ PNG</button></div></div>
    <div class="graph-box" id="eBox" style="height:680px"></div>`;
  $$('[data-et]', el).forEach(c => c.onchange = () => { T[c.dataset.et] = c.checked ? 1 : 0; AnaTabs.entity(el); });
  $('#eTop', el).onchange = e => { S.entTop = +e.target.value; AnaTabs.entity(el); };
  if (!nodes.size) { $('#eBox', el).innerHTML = `<div class="muted" style="padding:40px;text-align:center">No detail is shared by two or more accounts / profiles with the ticked types.${T.ifsc ? '' : ' Try ticking IFSC (branch).'}<br>Mobile, email, PAN and Aadhaar come from the trail sheet columns or from imported KYC replies.</div>`; return; }
  const g = Graph.mount($('#eBox', el), [...nodes.values()], edges, {
    mode: 'net', labels: false,
    onNode: n => {
      if (n.kind === 'ident') {
        const x = shown.find(s => 'I:' + s.type + ':' + s.value === n.id);
        const b = UI.drawer(x.type.toUpperCase() + ': ' + x.value, `<p class="small muted">Shared by ${x.owners.size}</p>` + [...x.owners].map(o => { const w = owners.get(o); return `<div class="list-item small">${o.startsWith('A:') ? accLink(o.slice(2)) : esc(w.label)} · ${esc(w.sub || '')}</div>`; }).join(''));
        bindAccLinks(b);
      } else if (n.id.startsWith('A:')) showAccount(n.id.slice(2));
    }
  });
  $('#ePng', el).onclick = () => g.download('entity_graph', true);
};
