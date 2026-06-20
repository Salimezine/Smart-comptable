
## Goal
- Stabiliser (187 tests, 0 échec) puis CI/CD : tests automatisés + déploiement GitHub Pages, après NGSign bloqué.

## Constraints & Preferences
- French UI labels throughout
- Must keep offline/localStorage fallback when Supabase unavailable
- Tesseract.js v7 core files served locally from `/tesseract/`; language data from CDN (`tessdata.projectnaptha.com`)
- No separate backend server for MVP – everything through Supabase + Cloudflare Worker ; le backend Express `el-fatoora-middleware` vient en complément pour la signature + TTN
- No Gemini/ML API – pure open-source OCR (Tesseract + self-learning)
- Landing page: vanilla CSS only (no Bootstrap, no Tailwind, no CDN fonts), dark/light mode with localStorage persistence, responsive mobile
- All tests must pass before deploy (187 tests)
- PowerShell execution policy bloque les scripts `.ps1` — utiliser `cmd.exe /c` ou `node_modules\.bin\*.cmd`
- App Express utilise Node >=24, pnpm, TypeScript avec `tsc` → `dist/`

## Progress
### Done
- **Tests Smart Comptable 187/187** — 15 suites Vitest, toutes passent, 0 échec
- **Frontend connecté au middleware Express** – validation Zod assouplie pour `pdf`, status map complète, mode middleware configurable dans Settings
- **Middleware déployé sur Railway** :
  - Domaine : `https://elfatoora-middleware-app-production.up.railway.app`
  - Health endpoint `/health` répond ✅ ; PostgreSQL provisionné ; test client créé (`taxId=1234567AAM000`, token=`416e5f9f7233b3d3e422995911664c69658fa8b0885dc6c3a005d0b051ad06e4`)
  - Document créé avec succès : `POST /v1/documents → "Invoice accepted (NGSign simulation mode)."`
  - Migration corrigée : `CREATE EXTENSION IF NOT EXISTS citext` ajouté, Dockerfile réparé, vars d'env configurées
- **Phase 2 – NGSign préparation frontend** :
  - `middlewareMapper.js` : envoie `successUrl`/`failureUrl` avec `window.location.origin` au lieu de `null`
  - `TeifDeclarationView.jsx` : auto-polling toutes les 8s après ouverture signature, détection callback `?teif_callback`, start `setPollingInvoice` sur envoi
  - `SettingsView.jsx` : champ `ngsignSignerEmail` ajouté, placeholder URL Railway par défaut
