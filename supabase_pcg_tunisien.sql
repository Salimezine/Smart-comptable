-- PCG Tunisien (Plan Comptable Général Tunisien)
-- Basé sur le système comptable tunisien (loi 96-112)
-- Classes 1 à 8

CREATE TABLE IF NOT EXISTS public.comptes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  libelle TEXT NOT NULL,
  classe INTEGER NOT NULL,
  compte_parent TEXT,
  nature TEXT CHECK (nature IN ('debit', 'credit', 'bilateral')) DEFAULT 'debit',
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, numero)
);

ALTER TABLE public.comptes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comptes access via company" ON public.comptes
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

GRANT ALL ON public.comptes TO authenticated;

-- Créer les comptes PCG par défaut pour une société
CREATE OR REPLACE FUNCTION public.init_pcg_default(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.comptes (company_id, numero, libelle, classe, nature) VALUES
  -- === CLASSE 1 : CAPITAUX ===
  (p_company_id, '10', 'Capital et réserves', 1, 'credit'),
  (p_company_id, '101', 'Capital social', 1, 'credit'),
  (p_company_id, '1011', 'Capital souscrit', 1, 'credit'),
  (p_company_id, '1012', 'Capital appelé', 1, 'credit'),
  (p_company_id, '1013', 'Capital libéré', 1, 'credit'),
  (p_company_id, '105', 'Primes d''émission', 1, 'credit'),
  (p_company_id, '106', 'Réserves', 1, 'credit'),
  (p_company_id, '1061', 'Réserve légale', 1, 'credit'),
  (p_company_id, '1063', 'Réserves statutaires', 1, 'credit'),
  (p_company_id, '1068', 'Autres réserves', 1, 'credit'),
  (p_company_id, '108', 'Compte d''exploitation', 1, 'credit'),
  (p_company_id, '11', 'Reports à nouveau', 1, 'credit'),
  (p_company_id, '110', 'Report à nouveau (solde créditeur)', 1, 'credit'),
  (p_company_id, '119', 'Report à nouveau (solde débiteur)', 1, 'debit'),
  (p_company_id, '12', 'Résultat de l''exercice', 1, 'bilateral'),
  (p_company_id, '129', 'Résultat en instance d''affectation', 1, 'bilateral'),
  (p_company_id, '13', 'Subventions d''investissement', 1, 'credit'),
  (p_company_id, '131', 'Subventions d''équipement', 1, 'credit'),
  (p_company_id, '14', 'Provisions réglementées', 1, 'credit'),
  (p_company_id, '141', 'Amortissements dérogatoires', 1, 'credit'),
  (p_company_id, '15', 'Provisions pour risques et charges', 1, 'credit'),
  (p_company_id, '151', 'Provisions pour litiges', 1, 'credit'),
  (p_company_id, '153', 'Provisions pour garanties', 1, 'credit'),
  (p_company_id, '16', 'Emprunts et dettes assimilées', 1, 'credit'),
  (p_company_id, '161', 'Emprunts obligataires', 1, 'credit'),
  (p_company_id, '164', 'Emprunts bancaires', 1, 'credit'),
  (p_company_id, '1641', 'Emprunts à long terme', 1, 'credit'),
  (p_company_id, '1642', 'Emprunts à moyen terme', 1, 'credit'),
  (p_company_id, '165', 'Dettes de location-acquisition', 1, 'credit'),
  (p_company_id, '168', 'Autres emprunts', 1, 'credit'),
  (p_company_id, '17', 'Dettes de crédit-bail', 1, 'credit'),
  (p_company_id, '18', 'Comptes de liaison', 1, 'bilateral'),

  -- === CLASSE 2 : IMMOBILISATIONS ===
  (p_company_id, '20', 'Frais d''établissement', 2, 'debit'),
  (p_company_id, '201', 'Frais de constitution', 2, 'debit'),
  (p_company_id, '202', 'Frais d''augmentation de capital', 2, 'debit'),
  (p_company_id, '21', 'Immobilisations incorporelles', 2, 'debit'),
  (p_company_id, '211', 'Frais de recherche et développement', 2, 'debit'),
  (p_company_id, '212', 'Brevets et licences', 2, 'debit'),
  (p_company_id, '213', 'Logiciels', 2, 'debit'),
  (p_company_id, '214', 'Fonds commercial', 2, 'debit'),
  (p_company_id, '215', 'Droit au bail', 2, 'debit'),
  (p_company_id, '22', 'Terrains', 2, 'debit'),
  (p_company_id, '221', 'Terrains nus', 2, 'debit'),
  (p_company_id, '222', 'Terrains aménagés', 2, 'debit'),
  (p_company_id, '223', 'Terrains bâtis', 2, 'debit'),
  (p_company_id, '23', 'Constructions', 2, 'debit'),
  (p_company_id, '231', 'Bâtiments industriels', 2, 'debit'),
  (p_company_id, '232', 'Bâtiments administratifs', 2, 'debit'),
  (p_company_id, '233', 'Constructions légères', 2, 'debit'),
  (p_company_id, '234', 'Aménagements de constructions', 2, 'debit'),
  (p_company_id, '24', 'Matériel et outillage', 2, 'debit'),
  (p_company_id, '241', 'Matériel industriel', 2, 'debit'),
  (p_company_id, '242', 'Outillage', 2, 'debit'),
  (p_company_id, '243', 'Matériel de bureau', 2, 'debit'),
  (p_company_id, '244', 'Mobilier de bureau', 2, 'debit'),
  (p_company_id, '245', 'Matériel informatique', 2, 'debit'),
  (p_company_id, '246', 'Matériel de transport', 2, 'debit'),
  (p_company_id, '247', 'Installations générales', 2, 'debit'),
  (p_company_id, '25', 'Autres immobilisations corporelles', 2, 'debit'),
  (p_company_id, '251', 'Agencements et aménagements', 2, 'debit'),
  (p_company_id, '26', 'Immobilisations financières', 2, 'debit'),
  (p_company_id, '261', 'Titres de participation', 2, 'debit'),
  (p_company_id, '262', 'Prêts au personnel', 2, 'debit'),
  (p_company_id, '263', 'Dépôts et cautionnements', 2, 'debit'),
  (p_company_id, '27', 'Immobilisations en cours', 2, 'debit'),
  (p_company_id, '271', 'Avances sur immobilisations', 2, 'debit'),
  (p_company_id, '28', 'Amortissements', 2, 'credit'),
  (p_company_id, '281', 'Amort. frais d''établissement', 2, 'credit'),
  (p_company_id, '282', 'Amort. immobilisations incorporelles', 2, 'credit'),
  (p_company_id, '283', 'Amort. terrains nus', 2, 'credit'),
  (p_company_id, '284', 'Amort. constructions', 2, 'credit'),
  (p_company_id, '285', 'Amort. matériel et outillage', 2, 'credit'),
  (p_company_id, '286', 'Amort. autres immo. corporelles', 2, 'credit'),
  (p_company_id, '29', 'Provisions pour dépréciation', 2, 'credit'),
  (p_company_id, '291', 'Prov. immo. incorporelles', 2, 'credit'),
  (p_company_id, '292', 'Prov. immo. corporelles', 2, 'credit'),

  -- === CLASSE 3 : STOCKS ===
  (p_company_id, '30', 'Marchandises', 3, 'debit'),
  (p_company_id, '301', 'Marchandises en magasin', 3, 'debit'),
  (p_company_id, '302', 'Marchandises en cours de route', 3, 'debit'),
  (p_company_id, '31', 'Matières premières', 3, 'debit'),
  (p_company_id, '311', 'Matières premières A', 3, 'debit'),
  (p_company_id, '312', 'Matières premières B', 3, 'debit'),
  (p_company_id, '32', 'Autres approvisionnements', 3, 'debit'),
  (p_company_id, '321', 'Fournitures consommables', 3, 'debit'),
  (p_company_id, '322', 'Emballages', 3, 'debit'),
  (p_company_id, '33', 'Produits finis', 3, 'debit'),
  (p_company_id, '34', 'Travaux en cours', 3, 'debit'),
  (p_company_id, '341', 'Travaux en cours production', 3, 'debit'),
  (p_company_id, '35', 'Produits intermédiaires', 3, 'debit'),
  (p_company_id, '38', 'Stocks hors exploitation', 3, 'debit'),
  (p_company_id, '39', 'Provisions pour dépréciation des stocks', 3, 'credit'),

  -- === CLASSE 4 : TIERS ===
  (p_company_id, '40', 'Fournisseurs', 4, 'credit'),
  (p_company_id, '401', 'Fournisseurs d''exploitation', 4, 'credit'),
  (p_company_id, '4011', 'Fournisseurs - Achats', 4, 'credit'),
  (p_company_id, '4012', 'Fournisseurs - Prestations', 4, 'credit'),
  (p_company_id, '402', 'Fournisseurs d''immobilisations', 4, 'credit'),
  (p_company_id, '403', 'Fournisseurs - Retenues de garantie', 4, 'credit'),
  (p_company_id, '404', 'Fournisseurs - Effets à payer', 4, 'credit'),
  (p_company_id, '409', 'Fournisseurs débiteurs', 4, 'debit'),
  (p_company_id, '41', 'Clients', 4, 'debit'),
  (p_company_id, '411', 'Clients - Ventes', 4, 'debit'),
  (p_company_id, '412', 'Clients - Effets à recevoir', 4, 'debit'),
  (p_company_id, '413', 'Clients - Retenues de garantie', 4, 'debit'),
  (p_company_id, '414', 'Clients douteux', 4, 'debit'),
  (p_company_id, '419', 'Clients créditeurs', 4, 'credit'),
  (p_company_id, '42', 'Personnel', 4, 'bilateral'),
  (p_company_id, '421', 'Personnel - Rémunérations dues', 4, 'credit'),
  (p_company_id, '422', 'Personnel - Congés à payer', 4, 'credit'),
  (p_company_id, '423', 'Personnel - Avances', 4, 'debit'),
  (p_company_id, '425', 'Personnel - Oppositions', 4, 'credit'),
  (p_company_id, '426', 'Personnel - Charges à payer', 4, 'credit'),
  (p_company_id, '43', 'État et collectivités publiques', 4, 'bilateral'),
  (p_company_id, '431', 'État - TVA collectée', 4, 'credit'),
  (p_company_id, '432', 'État - TVA déductible', 4, 'debit'),
  (p_company_id, '433', 'État - TVA due', 4, 'credit'),
  (p_company_id, '434', 'État - TVA crédit', 4, 'debit'),
  (p_company_id, '435', 'État - Impôt sur les sociétés', 4, 'credit'),
  (p_company_id, '436', 'État - Retenue à la source', 4, 'credit'),
  (p_company_id, '437', 'État - Autres impôts et taxes', 4, 'credit'),
  (p_company_id, '438', 'État - Subventions à recevoir', 4, 'debit'),
  (p_company_id, '44', 'Organismes sociaux', 4, 'bilateral'),
  (p_company_id, '441', 'CNSS - Cotisations dues', 4, 'credit'),
  (p_company_id, '442', 'CNSS - Cotisations à payer', 4, 'credit'),
  (p_company_id, '443', 'CNSS - Avances', 4, 'debit'),
  (p_company_id, '444', 'Mutuelle - Cotisations', 4, 'credit'),
  (p_company_id, '445', 'Assurance groupe', 4, 'credit'),
  (p_company_id, '45', 'Associés', 4, 'bilateral'),
  (p_company_id, '451', 'Associés - Comptes courants', 4, 'bilateral'),
  (p_company_id, '455', 'Associés - Dividendes à payer', 4, 'credit'),
  (p_company_id, '46', 'Débiteurs divers', 4, 'debit'),
  (p_company_id, '461', 'Créances diverses', 4, 'debit'),
  (p_company_id, '462', 'Créances sur cessions', 4, 'debit'),
  (p_company_id, '47', 'Créditeurs divers', 4, 'credit'),
  (p_company_id, '471', 'Dettes diverses', 4, 'credit'),
  (p_company_id, '48', 'Comptes de régularisation', 4, 'bilateral'),
  (p_company_id, '481', 'Charges constatées d''avance', 4, 'debit'),
  (p_company_id, '482', 'Produits constatés d''avance', 4, 'credit'),
  (p_company_id, '483', 'Charges à payer', 4, 'credit'),
  (p_company_id, '484', 'Produits à recevoir', 4, 'debit'),
  (p_company_id, '49', 'Provisions pour dépréciation des tiers', 4, 'credit'),
  (p_company_id, '491', 'Prov. dépréciation clients', 4, 'credit'),
  (p_company_id, '495', 'Prov. dépréciation débiteurs', 4, 'credit'),

  -- === CLASSE 5 : TRÉSORERIE ===
  (p_company_id, '50', 'Valeurs à encaisser', 5, 'debit'),
  (p_company_id, '501', 'Effets à encaisser', 5, 'debit'),
  (p_company_id, '502', 'Chèques à encaisser', 5, 'debit'),
  (p_company_id, '51', 'Banques', 5, 'debit'),
  (p_company_id, '511', 'Banque compte courant', 5, 'debit'),
  (p_company_id, '512', 'Banque compte épargne', 5, 'debit'),
  (p_company_id, '513', 'Banque crédit', 5, 'bilateral'),
  (p_company_id, '52', 'Caisse', 5, 'debit'),
  (p_company_id, '521', 'Caisse siège', 5, 'debit'),
  (p_company_id, '522', 'Caisse succursale', 5, 'debit'),
  (p_company_id, '53', 'Règles d''avance', 5, 'debit'),
  (p_company_id, '54', 'Virements internes', 5, 'bilateral'),
  (p_company_id, '55', 'Cartes de crédit', 5, 'debit'),
  (p_company_id, '56', 'Chèques postaux', 5, 'debit'),
  (p_company_id, '561', 'CCP', 5, 'debit'),
  (p_company_id, '57', 'Autres moyens de paiement', 5, 'debit'),
  (p_company_id, '59', 'Provisions pour dépréciation trésorerie', 5, 'credit'),

  -- === CLASSE 6 : CHARGES ===
  (p_company_id, '60', 'Achats', 6, 'debit'),
  (p_company_id, '601', 'Achats de marchandises', 6, 'debit'),
  (p_company_id, '602', 'Achats de matières premières', 6, 'debit'),
  (p_company_id, '603', 'Achats d''emballages', 6, 'debit'),
  (p_company_id, '604', 'Achats de fournitures', 6, 'debit'),
  (p_company_id, '605', 'Achats non stockés', 6, 'debit'),
  (p_company_id, '606', 'Variation des stocks (achats)', 6, 'debit'),
  (p_company_id, '607', 'Rabais, remises, ristournes (achats)', 6, 'credit'),
  (p_company_id, '61', 'Services extérieurs', 6, 'debit'),
  (p_company_id, '611', 'Électricité', 6, 'debit'),
  (p_company_id, '612', 'Eau', 6, 'debit'),
  (p_company_id, '613', 'Gaz', 6, 'debit'),
  (p_company_id, '614', 'Téléphone et internet', 6, 'debit'),
  (p_company_id, '615', 'Entretien et réparations', 6, 'debit'),
  (p_company_id, '616', 'Loyers', 6, 'debit'),
  (p_company_id, '617', 'Assurances', 6, 'debit'),
  (p_company_id, '618', 'Documentation et publications', 6, 'debit'),
  (p_company_id, '619', 'Autres services extérieurs', 6, 'debit'),
  (p_company_id, '62', 'Autres services extérieurs', 6, 'debit'),
  (p_company_id, '621', 'Honoraires', 6, 'debit'),
  (p_company_id, '622', 'Frais d''actes et contentieux', 6, 'debit'),
  (p_company_id, '623', 'Publicité et publications', 6, 'debit'),
  (p_company_id, '624', 'Transports', 6, 'debit'),
  (p_company_id, '625', 'Déplacements et missions', 6, 'debit'),
  (p_company_id, '626', 'Réceptions', 6, 'debit'),
  (p_company_id, '627', 'Commissions et courtages', 6, 'debit'),
  (p_company_id, '628', 'Autres charges externes', 6, 'debit'),
  (p_company_id, '63', 'Impôts et taxes', 6, 'debit'),
  (p_company_id, '631', 'Impôts directs', 6, 'debit'),
  (p_company_id, '6311', 'TCL (Taxe sur les établissements à caractère industriel, commercial ou professionnel)', 6, 'debit'),
  (p_company_id, '6312', 'Contribution des patentes', 6, 'debit'),
  (p_company_id, '632', 'Impôts indirects', 6, 'debit'),
  (p_company_id, '633', 'Taxes sur les salaires', 6, 'debit'),
  (p_company_id, '635', 'Autres impôts et taxes', 6, 'debit'),
  (p_company_id, '64', 'Charges de personnel', 6, 'debit'),
  (p_company_id, '641', 'Salaires et appointements', 6, 'debit'),
  (p_company_id, '642', 'Indemnités et primes', 6, 'debit'),
  (p_company_id, '643', 'CNSS - Part patronale', 6, 'debit'),
  (p_company_id, '644', 'Mutuelle - Part patronale', 6, 'debit'),
  (p_company_id, '645', 'Assurance groupe - Part patronale', 6, 'debit'),
  (p_company_id, '646', 'Formation professionnelle', 6, 'debit'),
  (p_company_id, '647', 'Médecine du travail', 6, 'debit'),
  (p_company_id, '648', 'Autres charges de personnel', 6, 'debit'),
  (p_company_id, '65', 'Charges financières', 6, 'debit'),
  (p_company_id, '651', 'Intérêts des emprunts', 6, 'debit'),
  (p_company_id, '652', 'Intérêts bancaires', 6, 'debit'),
  (p_company_id, '653', 'Escomptes accordés', 6, 'debit'),
  (p_company_id, '654', 'Agios bancaires', 6, 'debit'),
  (p_company_id, '655', 'Pertes de change', 6, 'debit'),
  (p_company_id, '658', 'Autres charges financières', 6, 'debit'),
  (p_company_id, '66', 'Charges diverses', 6, 'debit'),
  (p_company_id, '661', 'Pénalités et amendes', 6, 'debit'),
  (p_company_id, '662', 'Dons et libéralités', 6, 'debit'),
  (p_company_id, '663', 'Créances irrécouvrables', 6, 'debit'),
  (p_company_id, '668', 'Autres charges diverses', 6, 'debit'),
  (p_company_id, '67', 'Dotations aux amortissements', 6, 'debit'),
  (p_company_id, '671', 'Dotations amort. immo. incorporelles', 6, 'debit'),
  (p_company_id, '672', 'Dotations amort. constructions', 6, 'debit'),
  (p_company_id, '673', 'Dotations amort. matériel', 6, 'debit'),
  (p_company_id, '674', 'Dotations amort. transport', 6, 'debit'),
  (p_company_id, '675', 'Dotations amort. autres immo.', 6, 'debit'),
  (p_company_id, '68', 'Dotations aux provisions', 6, 'debit'),
  (p_company_id, '681', 'Dotations prov. réglementées', 6, 'debit'),
  (p_company_id, '682', 'Dotations prov. risques', 6, 'debit'),
  (p_company_id, '683', 'Dotations prov. dépréciation', 6, 'debit'),
  (p_company_id, '69', 'Participation des travailleurs', 6, 'debit'),

  -- === CLASSE 7 : PRODUITS ===
  (p_company_id, '70', 'Ventes', 7, 'credit'),
  (p_company_id, '701', 'Ventes de marchandises', 7, 'credit'),
  (p_company_id, '702', 'Ventes de produits finis', 7, 'credit'),
  (p_company_id, '703', 'Prestations de services', 7, 'credit'),
  (p_company_id, '704', 'Travaux', 7, 'credit'),
  (p_company_id, '705', 'Rabais, remises, ristournes (ventes)', 7, 'debit'),
  (p_company_id, '706', 'Ventes de sous-produits', 7, 'credit'),
  (p_company_id, '707', 'Bonis sur reprises', 7, 'credit'),
  (p_company_id, '71', 'Production stockée', 7, 'credit'),
  (p_company_id, '711', 'Variation stocks produits finis', 7, 'bilateral'),
  (p_company_id, '712', 'Variation stocks en cours', 7, 'bilateral'),
  (p_company_id, '72', 'Production immobilisée', 7, 'credit'),
  (p_company_id, '73', 'Subventions d''exploitation', 7, 'credit'),
  (p_company_id, '74', 'Autres produits', 7, 'credit'),
  (p_company_id, '741', 'Jetons de présence', 7, 'credit'),
  (p_company_id, '742', 'Revenus des immeubles', 7, 'credit'),
  (p_company_id, '748', 'Autres produits divers', 7, 'credit'),
  (p_company_id, '75', 'Produits financiers', 7, 'credit'),
  (p_company_id, '751', 'Intérêts et revenus', 7, 'credit'),
  (p_company_id, '752', 'Escomptes obtenus', 7, 'credit'),
  (p_company_id, '753', 'Gains de change', 7, 'credit'),
  (p_company_id, '754', 'Revenus des titres', 7, 'credit'),
  (p_company_id, '758', 'Autres produits financiers', 7, 'credit'),
  (p_company_id, '76', 'Produits divers', 7, 'credit'),
  (p_company_id, '77', 'Reprises sur amortissements', 7, 'credit'),
  (p_company_id, '78', 'Reprises sur provisions', 7, 'credit'),
  (p_company_id, '79', 'Transferts de charges', 7, 'credit'),

  -- === CLASSE 8 : RÉSULTATS ===
  (p_company_id, '80', 'Résultat d''exploitation', 8, 'bilateral'),
  (p_company_id, '81', 'Résultat financier', 8, 'bilateral'),
  (p_company_id, '82', 'Résultat exceptionnel', 8, 'bilateral'),
  (p_company_id, '83', 'Participation des travailleurs', 8, 'bilateral'),
  (p_company_id, '84', 'Impôt sur les bénéfices', 8, 'debit'),
  (p_company_id, '85', 'Résultat net', 8, 'bilateral');

  -- Mise à jour du champ compte_parent pour les sous-comptes
  UPDATE public.comptes SET compte_parent = '10' WHERE numero LIKE '10_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '11' WHERE numero LIKE '11_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '12' WHERE numero LIKE '12_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '13' WHERE numero LIKE '13_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '15' WHERE numero LIKE '15_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '16' WHERE numero LIKE '16_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '20' WHERE numero LIKE '20_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '21' WHERE numero LIKE '21_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '22' WHERE numero LIKE '22_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '23' WHERE numero LIKE '23_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '24' WHERE numero LIKE '24_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '26' WHERE numero LIKE '26_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '28' WHERE numero LIKE '28_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '30' WHERE numero LIKE '30_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '31' WHERE numero LIKE '31_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '40' WHERE numero LIKE '40_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '41' WHERE numero LIKE '41_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '42' WHERE numero LIKE '42_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '43' WHERE numero LIKE '43_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '44' WHERE numero LIKE '44_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '45' WHERE numero LIKE '45_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '46' WHERE numero LIKE '46_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '47' WHERE numero LIKE '47_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '48' WHERE numero LIKE '48_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '49' WHERE numero LIKE '49_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '51' WHERE numero LIKE '51_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '52' WHERE numero LIKE '52_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '60' WHERE numero LIKE '60_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '61' WHERE numero LIKE '61_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '62' WHERE numero LIKE '62_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '63' WHERE numero LIKE '63_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '64' WHERE numero LIKE '64_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '65' WHERE numero LIKE '65_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '67' WHERE numero LIKE '67_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '68' WHERE numero LIKE '68_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '70' WHERE numero LIKE '70_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '75' WHERE numero LIKE '75_' AND company_id = p_company_id;
  UPDATE public.comptes SET compte_parent = '631' WHERE numero LIKE '631_' AND company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
