import { useState, useEffect } from 'react';
import { Camera, CameraOff, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getReservaByQr, markReservaAsAttended, type Reserva } from '../../lib/firestore';

type ScanResult = 'valid' | 'used' | 'invalid' | 'unpaid' | null;

export default function QRScanner() {
  const [cameraOn, setCameraOn] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [scannedTicket, setScannedTicket] = useState<Reserva | null>(null);
  const [lastScannedId, setLastScannedId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [html5QrCode]);

  const startCamera = async () => {
    try {
      const qrCode = new Html5Qrcode("qr-reader");
      setHtml5QrCode(qrCode);
      setCameraOn(true);
      
      await qrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!isValidating) {
            qrCode.stop().then(() => setCameraOn(false)).catch(console.error);
            validateTicket(decodedText);
          }
        },
        () => {
          // ignore scan errors
        }
      );
    } catch (err) {
      alert('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
      setCameraOn(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCode && html5QrCode.isScanning) {
      await html5QrCode.stop();
    }
    setCameraOn(false);
    setScanResult(null);
    setScannedTicket(null);
  };

  // Manual QR entry for fallback
  const [manualId, setManualId] = useState('');
  const validateTicket = async (ticketId: string) => {
    if (!ticketId) return;
    setLastScannedId(ticketId);
    setIsValidating(true);
    
    try {
      const ticket = await getReservaByQr(ticketId);
      
      if (!ticket) {
        setScanResult('invalid');
        setScannedTicket(null);
      } else if (ticket.paymentStatus !== 'paid') {
        setScanResult('unpaid');
        setScannedTicket(ticket);
      } else if (ticket.attended) {
        setScanResult('used');
        setScannedTicket(ticket);
      } else {
        await markReservaAsAttended(ticket.id!);
        setScanResult('valid');
        setScannedTicket(ticket);
      }
    } catch (error) {
      console.error(error);
      alert('Error validando el código QR.');
    } finally {
      setIsValidating(false);
    }
  };

  const resultConfig = {
    valid: { bg: 'bg-green-500', icon: CheckCircle, title: '✅ ENTRADA VÁLIDA', sub: 'Marca como ingresado.' },
    used: { bg: 'bg-red-500', icon: XCircle, title: '🚫 ENTRADA YA USADA', sub: 'Esta entrada ya fue escaneada.' },
    invalid: { bg: 'bg-amber-500', icon: AlertTriangle, title: '⚠️ QR NO ENCONTRADO', sub: 'El código no está registrado.' },
    unpaid: { bg: 'bg-orange-500', icon: AlertTriangle, title: '⚠️ PAGO PENDIENTE', sub: 'No ha cancelado la totalidad de su entrada.' },
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900">Lector QR — Día del Evento</h1>

      {/* Camera */}
      <div className="bg-black rounded-2xl overflow-hidden aspect-[4/3] relative flex items-center justify-center">
        <div id="qr-reader" className="w-full h-full object-cover"></div>
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white bg-black">
            <Camera size={48} className="opacity-40" />
            <p className="opacity-60 text-sm">Cámara inactiva</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {!cameraOn ? (
          <button onClick={startCamera} className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl flex items-center justify-center gap-2 transition">
            <Camera size={20} /> Activar Cámara
          </button>
        ) : (
          <button onClick={stopCamera} className="flex-1 py-3 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition">
            <CameraOff size={20} /> Detener Cámara
          </button>
        )}
      </div>

      {/* Manual Entry Fallback */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase">Ingreso Manual (si el QR no se lee)</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={e => setManualId(e.target.value.toUpperCase())}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none font-mono text-sm"
            placeholder="TICKET-12345678-B7"
          />
          <button 
            onClick={() => validateTicket(manualId)} 
            disabled={isValidating || !manualId}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isValidating ? <Loader2 size={16} className="animate-spin" /> : null}
            Validar
          </button>
        </div>
      </div>

      {isValidating && !scanResult && (
        <div className="bg-blue-500 rounded-2xl p-6 text-white flex items-center gap-3 justify-center">
          <Loader2 size={24} className="animate-spin" />
          <p className="font-bold">Validando Entrada...</p>
        </div>
      )}

      {/* Result */}
      {scanResult && (
        <div className={`${resultConfig[scanResult].bg} rounded-2xl p-6 text-white`}>
          <p className="text-2xl font-black">{resultConfig[scanResult].title}</p>
          <p className="opacity-80 mt-1">{resultConfig[scanResult].sub}</p>
          {scannedTicket && (
            <div className="mt-4 bg-white/20 rounded-xl p-4 space-y-2">
              <div className="bg-black/30 text-white px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider w-fit">
                📅 {scannedTicket.eventDateName || 'Día 1 - 09 de Noviembre'}
              </div>
              <p className="font-black text-xl">{scannedTicket.fullName}</p>
              <p className="text-sm font-semibold opacity-95">
                {scannedTicket.zoneName} · Butaca <span className="text-lg font-black underline ml-1">{scannedTicket.seatId || 'GEN'}</span>
              </p>
              <p className="text-xs opacity-70 font-mono">{lastScannedId}</p>
            </div>
          )}
          <button onClick={() => { setScanResult(null); setScannedTicket(null); setManualId(''); }}
            className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition">
            Escanear Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
