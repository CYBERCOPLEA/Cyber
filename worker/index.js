/* SudarshanAshtra – Cloudflare door (Worker in front of the tool's files).
   Users sign in with the SAME User ID + password the Super Admin gives them in the tool's Super Admin Control page.
   The door checks them against the Super Admin's own Google Sheet script (fn 'ulogin'), so users are managed only in the tool.
   The Super Admin page (Sudarshanastra.html) is guarded by Cloudflare Access (e-mail code) and checked again here.
   No case data passes through here – only the login check.
   Settings (Cloudflare › Worker › Settings › Variables and Secrets):
     APPS_SCRIPT_URL  (Secret, required)  – the Google script Web app address ending in /exec
     ACCESS_TEAM      (optional)          – Cloudflare Zero Trust team name, default 'sudarshanashtrauser'
     ADMIN_EMAILS     (optional)          – comma list; when set, only these Access e-mails count as Super Admin */
'use strict';

const PUBLIC = new Set(['/staff.html', '/robots.txt', '/favicon.ico']);
/* the Super Admin page, whatever way its address is written (/Sudarshanastra, /sudarshanastra.HTML/, %2E …) */
function isAdmin(p) { let x = p; try { x = decodeURIComponent(p); } catch (e) { return true; } x = x.toLowerCase().replace(/\/{2,}/g, '/').replace(/\/+$/, '').replace(/\.html?$/, ''); return x === '/sudarshanastra' || x === '/sudarshanastra/index'; }
const DAY = 864e5, GATE_HOURS = 12;
const enc = new TextEncoder();

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); const b = atob(s + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function cookie(req, name) { const m = (req.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)')); return m ? m[1] : ''; }
const scriptOk = u => /^https:\/\/script\.google\.com\/(a\/[\w.-]+\/)?macros\/s\/[\w-]+\/exec$/.test(String(u || '').trim());

/* ---------- Super Admin: Cloudflare Access token ---------- */
let certs = null, certsAt = 0;
async function accessEmail(req, env) {
  const tok = req.headers.get('Cf-Access-Jwt-Assertion') || cookie(req, 'CF_Authorization');
  if (!tok) return '';
  try {
    const [h, p, s] = tok.split('.'); if (!s) return '';
    const head = JSON.parse(new TextDecoder().decode(unb64u(h))), pay = JSON.parse(new TextDecoder().decode(unb64u(p)));
    const iss = 'https://' + (env.ACCESS_TEAM || 'sudarshanashtrauser') + '.cloudflareaccess.com';
    if (pay.iss !== iss || !pay.exp || pay.exp * 1000 < Date.now() || head.alg !== 'RS256') return '';
    if (!certs || Date.now() - certsAt > 36e5) { const r = await fetch(iss + '/cdn-cgi/access/certs'); if (!r.ok) return ''; certs = (await r.json()).keys || []; certsAt = Date.now(); }
    const jwk = certs.find(k => k.kid === head.kid); if (!jwk) { certsAt = 0; return ''; }
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(h + '.' + p)))) return '';
    const email = String(pay.email || '').toLowerCase(); if (!email) return '';
    const allow = String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
    return !allow.length || allow.includes(email) ? email : '';
  } catch (e) { return ''; }
}

/* ---------- Users: signed door ticket (cookie) ---------- */
async function hkey(env) { return crypto.subtle.importKey('raw', enc.encode('sa-gate-v1|' + String(env.GATE_SECRET || env.APPS_SCRIPT_URL || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
async function ticket(env, id) {
  const body = b64u(enc.encode(JSON.stringify({ i: id, e: Date.now() + GATE_HOURS * 36e5 })));
  return body + '.' + b64u(await crypto.subtle.sign('HMAC', await hkey(env), enc.encode(body)));
}
async function ticketOk(req, env) {
  if (!scriptOk(env.APPS_SCRIPT_URL)) return null;
  const t = cookie(req, 'sa_gate'), [body, sig] = t.split('.'); if (!sig) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hkey(env), unb64u(sig), enc.encode(body)))) return null;
    const o = JSON.parse(new TextDecoder().decode(unb64u(body))); return o.e > Date.now() ? o : null;
  } catch (e) { return null; }
}

