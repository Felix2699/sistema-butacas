import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_EVENT_DATES } from './constants';

export interface EventDate {
  id: string;
  name: string;
  dateText: string;
  timeText: string;
  isActive: boolean;
  order: number;
}

export interface EventSettings {
  pricingStage: 'auto' | 'preventa' | 'regular';
  allowInstallments: boolean;
}

export interface PaymentRecord {
  amount: number;
    vendedorId?: string;
    vendedorName?: string;
  operationNumber: string;
  date: string;
  method: string;
  verified: boolean;
  voucherBase64?: string | null;
  detectedAmount?: number | null;
  note?: string;
}

export interface Reserva {
  id?: string;
  docType?: 'DNI' | 'CE' | 'RUC'; // Tipo de documento
  fullName: string;
  dni: string; // Número de documento (puede ser DNI, CE o RUC)
  email: string;
  phone: string;
  certificateName?: string;
  city?: string;
  zoneId: string;
  zoneName: string;
  seatId?: string | null;
  eventDateId?: string;
  eventDateName?: string;
  paymentPlan?: 'full' | 'installments';
  installmentNumber?: number;
  paymentStatus: 'pending' | 'partial' | 'paid';
    method?: string;
  totalPrice: number;
  totalPaid: number;
  payments: PaymentRecord[];
  createdAt: any;
  qrCode?: string;
  attended?: boolean;
  vendedorId?: string;
  vendedorName?: string;
  editReason?: string;
  editedAt?: string;
  editedBy?: string;
}

export interface Vendedor {
  id: string;
  name: string;
  active: boolean;
}

export interface Gasto {
  id?: string;
  date: string;
  reason: string;
  amount: number;
    vendedorId?: string;
    vendedorName?: string;
  method?: string;
  voucherBase64?: string | null;
  createdAt: any;
}

export interface Zona {
  id: string;
  name: string;
  floor: 1 | 2;
  type: 'numbered' | 'stock';
  price: number;
  rows?: number;
  seatsPerRow?: number;
  startRowLabel?: string;
  stockTotal?: number;
  color: string;
}

// =======================
// FECHAS DEL EVENTO
// =======================

export async function getEventDates(): Promise<EventDate[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'fechas_evento'));
    if (querySnapshot.empty) {
      try {
        for (const d of DEFAULT_EVENT_DATES) {
          await setDoc(doc(db, 'fechas_evento', d.id), d);
        }
      } catch (err) {
        console.warn('No se pudieron inicializar fechas por defecto en Firestore:', err);
      }
      return DEFAULT_EVENT_DATES;
    }
    const dates: EventDate[] = [];
    querySnapshot.forEach((d) => {
      dates.push({ id: d.id, ...d.data() } as EventDate);
    });
    return dates.sort((a, b) => a.order - b.order);
  } catch (err) {
    console.error('Error al obtener fechas del evento:', err);
    return DEFAULT_EVENT_DATES;
  }
}

export async function saveEventDate(date: EventDate): Promise<void> {
  await setDoc(doc(db, 'fechas_evento', date.id), date);
}

export async function deleteEventDate(id: string): Promise<void> {
  await deleteDoc(doc(db, 'fechas_evento', id));
}

export function subscribeToEventDates(callback: (dates: EventDate[]) => void) {
  return onSnapshot(
    collection(db, 'fechas_evento'), 
    (snapshot) => {
      if (snapshot.empty) {
        getEventDates().then(callback);
        return;
      }
      const dates: EventDate[] = [];
      snapshot.forEach((d) => {
        dates.push({ id: d.id, ...d.data() } as EventDate);
      });
      callback(dates.sort((a, b) => a.order - b.order));
    },
    (error) => {
      console.warn('Error en listener de fechas_evento:', error);
      callback(DEFAULT_EVENT_DATES);
    }
  );
}

// =======================
// CONFIGURACIÓN GLOBAL
// =======================

const DEFAULT_SETTINGS: EventSettings = {
  pricingStage: 'auto',
  allowInstallments: true,
};

export async function getEventSettings(): Promise<EventSettings> {
  try {
    const docRef = doc(db, 'config', 'settings');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as EventSettings;
    }
    try {
      await setDoc(docRef, DEFAULT_SETTINGS);
    } catch (err) {
      console.warn('No se pudo guardar la configuración por defecto en Firestore:', err);
    }
    return DEFAULT_SETTINGS;
  } catch (err) {
    console.error('Error al obtener la configuración global:', err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveEventSettings(settings: EventSettings): Promise<void> {
  const docRef = doc(db, 'config', 'settings');
  await setDoc(docRef, settings, { merge: true });
}

export function subscribeToEventSettings(callback: (settings: EventSettings) => void) {
  const docRef = doc(db, 'config', 'settings');
  return onSnapshot(
    docRef, 
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as EventSettings);
      } else {
        callback(DEFAULT_SETTINGS);
      }
    },
    (error) => {
      console.warn('Error en listener de config/settings:', error);
      callback(DEFAULT_SETTINGS);
    }
  );
}

// =======================
// ZONAS (Configuración)
// =======================

export async function getZonas(): Promise<Zona[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'zonas'));
    const zonas: Zona[] = [];
    querySnapshot.forEach((doc) => {
      zonas.push({ id: doc.id, ...doc.data() } as Zona);
    });
    return zonas;
  } catch (err) {
    console.error('Error al obtener zonas:', err);
    return [];
  }
}

export async function saveZonas(zonas: Zona[]): Promise<void> {
  for (const zona of zonas) {
    const zonaRef = doc(db, 'zonas', zona.id);
    await setDoc(zonaRef, zona);
  }
}

