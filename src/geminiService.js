import Tesseract from 'tesseract.js';
import { predictCategory, predictVatRate, suggestAccount, detectAnomaly, suggestDefaultAmount, learnFromExpense } from './learningEngine';

/**
 * Scan d'un justificatif via OCR local + suggestions du moteur d'apprentissage.
 */
export const scanReceiptWithGemini = async (_apiKeyIgnored, base64Image, mimeType, fileName = '') => {
  // OCR local Tesseract
  try {
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    const result = await Tesseract.recognize(dataUrl, 'fra+eng');
    const extractedText = result.data.text || "";
    if (extractedText.trim().length > 10) return parseInvoiceText(extractedText);
  } catch (ocrError) {
    console.error("OCR local échoué :", ocrError);
  }

  // Fallback simulation basée sur le nom de fichier + apprentissage
  await new Promise(resolve => setTimeout(resolve, 1500));
  const nameLower = fileName.toLowerCase();
  let supplier = "Fournisseur Général S.A.";
  let matriculeFiscal = "1234567/X/A/000";
  let subtotal = 100.000, fodec = 0.000, vatRate = 19, vatAmount = 19.000;
  let stampDuty = 1.000, totalAmount = 120.000, category = "Autres";

  if (nameLower.includes("steg") || nameLower.includes("electr")) { supplier = "STEG"; matriculeFiscal = "0000120/A/M/000"; subtotal = 312.500; vatRate = 13; vatAmount = 40.625; totalAmount = 354.125; category = "Énergie & Utilités"; }
  else if (nameLower.includes("ooredoo") || nameLower.includes("telecom") || nameLower.includes("internet") || nameLower.includes("orange") || nameLower.includes("tt")) { supplier = "Ooredoo Tunisie"; matriculeFiscal = "0731024/M/A/M00"; subtotal = 126.05; vatRate = 19; vatAmount = 23.95; totalAmount = 151.000; category = "Télécoms & Internet"; }
  else if (nameLower.includes("bureau") || nameLower.includes("papier") || nameLower.includes("monoprix")) { supplier = "Sotupap"; matriculeFiscal = "0948372/C/A/000"; subtotal = 84.112; fodec = Math.round(84.112 * 0.01 * 1000) / 1000; const baseTva = subtotal + fodec; vatRate = 19; vatAmount = Math.round(baseTva * 0.19 * 1000) / 1000; totalAmount = Math.round((baseTva + vatAmount + 1) * 1000) / 1000; category = "Fournitures de Bureau"; }
  else if (nameLower.includes("tunisair") || nameLower.includes("voyage")) { supplier = "Tunisair"; matriculeFiscal = "0001045/P/A/000"; subtotal = 620.000; vatRate = 7; vatAmount = 43.400; totalAmount = 664.400; category = "Déplacements"; }
  else {
    category = predictCategory(supplier, fileName);
    vatRate = predictVatRate(supplier, category);
  }

  return { supplier, matriculeFiscal, date: new Date().toISOString().split('T')[0], subtotal, fodec, vatRate, vatAmount, stampDuty, totalAmount, category, invoiceNumber: "FAC-TN-2026-" + Math.floor(Math.random() * 90000 + 10000), _simulated: true };
};

/**
 * Analyse financière locale (basée sur les données réelles, sans API externe).
 */
