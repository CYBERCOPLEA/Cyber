/* vault.js – locks all case data kept in this browser with the login password (AES-256-GCM, offline).
   One random data key seals every record. That key is stored only in sealed form: once with the password,
   once with the recovery key. Without one of them the records cannot be read, even from a copy of the browser files. */
'use strict';
class VaultPlain extends Error { }
const Vault = (() => {
  const PLAIN = /^(settings|ofDir|ofBak|ifscdb)$/, IT = 600000, E8 = new TextEncoder(), D8 = new TextDecoder();
  const b64 = u => { let s = ''; const a = new Uint8Array(u); for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode.apply(null, a.subarray(i, i + 32768)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  let openGate, keyIn; const gate = new Promise(r => openGate = r), hasKey = new Promise(r => keyIn = r);
  const V = { key: null, SK: 'sud-vk', ok: () => !!(window.crypto && crypto.subtle) };
  const on = () => !!(S.settings && S.settings.enc);
  const isSealed = r => !!(r && r.__sv === 1 && r.ct instanceof ArrayBuffer);

  /* ---- keys ---- */
  const kek = async (pw, salt, it) => crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: it, hash: 'SHA-256' },
    await crypto.subtle.importKey('raw', E8.encode(pw), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const wrap = async pw => { const salt = rnd(16), iv = rnd(12), raw = await crypto.subtle.exportKey('raw', V.key);
    return { s: b64(salt), i: b64(iv), c: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await kek(pw, salt, IT), raw)), it: IT }; };
  const imp = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
  const unwrap = async (pw, w) => { try { return await imp(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(w.i) }, await kek(pw, unb64(w.s), w.it || IT), unb64(w.c))); } catch (e) { return null; } };
  const use = async k => { V.key = k; try { sessionStorage.setItem(V.SK, b64(await crypto.subtle.exportKey('raw', k))); } catch (e) { } openGate(); keyIn(); };

  /* ---- records: JSON plus files / bytes / dates, packed into one buffer ---- */
  async function pack(v) {
    const parts = [];
    const json = JSON.stringify(v === undefined ? null : v, function (k, x) {
      const o = this[k];
      if (o instanceof Blob) { parts.push(o); return { '\u0000b': parts.length - 1, n: o.name || '', t: o.type, m: o.lastModified || 0, f: o instanceof File ? 1 : 0 }; }
      if (o instanceof Date) return { '\u0000d': isNaN(o) ? null : o.toISOString() };
      if (o instanceof ArrayBuffer || ArrayBuffer.isView(o)) { const u = o instanceof ArrayBuffer ? new Uint8Array(o) : new Uint8Array(o.buffer, o.byteOffset, o.byteLength); parts.push(u); return { '\u0000u': parts.length - 1, c: o instanceof ArrayBuffer ? 'ArrayBuffer' : o.constructor.name }; }
      if (o && typeof o === 'object') { const p = Object.getPrototypeOf(o); if (p !== Object.prototype && p !== Array.prototype && p !== null) throw new VaultPlain(); }
      return x;
    });
    const jb = E8.encode(json), hd = new DataView(new ArrayBuffer(8 + 4 * parts.length));
    hd.setUint32(0, jb.length); hd.setUint32(4, parts.length); parts.forEach((p, i) => hd.setUint32(8 + 4 * i, p.size !== undefined ? p.size : p.byteLength));
    return new Blob([hd.buffer, jb, ...parts]).arrayBuffer();
  }
  function unpack(buf) {
    const dv = new DataView(buf), n = dv.getUint32(0), P = dv.getUint32(4); let off = 8 + 4 * P + n; const at = [];
    for (let i = 0; i < P; i++) { const z = dv.getUint32(8 + 4 * i); at.push([off, z]); off += z; }
    const bytes = i => new Uint8Array(buf, at[i][0], at[i][1]).slice();
    return JSON.parse(D8.decode(new Uint8Array(buf, 8 + 4 * P, n)), (k, x) => {
      if (x && typeof x === 'object' && !Array.isArray(x)) {
        if ('\u0000b' in x) { const b = bytes(x['\u0000b']); return x.f ? new File([b], x.n, { type: x.t, lastModified: x.m }) : new Blob([b], { type: x.t }); }
        if ('\u0000u' in x) { const b = bytes(x['\u0000u']); return x.c === 'ArrayBuffer' ? b.buffer : new (window[x.c] || Uint8Array)(b.buffer); }
        if ('\u0000d' in x) return new Date(x['\u0000d']);
      }
      return x;
    });
  }
  V.seal = async v => { const iv = rnd(12); return { __sv: 1, iv, ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, V.key, await pack(v)) }; };
  V.unseal = async r => unpack(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: r.iv }, V.key, r.ct));

  /* ---- the database layer: seal on write, open on read ---- */
  const G = DB.get.bind(DB), P = DB.set.bind(DB), D = DB.del.bind(DB), q = new Map();
  const mk = k => on() && typeof k === 'string' && k.startsWith('ocrc:') ? 'ocrc#' + sha256(k.slice(5)) : k;   // OCR cache keys hold file names
  const chain = (k, f) => { const p = (q.get(k) || Promise.resolve()).catch(() => { }).then(f); q.set(k, p); p.finally(() => { if (q.get(k) === p) q.delete(k); }).catch(() => { }); return p; };
  DB.raw = { get: G, set: P, del: D };
  DB.get = async k => {
    if (q.has(k)) { try { await q.get(k); } catch (e) { } }
    const K = mk(k); let r = await G(K); if (r === undefined && K !== k) r = await G(k);
    if (k === 'settings' && !(r && r.enc)) openGate();
    if (!isSealed(r)) return r;
    if (!V.key) await hasKey;
    return V.unseal(r);
  };
  DB.set = (k, v) => chain(k, async () => {
    const K = mk(k); if (typeof k === 'string' && PLAIN.test(k)) return P(K, v);
    if (!V.key) await gate;
    if (!V.key) return P(K, v);
    let s; try { s = await V.seal(v); } catch (e) { if (e instanceof VaultPlain) { console.warn('vault: kept unsealed (not plain data)', k); return P(K, v); } throw e; }
    await P(K, s); if (K !== k) await D(k).catch(() => { });
  });
  DB.del = k => chain(k, async () => { const K = mk(k); await D(K); if (K !== k) await D(k); });

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
    for (const x of keys) { i++; const r = await G(x); if (r !== undefined && !isSealed(r)) { await DB.set(x, r); n++; } if (prog && i % 10 === 0) prog(i, keys.length); }
    return n;
  };
  return V;
})();
