# deploy.ps1 — Déploiement Smart Comptable vers GitHub Pages
Write-Host "=== Déploiement Smart Comptable ===" -ForegroundColor Cyan

# 1. Build
Write-Host "`n[1/3] Build production..." -ForegroundColor Yellow

if ($env:VITE_SUPABASE_URL) { $env:VITE_SUPABASE_URL = $env:VITE_SUPABASE_URL }
if ($env:VITE_SUPABASE_ANON_KEY) { $env:VITE_SUPABASE_ANON_KEY = $env:VITE_SUPABASE_ANON_KEY }

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build échoué ― abandon" -ForegroundColor Red
    exit 1
}
Write-Host "Build OK" -ForegroundColor Green

# Copier les pages : landing → index.html, app → app.html, mentions légales
Copy-Item -LiteralPath "dist\index.html" -Destination "dist\app.html" -Force
Copy-Item -LiteralPath "landing.html" -Destination "dist\index.html" -Force
Copy-Item -LiteralPath "mentions-legales.html" -Destination "dist\mentions-legales.html" -Force

# Supprimer les artefacts SW (PWA désactivé — causes de boucle de refresh)
Remove-Item -LiteralPath "dist\sw.js" -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "dist\workbox-*.js" -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "dist\registerSW.js" -Force -ErrorAction SilentlyContinue

# 2. Tests
Write-Host "`n[2/3] Tests..." -ForegroundColor Yellow
npx vitest run src/utils/ocrParser.test.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests échoués ― abandon" -ForegroundColor Red
    exit 1
}
Write-Host "Tests OK" -ForegroundColor Green

# 3. Deploy via gh-pages
Write-Host "`n[3/3] Déploiement vers GitHub Pages..." -ForegroundColor Yellow
npx gh-pages -d dist -m "Deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Déploiement échoué" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Déploiement terminé avec succès ! ===" -ForegroundColor Green
Write-Host "URL : https://salimezine.github.io/Smart-comptable/" -ForegroundColor Cyan
