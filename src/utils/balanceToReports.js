export function balancesToReports(accounts) {
  const balances = {};
  let totalDebit = 0;
  let totalCredit = 0;

  for (const a of accounts) {
    const compte = String(a.compte).replace(/\s.*$/, '').trim();
    if (!compte || !/^\d+$/.test(compte)) continue;
    balances[compte] = {
      debit: (balances[compte]?.debit || 0) + (a.debitTotal || 0),
      credit: (balances[compte]?.credit || 0) + (a.creditTotal || 0),
    };
    totalDebit += a.debitTotal || 0;
    totalCredit += a.creditTotal || 0;
  }

  const anomalies = [];

  const s = (p) => Object.keys(balances).filter(k => k.startsWith(p)).reduce((s, k) => s + (balances[k].debit || 0) - (balances[k].credit || 0), 0);
  const debit = (p) => Object.keys(balances).filter(k => k.startsWith(p)).reduce((s, k) => s + (balances[k].debit || 0), 0);
  const credit = (p) => Object.keys(balances).filter(k => k.startsWith(p)).reduce((s, k) => s + (balances[k].credit || 0), 0);

  // Individual-account helpers: each account classified by its net sign
  const debitNet = (p) => Object.keys(balances).filter(k => k.startsWith(p))
    .reduce((s, k) => s + Math.max(0, (balances[k].debit || 0) - (balances[k].credit || 0)), 0);
  const creditNet = (p) => Object.keys(balances).filter(k => k.startsWith(p))
    .reduce((s, k) => s + Math.max(0, (balances[k].credit || 0) - (balances[k].debit || 0)), 0);

  const ok = (v) => isNaN(v) || !isFinite(v) ? 0 : Math.round(v * 1000) / 1000;

  // ===== ACTIF NON COURANTS =====
  const fp = debitNet('20');
  const incorp = debitNet('21');
  const corp = debitNet('22') + debitNet('23') + debitNet('24');
  const fin = debitNet('25') + debitNet('26') + debitNet('27');
  const ancBrut = ok(fp + incorp + corp + fin);
  const amort = creditNet('28');
  const amortCorp = creditNet('281');
  const amortInc = creditNet('282');
  const provANC = creditNet('29');
  const amortissements = ok(amort);
  const amortissementsCorp = ok(amortCorp);
  const amortissementsInc = ok(amortInc);
  const provActifNC = ok(provANC);
  const actifNC = ok(ancBrut - amortissements - provActifNC);

  // ===== ACTIF COURANTS =====
  const stocksBrutes = debitNet('3');
  const provStocks = creditNet('39');
  const provisionsStocks = ok(provStocks);
  const stocks = ok(stocksBrutes - provStocks);

  const clBrut = debitNet('41');
  const provCl = creditNet('491');
  const clientsBrutes = ok(clBrut);
  const provisionsClients = ok(provCl);
  const clients = ok(clBrut - provCl);

  const etatDebit = debitNet('43');
  const etatCredit = creditNet('43');
  const personnelDebit = debitNet('421') + debitNet('425');
  const personnelCredit = creditNet('421') + creditNet('425') + creditNet('428');

  const autresCréances = ok(
    debitNet('403') + debitNet('409') + debitNet('44') + debitNet('453') + debitNet('46') + debitNet('47') + debitNet('48')
  );

  const tresorerieActif = debitNet('51') + debitNet('52') + debitNet('53') + debitNet('54') + debitNet('55');

  const actifC = ok(stocks + clients + etatDebit + personnelDebit + autresCréances + tresorerieActif);
  const totalActif = ok(actifNC + actifC);

  // ===== CAPITAUX PROPRES =====
  const capital = creditNet('101');
  const reserves = creditNet('11');
  const resultatsReportes = creditNet('12');
  const subventionsInvestissement = ok(Math.max(0, -s('13')));
  const ecartsReevaluation = creditNet('145');
  const autresCapitauxPropres = ok(subventionsInvestissement + ecartsReevaluation);

  // ===== PASSIFS =====
  const emprunts = creditNet('16');
  const empruntsCourants = creditNet('505');
  const provisionsRisques = creditNet('151');
  const provisionsDettes = creditNet('15');
  const provisions = provisionsDettes;
  const autresPassifsNC = creditNet('17') + creditNet('18');

  const fournisseurs = creditNet('401');
  const autresDettes = ok(
    creditNet('41') + creditNet('44') + creditNet('46') + creditNet('47') + creditNet('48') + creditNet('453') + creditNet('454')
  );
  const concoursBancaires = creditNet('506') + creditNet('54');

  // ===== COMPTE DE RÉSULTAT =====
  const totalVentes = ok(credit('70') - debit('709'));
  const ventesMarchandises = ok(credit('707') - debit('7097'));
  const prestationsServices = ok(credit('705') - debit('7095') + credit('704') - debit('7094'));
  const autresVentes = ok(totalVentes - ventesMarchandises - prestationsServices);

  const productionStockee = ok(credit('71'));
  const productionImmobilisee = ok(credit('72'));
  const subventionsExploitation = ok(credit('74'));
  const autresProduitsExploitation = ok(credit('75'));
  const reprises = ok(credit('781') + credit('786'));

  const produitsExploitation = ok(totalVentes + productionStockee + productionImmobilisee + subventionsExploitation + autresProduitsExploitation + reprises);

  const achatsBrut = debit('60') - debit('603');
  const variationStocks = credit('603') - debit('603');
  const varStockMarchandises = credit('6037') - debit('6037');
  const achatsConsommes = ok(achatsBrut - variationStocks);
  const achatsMarchandises = debit('601');

  const chargesExternes = debit('61');
  const autresServicesExterieurs = debit('62');
  const impotsTaxes = debit('63');
  const chargesDePersonnel = debit('64');
  const autresChargesOrdinaires = debit('65');
  const dotations = debit('68');
  const dotationsAmortCorp = debit('6811');
  const dotationsAmortInc = debit('6812');

  const chargesExploitation = ok(achatsConsommes + chargesExternes + autresServicesExterieurs + chargesDePersonnel + impotsTaxes + autresChargesOrdinaires + dotations);

  const resultatExploitation = ok(produitsExploitation - chargesExploitation);

  const produitsFinanciers = ok(credit('76'));
  const chargesFinancieres = debit('66');
  const resultatFinancier = ok(produitsFinanciers - chargesFinancieres);

  const produitsExceptionnels = ok(credit('77') + credit('787'));
  const chargesExceptionnelles = debit('67');
  const resultatExceptionnel = ok(produitsExceptionnels - chargesExceptionnelles);

  const impot = debit('69');

  const resultatAvantImpot = ok(resultatExploitation + resultatFinancier + resultatExceptionnel);
  const resultatNet = ok(resultatAvantImpot - impot);
  const resultatExercice = resultatNet;

  // ===== CAPITAUX PROPRES (final) =====
  const capPropres = ok(capital + reserves + resultatsReportes + autresCapitauxPropres + resultatExercice);
  const passifNC = ok(emprunts + provisionsDettes + autresPassifsNC);
  const passifC = ok(fournisseurs + etatCredit + personnelCredit + autresDettes + concoursBancaires + empruntsCourants);
  const totalPassif = ok(capPropres + passifNC + passifC);

  if (Math.abs(totalActif - totalPassif) > 0.01) {
    anomalies.push(`Bilan non équilibré : Actif=${totalActif} ≠ Passif=${totalPassif} (écart=${(totalActif - totalPassif).toFixed(3)})`);
  }

  // ===== SIG =====
  const varStockMarch = credit('6037') - debit('6037');
  const margeCommerciale = ok(ventesMarchandises - achatsMarchandises + varStockMarch);
  const productionExercice = ok(prestationsServices + autresVentes + productionStockee + productionImmobilisee);
  const achatsConsHorsMarch = ok(achatsConsommes - achatsMarchandises + varStockMarch);
  const valeurAjoutee = ok(margeCommerciale + productionExercice - achatsConsHorsMarch - chargesExternes - autresServicesExterieurs);
  const ebe = ok(valeurAjoutee + subventionsExploitation + autresProduitsExploitation - chargesDePersonnel - impotsTaxes - autresChargesOrdinaires);
  const sigResultatExploitation = ok(ebe + reprises - dotations);
  const sigRcai = ok(sigResultatExploitation + resultatFinancier);
  const sigResultatNet = ok(sigRcai + resultatExceptionnel - impot);

  // ===== FLUX DE TRÉSORERIE =====
  const mba = ok(resultatNet + dotations - reprises);
  const bfrClients = 0;
  const bfrFournisseurs = 0;
  const bfrEtat = 0;
  const bfrPersonnel = 0;
  const bfrStocks = 0;
  const fluxExploitation = ok(mba + bfrClients + bfrFournisseurs + bfrEtat + bfrPersonnel + bfrStocks);
  const acquisitionsImmobilisations = 0;
  const cessionsImmobilisations = 0;
  const fluxInvestissement = 0;
  const apportsCapital = 0;
  const empruntsNouveaux = 0;
  const remboursementsEmprunts = 0;
  const fluxFinancement = 0;
  const variationTresorerie = ok(fluxExploitation + fluxInvestissement + fluxFinancement);
  const tresorerieInitiale = ok(tresorerieActif - variationTresorerie);

  // ===== RATIOS =====
  const lr = (n, d) => d > 0 ? ok(n / d) : 0;
  const liquiditeGenerale = lr(actifC, passifC);
  const liquiditeReduite = lr(actifC - stocks, passifC);
  const liquiditeImmediate = lr(tresorerieActif, passifC);
  const autonomieFinanciere = lr(capPropres, totalPassif);
  const endettementNet = lr(emprunts + empruntsCourants + concoursBancaires + autresPassifsNC, capPropres || 1);
  const rentabiliteEconomique = lr(resultatExploitation, totalActif);
  const rentabiliteFinanciere = lr(resultatNet, capPropres || 1);
  const margeNette = lr(resultatNet, totalVentes || 1);
  const poidsChargesFinancieres = lr(chargesFinancieres, resultatExploitation || 1);
  const rotationStocksJours = achatsConsommes > 0 ? ok((stocks / achatsConsommes) * 360) : 0;
  const delaiClientsJours = totalVentes > 0 ? ok((clientsBrutes / totalVentes) * 360) : 0;
  const delaiFournisseursJours = achatsConsommes > 0 ? ok((fournisseurs / achatsConsommes) * 360) : 0;

  return {
    bilan: {
      actifNC, actifC, totalActif,
      ancBrut, amortissements, amortissementsCorp, amortissementsInc, provActifNC,
      dotationsAmortCorp: ok(dotationsAmortCorp),
      dotationsAmortInc: ok(dotationsAmortInc),
      amortissementsDeduction: amortissements,
      provisionsActifNCDeduction: provActifNC,
      fraisPreliminaires: ok(fp),
      immobilisationsIncorporelles: ok(incorp),
      immobilisationsCorporelles: ok(corp),
      immobilisationsFinancieres: ok(ifi),
      stocks, stocksBrutes, provisionsStocks,
      provisionsStocksDeduction: provisionsStocks,
      clients, clientsBrutes, provisionsClients,
      provisionsClientsDeduction: provisionsClients,
      clientsNets: clients,
      etatDebit, personnelDebit, autresCréances,
      tresorerie: tresorerieActif, tresorerieActif,
      tresorerieBrute: tresorerieActif,
      provisionsTresorerieDeduction: 0,
      capital, capitalSocial: capital,
      reserves, resultatsReportes, resultatExercice,
      autresCapitauxPropres,
      capPropres, passifNC, passifC, totalPassif,
      emprunts, empruntsCourants, provisionsDettes, provisions,
      autresPassifsNC,
      fournisseurs, etatCredit, personnelCredit, autresDettes, concoursBancaires,

      donneesImmobilisations: {
        totalBrut: ancBrut,
        lignes: [
          { categorie: 'Frais préliminaires', debut: 0, augmentation: 0, diminution: 0, fin: ok(fp), _key: 'fp' },
          { categorie: 'Incorporelles', debut: 0, augmentation: 0, diminution: 0, fin: ok(incorp), _key: 'inc' },
          { categorie: 'Corporelles', debut: 0, augmentation: 0, diminution: 0, fin: ok(corp), _key: 'corp' },
          { categorie: 'Financières', debut: 0, augmentation: 0, diminution: 0, fin: ok(ifi), _key: 'fin' },
        ],
      },
      donneesAmortissements: {
        total: amortissements,
        dotationExercice: ok(dotations),
        dotationsAmortCorp: ok(dotationsAmortCorp),
        dotationsAmortInc: ok(dotationsAmortInc),
        lignes: [
          { categorie: 'Frais préliminaires', debut: 0, augmentation: 0, diminution: 0, fin: 0, _key: 'fp' },
          { categorie: 'Incorporelles', debut: 0, augmentation: ok(dotationsAmortInc), diminution: 0, fin: ok(amortissementsInc), _key: 'inc' },
          { categorie: 'Corporelles', debut: 0, augmentation: ok(dotationsAmortCorp), diminution: 0, fin: ok(amortissementsCorp), _key: 'corp' },
        ],
      },
      donneesProvisions: {
        actifNC: provActifNC,
        stocks: provisionsStocks,
        clients: provisionsClients,
        risques: provisionsRisques,
        lignes: [
          { categorie: 'Immobilisations', debut: 0, augmentation: 0, diminution: 0, fin: ok(provActifNC), _key: 'anc' },
          { categorie: 'Stocks', debut: 0, augmentation: 0, diminution: 0, fin: ok(provisionsStocks), _key: 'stk' },
          { categorie: 'Clients', debut: 0, augmentation: 0, diminution: 0, fin: ok(provisionsClients), _key: 'clt' },
          { categorie: 'Risques et charges', debut: 0, augmentation: 0, diminution: 0, fin: ok(provisionsRisques), _key: 'rq' },
        ],
      },
      variationCapitauxPropres: {
        lignes: [
          { rubrique: 'Capital', debut: 0, augmentation: 0, diminution: 0, fin: ok(capital), _key: 'cap' },
          { rubrique: 'Réserves', debut: 0, augmentation: 0, diminution: 0, fin: ok(reserves), _key: 'res' },
          { rubrique: 'Résultats reportés', debut: 0, augmentation: 0, diminution: 0, fin: ok(resultatsReportes), _key: 'rr' },
          { rubrique: 'Subventions d\'investissement', debut: 0, augmentation: 0, diminution: 0, fin: ok(subventionsInvestissement), _key: 'subv' },
          { rubrique: 'Écarts de réévaluation', debut: 0, augmentation: 0, diminution: 0, fin: ok(ecartsReevaluation), _key: 'ecr' },
          { rubrique: 'Résultat de l\'exercice', debut: 0, augmentation: 0, diminution: 0, fin: ok(resultatExercice), _key: 'resex' },
        ],
      },
    },
    resultat: {
      produitsExploitation,
      totalProduitsExploitation: produitsExploitation,
      chargesExploitation,
      totalChargesExploitation: chargesExploitation,
      resultatExploitation,
      ventes: totalVentes,
      ventesMarchandises,
      ventesPrestations: prestationsServices,
      productionStockee,
      productionImmobilisee,
      subventionsExploitation,
      autresProduitsExploitation,
      autresProduits: autresProduitsExploitation,
      reprises,
      achats: achatsConsommes,
      achatsConsommes,
      achatsMarchandises,
      achatsMP: debit('602'),
      autresAchatsSIG: ok(achatsConsommes - achatsMarchandises + varStockMarchandises - debit('602')),
      chargesExternes,
      chargesPersonnel: chargesDePersonnel,
      impotsTaxes,
      autresChargesExploitation: autresChargesOrdinaires,
      autresCharges: autresChargesOrdinaires,
      autresServicesExterieurs,
      dotations,
      dotationsAmortCorp: ok(dotationsAmortCorp),
      dotationsAmortInc: ok(dotationsAmortInc),
      produitsFinanciers,
      chargesFinancieres,
      resultatFinancier,
      produitsExceptionnels,
      chargesExceptionnelles,
      resultatExceptionnel,
      resultatAvantImpot,
      impot, impotIS: impot,
      resultatNet,
      margeCommerciale,
      productionExercice,
      valeurAjoutee, ebe,
      rcai: sigRcai,
      sigResultatNet,
    },
    sig: {
      margeCommerciale, productionExercice,
      achatsConsHorsMarch,
      chargesExternes, autresServicesExterieurs,
      valeurAjoutee, ebe,
      sigResultatExploitation, sigRcai, sigResultatNet,
    },
    fluxTresorerie: {
      resultatNet,
      dotations: ok(dotations),
      reprises: ok(reprises),
      margeBruteAutofinancement: mba,
      variationClients: bfrClients,
      variationFournisseurs: bfrFournisseurs,
      variationEtat: bfrEtat,
      variationPersonnel: bfrPersonnel,
      variationStocks: bfrStocks,
      fluxExploitation,
      acquisitionsImmobilisations,
      cessionsImmobilisations,
      fluxInvestissement,
      apportsCapital,
      empruntsNouveaux,
      remboursementsEmprunts,
      fluxFinancement,
      variationTresorerie,
      tresorerieInitiale,
      tresorerieFinale: tresorerieActif,
    },
    ratios: {
      liquiditeGenerale, liquiditeReduite, liquiditeImmediate,
      autonomieFinanciere, endettementNet,
      rentabiliteEconomique, rentabiliteFinanciere, margeNette,
      poidsChargesFinancieres,
      rotationStocksJours, delaiClientsJours, delaiFournisseursJours,
      bfr: ok(stocks + clientsBrutes - fournisseurs),
      tresorerieNette: ok(tresorerieActif - concoursBancaires),
    },
    controle: {
      equilibree: Math.abs(totalDebit - totalCredit) < 0.001,
      totalDebit: ok(totalDebit),
      totalCredit: ok(totalCredit),
    },
    anomalies,
  };
}
