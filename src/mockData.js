export const INITIAL_INVOICES = [
  {
    id: "inv-1",
    invoiceNumber: "FACT-2026-001",
    clientName: "Acme Corporation Tunisie",
    clientEmail: "billing@acme.tn",
    issueDate: "2026-05-10",
    dueDate: "2026-06-10",
    subtotal: 4500.000,
    vatAmount: 855.000, // 19% de TVA en Tunisie
    stampDuty: 1.000,   // Timbre Fiscal tunisien
    totalAmount: 5356.000,
    status: "PAID",
    items: [
      { id: 1, description: "Consulting Technique & Architecture SaaS", quantity: 5, unitPrice: 900.000, vatRate: 19, total: 4500.000 }
    ]
  },
  {
    id: "inv-2",
    invoiceNumber: "FACT-2026-002",
    clientName: "Stark Industries Maghreb",
    clientEmail: "accounts@stark.tn",
    issueDate: "2026-05-15",
    dueDate: "2026-06-15",
    subtotal: 12500.000,
    vatAmount: 2375.000, // 19% de TVA
    stampDuty: 1.000,
    totalAmount: 14876.000,
    status: "SENT",
    items: [
      { id: 1, description: "Développement Dashboard Premium React & Tailwind", quantity: 1, unitPrice: 12500.000, vatRate: 19, total: 12500.000 }
    ]
  },
  {
    id: "inv-3",
    invoiceNumber: "FACT-2026-003",
    clientName: "Wayne Enterprises S.A.R.L",
    clientEmail: "finance@wayne.tn",
    issueDate: "2026-05-20",
    dueDate: "2026-06-20",
    subtotal: 8200.000,
    vatAmount: 1558.000, // 19% de TVA
    stampDuty: 1.000,
    totalAmount: 9759.000,
    status: "SENT",
    items: [
      { id: 1, description: "Audit Sécurité & Robustesse Backend Express", quantity: 1, unitPrice: 8200.000, vatRate: 19, total: 8200.000 }
    ]
  },
  {
    id: "inv-4",
    invoiceNumber: "FACT-2026-004",
    clientName: "Cyberdyne Systems Tunisie",
    clientEmail: "ap@cyberdyne.tn",
    issueDate: "2026-04-12",
    dueDate: "2026-05-12",
    subtotal: 3000.000,
    vatAmount: 570.000, // 19% de TVA
    stampDuty: 1.000,
    totalAmount: 3571.000,
    status: "OVERDUE",
    items: [
      { id: 1, description: "Maintenance Infrastructure Cloud & DevOps", quantity: 3, unitPrice: 1000.000, vatRate: 19, total: 3000.000 }
    ]
  }
];

export const INITIAL_TRANSACTIONS = [
  {
    id: "tx-1",
    date: "2026-05-12",
    description: "Virement reçu - Acme Corporation Tunisie",
    amount: 5356.000,
    type: "CREDIT",
    status: "RECONCILED",
    matchedInvoiceId: "inv-1",
  },
  {
    id: "tx-2",
    date: "2026-05-22",
    description: "Virement Wayne Enterprises - Fact 003",
    amount: 9759.000,
    type: "CREDIT",
    status: "UNRECONCILED",
    matchedInvoiceId: null,
  },
  {
    id: "tx-3",
    date: "2026-05-24",
    description: "Prélèvement automatique Ooredoo Tunisie",
    amount: -155.700,
    type: "DEBIT",
    status: "UNRECONCILED",
    matchedInvoiceId: null,
  },
  {
    id: "tx-4",
    date: "2026-05-25",
    description: "Facture Tunisie Telecom S.A.",
    amount: -845.500,
    type: "DEBIT",
    status: "UNRECONCILED",
    matchedInvoiceId: null,
  },
  {
    id: "tx-5",
    date: "2026-05-25",
    description: "Virement Stark Industries - Acompte",
    amount: 14876.000,
    type: "CREDIT",
    status: "UNRECONCILED",
    matchedInvoiceId: null,
  }
];

export const INITIAL_EXPENSES = [
  {
    id: "exp-1",
    supplier: "Ooredoo Tunisie",
    date: "2026-05-02",
    subtotal: 130.000,
    vatAmount: 24.700, // 19% de TVA
    stampDuty: 1.000,
    totalAmount: 155.700,
    category: "Télécoms & Internet",
    status: "VALIDATED"
  },
  {
    id: "exp-2",
    supplier: "STEG Tunisie",
    date: "2026-05-05",
    subtotal: 58.330,
    vatAmount: 7.583, // 13% de TVA (tarif électricité libéral en Tunisie)
    stampDuty: 1.000,
    totalAmount: 66.913,
    category: "Énergie & Utilités",
    status: "VALIDATED"
  }
];

export const MOCK_CHART_DATA = [
  { name: 'Jan', Revenus: 8000.000, Dépenses: 3200.000, Trésorerie: 4800.000 },
  { name: 'Fév', Revenus: 12000.000, Dépenses: 4500.000, Trésorerie: 12300.000 },
  { name: 'Mar', Revenus: 9500.000, Dépenses: 6100.000, Trésorerie: 15700.000 },
  { name: 'Avr', Revenus: 15000.000, Dépenses: 5200.000, Trésorerie: 25500.000 },
  { name: 'Mai', Revenus: 27840.000, Dépenses: 1071.500, Trésorerie: 52268.500 },
];

export const RECEIPT_SAMPLES = [
  {
    name: "Facture Ooredoo (155.700 DT)",
    url: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=400&h=500&q=80",
    data: {
      supplier: "Ooredoo Tunisie S.A.",
      date: "2026-05-24",
      subtotal: 130.000,
      vatAmount: 24.700,
      stampDuty: 1.000,
      totalAmount: 155.700,
      category: "Télécoms & Internet",
      invoiceNumber: "OOR-998877",
      vatRate: 19
    }
  },
  {
    name: "Reçu Monoprix Tunis (24.500 DT)",
    url: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=400&h=500&q=80",
    data: {
      supplier: "Monoprix Tunisie",
      date: "2026-05-25",
      subtotal: 19.748,
      vatAmount: 3.752,
      stampDuty: 1.000,
      totalAmount: 24.500,
      category: "Fournitures Bureau",
      invoiceNumber: "MNP-2026-9A",
      vatRate: 19
    }
  },
  {
    name: "Facture STEG Électricité (66.913 DT)",
    url: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=400&h=500&q=80",
    data: {
      supplier: "STEG District Tunis",
      date: "2026-05-25",
      subtotal: 58.330,
      vatAmount: 7.583,
      stampDuty: 1.000,
      totalAmount: 66.913,
      category: "Énergie & Utilités",
      invoiceNumber: "STEG-3382910",
      vatRate: 13
    }
  }
];
