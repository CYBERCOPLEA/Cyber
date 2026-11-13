/* SudarshanAshtra Desktop – Windows EXE shell (Electron).
   - Opens the User edition of SudarshanAshtra fully offline (bundled copy, or the newer copy fetched by ⬆ Update).
   - Licence: signed by the Super Admin (Ed25519), locked to this computer's Machine ID, valid from / to a date.
     Only the public key is here – nobody can make or change a licence without the Super Admin key file.
   - When online: asks the Super Admin's Google Sheet whether the licence is still active (Suspend / Delete / Extend),
     and checks the GitHub site for a newer build (⬆ Update). Case data never leaves this computer. */
'use strict';
const { app, BrowserWindow, protocol, ipcMain, shell, net, Menu } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process'), { pathToFileURL } = require('url');

const PUB = '2354206a5a6b00597cd19f967725427f1535fd7b83a93370418a28525ec769c9';
const SITE = process.env.SUD_SITE || 'https://cybercoplea.github.io/SudarshanAshtra/';
const SHELL = app.getVersion();
const BUN = path.join(__dirname, 'app');
let UD, LIC_F, UPD_D, MID, RAW, win = null;

protocol.registerSchemesAsPrivileged([{ scheme: 'sud', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

/* ---------- this computer ---------- */
function rawMachine() {
  if (process.env.SUD_TEST_MACHINE) return process.env.SUD_TEST_MACHINE;
  try {
    if (process.platform === 'win32') {
      const reg = path.join(process.env.windir || process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
      const out = execFileSync(reg, ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], { encoding: 'utf8', windowsHide: true });
      const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i); if (m) return m[1];
    } else if (process.platform === 'darwin') {
      const m = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8' }).match(/"IOPlatformUUID" = "([^"]+)"/); if (m) return m[1];
    } else for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) { try { const t = fs.readFileSync(f, 'utf8').trim(); if (t) return t; } catch (e) { } }
  } catch (e) { }
  return os.hostname();
}
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function midOf(raw) {
  const h = crypto.createHash('sha256').update('SUD-MID|' + String(raw).toLowerCase()).digest(); let bits = '', s = '';
  for (const b of h.subarray(0, 10)) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i < 16; i++) s += B32[parseInt(bits.slice(i * 5, i * 5 + 5), 2)];
  return 'SA-' + s.match(/.{4}/g).join('-');
}

