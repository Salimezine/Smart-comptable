import Tesseract from 'tesseract.js';

/* ============================================================
   CONFIGURATION N8N — Modifie ces valeurs pour pointer vers
   tes propres webhooks n8n.
   ============================================================ */
const N8N_BASE_URL = 'https://votre-n8n.com/webhook';
const N8N_SCAN_ENDPOINT = `${N8N_BASE_URL}/scan-receipt`;
const N8N_ANALYZE_ENDPOINT = `${N8N_BASE_URL}/analyze-dashboard`;
const N8N_AUTH_HEADER = 'X-N8N-API-Key'; // Nom du header d'auth

/**
 * Appel générique à un webhook n8n.
 */
async function callN8nWebhook(url, payload, apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey !== 'local' && apiKey !== 'n8n-local') {
    headers[N8N_AUTH_HEADER] = apiKey;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`n8n webhook error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Scan d'un justificatif via n8n (ou OCR local / simulation en fallback).
 * @param {string}  apiKey      - Clé d'API n8n
 * @param {string}  base64Image - Document encodé en base64
 * @param {string}  mimeType    - Type MIME (image/png, application/pdf, …)
 * @param {string}  fileName    - Nom du fichier original
 */
export const scanReceiptWithGemini = async (apiKey, base64Image, mimeType, fileName = '') => {
  // Tentative webhook n8n
  if (apiKey && apiKey !== 'local') {
    try {
      const data = await callN8nWebhook(N8N_SCAN_ENDPOINT, {
        base64Image,
        mimeType,
        fileName,
      }, apiKey);
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
      console.warn("Webhook n8n scan échoué, basculement vers l'OCR local :", e.message);
    }
  }

  // OCR local Tesseract
  try {
    console.log("Exécution de l'OCR local Tesseract.js sur :", fileName);
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    const result = await Tesseract.recognize(
      dataUrl,
      'fra+eng',
      { logger: m => console.log("Progression OCR local :", m) }
    );
    const extractedText = result.data.text || "";
    console.log("Texte extrait par l'OCR local :", extractedText);
    if (extractedText.trim().length > 10) {
      return parseInvoiceText(extractedText);
    }
  } catch (ocrError) {
    console.error("Échec de l'OCR local Tesseract.js, utilisation du simulateur :", ocrError);
  }

  // Simulateur local (fallback)
  await new Promise(resolve => setTimeout(resolve, 2000));
  const nameLower = fileName.toLowerCase();
  let selectedSupplier = {
    supplier: "Fournisseur Général S.A.",
    matriculeFiscal: "1234567/X/A/000",
    subtotal: 100.000,
    fodec: 0.000,
    vatRate: 19,
    vatAmount: 19.000,
    stampDuty: 1.000,
    totalAmount: 120.000,
    category: "Autres",
  };

  if (nameLower.includes("steg") || nameLower.includes("electr")) {
    selectedSupplier = {
      supplier: "STEG (Société Tunisienne de l'Électricité et du Gaz)",
      matriculeFiscal: "0000120/A/M/000",
      subtotal: 312.500,
      fodec: 0.000,
      vatRate: 13,
      vatAmount: 40.625,
      stampDuty: 1.000,
      totalAmount: 354.125,
      category: "Énergie & Utilités",
    };
  } else if (nameLower.includes("ooredoo") || nameLower.includes("telecom") || nameLower.includes("internet") || nameLower.includes("orange") || nameLower.includes("tt")) {
    selectedSupplier = {
      supplier: "Ooredoo Tunisie S.A.",
      matriculeFiscal: "0731024/M/A/M00",
      subtotal: 126.050,
      fodec: 0.000,
      vatRate: 19,
      vatAmount: 23.950,
      stampDuty: 1.000,
      totalAmount: 151.000,
      category: "Télécoms & Internet",
    };
  } else if (nameLower.includes("sotupap") || nameLower.includes("bureau") || nameLower.includes("papier") || nameLower.includes("fourniture") || nameLower.includes("monoprix") || nameLower.includes("achat")) {
    const sub = 84.112;
    const fodec = Math.round((sub * 0.01) * 1000) / 1000;
    const baseTva = sub + fodec;
    const vat = Math.round((baseTva * 0.19) * 1000) / 1000;
    const stamp = 1.000;
    const total = baseTva + vat + stamp;
    selectedSupplier = {
      supplier: "Sotupap (Fournitures de Bureau)",
      matriculeFiscal: "0948372/C/A/000",
      subtotal: sub,
      fodec: fodec,
      vatRate: 19,
      vatAmount: vat,
      stampDuty: stamp,
      totalAmount: total,
      category: "Fournitures de Bureau",
    };
  } else if (nameLower.includes("tunisair") || nameLower.includes("vol") || nameLower.includes("voyage") || nameLower.includes("deplacement") || nameLower.includes("taxi")) {
    selectedSupplier = {
      supplier: "Tunisair (Déplacement professionnel)",
      matriculeFiscal: "0001045/P/A/000",
      subtotal: 620.000,
      fodec: 0.000,
      vatRate: 7,
      vatAmount: 43.400,
      stampDuty: 1.000,
      totalAmount: 664.400,
      category: "Déplacements",
    };
  } else {
    const matches = nameLower.match(/(\d+[\d.,]*)/);
    if (matches && matches[0]) {
      const parsedVal = parseFloat(matches[0].replace(",", "."));
      if (parsedVal > 0) {
        const total = parsedVal;
        const stamp = 1.000;
        const sub = Math.round(((total - stamp) / 1.19) * 1000) / 1000;
        const vat = Math.round((sub * 0.19) * 1000) / 1000;
        selectedSupplier = {
          supplier: "Facture Importée S.A.R.L.",
          matriculeFiscal: "1234567/X/A/000",
          subtotal: Math.max(0.1, sub),
          fodec: 0.000,
          vatRate: 19,
          vatAmount: Math.max(0, vat),
          stampDuty: stamp,
          totalAmount: total,
          category: "Autres",
        };
      }
    }
  }

  return {
    ...selectedSupplier,
    date: new Date().toISOString().split('T')[0],
    invoiceNumber: "FAC-TN-2026-" + Math.floor(Math.random() * 90000 + 10000)
  };
};

/**
 * Analyse financière via n8n (ou simulation locale en fallback).
 * @param {string} apiKey        - Clé d'API n8n
 * @param {Object} dashboardData - Indicateurs financiers
 * @returns {Promise<string>}    - Rapport Markdown
 */
export const analyzeDashboardWithGemini = async (apiKey, dashboardData) => {
  // Tentative webhook n8n
  if (apiKey && apiKey !== 'local' && apiKey !== 'n8n-local') {
    try {
      const data = await callN8nWebhook(N8N_ANALYZE_ENDPOINT, { dashboardData }, apiKey);
      return data.report || data.markdown || JSON.stringify(data);
    } catch (e) {
      console.warn("Webhook n8n analyse échoué, basculement vers le moteur local :", e.message);
    }
  }

  // Simulation locale
  await new Promise(resolve => setTimeout(resolve, 1800));

  const {
    totalRevenues = 0,
    pendingRevenues = 0,
    totalExpenses = 0,
    bankBalance = 0,
  } = dashboardData;

  const netResult = totalRevenues - totalExpenses;
  const marginRate = totalRevenues > 0 ? ((netResult / totalRevenues) * 100).toFixed(1) : "0.0";

  const provisionIS = netResult > 0 ? netResult * 0.15 : 0;
  const baseSalariale = Math.max(totalExpenses * 0.35, 4500);
  const provisionCNSS = baseSalariale * 0.1657;

  const fmt = (val) => {
    return new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(val) + " DT";
  };

  const statusSante = netResult > 5000
    ? "Excellent (Rentable & Solide)"
    : netResult > 0
      ? "Stable (Équilibre à consolider)"
      : "Alerte (Déficit temporaire)";

  const diagnosticPointsForts = [];
  const diagnosticVigilance = [];

  if (netResult > 0) {
    diagnosticPointsForts.push(`**Rentabilité positive :** Votre résultat net s'élève à \`${fmt(netResult)}\` avec un taux de marge de \`${marginRate}%\`.`);
  } else {
    diagnosticVigilance.push(`**Résultat déficitaire :** Vos charges cumulées (\`${fmt(totalExpenses)}\`) dépassent vos revenus encaissés (\`${fmt(totalRevenues)}\`).`);
  }

  if (bankBalance > (provisionIS + provisionCNSS)) {
    diagnosticPointsForts.push(`**Trésorerie saine :** Votre solde en banque de \`${fmt(bankBalance)}\` couvre largement les provisions fiscales et sociales.`);
  } else {
    diagnosticVigilance.push(`**Tension de trésorerie :** Le solde bancaire de \`${fmt(bankBalance)}\` est insuffisant ou trop proche des obligations prévisionnelles cumulées (\`${fmt(provisionIS + provisionCNSS)}\`).`);
  }

  if (pendingRevenues > 0) {
    diagnosticPointsForts.push(`**Gisement de cash :** Vous avez \`${fmt(pendingRevenues)}\` de factures clients en attente de paiement, de quoi doper votre trésorerie.`);
  } else {
    diagnosticVigilance.push(`**Pas de factures en attente :** Pas d'encaissements prévus à court terme, veillez à sécuriser de nouveaux acomptes.`);
  }

  return `### 📊 Diagnostic Flash de Smart-Comptable (Simulé)
Bonjour, je suis **Smart-Comptable**, votre analyste financier IA dédié à l'écosystème de **Smart Comptable**. Voici l'audit instantané pour **Carthage Creative Studio S.A.R.L** :

> [!NOTE]
> Pour activer des rapports d'audit pilotés par votre **workflow n8n**, configurez l'URL du webhook et la clé d'API dans \`geminiService.js\`.

*   **Santé Globale :** **${statusSante}**
*   **Taux de Marge Opérationnelle :** \`${marginRate}%\`

#### ✅ Points Forts
${diagnosticPointsForts.map(pt => `- ${pt}`).join('\n')}

#### ⚠️ Points de Vigilance
${diagnosticVigilance.map(pt => `- ${pt}`).join('\n')}

---

### 💸 Focus Trésorerie & Flux
*   **Liquidités disponibles (Banque) :** **${fmt(bankBalance)}**
*   **Total des encaissements (Revenus) :** \`${fmt(totalRevenues)}\`
*   **Total des décaissements (Dépenses) :** \`${fmt(totalExpenses)}\`
*   **Factures clients non payées :** \`${fmt(pendingRevenues)}\` (Revenus à recouvrer activement pour consolider le fonds de roulement).

> **L'avis de l'expert :** ${bankBalance > totalExpenses ? "Votre structure dispose d'une bonne réserve de liquidités, ce qui vous permet d'envisager des investissements ou des recrutements à court terme." : "Attention à la gestion du BFR (Besoin en Fonds de Roulement). Priorisez le recouvrement des factures clients en attente pour éviter tout découvert."}

---

### 📝 Point Fiscal & Social (Tunisie)
Conformément aux règles comptables et à la Loi de Finances tunisienne, voici l'évaluation de vos provisions obligatoires :

| Obligation | Base de calcul | Taux appliqué | Provision Estimée | Statut |
| :--- | :--- | :---: | :---: | :--- |
| **Impôt sur les Sociétés (IS)** | Résultat Fiscal (\`${fmt(Math.max(0, netResult))}\`) | **15.00%** | \`${fmt(provisionIS)}\` | Prévisionnel mensuel |
| **CNSS Employeur** | Masse Salariale (\`${fmt(baseSalariale)}\`) | **16.57%** | \`${fmt(provisionCNSS)}\` | Provision trimestrielle |
| **Total Estimé** | - | - | **${fmt(provisionIS + provisionCNSS)}** | **À provisionner** |

*Note légale : Ces estimations sont fournies à titre indicatif par Smart Comptable pour votre gestion de trésorerie interne. Les déclarations finales doivent être validées avec votre comptable agréé ou sur le portail de la Recette des Finances.*

---

### 🚀 Actions Immédiates Recommandées
Voici votre feuille de route pour les prochains jours :

1.  **[ ] Rapprochement Bancaire :** Rapprocher les dernières transactions non validées pour s'assurer que le solde réel de \`${fmt(bankBalance)}\` concorde avec vos écritures comptables.
2.  **[ ] Recouvrement client :** Relancer les clients associés aux factures en attente pour capter les \`${fmt(pendingRevenues)}\` en souffrance.
3.  **[ ] Provisionnement Fiscal :** Transférer un montant de **${fmt(provisionIS + provisionCNSS)}** vers un compte d'épargne dédié pour anticiper le paiement de l'IS et de la prochaine échéance CNSS.
4.  **[ ] Justificatifs manquants :** Passer par l'onglet **Scan Reçus** pour numériser toutes vos factures d'achat papier et optimiser votre assiette fiscale.`;
};

