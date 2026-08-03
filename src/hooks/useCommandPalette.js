import { useState, useRef, useMemo, useCallback } from 'react';

const COMMANDS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', category: 'Navigation' },
  { id: 'invoicing', label: 'Factures Client', icon: 'FileText', category: 'Navigation' },
  { id: 'suppliers', label: 'Fournisseurs', icon: 'Package', category: 'Navigation' },
  { id: 'expenses', label: 'Dépenses', icon: 'TrendingDown', category: 'Navigation' },
  { id: 'bank', label: 'Rapprochement Bancaire', icon: 'ArrowLeftRight', category: 'Navigation' },
  { id: 'fiscal', label: 'Déclarations fiscales', icon: 'Calculator', category: 'Navigation' },
  { id: 'teif', label: 'TEIF & Télédéclaration', icon: 'FileText', category: 'Navigation' },
  { id: 'payroll', label: 'Paie & CNSS', icon: 'User', category: 'Navigation' },
  { id: 'audit', label: 'Audit & Conformité', icon: 'ShieldCheck', category: 'Navigation' },
  { id: 'financial', label: 'Bilan & Résultat', icon: 'CheckCheck', category: 'Navigation' },
  { id: 'manual', label: 'Saisie Manuelle', icon: 'BookOpen', category: 'Navigation' },
  { id: 'journal', label: 'Journal Comptable', icon: 'BookOpen', category: 'Navigation' },
  { id: 'ocr', label: 'Scan Reçus (IA)', icon: 'Scan', category: 'Navigation' },
  { id: 'chat', label: 'Assistant IA', icon: 'Sparkles', category: 'Navigation' },
  { id: 'ai_tax', label: 'Portail Déclarations', icon: 'FileText', category: 'Navigation' },
  { id: 'smart_tva', label: 'TVA Intelligente', icon: 'Calculator', category: 'Navigation' },
  { id: 'smart_irpp', label: 'IRPP Intelligent', icon: 'TrendingUp', category: 'Navigation' },
  { id: 'smart_is', label: 'IS Intelligent', icon: 'Building', category: 'Navigation' },
  { id: 'bi', label: 'Business Intelligence', icon: 'TrendingUp', category: 'Navigation' },
  { id: 'alerts', label: 'Centre d\'Alertes', icon: 'Bell', category: 'Navigation' },
  { id: 'crm', label: 'CRM Comptable', icon: 'Users', category: 'Navigation' },
  { id: 'portal', label: 'Portail Expert', icon: 'Building', category: 'Navigation' },
  { id: 'settings', label: 'Configuration', icon: 'SettingsIcon', category: 'Navigation' },
];

export default function useCommandPalette() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIdx, setCommandIdx] = useState(0);
  const commandInputRef = useRef(null);

  const openCommandPalette = useCallback(() => {
    setCommandQuery('');
    setCommandIdx(0);
    setCommandPaletteOpen(true);
    setTimeout(() => { if (commandInputRef.current) commandInputRef.current.focus(); }, 50);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
    setCommandQuery('');
  }, []);

  const filteredCommands = useMemo(() => {
    const q = commandQuery.toLowerCase().trim();
    if (!q) return COMMANDS;
    return COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.id.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  }, [commandQuery]);

  return {
    commandPaletteOpen,
    setCommandPaletteOpen,
    commandQuery,
    setCommandQuery,
    commandIdx,
    setCommandIdx,
    commandInputRef,
    COMMANDS,
    filteredCommands,
    openCommandPalette,
    closeCommandPalette,
  };
}
