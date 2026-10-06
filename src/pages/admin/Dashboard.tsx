import { useState, useEffect } from 'react';
import { Calendar, Users, CreditCard, Sparkles } from 'lucide-react';
import { 
  subscribeToReservas, 
  getEventDates, 
  type Reserva, 
  type EventDate,
} from '../../lib/firestore';

const REAL_ZONAS = [
  { id: 'iconic', name: 'ICONIC Experiencia', total: 62, color: '#ef4444' },
  { id: 'glam', name: 'GLAM - Nivel 01', total: 154, color: '#eab308' },
  { id: 'elite', name: 'ÉLITE - Nivel 02', total: 104, color: '#fb7185' },
  { id: 'bronce', name: 'BRONCE - Nivel 03', total: 358, color: '#d97706' },
  { id: 'invitados', name: 'INVITADOS', total: 20, color: '#06b6d4' },
  { id: 'staff', name: 'STAFF', total: 18, color: '#0f172a' }
];

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

      {/* REPORTE DE ZONAS */}
      <div className="space-y-4 pt-4">
        <h2 className="text-lg font-black text-slate-900">Reporte de Zonas y Stock</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {eventDates.map(d => {
            const dateReservas = reservas.filter(r => r.eventDateId === d.id || (!r.eventDateId && d.id === 'd1'));
            return (
              <div key={`report-${d.id}`} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-slate-800 mb-4">{d.name} <span className="text-xs text-slate-400 font-normal ml-2">{d.dateText}</span></h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 font-bold">
                      <tr>
                        <th className="px-3 py-2 rounded-l-lg">ZONA</th>
                        <th className="px-3 py-2 text-right">TOTAL BUTACAS</th>
                        <th className="px-3 py-2 text-right">VENDIDAS</th>
                        <th className="px-3 py-2 text-right rounded-r-lg">STOCK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {REAL_ZONAS.map(z => {
                        let vendidos = 0;
                        if (z.id === 'invitados' || z.id === 'staff') {
                            vendidos = dateReservas.filter(r => (r.method || '').toLowerCase() === z.id).length;
                        } else {
                            vendidos = dateReservas.filter(r => r.zoneId === z.id || r.zoneName === z.name).length;
                        }
                        const total = z.total;
                        const disponible = total - vendidos;
                        return (
                          <tr key={z.id}>
                            <td className="px-3 py-2 font-medium flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: z.color }}></span>
                              {z.name}
                            </td>
                            <td className="px-3 py-2 text-right">{total}</td>
                            <td className="px-3 py-2 text-right font-bold text-primary-dark">{vendidos}</td>
                            <td className="px-3 py-2 text-right font-black text-green-600">{disponible}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-black">
                      <tr>
                        <td className="px-3 py-2">TOTAL GENERAL</td>
                        <td className="px-3 py-2 text-right">{REAL_ZONAS.reduce((acc, z) => acc + z.total, 0)}</td>
                        <td className="px-3 py-2 text-right text-primary-dark">
                          {REAL_ZONAS.reduce((acc, z) => {
                             let v = 0;
                             if (z.id === 'invitados' || z.id === 'staff') v = dateReservas.filter(r => (r.method || '').toLowerCase() === z.id).length;
                             else v = dateReservas.filter(r => r.zoneId === z.id || r.zoneName === z.name).length;
                             return acc + v;
                          }, 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-green-600">
                          {REAL_ZONAS.reduce((acc, z) => {
                             let v = 0;
                             if (z.id === 'invitados' || z.id === 'staff') v = dateReservas.filter(r => (r.method || '').toLowerCase() === z.id).length;
                             else v = dateReservas.filter(r => r.zoneId === z.id || r.zoneName === z.name).length;
                             return acc + (z.total - v);
                          }, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
