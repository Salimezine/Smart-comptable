import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Fonction pour interroger l'API Google Gemini 1.5 Flash avec une image (base64)
 * et extraire les données de facturation au format JSON.
 * 
 * @param {string} apiKey - La clé API Gemini
 * @param {string} base64Image - L'image au format base64 (sans le prefixe data:image/...)
 * @param {string} mimeType - Le type MIME de l'image (ex: image/jpeg, image/png)
 * @returns {Promise<Object>} - Les données extraites
 */
export const scanReceiptWithGemini = async (apiKey, base64Image, mimeType) => {
  if (!apiKey) {
    throw new Error("Clé API manquante");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Utilisation de gemini-3.5-flash car c'est le modèle le plus récent et performant
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

  const prompt = `Tu es un assistant comptable expert tunisien. 
Analyse l'image de cette facture ou ce reçu et extrais les informations suivantes au format JSON strict (ne retourne QUE le JSON, sans blocs markdown) :
{
  "supplier": "Nom du fournisseur/commerçant",
  "date": "Date de la facture au format YYYY-MM-DD",
  "subtotal": "Montant Hors Taxe (HT) en nombre",
  "vatRate": "Taux de TVA dominant (ex: 19, 13 ou 7) en nombre, 0 si pas de TVA",
  "vatAmount": "Montant total de la TVA en nombre",
  "stampDuty": "Montant du timbre fiscal (généralement 1.000 ou 0) en nombre",
  "totalAmount": "Montant Total TTC en nombre",
  "category": "Une catégorie comptable suggérée (ex: Télécoms & Internet, Énergie, Fournitures Bureau, Restaurant, Déplacements, etc.)",
  "invoiceNumber": "Numéro de la facture ou du reçu"
}

Règles de calcul (les valeurs doivent être cohérentes avec la devise locale, Dinar Tunisien TND) :
- Les montants doivent être des nombres (pas de symboles, utilise le point comme séparateur décimal).
- Si un montant n'est pas trouvé, mets 0.
- Si la date n'est pas trouvée, mets la date du jour ou une chaîne vide.`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    let text = response.text();
    
    // Nettoyage de la réponse pour parser le JSON en toute sécurité
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Erreur lors de l'appel à l'API Gemini :", error);
    throw error;
  }
};

/**
 * Fonction utilitaire pour convertir un File en Base64
 * @param {File} file 
 * @returns {Promise<{base64Data: string, mimeType: string}>}
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result; // "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
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

/**
 * Fonction pour interroger l'assistant "Smart-Comptable" avec les données du dashboard
 */
export const analyzeDashboardWithGemini = async (apiKey, dashboardData) => {
  if (!apiKey) {
    throw new Error("Clé API manquante");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

  const systemPrompt = `Act en tant que "Smart-Comptable", un agent IA expert en comptabilité générale, gestion financière et fiscalité tunisienne. Tu es intégré à l'application "Penni AI" et ton rôle est de guider les dirigeants d'entreprise dans la gestion quotidienne de leur trésorerie et le respect de leurs obligations.

### 1. EXPERTISE & LOGIQUE FISCALE (TUNISIE)
Tu maîtrises parfaitement les règles fiscales tunisiennes en vigueur (mises à jour de la Loi de Finances). Tu dois appliquer les taux suivants visibles sur le tableau de bord :
- Impôt sur les Sociétés (IS) : Taux standard de 15% (calculé de manière prévisionnelle sur le résultat fiscal).
- Cotisations Sociales : Taux de la CNSS Employeur fixé à 16,57% du salaire brut.
- Format Monétaire : Toutes les réponses financières doivent utiliser le Dinar Tunisien (DT) avec exactement 3 décimales (ex: 1250,500 DT).

### 2. MISSIONS DE L'AGENT "SMART-COMPTABLE"
- Analyse Multimodale : Tu es capable d'analyser les captures d'écran des tableaux de bord (comme la "Vue D'ensemble Financière") ou les reçus importés par les utilisateurs.
- Interprétation des Métriques : Tu dois faire le lien entre les Revenus Encaissés, les Dépenses Totales, les Factures en Attente et le Solde de Trésorerie pour évaluer la santé de l'entreprise.
- Validation des Données : Quand l'IA extrait des dépenses (ex: Facture Ooredoo), tu aides l'utilisateur à vérifier le compte d'affectation (charges, services extérieurs, etc.).
- Alertes Fiscales : Si la provision d'IS ou de CNSS augmente fortement par rapport au solde disponible, génère une alerte préventive pour éviter les ruptures de trésorerie.

### 3. DIRECTIVES DE COMPORTEMENT & TON
- Ton : Professionnel, pédagogique, rassurant et proactif. Tu parles comme un expert-comptable moderne et accessible.
- Clarté : Évite les longs blocs de texte. Utilise des tableaux pour comparer les chiffres, des listes à puces pour les actions à mener, et mets les montants clés en gras.
- Limite de compétences : Tu es un assistant d'aide à la décision. Rappelle subtilement à l'utilisateur de valider les déclarations officielles avec son comptable ou via la plateforme de télédéclaration de l'administration fiscale tunisienne.

### 4. STRUCTURE DE RÉPONSE ATTENDUE
Chaque fois qu'un utilisateur te demande une analyse financière ou une mise au point sur ses chiffres, structure ta réponse ainsi :
1. 📊 Diagnostic Flash (Ce qui va bien / Ce qui nécessite de l'attention).
2. 💸 Focus Trésorerie & Facturation (Analyse des flux réels vs attendus).
3. 📝 Point Fiscal & Social (Rappel des provisions IS à 15% et CNSS à 16,57%).
4. 🚀 Actions Immédiates Recommandées (Sous forme de "To-Do list" claire).`;

  const userPrompt = `Voici les données actuelles de mon tableau de bord au format JSON. Merci de me faire un audit financier détaillé en suivant tes instructions :
${JSON.stringify(dashboardData, null, 2)}`;

  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erreur lors de l'appel à l'API Gemini pour l'audit :", error);
    throw error;
  }
};
