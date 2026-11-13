# SudarshanAshtra – Cyber Crime Case Analysis & Tracking

Offline tool for analysing cyber-fraud cases: NCRP complaints, layer-wise money trail,
bank statements and KYC, social media replies, mule-account flags, notices and reports.

## How to use
- **One file:** download `Sudarshanastra.html` and double-click it (Chrome / Edge).
  No zip, no installation, no internet needed.
- First login: ID `admin`, password `admin@123` – change it at once.
- All case data stays inside the browser on your computer. Nothing is uploaded.
  Take regular backups: Case File & Notices → Reports & Export → Download backup.
- The login is a convenience lock, not strong encryption.

## Desktop (Windows EXE)
- `desktop/` builds **SudarshanAshtra Desktop**, a Windows 10 / 11 setup that installs and works without internet.
- Each user needs a licence key from the Super Admin: Super Admin Control › 🖥 EXE Users › ➕ Add EXE User.
  A key is locked to one computer (Machine ID), has a category (Normal / Pro / Premium), valid dates and the left-panel
  sections ticked by the Super Admin. It is signed with a key made from the Super Admin key file – only the public key is in this repository.
- The ⬆ Update button in the EXE downloads the latest `User.html` from this site. A new setup is only needed when `desktop/` changes;
  the GitHub workflow `Desktop EXE` then builds it and puts it on the Releases page.

## Folders
| Path | What it is |
|---|---|
| `Sudarshanastra.html` | The complete tool in a single file (built from `src/`) |
| `index.html` | Opens `Sudarshanastra.html` (for a web link) |
| `src/` | Source: HTML, CSS, JavaScript, bundled libraries (SheetJS, PDF.js), user guide |
| `src/sample-data/` | Dummy sample files for testing – no real data |
| `desktop/` | Windows EXE (Electron): licence check, activation screen, ⬆ Update |
| `tools/bundle.py` | Rebuilds the single file: `python3 tools/bundle.py src Sudarshanastra.html` |

**Never commit real case files, exports or backups to this repository.**

## IFSC data
`data/ifsc-data.gz` is the public RBI bank branch list as published by github.com/razorpay/ifsc (MIT). The app loads it once and keeps it in the browser. With the offline HTML file, load it from IFSC Lookup → "Load IFSC database file".
