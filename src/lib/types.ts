export interface Seat {
  id: string;
  row: string;
  number: number;
  status: 'available' | 'reserved' | 'confirmed';
}

export interface Zone {
  id: string;
  name: string;
  floor: 1 | 2;
  type: 'numbered' | 'stock';
  price: number;
  totalSeats: number;
  availableSeats: number;
  layout?: {
    rows: number; // e.g., 5 rows
    seatsPerRow: number; // e.g., 10 seats per row
    startRowLabel: string; // e.g., 'A'
  }[];
}

export interface User {
  id: string;
  dni: string;
  fullName: string;
  email: string;
  phone: string;
  certificateName: string;
  city: string;
  role: 'client' | 'admin';
}

export interface Ticket {
  id: string;
  userId: string;
  zoneId: string;
  seatId?: string; // Optional if zone is 'stock'
  paymentStatus: 'pending' | 'partial' | 'paid';
  totalPaid: number;
  payments: {
    amount: number;
    operationNumber: string;
    date: string;
    imageUrl: string;
    verified: boolean;
  }[];
  createdAt: string;
  qrCodeData: string;
  attended: boolean;
}
