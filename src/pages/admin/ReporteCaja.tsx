import React, { useState, useEffect } from 'react';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  Search, 
  Download,
  Calendar,
  ArrowUpDown
} from 'lucide-react';
import { 
  subscribeToReservas, 
  subscribeToGastos,
  type Reserva, 
  type Gasto 
} from '../../lib/firestore';
import { clsx } from 'clsx';

interface Transaction {
  id: string;
  type: 'ingreso' | 'egreso';
  date: string;
  description: string;
  method: string;
  amount: number;
  timestamp: number;
}

export default function ReporteCaja() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    let allReservas: Reserva[] = [];
    let allGastos: Gasto[] = [];
    let unmounted = false;

    const processData = () => {
      if (unmounted) return;
      
      const trans: Transaction[] = [];

      // Procesar Ingresos (Abonos Verificados)
      allReservas.forEach(r => {
        if (r.payments && r.payments.length > 0) {
          r.payments.forEach((p, idx) => {
            if (p.verified) {
              // Extract timestamp from date string or fallback
              let ts = Date.now();
              // p.date is something like "13/09/2026, 16:30" or similar
              trans.push({
                id: `ing-${r.id}-${idx}`,
                type: 'ingreso',
                date: p.date,
                description: `Abono Reserva: ${r.fullName} (${r.dni})`,
                method: p.method || 'Efectivo',
                amount: p.amount,
                timestamp: ts // We'll just sort them roughly or keep as they appear
              });
            }
          });
        }
      });

      // Procesar Egresos (Gastos)
      allGastos.forEach(g => {
        let ts = Date.now();
        if (g.createdAt && g.createdAt.toMillis) {
          ts = g.createdAt.toMillis();
        }
        trans.push({
          id: `egr-${g.id}`,
          type: 'egreso',
          date: g.date,
          description: g.reason,
          method: g.method || 'Efectivo',
          amount: g.amount,
          timestamp: ts
        });
      });

      // Sort by whatever makes sense, newest first
      // Actually dates are string, so let's just reverse for simplicity
      setTransactions(trans.reverse());
      setLoading(false);
    };

    const unsubReservas = subscribeToReservas(data => {
      allReservas = data;
      if (allGastos !== undefined) processData();
    });

    const unsubGastos = subscribeToGastos(data => {
      allGastos = data;
      if (allReservas !== undefined) processData();
    });

    return () => {
      unmounted = true;
      unsubReservas();
      unsubGastos();
    };
  }, []);

  const filtered = transactions.filter(t => {
    const matchType = filterType === 'all' || t.type === filterType;
    const matchMethod = filterMethod === 'all' || t.method.toLowerCase().includes(filterMethod.toLowerCase());
    const matchSearch = t.description.toLowerCase().includes(search.toLowerCase());
    return matchType && matchMethod && matchSearch;
  });

  
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedFiltered = React.useMemo(() => {
    let sortableItems = [...filtered];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filtered, sortConfig]);

  const totalIngresos = filtered.filter(t => t.type === 'ingreso').reduce((acc, t) => acc + t.amount, 0);
  const totalEgresos = filtered.filter(t => t.type === 'egreso').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIngresos - totalEgresos;

  const exportCSV = () => {
    const headers = ['Tipo', 'Fecha', 'Descripcion', 'Metodo', 'Monto'];
    const rows = filtered.map(t => [
      t.type.toUpperCase(),
      t.date,
      t.description.replace(/,/g, ''), // remove commas for safe CSV
      t.method,
      t.amount.toFixed(2)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "reporte_caja_fluctuante.csv";
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reporte de Caja Fluctuante</h1>
          <p className="text-slate-500 text-sm mt-1">Auditoría en tiempo real de ingresos y egresos</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-slate-800 transition shadow-sm">
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wallet size={48} />
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Balance Actual</p>
          <p className={clsx("text-3xl font-black", balance >= 0 ? "text-slate-900" : "text-red-600")}>
            S/ {balance.toFixed(2)}
          </p>
        </div>
        
        <div className="bg-green-50 border border-green-200 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-green-700">
            <ArrowUpCircle size={48} />
          </div>
          <p className="text-green-700 text-xs font-bold uppercase tracking-wider mb-1">Total Ingresos</p>
          <p className="text-3xl font-black text-green-800">
            S/ {totalIngresos.toFixed(2)}
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-red-700">
            <ArrowDownCircle size={48} />
          </div>
          <p className="text-red-700 text-xs font-bold uppercase tracking-wider mb-1">Total Egresos</p>
          <p className="text-3xl font-black text-red-800">
            S/ {totalEgresos.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por descripción..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as any)}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary font-medium"
        >
          <option value="all">Todos los Movimientos</option>
          <option value="ingreso">Solo Ingresos</option>
          <option value="egreso">Solo Egresos</option>
        </select>
        <select
          value={filterMethod}
          onChange={e => setFilterMethod(e.target.value)}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary font-medium"
        >
          <option value="all">Todos los Métodos</option>
          <option value="yape">Yape</option>
          <option value="plin">Plin</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('type')}><div className="flex items-center gap-1">Tipo <ArrowUpDown size={12} /></div></th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('date')}><div className="flex items-center gap-1">Fecha <ArrowUpDown size={12} /></div></th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('description')}><div className="flex items-center gap-1">Descripción <ArrowUpDown size={12} /></div></th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('method')}><div className="flex items-center gap-1">Método <ArrowUpDown size={12} /></div></th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-200 transition  text-right" onClick={() => handleSort('amount')}><div className="flex items-center justify-end gap-1">Monto <ArrowUpDown size={12} /></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Cargando transacciones...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">No hay movimientos que coincidan con los filtros</td>
                </tr>
              ) : (
                sortedFiltered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      {t.type === 'ingreso' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                          <ArrowUpCircle size={12} /> INGRESO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-200">
                          <ArrowDownCircle size={12} /> EGRESO
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs flex items-center gap-1">
                      <Calendar size={12} /> {t.date}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-normal min-w-[200px]">
                      {t.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        {t.method}
                      </span>
                    </td>
                    <td className={clsx("px-4 py-3 font-black text-right", t.type === 'ingreso' ? 'text-green-600' : 'text-red-600')}>
                      {t.type === 'ingreso' ? '+' : '-'}S/ {t.amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
