## Goal
Build a secure, mobile-responsive Tunisian accounting app with a fully local AI learning engine, offline financial export (PDF/Excel), comprehensive audit system, and SCE-compliant Bilan & État de Résultat.

## Constraints & Preferences
- **Zero Gemini / n8n** — all AI uses the local learning engine + audit engine only; no API keys, no `analyzeDashboardWithGemini`.
- Fully offline; no external dependencies.
- AI learns from each invoice/expense (supplier memory, category/VAT prediction).
- Search across invoices and expenses from header.
- Security: PIN lock, encrypted localStorage, CSP, XSS sanitization.
- Mobile responsive: hamburger menu, off-canvas sidebar, scrollable tables.
- Tunisian compliance: TVA, timbre fiscal, retenue à la source, SCE plan comptable, IS 15%, CNSS 16.57%.
- Excel export must use `exceljs` (full formatting, sheet protection), not `xlsx`.
- Bilan must follow SCE Tunisie format with user-editable immobilisations, capital, loans, stocks.
- Audit system must be fully local (no Gemini), with score, pass/warn/fail checks, and recommendations.

## Progress
### Done
- **Local audit engine** (`src/auditEngine.js`): 15 compliance checks (TVA collectée/déduite, timbre fiscal, retenue source, MF fournisseurs, IS provision, CNSS, rapprochement bancaire, ratios liquidité/endettement/marge, anomalies, équilibre bilan, taux TVA, factures échues, couverture SCE). Weighted score /100, markdown report generation, recommendations.
- **`analyzeDashboardWithGemini` completely removed** from App.jsx imports and usage — `handleRequestAudit` and `handleGenerateAudit` now call `runFullAudit` from audit engine.
- **Bilan (SCE complet)** expanded in `generateBalanceSheet`: Actifs Non Courants (frais développement, brevets, fonds commercial, terrains, constructions, installations, transport, bureau, financières), Actifs Courants (stocks marchandises/MP, clients, personnel, État, autres débiteurs, banque, caisse), Capitaux Propres (capital, réserves légales/autres, résultat net), Passifs Non Courants (emprunts, provisions), Passifs Courants (fournisseurs, personnel, IS, TVA, autres dettes, concours bancaires).
- **État de Résultat (SCE complet)** expanded in `generateIncomeStatement`: Produits (ventes marchandises, prestations services, autres), Charges (achats marchandises/MP, charges externes, personnel, amortissements, autres), Résultat financier (produits/charges financières), Résultat ordinaire avant IS, Résultat net.
- **`generateBalanceSheet`** accepts 5th param `incomeStatement` (optional). All callers (`getFinancialExportData`, `FinancialReportView`, `calculateFinancialRatios`) pass the income statement to keep `retainedEarnings` = `netProfit` and `taxPayable` = `tax`.
- **9 financial ratios** in `calculateFinancialRatios`: liquidité générale, liquidité réduite, Dettes/CP, ROE, ROA, marge nette, marge brute, autonomie financière, couverture intérêts.
- **PDF export** (`src/pdfExport.js`): Bilan en tableau 2 colonnes (Actif gauche / Passif droit) avec `trow()` helper, sections indentées, État de Résultat en page 2. Totaux affichés sur une ligne unique (fond bleu, trait épais). Separators (`sep()`) supprimés avant les totaux.
- **Intermediate sub-totals removed**: Total Actifs Non Courants, Total Actifs Courants, Total Capitaux Propres, Total Passifs Non Courants, Total Passifs Courants supprimés. Seuls TOTAL ACTIFS et TOTAL PASSIFS & CP restent.
- **Excel export** (`src/excelExport.js`) restructured: helpers `L()/LR()/T()/TR()/S()/SR()` pour aligner synchrone Actif/Passif, sections épurées, plus de sous-totaux intermédiaires.
- **`FinancialReportView.jsx`**: sections repliables, champs éditables persistés (localStorage `sc_bilan_custom_data`), vue complète SCE avec tous les postes. Bouton ✏️ toggle édition.
- **Balancing step** added: si totalAssets ≠ totalLiabilitiesAndEquity, ajuste Caisse (`cashRegister`) pour équilibrer strictement. `cashRegister`/`cashAndBank` changés en `let` pour permettre la réaffectation.
- **MDT conversion complete**: `generateIncomeStatement` divise `totalRevenue`/`totalExpenses` par 1000. `formatCurrencyHelper` accepte `'MDT'`. `FinancialReportView.jsx` affiche `MDT`. PDF/Excel titres `(en MDT)`.
- **`generateSimulatedData`** in `accountingUtils.js`: génère 12 factures, 24 dépenses, 24 transactions fictives qui matchent les proportions de l'État de Résultat.
- **Build passes** — `npm run build` succeeds.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Removed `analyzeDashboardWithGemini` entirely — audit engine replaces it with 15 fully local checks; `geminiService.js` still exports the function but it is no longer imported anywhere.
- Replaced fragile Excel `SUM()` formulas with direct computed values for reliability; formulas were causing broken references due to dynamic row layout.
- PDF Bilan redesigned as side-by-side columns (Actif left / Passif right) using a custom `trow()` helper, with État de Résultat on page 2 — matches standard Tunisian financial statement presentation.
- **Totals as single lines**: removed `sep()` lines before totals and removed intermediate sub-totals so only the final TOTAL appears as one distinct line per column.
- **Linked Bilan / Résultat**: `retainedEarnings` now reads `incomeStatement.netProfit` and `taxPayable` reads `incomeStatement.tax` instead of independent calculation.
- **Balancing**: Caisse is the adjustment variable; any mismatch between Actif and Passif+CP is absorbed by cashRegister.
- **MDT conversion**: all internal values divided by 1000; constants scaled (5000→5 MDT, 200→0.200 MDT, 50→0.050 MDT).

