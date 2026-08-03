import React, { useMemo, useEffect, useState } from 'react';
import { Package, Users, Building2, ShoppingCart, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { productsStore, clientsStore, suppliersStore, salesOrdersStore, purchaseOrdersStore } from '../utils/erpStore';

function ErpKpiCard({ title, value, icon: Icon, color, bg, subtitle }) {
  return (
    <div className={`glass-card p-4 rounded-xl border ${bg} relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 card-hover-glow`}>
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">{title}</p>
            <h3 className={`text-lg font-extrabold tracking-tight ${color}`}>{value}</h3>
            {subtitle && <p className="text-[10px] text-slate-500">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${bg} border border-slate-700/30 group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-4 h-4 text-slate-300" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ErpKpiWidgets({ companyId }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onData = () => setVersion(v => v + 1);
    window.addEventListener('data:updated', onData);
    window.addEventListener('stock:updated', onData);
    window.addEventListener('journal:updated', onData);
    return () => {
      window.removeEventListener('data:updated', onData);
      window.removeEventListener('stock:updated', onData);
      window.removeEventListener('journal:updated', onData);
    };
  }, []);
  const refresh = version;
  const products = useMemo(() => productsStore.getAll(companyId), [companyId, refresh]);
  const clients = useMemo(() => clientsStore.getAll(companyId), [companyId, refresh]);
  const suppliers = useMemo(() => suppliersStore.getAll(companyId), [companyId, refresh]);
  const salesOrders = useMemo(() => salesOrdersStore.getAll(companyId), [companyId, refresh]);
  const purchaseOrders = useMemo(() => purchaseOrdersStore.getAll(companyId), [companyId, refresh]);

  const stockValue = useMemo(() =>
    products.reduce((sum, p) => sum + (p.stock_actuel || 0) * (p.prix_achat_ht || 0), 0)
  , [products]);

  const lowStockItems = useMemo(() =>
    products.filter(p => (p.stock_actuel || 0) < (p.stock_mini || 0) && p.stock_mini > 0)
  , [products]);

  const pendingSales = useMemo(() =>
    salesOrders.filter(o => o.statut === 'brouillon' || o.statut === 'confirme').length
  , [salesOrders]);

  const pendingPurchases = useMemo(() =>
    purchaseOrders.filter(o => o.statut === 'brouillon' || o.statut === 'confirme').length
  , [purchaseOrders]);

  const hasData = products.length > 0 || clients.length > 0 || suppliers.length > 0 || salesOrders.length > 0 || purchaseOrders.length > 0;

  if (!hasData) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4 text-brand-400" />
        <h3 className="text-sm font-bold text-slate-100">ERP — Gestion Commerciale</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <ErpKpiCard
          title="Articles"
          value={products.length}
          icon={Package}
          color="text-brand-400"
          bg="bg-brand-500/10 border-brand-500/20"
          subtitle={products.length > 0 ? `Stock: ${stockValue.toLocaleString()} DT` : undefined}
        />
        <ErpKpiCard
          title="Clients"
          value={clients.length}
          icon={Users}
          color="text-accent-400"
          bg="bg-accent-500/10 border-accent-500/20"
        />
        <ErpKpiCard
          title="Fournisseurs"
          value={suppliers.length}
          icon={Building2}
          color="text-indigo-400"
          bg="bg-indigo-500/10 border-indigo-500/20"
        />
        <ErpKpiCard
          title="Ventes en cours"
          value={pendingSales}
          icon={ShoppingCart}
          color="text-warning-400"
          bg="bg-warning-500/10 border-warning-500/20"
        />
        <ErpKpiCard
          title="Achats en cours"
          value={pendingPurchases}
          icon={ArrowLeftRight}
          color="text-danger-400"
          bg="bg-danger-500/10 border-danger-500/20"
        />
        <ErpKpiCard
          title="Stock Alerte"
          value={lowStockItems.length}
          icon={AlertTriangle}
          color={lowStockItems.length > 0 ? 'text-rose-400' : 'text-slate-500'}
          bg={lowStockItems.length > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-500/10 border-slate-500/20'}
          subtitle={lowStockItems.length > 0 ? lowStockItems.slice(0, 2).map(p => p.designation).join(', ') : undefined}
        />
      </div>
    </div>
  );
}
