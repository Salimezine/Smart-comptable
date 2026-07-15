import * as pdfjs from 'pdfjs-dist';
import ExcelJS from 'exceljs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const EXERCICE_RE = new RegExp('(?:exercice|période|année|du\\s*\\d{2}\\/\\d{2}\\/)?\\s*(\\d{4})\\s*(?:du|au|\\/)?.{0,20}?(\\d{4})?', 'i');

const BALANCE_HEADERS = ['compte','numéro','n°','num','comptes','code','intitulé','libellé','désignation','lib','débit','crédit','debit','credit','solde débiteur','solde crediteur','solde','soldes','total débit','total crédit','cumul débit','cumul crédit'];
const BILAN_HEADERS = ['actif','passif','capitaux','emplois','ressources','immobilisations','stocks','créances','trésorerie','dettes','provisions','résultat'];

function guessDelimiter(firstLine) {
  const delimiters = [';', ',', '\t', '|'];
  return delimiters.reduce((best, d) => {
    const count = (firstLine.match(new RegExp(d === '\t' ? '\t' : `\\${d}`, 'g')) || []).length;
    return count > (best?.count || 0) ? { char: d, count } : best;
  }, null)?.char || ';';
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('Le fichier CSV est vide ou ne contient qu\'une seule ligne.');
  const delimiter = guessDelimiter(lines[0]);
  const rows = lines.map(l => {
    const parts = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (c === delimiter && !inQuotes) { parts.push(current.trim()); current = ''; continue; }
      current += c;
    }
    parts.push(current.trim());
    return parts;
  });
  return { headers: rows[0], data: rows.slice(1).filter(r => r.some(c => c)) };
}

function cleanNum(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number') return val;
  let s = String(val).trim();
  s = s.replace(/\s/g, '');
  s = s.replace(',', '.');
  s = s.replace(/[^0-9.\-]/g, '');
  return parseFloat(s);
}

function detectColumnIndex(headers, keywords) {
  const h = headers.map((h, i) => ({ h: String(h).toLowerCase().trim(), i }));
  for (const kw of keywords) {
    const match = h.find(x => x.h.includes(kw) || x.h === kw);
    if (match) return match.i;
  }
  return -1;
}

function detectType(rows) {
  const allText = rows.slice(0, 20).flat().join(' ').toLowerCase();
  const bilanScore = BILAN_HEADERS.filter(h => allText.includes(h)).length;
  const balanceScore = BALANCE_HEADERS.filter(h => allText.includes(h)).length;
  const hasNumbers = rows.slice(0, 30).some(r => r.some(c => /^\d{3,8}$/.test(String(c).trim())));
  if (bilanScore > balanceScore && bilanScore >= 2) return 'bilan';
  if (balanceScore >= 2 || hasNumbers) return 'balance';
  if (bilanScore >= 1) return 'bilan';
  throw new Error('Type de fichier non détecté. Vérifiez que le fichier contient une balance (comptes débit/crédit) ou un bilan (actif/passif).');
}

function detectExercice(rows) {
  for (const r of rows) {
    for (const c of r) {
      const s = String(c);
      const m = s.match(EXERCICE_RE);
      if (m) return m[1];
    }
  }
  return new Date().getFullYear().toString();
}

function normalizeCompte(val) {
  if (val == null || val === '') return '';
  const s = String(val).trim().replace(/\s.*$/, '').trim();
  return s.replace(/[^0-9]/g, '');
}

function extractAccountsFromRows(headers, data, type) {
  const colCompte = detectColumnIndex(headers, ['compte','numéro','n°','numéro de compte','code compte','comptes','code']);
  const colLibelle = detectColumnIndex(headers, ['intitulé','libellé','désignation','lib','nom','label','name']);
  const colDebit = detectColumnIndex(headers, ['débit','debit','total débit','cumul débit','mouvement débiteur','montant débit']);
  const colCredit = detectColumnIndex(headers, ['crédit','credit','total crédit','cumul crédit','mouvement créditeur','montant crédit']);
  const colSoldeDeb = detectColumnIndex(headers, ['solde débiteur','solde debiteur','solde débiteur']);
  const colSoldeCred = detectColumnIndex(headers, ['solde créditeur','solde crediteur','solde créditeur']);
  const colSolde = detectColumnIndex(headers, ['solde','soldes','solde net']);
  const colMontant = detectColumnIndex(headers, ['montant','total','valeur']);

  const accounts = [];
  for (const row of data) {
    if (row.length < 2) continue;
    const compte = colCompte >= 0 ? normalizeCompte(row[colCompte]) : '';
    if (!compte || compte.length < 2) continue;
    const compteNum = parseInt(compte, 10);
    if (isNaN(compteNum)) continue;

    const libelle = colLibelle >= 0 ? String(row[colLibelle] || '').trim() : '';

    let debit = colDebit >= 0 ? cleanNum(row[colDebit]) : NaN;
    let credit = colCredit >= 0 ? cleanNum(row[colCredit]) : NaN;
    const soldeDeb = colSoldeDeb >= 0 ? cleanNum(row[colSoldeDeb]) : NaN;
    const soldeCred = colSoldeCred >= 0 ? cleanNum(row[colSoldeCred]) : NaN;
    const solde = colSolde >= 0 ? cleanNum(row[colSolde]) : NaN;

    if (isNaN(debit) && isNaN(credit)) {
      if (!isNaN(soldeDeb) || !isNaN(soldeCred)) {
        debit = isNaN(soldeDeb) ? 0 : soldeDeb;
        credit = isNaN(soldeCred) ? 0 : soldeCred;
      } else if (!isNaN(solde)) {
        debit = solde > 0 ? solde : 0;
        credit = solde < 0 ? -solde : 0;
      } else {
        debit = 0;
        credit = 0;
      }
    }

    accounts.push({ compte, libelle, debitTotal: debit || 0, creditTotal: credit || 0, soldeDebiteur: (debit > credit ? debit - credit : 0), soldeCrediteur: (credit > debit ? credit - debit : 0) });
  }

  return accounts;
}

