import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { getZonas, saveZonas, type Zona as ZoneConfig } from '../../lib/firestore';

// Removed inline ZoneConfig interface since we import it from firestore.ts

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316',
];

const defaultZones: ZoneConfig[] = [
  { id: 'z1', name: '1er Piso - Izquierda', floor: 1, type: 'numbered', price: 150, rows: 11, seatsPerRow: 18, startRowLabel: 'A', color: '#6366f1' },
  { id: 'z2', name: '1er Piso - Derecha', floor: 1, type: 'numbered', price: 150, rows: 11, seatsPerRow: 18, startRowLabel: 'A', color: '#8b5cf6' },
  { id: 'z3', name: '2do Piso - Libre Tránsito', floor: 2, type: 'stock', price: 80, stockTotal: 100, color: '#10b981' },
  { id: 'z4', name: '2do Piso - Laterales', floor: 2, type: 'numbered', price: 100, rows: 8, seatsPerRow: 8, startRowLabel: 'A', color: '#f59e0b' },
];

export default function MapConfig() {
  const [zones, setZones] = useState<ZoneConfig[]>(defaultZones);
  const [saved, setSaved] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchZonas = async () => {
      try {
        const storedZonas = await getZonas();
        if (storedZonas && storedZonas.length > 0) {
          setZones(storedZonas);
        }
      } catch (err) {
        console.error("Error cargando zonas:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchZonas();
  }, []);

  const updateZone = (id: string, field: keyof ZoneConfig, value: any) => {
    setZones(z => z.map(zone => zone.id === id ? { ...zone, [field]: value } : zone));
    setSaved(false);
  };

  const addZone = () => {
    const newZone: ZoneConfig = {
      id: `z${Date.now()}`,
      name: 'Nueva Zona',
      floor: 1,
      type: 'stock',
      price: 100,
      stockTotal: 50,
      color: COLORS[zones.length % COLORS.length],
    };
    setZones(z => [...z, newZone]);
    setSaved(false);
  };

  const deleteZone = (id: string) => {
    setZones(z => z.filter(zone => zone.id !== id));
    setSaved(false);
  };

  const saveConfig = async () => {
    try {
      await saveZonas(zones);
      setSaved(true);
      alert("Zonas guardadas correctamente en Firestore.");
    } catch (err) {
      console.error("Error guardando zonas:", err);
      alert("Ocurrió un error al guardar las zonas.");
    }
  };

  const totalSeats = zones.reduce((acc, z) => {
    if (z.type === 'numbered') return acc + (z.rows ?? 0) * (z.seatsPerRow ?? 0);
    return acc + (z.stockTotal ?? 0);
  }, 0);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando configuración de zonas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configurar Zonas</h1>
          <p className="text-slate-500 text-sm mt-1">Total capacidad calculada: <strong>{totalSeats} butacas</strong></p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={addZone}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark transition"
          >
            <Plus size={16} /> Añadir Zona
          </button>
          <button
            onClick={saveConfig}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition",
              saved ? 'bg-green-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
            )}
          >
            <Save size={16} /> {saved ? '¡Guardado!' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-blue-700 text-sm">
          <strong>Zonas Numeradas:</strong> El cliente escoge su butaca exacta (ej. A1, B12). <br/>
          <strong>Zonas por Stock:</strong> Solo hay un cupo disponible, el asiento se asigna el día del evento por orden de llegada.
        </p>
      </div>

      <div className="space-y-4">
        {zones.map((zone) => (
          <div key={zone.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              {/* Color Picker */}
              <div className="flex flex-col gap-2 items-center shrink-0">
                <div className="w-8 h-8 rounded-full border-4 border-white shadow-md" style={{ background: zone.color }} />
                <div className="flex flex-wrap gap-1 w-16">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => updateZone(zone.id, 'color', c)}
                      className={clsx("w-4 h-4 rounded-full transition", zone.color === c ? 'ring-2 ring-slate-400' : '')}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Zone Config */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">NOMBRE DE LA ZONA</label>
                  <input
                    type="text"
                    value={zone.name}
                    onChange={e => updateZone(zone.id, 'name', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">PISO</label>
                  <select
                    value={zone.floor}
                    onChange={e => updateZone(zone.id, 'floor', Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                  >
                    <option value={1}>1er Piso</option>
                    <option value={2}>2do Piso</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">TIPO</label>
                  <select
                    value={zone.type}
                    onChange={e => updateZone(zone.id, 'type', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                  >
                    <option value="numbered">Butacas Numeradas</option>
                    <option value="stock">Por Stock / Llegada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">PRECIO (S/)</label>
                  <input
                    type="number"
                    value={zone.price}
                    onChange={e => updateZone(zone.id, 'price', Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                  />
                </div>

                {zone.type === 'numbered' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">FILAS</label>
                      <input type="number" value={zone.rows ?? ''} onChange={e => updateZone(zone.id, 'rows', Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">ASIENTOS/FILA</label>
                      <input type="number" value={zone.seatsPerRow ?? ''} onChange={e => updateZone(zone.id, 'seatsPerRow', Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">FILA INICIAL (A, B...)</label>
                      <input type="text" maxLength={1} value={zone.startRowLabel ?? 'A'} onChange={e => updateZone(zone.id, 'startRowLabel', e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm font-mono" />
                    </div>
                    <div className="col-span-full">
                      <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                        📊 Capacidad calculada: <strong>{(zone.rows ?? 0) * (zone.seatsPerRow ?? 0)} butacas</strong>
                        {' '} (Filas {zone.startRowLabel} — {String.fromCharCode((zone.startRowLabel?.charCodeAt(0) ?? 65) + (zone.rows ?? 0) - 1)})
                      </p>
                    </div>
                  </>
                )}

                {zone.type === 'stock' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">CUPOS DISPONIBLES</label>
                    <input type="number" value={zone.stockTotal ?? ''} onChange={e => updateZone(zone.id, 'stockTotal', Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
                  </div>
                )}
              </div>

              <button onClick={() => deleteZone(zone.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition shrink-0">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
