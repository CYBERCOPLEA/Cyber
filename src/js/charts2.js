/* charts2.js – colourful bar + round (donut) charts. The bar / slice under the cursor pops out
   with a big live tooltip, and goes back when the cursor leaves. Each chart can show Bar, Round or Both. */
'use strict';
(() => {
  const COL = ['#3b82f6', '#f97316', '#10b981', '#ec4899', '#8b5cf6', '#eab308', '#06b6d4', '#ef4444', '#84cc16', '#6366f1', '#14b8a6', '#f43f5e', '#a855f7', '#0ea5e9', '#d946ef', '#22c55e'];
  const col = i => COL[i % COL.length];
  let gid = 0; const PREF = {};
  const grad = (id, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".62"/></linearGradient>`;
  const pct = (v, t) => t ? (v / t * 100).toFixed(v / t < .1 ? 1 : 0) + '%' : '';
  const tipHtml = (d, c, fmt, tot) => `<div class="ct-h"><i style="background:${c}"></i>${esc(d.label)}</div><div class="ct-v">${esc(fmt(d.value))}</div>${tot ? `<div class="ct-p"><span style="width:${Math.min(100, d.value / tot * 100)}%;background:${c}"></span></div><div class="ct-s">${pct(d.value, tot)} of total</div>` : ''}${d.sub ? `<div class="ct-s">${esc(d.sub)}</div>` : ''}`;

  Charts.tip = function (e, html) {
    const t = $('#chartTip'); if (!html) { t.classList.remove('on'); return; }
    if (t._h !== html) { t.innerHTML = html; t._h = html; }
    t.style.display = 'block'; t.classList.add('on');
    const r = t.getBoundingClientRect(), x = e.clientX + 18 + r.width > innerWidth ? e.clientX - r.width - 18 : e.clientX + 18, y = e.clientY + 14 + r.height > innerHeight ? e.clientY - r.height - 14 : e.clientY + 14;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  };
  Charts.bindTips = function (el) {
    $$('[data-tip]', el).forEach(n => {
      n.onmousemove = e => Charts.tip(e, n.dataset.tip);
      n.onmouseenter = () => { const s = n.closest('svg'); if (s) s.classList.add('hov'); n.classList.add('pop'); if (n._enter) n._enter(); };
      n.onmouseleave = e => { const s = n.closest('svg'); if (s) s.classList.remove('hov'); n.classList.remove('pop'); Charts.tip(e, null); if (n._leave) n._leave(); };
    });
  };

  // switch Bar / Round / Both above a chart
  const frame = (el, kind, data, o, def) => {
    const st = el._ch || (el._ch = { view: o.view || (el.id && PREF[el.id]) || def });
    st.kind = kind; st.data = data; st.o = o;
    const can = data.length >= 2 && data.length <= 40 && data.every(d => d.value >= 0) && o.round !== false;
    const v = can ? st.view : 'bar';
    el.classList.add('ch-host');
    el.innerHTML = `${can ? `<div class="ch-sw">${[['bar', '▮ Bar'], ['donut', '◕ Round'], ['both', '▮◕ Both']].map(([k, l]) => `<button data-v="${k}" class="${k === v ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}<div class="ch-body chv-${v}"></div>`;
    $$('.ch-sw button', el).forEach(b => b.onclick = () => { st.view = b.dataset.v; if (el.id) PREF[el.id] = st.view; Charts['_' + kind](el, data, o); });
    return { body: $('.ch-body', el), v };
  };

  const hbarSvg = (data, fmt, tot, onClick, wide) => {
    const W = wide ? 560 : 420, rowH = 30, lw = wide ? 170 : 130, H = data.length * rowH + 8, mx = Math.max(...data.map(d => d.value)) || 1, g = ++gid;
    return `<svg class="chart c2 hb" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet"><defs>${data.map((d, i) => grad(`hg${g}_${i}`, col(i))).join('')}</defs>${data.map((d, i) => {
      const w = Math.max(3, (W - lw - 92) * d.value / mx), y = i * rowH + 4, v = esc(fmt(d.value));
      return `<g class="it" data-tip="${esc(tipHtml(d, col(i), fmt, tot))}" data-i="${i}" style="cursor:${onClick ? 'pointer' : 'default'};--c:${col(i)}">
        <rect x="0" y="${y - 3}" width="${W}" height="${rowH}" fill="transparent"/>
        <text x="${lw - 8}" y="${y + 15}" text-anchor="end" class="lb">${esc(String(d.label).slice(0, wide ? 26 : 19))}</text>
        <rect class="bar" x="${lw}" y="${y + 2}" width="${w}" height="20" rx="6" fill="url(#hg${g}_${i})"/>
        <text x="${lw + w + 7}" y="${y + 16}" class="vl">${v}</text></g>`;
    }).join('')}</svg>`;
  };
  const donutSvg = (data, fmt, tot, title) => {
    const S = 240, R = 100, r = 62, cx = S / 2, cy = S / 2; let a0 = -Math.PI / 2;
    const segs = data.map((d, i) => {
      const a = tot ? d.value / tot * Math.PI * 2 : 0, a1 = a0 + Math.max(a, 0.0001), mid = (a0 + a1) / 2, big = a > Math.PI ? 1 : 0;
      const p = (rad, an) => `${cx + rad * Math.cos(an)},${cy + rad * Math.sin(an)}`;
      const path = a >= Math.PI * 2 - 1e-6 ? `M${cx - R},${cy}A${R},${R} 0 1 1 ${cx + R},${cy}A${R},${R} 0 1 1 ${cx - R},${cy}M${cx - r},${cy}A${r},${r} 0 1 0 ${cx + r},${cy}A${r},${r} 0 1 0 ${cx - r},${cy}Z`
        : `M${p(R, a0)}A${R},${R} 0 ${big} 1 ${p(R, a1)}L${p(r, a1)}A${r},${r} 0 ${big} 0 ${p(r, a0)}Z`;
      const s = { d, i, path, dx: Math.cos(mid) * 9, dy: Math.sin(mid) * 9 }; a0 = a1; return s;
    });
    return `<svg class="chart c2 dn" viewBox="0 0 ${S} ${S}"><circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="var(--surface-3)" stroke-width="${R - r}" opacity=".5"/>
      ${segs.map(s => `<g class="it sl" data-tip="${esc(tipHtml(s.d, col(s.i), fmt, tot))}" data-i="${s.i}" style="--dx:${s.dx.toFixed(1)}px;--dy:${s.dy.toFixed(1)}px;--c:${col(s.i)}"><path d="${s.path}" fill="${col(s.i)}" stroke="var(--surface-1)" stroke-width="1.5"/></g>`).join('')}
      <text class="dn-c1" x="${cx}" y="${cy - 4}" text-anchor="middle">${esc(title || 'Total')}</text><text class="dn-c2" x="${cx}" y="${cy + 18}" text-anchor="middle">${esc(Charts.short ? (fmt === fmtINR ? '₹' + Charts.short(tot) : Charts.short(tot)) : tot)}</text></svg>`;
  };
  const legend = (data, fmt, tot) => `<div class="ch-leg">${data.map((d, i) => `<div class="lg-it" data-li="${i}"><i style="background:${col(i)}"></i><span class="t">${esc(String(d.label).slice(0, 28))}</span><b>${pct(d.value, tot)}</b></div>`).join('')}</div>`;
  // live centre text + legend highlight while hovering a slice
  const linkDonut = (host, data, fmt, tot, title) => {
    const c1 = $('.dn-c1', host), c2 = $('.dn-c2', host); if (!c1) return;
    const set = (a, b) => { c1.textContent = a; c2.textContent = b; };
    const reset = () => set(title || 'Total', fmt === fmtINR ? '₹' + Charts.short(tot) : Charts.short(tot));
    $$('.dn .sl', host).forEach(g => { const d = data[+g.dataset.i]; g._enter = () => { set(String(d.label).slice(0, 18), pct(d.value, tot)); hl(+g.dataset.i); }; g._leave = () => { reset(); hl(-1); }; });
    const hl = i => $$('.lg-it', host).forEach(x => x.classList.toggle('on', +x.dataset.li === i));
    $$('.lg-it', host).forEach(x => { const g = $(`.dn .sl[data-i="${x.dataset.li}"]`, host); if (!g) return; x.onmouseenter = () => { g.classList.add('pop'); g.closest('svg').classList.add('hov'); g._enter(); }; x.onmouseleave = () => { g.classList.remove('pop'); g.closest('svg').classList.remove('hov'); g._leave(); }; });
  };

  Charts._hbar = function (el, data, o) {
    const { fmt = fmtNum, max = 12, onClick } = o; const all = data; data = data.slice(0, max);
    if (!data.length) { el.innerHTML = '<div class="muted small ch-empty">No data</div>'; return; }
    const tot = all.reduce((a, d) => a + Math.max(0, d.value), 0);
    const { body, v } = frame(el, 'hbar', all, o, el.clientWidth && el.clientWidth < 420 ? 'bar' : 'both');
    const dd = data.slice(); if (all.length > max && v !== 'bar') { const rest = all.slice(max).reduce((a, d) => a + d.value, 0); if (rest > 0) dd.push({ label: 'Others', value: rest, sub: (all.length - max) + ' more' }); }
    if (v === 'bar') body.innerHTML = hbarSvg(data, fmt, tot, onClick, true);
    else if (v === 'donut') body.innerHTML = `<div class="ch-dwrap">${donutSvg(dd, fmt, tot, o.title)}${legend(dd, fmt, tot)}</div>`;
    else body.innerHTML = `<div class="ch-both"><div class="ch-dwrap sm">${donutSvg(dd, fmt, tot, o.title)}</div><div class="ch-bw">${hbarSvg(data, fmt, tot, onClick, false)}</div></div>`;
    Charts.bindTips(body); linkDonut(body, dd, fmt, tot, o.title);
    if (onClick) $$('.hb g[data-i]', body).forEach(g => g.onclick = () => onClick(data[+g.dataset.i]));
  };
  Charts.hbar = function (el, data, o = {}) { el._ch = el._ch && el._ch.kind === 'hbar' ? el._ch : null; Charts._hbar(el, data, o); };

  const vbarSvg = (data, fmt, tot, W = 560) => {
    const H = W < 560 ? 250 : 236, pl = 56, pb = 34, pt = 16, mx = Math.max(...data.map(d => d.value)) || 1, bw = (W - pl - 10) / data.length, g = ++gid;
    const ticks = [0, .25, .5, .75, 1].map(t => mx * t);
    return `<svg class="chart c2 vb" viewBox="0 0 ${W} ${H}"><defs>${data.map((d, i) => `<linearGradient id="vg${g}_${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col(i)}"/><stop offset="1" stop-color="${col(i)}" stop-opacity=".55"/></linearGradient>`).join('')}</defs>
      ${ticks.map(t => { const y = H - pb - (H - pb - pt) * t / mx; return `<line class="gridline" x1="${pl}" x2="${W}" y1="${y}" y2="${y}"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end">${esc(Charts.short(t))}</text>`; }).join('')}
      ${data.map((d, i) => { const h = Math.max(2, (H - pb - pt) * d.value / mx), w = Math.max(3, Math.min(bw * .72 - 2, 58)), x = pl + i * bw + (bw - w) / 2, r = Math.min(6, w / 2);
        return `<g class="it" data-tip="${esc(tipHtml(d, col(i), fmt, tot))}" style="--c:${col(i)}"><rect x="${pl + i * bw}" y="${pt}" width="${bw}" height="${H - pb - pt}" fill="transparent"/>
        <path class="bar" d="M${x},${H - pb} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z" fill="url(#vg${g}_${i})"/>
        ${data.length <= 14 && h > 0 ? `<text class="vt" x="${x + w / 2}" y="${H - pb - h - 5}" text-anchor="middle">${esc(Charts.short(d.value))}</text>` : ''}
        ${data.length <= 16 || i % Math.ceil(data.length / 12) === 0 ? `<text x="${x + w / 2}" y="${H - pb + 15}" text-anchor="middle">${esc(String(d.label).slice(0, 10))}</text>` : ''}</g>`; }).join('')}
      <line x1="${pl}" x2="${W}" y1="${H - pb}" y2="${H - pb}" stroke="var(--grid)"/></svg>`;
  };
  Charts._vbar = function (el, data, o) {
    const { fmt = fmtNum } = o;
    if (!data.length) { el.innerHTML = '<div class="muted small ch-empty">No data</div>'; return; }
    const tot = data.reduce((a, d) => a + Math.max(0, d.value), 0);
    const { body, v } = frame(el, 'vbar', data, { ...o, round: o.round !== false && data.length <= 16 }, data.length <= 8 && !(el.clientWidth && el.clientWidth < 460) ? 'both' : 'bar');
    const dd = data.filter(d => d.value > 0);
    if (v === 'bar') body.innerHTML = vbarSvg(data, fmt, tot);
    else if (v === 'donut') body.innerHTML = `<div class="ch-dwrap">${donutSvg(dd, fmt, tot, o.title)}${legend(dd, fmt, tot)}</div>`;
    else body.innerHTML = `<div class="ch-both"><div class="ch-dwrap sm">${donutSvg(dd, fmt, tot, o.title)}</div><div class="ch-bw">${vbarSvg(data, fmt, tot, 360)}</div></div>`;
    Charts.bindTips(body); linkDonut(body, dd, fmt, tot, o.title);
  };
  Charts.vbar = function (el, data, o = {}) { el._ch = el._ch && el._ch.kind === 'vbar' ? el._ch : null; Charts._vbar(el, data, o); };

  // line over time: points pop on hover with a guide line
  Charts.line = function (el, data, { fmt = fmtNum } = {}) {
    if (data.length < 2) return Charts.vbar(el, data, { fmt, round: false });
    el._ch = null; el.classList.add('ch-host');
    const W = 560, H = 236, pl = 56, pb = 34, pt = 14, mx = Math.max(...data.map(d => d.value)) || 1, c = '#3b82f6', g = ++gid, tot = data.reduce((a, d) => a + d.value, 0);
    const x = i => pl + (W - pl - 12) * i / (data.length - 1), y = v => H - pb - (H - pb - pt) * v / mx;
    const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' '), step = Math.ceil(data.length / 8);
    el.innerHTML = `<svg class="chart c2 ln" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="lg${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>
      ${[0, .5, 1].map(t => `<line class="gridline" x1="${pl}" x2="${W}" y1="${y(mx * t)}" y2="${y(mx * t)}"/><text x="${pl - 6}" y="${y(mx * t) + 4}" text-anchor="end">${esc(Charts.short(mx * t))}</text>`).join('')}
      <path d="${path} L${x(data.length - 1)},${H - pb} L${pl},${H - pb} Z" fill="url(#lg${g})"/>
      <path d="${path}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>
      ${data.map((d, i) => { const cc = d.value >= mx * .5 ? '#ef4444' : d.value >= mx * .2 ? '#f97316' : c; return `<g class="it pt" data-tip="${esc(tipHtml(d, cc, fmt, tot))}" style="--c:${cc}"><rect x="${x(i) - (W / data.length) / 2}" y="${pt}" width="${W / data.length}" height="${H - pb - pt}" fill="transparent"/><line class="guide" x1="${x(i)}" x2="${x(i)}" y1="${pt}" y2="${H - pb}"/><circle class="dot ${data.length < 60 || d.value >= mx * .5 ? '' : 'hid'}" cx="${x(i)}" cy="${y(d.value)}" r="${d.value >= mx * .5 ? 4.5 : 3.5}" fill="${cc}" stroke="var(--surface-1)" stroke-width="2"/>${i % step === 0 ? `<text x="${x(i)}" y="${H - pb + 15}" text-anchor="middle">${esc(String(d.label).slice(5, 10) || d.label)}</text>` : ''}</g>`; }).join('')}
      <line x1="${pl}" x2="${W}" y1="${H - pb}" y2="${H - pb}" stroke="var(--grid)"/></svg>`;
    Charts.bindTips(el);
  };
  // stand-alone donut
  Charts.donut = function (el, data, o = {}) { o = { ...o, view: 'donut' }; el._ch = { view: 'donut' }; Charts._hbar(el, data, o); };
})();