export async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Le fichier Excel ne contient aucune feuille de calcul.');

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell) => { values.push(cell.value); });
    rows.push(values);
  });

  if (rows.length < 2) throw new Error('Le fichier Excel est vide.');

  const headers = rows[0].map(h => h?.value ?? h ?? '');
  const data = rows.slice(1).filter(r => r.some(c => c != null && c !== ''));
  const type = detectType([headers, ...data]);
  const exercice = detectExercice(rows);
  const accounts = extractAccountsFromRows(headers, data, type);

  return { type, filename: file.name, exercice, accounts, rawData: { headers, rows: data } };
}

export async function parseCSVFile(file) {
  const text = await file.text();
  const textClean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const { headers, data } = parseCSV(textClean);
  const type = detectType([headers, ...data]);
  const exercice = detectExercice([headers, ...data]);
  const accounts = extractAccountsFromRows(headers, data, type);
  return { type, filename: file.name, exercice, accounts, rawData: { headers, rows: data } };
}

export async function parsePDFFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let allText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    let lastY = -1;
    for (const item of tc.items) {
      const y = Math.round(item.transform[5]);
      if (lastY >= 0 && y < lastY - 2) allText += '\n';
      else if (lastY >= 0 && y === lastY) allText += ' ';
      else if (lastY >= 0) allText += '\n';
      allText += item.str;
      lastY = y;
    }
    allText += '\n';
  }
  allText = allText.trim();
  if (allText.length < 20) throw new Error('Le PDF ne contient pas assez de texte exploitable. Vérifiez qu\'il s\'agit d\'un PDF textuel (pas une image scannée).');
  return parseCSVFromText(allText, file.name);
}

function parseCSVFromText(text, filename) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('Impossible d\'extraire les données du PDF.');
  const isTabular = lines.every(l => /\t| {2,}|;/.test(l));
  if (isTabular) {
    const delimiter = guessDelimiter(lines[0]);
    const { headers, data } = parseCSV(lines.join('\n'));
    const type = detectType([headers, ...data]);
    const exercice = detectExercice([headers, ...data]);
    const accounts = extractAccountsFromRows(headers, data, type);
    return { type, filename, exercice, accounts, rawData: { headers, rows: data } };
  }
  const headers = ['compte', 'intitulé', 'montant'];
  const data = lines.map(l => {
    const parts = l.trim().split(/\s{2,}| {2,}/);
    return parts.length >= 2 ? parts : [l];
  }).filter(r => r.length >= 2 && /^\d{3,8}$/.test(normalizeCompte(r[0])));
  const type = 'balance';
  const exercice = detectExercice(lines.map(l => [l]));
  const colCompte = 0;
  const colLibelle = 1;
  const colMontant = 2;
  const accounts = data.map(row => {
    const compte = normalizeCompte(row[0]);
    const libelle = String(row[1] || '').trim();
    const montant = cleanNum(row[colMontant] || row[row.length - 1]) || 0;
    return { compte, libelle, debitTotal: montant > 0 ? montant : 0, creditTotal: montant < 0 ? -montant : 0, soldeDebiteur: montant > 0 ? montant : 0, soldeCrediteur: montant < 0 ? -montant : 0 };
  }).filter(a => a.compte);
  return { type, filename, exercice, accounts, rawData: { headers, rows: data } };
}

export async function parseBalanceFile(file) {
  const isExcel = /\.xlsx?$/i.test(file.name);
  const isCSV = /\.csv$/i.test(file.name);
  const isPDF = /\.pdf$/i.test(file.name);
  if (isExcel) return parseExcelFile(file);
  if (isCSV) return parseCSVFile(file);
  if (isPDF) return parsePDFFile(file);
  throw new Error('Format non supporté. Utilisez Excel (.xlsx), CSV (.csv) ou PDF (.pdf).');
}
