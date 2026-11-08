SUDARSHANASTRA – Cyber Crime Case Analysis & Tracking (offline)
==================================================================

HOW TO START
1. Extract (unzip) the whole "Sudarshanastra" folder to your computer, e.g. D:\Sudarshanastra
   (Do not run it from inside the zip.)
2. Double-click  index.html  – it opens in Google Chrome / Microsoft Edge. No internet, no installation needed.
3. First login:  ID = admin   Password = admin@123
   You will be asked to set your own ID and password at once (Settings).
4. Click "load demo data" on the Dashboard to see how everything works with dummy records.
   Then create a "+ New case" for real work.

FORGOT PASSWORD (works offline)
- When you set your own password, the app shows a one-time RECOVERY KEY (XXXX-XXXX-XXXX-XXXX).
  Write it down or print it and keep it safe. You can make a new one any time in Settings.
- Forgot your password? On the login page click "Forgot password?", type the recovery key and
  a new password. Each key works once; a new key is shown after use.
- Optional: you can also get a 6-digit code by e-mail (see next part).

FORGOT PASSWORD BY E-MAIL CODE (optional, needs internet only when the code is sent)
The app has no server, so it sends mail through your own free EmailJS account (emailjs.com,
free plan = 200 mails/month). Only the e-mail address and the 6-digit code are sent – never case data.
One-time setup (about 10 minutes):
 1. Go to https://www.emailjs.com and sign up (free).
 2. Email Services -> Add New Service -> Gmail -> "Connect account" with your own Gmail
    -> Create. Note the Service ID (looks like service_abc1234).
 3. Email Templates -> Create New Template:
      To Email : {{to_email}}
      Subject  : {{app_name}} password reset code
      Content  : Your code is {{passcode}}  (valid {{valid_minutes}} minutes)
                 Purpose: {{purpose}}   Requested: {{time}}
                 If you did not ask for this, someone is trying to reset your password.
    Save. Note the Template ID (template_xxxxxxx).
 4. Account -> General: copy the Public Key.
    Account -> Security: tick "Allow EmailJS API for non-browser applications" (needed because
    the app is opened as a file), and leave the domain allow-list empty.
 5. In Sudarshanastra: Settings -> "Forgot-password by e-mail code": check the e-mail, paste the
    Service ID, Template ID and Public Key, tick "Allow e-mail code on the login page",
    type your current password, Save. Click "Send test e-mail" to check it arrives.
Use: login page -> "Forgot password?" -> "E-mail me a code" -> Send code -> type the code and a
new password. Code is valid 10 minutes, 5 wrong tries cancel it, max 5 codes per hour.

MENU (in the order you investigate)
Overview      Dashboard
Investigation Complaints (NCRP) -> Money Trail -> Bank & Financial -> Social Media
Analysis      Analytics (Bulk Split & Rapid, Fast Movement, Cross-Link, Timeline, Hotspots ...)
Action        Case File & Notices (case details, notes, notice drafts, reports, tools)
The bar at the bottom always shows the open case and how much data is loaded.

SECTIONS (details)
Dashboard   Case summary, 5-step investigation checklist, complaints list, key figures and charts.
Money Trail Complaints found from the Acknowledgement No. column. For each complaint:
            Victim -> Layer 1 -> Layer 2 -> ... exactly as numbered in the bank action / NCRP
            trail sheet, with amount, date and arrows. Click a card to highlight its full path.
            Print / Save as PDF and CSV export.
1 Financial Import NCRP layer-wise money trail, bank transaction details, bank statements
            (CSV / Excel / digital PDF, also password-protected PDFs) and beneficiary/KYC details.
            - Layer-wise trail (layers read from file or worked out automatically)
            - Commonality: common account no., beneficiary, IFSC, bank, name, mobile, email,
              PAN, Aadhaar, state, district, address, IP, UTR, UPI – sortable A→Z / Z→A
            - Suspect accounts with a risk score (mule indicators)
            - Bank-wise and IFSC-wise summary (for notices)
            - Flow chart (layers), Mind map, Network graph – click any account; export PNG/SVG
