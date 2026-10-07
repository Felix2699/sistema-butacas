import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, BarChart2, TrendingUp, DollarSign } from 'lucide-react';
import { subscribeToVendedores, saveVendedor, deleteVendedor, subscribeToReservas, type Vendedor, type Reserva } from '../../lib/firestore';
import { clsx } from 'clsx';

// ─── Vertical Histogram ───────────────────────────────────────────────────────
interface HistItem { label: string; valueCount: number; valueMoney: number; color: string; }

function VendedorHistogram({ items, mode }: { items: HistItem[]; mode: 'count' | 'money' }) {
  const [animate, setAnimate] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 150);
    return () => clearTimeout(t);
  }, []);

  const maxVal = Math.max(...items.map(i => mode === 'count' ? i.valueCount : i.valueMoney), 1);

  return (
    <div className="relative">
      <div className="flex items-end gap-3 h-52 border-b border-slate-200 px-2 pt-4 overflow-x-auto">
        {items.map((item, idx) => {
          const val = mode === 'count' ? item.valueCount : item.valueMoney;
          const heightPct = (val / maxVal) * 100;
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={idx}
              className="flex flex-col items-center gap-1 flex-1 min-w-[52px] max-w-[90px] cursor-pointer select-none"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg whitespace-nowrap pointer-events-none">
                  {item.label}: {mode === 'count' ? `${item.valueCount} ventas` : `S/ ${item.valueMoney.toFixed(0)}`}
                </div>
              )}
              <span className="text-[10px] font-black text-slate-700">{mode === 'count' ? val : `S/${val.toFixed(0)}`}</span>
              <div
                className="w-full rounded-t-xl transition-all duration-700 ease-out hover:opacity-80"
                style={{
                  height: animate ? `${(heightPct / 100) * 176}px` : '0px',
                  backgroundColor: isHovered ? '#4f46e5' : item.color,
                  minHeight: val > 0 ? '4px' : '0px',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X axis labels */}
      <div className="flex gap-3 mt-2 overflow-x-auto px-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex-1 min-w-[52px] max-w-[90px] text-center">
            <span className="text-[9px] font-bold text-slate-500 truncate block leading-tight">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Vendedores() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', active: true });
  const [histMode, setHistMode] = useState<'count' | 'money'>('count');

  useEffect(() => {
    const unsub1 = subscribeToVendedores(setVendedores);
    const unsub2 = subscribeToReservas(setReservas);
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const id = isEditing || `v-${Date.now()}`;
      await saveVendedor({ id, name: form.name.trim(), active: form.active });
      setIsEditing(null);
      setForm({ name: '', active: true });
    } catch (err) {
      console.error(err);
      alert('Error guardando vendedor');
    }
  };

  const handleEdit = (v: Vendedor) => { setIsEditing(v.id); setForm({ name: v.name, active: v.active }); };
  const handleDelete = async (id: string) => { if (confirm('¿Seguro que deseas eliminar este vendedor?')) await deleteVendedor(id); };
  const cancelEdit = () => { setIsEditing(null); setForm({ name: '', active: true }); };

  const getVendedorStats = (id: string) => {
    const vReservas = reservas.filter(r => r.vendedorId === id);
    const soldCount = vReservas.length;
    const totalRevenue = vReservas.reduce((acc, r) => acc + (r.totalPrice || 0), 0);
    const totalPaid = vReservas.reduce((acc, r) => acc + (r.totalPaid || 0), 0);
    return { soldCount, totalRevenue, totalPaid };
  };

  // ─── Histogram data ───────────────────────────────────────────────────────
  const histItems: HistItem[] = vendedores.map(v => {
    const s = getVendedorStats(v.id);
    return {
      label: v.name,
      valueCount: s.soldCount,
      valueMoney: s.totalRevenue,
      color: v.active ? '#6366f1' : '#94a3b8',
    };
  }).sort((a, b) => (histMode === 'count' ? b.valueCount - a.valueCount : b.valueMoney - a.valueMoney));

  // Grand totals
  const grandCount = vendedores.reduce((acc, v) => acc + getVendedorStats(v.id).soldCount, 0);
  const grandRevenue = vendedores.reduce((acc, v) => acc + getVendedorStats(v.id).totalRevenue, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Gestión de Vendedores</h1>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          {isEditing ? 'Editar Vendedor' : 'Nuevo Vendedor'}
        </h2>
        <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 mb-1">Nombre del Vendedor</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none"
              placeholder="Ej. Juan Pérez"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="flex items-center gap-2 cursor-pointer h-[42px] px-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
              />
              <span className="text-sm font-semibold text-slate-700">Activo (Aparece en formulario)</span>
            </label>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {isEditing && (
              <button type="button" onClick={cancelEdit} className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">
                Cancelar
              </button>
            )}
            <button type="submit" className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition flex items-center justify-center gap-2">
              <Plus size={18} /> {isEditing ? 'Guardar Cambios' : 'Añadir Vendedor'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Histograma interactivo ────────────────────────────────────────── */}
      {histItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <BarChart2 size={18} className="text-primary" />
              <h2 className="text-lg font-bold text-slate-900">Histograma de Rendimiento</h2>
            </div>
            {/* Mode toggle */}
            <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setHistMode('count')}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-bold transition', histMode === 'count' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700')}
              >
                # Ventas
              </button>
              <button
                onClick={() => setHistMode('money')}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-bold transition', histMode === 'money' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700')}
              >
                S/ Recaudado
              </button>
            </div>
          </div>

          {/* Summary totals */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 flex items-center gap-3">
              <TrendingUp size={20} className="text-indigo-500 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase text-indigo-500">Total Entradas (Vendedores)</p>
                <p className="text-xl font-black text-indigo-800">{grandCount}</p>
              </div>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-2xl p-3 flex items-center gap-3">
              <DollarSign size={20} className="text-green-500 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase text-green-600">Total Facturado</p>
                <p className="text-xl font-black text-green-800">S/ {grandRevenue.toFixed(0)}</p>
              </div>
            </div>
          </div>

          <VendedorHistogram items={histItems} mode={histMode} />
        </div>
      )}

      {/* ── Cards por vendedor ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendedores.map(v => {
          const stats = getVendedorStats(v.id);
          const paidPct = stats.totalRevenue > 0 ? Math.min(100, (stats.totalPaid / stats.totalRevenue) * 100) : 0;
          return (
            <div key={v.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">{v.name}</h3>
                  <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', v.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                    {v.active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(v)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(v.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl flex justify-between border border-slate-100">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Entradas</p>
                  <p className="text-lg font-black text-slate-800">{stats.soldCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Precio Total</p>
                  <p className="text-lg font-black text-primary-dark">S/ {stats.totalRevenue.toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Cobrado</p>
                  <p className="text-lg font-black text-green-700">S/ {stats.totalPaid.toFixed(0)}</p>
                </div>
              </div>

              {/* Mini progress bar */}
              {stats.totalRevenue > 0 && (
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Cobrado</span>
                    <span className="font-bold">{paidPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-700"
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {vendedores.length === 0 && (
          <div className="col-span-full py-10 text-center text-slate-500">
            No hay vendedores registrados.
          </div>
        )}
      </div>
    </div>
  );
}