// =======================
// RESERVAS
// =======================

export async function createReserva(reserva: Reserva, id: string): Promise<void> {
  const reservaRef = doc(db, 'reservas', id);
  await setDoc(reservaRef, reserva);
}

export async function getReservaByDni(dni: string): Promise<Reserva | null> {
  try {
    const q = query(collection(db, 'reservas'), where('dni', '==', dni));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Reserva;
  } catch (err) {
    console.error('Error al buscar reserva por DNI:', err);
    return null;
  }
}

export async function getReservaByQr(qrCode: string): Promise<Reserva | null> {
  try {
    const q = query(collection(db, 'reservas'), where('qrCode', '==', qrCode));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Reserva;
  } catch (err) {
    console.error('Error al buscar reserva por QR:', err);
    return null;
  }
}

export async function getOccupiedSeats(eventDateId?: string | null): Promise<{zoneId: string, seatId: string, method?: string}[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'reservas'));
    const occupied: {zoneId: string, seatId: string, method?: string}[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.zoneId && data.seatId) {
        if (!eventDateId || data.eventDateId === eventDateId || (!data.eventDateId && eventDateId === 'd1')) {
          occupied.push({ zoneId: data.zoneId, seatId: data.seatId, method: data.method });
        }
      }
    });
    return occupied;
  } catch (err) {
    console.error('Error al obtener asientos ocupados:', err);
    return [];
  }
}

export async function updateReservaPayment(id: string, newTotalPaid: number, newStatus: Reserva['paymentStatus'], newPayments: Reserva['payments']): Promise<void> {
  const reservaRef = doc(db, 'reservas', id);
  await updateDoc(reservaRef, {
    totalPaid: newTotalPaid,
    paymentStatus: newStatus,
    payments: newPayments
  });
}

export async function updateReservaInfo(id: string, data: Partial<Reserva>): Promise<void> {
  const reservaRef = doc(db, 'reservas', id);
  await updateDoc(reservaRef, data);
}

// Agregar nuevo abono desde la interfaz de consulta (cliente)
export async function addReservaPayment(id: string, newPayment: PaymentRecord): Promise<void> {
  const reservaRef = doc(db, 'reservas', id);
  const snap = await getDoc(reservaRef);
  if (!snap.exists()) throw new Error('Reserva no encontrada');

  const currentData = snap.data() as Reserva;
  const currentPayments = currentData.payments || [];
  const updatedPayments = [...currentPayments, newPayment];

  await updateDoc(reservaRef, {
    payments: updatedPayments,
  });
}

// Actualizar lista de pagos, recalcular sumatoria y actualizar estado automáticamente
export async function updateReservaPaymentsAndTotal(id: string, updatedPayments: PaymentRecord[], totalPrice: number): Promise<{ totalPaid: number; newStatus: Reserva['paymentStatus'] }> {
  const reservaRef = doc(db, 'reservas', id);
  
  // Sumar únicamente los pagos verificados por administración
  const totalPaid = updatedPayments
    .filter(p => p.verified)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  let newStatus: Reserva['paymentStatus'] = 'pending';
  if (totalPaid >= totalPrice) {
    newStatus = 'paid';
  } else if (totalPaid > 0) {
    newStatus = 'partial';
  }

  await updateDoc(reservaRef, {
    totalPaid,
    paymentStatus: newStatus,
    payments: updatedPayments
  });

  return { totalPaid, newStatus };
}

export async function markReservaAsAttended(id: string): Promise<void> {
  const reservaRef = doc(db, 'reservas', id);
  await updateDoc(reservaRef, {
    attended: true
  });
}

export function subscribeToReservas(callback: (reservas: Reserva[]) => void) {
  return onSnapshot(
    collection(db, 'reservas'), 
    (snapshot) => {
      const reservas: Reserva[] = [];
      snapshot.forEach((doc) => {
        reservas.push({ id: doc.id, ...doc.data() } as Reserva);
      });
      callback(reservas);
    },
    (error) => {
      console.warn('Error en listener de reservas:', error);
      callback([]);
    }
  );
}

// =======================
// VENDEDORES
// =======================
export function subscribeToVendedores(callback: (vendedores: Vendedor[]) => void) {
  return onSnapshot(
    collection(db, 'vendedores'), 
    (snapshot) => {
      const data: Vendedor[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Vendedor));
      callback(data);
    },
    (error) => {
      console.warn('Error en listener de vendedores:', error);
      callback([]);
    }
  );
}

export async function saveVendedor(vendedor: Vendedor): Promise<void> {
  await setDoc(doc(db, 'vendedores', vendedor.id), vendedor);
}

export async function deleteVendedor(id: string): Promise<void> {
  await deleteDoc(doc(db, 'vendedores', id));
}

// =======================
// GASTOS
// =======================
export function subscribeToGastos(callback: (gastos: Gasto[]) => void) {
  return onSnapshot(
    collection(db, 'gastos'), 
    (snapshot) => {
      const data: Gasto[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Gasto));
      // Sort descending by date
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(data);
    },
    (error) => {
      console.warn('Error en listener de gastos:', error);
      callback([]);
    }
  );
}

export async function addGasto(gasto: Omit<Gasto, 'id'>): Promise<void> {
  const { addDoc } = await import('firebase/firestore');
  await addDoc(collection(db, 'gastos'), gasto);
}

export async function updateGasto(id: string, data: Partial<Gasto>): Promise<void> {
  const ref = doc(db, 'gastos', id);
  await updateDoc(ref, data);
}

export async function deleteGasto(id: string): Promise<void> {
  await deleteDoc(doc(db, 'gastos', id));
}
