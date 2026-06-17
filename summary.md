## Goal
- Smart Comptable with cloud sync (Supabase), offline fallback, local Tesseract.js OCR, full Tunisian accounting suite – deployable to GitHub Pages without a separate backend server.

## Constraints & Preferences
- French UI labels throughout
- Must keep offline/localStorage fallback when Supabase unavailable
- Deploy via `npm run build` → copy `dist/index.html` → `dist/app.html` + landing → `npx gh-pages -d dist`
- Tesseract.js v7 core files served locally from `/tesseract/`; language data from CDN (`tessdata.projectnaptha.com`)
- No separate backend server – everything through Supabase
- Supabase Management API (`api.supabase.com/v1/projects/{ref}/database/query`) for SQL execution
- IRPP barème LF 2026: 5 tranches (0%, 26%, 28%, 32%, 35%), CSS supprimée, minimum d'imposition 45 DT/an
- User rejected Gemini API integration; wants pure open-source OCR (Tesseract + OpenCV-style preprocessing)
- **All raw invoice types must parse correctly** – user prioritizes multi-line table layout fix (labels and values on separate lines in PDF text extraction)

## Progress
### Done
- **TTN invoice OCR fully fixed** – all 5 corrections verified working in UI (Taux=12%, HT=135.500, TVA=16.260, TTC=152.260, Timbre=0.500)
  - **Fix A**: `corrigerFacture()` – added `detectTotalHT(text)` fallback for `recap.ht` → prevents garbage line-sum override (was HT=2.553)
  - **Fix B**: `corrigerFacture()` – replaced timbre extraction with `detectTimbre(text)` → handles "Dr de Timbre 0500" → 0.500 (was 500.000)
  - **Fix C**: `corrigerFacture()` – guard on `taux_tva` override: only override if `tauxUniques.size > 1` (mixed) or no existing rate; prevents garbage lines (tva=19) from overwriting formulaire rate 12%
  - **Fix D**: `App.jsx` – added `<option value="12">12%</option>` to Taux TVA dropdown (was missing)
  - **Fix E**: `parseMontantLettres()` – now parses **millimes** portion ("ET DEUX CENT SOIXANTE MILLIMES" → 260/1000 = 0.260)
- **WebP preprocessing fix** – `preprocessImage()` now tries browser decoding first; if decode succeeds → runs full preprocessing; if fails (VP8X WhatsApp WebP) → returns raw file for Tesseract/Leptonica
- **Quality thresholds relaxed** – `tesseractOcr.js` line 518: changed from `words<3 || alpha<2 || digits<2` to `words<2 || alpha<1 || digits<1`; line 529: `letterRatio<0.15` (was 0.30)
- **Fallback OCR pipeline** – `scanFacture()` now retries OCR on the original raw file if the preprocessed image returns 0 text
- **`isCleanDocument()`** – new histogram-based detection in `tesseractOcr.js` that skips `removeShadows()`, `localContrastEnhancement()`, and `denoise()` for clean high-contrast scans (light>60% + dark>1% + midtones<20%)
- **`facture-exemple-1.png` diagnosed** – Node.js OCR test confirmed it IS a readable E-INFO invoice (712 chars, 59% conf); the browser preprocessing pipeline was destroying the text; `isCleanDocument()` now fixes this
- **Value analysis fallback `analyseValeursFacture()`** – new function in `ocrParser.js` that infers HT, TTC, TVA, timbre, FODEC from numerical relationships when label-based regex patterns fail (works for table-layout PDFs)
- **`analyseValeursFacture()` handles FODEC** – when TVA is calculated on HT+FODEC (as with STEG), the analysis tests both with and without FODEC, scoring by total match to TTC
- **Value analysis integrated** – called from `corrigerFacture()` after recap extraction, filling in any missing values before the existing HT/TVA fallback
- **Multi-line patterns removed from `extraireRecapitulatif()`** – were unreliable (matched wrong DT values); replaced by the mathematical value analysis which is order-independent
- **Sample PDFs analyzed** – extracted text from STEG, STE Bonjour invoices; confirmed table-layout parsing gap resolved by value analysis
- **Build passes** – `npm run build` succeeds

## Current Parser Architecture
1. **Label-based patterns** (`extraireRecapitulatif()`): regex matches labels like "Total HT :" followed by `[\d\s,.]+` – works for most invoices where labels and values are on same/adjacent lines
2. **Value analysis** (`analyseValeursFacture()`): fallback when labels don't match – uses mathematical relationships (TTC ≈ HT + TVA + timbre) to infer values from all numbers in the text; handles both TVA-on-HT and TVA-on-HT+FODEC
3. **CorrigerFacture corrections**: post-processing corrections for specific invoice formats (TTN, etc.)

## Next Steps
1. **Test `facture-exemple-1.png`** – build is done; scan it in the app to verify `isCleanDocument()` fix works
2. Test the sample PDFs in the app – scan each PDF to verify value analysis works correctly
3. If results are still wrong – tune `analyseValeursFacture()` heuristics or add more label patterns
4. Fix encoding issue for `facture_prestation_rs.pdf` and `facture_ooredoo_telecom.pdf` (pdfminer.six encoding error with accents)
5. Handle the remaining invoice types from the audit list (thermal tickets, fuel receipts, telecom, bank slips)

## Critical Context
- **`facture-exemple-1.png`** (C:\Users\ezzin\Downloads) – E-INFO invoice; should now parse correctly with `isCleanDocument()` skipping aggressive preprocessing
- **Sample PDFs**: `facture_ste_bonjour_produits.pdf` (STE Bonjour, table layout, HT=884.425, TVA 13%, TTC=1000.000, timbre=0.600), `facture_steg_electricite.pdf` (STEG, FODEC 1%, TVA 13%, TTC=205.416), `facture_prestation_rs.pdf` + `facture_ooredoo_telecom.pdf` (encoding error)
- **Value analysis** mathematically verifies: for STE Bonjour remainder TTC-Ht=115.575 splits into TVA=114.975 (13%) + timbre=0.600 (score 0); for STEG remainder splits into TVA=23.632 (13% on HT+FODEC) + FODEC=1.800 (score 0)
- **Github Pages**: `https://salimezine.github.io/Smart-comptable/`
- **Supabase**: `xkpkmqlcxtlcdkmccbhs` (URL `https://xkpkmqlcxtlcdkmccbhs.supabase.co`)

## Relevant Files
- **`src/tesseractOcr.js`**: `preprocessImage()` – WebP browser decode with fallback; `isCleanDocument()` – histogram-based clean doc detection; `scanFacture()` – OCR fallback to raw file
- **`src/utils/ocrParser.js`**: `analyseValeursFacture()` – mathematical value analysis (new rewrite handles FODEC); `extraireRecapitulatif()` – simplified (no multi-line patterns); `corrigerFacture()` – value analysis integrated as fallback before existing HT/TVA fallback
- **`C:\Users\ezzin\Downloads\facture-exemple-1.png`**: E-INFO invoice, to be tested after build
- **`C:\Users\ezzin\Downloads\facture_ste_bonjour_produits.pdf`**, **`facture_steg_electricite.pdf`**, **`facture_prestation_rs.pdf`**, **`facture_ooredoo_telecom.pdf`**: Sample PDFs
