/* publish.js – makes the PUBLIC copy of SudarshanAshtra (scrambled, no source files, no history).
   Usage: node tools/publish.js <outDir>      (run after tools/bundle.py has built Sudarshanastra.html / User.html)
   Needs terser:  npm i --no-save terser@5   (or set TERSER_DIR to a folder whose node_modules has it)
   What goes out: index.html, Sudarshanastra.html, User.html, staff.html, data/, desktop/latest.json, THIRD-PARTY-NOTICES.md
   – every app script is minified and its local names scrambled, comments are removed. Vendor libraries and data blobs stay as they are. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.resolve(process.argv[2] || path.join(ROOT, 'public-build'));
const req = m => { try { return require(m); } catch (e) { return require(path.join(process.env.TERSER_DIR || '', 'node_modules', m)); } };
const { minify } = req('terser');

const VENDOR = /^\s*(\/\*!|\/\*\*\s*\*\s*@licstart|!function|\/\*[^\n]{0,160}(\(MIT\)|Apache-2\.0|license|SheetJS|Tesseract))/i;   // third-party library banners
async function scramble(code) {
  if (code.length > 300e3 || VENDOR.test(code.slice(0, 400))) return code;            // vendor library / big data: leave it
  const r = await minify(code, { ecma: 2020, compress: { passes: 1, keep_fnames: false, drop_debugger: true }, mangle: { toplevel: false }, format: { comments: false, ascii_only: false }, parse: { bare_returns: false } });
  return r.code.replace(/<\/(script)/gi, '<\\/$1');
}
async function page(file) {
  let html = fs.readFileSync(path.join(ROOT, file), 'utf8'), out = '', i = 0, n = 0, kept = 0;
  const re = /<script>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) {
    out += html.slice(i, m.index); let code = m[1];
    const ed = code.match(/^const SUD_ED = '(\w+)';$/m);   // keep this line exactly: the EXE checks for it before it accepts an update
    if (ed) { out += "<script>\nconst SUD_ED = '" + ed[1] + "';\n</script>\n"; code = code.replace(ed[0], ''); }
    try { const s = await scramble(code); if (s === code) kept++; else n++; code = s; } catch (e) { throw new Error(file + ': script near "' + code.slice(0, 80).replace(/\s+/g, ' ') + '" – ' + e.message); }
    out += '<script>' + code + '</script>'; i = m.index + m[0].length;
  }
  out += html.slice(i);
  out = out.replace(/<style>([\s\S]*?)<\/style>/g, (_, c) => '<style>' + c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n+/g, '\n') + '</style>');
  const to = path.join(OUT, file); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, out);
  console.log(file, (html.length / 1e6).toFixed(2), '→', (out.length / 1e6).toFixed(2), 'MB ·', n, 'scripts scrambled ·', kept, 'left as they are');
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of ['Sudarshanastra.html', 'User.html', 'staff.html']) await page(f);
  for (const f of ['index.html', 'THIRD-PARTY-NOTICES.md', 'desktop/latest.json']) { fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f)); }
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'data'))) fs.copyFileSync(path.join(ROOT, 'data', f), path.join(OUT, 'data', f));
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  fs.writeFileSync(path.join(OUT, 'README.md'), '# SudarshanAshtra\n\nSudarshanAshtra – Cyber Crime Analysis & Tracking. This repository only hosts the published tool.\n\n© SudarshanAshtra. All rights reserved.\n');
  console.log('public copy ready in', OUT);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
