export function getClients(invoices = []) {
  const clientMap = {};
  invoices.forEach(inv => {
    const name = inv.clientName || inv.client || 'Inconnu';
    if (!clientMap[name]) {
      clientMap[name] = {
        name,
        email: inv.clientEmail || '',
        vat: inv.clientVat || '',
        totalInvoiced: 0,
        totalPaid: 0,
        totalPending: 0,
        invoiceCount: 0,
        lastInvoice: null,
        firstInvoice: null,
        invoices: [],
        status: 'active',
      };
    }
    clientMap[name].totalInvoiced += inv.totalAmount || 0;
    if (inv.status === 'PAID') clientMap[name].totalPaid += inv.totalAmount || 0;
    else clientMap[name].totalPending += inv.totalAmount || 0;
    clientMap[name].invoiceCount += 1;
    clientMap[name].invoices.push(inv);
    if (!clientMap[name].lastInvoice || inv.issueDate > clientMap[name].lastInvoice) {
      clientMap[name].lastInvoice = inv.issueDate;
    }
    if (!clientMap[name].firstInvoice || inv.issueDate < clientMap[name].firstInvoice) {
      clientMap[name].firstInvoice = inv.issueDate;
    }
  });

  return Object.values(clientMap).sort((a, b) => b.totalInvoiced - a.totalInvoiced);
}

export function getSuppliers(expenses = []) {
  const supplierMap = {};
  expenses.forEach(exp => {
    const name = exp.supplier || exp.fournisseur || 'Inconnu';
    if (!supplierMap[name]) {
      supplierMap[name] = {
        name,
        matriculeFiscal: exp.matriculeFiscal || '',
        category: exp.category || '',
        totalSpent: 0,
        expenseCount: 0,
        lastExpense: null,
        firstExpense: null,
        expenses: [],
      };
    }
    supplierMap[name].totalSpent += exp.totalAmount || 0;
    supplierMap[name].expenseCount += 1;
    supplierMap[name].expenses.push(exp);
    if (!supplierMap[name].lastExpense || exp.date > supplierMap[name].lastExpense) {
      supplierMap[name].lastExpense = exp.date;
    }
    if (!supplierMap[name].firstExpense || exp.date < supplierMap[name].firstExpense) {
      supplierMap[name].firstExpense = exp.date;
    }
  });

  return Object.values(supplierMap).sort((a, b) => b.totalSpent - a.totalSpent);
}

export function getClientTimeline(invoices) {
  const months = {};
  invoices.forEach(inv => {
    const d = new Date(inv.issueDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months[key]) months[key] = { month: key, count: 0, total: 0, paid: 0 };
    months[key].count += 1;
    months[key].total += inv.totalAmount || 0;
    if (inv.status === 'PAID') months[key].paid += inv.totalAmount || 0;
  });

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      ...val,
      label: new Date(`${key}-01`).toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
    }));
}

export function addNote(entityType, entityId, note) {
  const key = `sc_notes_${entityType}`;
  const notes = JSON.parse(localStorage.getItem(key) || '[]');
  notes.push({
    id: `note_${Date.now()}`,
    entityId,
    content: note,
    createdAt: new Date().toISOString(),
    author: 'Utilisateur',
  });
  localStorage.setItem(key, JSON.stringify(notes));
  return notes;
}

export function getNotes(entityType, entityId) {
  const key = `sc_notes_${entityType}`;
  const notes = JSON.parse(localStorage.getItem(key) || '[]');
  return notes.filter(n => n.entityId === entityId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
