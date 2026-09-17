import { useState, useEffect } from 'react';
import { Calendar, Users, CreditCard, Sparkles } from 'lucide-react';
import { 
  subscribeToReservas, 
  getEventDates, 
  type Reserva, 
  type EventDate 
} from '../../lib/firestore';

export default function Dashboard() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEventDates().then(setEventDates).catch(console.error);

    const unsubscribe = subscribeToReservas((data) => {
      setReservas(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const totalVentas = reservas.length;
  const ingresosPagados = reservas.reduce((acc, curr) => acc + (curr.totalPaid || 0), 0);
  const pendientesValidar = reservas.filter(r => r.paymentStatus === 'pending' || r.paymentStatus === 'partial').length;
  const ventasEnCuotas = reservas.filter(r => r.paymentPlan === 'installments').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard General</h1>
        <p className="text-slate-500 text-sm mt-1">Métricas globales y distribución por fecha del evento.</p>
      </div>
      
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-200">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-2">
            <Users size={16} /> Entradas Vendidas
          </div>
          <p className="text-3xl font-black text-slate-900">{loading ? '...' : totalVentas}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-200">
          <div className="flex items-center gap-2 text-green-600 text-xs font-bold uppercase mb-2">
            <Sparkles size={16} /> Ingresos Recaudados
          </div>
          <p className="text-3xl font-black text-green-700">{loading ? '...' : `S/ ${ingresosPagados.toFixed(2)}`}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-200">
          <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase mb-2">
            <Calendar size={16} /> Por Validar
          </div>
          <p className="text-3xl font-black text-amber-600">{loading ? '...' : pendientesValidar}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-200">
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase mb-2">
            <CreditCard size={16} /> En 2 Cuotas
          </div>
          <p className="text-3xl font-black text-primary-dark">{loading ? '...' : ventasEnCuotas}</p>
        </div>
      </div>

      {/* Desglose por Fecha de Evento */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-900">Ventas por Fecha de Presentación</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {eventDates.map((d) => {
            const dateReservas = reservas.filter(r => r.eventDateId === d.id || (!r.eventDateId && d.id === 'd1'));
            const dateIncome = dateReservas.reduce((acc, curr) => acc + (curr.totalPaid || 0), 0);

            return (
              <div key={d.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-slate-900 text-base">{d.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{d.dateText}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {d.timeText}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-center">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Butacas</span>
                    <span className="text-xl font-black text-slate-900 mt-0.5 block">{dateReservas.length}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Recaudado</span>
                    <span className="text-base font-black text-green-700 mt-0.5 block">S/ {dateIncome.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
