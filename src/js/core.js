/* core.js - storage, state, field definitions, normalisers, validators */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmtINR = n => (n == null || isNaN(n)) ? '' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtNum = n => (n == null || isNaN(n)) ? '' : Number(n).toLocaleString('en-IN');
const sum = (arr, f = x => x) => arr.reduce((a, b) => a + (Number(f(b)) || 0), 0);
const uniq = arr => Array.from(new Set(arr.filter(v => v !== '' && v != null)));
const groupBy = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- SHA-256 (pure JS fallback, works on file://) ---------- */
function sha256(ascii) {
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  const mp = Math.pow, maxWord = mp(2, 32); let result = '', i, j;
  const words = [], asciiBitLength = ascii.length * 8;
  let hash = [], k = [], primeCounter = 0; const isComposite = {};
  for (let c = 2; primeCounter < 64; c++) {
    if (!isComposite[c]) { for (i = 0; i < 313; i += c) isComposite[i] = c;
      hash[primeCounter] = (mp(c, .5) * maxWord) | 0; k[primeCounter++] = (mp(c, 1 / 3) * maxWord) | 0; }
  }
  hash = hash.slice(0, 8);
  ascii = unescape(encodeURIComponent(ascii)); const len = ascii.length * 8;
  ascii += '\x80'; while (ascii.length % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) { j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
  words[words.length] = ((len / maxWord) | 0); words[words.length] = (len);
  for (j = 0; j < words.length;) {
    const w = words.slice(j, j += 16), oldHash = hash; hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
      const temp1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
        (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash); hash[4] = (hash[4] + temp1) | 0; hash.pop();
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { const b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16); }
  return result;
}
const hashPass = (p, salt) => { let h = salt + '|' + p; for (let i = 0; i < 2000; i++) h = sha256(h + salt); return h; };

/* ---------- IndexedDB key-value store ---------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('sudarshanastra', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { DB.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  get(k) { return new Promise((res, rej) => { const t = DB.db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); },
  set(k, v) { return new Promise((res, rej) => { const t = DB.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  del(k) { return new Promise((res, rej) => { const t = DB.db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  keys() { return new Promise((res, rej) => { const t = DB.db.transaction('kv').objectStore('kv').getAllKeys(); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
};

/* ---------- App state ---------- */
const S = {
  settings: null,   // {user, salt, hash, theme, lockMins, mustChange}
  cases: [],        // [{id,name,fir,ps,io,ack,section,created,status,desc}]
  caseId: null,
  data: null,       // active case data
  page: 'dashboard', sub: {}
};
const emptyCase = () => ({ txns: [], kyc: [], social: [], ncrp: [], notes: [], tasks: [], idents: [], imports: [] });
let saveTimer = null;
function saveCase() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => { if (S.caseId) await DB.set('case:' + S.caseId, S.data); }, 300);
  Analysis.invalidate();
}
async function saveMeta() { await DB.set('settings', S.settings); await DB.set('cases', S.cases); await DB.set('caseId', S.caseId); }
const activeCase = () => S.cases.find(c => c.id === S.caseId) || {};

