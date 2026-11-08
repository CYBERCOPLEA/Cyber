# Sudarshanastra – Cyber Crime Case Analysis & Tracking

Offline tool for analysing cyber-fraud cases: NCRP complaints, layer-wise money trail,
bank statements and KYC, social media replies, mule-account flags, notices and reports.

## How to use
- **One file:** download `Sudarshanastra.html` and double-click it (Chrome / Edge).
  No zip, no installation, no internet needed.
- First login: ID `admin`, password `admin@123` – change it at once.
- All case data stays inside the browser on your computer. Nothing is uploaded.
  Take regular backups: Case File & Notices → Reports & Export → Download backup.
- The login is a convenience lock, not strong encryption.

## Folders
| Path | What it is |
|---|---|
| `Sudarshanastra.html` | The complete tool in a single file (built from `src/`) |
| `index.html` | Opens `Sudarshanastra.html` (for a web link) |
| `src/` | Source: HTML, CSS, JavaScript, bundled libraries (SheetJS, PDF.js), user guide |
| `src/sample-data/` | Dummy sample files for testing – no real data |
| `tools/bundle.py` | Rebuilds the single file: `python3 tools/bundle.py src Sudarshanastra.html` |

**Never commit real case files, exports or backups to this repository.**
