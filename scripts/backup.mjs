import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno desde .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const envVars = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        envVars[key] = val;
      }
    }
  }
  return envVars;
}

const env = loadEnv();

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collectionsToBackup = [
  'reservas',
  'fechas_evento',
  'zonas',
  'vendedores',
  'gastos',
  'config'
];

async function runBackup() {
  console.log('🔄 Conectando a Firebase Firestore...');
  console.log(`📌 Proyecto: ${firebaseConfig.projectId}`);
  console.log('----------------------------------------------------');

  const backupData = {
    metadata: {
      projectId: firebaseConfig.projectId,
      timestamp: new Date().toISOString(),
      timestampLocal: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
      version: '1.0'
    },
    collections: {},
    stats: {}
  };

  for (const colName of collectionsToBackup) {
    try {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      const docs = [];
      snapshot.forEach(docSnap => {
        docs.push({
          _id: docSnap.id,
          ...docSnap.data()
        });
      });
      backupData.collections[colName] = docs;
      console.log(`✅ Colección [${colName}]: ${docs.length} documentos`);
    } catch (err) {
      console.error(`⚠️ Error al leer colección [${colName}]:`, err.message);
      backupData.collections[colName] = [];
    }
  }

  // Cálculos estadísticos detallados
  const reservas = backupData.collections.reservas || [];
  const gastos = backupData.collections.gastos || [];
  const vendedores = backupData.collections.vendedores || [];
  const fechas = backupData.collections.fechas_evento || [];

  let totalRecaudado = 0;
  let totalEsperado = 0;
  let countPagado = 0;
  let countParcial = 0;
  let countPendiente = 0;

  const zonaStats = {};
  const dateStats = {};

  for (const r of reservas) {
    const price = Number(r.totalPrice) || 0;
    const paid = Number(r.totalPaid) || (r.payments ? r.payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0) : 0);
    
    totalEsperado += price;
    totalRecaudado += paid;

    if (r.paymentStatus === 'paid') countPagado++;
    else if (r.paymentStatus === 'partial') countParcial++;
    else countPendiente++;

    // Por zona
    const zName = r.zoneName || r.zoneId || 'Sin Zona';
    zonaStats[zName] = (zonaStats[zName] || 0) + 1;

    // Por fecha
    const fName = r.eventDateName || r.eventDateId || 'Fecha no especificada';
    dateStats[fName] = (dateStats[fName] || 0) + 1;
  }

  const totalGastos = gastos.reduce((acc, g) => acc + (Number(g.amount) || 0), 0);
  const balanceNeto = totalRecaudado - totalGastos;

  backupData.stats = {
    totalReservas: reservas.length,
    reservasPagadas: countPagado,
    reservasParciales: countParcial,
    reservasPendientes: countPendiente,
    totalMontoEsperado: totalEsperado,
    totalMontoRecaudado: totalRecaudado,
    totalSaldoPendiente: totalEsperado - totalRecaudado,
    totalGastos,
    balanceNeto,
    totalVendedores: vendedores.length,
    totalFechas: fechas.length,
    distribucionZonas: zonaStats,
    distribucionFechas: dateStats
  };

  // Crear directorio de backups si no existe
  const backupsDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Generar nombre de archivo con timestamp seguro
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const filename = `backup_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  const filePath = path.join(backupsDir, filename);
  const latestPath = path.join(backupsDir, 'latest.json');

  const jsonStr = JSON.stringify(backupData, null, 2);
  fs.writeFileSync(filePath, jsonStr, 'utf8');
  fs.writeFileSync(latestPath, jsonStr, 'utf8');

  console.log('----------------------------------------------------');
  console.log(`💾 COPIA DE SEGURIDAD GUARDADA EXITOSAMENTE:`);
  console.log(`📁 Archivo: ${filePath}`);
  console.log(`📁 Enlace rápido: ${latestPath}`);
  console.log(`📊 Tamaño del archivo: ${(Buffer.byteLength(jsonStr) / 1024).toFixed(2)} KB`);
  console.log('----------------------------------------------------');
  console.log('📈 ESTADO GENERAL DE LA BASE DE DATOS:');
  console.log(`- Total de Reservas/Ventas: ${reservas.length}`);
  console.log(`   • Pagadas al 100%: ${countPagado}`);
  console.log(`   • Pagos Parciales: ${countParcial}`);
  console.log(`   • Pendientes: ${countPendiente}`);
  console.log(`- Recaudación Total: S/ ${totalRecaudado.toFixed(2)}`);
  console.log(`- Saldo por Cobrar: S/ ${(totalEsperado - totalRecaudado).toFixed(2)}`);
  console.log(`- Total Gastos Caja: S/ ${totalGastos.toFixed(2)}`);
  console.log(`- Balance de Caja Neto: S/ ${balanceNeto.toFixed(2)}`);
  console.log(`- Vendedores registrados: ${vendedores.length}`);
  console.log(`- Fechas activas: ${fechas.length}`);

  process.exit(0);
}

runBackup().catch(err => {
  console.error('❌ Error fatal durante el backup:', err);
  process.exit(1);
});
