/**
 * teifGenerator.js — Wrapper client pour le générateur XML TEIF partagé
 *
 * Ajoute readConfig() (localStorage) et downloadTEIFXML() (Blob navigateur)
 * par-dessus le générateur pur dans shared/teif-generator.js
 */

import { generateTEIFXML as sharedGenerate, validateTEIF, esc, fmt3, makeId } from '../../shared/teif-generator.js';

export { esc, fmt3, makeId, validateTEIF };

function readConfig() {
  try {
    const c1 = JSON.parse(localStorage.getItem('smart_config') || '{}');
    const c2 = JSON.parse(localStorage.getItem('smart_entreprise') || '{}');
    const c3 = JSON.parse(localStorage.getItem('entreprise') || '{}');

    const currentId = localStorage.getItem('smart_comptable_current_id');
    let c4 = {};
    if (currentId) {
      try {
        const all = JSON.parse(localStorage.getItem('smart_comptable_companies') || '{}');
        const company = all[currentId];
        if (company?.companyDetails) {
          const d = company.companyDetails;
          c4 = {
            matriculeFiscal: d.vatNumber || d.matriculeFiscal || '',
            mf: d.vatNumber || d.matriculeFiscal || '',
            nom: d.name || d.companyName || '',
            raisonSociale: d.name || d.companyName || '',
            adresse: d.address || '',
            rne: d.rne || '',
          };
        }
      } catch {}
    }

    return { ...c3, ...c2, ...c1, ...c4 };
  } catch {
    return {};
  }
}

export function generateTEIFXML(invoice) {
  const config = readConfig();
  return sharedGenerate(invoice, config);
}

export function downloadTEIFXML(xmlString, invoiceId) {
  try {
    if (!xmlString) return;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `TEIF-${invoiceId || 'facture'}-${date}.xml`;
    const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    /* silencieux */
  }
}
