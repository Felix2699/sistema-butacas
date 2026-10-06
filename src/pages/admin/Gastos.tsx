import { useState, useEffect } from 'react';
import { Plus, Trash2, Upload, Eye, Edit, ArrowUpDown } from 'lucide-react';
import React from 'react';
import { subscribeToGastos, addGasto, deleteGasto, updateGasto, subscribeToVendedores, type Gasto, type Vendedor } from '../../lib/firestore';
import { clsx } from 'clsx';

export default function Gastos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [editingGasto, setEditingGasto] = useState<Gasto | null>(null);
  const [editForm, setEditForm] = useState<Partial<Gasto>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], reason: '', amount: '', method: 'Efectivo', vendedorId: '', vendedorName: '' });
  const [viewVoucherModal, setViewVoucherModal] = useState<string | null>(null);
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToGastos(setGastos);
    const unsubV = subscribeToVendedores(setVendedores);
    return () => { unsub(); unsubV(); };
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setVoucherPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason.trim() || !form.amount || isNaN(Number(form.amount))) return;

    try {
      await addGasto({
        date: form.date,
        reason: form.reason.trim(),
        amount: Number(form.amount),
        method: form.method,
        vendedorId: form.vendedorId,
        vendedorName: form.vendedorName,
        voucherBase64: voucherPreview,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setForm({ date: new Date().toISOString().split('T')[0], reason: '', amount: '', method: 'Efectivo', vendedorId: '', vendedorName: '' });
      setVoucherPreview(null);
    } catch (err) {
      console.error(err);
      alert('Error guardando el gasto');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este gasto de forma permanente?')) {
      await deleteGasto(id);
    }
  };

  const totalGastos = gastos.reduce((acc, g) => acc + (g.amount || 0), 0);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedGastos = React.useMemo(() => {
    let sortableItems = [...gastos];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let valA = a[sortConfig.key] || '';
        let valB = b[sortConfig.key] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [gastos, sortConfig]);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Registro de Gastos</h1>
          <p className="text-slate-500 mt-1">Control de caja chica y egresos</p>
        </div>
        <div className="bg-red-50 px-4 py-2 rounded-xl border border-red-200">
          <span className="text-xs text-red-500 font-bold block uppercase tracking-wider">Total Gastado</span>
          <span className="text-2xl font-black text-red-600">S/ {totalGastos.toFixed(2)}</span>
        </div>
      </div>

      {isAdding ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Registrar Nuevo Gasto</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">FECHA</label>
                <input 
                  type="date" 
                  required
                  value={form.date}
                  onChange={e => setForm({...form, date: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">MOTIVO / DESCRIPCIÓN</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej. Compra de suministros"
                  value={form.reason}
                  onChange={e => setForm({...form, reason: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">MONTO (S/)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm({...form, amount: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">MÉTODO DE PAGO</label>
                <select 
                  value={form.method}
                  onChange={e => setForm({...form, method: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none bg-white font-medium"
                >
                  <option value="Yape">Yape</option>
                  <option value="Plin">Plin</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="POS / Tarjeta">POS / Tarjeta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">REALIZADO POR (OPCIONAL)</label>
                <select 
                  value={form.vendedorId}
                  onChange={e => {
                    const v = vendedores.find(x => x.id === e.target.value);
                    setForm({...form, vendedorId: v?.id || '', vendedorName: v?.name || ''});
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none bg-white font-medium"
                >
                  <option value="">- Seleccione -</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">CAPTURA / COMPROBANTE</label>
              <label className="block cursor-pointer">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <div className={clsx(
                  "border-2 border-dashed rounded-2xl p-4 text-center transition-all h-[200px] flex items-center justify-center",
                  voucherPreview ? "border-green-400 bg-green-50/60" : "border-slate-300 bg-slate-50 hover:border-primary hover:bg-primary/5"
                )}>
                  {voucherPreview ? (
                    <img src={voucherPreview} alt="Comprobante" className="max-h-full mx-auto rounded-lg object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="text-slate-400" size={32} />
                      <p className="text-slate-600 text-sm font-bold">Haz clic para subir la captura</p>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="md:col-span-2 flex gap-3 justify-end pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition"
              >
                Guardar Gasto
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition shadow-md"
        >
          <Plus size={20} /> Registrar Nuevo Gasto
        </button>
      )}

      {/* Lista de Gastos */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-bold">
            <tr>
              <th className="px-4 py-3 cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('date')}><div className="flex items-center gap-1">FECHA <ArrowUpDown size={12} /></div></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('vendedorName')}><div className="flex items-center gap-1">RESPONSABLE <ArrowUpDown size={12} /></div></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('reason')}><div className="flex items-center gap-1">MOTIVO <ArrowUpDown size={12} /></div></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('method')}><div className="flex items-center gap-1">MÉTODO <ArrowUpDown size={12} /></div></th>
              <th className="px-4 py-3">COMPROBANTE</th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-200 transition" onClick={() => handleSort('amount')}><div className="flex items-center justify-end gap-1">MONTO <ArrowUpDown size={12} /></div></th>
              <th className="px-4 py-3 text-center">ACCIONES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedGastos.map(g => (
              <tr key={g.id} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3 font-medium text-slate-700">{g.date}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{g.vendedorName || '-'}</td>
                <td className="px-4 py-3 text-slate-900 font-bold">{g.reason}</td>
                <td className="px-4 py-3 text-slate-600 font-medium text-xs">{g.method || 'Efectivo'}</td>
                <td className="px-4 py-3">
                  {g.voucherBase64 ? (
                    <button onClick={() => setViewVoucherModal(g.voucherBase64!)} className="text-blue-500 hover:underline font-semibold text-xs flex items-center gap-1">
                      <Eye size={14} /> Ver Imagen
                    </button>
                  ) : (
                    <span className="text-slate-400 text-xs italic">Sin imagen</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-black text-red-600">
                  S/ {g.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => { setEditingGasto(g); setEditForm(g); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Editar gasto">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => g.id && handleDelete(g.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Eliminar gasto">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {gastos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No hay gastos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Visor de Comprobante */}
      {viewVoucherModal && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setViewVoucherModal(null)}
        >
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2"><Eye size={16} className="text-primary" /> Comprobante de Gasto</h3>
              <button onClick={() => setViewVoucherModal(null)} className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 flex items-center justify-center font-bold text-xl transition">&times;</button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center">
              <img src={viewVoucherModal} alt="Comprobante" className="max-w-full rounded-xl object-contain shadow-inner max-h-[75vh]" />
            </div>
          </div>
        </div>
      )}

      {editingGasto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEditingGasto(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Edit size={18} className="text-blue-500" /> Editar Gasto
              </h3>
              <button onClick={() => setEditingGasto(null)} className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 flex items-center justify-center font-bold text-base transition">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Motivo</label>
                <input 
                  type="text" 
                  value={editForm.reason || ''} 
                  onChange={e => setEditForm({...editForm, reason: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Monto (S/)</label>
                <input 
                  type="number" 
                  value={editForm.amount || ''} 
                  onChange={e => setEditForm({...editForm, amount: Number(e.target.value)})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Método de Pago</label>
                  <select 
                    value={editForm.method || 'Efectivo'}
                    onChange={e => setEditForm({...editForm, method: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary"
                  >
                    <option value="Yape">Yape</option>
                    <option value="Plin">Plin</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                    <option value="POS / Tarjeta">POS / Tarjeta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha</label>
                  <input 
                    type="date" 
                    value={editForm.date || ''} 
                    onChange={e => setEditForm({...editForm, date: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Responsable (Vendedor)</label>
                <select 
                  value={editForm.vendedorId || ''}
                  onChange={e => {
                    const v = vendedores.find(x => x.id === e.target.value);
                    setEditForm({...editForm, vendedorId: v?.id || '', vendedorName: v?.name || ''});
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary"
                >
                  <option value="">- Seleccione -</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setEditingGasto(null)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition text-sm font-semibold">Cancelar</button>
              <button onClick={async () => {
                if(editingGasto.id) {
                  await updateGasto(editingGasto.id, editForm);
                  setEditingGasto(null);
                }
              }} className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-bold shadow-md">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}