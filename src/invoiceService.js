import { predictCategory, predictVatRate, suggestDefaultAmount } from './learningEngine';

export const generateInvoiceLocal = async (userPrompt, companyDetails, lastInvoiceNumber) => {
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
  const retenueSource = isService ? Math.round(subtotal * 0.01 * 1000) / 1000 : 0;

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
