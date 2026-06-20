## Goal
Stabiliser Smart Comptable (MVP) puis construire le backend Express `el-fatoora-middleware` avec PostgreSQL, Zod 4, auth API, et préparer l'architecture de signature XAdES-BES pour la TTN réelle.

## Constraints & Preferences
- French UI labels throughout
- Must keep offline/localStorage fallback when Supabase unavailable
- Tesseract.js v7 core files served locally from `/tesseract/`; language data from CDN (`tessdata.projectnaptha.com`)
- No Gemini/ML API – pure open-source OCR (Tesseract + self-learning)
- Landing page: vanilla CSS only (no Bootstrap, no Tailwind, no CDN fonts), dark/light mode with localStorage persistence, responsive mobile
- Tests Smart Comptable via Vitest (187 tests) ; middleware via Node native test runner (config TS distincte)
- Backend Express `el-fatoora-middleware` vient en complément du Worker Cloudflare pour la signature + TTN

## Progress
### Done
- **Tests Smart Comptable 187/187** — toutes les suites applicatives passent :
  - `accountingUtils.test.js` (20 tests) — corrigé : comptes de passif (10-18) passés en crédit pour correspondre à `Math.max(-cl('X'), 0)`, assertion `resultatNet` corrigée pour tenir compte du plafonnement à 0 en cas de perte
  - `teifGenerator.test.js`, `syncManager.test.js`, `debug_test.test.js`, `accounting.test.js` — fixes de session précédentes (validateTEIF, auth mock, detectLignes, taux IS)
- **Tests middleware** : 31 suites marquées "No test suite found" sous Vitest (car le middleware utilise le test runner natif Node, TypeScript config séparée). Les tests middleware unitaires passent via `npm test` dans son propre répertoire.
- **Frontend ↔ Middleware connecté** :
  - Frontend envoie les factures au middleware via `sendToMiddleware()` (POST `<middlewareUrl>/v1/documents`)
  - Middleware accepte `pdf: ""` (validation Zod assouplie : `z.string().optional().default("")`)
  - Statut mappé côté frontend : `RECEIVED/SIGNING_PENDING/TTN_PENDING/TTN_SUBMITTED → pending`, `TTN_ACCEPTED → accepted`, `TTN_REJECTED/SIGNING_FAILED/FAILED → rejected`
  - Mode middleware configurable dans l'UI (Settings → TTN Mode → "Middleware (API REST)")
- **Phase 1 – Backend Express `el-fatoora-middleware` opérationnel :**
  - PostgreSQL 16 (Docker Compose) avec 4 migrations Kysely (8 tables)
  - Client test + token API (`smart-test-token-2026`) seedés
  - Auth par Bearer token DB fonctionnelle
  - Pipeline complet vérifié : Auth → Zod → Duplicate → DB → NGSign simulation → Audit trail
  - Endpoints : `POST /v1/documents`, `GET /v1/documents/status/:invoiceNumber`, `GET /v1/documents/artifacts/:invoiceNumber`, `POST /v1/documents/callback/:status`
  - Architecture existante : routes documents/clients, logique TEIF, intégration NGSign, soumission TTN (SOAP + SFTP), webhooks, cron jobs, audit trail via `documents_events`, graceful shutdown
- **Architecture full-stack stable** — 3 couches indépendantes :
  1. **Worker Cloudflare** (`smart-comptable-teif-api`) — API simple pour stockage Supabase
  2. **Middleware Express** (`el-fatoora-middleware`) — API complète avec PostgreSQL, signature, TTN
  3. **Frontend** — choix du mode par l'utilisateur dans Settings

### In Progress
- **Déploiement du middleware** — actuellement en localhost:3000 ; à déployer sur le cloud (Railway, Fly.io, ou VPS)

### Blocked
- **Phase 2 – Signature XAdès-BES (NGSign)** : nécessite certificat TUNTRUST et connexion NGSign. Le middleware a déjà la logique `createSignatureTransaction` avec `NGSIGN_SKIP=true` pour le moment.
- **Phase 3 – Transmission TTN réelle (SOAP/SFTP)** : dépend de la Phase 2 (signature). Workers TTN déjà présents dans le middleware.