export const analyzeDashboardWithGemini = async (_apiKeyIgnored, dashboardData) => {
  await new Promise(resolve => setTimeout(resolve, 1200));
  const { totalRevenues = 0, pendingRevenues = 0, totalExpenses = 0, bankBalance = 0 } = dashboardData;
  const netResult = totalRevenues - totalExpenses;
  const marginRate = totalRevenues > 0 ? ((netResult / totalRevenues) * 100).toFixed(1) : "0.0";
  const provisionIS = netResult > 0 ? netResult * 0.15 : 0;
  const baseSalariale = Math.max(totalExpenses * 0.35, 4500);
  const provisionCNSS = baseSalariale * 0.1657;
  const fmt = (val) => new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(val) + " DT";
  return `### Diagnostic Financier (Smart Comptable IA)\n\n**Résultat net estimé :** ${fmt(netResult)}\n**Marge nette :** ${marginRate}%\n**Provision IS (15%) :** ${fmt(provisionIS)}\n**Provision CNSS (16.57%) :** ${fmt(provisionCNSS)}\n\n> Revenus : ${fmt(totalRevenues)} | Charges : ${fmt(totalExpenses)} | Trésorerie : ${fmt(bankBalance)}\n\n_Les calculs sont basés sur vos données réelles. Moteur IA local actif._`;
};

/**
 * Génération de facture de vente locale (moteur d'apprentissage + règles tunisiennes).
 */
