# Plataforma de Venta de Entradas y Reserva de Butacas

Plataforma web para la reserva de butacas y venta de entradas a eventos. 
Desarrollada con React, TypeScript, TailwindCSS y Firebase.

## Características

- **Visualización de Mapa de Asientos:** Los clientes pueden ver un mapa interactivo para seleccionar sus butacas o zonas (numeradas o por stock general).
- **Integración con API de DNI:** Autocompletado de nombres a partir del DNI usando la API de Perú (`apiperu.dev`).
- **Pagos y OCR:** Los usuarios suben la captura de pantalla de su pago (Yape/Plin/Transferencia), y el sistema intenta extraer automáticamente el número de operación usando `Tesseract.js` (OCR).
- **Panel Administrativo Protegido:** Autenticación con Firebase Auth para administrar el sistema (`/login`).
- **Dashboard y Ventas:** Visualización de métricas en tiempo real, gestión de aprobaciones de pago, exportación a CSV.
- **Configuración de Zonas:** El administrador puede editar zonas, precios, y tipo de mapa directamente desde el panel.
- **Escáner QR Nativo:** Validación de boletos en la puerta usando la cámara del dispositivo móvil gracias a `html5-qrcode`.

## Configuración y Variables de Entorno

Debes crear un archivo `.env` en la raíz del proyecto, basándote en el archivo `.env.example`. 
Asegúrate de llenar todas las claves de Firebase y de tu API de DNI.

```env
VITE_DNI_API_TOKEN=tu_token
VITE_DNI_API_URL=https://apiperu.dev/api/dni

VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_dominio
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

## Estructura de Firebase

Para que la aplicación funcione correctamente, debes configurar los siguientes servicios en Firebase:

1. **Authentication:** Habilitar método de inicio de sesión con Correo/Contraseña.
2. **Firestore Database:** 
   - Colección `reservas` (Almacena todas las compras y ventas)
   - Colección `zonas` (Almacena la configuración del mapa)
3. **Storage:** (Opcional pero recomendado en el Plan Blaze) para almacenar las imágenes de los comprobantes de pago subidos por los clientes.

### Reglas de Seguridad Básicas (Firestore)
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reservas/{reservaId} {
      allow read: if true; // Para tracking
      allow write: if true; // Para nueva reserva pública (puedes restringir con más reglas según IP/captcha en prod)
      allow update: if request.auth != null; // Admin
    }
    match /zonas/{zonaId} {
      allow read: if true;
      allow write, update, delete: if request.auth != null; // Admin
    }
  }
}
```

## Ejecución Local

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Ejecuta el entorno de desarrollo:
   ```bash
   npm run dev
   ```

## Compilación para Producción (GitHub Pages / Firebase Hosting / Vercel)

```bash
npm run build
```
