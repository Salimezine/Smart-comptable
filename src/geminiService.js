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
  // Utilisation de gemini-1.5-flash car il est très rapide et excellent pour le texte/images
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
