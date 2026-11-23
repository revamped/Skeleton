# Suncor Site Survey: field app

A phone web app for the CRI / Suncor dealer site survey (`Suncor_Site_Survey_v1.1`). You fill the survey and take photos on site, and the app produces the finished upload package:

- the Word survey, filled in. Answers are in blue and ticked boxes show ☒, in the template's own layout. D02, C02, ER02 and so on get real copies of their pages.
- every photo already renamed `SiteID_ZoneID_NN_Description.jpg` and sorted into zone folders
- a Photo Register page in the report, plus a CSV of the same list
- the marked floor plan (PNG)
- `Open_Items.txt` (gaps and warnings) and `site_data.json` (raw data and backup)

**Hosted copy:** https://revamped.github.io/Skeleton/suncor-survey/ (once GitHub Pages serves this branch; see `builder/README.md`). It works offline after the first visit. On the phone, choose "Add to Home Screen".

## One-time setup (2 min)

1. Open the app, go to **Settings**, and enter your technician name.
2. Under **Blank survey template**, load `Suncor_Site_Survey_v1.1.docx`. The app checks that every field it fills exists in that file and refuses a different version.

## Per-site workflow

| Stage | Where | What you do | Time |
|---|---|---|---|
| Prep | Before leaving | **New site survey** → Site ID, address, contact. Load the floor plan (a screenshot of a PDF works). Add D02/D03 if you know the display count. | 3 min |
| Capture | On site | Work through each zone card: take the listed photos (each one is named the moment you take it), tap Yes/No/Unable chips, and type or dictate measurements. Mark IDs on the plan as you go. | 60 min |
| Close-out | Before leaving the lot | Open **Review**. Every gap links straight to its field or photo, so you can fix it while you're still at the site. | 5 min |
| Report | Car / office | Review the drafted Section 5 rows and write the overall observations. **Insert every "Unable to verify"** fills the outstanding-items list. Then **Build export ZIP** → Download / Share. | 10 min |
| QA | Laptop | Open the .docx, skim it, and upload the folder. | 5 min |

Offline admin goes from about 90 minutes to 15–20. Nearly all of the saving comes from photos already being named, sorted and referenced in the right fields.

## What is automatic

- **Photo names and IDs.** Photos are numbered per zone in checklist order. Deleting or retaking one renumbers the rest, so there are never gaps. Photo-ID fields ("Label photograph filename", "…/ photo ID" lines, the required-photo lists) fill themselves.
- **ID lines.** "Site ID / Display ID / area" is built from your entries.
- **Section 5 table.** There is one row per display × (current position, each C, each E), drafted from your answers (size vs max usable size, view, viability, work items). Each row is marked *draft* until you confirm or edit it.
- **Section 6.** The photo checklist (Captured/Missing/N/A), the folder/missing-photo line, all five quality checks and the signature line are filled from what you actually captured and answered.
- **Conditional fields.** "If yes…" fields that don't apply are written as N/A.
- **Checks.** These are listed on the Review screen:
  - "Unable to verify" or "Other" given without a reason
  - measurements with no unit
  - HDMI port counts that don't add up
  - Port 5 answered when no MX67 was found
  - an internet "Pass" below the CDM minimum of 25/5 Mbps
  - a ≤100 ft route answer that contradicts the length you typed
  - "Viable" marked despite mounting restrictions
  - IDs that aren't marked on the plan

## Install-guide facts shown as hints

These come from the CDM Suncor Install Guide FLEX SE 2.7:

- cash-zone screens sit about 82 in from floor to bottom, aligned with the security monitors
- end-cap screens sit about 6 in above merchandise
- the player connects to Port 5 of the Suncor MX67; nothing goes in the Suncor rack
- the Suncor network cabinet is locked; the code may default to the 3 digits of the store number
- the internet connection needs at least 25 Mbps down / 5 Mbps up
- the player feeds HDMI 1, and screens need a LAN port for remote monitoring

## Data and privacy

Surveys, photos, the template and floor plans are stored in the phone browser's IndexedDB and are never uploaded. Export each finished survey, then delete it from the phone. The optional **Copy AI review prompt** copies only text answers to the clipboard (no photos, phone or email) for an assistant to proofread. You apply any changes yourself.

## Files

| File | Role |
|---|---|
| `js/schema.js` | Every survey field, using the exact label text from the .docx, plus the photo checklist per zone |
| `js/model.js` | Composes answers, names photos, drafts Section 5, runs the review checks |
| `js/docx-fill.js` | Fills the template XML in place (keeps the template's formatting) and clones pages for extra zones |
| `js/store.js` | IndexedDB storage |
| `js/app.js` | Screens and capture flow |

If CRI issues a new template version, update the `label` strings in `schema.js`. The Settings check will show any label it can't find.
