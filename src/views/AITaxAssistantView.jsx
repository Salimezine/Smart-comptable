import React, { useState, useEffect, useRef } from 'react';
import { Trash2, CheckCircle, ExternalLink, Download, ArrowLeft, FileText, Settings, Sparkles, Save, Book, AlertTriangle } from 'lucide-react';
import { generateResponse } from '../utils/taxAssistant';
import { generateFilledPdf, downloadPdf } from '../utils/pdfFiller';
import { askAI, hasApiKey, setApiKey, clearApiKey, getApiKey, resetModel, getSuggestedQueries } from '../utils/auditAI';
import { getAllTemplates, matchTemplate, applyCalculations, validateDeclaration, addUserTemplate, removeUserTemplate } from '../utils/formulaEngine';
import { loadTemplates, saveTemplate, onTemplateChange, deleteTemplate as deleteRemoteTemplate } from '../utils/templateService';
import { isSupabaseEnabled } from '../utils/supabaseClient';
import { getCachedKnowledge } from '../utils/taxKnowledgeService';
import { autoFillFromJournal } from '../utils/autoFillService';

const FORMULAIRES_CARDS = [
  { id: 'mensuelle', labelFR: 'Déclaration mensuelle 2026', labelAR: 'التصريح الشهري 2026', icon: '📄' },
  { id: 'is', labelFR: 'Déclaration annuelle IS 2026', labelAR: 'التصريح السنوي IS 2026', icon: '🏢' },
  { id: 'irpp', labelFR: 'Déclaration annuelle IRPP 2025', labelAR: 'التصريح السنوي IRPP 2025', icon: '👤' },
  { id: 'employeur', labelFR: 'Déclaration employeur 2025', labelAR: 'تصريح المؤجر 2025', icon: '👔' },
  { id: 'plusvalue', labelFR: 'Plus-value cession actions 2025', labelAR: 'القيمة الزائدة 2025', icon: '📈' },
  { id: 'fortune', labelFR: 'Impôt sur la fortune 2026', labelAR: 'الضريبة على الثروة 2026', icon: '💰' },
];

const PROCESS_STEPS = [
  { id: 'accueil', label: 'Formulaire', icon: '📋' },
  { id: 'contexte', label: 'Client', icon: '👤' },
  { id: 'remplissage', label: 'Saisie', icon: '📝' },
  { id: 'recap', label: 'Récapitulatif', icon: '📋' },
];

