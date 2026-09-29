import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { subscribeToVendedores, saveVendedor, deleteVendedor, subscribeToReservas, type Vendedor, type Reserva } from '../../lib/firestore';
import { clsx } from 'clsx';

export default function Vendedores() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', active: true });

  useEffect(() => {
    const unsub1 = subscribeToVendedores(setVendedores);
    const unsub2 = subscribeToReservas(setReservas);
    return () => {
      unsub1();
      unsub2();
    };
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

  const handleEdit = (v: Vendedor) => {
    setIsEditing(v.id);
    setForm({ name: v.name, active: v.active });
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este vendedor?')) {
      await deleteVendedor(id);
    }
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setForm({ name: '', active: true });
  };

  // Calcular comisiones/ventas
  const getVendedorStats = (id: string) => {
    const vReservas = reservas.filter(r => r.vendedorId === id);
    const soldCount = vReservas.length;
    const totalRevenue = vReservas.reduce((acc, r) => acc + (r.totalPrice || 0), 0);
    return { soldCount, totalRevenue };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Gestión de Vendedores</h1>
      
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
              onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none"
              placeholder="Ej. Juan Pérez"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="flex items-center gap-2 cursor-pointer h-[42px] px-2">
              <input 
                type="checkbox" 
                checked={form.active}
                onChange={e => setForm({...form, active: e.target.checked})}
                className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
              />
              <span className="text-sm font-semibold text-slate-700">Activo (Aparece en formulario)</span>
            </label>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {isEditing && (
              <button 
                type="button" 
                onClick={cancelEdit}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
            )}
            <button 
              type="submit"
              className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition flex items-center justify-center gap-2"
            >
              <Plus size={18} /> {isEditing ? 'Guardar Cambios' : 'Añadir Vendedor'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendedores.map(v => {
          const stats = getVendedorStats(v.id);
          return (
            <div key={v.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">{v.name}</h3>
                  <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", v.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>
                    {v.active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(v)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition"><Edit2 size={16}/></button>
                  <button onClick={() => handleDelete(v.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={16}/></button>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl flex justify-between border border-slate-100">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Entradas</p>
                  <p className="text-lg font-black text-slate-800">{stats.soldCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Vendido (S/)</p>
                  <p className="text-lg font-black text-primary-dark">S/ {stats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
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