/* ---------- Field definitions ---------- */
// Each field: key, label, patterns (matched against normalised header text, in order)
const FIELDS = {
  txn: [
    ['ack_no', 'Acknowledgement / Complaint No', ['acknowledgement', 'ackno', 'acknowledge', 'complaintno', 'complaintid']],
    ['layer', 'Layer', ['layer', 'level']],
    ['from_acc', 'From Account / Sender', ['accountnowalletpgpaid', 'fromaccount', 'senderaccount', 'remitteraccount', 'debitaccount', 'payeraccount', 'victimaccount', 'fromacc', 'sourceaccount']],
    ['from_name', 'From Name', ['fromname', 'sendername', 'remittername', 'payername', 'victimname', 'debitorname']],
    ['from_bank', 'From Bank', ['frombank', 'senderbank', 'remitterbank', 'payerbank', 'victimbank']],
    ['from_ifsc', 'From IFSC', ['fromifsc', 'senderifsc', 'remitterifsc', 'payerifsc']],
    ['to_acc', 'To Account / Beneficiary', ['beneficiaryaccount', 'toaccount', 'creditaccount', 'payeeaccount', 'receiveraccount', 'beneficiaryacc', 'beneaccount', 'accountnumber', 'accountno', 'acno', 'accno', 'account']],
    ['to_name', 'To / Beneficiary Name', ['beneficiaryname', 'payeename', 'receivername', 'toname', 'benename', 'accountholdername', 'accountholder', 'customername', 'merchantname', 'name']],
    ['to_bank', 'To Bank', ['bankwalletpgpamerchant', 'beneficiarybank', 'tobank', 'payeebank', 'receiverbank', 'bankname', 'bankfis', 'bank']],
    ['to_ifsc', 'To IFSC', ['beneficiaryifsc', 'toifsc', 'payeeifsc', 'ifsccode', 'ifsc']],
    ['amount', 'Transaction Amount', ['transactionamount', 'txnamount', 'transferamount', 'amount', 'amt']],
    ['disputed', 'Disputed Amount', ['disputedamount', 'disputed', 'fraudamount']],
    ['hold', 'Put on Hold / Lien Amount', ['putonholdamount', 'holdamount', 'lienamount', 'onhold', 'freezeamount', 'hold']],
    ['date', 'Transaction Date', ['transactiondate', 'txndate', 'dateoftransaction', 'transactiondatetime', 'valuedate', 'date']],
    ['txn_id', 'UTR / Transaction ID / RRN', ['transactionidutr', 'utrnumber', 'utrno', 'utr', 'transactionid', 'txnid', 'rrn', 'referenceno', 'refno', 'reference']],
    ['mode', 'Mode (UPI/IMPS/NEFT/ATM)', ['mode', 'channel', 'paymentmode', 'transactiontype', 'txntype', 'type']],
    ['action', 'Action Taken by Bank', ['actiontakenbybank', 'actiontaken', 'action', 'status']],
    ['atm_loc', 'ATM / Withdrawal Location', ['atmlocation', 'atmid', 'withdrawallocation', 'branchlocation', 'tid', 'location', 'place']],
    ['mobile', 'Mobile', ['mobile', 'phone', 'contact', 'msisdn', 'cellno']],
    ['email', 'Email', ['email', 'mail']],
    ['pan', 'PAN', ['pan']],
    ['aadhaar', 'Aadhaar', ['aadhaar', 'aadhar', 'uid']],
    ['state', 'State', ['state']],
    ['district', 'District', ['district', 'city']],
    ['remarks', 'Remarks / Narration', ['remarks', 'narration', 'description', 'particulars', 'details', 'comment']]
  ],
  kyc: [
    ['acc', 'Account Number', ['accountnumber', 'accountno', 'acno', 'accno', 'account', 'walletid']],
    ['name', 'Account Holder Name', ['accountholdername', 'customername', 'holdername', 'beneficiaryname', 'name']],
    ['bank', 'Bank', ['bankname', 'bank']],
    ['ifsc', 'IFSC', ['ifsc']],
    ['branch', 'Branch', ['branch']],
    ['mobile', 'Mobile', ['registeredmobile', 'mobile', 'phone', 'contact', 'msisdn']],
    ['email', 'Email', ['registeredemail', 'email', 'mail']],
    ['pan', 'PAN', ['pan']],
    ['aadhaar', 'Aadhaar', ['aadhaar', 'aadhar', 'uid']],
    ['address', 'Address', ['address', 'addr']],
    ['state', 'State', ['state']],
    ['district', 'District', ['district', 'city']],
    ['pincode', 'PIN Code', ['pincode', 'pin', 'postal', 'zip']],
    ['open_date', 'Account Opening Date', ['openingdate', 'opendate', 'dateofopening', 'accountopen']],
    ['balance', 'Balance', ['balance', 'availablebalance']],
    ['ip', 'IP Address (login/registration)', ['ipaddress', 'ip']],
    ['device', 'Device / IMEI', ['imei', 'device']],
    ['linked', 'Linked Accounts / UPI', ['linked', 'upi', 'vpa']],
    ['ack_no', 'Acknowledgement No', ['acknowledgement', 'ackno', 'complaint']],
    ['remarks', 'Remarks', ['remarks', 'comment', 'note']]
  ],
  stmt: [
    ['date', 'Date', ['transactiondate', 'txndate', 'tranDate', 'postdate', 'valuedate', 'date']],
    ['narration', 'Narration / Description', ['narration', 'description', 'particulars', 'details', 'remarks', 'transactiondetails']],
    ['ref', 'Ref / Cheque / UTR', ['chqrefno', 'refno', 'reference', 'chequeno', 'chqno', 'utr', 'transactionid', 'refchqno']],
    ['debit', 'Debit / Withdrawal', ['withdrawalamt', 'withdrawal', 'debit', 'dr', 'paidout']],
    ['credit', 'Credit / Deposit', ['depositamt', 'deposit', 'credit', 'cr', 'paidin']],
    ['amount', 'Amount (single column)', ['amount', 'amt']],
    ['drcr', 'Dr/Cr indicator', ['drcr', 'crdr', 'type', 'indicator']],
    ['balance', 'Balance', ['closingbalance', 'balance', 'bal']]
  ],
  social: [
    ['platform', 'Platform', ['platform', 'app', 'service', 'source']],
    ['request_ref', 'Request / Case Ref', ['requestid', 'caseref', 'requestref', 'ticket', 'reference']],
    ['profile', 'Profile / Username / Account ID', ['username', 'userid', 'profileid', 'accountid', 'profileurl', 'handle', 'profile', 'targetaccount', 'account', 'url', 'id']],
    ['name', 'Display / Registered Name', ['displayname', 'registeredname', 'fullname', 'name']],
    ['mobile', 'Mobile', ['mobile', 'phone', 'contact', 'msisdn']],
    ['email', 'Email', ['email', 'mail']],
    ['imei', 'IMEI', ['imei']],
    ['device', 'Device / Model / OS', ['devicemodel', 'device', 'model', 'useragent', 'os']],
    ['ip', 'IP Address', ['ipaddress', 'ip']],
    ['port', 'Port', ['port']],
    ['ip_time', 'IP Timestamp', ['timestamp', 'logintime', 'datetime', 'time', 'date']],
    ['reg_date', 'Registration / Creation Date', ['registration', 'creation', 'created', 'joined']],
    ['address', 'Address / Location', ['address', 'location', 'city']],
    ['linked', 'Linked Accounts / Groups', ['linked', 'groups', 'associated']],
    ['remarks', 'Remarks', ['remarks', 'note', 'comment']]
  ],
  ncrp: [
    ['ack_no', 'Acknowledgement No', ['acknowledgement', 'ackno', 'complaintid', 'complaintno']],
    ['date', 'Complaint Date', ['complaintdate', 'dateofcomplaint', 'reporteddate', 'incidentdate', 'date']],
    ['victim_name', 'Complainant / Victim Name', ['complainantname', 'victimname', 'complainant', 'victim']],
    ['victim_mobile', 'Complainant Mobile', ['complainantmobile', 'victimmobile', 'complainantphone']],
    ['state', 'State', ['state']],
    ['district', 'District', ['district']],
    ['ps', 'Police Station', ['policestation', 'ps', 'thana']],
    ['category', 'Category', ['category', 'crimetype', 'fraudtype']],
    ['sub_category', 'Sub Category', ['subcategory']],
    ['amount', 'Amount Lost / Reported', ['amountlost', 'fraudamount', 'totalamount', 'reportedamount', 'amount']],
    ['hold_amount', 'Amount on Hold', ['holdamount', 'lienamount', 'putonhold', 'hold']],
    ['suspect_mobile', 'Suspect Mobile', ['suspectmobile', 'suspectphone', 'fraudstermobile', 'suspectnumber']],
    ['suspect_acc', 'Suspect Account', ['suspectaccount', 'suspectbank', 'fraudsteraccount']],
    ['suspect_upi', 'Suspect UPI / Wallet', ['suspectupi', 'upi', 'vpa', 'wallet']],
    ['suspect_url', 'Suspect URL / App / Handle', ['suspecturl', 'url', 'website', 'app', 'handle', 'socialmedia']],
    ['suspect_email', 'Suspect Email', ['suspectemail', 'email']],
    ['status', 'Status', ['status', 'stage']],
    ['remarks', 'Remarks / Brief', ['remarks', 'brief', 'description', 'details', 'facts']]
  ]
};
const fieldLabel = (type, key) => (FIELDS[type].find(f => f[0] === key) || [key, key])[1];

