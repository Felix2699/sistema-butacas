import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { getOccupiedSeats } from '../lib/firestore';
import { ZONAS_MAP } from '../lib/constants';

interface SeatMapProps {
  onSelectSeat: (zoneId: string, seatId?: string) => void;
  eventDateId?: string | null;
  selectedZone?: string | null;
  selectedSeat?: string | null;
}

interface SeatMeta {
  id: string;
  label: string;
  zoneId: string;
  isSpecial?: 'invitados' | 'staff';
}

export default function SeatMap({ onSelectSeat, eventDateId, selectedSeat }: SeatMapProps) {
  const [activeFloor, setActiveFloor] = useState<1 | 2>(1);
  const [occupiedSeats, setOccupiedSeats] = useState<{ zoneId: string; seatId: string }[]>([]);

  useEffect(() => {
    getOccupiedSeats(eventDateId)
      .then(setOccupiedSeats)
      .catch(console.error);
  }, [eventDateId]);

  const handleSeatClick = (seat: SeatMeta) => {
    if (seat.isSpecial) return; // Bloqueados
    onSelectSeat(seat.zoneId, seat.id);
  };

  // Helper para generar asientos del Primer Piso
  // Fila A a H (Zona Iconic, Glam, Invitados)
  // Filas posteriores I a N (Zona Élite y Staff)
  const getFloor1Seats = () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    
    return rows.map(rowLetter => {
      const isEliteBlock = ['I', 'J', 'K', 'L'].includes(rowLetter);

      // Números lado izquierdo: 26 bajando a 14
      const leftSeats: SeatMeta[] = [];
      const rightSeats: SeatMeta[] = [];

      for (let num = 26; num >= 14; num--) {
        const seatId = `${rowLetter}${num}`;
        let zoneId = 'glam';
        let special: 'invitados' | 'staff' | undefined = undefined;

        if (!isEliteBlock) {
          if (rowLetter === 'A') {
            if (num >= 21) {
              zoneId = 'invitados';
              special = 'invitados';
            } else {
              zoneId = 'iconic';
            }
          } else if (rowLetter === 'B') {
            if (num <= 20) zoneId = 'iconic';
            else zoneId = 'glam';
          }
        } else {
          zoneId = 'elite';
          // Staff en esquinas
          if ((rowLetter === 'I' && num === 26) || (rowLetter === 'L' && (num === 26 || num === 14))) {
            special = 'staff';
          }
        }

        // Ajuste de forma: fila A y C no tienen 25-26
        if ((rowLetter === 'A' || rowLetter === 'B' || rowLetter === 'C') && num >= 25) {
          // Espacio vacío
          continue;
        }

        leftSeats.push({ id: seatId, label: String(num), zoneId, isSpecial: special });
      }

      // Números lado derecho: 13 bajando a 1
      for (let num = 13; num >= 1; num--) {
        const seatId = `${rowLetter}${num}`;
        let zoneId = 'glam';
        let special: 'invitados' | 'staff' | undefined = undefined;

        if (!isEliteBlock) {
          if (rowLetter === 'A') {
            if (num <= 6) {
              zoneId = 'invitados';
              special = 'invitados';
            } else {
              zoneId = 'iconic';
            }
          } else if (rowLetter === 'B') {
            if (num >= 7) zoneId = 'iconic';
            else zoneId = 'glam';
          }
        } else {
          zoneId = 'elite';
          // Staff en esquinas
          if ((rowLetter === 'I' && (num === 1 || num === 13)) || (rowLetter === 'L' && (num === 1 || num === 13))) {
            special = 'staff';
          }
        }

        // Ajuste de forma: fila A, B no tienen 1-2
        if (rowLetter === 'A' && num <= 0) continue;

        rightSeats.push({ id: seatId, label: String(num), zoneId, isSpecial: special });
      }

      return { rowLetter, isEliteBlock, leftSeats, rightSeats };
    });
  };

  // Helper para generar asientos del Segundo Piso (Zona Bronce / 358 butacas)
  const getFloor2Seats = () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    return rows.map(rowLetter => {
      const leftSeats: SeatMeta[] = [];
      const centerSeats: SeatMeta[] = [];
      const rightSeats: SeatMeta[] = [];

      // Lateral Izquierdo: col 1 a 6
      for (let c = 1; c <= 6; c++) {
        const seatId = `2P-${rowLetter}L${c}`;
        let special: 'staff' | undefined = undefined;
        if (rowLetter === 'A' && (c === 5 || c === 6)) special = 'staff';
        leftSeats.push({ id: seatId, label: `${c}`, zoneId: 'bronce', isSpecial: special });
      }

      // Centro: col 1 a 12
      for (let c = 1; c <= 12; c++) {
        const seatId = `2P-${rowLetter}C${c}`;
        let special: 'staff' | undefined = undefined;
        if (rowLetter === 'A' && (c === 6 || c === 7)) special = 'staff';
        centerSeats.push({ id: seatId, label: `${c}`, zoneId: 'bronce', isSpecial: special });
      }

      // Lateral Derecho: col 1 a 6
      for (let c = 1; c <= 6; c++) {
        const seatId = `2P-${rowLetter}R${c}`;
        let special: 'staff' | undefined = undefined;
        if (rowLetter === 'A' && (c === 1 || c === 2)) special = 'staff';
        rightSeats.push({ id: seatId, label: `${c}`, zoneId: 'bronce', isSpecial: special });
      }

      return { rowLetter, leftSeats, centerSeats, rightSeats };
    });
  };

  const renderSeatButton = (seat: SeatMeta) => {
    const isSelected = selectedSeat === seat.id;
    const isOccupied = occupiedSeats.some(s => s.seatId === seat.id);
    const isBlocked = seat.isSpecial != null;

    let colorClasses = "bg-amber-400 hover:bg-amber-500 text-slate-900 border-amber-500"; // Glam default
    if (seat.zoneId === 'iconic') {
      colorClasses = "bg-red-500 hover:bg-red-600 text-white border-red-600";
    } else if (seat.zoneId === 'elite') {
      colorClasses = "bg-rose-400 hover:bg-rose-500 text-white border-rose-500";
    } else if (seat.zoneId === 'bronce') {
      colorClasses = "bg-amber-600 hover:bg-amber-700 text-white border-amber-700";
    }

    if (seat.isSpecial === 'invitados') {
      colorClasses = "bg-cyan-500 text-white border-cyan-600 cursor-not-allowed opacity-90";
    } else if (seat.isSpecial === 'staff') {
      colorClasses = "bg-slate-900 text-white border-black cursor-not-allowed opacity-90";
    }

    if (isOccupied) {
      colorClasses = "bg-slate-300 text-slate-500 border-slate-400 cursor-not-allowed line-through opacity-40";
    }

    if (isSelected) {
      colorClasses = "bg-purple-600 text-white border-purple-800 scale-125 z-20 shadow-lg ring-2 ring-purple-300 animate-pulse";
    }

    const titleText = isOccupied
      ? `Asiento ${seat.id} (Ocupado)`
      : seat.isSpecial === 'invitados'
      ? `Asiento ${seat.id} (Reservado Invitados)`
      : seat.isSpecial === 'staff'
      ? `Asiento ${seat.id} (Reservado Staff)`
      : isSelected
      ? `Asiento ${seat.id} (Seleccionado)`
      : `Asiento ${seat.id} - Zona ${ZONAS_MAP[seat.zoneId]?.name || seat.zoneId}`;

    return (
      <button
        key={seat.id}
        type="button"
        disabled={isOccupied || isBlocked}
        onClick={() => handleSeatClick(seat)}
        title={titleText}
        className={clsx(
          "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-t-md rounded-b-[2px] border text-[7px] sm:text-[9px] font-bold transition-all flex items-center justify-center shrink-0 shadow-xs",
          colorClasses
        )}
      >
        {seat.label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Floor Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveFloor(1)}
            className={clsx(
              "px-5 py-2 rounded-xl font-bold transition text-xs sm:text-sm shadow-sm",
              activeFloor === 1 ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            Primer Piso (394 Butacas)
          </button>
          <button
            type="button"
            onClick={() => setActiveFloor(2)}
            className={clsx(
              "px-5 py-2 rounded-xl font-bold transition text-xs sm:text-sm shadow-sm",
              activeFloor === 2 ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            Segundo Piso / Zona Bronce (358)
          </button>
        </div>

        {selectedSeat && (
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-purple-700 font-medium">Asiento elegido:</span>
            <span className="text-sm font-black text-purple-900">{selectedSeat}</span>
          </div>
        )}
      </div>

      {/* Leyenda Oficial */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-semibold">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-red-500 border border-red-600 inline-block" />
          <span className="text-slate-700">ICONIC</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500 inline-block" />
          <span className="text-slate-700">GLAM</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-rose-400 border border-rose-500 inline-block" />
          <span className="text-slate-700">ÉLITE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-600 border border-amber-700 inline-block" />
          <span className="text-slate-700">BRONCE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-cyan-500 border border-cyan-600 inline-block" />
          <span className="text-slate-500">Invitados</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-slate-900 border border-black inline-block" />
          <span className="text-slate-500">Staff</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-slate-300 border border-slate-400 opacity-60 inline-block" />
          <span className="text-slate-400">Ocupado</span>
        </div>
      </div>

      {/* Stage Banner */}
      <div className="flex flex-col items-center gap-1.5 w-full max-w-xl mx-auto">
        <div className="w-full h-7 bg-amber-300 text-amber-950 font-black text-[11px] uppercase tracking-widest flex items-center justify-center rounded-t-2xl shadow-xs border border-amber-400">
          Pantalla Gigante
        </div>
        <div className="w-full h-11 bg-orange-200 text-orange-950 font-black text-xs uppercase tracking-widest flex items-center justify-center rounded-b-2xl shadow-md border-b-4 border-orange-300">
          Escenario
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 lg:hidden">
        ↔️ Desliza horizontalmente para ver todo el mapa de asientos
      </div>

      {/* Map Area */}
      <div className="w-full overflow-x-auto pb-6 bg-slate-50/50 p-4 rounded-3xl border border-slate-200">
        <div className="min-w-[680px] flex flex-col items-center gap-3">
          {activeFloor === 1 ? (
            <div className="flex flex-col gap-2 w-full max-w-3xl">
              {getFloor1Seats().map(({ rowLetter, isEliteBlock, leftSeats, rightSeats }) => (
                <div key={rowLetter} className={clsx("flex items-center justify-between gap-3", isEliteBlock && rowLetter === 'I' && "mt-4 pt-3 border-t-2 border-dashed border-slate-200")}>
                  {/* Letra de Fila Izquierda */}
                  <span className="w-4 text-center font-black text-slate-400 text-xs shrink-0">{rowLetter}</span>

                  {/* Lado Izquierdo */}
                  <div className="flex gap-1 justify-end flex-1">
                    {leftSeats.map(renderSeatButton)}
                  </div>

                  {/* Pasillo central */}
                  <div className="w-6 sm:w-8 shrink-0 flex items-center justify-center text-[10px] text-slate-300 font-mono">
                    |
                  </div>

                  {/* Lado Derecho */}
                  <div className="flex gap-1 justify-start flex-1">
                    {rightSeats.map(renderSeatButton)}
                  </div>

                  {/* Letra de Fila Derecha */}
                  <span className="w-4 text-center font-black text-slate-400 text-xs shrink-0">{rowLetter}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full max-w-3xl">
              <div className="text-center font-bold text-amber-800 bg-amber-100/60 py-1 rounded-xl text-xs mb-2">
                Segundo Piso · Zona Bronce (358 Butacas)
              </div>
              {getFloor2Seats().map(({ rowLetter, leftSeats, centerSeats, rightSeats }) => (
                <div key={rowLetter} className="flex items-center justify-between gap-3">
                  <span className="w-4 text-center font-black text-slate-400 text-xs shrink-0">{rowLetter}</span>

                  {/* Lateral Izquierdo */}
                  <div className="flex gap-1 justify-end">
                    {leftSeats.map(renderSeatButton)}
                  </div>

                  {/* Pasillo */}
                  <div className="w-4 shrink-0 text-[10px] text-slate-300 text-center">|</div>

                  {/* Bloque Central */}
                  <div className="flex gap-1 justify-center flex-1">
                    {centerSeats.map(renderSeatButton)}
                  </div>

                  {/* Pasillo */}
                  <div className="w-4 shrink-0 text-[10px] text-slate-300 text-center">|</div>

                  {/* Lateral Derecho */}
                  <div className="flex gap-1 justify-start">
                    {rightSeats.map(renderSeatButton)}
                  </div>

                  <span className="w-4 text-center font-black text-slate-400 text-xs shrink-0">{rowLetter}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
