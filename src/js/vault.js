/* vault.js – locks all case data kept in this browser with the login password (AES-256-GCM, offline).
   One random data key seals every record. That key is stored only in sealed form: once with the password,
   once with the recovery key. Without one of them the records cannot be read, even from a copy of the browser files. */
'use strict';
class VaultPlain extends Error { }
const Vault = (() => {
  const PLAIN = /^(settings|ofDir|ofBak|ifscdb|casever)$/, IT = 600000, E8 = new TextEncoder(), D8 = new TextDecoder();
  const b64 = u => { let s = ''; const a = new Uint8Array(u); for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode.apply(null, a.subarray(i, i + 32768)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  let openGate, keyIn; const gate = new Promise(r => openGate = r), hasKey = new Promise(r => keyIn = r);
  const V = { key: null, SK: 'sud-vk', ok: () => !!(window.crypto && crypto.subtle) };
  const on = () => !!(S.settings && S.settings.enc);
  const isSealed = r => !!(r && (r.__sv === 1 || r.__sv === 2) && r.ct instanceof ArrayBuffer);

  /* ---- keys ---- */
  const kek = async (pw, salt, it) => crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: it, hash: 'SHA-256' },
    await crypto.subtle.importKey('raw', E8.encode(pw), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const wrap = async pw => { const salt = rnd(16), iv = rnd(12), raw = await crypto.subtle.exportKey('raw', V.key);
    return { s: b64(salt), i: b64(iv), c: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await kek(pw, salt, IT), raw)), it: IT }; };
  const imp = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
  const unwrap = async (pw, w) => { try { return await imp(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(w.i) }, await kek(pw, unb64(w.s), w.it || IT), unb64(w.c))); } catch (e) { return null; } };
  const use = async k => { V.key = k; try { sessionStorage.setItem(V.SK, b64(await crypto.subtle.exportKey('raw', k))); } catch (e) { } openGate(); keyIn(); };

  /* ---- records: JSON plus files / bytes / dates, packed into one buffer ---- */
  // quick look for anything plain JSON cannot hold; most case data has none, so the fast native path is used
  function special(v) {
    const st = [v];
    while (st.length) {
      const o = st.pop(); if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const x = o[i]; if (x && typeof x === 'object') st.push(x); } continue; }
      const p = Object.getPrototypeOf(o);
      if (p !== Object.prototype && p !== null) { if (o instanceof Blob || o instanceof Date || o instanceof ArrayBuffer || ArrayBuffer.isView(o) || o instanceof Map || o instanceof Set) return true; throw new VaultPlain(); }
      for (const k in o) { const x = o[k]; if (x && typeof x === 'object') st.push(x); }
    }
    return false;
  }
  async function pack(v) {
    const parts = []; v = v === undefined ? null : v; const sp = special(v);
    const json = !sp ? JSON.stringify(v) : JSON.stringify(v, function (k, x) {
      const o = this[k];
      if (o instanceof Blob) { parts.push(o); return { '\u0000b': parts.length - 1, n: o.name || '', t: o.type, m: o.lastModified || 0, f: o instanceof File ? 1 : 0 }; }
      if (o instanceof Date) return { '\u0000d': isNaN(o) ? null : o.toISOString() };
      if (o instanceof Map) return { '\u0000m': [...o] };
      if (o instanceof Set) return { '\u0000s': [...o] };
      if (o instanceof ArrayBuffer || ArrayBuffer.isView(o)) { const u = o instanceof ArrayBuffer ? new Uint8Array(o) : new Uint8Array(o.buffer, o.byteOffset, o.byteLength); parts.push(u); return { '\u0000u': parts.length - 1, c: o instanceof ArrayBuffer ? 'ArrayBuffer' : o.constructor.name }; }
      return x;
    });
    const jb = E8.encode(json), hd = new DataView(new ArrayBuffer(12 + 4 * parts.length));
    hd.setUint32(0, jb.length); hd.setUint32(4, parts.length); hd.setUint32(8, sp ? 1 : 0); parts.forEach((p, i) => hd.setUint32(12 + 4 * i, p.size !== undefined ? p.size : p.byteLength));
    return new Blob([hd.buffer, jb, ...parts]).arrayBuffer();
  }
  function unpack(buf, ver) {
    const dv = new DataView(buf), n = dv.getUint32(0), P = dv.getUint32(4), H = ver === 1 ? 8 : 12, sp = ver === 1 ? 1 : dv.getUint32(8); let off = H + 4 * P + n; const at = [];
    for (let i = 0; i < P; i++) { const z = dv.getUint32(H + 4 * i); at.push([off, z]); off += z; }
    const txt = D8.decode(new Uint8Array(buf, H + 4 * P, n)); if (!sp) return JSON.parse(txt);
    const bytes = i => new Uint8Array(buf, at[i][0], at[i][1]).slice();
    return JSON.parse(txt, (k, x) => {
      if (x && typeof x === 'object' && !Array.isArray(x)) {
        if ('\u0000b' in x) { const b = bytes(x['\u0000b']); return x.f ? new File([b], x.n, { type: x.t, lastModified: x.m }) : new Blob([b], { type: x.t }); }
        if ('\u0000u' in x) { const b = bytes(x['\u0000u']); return x.c === 'ArrayBuffer' ? b.buffer : new (window[x.c] || Uint8Array)(b.buffer); }
        if ('\u0000d' in x) return new Date(x['\u0000d']);
        if ('\u0000m' in x) return new Map(x['\u0000m']);
        if ('\u0000s' in x) return new Set(x['\u0000s']);
      }
      return x;
    });
  }
  V.seal = async v => { const iv = rnd(12); return { __sv: 2, iv, ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, V.key, await pack(v)) }; };
  V.unseal = async r => unpack(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: r.iv }, V.key, r.ct), r.__sv);

  /* ---- the database layer: seal on write, open on read ---- */
  const G = DB.get.bind(DB), P = DB.set.bind(DB), D = DB.del.bind(DB), q = new Map();
  const mk = k => on() && typeof k === 'string' && k.startsWith('ocrc:') ? 'ocrc#' + sha256(k.slice(5)) : k;   // OCR cache keys hold file names
  const chain = (k, f) => { const p = (q.get(k) || Promise.resolve()).catch(() => { }).then(f); q.set(k, p); p.finally(() => { if (q.get(k) === p) q.delete(k); }).catch(() => { }); return p; };
  DB.raw = { get: G, set: P, del: D };
  /* per-case summaries saved for next time (common identifiers, work lists…): reused until that case changes,
     so big cases are not read again just to show the Dashboard */
  let VER = null; const ver = async () => VER || (VER = (await G('casever')) || {});
  V.verKey = async () => JSON.stringify(await ver());
  V.sum = async (id, name, tag, fn) => {
    const v = (await ver())[id] || 0, K = 'sum:' + name + ':' + id; let r; try { r = await DB.get(K); } catch (e) { }
    if (r && r.v === v && r.t === tag) return r.d;
    const d = await fn(); DB.set(K, { v, t: tag, d }).catch(() => { }); return d;
  };
  /* big data: case records are kept packed (JSON reads much faster than the browser's own copy),
     and a case already read stays in memory while the browser keeps it (WeakRef) – no second read */
  const BIG = k => typeof k === 'string' && k.startsWith('case:'), isPk = r => !!(r && r.__pk === 2 && r.b instanceof ArrayBuffer), isPj = r => !!(r && r.__pk === 3 && typeof r.j === 'string');
  const C = new Map(), keep = (k, v) => { if (BIG(k) && v && typeof v === 'object' && window.WeakRef) { C.set(k, new WeakRef(v)); V._hold = V._hold || new Map(); V._hold.delete(k); V._hold.set(k, v); while (V._hold.size > 3) V._hold.delete(V._hold.keys().next().value); setTimeout(() => { if (V._hold.get(k) === v) V._hold.delete(k); }, 20000); } return v; };
  DB.get = async k => {
    if (q.has(k)) { try { await q.get(k); } catch (e) { } }
    const w = C.get(k), hit = w && w.deref(); if (hit) return hit;
    const K = mk(k); let r = await G(K); if (r === undefined && K !== k) r = await G(k);
    if (k === 'settings' && !(r && r.enc)) openGate();
    if (isPj(r)) return keep(k, JSON.parse(r.j));
    if (isPk(r)) return keep(k, unpack(r.b, 2));
    if (!isSealed(r)) return r;
    if (!V.key) await hasKey;
    return keep(k, await V.unseal(r));
  };
  DB.set = (k, v) => { C.delete(k); V._hold && V._hold.delete(k); return chain(k, async () => {
    if (BIG(k)) { const m = await ver(); m[k.slice(5)] = (m[k.slice(5)] || 0) + 1; P('casever', m).catch(() => { }); }
    const K = mk(k); if (typeof k === 'string' && PLAIN.test(k)) return P(K, v);
    if (!V.key) await gate;
    if (!V.key || !on()) { if (BIG(k)) { try { return await P(K, { __pk: 2, b: await pack(v) }); } catch (e) { if (!(e instanceof VaultPlain)) throw e; } } return P(K, v); }
    let s; try { s = await V.seal(v); } catch (e) { if (e instanceof VaultPlain) { console.warn('vault: kept unsealed (not plain data)', k); return P(K, v); } throw e; }
    await P(K, s); if (K !== k) await D(k).catch(() => { });
  }); };
  DB.del = k => { C.delete(k); V._hold && V._hold.delete(k); return chain(k, async () => { const K = mk(k); await D(K); if (K !== k) await D(k); }); };

  /* ---- unlock / lock / change password ---- */
  const check = async k => { const c = S.settings.enc.t; if (!c) return true; try { await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(c.i) }, k, unb64(c.c)); return true; } catch (e) { return false; } };
  V.on = on;
  V.resume = async () => {   // page refresh while signed in
    if (!on()) return true; if (V.key) return true;
    try { const s = sessionStorage.getItem(V.SK); if (!s) return false; const k = await imp(unb64(s)); if (!(await check(k))) return false; await use(k); return true; } catch (e) { return false; }
  };
  V.unlock = async pw => { if (!on()) return true; const k = await unwrap(pw, S.settings.enc.p); if (!k) return false; await use(k); return true; };
  V.fromRec = async rk => { const w = on() && S.settings.enc.r; if (!w) return false; const k = await unwrap(rk, w); if (!k) return false; await use(k); return true; };
  V.rewrap = async pw => { S.settings.enc.p = await wrap(pw); };
  V.wrapRec = async rk => { if (on() && V.key) S.settings.enc.r = await wrap(rk); };
  V.forget = () => { try { sessionStorage.removeItem(V.SK); } catch (e) { } };
  V.enable = async (pw, prog) => {
    if (on()) return 0; if (!V.ok()) throw new Error('This browser cannot lock data. Use Google Chrome or Microsoft Edge.');
    const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']); V.key = k;
    const iv = rnd(12), t = { i: b64(iv), c: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, E8.encode('SudarshanAshtra'))) };
    S.settings.enc = { v: 1, when: new Date().toISOString(), p: await wrap(pw), t };
    await P('settings', S.settings); await use(k);
    const keys = (await DB.keys()).filter(x => typeof x === 'string' && !PLAIN.test(x) && !x.startsWith('ocrc#')); let n = 0, i = 0;
    for (const x of keys) { i++; let r = await G(x); if (isPk(r)) r = unpack(r.b, 2); else if (isPj(r)) r = JSON.parse(r.j); if (r !== undefined && !isSealed(r)) { await DB.set(x, r); n++; } if (prog && i % 10 === 0) prog(i, keys.length); }
    return n;
  };
  /* remove the lock: every record is opened and written back as plain data */
  V.disable = async (pw, prog) => {
    if (!on()) return 0; const k = await unwrap(pw, S.settings.enc.p); if (!k) throw new Error('Password is wrong');
    V.key = k; const keys = (await DB.keys()).filter(x => typeof x === 'string'); let n = 0, i = 0;
    const open1 = async x => { const r = await G(x); if (isSealed(r)) { if (x.startsWith('ocrc#')) await D(x); else { const v = await V.unseal(r); let b = null; if (BIG(x)) try { b = await pack(v); } catch (e) { } await P(x, b ? { __pk: 2, b } : v); n++; } } };
    for (const x of keys) { i++; await open1(x); if (prog && i % 10 === 0) prog(i, keys.length); }
    const E = S.settings.enc; delete S.settings.enc;   // from here on new saves are plain
    try { for (const x of (await DB.keys()).filter(x => typeof x === 'string')) await open1(x); await Promise.all([...q.values()].map(p => p.catch(() => { }))); for (const x of [...q.keys()]) await open1(x); }
    catch (e) { S.settings.enc = E; throw e; }
    await P('settings', S.settings); V.forget(); return n;
  };
  return V;
})();