- **Fix URL NGSign** : `helpers.test.ts` corrigé pour correspondre au code (`ng-sign.com` avec trait d'union, `/server` en PROD) — 6/6 tests pass
- **CI/CD GitHub Actions** :
  - `deploy.yml` : jobs `test` (must pass) → `deploy` (build + copy landing page + force push `gh-pages`)
  - `ci.yml` : tests sur toutes les branches/PR
  - Sous-module `elfatoora-middleware` retiré de l'index git et ajouté à `.gitignore`
  - `vite.config.js` : `test.exclude: ['elfatoora-middleware/**', 'backend/**', 'node_modules/**', '**/node_modules/**']`
  - `package.json` : `"test": "vitest run"` (exclusion via config)
  - Secrets `supabase_key.txt` et `worker/.wrangler/` ajoutés à `.gitignore`

### In Progress
- **CI/CD GitHub Actions** — commit `9773d02` poussé sur `main` avec toutes les corrections. En attente du résultat du pipeline.

### Blocked
- **Phase 2 – Signature XAdès-BES (NGSign)** : nécessite certificat TUNTRUST + accès API NGSign. L'utilisateur n'a pas accès au menu "Développeur" sur le sandbox NGSign (compte non certifié ou API access non activé). En attente de demande via `ng-sign.com/api-reference-simple-version/`.
- **Phase 3 – Transmission TTN réelle (SOAP/SFTP)** : dépend de la Phase 2 (signature). Workers TTN déjà présents dans le middleware.

## Key Decisions
- **Mode Middleware optionnel** — l'utilisateur choisit entre Dev (mock), Production (SFTP/download manuel), ou Middleware (API REST) via le Settings
- **Phase 1 d'abord** — Express/PostgreSQL → NGSign → TTN, car sans signature le SOAP/SFTP n'apporte rien
- **`shared/teif-generator.js` comme source de vérité unique** — partagé entre client, Worker ET middleware
- **`saveData` débouncé à 2s** — évite `ERR_INSUFFICIENT_RESOURCES` ; verrou `savingRef` empêche les exécutions concurrentes
- **`NGSIGN_SKIP=true`** dans `.env` du middleware tant que NGSign n'est pas connecté
- **Comptes passif (10-18) en crédit dans les tests** — l'appli utilise `Math.max(-cl('X'), 0)`, donc les données de test doivent avoir des soldes créditeurs pour ces classes
- **Token Railway sans workspace** — le CLI Railway nécessite un token API créé sans workspace sélectionné (bug connu du CLI)
- **`railway up`** utilisé pour le déploiement (build Docker + push) ; `railway domain` génère le domaine `.up.railway.app`
- **Callback URLs frontend** — `successUrl: "${origin}/?teif_callback=success"` passé au middleware pour rediriger l'onglet NGSign après signature
- **Auto-polling middleware** — après signature, frontend interroge toutes les 8s `pollMiddlewareStatus()` jusqu'à `accepted`/`rejected`
- **Exclusion middleware des tests Vitest** — configurée dans `vite.config.js` via `test.exclude`, pas de flag CLI, car les `.test.ts` middleware utilisent le Node native runner
- **`npm ci` dans CI** — utilise `package-lock.json` ; nécessite que le lockfile soit à jour

## Next Steps
1. ✅ **CI/CD poussé** — attendre le résultat du pipeline GitHub Actions sur `main`
2. **Phase 2 – NGSign** — demander l'accès API sur `ng-sign.com/api-reference-simple-version/` (section "Request Access") ; une fois token obtenu, `PATCH /v1/clients/1234567AAM000` + `NGSIGN_SKIP=false`
3. **Phase 3 – TTN réelle** — SOAP ou SFTP selon le canal retenu, accusés, retentatives
4. **Améliorer l'audit trail** — dashboard de suivi des soumissions dans le frontend

## Critical Context
- **Tests Smart Comptable** : `npm run test` (Vitest) → `vite.config.js` exclut `elfatoora-middleware/**`, `backend/**`, `**/node_modules/**` → 15 suites, 187 tests, 0 échec
- **Middleware URL (Railway)** : `https://elfatoora-middleware-app-production.up.railway.app`
- **Token API middleware (test customer)** : `416e5f9f7233b3d3e422995911664c69658fa8b0885dc6c3a005d0b051ad06e4` (customer `1234567AAM000`)
- **Global API key middleware** : `il09luq402okmn6mk70zk9ms7ulw06yu` (pour `/v1/clients`)
- **GitHub Smart Comptable** : `Salimezine/Smart-comptable` — sous-module `elfatoora-middleware` retiré et ignoré
- **GitHub middleware** : `Salimezine/elfatoora-middleware`
- **Supabase project** : `xkpkmqlcxtlcdkmccbhs.supabase.co`
- **GitHub Pages** : `https://salimezine.github.io/Smart-comptable/`
- **CSP `connect-src`** inclut : `'self' blob: data: https://tessdata.projectnaptha.com https://*.supabase.co wss://*.supabase.co https://api.emailjs.com https://*.workers.dev http://localhost:3000 https://*.up.railway.app`
- **Railway CLI** : `railway up --json` avec `RAILWAY_API_TOKEN` (token sans workspace) ; `railway domain` pour générer le domaine
- **Docker PostgreSQL** : `docker compose up -d postgres` (port 5432, DB `e_fatoura`, user/pass `postgres`)
- **NGSign sandbox** : `https://sandbox.ng-sign.com/` ; menu "Développeur" absent — besoin d'activer l'accès API via formulaire de demande
- **Callback URLs** : le middleware redirige l'onglet NGSign vers la `successUrl`/`failureUrl` fournie par le frontend ; le frontend détecte `?teif_callback` au montage
- **PowerShell execution policy** : `npm`/`npx` bloqués — utiliser `cmd.exe /c` ou `node_modules\.bin\*.cmd`

## Relevant Files
- **`elfatoora-middleware/Dockerfile`** — multi-stage Node 24 Alpine, pnpm, tsc build, entrypoint avec migrations
- **`elfatoora-middleware/docker-entrypoint.sh`** — `node dist/db/migrate.js` puis `node dist/index.js`
- **`elfatoora-middleware/railway.json`** — builder Docker, health check `/health`, restart policy
- **`elfatoora-middleware/src/controllers/documents.controller.ts`** — `createDocuments`, `DocumentsApiSchema` avec `pdf: z.string().optional().default("")`
- **`elfatoora-middleware/src/business-logic/ngsign/__tests__/helpers.test.ts`** — corrigé : URLs `ng-sign.com` avec trait d'union, `/server` en PROD
- **`src/utils/middlewareMapper.js`** — `mapInvoiceToMiddlewareDoc()`, `sendToMiddleware()`, `pollMiddlewareStatus()` avec callback URLs
- **`src/views/SettingsView.jsx`** — sélecteur TTN Mode (dev/prod/middleware), champs middlewareUrl/middlewareToken + `ngsignSignerEmail`
- **`src/views/TeifDeclarationView.jsx`** — auto-polling 8s, callback detection, `setPollingInvoice` sur envoi middleware
- **`vite.config.js`** — `import { defineConfig } from 'vitest/config'` ; `test.exclude: ['elfatoora-middleware/**', 'backend/**', 'node_modules/**', '**/node_modules/**']`
- **`.github/workflows/deploy.yml`** — jobs `test` + `deploy` ; checkout sans submodules ; build avec `VITE_SUPABASE_URL`
- **`.github/workflows/ci.yml`** — tests sur push (hors main) et PRs
- **`.gitignore`** — ajout de `elfatoora-middleware/`, `*supabase_key.txt`, `worker/.wrangler/`
