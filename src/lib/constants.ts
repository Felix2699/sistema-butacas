export interface ZoneDefinition {
  id: string;
  name: string;
  shortName: string;
  color: string;
  badgeBg: string;
  floor: 1 | 2;
  workshopIncluded?: boolean;
  blocked?: boolean;
  description: string;
}

export const ZONAS_MAP: Record<string, ZoneDefinition> = {
  iconic: {
    id: 'iconic',
    name: 'ICONIC Experiencia',
    shortName: 'ICONIC',
    color: '#ef4444', // Rojo
    badgeBg: 'bg-red-500 text-white',
    floor: 1,
    workshopIncluded: true,
    description: 'Incluye ingreso al WORKSHOP exclusivo y mejor ubicación frente al escenario.',
  },
  glam: {
    id: 'glam',
    name: 'GLAM - Nivel 01',
    shortName: 'GLAM',
    color: '#eab308', // Dorado/Amarillo
    badgeBg: 'bg-amber-400 text-slate-900',
    floor: 1,
    description: 'Primer piso preferencial central con excelente vista a escenario y pantalla.',
  },
  elite: {
    id: 'elite',
    name: 'ÉLITE - Nivel 02',
    shortName: 'ÉLITE',
    color: '#fb7185', // Rosa coral
    badgeBg: 'bg-rose-400 text-white',
    floor: 1,
    description: 'Primer piso posterior con acceso directo y gran comodidad.',
  },
  bronce: {
    id: 'bronce',
    name: 'BRONCE - Nivel 03',
    shortName: 'BRONCE',
    color: '#d97706', // Ámbar / Arena
    badgeBg: 'bg-amber-600 text-white',
    floor: 2,
    description: 'Segundo piso con vista panorámica completa del escenario.',
  },
  invitados: {
    id: 'invitados',
    name: 'INVITADOS',
    shortName: 'INVITADOS',
    color: '#06b6d4', // Celeste
    badgeBg: 'bg-cyan-500 text-white',
    floor: 1,
    blocked: true,
    description: 'Asientos reservados exclusivamente para Invitados Especiales.',
  },
  staff: {
    id: 'staff',
    name: 'STAFF',
    shortName: 'STAFF',
    color: '#0f172a', // Negro
    badgeBg: 'bg-slate-900 text-white',
    floor: 1,
    blocked: true,
    description: 'Ubicaciones técnicas reservadas para Staff y producción.',
  },
};

export interface StagePricing {
  cash: number;
  allowInstallments: boolean;
  installmentAmount?: number;
  installmentCount?: number;
}

export const ZONE_PRICING: Record<string, { preventa: StagePricing; regular: StagePricing }> = {
  iconic: {
    preventa: { cash: 700, allowInstallments: true, installmentAmount: 350, installmentCount: 2 },
    regular: { cash: 750, allowInstallments: true, installmentAmount: 375, installmentCount: 2 },
  },
  glam: {
    preventa: { cash: 360, allowInstallments: true, installmentAmount: 180, installmentCount: 2 },
    regular: { cash: 390, allowInstallments: true, installmentAmount: 195, installmentCount: 2 },
  },
  elite: {
    preventa: { cash: 240, allowInstallments: true, installmentAmount: 120, installmentCount: 2 },
    regular: { cash: 280, allowInstallments: true, installmentAmount: 140, installmentCount: 2 },
  },
  bronce: {
    preventa: { cash: 120, allowInstallments: false },
    regular: { cash: 150, allowInstallments: false },
  },
};

export function getAutoStage(): 'preventa' | 'regular' {
  // Preventa: 04 Sep a 04 Oct. Regular: 05 Oct a 05 Nov.
  const now = new Date();
  const year = now.getFullYear();
  const preventaEnd = new Date(year, 9, 4, 23, 59, 59); // 04 de Octubre (mes 9 en JS es Octubre)
  return now <= preventaEnd ? 'preventa' : 'regular';
}

export const DEFAULT_EVENT_DATES = [
  {
    id: 'd1',
    name: 'Día 1 - 09 de Noviembre',
    dateText: 'Lunes 09 de Noviembre, 2026',
    timeText: '09:00 AM',
    isActive: true,
    order: 1,
  },
  {
    id: 'd2',
    name: 'Día 2 - 10 de Noviembre',
    dateText: 'Martes 10 de Noviembre, 2026',
    timeText: '09:00 AM',
    isActive: true,
    order: 2,
  },
];
