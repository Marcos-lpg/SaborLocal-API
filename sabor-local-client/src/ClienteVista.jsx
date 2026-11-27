import { useState, useEffect, useRef, useMemo } from 'react';
import api from './ApiClient';
import {
  obtenerEtiquetaModalidad,
  leerModalidadLocal,
  EVENTO_MODALIDAD_CAMBIADA
} from './modalidadesServicio';

const DURACION_ENTREGADO_MS = 15000;
const EVENTO_PROMOCIONES_CAMBIADAS = 'saborlocal:promociones_cambiadas';
const EVENTO_BANCO_CAMBIADO = 'saborlocal:banco_cambiado';
const CLAVE_PEDIDOS_ACTIVOS = 'saborlocal_pedidos_activos';
const CLAVE_PEDIDOS_OCULTOS = 'saborlocal_pedidos_completados_ocultos';

const obtenerClavePedido = (pedido) =>
  String(pedido?.id ?? pedido?.Id ?? pedido?.pedidoId ?? pedido?.PedidoId ?? '').trim();

const esEstadoCompletado = (estadoRaw) => {
  const st = String(estadoRaw || '').toUpperCase().trim();
  return st === 'COMPLETADO' || st === 'ENTREGADO';
};

const esEstadoCancelado = (estadoRaw) => {
  const st = String(estadoRaw || '').toUpperCase().trim();
  return st === 'CANCELADO';
};

const leerMapaPedidosOcultos = () => {
  try {
    const raw = localStorage.getItem(CLAVE_PEDIDOS_OCULTOS) || '{}';
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const marcarPedidoOcultoPermanentemente = (pedidoId, ahora = Date.now()) => {
  const key = String(pedidoId || '').trim();
  if (!key) return;
  try {
    const mapa = leerMapaPedidosOcultos();
    mapa[key] = mapa[key] || ahora;
    localStorage.setItem(CLAVE_PEDIDOS_OCULTOS, JSON.stringify(mapa));
  } catch {
    // Ignorar error de storage
  }
};

const leerPromocionesParaComercio = (comercioObj) => {
  try {
    const candidatos = [
      comercioObj?.id,
      comercioObj?.Id,
      comercioObj?.comercioId,
      comercioObj?.tenantId,
      comercioObj?.nombreComercio,
      comercioObj?.NombreComercio,
      comercioObj?.correoDuenio,
      comercioObj?.CorreoDuenio,
      comercioObj?.correo
    ];

    for (const c of candidatos) {
      if (c !== undefined && c !== null && String(c).trim() !== '') {
        const clave = String(c).trim().toLowerCase();
        const raw = localStorage.getItem(`saborlocal_promociones_${clave}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    }
  } catch {
    // Ignorar error de lectura local
  }
  return [];
};

const leerBancoParaComercio = (comercioObj) => {
  try {
    const candidatos = [
      comercioObj?.id,
      comercioObj?.Id,
      comercioObj?.comercioId,
      comercioObj?.tenantId,
      comercioObj?.nombreComercio,
      comercioObj?.NombreComercio,
      comercioObj?.correoDuenio,
      comercioObj?.CorreoDuenio,
      comercioObj?.correo,
      1
    ];

    for (const c of candidatos) {
      if (c !== undefined && c !== null && String(c).trim() !== '') {
        const clave = String(c).trim().toLowerCase();
        const raw = localStorage.getItem(`banco_${clave}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.banco || parsed.numeroCuenta || parsed.titular)) {
            return {
              banco: parsed.banco || '',
              numeroCuenta: parsed.numeroCuenta || '',
              titular: parsed.titular || ''
            };
          }
        }
      }
    }
  } catch {
    // Ignorar error de lectura local
  }
  return null;
};

const formatearEstadoPedido = (estadoRaw) => {
  const st = String(estadoRaw || 'RECIBIDO').toUpperCase().trim();
  if (st === 'RECIBIDO' || st === 'PENDIENTE') return 'Recibido';
  if (st === 'EN_PREPARACION' || st === 'PREPARANDO') return 'Pedido en preparación';
  if (st === 'HACIA_DOMICILIO') return 'Hacia tu domicilio';
  if (st === 'COMPLETADO' || st === 'ENTREGADO') return 'Pedido entregado';
  return estadoRaw || 'Recibido';
};

const normalizarPedidoConTiempo = (pedido, previo = null, ahora = Date.now(), mapaOcultos = {}) => {
  const key = obtenerClavePedido(pedido);
  const estado = pedido?.estado ?? previo?.estado ?? 'RECIBIDO';
  const completado = esEstadoCompletado(estado);

  let entregadoEn = Number(pedido?.entregadoEn || previo?.entregadoEn || 0) || undefined;
  let ocultarCompletadoEn =
    Number(pedido?.ocultarCompletadoEn || previo?.ocultarCompletadoEn || 0) || undefined;

  if (completado) {
    const baseTimestamp =
      entregadoEn ||
      Number(pedido?.calificadoEn || previo?.calificadoEn || 0) ||
      ahora;
    entregadoEn = baseTimestamp;
    if (!ocultarCompletadoEn) {
      ocultarCompletadoEn = baseTimestamp + DURACION_ENTREGADO_MS;
    }
  } else {
    entregadoEn = undefined;
    ocultarCompletadoEn = undefined;
  }

  const calificadoEn = Number(pedido?.calificadoEn || previo?.calificadoEn || 0) || undefined;
  const calificacion = pedido?.calificacion ?? previo?.calificacion;
  const yaOcultoPorTiempo = Boolean(key && mapaOcultos[key]);

  return {
    ...(previo || {}),
    ...pedido,
    id: pedido?.id ?? previo?.id,
    pedidoId: pedido?.pedidoId || previo?.pedidoId || (pedido?.id ? `ORD-${pedido.id}` : ''),
    estado,
    ...(entregadoEn ? { entregadoEn } : {}),
    ...(ocultarCompletadoEn ? { ocultarCompletadoEn } : {}),
    ...(calificadoEn ? { calificadoEn } : {}),
    ...(calificacion !== undefined ? { calificacion } : {}),
    ...(yaOcultoPorTiempo ? { ocultoPorTiempo: true } : {})
  };
};

