import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Eye, 
  Download, 
  Search, 
  Calendar, 
  Clock, 
  PlusCircle, 
  Check, 
  Receipt,
  DollarSign,
  Edit
} from 'lucide-react';
import { clsx } from 'clsx';
import { generateTicketPDF } from '../../lib/pdfGenerator';
import { 
  subscribeToReservas, 
  updateReservaPaymentsAndTotal,
  updateReservaInfo,
  subscribeToVendedores,
  getEventDates,
  type Reserva, 
  type EventDate,
  type PaymentRecord,
  type Vendedor
} from '../../lib/firestore';

const statusBadge = {
  paid: 'bg-green-100 text-green-700 border border-green-300',
  partial: 'bg-amber-100 text-amber-700 border border-amber-300',
  pending: 'bg-slate-100 text-slate-600 border border-slate-300',
};
const statusLabel = { paid: 'Pagado', partial: 'Parcial', pending: 'Pendiente' };

export default function Sales() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'partial' | 'pending'>('all');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [sales, setSales] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [voucherModal, setVoucherModal] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  
  // Modal de edición de datos
  const [editingSale, setEditingSale] = useState<Reserva | null>(null);
  const [editForm, setEditForm] = useState<Partial<Reserva>>({});

  // Modal de gestión de abonos y validación
  const [managingSale, setManagingSale] = useState<Reserva | null>(null);
  const [editablePayments, setEditablePayments] = useState<PaymentRecord[]>([]);
  const [isSavingPayments, setIsSavingPayments] = useState(false);

  // Formulario para nuevo abono manual desde administración
  const [showAddManualPayment, setShowAddManualPayment] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualOp, setManualOp] = useState('');
  const [manualMethod, setManualMethod] = useState('Transferencia Bancaria');

  useEffect(() => {
    getEventDates().then(setEventDates).catch(console.error);

    const unsubscribe = subscribeToReservas((data) => {
      setSales(data.reverse());
      setLoading(false);
    });
    const unsubVendors = subscribeToVendedores(setVendedores);

    return () => {
      unsubscribe();
      unsubVendors();
    };
  }, []);

  // Abrir modal de gestión de abonos
  const handleOpenManagePayments = (sale: Reserva) => {
    setManagingSale(sale);
    // Clonar lista de pagos para edición local
    const paymentsList = (sale.payments || []).map(p => ({ ...p }));
    setEditablePayments(paymentsList);
    setShowAddManualPayment(false);
    setManualAmount('');
    setManualOp('');
  };

  // Toggle verificación de un abono individual
  const handleToggleVerifyPayment = (index: number) => {
    setEditablePayments(prev => {
      const next = [...prev];
      next[index] = { ...next[index], verified: !next[index].verified };
      return next;
    });
  };

  // Cambiar monto de un abono individual en caso de ajuste
  const handleAmountChange = (index: number, val: string) => {
    const num = parseFloat(val);
    setEditablePayments(prev => {
      const next = [...prev];
      next[index] = { ...next[index], amount: isNaN(num) ? 0 : num };
      return next;
    });
  };

  // Validar todos los abonos a la vez
  const handleVerifyAll = () => {
    setEditablePayments(prev => prev.map(p => ({ ...p, verified: true })));
  };

  // Agregar nuevo abono manual en el modal
  const handleAddManualPayment = () => {
    const amountNum = parseFloat(manualAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Por favor ingresa un monto válido.');
      return;
    }
    const newP: PaymentRecord = {
      amount: amountNum,
      operationNumber: manualOp.trim() || `MANUAL-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleString('es-PE'),
      method: manualMethod,
      verified: true, // Manual por admin nace verificado
      voucherBase64: null,
      note: 'Registrado directamente por administración'
    };

    setEditablePayments(prev => [...prev, newP]);
    setShowAddManualPayment(false);
    setManualAmount('');
    setManualOp('');
  };

  // Guardar y aplicar la sumatoria a Firestore
  const handleSavePayments = async () => {
    if (!managingSale?.id) return;
    setIsSavingPayments(true);
    try {
      await updateReservaPaymentsAndTotal(managingSale.id, editablePayments, managingSale.totalPrice);
      setManagingSale(null);
    } catch (err) {
      console.error('Error al actualizar pagos:', err);
      alert('Hubo un error al guardar los pagos.');
    } finally {
      setIsSavingPayments(false);
    }
  };

  const handleOpenEdit = (sale: Reserva) => {
    setEditingSale(sale);
    setEditForm({
      fullName: sale.fullName,
      dni: sale.dni,
      zoneName: sale.zoneName,
      seatId: sale.seatId,
      vendedorId: sale.vendedorId,
      vendedorName: sale.vendedorName
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSale?.id) return;
    try {
      await updateReservaInfo(editingSale.id, editForm);
      setEditingSale(null);
    } catch (err) {
      console.error(err);
      alert('Error guardando los datos');
    }
  };

  // Exportar CSV
  const exportCSV = () => {
    const headers = ['ID', 'Fecha Evento', 'Modalidad', 'Nombre', 'DNI', 'Email', 'Celular', 'Zona', 'Butaca', 'Total', 'Pagado', 'Abonos', 'Estado'];
    const rows = sales.map(s => [
      s.id,
      s.eventDateName || 'Día 1',
      s.paymentPlan === 'installments' ? '2 Cuotas' : 'Contado',
      s.fullName,
      s.dni,
      s.email,
      s.phone,
      s.zoneName,
      s.seatId || 'GEN',
      s.totalPrice,
      s.totalPaid,
      s.payments?.length || 0,
      s.paymentStatus
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ventas_butacas.csv";
    link.click();
  };

  const filtered = sales.filter(s => {
    const matchSearch = s.fullName.toLowerCase().includes(search.toLowerCase()) || s.dni.includes(search);
    const matchFilter = filter === 'all' || s.paymentStatus === filter;
    const matchDate = filterDate === 'all' || s.eventDateId === filterDate || (!s.eventDateId && filterDate === 'd1');
    return matchSearch && matchFilter && matchDate;
  });

  const totalPaidCount = sales.filter(s => s.paymentStatus === 'paid').length;
  const totalPartialCount = sales.filter(s => s.paymentStatus === 'partial').length;
  const totalPendingCount = sales.filter(s => s.paymentStatus === 'pending').length;

  // Cálculos en tiempo real dentro del modal
  const modalTotalPrice = managingSale?.totalPrice || 0;
  const modalVerifiedTotal = editablePayments
    .filter(p => p.verified)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const modalSaldoPendiente = Math.max(0, modalTotalPrice - modalVerifiedTotal);
  const modalNewStatus = modalVerifiedTotal >= modalTotalPrice ? 'paid' : modalVerifiedTotal > 0 ? 'partial' : 'pending';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ventas y Gestión de Pagos</h1>
          <p className="text-slate-500 text-sm mt-1">Supervisa las ventas, valida abonos parciales y autoriza la emisión de entradas oficiales.</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-slate-800 transition shadow-sm">
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 p-4 rounded-2xl">
          <p className="text-green-600 text-sm font-medium">✅ Pagados Completos</p>
          <p className="text-3xl font-black text-green-800 mt-1">{totalPaidCount}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
          <p className="text-amber-600 text-sm font-medium">⏳ Pagos Parciales (Abonando)</p>
          <p className="text-3xl font-black text-amber-800 mt-1">{totalPartialCount}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
          <p className="text-slate-500 text-sm font-medium">🕐 Sin Pagos Validados</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{totalPendingCount}</p>
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
            placeholder="Buscar por nombre o DNI..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>

        {/* Filtro por Fecha del Evento */}
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400 shrink-0" />
          <select
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          >
            <option value="all">Todas las Fechas</option>
            {eventDates.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Filtro por Estado de Pago */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'paid', 'partial', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-3 py-2 rounded-xl text-xs font-bold transition",
                filter === f ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {f === 'all' ? 'Todos' : statusLabel[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Persona', 'DNI', 'Zona / Butaca', 'Estado', 'Pagado / Total', 'Historial Abonos', 'Fecha Registro', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(sale => {
                const dateStr = sale.createdAt && (sale.createdAt as any).toDate 
                  ? (sale.createdAt as any).toDate().toLocaleString() 
                  : '—';

                const paymentsCount = sale.payments?.length || 0;
                const unverifiedCount = sale.payments?.filter(p => !p.verified).length || 0;
                const saldo = Math.max(0, sale.totalPrice - sale.totalPaid);

                return (
                <tr key={sale.id} className="hover:bg-slate-50 transition">
                  {/* Persona */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-bold text-slate-900">{sale.fullName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        {sale.eventDateName?.split('(')[0]?.trim() || 'Día 1'}
                      </span>
                      {sale.paymentPlan === 'installments' && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          2 Cuotas
                        </span>
                      )}
                    </div>
                  </td>

                  {/* DNI */}
                  <td className="px-4 py-3 text-slate-500 font-mono">{sale.dni}</td>

                  {/* Zona / Butaca */}
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    <span className="font-medium">{sale.zoneName}</span>
                    <span className="text-primary-dark font-black ml-2">{sale.seatId || '—'}</span>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-1 rounded-full text-xs font-bold', statusBadge[sale.paymentStatus])}>
                      {statusLabel[sale.paymentStatus]}
                    </span>
                  </td>

                  {/* Pagado / Total (Sumatoria) */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${sale.paymentStatus === 'paid' ? 'bg-green-500' : 'bg-amber-500'}`} 
                            style={{ width: `${Math.min(100, (sale.totalPaid / sale.totalPrice) * 100)}%` }} 
                          />
                        </div>
                        <span className="text-slate-800 text-xs font-bold">
                          S/ {sale.totalPaid.toFixed(2)} / S/ {sale.totalPrice.toFixed(2)}
                        </span>
                      </div>
                      {saldo > 0 ? (
                        <p className="text-[10px] text-amber-700 font-semibold">Resta: S/ {saldo.toFixed(2)}</p>
                      ) : (
                        <p className="text-[10px] text-green-600 font-bold">✓ Pagado 100%</p>
                      )}
                    </div>
                  </td>

                  {/* Historial Abonos y Alerta de Pendientes */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Receipt size={13} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">
                          {paymentsCount} {paymentsCount === 1 ? 'abono' : 'abonos'}
                        </span>
                      </div>
                      {unverifiedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 animate-pulse">
                          <Clock size={10} /> {unverifiedCount} por validar
                        </span>
                      ) : paymentsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
                          <Check size={10} /> Todos validados
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Sin abonos</span>
                      )}
                    </div>
                  </td>

                  {/* Fecha Registro */}
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{dateStr}</td>

                  {/* Acciones */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {/* Botón Principal: Gestionar Abonos / Validar */}
                      <button 
                        title="Gestionar Abonos y Validar Pagos" 
                        onClick={() => handleOpenManagePayments(sale)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-xs ${
                          unverifiedCount > 0
                            ? 'bg-amber-600 hover:bg-amber-700 text-white animate-bounce'
                            : sale.paymentStatus === 'paid'
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-primary hover:bg-primary-dark text-white'
                        }`}
                      >
                        <DollarSign size={14} />
                        <span>Abonos ({paymentsCount})</span>
                      </button>

                      {/* Descargar Boleto PDF */}
                      <button
                        title="Descargar Boleto PDF"
                        onClick={() => {
                          if (sale.id) {
                            generateTicketPDF({
                              id: sale.id,
                              fullName: sale.fullName,
                              dni: sale.dni,
                              email: sale.email,
                              phone: sale.phone,
                              certificateName: sale.certificateName || sale.fullName,
                              city: sale.city || '',
                              zoneName: sale.zoneName,
                              seatNumber: sale.seatId || undefined,
                              price: sale.totalPrice,
                              eventDateName: sale.eventDateName,
                              paymentPlan: sale.paymentPlan,
                              qrCode: sale.qrCode || `EVT-2026-${sale.dni}-${sale.seatId || 'GEN'}`,
                              status: sale.paymentStatus === 'paid' ? 'APROBADO' : 'PENDIENTE'
                            });
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition"
                      >
                        <Download size={16} />
                      </button>

                      {/* Editar Información */}
                      <button
                        title="Editar Información"
                        onClick={() => handleOpenEdit(sale)}
                        className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition"
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg font-medium">Sin resultados</p>
              <p className="text-sm">Intenta con otro nombre o DNI</p>
            </div>
          )}
          {loading && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg font-medium">Cargando ventas...</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL PRINCIPAL: GESTIÓN DE ABONOS Y VALIDACIÓN ACUMULADA */}
      {/* ========================================================= */}
      {managingSale && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto" onClick={() => setManagingSale(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-8" onClick={e => e.stopPropagation()}>
            
            {/* Cabecera del modal */}
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <Receipt className="text-primary" size={20} />
                  Gestión y Validación de Abonos
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  {managingSale.fullName} · DNI {managingSale.dni} · {managingSale.zoneName} ({managingSale.seatId || 'General'})
                </p>
              </div>
              <button 
                onClick={() => setManagingSale(null)}
                className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 flex items-center justify-center font-bold text-base transition"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Tarjetas de Resumen Financiero en Tiempo Real */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-center">
                  <p className="text-slate-500 text-[11px] font-bold uppercase">Total Entrada</p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">S/ {modalTotalPrice.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 border border-green-200 p-3.5 rounded-2xl text-center">
                  <p className="text-green-700 text-[11px] font-bold uppercase">Total Validador (Suma)</p>
                  <p className="text-xl font-black text-green-700 mt-0.5">S/ {modalVerifiedTotal.toFixed(2)}</p>
                </div>
                <div className={`p-3.5 rounded-2xl text-center border ${modalSaldoPendiente > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                  <p className={`text-[11px] font-bold uppercase ${modalSaldoPendiente > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                    {modalSaldoPendiente > 0 ? 'Saldo Restante' : 'Estado Final'}
                  </p>
                  <p className={`text-xl font-black mt-0.5 ${modalSaldoPendiente > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                    {modalSaldoPendiente > 0 ? `S/ ${modalSaldoPendiente.toFixed(2)}` : '✓ 100% Pagado'}
                  </p>
                </div>
              </div>

              {/* Banner de Estado Resultante */}
              <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                modalNewStatus === 'paid'
                  ? 'bg-green-50 border-green-300 text-green-800'
                  : modalNewStatus === 'partial'
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}>
                <span>
                  {modalNewStatus === 'paid' && '🎉 Al guardar, la entrada quedará marcada como PAGADA y el cliente podrá descargar su boleto con QR oficial.'}
                  {modalNewStatus === 'partial' && `⚠️ Pago Parcial: el cliente registra abonos pero aún le falta cancelar S/ ${modalSaldoPendiente.toFixed(2)}. El QR se mantiene bloqueado hasta el 100%.`}
                  {modalNewStatus === 'pending' && '🕐 Sin abonos verificados: la entrada se mantiene en estado PENDIENTE.'}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 ${statusBadge[modalNewStatus]}`}>
                  {statusLabel[modalNewStatus]}
                </span>
              </div>

              {/* Botón para validar todos rápidamente */}
              {editablePayments.some(p => !p.verified) && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleVerifyAll}
                    className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                  >
                    <CheckCircle size={14} /> Marcar todos los abonos como Validados
                  </button>
                </div>
              )}

              {/* Lista de Abonos Registrados */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Abonos del Cliente ({editablePayments.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddManualPayment(!showAddManualPayment)}
                    className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 transition"
                  >
                    <PlusCircle size={14} /> {showAddManualPayment ? 'Ocultar formulario' : '+ Agregar Abono Manual'}
                  </button>
                </div>

                {/* Formulario desplegable para agregar abono manual por administración */}
                {showAddManualPayment && (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Registrar abono recibido directamente por administración</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Monto (S/)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Ej: 100.00"
                          value={manualAmount}
                          onChange={e => setManualAmount(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">N° Operación</label>
                        <input
                          type="text"
                          placeholder="Opcional / Nro de ticket"
                          value={manualOp}
                          onChange={e => setManualOp(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Método</label>
                        <select
                          value={manualMethod}
                          onChange={e => setManualMethod(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="Transferencia Bancaria">Transferencia</option>
                          <option value="Efectivo en Caja">Efectivo</option>
                          <option value="Yape">Yape</option>
                          <option value="Plin">Plin</option>
                          <option value="POS / Tarjeta">POS / Tarjeta</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddManualPayment(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddManualPayment}
                        className="px-4 py-1.5 text-xs font-bold bg-primary text-white hover:bg-primary-dark rounded-xl transition"
                      >
                        Agregar Abono
                      </button>
                    </div>
                  </div>
                )}

                {editablePayments.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400">
                    <Receipt size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-bold text-slate-600">No hay pagos ni abonos registrados</p>
                    <p className="text-xs mt-0.5">El cliente aún no ha subido comprobantes o puedes registrar un abono manual arriba.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editablePayments.map((p, idx) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-2xl border transition-all ${
                          p.verified 
                            ? 'bg-green-50/50 border-green-200' 
                            : 'bg-amber-50/50 border-amber-200 ring-1 ring-amber-300'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          
                          {/* Info del Abono */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-sm">Abono #{idx + 1}</span>
                              <span className="font-mono text-xs font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md">
                                Op: {p.operationNumber || 'Sin número'}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">{p.method}</span>
                            </div>

                            <p className="text-[11px] text-slate-400">
                              📅 {p.date} {p.note ? `· ${p.note}` : ''}
                            </p>

                            {/* Badge OCR si existe */}
                            {p.detectedAmount != null && (
                              <p className="text-[11px] font-bold text-slate-600">
                                🤖 OCR detectó en captura: <span className="text-primary font-black">S/ {p.detectedAmount.toFixed(2)}</span>
                              </p>
                            )}

                            {/* Botón ver comprobante */}
                            {p.voucherBase64 && (
                              <button
                                type="button"
                                onClick={() => setVoucherModal(p.voucherBase64!)}
                                className="text-primary font-bold text-xs hover:underline inline-flex items-center gap-1 mt-1"
                              >
                                <Eye size={13} /> 👁️ Ver captura de comprobante ({p.operationNumber || 'voucher'})
                              </button>
                            )}
                          </div>

                          {/* Ajuste de Monto y Switch de Verificación */}
                          <div className="flex items-center gap-3 self-end md:self-center">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Monto Real (S/)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={p.amount}
                                onChange={e => handleAmountChange(idx, e.target.value)}
                                className="w-24 px-2.5 py-1.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 bg-white outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleVerifyPayment(idx)}
                              className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
                                p.verified
                                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-xs'
                                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                              }`}
                            >
                              {p.verified ? (
                                <>
                                  <CheckCircle size={14} /> Validado
                                </>
                              ) : (
                                <>
                                  <Clock size={14} /> Validar Abono
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer con botones de confirmación */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Total acumulado verificado: <span className="font-bold text-slate-900">S/ {modalVerifiedTotal.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setManagingSale(null)} 
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-white transition text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  disabled={isSavingPayments}
                  onClick={handleSavePayments} 
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition text-xs flex items-center gap-1.5 shadow-md"
                >
                  {isSavingPayments ? 'Guardando...' : 'Guardar y Actualizar Estado'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal Pantalla Completa para Ver Comprobante */}
      {voucherModal && (
        <div 
          className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setVoucherModal(null)}
        >
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Receipt size={16} className="text-primary" />
                Captura de Comprobante de Pago
              </h3>
              <button 
                onClick={() => setVoucherModal(null)} 
                className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 flex items-center justify-center font-bold text-sm"
              >
                &times;
              </button>
            </div>
            <div className="p-4 bg-slate-900/5 flex items-center justify-center">
              <img 
                src={voucherModal} 
                alt="Comprobante de Pago" 
                className="w-full h-auto rounded-2xl object-contain max-h-[75vh] shadow-inner" 
              />
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setVoucherModal(null)}
                className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA EDITAR INFORMACIÓN DE RESERVA */}
      {editingSale && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto" onClick={() => setEditingSale(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Edit size={18} className="text-blue-500" /> Editar Reserva
              </h3>
              <button onClick={() => setEditingSale(null)} className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 flex items-center justify-center font-bold text-base transition">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={editForm.fullName || ''} 
                  onChange={e => setEditForm({...editForm, fullName: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">DNI</label>
                <input 
                  type="text" 
                  value={editForm.dni || ''} 
                  onChange={e => setEditForm({...editForm, dni: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Zona</label>
                  <input 
                    type="text" 
                    value={editForm.zoneName || ''} 
                    onChange={e => setEditForm({...editForm, zoneName: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Butaca</label>
                  <input 
                    type="text" 
                    value={editForm.seatId || ''} 
                    onChange={e => setEditForm({...editForm, seatId: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Vendedor</label>
                <select
                  value={editForm.vendedorId || ''}
                  onChange={e => {
                    const v = vendedores.find(x => x.id === e.target.value);
                    setEditForm({...editForm, vendedorId: v?.id || '', vendedorName: v?.name || ''});
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                >
                  <option value="">Sin Vendedor (Cliente Web)</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setEditingSale(null)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition text-sm font-semibold">Cancelar</button>
              <button onClick={handleSaveEdit} className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-bold shadow-md">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
