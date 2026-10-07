import { useState, useEffect } from 'react';
import { Calendar, Users, CreditCard, Sparkles, BarChart2, TrendingUp, Package } from 'lucide-react';
import { 
  subscribeToReservas, 
  subscribeToVendedores,
  getEventDates, 
  type Reserva, 
  type EventDate,
  type Vendedor,
} from '../../lib/firestore';

// ─── Capacidades reales por zona ─────────────────────────────────────────────
const REAL_ZONAS = [
  { id: 'iconic',    name: 'ICONIC',    total: 26,  color: '#ef4444' },
  { id: 'glam',      name: 'GLAM',      total: 154, color: '#eab308' },
  { id: 'elite',     name: 'ÉLITE',     total: 104, color: '#fb7185' },
  { id: 'bronce',    name: 'BRONCE',    total: 358, color: '#d97706' },
  { id: 'invitados', name: 'INVITADOS', total: 20,  color: '#06b6d4' },
  { id: 'staff',     name: 'STAFF',     total: 18,  color: '#0f172a' },
];

// ─── Mini bar chart: renders horizontal bars ──────────────────────────────────
interface BarItem { label: string; value: number; max: number; color: string; sub?: string; }

function HorizontalBar({ item, animate }: { item: BarItem; animate: boolean }) {
  const pct = item.max > 0 ? Math.min(100, (item.value / item.max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5 group cursor-default">
      <span className="text-xs font-bold text-slate-600 w-20 shrink-0 truncate">{item.label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: animate ? `${pct}%` : '0%',
            backgroundColor: item.color,
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white mix-blend-difference pointer-events-none">
          {item.value}
        </span>
      </div>
      <span className="text-xs font-black text-slate-800 w-10 text-right shrink-0">{pct.toFixed(0)}%</span>
      {item.sub && <span className="text-[10px] text-slate-400 shrink-0">{item.sub}</span>}
    </div>
  );
}

// ─── Vertical bar chart (histograma) ─────────────────────────────────────────
interface VertBarItem { label: string; value: number; color: string; secondaryLabel?: string; }

function VerticalHistogram({ items, title, subtitle, emptyText }: {
  items: VertBarItem[];
  title: string;
  subtitle?: string;
  emptyText?: string;
}) {
  const [animate, setAnimate] = useState(false);
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);
  const maxVal = Math.max(...items.map(i => i.value), 1);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 120);
    return () => clearTimeout(t);
  }, [items.length]);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
      <div className="flex items-center gap-2 mb-1">
        <BarChart2 size={16} className="text-primary" />
        <h3 className="font-black text-slate-900 text-sm">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-slate-400 mb-4">{subtitle}</p>}

      {items.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-sm">{emptyText || 'Sin datos'}</div>
      ) : (
        <div className="relative">
          {/* Chart area */}
          <div className="flex items-end gap-2 h-44 pt-4 border-b border-slate-200 relative overflow-x-auto pb-1">
            {items.map((item, idx) => {
              const heightPct = (item.value / maxVal) * 100;
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center gap-1 flex-1 min-w-[40px] max-w-[80px] cursor-pointer"
                  onMouseEnter={e => setTooltip({ idx, x: (e.target as HTMLElement).getBoundingClientRect().left, y: 0 })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Value label on top */}
                  <span className="text-[10px] font-black text-slate-700">{item.value}</span>
                  {/* Bar */}
                  <div className="w-full relative">
                    <div
                      className="w-full rounded-t-lg transition-all duration-700 ease-out hover:opacity-80"
                      style={{
                        height: animate ? `${(heightPct / 100) * 140}px` : '0px',
                        backgroundColor: item.color,
                        minHeight: item.value > 0 ? '4px' : '0px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* X-axis labels */}
          <div className="flex gap-2 mt-1 overflow-x-auto">
            {items.map((item, idx) => (
              <div key={idx} className="flex-1 min-w-[40px] max-w-[80px] text-center">
                <span className="text-[9px] font-bold text-slate-500 truncate block">{item.label}</span>
                {item.secondaryLabel && (
                  <span className="text-[8px] text-slate-400 truncate block">{item.secondaryLabel}</span>
                )}
              </div>
            ))}
          </div>

          {/* Tooltip */}
          {tooltip !== null && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg pointer-events-none z-10">
              {items[tooltip.idx].label}: {items[tooltip.idx].value}
              {items[tooltip.idx].secondaryLabel && ` · ${items[tooltip.idx].secondaryLabel}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stock Histogram (zona usage) ────────────────────────────────────────────
function ZonaStockHistogram({ dateReservas, dateLabel }: { dateReservas: Reserva[]; dateLabel: string }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(t);
  }, [dateReservas.length]);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
      <div className="flex items-center gap-2 mb-1">
        <Package size={16} className="text-primary" />
        <h3 className="font-black text-slate-900 text-sm">Stock por Zona · {dateLabel}</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">Vendido vs disponible por zona</p>
      <div className="space-y-1">
        {REAL_ZONAS.map(z => {
          let vendidos = 0;
          if (z.id === 'invitados' || z.id === 'staff') {
            vendidos = dateReservas.filter(r => (r.method || '').toLowerCase() === z.id).length;
          } else {
            vendidos = dateReservas.filter(r => r.zoneId === z.id || r.zoneName?.includes(z.name.split(' ')[0])).length;
          }
          const disponible = z.total - vendidos;
          return (
            <HorizontalBar
              key={z.id}
              animate={animate}
              item={{
                label: z.name,
                value: vendidos,
                max: z.total,
                color: z.color,
                sub: `${disponible} libre`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('all');

  useEffect(() => {
    getEventDates().then(setEventDates).catch(console.error);

    const unsubscribe = subscribeToReservas((data) => {
      setReservas(data);
      setLoading(false);
    });
    const unsubVendors = subscribeToVendedores(setVendedores);
    return () => {
      unsubscribe();
      unsubVendors();
    };
  }, []);

  const totalVentas = reservas.length;
  const ingresosPagados = reservas.reduce((acc, curr) => acc + (curr.totalPaid || 0), 0);
  const pendientesValidar = reservas.filter(r => r.paymentStatus === 'pending' || r.paymentStatus === 'partial').length;
  const ventasEnCuotas = reservas.filter(r => r.paymentPlan === 'installments').length;

  // ─── Filtro por fecha para histogramas ─────────────────────────────────────
  const filteredReservas = selectedDate === 'all'
    ? reservas
    : reservas.filter(r => r.eventDateId === selectedDate || (!r.eventDateId && selectedDate === 'd1'));

  // ─── Histograma vendedores ─────────────────────────────────────────────────
  const vendedorItems: VertBarItem[] = vendedores.map(v => {
    const vReservas = filteredReservas.filter(r => r.vendedorId === v.id);
    const revenue = vReservas.reduce((acc, r) => acc + (r.totalPrice || 0), 0);
    return {
      label: v.name.split(' ')[0], // first name only for brevity
      value: vReservas.length,
      color: '#6366f1',
      secondaryLabel: `S/ ${revenue.toFixed(0)}`,
    };
  }).sort((a, b) => b.value - a.value);

  // Web sales (no vendedor)
  const webSales = filteredReservas.filter(r => !r.vendedorId).length;
  if (webSales > 0) {
    vendedorItems.push({ label: 'Web Directo', value: webSales, color: '#94a3b8', secondaryLabel: '' });
  }

  // ─── Histograma zonas vendidas ─────────────────────────────────────────────
  const zonaHistItems: VertBarItem[] = REAL_ZONAS.map(z => {
    let vendidos = 0;
    if (z.id === 'invitados' || z.id === 'staff') {
      vendidos = filteredReservas.filter(r => (r.method || '').toLowerCase() === z.id).length;
    } else {
      vendidos = filteredReservas.filter(r => r.zoneId === z.id || r.zoneName?.includes(z.name.split(' ')[0])).length;
    }
    return {
      label: z.name,
      value: vendidos,
      color: z.color,
      secondaryLabel: `/${z.total}`,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard General</h1>
          <p className="text-slate-500 text-sm mt-1">Métricas globales y distribución por fecha del evento.</p>
        </div>

        {/* Filtro de fecha global para histogramas */}
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-slate-400" />
          <select
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary font-semibold"
          >
            <option value="all">Todas las Fechas</option>
            {eventDates.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Top Stats ──────────────────────────────────────────────────────── */}
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

      {/* ── Ventas por Fecha ───────────────────────────────────────────────── */}
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

      {/* ── HISTOGRAMAS INTERACTIVOS ───────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          <h2 className="text-lg font-black text-slate-900">Histogramas Interactivos</h2>
          <span className="text-xs text-slate-400 font-medium ml-1">
            {selectedDate === 'all' ? '· Todas las fechas' : `· ${eventDates.find(d => d.id === selectedDate)?.name}`}
          </span>
        </div>

        {/* Histograma vendedores + Histograma zonas en 2 cols */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <VerticalHistogram
            items={vendedorItems}
            title="Ventas por Vendedor"
            subtitle="Número de entradas vendidas por cada vendedor"
            emptyText="No hay vendedores registrados"
          />
          <VerticalHistogram
            items={zonaHistItems}
            title="Entradas Vendidas por Zona"
            subtitle="Cantidad vendida vs capacidad total (label)"
            emptyText="Sin datos"
          />
        </div>

        {/* Histogramas de stock por fecha */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {(selectedDate === 'all' ? eventDates : eventDates.filter(d => d.id === selectedDate)).map(d => {
            const dateReservas = reservas.filter(r => r.eventDateId === d.id || (!r.eventDateId && d.id === 'd1'));
            return (
              <ZonaStockHistogram
                key={d.id}
                dateReservas={dateReservas}
                dateLabel={d.name}
              />
            );
          })}
        </div>
      </div>

      {/* ── TABLA REPORTE DE ZONAS ────────────────────────────────────────── */}
      <div className="space-y-4 pt-2">
        <h2 className="text-lg font-black text-slate-900">Reporte de Zonas y Stock (Detalle)</h2>
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
                        <th className="px-3 py-2 text-right">TOTAL</th>
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
                        const disponible = z.total - vendidos;
                        return (
                          <tr key={z.id}>
                            <td className="px-3 py-2 font-medium flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: z.color }}></span>
                              {z.name}
                            </td>
                            <td className="px-3 py-2 text-right">{z.total}</td>
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
