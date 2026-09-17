import React, { useState, useEffect } from 'react';
import SeatMap from '../components/SeatMap';
import { fetchDniData } from '../lib/api';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Tesseract from 'tesseract.js';
import { 
  CheckCircle, 
  Loader2, 
  Upload, 
  AlertCircle, 
  Calendar, 
  Clock, 
  Sparkles, 
  ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import { 
  subscribeToEventDates, 
  subscribeToEventSettings,
  type EventDate, 
  type EventSettings 
} from '../lib/firestore';
import { 
  ZONAS_MAP, 
  ZONE_PRICING, 
  getAutoStage, 
  DEFAULT_EVENT_DATES 
} from '../lib/constants';

interface FormData {
  fullName: string;
  dni: string;
  email: string;
  phone: string;
  certificateName: string;
  city: string;
}

const initialForm: FormData = {
  fullName: '',
  dni: '',
  email: '',
  phone: '',
  certificateName: '',
  city: '',
};

export default function Booking() {
  // Fechas y Configuración del Evento
  const [eventDates, setEventDates] = useState<EventDate[]>(DEFAULT_EVENT_DATES);
  const [selectedEventDateId, setSelectedEventDateId] = useState<string>('d1');
  const [settings, setSettings] = useState<EventSettings>({ pricingStage: 'auto', allowInstallments: true });
  const [paymentPlan, setPaymentPlan] = useState<'full' | 'installments'>('full');

  // Selección de Asiento
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState<FormData>(initialForm);
  const [isSearchingDni, setIsSearchingDni] = useState(false);
  const [dniError, setDniError] = useState('');
  const [dniFetched, setDniFetched] = useState(false);

  // Payment voucher / OCR State
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);
  const [operationNumber, setOperationNumber] = useState('');
  const [detectedAmount, setDetectedAmount] = useState<number | null>(null);
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [amountDetected, setAmountDetected] = useState<boolean>(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrDetected, setOcrDetected] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubDates = subscribeToEventDates((dates) => {
      const active = dates.filter(d => d.isActive);
      setEventDates(active);
      if (active.length > 0 && !active.some(d => d.id === selectedEventDateId)) {
        setSelectedEventDateId(active[0].id);
      }
    });

    const unsubSettings = subscribeToEventSettings((s) => {
      setSettings(s);
    });

    return () => {
      unsubDates();
      unsubSettings();
    };
  }, []);

  // Determinar etapa de precio y precios
  const currentStage = settings.pricingStage === 'auto' ? getAutoStage() : settings.pricingStage;
  const currentZoneDef = selectedZone ? ZONAS_MAP[selectedZone] : null;
  const currentZonePricing = selectedZone ? ZONE_PRICING[selectedZone]?.[currentStage] : null;

  const ticketCashPrice = currentZonePricing?.cash || 0;
  const canInstallments = settings.allowInstallments && !!currentZonePricing?.allowInstallments;
  const installmentAmount = currentZonePricing?.installmentAmount || ticketCashPrice / 2;

  // Monto a transferir hoy y monto total del ticket
  const expectedPaymentToday = (paymentPlan === 'installments' && canInstallments)
    ? installmentAmount
    : ticketCashPrice;

  const ticketTotalPrice = ticketCashPrice;
  const zoneName = currentZoneDef?.name || selectedZone || '';

  const selectedEventDate = eventDates.find(d => d.id === selectedEventDateId) || eventDates[0];

  const setField = (key: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectEventDate = (dateId: string) => {
    setSelectedEventDateId(dateId);
    // Reiniciar selección de asiento para evitar inconsistencias
    setSelectedZone(null);
    setSelectedSeat(null);
    setPaidAmount('');
    setAmountDetected(false);
  };

  const handleSelectSeat = (zoneId: string, seatId?: string) => {
    setSelectedZone(zoneId);
    setSelectedSeat(seatId || null);

    // Calcular el precio esperado para la zona y modalidad actual
    const zPricing = ZONE_PRICING[zoneId]?.[currentStage];
    const cash = zPricing?.cash || 0;
    const canInst = settings.allowInstallments && !!zPricing?.allowInstallments;
    
    // Si la zona no admite cuotas (ej. Bronce), forzar a full
    if (!canInst && paymentPlan === 'installments') {
      setPaymentPlan('full');
    }

    const expected = (paymentPlan === 'installments' && canInst)
      ? (zPricing?.installmentAmount || cash / 2)
      : cash;

    if (!amountDetected) {
      setPaidAmount(String(expected));
    }
  };

  const handleChangePaymentPlan = (plan: 'full' | 'installments') => {
    setPaymentPlan(plan);
    if (!amountDetected && currentZonePricing) {
      const expected = plan === 'installments' ? installmentAmount : ticketCashPrice;
      setPaidAmount(String(expected));
    }
  };

  const handleSearchDni = async () => {
    if (form.dni.length !== 8) {
      setDniError('El DNI debe tener 8 dígitos');
      return;
    }
    setDniError('');
    setIsSearchingDni(true);
    setDniFetched(false);
    try {
      const data = await fetchDniData(form.dni);
      setField('fullName', data.nombreCompleto);
      setDniFetched(true);
    } catch (error) {
      setDniError((error as Error).message + ' — Puede ingresar su nombre manualmente.');
      setField('fullName', '');
    } finally {
      setIsSearchingDni(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);
    setOcrDetected(false);
    setDetectedAmount(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setVoucherPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const result = await Tesseract.recognize(file, 'spa', { logger: () => {} });
      const text = result.data.text.replace(/\n/g, ' ');

      // 1. Buscar número de operación
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
      if (foundOp) {
        setOperationNumber(foundOp.toUpperCase());
        setOcrDetected(true);
      }

      // 2. Extraer monto pagado
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
        setDetectedAmount(foundVal);
        setPaidAmount(foundVal.toFixed(2));
        setAmountDetected(true);
      }
    } catch (err) {
      console.error('OCR error:', err);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const isFormValid = () => {
    const numPaid = parseFloat(paidAmount);
    return (
      selectedEventDateId &&
      selectedZone &&
      form.fullName.trim() &&
      form.dni.length === 8 &&
      form.email.includes('@') &&
      form.phone.length >= 9 &&
      operationNumber.trim() &&
      (!isNaN(numPaid) && numPaid > 0)
    );
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      setSubmitError('Por favor selecciona tu fecha, asiento, completa tus datos y adjunta tu comprobante.');
      return;
    }
    setSubmitError('');
    setIsSubmitting(true);

    try {
      const voucherBase64 = voucherPreview || null;
      const parsedPaid = parseFloat(paidAmount) || detectedAmount || expectedPaymentToday;
      const dateName = selectedEventDate ? `${selectedEventDate.name} (${selectedEventDate.dateText})` : 'Fecha Oficial';

      const newQrCode = `EVT-2026-${selectedEventDateId}-${form.dni.trim()}-${selectedSeat || 'GEN'}`;
      
      const docRef = await addDoc(collection(db, 'reservas'), {
        fullName: form.fullName.trim().toUpperCase(),
        dni: form.dni.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        certificateName: (form.certificateName.trim() || form.fullName.trim()).toUpperCase(),
        city: form.city.trim() || 'No especificada',
        eventDateId: selectedEventDateId,
        eventDateName: dateName,
        paymentPlan: paymentPlan,
        installmentNumber: paymentPlan === 'installments' ? 1 : 0,
        zoneId: selectedZone,
        zoneName: zoneName,
        seatId: selectedSeat || null,
        totalPrice: ticketTotalPrice,
        totalPaid: 0, // se confirma por admin
        payments: [{
          amount: parsedPaid,
          operationNumber: operationNumber.trim(),
          date: new Date().toISOString(),
          method: 'Transferencia/Yape/Plin',
          verified: false,
          voucherBase64: voucherBase64,
          detectedAmount: detectedAmount || parsedPaid,
        }],
        paymentStatus: 'pending',
        qrCode: newQrCode,
        attended: false,
        createdAt: serverTimestamp(),
      });

      setBookingId(docRef.id);

    } catch (err: any) {
      console.error('Error al guardar reserva:', err);
      setSubmitError('Ocurrió un error al procesar tu reserva. Intenta nuevamente o contáctanos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── SUCCESS SCREEN ───────────────────────────────────────────────────────────
  if (bookingId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 sm:p-10 flex flex-col items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="text-green-600 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">¡Reserva Registrada con Éxito!</h2>
          <p className="text-slate-500 text-sm">
            Tu comprobante ha sido recibido. El equipo administrativo validará tu pago y recibirás tu entrada oficial con código QR.
          </p>
          <div className="bg-slate-50 rounded-2xl p-5 w-full text-left space-y-2.5 border border-slate-200 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Fecha del Evento:</span>
              <span className="font-bold text-slate-900 text-right">{selectedEventDate?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Titular:</span>
              <span className="font-bold text-slate-900">{form.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">DNI:</span>
              <span className="font-mono font-bold text-slate-900">{form.dni}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Zona:</span>
              <span className="font-bold text-slate-900">{zoneName}</span>
            </div>
            {selectedSeat && (
              <div className="flex justify-between">
                <span className="text-slate-500">Butaca:</span>
                <span className="font-black text-primary text-base">{selectedSeat}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Modalidad:</span>
              <span className="font-bold text-slate-800">
                {paymentPlan === 'installments' ? '2 Cuotas (Cuota 1 enviada)' : 'Al Contado (100%)'}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 mt-1">
              <span className="text-slate-500 font-semibold">Total del Boleto:</span>
              <span className="font-black text-lg text-primary-dark">S/ {ticketTotalPrice.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Código de reserva: <span className="font-mono text-slate-600 font-medium">{bookingId.slice(0, 12).toUpperCase()}</span>
          </p>
          <a
            href="/tracking"
            className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition text-center block shadow-md"
          >
            Consultar Estado de Mi Entrada con DNI →
          </a>
        </div>
      </div>
    );
  }

  // ─── BOOKING FORM ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col gap-8">
      {/* Selector de Fechas del Evento (Paso 1) */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
              Paso 1: Elige tu Fecha
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2">¿Qué día deseas asistir?</h2>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 w-fit">
            <Sparkles size={14} className="text-amber-500" />
            Tarifa: {currentStage === 'preventa' ? '🔥 Preventa Activa' : 'Regular'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {eventDates.map((d) => {
            const isSelected = selectedEventDateId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => handleSelectEventDate(d.id)}
                className={clsx(
                  "p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between gap-3 group",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className={clsx("font-black text-base", isSelected ? "text-primary-dark" : "text-slate-800")}>
                      {d.name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                      <Calendar size={13} className="text-slate-400" /> {d.dateText}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                      <CheckCircle size={14} />
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <Clock size={12} /> {d.timeText}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Column: Seat Map (Paso 2) */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
                Paso 2: Elige tu Asiento
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">Mapa del Teatro</h2>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Fecha seleccionada:</span>
              <p className="text-xs font-bold text-slate-800">{selectedEventDate?.name}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 sm:p-6 overflow-hidden">
            <SeatMap 
              onSelectSeat={handleSelectSeat} 
              eventDateId={selectedEventDateId}
              selectedZone={selectedZone}
              selectedSeat={selectedSeat}
            />
          </div>
        </div>

        {/* Right Column: Booking Form (Paso 3) */}
        <div className="w-full lg:w-[430px] shrink-0">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sticky top-8 space-y-5">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
                Paso 3: Tus Datos y Pago
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2">Detalles de Reserva</h3>
            </div>

            {/* Resumen de Asiento y Zona */}
            <div className={clsx(
              "rounded-2xl p-4 border transition-all",
              selectedZone ? "bg-slate-50 border-slate-200" : "bg-amber-50/50 border-amber-200/60"
            )}>
              {selectedZone ? (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Fecha:</span>
                    <span className="font-bold text-slate-900 text-right">{selectedEventDate?.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Zona:</span>
                    <span className={clsx("font-bold px-2 py-0.5 rounded text-xs", currentZoneDef?.badgeBg)}>
                      {zoneName}
                    </span>
                  </div>
                  {selectedSeat && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Butaca seleccionada:</span>
                      <span className="font-black text-primary-dark text-base">{selectedSeat}</span>
                    </div>
                  )}

                  {/* Banner exclusivo de Workshop si es Iconic */}
                  {currentZoneDef?.workshopIncluded && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-600 shrink-0" />
                      <span>¡Solo la zona ICONIC incluye ingreso al WORKSHOP!</span>
                    </div>
                  )}

                  {/* Selector de Modalidad de Pago: Al Contado vs 2 Cuotas */}
                  {canInstallments && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <label className="block text-xs font-bold text-slate-700">Modalidad de Pago:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleChangePaymentPlan('full')}
                          className={clsx(
                            "p-2.5 rounded-xl border text-left transition text-xs flex flex-col justify-between",
                            paymentPlan === 'full'
                              ? "border-primary bg-primary/10 text-primary-dark font-black"
                              : "border-slate-200 hover:border-slate-300 text-slate-600"
                          )}
                        >
                          <span>Al Contado</span>
                          <span className="text-sm font-black mt-1">S/ {ticketCashPrice}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleChangePaymentPlan('installments')}
                          className={clsx(
                            "p-2.5 rounded-xl border text-left transition text-xs flex flex-col justify-between",
                            paymentPlan === 'installments'
                              ? "border-primary bg-primary/10 text-primary-dark font-black"
                              : "border-slate-200 hover:border-slate-300 text-slate-600"
                          )}
                        >
                          <span>En 2 Cuotas</span>
                          <span className="text-sm font-black mt-1">2x S/ {installmentAmount}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-1">
                    <div>
                      <span className="text-slate-500 font-semibold text-xs block">
                        {paymentPlan === 'installments' ? 'Pagas Hoy (Cuota 1):' : 'Total a Pagar:'}
                      </span>
                      {paymentPlan === 'installments' && (
                        <span className="text-[10px] text-slate-400">Total entrada: S/ {ticketTotalPrice}</span>
                      )}
                    </div>
                    <span className="font-black text-2xl text-primary-dark">
                      S/ {expectedPaymentToday.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-slate-500 text-xs">
                  <p className="font-semibold text-slate-700">Aún no has seleccionado butaca</p>
                  <p className="mt-0.5 text-slate-400">Haz clic sobre un asiento en el mapa interactivo para ver los precios y continuar.</p>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* DNI */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  DNI / CE <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={8}
                    value={form.dni}
                    onChange={(e) => {
                      setField('dni', e.target.value.replace(/\D/g, ''));
                      setDniFetched(false);
                    }}
                    placeholder="8 dígitos"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-mono"
                  />
                  <button
                    type="button"
                    disabled={form.dni.length !== 8 || isSearchingDni}
                    onClick={handleSearchDni}
                    className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition"
                  >
                    {isSearchingDni ? <Loader2 size={14} className="animate-spin" /> : 'Validar'}
                  </button>
                </div>
                {dniError && <p className="text-xs text-red-500 mt-1">{dniError}</p>}
                {dniFetched && <p className="text-xs text-green-600 mt-1">✅ Nombre autocompletado con éxito</p>}
              </div>

              {/* Nombres y Apellidos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombres y Apellidos <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setField('fullName', e.target.value)}
                  placeholder="JUAN PEREZ GOMEZ"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm uppercase"
                />
              </div>

              {/* Correo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correo Electrónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                />
              </div>

              {/* Celular */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Celular (WhatsApp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="987654321"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                />
              </div>

              {/* Comprobante de Pago */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Comprobante de Pago (Yape / Plin / Transferencia) <span className="text-red-500">*</span>
                </label>

                <label className="block cursor-pointer group">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <div className={clsx(
                    "border-2 border-dashed rounded-2xl p-4 text-center transition-all",
                    voucherPreview ? "border-green-400 bg-green-50/60" : "border-slate-300 bg-slate-50 hover:border-primary hover:bg-primary/5"
                  )}>
                    {voucherPreview ? (
                      <img src={voucherPreview} alt="Comprobante" className="max-h-36 mx-auto rounded-lg object-contain shadow-xs" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 py-2">
                        <Upload className="text-slate-400" size={24} />
                        <p className="text-slate-600 text-xs font-bold">Haz clic para subir la captura</p>
                        <p className="text-slate-400 text-[10px]">JPG, PNG · El sistema leerá el comprobante</p>
                      </div>
                    )}
                  </div>
                </label>

                {isOcrProcessing && (
                  <p className="text-xs text-primary font-bold mt-2 flex items-center gap-1.5 animate-pulse">
                    <Loader2 size={13} className="animate-spin" /> Leyendo comprobante con OCR...
                  </p>
                )}
              </div>

              {/* Número de Operación */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nro. de Operación <span className="text-red-500">*</span>
                  {ocrDetected && !isOcrProcessing && (
                    <span className="ml-2 text-[10px] text-green-600 font-semibold">✅ Detectado</span>
                  )}
                </label>
                <input
                  type="text"
                  value={operationNumber}
                  onChange={(e) => setOperationNumber(e.target.value)}
                  placeholder="Ej: 12428341"
                  className={clsx(
                    "w-full px-4 py-2.5 rounded-xl border outline-none font-mono text-sm tracking-wider",
                    ocrDetected && operationNumber ? "border-green-400 bg-green-50/50" : "border-slate-200 focus:border-primary"
                  )}
                />
              </div>

              {/* Monto Pagado / Adelanto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto Pagado / Adelanto (S/) <span className="text-red-500">*</span>
                  {amountDetected && !isOcrProcessing && (
                    <span className="ml-2 text-[10px] text-green-600 font-semibold">✅ Detectado del comprobante</span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">S/</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={paidAmount}
                    onChange={(e) => {
                      setPaidAmount(e.target.value);
                      setAmountDetected(false);
                    }}
                    placeholder={expectedPaymentToday > 0 ? expectedPaymentToday.toFixed(2) : "150.00"}
                    className={clsx(
                      "w-full pl-9 pr-4 py-2.5 rounded-xl border outline-none font-bold text-base",
                      amountDetected && paidAmount
                        ? "border-green-400 bg-green-50/50 text-green-800"
                        : "border-slate-200 focus:border-primary text-slate-900"
                    )}
                  />
                </div>
                {expectedPaymentToday > 0 && paidAmount && parseFloat(paidAmount) < expectedPaymentToday && (
                  <p className="text-xs text-amber-600 font-semibold mt-1">
                    ⚠️ Abono inferior al monto esperado (Falta S/ {(expectedPaymentToday - parseFloat(paidAmount)).toFixed(2)})
                  </p>
                )}
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-2xl transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Registrando Reserva...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} /> Confirmar Reserva
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
