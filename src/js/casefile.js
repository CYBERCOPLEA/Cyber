/* casefile.js – notice drafts (save / edit / more templates / my templates) and the case report
   for senior officers, exported as Word (.docx) and PDF. Everything is made inside this browser. */
'use strict';

/* ---------- tiny ZIP (store only) + Word .docx writer ---------- */
const Zip = {
  _t: null,
  crc(b) { const T = this._t || (this._t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; },
  make(files) {
    const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
    const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = this.crc(data);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(h, name, data);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      cd.push(c, name); off += 30 + name.length + data.length;
    }
    const cdSize = cd.reduce((a, x) => a + (x.byteLength ?? x.length), 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cd, e], { type: 'application/zip' });
  }
};

const Docx = {
  x: s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''),
  // text run; newlines become line breaks
  r(t, o = {}) {
    const pr = `<w:rPr>${o.font ? `<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>` : ''}${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.caps ? '<w:caps/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.sz ? `<w:sz w:val="${o.sz * 2}"/><w:szCs w:val="${o.sz * 2}"/>` : ''}</w:rPr>`;
    return String(t ?? '').split('\n').map((l, i) => `<w:r>${pr}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${this.x(l)}</w:t></w:r>`).join('');
  },
  p(runs, o = {}) {
    return `<w:p><w:pPr>${o.keep ? '<w:keepNext/>' : ''}${o.pb ? '<w:pageBreakBefore/>' : ''}${o.border ? `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="2" w:color="${o.border}"/></w:pBdr>` : ''}${o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : ''}<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 100}"/>${o.ind ? `<w:ind w:left="${o.ind}" w:hanging="${o.hang || 0}"/>` : ''}${o.align ? `<w:jc w:val="${o.align}"/>` : ''}</w:pPr>${runs}</w:p>`;
  },
  // table: rows of cells; a cell is text or {t, b, fill, color, align}
  table(rows, o = {}) {
    const W = o.widths, tw = 10200, n = rows[0]?.length || 1, ws = W ? W.map(w => Math.round(w * tw)) : Array(n).fill(Math.round(tw / n));
    const cell = (c, i, hdr) => { c = typeof c === 'object' && c !== null ? c : { t: c }; const fill = c.fill || (hdr ? o.head || '1F3A5F' : null);
      return `<w:tc><w:tcPr><w:tcW w:w="${ws[i]}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}<w:tcMar><w:top w:w="50" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>${this.p(this.r(c.t, { b: hdr || c.b, color: hdr ? 'FFFFFF' : c.color, sz: c.sz || o.sz || 9 }), { after: 0, align: c.align })}</w:tc>`; };
    return `<w:tbl><w:tblPr><w:tblW w:w="${tw}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="${o.line || 'B8C4D6'}"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${ws.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
      ${rows.map((r, ri) => `<w:tr>${ri === 0 && o.header !== false ? '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${r.map((c, i) => cell(ri % 2 === 0 && ri > 0 && o.zebra && (typeof c !== 'object' || c === null) ? { t: c, fill: 'F3F6FB' } : c, i, ri === 0 && o.header !== false)).join('')}</w:tr>`).join('')}</w:tbl>${this.p('', { after: 60 })}`;
  },
  img(rid, wPx, hPx, maxCm = 17.5) {
    const emu = 360000, w = Math.min(maxCm * emu, wPx * 9525), h = Math.round(w * hPx / wPx), id = Math.floor(Math.random() * 1e6);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${w}" cy="${h}"/><wp:docPr id="${id}" name="Picture ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${rid}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  },
  // body xml + images [{rid, bytes}] + footer text → Blob
  build(body, o = {}) {
    const imgs = o.images || [], foot = o.footer || '';
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
    const sect = `<w:sectPr>${foot ? '<w:footerReference w:type="default" r:id="rIdFoot"/>' : ''}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="850" w:bottom="1000" w:left="850" w:header="500" w:footer="450" w:gutter="0"/></w:sectPr>`;
    const fld = k => `<w:fldSimple w:instr="${k}"><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="666666"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>`;
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${W}>${this.p(this.r(foot + '   ·   Page ', { sz: 8, color: '666666' }) + fld('PAGE') + this.r(' of ', { sz: 8, color: '666666' }) + fld('NUMPAGES'), { align: 'center', after: 0 })}</w:ftr>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${o.font || 'Calibri'}" w:hAnsi="${o.font || 'Calibri'}" w:cs="${o.font || 'Calibri'}" w:eastAsia="${o.font || 'Calibri'}"/><w:sz w:val="${(o.size || 10.5) * 2}"/><w:szCs w:val="${(o.size || 10.5) * 2}"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${foot ? '<Relationship Id="rIdFoot" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : ''}${imgs.map(i => `<Relationship Id="${i.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${i.rid}.png"/>`).join('')}</Relationships>`;
    const files = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${foot ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${this.x(o.title || 'Document')}</dc:title><dc:creator>SudarshanAshtra</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
      { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}${sect}</w:body></w:document>` },
      { name: 'word/styles.xml', data: styles },
      { name: 'word/_rels/document.xml.rels', data: rels },
      ...(foot ? [{ name: 'word/footer1.xml', data: footer }] : []),
      ...imgs.map(i => ({ name: `word/media/${i.rid}.png`, data: i.bytes }))
    ];
    return new Blob([Zip.make(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  },
  save(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); },
  // plain letter (notice) → .docx
  letter(text, title) { return this.build(String(text || '').split('\n').map(l => this.p(this.r(l), { after: 0 })).join(''), { font: 'Times New Roman', size: 12, title }); }
};
// image (any data URL / SVG string) → PNG bytes
async function toPng(src, maxW = 1600, bg = '#ffffff') {
  const url = /^</.test(src) ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src) : src;
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const sc = Math.min(1, maxW / (im.naturalWidth || maxW)), w = Math.max(1, Math.round((im.naturalWidth || maxW) * sc)), h = Math.max(1, Math.round((im.naturalHeight || maxW * .6) * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); } x.drawImage(im, 0, 0, w, h);
  const du = c.toDataURL('image/png'), bin = atob(du.split(',')[1]), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { du, bytes, w, h };
}

/* ---------- Notice templates: more of them ---------- */
Object.assign(Notices.T, {
  tel_cdr: { name: 'Telecom – CDR with tower location (Sec 94 BNSS)', to: 'The Nodal Officer\n{{tsp}}', subject: 'Notice under Section 94 BNSS, 2023 – Call Detail Records with cell-ID location – {{fir}}',
    body: `In connection with the investigation of the above case under {{section}} registered at PS {{ps}}, District {{district}}, you are requested to furnish the following for the mobile number(s):\n\n{{mobiles}}\n\nfor the period from ____________ to ____________:\n1. Call Detail Records (voice, SMS, data sessions) with date, time, duration, B-party number and IMEI.\n2. First and last cell-ID with tower address, latitude / longitude and azimuth for every record.\n3. Subscriber details (CAF) with date of activation, Point-of-Sale name, code and POS agent.\n4. Roaming details and current status of the connection.\n\nKindly send the records in Excel / CSV format to {{io_email}}.` },
  tel_ipdr: { name: 'Telecom – IPDR / IP address resolution', to: 'The Nodal Officer\n{{tsp}}', subject: 'Request for IPDR / identification of user of public IP address – {{fir}}',
    body: `During investigation of the above case under {{section}} at PS {{ps}}, District {{district}}, the following IP address(es) were found used by the accused:\n\n{{ips}}\n\nYou are requested under Section 94 of the BNSS, 2023 to identify the subscriber(s) who were allotted the above public IP address(es) with the source port at the date and time (IST) mentioned, and to furnish:\n1. Mobile number / user ID, CAF and address of the subscriber.\n2. IPDR of the identified number for ____________ to ____________ (public IP, private IP, port, start / end time, cell-ID, IMEI).\n\nKindly send the details to {{io_email}}.` },
  tel_tower: { name: 'Telecom – tower dump', to: 'The Nodal Officer\n{{tsp}}', subject: 'Request for tower dump data – {{fir}}',
    body: `In connection with the above case under {{section}} at PS {{ps}}, District {{district}}, you are requested under Section 94 of the BNSS, 2023 to provide the tower dump (all mobile numbers / IMEIs that connected) of the cell site(s) covering the location below:\n\nLocation: ______________________________________\nDate: ____________   Time: from ________ to ________ (IST)\n\nKindly provide the data in Excel / CSV format with cell-ID, tower address, IMEI and IMSI to {{io_email}}.` },
  tel_imei: { name: 'Telecom – IMEI based CDR / numbers used in handset', to: 'The Nodal Officer\n{{tsp}}', subject: 'Request for numbers used in handset (IMEI) – {{fir}}',
    body: `In connection with the above case under {{section}} at PS {{ps}}, District {{district}}, you are requested under Section 94 of the BNSS, 2023 to furnish all mobile numbers used in the handset(s) bearing IMEI:\n\n{{imeis}}\n\nfor the period ____________ to ____________, with subscriber details (CAF), first and last use date, and the latest cell-ID location.\n\nKindly send the details to {{io_email}}.` },
  email: { name: 'E-mail provider – subscriber info & login IP logs', to: 'The Law Enforcement Response Team\n{{company}}', subject: 'Notice under Section 94 BNSS, 2023 and Section 79(3)(b) IT Act – details of e-mail account(s) – {{fir}}',
    body: `The undersigned is investigating the above case under {{section}} at PS {{ps}}, District {{district}}. The following e-mail account(s) were used in the commission of the offence:\n\n{{emails}}\n\nYou are requested to provide:\n1. Subscriber details – name, recovery phone number and recovery e-mail, date and IP of account creation.\n2. Login IP logs with date, time (with time zone) and port for the last 6 months / available period.\n3. Linked accounts and devices.\n4. Preserve the content and data of the account(s) pending legal process.\n\nPlease send the information to {{io_email}}.` },
  upi: { name: 'UPI / wallet / payment app – VPA & transaction details', to: 'The Nodal Officer\n{{company}}', subject: 'Notice under Section 94 BNSS, 2023 – details of UPI ID / wallet involved in cyber fraud – {{fir}}',
    body: `In connection with the above case under {{section}} at PS {{ps}}, District {{district}} (NCRP Ack No. {{ack}}), the following UPI ID(s) / wallet(s) / account(s) were used to receive the proceeds of crime:\n\n{{upis}}\n\nYou are requested to furnish:\n1. KYC of the UPI ID / wallet holder, registered mobile number and e-mail.\n2. Linked bank account(s) with IFSC.\n3. Transaction history with counter-party VPA, bank reference (RRN / UTR), date and time.\n4. Device ID, device model, app login IP addresses with date-time.\n5. Freeze the wallet balance / block the UPI ID pending investigation and confirm the balance.\n\nKindly send the information to {{io_email}}.` },
  pg: { name: 'Payment gateway – merchant details & settlement', to: 'The Nodal Officer\n{{company}}', subject: 'Notice under Section 94 BNSS, 2023 – merchant details and settlement account – {{fir}}',
    body: `In connection with the above case under {{section}} at PS {{ps}}, District {{district}}, money of the victim(s) was collected through your payment gateway (transaction / order IDs below):\n\n{{accounts}}\n\nYou are requested to furnish:\n1. Merchant name, KYC, GST, website / app, registered mobile and e-mail.\n2. Settlement bank account(s) with IFSC and settlement statement.\n3. Login IPs of the merchant dashboard with date-time.\n4. Stop settlement of the disputed amount and confirm the amount held.\n\nKindly send the details to {{io_email}}.` },
  ecom: { name: 'E-commerce – order, delivery & payment details', to: 'The Nodal Officer\n{{company}}', subject: 'Notice under Section 94 BNSS, 2023 – order / delivery details – {{fir}}',
    body: `In connection with the above case under {{section}} at PS {{ps}}, District {{district}}, the proceeds of crime / account details below were used to place orders on your platform:\n\n{{accounts}}\n\nYou are requested to furnish for the period ____________ to ____________:\n1. Account holder details, registered mobile number and e-mail.\n2. Order details with delivery address, delivery person, date of delivery and proof of delivery.\n3. Payment details (card / UPI / wallet / bank reference).\n4. Login IP addresses and device details.\n\nKindly send the details to {{io_email}}.` },
  crypto: { name: 'Crypto exchange – KYC, wallets, freeze', to: 'The Compliance / Nodal Officer\n{{company}}', subject: 'Notice under Section 94 & 106 BNSS, 2023 – crypto account(s) involved in cyber fraud – {{fir}}',
    body: `In connection with the above case under {{section}} at PS {{ps}}, District {{district}}, the proceeds of crime were converted / transferred through the following account(s) / wallet address(es) / UPI ID(s) on your exchange:\n\n{{accounts}}\n\nYou are requested to:\n1. Furnish KYC of the user(s), linked bank accounts, registered mobile and e-mail.\n2. Furnish deposit / withdrawal history (INR and crypto) with transaction hashes and wallet addresses.\n3. Furnish login IP addresses and device details with date-time.\n4. Freeze the account(s) and wallet balance(s) immediately and confirm the value held.\n\nKindly send the information to {{io_email}}.` },
  domain: { name: 'Domain registrar / hosting – registrant & IP logs', to: 'The Abuse / Legal Team\n{{company}}', subject: 'Notice under Section 94 BNSS, 2023 and Section 79(3)(b) IT Act – website used for cyber fraud – {{fir}}',
    body: `The following website(s) / domain(s) hosted or registered with you were used to cheat the public in the above case under {{section}} at PS {{ps}}, District {{district}}:\n\n{{profiles}}\n\nYou are requested to:\n1. Furnish registrant details, contact e-mail / phone and payment details for the domain / hosting.\n2. Furnish account login IP logs and server / FTP / cPanel access logs.\n3. Preserve all data and suspend / take down the website as it is being used for an offence.\n\nKindly send the details to {{io_email}}.` },
  preserve: { name: 'Data preservation request (any platform)', to: 'The Law Enforcement Response Team\n{{company}}', subject: 'Request for preservation of data – {{fir}}',
    body: `The undersigned is investigating the above case under {{section}} at PS {{ps}}, District {{district}}. You are requested to immediately preserve all data, including subscriber details, content, IP logs and transaction records, related to:\n\n{{profiles}}\n\nfor a period of 180 days or until legal process is served. Kindly confirm preservation to {{io_email}}.` },
  takedown: { name: 'Intermediary – blocking / takedown (Sec 79(3)(b) IT Act)', to: 'The Grievance Officer\n{{platform}}', subject: 'Notice under Section 79(3)(b) of the IT Act, 2000 – removal / disabling of unlawful content – {{fir}}',
    body: `The following account(s) / content on your platform are being used to commit cyber fraud, which is an offence under {{section}} (case registered at PS {{ps}}, District {{district}}):\n\n{{profiles}}\n\nYou are requested to expeditiously remove / disable access to the above account(s) / content without vitiating the evidence, preserve all related data, and confirm the action taken to {{io_email}}.` },
  unfreeze: { name: 'Bank – refund / release of frozen amount to victim', to: 'The Nodal Officer / Branch Manager\n{{bank}}', subject: 'Release of frozen amount to the victim – {{fir}}',
    body: `With reference to the debit freeze / lien marked on the account(s) below in the above case under {{section}} at PS {{ps}}, District {{district}} (NCRP Ack No. {{ack}}):\n\n{{accounts}}\n\nthe Hon'ble Court of ______________________ vide order dated ____________ (copy enclosed) has directed release of ₹____________ to the victim.\n\nYou are requested to remit the said amount to the victim's account below and confirm with the UTR:\nVictim name: ______________________\nAccount No.: ______________________   IFSC: ______________\n\nThe lien on the remaining amount, if any, shall continue until further orders.` },
  lift_lien: { name: 'Bank – lift / reduce debit freeze (excess amount)', to: 'The Nodal Officer / Branch Manager\n{{bank}}', subject: 'Request to lift / reduce debit freeze on account – {{fir}}',
    body: `With reference to the debit freeze marked on the account(s) below in the above case under {{section}} at PS {{ps}}, District {{district}}:\n\n{{accounts}}\n\nOn verification, the disputed amount relating to this case is ₹____________ only. You are requested to keep the lien limited to the disputed amount and lift the debit freeze on the remaining balance / operations of the account. Kindly confirm the action taken.` },
  sec107: { name: 'Application to Magistrate – attachment (Sec 107 BNSS)', to: 'The Hon\'ble Court of the Judicial Magistrate\n____________, District {{district}}', court: true, subject: 'Application under Section 107 of the BNSS, 2023 for attachment of proceeds of crime – {{fir}}',
    body: `Respectfully submitted:\n\n1. That the above case under {{section}} is registered at PS {{ps}}, District {{district}} and is under investigation by the undersigned.\n2. That investigation has revealed that the following property / account balances are proceeds of crime:\n\n{{accounts}}\n\n3. That there is reason to believe that the said property is likely to be concealed, transferred or dealt with, which will defeat the purpose of restoring it to the victim(s).\n\nIt is therefore prayed that the Hon'ble Court may be pleased to order attachment of the above property under Section 107 of the BNSS, 2023, in the interest of justice.` }
});

/* ---------- Notice drafts: generate, edit, save, re-open; my templates ---------- */
Notices.vars = function (bank, platform, ref, company) {
  const c = activeCase(), uq = a => uniq(a.filter(Boolean).map(String)), num = (a, blank) => a.length ? a.slice(0, 40).map((v, i) => `${i + 1}. ${v}`).join('\n') : blank;
  const kyc = S.data.kyc || [], soc = S.data.social || [];
  const accs = Analysis.accountRows().filter(a => a.layer > 0 && !isSynthetic(a.acc) && (!bank || a.bank.includes(bank)));
  const accLines = accs.slice(0, 60).map((a, i) => `${i + 1}. A/c ${a.acc}${a.name ? ' – ' + a.name : ''}${a.ifsc ? ' – IFSC ' + a.ifsc : ''} – amount received ${fmtINR(a.inAmt)}${a.ackList ? ' (Ack ' + a.ackList + ')' : ''}`).join('\n') || '1. A/c ____________ IFSC ________ amount ₹________';
  const profs = soc.filter(s => !platform || s.platform === platform);
  return {
    bank: bank || '____________ Bank', platform: platform || '____________', company: company || '____________', tsp: company || '____________ (Jio / Airtel / Vi / BSNL)',
    ps: c.ps || '________', fir: c.fir ? 'FIR No. ' + c.fir : 'Case No. ________', section: c.section || '________', district: c.district || 'Ghaziabad',
    ack: c.ack || uniq(S.data.txns.map(x => x.ack_no)).slice(0, 5).join(', ') || '________', io: c.io || '', io_rank: c.io_rank || '', io_mobile: c.io_mobile || '', io_email: c.io_email || '________', ref: ref || '', date: new Date().toLocaleDateString('en-IN'),
    accounts: accLines,
    profiles: num(uq(profs.map(s => s.profile || s.mobile)), '1. ____________ (profile URL / username / phone number)'),
    mobiles: num(uq([...kyc.map(k => k.mobile), ...S.data.ncrp.map(n => n.suspect_mobile), ...soc.map(s => s.mobile)]), '1. __________'),
    ips: num(uq([...soc.map(s => s.ip), ...kyc.map(k => k.ip)]), '1. IP ____________  Date-time ____________ (IST)  Port ______'),
    emails: num(uq([...soc.map(s => s.email), ...kyc.map(k => k.email), ...S.data.ncrp.map(n => n.suspect_email)]), '1. ____________@____________'),
    imeis: num(uq([...soc.map(s => s.imei), ...kyc.map(k => k.imei)]), '1. IMEI ____________________'),
    upis: num(uq([...S.data.txns.map(t => t.upi || t.vpa), ...kyc.map(k => k.upi)]), '1. ____________@______')
  };
};
Notices.fill = function (key, bank, platform, ref, company) {
  const v = this.vars(bank, platform, ref, company), f = s => String(s).replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ?? m), c = activeCase();
  const my = (S.settings.myTpl || []).find(t => t.id === key); if (my) return f(my.text);
  const t = this.T[key]; if (!t) return '';
  if (t.court) return `To,\n${f(t.to)}\n\nSubject: ${f(t.subject)}\n\n${f(t.body)}\n\n\nDate: ${v.date}\nPlace: ${v.district}\n\n(${c.io || 'Name of IO'})\n${c.io_rank || 'Designation'}\nInvestigating Officer, PS ${c.ps || '________'}, District ${v.district}`;
  return `${ref ? 'Ref. No.: ' + ref + '\n' : ''}Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}\n\nTo,\n${f(t.to)}\n\nSubject: ${f(t.subject)}\n\nSir / Madam,\n\n${f(t.body)}\n\nThis is a matter of urgency as it relates to the proceeds of crime and loss to the victim(s).\n\n\n(${c.io || 'Name of IO'})\n${c.io_rank || 'Designation'}\nPolice Station ${c.ps || '________'}, District ${v.district}\nMobile: ${c.io_mobile || '________'}  E-mail: ${c.io_email || '________'}`;
};

Notices.render = function (el) {
  const D = S.data.drafts || (S.data.drafts = []), my = S.settings.myTpl || [];
  const banks = uniq(Analysis.accountRows().filter(a => a.layer > 0 && !isSynthetic(a.acc)).map(a => a.bank.split(' / ')[0])).sort();
  const plats = uniq(S.data.social.map(s => s.platform)).sort();
  const groups = [['Bank', ['bank_kyc', 'bank_freeze', 'atm_cctv', 'lift_lien', 'unfreeze']], ['Telecom', ['telecom', 'tel_cdr', 'tel_ipdr', 'tel_tower', 'tel_imei']], ['Social media / internet', ['intermediary', 'takedown', 'email', 'domain', 'preserve']], ['Payments / others', ['upi', 'pg', 'ecom', 'crypto']], ['Court', ['sec107']]];
  const listed = new Set(groups.flatMap(g => g[1])), rest = Object.keys(this.T).filter(k => !listed.has(k) && !k.startsWith('__'));
  const st = this._st || (this._st = { id: null });
  el.innerHTML = `<div class="note warn">Templates are drafts to save typing. Check the sections of law, period and wording as per current law and your department's format before signing.</div>
    <div class="nt-grid"><div>
      <div class="card"><h3>1 · New notice from a template <span class="badge">${Object.keys(this.T).filter(k => !k.startsWith('__')).length + my.length} templates</span></h3>
        <div class="nt-form"><label class="nt-wide">Template<select id="ntT">${groups.map(([g, ks]) => `<optgroup label="${g}">${ks.filter(k => this.T[k]).map(k => `<option value="${k}">${esc(this.T[k].name)}</option>`).join('')}</optgroup>`).join('')}${rest.length ? `<optgroup label="Other">${rest.map(k => `<option value="${k}">${esc(this.T[k].name)}</option>`).join('')}</optgroup>` : ''}${my.length ? `<optgroup label="⭐ My templates">${my.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</optgroup>` : ''}</select></label>
          <label>Bank<select id="ntB"><option value="">— choose —</option>${banks.map(b => `<option>${esc(b)}</option>`).join('')}</select></label>
          <label>Platform<select id="ntP"><option value="">— choose —</option>${[...new Set([...plats, ...PLATFORMS])].map(b => `<option>${esc(b)}</option>`).join('')}</select></label>
          <label>Operator / company<input id="ntC" placeholder="e.g. Bharti Airtel Ltd, Google LLC, PhonePe"></label>
          <label>Ref No<input id="ntRef"></label></div>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="ntGo">✨ Generate new draft</button><button class="btn sm danger hidden" id="ntDelMy">Delete this template</button></div></div>
      <div class="card nt-ed"><div class="row"><h3 class="grow">2 · Edit draft</h3><span class="small muted" id="ntState"></span></div>
        <input id="ntName" class="nt-name" placeholder="Draft name (e.g. HDFC freeze – 12 accounts)">
        <textarea id="ntOut" spellcheck="true"></textarea>
        <div class="row nt-btns"><button class="btn primary" id="ntSave">💾 Save draft</button><button class="btn" id="ntSaveNew">Save as new copy</button><button class="btn" id="ntDocx">⬇ Word (.docx)</button><button class="btn" id="ntPrint">🖨 Print / PDF</button><button class="btn" id="ntCopy">Copy</button><button class="btn" id="ntMy">⭐ Save as my template</button><button class="btn" id="ntTask">+ Follow-up task</button></div></div>
    </div>
    <div class="card nt-list"><h3>📂 Saved drafts <span class="badge">${D.length}</span></h3><div class="sub">Saved in this case. Click a draft to open and edit it.</div>
      <input id="ntFind" placeholder="Search drafts…" style="width:100%;margin:6px 0 8px">
      <div id="ntDrafts"></div></div></div>`;
  const out = $('#ntOut', el), nm = $('#ntName', el), tsel = $('#ntT', el);
  NoticeKit.recipients($('#ntB', el), 'bank', banks.map(b => [b, b]), ''); NoticeKit.recipients($('#ntP', el), 'plat', plats.map(b => [b, b]), '');
  NoticeKit.tools($('.nt-btns', el), out, { vars: () => ({ bank: NoticeKit.nameOf($('#ntB', el).value), platform: NoticeKit.nameOf($('#ntP', el).value), company: $('#ntC', el).value.trim(), ref: $('#ntRef', el).value }), after: () => this.render(el) });
  const draw = () => {
    const f = ($('#ntFind', el).value || '').toLowerCase(), L = D.slice().sort((a, b) => b.updated.localeCompare(a.updated)).filter(d => !f || (d.name + ' ' + d.text).toLowerCase().includes(f));
    $('#ntDrafts', el).innerHTML = L.length ? L.map(d => `<div class="nt-item ${d.id === st.id ? 'on' : ''}" data-d="${d.id}"><div class="grow"><b>${esc(d.name)}</b><div class="small muted">${esc(d.tplName || '')}</div><div class="small muted">Edited ${esc(new Date(d.updated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}</div></div><div class="nt-acts"><button class="btn sm" data-dup="${d.id}" title="Make a copy">⧉</button><button class="btn sm danger" data-del="${d.id}" title="Delete">✕</button></div></div>`).join('') : `<div class="muted small">${D.length ? 'No draft matches.' : 'No saved drafts yet. Generate a notice, edit it and press 💾 Save draft.'}</div>`;
    $$('#ntDrafts [data-d]', el).forEach(x => x.onclick = e => { if (e.target.closest('button')) return; const d = D.find(y => y.id === x.dataset.d); st.id = d.id; out.value = d.text; nm.value = d.name; st.dirty = false; state(); draw(); });
    $$('#ntDrafts [data-del]', el).forEach(b => b.onclick = () => { const d = D.find(y => y.id === b.dataset.del); if (!UI.confirm(`Delete draft "${d.name}"?`)) return; D.splice(D.indexOf(d), 1); if (st.id === d.id) st.id = null; saveCase(); draw(); state(); $('.nt-list .badge', el).textContent = D.length; });
    $$('#ntDrafts [data-dup]', el).forEach(b => b.onclick = () => { const d = D.find(y => y.id === b.dataset.dup), n = { ...d, id: uid() + '', name: d.name + ' (copy)', updated: new Date().toISOString() }; D.push(n); saveCase(); draw(); $('.nt-list .badge', el).textContent = D.length; });
  };
  const state = () => { const d = D.find(x => x.id === st.id); $('#ntState', el).innerHTML = d ? `Editing saved draft${st.dirty ? ' · <span class="err">unsaved changes</span>' : ' · saved'}` : (out.value ? 'New draft · <span class="err">not saved yet</span>' : ''); };
  const tplName = () => { const o = tsel.selectedOptions[0]; return o ? o.textContent : ''; };
  const gen = () => { out.value = this.fill(tsel.value, NoticeKit.nameOf($('#ntB', el).value), NoticeKit.nameOf($('#ntP', el).value), $('#ntRef', el).value, $('#ntC', el).value.trim()); nm.value = tplName().replace(/\s*\(.*?\)\s*/g, ' ').trim() + (NoticeKit.nameOf($('#ntB', el).value) ? ' – ' + NoticeKit.nameOf($('#ntB', el).value) : $('#ntC', el).value ? ' – ' + $('#ntC', el).value : NoticeKit.nameOf($('#ntP', el).value) ? ' – ' + NoticeKit.nameOf($('#ntP', el).value) : ''); st.id = null; st.dirty = false; state(); draw(); };
  const save = asNew => { const text = out.value; if (!text.trim()) { UI.toast('Nothing to save'); return; } let d = !asNew && D.find(x => x.id === st.id); const name = nm.value.trim() || tplName() || 'Notice';
    if (d) Object.assign(d, { name, text, updated: new Date().toISOString() }); else { d = { id: uid() + '', name: asNew && st.id ? name + ' (copy)' : name, tpl: tsel.value, tplName: tplName(), text, created: new Date().toISOString(), updated: new Date().toISOString() }; D.push(d); }
    st.id = d.id; st.dirty = false; saveCase(); state(); draw(); $('.nt-list .badge', el).textContent = D.length; UI.toast('Draft saved'); };
  tsel.onchange = () => $('#ntDelMy', el).classList.toggle('hidden', !my.some(t => t.id === tsel.value));
  $('#ntGo', el).onclick = () => { if (st.dirty && !UI.confirm('The open draft has unsaved changes. Start a new one anyway?')) return; gen(); };
  $('#ntDelMy', el).onclick = () => { const t = my.find(x => x.id === tsel.value); if (!t || !UI.confirm(`Delete your template "${t.name}"?`)) return; S.settings.myTpl = my.filter(x => x !== t); saveMeta(); this.render(el); };
  out.oninput = nm.oninput = () => { st.dirty = true; state(); };
  $('#ntSave', el).onclick = () => save(false);
  $('#ntSaveNew', el).onclick = () => save(true);
  $('#ntDocx', el).onclick = () => Docx.save((nm.value.trim() || 'notice').replace(/[^\w\- ]+/g, '_') + '.docx', Docx.letter(out.value, nm.value));
  $('#ntPrint', el).onclick = () => Reports.printText(out.value);
  $('#ntCopy', el).onclick = () => { navigator.clipboard?.writeText(out.value); UI.toast('Copied'); };
  $('#ntMy', el).onclick = () => {
    const name = window.prompt('Name for your template (it can be used in every case). Tip: keep {{fir}}, {{ps}}, {{section}}, {{accounts}}, {{mobiles}}, {{io_email}} etc. where case details should be filled in.', nm.value || tplName()); if (!name) return;
    (S.settings.myTpl || (S.settings.myTpl = [])).push({ id: 'my_' + uid(), name: name.trim(), text: out.value }); saveMeta(); UI.toast('Saved in ⭐ My templates'); this.render(el);
  };
  $('#ntTask', el).onclick = () => { S.data.tasks.push({ id: uid(), text: 'Follow up: ' + (nm.value || tplName()), due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), done: false }); saveCase(); UI.toast('Task added (due in 7 days)'); };
  $('#ntFind', el).oninput = draw;
  const cur = D.find(x => x.id === st.id);
  if (cur) { out.value = cur.text; nm.value = cur.name; state(); draw(); } else gen();
};

/* ---------- Case report for senior officers: one model → PDF (print) and Word ---------- */
const CaseReport = {
  inr: v => fmtINR(v || 0),
  model() {
    const c = activeCase(), d = S.data, A = Analysis.accountRows().filter(a => !isSynthetic(a.acc));
    const C = typeof Trail !== 'undefined' ? Trail.complaints() : d.ncrp.map(n => ({ ack: n.ack_no, victim: n.victim_name, district: n.district, category: n.category, date: n.date, amount: n.amount, hold: n.hold_amount, layers: 0, accounts: 0 }));
    const loss = C.reduce((a, x) => a + (+x.amount || 0), 0), hold = Math.max(C.reduce((a, x) => a + (+x.hold || 0), 0), A.reduce((a, x) => a + (x.hold || 0), 0));
    const maxL = Math.max(0, ...A.map(a => a.layer || 0)), bank1 = a => (a.bank || '').split(' / ')[0] || 'Unknown bank';
    const cash = A.filter(a => a.cashOut > 0), high = A.filter(a => a.score >= 60).sort((a, b) => b.score - a.score);
    const top = A.slice().sort((a, b) => b.score - a.score || b.inAmt - a.inAmt).slice(0, 15);
    // layer-wise
    const LW = []; for (let l = 1; l <= maxL; l++) { const L = A.filter(a => a.layer === l); if (!L.length) continue; const bk = new Map(); L.forEach(a => bk.set(bank1(a), (bk.get(bank1(a)) || 0) + a.inAmt)); LW.push({ layer: 'Layer ' + l, accounts: L.length, inAmt: L.reduce((s, a) => s + a.inAmt, 0), cash: L.reduce((s, a) => s + (a.cashOut || 0), 0), hold: L.reduce((s, a) => s + (a.hold || 0), 0), banks: [...bk.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).join(', ') }); }
    // bank-wise
    const BM = new Map(); A.filter(a => a.layer > 0).forEach(a => { const k = bank1(a); const b = BM.get(k) || { bank: k, accounts: 0, inAmt: 0, hold: 0, cash: 0 }; b.accounts++; b.inAmt += a.inAmt; b.hold += a.hold || 0; b.cash += a.cashOut || 0; BM.set(k, b); });
    const BW = [...BM.values()].sort((a, b) => b.inAmt - a.inAmt);
    // links
    const COM = []; for (const f of ['account', 'mobile', 'email', 'pan', 'aadhaar', 'ifsc']) { try { Analysis.finCommon(f).filter(g => g.n >= 2 && (g.accs >= 2 || g.acks >= 2)).forEach(g => COM.push({ type: Analysis.FIN_COMMON[f].label, value: g.value, n: g.n, accs: g.accs, acks: g.acks, amount: g.amount })); } catch (e) { } }
    COM.sort((a, b) => b.acks - a.acks || b.n - a.n);
    let XL = []; try { XL = Analysis.crossLinks().filter(x => x.sections >= 2 || x.refs >= 2).sort((a, b) => b.sections - a.sections || b.refs - a.refs); } catch (e) { }
    const plat = {}; d.social.forEach(s => plat[s.platform || 'Other'] = (plat[s.platform || 'Other'] || 0) + 1);
    const mobs = uniq([...d.kyc.map(k => k.mobile), ...d.ncrp.map(n => n.suspect_mobile), ...d.social.map(s => s.mobile)].filter(Boolean));
    const caf = d.caf || [], cafPos = caf.length && typeof CAF !== 'undefined' ? CAF.groups('pos_name').filter(g => g.n >= 2).sort((a, b) => b.n - a.n) : [];
    const pend = d.tasks.filter(t => !t.done);
    const notHeld = A.filter(a => a.layer > 0 && !a.hold && a.inAmt > 0 && a.inAmt > (a.outAmt || 0));
    // executive summary
    const pct = loss ? Math.round(hold / loss * 100) : 0, banksN = BW.length;
    const ex = [];
    ex.push(`${C.length} complaint${C.length === 1 ? '' : 's'} ${C.length ? `with a total reported loss of ${this.inr(loss)} ` : ''}${C.length ? 'are' : 'were'} analysed in this case${c.district ? ` (District ${c.district})` : ''}.`);
    if (A.length) ex.push(`The money was traced through ${maxL} layer${maxL === 1 ? '' : 's'} into ${A.length} account${A.length === 1 ? '' : 's'} at ${banksN} bank${banksN === 1 ? '' : 's'}${BW[0] ? `; the largest share went to ${BW[0].bank} (${this.inr(BW[0].inAmt)})` : ''}.`);
    if (hold) ex.push(`${this.inr(hold)} is on hold / lien${loss ? ` – about ${pct}% of the reported loss` : ''}.`);
    if (cash.length) ex.push(`Cash / ATM withdrawals were made from ${cash.length} account${cash.length === 1 ? '' : 's'} (${this.inr(cash.reduce((s, a) => s + a.cashOut, 0))}).`);
    if (high.length) ex.push(`${high.length} account${high.length === 1 ? ' is' : 's are'} rated high risk; the top suspect account is ${high[0].acc}${high[0].name ? ' (' + high[0].name + ')' : ''} at ${bank1(high[0])}.`);
    if (COM.length || XL.length) ex.push(`${COM.length + XL.length} shared identifier${COM.length + XL.length === 1 ? '' : 's'} (same account, mobile, e-mail, PAN etc. across complaints or sources) point to a connected group of suspects.`);
    if (d.social.length) ex.push(`${d.social.length} social media / platform record${d.social.length === 1 ? '' : 's'} were analysed (${Object.entries(plat).map(([k, v]) => k + ' ' + v).join(', ')}).`);
    if (caf.length) ex.push(`${caf.length} SIM application form${caf.length === 1 ? '' : 's'} (CAF) were analysed${cafPos[0] ? `; ${cafPos[0].n} SIMs were issued by the same POS "${cafPos[0].value}"` : ''}.`);
    // recommended actions
    const R = [];
    if (notHeld.length) R.push(`Send debit freeze / lien notices (Sec 106 BNSS) for ${notHeld.length} account${notHeld.length === 1 ? '' : 's'} not yet on hold – mainly ${uniq(notHeld.map(bank1)).slice(0, 4).join(', ')}.`);
    if (top.length) R.push(`Obtain KYC, account statements, login IP logs and linked accounts (Sec 94 BNSS) for the top ${Math.min(10, top.length)} suspect accounts listed in this report.`);
    if (cash.length) R.push(`Obtain ATM ID, location and CCTV footage for cash withdrawals from ${cash.length} account${cash.length === 1 ? '' : 's'}; identify the person withdrawing.`);
    if (mobs.length) R.push(`Obtain CAF, CDR (with tower location) and IPDR for ${mobs.length} suspect mobile number${mobs.length === 1 ? '' : 's'}; check IMEIs for other numbers used in the same handsets.`);
    if (cafPos.length) R.push(`Verify POS "${cafPos[0].value}" (${cafPos[0].n} SIMs) and its agent for bulk / fraudulent SIM issuance.`);
    if (d.social.length) R.push(`Send notices to ${Object.keys(plat).slice(0, 4).join(', ')} for subscriber details and IP logs; request takedown of fraud profiles.`);
    if (XL.length || COM.length) R.push(`Examine the shared identifiers listed under "Links between suspects" – they link complaints and may reveal the organiser; check the same on NCRP / JCCT Samanvaya for linked cases in other states.`);
    if (hold) R.push(`Move the competent court for release of ${this.inr(hold)} on hold to the victims, with the victim-wise breakup.`);
    if (pend.length) R.push(`Close ${pend.length} pending task${pend.length === 1 ? '' : 's'} listed at the end of this report.`);
    if (!R.length) R.push('Import NCRP complaints and bank replies to generate specific action points.');
    const B = [];
    B.push({ t: 'h', text: 'Executive summary' }, { t: 'p', text: ex.join(' ') });
    B.push({ t: 'kpi', items: [['Complaints', fmtNum(C.length)], ['Reported loss', this.inr(loss)], ['Amount on hold', this.inr(hold)], ['Hold vs loss', loss ? pct + '%' : '–'], ['Accounts traced', fmtNum(A.length)], ['Layers', fmtNum(maxL)], ['Banks involved', fmtNum(banksN)], ['High-risk accounts', fmtNum(high.length)], ['Cash / ATM accounts', fmtNum(cash.length)], ['Shared identifiers', fmtNum(COM.length + XL.length)], ['Social records', fmtNum(d.social.length)], ['Transactions', fmtNum(d.txns.length)]] });
    B.push({ t: 'h', text: 'Case particulars' }, { t: 'kv', rows: [['Case', c.name], ['FIR / Case No', c.fir], ['Sections of law', c.section], ['Police Station', c.ps], ['District', c.district], ['Investigating Officer', [c.io, c.io_rank].filter(Boolean).join(', ')], ['IO contact', [c.io_mobile, c.io_email].filter(Boolean).join(' · ')], ['NCRP Ack No', c.ack], ['Status', c.status], ['Brief facts', c.desc]].filter(r => r[1]) });
    B.push({ t: 'h', text: 'Recommended actions' }, { t: 'list', ordered: true, items: R });
    B.push({ t: 'h', text: 'Top suspect accounts' }, top.length ? { t: 'table', cols: [['rank', '#'], ['acc', 'Account'], ['name', 'Holder'], ['bank', 'Bank / IFSC'], ['layer', 'Layer'], ['inAmt', 'Received', 1], ['cashOut', 'Cash / ATM', 1], ['hold', 'Hold', 1], ['acks', 'Compl.'], ['score', 'Risk'], ['why', 'Reason']], widths: [.04, .13, .12, .14, .055, .09, .08, .08, .055, .045, .16], rows: top.map((a, i) => ({ ...a, rank: i + 1, bank: [bank1(a), (a.ifsc || '').split(' / ')[0]].filter(Boolean).join(' · '), why: (a.flags || []).slice(0, 3).join('; ') })) } : { t: 'p', text: 'No accounts traced yet.', muted: 1 });
    B.push({ t: 'h', text: 'Layer-wise money trail' }, LW.length ? { t: 'table', cols: [['layer', 'Layer'], ['accounts', 'Accounts'], ['inAmt', 'Amount received', 1], ['cash', 'Cash / ATM', 1], ['hold', 'On hold', 1], ['banks', 'Main banks']], widths: [.1, .1, .18, .15, .15, .32], rows: LW } : { t: 'p', text: 'No layer-wise trail available.', muted: 1 });
    B.push({ t: 'img', key: 'flow', caption: 'Money trail flow chart (victim → layer 1 → layer 2 …)' });
    if (BW.length) B.push({ t: 'h', text: 'Bank-wise summary (for notices)' }, { t: 'table', cols: [['bank', 'Bank'], ['accounts', 'Accounts'], ['inAmt', 'Amount received', 1], ['cash', 'Cash / ATM', 1], ['hold', 'On hold', 1]], widths: [.36, .12, .18, .17, .17], rows: BW.slice(0, 25) });
    B.push({ t: 'h', text: 'Links between suspects' });
    if (COM.length) B.push({ t: 'table', cols: [['type', 'Identifier'], ['value', 'Value'], ['acks', 'Complaints'], ['accs', 'Accounts'], ['amount', 'Amount', 1]], widths: [.22, .32, .14, .14, .18], rows: COM.slice(0, 20) });
    if (XL.length) B.push({ t: 'p', text: 'Seen in more than one source:', b: 1 }, { t: 'table', cols: [['type', 'Type'], ['value', 'Value'], ['sectionList', 'Found in']], widths: [.18, .34, .48], rows: XL.slice(0, 20) });
    if (!COM.length && !XL.length) B.push({ t: 'p', text: 'No shared identifiers found yet.', muted: 1 });
    if (d.social.length || caf.length) {
      B.push({ t: 'h', text: 'Social media and SIM (CAF) findings' });
      if (d.social.length) B.push({ t: 'kv', rows: Object.entries(plat).map(([k, v]) => [k, v + ' record' + (v === 1 ? '' : 's')]) });
      if (cafPos.length) B.push({ t: 'table', cols: [['value', 'POS'], ['n', 'SIMs'], ['mobiles', 'Mobile numbers'], ['dates', 'Activation dates']], widths: [.25, .08, .4, .27], rows: cafPos.slice(0, 10) });
    }
    if (pend.length || d.notes.length) {
      B.push({ t: 'h', text: 'Pending tasks and notes' });
      if (pend.length) B.push({ t: 'list', items: pend.map(t => t.text + (t.due ? ` (due ${t.due})` : '')) });
      d.notes.slice(-8).forEach(n => B.push({ t: 'p', text: `${String(n.when || '').slice(0, 10)} · ${n.title || n.tag || 'Note'}: ${n.text}` }));
    }
    B.push({ t: 'sign' });
    // annexures
    B.push({ t: 'annex', text: 'Annexure A – Complaints' }, C.length ? { t: 'table', small: 1, cols: [['ack', 'Ack No'], ['date', 'Date'], ['victim', 'Victim'], ['district', 'District'], ['category', 'Category'], ['amount', 'Amount', 1], ['hold', 'Hold', 1], ['layers', 'Layers'], ['accounts', 'Accounts']], widths: [.14, .1, .16, .11, .17, .1, .09, .06, .07], rows: C, max: 300 } : { t: 'p', text: 'None', muted: 1 });
    B.push({ t: 'annex', text: 'Annexure B – All suspect accounts (by risk)' }, A.length ? { t: 'table', small: 1, cols: [['acc', 'Account'], ['name', 'Holder'], ['bank', 'Bank'], ['ifsc', 'IFSC'], ['layer', 'Layer'], ['inAmt', 'Received', 1], ['outAmt', 'Sent', 1], ['hold', 'Hold', 1], ['score', 'Risk']], widths: [.14, .15, .18, .12, .06, .1, .1, .09, .06], rows: A.slice().sort((a, b) => b.score - a.score), max: 200 } : { t: 'p', text: 'None', muted: 1 });
    if (d.txns.length) B.push({ t: 'annex', text: 'Annexure C – Layer-wise transactions' }, { t: 'table', small: 1, cols: [['layer', 'L'], ['ack_no', 'Ack'], ['from_acc', 'From'], ['to_acc', 'To'], ['to_bank', 'Bank'], ['amount', 'Amount', 1], ['date', 'Date'], ['txn_id', 'UTR'], ['action', 'Action']], widths: [.04, .12, .13, .13, .14, .1, .1, .12, .12], rows: d.txns.slice().sort((a, b) => (a.layer || 99) - (b.layer || 99) || String(a.date).localeCompare(b.date)), max: 400 });
    return { c, B, title: 'Case Analysis Report', sub: [c.fir ? 'FIR / Case No ' + c.fir : '', c.ps ? 'PS ' + c.ps : '', c.district ? 'District ' + c.district : ''].filter(Boolean).join(' · ') || (c.name || '') };
  },
  fmt(col, v) { if (col[2]) return v ? fmtINR(v) : '–'; if (v == null || v === '') return ''; return String(v); },
  async images() {
    const out = {};
    try {
      const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-9999px;top:0;width:1400px;height:900px'; document.body.appendChild(box);
      const th = document.documentElement.dataset.theme; document.documentElement.dataset.theme = 'light'; const { nodes, edges } = finGraphData({ mode: 'flow', min: 0 }); let g = null; try { if (nodes.length) g = Graph.mount(box, nodes, edges, { mode: 'flow' }).exportSVG(); } finally { document.documentElement.dataset.theme = th; } if (g) { out.flow = { svg: g.str, ...(await toPng(g.str, 1800)) }; } box.remove();
    } catch (e) { console.warn('flow chart', e); }
    try { const bg = getComputedStyle((document.querySelector('.emblem-big') || document.querySelector('.emblem'))).backgroundImage.match(/url\("?(.*?)"?\)$/); if (bg) out.emblem = await toPng(bg[1], 300, null); } catch (e) { }
    return out;
  },
  html(m, im) {
    const c = m.c, now = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' }); let h = '', sec = 0;
    const tb = b => `<table class="${b.small ? 'sm' : ''}"><colgroup>${(b.widths || []).map(w => `<col style="width:${w * 100}%">`).join('')}</colgroup><thead><tr>${b.cols.map(x => `<th class="${x[2] ? 'n' : ''}">${esc(x[1])}</th>`).join('')}</tr></thead><tbody>${b.rows.slice(0, b.max || 100).map(r => `<tr>${b.cols.map(x => `<td class="${x[2] ? 'n' : ''}">${esc(this.fmt(x, r[x[0]]))}</td>`).join('')}</tr>`).join('')}</tbody></table>${b.rows.length > (b.max || 100) ? `<p class="muted">… ${b.rows.length - (b.max || 100)} more rows in the Excel export.</p>` : ''}`;
    for (const b of m.B) {
      if (b.t === 'h') h += `<h2><span>${++sec}</span>${esc(b.text)}</h2>`;
      else if (b.t === 'annex') h += `<h2 class="annex">${esc(b.text)}</h2>`;
      else if (b.t === 'p') h += `<p class="${b.muted ? 'muted' : ''}${b.b ? ' b' : ''}">${esc(b.text)}</p>`;
      else if (b.t === 'kv') h += `<table class="kv">${b.rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</table>`;
      else if (b.t === 'kpi') h += `<div class="kpis">${b.items.map(k => `<div><span>${esc(k[0])}</span><b>${esc(k[1])}</b></div>`).join('')}</div>`;
      else if (b.t === 'list') h += `<${b.ordered ? 'ol' : 'ul'} class="acts">${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
      else if (b.t === 'table') h += tb(b);
      else if (b.t === 'img' && im[b.key]) h += `<figure><img src="${im[b.key].du}"><figcaption>${esc(b.caption)}</figcaption></figure>`;
      else if (b.t === 'sign') h += `<div class="sign"><div>Date: ${new Date().toLocaleDateString('en-IN')}<br>Place: ${esc(c.district || '')}</div><div><b>(${esc(c.io || 'Investigating Officer')})</b><br>${esc(c.io_rank || 'Designation')}<br>PS ${esc(c.ps || '________')}, District ${esc(c.district || '________')}${c.io_mobile ? '<br>Mobile: ' + esc(c.io_mobile) : ''}</div></div>`;
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(m.title)} – ${esc(c.name || '')}</title><style>
      @page{size:A4;margin:14mm 12mm 16mm;@bottom-center{content:"Confidential – for official use only   ·   Page " counter(page) " of " counter(pages);font:9px Arial;color:#666}}
      *{box-sizing:border-box} body{font:11.5px/1.5 "Segoe UI",Calibri,Arial,sans-serif;color:#1b2430;margin:0;background:#e9edf3}
      .page{max-width:1000px;margin:0 auto;background:#fff;padding:26px 34px 40px}
      .bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;justify-content:center;padding:10px;background:#0f1b2d}
      .bar button{font:600 13px "Segoe UI",Arial;padding:9px 18px;border-radius:8px;border:0;cursor:pointer;background:#2563eb;color:#fff}.bar button.w{background:#1d4ed8}.bar span{color:#cbd5e1;font-size:12px;align-self:center}
      .hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1f3a5f;padding-bottom:12px}
      .hd img{height:74px} .hd .t{flex:1} .hd h1{margin:0;font-size:22px;color:#1f3a5f;letter-spacing:.3px} .hd .s{color:#475569;font-size:12.5px;margin-top:2px}
      .conf{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;letter-spacing:1.2px;color:#b91c1c;border:1.5px solid #b91c1c;border-radius:4px;padding:1px 7px}
      .meta{text-align:right;font-size:11px;color:#475569}
      h2{font-size:14.5px;color:#1f3a5f;margin:22px 0 8px;padding:5px 0;border-bottom:1.5px solid #c7d2e3;display:flex;align-items:center;gap:8px;break-after:avoid}
      h2 span{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#1f3a5f;color:#fff;font-size:12px}
      h2.annex{break-before:page;color:#334155}
      p{margin:4px 0 8px;text-align:justify} p.b{font-weight:700} .muted{color:#64748b}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 4px}
      .kpis div{border:1px solid #d6deea;border-left:4px solid #2563eb;border-radius:6px;padding:7px 10px;background:#f7f9fc;break-inside:avoid}
      .kpis div:nth-child(4n+2){border-left-color:#dc2626}.kpis div:nth-child(4n+3){border-left-color:#16a34a}.kpis div:nth-child(4n){border-left-color:#d97706}
      .kpis span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b}.kpis b{font-size:16px;color:#0f172a}
      table{border-collapse:collapse;width:100%;margin:6px 0 10px;font-size:10.5px;table-layout:fixed} th,td{border:1px solid #c9d3e1;padding:4px 6px;text-align:left;vertical-align:top;word-wrap:break-word}
      thead th{background:#1f3a5f;color:#fff;font-weight:600} tbody tr:nth-child(even) td{background:#f3f6fb} td.n,th.n{text-align:right;white-space:nowrap}
      table.sm{font-size:9.5px} table.kv th{width:28%;background:#eef2f8;color:#1f3a5f} table.kv td{white-space:pre-wrap}
      ol.acts{margin:4px 0 8px 0;padding-left:22px} ol.acts li{margin:3px 0;padding:4px 8px;background:#fff7ed;border-left:3px solid #ea580c;border-radius:3px}
      figure{margin:10px 0;text-align:center;break-inside:avoid} figure img{max-width:100%;border:1px solid #d6deea} figcaption{font-size:10px;color:#64748b}
      .sign{display:flex;justify-content:space-between;margin-top:34px;break-inside:avoid} .sign div:last-child{text-align:right}
      @media print{body{background:#fff}.bar{display:none}.page{padding:0;max-width:none} thead{display:table-header-group} tr{break-inside:avoid}}
    </style></head><body><div class="bar"><button onclick="print()">⬇ Save as PDF / Print</button><span>In the print window choose “Save as PDF”.</span></div><div class="page">
      <div class="hd">${im.emblem ? `<img src="${im.emblem.du}" alt="">` : ''}<div class="t"><h1>${esc(m.title)}</h1><div class="s">${esc(m.sub)}</div><div class="conf">CONFIDENTIAL · FOR OFFICIAL USE ONLY</div></div><div class="meta">${esc(c.name || '')}<br>Prepared: ${esc(now)}<br>${esc(c.io ? 'By ' + c.io : '')}</div></div>
      ${h}<p class="muted" style="margin-top:24px;font-size:10px">Prepared with SudarshanAshtra from records available to the investigating officer. Figures are as per the data imported on the date above.</p></div></body></html>`;
  },
  docx(m, im) {
    const D = Docx, c = m.c, B = [], C1 = '1F3A5F'; let sec = 0, rid = 0; const imgs = [];
    const addImg = x => { const id = 'rIdImg' + (++rid); imgs.push({ rid: id, bytes: x.bytes }); return id; };
    // header block
    const hdr = [[{ t: '' }, { t: '' }]];
    const head = `<w:tbl><w:tblPr><w:tblW w:w="10200" w:type="dxa"/><w:tblBorders><w:bottom w:val="single" w:sz="18" w:space="0" w:color="${C1}"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="1500"/><w:gridCol w:w="8700"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${D.p(im.emblem ? D.img(addImg(im.emblem), im.emblem.w, im.emblem.h, 2.4) : '', { after: 60 })}</w:tc><w:tc><w:tcPr><w:tcW w:w="8700" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${D.p(D.r(m.title, { b: 1, sz: 20, color: C1 }), { after: 20 })}${D.p(D.r(m.sub, { sz: 10.5, color: '475569' }), { after: 20 })}${D.p(D.r('CONFIDENTIAL · FOR OFFICIAL USE ONLY', { b: 1, sz: 8, color: 'B91C1C' }) + D.r('     Prepared: ' + new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' }) + (c.io ? ' · ' + c.io : ''), { sz: 8, color: '64748B' }), { after: 60 })}</w:tc></w:tr></w:tbl>`;
    void hdr; B.push(head, D.p('', { after: 60 }));
    const tbl = b => { const rows = b.rows.slice(0, b.max || 100); B.push(D.table([b.cols.map(x => ({ t: x[1], align: x[2] ? 'right' : undefined })), ...rows.map(r => b.cols.map(x => ({ t: this.fmt(x, r[x[0]]), align: x[2] ? 'right' : undefined })))], { widths: b.widths, sz: b.small ? 7.5 : 8.5, zebra: 1 })); if (b.rows.length > rows.length) B.push(D.p(D.r(`… ${b.rows.length - rows.length} more rows in the Excel export.`, { i: 1, sz: 8, color: '64748B' }))); };
    for (const b of m.B) {
      if (b.t === 'h') B.push(D.p(D.r(`${++sec}.  ${b.text}`, { b: 1, sz: 13, color: C1 }), { before: 240, after: 80, border: 'C7D2E3', keep: 1 }));
      else if (b.t === 'annex') B.push(D.p(D.r(b.text, { b: 1, sz: 13, color: '334155' }), { pb: 1, after: 80, border: 'C7D2E3', keep: 1 }));
      else if (b.t === 'p') B.push(D.p(D.r(b.text, { b: b.b, i: b.muted, color: b.muted ? '64748B' : undefined }), { align: 'both' }));
      else if (b.t === 'kv') B.push(D.table(b.rows.map(r => [{ t: r[0], b: 1, fill: 'EEF2F8', color: C1 }, r[1]]), { widths: [.28, .72], header: false, sz: 9.5 }));
      else if (b.t === 'kpi') { const rows = []; for (let i = 0; i < b.items.length; i += 4) rows.push(b.items.slice(i, i + 4).map(k => ({ t: k[0].toUpperCase() + '\n' + k[1], fill: 'F3F6FB', b: 1, color: '0F172A' }))); B.push(D.table(rows, { header: false, sz: 9.5, line: 'D6DEEA' })); }
      else if (b.t === 'list') b.items.forEach((it, i) => B.push(D.p(D.r((b.ordered ? (i + 1) + '.' : '•') + '\t') + D.r(it), { ind: 420, hang: 300, after: 60, shade: b.ordered ? 'FFF7ED' : undefined })));
      else if (b.t === 'table') tbl(b);
      else if (b.t === 'img' && im[b.key]) B.push(D.p(D.img(addImg(im[b.key]), im[b.key].w, im[b.key].h), { align: 'center', after: 20 }), D.p(D.r(b.caption, { i: 1, sz: 8, color: '64748B' }), { align: 'center' }));
      else if (b.t === 'sign') B.push(D.p('', { before: 400 }), D.table([[{ t: `Date: ${new Date().toLocaleDateString('en-IN')}\nPlace: ${c.district || ''}` }, { t: `(${c.io || 'Investigating Officer'})\n${c.io_rank || 'Designation'}\nPS ${c.ps || '________'}, District ${c.district || '________'}${c.io_mobile ? '\nMobile: ' + c.io_mobile : ''}`, align: 'right', b: 1 }]], { header: false, line: 'FFFFFF', sz: 10 }));
    }
    B.push(D.p(D.r('Prepared with SudarshanAshtra from records available to the investigating officer. Figures are as per the data imported on the date above.', { i: 1, sz: 8, color: '64748B' }), { before: 200 }));
    return D.build(B.join(''), { images: imgs, footer: 'Confidential – for official use only', title: m.title + ' – ' + (c.name || '') });
  },
  fname(ext) { const c = activeCase(); return ('Case_Report_' + (c.fir || c.name || 'case')).replace(/[^\w\- ]+/g, '_').replace(/\s+/g, '_') + '_' + today() + '.' + ext; },
  async pdf(auto = true) {
    const w = window.open('', '_blank'); if (!w) { UI.toast('Pop-up blocked. Allow pop-ups for this page.'); return; }
    w.document.write('<p style="font:14px Arial;padding:20px">Preparing the report…</p>');
    const m = this.model(), im = await this.images();
    w.document.open(); w.document.write(this.html(m, im)); w.document.close();
    if (auto) setTimeout(() => { try { w.focus(); w.print(); } catch (e) { } }, 700);
  },
  async word() {
    UI.toast('Preparing Word report…');
    const m = this.model(), im = await this.images();
    Docx.save(this.fname('docx'), this.docx(m, im)); UI.toast('Word report downloaded');
  }
};
Reports.caseReport = () => CaseReport.pdf(false);

OthTabs.reports = function (el) {
  el.innerHTML = `<div class="rp-hero card"><div class="rp-ic">📑</div><div class="grow"><h3>Case report for senior officers</h3>
      <div class="sub">A clear, professional report: executive summary, key figures, recommended actions, top suspects, layer-wise trail with flow chart, bank-wise summary, links between suspects, and annexures. Made on this computer – nothing is uploaded.</div>
      <div class="row" style="margin-top:12px"><button class="btn primary big" id="rWord">⬇ Download Word (.docx)</button><button class="btn primary big rp-pdf" id="rPdf">⬇ Save as PDF</button><button class="btn" id="rView">👁 Preview</button></div>
      <div class="small muted" style="margin-top:8px">PDF: the report opens with the print window – choose <b>Save as PDF</b> as the printer. Fill <i>Case Details</i> (FIR, PS, IO, sections) first so they appear on the report.</div></div></div>
    <div class="grid g2">
      <div class="card"><h3>📊 Excel workbook</h3><div class="sub">All data and analysis of this case in one .xlsx file (one sheet each).</div><button class="btn primary" id="rXls">Download Excel</button></div>
      <div class="card"><h3>💾 Backup / restore</h3><div class="sub">Save everything (all cases) to a file, and restore it on this or another computer. Keep backups safe – they contain case data.</div><div class="row"><button class="btn" id="rBak">Download backup</button><button class="btn" id="rRes">Restore from backup</button></div></div></div>`;
  $('#rWord', el).onclick = () => CaseReport.word();
  $('#rPdf', el).onclick = () => CaseReport.pdf(true);
  $('#rView', el).onclick = () => CaseReport.pdf(false);
  $('#rXls', el).onclick = () => Reports.excel();
  $('#rBak', el).onclick = () => Reports.backup();
  $('#rRes', el).onclick = () => Reports.restore();
};