/* ---------- Normalisers ---------- */
const N = {
  hdr: s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  acc: s => { s = String(s ?? '').trim().toUpperCase().replace(/^'+/, '').replace(/[\s\-]/g, ''); if (/^\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, ''); if (/^\d+E\+\d+$/.test(s)) s = Number(s).toFixed(0); return s; },
  ack: s => { const v = N.acc(s); return /^\d+$/.test(v) || /^[A-Z0-9]+$/.test(v) ? v : N.text(s); },
  mobile: s => { const d = String(s ?? '').replace(/\D/g, ''); if (d.length >= 10) return d.slice(-10); return d; },
  email: s => String(s ?? '').trim().toLowerCase(),
  pan: s => String(s ?? '').trim().toUpperCase().replace(/\s/g, ''),
  aadhaar: s => String(s ?? '').replace(/\D/g, ''),
  ifsc: s => String(s ?? '').trim().toUpperCase().replace(/\s/g, ''),
  text: s => String(s ?? '').trim().replace(/\s+/g, ' '),
  upper: s => String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase(),
  imei: s => String(s ?? '').replace(/\D/g, '').slice(0, 15),
  ip: s => String(s ?? '').trim().replace(/^\[|\]$/g, '').replace(/:\d+$/, m => (String(s).split(':').length > 2 ? m : '')),
  amount(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    let s = String(v).replace(/[₹,\s]|INR|Rs\.?/gi, '');
    let neg = /^\(.*\)$/.test(s) || /^-/.test(s); s = s.replace(/[()\-]/g, '');
    s = s.replace(/(cr|dr)\.?$/i, '');
    const n = parseFloat(s); if (isNaN(n)) return null; return neg ? -n : n;
  },
  date(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 16).replace('T', ' ').replace(' 00:00', '');
    if (typeof v === 'number' && v > 20000 && v < 80000) { // Excel serial
      const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 16).replace('T', ' ').replace(' 00:00', '');
    }
    const s = String(v).trim();
    const mon = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
    let m, y, mo, d, t = '';
    const tm = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
    if (tm) { let h = +tm[1]; if (tm[4]) { const pm = /p/i.test(tm[4]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; } t = ' ' + String(h).padStart(2, '0') + ':' + tm[2]; }
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})[-\/. ](\d{1,2})[-\/. ](\d{2,4})/))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (mo > 12 && d <= 12) [d, mo] = [mo, d]; }
    else if ((m = s.match(/^(\d{1,2})[-\/ ]?([A-Za-z]{3,9})[-\/ ,]*(\d{2,4})/))) { d = +m[1]; mo = mon[m[2].toLowerCase().slice(0, m[2].length > 3 && m[2].toLowerCase().startsWith('sept') ? 4 : 3)]; y = +m[3]; }
    else if ((m = s.match(/^([A-Za-z]{3,9})[-\/ ](\d{1,2}),?[-\/ ](\d{2,4})/))) { mo = mon[m[1].toLowerCase().slice(0, 3)]; d = +m[2]; y = +m[3]; }
    else return s;
    if (!mo || !d || !y) return s;
    if (y < 100) y += 2000;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}${t === ' 00:00' ? '' : t}`;
  }
};
const isDateLike = s => /^\s*(\d{1,2}[-\/. ](\d{1,2}|[A-Za-z]{3,9})[-\/. ,]*\d{2,4}|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/.test(String(s ?? ''));

/* ---------- Reference data ---------- */
const BANKS = {
  SBIN: 'State Bank of India', HDFC: 'HDFC Bank', ICIC: 'ICICI Bank', UTIB: 'Axis Bank', PUNB: 'Punjab National Bank', BARB: 'Bank of Baroda',
  CNRB: 'Canara Bank', UBIN: 'Union Bank of India', BKID: 'Bank of India', IDIB: 'Indian Bank', IOBA: 'Indian Overseas Bank', UCBA: 'UCO Bank',
  MAHB: 'Bank of Maharashtra', CBIN: 'Central Bank of India', PSIB: 'Punjab & Sind Bank', KKBK: 'Kotak Mahindra Bank', YESB: 'Yes Bank',
  INDB: 'IndusInd Bank', IDFB: 'IDFC First Bank', FDRL: 'Federal Bank', KARB: 'Karnataka Bank', SIBL: 'South Indian Bank', RATN: 'RBL Bank',
  AUBL: 'AU Small Finance Bank', ESFB: 'Equitas Small Finance Bank', UJVN: 'Ujjivan Small Finance Bank', JAKA: 'Jammu & Kashmir Bank',
  PYTM: 'Paytm Payments Bank', AIRP: 'Airtel Payments Bank', FINO: 'Fino Payments Bank', IPOS: 'India Post Payments Bank', NSPB: 'NSDL Payments Bank',
  JIOP: 'Jio Payments Bank', DBSS: 'DBS Bank India', HSBC: 'HSBC', SCBL: 'Standard Chartered', CITI: 'Citibank', DLXB: 'Dhanlaxmi Bank',
  CSBK: 'CSB Bank', TMBL: 'Tamilnad Mercantile Bank', KVBL: 'Karur Vysya Bank', BDBL: 'Bandhan Bank', SURY: 'Suryoday SFB', ESMF: 'ESAF SFB',
  UTKS: 'Utkarsh SFB', JSFB: 'Jana SFB', NESF: 'North East SFB', CIUB: 'City Union Bank', DCBL: 'DCB Bank', IBKL: 'IDBI Bank', NKGS: 'NKGSB Co-op Bank',
  SVCB: 'SVC Co-op Bank', SRCB: 'Saraswat Co-op Bank', COSB: 'Cosmos Co-op Bank', ABHY: 'Abhyudaya Co-op Bank', PMCB: 'PMC Bank',
  PRTH: 'Prathama UP Gramin Bank', BARU: 'Baroda UP Bank', ALLA: 'Allahabad Bank (now Indian Bank)', ORBC: 'Oriental Bank of Commerce (now PNB)',
  SYNB: 'Syndicate Bank (now Canara)', CORP: 'Corporation Bank (now Union)', ANDB: 'Andhra Bank (now Union)', VIJB: 'Vijaya Bank (now BoB)',
  DNSB: 'Dombivli Nagari Sahakari Bank', HPSC: 'HP State Co-op Bank', APGV: 'Andhra Pragathi Grameena Bank', SBBJ: 'SBBJ (now SBI)', SPCB: 'Surat People\'s Co-op'
};
const UPI_HANDLES = {
  okaxis: 'Google Pay (Axis)', oksbi: 'Google Pay (SBI)', okhdfcbank: 'Google Pay (HDFC)', okicici: 'Google Pay (ICICI)',
  ybl: 'PhonePe (Yes Bank)', ibl: 'PhonePe (ICICI)', axl: 'PhonePe (Axis)', paytm: 'Paytm', ptyes: 'Paytm (Yes)', ptaxis: 'Paytm (Axis)',
  pthdfc: 'Paytm (HDFC)', ptsbi: 'Paytm (SBI)', upi: 'BHIM / NPCI', apl: 'Amazon Pay', yapl: 'Amazon Pay (Yes)', rapl: 'Amazon Pay (RBL)',
  ikwik: 'MobiKwik', freecharge: 'Freecharge', axisbank: 'Axis Bank', sbi: 'SBI', icici: 'ICICI Bank', hdfcbank: 'HDFC Bank', kotak: 'Kotak',
  kmbl: 'Kotak', jupiteraxis: 'Jupiter (Axis)', fbl: 'Federal Bank', airtel: 'Airtel Payments Bank', jio: 'Jio', pnb: 'PNB', barodampay: 'Bank of Baroda',
  unionbank: 'Union Bank', cnrb: 'Canara Bank', indus: 'IndusInd', idfcbank: 'IDFC First', yesbank: 'Yes Bank', postbank: 'India Post Payments Bank',
  slice: 'Slice', superyes: 'super.money (Yes)', naviaxis: 'Navi (Axis)', waaxis: 'WhatsApp Pay (Axis)', wahdfcbank: 'WhatsApp Pay (HDFC)',
  wasbi: 'WhatsApp Pay (SBI)', waicici: 'WhatsApp Pay (ICICI)', fam: 'FamPay', cred: 'CRED', axisb: 'CRED (Axis)', abfspay: 'Aditya Birla'
};
const bankFromIfsc = ifsc => { ifsc = N.ifsc(ifsc); return BANKS[ifsc.slice(0, 4)] || ''; };

/* ---------- Validators ---------- */
const V = {
  ifsc: s => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(N.ifsc(s)),
  pan: s => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(N.pan(s)),
  panType: s => ({ P: 'Individual', C: 'Company', H: 'HUF', F: 'Firm / LLP', A: 'Association of Persons', T: 'Trust', B: 'Body of Individuals', L: 'Local Authority', J: 'Artificial Juridical Person', G: 'Government' }[N.pan(s)[3]] || 'Unknown'),
  verhoeff(num) {
    const d = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]];
    const p = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]];
    let c = 0; const a = String(num).split('').reverse().map(Number);
    for (let i = 0; i < a.length; i++) c = d[c][p[i % 8][a[i]]];
    return c === 0;
  },
  aadhaar: s => { const a = N.aadhaar(s); return /^[2-9]\d{11}$/.test(a) && V.verhoeff(a); },
  luhn(s) { const a = String(s).replace(/\D/g, ''); let t = 0; for (let i = 0; i < a.length; i++) { let n = +a[a.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; },
  imei: s => { const a = N.imei(s); return a.length === 15 && V.luhn(a); },
  mobile: s => /^[6-9]\d{9}$/.test(N.mobile(s)),
  email: s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim()),
  ipKind(ip) {
    ip = String(ip).trim();
    if (ip.includes(':')) { if (/^fe80/i.test(ip)) return 'IPv6 link-local'; if (/^f[cd]/i.test(ip)) return 'IPv6 private'; if (ip === '::1') return 'Loopback'; return 'IPv6 public'; }
    const p = ip.split('.').map(Number); if (p.length !== 4 || p.some(x => isNaN(x) || x > 255)) return 'Invalid';
    if (p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168)) return 'Private (LAN)';
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return 'CGNAT (shared - needs port + time)';
    if (p[0] === 127) return 'Loopback'; if (p[0] === 169 && p[1] === 254) return 'Link-local';
    return 'IPv4 public';
  }
};

/* ---------- Identifier extraction (free text) ---------- */
const RX = {
  email: /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g,
  upi: /\b[A-Za-z0-9._\-]{2,}@[A-Za-z]{2,}\b(?!\.)/g,
  mobile: /(?<![\d])(?:\+?91[\-\s]?|0)?[6-9]\d{4}[\-\s]?\d{5}(?![\d])/g,
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  ipv6: /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g,
  pan: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
  ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
  aadhaar: /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g,
  imei: /\b\d{15}\b/g,
  account: /\b\d{9,18}\b/g,
  url: /\bhttps?:\/\/[^\s"'<>]+|\bwww\.[^\s"'<>]+/gi,
  utr: /\b[A-Z]{4}[A-Z0-9]{12,18}\b/g
};
function extractIdentifiers(text) {
  const out = []; const seen = new Set();
  const add = (type, value) => { const k = type + '|' + value; if (!seen.has(k)) { seen.add(k); out.push({ type, value }); } };
  const emails = text.match(RX.email) || [];
  emails.forEach(e => add('email', e.toLowerCase()));
  (text.match(RX.upi) || []).forEach(u => { const h = u.split('@')[1].toLowerCase(); if (!emails.some(e => e.startsWith(u.toLowerCase())) && (UPI_HANDLES[h] || !h.includes('.'))) add('upi', u.toLowerCase()); });
  (text.match(RX.url) || []).forEach(u => add('url', u.replace(/[).,;]+$/, '')));
  (text.match(RX.ipv4) || []).forEach(ip => add('ip', ip));
  (text.match(RX.ipv6) || []).forEach(ip => { if (ip.split(':').length > 3) add('ip', ip.toLowerCase()); });
  (text.match(RX.pan) || []).forEach(p => add('pan', p));
  (text.match(RX.ifsc) || []).forEach(p => add('ifsc', p));
  const used = new Set();
  (text.match(RX.imei) || []).forEach(n => { if (V.luhn(n)) { add('imei', n); used.add(n); } });
  (text.match(RX.aadhaar) || []).forEach(a => { const d = a.replace(/\s/g, ''); if (V.verhoeff(d)) { add('aadhaar', d); used.add(d); } });
  (text.match(RX.mobile) || []).forEach(m => { const d = N.mobile(m); if (V.mobile(d)) { add('mobile', d); used.add(m.replace(/\D/g, '')); } });
  (text.match(RX.account) || []).forEach(a => { if (!used.has(a) && !(a.length === 10 && /^[6-9]/.test(a)) && !(a.length === 12 && /^91[6-9]/.test(a))) add('account', a); });
  return out;
}
