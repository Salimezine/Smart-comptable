const KNOWLEDGE_BASE = [
  {
    id: 'tva_taux_general',
    keywords: ['tva', 'taux', 'general', 'standard', 'normale', 'taux tva'],
    tags: ['tva'],
    answerFR: 'Le taux normal de TVA en Tunisie est de **19%** depuis 2024. Il s\'applique à la plupart des biens et services. Taux réduit à **7%** pour certains secteurs (transport, agriculture, santé, éducation, produits alimentaires de base). Taux à **13%** pour les activités hôtelières, restauration, et certaines prestations de services.',
    answerAR: 'نسبة الأداء على القيمة المضافة العادية في تونس هي **19%** منذ 2024. تطبق على معظم السلع والخدمات. نسبة مخفضة **7%** لبعض القطاعات (النقل، الفلاحة، الصحة، التربية، المواد الغذائية الأساسية). نسبة **13%** للنزل والمطاعم وبعض خدمات.',
  },
  {
    id: 'tva_taux_7',
    keywords: ['tva 7', 'taux reduit', '7%', 'tva 7%', 'tva réduit'],
    tags: ['tva'],
    answerFR: 'Le taux réduit de TVA à **7%** en Tunisie s\'applique à: transport de personnes, produits agricoles non transformés, produits pharmaceutiques, livres et fournitures scolaires, logements sociaux, équipements pour personnes handicapées, prestations de santé, éducation et formation professionnelle.',
    answerAR: 'نسبة الادماء المخفضة **7%** في تونس تنطبق على: نقل الأشخاص، المنتجات الفلاحية غير المحولة، الأدوية، الكتب واللوازم المدرسية، المساكن الاجتماعية، تجهيزات المعوقين، خدمات الصحة والتربية والتكوين المهني.',
  },
  {
    id: 'tva_taux_13',
    keywords: ['tva 13', '13%', 'tva 13%', 'hotelier', 'restauration', 'hotel'],
    tags: ['tva', 'hotelier'],
    answerFR: 'Le taux de TVA à **13%** en Tunisie concerne: les services hôteliers et touristiques, la restauration, les agences de voyages, les spectacles et divertissements, les droits d\'auteur et brevets, les opérations de location de locaux meublés à usage touristique.',
    answerAR: 'نسبة الادماء **13%** في تونس تخص: الخدمات النزلية والسياحية، المطاعم، وكالات الأسفار، العروض والترفيه، حقوق التأليف وبراءات الاختراع، كراء المحلات المفروشة للاستعمال السياحي.',
  },
  {
    id: 'tva_declaration_mensuelle',
    keywords: ['declaration tva', 'déclaration tva', 'quand déclarer tva', 'tva mensuelle', 'date tva', 'échéance tva'],
    tags: ['tva', 'declarations', 'echeances'],
    answerFR: 'La déclaration TVA est **mensuelle** (dépôt entre le 1ᵉʳ et le **15 du mois suivant**). Les entreprises au régime simplifié déclarent **trimestriellement** (dans le mois suivant la fin du trimestre). Le paiement se fait auprès de la recette des impôts ou en ligne via **jibaya.tn**.',
    answerAR: 'التصريح بالأداء على القيمة المضافة هو **شهري** (إيداع بين 1 و **15 من الشهر الموالي**). المؤسسات ذات النظام المبسط تتصريح **ثلاثيا** (في الشهر الموالي لنهاية الثلاثي). الأداء يتم لدى قباضة المالية أو عبر الأنترنت عبر **jibaya.tn**.',
  },
  {
    id: 'irpp_bareme',
    keywords: ['irpp', 'bareme irpp', 'impot revenu', 'barème irpp', 'tranche irpp', 'يرپ'],
    tags: ['irpp'],
    answerFR: '**Barème IRPP 2025** (revenu imposable annuel):\n• 0 – 5 000 DT: **0%** (exonéré)\n• 5 001 – 10 000 DT: **15%**\n• 10 001 – 20 000 DT: **25%**\n• 20 001 – 30 000 DT: **30%**\n• 30 001 – 40 000 DT: **33%**\n• 40 001 – 50 000 DT: **36%**\n• 50 001 – 70 000 DT: **38%**\n• Plus de 70 000 DT: **40%**\nContribution sociale: **0.5%** du revenu net.',
    answerAR: '**سلم الإرپ 2025** (الدخل الخاضع السنوي):\n• 0 – 5,000 د: **0%** (معفى)\n• 5,001 – 10,000 د: **15%**\n• 10,001 – 20,000 د: **25%**\n• 20,001 – 30,000 د: **30%**\n• 30,001 – 40,000 د: **33%**\n• 40,001 – 50,000 د: **36%**\n• 50,001 – 70,000 د: **38%**\n• أكثر من 70,000 د: **40%**\nالمساهمة الاجتماعية: **0.5%** من الدخل الصافي.',
  },
  {
    id: 'is_taux',
    keywords: ['is', 'impot societe', 'impôt société', 'taux is', 'taux société', 'شركات'],
    tags: ['is'],
    answerFR: '**Taux IS** (Impôt sur les Sociétés) depuis 2024:\n• **10%**: Artisanat, agriculture, pêche, coopératives, micro-finance (chiffre d\'affaires ≥ 300 DT)\n• **15%**: Éducation privée, formation prof., santé, hébergement universitaire (≥ 400 DT)\n• **20%**: Taux général depuis 01/01/2024 (≥ 500 DT)\n• **35%**: Opérateurs télécom, hydrocarbures, raffinage\n• **40%**: Banques, établissements financiers, assurances\n\nImpôt minimum: **0.2%** du CA (minimum 500 DT).',
    answerAR: '**نسب الضريبة على الشركات** منذ 2024:\n• **10%**: الصناعات التقليدية، الفلاحة، الصيد، التعاونيات، التمويل الصغير\n• **15%**: التعليم الخاص، التكوين المهني، الصحة، الإقامة الجامعية\n• **20%**: النسبة العامة منذ 01/01/2024\n• **35%**: متصرفي الاتصالات، المحروقات، التكرير\n• **40%**: البنوك، المؤسسات المالية، التأمينات\nالضريبة الدنيا: **0.2%** من رقم المعاملات (حد أدنى 500 د).',
  },
  {
    id: 'rs_retenue_source',
    keywords: ['retenue source', 'retenue à la source', 'rs', 'خصم من المنبع', 'خصم'],
    tags: ['rs'],
    answerFR: 'La **retenue à la source** (RS) s\'applique sur 31 catégories de paiements. Principaux taux:\n• Ligne 1: Salaires (barème progressif IRPP)\n• Ligne 2: Honoraires **10%** (15% si non-résident)\n• Ligne 4: Loyers **10%** (15% personnes morales)\n• Ligne 5: Intérêts **10%** (15% p.e.c.)\n• Ligne 7: Marchés publics **5%**\n• Ligne 10: Épargne/obligations **20%**\n• Ligne 17: Achats ≥1 000 DT (IS 20%): **1%**\n• Ligne 22: Avance ventes industrie/grossistes PP forfait: **1%**\nDéclaration et paiement avant le **20 du mois suivant**.',
    answerAR: '**الخصم من المنبع** يطبق على 31 صنف من الدفوعات. أهم النسب:\n• السطر 1: الأجور (سلم تدريجي)\n• السطر 2: الأتعاب **10%** (15% لغير المقيم)\n• السطر 4: الكراء **10%** (15% للأشخاص المعنويين)\n• السطر 5: الفوائد **10%** (15% عند الخ.ل)\n• السطر 7: الصفقات العمومية **5%**\n• السطر 10: الادخار/السندات **20%**\n• السطر 17: مشتريات ≥1,000 د (ضريبة شركات 20%): **1%**\nالتصريح والأداء قبل **20 من الشهر الموالي**.',
  },
  {
    id: 'tfp_formation',
    keywords: ['tfp', 'formation', 'professionnelle', 'معلوم التكوين المهني', 'تكوين مهني'],
    tags: ['tfp'],
    answerFR: '**TFP** (Taxe de Formation Professionnelle):\n• Taux: **1%** de la masse salariale brute\n• Employeurs de **10+ salariés**: 1% + contribution supplémentaire **0.5%** (si pas de programme de formation agréé)\n• Déclaration: mensuelle sur le même bordereau que la déclaration TVA\n• Paiement: avant le **15 du mois suivant**\n• Les entreprises du secteur agricole sont exonérées.',
    answerAR: '**معلوم التكوين المهني**:\n• النسبة: **1%** من الكتلة الاجرية الخام\n• المشغلون بـ **10+ أجير**: 1% + مساهمة إضافية **0.5%** (في صورة عدم وجود برنامج تكوين معتمد)\n• التصريح: شهري على نفس مطبوعة الأداء على القيمة المضافة\n• الأداء: قبل **15 من الشهر الموالي**\n• مؤسسات القطاع الفلاحي معفاة.',
  },
  {
    id: 'foprolos',
    keywords: ['foprolos', 'فوبرولوص', 'logement', 'سكن', 'locaux'],
    tags: ['foprolos'],
    answerFR: '**FOPROLOS** (Fonds de Promotion des Logements):\n• Taux: **1%** sur les salaires bruts\n• S\'applique aux employeurs de **10 salariés et plus**\n• Déclaration mensuelle avant le **15 du mois suivant**\n• Versement auprès de la **CNSS** (Caisse Nationale de Sécurité Sociale)\n• Les entreprises agricoles et les coopératives sont exonérées.',
    answerAR: '**فوبرولوص** (صندوق النهوض بالمساكن):\n• النسبة: **1%** على الأجور الخام\n• يطبق على المشغلين بـ **10 أجير فأكثر**\n• تصريح شهري قبل **15 من الشهر الموالي**\n• الأداء لدى **الصندوق الوطني للضمان الاجتماعي**\n• المؤسسات الفلاحية والتعاونيات معفاة.',
  },
  {
    id: 'tcl',
    keywords: ['tcl', 'tcl', 'collectivites locales', 'جماعات محلية', 'البلدية'],
    tags: ['tcl'],
    answerFR: '**TCL** (Taxe des Collectivités Locales):\n• Taux: **3%** minimum (varie selon les municipalités, jusqu\'à 6%)\n• Assiette: Montant net de TVA due\n• Déclaration: mensuelle avec la TVA\n• Paiement: auprès de la recette municipale ou avec la déclaration TVA\n• Versée aux municipalités pour financer les services locaux.',
    answerAR: '**معاليم الجماعات المحلية**:\n• النسبة: **3%** كحد أدنى (تختلف حسب البلديات، حتى 6%)\n• الوعاء: المبلغ الصافي للأداء على القيمة المضافة المستحق\n• التصريح: شهري مع الادماء\n• الأداء: لدى قباضة البلدية أو مع تصريح الادماء\n• تورد للبلديات لتمويل الخدمات المحلية.',
  },
  {
    id: 'timbre_fiscal',
    keywords: ['timbre', 'timbre fiscal', 'طابع', 'معلوم الطابع'],
    tags: ['timbre'],
    answerFR: '**Timbre fiscal**:\n• Timbre mobile: 0.500 DT par facture (ventes au détail)\n• Timbre de quittance: 0.200 DT par reçu\n• Timbre sur vente à emporter: 0.100 DT/opération\n• Timbre sur les déclarations fiscales: variable selon le document\n• S\'achète auprès des recettes des impôts ou en ligne.\n• Le timbre électronique (e-timbre) est disponible via les plateformes agréées.',
    answerAR: '**معلوم الطابع**:\n• طابع متنقل: 0.500 د لكل فاتورة (بيع بالتجزئة)\n• طابع مخالصة: 0.200 د لكل وصل\n• طابع على بيع الجعة: 0.100 د/عملية\n• طابع على التصاريح الجبائية: يختلف حسب الوثيقة\n• يشترى من قباضات المالية أو عبر الأنترنت.\n• الطابع الإلكتروني متاح عبر المنصات المعتمدة.',
  },
  {
    id: 'penalites_retard',
    keywords: ['penalite', 'pénalité', 'retard', 'amende', 'majoration', 'غرامة', 'تأخير'],
    tags: ['penalites'],
    answerFR: '**Pénalités de retard** en Tunisie:\n• **Majoration 1%** par mois ou fraction de mois de retard sur le principal (plafond 50%)\n• **Amende fiscale** pour défaut de déclaration: 50 DT à 1 000 DT selon la taille\n• **Pénalité 5%** pour insuffisance de déclaration\n• **Intérêts de retard** au taux légal + 5 points\n• Non-respect des obligations de facturation: 200 DT à 5 000 DT par infraction\n• Le paiement spontané avant contrôle réduit les pénalités de 50% (délai de grâce).',
    answerAR: '**الخطايا عن التأخير** في تونس:\n• **زيادة 1%** عن كل شهر أو كسر شهر تأخير على أصل الدين (بحد أقصى 50%)\n• **غرامة جبائية** عن عدم التصريح: 50 د إلى 1,000 د حسب الحجم\n• **خطية 5%** عن عدم كفاية التصريح\n• **فواضل تأخير** بنسبة قانونية + 5 نقاط\n• عدم احترام التزامات الإشعار: 200 د إلى 5,000 د لكل مخالفة\n• الخلاص التلقائي قبل المراقبة يخفض الخطايا بنسبة 50% (مهلة السماح).',
  },
  {
    id: 'echeances',
    keywords: ['echeance', 'date', 'délai', 'calendrier', 'date limite', 'موعد', 'اجل', 'échéance'],
    tags: ['echeances'],
    answerFR: '**Principales échéances fiscales** en Tunisie:\n• **15 du mois**: Déclaration TVA mensuelle + TFP + TCL + paiement\n• **20 du mois**: Déclaration et reversement Retenue à la Source\n• **28 février**: Déclaration annuelle IS (si exercice = année civile)\n• **28 mars**: Déclaration annuelle IRPP\n• **30 juin**: 1er acompte provisionnel IS\n• **30 septembre**: 2ème acompte provisionnel IS\n• **31 décembre**: 3ème acompte provisionnel IS\n• **Vérifiez sur jibaya.tn** pour les dates exactes selon votre régime.',
    answerAR: '**المواعيد الجبائية الرئيسية** في تونس:\n• **15 من الشهر**: تصريح الادماء الشهري + معلوم التكوين المهني + معاليم الجماعات المحلية + الخلاص\n• **20 من الشهر**: تصريح وخلاص الخصم من المنبع\n• **28 فيفري**: التصريح السنوي للشركات (إذا سنة ميلادية)\n• **28 مارس**: التصريح السنوي للإرپ\n• **30 جوان**: الدفعة الأولى الاحتياطية للشركات\n• **30 سبتمبر**: الدفعة الثانية الاحتياطية\n• **31 ديسمبر**: الدفعة الثالثة الاحتياطية\n• **تحقق على jibaya.tn** للمواعيد الدقيقة حسب نظامك.',
  },
  {
    id: 'cnss_cotisations',
    keywords: ['cnss', 'cotisation', 'sécurité sociale', 'sociale', 'patronale', 'ضمان اجتماعي'],
    tags: ['cnss'],
    answerFR: '**Cotisations CNSS** (taux 2025):\n• **Patronale**: Salaire + indemnités: ~**16.57%** (dont 8.12% régime général, 5.63% accidents travail, 2.82% autres)\n• **Salariale**: ~**9.18%** (dont 6.75% régime général, 2.43% autres)\n• **Total**: ~**25.75%** de la masse salariale brute\n• Plafond mensuel: variable selon les catégories\n• Déclaration mensuelle avant le **15 du mois suivant**\n• Paiement en ligne via le portail CNSS.',
    answerAR: '**اشتراكات الضمان الاجتماعي** (نسب 2025):\n• **صاحب العمل**: الأجر + التعويضات: ~**16.57%** (منها 8.12% النظام العام، 5.63% حوادث الشغل، 2.82% أخرى)\n• **الأجير**: ~**9.18%** (منها 6.75% النظام العام، 2.43% أخرى)\n• **المجموع**: ~**25.75%** من الكتلة الاجرية الخام\n• السقف الشهري: يختلف حسب الأصناف\n• التصريح الشهري قبل **15 من الشهر الموالي**\n• الأداء عبر الأنترنت عبر بوابة الضمان الاجتماعي.',
  },
  {
    id: 'taxe_hoteliere',
    keywords: ['taxe hoteliere', 'taxe hôtelière', 'hotel', 'نزل', 'معلوم النزل', 'tourisme'],
    tags: ['hotelier'],
    answerFR: '**Taxe hôtelière**:\n• Taxe de séjour par nuitée: 1 DT à 12 DT selon la catégorie de l\'hôtel\n• 5*: 12 DT, 4*: 8 DT, 3*: 5 DT, 2*: 3 DT, 1*: 2 DT, non classé: 1 DT\n• Résidences touristiques: 3 DT\n• Déclaration mensuelle avant le **15 du mois suivant**\n• Les hôtels doivent collecter la taxe auprès des clients et la reverser à l\'État.',
    answerAR: '**معلوم النزل**:\n• معلوم الإقامة لليلة الواحدة: 1 د إلى 12 د حسب صنف النزل\n• 5 نجوم: 12 د، 4 نجوم: 8 د، 3 نجوم: 5 د، 2 نجمة: 3 د، 1 نجمة: 2 د، غير مصنف: 1 د\n• المساكن السياحية: 3 د\n• التصريح الشهري قبل **15 من الشهر الموالي**\n• على النزل تجميع المعلوم من الحرفاء وخلاصه للدولة.',
  },
  {
    id: 'plus_value_cession',
    keywords: ['plus value', 'plus-value', 'cession', 'actions', 'valeur', 'قيمة زائدة', 'تفويت'],
    tags: ['plusvalue'],
    answerFR: '**Plus-value de cession d\'actions**:\n• Taux d\'imposition: **10%** (résidents) ou **20%** (non-résidents)\n• Assiette: Prix de cession - Prix d\'acquisition (frais inclus)\n• Exonération: détention de plus de 5 ans ou sociétés cotées avec seuil de participation\n• Déclaration: annuelle (formulaire spécifique)\n• Paiement: dans les **30 jours** suivant la cession pour les non-résidents\n• Déductions possibles: frais d\'acquisition, frais de cession, moins-values antérieures.',
    answerAR: '**القيمة الزائدة عن تفويت الأسهم**:\n• نسبة الضريبة: **10%** (مقيمون) أو **20%** (غير مقيمين)\n• الوعاء: ثمن التفويت - ثمن الاكتساب (بما في ذلك المصاريف)\n• الإعفاء: إذا كانت المدة أكثر من 5 سنوات أو الشركات المقيدة بشرط نسبة المشاركة\n• التصريح: سنوي (مطبوع خاص)\n• الأداء: في غضون **30 يوما** من التفويت لغير المقيمين\n• الخصومات الممكنة: مصاريف الاكتساب، مصاريف التفويت، القيم الزائدة السابقة السالبة.',
  },
  {
    id: 'impot_fortune',
    keywords: ['fortune', 'impôt fortune', 'ثروة', 'ضريبة الثروة'],
    tags: ['fortune'],
    answerFR: '**Impôt sur la fortune** en Tunisie:\n• Seuil d\'imposition: **Patrimoine net ≥ 3 000 000 DT**\n• Taux: **0.5%** à **1.5%** selon la tranche\n• Biens imposables: biens immobiliers, comptes bancaires, placements financiers, actions, obligations\n• Biens exonérés: résidence principale (jusqu\'à 500 000 DT), biens professionnels, œuvres d\'art\n• Déclaration: annuelle avant **28 mars**\n• Pour les Tunisiens résidents à l\'étranger: biens situés en Tunisie uniquement.',
    answerAR: '**الضريبة على الثروة** في تونس:\n• عتبة الضريبة: **الثروة الصافية ≥ 3,000,000 د**\n• النسبة: **0.5%** إلى **1.5%** حسب الشريحة\n• الأموال الخاضعة: العقارات، الحسابات البنكية، الاستثمارات المالية، الأسهم، السندات\n• الأموال المعفاة: المسكن الرئيسي (حتى 500,000 د)، الأموال المهنية، الأعمال الفنية\n• التصريح: سنوي قبل **28 مارس**\n• للتونسيين المقيمين بالخارج: الأموال الموجودة بتونس فقط.',
  },
  {
    id: 'declaration_mensuelle',
    keywords: ['declaration mensuelle', 'déclaration mensuelle', 'تصريح شهري', 'bordereau mensuel'],
    tags: ['declarations'],
    answerFR: 'La **déclaration mensuelle** (bordereau mensuel) regroupe:\n• **TVA** collectée et déductible\n• **TFP** (Taxe Formation Professionnelle)\n• **TCL** (Taxe Collectivités Locales)\n• **Retenue à la source** (lignes 1 à 31)\n• **FOPROLOS** (si applicable)\n• **Autres taxes** (19 postes)\n• **Timbre fiscal**\nDépôt: avant le **15 de chaque mois** pour le mois précédent, via jibaya.tn ou papier.',
    answerAR: '**التصريح الشهري** يجمع:\n• الادماء المحصل والخصم\n• معلوم التكوين المهني\n• معاليم الجماعات المحلية\n• الخصم من المنبع (أسطر 1 إلى 31)\n• فوبرولوص (عند الاقتضاء)\n• المعاليم الأخرى (19)\n• معلوم الطابع\nالإيداع: قبل **15 من كل شهر** عن الشهر السابق، عبر jibaya.tn أو ورقيا.',
  },
  {
    id: 'deductions_fiscales',
    keywords: ['deduction', 'déduction', 'déductible', 'خصم', 'مخصوم'],
    tags: ['deductions'],
    answerFR: '**Déductions fiscales** principales:\n• **Frais professionnels**: 20% du revenu (plafonné)\n• **Charges familiales**: 100 DT par enfant à charge (max 6)\n• **Assurance-vie et épargne retraite**: dans la limite de 10% du revenu\n• **Intérêts d\'emprunt logement principal**: déductibles pendant 5 ans\n• **Dons aux œuvres sociales**: 1% du revenu imposable (max 10 000 DT)\n• **Frais de scolarité**: 1000 DT par enfant (établissements privés en Tunisie)\n• **Souscription au capital sociétés nouvelles**: 50% du montant dans la limite de 50% du revenu net.',
    answerAR: '**الخصومات الجبائية** الرئيسية:\n• **مصاريف مهنية**: 20% من الدخل (بسقف)\n• **أعباء عائلية**: 100 د لكل طفل مكفول (أقصى 6)\n• **التأمين على الحياة والتقاعد**: في حدود 10% من الدخل\n• **فوائض قرض المسكن الرئيسي**: قابلة للخصم لمدة 5 سنوات\n• **الهبات للأعمال الاجتماعية**: 1% من الدخل الخاضع (أقصى 10,000 د)\n• **مصاريف التعليم**: 1000 د لكل طفل (مؤسسات خاصة بتونس)\n• **الاكتتاب في رأس مال الشركات الجديدة**: 50% من المبلغ في حدود 50% من الدخل الصافي.',
  },
  {
    id: 'controle_fiscal',
    keywords: ['controle', 'contrôle', 'vérification', 'مراقبة', 'تدقيق', 'رقابة'],
    tags: ['controle'],
    answerFR: '**Contrôle fiscal** en Tunisie:\n• **Délai de prescription**: 4 ans (délai général), 6 ans (en cas d\'infraction grave)\n• **Types**: contrôle sur pièces (au bureau), vérification approfondie (sur place), contrôle inopiné\n• **Droits du contribuable**: droit à l\'information, droit au débat contradictoire, droit de se faire assister\n• **Procédure**: avis de vérification (15 jours avant), notification des redressements, réponse du contribuable (30 jours), décision\n• **Voies de recours**: réclamation gracieuse (6 mois), tribunal administratif, cour d\'appel\n• **Régularisation spontanée**: réduit les pénalités de 50% (délai de grâce).',
    answerAR: '**المراقبة الجبائية** في تونس:\n• **التقادم**: 4 سنوات (عام)، 6 سنوات (في حالة مخالفة خطيرة)\n• **الأنواع**: مراقبة بالمقر، تدقيق معمق (بالمكان)، مراقبة فجئية\n• **حقوق المطالب بالأداء**: الحق في الإعلام، الحق في النقاش المواجهي، الحق في الاستعانة بمختص\n• **الإجراء**: إعلام بالتدقيق (15 يوما قبل)، إشعار بالتصحيحات، رد المطالب (30 يوما)، القرار\n• **طرق الطعن**: التظلم الودي (6 أشهر)، المحكمة الإدارية، محكمة الاستئناف\n• **التسوية التلقائية**: تخفيض الخطايا بنسبة 50% (مهلة السماح).',
  },
  {
    id: 'exoneration_tva',
    keywords: ['exoneration tva', 'exonération', 'tva non soumise', 'tva exonérée', 'إعفاء', 'ادماء'],
    tags: ['tva'],
    answerFR: '**Exonérations de TVA** en Tunisie:\n• **Exportations**: TVA 0% (droit à déduction)\n• **Produits de base**: pain, lait, œufs, huile, sucre, semoule, eau minérale\n• **Services médicaux et hospitaliers**\n• **Éducation et formation professionnelle**\n• **Transport terrestre de personnes**\n• **Opérations bancaires et financières** (intérêts, commissions)\n• **Assurances**\n• **Vente de terrains non viabilisés**\n• **Location d\'habitation nue**\n• **Petits agriculteurs** (régime forfaitaire)',
    answerAR: '**الإعفاءات من الأداء على القيمة المضافة** في تونس:\n• **التصدير**: نسبة 0% (مع حق الخصم)\n• **المواد الأساسية**: الخبز، الحليب، البيض، الزيت، السكر، السميد، الماء المعدني\n• **الخدمات الطبية والاستشفائية**\n• **التربية والتكوين المهني**\n• **النقل البري للأشخاص**\n• **العملية البنكية والمالية** (فوائد، عمولات)\n• **التأمينات**\n• **بيع الأراضي غير المهيأة**\n• **كراء السكنى غير المفروش**\n• **صغار الفلاحين** (النظام الاتفاقي)',
  },
  {
    id: 'regime_forfaitaire',
    keywords: ['forfaitaire', 'régime forfaitaire', 'اتفاقي', 'forfait'],
    tags: ['regime'],
    answerFR: '**Régime forfaitaire**:\n• Pour les **petits commerçants et artisans** dont le CA annuel HT ≤ 100 000 DT (commerces) ou ≤ 50 000 DT (services)\n• Impôt fixé forfaitairement par l\'administration (pas de déclaration comptable)\n• **TVA non facturée** (pas de droit à déduction)\n• **IRPP** basé sur un bénéfice forfaitaire\n• **Pas de tenue de comptabilité** obligatoire, mais un livre de recettes\n• Passage au régime réel obligatoire si dépassement du seuil 2 années consécutives.',
    answerAR: '**النظام الاتفاقي**:\n• للـ **صغار التجار والصناع** الذين رقم معاملاتهم السنوي ≤ 100,000 د (تجارة) أو ≤ 50,000 د (خدمات)\n• الضريبة محددة اتفاقيا من الإدارة (لا تصريح محاسبي)\n• **لا أداء على القيمة المضافة** (لا حق في الخصم)\n• **الإرپ** مبني على ربح اتفاقي\n• **لا إمساك محاسبة** إجباري، ولكن سجل إيرادات\n• الانتقال للنظام الحقيقي إجباري إذا تجاوز العتبة سنتين متتاليتين.',
  },
  {
    id: 'regime_reel',
    keywords: ['réel', 'regime reel', 'régime réel', 'حقيقي', 'نظام حقيقي'],
    tags: ['regime'],
    answerFR: '**Régime réel**:\n• Pour les entreprises avec CA HT > 100 000 DT (commerce) ou > 50 000 DT (services)\n• **Obligations comptables**: bilan, compte de résultats, états financiers annuels\n• **TVA** collectée sur ventes - TVA déductible sur achats = TVA due\n• **Déclaration mensuelle** obligatoire\n• **Amortissements** et **provisions** déductibles\n• **Tenue de 4 journaux**: journal général, journal d\'achats, journal de ventes, journal de caisse\n• **Bilan annuel** à déposer avant le **30 avril** (personnes physiques) ou le **30 juin** (personnes morales).',
    answerAR: '**النظام الحقيقي**:\n• للمؤسسات التي رقم معاملاتها > 100,000 د (تجارة) أو > 50,000 د (خدمات)\n• **الالتزامات المحاسبية**: ميزانية، حساب نتائج، قوائم مالية سنوية\n• **الأداء على القيمة المضافة**: محصل - خصم = مستحق\n• **تصريح شهري** إجباري\n• **الاهتلاكات** و **المؤونات** قابلة للخصم\n• **إمساك 4 دفاتر**: يومية عامة، يومية مشتريات، يومية مبيعات، يومية صندوق\n• **الميزانية السنوية** تودع قبل **30 أفريل** (أشخاص طبيعيون) أو **30 جوان** (أشخاص معنويون).',
  },
  {
    id: 'amortissement',
    keywords: ['amortissement', 'amortir', 'اهتلاك', 'إهلاك'],
    tags: ['comptabilite'],
    answerFR: '**Amortissements** en Tunisie:\n• **Linéaire**: taux fixe sur la durée de vie (construction: 20-30 ans 3.3-5%, matériel: 5-10 ans 10-20%, véhicules: 5 ans 20%, matériel informatique: 3 ans 33.3%)\n• **Dégressif**: taux majoré pour les biens neufs (coefficient 1.5 ou 2 selon durée)\n• **Déductibilité**: l\'amortissement est déductible fiscalement s\'il est comptabilisé\n• **Reprise**: en cas de cession, l\'amortissement excédentaire est réintégré\n• Les amortissements sont obligatoires pour les biens dont la valeur > 200 DT et durée > 1 an.',
    answerAR: '**الاهتلاكات** في تونس:\n• **الخطي**: نسبة ثابتة على عمر الأصل (بناء: 20-30 سنة 3.3-5%، معدات: 5-10 سنوات 10-20%، سيارات: 5 سنوات 20%، معدات إعلامية: 3 سنوات 33.3%)\n• **التناقصي**: نسبة مضاعفة للأصول الجديدة (معامل 1.5 أو 2 حسب المدة)\n• **قابلية الخصم**: الاهتلاك قابل للخصم جبائيا إذا تم قيده محاسبيا\n• **الاسترجاع**: في حالة التفويت، يعاد إدراج الاهتلاك الزائد\n• الاهتلاكات إجبارية للأصول التي قيمتها > 200 د ومدة > سنة.',
  },
  {
    id: 'frais_etablissement',
    keywords: ['frais etablissement', 'frais constitution', 'fraie création', 'مصاريف تأسيس'],
    tags: ['comptabilite'],
    answerFR: '**Frais d\'établissement**:\n• Frais de constitution, augmentation de capital, frais de publicité légale\n• **Amortissables** sur 5 ans maximum (linéaire)\n• Plafond de déduction: **10 000 DT** pour les frais de constitution\n• Les frais d\'émission d\'emprunt sont amortissables sur la durée de l\'emprunt\n• Les frais d\'augmentation de capital sont amortissables sur 5 ans.',
    answerAR: '**مصاريف التأسيس**:\n• مصاريف التأسيس، زيادة رأس المال، مصاريف النشر القانوني\n• **قابلة للاهتلاك** على 5 سنوات كأقصى حد (خطي)\n• حد الخصم: **10,000 د** لمصاريف التأسيس\n• مصاريف إصدار القرض قابلة للاهتلاك على مدة القرض\n• مصاريف زيادة رأس المال قابلة للاهتلاك على 5 سنوات.',
  },
  {
    id: 'tva_deductible',
    keywords: ['tva deductible', 'tva déductible', 'tva recuperable', 'récupérer tva', 'خصم الادماء'],
    tags: ['tva'],
    answerFR: '**TVA déductible**:\n• Vous récupérez la TVA payée sur vos achats et frais professionnels\n• **Conditions**: facture conforme (MF, date, montant, TVA détaillée), bien/service utilisé pour l\'activité imposable\n• **Délai**: déduction dans le mois de la réception de la facture (jusqu\'à 3 mois de décalage possible)\n• **Exclusions**: véhicules de tourisme (sauf concessionnaires), carburant (sauf transporteurs), frais de réception (plafonné 50%), logement de fonction\n• **Régularisation**: si le bien est cédé ou utilisé pour du non-imposable, la TVA initialement déduite est reversée.',
    answerAR: '**الأداء على القيمة المضافة القابل للخصم**:\n• تسترجع الادماء المدفوع على مشترياتك ومصاريفك المهنية\n• **الشروط**: فاتورة مطابقة (معرف جبائي، تاريخ، مبلغ، تفصيل الادماء)، المصلحة/الخدمة مستعملة للنشاط الخاضع\n• **الأجل**: الخصم في شهر استلام الفاتورة (إلى 3 أشهر تأخير ممكن)\n• **الاستثناءات**: سيارات السياحة (عدا الوكلاء)، المحروقات (عدا الناقلين)، مصاريف الاستقبال (بسقف 50%)، مسكن الوظيفة\n• **التسوية**: إذا تم التفويت في المصلحة أو استعمالها لغير الخاضع، يسترجع الادماء المخصوم أصلا.',
  },
  {
    id: 'jibaya_en_ligne',
    keywords: ['jibaya', 'jibaya.tn', 'تصريح عبر الأنترنت', 'جباية', 'declaration en ligne'],
    tags: ['declarations'],
    answerFR: '**Déclaration en ligne** via jibaya.tn:\n• Plateforme officielle de l\'administration fiscale tunisienne\n• Services: déclaration TVA, RS, IRPP, IS, consultation du solde, paiement en ligne\n• Accès avec le **matricule fiscal** et mot de passe\n• **Paiement**: par carte bancaire (CIB, e-Dinar) ou virement\n• **Calendrier**: disponible sur la plateforme avec rappels\n• **Assistance**: centre d\'appel 1818 ou bureau d\'assistance de votre recette',
    answerAR: '**التصريح عبر الأنترنت** عبر jibaya.tn:\n• المنصة الرسمية للإدارة الجبائية التونسية\n• الخدمات: تصريح الادماء، الخصم من المنبع، الإرپ، ضريبة الشركات، استشارة الرصيد، الخلاص عبر الأنترنت\n• الدخول بـ **المعرف الجبائي** وكلمة السر\n• **الخلاص**: ببطاقة بنكية (CIB, e-Dinar) أو تحويل\n• **الرزنامة**: متاحة على المنصة مع تذكير\n• **المساعدة**: مركز النداء 1818 أو مكتب المساعدة بقباضتك.',
  },
  {
    id: 'interets_retard',
    keywords: ['interet retard', 'intérêt retard', 'فواضل', 'فائدة تأخير'],
    tags: ['penalites'],
    answerFR: '**Intérêts de retard**:\n• Taux: **taux légal + 5 points** par an\n• Taux légal 2025: **6.75%** (donc total ~11.75% par an)\n• Calcul: par mois ou fraction de mois de retard\n• S\'appliquent sur le principal de l\'impôt dû\n• Cumulables avec les majorations et amendes\n• Les intérêts courent à partir de la date d\'exigibilité jusqu\'au paiement complet.',
    answerAR: '**فواضل التأخير**:\n• النسبة: **النسبة القانونية + 5 نقاط** في السنة\n• النسبة القانونية 2025: **6.75%** (إذا المجموع ~11.75% في السنة)\n• الحساب: بالشهر أو كسر الشهر تأخير\n• تطبق على أصل الضريبة المستحقة\n• تراكم مع الزيادات والغرامات\n• الفواضل تحتسب من تاريخ الاستحقاق حتى الخلاص الكامل.',
  },
  {
    id: 'commissaire_comptes',
    keywords: ['commissaire comptes', 'auditeur', 'مراقب حسابات', 'تدقيق'],
    tags: ['comptabilite'],
    answerFR: '**Commissaire aux Comptes** (CAC):\n• **Obligatoire** pour: SA, SARL avec CA > 3 000 000 DT, sociétés faisant appel public à l\'épargne, banques, assurances, établissements financiers\n• **Mission**: certification des comptes, vérification de la conformité, révélation des faits délictueux\n• **Durée du mandat**: 3 ans renouvelable (SARL), 6 ans pour les sociétés cotées\n• **Rapport**: à déposer avec les états financiers annuels\n• **Indépendance**: le CAC ne peut être ni actionnaire, ni salarié, ni lié à la société.',
    answerAR: '**مراقب الحسابات**:\n• **إجباري** لـ: شركات مساهمة، ذات مسؤولية محدودة برقم معاملات > 3,000,000 د، الشركات المقيدة بالبورصة، البنوك، التأمينات، المؤسسات المالية\n• **المهمة**: المصادقة على القوائم المالية، التحقق من المطابقة، كشف الأفعال المخالفة\n• **مدة العهدة**: 3 سنوات قابلة للتجديد، 6 سنوات للشركات المقيدة\n• **التقرير**: يودع مع القوائم المالية السنوية\n• **الاستقلالية**: لا يمكن أن يكون مساهما ولا أجيرا ولا مرتبطا بالشركة.',
  },
  {
    id: 'acomptes_is',
    keywords: ['acompte is', 'acompte provisionnel', 'acomptes', 'دفعة احتياطية', 'أقساط'],
    tags: ['is', 'echeances'],
    answerFR: '**Acomptes provisionnels IS**:\n• **3 acomptes** par an (30 juin, 30 septembre, 31 décembre)\n• Chaque acompte = **30%** de l\'IS de l\'exercice précédent\n• Total des 3 acomptes = **90%** de l\'IS dû\n• Le solde (10%) est payé avec la déclaration annuelle (28 février)\n• **Exception**: les entreprises nouvelles paient des acomptes calculés sur l\'IS estimé\n• Défaut de paiement: majoration 1% par mois.',
    answerAR: '**الدفعات الاحتياطية للضريبة على الشركات**:\n• **3 دفعات** في السنة (30 جوان، 30 سبتمبر، 31 ديسمبر)\n• كل دفعة = **30%** من الضريبة على الشركات للسنة السابقة\n• مجموع الدفعات = **90%** من الضريبة المستحقة\n• الرصيد (10%) يخلّص مع التصريح السنوي (28 فيفري)\n• **استثناء**: المؤسسات الجديدة تخلّص دفعات على أساس الضريبة المقدرة\n• عدم الخلاص: زيادة 1% كل شهر.',
  },
  {
    id: 'taxe_vehicule',
    keywords: ['taxe vehicule', 'vignette', 'voiture', 'سيارة', 'معلوم سيارة'],
    tags: ['taxes'],
    answerFR: '**Taxe sur les véhicules** (vignette):\n• **Taxe annuelle** payable avant le 31 janvier\n• Calculée selon: puissance fiscale (CV), type de carburant, âge du véhicule\n• Véhicules essence: 50 DT à 500 DT\n• Véhicules diesel: 100 DT à 1 000 DT\n• Véhicules hybrides/électriques: 20 DT à 200 DT (réduction 50%)\n• Paiement: en ligne (jibaya.tn) ou auprès de la recette des impôts\n• Les véhicules de société (>5 ans): réduction de 20% sur la taxe.',
    answerAR: '**معلوم السيارات** (الشباك):\n• **معلوم سنوي** يخلّص قبل 31 جانفي\n• يحسب حسب: القوة الجبائية (CV)، نوع الوقود، عمر السيارة\n• سيارات بنزين: 50 د إلى 500 د\n• سيارات مازوت: 100 د إلى 1,000 د\n• سيارات هجينة/كهربائية: 20 د إلى 200 د (تخفيض 50%)\n• الخلاص: عبر الأنترنت (jibaya.tn) أو لدى قباضة المالية\n• سيارات المؤسسة (أكثر من 5 سنوات): تخفيض 20% على المعلوم.',
  },
  {
    id: 'ecommerce_tunisie',
    keywords: ['ecommerce', 'e-commerce', 'التجارة الإلكترونية', 'livreur', 'موقع'],
    tags: ['ecommerce'],
    answerFR: '**Fiscalité du e-commerce** en Tunisie:\n• Les sites e-commerce et livreurs doivent s\'immatriculer et avoir un **MF**\n• **TVA** normale (19%) sur les ventes en ligne\n• **RS ligne 31**: 3% sur les paiements aux livreurs sans MF\n• Obligation de **facturation électronique** (loi de finances 2024)\n• Les plateformes étrangères (Google Play, Apple Store, Netflix) sont soumises à la **taxe GAFA** (5% sur le CA)\n• **Déclaration mensuelle** obligatoire pour les revenus des plateformes.\n• Seuil de tolérance pour les micro-entreprises e-commerce: CA < 20 000 DT/an.',
    answerAR: '**جباية التجارة الإلكترونية** في تونس:\n• مواقع التجارة الإلكترونية والموزعين يجب أن يكون لهم **معرف جبائي**\n• **أداء على القيمة المضافة** عادي (19%) على البيع عبر الأنترنت\n• **الخصم من المنبع سطر 31**: 3% على الدفوعات للموزعين دون معرف جبائي\n• إلزامية **الإشعار الإلكتروني** (قانون المالية 2024)\n• المنصات الأجنبية (Google Play, Apple Store, Netflix) تخضع لـ **ضريبة GAFA** (5% على رقم المعاملات)\n• **تصريح شهري** إجباري لإيرادات المنصات.',
  },
  {
    id: 'rs_ligne2',
    keywords: ['honoraire', 'honoraires', 'rs 2', 'اتعاب', 'ligne 2', 'rs ligne 2'],
    tags: ['rs'],
    answerFR: '**Ligne 2 - Honoraires**:\n• Taux RS: **10%** pour les résidents (15% pour les non-résidents)\n• S\'applique aux: honoraires d\'avocats, experts-comptables, architectes, ingénieurs, conseils, notaires, huissiers\n• Base de calcul: montant brut HT\n• Exonération: si le prestataire est soumis à l\'IRPP/IS et a un MF valide\n• Déclaration: mensuelle avant le **20 du mois suivant**\n• Le client doit opérer la retenue et la reverser à l\'administration.',
    answerAR: '**السطر 2 - الأتعاب**:\n• نسبة الخصم: **10%** للمقيمين (15% لغير المقيمين)\n• يطبق على: أتعاب المحامين، الخبراء المحاسبين، المهندسين المعماريين، المهندسين، المستشارين، العدول المنفذين، المحضرين\n• أساس الحساب: المبلغ الخام خارج الأداء\n• الإعفاء: إذا كان المؤدي خاضعا للإرپ/ضريبة الشركات وله معرف جبائي صحيح\n• التصريح: شهري قبل **20 من الشهر الموالي**.',
  },
  {
    id: 'rs_ligne4',
    keywords: ['loyer', 'rs 4', 'كراء', 'ligne 4', 'rs ligne 4'],
    tags: ['rs'],
    answerFR: '**Ligne 4 - Loyers**:\n• Taux RS: **10%** (personnes physiques), **15%** (personnes morales)\n• S\'applique aux loyers professionnels (bureaux, locaux commerciaux, entrepôts, terrains)\n• **Exonération**: loyers d\'habitation (usage strictement personnel)\n• Base de calcul: montant brut annuel du loyer\n• Le locataire doit opérer la retenue et la reverser\n• Si le bailleur est non-résident: **20%** sauf convention fiscale.',
    answerAR: '**السطر 4 - الكراء**:\n• نسبة الخصم: **10%** (أشخاص طبيعيون)، **15%** (أشخاص معنويون)\n• يطبق على الكراء المهني (مكاتب، محلات تجارية، مستودعات، أراضي)\n• **الإعفاء**: كراء السكنى (استعمال شخصي فقط)\n• أساس الحساب: المبلغ الخام السنوي للكراء\n• المكتري يجب أن يقوم بالخصم وخلاصه.',
  },
  {
    id: 'rs_ligne7',
    keywords: ['marche public', 'rs 7', 'صفقة عمومية', 'marchés publics', 'ligne 7'],
    tags: ['rs'],
    answerFR: '**Ligne 7 - Marchés publics**:\n• Taux RS: **5%**\n• S\'applique aux paiements effectués par l\'État, collectivités locales, entreprises publiques au titre de marchés publics\n• Base de calcul: montant total HT du marché\n• **Exonération**: si le montant annuel des marchés < 1 000 DT\n• La retenue est opérée par le maître d\'ouvrage (administration)\n• Déclaration mensuelle avant le **20 du mois suivant**.',
    answerAR: '**السطر 7 - الصفقات العمومية**:\n• نسبة الخصم: **5%**\n• يطبق على الدفوعات المنجزة من الدولة والجماعات المحلية والمؤسسات العمومية بمناسبة الصفقات العمومية\n• أساس الحساب: المبلغ الإجمالي خارج الأداء للصفقة\n• **الإعفاء**: إذا كان المبلغ السنوي للصفقات < 1,000 د\n• الخصم يقوم به صاحب المشروع (الإدارة).',
  },
  {
    id: 'rs_ligne17',
    keywords: ['achat 1000', 'rs 17', 'مشتريات', 'شراء', 'ligne 17'],
    tags: ['rs'],
    answerFR: '**Ligne 17 - Achats ≥ 1 000 DT**:\n• Taux RS: **1%**\n• S\'applique aux achats de biens ≥ **1 000 DT TTC** par des assujettis à l\'IS au taux de 20%\n• Seuil: par fournisseur et par mois cumulé\n• Base: montant TTC de l\'achat\n• Si le seuil de 1 000 DT/mois n\'est pas atteint: pas de retenue\n• Le client doit opérer la retenue et la reverser avant le **20 du mois suivant**.',
    answerAR: '**السطر 17 - المشتريات ≥ 1,000 د**:\n• نسبة الخصم: **1%**\n• يطبق على مشتريات البضائع التي قيمتها ≥ **1,000 د شامل الأداء** من قبل الخاضعين لضريبة الشركات بنسبة 20%\n• العتبة: لكل مورد ولكل شهر مجمع\n• الأساس: المبلغ شامل الأداء\n• إذا لم يبلغ العتبة 1,000 د/شهر: لا خصم.',
  },
  {
    id: 'declaration_annuelle_is',
    keywords: ['declaration annuelle is', 'is annuel', 'تصريح سنوي شركات', 'bilan is'],
    tags: ['is', 'declarations'],
    answerFR: '**Déclaration annuelle IS** (formulaire annuel IS):\n• **Date limite**: **28 février** (si exercice = année civile)\n• **Contenu**: identification, données taxation, bénéfices déduits, exonérations, produits non imposables, calcul IS, acomptes, liquidation, contributions\n• **Pièces jointes**: Bilan, CR, notes aux états financiers, rapport CAC (si obligatoire)\n• **Paiement**: solde IS (10%) + contributions\n• **Dépôt**: en ligne (jibaya.tn) ou en papier (recette des impôts)\n• **Amende** pour retard: 50 DT à 500 DT selon le CA.',
    answerAR: '**التصريح السنوي للشركات**:\n• **الموعد النهائي**: **28 فيفري** (إذا سنة ميلادية)\n• **المحتوى**: تعريف، معطيات تضريب، أرباح مخصومة، إعفاءات، مداخيل غير خاضعة، حساب الضريبة، دفعات، تسوية، مساهمات\n• **الملفات المرفقة**: ميزانية، حساب نتائج، قوائم مالية، تقرير مراقب الحسابات (إن وجب)\n• **الخلاص**: رصيد الضريبة (10%) + المساهمات\n• **الإيداع**: عبر الأنترنت (jibaya.tn) أو ورقيا (قباضة المالية).',
  },
  {
    id: 'reduction_fiscale_investissement',
    keywords: ['reduction fiscale', 'investissement', 'تخفيض جبائي', 'استثمار'],
    tags: ['deductions'],
    answerFR: '**Réductions fiscales pour investissement**:\n• **Souscription au capital**: 50% du montant investi dans une société nouvelle (max 50% du revenu net)\n• **Investissement en actions**: 30% du montant investi dans des sociétés cotées (plafond 10 000 DT)\n• **PME innovantes**: 100% des frais de R&D déductibles\n• **Agriculture**: réduction de 50% des bénéfices réinvestis\n• **Équipements verts**: 50% de déduction sur les investissements dans les énergies renouvelables\n• **Développement régional**: exonération totale d\'IS pour 5 ans (zones de développement régional).',
    answerAR: '**التخفيضات الجبائية للاستثمار**:\n• **الاكتتاب في رأس المال**: 50% من المبلغ المستثمر في شركة جديدة (بحد أقصى 50% من الدخل الصافي)\n• **الاستثمار في الأسهم**: 30% من المبلغ المستثمر في شركات مقيدة (بسقف 10,000 د)\n• **المؤسسات الصغرى المبتكرة**: 100% من مصاريف البحث والتطوير قابلة للخصم\n• **الفلاحة**: تخفيض بنسبة 50% من الأرباح المعاد استثمارها\n• **التجهيزات الخضراء**: تخفيض 50% على الاستثمارات في الطاقات المتجددة\n• **التنمية الجهوية**: إعفاء كلي من ضريبة الشركات لمدة 5 سنوات.',
  },
  {
    id: 'location_vehicule',
    keywords: ['location vehicule', 'voiture location', 'كراء سيارة', 'rs 28'],
    tags: ['taxes'],
    answerFR: '**Taxe sur location de voitures**:\n• **Prélèvement**: 2 DT/jour sur la location de voitures\n• Appliqué par les agences de location\n• Déclaration mensuelle avant le **15 du mois suivant**\n• Les locations de voitures électriques sont exonérées\n• Les locations de plus de 30 jours: réduction de 50%',
    answerAR: '**معلوم كراء السيارات**:\n• **الاقتطاع**: 2 د/يوم على كراء السيارات\n• تخرص وكالات الكراء\n• التصريح الشهري قبل **15 من الشهر الموالي**\n• كراء السيارات الكهربائية معفى\n• الكراء لأكثر من 30 يوما: تخفيض 50%.',
  },
  {
    id: 'fodec',
    keywords: ['fodec', 'fonds competitivite', 'صندوق التنافسية'],
    tags: ['taxes'],
    answerFR: '**FODEC** (Fonds de Développement de la Compétitivité):\n• **1%** sur le CA HT pour l\'industrie et les services\n• **2%** pour l\'agriculture et pêche (poissons)\n• **2.5%** pour les légumineuses et soja\n• **2%** pour les légumes et fruits\n• **1%** pour les hôtels et restaurants (tourisme)\n• **7%** sur le CA HT des produits polluants (fonds lutte pollution)\n• Déclaration mensuelle avec la TVA.',
    answerAR: '**صندوق التنافسية**:\n• **1%** على رقم المعاملات خارج الأداء للصناعة والخدمات\n• **2%** للفلاحة والصيد (سمك)\n• **2.5%** للبقوليات والصوجا\n• **2%** للخضر والغلال\n• **1%** للنزل والمطاعم (سياحة)\n• **7%** على رقم المعاملات خارج الأداء للمنتجات الملوثة (صندوق مقاومة التلوث)\n• التصريح شهري مع الادماء.',
  },
  {
    id: 'taxe_sucre',
    keywords: ['taxe sucre', 'otco', 'سكر', 'otco'],
    tags: ['taxes'],
    answerFR: '**Taxe sucre (OTCO)**:\n• **0.100 DT/kg** de sucre\n• Perçue sur la production et l\'importation du sucre\n• Versée à l\'Office du Commerce de la Tunisie (OTCO)\n• Déclaration mensuelle avant le **15 du mois suivant**.\n• Les petits conditionneurs (capacité < 1 tonne/mois) sont exonérés.',
    answerAR: '**معلوم السكر**:\n• **0.100 د/كغ** من السكر\n• تجبى على إنتاج واستيراد السكر\n• تورد لديوان التجارة التونسية\n• التصريح شهري قبل **15 من الشهر الموالي**.',
  },
  {
    id: 'rs_licence',
    keywords: ['licence', 'taxe licence', 'vin', 'biere', 'خمر', 'جعة'],
    tags: ['taxes'],
    answerFR: '**Taxe sur les boissons alcoolisées**:\n• **Vente vins et bières**: 5% d\'avance (RS ligne 23)\n• Taxe de licence: variable selon le type d\'établissement\n• Les bars, restaurants et débits de boissons doivent avoir une **licence**\n• Renouvellement annuel de la licence\n• La taxe est déclarée mensuellement.',
    answerAR: '**معلوم المشروبات الكحولية**:\n• **بيع الخمر والجعة**: 5% تقديم (خصم من المنبع سطر 23)\n• معلوم الإجازة: يختلف حسب نوع المؤسسة\n• المقاهي والمطاعم ومحلات بيع المشروبات يجب أن يكون لهم **إجازة**\n• تجديد سنوي للإجازة\n• المعلوم يصرح به شهريا.',
  },
];

