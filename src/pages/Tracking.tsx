import { useState } from 'react';
import { 
  Search, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Download, 
  Lock, 
  PlusCircle, 
  Upload, 
  Loader2, 
  Eye, 
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { generateTicketPDF } from '../lib/pdfGenerator';
import { getReservaByDni, addReservaPayment, type Reserva, type PaymentRecord } from '../lib/firestore';
import Tesseract from 'tesseract.js';
import { clsx } from 'clsx';

const statusConfig = {
  paid: { label: 'Pago Completo (Boleto Activo)', color: 'text-green-700 bg-green-100 border-green-300', icon: CheckCircle },
  partial: { label: 'Pago Parcial (Saldo Pendiente)', color: 'text-amber-700 bg-amber-100 border-amber-300', icon: Clock },
  pending: { label: 'Pendiente de Validación', color: 'text-slate-600 bg-slate-100 border-slate-300', icon: AlertCircle },
};

export default function TrackingPortal() {
  const [dni, setDni] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [ticket, setTicket] = useState<Reserva | null>(null);
  const [error, setError] = useState('');

  // Modal para registrar nuevo abono
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);
  const [operationNumber, setOperationNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Yape');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [amountDetected, setAmountDetected] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');

  // Visor de comprobante
  const [viewVoucherModal, setViewVoucherModal] = useState<string | null>(null);

  const handleSearch = async () => {
    if (dni.length !== 8) { setError('El DNI debe tener 8 dígitos'); return; }
    setError('');
    setIsSearching(true);
    
    try {
      const result = await getReservaByDni(dni);
      if (result) {
        setTicket(result);
      } else {
        setError('No se encontró ninguna reserva asociada a este DNI.');
        setTicket(null);
      }
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al consultar tu reserva.');
      setTicket(null);
    }
    
    setIsSearching(false);
  };

  const openNewPaymentModal = () => {
    if (!ticket) return;
    const remaining = Math.max(0, ticket.totalPrice - ticket.totalPaid);
    setAmount(remaining > 0 ? remaining.toFixed(2) : '');
    setOperationNumber('');
    setVoucherPreview(null);
    setPaymentDate(new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }));
    setPaymentMethod('Yape');
    setAmountDetected(false);
    setPaymentSuccessMsg('');
    setIsPaymentModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);
    setAmountDetected(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setVoucherPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const result = await Tesseract.recognize(file, 'spa', { logger: () => {} });
      const text = result.data.text.replace(/\n/g, ' ');

      // 1. Extraer número de operación
      const opRegex = /(?:operaci[oó]n|op\.?|nro\.?|n[uú]mero|ref\.?|c[oó]digo|code)[:\s.-]*#?\s*([A-Za-z0-9]{6,15})/i;
      const opMatch = text.match(opRegex);
      let foundOp = '';
      if (opMatch?.[1] && !/operaci/i.test(opMatch[1]) && !/numero/i.test(opMatch[1])) {
        foundOp = opMatch[1];
      } else {
        const fallbackMatch = text.match(/\b([A-Za-z0-9]*\d[A-Za-z0-9]*){6,15}\b/);
        if (fallbackMatch) {
          foundOp = fallbackMatch[0];
        }
      }
      if (foundOp) setOperationNumber(foundOp.toUpperCase());

      // 2. Extraer monto
      const clean = text.replace(/[\r\n]+/g, ' ');
      const amountPatterns = [
        /[Ss$][\/\.\s|!Il1]{1,3}\s*(\d{1,4}[.,]\d{2})/i,
        /(?:S\/|S1)\s*(\d{1,4}[.,]\d{2})/i,
        /(?:yapeaste|pagaste|enviaste|transferiste|importe)[^\d]*(\d{1,4}[.,]\d{2})/i,
        /(?:monto|total|importe|precio)[\s:]*S?[\/\.]?\s*(\d{1,4}[.,]\d{2})/i,
        /(\d{1,4}[.,]\d{2})\s*(?:soles|pen|soies)/i,
      ];

      let foundVal: number | null = null;
      for (const pattern of amountPatterns) {
        const amountMatch = clean.match(pattern);
        if (amountMatch?.[1]) {
          const parsed = parseFloat(amountMatch[1].replace(',', '.'));
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 9999) {
            foundVal = parsed;
            break;
          }
        }
      }

      if (foundVal === null) {
        const allDecimals = [...clean.matchAll(/\b(\d{1,4}[.,]\d{2})\b/g)];
        for (const m of allDecimals) {
          const parsed = parseFloat(m[1].replace(',', '.'));
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 9999) {
            foundVal = parsed;
            break;
          }
        }
      }

      if (foundVal !== null) {
        setAmount(foundVal.toFixed(2));
        setAmountDetected(true);
      }

      // 3. Extraer Fecha y Hora
      const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:de\s+)?[a-z]+\s+(?:de\s+)?\d{4})/i;
      const timeRegex = /(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[aApP]\.?\s*[mM]\.?)?)/i;
      
      const dateMatch = clean.match(dateRegex);
      const timeMatch = clean.match(timeRegex);
      
      if (dateMatch || timeMatch) {
        const d = dateMatch ? dateMatch[0] : '';
        const t = timeMatch ? timeMatch[0] : '';
        if (d || t) {
          setPaymentDate(`${d} ${t}`.trim());
        }
      }
    } catch (err) {
      console.error('OCR Error:', err);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleSubmitNewPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket?.id) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Por favor ingresa un monto válido.');
      return;
    }
    if (!operationNumber.trim()) {
      alert('Por favor ingresa el número de operación.');
      return;
    }
    if (!voucherPreview) {
      alert('Por favor adjunta la captura del comprobante.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const newPayment: PaymentRecord = {
        amount: parsedAmount,
        operationNumber: operationNumber.trim(),
        date: paymentDate.trim() || new Date().toLocaleString('es-PE'),
        method: paymentMethod,
        verified: false,
        voucherBase64: voucherPreview,
        detectedAmount: amountDetected ? parsedAmount : null,
      };

      await addReservaPayment(ticket.id, newPayment);

      // Refrescar los datos del ticket
      const updated = await getReservaByDni(dni);
      if (updated) setTicket(updated);

      setIsPaymentModalOpen(false);
      setPaymentSuccessMsg('¡Abono registrado con éxito! El equipo de administración revisará tu comprobante.');
      setTimeout(() => setPaymentSuccessMsg(''), 6000);
    } catch (err) {
      console.error(err);
      alert('Error al registrar el abono. Por favor intenta nuevamente.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const status = ticket ? statusConfig[ticket.paymentStatus] : null;
  const StatusIcon = status?.icon;
  const saldoPendiente = ticket ? Math.max(0, ticket.totalPrice - ticket.totalPaid) : 0;
  const isFullyPaid = ticket?.paymentStatus === 'paid';

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 w-full">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-slate-900">Consulta de Entrada y Pagos</h2>
        <p className="text-slate-500 mt-2">
          Ingresa tu DNI para ver el estado de tu reserva, registrar nuevos abonos y descargar tu entrada oficial una vez pagada al 100%.
        </p>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mb-6">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Número de DNI / CE
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-lg font-mono tracking-widest font-bold"
            placeholder="12345678"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || dni.length !== 8}
            className="px-6 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-2xl transition flex items-center gap-2 disabled:bg-slate-400 shrink-0 shadow-md shadow-primary/20"
          >
            {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            Consultar
          </button>
        </div>
        {error && <p className="text-red-500 text-xs font-semibold mt-2 flex items-center gap-1"><XCircle size={15} /> {error}</p>}
      </div>

      {paymentSuccessMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-sm font-bold flex items-center gap-2">
          <CheckCircle size={18} className="text-green-600 shrink-0" />
          <span>{paymentSuccessMsg}</span>
        </div>
      )}

      {/* Ticket Card */}
      {ticket && status && StatusIcon && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-0">
          {/* Status Header */}
          <div className={`p-5 border-b flex items-center gap-3 ${status.color}`}>
            <StatusIcon size={26} className="shrink-0" />
            <div>
              <p className="font-black text-lg">{status.label}</p>
              <p className="text-xs font-semibold opacity-90">
                Pagado verificado: S/ {ticket.totalPaid.toFixed(2)} de S/ {ticket.totalPrice.toFixed(2)}
              </p>
            </div>
            {/* Progress Bar */}
            <div className="ml-auto w-24 sm:w-32 h-2.5 bg-black/10 rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-current rounded-full transition-all"
                style={{ width: `${Math.min(100, (ticket.totalPaid / ticket.totalPrice) * 100)}%` }}
              />
            </div>
          </div>

          {/* Ticket Details */}
          <div className="p-6 grid grid-cols-2 gap-4">
            <div className="col-span-2 bg-primary/5 border border-primary/20 rounded-2xl p-3.5">
              <p className="text-xs text-primary font-bold uppercase tracking-wider">Fecha del Evento / Función</p>
              <p className="font-black text-slate-900 text-base mt-0.5">{ticket.eventDateName || 'Día 1 - 09 de Noviembre'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Asistente</p>
              <p className="font-bold text-slate-900 mt-0.5 text-sm">{ticket.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">DNI</p>
              <p className="font-bold text-slate-900 font-mono mt-0.5 text-sm">{ticket.dni}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Zona</p>
              <p className="font-bold text-slate-900 mt-0.5 text-sm">{ticket.zoneName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Butaca Asignada</p>
              <p className="font-black text-primary-dark text-xl mt-0.5">{ticket.seatId || 'GEN'}</p>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-100 flex justify-between items-center text-sm">
              <span className="text-slate-500 font-semibold">Total del Boleto:</span>
              <span className="font-black text-lg text-slate-900">S/ {ticket.totalPrice.toFixed(2)}</span>
            </div>
            {saldoPendiente > 0 && (
              <div className="col-span-2 flex justify-between items-center text-sm bg-amber-50 p-3 rounded-xl border border-amber-200">
                <span className="text-amber-800 font-bold">Saldo Pendiente:</span>
                <span className="font-black text-base text-amber-900">S/ {saldoPendiente.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Historial de Pagos y Abonos */}
          <div className="px-6 pb-6 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Historial de Pagos ({ticket.payments?.length || 0})
              </h4>
              {saldoPendiente > 0 && (
                <button
                  type="button"
                  onClick={openNewPaymentModal}
                  className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 transition"
                >
                  <PlusCircle size={15} /> Registrar Abono
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {ticket.payments?.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-2xl p-3.5 border border-slate-100 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">Abono #{i + 1}</span>
                      <span className="text-slate-500 font-mono text-[11px]">Op. #{p.operationNumber || '—'}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5">{p.date} · {p.method}</p>
                    {p.voucherBase64 && (
                      <button
                        type="button"
                        onClick={() => setViewVoucherModal(p.voucherBase64!)}
                        className="text-primary font-bold text-[11px] hover:underline flex items-center gap-1 mt-1"
                      >
                        <Eye size={12} /> Ver comprobante adjunto
                      </button>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm text-slate-900">S/ {p.amount.toFixed(2)}</p>
                    {p.verified ? (
                      <span className="text-green-600 font-bold text-[10px] bg-green-50 px-2 py-0.5 rounded-full border border-green-200 inline-flex items-center gap-1 mt-0.5">
                        <CheckCircle size={10} /> Validado
                      </span>
                    ) : (
                      <span className="text-amber-600 font-bold text-[10px] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 inline-flex items-center gap-1 mt-0.5">
                        <Clock size={10} /> En revisión
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Acciones: Descarga QR vs Bloqueo por saldo pendiente */}
          <div className="p-6 border-t border-slate-100 space-y-3">
            {isFullyPaid ? (
              // PAGO COMPLETO -> DESCARGA HABILITADA
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-xs font-semibold flex items-center gap-2">
                  <ShieldCheck size={18} className="text-green-600 shrink-0" />
                  <span>Tu pago ha sido completado y verificado. Tu entrada oficial y código QR están listos.</span>
                </div>

                <button
                  onClick={() => generateTicketPDF({
                    id: ticket.id || ticket.dni,
                    fullName: ticket.fullName,
                    dni: ticket.dni,
                    email: ticket.email,
                    phone: ticket.phone,
                    certificateName: ticket.certificateName || ticket.fullName,
                    city: ticket.city || '',
                    zoneName: ticket.zoneName,
                    seatNumber: ticket.seatId || undefined,
                    price: ticket.totalPrice,
                    eventDateName: ticket.eventDateName,
                    paymentPlan: ticket.paymentPlan,
                    qrCode: ticket.qrCode || `EVT-2026-${ticket.dni}-${ticket.seatId || 'GEN'}`,
                    status: 'APROBADO'
                  })}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 text-sm"
                >
                  <Download size={20} />
                  Descargar Entrada Oficial con Código QR (PDF)
                </button>
              </div>
            ) : (
              // PAGO PARCIAL / PENDIENTE -> BLOQUEO DE QR
              <div className="space-y-3">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-black text-sm text-amber-800">
                    <Lock size={16} />
                    Código QR y Entrada Oficial Bloqueados
                  </div>
                  <p className="leading-relaxed">
                    Tu entrada se emitirá y el código QR de acceso se desbloqueará una vez que se complete el pago total (Saldo restante: <strong>S/ {saldoPendiente.toFixed(2)}</strong>).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openNewPaymentModal}
                  className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 shadow-md shadow-primary/20 text-sm"
                >
                  <CreditCard size={18} />
                  Registrar Nuevo Abono / Pago (Falta S/ {saldoPendiente.toFixed(2)})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para Registrar Nuevo Abono */}
      {isPaymentModalOpen && ticket && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-xl font-black text-slate-900">Registrar Nuevo Abono</h3>
              <p className="text-slate-500 text-xs mt-1">
                {ticket.fullName} · {ticket.zoneName} ({ticket.seatId || 'GEN'})
              </p>
              <div className="mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs flex justify-between">
                <span className="text-amber-800 font-semibold">Saldo total pendiente:</span>
                <span className="font-black text-amber-900">S/ {saldoPendiente.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitNewPayment} className="space-y-3.5">
              {/* Comprobante Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Captura del Comprobante (Yape / Plin / Banco) <span className="text-red-500">*</span>
                </label>
                <label className="block cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <div className={clsx(
                    "border-2 border-dashed rounded-2xl p-4 text-center transition-all",
                    voucherPreview ? "border-green-400 bg-green-50/60" : "border-slate-300 bg-slate-50 hover:border-primary"
                  )}>
                    {voucherPreview ? (
                      <img src={voucherPreview} alt="Comprobante" className="max-h-32 mx-auto rounded-lg object-contain shadow-xs" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 py-1">
                        <Upload className="text-slate-400" size={22} />
                        <p className="text-slate-600 text-xs font-bold">Subir foto del comprobante</p>
                        <p className="text-slate-400 text-[10px]">JPG, PNG · El OCR leerá el monto y operación</p>
                      </div>
                    )}
                  </div>
                </label>

                {isOcrProcessing && (
                  <p className="text-xs text-primary font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                    <Loader2 size={12} className="animate-spin" /> Leyendo comprobante...
                  </p>
                )}
              </div>

              {/* Monto Abonado */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto de este Abono (S/) <span className="text-red-500">*</span>
                  {amountDetected && (
                    <span className="ml-2 text-[10px] text-green-600 font-semibold">✅ Detectado</span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">S/</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={amount}
                    onChange={e => {
                      setAmount(e.target.value);
                      setAmountDetected(false);
                    }}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none font-bold text-base focus:border-primary"
                  />
                </div>
              </div>

              {/* Nro Operación */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nro. de Operación <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={operationNumber}
                  onChange={e => setOperationNumber(e.target.value)}
                  placeholder="Ej: 12428341"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none font-mono text-sm tracking-wider focus:border-primary"
                />
              </div>

              {/* Método y Fecha */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Método</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none bg-white"
                  >
                    <option value="Yape">Yape</option>
                    <option value="Plin">Plin</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia BCP">Transferencia BCP</option>
                    <option value="Transferencia BBVA">Transferencia BBVA</option>
                    <option value="Transferencia Interbank">Transferencia Interbank</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha y Hora</label>
                  <input
                    type="text"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    placeholder="13/09/2026, 16:30"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingPayment ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Enviar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visor de Comprobante */}
      {viewVoucherModal && (
        <div 
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setViewVoucherModal(null)}
        >
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Comprobante de Abono</h3>
              <button onClick={() => setViewVoucherModal(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img src={viewVoucherModal} alt="Comprobante" className="max-w-full h-auto rounded-xl object-contain shadow" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
