export const MODALIDADES_SERVICIO = [
  {
    value: 'LOCAL_Y_DOMICILIO',
    label: 'En el local y a domicilio',
    descripcion: 'Tiene local abierto y también realiza entregas a domicilio.'
  },
  {
    value: 'SOLO_DOMICILIO',
    label: 'Solo a domicilio',
    descripcion: 'No tiene local físico; opera únicamente con envíos a domicilio.'
  },
  {
    value: 'DOMICILIO_Y_RECOGER',
    label: 'A domicilio y pasar a recoger',
    descripcion: 'Ideal para negocios que inician: entrega a domicilio y/o recogida.'
  },
  {
    value: 'SOLO_LOCAL',
    label: 'Solo en el local',
    descripcion: 'Consumo en el establecimiento sin reparto a domicilio.'
  }
];

export const EVENTO_MODALIDAD_CAMBIADA = 'saborlocal:modalidad_cambiada';

export const obtenerEtiquetaModalidad = (valorRaw) => {
  const val = String(valorRaw || '').toUpperCase().trim();
  const encontrada = MODALIDADES_SERVICIO.find((m) => m.value === val);
  if (encontrada) return encontrada.label;

  if (val.includes('SOLO') && val.includes('LOCAL')) return 'Solo en el local';
  if (val.includes('RECOGER')) return 'A domicilio y pasar a recoger';
  if (val.includes('SOLO') && val.includes('DOMICILIO')) return 'Solo a domicilio';
  return 'En el local y a domicilio';
};

export const guardarModalidadLocal = (identificador, modalidad) => {
  try {
    const normalizada = String(modalidad || 'LOCAL_Y_DOMICILIO').toUpperCase().trim();
    const mapaActual = JSON.parse(localStorage.getItem('saborlocal_modalidades_comercio') || '{}');
    if (identificador !== undefined && identificador !== null && String(identificador).trim() !== '') {
      const clave = String(identificador).trim().toLowerCase();
      mapaActual[clave] = normalizada;
      localStorage.setItem('saborlocal_modalidades_comercio', JSON.stringify(mapaActual));

      window.dispatchEvent(
        new CustomEvent(EVENTO_MODALIDAD_CAMBIADA, {
          detail: { identificador: clave, modalidad: normalizada }
        })
      );
    }
  } catch {
    // Ignorar error de almacenamiento local
  }
};

export const leerModalidadLocal = (comercioObj = {}) => {
  try {
    const mapaActual = JSON.parse(localStorage.getItem('saborlocal_modalidades_comercio') || '{}');
    const candidatos = [
      comercioObj?.id,
      comercioObj?.Id,
      comercioObj?.comercioId,
      comercioObj?.tenantId,
      comercioObj?.correoDuenio,
      comercioObj?.CorreoDuenio,
      comercioObj?.correo,
      comercioObj?.nombreComercio,
      comercioObj?.NombreComercio
    ];

    for (const c of candidatos) {
      if (c !== undefined && c !== null && String(c).trim() !== '') {
        const encontrada = mapaActual[String(c).trim().toLowerCase()];
        if (encontrada) return encontrada;
      }
    }
  } catch {
    // Ignorar error de almacenamiento local
  }

  return (
    comercioObj?.modalidadServicio ||
    comercioObj?.ModalidadServicio ||
    comercioObj?.tipoServicio ||
    'LOCAL_Y_DOMICILIO'
  );
};