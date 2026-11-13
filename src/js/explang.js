/* explang.js – English / हिन्दी / Bilingual switch for every export and report.
   Every print / PDF / Word / HTML window (DocEdit.popup) gets the switch in its bar; the Report / Export window asks it too.
   Headings, table headers and labels are translated; the data itself (names, numbers, accounts) is never changed. */
'use strict';
const ExpLang = {
  D: {
    'case': 'मामला', 'cases': 'मामले', 'all cases': 'सभी मामले', 'all cases report': 'सभी मामलों की रिपोर्ट', 'case report': 'मामले की रिपोर्ट', 'case analysis report': 'मामले की विश्लेषण रिपोर्ट', 'report': 'रिपोर्ट',
    'case particulars': 'मामले का विवरण', 'executive summary': 'संक्षिप्त सारांश', 'summary': 'सारांश', 'details': 'विवरण', 'brief facts': 'संक्षिप्त तथ्य',
    'fir': 'एफआईआर', 'fir no': 'एफआईआर संख्या', 'fir no.': 'एफआईआर संख्या', 'fir / case no': 'एफआईआर / मामला संख्या', 'fir / ack no.': 'एफआईआर / पावती संख्या', 'fir / case no.': 'एफआईआर / मामला संख्या',
    'police station': 'थाना', 'ps': 'थाना', 'police commissionerate': 'पुलिस कमिश्नरेट', 'district': 'जनपद', 'state': 'राज्य', 'address': 'पता', 'location': 'स्थान',
    'io': 'विवेचक', 'investigating officer': 'विवेचक अधिकारी', 'io contact': 'विवेचक संपर्क', 'designation': 'पद', 'enquiry officer': 'जाँच अधिकारी', 'eo': 'जाँच अधिकारी',
    'status': 'स्थिति', 'under investigation': 'विवेचनाधीन', 'pending': 'लंबित', 'completed': 'पूर्ण', 'charge sheet': 'आरोप पत्र', 'final report': 'अंतिम रिपोर्ट', 'cs': 'आरोप पत्र', 'fr': 'अंतिम रिपोर्ट', 'cs-ppi': 'आरोप पत्र (अग्रिम विवेचना लंबित)',
    'sections of law': 'धाराएँ', 'section': 'धारा', 'sections': 'धाराएँ', 'year': 'वर्ष', 'date': 'दिनांक', 'time': 'समय', 'date & time': 'दिनांक व समय', 'date / time': 'दिनांक / समय',
    'complaint': 'शिकायत', 'complaints': 'शिकायतें', 'complainant': 'शिकायतकर्ता', 'victim': 'पीड़ित', 'victims': 'पीड़ित', 'accused': 'अभियुक्त', 'suspect': 'संदिग्ध', 'suspects': 'संदिग्ध', 'category': 'श्रेणी', 'sub category': 'उप-श्रेणी',
    'ncrp ack no': 'एनसीआरपी पावती संख्या', 'ack no': 'पावती संख्या', 'ack no.': 'पावती संख्या', 'acknowledgement no.': 'पावती संख्या', 'acknowledgement no': 'पावती संख्या',
    'amount': 'राशि', 'amount lost': 'गई राशि', 'amount lost (₹)': 'गई राशि (₹)', 'reported loss': 'बताई गई हानि', 'loss': 'हानि', 'on hold': 'होल्ड राशि', 'on hold (₹)': 'होल्ड राशि (₹)', 'amount on hold': 'होल्ड की गई राशि', 'hold': 'होल्ड', 'hold amount': 'होल्ड राशि', 'hold vs loss': 'होल्ड बनाम हानि', 'disputed amount': 'विवादित राशि', 'total': 'योग', 'grand total': 'कुल योग',
    'transactions': 'लेन-देन', 'transaction': 'लेन-देन', 'transaction id': 'लेन-देन आईडी', 'utr': 'यूटीआर', 'utr no': 'यूटीआर संख्या', 'mode': 'माध्यम', 'payment mode': 'भुगतान माध्यम', 'debit': 'नामे', 'credit': 'जमा', 'balance': 'शेष', 'from': 'से', 'to': 'को', 'from account': 'प्रेषक खाता', 'to account': 'प्राप्तकर्ता खाता',
    'account': 'खाता', 'accounts': 'खाते', 'account no': 'खाता संख्या', 'account no.': 'खाता संख्या', 'account number': 'खाता संख्या', 'accounts traced': 'खोजे गए खाते', 'bank': 'बैंक', 'banks': 'बैंक', 'banks involved': 'संलिप्त बैंक', 'ifsc': 'आईएफएससी', 'branch': 'शाखा', 'holder': 'खाताधारक', 'account holder': 'खाताधारक', 'kyc': 'केवाईसी', 'pan': 'पैन', 'aadhaar': 'आधार',
    'layer': 'लेयर', 'layers': 'लेयर', 'layer-wise money trail': 'लेयर-वार धन प्रवाह', 'layer-wise trail': 'लेयर-वार धन प्रवाह', 'money trail': 'धन प्रवाह', 'bank-wise summary (for notices)': 'बैंक-वार सारांश (नोटिस हेतु)', 'bank-wise summary': 'बैंक-वार सारांश',
    'top suspect accounts': 'प्रमुख संदिग्ध खाते', 'high-risk accounts': 'उच्च जोखिम खाते', 'cash / atm accounts': 'नकद / एटीएम खाते', 'cash withdrawn': 'नकद निकासी', 'atm': 'एटीएम', 'cheque': 'चेक', 'score': 'स्कोर', 'risk': 'जोखिम', 'high': 'उच्च', 'medium': 'मध्यम', 'low': 'निम्न',
    'links between suspects': 'संदिग्धों के बीच संबंध', 'shared identifiers': 'साझा पहचानकर्ता', 'seen in more than one source:': 'एक से अधिक स्रोत में मिले:', 'social records': 'सोशल मीडिया रिकॉर्ड', 'social': 'सोशल मीडिया', 'social media': 'सोशल मीडिया', 'social media and sim (caf) findings': 'सोशल मीडिया एवं सिम (सीएएफ) निष्कर्ष',
    'pending tasks and notes': 'लंबित कार्य एवं टिप्पणियाँ', 'recommended actions': 'सुझाई गई कार्यवाही', 'annexure a – complaints': 'अनुलग्नक क – शिकायतें', 'annexure b – all suspect accounts (by risk)': 'अनुलग्नक ख – सभी संदिग्ध खाते (जोखिम अनुसार)', 'annexure c – layer-wise transactions': 'अनुलग्नक ग – लेयर-वार लेन-देन',
    'name': 'नाम', 'father': 'पिता', "father's name": 'पिता का नाम', 'mobile': 'मोबाइल', 'mobile no': 'मोबाइल संख्या', 'email': 'ईमेल', 'e-mail': 'ईमेल', 'imei': 'आईएमईआई', 'ip': 'आईपी', 'upi': 'यूपीआई', 'type': 'प्रकार', 'value': 'मान', 'source': 'स्रोत', 'found in': 'कहाँ मिला', 'remarks': 'टिप्पणी', 'note': 'टिप्पणी', 'notes': 'टिप्पणियाँ',
    'sr': 'क्र.', 'sr.': 'क्र.', 'sr no': 'क्र. सं.', 'sr. no.': 'क्र. सं.', 's.no.': 'क्र. सं.', 'no.': 'सं.', 'count': 'संख्या', 'records': 'रिकॉर्ड', 'rows': 'पंक्तियाँ', 'files': 'फ़ाइलें', 'file': 'फ़ाइल', 'page': 'पृष्ठ', 'none': 'कोई नहीं',
    'arrested': 'गिरफ्तार', 'wanted': 'वांछित', 'notice': 'नोटिस', 'notices': 'नोटिस', 'subject': 'विषय', 'letter no.': 'पत्र संख्या', 'signature': 'हस्ताक्षर', 'prepared by': 'द्वारा तैयार', 'by': 'द्वारा',
    'nodal': 'नोडल', 'escrow': 'एस्क्रो', 'target': 'लक्ष्य', 'targets': 'लक्ष्य', 'calls': 'कॉल', 'duration': 'अवधि', 'tower': 'टावर', 'operator': 'ऑपरेटर', 'device': 'उपकरण', 'platform': 'प्लेटफ़ॉर्म'
  },
  L: { en: 'English', hi: 'हिन्दी', bi: 'Bilingual' },
  get() { try { return (S.settings && S.settings.expLang) || 'en'; } catch (e) { return 'en'; } },
  set(m) { try { S.settings.expLang = m; saveMeta(); } catch (e) { } },
  key: t => t.replace(/\s+/g, ' ').trim().replace(/\s*:$/, '').toLowerCase(),
  hi(t) { const k = this.key(t); if (this.D[k]) return this.D[k] + (/:\s*$/.test(t) ? ':' : ''); return null; },
  /* phrases inside headings / table headers (longest first) */
  _rx: null,
  phr(t) { if (!this._rx) { const K = Object.keys(this.D).filter(k => k.length > 3).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); this._rx = new RegExp('\\b(' + K.join('|') + ')\\b', 'gi'); }
    let n = 0; const r = t.replace(this._rx, m => { n++; return this.D[m.toLowerCase()] || m; }); return n ? r : null; },
  HEAD: 'h1,h2,h3,h4,h5,th,caption,dt,label,.xm-h,.sec-t',
  apply(root, mode) {
    if (!root) return; const d = root.ownerDocument || document, tw = d.createTreeWalker(root, 4);
    const L = []; while (tw.nextNode()) L.push(tw.currentNode);
    L.forEach(n => { if (n.parentElement && n.parentElement.closest('#deBar,.np,script,style')) return;
      if (n._en == null) n._en = n.data; const en = n._en; if (!en.trim()) return;
      if (mode === 'en') { n.data = en; return; }
      let h = this.hi(en); if (h == null && n.parentElement && n.parentElement.closest(this.HEAD)) h = this.phr(en);
      if (h == null) { n.data = en; return; }
      const lead = en.match(/^\s*/)[0], tail = en.match(/\s*$/)[0];
      n.data = mode === 'hi' ? lead + h.trim() + tail : lead + en.trim() + ' / ' + h.trim() + tail; });
    try { d.documentElement.lang = mode === 'hi' ? 'hi' : 'en'; } catch (e) { }
  },
  /* the same on an HTML string (downloads made without a window) */
  html(h, mode) { if (!mode || mode === 'en') return h; const doc = new DOMParser().parseFromString(h, 'text/html'); this.apply(doc.body, mode); return '<!DOCTYPE html>' + doc.documentElement.outerHTML; },
  sel(id, cur) { return `<select id="${id}" title="Language of the report">${Object.entries(this.L).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>🌐 ${v}</option>`).join('')}</select>`; }
};
/* every print / PDF / Word / HTML window: the switch in its bar */
(() => {
  if (typeof DocEdit === 'undefined' || !DocEdit.popup) return;
  const op = DocEdit.popup; DocEdit.popup = function (w) {
    const r = op.apply(this, arguments);
    try { const d = w.document, bar = d.getElementById('deBar'), doc = d.getElementById('deDoc'); if (bar && doc && !d.getElementById('deLang')) {
      const row = bar.firstElementChild || bar; row.insertAdjacentHTML('beforeend', ExpLang.sel('deLang', ExpLang.get()));
      const s = d.getElementById('deLang'); s.onchange = () => { ExpLang.set(s.value); ExpLang.apply(doc, s.value); };
      if (ExpLang.get() !== 'en') ExpLang.apply(doc, ExpLang.get()); } } catch (e) { console.warn('explang', e); }
    return r;
  };
})();
