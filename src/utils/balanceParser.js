import * as pdfjs from 'pdfjs-dist';
import ExcelJS from 'exceljs';

try {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();
} catch (e) {
  console.warn('PDF worker init:', e.message);
}

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

function detectColumnIndex(headers, keywords, data) {
  const h = headers.map((h, i) => ({ h: String(h).toLowerCase().trim().replace(/[^a-z0-9éèêëàâäùûüôöîïç]/g, ''), i }));
  const raw = headers.map((h, i) => ({ h: String(h).toLowerCase().trim(), i }));
  for (const kw of keywords) {
    const kwClean = kw.replace(/[^a-z0-9éèêëàâäùûüôöîïç]/g, '');
    const match = h.find(x => x.h.includes(kwClean) || x.h === kwClean);
    if (match) return match.i;
    const rawMatch = raw.find(x => x.h.includes(kw) || x.h === kw);
    if (rawMatch) return rawMatch.i;
  }
  if (data && data.length > 0) {
    const numericCols = [];
    for (let col = 0; col < headers.length; col++) {
      const sample = data.slice(0, 20).map(r => r[col]).filter(v => v != null && v !== '');
      const numCount = sample.filter(v => !isNaN(parseFloat(String(v).replace(',', '.'))) && isFinite(Number(String(v).replace(',', '.')))).length;
      if (numCount > sample.length * 0.4 && numCount >= 3) {
        numericCols.push(col);
      }
    }
    const compteCols = [];
    for (const col of numericCols) {
      const sample = data.slice(0, 30).map(r => String(r[col]).trim());
      const codeLike = sample.filter(v => /^\d{3,8}$/.test(v)).length;
      if (codeLike >= 5) compteCols.push(col);
    }
    if (compteCols.length === 1) return compteCols[0];
    if (compteCols.length > 1) {
      return compteCols.reduce((a, b) => {
        const aLen = data.slice(0, 30).filter(r => /^\d{3,8}$/.test(String(r[a]).trim())).length;
        const bLen = data.slice(0, 30).filter(r => /^\d{3,8}$/.test(String(r[b]).trim())).length;
        return aLen >= bLen ? a : b;
      });
    }
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

function findAmountColumns(headers, data) {
  const results = {};
  const h = headers.map((h, i) => ({ h: String(h).toLowerCase().trim().replace(/[^a-z0-9éèêëàâäùûüôöîïç]/g, ''), i }));
  const numericCols = [];
  for (let col = 0; col < headers.length; col++) {
    const sample = data.slice(0, 30).map(r => r[col]).filter(v => v != null && v !== '');
    const numCount = sample.filter(v => !isNaN(parseFloat(String(v).replace(',', '.'))) && isFinite(Number(String(v).replace(',', '.')))).length;
    if (numCount > sample.length * 0.4 && numCount >= 3) numericCols.push(col);
  }
  const debitCredit = numericCols.filter(c => {
    const vals = data.slice(0, 50).map(r => parseFloat(String(r[c]).replace(',', '.')) || 0);
    const hasPositive = vals.some(v => v > 0);
    const hasNegative = vals.some(v => v < 0);
    return hasPositive && hasNegative;
  });
  if (debitCredit.length === 1) {
    results.debit = debitCredit[0];
    results.credit = debitCredit[0];
  } else if (debitCredit.length >= 2) {
    results.debit = debitCredit[0];
    results.credit = debitCredit[1];
  }
  return results;
}

function extractAccountsFromRows(headers, data, type) {
  let colCompte = detectColumnIndex(headers, ['compte','numéro','n°','numéro de compte','code compte','comptes','code','numero compte','compte numero','n compte'], data);
  let colLibelle = detectColumnIndex(headers, ['intitulé','libellé','désignation','lib','nom','label','name','designation'], data);
  let colDebit = detectColumnIndex(headers, ['débit','debit','total débit','cumul débit','mouvement débiteur','montant débit','solde debiteur','mvt debit','mouvement debit'], data);
  let colCredit = detectColumnIndex(headers, ['crédit','credit','total crédit','cumul crédit','mouvement créditeur','montant crédit','solde crediteur','mvt credit','mouvement credit'], data);
  let colSoldeDeb = detectColumnIndex(headers, ['solde débiteur','solde debiteur'], data);
  let colSoldeCred = detectColumnIndex(headers, ['solde créditeur','solde crediteur'], data);
  let colSolde = detectColumnIndex(headers, ['solde','soldes','solde net','montant','total','valeur','net'], data);
  let colMontant = detectColumnIndex(headers, ['montant','total','valeur'], data);

  if (colCompte < 0) colCompte = 0;
  const amtCols = findAmountColumns(headers, data);
  if (colDebit < 0 && amtCols.debit != null) colDebit = amtCols.debit;
  if (colCredit < 0 && amtCols.credit != null) colCredit = amtCols.credit;

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

    if (debit !== 0 || credit !== 0) {
      accounts.push({ compte, libelle, debitTotal: debit || 0, creditTotal: credit || 0, soldeDebiteur: (debit > credit ? debit - credit : 0), soldeCrediteur: (credit > debit ? credit - debit : 0) });
    }
  }

  if (accounts.length === 0 && data.length > 0) {
    const numCols = [];
    for (let col = 0; col < headers.length; col++) {
      const sample = data.slice(0, 40).map(r => r[col]).filter(v => v != null && v !== '');
      const nums = sample.filter(v => !isNaN(cleanNum(v)) && isFinite(cleanNum(v)));
      if (nums.length >= 5) numCols.push(col);
    }
    const acctCol = numCols.find(c => {
      return data.slice(0, 40).filter(r => /^\d{3,8}$/.test(String(r[c]).trim())).length >= 5;
    });
    if (acctCol != null) {
      const amtCol = numCols.find(c => c !== acctCol);
      for (const row of data) {
        const compte = normalizeCompte(row[acctCol]);
        if (!compte || compte.length < 2) continue;
        if (isNaN(parseInt(compte, 10))) continue;
        const val = amtCol != null ? (cleanNum(row[amtCol]) || 0) : 0;
        accounts.push({ compte, libelle: '', debitTotal: val > 0 ? val : 0, creditTotal: val < 0 ? -val : 0, soldeDebiteur: val > 0 ? val : 0, soldeCrediteur: val < 0 ? -val : 0 });
      }
    }
  }

  return accounts;
}

function findHeaderRow(rows) {
  const allHeaders = ['compte','numéro','n°','intitulé','libellé','débit','crédit','solde','actif','passif','rubriques','montant','total',
    'actifs non courants','capitaux propres','classe','soldes','lib','nom','code','num'];
  let bestRow = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowText = rows[i].map(v => String(v?.value ?? v ?? '').toLowerCase().trim()).join(' ');
    const score = allHeaders.filter(h => rowText.includes(h)).length;
    if (score > bestScore) { bestScore = score; bestRow = i; }
    const hasCode = rows[i].some(v => /^\d{3,8}$/.test(String(v?.value ?? v ?? '').trim()));
    if (hasCode && score >= 2) { bestRow = i; break; }
  }
  return bestRow;
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

  const hdrIdx = findHeaderRow(rows);
  const headers = rows[hdrIdx].map(h => h?.value ?? h ?? '');
  const data = rows.slice(hdrIdx + 1).filter(r => r.some(c => c != null && c !== ''));
  const type = detectType([headers, ...data]);
  const exercice = detectExercice(rows);
  const accounts = extractAccountsFromRows(headers, data, type);

  return { type, filename: file.name, exercice, accounts, rawData: { headers, rows: data } };
}

function findHeaderRowInData(headers, data) {
  const allH = ['compte','numéro','n°','intitulé','libellé','débit','crédit','solde','actif','passif','rubriques','montant','total',
    'actifs non courants','capitaux propres','classe','soldes','lib','nom','code','num'];
  let bestH = headers;
  let bestI = -1;
  let bestScore = 0;
  const candidates = [headers, ...data.slice(0, 10)];
  for (let i = 0; i < candidates.length; i++) {
    const rowText = candidates[i].map(v => String(v).toLowerCase().trim()).join(' ');
    const score = allH.filter(h => rowText.includes(h)).length;
    if (score > bestScore && score >= 2) { bestScore = score; bestI = i; bestH = candidates[i]; }
  }
  return { headers: bestH, data: bestI < 0 ? data : data.slice(bestI) };
}

export async function parseCSVFile(file) {
  const text = await file.text();
  const textClean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const parsed = parseCSV(textClean);
  const { headers, data } = findHeaderRowInData(parsed.headers, parsed.data);
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
    const parsed = parseCSV(lines.join('\n'));
    const { headers, data } = findHeaderRowInData(parsed.headers, parsed.data);
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