const CONTEXT_FIELDS = [
  { key: 'matriculeFiscal', labelFR: 'Matricule Fiscal', labelAR: 'المعرف الجبائي', placeholder: '1234567A000 ou 1234567XAM000', validate: v => /^\d{6,7}[A-Z]{1,3}\d{3}$/.test(v.replace(/\//g, '').toUpperCase()), errorFR: 'Format: 7 chiffres + 1-3 lettres + 3 chiffres (ex: 1234567A000 ou 1234567XAM000)', errorAR: 'صيغة: 7 أرقام + 1-3 أحرف + 3 أرقام (مثال: 1234567A000 أو 1234567XAM000)' },
  { key: 'nom', labelFR: 'Raison sociale', labelAR: 'الاسم', placeholder: 'Nom de l\'entreprise' },
  { key: 'adresse', labelFR: 'Adresse', labelAR: 'العنوان', placeholder: 'Adresse du siège social' },
  { key: 'codePostal', labelFR: 'Code postal', labelAR: 'الترقيم البريدي', placeholder: 'Ex: 1000' },
  { key: 'personneType', labelFR: 'Type', labelAR: 'النوع', options: [{ value: 'PP', labelFR: 'Personne physique', labelAR: 'شخص طبيعي' }, { value: 'PM', labelFR: 'Personne morale', labelAR: 'شخص معنوي' }] },
  { key: 'regime', labelFR: 'Régime', labelAR: 'النظام', options: [{ value: 'Réel', labelFR: 'Réel', labelAR: 'حقيقي' }, { value: 'Simplifié', labelFR: 'Simplifié', labelAR: 'مبسط' }, { value: 'Forfaitaire', labelFR: 'Forfaitaire', labelAR: 'اتفاقي' }] },
  { key: 'secteur', labelFR: 'Secteur d\'activité', labelAR: 'قطاع النشاط', placeholder: 'Ex: Commerce, Services, Industrie' },
  { key: 'periode', labelFR: 'Période', labelAR: 'الفترة', placeholder: 'Ex: 2026-06 ou exercice 2026' },
];

function FieldInput({ field, value, onChange, error }) {
  const hasError = !!error;
  if (field.options) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          {field.options.map(opt => (
            <button key={opt.value} onClick={() => onChange(field.key, opt.value)}
              className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${value === opt.value ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600'}`}>
              {opt.labelFR}
            </button>
          ))}
        </div>
        {hasError && <span className="text-[11px] text-red-400 font-medium">{error}</span>}
      </div>
    );
  }
  return <div className="flex flex-col gap-1">
    <input type="text" value={value || ''} onChange={e => onChange(field.key, e.target.value)} placeholder={field.placeholder}
      className={`w-full bg-slate-900/80 border rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors ${hasError ? 'border-red-500/60 focus:border-red-400' : 'border-slate-700/80 focus:border-emerald-500/50'}`} />
    {hasError && <span className="text-[11px] text-red-400 font-medium leading-tight">{error}</span>}
  </div>;
}

export default function AITaxAssistantView() {
  const [guidedState, setGuidedState] = useState(null);
  const [contextValues, setContextValues] = useState({});
  const [contextErrors, setContextErrors] = useState({});
  const [contextStep, setContextStep] = useState(0);
  const [sectionValues, setSectionValues] = useState({});
  const [currentFieldValue, setCurrentFieldValue] = useState('');
  const [currentFieldError, setCurrentFieldError] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('fr');
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [templates, setTemplates] = useState(getAllTemplates());
  const [calculations, setCalculations] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('');
  const [showManagePanel, setShowManagePanel] = useState(false);
  const [manageTab, setManageTab] = useState('templates');
  const [manageAction, setManageAction] = useState(null);
  const [knowledges, setKnowledges] = useState([]);

  const autoFilledRef = useRef(false);

  useEffect(() => {
    loadTemplates();
    const unsub = onTemplateChange((remote) => {
      if (remote) setTemplates(getAllTemplates());
    });
    const cached = getCachedKnowledge();
    if (cached) setKnowledges(cached);
    return unsub;
  }, []);

  useEffect(() => {
    if (guidedState?.step !== 'remplissage') { autoFilledRef.current = false; return; }
    if (autoFilledRef.current) return;
    const periode = guidedState.data?.periode || contextValues.periode;
    if (!periode) return;
    const result = autoFillFromJournal(periode);
    if (!result) return;
    autoFilledRef.current = true;
    const newSections = { ...(guidedState.data?.sections || {}) };
    for (const [sectionId, fields] of Object.entries(result)) {
      const existing = { ...(newSections[sectionId] || {}) };
      for (const [key, val] of Object.entries(fields)) {
        if (!existing[key] || parseFloat(existing[key]) === 0) existing[key] = val;
      }
      newSections[sectionId] = existing;
    }
    setGuidedState(prev => ({ ...prev, data: { ...prev.data, sections: newSections } }));
    setTimeout(() => { handleRecalcValidation(); }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedState?.step]);

  const currentStep = guidedState?.step || 'accueil';
  const formDef = FORMULAIRES_CARDS.find(f => f.id === guidedState?.formulaire);
  const sections = guidedState ? getSectionsFor(guidedState.formulaire) : [];
  const doneSections = Object.keys(guidedState?.data?.sections || {});
  const activeSection = guidedState?.sectionId ? sections.find(s => s.id === guidedState.sectionId) : null;

  const REPETITIVE_TOTALS = { retenues_source: 31, autres_taxes: 19 };
  function getRepetitiveTotal(id) { return REPETITIVE_TOTALS[id] || 0; }

  function getSectionsFor(formId) {
    const all = {
      mensuelle: [
        { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
        { id: 'retenues_source', labelFR: 'Retenue à la source (31 lignes)', labelAR: 'الخصم من المنبع (31 خط)', icon: '💰' },
        { id: 'tfp', labelFR: 'TFP', labelAR: 'معلوم التكوين المهني', icon: '🎓' },
        { id: 'foprolos', labelFR: 'FOPROLOS', labelAR: 'فوبرولوص', icon: '🏠' },
        { id: 'tva', labelFR: 'TVA', labelAR: 'الأداء على القيمة المضافة', icon: '📊' },
        { id: 'autres_taxes', labelFR: 'Autres taxes (19 postes)', labelAR: 'المعاليم الأخرى (19)', icon: '🧾' },
        { id: 'timbre', labelFR: 'Timbre fiscal', labelAR: 'معلوم الطابع', icon: '🏷️' },
        { id: 'taxe_hoteliere', labelFR: 'Taxe hôtelière', labelAR: 'معلوم النزل', icon: '🏨' },
        { id: 'tcl', labelFR: 'TCL', labelAR: 'معاليم الجماعات المحلية', icon: '🏛️' },
        { id: 'licence', labelFR: 'Taxe licence', labelAR: 'معلوم الإجازة', icon: '🍷' },
      ],
      is: [
        { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
        { id: 'donnees_taxation', labelFR: 'I — Données de taxation', labelAR: 'I — معطيات التضريب', icon: '📈' },
        { id: 'benefices_deduits', labelFR: 'II — Bénéfices déduits', labelAR: 'II — الأرباح المخصومة', icon: '📉' },
        { id: 'exonerations', labelFR: 'III — Sociétés exonérées', labelAR: 'III — الشركات المعفاة', icon: '✅' },
        { id: 'non_imposable', labelFR: 'IV — Produits non imposables', labelAR: 'IV — المداخيل غير الخاضعة', icon: '🟢' },
        { id: 'calcul_is', labelFR: 'V — Calcul IS', labelAR: 'V — حساب الضريبة', icon: '🧮' },
        { id: 'acomptes', labelFR: 'VI — Acomptes', labelAR: 'VI — الدفعات', icon: '📅' },
        { id: 'liquidation', labelFR: 'VII — Liquidation', labelAR: 'VII — التسوية', icon: '✅' },
        { id: 'contributions', labelFR: 'VIII-IX — Contributions', labelAR: 'VIII-IX — المساهمات', icon: '🤝' },
        { id: 'recap_bancaire', labelFR: 'XII — Récap + bancaires', labelAR: 'XII — الملخص والبنوك', icon: '🏦' },
      ],
      irpp: [
        { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
        { id: 'situation_familiale', labelFR: 'Situation familiale', labelAR: 'الوضعية العائلية', icon: '👨‍👩‍👧‍👦' },
        { id: 'revenus', labelFR: 'Catégories de revenus', labelAR: 'أصناف المداخيل', icon: '💰' },
      ],
      employeur: [
        { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
        { id: 'salaires', labelFR: 'Salaires déclarés', labelAR: 'الأجور المصرح بها', icon: '💰' },
        { id: 'effectifs', labelFR: 'Effectifs', labelAR: 'الأعوان', icon: '👥' },
      ],
      plusvalue: [
        { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
        { id: 'cessions', labelFR: 'Cessions réalisées', labelAR: 'التفويتات', icon: '📈' },
      ],
      fortune: [
        { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
        { id: 'patrimoine', labelFR: 'Patrimoine imposable', labelAR: 'الثروة الخاضعة', icon: '💰' },
      ],
    };
    return all[formId] || [];
  }

  function startForm(formId) {
    const r = generateResponse(FORMULAIRES_CARDS.findIndex(f => f.id === formId) + 1 + '', { guidedState: null });
    setGuidedState(r.guidedState);
    setContextValues({});
    setContextErrors({});
    setContextStep(0);
    setSectionValues({});
    setCurrentFieldValue('');
  }

  function resetAll() {
    setGuidedState(null);
    setContextValues({});
    setContextErrors({});
    setContextStep(0);
    setSectionValues({});
    setCurrentFieldValue('');
    setCurrentFieldError('');
    setCurrentPrompt('');
  }

  function updateContext(key, value) {
    const next = { ...contextValues, [key]: value };
    setContextValues(next);
    setContextErrors(prev => ({ ...prev, [key]: '' }));
  }

  function applyTemplateToState(template) {
    if (!template || !guidedState) return;
    setActiveTemplate(template);
    const formId = guidedState.formulaire;
    const currentVals = guidedState.data?.sections || {};
    const { values, calculations: calcs } = applyCalculations(formId, { ...guidedState.data?.sections }, template);
    if (calcs.length > 0) {
      setCalculations(calcs);
      const newData = { ...guidedState.data, sections: values };
      setGuidedState(prev => ({ ...prev, data: newData }));
    }
  }

  function matchAndApplyTemplate() {
    const tmpl = matchTemplate(contextValues, templates);
    if (tmpl) {
      setActiveTemplate(tmpl);
      applyTemplateToState(tmpl);
    }
  }

  function submitContext() {
    const field = CONTEXT_FIELDS[contextStep];
    if (!field) { finishContext(); return; }
    const val = (contextValues[field.key] || '').trim();
    if (field.validate && !field.validate(val)) {
      setContextErrors(prev => ({ ...prev, [field.key]: field.errorFR }));
      return;
    }
    if (!val && !field.options) {
      setContextErrors(prev => ({ ...prev, [field.key]: 'Champ requis' }));
      return;
    }
    const r = generateResponse(val, { guidedState });
    if (r.guidedState) setGuidedState(r.guidedState);
    if (contextStep < CONTEXT_FIELDS.length - 1) {
      setContextStep(contextStep + 1);
    } else {
      finishContext();
    }
  }

  function finishContext() {
    const lastVal = contextValues[CONTEXT_FIELDS[CONTEXT_FIELDS.length - 1].key] || '';
    const r = generateResponse(lastVal, { guidedState });
    if (r.guidedState) {
      setGuidedState(r.guidedState);
      matchAndApplyTemplate();
    }
  }

  function selectSection(sectionId) {
    const r = generateResponse(sections.findIndex(s => s.id === sectionId) + 1 + '', { guidedState });
    if (r.guidedState) {
      setGuidedState(r.guidedState);
      setCurrentFieldValue('');
      setCurrentFieldError('');
    }
    if (r.message) setCurrentPrompt(r.message);
  }

  function submitField() {
    if (!currentFieldValue.trim()) { setCurrentFieldError('Veuillez saisir une valeur'); return; }
    const r = generateResponse(currentFieldValue, { guidedState });
    if (r.guidedState) {
      setGuidedState(r.guidedState);
      setCurrentFieldValue('');
      setCurrentFieldError('');
    }
    if (r.message) setCurrentPrompt(r.message);
  }

  function finishFilling() {
    const r = generateResponse('terminé', { guidedState });
    if (r.guidedState) {
      setGuidedState(r.guidedState);
      setTimeout(() => handleRecalcValidation(), 50);
    }
  }

  async function handleDownload() {
    setLoading(true);
    try {
      const pdfBytes = await generateFilledPdf(guidedState, lang);
      const formId = guidedState?.formulaire || 'declaration';
      const nom = guidedState?.data?.nom || 'client';
      downloadPdf(pdfBytes, `${formId}_${nom}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      alert('Erreur génération PDF: ' + err.message);
    }
    setLoading(false);
  }

  function handleAutoFill() {
    if (!guidedState) return;
    const periode = guidedState.data?.periode || contextValues.periode;
    if (!periode) { alert('Veuillez d\'abord saisir la période dans les informations client.'); return; }
    const result = autoFillFromJournal(periode);
    if (!result) { alert('Aucune écriture trouvée dans le journal pour la période ' + periode); return; }
    const newSections = { ...(guidedState.data?.sections || {}) };
    let filled = 0;
    for (const [sectionId, fields] of Object.entries(result)) {
      const existing = { ...(newSections[sectionId] || {}) };
      for (const [key, val] of Object.entries(fields)) {
        if (!existing[key] || parseFloat(existing[key]) === 0) {
          existing[key] = val;
          filled++;
        }
      }
      newSections[sectionId] = existing;
    }
    const newData = { ...guidedState.data, sections: newSections };
    setGuidedState(prev => ({ ...prev, data: newData }));
    setTimeout(() => { handleRecalcValidation(); }, 50);
  }

  function handleSaveApiKey() {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      resetModel();
    } else {
      clearApiKey();
    }
    setShowSettings(false);
  }

  function handleClearApiKey() {
    clearApiKey();
    setApiKeyInput('');
    resetModel();
    setShowSettings(false);
  }

  function handleSelectTemplate(template) {
    setActiveTemplate(template);
    setShowTemplatePicker(false);
    if (guidedState) {
      applyTemplateToState(template);
    }
  }

  function handleRecalcValidation() {
    if (!guidedState) return;
    const formId = guidedState.formulaire;
    const data = guidedState.data;
    const result = validateDeclaration(data, formId);
    setValidationResult(result);

    if (activeTemplate) {
      const { calculations: calcs } = applyCalculations(formId, { ...data?.sections }, activeTemplate);
      setCalculations(calcs);
    }
  }

  function handleSaveTemplateNow() {
    const name = templateNameInput.trim() || (contextValues.nom + ' - ' + (formDef?.labelFR || ''));
    const tmpl = addUserTemplate({
      name,
      client_match: (contextValues.nom || '').toUpperCase(),
      sector: contextValues.secteur || '',
      regime: contextValues.regime || '',
      config: {
        [guidedState.formulaire]: {
          template_date: new Date().toISOString().slice(0, 10),
        },
      },
    });
    setTemplateNameInput('');
    setShowTemplatePicker(false);
    setActiveTemplate(tmpl);
  }

  async function handleAiSubmit(q) {
    const query = (q || aiQuery).trim();
    if (!query) return;
    if (q) setAiQuery(q);
    setChatHistory(prev => [...prev, { role: 'user', content: query }]);
    setAiLoading(true);
    setAiResponse('');
    const answer = await askAI(query, chatHistory.map(m => ({ role: m.role, content: m.content })));
    const resp = answer || 'Aucune réponse disponible pour cette question.';
    setAiResponse(resp);
    setChatHistory(prev => [...prev, { role: 'assistant', content: resp }]);
    setAiLoading(false);
    if (!q) setAiQuery('');
  }

  function goBack() {
    if (guidedState?.sectionId) {
      const r = generateResponse('section', { guidedState });
      if (r.guidedState) { setGuidedState(r.guidedState); setCurrentFieldValue(''); setCurrentPrompt(''); }
    } else if (guidedState?.step === 'remplissage') {
      resetAll();
    } else if (contextStep > 0) {
      setContextStep(prev => prev - 1);
    } else {
      resetAll();
    }
  }

  const templateSectors = [...new Set(templates.map(t => t.sector).filter(Boolean))].sort();
  const filteredTemplates = templates.filter(t => {
    const matchSearch = !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()) || (t.sector || '').toLowerCase().includes(templateSearch.toLowerCase());
    const matchCategory = !templateCategoryFilter || t.sector === templateCategoryFilter;
    return matchSearch && matchCategory;
  });

  const stepIcons = { accueil: '📋', contexte: '👤', remplissage: '📝', recap: '📋' };
  const stepLabels = { accueil: 'Formulaire', contexte: 'Client', remplissage: 'Saisie', recap: 'Récap' };
  const stepIndex = ['accueil', 'contexte', 'remplissage', 'recap'];

  return (
    <>
    <div className="h-full flex flex-col gap-0">
      {/* ===== COMPACT HEADER ===== */}
      <div className="flex items-center gap-3 px-1 py-2 mb-2">
        <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
          <FileText className="w-4 h-4 text-emerald-400" />
        </div>
        {guidedState ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{formDef?.labelFR}</span>
            <span className="text-slate-700 text-[9px]">/</span>
            <div className="flex items-center gap-1.5 text-[10px]">
              {stepIndex.map((s, i) => {
                const idx = stepIndex.indexOf(currentStep);
                return (
                  <span key={s} className={`flex items-center gap-1 ${i < idx ? 'text-emerald-400' : i === idx ? 'text-amber-400 font-bold' : 'text-slate-600'}`}>
                    {i < idx ? <CheckCircle className="w-2.5 h-2.5" /> : <span>{stepIcons[s]}</span>}
                    <span className="hidden xs:inline">{stepLabels[s]}</span>
                    {i < 3 && <span className="text-slate-700 mx-0.5">›</span>}
                  </span>
                );
              })}
            </div>
            {activeTemplate && (
              <span className="ml-auto text-[8px] text-emerald-400/60 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 truncate max-w-[120px]">
                {activeTemplate.name}
              </span>
            )}
          </div>
        ) : (
          <h2 className="text-sm font-bold text-white tracking-tight">Déclarations</h2>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {guidedState && (
            <button onClick={goBack} className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white text-[10px] font-medium transition-all">
              <ArrowLeft className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => { setShowManagePanel(true); setManageTab('templates'); }} className="p-1 rounded-md text-slate-500 hover:text-emerald-400 transition-all" title="Gérer modèles et connaissances">
            <FileText className="w-3 h-3" />
          </button>
          <button onClick={resetAll} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-slate-700/50 bg-slate-800/60 text-slate-400 hover:border-red-500/30 hover:text-red-400 transition-all">
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-1 rounded-md text-slate-500 hover:text-slate-300 transition-all" title="Configuration IA">
            <Settings className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Step indicator dots */}
        {guidedState && (
          <div className="flex items-center gap-1 mb-3 px-1">
            {stepIndex.map((s, i) => (
              <div key={s} className={`flex-1 h-0.5 rounded-full transition-all ${i < stepIndex.indexOf(currentStep) ? 'bg-emerald-500/60' : i === stepIndex.indexOf(currentStep) ? 'bg-amber-500/60' : 'bg-slate-800'}`} />
            ))}
          </div>
        )}

        {/* === ACCUEIL === */}
        {!guidedState && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {FORMULAIRES_CARDS.map(f => (
              <button key={f.id} onClick={() => startForm(f.id)}
                className="group relative flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/40 hover:border-emerald-500/30 hover:bg-slate-800/80 transition-all text-left overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/[0.02] transition-all pointer-events-none" />
                <span className="text-xl shrink-0">{f.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors truncate">{f.labelFR}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{f.labelAR}</div>
                </div>
                <div className="ml-auto shrink-0 text-[8px] text-slate-600/50 group-hover:text-emerald-500/50 transition-colors">→</div>
              </button>
            ))}
          </div>
        )}

        {/* === CONTEXTE === */}
        {guidedState?.step === 'contexte' && (
          <div className="max-w-md mx-auto">
            {/* Mini progress bar */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[9px] text-slate-500 font-medium w-16 shrink-0">{contextStep + 1}/{CONTEXT_FIELDS.length}</span>
              <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/60 rounded-full transition-all duration-500" style={{ width: `${((contextStep + 1) / CONTEXT_FIELDS.length) * 100}%` }} />
              </div>
            </div>
            {/* Current field */}
            {CONTEXT_FIELDS.map((field, i) => (
              <div key={field.key} className={i === contextStep ? 'block' : 'hidden'}>
                {/* Compact field info */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] font-bold text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded">{field.labelFR}</span>
                  <span className="text-[9px] text-slate-600">{field.labelAR}</span>
                </div>
                <FieldInput field={field} value={contextValues[field.key]} onChange={updateContext} error={contextErrors[field.key]} />
                {contextErrors[field.key] && <p className="text-red-400 text-[10px] mt-1">{contextErrors[field.key]}</p>}
                <div className="flex gap-2 mt-4">
                  {contextStep > 0 && <button onClick={() => setContextStep(prev => prev - 1)} className="px-4 py-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs font-semibold hover:border-slate-500 transition-all">←</button>}
                  <button onClick={submitContext} className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold hover:shadow-lg hover:shadow-emerald-500/20 transition-all">{contextStep < CONTEXT_FIELDS.length - 1 ? 'Suivant' : 'Terminer'}</button>
                </div>
                {/* Summary of filled fields */}
                <div className="mt-4 flex flex-wrap gap-1">
                  {CONTEXT_FIELDS.slice(0, contextStep).map((_, idx) => (
                    <span key={idx} className="text-[8px] text-emerald-400/50 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">✓ {CONTEXT_FIELDS[idx].labelFR}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === REMPLISSAGE (section list) === */}
        {guidedState?.step === 'remplissage' && !guidedState?.sectionId && (
          <div>
            {/* Header bar */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-medium">Sections</span>
                <span className="text-[8px] text-slate-600">({doneSections.length}/{sections.length})</span>
                <div className="w-20 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/50 rounded-full transition-all" style={{ width: `${(doneSections.length / Math.max(sections.length, 1)) * 100}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {calculations.length > 0 && (
                  <span className="text-[8px] text-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-2 h-2" /> {calculations.length}
                  </span>
                )}
                <button onClick={handleAutoFill} className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors font-medium" title="Remplir automatiquement depuis le journal">Auto ⚡</button>
                {doneSections.length === sections.length && sections.length > 0 ? (
                  <button onClick={finishFilling} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">Voir le récapitulatif →</button>
                ) : (
                  <button onClick={finishFilling} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">Passer →</button>
                )}
              </div>
            </div>

            {/* Section cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {sections.map(sec => {
                const done = doneSections.includes(sec.id);
                const entries = guidedState?.data?.sections?.[sec.id] || {};
                const entryCount = Object.keys(entries).filter(k => !k.startsWith('_')).length;
                return (
                  <button key={sec.id} onClick={() => selectSection(sec.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${done ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-slate-800/40 border-slate-700/40 hover:border-amber-500/30 hover:bg-slate-800/70'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${done ? 'bg-emerald-500/15' : 'bg-slate-800/80'}`}>
                      {sec.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[11px] font-bold truncate ${done ? 'text-emerald-300' : 'text-slate-200'}`}>{sec.labelFR}</div>
                      <div className="text-[8px] text-slate-500 truncate">{sec.labelAR}</div>
                      {done && <div className="text-[8px] text-emerald-400/50 mt-0.5">{entryCount} champ(s)</div>}
                    </div>
                    {done && <CheckCircle className="w-3 h-3 text-emerald-400/60 shrink-0" />}
                    {!done && <div className="w-3 h-3 rounded-full border border-slate-600/50 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* === REMPLISSAGE (single section) === */}
        {guidedState?.step === 'remplissage' && guidedState?.sectionId && (
          <div className="max-w-sm mx-auto">
            {/* Section header */}
            <div className="flex items-center gap-2 mb-4">
              <button onClick={goBack} className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800/60 transition-all"><ArrowLeft className="w-3.5 h-3.5" /></button>
              <div>
                <div className="text-xs font-bold text-amber-400">{activeSection?.labelFR || guidedState.sectionId}</div>
                {activeSection && <div className="text-[8px] text-slate-500">{activeSection.labelAR}</div>}
              </div>
            </div>
            {/* Input card */}
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4">
              {guidedState.sectionType === 'repetitive' && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] text-slate-500 font-medium">Ligne {(guidedState.repetitiveIndex || 0) + 1}/{getRepetitiveTotal(guidedState.sectionId)}</span>
                  <div className="flex-1 h-0.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500/40 rounded-full transition-all" style={{ width: `${(((guidedState.repetitiveIndex || 0) + 1) / getRepetitiveTotal(guidedState.sectionId)) * 100}%` }} />
                  </div>
                </div>
              )}
              {currentPrompt && (
                <div className="text-[10px] text-slate-400 mb-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 leading-relaxed">{currentPrompt}</div>
              )}
              <label className="block text-xs font-bold text-slate-300 mb-2">
                {guidedState.currentFieldType === 'text' ? 'Valeur :' : 'Montant (DT) :'}
              </label>
              <div className="relative">
                {guidedState.currentFieldType !== 'text' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">TND</span>}
                <input type="text" value={currentFieldValue} onChange={e => { setCurrentFieldValue(e.target.value); setCurrentFieldError(''); }}
                  onKeyDown={e => e.key === 'Enter' && submitField()}
                  placeholder={guidedState.currentFieldType === 'text' ? 'Saisir...' : '0.000'}
                  className={`w-full bg-slate-900/80 border rounded-lg px-4 py-2.5 text-base text-slate-200 placeholder-slate-600 focus:outline-none transition-colors text-center font-mono ${guidedState.currentFieldType !== 'text' ? 'pl-10' : ''} ${currentFieldError ? 'border-red-500/60 focus:border-red-400' : 'border-slate-700/60 focus:border-emerald-500/50'}`}
                  autoFocus />
              </div>
              {currentFieldError && <p className="text-red-400 text-[10px] mt-1.5">{currentFieldError}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={submitField} className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold hover:shadow-lg hover:shadow-emerald-500/20 transition-all">Valider</button>
                <button onClick={() => { const r = generateResponse('', { guidedState }); if (r.guidedState) setGuidedState(r.guidedState); }} className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 text-xs hover:text-white transition-all">Passer</button>
              </div>
            </div>
          </div>
        )}

        {/* === RECAP === */}
        {guidedState?.step === 'recap' && (
          <div className="max-w-md mx-auto">
            {/* Header info */}
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-800/30 border border-slate-700/40">
              <span className="text-xl">{formDef?.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{formDef?.labelFR}</div>
                <div className="text-[9px] text-slate-500 truncate">
                  {guidedState.data?.matriculeFiscal || 'MF: —'} · {guidedState.data?.nom || 'Nom: —'}
                </div>
              </div>
              <button onClick={() => setShowTemplatePicker(true)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700/50 text-[9px] text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30 transition-all">
                <Book className="w-2.5 h-2.5" /> Modèle
              </button>
            </div>

            {/* Status banners */}
            {validationResult && !validationResult.valid && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span className="text-[9px] font-bold text-red-400/80">{validationResult.errors.length} erreur(s)</span>
                </div>
                {validationResult.errors.map(e => (
                  <div key={e.ruleId} className="text-[9px] text-red-300/80 py-0.5">• {e.message}</div>
                ))}
              </div>
            )}
            {validationResult && validationResult.valid && doneSections.length > 0 && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] font-bold text-emerald-400/80">Valide · {validationResult.totalSections} section(s)</span>
                </div>
              </div>
            )}

            {/* Sections summary */}
            {doneSections.length === 0 && <p className="text-center text-[10px] text-slate-500 py-6">Aucune section remplie.</p>}
            <div className="space-y-2">
              {doneSections.map(id => {
                const sec = sections.find(s => s.id === id);
                const vals = guidedState.data?.sections?.[id] || {};
                const entries = Object.entries(vals).filter(([k]) => !k.startsWith('_'));
                const total = entries.reduce((a, [, v]) => a + (parseFloat(v) || 0), 0);
                return (
                  <details key={id} className="group rounded-xl bg-slate-800/30 border border-slate-700/40 overflow-hidden" open>
                    <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-800/60 transition-colors list-none">
                      <span>{sec?.icon || '📄'}</span>
                      <span className="text-[10px] font-bold text-slate-300 flex-1 truncate">{sec?.labelFR || id}</span>
                      <span className="text-[9px] text-slate-500">{entries.length}</span>
                      {entries.length > 1 && <span className="text-[9px] text-emerald-300/60 font-mono">{total.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</span>}
                      <span className="text-slate-600 text-[10px] group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <div className="px-3 pb-2.5 space-y-0.5">
                      {entries.map(([k, v]) => (
                        <div key={k} className="flex justify-between py-1 px-2 rounded-md bg-slate-900/40">
                          <span className="text-[9px] text-slate-400">{k.replace(/^ligne_(\d+)/, 'Ligne $1')}</span>
                          <span className="text-[9px] text-slate-200 font-mono">{(parseFloat(v) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</span>
                        </div>
                      ))}
                      {entries.length > 1 && (
                        <div className="flex justify-between py-1 px-2 mt-1 border-t border-slate-700/40 text-[9px] font-bold text-emerald-300">
                          <span>Total</span>
                          <span className="font-mono">{total.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</span>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>

            {/* Auto-calculations */}
            {calculations.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                  <span className="text-[9px] font-bold text-amber-400/80">Calculs automatiques</span>
                </div>
                {calculations.map(c => (
                  <div key={c.formulaId} className="flex justify-between py-0.5 text-[9px]">
                    <span className="text-slate-400">{c.label}</span>
                    <span className="text-amber-300 font-mono">{c.value.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {doneSections.length > 0 && (
              <div className="flex gap-2 mt-4">
                <button onClick={handleDownload} disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2">
                  <Download className="w-3 h-3" /> {loading ? 'Génération...' : 'Télécharger PDF'}
                </button>
                <button onClick={() => setShowTemplatePicker(true)}
                  className="px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30 transition-all">
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {guidedState.data?.matriculeFiscal && (
              <a href="https://jibaya.tn" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 mt-3 text-[9px] text-amber-400/50 hover:text-amber-400 transition-colors">
                <ExternalLink className="w-2.5 h-2.5" /> jibaya.tn
              </a>
            )}
          </div>
        )}
      </div>

      {/* ===== AI CHAT (collapsed by default) ===== */}
      <details className="group mt-2 bg-slate-900/40 border border-slate-800/60 rounded-xl">
        <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800/30 rounded-xl transition-colors list-none">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span className="text-[9px] font-bold text-slate-400">Assistant Fiscal {hasApiKey() && <span className="text-amber-400/70">· Gemini</span>}</span>
          <span className="ml-auto text-slate-600 text-[10px] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-3 pb-3">
          {/* Chat messages */}
          {chatHistory.length > 0 && (
            <div className="max-h-48 overflow-y-auto mb-2 space-y-1.5 scrollbar-thin">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-2 rounded-lg text-[9px] leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-200' : 'bg-slate-800/60 border border-slate-700/50 text-slate-300'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-[9px] text-slate-500 animate-pulse flex items-center gap-1">
                    <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></span>
                    <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span>
                    <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Suggested queries (always visible when chat is empty) */}
          <div className="mb-2">
            {chatHistory.length > 0 && (
              <button onClick={() => setChatHistory([])} className="text-[7px] text-slate-600 hover:text-red-400 transition-colors mb-1">Effacer l'historique</button>
            )}
            <p className="text-[8px] text-slate-600 mb-1.5">Questions suggérées :</p>
            <div className="flex flex-wrap gap-1">
              {getSuggestedQueries().slice(0, 6).map(sq => (
                <button key={sq} onClick={() => handleAiSubmit(sq)} className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/50 text-[8px] text-slate-400 hover:text-amber-300 hover:border-amber-500/30 transition-all">{sq}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5">
            <input type="text" value={aiQuery} onChange={e => setAiQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAiSubmit()}
              placeholder="Posez une question..." className="flex-1 bg-slate-900/80 border border-slate-700/60 focus:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none transition-colors" />
            <button onClick={() => handleAiSubmit()} disabled={aiLoading || !aiQuery.trim()}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[9px] font-bold hover:shadow-lg hover:shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">→</button>
          </div>
        </div>
      </details>
    </div>

    {/* ===== TEMPLATE PICKER MODAL ===== */}
    {showTemplatePicker && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowTemplatePicker(false); setTemplateSearch(''); setTemplateCategoryFilter(''); }}>
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-white">Modèle de déclaration</h3>
            <button onClick={() => { setShowTemplatePicker(false); setTemplateSearch(''); setTemplateCategoryFilter(''); }} className="text-slate-500 hover:text-white text-xs">✕</button>
          </div>
          <p className="text-[9px] text-slate-500 mb-2">Suggéré selon le nom et le secteur du client.</p>
          {/* Search */}
          <input type="text" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
            placeholder="Rechercher un modèle..."
            className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none transition-colors mb-2" />
          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1 mb-3">
            <button onClick={() => setTemplateCategoryFilter('')}
              className={`px-2 py-0.5 rounded-full text-[8px] transition-all ${!templateCategoryFilter ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:border-slate-600'}`}>Tous</button>
            {templateSectors.map(s => (
              <button key={s} onClick={() => setTemplateCategoryFilter(s)}
                className={`px-2 py-0.5 rounded-full text-[8px] transition-all ${templateCategoryFilter === s ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:border-slate-600'}`}>{s}</button>
            ))}
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1 mb-3">
            {filteredTemplates.length === 0 && (
              <p className="text-[9px] text-slate-600 text-center py-4">Aucun modèle trouvé</p>
            )}
            {filteredTemplates.map(t => {
              const isActive = activeTemplate?.id === t.id;
              return (
                <button key={t.id} onClick={() => handleSelectTemplate(t)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${isActive ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'}`}>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10px] font-bold truncate ${isActive ? 'text-emerald-300' : 'text-slate-200'}`}>{t.name}</div>
                    <div className="text-[8px] text-slate-500 truncate">{t.sector || 'Tous secteurs'} {t.regime && `· ${t.regime}`}</div>
                  </div>
                  {t.is_default && <span className="text-[7px] text-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Défaut</span>}
                  {isActive && <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-700/50 pt-3">
            <p className="text-[8px] font-bold text-slate-400 mb-1.5">Enregistrer comme modèle</p>
            <div className="flex gap-1.5">
              <input type="text" value={templateNameInput} onChange={e => setTemplateNameInput(e.target.value)}
                placeholder={contextValues.nom || 'Nom du modèle'}
                className="flex-1 bg-slate-950 border border-slate-700 focus:border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none transition-colors" />
              <button onClick={handleSaveTemplateNow} disabled={!templateNameInput.trim() && !contextValues.nom}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[9px] font-bold transition-all disabled:opacity-40">+</button>
            </div>
            <button onClick={() => { setShowTemplatePicker(false); setShowManagePanel(true); setManageTab('templates'); }}
              className="w-full mt-2 text-[8px] text-slate-500 hover:text-slate-300 text-center transition-colors py-1">
              Gérer les modèles et la base de connaissances →
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ===== MANAGE PANEL (Templates & Knowledge Base) ===== */}
    {showManagePanel && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowManagePanel(false); setManageAction(null); }}>
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header with tabs */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-slate-700/50">
            <div className="flex gap-2">
              <button onClick={() => setManageTab('templates')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${manageTab === 'templates' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}>
                Modèles ({templates.length})
              </button>
              <button onClick={() => setManageTab('knowledge')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${manageTab === 'knowledge' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}>
                Connaissances ({knowledges.length || '—'})
              </button>
            </div>
            <button onClick={() => { setShowManagePanel(false); setManageAction(null); }} className="text-slate-500 hover:text-white text-xs">✕</button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {manageTab === 'templates' && (
              <div className="space-y-1.5">
                {templates.map(t => {
                  const isUser = t.is_user;
                  const configStr = JSON.stringify(t.config || {}, null, 1);
                  return (
                    <details key={t.id} className="rounded-xl bg-slate-800/30 border border-slate-700/40 overflow-hidden">
                      <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800/60 transition-colors list-none text-[10px]">
                        <span className="font-bold text-slate-200 flex-1 truncate">{t.name}</span>
                        {t.is_default && <span className="text-[7px] text-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Défaut</span>}
                        {isUser && <span className="text-[7px] text-emerald-400/60 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Personnalisé</span>}
                        {t.sector && <span className="text-[8px] text-slate-500">{t.sector}</span>}
                        <span className="text-slate-600 text-[10px] group-open:rotate-180 transition-transform">▾</span>
                      </summary>
                      <div className="px-3 pb-2 space-y-1.5">
                        <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-400">
                          <div>Secteur: <span className="text-slate-200">{t.sector || '—'}</span></div>
                          <div>Régime: <span className="text-slate-200">{t.regime || '—'}</span></div>
                          <div className="col-span-2">Client: <span className="text-slate-200">{t.client_match || '—'}</span></div>
                        </div>
                        <pre className="text-[8px] text-slate-500 bg-slate-900/80 rounded-lg p-2 overflow-x-auto max-h-28">{configStr}</pre>
                        <div className="flex gap-1.5 justify-end">
                          {isUser && (
                            <button onClick={async () => {
                              const confirmDelete = window.confirm(`Supprimer le modèle "${t.name}" ?`);
                              if (!confirmDelete) return;
                              removeUserTemplate(t.id);
                              if (t.id && !t.id.startsWith('user_')) {
                                await deleteRemoteTemplate(t.id);
                              }
                              setTemplates(getAllTemplates());
                            }}
                              className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] hover:bg-red-500/20 transition-all">
                              Supprimer
                            </button>
                          )}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            {manageTab === 'knowledge' && (
              <div>
                {(!knowledges || knowledges.length === 0) ? (
                  <p className="text-[10px] text-slate-500 text-center py-6">
                    {isSupabaseEnabled() ? 'Aucune entrée dans la base de connaissances.' : 'Supabase non configurée. La base de connaissances locale est active.'}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {knowledges.map(k => (
                      <details key={k.id} className="rounded-xl bg-slate-800/30 border border-slate-700/40 overflow-hidden">
                        <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800/60 transition-colors list-none text-[10px]">
                          <span className="font-bold text-slate-200 flex-1 truncate">
                            {(k.tags || []).join(', ') || 'Général'}
                          </span>
                          <span className="text-[8px] text-slate-500">{(k.keywords || []).join(', ')}</span>
                          <span className="text-slate-600 text-[10px] group-open:rotate-180 transition-transform">▾</span>
                        </summary>
                        <div className="px-3 pb-2 space-y-1">
                          <div className="text-[9px] text-slate-400 leading-relaxed whitespace-pre-wrap">{k.answerFR}</div>
                          {k.answerAR && <div className="text-[9px] text-slate-500 leading-relaxed text-right" dir="rtl">{k.answerAR}</div>}
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ===== SETTINGS MODAL ===== */}
    {showSettings && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-white">Configuration Gemini</h3>
            <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
          </div>
          <p className="text-[9px] text-slate-500 mb-3 leading-relaxed">
            L'assistant répond déjà aux questions sans clé. Gemini est optionnel.
          </p>
          <input type="text" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)}
            placeholder="Clé API Gemini..."
            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500/50 rounded-lg px-3 py-2 text-[10px] text-slate-200 placeholder-slate-600 font-mono focus:outline-none transition-colors mb-3" />
          {hasApiKey() && <p className="text-[9px] text-emerald-400/70 mb-2">✓ Clé API configurée</p>}
          <div className="flex gap-2">
            <button onClick={handleSaveApiKey} className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-bold transition-all hover:shadow-lg hover:shadow-amber-500/20">Enregistrer</button>
            {hasApiKey() && <button onClick={handleClearApiKey} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-semibold hover:border-red-500/30 hover:text-red-400 transition-all">Effacer</button>}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