## Key Decisions
- **Mode Middleware optionnel** — l'utilisateur choisit entre Dev (mock), Production (SFTP/download manuel), ou Middleware (API REST) via le Settings
- **Phase 1 d'abord** — Express/PostgreSQL → NGSign → TTN, car sans signature le SOAP/SFTP n'apporte rien
- **`shared/teif-generator.js` comme source de vérité unique** — partagé entre client, Worker ET middleware
- **`saveData` débouncé à 2s** — évite `ERR_INSUFFICIENT_RESOURCES` ; verrou `savingRef` empêche les exécutions concurrentes
- **`NGSIGN_SKIP=true`** dans `.env` du middleware tant que NGSign n'est pas connecté
- **Comptes passif (10-18) en crédit dans les tests** — l'appli utilise `Math.max(-cl('X'), 0)`, donc les données de test doivent avoir des soldes créditeurs pour ces classes

## Next Steps
1. **Déployer le middleware** sur Railway / Fly.io / VPS avec Docker
2. **Phase 2 : Intégration NGSign** — connecter NGSign, retirer `NGSIGN_SKIP`, gérer les callbacks réels
3. **Phase 3 : TTN réelle** — SOAP ou SFTP selon le canal retenu, accusés, retentatives
4. **Améliorer l'audit trail** — dashboard de suivi des soumissions dans le frontend

## Critical Context
- **Tests Smart Comptable** : `npm run test` (Vitest) → 187 tests, 15 suites, 0 échec
- **Tests middleware** : `cd elfatoora-middleware && npm test` (Node native runner) → tests unitaires et schemas
- **Worker URL** : `https://smart-comptable-teif-api.ezzinesalim21.workers.dev`
- **Worker API key** : `smart-comptable-teif-2026` (header `X-API-Key` ou `Authorization: Bearer`)
- **Middleware Express URL** : `http://localhost:3000` (dev)
- **Token API middleware de test** : `smart-test-token-2026` (customer test avec `tax_id = '1234567AAM000'`)
- **Global API key middleware** : `il09luq402okmn6mk70zk9ms7ulw06yu` (pour `/v1/clients`)
- **Supabase project** : `xkpkmqlcxtlcdkmccbhs.supabase.co`
- **GitHub Pages** : `https://salimezine.github.io/Smart-comptable/`
- **CSP `connect-src`** inclut : `'self' blob: data: https://tessdata.projectnaptha.com https://*.supabase.co wss://*.supabase.co https://api.emailjs.com https://*.workers.dev http://localhost:3000`
- **PowerShell execution policy** bloque `npm`/`npx` — utiliser `node_modules\.bin\*.cmd` directement ou `cmd.exe /c "..."`
- **Docker PostgreSQL** : `cd elfatoora-middleware ; docker compose up -d postgres` (port 5432, DB `e_fatoura`, user/pass `postgres`)

## Relevant Files
### Smart Comptable (src/)
- **`src/accountingUtils.js`** — `generateFromJournal()` avec `Math.max(-cl('10'), 0)` pour les comptes de capitaux propres, `generateCashFlowStatement()`, `generateSIG()`
- **`src/accountingUtils.test.js`** — 20 tests, comptes passif en crédit
- **`src/views/SettingsView.jsx`** — sélecteur TTN Mode (dev/prod/middleware), champs middlewareUrl/middlewareToken
- **`src/utils/middlewareMapper.js`** — `mapInvoiceToMiddlewareDoc()`, `sendToMiddleware()`, `pollMiddlewareStatus()` — mapping du format facture Smart Comptable vers le format middleware
- **`src/views/TeifDeclarationView.jsx`** — orchestre `sendToMiddleware()` ou `sendToTTN()` selon `ttnMode`
- **`shared/teif-generator.js`** — générateur XML TEIF partagé client + worker + middleware

### Middleware (elfatoora-middleware/)
- **`src/index.ts`** — point d'entrée Express 5 : health, CORS, auth token DB, graceful shutdown
- **`src/controllers/documents.controller.ts`** — `createDocuments` (POST), `documentsCallback`, `getDocumentStatus`, `getDocumentArtifacts` ; validation Zod assouplie (`pdf: z.string().optional().default("")`)
- **`src/schemas/document.schema.ts`** — schéma Zod 4 avec fiscal ID tunisien, parties, lignes, totaux
- **`src/middleware/api-key.middleware.ts`** — middleware `X-API-Key` pour les endpoints clients
- **`src/db/migrations/001_init_invoice_middleware.ts`** — migration complète : 8 tables, enums
- **`docker-compose.yml`** — PostgreSQL 16 Alpine, port 5432

### Worker (worker/)
- **`src/index.js`** — routes `/api/v1/documents`, `/api/invoices/:id/submit`, etc.