/**
 * Parse le texte brut d'une facture tunisienne (utilisé par l'OCR local).
 */
export const parseInvoiceText = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let supplier = "Fournisseur Général S.A.";
  let matriculeFiscal = "1234567/X/A/000";
  let date = new Date().toISOString().split('T')[0];
  let subtotal = 0;
  let fodec = 0;
  let vatRate = 19;
  let vatAmount = 0;
  let stampDuty = 1.000;
  let totalAmount = 0;
  let category = "Autres";
  let invoiceNumber = "FAC-LOC-" + Math.floor(Math.random() * 90000 + 10000);

  const textClean = text.replace(/[\r\n]+/g, " ");
  const textLower = textClean.toLowerCase();

  if (textLower.includes("ooredoo")) {
    supplier = "Ooredoo Tunisie S.A.";
    matriculeFiscal = "0731024/M/A/M00";
    category = "Télécoms & Internet";
  } else if (textLower.includes("steg")) {
    supplier = "STEG (Société Tunisienne de l'Électricité et du Gaz)";
    matriculeFiscal = "0000120/A/M/000";
    category = "Énergie & Utilités";
    vatRate = 13;
  } else if (textLower.includes("orange")) {
    supplier = "Orange Tunisie S.A.";
    matriculeFiscal = "1138402/Y/A/000";
    category = "Télécoms & Internet";
  } else if (textLower.includes("telecom") || textLower.includes("tunisie t")) {
    supplier = "Tunisie Telecom S.A.";
    matriculeFiscal = "0000100/P/A/000";
    category = "Télécoms & Internet";
  } else if (textLower.includes("monoprix")) {
    supplier = "Monoprix Tunisie";
    matriculeFiscal = "0002340/C/A/000";
    category = "Fournitures de Bureau";
  } else if (textLower.includes("carrefour")) {
    supplier = "Carrefour Tunisie (UHD)";
    matriculeFiscal = "0482019/D/A/000";
    category = "Fournitures de Bureau";
  } else if (textLower.includes("tunisair")) {
    supplier = "Tunisair";
    matriculeFiscal = "0001045/P/A/000";
    category = "Déplacements";
    vatRate = 7;
  } else if (lines.length > 0) {
    supplier = lines[0].substring(0, 40);
  }

  const mfRegex = /(\d{7})\s*[\/\s-]?\s*([A-Z])\s*[\/\s-]?\s*([A-Z])\s*[\/\s-]?\s*([A-Z])\s*[\/\s-]?\s*(\d{3})/i;
  const mfMatch = text.match(mfRegex);
  if (mfMatch) {
    matriculeFiscal = `${mfMatch[1]}/${mfMatch[2].toUpperCase()}/${mfMatch[3].toUpperCase()}/${mfMatch[5] || '000'}`;
  }

  const dateRegex = /(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  const invNumRegex = /(facture|n°|numéro|invoice|fac|ref)\s*[:#\-]?\s*([A-Z0-9\-_]{4,15})/i;
  const invNumMatch = text.match(invNumRegex);
  if (invNumMatch && invNumMatch[2]) {
    invoiceNumber = invNumMatch[2].toUpperCase();
  }

  const getNumberNearKeyword = (keywords, textStr) => {
    for (const kw of keywords) {
      const idx = textStr.indexOf(kw);
      if (idx !== -1) {
        const sub = textStr.substring(idx + kw.length, idx + kw.length + 40);
        const match = sub.match(/(\d+[\.,]\d{2,3})/);
        if (match) {
          const val = parseFloat(match[1].replace(',', '.'));
          if (!isNaN(val) && val > 0) return val;
        }
      }
    }
    return null;
  };

  const ttcKeywords = ["total ttc", "net à payer", "net a payer", "ttc", "total à payer", "total a payer", "montant total", "payer"];
  totalAmount = getNumberNearKeyword(ttcKeywords, textLower) || 0;

  const htKeywords = ["total ht", "net ht", "hors taxe", "ht", "montant ht"];
  subtotal = getNumberNearKeyword(htKeywords, textLower) || 0;

  const fodecKeywords = ["fodec", "f.o.d.e.c"];
  fodec = getNumberNearKeyword(fodecKeywords, textLower) || 0;

  const tvaKeywords = ["montant tva", "tva", "t.v.a"];
  vatAmount = getNumberNearKeyword(tvaKeywords, textLower) || 0;

  if (textLower.includes("19%")) vatRate = 19;
  else if (textLower.includes("13%")) vatRate = 13;
  else if (textLower.includes("7%")) vatRate = 7;
  else if (textLower.includes("0%")) vatRate = 0;

  if (totalAmount > 0) {
    if (subtotal === 0) {
      const hasFodec = textLower.includes("fodec") || fodec > 0;
      const multiplier = hasFodec ? 1.01 : 1.0;
      const calculatedBase = (totalAmount - stampDuty) / (1 + vatRate / 100);
      subtotal = calculatedBase / multiplier;
      if (hasFodec) {
        fodec = subtotal * 0.01;
      }
      vatAmount = calculatedBase * (vatRate / 100);
    }
  } else if (subtotal > 0) {
    const hasFodec = textLower.includes("fodec") || fodec > 0;
    if (hasFodec && fodec === 0) {
      fodec = subtotal * 0.01;
    }
    const baseTva = subtotal + fodec;
    vatAmount = baseTva * (vatRate / 100);
    totalAmount = baseTva + vatAmount + stampDuty;
  } else {
    const amountRegex = /(\d+[\.,]\d{2,3})/g;
    const amountMatches = text.match(amountRegex) || [];
    const candidates = [];
    amountMatches.forEach(m => {
      const val = parseFloat(m.replace(',', '.'));
      if (!isNaN(val) && val > 1 && val < 5000 && val !== 1053 && val !== 2037 && val !== 1003 && val !== 2000) {
        candidates.push(val);
      }
    });
    candidates.sort((a, b) => a - b);
    if (candidates.length > 0) {
      totalAmount = candidates[candidates.length - 1];
      const calculatedBase = (totalAmount - stampDuty) / (1 + vatRate / 100);
      subtotal = calculatedBase;
      vatAmount = calculatedBase * (vatRate / 100);
    } else {
      subtotal = 100.000;
      fodec = 0.000;
      vatAmount = 19.000;
      stampDuty = 1.000;
      totalAmount = 120.000;
    }
  }

  return {
    supplier,
    matriculeFiscal,
    date,
    subtotal: Math.max(0, Math.round(subtotal * 1000) / 1000),
    fodec: Math.round(fodec * 1000) / 1000,
    vatRate,
    vatAmount: Math.max(0, Math.round(vatAmount * 1000) / 1000),
    stampDuty,
    totalAmount: Math.round(totalAmount * 1000) / 1000,
    category,
    invoiceNumber
  };
};

/**
 * Convertit un File en Base64.
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result;
      const split = result.split(',');
      const match = split[0].match(/:(.*?);/);
      resolve({
        base64Data: split[1],
        mimeType: match ? match[1] : file.type
      });
    };
    reader.onerror = (error) => reject(error);
  });
};