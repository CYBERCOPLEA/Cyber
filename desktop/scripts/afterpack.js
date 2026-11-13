/* sets the SudarshanAshtra icon and name inside SudarshanAshtra.exe (works on Linux too – no Wine needed) */
'use strict';
const fs = require('fs'), path = require('path');
module.exports = async ctx => {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = require('resedit');
  const exe = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.exe');
  const data = fs.readFileSync(exe);
  const ex = ResEdit.NtExecutable.from(data, { ignoreCert: true }); const rs = ResEdit.NtExecutableResource.from(ex);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.ico')));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(rs.entries, 1, 1033, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(rs.entries)[0]; const ver = ctx.packager.appInfo.version.split('.').map(Number);
  if (vi) {
    vi.setFileVersion(ver[0], ver[1], ver[2], 0, 1033); vi.setProductVersion(ver[0], ver[1], ver[2], 0, 1033);
    vi.setStringValues({ lang: 1033, codepage: 1200 }, { FileDescription: 'SudarshanAshtra', ProductName: 'SudarshanAshtra', CompanyName: 'Vijay Tomar', LegalCopyright: 'Developer: Vijay Tomar', OriginalFilename: 'SudarshanAshtra.exe', InternalName: 'SudarshanAshtra' });
    vi.outputToResourceEntries(rs.entries);
  }
  rs.outputResource(ex); fs.writeFileSync(exe, Buffer.from(ex.generate()));
  console.log('  • icon and version set in', path.basename(exe));
};
