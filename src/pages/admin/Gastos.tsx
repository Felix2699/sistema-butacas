import { useState, useEffect } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { subscribeToGastos, addGasto, deleteGasto, type Gasto } from '../../lib/firestore';
import { clsx } from 'clsx';

export default function Gastos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], reason: '', amount: '' });
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToGastos(setGastos);
    return () => unsub();
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
        voucherBase64: voucherPreview,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setForm({ date: new Date().toISOString().split('T')[0], reason: '', amount: '' });
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
              <th className="px-4 py-3">FECHA</th>
              <th className="px-4 py-3">MOTIVO</th>
              <th className="px-4 py-3">COMPROBANTE</th>
              <th className="px-4 py-3 text-right">MONTO</th>
              <th className="px-4 py-3 text-center">ACCIONES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gastos.map(g => (
              <tr key={g.id} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3 font-medium text-slate-700">{g.date}</td>
                <td className="px-4 py-3 text-slate-900 font-bold">{g.reason}</td>
                <td className="px-4 py-3">
                  {g.voucherBase64 ? (
                    <a href={g.voucherBase64} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-semibold text-xs flex items-center gap-1">
                      Ver Imagen
                    </a>
                  ) : (
                    <span className="text-slate-400 text-xs italic">Sin imagen</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-black text-red-600">
                  S/ {g.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => g.id && handleDelete(g.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Eliminar gasto">
                    <Trash2 size={16} />
                  </button>
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
    </div>
  );
}