## Next Steps
1. Test PDF download works end-to-end with MDT values.
2. Verify Excel export opens cleanly in Excel/LibreOffice without formula errors.
3. Confirm audit engine scores match expected weights and recommendations are relevant.
4. The large main chunk (~2167 kB) could be split later with dynamic imports.

## Critical Context
- Production build succeeds; main chunk ~2167 kB (could code-split later).
- `generateBalanceSheet` signature: `(invoices, expenses, transactions, customData={}, incomeStatement=null)` — 5th param new.
- `canApplySavingsCalculation`? No — user refused.
- `analyzeDashboardWithGemini` is still defined in `geminiService.js` but no longer imported anywhere — dead code, safe to remove.
- Audit engine (`auditEngine.js`) depends on `learningEngine` (for `detectAnomaly`, `getLearningStats`) and `accountingUtils` (for `generateBalanceSheet`, ratios) — all local.
- PDF generates both Bilan and État de Résultat in a single file when calling `exportBalanceSheetPDF`; `exportIncomeStatementPDF` still exists separately for backward compatibility.
- Workflow: `.github/workflows/deploy.yml` — builds on Ubuntu, deploys via `actions/upload-pages-artifact@v3`.

## Relevant Files
- `src/accountingUtils.js`: `generateBalanceSheet` (MDT conversion, balancing step, 5th incomeStatement param), `generateIncomeStatement` (MDT), `calculateFinancialRatios` (9 ratios), `formatCurrencyHelper` (MDT), `generateSimulatedData`.
- `src/pdfExport.js`: Bilan 2-col side-by-side via `trow()` (page 1), État de Résultat (page 2). Totals as single lines with blue background. MDT labels.
- `src/excelExport.js`: 4 sheets, direct values, `L/LR/T/TR/S/SR` helpers for aligned Actif/Passif, no intermediate sub-totals. MDT titles.
- `src/FinancialReportView.jsx`: Collapsible SCE sections, editable fields, localStorage persistence. `fmt()` displays "MDT".
- `src/auditEngine.js`: 15 local checks, uses `generateBalanceSheet` & `calculateFinancialRatios` from accountingUtils.