let remoteKnowledge = [];
let scrapedKnowledge = [];

export async function initKnowledgeBase() {
  try {
    const { loadKnowledgeBase, onKnowledgeChange } = await import('./taxKnowledgeService');
    const remote = await loadKnowledgeBase();
    if (remote) remoteKnowledge = remote;
    onKnowledgeChange(data => { remoteKnowledge = data || []; });
  } catch (_) {}

  try {
    const { loadScrapedMarkdown, loadScrapedIndex } = await import('./scrapeService');
    const index = await loadScrapedIndex();
    if (index) {
      const sources = index.sources || Object.keys(index);
      for (const src of sources) {
        if (typeof src === 'string') {
          const md = await loadScrapedMarkdown(src);
          if (md) {
            scrapedKnowledge.push({
              id: 'scraped_' + src,
              keywords: [src, src.replace(/_/g, ' '), 'fiscal', 'tunisie', 'impots'],
              tags: ['scraped', 'impots', src],
              answerFR: md.slice(0, 2000),
              answerAR: md.slice(0, 2000),
              source: src,
            });
          }
        }
      }
    }
  } catch (_) {}
}

function mergeKnowledge() {
  let all = KNOWLEDGE_BASE;
  if (remoteKnowledge.length > 0) all = [...all, ...remoteKnowledge];
  if (scrapedKnowledge.length > 0) all = [...all, ...scrapedKnowledge];
  return all;
}

