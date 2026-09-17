export interface DniResult {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  numeroDocumento: string;
}

// Token por defecto provisto por el usuario
const DEFAULT_TOKEN = '25474|yuN3eINp2tf2Qp3UsGx1nZPMjJ5bgKIEkY1E4SxK5202e8e7';

export const fetchDniData = async (dni: string): Promise<DniResult> => {
  if (dni.length !== 8 || isNaN(Number(dni))) {
    throw new Error('El DNI debe tener 8 dígitos numéricos.');
  }

  const token = import.meta.env.VITE_DNI_API_TOKEN || DEFAULT_TOKEN;

  try {
    // Intentar consulta con ApiPeru.dev / APIs compatibles
    const response = await fetch(`https://apiperu.dev/api/dni/${dni}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('DNI no encontrado.');
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('Token de API no válido o saldo insuficiente.');
      }
      throw new Error(`Error en la consulta (${response.status}). Complete su nombre manualmente.`);
    }

    const data = await response.json();
    const payload = data.data || data.result || data;

    const nombres = payload.nombres || payload.nombre || payload.name || '';
    const apellidoPaterno = payload.apellidoPaterno || payload.apellido_paterno || payload.paterno || '';
    const apellidoMaterno = payload.apellidoMaterno || payload.apellido_materno || payload.materno || '';
    
    let nombreCompleto = payload.nombreCompleto || payload.nombre_completo || payload.full_name || '';
    if (!nombreCompleto && (nombres || apellidoPaterno)) {
      nombreCompleto = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim();
    }

    if (!nombreCompleto) {
      throw new Error('No se encontraron los datos del DNI. Por favor ingréselos manualmente.');
    }

    return {
      nombres,
      apellidoPaterno,
      apellidoMaterno,
      nombreCompleto,
      numeroDocumento: dni,
    };
  } catch (err: any) {
    console.warn('Advertencia en consulta DNI:', err);
    throw new Error(err.message || 'No se pudo consultar el DNI. Ingrese sus nombres manualmente.');
  }
};
