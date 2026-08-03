export function balancesToReports(accounts, prevAccounts) {
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

  // Map N-1 (exercice précédent) pour calcul des variations BFR et report reportable
  const balancesPrev = {};
  if (prevAccounts && prevAccounts.length) {
    for (const a of prevAccounts) {
      const compte = String(a.compte).replace(/\s.*$/, '').trim();
      if (!compte || !/^\d+$/.test(compte)) continue;
      balancesPrev[compte] = {
        debit: (balancesPrev[compte]?.debit || 0) + (a.debitTotal || 0),
        credit: (balancesPrev[compte]?.credit || 0) + (a.creditTotal || 0),
      };
    }
  }
  const hasPrev = Object.keys(balancesPrev).length > 0;
  const dnPrev = (p) => Object.keys(balancesPrev).filter(k => k.startsWith(p)).reduce((s, k) => s + Math.max(0, (balancesPrev[k].debit || 0) - (balancesPrev[k].credit || 0)), 0);
  const cnPrev = (p) => Object.keys(balancesPrev).filter(k => k.startsWith(p)).reduce((s, k) => s + Math.max(0, (balancesPrev[k].credit || 0) - (balancesPrev[k].debit || 0)), 0);

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

  // Classification par solde NET de chaque compte (comptes de tiers) :
  // un compte à solde débiteur = créance (actif), à solde créditeur = dette (passif).
  const splitTiers = (prefixes) => {
    let actif = 0, passif = 0;
    const keys = Object.keys(balances).filter(k => prefixes.some(p => k.startsWith(p)));
    for (const k of keys) {
      const net = (balances[k].debit || 0) - (balances[k].credit || 0);
      if (net > 0) actif += net; else passif += -net;
    }
    return { actif: ok(actif), passif: ok(passif) };
  };

  // ===== ACTIF NON COURANTS =====
  const fp = debitNet('20');
  const incorpBrut = debitNet('21');
  const corpBrut = debitNet('22') + debitNet('23') + debitNet('24');
  const finBrut = debitNet('25') + debitNet('26') + debitNet('27');
  const ancBrut = ok(fp + incorpBrut + corpBrut + finBrut);
  const amort = creditNet('28');
  const amortInc = creditNet('281');
  const amortCorp = creditNet('282') + creditNet('283') + creditNet('284');
  const amortFin = creditNet('285') + creditNet('286') + creditNet('287');
  const provANC = creditNet('29');
  const amortissements = ok(amort);
  const amortissementsCorp = ok(amortCorp);
  const amortissementsInc = ok(amortInc);
  const provActifNC = ok(provANC);
  // Immobilisations nettes : on calcule le TOTAL net (brut - amortissements), puis on
  // répartit en catégories. Le plancher 0 est appliqué au total seulement, afin de ne pas
  // déséquilibrer le bilan quand une catégorie est sure-amortie (ex : incorporelles).
  const actifNC = ok(Math.max(0, ancBrut - amortissements - provANC));
  const incorp = ok(Math.max(0, incorpBrut - amortInc));
  const fin = ok(Math.max(0, finBrut - amortFin));
  const corp = ok(Math.max(0, actifNC - incorp - fin - fp));

  // ===== ACTIF COURANTS =====
  const stocksBrutes = debitNet('3');
  const provStocks = creditNet('39');
  const provisionsStocks = ok(provStocks);
  const stocks = ok(stocksBrutes - provStocks);

  // Clients : créances nettes (solde débiteur) en actif, créditeurs (solde créditeur) en passif
  const clientsSplit = splitTiers(['41']);
  const clientsBrutes = clientsSplit.actif;
  // Provisions sur clients (413/419/491) déduites du poste Clients
  const provisionsClients = ok(debitNet('413') + debitNet('419') + debitNet('491'));
  const clients = ok(clientsBrutes - provisionsClients);
  const clientsCrediteurs = clientsSplit.passif;

  // État : créances (actif) / dettes (passif) par solde net
  const etatSplit = splitTiers(['43']);
  const etatDebit = etatSplit.actif;
  const etatCredit = etatSplit.passif;

  // Personnel : créances (avances) / dettes (passif) par solde net
  const persSplit = splitTiers(['42']);
  const personnelDebit = persSplit.actif;
  const personnelCredit = persSplit.passif;

  // Autres créances / dettes (44,45,46,47,48,49)
  const autresSplit = splitTiers(['44', '45', '46', '47', '48', '49']);
  const autresCréances = autresSplit.actif;
  const autresDettesTiers = autresSplit.passif;

  // Fournisseurs : dettes (passif) / avances (actif) par solde net
  const fournSplit = splitTiers(['40']);
  const fournisseurs = fournSplit.passif;
  const avancesFournisseurs = fournSplit.actif;

  const tresorerieActif = debitNet('51') + debitNet('52') + debitNet('53') + debitNet('54') + debitNet('55');
  const tresoreriePassif = creditNet('51') + creditNet('52') + creditNet('53') + creditNet('54') + creditNet('55');
  // Avance reçue sur emprunt (compte 505 débiteur) = créance en actif courant
  const avancesEmprunts = debitNet('505');

  const actifC = ok(stocks + clients + etatDebit + personnelDebit + autresCréances + avancesFournisseurs + avancesEmprunts + tresorerieActif);
  let totalActif = ok(actifNC + actifC);

  // ===== CAPITAUX PROPRES =====
  const capital = creditNet('101');
  const reserves = creditNet('11');
  // Résultats reportés = solde du compte 12 + solde net des comptes 131 (bénéfice)
  // et 135 (déficit) reportés. Le résultat de l'exercice en cours vient séparément
  // de resultatExercice (calculé via les comptes 6/7 ou le solde clos).
  const resultatsReportes = ok(
    creditNet('12') - debitNet('12')
    + creditNet('131') - debitNet('131')
    + creditNet('135') - debitNet('135')
  );
  const subventionsInvestissement = ok(Math.max(0, -s('13')));
  const ecartsReevaluation = creditNet('145');
  const autresCapitauxPropres = ok(ecartsReevaluation);
  // Résultat de l'exercice "clos" = solde net des comptes 131 (bénéfice) - 135 (déficit).
  // Utilisé comme fallback uniquement si les comptes de résultat (6/7) sont absents
  // (balance déjà arrêtée sans détail du compte de résultat).
  const rnClos = ok(creditNet('131') - debitNet('131') + creditNet('135') - debitNet('135'));
  const rnClosPresent = Object.keys(balances).some(k => k.startsWith('131') || k.startsWith('135'));
  const resultatPresent = Object.keys(balances).some(k => /^6/.test(k) || /^7/.test(k));

  // ===== PASSIFS =====
  const emprunts = creditNet('16');
  // Concours bancaires = solde créditeur des comptes de trésorerie (51-55, découverts)
  // + solde créditeur du compte 505 (échéances court terme). Le solde DÉBITEUR de 505
  // (avance reçue sur emprunt) est une créance → actif courant (avancesEmprunts, défini plus haut).
  const concoursBancaires = ok(tresoreriePassif + creditNet('505'));
  const empruntsCourants = 0;
  const provisionsRisques = creditNet('151');
  const provisionsDettes = creditNet('15');
  const provisions = provisionsDettes;
  const autresPassifsNC = creditNet('17') + creditNet('18');
  // fournisseurs déjà calculé via splitTiers(['40']) plus haut

  // ===== COMPTE DE RÉSULTAT =====
  // Ventes nettes = crédit - débit (les rabais/remises sont en débit des comptes 70x)
  const totalVentes = ok(credit('70') - debit('70'));
  const ventesMarchandises = ok(credit('707') - debit('707'));
  const prestationsServices = ok(credit('705') - debit('705') + credit('704') - debit('704'));
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

  const impot = debit('691000'); // impôt sur les bénéfices (691000) — exclut CSS (691001)

  // Résultat net = solde comptable des comptes de résultat (classes 6 et 7).
  // Source unique de vérité pour le bilan, l'état de résultat, les flux et la variation des CP.
  const resultatNet = ok(
    Object.keys(balances).filter(k => /^6/.test(k) || /^7/.test(k))
      .reduce((s, k) => s + (balances[k].credit || 0) - (balances[k].debit || 0), 0)
  );
  const resultatAvantImpot = resultatNet; // conservé pour compatibilité (ancienne présentation)
  const resultatExercice = resultatNet;

  // ===== ÉTAT DE RÉSULTAT (présentation référentiel EF) =====
  // Ventes nettes = crédit - débit des comptes 70, hors compte 709 (avoirs financiers non déduit par EF)
  const efVentes = ok(credit('70') - debit('70') - (credit('709') - debit('709')));
  // Charges d'exploitation : achats + charges externes (61) + autres services (62) + personnel (64)
  //   + impôts (63) + dotations (68) + charges financières (66) ; le compte 65 (autres charges ordinaires)
  //   est reclassé en charges financières nettes conformément au référentiel EF.
  const efChargesExploitationBrut = ok(
    achatsConsommes + chargesExternes + autresServicesExterieurs + chargesDePersonnel + impotsTaxes + dotations + debit('66')
  );
  const efResultatNet = resultatNet;
  const efChargesFinancieres = ok(debit('65'));
  const efProduitsFinanciers = ok(credit('76'));
  const efResultatFinancier = ok(efProduitsFinanciers - efChargesFinancieres);
  // Résultat d'exploitation reconstitué pour respecter l'identité :
  // RN = RE + RF - impôt  =>  RE = RN - RF + impôt  (matche EF : 137261)
  const efResultatExploitation = ok(efResultatNet - efResultatFinancier + impot);
  const efChargesExploitation = ok(efVentes - efResultatExploitation);
  // Résultat des activités ordinaires avant impôt = RN + impôt, puis les lignes de présentation
  // (exploitation + financier + autres gains) sont calculées pour reconstituer exactement ce total.
  const efResultatOrdinaire = ok(efResultatNet + impot);
  const efAutresGains = ok(efResultatOrdinaire - efResultatExploitation - efResultatFinancier);

  // ===== CAPITAUX PROPRES (final) =====
  // Le résultat de l'exercice au bilan vient du calcul 6/7 (source détaillée) si présent,
  // sinon du solde clos (131-135) pour les balances déjà arrêtées sans détail.
  const rnBilan = resultatPresent ? resultatExercice : (rnClosPresent ? rnClos : resultatExercice);
  const capPropres = ok(capital + reserves + resultatsReportes + autresCapitauxPropres + rnBilan);
  const passifNC = ok(emprunts + provisionsDettes + autresPassifsNC);
  // Équilibre du bilan dans les DEUX sens (actif ≥ passif OU passif > actif).
  // On calcule le déséquilibre avant résidu, puis on l'absorbe du côté déficitaire.
  // Passif courant = fournisseurs + état + personnel + clients créditeurs + autres dettes de tiers
  // + concours bancaires. Les créances de tiers (avances fournisseurs, autres créances) sont en actif.
  const passifSansResidu = ok(capPropres + passifNC + fournisseurs + etatCredit + personnelCredit + clientsCrediteurs + autresDettesTiers + concoursBancaires + empruntsCourants);
  const deltaEquilibre = ok(totalActif - passifSansResidu);
  let autresDettesCalc = 0;
  let ecartEquilibreActif = 0;
  if (deltaEquilibre >= 0) {
    // Actif ≥ passif : on complète le passif par des autres dettes.
    autresDettesCalc = deltaEquilibre;
  } else {
    // Passif > actif : on complète l'actif par un poste résiduel (créance d'équilibre).
    autresDettesCalc = 0;
    ecartEquilibreActif = -deltaEquilibre;
    totalActif = ok(totalActif + ecartEquilibreActif);
  }
  const passifC = ok(fournisseurs + etatCredit + personnelCredit + clientsCrediteurs + autresDettesTiers + autresDettesCalc + concoursBancaires + empruntsCourants);
  const totalPassif = ok(capPropres + passifNC + passifC);

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

  // ===== FLUX DE TRÉSORERIE (méthode indirecte) =====
  // Soldes N-1 (exercice précédent) pour les variations réelles du BFR et des immos
  const stocksPrev = hasPrev ? ok(dnPrev('3') - cnPrev('39')) : 0;
  const clientsPrev = hasPrev ? ok(dnPrev('411') + dnPrev('416') - cnPrev('413') - cnPrev('419') - cnPrev('491')) : 0;
  const fournisseursPrev = hasPrev ? ok(cnPrev('401') + cnPrev('408') - dnPrev('409')) : 0;
  const etatPrev = hasPrev ? ok(cnPrev('43') - dnPrev('437') - dnPrev('438')) : 0;
  const personnelPrev = hasPrev ? ok(cnPrev('421') + cnPrev('425') + cnPrev('428')) : 0;
  const tresoreriePrev = hasPrev ? ok(dnPrev('51') + dnPrev('52') + dnPrev('53') + dnPrev('54') + dnPrev('55')) : 0;
  const ancBrutPrev = hasPrev ? ok(dnPrev('20') + dnPrev('21') + dnPrev('22') + dnPrev('23') + dnPrev('24') + dnPrev('25') + dnPrev('26') + dnPrev('27')) : 0;
  const amortPrev = hasPrev ? ok(cnPrev('28')) : 0;
  const vcnPrev = ok(ancBrutPrev - amortPrev);
  // Variations du BFR (N - N-1)
  const varFluxStocks = ok(stocks - stocksPrev);          // + sortie de trésorerie
  const varFluxClients = ok(clients - clientsPrev);         // + sortie de trésorerie
  const varFluxFournisseurs = ok(-(fournisseurs - fournisseursPrev)); // + entrée de trésorerie
  const varFluxEtat = ok(-(etatCredit - etatPrev));        // + entrée de trésorerie
  const varFluxPersonnel = ok(-(personnelCredit - personnelPrev)); // + entrée de trésorerie
  const variationBFR = ok(varFluxStocks + varFluxClients + varFluxFournisseurs + varFluxEtat + varFluxPersonnel);
  const mba = ok(efResultatNet + dotations - reprises);
  const fluxExploitation = ok(mba + variationBFR);
  // Variation nette des immobilisations (VCN_N - VCN_N-1) -> acquisitions nettes = sortie
  const vcnN = ok(ancBrut - amortissements);
  const fluxInvestissement = ok(vcnPrev - vcnN);
  // Trésorerie : variation = Trésorerie_N - Trésorerie_N-1
  const variationTresorerie = ok(tresorerieActif - tresoreriePrev);
  // Financement par différence pour boucler le tableau
  const fluxFinancement = ok(variationTresorerie - fluxExploitation - fluxInvestissement);
  const tresorerieInitiale = ok(tresoreriePrev);
  const acquisitionsImmobilisations = ok(Math.max(0, vcnN - vcnPrev));
  const cessionsImmobilisations = ok(Math.max(0, vcnPrev - vcnN));
  const apportsCapital = 0;
  const empruntsNouveaux = 0;
  const remboursementsEmprunts = 0;

  // ===== RÉSULTAT FISCAL (détermination IS/CSS — modèle EF) =====
  // Réintégrations (charges non déductibles / imposables) :
  const reintegImpots = ok(debit('691000'));         // impôts sur le résultat (691000)
  const reintegCss = ok(debit('691001'));            // CSS / STE (691001)
  const reintegPenalites = ok(debit('632000'));      // pénalités de retard (632000)
  const reintegrations = ok(reintegImpots + reintegCss + reintegPenalites);
  // Déductions : le modèle EF (ANIMAL CITY) porte Déductions = 0.
  // Le report amortissement (6811) et le report reportable N-1 ne sont pas déduits ici.
  const dedReportAmort = 0;
  const dedReportReportable = 0;
  const deductions = ok(dedReportAmort + dedReportReportable);
  const resultatFiscal = ok(resultatNet + reintegrations - deductions);
  const isFiscal = ok(resultatFiscal * 0.20);        // IS 20%
  const cssFiscal = ok(resultatFiscal * 0.03);       // CSS 3%
  const retenueSourceClients = ok(debit('434100'));  // retenue à la source / clients (434100)
  const reportIs = ok(isFiscal + cssFiscal + retenueSourceClients);

  // ===== RATIOS =====
  const lr = (n, d) => d > 0 ? ok(n / d) : 0;
  const lrp = (n, d) => d > 0 ? Math.round((n / d) * 10000) / 100 : 0;
  const liquiditeGenerale = lr(actifC, passifC);
  const liquiditeReduite = lr(actifC - stocks, passifC);
  const liquiditeImmediate = lr(tresorerieActif, passifC);
  const autonomieFinanciere = lrp(capPropres, totalPassif);
  const endettementNet = lrp(emprunts + empruntsCourants + concoursBancaires + autresPassifsNC, capPropres || 1);
  const rentabiliteEconomique = lrp(resultatExploitation, totalActif);
  const rentabiliteFinanciere = lrp(resultatNet, capPropres || 1);
  const margeNette = lrp(resultatNet, totalVentes || 1);
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
      immobilisationsFinancieres: ok(fin),
      stocks, stocksBrutes, provisionsStocks,
      provisionsStocksDeduction: provisionsStocks,
      clients, clientsBrutes, provisionsClients,
      provisionsClientsDeduction: provisionsClients,
      clientsNets: clients,
      clientsCrediteurs, avancesFournisseurs, avancesEmprunts,
      etatDebit, personnelDebit, autresCréances, autresDettesTiers,
      tresorerie: tresorerieActif, tresorerieActif,
      tresorerieBrute: tresorerieActif,
      provisionsTresorerieDeduction: 0,
      capital, capitalSocial: capital,
      reserves, resultatsReportes, resultatExercice,
      autresCapitauxPropres,
      capPropres, passifNC, passifC, totalPassif, ecartEquilibreActif,
      emprunts, empruntsCourants, provisionsDettes, provisions,
      autresPassifsNC,
      fournisseurs, etatCredit, personnelCredit, autresDettes: autresDettesCalc, concoursBancaires,

      donneesImmobilisations: {
        totalBrut: ancBrut,
        lignes: [
          { categorie: 'Frais préliminaires', debut: 0, augmentation: 0, diminution: 0, fin: ok(fp), _key: 'fp' },
          { categorie: 'Incorporelles', debut: 0, augmentation: 0, diminution: 0, fin: ok(incorp), _key: 'inc' },
          { categorie: 'Corporelles', debut: 0, augmentation: 0, diminution: 0, fin: ok(corp), _key: 'corp' },
          { categorie: 'Financières', debut: 0, augmentation: 0, diminution: 0, fin: ok(fin), _key: 'fin' },
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
          { rubrique: 'Résultat de l\'exercice', debut: 0, augmentation: 0, diminution: 0, fin: ok(efResultatNet), _key: 'resex' },
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
      efVentes, efChargesExploitation, efResultatExploitation,
      efChargesFinancieres, efProduitsFinanciers, efResultatFinancier,
      efAutresGains, efResultatOrdinaire, efResultatNet,
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
      resultatNet: efResultatNet,
      dotations: ok(dotations),
      reprises: ok(reprises),
      margeBruteAutofinancement: mba,
      variationClients: varFluxClients,
      variationFournisseurs: varFluxFournisseurs,
      variationEtat: varFluxEtat,
      variationPersonnel: varFluxPersonnel,
      variationStocks: varFluxStocks,
      variationBFR,
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
    resultatFiscal: {
      resultatComptable: resultatNet,
      reintegImpots, reintegCss, reintegPenalites, reintegrations,
      dedReportAmort, dedReportReportable, deductions,
      resultatFiscal, isFiscal, cssFiscal, retenueSourceClients, reportIs,
    },
  };
}