export function getScrapedSources() {
  return scrapedKnowledge.map(k => ({
    id: k.id,
    source: k.source,
    preview: k.answerFR.slice(0, 120),
  }));
}

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreQuery(tokens, keywords) {
  const kwTokens = keywords.flatMap(k => tokenize(k));
  let score = 0;
  for (const qt of tokens) {
    for (const kt of kwTokens) {
      if (qt === kt) {
        score += 10;
      } else if (qt.length > 2 && kt.length > 2 && (kt.includes(qt) || qt.includes(kt))) {
        score += 5;
      } else if (qt.length > 3 && kt.length > 3) {
        const dist = levenshtein(qt, kt);
        if (dist <= 1) score += 8;
        else if (dist <= 2) score += 4;
      }
    }
  }
  const queryStr = tokens.join(' ');
  const kwStr = keywords.join(' ');
  const bigramScore = bigramSimilarity(queryStr, kwStr);
  score += bigramScore * 3;
  return score;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function bigramSimilarity(a, b) {
  const bigrams = (s) => { const r = new Set(); for (let i = 0; i < s.length - 1; i++) r.add(s.slice(i, i + 2)); return r; };
  const ba = bigrams(a), bb = bigrams(b);
  let common = 0;
  for (const bf of ba) if (bb.has(bf)) common++;
  return (2 * common) / (ba.size + bb.size || 1);
}

function detectLangue(query) {
  return /[\u0600-\u06FF]/.test(query) ? 'ar' : 'fr';
}

export function smartAnswer(query) {
  const q = query.trim().toLowerCase();
  const lang = detectLangue(query);
  const tokens = tokenize(q);

  const kb = mergeKnowledge();
  const scored = kb.map(k => ({
    entry: k,
    score: scoreQuery(tokens, k.keywords) + (k.tags.some(t => q.includes(t)) ? 15 : 0),
  }));

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (best && best.score >= 10) {
    return {
      found: true,
      message: lang === 'ar' ? best.entry.answerAR : best.entry.answerFR,
      id: best.entry.id,
      score: best.score,
    };
  }

  return { found: false, message: '' };
}

export function getSuggestedQueries() {
  return [
    'Analyse mon audit comptable',
    'Quels sont les points critiques de ma comptabilité ?',
    'Donne-moi 3 actions pour améliorer ma conformité',
    'Taux TVA Tunisie',
    'Barème IRPP 2025',
    'Taux IS 2025',
    'Déclaration mensuelle',
    'Retenue à la source',
    'Date limite déclaration',
    'TFP et FOPROLOS',
    'TCL',
    'Pénalités retard',
    'CNSS cotisations',
    'Déductions fiscales',
    'Exonération TVA',
    'Contrôle fiscal',
    'Taxe hôtelière',
    'Plus-value cession',
  ];
}