/* ---------- pages ---------- */
const safeNext = n => (typeof n === 'string' && /^\/[\w.\-\/]*(\?[\w=&.%-]*)?$/.test(n) && !n.startsWith('//') && !isAdmin(n.split('?')[0])) ? n : '/User.html';
const H = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' };
function page(title, inner, status = 200, extra = {}) {
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(title)}</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:15px/1.45 "Segoe UI",Arial,sans-serif;background:radial-gradient(circle at 30% 20%,#1e3a8a 0,#0b1226 55%,#050914 100%);color:#e2e8f0;padding:18px}
.c{width:100%;max-width:400px;background:rgba(15,23,42,.92);border:1px solid #334155;border-radius:16px;padding:26px 24px;box-shadow:0 20px 50px rgba(0,0,0,.45)}
.b{font-weight:800;font-size:22px;letter-spacing:.3px}.b span{color:#f59e0b}.s{font-size:11px;letter-spacing:2px;color:#94a3b8;margin:2px 0 18px}
label{display:block;font-size:13px;color:#cbd5e1;margin:12px 0 4px}input{width:100%;padding:11px 12px;border-radius:9px;border:1px solid #475569;background:#0f172a;color:#f8fafc;font-size:15px}
input:focus{outline:2px solid #f59e0b;border-color:transparent}button{width:100%;margin-top:18px;padding:12px;border:0;border-radius:9px;background:linear-gradient(90deg,#f59e0b,#ea580c);color:#111;font-weight:700;font-size:15px;cursor:pointer}
.e{background:#7f1d1d;border:1px solid #dc2626;color:#fee2e2;border-radius:8px;padding:9px 11px;margin-top:12px;font-size:13px}.n{font-size:12px;color:#94a3b8;margin-top:14px}.r{margin-top:16px;font-size:11px;color:#fca5a5;text-align:center}a{color:#fbbf24}</style></head>
<body><div class="c"><div class="b">SudarshanAshtra <span>सुदर्शनास्त्र</span></div><div class="s">CYBER CRIME ANALYSIS &amp; TRACKING</div>${inner}
<div class="r">🔒 Restricted access · Police personnel only</div></div></body></html>`, { status, headers: Object.assign({}, H, extra) });
}
function gateForm(next, err) {
  return page('Sign in – SudarshanAshtra', `<form method="post" action="/gate" id="f" autocomplete="on"><input type="hidden" name="next" value="${esc(next)}"><input type="hidden" name="h" id="h">
<label for="i">User ID</label><input id="i" name="id" required autocomplete="username" autofocus>
<label for="p">Password</label><input id="p" name="pw" type="password" required autocomplete="current-password">
${err ? `<div class="e">${esc(err)}</div>` : ''}<button type="submit">Open SudarshanAshtra</button></form>
<div class="n">Use the <b>User ID</b> and <b>password</b> given by the SudarshanAshtra Super Admin. Forgot it? Ask the SudarshanAshtra Super Admin to reset it.</div>
<script>document.getElementById('h').value=location.hash.slice(0,600)</script>`, err ? 401 : 200);
}

async function doLogin(req, env) {
  const f = await req.formData(), id = String(f.get('id') || '').trim().slice(0, 60), pw = String(f.get('pw') || '').slice(0, 200);
  const next = safeNext(String(f.get('next') || '')), hash = /^#[\w=.\-&%]*$/.test(String(f.get('h') || '')) ? String(f.get('h')) : '';
  if (!scriptOk(env.APPS_SCRIPT_URL)) return gateForm(next, 'Sign-in is not set up yet. The Super Admin must add the Google script address in Cloudflare.');
  if (!id || !pw) return gateForm(next, 'Enter your User ID and password.');
  let j;
  try {
    const r = await fetch(env.APPS_SCRIPT_URL.trim(), { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ fn: 'ulogin', id, pw, dev: 'Cloudflare door · ' + (req.headers.get('User-Agent') || '').slice(0, 80) }) });
    j = JSON.parse(await r.text());
  } catch (e) { return gateForm(next, 'Could not reach the Super Admin\'s server. Try again in a minute.'); }
  if (!j || !j.ok) return gateForm(next, (j && j.err) || 'Wrong User ID or password.');
  const r = j.r || {};
  if (r.off) return gateForm(next, '⛔ Your access has been switched off by the Super Admin. Contact the SudarshanAshtra Super Admin.');
  if (!r.tok || !r.user) return gateForm(next, 'Wrong User ID or password.');
  const t = await ticket(env, r.user.id);
  /* hand the fresh login to the tool in this tab, so it can skip asking again (read once by User.html) */
  const hand = JSON.stringify({ id: r.user.id, tok: r.tok, user: r.user, temp: r.temp ? 1 : 0, url: env.APPS_SCRIPT_URL.trim(), at: Date.now() }).replace(/</g, '\\u003c');
  return new Response(`<!DOCTYPE html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Opening…</title><body style="background:#0b1226;color:#e2e8f0;font-family:Arial;padding:40px">Opening SudarshanAshtra…
<script>try{sessionStorage.setItem('sa_gate',JSON.stringify(${hand}))}catch(e){}location.replace(${JSON.stringify(next + hash)})</script></body>`,
    { headers: Object.assign({}, H, { 'Set-Cookie': `sa_gate=${t}; Path=/; Max-Age=${GATE_HOURS * 3600}; HttpOnly; Secure; SameSite=Lax` }) });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname;
    if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
    if (path === '/gate' && req.method === 'POST') return doLogin(req, env);
    if (path === '/gate') { if (await ticketOk(req, env)) return Response.redirect(url.origin + safeNext(url.searchParams.get('next')), 302); return gateForm(safeNext(url.searchParams.get('next')), ''); }
    if (path === '/gate/out') return new Response(null, { status: 302, headers: { Location: '/gate', 'Set-Cookie': 'sa_gate=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax', 'Cache-Control': 'no-store' } });
    if (PUBLIC.has(path)) return env.ASSETS.fetch(req);

    const admin = await accessEmail(req, env);
    if (path === '/' || path === '/index.html') return Response.redirect(url.origin + (admin ? '/Sudarshanastra.html' : '/User.html'), 302);
    if (isAdmin(path)) {
      if (!admin) return page('Super Admin only', `<p><b>This page is for the Super Admin only.</b></p><p class="n">Officers: open <a href="/User.html">the User page</a> and sign in with your User ID and password.</p>`, 403);
      return env.ASSETS.fetch(req);
    }
    if (admin || await ticketOk(req, env)) {
      const res = await env.ASSETS.fetch(req), h = new Headers(res.headers);
      h.set('Cache-Control', 'private, no-cache'); h.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    }
    if (req.method === 'GET' && /\.html?$/.test(path) || path.endsWith('/')) return Response.redirect(url.origin + '/gate?next=' + encodeURIComponent(path + url.search), 302);
    return new Response('Sign in first', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
};
