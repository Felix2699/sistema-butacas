import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export interface TicketData {
  id: string;
  fullName: string;
  docType?: 'DNI' | 'CE' | 'RUC' | string;
  dni: string;
  email: string;
  phone: string;
  certificateName: string;
  city: string;
  zoneName: string;
  seatNumber?: string;
  price: number;
  qrCode: string;
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  eventDateName?: string;
  paymentPlan?: string;
}

export async function generateTicketPDF(ticket: TicketData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 180], // High quality ticket dimensions
  });

  // Dark Header Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 100, 35, 'F');

  // Title Text
  doc.setTextColor(245, 158, 11); // amber-500
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('EVENTO ESTILISTAS 2026', 50, 15, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ENTRADA OFICIAL VIP / GENERAL', 50, 24, { align: 'center' });

  // Ticket Code Banner
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(5, 40, 90, 12, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`CÓDIGO DE ENTRADA: ${ticket.qrCode}`, 50, 47.5, { align: 'center' });

  // Details Section
  let y = 60;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);

  const addDetail = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), 10, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(value, 40, y);
    y += 7;
  };

  if (ticket.eventDateName) {
    addDetail('FECHA FUNCIÓN:', ticket.eventDateName);
  }
  addDetail('ASISTENTE:', ticket.fullName);
  addDetail(`${ticket.docType || 'DNI'}:`, ticket.dni);
  addDetail('CELULAR:', ticket.phone);
  addDetail('CERTIFICADO:', ticket.certificateName || ticket.fullName);
  addDetail('ZONA:', ticket.zoneName);
  addDetail('BUTACA:', ticket.seatNumber ? ticket.seatNumber : 'Zona General');
  addDetail('TOTAL ENTRADA:', `S/ ${ticket.price.toFixed(2)}`);
  if (ticket.paymentPlan === 'installments') {
    addDetail('MODALIDAD:', 'Pago en 2 Cuotas');
  }

  // Divider line
  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(10, y, 90, y);
  y += 6;

  // QR Code Generation
  try {
    const qrDataUrl = await QRCode.toDataURL(ticket.qrCode, {
      margin: 1,
      width: 150,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    doc.addImage(qrDataUrl, 'PNG', 32, y, 36, 36);
    y += 39;
  } catch (err) {
    console.error('Error generating QR for PDF:', err);
  }

  // Footer Instructions
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text('Presente este QR impreso o en su celular al ingresar.', 50, y, { align: 'center' });
  doc.text('Entrada personal e intransferible. Validez de 1 solo uso.', 50, y + 4, { align: 'center' });

  // Download PDF
  doc.save(`Entrada_${ticket.qrCode}_${ticket.fullName.replace(/\s+/g, '_')}.pdf`);
}