/* ---------- licence ---------- */
const PUBKEY = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(PUB, 'hex')]), format: 'der', type: 'spki' });
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
function parseKey(key) {
  const m = String(key || '').replace(/\s+/g, '').match(/SADL1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/); if (!m) return null;
  try { if (!crypto.verify(null, Buffer.from(m[1]), PUBKEY, unb64u(m[2]))) return null; const p = JSON.parse(unb64u(m[1]).toString('utf8')); if (p.v !== 1 || !p.lid || !p.mid) return null; p._key = 'SADL1.' + m[1] + '.' + m[2]; return p; } catch (e) { return null; }
}
const istToday = (t = Date.now()) => new Date(t + 5.5 * 3600e3).toISOString().slice(0, 10);
const macKey = () => crypto.createHash('sha256').update('SUD-ST|' + RAW + '|' + PUB).digest();
const mac = o => crypto.createHmac('sha256', macKey()).update(JSON.stringify({ key: o.key, st: o.st })).digest('hex');
function load() {
  try { const o = JSON.parse(fs.readFileSync(LIC_F, 'utf8')); if (!o || !o.key) return null; o.st = o.st || {}; o.bad = o.mac !== mac(o); return o; } catch (e) { return null; }
}
function save(o) { const x = { key: o.key, st: o.st || {} }; x.mac = mac(x); fs.mkdirSync(path.dirname(LIC_F), { recursive: true }); fs.writeFileSync(LIC_F + '.tmp', JSON.stringify(x)); fs.renameSync(LIC_F + '.tmp', LIC_F); }
/* is this computer allowed to open the tool now? */
function check(touch = true) {
  const f = load(); if (!f) return { ok: false, why: 'none' };
  if (f.bad) return { ok: false, why: 'tamper' };
  const p = parseKey(f.key); if (!p) return { ok: false, why: 'invalid' };
  if (p.mid !== MID) return { ok: false, why: 'machine', p };
  const now = Date.now(), st = f.st;
  if (st.last && now < st.last - 6 * 3600e3) return { ok: false, why: 'clock', p, last: st.last };
  if (st.block) return { ok: false, why: st.block.st, p, at: st.block.at };
  const t = istToday(); if (t < p.from) return { ok: false, why: 'notyet', p }; if (t > p.to) return { ok: false, why: 'expired', p };
  if (touch && (!st.last || now > st.last + 60e3)) { st.last = Math.max(st.last || 0, now); save(f); }
  return { ok: true, p, st };
}
function setLicence(key) {
  const p = parseKey(key); if (!p) return { ok: false, err: 'This is not a valid SudarshanAshtra licence key. Copy the whole key again (it starts with SADL1.).' };
  if (p.mid !== MID) return { ok: false, err: `This key is for another computer (${p.mid}). This computer is ${MID}. Ask the Super Admin for a key for this computer.` };
  if (istToday() > p.to) return { ok: false, err: 'This licence ended on ' + p.to.split('-').reverse().join('-') + '. Ask the Super Admin to extend it.' };
  const old = load(), st = {};
  if (old && !old.bad) { const q = parseKey(old.key); if (q && q.lid === p.lid) { if (p.seq < q.seq) return { ok: false, err: 'This is an older key. You already have a newer one (issue #' + q.seq + ').' }; st.last = old.st.last; if (old.st.block && p.seq <= (old.st.block.seq || 0)) st.block = old.st.block; st.chk = old.st.chk; } }
  st.last = Math.max(st.last || 0, Date.now());
  save({ key: p._key, st });
  return { ok: true, lid: p.lid };
}
/* ---------- online check with the Super Admin's Google Sheet (only licence ID + Machine ID are sent) ---------- */
async function online() {
  const f = load(); const p = f && !f.bad && parseKey(f.key);
  if (!p) return { ok: false, msg: 'No licence on this computer yet.' };
  if (!p.u) return { ok: true, msg: '✔ Licence is fine (this licence is checked offline only).' };
  let r;
  try {
    const res = await net.fetch(p.u, { method: 'POST', body: JSON.stringify({ fn: 'lchk', lid: p.lid, mid: MID, seq: p.seq, build: cur().build }), headers: { 'Content-Type': 'text/plain' } });
    const j = JSON.parse(await res.text()); if (!j.ok) throw new Error(j.err || 'no answer'); r = j.r;
  } catch (e) { return { ok: false, msg: /Unknown request/.test(String(e.message)) ? '✔ Licence is fine (the Super Admin’s online check is not set up yet).' : 'No internet – could not check now. The tool keeps working offline.' }; }
  const st = f.st; st.chk = Date.now();
  const srv = Date.parse(r.now || ''); if (srv) st.last = srv;   // the Super Admin's server time is trusted over this computer's clock
  if (r.st === 'Suspended' || r.st === 'Deleted' || r.st === 'moved') { st.block = { st: r.st, at: Date.now(), seq: p.seq }; save(f); return { ok: false, reload: true, msg: r.st === 'Suspended' ? '⏸ Your licence has been suspended by the Super Admin.' : r.st === 'moved' ? 'Your licence was moved to another computer by the Super Admin.' : '🗑 Your licence has been deleted by the Super Admin.' }; }
  let reload = false;
  if (r.st === 'Active' && st.block) { delete st.block; reload = true; }
  if (r.lic) { const q = parseKey(r.lic); if (q && q.lid === p.lid && q.mid === MID && q.seq > p.seq) { f.key = q._key; reload = true; save(f); return { ok: true, reload, msg: '✔ The Super Admin changed your licence – valid till ' + q.to.split('-').reverse().join('-') + '.' }; } }
  save(f);
  return { ok: true, reload, msg: reload ? '✔ Your licence is active again.' : '✔ Licence is fine.' };
}
/* ---------- licence request sent online to the Super Admin's 🔔 inbox (only the details the user typed + Machine ID – never case data) ---------- */
const GS_RE = /^https:\/\/script\.google(usercontent)?\.com\/\S+$/;
const okInbox = u => GS_RE.test(u || '') || (!app.isPackaged && /^http:\/\/127\.0\.0\.1:\d+\//.test(u || ''));   // 127.0.0.1 only for tests of the unpacked app
async function inboxUrl() {
  const cf = path.join(UD, 'inbox.json');
  try { const j = JSON.parse(await getText(SITE + 'desktop/latest.json?t=' + Date.now())); if (okInbox(j.req)) { try { fs.writeFileSync(cf, JSON.stringify({ u: j.req })); } catch (e) { } return j.req; } } catch (e) { }
  try { const u = JSON.parse(fs.readFileSync(cf, 'utf8')).u; if (okInbox(u)) return u; } catch (e) { }
  const f = load(); const p = f && !f.bad && parseKey(f.key); return p && okInbox(p.u) ? p.u : '';
}
async function sendReq(o) {
  o = o || {}; const r = { mid: MID };
  ['n', 'rk', 'ps', 'dist', 'st', 'mob'].forEach(k => { r[k] = String(o[k] || '').replace(/\s+/g, ' ').trim().slice(0, 80); });
  if (!r.n) return { ok: false, msg: 'Fill your name first' };
  const u = await inboxUrl();
  if (!u) return { ok: false, msg: 'Could not reach the Super Admin online (no internet?). Use “Copy Request Code” or “Send On WhatsApp” instead.' };
  try {
    const res = await net.fetch(u, { method: 'POST', body: JSON.stringify({ fn: 'lreq', r, code: String(o.code || '').slice(0, 2000), build: cur().build + ' / setup ' + SHELL }), headers: { 'Content-Type': 'text/plain' } });
    const j = JSON.parse(await res.text()); if (!j.ok) throw new Error(j.err || 'no answer');
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: /Unknown request/.test(String(e.message)) ? 'The Super Admin’s online inbox is not switched on yet. Use “Copy Request Code” or “Send On WhatsApp” instead.' : /Too many|Machine ID|Name/.test(String(e.message)) ? String(e.message) : 'Could not reach the Super Admin online (no internet?). Use “Copy Request Code” or “Send On WhatsApp” instead.' };
  }
}
/* ---------- the tool itself: bundled copy or a newer copy from ⬆ Update ---------- */
function verOf(d) { try { return JSON.parse(fs.readFileSync(path.join(d, 'ver.json'), 'utf8')); } catch (e) { return null; } }
function cur() { const b = verOf(BUN) || { v: '0', build: '?' }, u = verOf(UPD_D); return u && u.v > b.v && fs.existsSync(path.join(UPD_D, 'User.html')) ? Object.assign({ dir: UPD_D }, u) : Object.assign({ dir: BUN }, b); }
const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
async function getText(u) { const r = await net.fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }
async function checkUpdate() {
  let t; try { t = await getText(SITE + 'index.html?t=' + Date.now()); } catch (e) { return { err: 'No internet – could not reach the SudarshanAshtra site.' }; }
  const m = t.match(/\?v=(\d{12})/), b = t.match(/\(build ([^)]+)\)/), c = cur(); if (!m) return { err: 'The site did not answer properly. Try again later.' };
  const o = { cur: c.build, latest: b ? b[1] : m[1], v: m[1], newer: m[1] > c.v, mb: 14 };
  try { const j = JSON.parse(await getText(SITE + 'desktop/latest.json?t=' + Date.now())); if (j.shell && cmpVer(j.shell, SHELL) > 0) { o.shellNew = j.shell; o.shellUrl = j.url || 'https://drive.google.com/file/d/1n601SQf1vr2OmqlduABBrDc88Rcmvjjk/view?usp=sharing'; } } catch (e) { }
  return o;
}
async function applyUpdate() {
  const r = await checkUpdate(); if (r.err) return { ok: false, err: r.err }; if (!r.newer) return { ok: true, same: 1 };
  let buf; try { const res = await net.fetch(SITE + 'User.html?v=' + r.v, { cache: 'no-store' }); if (!res.ok) throw new Error('HTTP ' + res.status); buf = Buffer.from(await res.arrayBuffer()); } catch (e) { return { ok: false, err: 'Download failed (' + e.message + '). Try again.' }; }
  const s = buf.toString('utf8');
  if (buf.length < 2e6 || !s.includes("const SUD_ED = 'user'") || !s.includes('window.SudDesk') || !s.includes('SudarshanAshtra')) return { ok: false, err: 'The downloaded file is not a complete SudarshanAshtra build. Try again later.' };
  fs.mkdirSync(UPD_D, { recursive: true });
  fs.writeFileSync(path.join(UPD_D, 'User.html.tmp'), buf); fs.renameSync(path.join(UPD_D, 'User.html.tmp'), path.join(UPD_D, 'User.html'));
  fs.writeFileSync(path.join(UPD_D, 'ver.json'), JSON.stringify({ v: r.v, build: r.latest, at: new Date().toISOString() }));
  return { ok: true, build: r.latest };
}
/* ---------- window ---------- */
function info() {
  const c = check(false), p = c.p ? Object.assign({}, c.p) : null; if (p) delete p._key;
  return { mid: MID, shell: SHELL, build: cur().build, ok: c.ok, why: c.why || '', lic: c.ok ? p : null, plic: p, state: c.st ? { chk: c.st.chk || 0 } : {} };
}
function serve(req) {
  const u = new URL(req.url); let p = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'User.html', file;
  if (p === 'User.html' || p === 'index.html') { if (!check().ok) file = path.join(BUN, 'activate.html'); else file = path.join(cur().dir, 'User.html'); }
  else { file = path.normalize(path.join(BUN, p)); if (!file.startsWith(BUN + path.sep)) return new Response('Not found', { status: 404 }); if (!fs.existsSync(file)) return new Response('Not found', { status: 404 }); }
  return net.fetch(pathToFileURL(file).toString());
}
function createWindow() {
  win = new BrowserWindow({ width: 1366, height: 820, show: false, autoHideMenuBar: true, backgroundColor: '#0b1220', title: 'SudarshanAshtra', icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, devTools: !app.isPackaged || !!process.env.SUD_DEV } });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:|^tel:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } } };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('sud://')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
  win.loadURL('sud://app/User.html');
}
function wire() {
  ipcMain.on('desk:init', e => { e.returnValue = info(); });
  ipcMain.handle('desk:setLicence', async (e, key) => { const r = setLicence(key); if (r.ok) { const o = await online(); if (o.reload && !check(false).ok) return { ok: false, err: o.msg, saved: 1 }; } return r; });
  ipcMain.handle('desk:checkOnline', () => online());
  ipcMain.handle('desk:sendReq', (e, o) => sendReq(o));
  ipcMain.handle('desk:checkUpdate', () => checkUpdate());
  ipcMain.handle('desk:applyUpdate', () => applyUpdate());
  ipcMain.handle('desk:open', (e, url) => { if (/^https:\/\//i.test(String(url))) shell.openExternal(String(url)); });
  ipcMain.handle('desk:start', () => { if (win) win.loadURL('sud://app/User.html'); });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    UD = app.getPath('userData'); LIC_F = path.join(UD, 'licence.json'); UPD_D = path.join(UD, 'app'); RAW = rawMachine(); MID = midOf(RAW);
    Menu.setApplicationMenu(null);
    protocol.handle('sud', serve);
    wire(); createWindow();
    /* online licence check soon after start and every 6 hours; licence re-checked every 15 minutes */
    const on = async () => { const r = await online(); if (r.reload && win) win.reload(); };
    setTimeout(on, 20e3); setInterval(on, 6 * 3600e3);
    setInterval(() => { const c = check(); if (!c.ok && win && /User\.html/.test(win.webContents.getURL())) win.reload(); }, 15 * 60e3);
  });
  app.on('window-all-closed', () => app.quit());
}
