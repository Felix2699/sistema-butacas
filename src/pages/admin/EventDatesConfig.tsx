import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  Clock, 
  CreditCard, 
  DollarSign, 
  ToggleLeft, 
  ToggleRight
} from 'lucide-react';
import { 
  saveEventDate, 
  deleteEventDate, 
  saveEventSettings, 
  subscribeToEventDates,
  subscribeToEventSettings,
  type EventDate, 
  type EventSettings 
} from '../../lib/firestore';
import { clsx } from 'clsx';

export default function EventDatesConfig() {
  const [dates, setDates] = useState<EventDate[]>([]);
  const [settings, setSettings] = useState<EventSettings>({ pricingStage: 'auto', allowInstallments: true });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Modal / Formulario de Fecha
  const [editingDate, setEditingDate] = useState<EventDate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<EventDate, 'id'>>({
    name: '',
    dateText: '',
    timeText: '09:00 AM',
    isActive: true,
    order: 1,
  });

  useEffect(() => {
    const unsubDates = subscribeToEventDates((data) => {
      setDates(data);
      setLoading(false);
    });
    const unsubSettings = subscribeToEventSettings((data) => {
      setSettings(data);
    });

    return () => {
      unsubDates();
      unsubSettings();
    };
  }, []);

  const openNewModal = () => {
    setEditingDate(null);
    setForm({
      name: `Día ${dates.length + 1} - Presentación`,
      dateText: 'Lunes 09 de Noviembre, 2026',
      timeText: '09:00 AM',
      isActive: true,
      order: dates.length + 1,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (d: EventDate) => {
    setEditingDate(d);
    setForm({
      name: d.name,
      dateText: d.dateText,
      timeText: d.timeText,
      isActive: d.isActive,
      order: d.order,
    });
    setIsModalOpen(true);
  };

  const handleSaveDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.dateText.trim()) return;

    const id = editingDate ? editingDate.id : `date_${Date.now()}`;
    const dateToSave: EventDate = {
      id,
      ...form,
    };

    await saveEventDate(dateToSave);
    setIsModalOpen(false);
    showNotice('Fecha guardada correctamente');
  };

  const handleDeleteDate = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la fecha "${name}"?`)) return;
    await deleteEventDate(id);
    showNotice('Fecha eliminada');
  };

  const handleToggleActive = async (d: EventDate) => {
    await saveEventDate({ ...d, isActive: !d.isActive });
  };

  const handleToggleInstallments = async () => {
    setSavingSettings(true);
    const newSettings: EventSettings = {
      ...settings,
      allowInstallments: !settings.allowInstallments,
    };
    await saveEventSettings(newSettings);
    setSavingSettings(false);
    showNotice(newSettings.allowInstallments ? 'Pagos en cuotas ACTIVADOS' : 'Pagos en cuotas DESACTIVADOS');
  };

  const handleChangeStage = async (stage: EventSettings['pricingStage']) => {
    setSavingSettings(true);
    const newSettings: EventSettings = {
      ...settings,
      pricingStage: stage,
    };
    await saveEventSettings(newSettings);
    setSavingSettings(false);
    showNotice(`Etapa de precios cambiada a: ${stage.toUpperCase()}`);
  };

  const showNotice = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="text-primary" size={32} />
            Fechas y Configuración del Evento
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestiona las fechas de presentación (sin tope) y controla la política de cuotas y precios.
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 transition-all hover:scale-105"
        >
          <Plus size={18} /> Nueva Fecha
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-sm font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle size={18} className="text-green-600" />
          {successMsg}
        </div>
      )}

      {/* Control Global de Cuotas y Etapa de Precios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Switch de Pagos en Cuotas */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
              <CreditCard size={18} />
              Modalidad de Pagos en Cuotas
            </div>
            <h3 className="text-xl font-black text-slate-900">Permitir 2 Cuotas (50% / 50%)</h3>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
              Si está activo, los clientes podrán elegir pagar al contado o en 2 partes en zonas Iconic, Glam y Élite. Puedes desactivarlo cuando no esté disponible.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <span className={clsx(
              "text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full",
              settings.allowInstallments ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"
            )}>
              {settings.allowInstallments ? '✅ Cuotas Habilitadas' : '⛔ Solo Contado'}
            </span>

            <button
              type="button"
              disabled={savingSettings}
              onClick={handleToggleInstallments}
              className="flex items-center gap-2 text-slate-700 hover:text-primary font-bold text-sm transition"
            >
              {settings.allowInstallments ? (
                <ToggleRight size={38} className="text-green-600" />
              ) : (
                <ToggleLeft size={38} className="text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Selector de Etapa de Precios */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm mb-1">
              <DollarSign size={18} />
              Tarifario Activo
            </div>
            <h3 className="text-xl font-black text-slate-900">Etapa de Precios</h3>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
              Define qué precios se cobran en la web: automático según calendario (Preventa hasta 04 Oct, luego Regular) o forzar una etapa específica.
            </p>
          </div>

          <div className="flex gap-2 pt-4 border-t border-slate-100">
            {(['auto', 'preventa', 'regular'] as const).map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => handleChangeStage(stage)}
                className={clsx(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition capitalize",
                  settings.pricingStage === stage
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {stage === 'auto' ? 'Automático' : stage}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Listado de Fechas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">Fechas del Evento ({dates.length})</h2>
          <span className="text-xs text-slate-400">Cada fecha cuenta con su propio mapa independiente de butacas</span>
        </div>

        {loading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400">
            Cargando fechas...
          </div>
        ) : dates.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <p className="text-slate-500 font-medium">No hay fechas registradas todavía.</p>
            <button onClick={openNewModal} className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm">
              Agregar Primera Fecha
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dates.map((d) => (
              <div
                key={d.id}
                className={clsx(
                  "p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 bg-white shadow-xs",
                  d.isActive ? "border-slate-200 hover:border-primary/50" : "border-slate-200/60 opacity-60 bg-slate-50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                      Orden #{d.order}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 mt-2">{d.name}</h3>
                    <p className="text-slate-600 text-sm font-semibold mt-1 flex items-center gap-1.5">
                      <Calendar size={15} className="text-slate-400" />
                      {d.dateText}
                    </p>
                    <p className="text-slate-500 text-xs flex items-center gap-1.5 mt-0.5">
                      <Clock size={14} className="text-slate-400" />
                      {d.timeText}
                    </p>
                  </div>

                  <span className={clsx(
                    "text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap",
                    d.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                  )}>
                    {d.isActive ? 'Venta Activa' : 'Pausada'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(d)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 transition"
                  >
                    {d.isActive ? 'Pausar Venta' : 'Reactivar Venta'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(d)}
                      className="p-2 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-xl transition"
                      title="Editar fecha"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteDate(d.id, d.name)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                      title="Eliminar fecha"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Crear / Editar Fecha */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900">
              {editingDate ? 'Editar Fecha de Evento' : 'Nueva Fecha de Presentación'}
            </h3>

            <form onSubmit={handleSaveDate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Fecha / Función</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Día 1 - 09 de Noviembre"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Formateada (Texto visible)</label>
                <input
                  type="text"
                  required
                  value={form.dateText}
                  onChange={e => setForm({ ...form, dateText: e.target.value })}
                  placeholder="Ej: Lunes 09 de Noviembre, 2026"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hora de Inicio</label>
                  <input
                    type="text"
                    required
                    value={form.timeText}
                    onChange={e => setForm({ ...form, timeText: e.target.value })}
                    placeholder="Ej: 09:00 AM"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Orden de Presentación</label>
                  <input
                    type="number"
                    min="1"
                    value={form.order}
                    onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Habilitar venta pública de esta fecha
                </label>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md transition"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