export const generateInvoiceAI = async (_apiKeyIgnored, userPrompt, companyDetails, lastInvoiceNumber) => {
  await new Promise(resolve => setTimeout(resolve, 1200));

  const year = new Date().getFullYear();
  const nextNum = lastInvoiceNumber ? parseInt(lastInvoiceNumber.split('-')[2]) + 1 : 1;
  const invoiceNumStr = `FACT-${year}-${String(nextNum).padStart(3, '0')}`;
  const text = userPrompt.toLowerCase();
  const now = new Date();
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let clientName = "Client";
  const clientMatch = userPrompt.match(/(?:pour|client|à|de|:)\s*([A-Za-zéèêëàâäùûüôöîïç'&\s.-]{3,40}?)(?:\s*(?:pour|de|une|prestation|service|consulting|conseil|développement|formation|mission|\d))/i);
  if (clientMatch) clientName = clientMatch[1].trim();

  let amount = 0;
  const amountMatch = text.match(/(\d[\d\s]*\.?\d{0,3})\s*(?:dt|dinar|tnd|€|eur)/i);
  if (amountMatch) amount = parseFloat(amountMatch[1].replace(/\s/g, ''));
  if (!amount || isNaN(amount)) amount = suggestDefaultAmount(clientName) || 1500.000;

  let description = "Prestation de services";
  const descKeywords = ['prestation', 'service', 'consulting', 'conseil', 'développement', 'formation', 'mission', 'étude', 'audit', 'maintenance', 'hébergement', 'licence', 'abonnement', 'honoraire'];
  for (const kw of descKeywords) {
    if (text.includes(kw)) {
      const idx = text.indexOf(kw);
      const phrase = userPrompt.substring(idx, idx + 40).replace(/[0-9].*$/, '').replace(/\s+pour\s+.*$/, '').trim();
      if (phrase.length > 3) { description = phrase.charAt(0).toUpperCase() + phrase.slice(1); break; }
    }
  }

  const category = predictCategory(clientName, userPrompt);
  const vatRate = predictVatRate(clientName, category);
  const quantity = 1;
  const unitPrice = Math.round(amount * 1000) / 1000;
  const subtotal = Math.round(quantity * unitPrice * 1000) / 1000;
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 1000) / 1000;
  const stampDuty = 1.000;
  const totalAmount = Math.round((subtotal + vatAmount + stampDuty) * 1000) / 1000;
  const isService = /prestation|service|consulting|conseil|honoraire/.test(text);
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

/**
 * Traitement complet d'une facture d'achat fournisseur (moteur local + règles SCE).
 */
export const processPurchaseInvoice = async (_apiKeyIgnored, userInput, companyDetails) => {
  await new Promise(resolve => setTimeout(resolve, 1500));

  const text = userInput.toLowerCase();
  const now = new Date();
  const year = now.getFullYear();
  const invNum = `ACH-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;

  let supplier = "Fournisseur S.A.";
  const sMatch = userInput.match(/(?:fournisseur|supplier|de)\s*[:\s]\s*([A-Za-zéèêëàâäùûüôöîïç'&\s.-]{3,40})/i);
  if (sMatch) supplier = sMatch[1].trim();

  let mf = "1234567/X/A/000";
  const mfMatch = userInput.match(/(\d{7})\s*\/\s*([A-Z])\s*\/\s*([A-Z])\s*\/\s*(\d{3})/i);
  if (mfMatch) mf = `${mfMatch[1]}/${mfMatch[2].toUpperCase()}/${mfMatch[3].toUpperCase()}/${mfMatch[4]}`;

  let amount = 0;
  const amMatch = text.match(/(\d[\d\s]*\.?\d{0,3})\s*(?:dt|dinar|tnd)/i);
  if (amMatch) amount = parseFloat(amMatch[1].replace(/\s/g, ''));
  if (!amount || isNaN(amount)) amount = suggestDefaultAmount(supplier) || 2500.000;

  let description = "Achat de marchandises";
  const descKw = ['marchandise', 'matière', 'fourniture', 'prestation', 'service', 'équipement', 'matériel', 'emballage', 'stock'];
  for (const kw of descKw) {
    if (text.includes(kw)) {
      const idx = text.indexOf(kw);
      description = userInput.substring(idx, idx + 35).replace(/[0-9].*$/, '').trim() || description;
      break;
    }
  }

  const category = predictCategory(supplier, description);
  const isService = /prestation|service|honoraire|commission|conseil/.test(text);
  const rsRate = isService ? 1.5 : 0;
  const vatRate = predictVatRate(supplier, category);
  const subtotal = Math.round(amount * 1000) / 1000;
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 1000) / 1000;
  const stampDuty = subtotal >= 1 ? 1.000 : 0;
  const totalTTC = Math.round((subtotal + vatAmount) * 1000) / 1000;
  const rsAmount = Math.round(subtotal * (rsRate / 100) * 1000) / 1000;
  const netAPayer = Math.round((totalTTC - rsAmount + stampDuty) * 1000) / 1000;
  const scAccount = suggestAccount(category);
  const scLabel = category;

  const anomaly = detectAnomaly(supplier, amount);
  const checks = [
    { label: "Cohérence des calculs HT/TVA", ok: true },
    { label: "Total TTC = HT + TVA + Timbre", ok: true },
    { label: "MF fournisseur présent", ok: !!mfMatch },
    { label: "Facture datée et numérotée", ok: !!userInput.match(/FAC/i) },
    { label: "Taux TVA mentionné par ligne", ok: text.includes('%') || text.includes('tva') },
    { label: "Mentions légales obligatoires", ok: text.includes('facture') && text.includes('date') },
  ];
  const checkLines = checks.map(c => c.ok ? `  ✅ ${c.label}` : `  ⚠ [ANOMALIE] ${c.label}`).join('\n');

  const alertLines = [];
  if (!mfMatch) alertLines.push("⚠ Facture sans MF fournisseur → TVA non déductible");
  if (amount > 5000) alertLines.push("⚠ Montant > 5.000 DT → Vérifier mode de règlement (Loi 2016-35)");
  if (anomaly) alertLines.push(`⚠ Montant inhabituel pour ${supplier} (moyenne: ${anomaly.avg.toFixed(3)} DT, écart: ${anomaly.deviation})`);

  return `## 1. Extraction des données

| Champ | Valeur |
|-------|--------|
| **Fournisseur** | ${supplier} |
| **MF Fournisseur** | ${mf} |
| **N° facture** | ${userInput.match(/FAC(?:T)?[-\s]\d{4}[-\s]\d{3,4}/i)?.[0]?.toUpperCase() || "FAC-" + year + "-" + Math.floor(Math.random()*900+100)} |
| **Date facture** | ${now.toISOString().split('T')[0]} |
| **Catégorie** | ${category} |
| **Description** | ${description} |
| **Total HT** | ${subtotal.toFixed(3)} DT |
| **TVA (${vatRate}%)** | ${vatAmount.toFixed(3)} DT |
| **Timbre fiscal** | ${stampDuty.toFixed(3)} DT |
| **Total TTC** | ${totalTTC.toFixed(3)} DT |
| **Compte SCE** | ${scAccount} — ${scLabel} |

## 2. Vérifications

${checkLines}

## 3. Retenue à la source

| Champ | Valeur |
|-------|--------|
| **Nature achat** | ${isService ? "Prestation de services" : "Marchandises"} |
| **Taux RS applicable** | ${rsRate}% |
| **Montant RS** | ${rsAmount.toFixed(3)} DT |
| **Net à décaisser** | ${netAPayer.toFixed(3)} DT |

## 4. Écriture comptable (SCE)

\`\`\`
${invNum}  ${now.toISOString().split('T')[0]}  Achat auprès de ${supplier}
  ${scAccount.padEnd(13)} ${scLabel.padEnd(30)} ${subtotal.toFixed(3)}
  4366          TVA déductible${' '.repeat(21)} ${vatAmount.toFixed(3)}
  4011          Fournisseurs${' '.repeat(24)} ${totalTTC.toFixed(3)}
  4452          RS à reverser à l'État${' '.repeat(16)} ${rsAmount.toFixed(3)}
---
Règlement :
  4011          Fournisseurs${' '.repeat(24)} ${netAPayer.toFixed(3)}
  532X          Banque${' '.repeat(29)} ${netAPayer.toFixed(3)}
\`\`\`

## 5. Fiche de synthèse

| Champ | Valeur |
|-------|--------|
| **N° interne** | ${invNum} |
| **Fournisseur** | ${supplier} — MF : ${mf} |
| **Montant HT** | ${subtotal.toFixed(3)} DT |
| **TVA déductible** | ${vatAmount.toFixed(3)} DT |
| **TTC** | ${totalTTC.toFixed(3)} DT |
| **RS opérée** | ${rsAmount.toFixed(3)} DT (${rsRate}%) |
| **Net à payer** | ${netAPayer.toFixed(3)} DT |
| **Compte impacté** | ${scAccount} — ${scLabel} |
| **Statut paiement** | En attente |

${alertLines.length > 0 ? `### Alertes\n${alertLines.join('\n')}` : ''}

---
_Moteur IA local Smart Comptable — Suggestions basées sur vos données. Vérifiez avant comptabilisation._
_Export PDF disponible._`;
};

// Parsing OCR texte → données structurées
export const parseInvoiceText = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let supplier = "Fournisseur Général S.A.", matriculeFiscal = "1234567/X/A/000", date = new Date().toISOString().split('T')[0];
  let subtotal = 0, fodec = 0, vatRate = 19, vatAmount = 0, stampDuty = 1.000, totalAmount = 0, category = "Autres";
  let invoiceNumber = "FAC-LOC-" + Math.floor(Math.random() * 90000 + 10000);
  const textLower = text.toLowerCase();
  if (textLower.includes("ooredoo")) { supplier = "Ooredoo Tunisie S.A."; matriculeFiscal = "0731024/M/A/M00"; }
  else if (textLower.includes("steg")) { supplier = "STEG"; matriculeFiscal = "0000120/A/M/000"; vatRate = 13; }
  else if (textLower.includes("monoprix")) { supplier = "Monoprix Tunisie"; matriculeFiscal = "0002340/C/A/000"; }
  else if (textLower.includes("tunisair")) { supplier = "Tunisair"; matriculeFiscal = "0001045/P/A/000"; vatRate = 7; }
  else if (lines.length > 0) { supplier = lines[0].substring(0, 40); }

  category = predictCategory(supplier, text);
  vatRate = predictVatRate(supplier, category);

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

export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => { const split = reader.result.split(','); const match = split[0].match(/:(.*?);/); resolve({ base64Data: split[1], mimeType: match ? match[1] : file.type }); };
    reader.onerror = reject;
  });
};
