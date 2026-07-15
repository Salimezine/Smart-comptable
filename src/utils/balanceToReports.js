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

  const ok = (v) => isNaN(v) || !isFinite(v) ? 0 : Math.round(v * 1000) / 1000;

  const cap = s('10'); const res = s('11'); const rr = s('12'); const rEx = s('13');
  const capital = ok(cap < 0 ? -cap : 0);
  const reserves = ok(res < 0 ? -res : 0);
  const resultatsReportes = ok(rr < 0 ? -rr : 0);
  const resultatExercice = ok(rEx < 0 ? -rEx : 0);

  const fp = s('20'); const ii = s('21'); const ic = s('22') + s('23') + s('24') + s('25'); const ifi = s('27');
  const am = s('28'); const pnc = s('29');
  const ancBrut = ok(fp + ii + ic + ifi);
  const amortissements = ok(am < 0 ? -am : 0);
  const provActifNC = ok(pnc < 0 ? -pnc : 0);
  const actifNC = ok(ancBrut - amortissements - provActifNC);

  const stockBalance = s('3');
  const provStockBalance = s('39');
  const stocksBrutVal = ok(stockBalance - provStockBalance);
  const provisionsStocksVal = ok(provStockBalance < 0 ? -provStockBalance : 0);
  const stocks = ok(stockBalance > 0 ? stockBalance : 0);
  const cl = s('41'); const provCl = s('491');
  const clients = ok(cl > 0 ? cl : 0);
  const provisionsClients = ok(provCl < 0 ? -provCl : 0);
  const clientsNets = ok(clients - provisionsClients);
  const etatDebit = ok(s('43') > 0 ? s('43') : 0);
  const personnelDebit = ok(s('45') > 0 ? s('45') : 0);
  const autresCréances = ok(s('40') + s('44') + s('46') + s('47') + s('48'));
  const tresorerie = ok(s('5'));
  const actifC = ok(stocks + clientsNets + etatDebit + personnelDebit + autresCréances + tresorerie);
  const totalActif = ok(actifNC + actifC);

  const emprunts = ok(s('16') < 0 ? -s('16') : 0);
  const provisionsDettes = ok(s('15') < 0 ? -s('15') : 0);
  const fournisseurs = ok(s('40') < 0 ? -s('40') : 0);
  const etatCredit = ok(s('43') < 0 ? -s('43') : 0);
  const personnelCredit = ok(s('42') < 0 ? -s('42') : 0);
  const autresDettes = ok(s('44') + s('46') + s('47') + s('48') + s('49'));
  const concoursBancaires = ok(s('52') < 0 ? -s('52') : 0);

  const capPropres = ok(capital + reserves + resultatsReportes + resultatExercice);
  const passifNC = ok(emprunts + provisionsDettes);
  const passifC = ok(fournisseurs + etatCredit + personnelCredit + autresDettes + concoursBancaires);
  const totalPassif = ok(capPropres + passifNC + passifC);

  if (Math.abs(totalActif - totalPassif) > 0.01) {
    anomalies.push(`Bilan non équilibré : Actif=${totalActif} ≠ Passif=${totalPassif} (écart=${(totalActif - totalPassif).toFixed(3)})`);
  }

  // État de résultat
  const ventes = credit('70');
  const productionStockee = credit('71');
  const productionImmobilisee = credit('72');
  const subventionsExploitation = credit('74');
  const autresProduitsExploitation = credit('75');
  const reprises = credit('78');
  const produitsExploitation = ventes + productionStockee + productionImmobilisee + subventionsExploitation + autresProduitsExploitation + reprises;

  const achatsConsommes = debit('60');
  const chargesExternes = debit('61');
  const chargesPersonnel = debit('62');
  const impotsTaxes = debit('63');
  const autresChargesExploitation = debit('65');
  const dotations = debit('68');
  const chargesExploitation = achatsConsommes + chargesExternes + chargesPersonnel + impotsTaxes + autresChargesExploitation + dotations;

  const resultatExploitation = ok(produitsExploitation - chargesExploitation);
  const produitsFinanciers = credit('76');
  const chargesFinancieres = debit('66');
  const resultatFinancier = ok(produitsFinanciers - chargesFinancieres);
  const produitsExceptionnels = credit('77');
  const chargesExceptionnelles = debit('67');
  const resultatExceptionnel = ok(produitsExceptionnels - chargesExceptionnelles);
  const resultatAvantImpot = ok(resultatExploitation + resultatFinancier);
  const impot = debit('69');
  const resultatNet = ok(resultatAvantImpot + resultatExceptionnel - impot);

  if (Math.abs(resultatNet - resultatExercice) > 0.01) {
    anomalies.push(`Résultat CPC (${resultatNet}) ≠ Résultat bilan (${resultatExercice})`);
  }

  // SIG
  const vMarch = credit('70') - credit('706');
  const prestations = credit('706');
  const aMarch = debit('601');
  const vStockMarch = s('36');
  const margeCommerciale = ok(vMarch - aMarch + vStockMarch);
  const productionExercice = ok(prestations + productionStockee + productionImmobilisee);
  const valeurAjoutee = ok(margeCommerciale + productionExercice - achatsConsommes - chargesExternes);
  const ebe = ok(valeurAjoutee + subventionsExploitation - chargesPersonnel - impotsTaxes);
  const sigResultatExploitation = ok(ebe + reprises - dotations + autresProduitsExploitation - autresChargesExploitation);
  const sigRcai = ok(sigResultatExploitation + resultatFinancier);
  const sigResultatNet = ok(sigRcai + resultatExceptionnel - impot);

  // Flux trésorerie
  const mba = ok(resultatNet + dotations - reprises);
  const fluxExploitation = ok(mba);
  const fluxInvestissement = 0;
  const fluxFinancement = 0;
  const variationTresorerie = ok(fluxExploitation + fluxInvestissement + fluxFinancement);

  // Ratios
  const lr = (n, d) => d > 0 ? ok(n / d) : 0;
  const lg = lr(actifC, passifC);
  const lr2 = lr(actifC - stocks, passifC);
  const li = lr(tresorerie, passifC);
  const af = lr(capPropres, totalPassif);
  const en = lr(passifNC + passifC, capPropres);
  const re2 = lr(resultatExploitation, totalActif);
  const rf = lr(resultatNet, capPropres);
  const mn = lr(resultatNet, produitsExploitation);
  const rs = achatsConsommes > 0 ? ok((stocks / achatsConsommes) * 360) : 0;
  const dc = ventes > 0 ? ok((clients / ventes) * 360) : 0;
  const df = achatsConsommes > 0 ? ok((fournisseurs / achatsConsommes) * 360) : 0;

  return {
    bilan: {
      actifNC, actifC, totalActif,
      ancBrut, amortissements, provActifNC,
      amortissementsDeduction: amortissements,
      provisionsActifNCDeduction: provActifNC,
      provisionsStocksDeduction: provisionsStocksVal,
      provisionsClientsDeduction: provisionsClients,
      provisionsTresorerieDeduction: 0,
      fraisPreliminaires: ok(fp),
      immobilisationsIncorporelles: ok(ii),
      immobilisationsCorporelles: ok(ic),
      immobilisationsFinancieres: ok(ifi),
      stocks, stocksBrutes: stocksBrutVal, provisionsStocks: provisionsStocksVal,
      clients, provisionsClients, clientsNets,
      etatDebit, personnelDebit, autresCréances,
      tresorerie, tresorerieActif: tresorerie,
      capital, capitalSocial: capital,
      reserves, resultatsReportes, resultatExercice,
      autresCapitauxPropres: 0,
      capPropres, passifNC, passifC, totalPassif,
      emprunts, provisionsDettes, provisions: provisionsDettes,
      autresPassifsNC: 0,
      fournisseurs, etatCredit, personnelCredit, autresDettes, concoursBancaires,
    },
    resultat: {
      produitsExploitation: ok(produitsExploitation),
      totalProduitsExploitation: ok(produitsExploitation),
      chargesExploitation: ok(chargesExploitation),
      totalChargesExploitation: ok(chargesExploitation),
      resultatExploitation,
      ventes: ok(ventes),
      ventesMarchandises: ok(ventes - prestations),
      ventesPrestations: ok(prestations),
      productionStockee: ok(productionStockee),
      productionImmobilisee: ok(productionImmobilisee),
      subventionsExploitation: ok(subventionsExploitation),
      autresProduitsExploitation: ok(autresProduitsExploitation),
      autresProduits: ok(autresProduitsExploitation),
      reprises: ok(reprises),
      achats: ok(achatsConsommes),
      achatsConsommes: ok(achatsConsommes),
      achatsMarchandises: ok(debit('601')),
      achatsMP: ok(debit('602')),
      autresAchatsSIG: ok(debit('60') - debit('601') - debit('602')),
      chargesExternes: ok(chargesExternes),
      chargesPersonnel: ok(chargesPersonnel),
      impotsTaxes: ok(impotsTaxes),
      autresChargesExploitation: ok(autresChargesExploitation),
      autresCharges: ok(autresChargesExploitation),
      dotations: ok(dotations),
      produitsFinanciers: ok(produitsFinanciers),
      chargesFinancieres: ok(chargesFinancieres),
      resultatFinancier,
      produitsExceptionnels: ok(produitsExceptionnels),
      chargesExceptionnelles: ok(chargesExceptionnelles),
      resultatExceptionnel,
      resultatAvantImpot,
      impot: ok(impot),
      impotIS: ok(impot),
      resultatNet,
      margeCommerciale,
      productionExercice,
      valeurAjoutee,
      ebe,
      rcai: sigRcai,
      sigResultatNet,
    },
    sig: {
      margeCommerciale, productionExercice, valeurAjoutee,
      ebe, sigResultatExploitation, sigRcai, sigResultatNet,
    },
    fluxTresorerie: {
      resultatNet, dotations: ok(dotations), reprises: ok(reprises),
      margeBruteAutofinancement: mba,
      fluxExploitation, fluxInvestissement, fluxFinancement,
      variationTresorerie,
      tresorerieInitiale: 0, tresorerieFinale: tresorerie,
      acquisitionsImmobilisations: 0, cessionsImmobilisations: 0,
      apportsCapital: 0, empruntsNouveaux: 0, remboursementsEmprunts: 0,
    },
    ratios: {
      liquiditeGenerale: lg, liquiditeReduite: lr2, liquiditeImmediate: li,
      autonomieFinanciere: af, endettementNet: en,
      rentabiliteEconomique: re2, rentabiliteFinanciere: rf, margeNette: mn,
      rotationStocksJours: rs, delaiClientsJours: dc, delaiFournisseursJours: df,
      bfr: ok(stocks + clients - fournisseurs),
      tresorerieNette: ok(tresorerie - concoursBancaires),
    },
    controle: {
      equilibree: Math.abs(totalDebit - totalCredit) < 0.001,
      totalDebit: ok(totalDebit),
      totalCredit: ok(totalCredit),
    },
    anomalies,
  };
}
