# 📖 Manual de Uso, Administración y Despliegue
## Sistema de Venta de Entradas y Gestión de Butacas — Evento Estilistas 2026

---

## 📋 Índice
1. [Descripción General](#1-descripción-general)
2. [Guía para el Cliente (Asistente)](#2-guía-para-el-cliente-asistente)
3. [Guía para el Administrador](#3-guía-para-el-administrador)
4. [Configuración Técnica de Servicios (DNI, Firebase y OCR)](#4-configuración-técnica-de-servicios)
5. [Despliegue a Producción (Paso a Paso)](#5-despliegue-a-producción-paso-a-paso)

---

## 1. Descripción General

La aplicación está diseñada para resolver la venta de entradas de eventos con dos modalidades de zona:
* **Zonas Numeradas (Butacas especificas):** Ejemplo: Filas A-Z, asientos A1, B2, C16.
* **Zonas por Stock (Sin numeración):** Orden de llegada / Zona General.

### Características Clave:
- **Tiempo Real:** Actualización dinámica de asientos mediante subscripción Firestore.
- **Lectura Automática de Vouchers (OCR):** Lee el Nro. de Operación directamente de la captura de Yape/Plin subida por el usuario.
- **Validación de DNI en Vivo:** Consulta la API pública para autocompletar Nombres y Apellidos.
- **Descarga de Boleto PDF con Código QR:** Formato listo para guardar en celular o imprimir.
- **Escaner QR para Control de Accesos:** Herramienta Web para escanear en la puerta el día del evento sin hardware especializado.

---

## 2. Guía para el Cliente (Asistente)

### Paso 1: Selección de Zona y Butaca (`/booking`)
1. El usuario ingresa a la web y selecciona el piso (Piso 1 o Piso 2) y la Zona deseada.
2. Si la zona es **Numerada**, se despliega el mapa interactivo de asientos (adaptado para móviles).
   - 🟩 Verde: Asiento libre.
   - 🟥 Rojo: Asiento ocupado/reservado.
   - 🟨 Amarillo: Asiento seleccionado.
3. Si la zona es **por Stock**, solo selecciona el número de entradas requeridas (sujeto a disponibilidad restante).

### Paso 2: Registro de Datos
1. Ingresar el número de **DNI (8 dígitos)**.
2. Al presionar "Consultar DNI", la web autocompleta automáticamente los **Nombres y Apellidos** desde la RENIEC.
3. Completar:
   - Nombre para el certificado.
   - Correo electrónico.
   - Número de celular (WhatsApp).
   - Ciudad de procedencia.

### Paso 3: Pago y Carga de Comprobante (OCR)
1. La pantalla muestra los métodos de pago (QR Yape/Plin y Nro. de Cuenta bancaria).
2. El cliente sube la captura de pantalla o foto de su voucher de pago.
3. **Lector Automático (OCR):** La web analizará la imagen y extraerá automáticamente el **Número de Operación**. El campo se iluminará en verde. Si la imagen es difusa, el usuario puede corregirlo manualmente.

### Paso 4: Seguimiento y Descarga del Boleto (`/tracking`)
1. El cliente puede consultar su estado ingresando su DNI en el **Portal de Consulta**.
2. Al ser **Aprobado** por el administrador, se habilita el botón **"Descargar Boleto PDF (con Código QR)"**.

---

## 3. Guía para el Administrador

Acceso por defecto: `/admin` (Credenciales demo: `admin@estilistas.com` / `admin123`).

### A. Panel de Ventas (`/admin/sales`)
- **Filtros rápidos:** Todos, Pagados, Parciales, Pendientes.
- **Buscador:** Por Nombre o por DNI.
- **Verificación de Pagos:** Al hacer clic en una venta pendiente, se visualiza el voucher subido y el número de operación detectado.
- **Acciones:** Aprobar pago, Rechazar venta, o Descargar el Boleto PDF con QR para enviarlo al cliente por WhatsApp.

### B. Configuración del Mapa y Zonas (`/admin/map-config`)
- Permitir al organizador ajustar el evento antes de iniciar ventas:
  - Crear nuevas zonas (Ej: "Zona VIP Platinum", "Zona General").
  - Elegir si es por **Numeración (Filas × Columnas)** o **Stock Directo**.
  - Asignar precio y color distintivo.

### C. Escáner QR de Puerta (`/admin/qr-scanner`)
- Utilizado el día del evento por el personal de seguridad/recepción.
- Abre la cámara del dispositivo móvil o laptop.
- Al enfocar un QR de entrada:
  - ✅ **Verde (VÁLIDO):** Muestra el Nombre y la Butaca asignada. Marca la entrada como "Asistida".
  - ❌ **Rojo (YA USADA / INVÁLIDA):** Alerta sonora y visual si alguien intenta ingresar con una entrada duplicada.
- Incluye un campo para **Ingreso Manual de Código** como respaldo si la pantalla del usuario está rota.

---

## 4. Configuración Técnica de Servicios

Para poner el sistema en producción al 100% real, solo debes configurar las variables en el archivo `.env`:

```env
# 1. API DE CONSULTA DNI (Proveedores activos: apiperu.dev / decolecta / apidni)
VITE_DNI_API_TOKEN=tu_token_obtenido_de_apiperu_o_decolecta
# Opcional: Si usas una URL personalizada de API propia o proxy
VITE_DNI_API_URL=https://apiperu.dev/api/dni/

# 2. FIREBASE CONFIGURATION (Consola Firebase > Configuración del proyecto)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tus-butacas.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tus-butacas
VITE_FIREBASE_STORAGE_BUCKET=tus-butacas.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Configuración del Servidor de DNI (`src/lib/api.ts`):
Debido a la normativa de Protección de Datos Personales en Perú, APIs públicas antiguas como `apis.net.pe` deshabilitaron su servicio gratuito público. Por ello, hemos actualizado el código para admitir cualquier proveedor activo o backend personalizado:

* **Proveedores recomendados con API Token:**
  1. **ApiPeru.dev:** `https://apiperu.dev/` (Planes gratis y de producción por token Bearer).
  2. **Decolecta:** `https://decolecta.com/` (Excelente estabilidad y respuesta JSON rápida).
  3. **ApiDni / JSON.pe:** `https://www.json.pe/` o `https://apidni.com/`.
* **Modo Sin Bloqueo (Fallback manual):**
  - Si el usuario no tiene token en `.env`, el sistema simula los datos en modo de pruebas.
  - Si una API devuelve error o no encuentra el DNI, el campo **Nombres y Apellidos** se habilita para edición manual sin bloquear la compra.

---

## 5. Despliegue a Producción (Paso a Paso)

### Opción A: Despliegue en Vercel (Recomendado)
1. Sube tu código a un repositorio de GitHub (o GitLab).
2. Entra a [vercel.com](https://vercel.com) e inicie sesión.
3. Haz clic en **"Add New Project"** e importa tu repositorio.
4. En la sección **Environment Variables**, agrega las variables del punto 4 (`VITE_DNI_API_TOKEN`, etc.).
5. Haz clic en **Deploy**. ¡Listo en menos de 2 minutos!

### Opción B: Build Local para Hosting Tradicional (cPanel / Apache / Nginx)
1. Ejecuta el comando de compilación en la terminal:
   ```bash
   npm run build
   ```
2. Esto generará una carpeta llamada `dist/`.
3. Sube todos los archivos que están dentro de la carpeta `dist/` a tu servidor de hosting (`public_html`).

---
*Manual generado automáticamente para la plataforma Evento Estilistas 2026.*