2 Social    Import replies from WhatsApp, Facebook, Instagram, Threads, Google, X, Telegram etc.
            Common mobile, email, IMEI, IP, device, name; IP log analysis; link graph.
3 NCRP      Complaint Analysis: pick any complaint (Acknowledgement No) found in the imported money
            trail / bank action sheet / NCRP export and see:
            - beneficiary account, IFSC, bank, txn date, txn amount, UTR (sorted max -> min amount)
            - layer-wise totals (Victim -> Layer 1 -> Layer 2 ...) with a TOTAL row
            - nodal / escrow / payment-gateway / wallet accounts flagged
            - BULK SPLIT accounts (received money, sent it to many accounts) and RAPID pass-through
              accounts (sent money on within minutes) – limits can be changed on screen
            - flow chart, mind map and graph with moving "live" lines, amount, date and L1->L2 on
              every line. Point at a line to highlight it. Click a line to trace that
              transaction from the victim to the end. Click an account to trace the money
              from the victim to that account ("Show onward money too" adds the rest).
            - "Rows: Money Transfer to only" draws only Money Transfer rows (by the Action
              column, or a sheet named "Money Transfer to"); switch to All rows for ATM / hold.
            Also: complaint lists, summary charts, suspects repeated across complaints.
4 Analytics "Bulk Split & Rapid" tab checks the same flags across ALL complaints together.
4 Analytics Cross-Link (same identifier found in bank + social + NCRP data), entity graph,
            timeline & chronology, hotspots (state/district/PIN/ATM), fast money movement,
            patterns (fan-out, two-way transfers, round figures).
5 Others    Case details, case notes & tasks, Identifier Extractor (paste any text/PDF),
            validators (IFSC→bank, PAN type, Aadhaar & IMEI checksum, UPI handle→app, IP type),
            notice templates (bank KYC, debit freeze, intermediary, telecom, ATM CCTV),
            printable case report (Save as PDF), Excel export, backup/restore.

IMPORTING TIPS
- Any column names work: the tool guesses the columns and shows a mapping screen to correct them.
- Excel workbooks with many sheets: ALL sheets are read together. Each sheet's data type
  (money trail / statement / KYC / social / NCRP) and columns are detected separately.
  Untick any sheet you don't want, and type the account number for statement sheets.
- If a sheet has title lines above the table, set the correct "Header row" number.
- Scanned (image) PDFs have no text – ask the bank for Excel/CSV or a digital PDF.
- For bank statements you must type the account number the statement belongs to.
- Sample files are in the "sample-data" folder (all dummy data).

SECURITY – PLEASE READ
- All data stays inside this browser on this computer. Nothing is uploaded anywhere.
- The login is a convenience lock to keep casual users out. Data is NOT encrypted on disk;
  someone with access to your Windows account and technical skill could read it.
  Use a password-protected Windows login, lock the screen when away (Win+L),
  and keep backup files in a safe place.
- Data is tied to this browser. Clearing browser data / history "site data" will erase it.
  Take regular backups: Others → Reports & Export → Download backup.
- Notice templates are drafts. Check sections of law and format before signing.
- The risk score is a pointer for prioritising, not proof.

हिंदी में संक्षेप
- पासवर्ड भूल गए? लॉगिन पेज पर "Forgot password?" दबाएँ और अपनी रिकवरी की (recovery key) डालें,
  या (Settings में EmailJS सेट करने के बाद) अपने ई-मेल पर 6 अंकों का कोड मँगाएँ – इसके लिए इंटरनेट चाहिए।
- फ़ोल्डर को ज़िप से बाहर निकालें और index.html पर डबल-क्लिक करें (Chrome / Edge में खुलेगा)।
- पहला लॉगिन: ID admin, पासवर्ड admin@123 – तुरंत अपना पासवर्ड बदलें।
- सारा डेटा इसी कंप्यूटर के ब्राउज़र में रहता है, कहीं अपलोड नहीं होता। नियमित बैकअप लें।
- लॉगिन केवल सुविधा-लॉक है, मज़बूत एन्क्रिप्शन नहीं – विंडोज़ अकाउंट पर पासवर्ड रखें।