function ClienteVista({
  comercio,
  servidorActivo = true,
  onPerderConexion = () => {},
  onRecuperarConexion = () => {},
  onCalificacionGuardada
}) {
  const comercioId = comercio?.id;
  const [productos, setProductos] = useState([]);
  const [promociones, setPromociones] = useState(() => leerPromocionesParaComercio(comercio));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalidadComercio, setModalidadComercio] = useState(() => leerModalidadLocal(comercio));

  const [notificacionApp, setNotificacionApp] = useState(null);
  const timerNotificacionRef = useRef(null);
  const timerCierreModalRef = useRef(null);
  const productosRef = useRef([]);
  productosRef.current = productos;
  const cargandoMenuRef = useRef(false);
  const verificandoPedidosRef = useRef(false);

  const onPerderConexionRef = useRef(onPerderConexion);
  onPerderConexionRef.current = onPerderConexion;
  const onRecuperarConexionRef = useRef(onRecuperarConexion);
  onRecuperarConexionRef.current = onRecuperarConexion;

  const mostrarNotificacion = (mensaje, tipo = 'exito') => {
    setNotificacionApp({ mensaje, tipo });
    clearTimeout(timerNotificacionRef.current);
    timerNotificacionRef.current = setTimeout(() => {
      setNotificacionApp(null);
    }, 4500);
  };

  useEffect(() => {
    return () => {
      clearTimeout(timerNotificacionRef.current);
      clearTimeout(timerCierreModalRef.current);
    };
  }, []);

  useEffect(() => {
    const sincronizarModalidad = () => {
      const actualizada = leerModalidadLocal(comercio);
      setModalidadComercio((prev) => (prev === actualizada ? prev : actualizada));
    };

    sincronizarModalidad();

    window.addEventListener(EVENTO_MODALIDAD_CAMBIADA, sincronizarModalidad);
    window.addEventListener('storage', sincronizarModalidad);

    return () => {
      window.removeEventListener(EVENTO_MODALIDAD_CAMBIADA, sincronizarModalidad);
      window.removeEventListener('storage', sincronizarModalidad);
    };
  }, [comercioId]);

  useEffect(() => {
    const sincronizarPromociones = () => {
      const actualizadas = leerPromocionesParaComercio(comercio);
      setPromociones((prev) =>
        JSON.stringify(prev) === JSON.stringify(actualizadas) ? prev : actualizadas
      );
    };

    sincronizarPromociones();

    window.addEventListener(EVENTO_PROMOCIONES_CAMBIADAS, sincronizarPromociones);
    window.addEventListener('storage', sincronizarPromociones);

    return () => {
      window.removeEventListener(EVENTO_PROMOCIONES_CAMBIADAS, sincronizarPromociones);
      window.removeEventListener('storage', sincronizarPromociones);
    };
  }, [comercioId]);

  const obtenerClaveCarrito = (idCom) => {
    try {
      const sesionRaw =
        sessionStorage.getItem('saborlocal_sesion_tab') ||
        localStorage.getItem('saborlocal_sesion_offline');
      const sesionParsed = sesionRaw ? JSON.parse(sesionRaw) : null;
      const identificadorUsuario =
        sesionParsed?.telefono || sesionParsed?.nombre || 'invitado';
      return `carrito_comercio_${identificadorUsuario}_${idCom}`;
    } catch {
      return `carrito_comercio_invitado_${idCom}`;
    }
  };

  const leerCarritoGuardado = (idCom) => {
    if (!idCom) return [];
    try {
      const guardado = localStorage.getItem(obtenerClaveCarrito(idCom));
      const parsed = guardado ? JSON.parse(guardado) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const esPedidoVisibleActivo = (pedido, ahora = Date.now(), mapaOcultos = null) => {
    if (!pedido || pedido.ocultoPorTiempo) return false;
    const key = obtenerClavePedido(pedido);
    const ocultos = mapaOcultos || leerMapaPedidosOcultos();
    if (key && ocultos[key]) return false;

    if (esEstadoCancelado(pedido?.estado)) return false;

    if (esEstadoCompletado(pedido?.estado)) {
      const expiraEn =
        Number(pedido?.ocultarCompletadoEn || 0) ||
        (Number(pedido?.entregadoEn || pedido?.calificadoEn || 0) > 0
          ? Number(pedido?.entregadoEn || pedido?.calificadoEn || 0) + DURACION_ENTREGADO_MS
          : 0);

      if (!expiraEn) return false;
      if (ahora >= expiraEn) {
        if (key) marcarPedidoOcultoPermanentemente(key, ahora);
        return false;
      }
      return true;
    }

    return true;
  };

  const leerPedidosActivosGuardados = (idCom) => {
    try {
      const raw = localStorage.getItem(CLAVE_PEDIDOS_ACTIVOS) || '[]';
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const ahora = Date.now();
      const mapaOcultos = leerMapaPedidosOcultos();
      return parsed
        .map((p) => normalizarPedidoConTiempo(p, p, ahora, mapaOcultos))
        .filter((p) => {
          const mismoComercio = idCom ? Number(p?.tenantId) === Number(idCom) : true;
          return mismoComercio && esPedidoVisibleActivo(p, ahora, mapaOcultos);
        });
    } catch {
      return [];
    }
  };

  const [carrito, setCarrito] = useState(() => leerCarritoGuardado(comercioId));
  const [modalCheckout, setModalCheckout] = useState(false);
  const comercioCargadoRef = useRef(comercioId);
  const comercioRef = useRef(comercio);
  comercioRef.current = comercio;

  const enLinea = Boolean(servidorActivo) && navigator.onLine;
  const enLineaRef = useRef(enLinea);
  enLineaRef.current = enLinea;

  const estaAbierto = comercio?.estaAbierto !== false;
  const envioGratis = comercio?.envioGratis !== false || !(Number(comercio?.costoEnvio) > 0);
  const costoEnvio = envioGratis ? 0 : Number(comercio?.costoEnvio || 0);
  const modalidadUpper = String(modalidadComercio || 'LOCAL_Y_DOMICILIO').toUpperCase().trim();
  const esSoloLocal = modalidadUpper === 'SOLO_LOCAL';
  const permiteRecoger = modalidadUpper === 'DOMICILIO_Y_RECOGER';
  const etiquetaModalidad = obtenerEtiquetaModalidad(modalidadUpper);

  const [nombreCliente, setNombreCliente] = useState(() => {
    try {
      const s =
        sessionStorage.getItem('saborlocal_sesion_tab') ||
        localStorage.getItem('saborlocal_sesion_offline');
      return s ? JSON.parse(s)?.nombre || '' : '';
    } catch {
      return '';
    }
  });
  const [telefonoCliente, setTelefonoCliente] = useState(() => localStorage.getItem('clienteTelefono') || '');
  const [direccionCliente, setDireccionCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [cambioPara, setCambioPara] = useState('');

  const [comprobanteBase64, setComprobanteBase64] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [cargandoImagen, setCargandoImagen] = useState(false);
  const [datosBancoRestaurante, setDatosBancoRestaurante] = useState(() => leerBancoParaComercio(comercio));
  const [mensajeRevision, setMensajeRevision] = useState(false);

  const [pedidoEnviado, setPedidoEnviado] = useState(false);
  const [misPedidos, setMisPedidos] = useState(() => leerPedidosActivosGuardados(comercioId));
  const [tipoEntregaPedido, setTipoEntregaPedido] = useState('DOMICILIO');
  const [calificacionesForm, setCalificacionesForm] = useState({});
  const [hoverEstrella, setHoverEstrella] = useState({});
  const [pedidosCalificadosLocal, setPedidosCalificadosLocal] = useState({});
  const [enviandoCalificacionId, setEnviandoCalificacionId] = useState(null);

  const limpiarFormularioCheckout = () => {
    setTipoEntregaPedido('DOMICILIO');
    setNombreCliente('');
    setTelefonoCliente('');
    setDireccionCliente('');
    setMetodoPago('Efectivo');
    setCambioPara('');
    setComprobanteBase64('');
    setNombreArchivo('');
    setCargandoImagen(false);
    setMensajeRevision(false);
    setPedidoEnviado(false);
  };

  const abrirModalCheckout = () => {
    if (esSoloLocal) {
      mostrarNotificacion('Este restaurante no cuenta con servicio a domicilio.', 'aviso');
      return;
    }
    limpiarFormularioCheckout();
    setDatosBancoRestaurante(leerBancoParaComercio(comercioRef.current));
    setModalCheckout(true);
  };

  const cerrarModalCheckout = () => {
    limpiarFormularioCheckout();
    setModalCheckout(false);
  };

  useEffect(() => {
    if (comercioId && comercioCargadoRef.current !== comercioId) {
      comercioCargadoRef.current = comercioId;
      setCarrito(leerCarritoGuardado(comercioId));
      setProductos([]);
    }
    if (comercioId) {
      setMisPedidos(leerPedidosActivosGuardados(comercioId));
    }
  }, [comercioId]);

  useEffect(() => {
    if (!comercioId) return;
    try {
      const clave = obtenerClaveCarrito(comercioId);
      if (carrito.length > 0) {
        localStorage.setItem(clave, JSON.stringify(carrito));
      } else {
        localStorage.removeItem(clave);
      }
    } catch (e) {
      console.error('Error al guardar el carrito local:', e);
    }
  }, [carrito, comercioId]);

  const guardarEnDirectorioOffline = (datosComercio, listaProductos) => {
    if (!datosComercio?.id) return;
    try {
      localStorage.setItem(`cache_menu_${datosComercio.id}`, JSON.stringify(listaProductos));
      const directorioActual = JSON.parse(localStorage.getItem('directorio_offline') || '[]');
      const ficha = {
        id: datosComercio.id,
        nombreComercio: datosComercio.nombreComercio,
        modalidadServicio: leerModalidadLocal(datosComercio),
        direccion: datosComercio.direccion || 'Candelaria, Campeche',
        telefono: datosComercio.telefono || datosComercio.telefonoComercio || 'Sin teléfono',
        categoria: datosComercio.categoria || 'Especialidades de la Casa',
        horarioAtencion: datosComercio.horarioAtencion || 'Lun - Dom: 9:00 AM - 10:00 PM',
        tiempoPreparacion: datosComercio.tiempoPreparacion || '25-40 min',
        envioGratis: datosComercio.envioGratis !== false,
        costoEnvio: Number(datosComercio.costoEnvio || 0),
        logoUrl: datosComercio.logoUrl || null,
        estaAbierto: datosComercio.estaAbierto !== false,
        calificacionPromedio: Number(datosComercio.calificacionPromedio || 0),
        totalCalificaciones: Number(datosComercio.totalCalificaciones || 0),
        actualizadoEn: new Date().toISOString()
      };
      const sinDuplicado = directorioActual.filter((c) => c.id !== datosComercio.id);
      localStorage.setItem('directorio_offline', JSON.stringify([ficha, ...sinDuplicado]));
    } catch (e) {
      console.error('Error al guardar en caché local:', e);
    }
  };

  useEffect(() => {
    const sincronizarBanco = () => {
      const actualizado = leerBancoParaComercio(comercioRef.current);
      setDatosBancoRestaurante((prev) =>
        JSON.stringify(prev) === JSON.stringify(actualizado) ? prev : actualizado
      );
    };

    sincronizarBanco();
    window.addEventListener(EVENTO_BANCO_CAMBIADO, sincronizarBanco);
    window.addEventListener('storage', sincronizarBanco);

    return () => {
      window.removeEventListener(EVENTO_BANCO_CAMBIADO, sincronizarBanco);
      window.removeEventListener('storage', sincronizarBanco);
    };
  }, [comercioId]);

  useEffect(() => {
    if (!comercioId) return;

    let cancelado = false;

    const cargarProductosDelComercio = async () => {
      if (cargandoMenuRef.current) return;
      cargandoMenuRef.current = true;

      const cacheGuardada = localStorage.getItem(`cache_menu_${comercioId}`);
      if (productosRef.current.length === 0 && !cacheGuardada) {
        setLoading(true);
      }

      if (!navigator.onLine) {
        onPerderConexionRef.current();
        if (cacheGuardada && !cancelado) {
          setProductos((prev) => {
            const parsed = JSON.parse(cacheGuardada);
            return JSON.stringify(prev) === JSON.stringify(parsed) ? prev : parsed;
          });
          setError(null);
        } else if (!cancelado && productosRef.current.length === 0) {
          setError('No hay menú guardado previamente para este comercio en modo sin conexión.');
        }
        if (!cancelado) setLoading(false);
        cargandoMenuRef.current = false;
        return;
      }

      try {
        const res = await api.get(`/productos/comercio/${comercioId}`, {
          timeout: 2500,
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (cancelado) return;
        onRecuperarConexionRef.current();
        let listaFinal = [];
        if (Array.isArray(res?.data) && res.data.length > 0) {
          listaFinal = res.data;
        } else {
          const resGeneral = await api.get('/productos', {
            timeout: 2500,
            headers: { 'Cache-Control': 'no-cache' }
          });
          if (cancelado) return;
          listaFinal = (resGeneral?.data || []).filter(
            (p) => p.tenantId === comercioId || p.tenantId === 1 || !p.tenantId
          );
        }
        setProductos((prev) =>
          JSON.stringify(prev) === JSON.stringify(listaFinal) ? prev : listaFinal
        );
        guardarEnDirectorioOffline(comercioRef.current, listaFinal);
        setError(null);
      } catch {
        try {
          const resGeneral = await api.get('/productos', {
            timeout: 2500,
            headers: { 'Cache-Control': 'no-cache' }
          });
          if (cancelado) return;
          onRecuperarConexionRef.current();
          const datosGen = Array.isArray(resGeneral?.data) ? resGeneral.data : [];
          setProductos((prev) =>
            JSON.stringify(prev) === JSON.stringify(datosGen) ? prev : datosGen
          );
          guardarEnDirectorioOffline(comercioRef.current, datosGen);
          setError(null);
        } catch {
          if (cancelado) return;
          onPerderConexionRef.current();
          if (cacheGuardada) {
            setProductos((prev) => {
              const parsed = JSON.parse(cacheGuardada);
              return JSON.stringify(prev) === JSON.stringify(parsed) ? prev : parsed;
            });
            setError(null);
          } else if (productosRef.current.length === 0) {
            setError('No se pudo cargar el menú de este comercio.');
          }
        }
      } finally {
        cargandoMenuRef.current = false;
        if (!cancelado) setLoading(false);
      }
    };

    cargarProductosDelComercio();

    return () => {
      cancelado = true;
      cargandoMenuRef.current = false;
    };
  }, [comercioId]);

  const persistirPedidoActivoEnStorage = (pedidoObj) => {
    try {
      const actual = JSON.parse(localStorage.getItem(CLAVE_PEDIDOS_ACTIVOS) || '[]');
      const lista = Array.isArray(actual) ? actual : [];
      const keyNuevo = obtenerClavePedido(pedidoObj);
      const ahora = Date.now();
      const mapaOcultos = leerMapaPedidosOcultos();
      if (keyNuevo && mapaOcultos[keyNuevo]) return;

      const previo = lista.find((item) => obtenerClavePedido(item) === keyNuevo);
      const normalizado = normalizarPedidoConTiempo(pedidoObj, previo, ahora, mapaOcultos);

      const filtrados = lista.filter((item) => obtenerClavePedido(item) !== keyNuevo);
      const siguiente = [normalizado, ...filtrados].filter((p) =>
        esPedidoVisibleActivo(p, ahora, mapaOcultos)
      );

      localStorage.setItem(CLAVE_PEDIDOS_ACTIVOS, JSON.stringify(siguiente));
      const vigentesComercio = leerPedidosActivosGuardados(comercioId);
      setMisPedidos((prev) =>
        JSON.stringify(prev) === JSON.stringify(vigentesComercio) ? prev : vigentesComercio
      );
    } catch (e) {
      console.error('Error al persistir pedido activo:', e);
    }
  };

  useEffect(() => {
    if (!comercioId) return;

    let montado = true;

    const limpiarExpirados = () => {
      if (!montado) return;
      const ahora = Date.now();
      const mapaOcultos = leerMapaPedidosOcultos();
      let ocultosModificados = false;

      try {
        const raw = localStorage.getItem(CLAVE_PEDIDOS_ACTIVOS) || '[]';
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const vigentes = [];
          for (const item of parsed) {
            const norm = normalizarPedidoConTiempo(item, item, ahora, mapaOcultos);
            const key = obtenerClavePedido(norm);
            if (esPedidoVisibleActivo(norm, ahora, mapaOcultos)) {
              vigentes.push(norm);
            } else if (esEstadoCompletado(norm?.estado) && key && !mapaOcultos[key]) {
              mapaOcultos[key] = ahora;
              ocultosModificados = true;
            }
          }
          if (ocultosModificados) {
            localStorage.setItem(CLAVE_PEDIDOS_OCULTOS, JSON.stringify(mapaOcultos));
          }
          if (vigentes.length !== parsed.length) {
            localStorage.setItem(CLAVE_PEDIDOS_ACTIVOS, JSON.stringify(vigentes));
          }
        }
      } catch {
        // Ignorar error de lectura local
      }

      setMisPedidos((prev) => {
        const filtrados = prev
          .map((p) => normalizarPedidoConTiempo(p, p, ahora, mapaOcultos))
          .filter((p) => esPedidoVisibleActivo(p, ahora, mapaOcultos));
        return JSON.stringify(filtrados) === JSON.stringify(prev) ? prev : filtrados;
      });
    };

    const verificarEstatusPedidos = async () => {
      if (!montado || verificandoPedidosRef.current) return;
      verificandoPedidosRef.current = true;

      try {
        const ahora = Date.now();
        const mapaOcultos = leerMapaPedidosOcultos();
        const localesComercio = leerPedidosActivosGuardados(comercioId);

        setMisPedidos((prev) => {
          const vigentesPrev = prev
            .map((p) => normalizarPedidoConTiempo(p, p, ahora, mapaOcultos))
            .filter((p) => esPedidoVisibleActivo(p, ahora, mapaOcultos));
          return JSON.stringify(vigentesPrev) === JSON.stringify(prev) ? prev : vigentesPrev;
        });

        const telReferencia = String(localStorage.getItem('clienteTelefono') || '').trim();
        if (!enLineaRef.current) return;

        const res = await api.get('/pedidos', {
          timeout: 2500,
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!montado) return;
        onRecuperarConexionRef.current();

        const todos = Array.isArray(res?.data) ? res.data : [];
        const idsLocales = new Set(localesComercio.map((p) => obtenerClavePedido(p)).filter(Boolean));

        const todosActivosGlobalRaw = JSON.parse(localStorage.getItem(CLAVE_PEDIDOS_ACTIVOS) || '[]');
        const todosActivosGlobal = Array.isArray(todosActivosGlobalRaw)
          ? todosActivosGlobalRaw
          : [];

        const mapaGlobal = new Map();

        for (const item of todosActivosGlobal) {
          const key = obtenerClavePedido(item);
          if (!key || mapaOcultos[key]) continue;
          const matchServer = todos.find((s) => obtenerClavePedido(s) === key);
          const combinado = matchServer ? { ...item, ...matchServer, estado: matchServer.estado } : item;
          const norm = normalizarPedidoConTiempo(combinado, item, ahora, mapaOcultos);
          if (esPedidoVisibleActivo(norm, ahora, mapaOcultos)) {
            mapaGlobal.set(key, norm);
          } else if (esEstadoCompletado(norm?.estado) && !mapaOcultos[key]) {
            mapaOcultos[key] = ahora;
          }
        }

        for (const s of todos) {
          if (Number(s?.tenantId) !== Number(comercioId)) continue;
          const key = obtenerClavePedido(s);
          if (!key || mapaOcultos[key]) continue;

          const coincideTel =
            telReferencia && String(s?.telefonoCliente || '').trim() === telReferencia;
          const coincideId = idsLocales.has(key);
          if (!coincideTel && !coincideId) continue;

          const previo = mapaGlobal.get(key) || null;
          const norm = normalizarPedidoConTiempo(s, previo, ahora, mapaOcultos);
          if (esPedidoVisibleActivo(norm, ahora, mapaOcultos)) {
            mapaGlobal.set(key, norm);
          } else if (esEstadoCompletado(norm?.estado) && !mapaOcultos[key]) {
            mapaOcultos[key] = ahora;
          }
        }

        try {
          localStorage.setItem(CLAVE_PEDIDOS_OCULTOS, JSON.stringify(mapaOcultos));
        } catch {
          // Ignorar error de storage
        }

        const globalFiltrado = Array.from(mapaGlobal.values());
        try {
          const rawActual = localStorage.getItem(CLAVE_PEDIDOS_ACTIVOS) || '[]';
          if (JSON.stringify(globalFiltrado) !== rawActual) {
            localStorage.setItem(CLAVE_PEDIDOS_ACTIVOS, JSON.stringify(globalFiltrado));
          }
        } catch {
          // Ignorar error de storage
        }

        const listaComercio = globalFiltrado.filter(
          (p) => Number(p?.tenantId) === Number(comercioId)
        );

        if (montado) {
          setMisPedidos((prev) =>
            JSON.stringify(prev) === JSON.stringify(listaComercio) ? prev : listaComercio
          );
        }
      } catch {
        if (montado) onPerderConexionRef.current();
      } finally {
        verificandoPedidosRef.current = false;
      }
    };

    verificarEstatusPedidos();
    const intervalPedidos = setInterval(verificarEstatusPedidos, 5000);
    const intervalExpiracion = setInterval(limpiarExpirados, 1000);

    return () => {
      montado = false;
      verificandoPedidosRef.current = false;
      clearInterval(intervalPedidos);
      clearInterval(intervalExpiracion);
    };
  }, [comercioId]);

  const enviarCalificacion = async (pedidoId) => {
    const form = calificacionesForm[pedidoId] || { estrellas: 0 };
    if (!form.estrellas || form.estrellas < 1 || form.estrellas > 5) {
      mostrarNotificacion('Por favor selecciona de 1 a 5 estrellas para calificar al restaurante.', 'aviso');
      return;
    }

    setEnviandoCalificacionId(pedidoId);
    const marcaCalificado = Date.now();
    const expiraEn = marcaCalificado + DURACION_ENTREGADO_MS;
    const keyTarget = String(pedidoId);

    try {
      await api.put(`/pedidos/${pedidoId}/calificar`, {
        calificacion: form.estrellas
      });

      setPedidosCalificadosLocal((prev) => ({ ...prev, [pedidoId]: form.estrellas }));
      setMisPedidos((prev) =>
        prev.map((p) =>
          obtenerClavePedido(p) === keyTarget
            ? {
                ...p,
                calificacion: form.estrellas,
                calificadoEn: p.calificadoEn || marcaCalificado,
                entregadoEn: p.entregadoEn || marcaCalificado,
                ocultarCompletadoEn: p.ocultarCompletadoEn || expiraEn
              }
            : p
        )
      );

      try {
        const raw = localStorage.getItem(CLAVE_PEDIDOS_ACTIVOS) || '[]';
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const actualizado = parsed.map((p) =>
            obtenerClavePedido(p) === keyTarget
              ? {
                  ...p,
                  calificacion: form.estrellas,
                  calificadoEn: p.calificadoEn || marcaCalificado,
                  entregadoEn: p.entregadoEn || marcaCalificado,
                  ocultarCompletadoEn: p.ocultarCompletadoEn || expiraEn
                }
              : p
          );
          localStorage.setItem(CLAVE_PEDIDOS_ACTIVOS, JSON.stringify(actualizado));
        }
      } catch {
        // Ignorar error de storage
      }

      if (onCalificacionGuardada) {
        onCalificacionGuardada();
      }
      mostrarNotificacion('¡Gracias por calificar! Se ocultará en 15 segundos.', 'exito');
    } catch (err) {
      console.error('Error al enviar calificación:', err);
      mostrarNotificacion('No se pudo enviar tu calificación. Intenta nuevamente.', 'error');
    } finally {
      setEnviandoCalificacionId(null);
    }
  };

  const agregarAlCarrito = (producto) => {
    if (esSoloLocal) {
      mostrarNotificacion('Este restaurante no cuenta con servicio a domicilio.', 'aviso');
      return;
    }
    if (enLinea && !estaAbierto) {
      mostrarNotificacion('Este restaurante se encuentra cerrado en este momento.', 'aviso');
      return;
    }
    const itemExistente = carrito.find((item) => item.id === producto.id);
    if (itemExistente) {
      setCarrito(
        carrito.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        )
      );
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }
  };

  const agregarPromoAlCarrito = (promo) => {
    if (!promo?.disponible || esSoloLocal) return;
    const precioFinal =
      promo.precioPromo !== null && promo.precioPromo !== undefined ? Number(promo.precioPromo) : 0;
    const itemPromo = {
      id: `promo-${promo.id}`,
      nombre: `🔥 ${promo.titulo}`,
      descripcion: promo.descripcion || 'Promoción del día',
      precio: precioFinal
    };
    agregarAlCarrito(itemPromo);
    mostrarNotificacion(`"${promo.titulo}" agregada a tu pedido.`, 'exito');
  };

  const cambiarCantidad = (id, delta) => {
    if (esSoloLocal) return;
    setCarrito(
      carrito
        .map((item) => {
          if (item.id === id) {
            const nuevaCantidad = item.cantidad + delta;
            return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const vaciarCarrito = () => {
    if (esSoloLocal) return;
    setCarrito([]);
    if (comercioId) {
      localStorage.removeItem(obtenerClaveCarrito(comercioId));
    }
  };

  const calcularSubtotal = () => {
    return carrito.reduce((total, item) => total + Number(item.precio || 0) * Number(item.cantidad || 0), 0);
  };

  const calcularTotal = () => {
    const subtotal = calcularSubtotal();
    const total = subtotal + (carrito.length > 0 ? costoEnvio : 0);
    return total.toFixed(2);
  };

  const totalCantidadCarrito = esSoloLocal
    ? 0
    : carrito.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);

  const bloquearTeclasTelefono = (e) => {
    const teclasPermitidas = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'
    ];
    if (teclasPermitidas.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleTelefonoChange = (e) => {
    const soloNumeros = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
    setTelefonoCliente(soloNumeros);
  };

  const bloquearTeclasMonto = (e) => {
    const teclasPermitidas = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', '.'
    ];
    if (teclasPermitidas.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleCambioChange = (e) => {
    let valor = e.target.value.replace(/[^0-9.]/g, '');
    const partes = valor.split('.');
    if (partes.length > 2) {
      valor = `${partes[0]}.${partes.slice(1).join('')}`;
    }
    setCambioPara(valor);
  };

  const handleArchivoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setNombreArchivo(file.name);
      setCargandoImagen(true);

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setComprobanteBase64(compressedBase64);
          setCargandoImagen(false);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const guardarEnHistorial = (pedidoPayload, dataApi) => {
    try {
      if (telefonoCliente) {
        localStorage.setItem('clienteTelefono', telefonoCliente);
      }
      const idReal = dataApi?.id ?? dataApi?.pedidoId ?? Date.now();
      const codigoOrden = dataApi?.pedidoId || `ORD-${idReal}`;
      const estadoOrden = dataApi?.estado || pedidoPayload.estado || 'RECIBIDO';

      const nuevoRegistro = {
        pedidoId: codigoOrden,
        tenantId: comercioId,
        nombreComercio: comercio?.nombreComercio || '',
        direccionComercio: comercio?.direccion || '',
        telefonoComercio: comercio?.telefono || comercio?.telefonoComercio || '',
        total: pedidoPayload.total,
        estado: estadoOrden,
        fechaCreacion: new Date().toISOString()
      };

      const previos = JSON.parse(localStorage.getItem('mis_pedidos') || '[]');
      localStorage.setItem('mis_pedidos', JSON.stringify([nuevoRegistro, ...previos]));

      persistirPedidoActivoEnStorage({
        id: idReal,
        pedidoId: codigoOrden,
        tenantId: comercioId,
        nombreComercio: comercio?.nombreComercio || '',
        telefonoCliente: telefonoCliente,
        total: pedidoPayload.total,
        estado: estadoOrden,
        fechaCreacion: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const realizarPedido = async (e) => {
    e.preventDefault();
    if (esSoloLocal) {
      mostrarNotificacion('Este restaurante no cuenta con servicio a domicilio.', 'aviso');
      return;
    }
    if (!enLinea) {
      mostrarNotificacion(
        'Sin conexión con el servidor. Los pedidos en línea se restablecerán hasta que vuelva la conexión.',
        'aviso'
      );
      return;
    }
    if (!estaAbierto) {
      mostrarNotificacion('Este restaurante acaba de cerrar sus ventas por hoy.', 'aviso');
      return;
    }

    const requiereDireccion = !(permiteRecoger && tipoEntregaPedido === 'RECOGER');

    if (!nombreCliente.trim() || !telefonoCliente.trim() || (requiereDireccion && !direccionCliente.trim())) {
      mostrarNotificacion(
        requiereDireccion
          ? 'Por favor completa tu nombre, teléfono y dirección de entrega.'
          : 'Por favor completa tu nombre y teléfono de contacto.',
        'error'
      );
      return;
    }

    if (telefonoCliente.length !== 10) {
      mostrarNotificacion(
        'El teléfono de contacto debe tener exactamente 10 dígitos numéricos.',
        'error'
      );
      return;
    }

    if (metodoPago === 'Efectivo' && cambioPara && !/^\d+(\.\d+)?$/.test(cambioPara)) {
      mostrarNotificacion(
        "En '¿Pagas con cuánto?' solo se permiten números.",
        'error'
      );
      return;
    }

    if (metodoPago === 'Transferencia Bancaria') {
      if (cargandoImagen) {
        mostrarNotificacion(
          'La imagen se está procesando. Espera un segundo por favor.',
          'aviso'
        );
        return;
      }
      if (!comprobanteBase64) {
        mostrarNotificacion(
          'Por favor selecciona la imagen de tu comprobante de transferencia.',
          'error'
        );
        return;
      }
    }

    setPedidoEnviado(true);

    if (metodoPago === 'Transferencia Bancaria') {
      setMensajeRevision(true);
    }

    const direccionFinal =
      permiteRecoger && tipoEntregaPedido === 'RECOGER'
        ? direccionCliente.trim()
          ? `Pasar a recoger (${direccionCliente.trim()})`
          : 'Pasar a recoger'
        : direccionCliente.trim();

    const pedidoPayload = {
      tenantId: comercioId,
      clienteNombre: nombreCliente.trim(),
      telefonoCliente: telefonoCliente.trim(),
      direccionCliente: direccionFinal,
      metodoPago: metodoPago,
      cambioPara: cambioPara ? `$${cambioPara}` : 'Exacto',
      total: parseFloat(calcularTotal()),
      estado: 'RECIBIDO',
      comprobanteUrl: comprobanteBase64 || '',
      comprobante: comprobanteBase64 || '',
      imagenComprobante: comprobanteBase64 || '',
      voucher: comprobanteBase64 || '',
      urlComprobante: comprobanteBase64 || '',
      detalles: carrito.map((item) => ({
        nombreProducto: item.nombre,
        precio: parseFloat(item.precio),
        cantidad: item.cantidad
      }))
    };

    try {
      const res = await api.post('/pedidos', pedidoPayload);
      onRecuperarConexionRef.current();
      guardarEnHistorial(pedidoPayload, res?.data);

      clearTimeout(timerCierreModalRef.current);
      timerCierreModalRef.current = setTimeout(() => {
        setModalCheckout(false);
        limpiarFormularioCheckout();
        vaciarCarrito();
        mostrarNotificacion(
          '¡Pedido realizado con éxito! El restaurante ya lo recibió en su panel.',
          'exito'
        );
      }, 1500);
    } catch (err) {
      console.error('Error al enviar el pedido:', err);
      onPerderConexionRef.current();
      mostrarNotificacion(
        'Hubo un error al procesar tu pedido o se detuvo el servidor. Los pedidos en línea se restablecerán cuando vuelva la conexión.',
        'error'
      );
      setPedidoEnviado(false);
      setMensajeRevision(false);
    }
  };

  const totalOpcionesMenu = productos.length + promociones.length;

  const listaMenuMemo = useMemo(() => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {productos.map((prod) => {
          const puedeAgregarProd = !esSoloLocal && enLinea;
          return (
            <div
              key={prod.id}
              className="neon-amber-card bg-gradient-to-b from-[#152736] to-[#0c1822] rounded-2xl p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="icon-3d-pod relative h-32 w-full rounded-xl overflow-hidden flex items-center justify-center">
                  <span className="absolute top-2 left-2 z-10 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase shadow-[0_0_10px_rgba(16,185,129,0.7)]">
                    ABIERTO
                  </span>
                  <span className="text-5xl drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)] select-none">🍔</span>
                </div>

                <h4 className="font-black text-white text-sm leading-snug">{prod.nombre}</h4>
                <p className="text-[11px] text-slate-300/85 line-clamp-2">
                  {prod.descripcion || 'Elaborado con ingredientes frescos de la región.'}
                </p>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-white/10 gap-2">
                <span className="text-sm font-black text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]">
                  ${Number(prod.precio || 0).toFixed(2)}{' '}
                  <span className="text-[10px] font-bold text-slate-300">MXN</span>
                </span>
                <button
                  type="button"
                  disabled={!puedeAgregarProd}
                  onClick={() => agregarAlCarrito(prod)}
                  className={`text-[11px] font-black px-3.5 py-1.5 rounded-full ${
                    puedeAgregarProd
                      ? 'neon-btn-orange text-white cursor-pointer'
                      : 'bg-slate-700/80 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {esSoloLocal ? 'Solo local' : 'Agregar +'}
                </button>
              </div>
            </div>
          );
        })}

        {promociones.map((promo) => {
          const estaDisponible = Boolean(promo.disponible);
          const tienePrecio =
            promo.precioPromo !== null &&
            promo.precioPromo !== undefined &&
            !Number.isNaN(Number(promo.precioPromo));
          const puedeAgregar = !esSoloLocal && estaDisponible && tienePrecio && enLinea;

          return (
            <div
              key={promo.id}
              className={`neon-amber-card bg-gradient-to-b from-[#1a2234] to-[#0c1522] rounded-2xl p-4 flex flex-col justify-between gap-3 ${
                !estaDisponible ? 'opacity-75' : ''
              }`}
            >
              <div className="space-y-2">
                <div className="icon-3d-pod relative h-32 w-full rounded-xl overflow-hidden flex items-center justify-center">
                  <span
                    className={`absolute top-2 left-2 z-10 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${
                      estaDisponible
                        ? 'bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]'
                        : 'bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.65)]'
                    }`}
                  >
                    {estaDisponible ? 'Promociones 🔥' : 'Promociones agotadas'}
                  </span>
                  <span className="text-5xl drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)] select-none">🔥</span>
                </div>

                <h4 className="font-black text-white text-sm leading-snug">{promo.titulo}</h4>
                <p className="text-[11px] text-slate-300/85 line-clamp-2">
                  {promo.descripcion || 'Promoción especial del establecimiento.'}
                </p>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-white/10 gap-2">
                {tienePrecio ? (
                  <span className="text-sm font-black text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]">
                    ${Number(promo.precioPromo).toFixed(2)}{' '}
                    <span className="text-[10px] font-bold text-slate-300">MXN</span>
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-black uppercase ${
                      estaDisponible ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {estaDisponible ? 'Promociones 🔥' : 'Promociones agotadas'}
                  </span>
                )}

                {!esSoloLocal && tienePrecio && (
                  <button
                    type="button"
                    disabled={!puedeAgregar}
                    onClick={() => agregarPromoAlCarrito(promo)}
                    className={`text-[11px] font-black px-3.5 py-1.5 rounded-full ${
                      puedeAgregar
                        ? 'neon-btn-orange text-white cursor-pointer'
                        : 'bg-slate-700/80 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {estaDisponible ? 'Agregar +' : 'Agotada'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [productos, promociones, esSoloLocal, enLinea]);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10 text-slate-100">
      {notificacionApp && (
        <div
          className={`fixed bottom-5 right-5 z-[60] max-w-sm w-[calc(100%-2.5rem)] rounded-2xl px-4 py-3.5 border backdrop-blur-md flex items-start justify-between gap-3 shadow-2xl ${
            notificacionApp.tipo === 'exito'
              ? 'bg-[#0b241d]/95 border-emerald-400/60 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.35)]'
              : notificacionApp.tipo === 'error'
              ? 'bg-[#2a0d14]/95 border-rose-400/60 text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.35)]'
              : 'bg-[#261c0a]/95 border-amber-400/60 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.35)]'
          }`}
        >
          <div className="flex items-start gap-2.5 text-xs font-bold leading-snug">
            <span className="text-base shrink-0">
              {notificacionApp.tipo === 'exito'
                ? '✅'
                : notificacionApp.tipo === 'error'
                ? '⚠️'
                : '📡'}
            </span>
            <span>{notificacionApp.mensaje}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotificacionApp(null)}
            className="text-white/75 hover:text-white text-xs font-black px-1 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {!enLinea && (
        <div className="bg-amber-500/15 border border-amber-400/50 text-amber-200 px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_16px_rgba(245,158,11,0.2)]">
          <div className="space-y-0.5">
            <p className="text-xs font-black flex items-center gap-2">
              <span>📡</span> Modo Sin Conexión (Directorio Offline Activo)
            </p>
            <p className="text-[11px] text-amber-100/85 leading-relaxed">
              Estás consultando el menú y los datos guardados localmente. Los pedidos en línea se restablecerán al volver la conexión.
            </p>
          </div>
          <span className="text-[10px] font-bold bg-amber-500/25 border border-amber-400/35 px-2.5 py-1 rounded-xl text-amber-200 self-start sm:self-center whitespace-nowrap">
            Solo consulta
          </span>
        </div>
      )}

      <div className="neon-amber-card rounded-2xl bg-gradient-to-r from-[#0f202d] via-[#132938] to-[#0f202d] p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block bg-emerald-500 text-white px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.65)]">
              {enLinea ? 'ABIERTO' : 'GUARDADO'}
            </span>
            <span className="inline-block bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold">
              🏷️ {etiquetaModalidad}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight drop-shadow-xs">
            {comercio?.nombreComercio || 'Comercio'}
          </h2>
          <div className="flex flex-wrap gap-3 text-xs text-slate-300 font-medium">
            <span>📍 {comercio?.direccion || 'Candelaria, Campeche'}</span>
            <span>📞 {comercio?.telefono || comercio?.telefonoComercio || 'Sin teléfono'}</span>
            <span>🕒 {comercio?.horarioAtencion || 'Lun - Dom: 9:00 AM - 10:00 PM'}</span>
            <span className="bg-[#070e14] px-2.5 py-0.5 rounded-lg border border-white/15 font-bold">
              ⏱️ {comercio?.tiempoPreparacion || '25-40 min'}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-lg border font-bold ${
                envioGratis
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                  : 'bg-orange-500/15 text-orange-300 border-orange-400/35'
              }`}
            >
              🛵 {envioGratis ? 'Envío gratis' : `Envío $${costoEnvio.toFixed(2)} MXN`}
            </span>
            {comercio?.categoria && <span>🍔 {comercio.categoria}</span>}
          </div>
        </div>

        <div className="icon-3d-pod w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-4xl shrink-0 border-2 border-amber-400/60">
          {comercio?.logoUrl ? (
            <img
              src={comercio.logoUrl}
              alt={`Logo ${comercio?.nombreComercio || 'Comercio'}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>🍔</span>
          )}
        </div>
      </div>

      {enLinea && !estaAbierto && (
        <div className="bg-red-500/15 border border-red-400/50 text-red-200 px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_16px_rgba(239,68,68,0.2)]">
          <div className="space-y-0.5">
            <p className="text-xs font-black flex items-center gap-2 text-red-300">
              <span>🔒</span> Este restaurante está cerrado en este momento
            </p>
            <p className="text-[11px] text-red-100/85 leading-relaxed">
              Puedes consultar el menú y horarios ({comercio?.horarioAtencion || 'Lun - Dom: 9:00 AM - 10:00 PM'}). Los pedidos se habilitarán cuando inicie sus ventas.
            </p>
          </div>
          <span className="text-[10px] font-black bg-red-500/25 border border-red-400/35 px-2.5 py-1 rounded-xl text-red-200 self-start sm:self-center whitespace-nowrap">
            Cerrado
          </span>
        </div>
      )}

      {misPedidos.length > 0 && (
        <div className="neon-amber-card bg-[#0e1b26] p-4 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-black text-amber-300 flex items-center gap-2">
            <span>🔔</span> Estado de tus Pedidos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {misPedidos.map((p) => {
              const idClave = obtenerClavePedido(p) || p.id;
              const formCalif = calificacionesForm[p.id] || { estrellas: 0 };
              const estrellaHover = hoverEstrella[p.id] || 0;
              const yaCalificado = Boolean(p.calificacion || pedidosCalificadosLocal[p.id]);
              const califFinal = p.calificacion || pedidosCalificadosLocal[p.id];

              const textoEstado = formatearEstadoPedido(p.estado);
              const completado = esEstadoCompletado(p.estado);

              return (
                <div
                  key={idClave}
                  className="bg-[#070e14] p-3.5 rounded-xl border border-white/10 space-y-2.5"
                >
                  <div className="flex justify-between items-center text-xs gap-2">
                    <span className="font-extrabold text-white">{p.pedidoId || `ORD-${p.id}`}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-extrabold text-[9px] border ${
                        completado
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-400/35'
                      }`}
                    >
                      {completado ? '✅ ¡Pedido Completado!' : textoEstado}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Total:{' '}
                    <span className="font-black text-amber-400">
                      ${Number(p.total || 0).toFixed(2)} MXN
                    </span>
                  </p>

                  {completado && (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      {yaCalificado ? (
                        <div className="bg-emerald-500/15 border border-emerald-400/35 rounded-xl p-2.5 text-[11px] text-emerald-300 font-bold flex items-center justify-between">
                          <span>🎉 ¡Gracias por calificar!</span>
                          <span className="text-amber-300">
                            {'★'.repeat(califFinal)}
                            {'☆'.repeat(5 - califFinal)} ({califFinal}/5)
                          </span>
                        </div>
                      ) : (
                        <div className="bg-[#0e1b26] border border-amber-400/35 rounded-xl p-3 space-y-2">
                          <p className="text-[11px] font-black text-amber-200">⭐ Califica al restaurante</p>
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((num) => {
                              const activo = num <= (estrellaHover || formCalif.estrellas);
                              return (
                                <button
                                  key={num}
                                  type="button"
                                  onMouseEnter={() => setHoverEstrella((prev) => ({ ...prev, [p.id]: num }))}
                                  onMouseLeave={() => setHoverEstrella((prev) => ({ ...prev, [p.id]: 0 }))}
                                  onClick={() =>
                                    setCalificacionesForm((prev) => ({
                                      ...prev,
                                      [p.id]: { estrellas: num }
                                    }))
                                  }
                                  className={`text-2xl ${
                                    activo ? 'text-amber-400' : 'text-slate-600'
                                  } cursor-pointer`}
                                  title={`${num} estrella${num > 1 ? 's' : ''}`}
                                >
                                  ★
                                </button>
                              );
                            })}
                            {formCalif.estrellas > 0 && (
                              <span className="text-[11px] font-bold text-amber-300 ml-2">
                                {formCalif.estrellas} / 5
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={enviandoCalificacionId === p.id || !formCalif.estrellas}
                            onClick={() => enviarCalificacion(p.id)}
                            className="neon-btn-orange w-full disabled:opacity-40 text-white font-black py-1.5 rounded-full text-[11px] cursor-pointer"
                          >
                            {enviandoCalificacionId === p.id
                              ? 'Enviando calificación...'
                              : 'Enviar Calificación ⭐'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-3.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">■</span>
              <span>Menú del Día y Platillos</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-200 bg-[#132534] border border-cyan-400/30 px-3 py-0.5 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.18)]">
              {totalOpcionesMenu} opciones disponibles
            </span>
          </div>

          {loading ? (
            <div className="neon-amber-card bg-[#0e1b26] p-12 rounded-2xl text-center space-y-2">
              <div className="animate-spin text-3xl">🍔</div>
              <p className="text-slate-400 text-xs font-semibold">Cargando platillos...</p>
            </div>
          ) : error && productos.length === 0 && promociones.length === 0 ? (
            <div className="neon-amber-card bg-[#0e1b26] p-8 rounded-2xl text-center space-y-1.5">
              <p className="text-3xl">📡</p>
              <h4 className="text-xs font-black text-white">Sin datos guardados</h4>
              <p className="text-slate-400 text-xs">{error}</p>
            </div>
          ) : productos.length === 0 && promociones.length === 0 ? (
            <div className="neon-amber-card bg-[#0e1b26] p-8 rounded-2xl text-center space-y-1.5">
              <p className="text-3xl">🍽️</p>
              <h4 className="text-xs font-black text-white">Menú en preparación</h4>
              <p className="text-slate-400 text-xs">Este establecimiento aún no ha publicado platillos.</p>
            </div>
          ) : (
            listaMenuMemo
          )}
        </div>

        <div
          aria-disabled={esSoloLocal}
          className={`neon-amber-card bg-[#0e1b26] rounded-2xl sticky top-24 overflow-hidden ${
            esSoloLocal ? 'opacity-80' : ''
          }`}
        >
          <div className="neon-btn-orange px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <span>Tu pedido actual ({totalCantidadCarrito})</span>
            </h3>
            {!esSoloLocal && carrito.length > 0 && (
              <button
                type="button"
                onClick={vaciarCarrito}
                className="text-[10px] font-extrabold text-white/95 hover:text-white underline cursor-pointer"
              >
                Vaciar
              </button>
            )}
          </div>

          <div className="p-4 space-y-3.5">
            {esSoloLocal ? (
              <div className="bg-[#070e14] border border-amber-400/35 rounded-xl p-4 text-center space-y-1.5">
                <div className="icon-3d-pod w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl opacity-75">
                  🛒
                </div>
                <p className="text-xs font-black text-amber-300">
                  Este restaurante no cuenta con servicio a domicilio.
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Carrito deshabilitado mientras este comercio esté en modo Solo en el local.
                </p>
              </div>
            ) : carrito.length === 0 ? (
              <div className="py-7 text-center space-y-2 bg-[#070e14] rounded-xl border border-white/10 p-3.5">
                <div className="icon-3d-pod w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl">
                  🛒
                </div>
                <p className="text-white text-xs font-bold">Tu carrito está vacío.</p>
                <p className="text-slate-400 text-[11px]">Agrega un platillo del menú para armar tu orden.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="divide-y divide-white/10 max-h-56 overflow-y-auto space-y-2.5 pr-1">
                  {carrito.map((item) => (
                    <div key={item.id} className="pt-2.5 first:pt-0 flex justify-between items-center text-xs gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <h5 className="font-bold text-white truncate">{item.nombre}</h5>
                        <p className="text-amber-400 font-extrabold">
                          ${(Number(item.precio || 0) * Number(item.cantidad || 0)).toFixed(2)} MXN
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#070e14] rounded-lg p-1 border border-white/15 shrink-0">
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(item.id, -1)}
                          className="w-5 h-5 flex items-center justify-center font-bold text-slate-200 hover:bg-white/10 rounded-md cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-bold w-4 text-center text-white text-[11px]">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(item.id, 1)}
                          className="w-5 h-5 flex items-center justify-center font-bold text-slate-200 hover:bg-white/10 rounded-md cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-3 space-y-2.5">
                  <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium">
                    <span>Subtotal:</span>
                    <span>${calcularSubtotal().toFixed(2)} MXN</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-slate-400">Envío:</span>
                    <span className={envioGratis ? 'text-emerald-400' : 'text-amber-300'}>
                      {envioGratis ? 'Envío gratis' : `$${costoEnvio.toFixed(2)} MXN`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-black text-white bg-[#070e14] p-3 rounded-xl border border-amber-400/25">
                    <span>Total a pagar:</span>
                    <span className="text-amber-400">${calcularTotal()} MXN</span>
                  </div>

                  <button
                    type="button"
                    onClick={abrirModalCheckout}
                    disabled={!enLinea}
                    className={`w-full font-black py-2.5 rounded-full text-xs flex items-center justify-center gap-2 cursor-pointer ${
                      enLinea
                        ? 'neon-btn-orange text-white'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span>
                      {!enLinea
                        ? 'Disponible al volver la conexión'
                        : !estaAbierto
                          ? 'Restaurante cerrado'
                          : 'Proceder al Pago →'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modalCheckout && !esSoloLocal && (
        <div
          onClick={cerrarModalCheckout}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="neon-amber-card bg-[#0e1b26] rounded-2xl max-w-md w-full p-6 relative text-slate-100"
          >
            <div className="text-center mb-4">
              <div className="icon-3d-pod w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-1">
                🛍️
              </div>
              <h3 className="text-lg font-black text-white">Finalizar Pedido</h3>
              <p className="text-xs text-slate-400">
                Ordenando en {comercio?.nombreComercio || 'Comercio'} • {etiquetaModalidad}
              </p>
            </div>

            {pedidoEnviado ? (
              <div className="py-8 text-center space-y-2.5">
                <div className="animate-spin text-3xl">🍔</div>
                <p className="font-bold text-xs text-amber-400">
                  {mensajeRevision
                    ? '🛡️ Tu comprobante está en revisión (aprox. 8 min)...'
                    : 'Enviando orden al restaurante...'}
                </p>
              </div>
            ) : (
              <form onSubmit={realizarPedido} autoComplete="off" className="space-y-3">
                {permiteRecoger && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Tipo de Entrega</label>
                    <select
                      value={tipoEntregaPedido}
                      onChange={(e) => setTipoEntregaPedido(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="DOMICILIO">Enviar a domicilio</option>
                      <option value="RECOGER">Pasar a recoger</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Tu Nombre Completo</label>
                  <input
                    type="text"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    autoComplete="off"
                    required
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Teléfono de Contacto (10 dígitos numéricos)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={telefonoCliente}
                    onKeyDown={bloquearTeclasTelefono}
                    onChange={handleTelefonoChange}
                    autoComplete="off"
                    required
                    placeholder="Ej. 9381234567"
                    className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {!(permiteRecoger && tipoEntregaPedido === 'RECOGER') && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Dirección de Entrega</label>
                    <input
                      type="text"
                      value={direccionCliente}
                      onChange={(e) => setDireccionCliente(e.target.value)}
                      autoComplete="off"
                      required
                      placeholder="Ej. Calle 10 x 21 y 23, Col. Centro"
                      className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Método de Pago</label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  </select>
                </div>

                {metodoPago === 'Transferencia Bancaria' && (
                  <div className="bg-[#070e14] p-3.5 rounded-xl border border-white/10 space-y-2.5">
                    <div className="text-[11px] space-y-0.5">
                      <p className="font-extrabold text-amber-400">🏦 Datos para Transferencia:</p>
                      <p className="text-slate-300">
                        Banco:{' '}
                        <strong className="text-white">
                          {datosBancoRestaurante?.banco || 'No configurado'}
                        </strong>
                      </p>
                      <p className="text-slate-300">
                        Cuenta/CLABE:{' '}
                        <strong className="text-white">
                          {datosBancoRestaurante?.numeroCuenta || 'No configurada'}
                        </strong>
                      </p>
                      <p className="text-slate-300">
                        Titular:{' '}
                        <strong className="text-white">
                          {datosBancoRestaurante?.titular || 'No configurado'}
                        </strong>
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">📤 Subir Comprobante</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleArchivoChange}
                        required
                        className="w-full text-[11px] text-slate-300 file:mr-2.5 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-amber-500 file:text-slate-950 cursor-pointer"
                      />
                      {cargandoImagen && (
                        <p className="text-[10px] text-amber-300 mt-1 font-semibold">⏳ Comprimiendo imagen...</p>
                      )}
                      {nombreArchivo && !cargandoImagen && (
                        <p className="text-[10px] text-emerald-400 mt-1 font-semibold">✓ Listo: {nombreArchivo}</p>
                      )}
                    </div>
                  </div>
                )}

                {metodoPago === 'Efectivo' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      ¿Pagas con cuánto? (Solo números)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cambioPara}
                      onKeyDown={bloquearTeclasMonto}
                      onChange={handleCambioChange}
                      autoComplete="off"
                      placeholder="Ej. 200"
                      className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                )}

                <div className="flex gap-2.5 pt-1.5">
                  <button
                    type="button"
                    onClick={cerrarModalCheckout}
                    className="flex-1 bg-[#172836] hover:bg-[#1f3446] text-slate-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!enLinea || !estaAbierto}
                    className={`flex-1 font-black py-2.5 rounded-xl text-xs ${
                      enLinea && estaAbierto
                        ? 'neon-btn-orange text-white cursor-pointer'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {!enLinea ? 'Sin conexión' : !estaAbierto ? 'Cerrado' : 'Confirmar Pedido'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClienteVista;