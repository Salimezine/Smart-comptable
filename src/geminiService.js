import Tesseract from 'tesseract.js';

// URLs des webhooks n8n (workflows Smart-Comptable déjà déployés)
const N8N_SCAN_URL = 'https://ezzinesalim.app.n8n.cloud/webhook/scan-receipt';
const N8N_ANALYZE_URL = 'https://ezzinesalim.app.n8n.cloud/webhook/analyze-dashboard';
const N8N_INVOICE_URL = 'https://ezzinesalim.app.n8n.cloud/webhook/generate-invoice';

const GEMINI_MODEL = 'gemini-2.0-flash';

// Fallback direct vers l'API Gemini (quand n8n n'est pas disponible)
const callGeminiDirect = async (apiKey, parts) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!response.ok) throw new Error(`Gemini direct error ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

// Secret partagé pour valider les appels aux webhooks n8n
// (visible côté client — protection de base contre les appels non autorisés)
const WEBHOOK_SECRET = 'sm4rt-c0mpt4bl3-s3cur3-2026';

/**
 * Scan d'un justificatif via n8n → Gemini (ou OCR local / simulation en fallback).
 */
export const scanReceiptWithGemini = async (apiKey, base64Image, mimeType, fileName = '') => {
  if (apiKey && apiKey !== 'local') {
    try {
      const payload = {
        prompt: `En tant qu'expert comptable tunisien, analyse cette image ou ce PDF de reçu/facture d'achat.
Extrais précisément les champs suivants au format JSON brut (ne mets pas de bloc markdown) :
{
  "supplier": "Nom du fournisseur",
  "matriculeFiscal": "Matricule fiscal tunisien",
  "date": "YYYY-MM-DD",
  "subtotal": float,
  "fodec": float,
  "vatRate": float,
  "vatAmount": float,
  "stampDuty": float,
  "totalAmount": float,
  "category": "Télécoms & Internet | Énergie & Utilités | Fournitures de Bureau | Déplacements | Restauration | Autres",
  "invoiceNumber": "Référence"
}
Retourne UNIQUEMENT le JSON brut.`,
        base64Image,
        mimeType,
        fileName,
        apiKey,
        secret: WEBHOOK_SECRET,
      };
      const response = await fetch(N8N_SCAN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`n8n error ${response.status}`);
      const data = await response.json();
      return {
        supplier: data.supplier || '',
        matriculeFiscal: data.matriculeFiscal || '',
        date: data.date || new Date().toISOString().split('T')[0],
        subtotal: parseFloat(data.subtotal) || 0,
        fodec: parseFloat(data.fodec) || 0,
        vatRate: parseFloat(data.vatRate) || 19,
        vatAmount: parseFloat(data.vatAmount) || 0,
        stampDuty: parseFloat(data.stampDuty) !== undefined ? parseFloat(data.stampDuty) : 1.000,
        totalAmount: parseFloat(data.totalAmount) || 0,
        category: data.category || 'Autres',
        invoiceNumber: data.invoiceNumber || '',
      };
    } catch (e) {
      console.warn("Webhook n8n scan échoué, tentative directe Gemini :", e.message);
    }

    // Fallback direct API Gemini
    try {
      const prompt = `En tant qu'expert comptable tunisien, analyse cette image de reçu/facture d'achat. Extrais précisément les champs suivants au format JSON brut (ne mets PAS de markdown, retourne UNIQUEMENT le JSON valide) : {"supplier": "", "matriculeFiscal": "", "date": "YYYY-MM-DD", "subtotal": 0, "fodec": 0, "vatRate": 19, "vatAmount": 0, "stampDuty": 1.000, "totalAmount": 0, "category": "Autres", "invoiceNumber": ""}. Catégories possibles : Télécoms & Internet | Énergie & Utilités | Fournitures de Bureau | Déplacements | Restauration | Autres.`;
      const text = await callGeminiDirect(apiKey, [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Image } }
      ]);
      const jsonStr = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.supplier) {
        return {
          supplier: parsed.supplier || '',
          matriculeFiscal: parsed.matriculeFiscal || '',
          date: parsed.date || new Date().toISOString().split('T')[0],
          subtotal: parseFloat(parsed.subtotal) || 0,
          fodec: parseFloat(parsed.fodec) || 0,
          vatRate: parseFloat(parsed.vatRate) || 19,
          vatAmount: parseFloat(parsed.vatAmount) || 0,
          stampDuty: parsed.stampDuty !== undefined ? parseFloat(parsed.stampDuty) : 1.000,
          totalAmount: parseFloat(parsed.totalAmount) || 0,
          category: parsed.category || 'Autres',
          invoiceNumber: parsed.invoiceNumber || '',
        };
      }
    } catch (e2) {
      console.warn("Gemini direct scan échoué, OCR local :", e2.message);
    }
  }

  // OCR local Tesseract
  try {
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    const result = await Tesseract.recognize(dataUrl, 'fra+eng');
    const extractedText = result.data.text || "";
    if (extractedText.trim().length > 10) return parseInvoiceText(extractedText);
  } catch (ocrError) {
    console.error("OCR local échoué, simulateur :", ocrError);
  }

  // Simulateur local (fallback)
  await new Promise(resolve => setTimeout(resolve, 2000));
  const nameLower = fileName.toLowerCase();
  let selectedSupplier = { supplier: "Fournisseur Général S.A.", matriculeFiscal: "1234567/X/A/000", subtotal: 100.000, fodec: 0.000, vatRate: 19, vatAmount: 19.000, stampDuty: 1.000, totalAmount: 120.000, category: "Autres" };
  if (nameLower.includes("steg") || nameLower.includes("electr")) { selectedSupplier = { supplier: "STEG", matriculeFiscal: "0000120/A/M/000", subtotal: 312.500, fodec: 0.000, vatRate: 13, vatAmount: 40.625, stampDuty: 1.000, totalAmount: 354.125, category: "Énergie & Utilités" }; }
  else if (nameLower.includes("ooredoo") || nameLower.includes("telecom") || nameLower.includes("internet") || nameLower.includes("orange") || nameLower.includes("tt")) { selectedSupplier = { supplier: "Ooredoo Tunisie", matriculeFiscal: "0731024/M/A/M00", subtotal: 126.05, fodec: 0.000, vatRate: 19, vatAmount: 23.95, stampDuty: 1.000, totalAmount: 151.000, category: "Télécoms & Internet" }; }
  else if (nameLower.includes("bureau") || nameLower.includes("papier") || nameLower.includes("monoprix")) { const sub = 84.112; const fodec = Math.round((sub * 0.01) * 1000) / 1000; const baseTva = sub + fodec; const vat = Math.round((baseTva * 0.19) * 1000) / 1000; selectedSupplier = { supplier: "Sotupap", matriculeFiscal: "0948372/C/A/000", subtotal: sub, fodec, vatRate: 19, vatAmount: vat, stampDuty: 1.000, totalAmount: Math.round((baseTva + vat + 1) * 1000) / 1000, category: "Fournitures de Bureau" }; }
  else if (nameLower.includes("tunisair") || nameLower.includes("voyage")) { selectedSupplier = { supplier: "Tunisair", matriculeFiscal: "0001045/P/A/000", subtotal: 620.000, fodec: 0.000, vatRate: 7, vatAmount: 43.400, stampDuty: 1.000, totalAmount: 664.400, category: "Déplacements" }; }
  return { ...selectedSupplier, date: new Date().toISOString().split('T')[0], invoiceNumber: "FAC-TN-2026-" + Math.floor(Math.random() * 90000 + 10000), _simulated: true };
};

/**
 * Analyse financière via n8n → Gemini (ou simulation locale en fallback).
 */
export const analyzeDashboardWithGemini = async (apiKey, dashboardData) => {
  if (apiKey && apiKey !== 'local' && apiKey !== 'n8n-local') {
    try {
      const response = await fetch(N8N_ANALYZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `## IDENTITÉ
Tu es Smart Comptable, un expert-comptable IA spécialisé dans
le système comptable tunisien (SCE — Système Comptable des
Entreprises, NC 01 à NC 46) et les normes IFRS applicables
en Tunisie. Tu assistes les entreprises tunisiennes dans la
préparation de leurs états financiers annuels conformes au
cadre conceptuel du SCE.

## LANGUE & TON
Réponds toujours en français. Utilise la terminologie exacte
du SCE tunisien. Sois précis, structuré et professionnel.
Signale tout écart ou anomalie détecté dans les données.

## DONNÉES ACCEPTÉES
Tu peux traiter les données sous toutes ces formes :
- Balance générale des comptes (numéros + soldes débit/crédit)
- Grand livre résumé ou détaillé
- Tableau de chiffres saisis manuellement
- Description textuelle des opérations
- Fichier CSV ou tableau collé directement dans le chat
Dans tous les cas, commence par demander la période comptable
(exercice N) et le type d'entreprise (SARL, SA, individuelle…)
si ces informations ne sont pas fournies.

## PLAN COMPTABLE SCE
Utilise la classification officielle du SCE :
- Classe 1 : Capitaux propres et passifs non courants
- Classe 2 : Actifs non courants
- Classe 3 : Stocks
- Classe 4 : Actifs et passifs courants (créances/dettes)
- Classe 5 : Trésorerie et équivalents
- Classe 6 : Charges
- Classe 7 : Produits

## ÉTATS FINANCIERS À PRODUIRE
Sur demande, génère les états suivants conformément au SCE :

1. BILAN (État de la situation financière)
   Format : Actif (non courant + courant) | Passif & Capitaux
   Respecter l'ordre de liquidité croissante pour l'actif.
   Inclure : immobilisations nettes, stocks, créances clients,
   trésorerie / dettes fournisseurs, emprunts, capitaux propres.
   Présenter sur 2 exercices comparatifs (N et N-1) si dispo.

2. ÉTAT DE RÉSULTAT
   Format par nature (conforme SCE) :
   Produits d'exploitation - Charges d'exploitation
   = Résultat d'exploitation
   + Produits financiers - Charges financières
   = Résultat des activités ordinaires
   + Éléments extraordinaires (si applicable)
   - Impôt sur les sociétés (IS, taux standard 15%)
   = Résultat net de l'exercice

3. TABLEAU DES FLUX DE TRÉSORERIE
   Méthode indirecte (recommandée SCE) :
   I. Flux liés à l'exploitation (résultat net + retraitements)
   II. Flux liés aux investissements (acquisitions/cessions)
   III. Flux liés au financement (emprunts, dividendes, capital)
   = Variation nette de trésorerie

4. NOTES ANNEXES
   Rédige les notes prioritaires :
   - Méthodes comptables appliquées
   - Détail des immobilisations et amortissements
   - Détail des créances et dettes
   - Engagements hors bilan
   - Événements postérieurs à la clôture
   - Tableau de variation des capitaux propres
   Adapte les notes au profil de l'entreprise.

## CALCULS FISCAUX TUNISIENS
Applique automatiquement :
- IS : 15% (taux standard PME) ou 25% (grandes entreprises,
  banques, compagnies d'assurance, télécoms)
- TVA : 19% (taux normal), 7% ou 13% selon activité
- CNSS employeur : 16,57% / salarié : 9,18%
- Retenue à la source : selon nature du paiement (1,5% à 25%)
- TCL : 0,2% du CA brut (communes)
Signale si des ajustements fiscaux sont nécessaires.

## FORMAT DE SORTIE
- Présente chaque état dans un tableau clair en DT (dinars tunisiens)
- Arrondis à 3 décimales (millimes) ou en DT entiers selon contexte
- Indique toujours le total de contrôle (Actif = Passif + CP)
- Mets en évidence les ratios clés : liquidité, rentabilité, solvabilité
- Si des données manquent, liste-les explicitement avant de continuer
- Après chaque état, propose une analyse synthétique de 3-5 points

## VÉRIFICATIONS AUTOMATIQUES
Avant de valider tout état financier, vérifie :
✓ Équilibre du bilan (Total Actif = Total Passif + Capitaux propres)
✓ Cohérence résultat net → bilan (capitaux propres)
✓ Variation trésorerie bilan ↔ tableau des flux
✓ Absence de soldes débiteurs sur comptes passifs et inversement
En cas d'anomalie, signale-la avec une explication claire.

## LIMITES
Tu n'es pas un expert-comptable agréé. Les états produits sont
à titre indicatif et doivent être validés par un professionnel
habilité avant tout dépôt officiel ou usage légal.

Données financières :
${JSON.stringify(dashboardData, null, 2)}`,
          dashboardData,
          apiKey,
          secret: WEBHOOK_SECRET,
        }),
      });
      if (!response.ok) throw new Error(`n8n error ${response.status}`);
      const data = await response.json();
      if (data.report) return data.report;
      throw new Error('Réponse n8n invalide');
    } catch (e) {
      console.warn("Webhook n8n analyse échoué, tentative directe Gemini :", e.message);
    }

    // Fallback direct API Gemini
    try {
      const prompt = `## IDENTITÉ
Tu es Smart Comptable, un expert-comptable IA spécialisé dans le système comptable tunisien (SCE). Réponds toujours en français.

Données financières à analyser :
${JSON.stringify(dashboardData, null, 2)}

Tu dois produire :
1. **Analyse de trésorerie** : liquidité immédiate, besoin en fonds de roulement
2. **Résultat net estimé** : (Total Revenus - Total Charges)
3. **Provisions fiscales** : IS (15% du résultat), CNSS employeur (16,57% sur masse salariale estimée)
4. **Ratios clés** : marge nette, taux de couverture des charges
5. **Recommandations** : optimisation fiscale et conseils de gestion

Formate la réponse en Markdown avec des tableaux et sections claires.`;

      const text = await callGeminiDirect(apiKey, [{ text: prompt }]);
      if (text) return text;
    } catch (e2) {
      console.warn("Gemini direct analyse échoué, simulation locale :", e2.message);
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1800));
  const { totalRevenues = 0, pendingRevenues = 0, totalExpenses = 0, bankBalance = 0 } = dashboardData;
  const netResult = totalRevenues - totalExpenses;
  const marginRate = totalRevenues > 0 ? ((netResult / totalRevenues) * 100).toFixed(1) : "0.0";
  const provisionIS = netResult > 0 ? netResult * 0.15 : 0;
  const baseSalariale = Math.max(totalExpenses * 0.35, 4500);
  const provisionCNSS = baseSalariale * 0.1657;
  const fmt = (val) => new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(val) + " DT";
  return `### ⚠️ Diagnostic Simulé (Mode Hors Ligne)\n*L'IA Gemini n'est pas joignable. Les chiffres ci-dessous sont une estimation basée sur vos données réelles.*\n\n**Résultat net estimé :** ${fmt(netResult)}\n**Marge nette :** ${marginRate}%\n**Provision IS (15%) :** ${fmt(provisionIS)}\n**Provision CNSS (16.57%) :** ${fmt(provisionCNSS)}\n\n> Revenus : ${fmt(totalRevenues)} | Charges : ${fmt(totalExpenses)} | Trésorerie : ${fmt(bankBalance)}`;
};

// Parsing OCR texte → données structurées
export const parseInvoiceText = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let supplier = "Fournisseur Général S.A.", matriculeFiscal = "1234567/X/A/000", date = new Date().toISOString().split('T')[0];
  let subtotal = 0, fodec = 0, vatRate = 19, vatAmount = 0, stampDuty = 1.000, totalAmount = 0, category = "Autres";
  let invoiceNumber = "FAC-LOC-" + Math.floor(Math.random() * 90000 + 10000);
  const textLower = text.toLowerCase();
  if (textLower.includes("ooredoo")) { supplier = "Ooredoo Tunisie S.A."; matriculeFiscal = "0731024/M/A/M00"; category = "Télécoms & Internet"; }
  else if (textLower.includes("steg")) { supplier = "STEG"; matriculeFiscal = "0000120/A/M/000"; category = "Énergie & Utilités"; vatRate = 13; }
  else if (textLower.includes("monoprix")) { supplier = "Monoprix Tunisie"; matriculeFiscal = "0002340/C/A/000"; category = "Fournitures de Bureau"; }
  else if (textLower.includes("tunisair")) { supplier = "Tunisair"; matriculeFiscal = "0001045/P/A/000"; category = "Déplacements"; vatRate = 7; }
  else if (lines.length > 0) { supplier = lines[0].substring(0, 40); }
  const mfMatch = text.match(/(\d{7})\s*\/\s*([A-Z])\s*\/\s*([A-Z])\s*\/\s*(\d{3})/i);
  if (mfMatch) matriculeFiscal = `${mfMatch[1]}/${mfMatch[2].toUpperCase()}/${mfMatch[3].toUpperCase()}/${mfMatch[4]}`;
  const dateMatch = text.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  if (dateMatch) date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  const invMatch = text.match(/(facture|n°|invoice|fac)\s*[:#-]?\s*([A-Z0-9_-]{4,15})/i);
  if (invMatch?.[2]) invoiceNumber = invMatch[2].toUpperCase();
  const ttcKeywords = ["total ttc", "net à payer", "ttc", "total à payer", "montant total"];
  for (const kw of ttcKeywords) { const idx = textLower.indexOf(kw); if (idx !== -1) { const match = textLower.substring(idx + kw.length, idx + kw.length + 40).match(/(\d+[\.,]\d{2,3})/); if (match) { totalAmount = parseFloat(match[1].replace(',', '.')); break; } } }
  const htKeywords = ["total ht", "net ht", "hors taxe", "montant ht"];
  for (const kw of htKeywords) { const idx = textLower.indexOf(kw); if (idx !== -1) { const match = textLower.substring(idx + kw.length, idx + kw.length + 40).match(/(\d+[\.,]\d{2,3})/); if (match) { subtotal = parseFloat(match[1].replace(',', '.')); break; } } }
  if (textLower.includes("19%")) vatRate = 19; else if (textLower.includes("13%")) vatRate = 13; else if (textLower.includes("7%")) vatRate = 7;
  if (totalAmount > 0 && subtotal === 0) { subtotal = Math.round(((totalAmount - stampDuty) / (1 + vatRate / 100)) * 1000) / 1000; vatAmount = Math.round((subtotal * (vatRate / 100)) * 1000) / 1000; }
  else if (subtotal > 0 && totalAmount === 0) { vatAmount = Math.round((subtotal * (vatRate / 100)) * 1000) / 1000; totalAmount = Math.round((subtotal + vatAmount + stampDuty) * 1000) / 1000; }
  return { supplier, matriculeFiscal, date, subtotal: Math.round(subtotal * 1000) / 1000, fodec: Math.round(fodec * 1000) / 1000, vatRate, vatAmount: Math.round(vatAmount * 1000) / 1000, stampDuty, totalAmount: Math.round(totalAmount * 1000) / 1000, category, invoiceNumber };
};

/**
 * Génération de facture par IA (via n8n → Gemini direct → simulation locale)
 */
export const generateInvoiceAI = async (apiKey, userPrompt, companyDetails, lastInvoiceNumber) => {
  const year = new Date().getFullYear();
  const nextNum = lastInvoiceNumber
    ? parseInt(lastInvoiceNumber.split('-')[2]) + 1
    : 1;
  const invoiceNumStr = `FACT-${year}-${String(nextNum).padStart(3, '0')}`;

  const sellerInfo = `Raison sociale: ${companyDetails.name || 'Non renseigné'}
MF: ${companyDetails.vatNumber || 'Non renseigné'}
Adresse: ${companyDetails.address || 'Non renseignée'}
RIB: ${companyDetails.iban || 'Non renseigné'}
Téléphone: ${companyDetails.phone || 'Non renseigné'}`;

  const systemPrompt = `## FACTURE DE VENTE — SMART COMPTABLE

RÔLE
Tu génères des factures de vente conformes à la législation
tunisienne (Code de la TVA, Loi 2000-57 sur la facturation
électronique, décret 2008-2572 sur le timbre fiscal).

NUMÉROTATION AUTOMATIQUE
Format obligatoire : FACT-{YYYY}-{NNN}
- YYYY = année en cours (ex: ${year})
- NNN = numéro séquentiel sur 3 chiffres (001, 002…)
Prochain numéro à utiliser : ${invoiceNumStr}

INFORMATIONS À COLLECTER
Utilise les données vendeur ci-dessous et la demande client.
Si des informations client essentielles manquent, déduis-les
ou utilise des valeurs par défaut raisonnables.

VENDEUR (utilise ces informations pour l'en-tête) :
${sellerInfo}

DEMANDE DU CLIENT :
${userPrompt}

CALCULS OBLIGATOIRES
Pour chaque ligne :
  Montant HT = Qté × PU HT − Remise
  Montant TVA = Montant HT × Taux TVA
  Montant TTC = Montant HT + Montant TVA

Totaux facture :
  Total HT = Σ montants HT
  Total TVA = Σ TVA par taux (détailler chaque taux séparé)
  Timbre fiscal = 1,000 DT (fixe, toute facture ≥ 1 DT)
  NET À PAYER = Total TTC + Timbre fiscal

Retenue à la source (si client assujetti) :
  - Prestations de services : 1,5% sur montant HT
  - Honoraires : 10% ou 15% sur montant HT
  Indiquer le montant RS et le NET À ENCAISSER résultant.

FORMAT DE SORTIE
Retourne UNIQUEMENT du JSON brut (sans markdown, sans blocs \`\`\`) :
{
  "clientName": "Raison sociale ou nom du client",
  "clientEmail": "email@client.tn",
  "clientMF": "Matricule Fiscal ou CIN",
  "clientAddress": "Adresse du client",
  "invoiceNumber": "${invoiceNumStr}",
  "issueDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "paymentMethod": "espèces|chèque|virement|traite",
  "items": [
    { "description": "Désignation article", "quantity": 1, "unitPrice": 0.000, "vatRate": 19, "discount": 0 }
  ],
  "subtotal": 0.000,
  "vatBreakdown": [{ "rate": 19, "amount": 0.000 }],
  "vatAmount": 0.000,
  "stampDuty": 1.000,
  "totalAmount": 0.000,
  "retenueSource": 0.000,
  "netAPercevoir": 0.000,
  "amountInLetters": "Arrêtée à la somme de ... DINARS",
  "notes": "Facture à payer dans un délai de 30 jours. Tout retard de paiement entraîne des pénalités (taux légal)."
}

LANGUE
Facture en français. Montants en DT (3 décimales — millimes).`;

  if (apiKey && apiKey !== 'local') {
    try {
      const response = await fetch(N8N_INVOICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: systemPrompt,
          apiKey,
          secret: WEBHOOK_SECRET,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.invoiceNumber) {
          return { ...data, _simulated: false };
        }
      }
      throw new Error('n8n response invalid');
    } catch (e) {
      console.warn("Webhook n8n invoice échoué, tentative directe Gemini :", e.message);
    }

    try {
      const text = await callGeminiDirect(apiKey, [{ text: systemPrompt }]);
      const jsonStr = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.clientName) {
        return { ...parsed, _simulated: false };
      }
    } catch (e2) {
      console.warn("Gemini direct invoice échoué, simulation :", e2.message);
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1500));
  return simulateInvoiceLocal(userPrompt, companyDetails, invoiceNumStr);
};

const simulateInvoiceLocal = (userPrompt, companyDetails, invoiceNumStr) => {
  const text = userPrompt.toLowerCase();
  const now = new Date();
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let clientName = "Client";
  const clientMatch = userPrompt.match(/(?:pour|client|à|de|:)\s*([A-Za-zéèêëàâäùûüôöîïç'&\s.-]{3,40}?)(?:\s*(?:pour|de|une|prestation|service|consulting|conseil|développement|formation|mission|\d))/i);
  if (clientMatch) clientName = clientMatch[1].trim();

  let amount = 0;
  const amountMatch = text.match(/(\d[\d\s]*\.?\d{0,3})\s*(?:dt|dinar|tnd|€|eur)/i);
  if (amountMatch) amount = parseFloat(amountMatch[1].replace(/\s/g, ''));
  if (!amount || isNaN(amount)) amount = 1500.000;

  let description = "Prestation de services";
  const descKeywords = ['prestation', 'service', 'consulting', 'conseil', 'développement', 'formation', 'mission', 'étude', 'audit', 'maintenance', 'hébergement', 'licence', 'abonnement', 'honoraire'];
  for (const kw of descKeywords) {
    if (text.includes(kw)) {
      const idx = text.indexOf(kw);
      const phrase = userPrompt.substring(idx, idx + 40).replace(/[0-9].*$/, '').replace(/\s+pour\s+.*$/, '').trim();
      if (phrase.length > 3) { description = phrase.charAt(0).toUpperCase() + phrase.slice(1); break; }
    }
  }

  const subKeywords = ['prestation', 'service', 'consulting', 'conseil', 'honoraire'];
  const isService = subKeywords.some(k => text.includes(k));
  const vatRate = 19;
  const quantity = 1;
  const unitPrice = Math.round(amount * 1000) / 1000;
  const subtotal = Math.round(quantity * unitPrice * 1000) / 1000;
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 1000) / 1000;
  const stampDuty = 1.000;
  const totalAmount = Math.round((subtotal + vatAmount + stampDuty) * 1000) / 1000;
  const retenueSource = isService ? Math.round(subtotal * 0.015 * 1000) / 1000 : 0;

  return {
    clientName,
    clientEmail: "client@email.tn",
    clientMF: "",
    clientAddress: "",
    invoiceNumber: invoiceNumStr,
    issueDate: now.toISOString().split('T')[0],
    dueDate,
    paymentMethod: "virement",
    items: [{ description, quantity, unitPrice, vatRate, discount: 0 }],
    subtotal,
    vatBreakdown: [{ rate: vatRate, amount: vatAmount }],
    vatAmount,
    stampDuty,
    totalAmount,
    retenueSource,
    netAPercevoir: Math.round((totalAmount - retenueSource) * 1000) / 1000,
    amountInLetters: `Arrêtée à la somme de ${totalAmount.toFixed(0)} DINARS${totalAmount % 1 !== 0 ? ` ET ${Math.round((totalAmount % 1) * 1000)} MILLIMES` : ''}`,
    notes: "Facture à payer dans un délai de 30 jours. Tout retard de paiement entraîne des pénalités (taux légal).",
    _simulated: true,
  };
};

export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => { const split = reader.result.split(','); const match = split[0].match(/:(.*?);/); resolve({ base64Data: split[1], mimeType: match ? match[1] : file.type }); };
    reader.onerror = reject;
  });
};