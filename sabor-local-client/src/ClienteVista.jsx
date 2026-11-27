import { useState, useEffect, useRef } from 'react';
import api from './ApiClient';
import {
  obtenerEtiquetaModalidad,
  leerModalidadLocal,
  EVENTO_MODALIDAD_CAMBIADA
} from './modalidadesServicio';

const DURACION_ENTREGADO_MS = 15000;
const EVENTO_PROMOCIONES_CAMBIADAS = 'saborlocal:promociones_cambiadas';
const EVENTO_BANCO_CAMBIADO = 'saborlocal:banco_cambiado';

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

function ClienteVista({
  comercio,
  servidorActivo = true,
  onPerderConexion = () => {},
  onRecuperarConexion = () => {}
}) {
  const [productos, setProductos] = useState([]);
  const [promociones, setPromociones] = useState(() => leerPromocionesParaComercio(comercio));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalidadComercio, setModalidadComercio] = useState(() => leerModalidadLocal(comercio));

  const [notificacionApp, setNotificacionApp] = useState(null);
  const timerNotificacionRef = useRef(null);

  const mostrarNotificacion = (mensaje, tipo = 'exito') => {
    setNotificacionApp({ mensaje, tipo });
    clearTimeout(timerNotificacionRef.current);
    timerNotificacionRef.current = setTimeout(() => {
      setNotificacionApp(null);
    }, 4500);
  };

  useEffect(() => {
    return () => clearTimeout(timerNotificacionRef.current);
  }, []);

  useEffect(() => {
    const sincronizarModalidad = () => {
      const actualizada = leerModalidadLocal(comercio);
      setModalidadComercio((prev) => (prev === actualizada ? prev : actualizada));
    };

    sincronizarModalidad();

    window.addEventListener(EVENTO_MODALIDAD_CAMBIADA, sincronizarModalidad);
    window.addEventListener('storage', sincronizarModalidad);
    const timer = setInterval(sincronizarModalidad, 800);

    return () => {
      window.removeEventListener(EVENTO_MODALIDAD_CAMBIADA, sincronizarModalidad);
      window.removeEventListener('storage', sincronizarModalidad);
      clearInterval(timer);
    };
  }, [comercio]);

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
    const timerPromo = setInterval(sincronizarPromociones, 800);

    return () => {
      window.removeEventListener(EVENTO_PROMOCIONES_CAMBIADAS, sincronizarPromociones);
      window.removeEventListener('storage', sincronizarPromociones);
      clearInterval(timerPromo);
    };
  }, [comercio]);

  const obtenerClaveCarrito = (comercioId) => {
    try {
      const sesionRaw =
        sessionStorage.getItem('saborlocal_sesion_tab') ||
        localStorage.getItem('saborlocal_sesion_offline');
      const sesionParsed = sesionRaw ? JSON.parse(sesionRaw) : null;
      const identificadorUsuario =
        sesionParsed?.telefono || sesionParsed?.nombre || 'invitado';
      return `carrito_comercio_${identificadorUsuario}_${comercioId}`;
    } catch {
      return `carrito_comercio_invitado_${comercioId}`;
    }
  };

  const leerCarritoGuardado = (comercioId) => {
    if (!comercioId) return [];
    try {
      const guardado = localStorage.getItem(obtenerClaveCarrito(comercioId));
      const parsed = guardado ? JSON.parse(guardado) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const esPedidoVisibleActivo = (pedido, ahora = Date.now()) => {
    if (!pedido) return false;
    const estadoUpper = String(pedido?.estado || '').toUpperCase().trim();
    if (estadoUpper === 'CANCELADO') return false;

    if (estadoUpper === 'COMPLETADO' || estadoUpper === 'ENTREGADO') {
      const entregadoEn = Number(pedido?.entregadoEn || 0);
      if (!entregadoEn) return false;
      return ahora - entregadoEn < DURACION_ENTREGADO_MS;
    }

    return true;
  };

  const leerPedidosActivosGuardados = (comercioId) => {
    try {
      const raw = localStorage.getItem('saborlocal_pedidos_activos') || '[]';
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const ahora = Date.now();
      return parsed.filter(p => {
        const mismoComercio = comercioId ? Number(p?.tenantId) === Number(comercioId) : true;
        return mismoComercio && esPedidoVisibleActivo(p, ahora);
      });
    } catch {
      return [];
    }
  };

  const [carrito, setCarrito] = useState(() => leerCarritoGuardado(comercio?.id));
  const [modalCheckout, setModalCheckout] = useState(false);
  const comercioCargadoRef = useRef(comercio?.id);

  const enLinea = Boolean(servidorActivo) && navigator.onLine;

  const modalidadUpper = String(modalidadComercio || 'LOCAL_Y_DOMICILIO').toUpperCase().trim();
  const esSoloLocal = modalidadUpper === 'SOLO_LOCAL';
  const permiteRecoger = modalidadUpper === 'DOMICILIO_Y_RECOGER';
  const etiquetaModalidad = obtenerEtiquetaModalidad(modalidadUpper);

  useEffect(() => {
    if (esSoloLocal && modalCheckout) {
      setModalCheckout(false);
    }
  }, [esSoloLocal, modalCheckout]);

  const [tipoEntregaPedido, setTipoEntregaPedido] = useState('DOMICILIO');
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [direccionCliente, setDireccionCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [cambioPara, setCambioPara] = useState('');

  const [comprobanteBase64, setComprobanteBase64] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [cargandoImagen, setCargandoImagen] = useState(false);
  const [datosBancoRestaurante, setDatosBancoRestaurante] = useState(() => leerBancoParaComercio(comercio));
  const [mensajeRevision, setMensajeRevision] = useState(false);

  const [pedidoEnviado, setPedidoEnviado] = useState(false);
  const [misPedidos, setMisPedidos] = useState(() => leerPedidosActivosGuardados(comercio?.id));

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
      mostrarNotificacion("Este restaurante no cuenta con servicio a domicilio.", "aviso");
      return;
    }
    limpiarFormularioCheckout();
    setDatosBancoRestaurante(leerBancoParaComercio(comercio));
    setModalCheckout(true);
  };

  const cerrarModalCheckout = () => {
    limpiarFormularioCheckout();
    setModalCheckout(false);
  };

  useEffect(() => {
    if (comercio?.id && comercioCargadoRef.current !== comercio.id) {
      comercioCargadoRef.current = comercio.id;
      setCarrito(leerCarritoGuardado(comercio.id));
    }
    if (comercio?.id) {
      setMisPedidos(leerPedidosActivosGuardados(comercio.id));
    }
  }, [comercio?.id]);

  useEffect(() => {
    if (!comercio?.id) return;
    try {
      const clave = obtenerClaveCarrito(comercio.id);
      if (carrito.length > 0) {
        localStorage.setItem(clave, JSON.stringify(carrito));
      } else {
        localStorage.removeItem(clave);
      }
    } catch (e) {
      console.error('Error al guardar el carrito local:', e);
    }
  }, [carrito, comercio?.id]);

  const guardarEnDirectorioOffline = (datosComercio, listaProductos) => {
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
        actualizadoEn: new Date().toISOString()
      };
      const sinDuplicado = directorioActual.filter(c => c.id !== datosComercio.id);
      localStorage.setItem('directorio_offline', JSON.stringify([ficha, ...sinDuplicado]));
    } catch (e) {
      console.error('Error al guardar en caché local:', e);
    }
  };

  useEffect(() => {
    const sincronizarBanco = () => {
      const actualizado = leerBancoParaComercio(comercio);
      setDatosBancoRestaurante((prev) =>
        JSON.stringify(prev) === JSON.stringify(actualizado) ? prev : actualizado
      );
    };

    sincronizarBanco();
    window.addEventListener(EVENTO_BANCO_CAMBIADO, sincronizarBanco);
    window.addEventListener('storage', sincronizarBanco);
    const timerBanco = setInterval(sincronizarBanco, 800);

    return () => {
      window.removeEventListener(EVENTO_BANCO_CAMBIADO, sincronizarBanco);
      window.removeEventListener('storage', sincronizarBanco);
      clearInterval(timerBanco);
    };
  }, [comercio]);

  useEffect(() => {
    const cargarProductosDelComercio = async () => {
      setLoading(true);
      const cacheGuardada = localStorage.getItem(`cache_menu_${comercio.id}`);

      if (!navigator.onLine) {
        onPerderConexion();
        if (cacheGuardada) {
          setProductos(JSON.parse(cacheGuardada));
          setError(null);
        } else {
          setError("No hay menú guardado previamente para este comercio en modo sin conexión.");
        }
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(`/productos/comercio/${comercio.id}`, {
          timeout: 1800,
          headers: { 'Cache-Control': 'no-cache' }
        });
        onRecuperarConexion();
        let listaFinal = [];
        if (res.data && res.data.length > 0) {
          listaFinal = res.data;
        } else {
          const resGeneral = await api.get('/productos', {
            timeout: 1800,
            headers: { 'Cache-Control': 'no-cache' }
          });
          listaFinal = (resGeneral.data || []).filter(p =>
            p.tenantId === comercio.id || p.tenantId === 1 || !p.tenantId
          );
        }
        setProductos(listaFinal);
        guardarEnDirectorioOffline(comercio, listaFinal);
        setError(null);
      } catch {
        try {
          const resGeneral = await api.get('/productos', {
            timeout: 1800,
            headers: { 'Cache-Control': 'no-cache' }
          });
          onRecuperarConexion();
          setProductos(resGeneral.data || []);
          guardarEnDirectorioOffline(comercio, resGeneral.data || []);
          setError(null);
        } catch {
          onPerderConexion();
          if (cacheGuardada) {
            setProductos(JSON.parse(cacheGuardada));
            setError(null);
          } else {
            setError("No se pudo cargar el menú de este comercio.");
          }
        }
      } finally {
        setLoading(false);
      }
    };

    if (comercio?.id) {
      cargarProductosDelComercio();
    }
  }, [comercio]);

  const persistirPedidoActivoEnStorage = (pedidoObj) => {
    try {
      const actual = JSON.parse(localStorage.getItem('saborlocal_pedidos_activos') || '[]');
      const lista = Array.isArray(actual) ? actual : [];
      const keyNuevo = String(pedidoObj?.id ?? pedidoObj?.pedidoId);
      const ahora = Date.now();

      const filtrados = lista.filter(
        item => String(item?.id ?? item?.pedidoId) !== keyNuevo
      );

      const siguiente = [pedidoObj, ...filtrados].filter(p => esPedidoVisibleActivo(p, ahora));

      localStorage.setItem('saborlocal_pedidos_activos', JSON.stringify(siguiente));
      setMisPedidos(leerPedidosActivosGuardados(comercio?.id));
    } catch (e) {
      console.error('Error al persistir pedido activo:', e);
    }
  };

  useEffect(() => {
    const verificarEstatusPedidos = async () => {
      const localesComercio = leerPedidosActivosGuardados(comercio?.id);
      setMisPedidos(localesComercio);

      const telReferencia = localStorage.getItem('clienteTelefono') || '';
      if (!enLinea) return;

      try {
        const res = await api.get('/pedidos', {
          timeout: 1800,
          headers: { 'Cache-Control': 'no-cache' }
        });
        onRecuperarConexion();

        const todos = Array.isArray(res?.data) ? res.data : [];
        const idsLocales = new Set(localesComercio.map(p => String(p?.id ?? p?.pedidoId)));
        const ahora = Date.now();

        const todosActivosGlobal = JSON.parse(localStorage.getItem('saborlocal_pedidos_activos') || '[]');
        const globalActualizado = (Array.isArray(todosActivosGlobal) ? todosActivosGlobal : [])
          .map(item => {
            const matchServer = todos.find(s => String(s?.id) === String(item?.id ?? item?.pedidoId));
            const estadoNuevo = String(matchServer?.estado || item?.estado || 'RECIBIDO').toUpperCase().trim();
            const esCompletado = estadoNuevo === 'COMPLETADO' || estadoNuevo === 'ENTREGADO';
            const entregadoEn = esCompletado
              ? Number(item?.entregadoEn || matchServer?.entregadoEn || ahora)
              : undefined;

            return matchServer
              ? { ...item, ...matchServer, estado: matchServer.estado, ...(entregadoEn ? { entregadoEn } : {}) }
              : { ...item, ...(entregadoEn ? { entregadoEn } : {}) };
          })
          .filter(item => esPedidoVisibleActivo(item, ahora));

        localStorage.setItem('saborlocal_pedidos_activos', JSON.stringify(globalActualizado));

        const activosServidorComercio = todos
          .filter(p => {
            if (Number(p?.tenantId) !== Number(comercio.id)) return false;
            const coincideTel =
              telReferencia && String(p?.telefonoCliente || '').trim() === String(telReferencia).trim();
            const coincideId = idsLocales.has(String(p?.id));
            return coincideTel || coincideId;
          })
          .map(s => {
            const previo = globalActualizado.find(g => String(g?.id ?? g?.pedidoId) === String(s?.id));
            const stUpper = String(s?.estado || '').toUpperCase().trim();
            const esCompletado = stUpper === 'COMPLETADO' || stUpper === 'ENTREGADO';
            const entregadoEn = esCompletado
              ? Number(previo?.entregadoEn || ahora)
              : undefined;
            return {
              ...(previo || {}),
              ...s,
              ...(entregadoEn ? { entregadoEn } : {})
            };
          })
          .filter(item => esPedidoVisibleActivo(item, ahora));

        const mapa = new Map();
        globalActualizado
          .filter(p => Number(p?.tenantId) === Number(comercio.id))
          .forEach(p => {
            const k = String(p?.id ?? p?.pedidoId);
            mapa.set(k, p);
          });

        activosServidorComercio.forEach(s => {
          const k = String(s?.id);
          mapa.set(k, { ...(mapa.get(k) || {}), ...s });
        });

        setMisPedidos(
          Array.from(mapa.values()).filter(p => esPedidoVisibleActivo(p, ahora))
        );
      } catch {
        onPerderConexion();
      }
    };

    verificarEstatusPedidos();
    const interval = setInterval(verificarEstatusPedidos, 1500);
    return () => clearInterval(interval);
  }, [comercio?.id, enLinea]);

  const agregarAlCarrito = (producto) => {
    if (esSoloLocal) {
      mostrarNotificacion("Este restaurante no cuenta con servicio a domicilio.", "aviso");
      return;
    }
    const itemExistente = carrito.find(item => item.id === producto.id);
    if (itemExistente) {
      setCarrito(carrito.map(item =>
        item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
      ));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }
  };

  const agregarPromoAlCarrito = (promo) => {
    if (!promo?.disponible || esSoloLocal) return;
    const precioFinal = promo.precioPromo !== null && promo.precioPromo !== undefined ? Number(promo.precioPromo) : 0;
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
    setCarrito(carrito.map(item => {
      if (item.id === id) {
        const nuevaCantidad = item.cantidad + delta;
        return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const vaciarCarrito = () => {
    if (esSoloLocal) return;
    setCarrito([]);
    if (comercio?.id) {
      localStorage.removeItem(obtenerClaveCarrito(comercio.id));
    }
  };

  const calcularTotal = () => {
    return carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0).toFixed(2);
  };

  const totalCantidadCarrito = esSoloLocal ? 0 : carrito.reduce((acc, item) => acc + item.cantidad, 0);

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
    const file = e.target.files[0];
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
        tenantId: comercio.id,
        nombreComercio: comercio.nombreComercio,
        direccionComercio: comercio.direccion || '',
        telefonoComercio: comercio.telefono || comercio.telefonoComercio || '',
        total: pedidoPayload.total,
        estado: estadoOrden,
        fechaCreacion: new Date().toISOString()
      };

      const previos = JSON.parse(localStorage.getItem('mis_pedidos') || '[]');
      localStorage.setItem('mis_pedidos', JSON.stringify([nuevoRegistro, ...previos]));

      persistirPedidoActivoEnStorage({
        id: idReal,
        pedidoId: codigoOrden,
        tenantId: comercio.id,
        nombreComercio: comercio.nombreComercio,
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
      mostrarNotificacion("Este restaurante no cuenta con servicio a domicilio.", "aviso");
      return;
    }
    if (!enLinea) {
      mostrarNotificacion(
        "Sin conexión con el servidor. Los pedidos en línea se restablecerán hasta que vuelva la conexión.",
        "aviso"
      );
      return;
    }

    const requiereDireccion = !(permiteRecoger && tipoEntregaPedido === 'RECOGER');

    if (!nombreCliente.trim() || !telefonoCliente.trim() || (requiereDireccion && !direccionCliente.trim())) {
      mostrarNotificacion(
        requiereDireccion
          ? "Por favor completa tu nombre, teléfono y dirección de entrega."
          : "Por favor completa tu nombre y teléfono de contacto.",
        "error"
      );
      return;
    }

    if (telefonoCliente.length !== 10) {
      mostrarNotificacion(
        "El teléfono de contacto debe tener exactamente 10 dígitos numéricos.",
        "error"
      );
      return;
    }

    if (metodoPago === 'Efectivo' && cambioPara && (!/^\d+(\.\d+)?$/.test(cambioPara))) {
      mostrarNotificacion(
        "En '¿Pagas con cuánto?' solo se permiten números.",
        "error"
      );
      return;
    }

    if (metodoPago === 'Transferencia Bancaria') {
      if (cargandoImagen) {
        mostrarNotificacion(
          "La imagen se está procesando. Espera un segundo por favor.",
          "aviso"
        );
        return;
      }
      if (!comprobanteBase64) {
        mostrarNotificacion(
          "Por favor selecciona la imagen de tu comprobante de transferencia.",
          "error"
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
        ? (direccionCliente.trim() ? `Pasar a recoger (${direccionCliente.trim()})` : 'Pasar a recoger')
        : direccionCliente.trim();

    const pedidoPayload = {
      tenantId: comercio.id,
      clienteNombre: nombreCliente.trim(),
      telefonoCliente: telefonoCliente.trim(),
      direccionCliente: direccionFinal,
      metodoPago: metodoPago,
      cambioPara: cambioPara ? `$${cambioPara}` : "Exacto",
      total: parseFloat(calcularTotal()),
      estado: "RECIBIDO",
      comprobanteUrl: comprobanteBase64 || "",
      comprobante: comprobanteBase64 || "",
      imagenComprobante: comprobanteBase64 || "",
      voucher: comprobanteBase64 || "",
      urlComprobante: comprobanteBase64 || "",
      detalles: carrito.map(item => ({
        nombreProducto: item.nombre,
        precio: parseFloat(item.precio),
        cantidad: item.cantidad
      }))
    };

    try {
      const res = await api.post('/pedidos', pedidoPayload);
      onRecuperarConexion();
      guardarEnHistorial(pedidoPayload, res?.data);

      setTimeout(() => {
        setModalCheckout(false);
        limpiarFormularioCheckout();
        vaciarCarrito();
        mostrarNotificacion(
          "¡Pedido realizado con éxito! El restaurante ya lo recibió en su panel.",
          "exito"
        );
      }, 1500);

    } catch (err) {
      console.error("Error al enviar el pedido:", err);
      onPerderConexion();
      mostrarNotificacion(
        "Hubo un error al procesar tu pedido o se detuvo el servidor. Los pedidos en línea se restablecerán cuando vuelva la conexión.",
        "error"
      );
      setPedidoEnviado(false);
      setMensajeRevision(false);
    }
  };

  const totalOpcionesMenu = productos.length + promociones.length;

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
            {comercio.nombreComercio}
          </h2>
          <div className="flex flex-wrap gap-3 text-xs text-slate-300 font-medium">
            <span>📍 {comercio.direccion || "Candelaria, Campeche"}</span>
            <span>📞 {comercio.telefono || comercio.telefonoComercio || "Sin teléfono"}</span>
            {comercio.categoria && <span>🍔 {comercio.categoria}</span>}
          </div>
        </div>

        <div className="icon-3d-pod w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shrink-0">
          🍔
        </div>
      </div>

      {misPedidos.length > 0 && (
        <div className="neon-amber-card bg-[#0e1b26] p-4 rounded-2xl space-y-2.5">
          <h3 className="text-xs font-black text-amber-300 flex items-center gap-2">
            <span>🔔</span> Estado de tus Pedidos Activos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {misPedidos.map((p, idx) => {
              const textoEstado = formatearEstadoPedido(p.estado);
              const esEntregado = textoEstado === 'Pedido entregado';

              return (
                <div key={p.id ?? p.pedidoId ?? idx} className="bg-[#070e14] p-3 rounded-xl border border-white/10 space-y-1">
                  <div className="flex justify-between items-center text-xs gap-2">
                    <span className="font-extrabold text-white">
                      {p.pedidoId || `ORD-${p.id}`}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md font-extrabold text-[10px] ${
                        esEntregado
                          ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.65)]'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                      }`}
                    >
                      {textoEstado}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Total: <span className="font-black text-amber-400">${Number(p.total || 0).toFixed(2)} MXN</span>
                  </p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {productos.map((prod) => {
                const puedeAgregarProd = !esSoloLocal && enLinea;
                return (
                  <div
                    key={prod.id}
                    className="neon-amber-card bg-gradient-to-b from-[#152736] to-[#0c1822] rounded-2xl p-4 transition flex flex-col justify-between gap-3"
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
                        {prod.descripcion || "Elaborado con ingredientes frescos de la región."}
                      </p>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-white/10 gap-2">
                      <span className="text-sm font-black text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]">
                        ${prod.precio.toFixed(2)} <span className="text-[10px] font-bold text-slate-300">MXN</span>
                      </span>
                      <button
                        type="button"
                        disabled={!puedeAgregarProd}
                        onClick={() => agregarAlCarrito(prod)}
                        className={`text-[11px] font-black px-3.5 py-1.5 rounded-full transition ${
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
                const tienePrecio = promo.precioPromo !== null && promo.precioPromo !== undefined && !Number.isNaN(Number(promo.precioPromo));
                const puedeAgregar = !esSoloLocal && estaDisponible && tienePrecio && enLinea;

                return (
                  <div
                    key={promo.id}
                    className={`neon-amber-card bg-gradient-to-b from-[#1a2234] to-[#0c1522] rounded-2xl p-4 transition flex flex-col justify-between gap-3 ${
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
                        {promo.descripcion || "Promoción especial del establecimiento."}
                      </p>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-white/10 gap-2">
                      {tienePrecio ? (
                        <span className="text-sm font-black text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]">
                          ${Number(promo.precioPromo).toFixed(2)} <span className="text-[10px] font-bold text-slate-300">MXN</span>
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
                          className={`text-[11px] font-black px-3.5 py-1.5 rounded-full transition ${
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
                className="text-[10px] font-extrabold text-white/95 hover:text-white underline transition cursor-pointer"
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
                        <p className="text-amber-400 font-extrabold">${(item.precio * item.cantidad).toFixed(2)} MXN</p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#070e14] rounded-lg p-1 border border-white/15 shrink-0">
                        <button type="button" onClick={() => cambiarCantidad(item.id, -1)} className="w-5 h-5 flex items-center justify-center font-bold text-slate-200 hover:bg-white/10 rounded-md transition cursor-pointer">-</button>
                        <span className="font-bold w-4 text-center text-white text-[11px]">{item.cantidad}</span>
                        <button type="button" onClick={() => cambiarCantidad(item.id, 1)} className="w-5 h-5 flex items-center justify-center font-bold text-slate-200 hover:bg-white/10 rounded-md transition cursor-pointer">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-3 space-y-2.5">
                  <div className="flex justify-between items-center text-sm font-black text-white bg-[#070e14] p-3 rounded-xl border border-amber-400/25">
                    <span>Total a pagar:</span>
                    <span className="text-amber-400">${calcularTotal()} MXN</span>
                  </div>

                  <button
                    type="button"
                    onClick={abrirModalCheckout}
                    disabled={!enLinea}
                    className={`w-full font-black py-2.5 rounded-full transition text-xs flex items-center justify-center gap-2 cursor-pointer ${
                      enLinea
                        ? 'neon-btn-orange text-white'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span>{enLinea ? 'Proceder al Pago →' : 'Disponible al volver la conexión'}</span>
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
                Ordenando en {comercio.nombreComercio} • {etiquetaModalidad}
              </p>
            </div>

            {pedidoEnviado ? (
              <div className="py-8 text-center space-y-2.5">
                <div className="animate-spin text-3xl">🍔</div>
                <p className="font-bold text-xs text-amber-400">
                  {mensajeRevision ? "🛡️ Tu comprobante está en revisión (aprox. 8 min)..." : "Enviando orden al restaurante..."}
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
                      <p className="text-slate-300">Banco: <strong className="text-white">{datosBancoRestaurante?.banco || "No configurado"}</strong></p>
                      <p className="text-slate-300">Cuenta/CLABE: <strong className="text-white">{datosBancoRestaurante?.numeroCuenta || "No configurada"}</strong></p>
                      <p className="text-slate-300">Titular: <strong className="text-white">{datosBancoRestaurante?.titular || "No configurado"}</strong></p>
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
                      {cargandoImagen && <p className="text-[10px] text-amber-300 mt-1 font-semibold">⏳ Comprimiendo imagen...</p>}
                      {nombreArchivo && !cargandoImagen && <p className="text-[10px] text-emerald-400 mt-1 font-semibold">✓ Listo: {nombreArchivo}</p>}
                    </div>
                  </div>
                )}

                {metodoPago === 'Efectivo' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">¿Pagas con cuánto? (Solo números)</label>
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
                    className="flex-1 bg-[#172836] hover:bg-[#1f3446] text-slate-200 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!enLinea}
                    className="neon-btn-orange flex-1 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Confirmar Pedido
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
