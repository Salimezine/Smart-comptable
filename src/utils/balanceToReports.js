export function balancesToReports(accounts) {
  const balances = {};
  for (const a of accounts) {
    const compte = a.compte.replace(/\s.*$/, '').trim();
    if (!compte) continue;
    balances[compte] = {
      debit: (balances[compte]?.debit || 0) + (a.debitTotal || 0),
      credit: (balances[compte]?.credit || 0) + (a.creditTotal || 0),
    };
  }

  const solde = (c) => parseFloat(((balances[c]?.debit || 0) - (balances[c]?.credit || 0)).toFixed(3));
  const soldeDetails = (filter) => Object.keys(balances).filter(filter).map(k => ({ code: k, solde: solde(k) })).filter(d => Math.abs(d.solde) > 0.001);
  const cl = (p) => Object.keys(balances).filter(k => k.startsWith(p)).reduce((s, k) => s + solde(k), 0);

  const fraisPreliminairesBrutes = Math.max(cl('20'), 0) / 1000;
  const immobilisationsIncorporellesBrutes = Math.max(cl('21'), 0) / 1000;
  const immobilisationsCorporellesBrutes = Math.max(cl('22') + cl('23') + cl('24') + cl('25') + cl('26'), 0) / 1000;
  const immobilisationsFinancieresBrutes = Math.max(cl('27'), 0) / 1000;
  const amortissementsDeduction = Math.max(-cl('28'), 0) / 1000;
  const provisionsActifNCDeduction = Math.max(-cl('29'), 0) / 1000;

  const stocksBrutes = Math.max(cl('30') + cl('31') + cl('32') + cl('33') + cl('34') + cl('35') + cl('37') + cl('38'), 0) / 1000;
  const provisionsStocksDeduction = Math.max(-cl('39'), 0) / 1000;

  const fournisseurs = Math.max(-cl('40'), 0) / 1000;
  const clientsBrutes = Math.max(cl('41'), 0) / 1000;
  const provisionsClientsDeduction = Math.max(-cl('491'), 0) / 1000;
  const clients = clientsBrutes - provisionsClientsDeduction;
  const etatDebit = Math.max(cl('43'), 0) / 1000;
  const etatCredit = Math.max(-cl('43'), 0) / 1000;
  const personnelDebit = Math.max(cl('45'), 0) / 1000;
  const personnelCredit = Math.max(-cl('42'), 0) / 1000;
  const autresCréances = Math.max(cl('409') + cl('47') - cl('472'), 0) / 1000;
  const autresDettes = Math.max(-cl('44') - cl('46') - cl('48') - cl('49'), 0) / 1000;

  const tresorerieBrute = Math.max(cl('5') - cl('52'), 0) / 1000;
  const provisionsTresorerieDeduction = Math.max(-cl('59'), 0) / 1000;
  const tresorerieActif = tresorerieBrute - provisionsTresorerieDeduction;
  const concoursBancaires = Math.max(-cl('52'), 0) / 1000;

  const capitalSocial = Math.max(-cl('10'), 0) / 1000;
  const reserves = Math.max(-cl('11'), 0) / 1000;
  const resultatsReportes = Math.max(-cl('12'), 0) / 1000;
  const resultatExercice = Math.max(-cl('13'), 0) / 1000;
  const autresCapitauxPropres = Math.max(-cl('14'), 0) / 1000;
  const emprunts = Math.max(-cl('16') - cl('17'), 0) / 1000;
  const provisions = Math.max(-cl('15'), 0) / 1000;
  const autresPassifsNC = Math.max(-cl('18'), 0) / 1000;

  const ancBrut = fraisPreliminairesBrutes + immobilisationsIncorporellesBrutes + immobilisationsCorporellesBrutes + immobilisationsFinancieresBrutes;
  const actifNC = ancBrut - amortissementsDeduction - provisionsActifNCDeduction;
  const stocks = stocksBrutes - provisionsStocksDeduction;
  const actifC = stocks + clients + etatDebit + personnelDebit + autresCréances + tresorerieActif;
  const totalActif = actifNC + actifC;

  const charges = Object.keys(balances).filter(k => k.startsWith('6')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const produits = Object.keys(balances).filter(k => k.startsWith('7')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const netComputed = produits - charges;
  const finalResultat = resultatExercice > 0.001 ? resultatExercice : Math.max(netComputed, 0);

  const capPropres = capitalSocial + reserves + resultatsReportes + finalResultat + autresCapitauxPropres;
  const passifNC = emprunts + provisions + autresPassifsNC;
  const passifC = fournisseurs + etatCredit + personnelCredit + autresDettes + concoursBancaires;
  const totalPassif = capPropres + passifNC + passifC;

  const achats = Object.keys(balances).filter(k => k.startsWith('60')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const achatsMarchandises = Object.keys(balances).filter(k => k.startsWith('601')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const achatsMP = Object.keys(balances).filter(k => k.startsWith('602')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const autresAchatsSIG = Object.keys(balances).filter(k => k.startsWith('60') && !k.startsWith('601') && !k.startsWith('602')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const chargesExternes = Object.keys(balances).filter(k => k.startsWith('61')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const chargesPersonnel = Object.keys(balances).filter(k => k.startsWith('62') || k.startsWith('64')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const impotsTaxes = Object.keys(balances).filter(k => k.startsWith('63') || k.startsWith('6654')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const autresCharges = Object.keys(balances).filter(k => k.startsWith('65')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const chargesFinancieres = Object.keys(balances).filter(k => k.startsWith('66') && !k.startsWith('6654')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const chargesExceptionnelles = Object.keys(balances).filter(k => k.startsWith('67')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const dotations = Object.keys(balances).filter(k => k.startsWith('68')).reduce((s, k) => s + balances[k].debit, 0) / 1000;

  const ventes = Object.keys(balances).filter(k => k.startsWith('70')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const ventesMarchandises = Object.keys(balances).filter(k => k.startsWith('70') && !k.startsWith('706')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const ventesPrestations = Object.keys(balances).filter(k => k.startsWith('706')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const productionStockee = Object.keys(balances).filter(k => k.startsWith('71')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const productionImmobilisee = Object.keys(balances).filter(k => k.startsWith('72')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const subventionsExploitation = Object.keys(balances).filter(k => k.startsWith('74')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const produitsFinanciers = Object.keys(balances).filter(k => k.startsWith('76')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const produitsExceptionnels = Object.keys(balances).filter(k => k.startsWith('77')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const reprises = Object.keys(balances).filter(k => k.startsWith('78')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const autresProduits = (produits - ventes - productionStockee - productionImmobilisee - subventionsExploitation - produitsFinanciers - produitsExceptionnels - reprises);

  const totalChargesExploitation = achats + chargesExternes + chargesPersonnel + impotsTaxes + autresCharges + dotations;
  const totalProduitsExploitation = ventes + productionStockee + productionImmobilisee + subventionsExploitation + autresProduits;

  const resultatExploitation = totalProduitsExploitation - totalChargesExploitation;
  const resultatFinancier = produitsFinanciers - chargesFinancieres;
  const resultatExceptionnel = produitsExceptionnels - chargesExceptionnelles;

  const margeCommerciale = ventesMarchandises - achatsMarchandises;
  const productionExercice = ventes + productionStockee + productionImmobilisee;
  const valeurAjoutee = margeCommerciale + productionExercice - chargesExternes - achatsMP - autresAchatsSIG;
  const ebe = valeurAjoutee - impotsTaxes - chargesPersonnel;
  const sigResultatExploitation = ebe + reprises - dotations;
  const rcai = sigResultatExploitation + resultatFinancier;
  const sigResultatNet = rcai + resultatExceptionnel;

  const liquiditeGenerale = passifC > 0 ? Math.round((actifC / passifC) * 100) / 100 : 0;
  const liquiditeReduite = passifC > 0 ? Math.round(((actifC - stocks - provisionsStocksDeduction) / passifC) * 100) / 100 : 0;
  const autonomieFinanciere = totalPassif > 0 ? Math.round((capPropres / totalPassif) * 10000) / 100 : 0;
  const endettementNet = capPropres > 0 ? Math.round(((emprunts + concoursBancaires + autresPassifsNC) / capPropres) * 100) / 100 : 0;
  const margeNette = totalProduitsExploitation > 0 ? Math.round((sigResultatNet / totalProduitsExploitation) * 10000) / 100 : 0;
  const roe = capPropres > 0 ? Math.round((sigResultatNet / capPropres) * 10000) / 100 : 0;
  const roa = totalActif > 0 ? Math.round((sigResultatNet / totalActif) * 10000) / 100 : 0;
  const couvertureEmploisStables = actifNC > 0 ? Math.round(((capPropres + passifNC) / actifNC) * 100) / 100 : 0;
  const margeExploitation = totalProduitsExploitation > 0 ? Math.round((sigResultatExploitation / totalProduitsExploitation) * 10000) / 100 : 0;

  return {
    bilan: {
      actifNC, actifC, totalActif,
      fraisPreliminaires: fraisPreliminairesBrutes,
      immobilisationsIncorporelles: immobilisationsIncorporellesBrutes,
      immobilisationsCorporelles: immobilisationsCorporellesBrutes,
      immobilisationsFinancieres: immobilisationsFinancieresBrutes,
      amortissementsDeduction, provisionsActifNCDeduction,
      stocks, stocksBrutes, provisionsStocksDeduction,
      clients, clientsBrutes, provisionsClientsDeduction,
      etatDebit, personnelDebit, autresCréances,
      tresorerieActif, tresorerieBrute, provisionsTresorerieDeduction,
      capPropres, passifNC, passifC, totalPassif,
      capitalSocial, reserves, resultatsReportes, resultatExercice: finalResultat, autresCapitauxPropres,
      emprunts, provisions, autresPassifsNC,
      fournisseurs, etatCredit, personnelCredit, autresDettes, concoursBancaires,
    },
    resultat: {
      produits, charges, resultatNet: finalResultat,
      ventes, ventesMarchandises, ventesPrestations,
      productionStockee, productionImmobilisee, subventionsExploitation,
      autresProduits, produitsFinanciers, produitsExceptionnels, reprises,
      achats, achatsMarchandises, achatsMP, autresAchatsSIG,
      chargesExternes, chargesPersonnel, impotsTaxes,
      autresCharges, chargesFinancieres, chargesExceptionnelles, dotations,
      resultatExploitation, resultatFinancier, resultatExceptionnel,
      totalProduitsExploitation, totalChargesExploitation,
      margeCommerciale, productionExercice, valeurAjoutee, ebe,
      rcai, sigResultatNet,
    },
    ratios: {
      liquiditeGenerale, liquiditeReduite, autonomieFinanciere, endettementNet,
      margeNette, roe, roa, couvertureEmploisStables, margeExploitation,
      bfr: (stocks || 0) + (clients || 0) - (fournisseurs || 0),
      tresorerieNette: (tresorerieActif || 0) - (concoursBancaires || 0),
      poidsChargesFinancieres: (ebe && ebe > 0) ? Math.round((chargesFinancieres / ebe) * 1000) / 1000 : 0,
    },
    details: {
      fraisPreliminaires: soldeDetails(k => k.startsWith('20')),
      immobilisationsIncorporelles: soldeDetails(k => k.startsWith('21')),
      immobilisationsCorporelles: soldeDetails(k => k.startsWith('22') || k.startsWith('23') || k.startsWith('24') || k.startsWith('25') || k.startsWith('26')),
      immobilisationsFinancieres: soldeDetails(k => k.startsWith('27')),
      amortissementsDeduction: soldeDetails(k => k.startsWith('28')),
      provisionsActifNCDeduction: soldeDetails(k => k.startsWith('29')),
      stocksBrutes: soldeDetails(k => (k.startsWith('3') && !k.startsWith('39'))),
      provisionsStocksDeduction: soldeDetails(k => k.startsWith('39')),
      clientsBrutes: soldeDetails(k => k.startsWith('41')),
      provisionsClientsDeduction: soldeDetails(k => k.startsWith('491')),
      fournisseurs: soldeDetails(k => k.startsWith('40')),
      etatDebit: soldeDetails(k => k.startsWith('43') && solde(k) > 0),
      etatCredit: soldeDetails(k => k.startsWith('43') && solde(k) < 0),
      personnelDebit: soldeDetails(k => k.startsWith('45')),
      personnelCredit: soldeDetails(k => k.startsWith('42')),
      autresCréances: soldeDetails(k => (k.startsWith('409') || k.startsWith('47')) && !k.startsWith('472')),
      autresDettes: soldeDetails(k => k.startsWith('44') || k.startsWith('46') || k.startsWith('48') || k.startsWith('49')),
      tresorerieBrute: soldeDetails(k => k.startsWith('5') && !k.startsWith('52') && !k.startsWith('59')),
      tresorerieActif: soldeDetails(k => k.startsWith('5') && solde(k) > 0 && !k.startsWith('59')),
      concoursBancaires: soldeDetails(k => k.startsWith('52') && solde(k) > 0),
      capitalSocial: soldeDetails(k => k.startsWith('10')),
      reserves: soldeDetails(k => k.startsWith('11')),
      resultatsReportes: soldeDetails(k => k.startsWith('12')),
      emprunts: soldeDetails(k => k.startsWith('16') || k.startsWith('17')),
      provisions_dettes: soldeDetails(k => k.startsWith('15')),
      autresPassifsNC: soldeDetails(k => k.startsWith('18')),
      achats: soldeDetails(k => k.startsWith('60')),
      chargesExternes: soldeDetails(k => k.startsWith('61')),
      chargesPersonnel: soldeDetails(k => k.startsWith('62') || k.startsWith('64')),
      impotsTaxes: soldeDetails(k => k.startsWith('63') || k.startsWith('6654')),
      autresCharges: soldeDetails(k => k.startsWith('66') || k.startsWith('67') || k.startsWith('68') || (k.startsWith('65') && !k.startsWith('6654'))),
      ventes: soldeDetails(k => k.startsWith('70')),
      reprises: soldeDetails(k => k.startsWith('78')),
      produitsFinanciers: soldeDetails(k => k.startsWith('76') && solde(k) > 0),
      subventionsExploitation: soldeDetails(k => k.startsWith('74')),
      chargesFinancieres: soldeDetails(k => k.startsWith('66') && solde(k) > 0),
      dotations: soldeDetails(k => k.startsWith('68')),
    },
    // Flux de trésorerie (méthode indirecte)
    fluxTresorerie: generateCashFlow({
      actifC, actifNC, stocks, stocksBrutes, clients, fournisseurs,
      etatDebit, etatCredit, personnelCredit, capPropres, passifNC, passifC,
    }, { resultatNet: finalResultat, dotations, reprises }),
  };
}

function generateCashFlow(bilan, resultat) {
  const resultatNet = resultat.resultatNet || 0;
  const dotations = resultat.dotations || 0;
  const reprises = resultat.reprises || 0;
  const margeBruteAutofinancement = resultatNet + dotations - reprises;

  const stocksN = bilan.stocks || 0;
  const stocksN1 = 0;
  const clientsN = bilan.clients || 0;
  const clientsN1 = 0;
  const fournisseursN = bilan.fournisseurs || 0;
  const fournisseursN1 = 0;
  const etatDebitN = bilan.etatDebit || 0;
  const etatDebitN1 = 0;
  const etatCreditN = bilan.etatCredit || 0;
  const etatCreditN1 = 0;
  const personnelDebitN = bilan.personnelDebit || 0;
  const personnelDebitN1 = 0;
  const personnelCreditN = bilan.personnelCredit || 0;
  const personnelCreditN1 = 0;

  const variationStocks = stocksN - stocksN1;
  const variationClients = clientsN - clientsN1;
  const variationFournisseurs = fournisseursN - fournisseursN1;
  const variationEtat = (etatCreditN - etatCreditN1) - (etatDebitN - etatDebitN1);
  const variationPersonnel = (personnelCreditN - personnelCreditN1) - (personnelDebitN - personnelDebitN1);

  const fluxExploitation = margeBruteAutofinancement
    - variationStocks - variationClients + variationFournisseurs - variationEtat - variationPersonnel;

  return {
    resultatNet, dotations, reprises,
    margeBruteAutofinancement,
    variationStocks, variationClients, variationFournisseurs,
    variationEtat, variationPersonnel,
    fluxExploitation,
    acquisitionsImmobilisations: 0,
    cessionsImmobilisations: 0,
    fluxInvestissement: 0,
    apportsCapital: 0,
    empruntsNouveaux: 0,
    remboursementsEmprunts: 0,
    fluxFinancement: 0,
    variationTresorerie: fluxExploitation,
    tresorerieInitiale: 0,
    tresorerieFinale: 0,
  };
}
