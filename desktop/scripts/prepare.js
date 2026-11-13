/* copies the latest User edition of the tool (and the IFSC list) into desktop/app before packing */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..'), A = path.join(__dirname, '..', 'app');
fs.rmSync(A, { recursive: true, force: true }); fs.mkdirSync(path.join(A, 'data'), { recursive: true });
const u = fs.readFileSync(path.join(R, 'User.html'), 'utf8');
if (!u.includes("const SUD_ED = 'user'") || !u.includes('window.SudDesk')) throw new Error('User.html is not the desktop-ready User edition – rebuild it first');
fs.copyFileSync(path.join(R, 'User.html'), path.join(A, 'User.html'));
fs.copyFileSync(path.join(R, 'data', 'ifsc-data.gz'), path.join(A, 'data', 'ifsc-data.gz'));
fs.copyFileSync(path.join(__dirname, '..', 'activate.html'), path.join(A, 'activate.html'));
fs.copyFileSync(path.join(__dirname, '..', 'build', 'icon.png'), path.join(A, 'emblem.png'));
const idx = fs.readFileSync(path.join(R, 'index.html'), 'utf8'), v = (idx.match(/\?v=(\d{12})/) || [])[1], b = (idx.match(/\(build ([^)]+)\)/) || [])[1];
if (!v) throw new Error('index.html has no build number');
fs.writeFileSync(path.join(A, 'ver.json'), JSON.stringify({ v, build: b || v }));
console.log('desktop/app ready – build', b || v);
