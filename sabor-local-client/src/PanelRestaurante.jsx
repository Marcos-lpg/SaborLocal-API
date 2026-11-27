import { useState, useEffect, useRef } from 'react';
import api from './ApiClient';
import {
  MODALIDADES_SERVICIO,
  obtenerEtiquetaModalidad,
  guardarModalidadLocal,
  leerModalidadLocal
} from './modalidadesServicio';

const EVENTO_PROMOCIONES_CAMBIADAS = 'saborlocal:promociones_cambiadas';
const EVENTO_BANCO_CAMBIADO = 'saborlocal:banco_cambiado';

const leerPromocionesComercio = (claveId) => {
  try {
    const raw = localStorage.getItem(`saborlocal_promociones_${claveId}`) || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const leerBancoComercio = ({ idReal, nombreComercio, correoNegocio }) => {
  try {
    const claves = [
      idReal,
      nombreComercio ? String(nombreComercio).trim().toLowerCase() : null,
      correoNegocio ? String(correoNegocio).trim().toLowerCase() : null,
      1
    ].filter(Boolean);

    for (const clave of claves) {
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
  } catch {
    // Ignorar error de lectura local
  }
  return { banco: '', numeroCuenta: '', titular: '' };
};

const leerRepartidoresGuardados = (claveId) => {
  try {
    const raw = localStorage.getItem(`saborlocal_repartidores_${claveId}`) || '{}';
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const obtenerNombreRepartidorPedido = (pedido, mapaLocal = {}) => {
  const desdeApi =
    pedido?.repartidorNombre ||
    pedido?.nombreRepartidor ||
    pedido?.RepartidorNombre ||
    pedido?.NombreRepartidor ||
    '';
  if (String(desdeApi).trim()) return String(desdeApi).trim();

  const desdeLocal = mapaLocal?.[pedido?.id] ?? mapaLocal?.[String(pedido?.id)] ?? '';
  return String(desdeLocal).trim();
};

function PanelRestaurante({ comercioId = 1, nombreComercio = "Mi Negocio", correoNegocio = "" }) {
  const idReal = (comercioId && typeof comercioId === 'number' && comercioId < 1000000) ? comercioId : 1;

  const [tituloNegocio, setTituloNegocio] = useState(nombreComercio || "Mi Negocio");
  const [modalidadServicio, setModalidadServicio] = useState(() =>
    leerModalidadLocal({ id: idReal, nombreComercio, correoDuenio: correoNegocio })
  );

  const [seccionActiva, setSeccionActiva] = useState('COMANDAS');

  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [repartidoresPorPedido, setRepartidoresPorPedido] = useState(() => leerRepartidoresGuardados(idReal));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [confirmarEliminarPlatillo, setConfirmarEliminarPlatillo] = useState(null);
  const [confirmarCerrarCaja, setConfirmarCerrarCaja] = useState(false);

  const [promociones, setPromociones] = useState(() => leerPromocionesComercio(idReal));
  const [editandoPromoId, setEditandoPromoId] = useState(null);
  const [promoForm, setPromoForm] = useState({
    titulo: '',
    descripcion: '',
    precioPromo: '',
    disponible: true
  });

  const [nuevaAlertaPedido, setNuevaAlertaPedido] = useState(false);
  const [ultimoConteoPedidos, setUltimoConteoPedidos] = useState(0);

  const [editandoId, setEditandoId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', precio: '', disponible: true });

  const [datosBanco, setDatosBanco] = useState(() =>
    leerBancoComercio({ idReal, nombreComercio, correoNegocio })
  );

  // Estado de caja (Abierto / Cerrado) y métricas del comercio
  const [estaAbierto, setEstaAbierto] = useState(true);
  const [ultimoCierreCaja, setUltimoCierreCaja] = useState(null);
  const [cambiandoCaja, setCambiandoCaja] = useState(false);
  const [calificacionStats, setCalificacionStats] = useState({ promedio: 0, total: 0 });

  // Configuración del perfil del restaurante (Logo, Horarios, Tiempo de preparación, Envío)
  const [configRestaurante, setConfigRestaurante] = useState({
    horarioAtencion: 'Lun - Dom: 9:00 AM - 10:00 PM',
    tiempoPreparacion: '25-40 min',
    envioGratis: true,
    costoEnvio: '0',
    logoUrl: ''
  });
  const [procesandoLogo, setProcesandoLogo] = useState(false);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const configCargadaRef = useRef(false);

  const mostrarMensaje = (texto) => {
    setMensaje(texto);
    setTimeout(() => setMensaje(null), 4500);
  };

  useEffect(() => {
    setTituloNegocio(nombreComercio || "Mi Negocio");
  }, [nombreComercio]);

  useEffect(() => {
    setRepartidoresPorPedido(leerRepartidoresGuardados(idReal));
  }, [idReal]);

  const handleRepartidorChange = (idPedido, nombreRepartidor) => {
    setRepartidoresPorPedido((prev) => {
      const siguiente = { ...prev, [idPedido]: nombreRepartidor };
      try {
        localStorage.setItem(`saborlocal_repartidores_${idReal}`, JSON.stringify(siguiente));
      } catch {
        // Ignorar error de storage
      }
      return siguiente;
    });
  };

  const persistirPromociones = (listaActualizada, nombreActual = tituloNegocio) => {
    try {
      const claves = new Set([String(idReal)]);
      if (nombreActual) claves.add(String(nombreActual).trim().toLowerCase());
      if (correoNegocio) claves.add(String(correoNegocio).trim().toLowerCase());

      claves.forEach((clave) => {
        localStorage.setItem(`saborlocal_promociones_${clave}`, JSON.stringify(listaActualizada));
      });

      setPromociones(listaActualizada);
      window.dispatchEvent(
        new CustomEvent(EVENTO_PROMOCIONES_CAMBIADAS, {
          detail: { comercioId: idReal, nombreComercio: nombreActual, promociones: listaActualizada }
        })
      );
    } catch (e) {
      console.error('Error al guardar promociones:', e);
    }
  };

  useEffect(() => {
    const cargadas = leerPromocionesComercio(idReal);
    setPromociones(cargadas);
  }, [idReal]);

  useEffect(() => {
    const buscarComercioEnLista = (lista) => {
      if (!Array.isArray(lista)) return null;
      const correoBuscado = String(correoNegocio || '').toLowerCase().trim();
      return (
        lista.find(
          c =>
            Number(c?.id ?? c?.Id ?? c?.comercioId ?? c?.ComercioId) === Number(idReal) ||
            (correoBuscado &&
              String(c?.correoDuenio || c?.CorreoDuenio || c?.correo || c?.Correo || '').toLowerCase().trim() ===
                correoBuscado)
        ) || null
      );
    };

    const resolverNombreRealNegocio = async () => {
      try {
        const cacheApi = JSON.parse(localStorage.getItem('cache_comercios_api') || '[]');
        const dirOffline = JSON.parse(localStorage.getItem('directorio_offline') || '[]');
        const locales = JSON.parse(localStorage.getItem('comercios_registrados') || '[]');
        const matchLocal =
          buscarComercioEnLista(cacheApi) ||
          buscarComercioEnLista(dirOffline) ||
          buscarComercioEnLista(locales);

        const nombreLocal = matchLocal?.nombreComercio || matchLocal?.NombreComercio || '';
        if (nombreLocal) {
          setTituloNegocio(nombreLocal);
        }

        const modalidadGuardada = leerModalidadLocal({
          ...(matchLocal || {}),
          id: idReal,
          nombreComercio: nombreLocal || nombreComercio,
          correoDuenio: correoNegocio
        });
        setModalidadServicio(modalidadGuardada);

        const resComercio = await api.get(`/comercios/${idReal}`, { timeout: 2500 });
        const dataComercio = resComercio?.data;
        const nombreApi = dataComercio?.nombreComercio || dataComercio?.NombreComercio;
        if (nombreApi) {
          setTituloNegocio(nombreApi);
        }
        const modalidadApi = dataComercio?.modalidadServicio || dataComercio?.ModalidadServicio;
        if (modalidadApi) {
          setModalidadServicio(modalidadApi);
          guardarModalidadLocal(idReal, modalidadApi);
          if (nombreApi) guardarModalidadLocal(nombreApi, modalidadApi);
        }
        return;
      } catch {
        // Si falla el endpoint directo, busca en la lista completa /comercios
      }

      try {
        const resLista = await api.get('/comercios', { timeout: 2500 });
        const matchLista = buscarComercioEnLista(resLista?.data);
        const nombreDesdeLista = matchLista?.nombreComercio || matchLista?.NombreComercio;
        if (nombreDesdeLista) {
          setTituloNegocio(nombreDesdeLista);
        }
        const modalidadLista = matchLista?.modalidadServicio || matchLista?.ModalidadServicio;
        if (modalidadLista) {
          setModalidadServicio(modalidadLista);
          guardarModalidadLocal(idReal, modalidadLista);
        }
      } catch {
        // Conserva el nombre local o el recibido por props
      }
    };

    resolverNombreRealNegocio();
  }, [idReal, correoNegocio, nombreComercio]);

  const handleCambiarModalidad = async (nuevaModalidad) => {
    setModalidadServicio(nuevaModalidad);
    guardarModalidadLocal(idReal, nuevaModalidad);
    if (tituloNegocio) guardarModalidadLocal(tituloNegocio, nuevaModalidad);
    if (correoNegocio) guardarModalidadLocal(correoNegocio, nuevaModalidad);

    try {
      await api.put(`/comercios/${idReal}/modalidad`, { modalidadServicio: nuevaModalidad });
    } catch {
      // Queda guardado localmente si el endpoint aún no existe
    }

    setMensaje(`Modalidad actualizada: ${obtenerEtiquetaModalidad(nuevaModalidad)}.`);
    setTimeout(() => setMensaje(null), 3500);
  };

  useEffect(() => {
    const bancoLeido = leerBancoComercio({
      idReal,
      nombreComercio: tituloNegocio,
      correoNegocio
    });
    setDatosBanco(bancoLeido);
  }, [idReal, tituloNegocio, correoNegocio]);

  const guardarDatosBanco = (e) => {
    e.preventDefault();
    const limpio = {
      banco: datosBanco.banco.trim(),
      numeroCuenta: datosBanco.numeroCuenta.trim(),
      titular: datosBanco.titular.trim()
    };

    const claves = new Set([String(idReal), '1']);
    if (tituloNegocio) claves.add(String(tituloNegocio).trim().toLowerCase());
    if (nombreComercio) claves.add(String(nombreComercio).trim().toLowerCase());
    if (correoNegocio) claves.add(String(correoNegocio).trim().toLowerCase());

    claves.forEach((clave) => {
      localStorage.setItem(`banco_${clave}`, JSON.stringify(limpio));
    });

    setDatosBanco(limpio);
    window.dispatchEvent(
      new CustomEvent(EVENTO_BANCO_CAMBIADO, {
        detail: { comercioId: idReal, nombreComercio: tituloNegocio, banco: limpio }
      })
    );
    setMensaje("🏦 Datos bancarios actualizados correctamente para tus clientes.");
    setTimeout(() => setMensaje(null), 4000);
  };

  const handlePromoInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPromoForm({
      ...promoForm,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleGuardarPromocion = (e) => {
    e.preventDefault();
    if (!promoForm.titulo.trim()) return;

    const precioNum = promoForm.precioPromo !== '' ? parseFloat(promoForm.precioPromo) : null;
    const precioValido = precioNum !== null && !Number.isNaN(precioNum) && precioNum >= 0 ? precioNum : null;

    if (editandoPromoId) {
      const actualizada = promociones.map((p) =>
        p.id === editandoPromoId
          ? {
              ...p,
              titulo: promoForm.titulo.trim(),
              descripcion: promoForm.descripcion.trim(),
              precioPromo: precioValido,
              disponible: Boolean(promoForm.disponible)
            }
          : p
      );
      persistirPromociones(actualizada);
      setEditandoPromoId(null);
      setMensaje("🔥 Promoción actualizada.");
    } else {
      const nuevaPromo = {
        id: `promo-${Date.now()}`,
        titulo: promoForm.titulo.trim(),
        descripcion: promoForm.descripcion.trim(),
        precioPromo: precioValido,
        disponible: Boolean(promoForm.disponible)
      };
      persistirPromociones([nuevaPromo, ...promociones]);
      setMensaje("🔥 Promoción publicada para tus clientes.");
    }

    setPromoForm({
      titulo: '',
      descripcion: '',
      precioPromo: '',
      disponible: true
    });
    setTimeout(() => setMensaje(null), 3500);
  };

  const iniciarEdicionPromo = (promo) => {
    setEditandoPromoId(promo.id);
    setPromoForm({
      titulo: promo.titulo || '',
      descripcion: promo.descripcion || '',
      precioPromo: promo.precioPromo !== null && promo.precioPromo !== undefined ? String(promo.precioPromo) : '',
      disponible: Boolean(promo.disponible)
    });
  };

  const cancelarEdicionPromo = () => {
    setEditandoPromoId(null);
    setPromoForm({
      titulo: '',
      descripcion: '',
      precioPromo: '',
      disponible: true
    });
  };

  const alternarEstadoPromo = (promoId) => {
    const actualizada = promociones.map((p) =>
      p.id === promoId ? { ...p, disponible: !p.disponible } : p
    );
    persistirPromociones(actualizada);
    setMensaje("🔄 Estado de la promoción actualizado.");
    setTimeout(() => setMensaje(null), 3000);
  };

  const eliminarPromocion = (promoId) => {
    const actualizada = promociones.filter((p) => p.id !== promoId);
    if (editandoPromoId === promoId) {
      cancelarEdicionPromo();
    }
    persistirPromociones(actualizada);
    setMensaje("🗑️ Promoción eliminada.");
    setTimeout(() => setMensaje(null), 3000);
  };

  const cargarDatosRestaurante = async () => {
    try {
      try {
        const resCom = await api.get(`/comercios/${idReal}`);
        const com = resCom.data;
        if (com) {
          if (com.nombreComercio || com.NombreComercio) {
            setTituloNegocio(com.nombreComercio || com.NombreComercio);
          }
          setEstaAbierto(com.estaAbierto !== false);
          setUltimoCierreCaja(com.ultimoCierreCaja || null);
          setCalificacionStats({
            promedio: Number(com.calificacionPromedio || 0),
            total: Number(com.totalCalificaciones || 0)
          });
          if (!configCargadaRef.current) {
            setConfigRestaurante({
              horarioAtencion: com.horarioAtencion || 'Lun - Dom: 9:00 AM - 10:00 PM',
              tiempoPreparacion: com.tiempoPreparacion || '25-40 min',
              envioGratis: com.envioGratis !== false,
              costoEnvio: String(com.costoEnvio ?? 0),
              logoUrl: com.logoUrl || ''
            });
            configCargadaRef.current = true;
          }
        }
      } catch {
        // Si falla la carga puntual del comercio, continuamos con productos y pedidos
      }

      try {
        const resProd = await api.get(`/productos/comercio/${idReal}`);
        if (resProd.data && resProd.data.length > 0) {
          setProductos(resProd.data);
        } else {
          const resGen = await api.get('/productos');
          setProductos(resGen.data);
        }
      } catch {
        const resGen = await api.get('/productos');
        setProductos(resGen.data);
      }

      const resPedidos = await api.get(`/pedidos/comercio/${idReal}`);
      const listaPedidos = (resPedidos.data || []).filter(p => p.tenantId === idReal || !p.tenantId);

      const recibidosActuales = listaPedidos.filter(p => p.estado === 'RECIBIDO' || p.estado === 'PENDIENTE').length;
      if (ultimoConteoPedidos > 0 && recibidosActuales > ultimoConteoPedidos) {
        setNuevaAlertaPedido(true);
        setTimeout(() => setNuevaAlertaPedido(false), 7000);
      }
      setUltimoConteoPedidos(recibidosActuales);
      setPedidos(listaPedidos);
      setError(null);
    } catch (err) {
      console.error("Error al cargar datos del panel:", err);
      setError("No se pudieron cargar los datos del restaurante.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosRestaurante();
    const intervalo = setInterval(cargarDatosRestaurante, 3000);
    return () => clearInterval(intervalo);
  }, [idReal, ultimoConteoPedidos]);

  const ejecutarCambioCaja = async (abrir) => {
    setConfirmarCerrarCaja(false);
    setCambiandoCaja(true);
    setError(null);
    try {
      const res = await api.put(`/comercios/${idReal}/caja`, { estaAbierto: abrir });
      setEstaAbierto(res.data?.estaAbierto ?? abrir);
      setUltimoCierreCaja(res.data?.ultimoCierreCaja ?? (!abrir ? new Date().toISOString() : ultimoCierreCaja));
      mostrarMensaje(
        abrir
          ? "🟢 ¡Ventas iniciadas! Tu restaurante ya aparece ABIERTO para los clientes."
          : "🔒 Caja cerrada. Ingresos del día reiniciados y restaurante marcado como CERRADO."
      );
      cargarDatosRestaurante();
    } catch (err) {
      console.error("Error al actualizar estado de caja:", err);
      setError("No se pudo actualizar el estado de la caja en el servidor.");
    } finally {
      setCambiandoCaja(false);
    }
  };

  const handleToggleCaja = async (abrir) => {
    if (!abrir) {
      setConfirmarCerrarCaja(true);
      return;
    }
    await ejecutarCambioCaja(true);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesandoLogo(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setConfigRestaurante((prev) => ({ ...prev, logoUrl: compressedBase64 }));
        setProcesandoLogo(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleGuardarConfiguracion = async (e) => {
    e.preventDefault();
    setGuardandoConfig(true);
    setError(null);

    try {
      const costo = configRestaurante.envioGratis ? 0 : Math.max(0, parseFloat(configRestaurante.costoEnvio || '0') || 0);
      await api.put(`/comercios/${idReal}/configuracion`, {
        horarioAtencion: configRestaurante.horarioAtencion,
        tiempoPreparacion: configRestaurante.tiempoPreparacion,
        envioGratis: configRestaurante.envioGratis,
        costoEnvio: costo,
        logoUrl: configRestaurante.logoUrl || ''
      });
      mostrarMensaje("🏪 Perfil, horarios, envío y logo guardados correctamente.");
      cargarDatosRestaurante();
    } catch (err) {
      console.error("Error al guardar configuración:", err);
      setError("No se pudo guardar la configuración del restaurante.");
    } finally {
      setGuardandoConfig(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleGuardarProducto = async (e) => {
    e.preventDefault();
    try {
      if (editandoId) {
        await api.put(`/productos/${editandoId}`, {
          ...formData,
          id: editandoId,
          tenantId: idReal,
          precio: parseFloat(formData.precio)
        });
        setMensaje("Platillo actualizado exitosamente.");
        setEditandoId(null);
      } else {
        await api.post('/productos', {
          ...formData,
          tenantId: idReal,
          precio: parseFloat(formData.precio)
        });
        setMensaje("Platillo agregado al menú.");
      }
      setFormData({ nombre: '', descripcion: '', precio: '', disponible: true });
      cargarDatosRestaurante();
    } catch {
      setError("No se pudo guardar el producto.");
    }
  };

  const iniciarEdicion = (prod) => {
    setEditandoId(prod.id);
    setFormData({
      nombre: prod.nombre,
      descripcion: prod.descripcion || '',
      precio: prod.precio,
      disponible: prod.disponible
    });
    setSeccionActiva('MENU');
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setFormData({ nombre: '', descripcion: '', precio: '', disponible: true });
  };

  const confirmarEliminarProducto = async () => {
    if (!confirmarEliminarPlatillo) return;
    const { id, nombre } = confirmarEliminarPlatillo;
    setConfirmarEliminarPlatillo(null);

    try {
      await api.delete(`/productos/${id}`);
      setMensaje(`Platillo '${nombre}' eliminado del menú.`);
      setTimeout(() => setMensaje(null), 3500);
      cargarDatosRestaurante();
    } catch {
      setError("No se pudo eliminar el producto.");
    }
  };

  const cambiarEstadoPedido = async (idPedido, nuevoEstado) => {
    const repartidorLimpio = String(repartidoresPorPedido[idPedido] ?? '').trim();
    const esRecogerPedido = String(
      pedidos.find(p => p.id === idPedido)?.direccionCliente || ''
    ).toLowerCase().includes('recoger');

    if (nuevoEstado === 'HACIA_DOMICILIO' && !esRecogerPedido && !repartidorLimpio) {
      setError(`Asigna el nombre del repartidor para ORD-${idPedido} antes de enviarlo a domicilio.`);
      setTimeout(() => setError(null), 3500);
      return;
    }

    try {
      await api.put(`/pedidos/estado/${idPedido}`, {
        estado: nuevoEstado,
        ...(repartidorLimpio ? { repartidorNombre: repartidorLimpio } : {})
      });
      cargarDatosRestaurante();
    } catch {
      setError("No se pudo actualizar el estado del pedido.");
    }
  };

  const modalidadUpper = String(modalidadServicio || 'LOCAL_Y_DOMICILIO').toUpperCase().trim();
  const esSoloLocal = modalidadUpper === 'SOLO_LOCAL';
  const permiteRecoger = modalidadUpper === 'DOMICILIO_Y_RECOGER';

  const pedidosRecibidos = pedidos.filter(p => p.estado === 'RECIBIDO' || p.estado === 'PENDIENTE');
  const pedidosEnPreparacion = pedidos.filter(p => p.estado === 'EN_PREPARACION' || p.estado === 'PREPARANDO');
  const pedidosHaciaDomicilio = pedidos.filter(p => p.estado === 'HACIA_DOMICILIO');

  // Solo contamos en "Ventas del Día" las órdenes completadas en el turno actual (después del último cierre de caja)
  const pedidosCompletados = !estaAbierto
    ? []
    : pedidos.filter(p => {
        if (p.estado !== 'COMPLETADO') return false;
        if (!ultimoCierreCaja) return true;
        const fechaRef = new Date(p.fechaCompletado || p.fechaCreacion);
        return fechaRef > new Date(ultimoCierreCaja);
      });

  const ventasDelDiaTotal = pedidosCompletados.reduce((acc, p) => acc + (p.total || 0), 0);

  const ventasPorPlatilloYRepartidor = [];
  pedidosCompletados.forEach(pedido => {
    const repNombre = obtenerNombreRepartidorPedido(pedido, repartidoresPorPedido) || 'Sin repartidor asignado';
    pedido.detalles?.forEach(det => {
      const clave = `${det.nombreProducto}__${repNombre.toLowerCase()}`;
      const existente = ventasPorPlatilloYRepartidor.find(v => v.clave === clave);
      const subtotal = Number(det.precio || 0) * Number(det.cantidad || 0);
      if (existente) {
        existente.cantidad += Number(det.cantidad || 0);
        existente.totalVendido += subtotal;
      } else {
        ventasPorPlatilloYRepartidor.push({
          clave,
          nombre: det.nombreProducto,
          repartidor: repNombre,
          cantidad: Number(det.cantidad || 0),
          totalVendido: subtotal
        });
      }
    });
  });

  const seccionVisible = esSoloLocal && seccionActiva === 'COMANDAS' ? 'MENU' : seccionActiva;

  return (
    <div className="max-w-6xl mx-auto space-y-5 relative text-slate-100">

      {nuevaAlertaPedido && !esSoloLocal && (
        <div className="neon-btn-orange text-white p-3.5 rounded-2xl flex items-center justify-between animate-bounce z-50">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚨</span>
            <div>
              <p className="font-black text-xs">¡Nuevo Pedido Entrante!</p>
              <p className="text-[11px] text-amber-100">Un cliente acaba de enviar una orden a tu establecimiento.</p>
            </div>
          </div>
          <span className="bg-black/30 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full">
            ¡Revisa Recibidos!
          </span>
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-2xl border-2 border-amber-400/80 bg-[#0d2a32] flex flex-col sm:flex-row justify-between items-stretch sm:items-center min-h-[118px]"
        style={{
          boxShadow:
            '0 0 24px rgba(245, 158, 11, 0.28), 0 14px 30px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.14)'
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 360 140"
          preserveAspectRatio="none"
          className="hidden sm:block absolute top-0 right-0 bottom-0 h-full w-[42%]"
        >
          <defs>
            <linearGradient id="goldWaveNegocio" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f3cf83" />
              <stop offset="52%" stopColor="#e0a83e" />
              <stop offset="100%" stopColor="#c47e18" />
            </linearGradient>
          </defs>
          <path
            d="M 115 0 C 48 34, 88 76, 36 106 C 12 120, 6 132, 0 140 L 360 140 L 360 0 Z"
            fill="url(#goldWaveNegocio)"
          />
        </svg>

        <div className="relative z-10 px-5 sm:px-6 py-5 flex items-center gap-3.5">
          <div className="icon-3d-pod w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-2xl shrink-0 border-2 border-amber-400/60">
            {configRestaurante.logoUrl ? (
              <img src={configRestaurante.logoUrl} alt={`Logo ${tituloNegocio}`} className="w-full h-full object-cover" />
            ) : (
              <span>👨‍🍳</span>
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
                estaAbierto
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : 'bg-red-500/20 text-red-300 border-red-400/40'
              }`}>
                {estaAbierto ? '🟢 Abierto' : '🔴 Cerrado'}
              </span>
              {calificacionStats.total > 0 && (
                <span className="bg-[#070e14]/80 text-amber-300 border border-amber-400/40 text-[10px] px-2.5 py-0.5 rounded-full font-black">
                  ⭐ {calificacionStats.promedio.toFixed(1)} ({calificacionStats.total})
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-[28px] font-black text-white leading-tight drop-shadow-xs">
              {tituloNegocio}
            </h2>
            <p className="text-[11px] text-amber-200/85 font-extrabold uppercase tracking-wider mt-0.5">
              PANEL ADMINISTRATIVO • {obtenerEtiquetaModalidad(modalidadServicio)}
            </p>
          </div>
        </div>

        <div className="relative z-10 px-4 sm:pr-6 py-3 sm:py-4 flex items-center justify-end">
          <div
            className="bg-[#1b1914]/95 border-2 border-amber-300 px-5 py-3 rounded-2xl text-center w-full sm:w-auto min-w-[215px] space-y-2"
            style={{ boxShadow: '0 0 24px rgba(251, 191, 36, 0.65), 0 8px 18px rgba(0, 0, 0, 0.55)' }}
          >
            <div>
              <p className="text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>💰</span>
                <span>VENTAS DEL DÍA</span>
              </p>
              <p className="text-xl sm:text-2xl font-black text-white leading-tight mt-0.5">
                ${ventasDelDiaTotal.toFixed(2)}{' '}
                <span className="text-[10px] font-extrabold text-amber-200">MXN</span>
              </p>
              <p className="text-[10px] text-amber-100/90 font-semibold mt-0.5">
                {estaAbierto ? `${pedidosCompletados.length} órdenes completadas` : 'Turno cerrado • Inicia ventas'}
              </p>
            </div>
            {estaAbierto ? (
              <button
                type="button"
                disabled={cambiandoCaja}
                onClick={() => handleToggleCaja(false)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-1.5 px-3 rounded-xl text-[11px] transition cursor-pointer disabled:opacity-50"
              >
                {cambiandoCaja ? 'Cerrando...' : '🔒 Cerrar Día / Caja'}
              </button>
            ) : (
              <button
                type="button"
                disabled={cambiandoCaja}
                onClick={() => handleToggleCaja(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 px-3 rounded-xl text-[11px] transition cursor-pointer disabled:opacity-50"
              >
                {cambiandoCaja ? 'Abriendo...' : '🟢 Iniciar Ventas (Abrir)'}
              </button>
            )}
          </div>
        </div>
      </div>

      {mensaje && (
        <div className="bg-emerald-500/15 border border-emerald-400/50 text-emerald-200 p-3 rounded-xl text-center text-xs font-bold shadow-[0_0_14px_rgba(16,185,129,0.25)]">
          {mensaje}
        </div>
      )}
      {error && (
        <div className="bg-red-500/15 border border-red-400/50 text-red-200 p-3 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        <aside className="lg:col-span-3 neon-amber-card bg-[#0e1b26] p-3.5 rounded-2xl space-y-2 lg:sticky lg:top-24">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2.5 pt-1 pb-1">
            Módulos del Negocio
          </p>

          {!esSoloLocal && (
            <button
              type="button"
              onClick={() => setSeccionActiva('COMANDAS')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-between ${
                seccionVisible === 'COMANDAS'
                  ? 'bg-amber-400/15 text-amber-300 border border-amber-400/60 shadow-[0_0_14px_rgba(251,191,36,0.2)]'
                  : 'text-slate-300 hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>🕒</span>
                <span>Comandas</span>
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full text-[10px]">
                {pedidosRecibidos.length + pedidosEnPreparacion.length + pedidosHaciaDomicilio.length}
              </span>
            </button>
          )}

          {!esSoloLocal && (
            <button
              type="button"
              onClick={() => setSeccionActiva('VENTAS')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-between ${
                seccionVisible === 'VENTAS'
                  ? 'bg-amber-400/15 text-amber-300 border border-amber-400/60 shadow-[0_0_14px_rgba(251,191,36,0.2)]'
                  : 'text-slate-300 hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>📊</span>
                <span>Ventas del Día</span>
              </span>
              <span className="text-[10px] text-amber-300 font-extrabold">
                ${ventasDelDiaTotal.toFixed(0)}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSeccionActiva('MENU')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-between ${
              seccionVisible === 'MENU'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/60 shadow-[0_0_14px_rgba(251,191,36,0.2)]'
                : 'text-slate-300 hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📜</span>
              <span>Menú</span>
            </span>
            <span className="bg-white/10 text-slate-200 px-2 py-0.5 rounded-full text-[10px]">
              {productos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSeccionActiva('PROMOS')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-between ${
              seccionVisible === 'PROMOS'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/60 shadow-[0_0_14px_rgba(251,191,36,0.2)]'
                : 'text-slate-300 hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🔥</span>
              <span>Promociones</span>
            </span>
            <span className="bg-orange-500/20 text-orange-300 border border-orange-400/35 px-2 py-0.5 rounded-full text-[10px]">
              {promociones.filter(p => p.disponible).length}
            </span>
          </button>

          <div className="border-t border-white/10 pt-2 mt-1">
            <button
              type="button"
              onClick={() => setSeccionActiva('CONFIG')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-between ${
                seccionVisible === 'CONFIG'
                  ? 'bg-amber-400/15 text-amber-300 border border-amber-400/60 shadow-[0_0_14px_rgba(251,191,36,0.2)]'
                  : 'text-slate-300 hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>🏛️</span>
                <span>Banco y Modalidad</span>
              </span>
            </button>
          </div>
        </aside>

        <section className="lg:col-span-9 space-y-5 min-w-0">

          {seccionVisible === 'COMANDAS' && !esSoloLocal && (
            <div
              className="bg-[#d7eee7] text-[#0f172a] p-5 sm:p-6 rounded-2xl border-2 border-emerald-300/80 space-y-4"
              style={{ boxShadow: '0 0 22px rgba(16, 185, 129, 0.22), 0 14px 30px rgba(0, 0, 0, 0.6)' }}
            >
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-emerald-900/15 pb-3">
                <h3 className="text-sm sm:text-base font-black text-[#0f172a] flex items-center gap-2">
                  <span>🕒</span>
                  <span>
                    {permiteRecoger
                      ? 'Comandas en Tiempo Real (Domicilio y Recoger)'
                      : 'Comandas y Pedidos en Tiempo Real'}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={cargarDatosRestaurante}
                  className="text-[11px] bg-[#134e4a] hover:bg-[#0f3d3a] text-white px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer shadow-sm"
                >
                  🔄 Actualizar Tablero
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div
                  className="bg-[#123c33] text-white p-3.5 rounded-2xl border-2 border-emerald-400/65 space-y-2.5 min-w-0"
                  style={{ boxShadow: '0 0 16px rgba(16, 185, 129, 0.22)' }}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-white/15">
                    <span className="font-black text-emerald-200 text-xs flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"></span>
                      <span>Recibidos</span>
                    </span>
                    <span className="bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black shadow-[0_0_10px_rgba(251,191,36,0.55)]">
                      {pedidosRecibidos.length}
                    </span>
                  </div>

                  {loading && pedidos.length === 0 ? (
                    <p className="text-[11px] text-emerald-100/70 text-center py-6">Cargando...</p>
                  ) : pedidosRecibidos.length === 0 ? (
                    <p className="text-[11px] text-emerald-100/70 text-center py-6 font-medium">Sin pedidos en este estado</p>
                  ) : (
                    pedidosRecibidos.map(ped => {
                      const imagenComprobante = ped.comprobanteUrl || ped.comprobante || ped.imagenComprobante || ped.voucher || ped.urlComprobante;

                      return (
                        <div key={ped.id} className="bg-white text-slate-900 p-3 rounded-xl border border-emerald-200 shadow-sm space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-[11px] text-slate-900">ORD-{ped.id}</span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {new Date(ped.fechaCreacion || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="space-y-0.5 text-[11px]">
                            <p className="font-extrabold text-slate-900 truncate">{ped.clienteNombre}</p>
                            <p className="text-slate-600 truncate">📞 {ped.telefonoCliente}</p>
                            <p className="text-emerald-700 font-bold truncate">📍 {ped.direccionCliente || "Pasar a recoger"}</p>
                          </div>
                          <div className="bg-slate-100 p-2 rounded-lg text-[11px] space-y-0.5 font-semibold text-slate-800">
                            {ped.detalles?.map((d, i) => <div key={i} className="truncate">• {d.cantidad}x {d.nombreProducto}</div>)}
                          </div>

                          {imagenComprobante && (
                            <div className="bg-slate-100 p-2 rounded-lg border border-slate-200 text-center space-y-1">
                              <p className="text-[10px] font-extrabold text-indigo-700">📎 Comprobante de Pago:</p>
                              <a href={imagenComprobante} target="_blank" rel="noopener noreferrer" className="block">
                                <img
                                  src={imagenComprobante.startsWith('data:') || imagenComprobante.startsWith('http') || imagenComprobante.startsWith('/') ? imagenComprobante : `data:image/png;base64,${imagenComprobante}`}
                                  alt="Comprobante"
                                  className="w-full h-24 object-cover rounded-md border border-slate-300"
                                />
                              </a>
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-[11px]">
                            <span className="text-slate-500 truncate">Pago: {ped.metodoPago}</span>
                            <span className="font-black text-emerald-700">${ped.total?.toFixed(2)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => cambiarEstadoPedido(ped.id, 'EN_PREPARACION')}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black py-1.5 rounded-full transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                          >
                            Preparar →
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div
                  className="bg-[#0f463a] text-white p-3.5 rounded-2xl border-2 border-emerald-400/75 space-y-2.5 min-w-0"
                  style={{ boxShadow: '0 0 18px rgba(16, 185, 129, 0.28)' }}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-white/15">
                    <span className="font-black text-emerald-200 text-xs flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]"></span>
                      <span>En Preparación</span>
                    </span>
                    <span className="bg-emerald-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black shadow-[0_0_10px_rgba(52,211,153,0.6)]">
                      {pedidosEnPreparacion.length}
                    </span>
                  </div>

                  {pedidosEnPreparacion.length === 0 ? (
                    <p className="text-[11px] text-emerald-100/70 text-center py-6 font-medium">Sin pedidos en este estado</p>
                  ) : (
                    pedidosEnPreparacion.map(ped => {
                      const esRecoger = String(ped.direccionCliente || '').toLowerCase().includes('recoger');
                      const repActual = repartidoresPorPedido[ped.id] ?? obtenerNombreRepartidorPedido(ped, repartidoresPorPedido);

                      return (
                        <div key={ped.id} className="bg-white text-slate-900 p-3 rounded-xl border border-emerald-200 shadow-sm space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-[11px] text-slate-900">ORD-{ped.id}</span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {new Date(ped.fechaCreacion || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="space-y-0.5 text-[11px]">
                            <p className="font-extrabold text-slate-900 truncate">{ped.clienteNombre}</p>
                            <p className="text-slate-600 truncate">📞 {ped.telefonoCliente}</p>
                            <p className="text-emerald-700 font-bold truncate">📍 {ped.direccionCliente || "Pasar a recoger"}</p>
                          </div>
                          <div className="bg-slate-100 p-2 rounded-lg text-[11px] space-y-0.5 font-semibold text-slate-800">
                            {ped.detalles?.map((d, i) => <div key={i} className="truncate">• {d.cantidad}x {d.nombreProducto}</div>)}
                          </div>

                          {!esRecoger && (
                            <div className="space-y-1">
                              <label className="block text-[10px] font-extrabold text-slate-700">
                                🛵 Repartidor asignado
                              </label>
                              <input
                                type="text"
                                value={repActual}
                                onChange={(e) => handleRepartidorChange(ped.id, e.target.value)}
                                placeholder="Nombre del repartidor"
                                className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-[11px] text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-[11px]">
                            <span className="text-slate-500 truncate">Pago: {ped.metodoPago}</span>
                            <span className="font-black text-emerald-700">${ped.total?.toFixed(2)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => cambiarEstadoPedido(ped.id, 'HACIA_DOMICILIO')}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black py-1.5 rounded-full transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                          >
                            {esRecoger ? 'Listo para Recoger 🛍️' : 'Enviar a Domicilio 🛵'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div
                  className="bg-[#123c33] text-white p-3.5 rounded-2xl border-2 border-emerald-400/65 space-y-2.5 min-w-0"
                  style={{ boxShadow: '0 0 16px rgba(16, 185, 129, 0.22)' }}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-white/15">
                    <span className="font-black text-emerald-200 text-xs flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
                      <span>{permiteRecoger ? 'En Camino / Recogida' : 'Hacia el Domicilio'}</span>
                    </span>
                    <span className="bg-emerald-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black shadow-[0_0_10px_rgba(52,211,153,0.6)]">
                      {pedidosHaciaDomicilio.length}
                    </span>
                  </div>

                  {pedidosHaciaDomicilio.length === 0 ? (
                    <p className="text-[11px] text-emerald-100/70 text-center py-6 font-medium">Sin pedidos en este estado</p>
                  ) : (
                    pedidosHaciaDomicilio.map(ped => {
                      const nombreRep = obtenerNombreRepartidorPedido(ped, repartidoresPorPedido);
                      return (
                        <div key={ped.id} className="bg-white text-slate-900 p-3 rounded-xl border border-emerald-200 shadow-sm space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-[11px] text-slate-900">ORD-{ped.id}</span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {new Date(ped.fechaCreacion || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="space-y-0.5 text-[11px]">
                            <p className="font-extrabold text-slate-900 truncate">{ped.clienteNombre}</p>
                            <p className="text-slate-600 truncate">📞 {ped.telefonoCliente}</p>
                            <p className="text-emerald-700 font-bold truncate">📍 {ped.direccionCliente || "Pasar a recoger"}</p>
                            <p className="text-indigo-700 font-extrabold truncate">
                              🛵 Repartidor: {nombreRep || "No asignado"}
                            </p>
                          </div>
                          <div className="bg-slate-100 p-2 rounded-lg text-[11px] space-y-0.5 font-semibold text-slate-800">
                            {ped.detalles?.map((d, i) => <div key={i} className="truncate">• {d.cantidad}x {d.nombreProducto}</div>)}
                          </div>
                          <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-[11px]">
                            <span className="text-slate-500 truncate">Pago: {ped.metodoPago}</span>
                            <span className="font-black text-emerald-700">${ped.total?.toFixed(2)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => cambiarEstadoPedido(ped.id, 'COMPLETADO')}
                            className="neon-btn-orange w-full text-white text-[11px] font-black py-1.5 rounded-full transition cursor-pointer"
                          >
                            Completar / Entregado ✅
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </div>
          )}

          {seccionVisible === 'VENTAS' && !esSoloLocal && (
            <div className="neon-amber-card bg-[#0e1b26] p-5 sm:p-6 rounded-2xl space-y-3.5">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span className="icon-3d-pod w-8 h-8 rounded-xl flex items-center justify-center text-base">📊</span>
                <span>Desglose de Ventas del Día por Producto</span>
              </h3>
              {ventasPorPlatilloYRepartidor.length === 0 ? (
                <div className="bg-[#070e14] p-6 rounded-xl text-center border border-dashed border-white/15">
                  <p className="text-xs text-slate-400 font-medium">Aún no hay ventas completadas hoy.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Producto / Platillo</th>
                        <th className="py-2.5 px-3">Repartidor</th>
                        <th className="py-2.5 px-3 text-center">Cantidad Vendida</th>
                        <th className="py-2.5 px-3 text-right">Total Generado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-xs font-medium">
                      {ventasPorPlatilloYRepartidor.map((item) => (
                        <tr key={item.clave} className="hover:bg-white/5 transition">
                          <td className="py-2.5 px-3 font-bold text-white">🍔 {item.nombre}</td>
                          <td className="py-2.5 px-3 text-cyan-300 font-semibold">🛵 {item.repartidor}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                              {item.cantidad} pzas
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-amber-400">
                            ${item.totalVendido.toFixed(2)} MXN
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {seccionVisible === 'MENU' && (
            <div className="space-y-5">
              <div className="neon-amber-card bg-[#0e1b26] p-5 sm:p-6 rounded-2xl">
                <h3 className="text-sm font-black text-white mb-3.5 flex items-center gap-2">
                  <span className="icon-3d-pod w-8 h-8 rounded-xl flex items-center justify-center text-base">
                    {editandoId ? "✏️" : "➕"}
                  </span>
                  <span>{editandoId ? "Editar Platillo" : "Registrar Nuevo Platillo al Menú"}</span>
                </h3>
                <form onSubmit={handleGuardarProducto} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Nombre del Platillo</label>
                      <input
                        type="text"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Precio ($ MXN)</label>
                      <input
                        type="number"
                        step="0.50"
                        name="precio"
                        value={formData.precio}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Descripción</label>
                    <input
                      type="text"
                      name="descripcion"
                      value={formData.descripcion}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                    />
                  </div>
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="submit"
                      className="neon-btn-orange text-white font-black px-5 py-2 rounded-xl text-xs transition cursor-pointer"
                    >
                      {editandoId ? "Actualizar Platillo" : "Guardar en el Menú"}
                    </button>
                    {editandoId && (
                      <button
                        type="button"
                        onClick={cancelarEdicion}
                        className="bg-[#172836] hover:bg-[#1f3446] text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="neon-amber-card bg-[#0e1b26] p-5 sm:p-6 rounded-2xl">
                <h3 className="text-sm font-black text-white mb-3.5 flex items-center gap-2">
                  <span className="icon-3d-pod w-8 h-8 rounded-xl flex items-center justify-center text-base">📜</span>
                  <span>Menú Publicado Actual</span>
                </h3>
                {productos.length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-xs font-medium">No hay platillos registrados.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {productos.map(prod => (
                      <div key={prod.id} className="p-3.5 rounded-xl border border-amber-400/25 bg-[#070e14] flex justify-between items-start gap-3">
                        <div>
                          <h4 className="font-extrabold text-white text-xs">{prod.nombre}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">{prod.descripcion}</p>
                          <p className="text-xs font-black text-amber-400 mt-1.5">${prod.precio.toFixed(2)} MXN</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => iniciarEdicion(prod)}
                            className="icon-3d-pod p-1.5 rounded-lg hover:brightness-110 transition text-xs cursor-pointer"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmarEliminarPlatillo({ id: prod.id, nombre: prod.nombre })}
                            className="icon-3d-pod p-1.5 rounded-lg hover:border-red-400/60 transition text-xs cursor-pointer"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {seccionVisible === 'PROMOS' && (
            <div className="neon-amber-card bg-[#0e1b26] p-5 sm:p-6 rounded-2xl space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <span className="icon-3d-pod w-8 h-8 rounded-xl flex items-center justify-center text-base">🔥</span>
                    <span>Promociones del Negocio</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Publica promociones y cámbialas entre disponible o agotada cuando se terminen.
                  </p>
                </div>
                <span className="text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/35 px-3 py-1 rounded-full">
                  {promociones.filter(p => p.disponible).length} disponibles
                </span>
              </div>

              <form onSubmit={handleGuardarPromocion} className="space-y-3 bg-[#070e14] p-4 rounded-xl border border-white/10">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Título de la Promoción</label>
                    <input
                      type="text"
                      name="titulo"
                      value={promoForm.titulo}
                      onChange={handlePromoInputChange}
                      placeholder="Ej. 2x1 en Hamburguesas Clásicas"
                      required
                      className="w-full px-3.5 py-2 bg-[#0e1b26] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Precio Promo ($ MXN opcional)</label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      name="precioPromo"
                      value={promoForm.precioPromo}
                      onChange={handlePromoInputChange}
                      placeholder="Ej. 99.00"
                      className="w-full px-3.5 py-2 bg-[#0e1b26] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Detalles o Condiciones</label>
                  <input
                    type="text"
                    name="descripcion"
                    value={promoForm.descripcion}
                    onChange={handlePromoInputChange}
                    placeholder="Ej. Válido hoy hasta agotar existencias."
                    className="w-full px-3.5 py-2 bg-[#0e1b26] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      name="disponible"
                      checked={promoForm.disponible}
                      onChange={handlePromoInputChange}
                      className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Marcar como promoción disponible</span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="neon-btn-orange text-white font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                    >
                      {editandoPromoId ? 'Guardar Cambios' : 'Publicar Promoción'}
                    </button>
                    {editandoPromoId && (
                      <button
                        type="button"
                        onClick={cancelarEdicionPromo}
                        className="bg-[#172836] hover:bg-[#1f3446] text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </form>

              {promociones.length === 0 ? (
                <div className="bg-[#070e14] p-5 rounded-xl text-center border border-dashed border-white/15">
                  <p className="text-xs text-slate-400 font-medium">Aún no has agregado promociones para este negocio.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {promociones.map((promo) => (
                    <div
                      key={promo.id}
                      className="p-3.5 rounded-xl border border-amber-400/25 bg-[#070e14] flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              promo.disponible
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                            }`}
                          >
                            {promo.disponible ? 'Promociones 🔥' : 'Promociones agotadas'}
                          </span>
                          {promo.precioPromo !== null && promo.precioPromo !== undefined && (
                            <span className="text-xs font-black text-amber-400">
                              ${Number(promo.precioPromo).toFixed(2)} MXN
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-white text-xs pt-1">{promo.titulo}</h4>
                        {promo.descripcion && (
                          <p className="text-[11px] text-slate-400">{promo.descripcion}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => alternarEstadoPromo(promo.id)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                            promo.disponible
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/35'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/35'
                          }`}
                        >
                          {promo.disponible ? 'Marcar Agotada' : 'Marcar Disponible'}
                        </button>

                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => iniciarEdicionPromo(promo)}
                            className="icon-3d-pod p-1.5 rounded-lg hover:brightness-110 transition text-xs cursor-pointer"
                            title="Editar promoción"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarPromocion(promo.id)}
                            className="icon-3d-pod p-1.5 rounded-lg hover:border-red-400/60 transition text-xs cursor-pointer"
                            title="Eliminar promoción"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {seccionVisible === 'CONFIG' && (
            <div className="space-y-5">
              <div className="neon-amber-card bg-[#0e1b26] px-5 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-amber-300">
                    🏷️ Modalidad de Servicio del Negocio
                  </p>
                  <p className="text-[11px] text-slate-300">
                    {esSoloLocal
                      ? 'Modo solo local activo: enfocado en tu cuenta de transferencias, promociones y menú.'
                      : permiteRecoger
                      ? 'Modo domicilio y pasar a recoger activo: ideal para negocios que inician.'
                      : 'Modo con envío a domicilio activo.'}
                  </p>
                </div>

                <select
                  value={modalidadUpper}
                  onChange={(e) => handleCambiarModalidad(e.target.value)}
                  className="px-3.5 py-2 bg-[#070e14] border border-amber-400/35 rounded-xl text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                >
                  {MODALIDADES_SERVICIO.map((modo) => (
                    <option key={modo.value} value={modo.value}>
                      {modo.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="neon-amber-card bg-[#0e1b26] p-5 sm:p-6 rounded-2xl space-y-4">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <span>🏪</span>
                    <span>Perfil, Horarios, Tiempo de Preparación y Envío</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Estos datos se mostrarán a los clientes en la lista de comercios y dentro de tu menú.
                  </p>
                </div>

                <form onSubmit={handleGuardarConfiguracion} className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#070e14] p-4 rounded-xl border border-white/10">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-[#122332] border-2 border-amber-400/70 flex items-center justify-center shrink-0">
                      {configRestaurante.logoUrl ? (
                        <img
                          src={configRestaurante.logoUrl}
                          alt="Logo del restaurante"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">🍔</span>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <label className="block text-[11px] font-bold text-slate-200">
                        Logo / Foto de Perfil del Restaurante
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="w-full text-[11px] text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-amber-500 file:text-slate-950 cursor-pointer"
                      />
                      {procesandoLogo && (
                        <p className="text-[10px] text-amber-300 font-semibold">Procesando logo...</p>
                      )}
                      {configRestaurante.logoUrl && !procesandoLogo && (
                        <button
                          type="button"
                          onClick={() => setConfigRestaurante((prev) => ({ ...prev, logoUrl: '' }))}
                          className="text-[10px] text-rose-300 hover:underline font-bold cursor-pointer"
                        >
                          Quitar logo actual
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Días y Horario de Atención
                      </label>
                      <input
                        type="text"
                        value={configRestaurante.horarioAtencion}
                        onChange={(e) =>
                          setConfigRestaurante((prev) => ({ ...prev, horarioAtencion: e.target.value }))
                        }
                        placeholder="Ej. Lun - Dom: 9:00 AM - 10:00 PM"
                        required
                        className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Tiempo Aproximado de Preparación
                      </label>
                      <input
                        type="text"
                        value={configRestaurante.tiempoPreparacion}
                        onChange={(e) =>
                          setConfigRestaurante((prev) => ({ ...prev, tiempoPreparacion: e.target.value }))
                        }
                        placeholder="Ej. 25-40 min"
                        required
                        className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  <div className="bg-[#070e14] p-4 rounded-xl border border-white/10 space-y-3">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(configRestaurante.envioGratis)}
                        onChange={(e) =>
                          setConfigRestaurante((prev) => ({
                            ...prev,
                            envioGratis: e.target.checked,
                            costoEnvio: e.target.checked ? '0' : prev.costoEnvio
                          }))
                        }
                        className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Envío gratis</span>
                    </label>

                    {!configRestaurante.envioGratis && (
                      <div className="max-w-xs">
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Costo de Envío ($ MXN)
                        </label>
                        <input
                          type="number"
                          step="0.50"
                          min="0"
                          value={configRestaurante.costoEnvio}
                          onChange={(e) =>
                            setConfigRestaurante((prev) => ({ ...prev, costoEnvio: e.target.value }))
                          }
                          placeholder="Ej. 25.00"
                          required
                          className="w-full px-3.5 py-2 bg-[#0e1b26] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={guardandoConfig || procesandoLogo}
                    className="neon-btn-orange text-white font-black px-5 py-2.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {guardandoConfig ? 'Guardando...' : 'Guardar Perfil del Restaurante'}
                  </button>
                </form>
              </div>

              <div
                className="bg-[#d7eee7] text-[#0f172a] p-5 sm:p-6 rounded-2xl border-2 border-emerald-300/80"
                style={{ boxShadow: '0 0 22px rgba(16, 185, 129, 0.22), 0 12px 26px rgba(0, 0, 0, 0.55)' }}
              >
                <div className="mb-3.5">
                  <h3 className="text-sm sm:text-base font-black text-[#0f172a] flex items-center gap-2">
                    <span className="text-teal-800 text-base">🏛️</span>
                    <span>Configuración de Cuenta para Transferencias</span>
                  </h3>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    Estos datos se mostrarán automáticamente a los clientes cuando elijan pagar por transferencia.
                  </p>
                </div>

                <form onSubmit={guardarDatosBanco} className="space-y-3.5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Banco</label>
                      <input
                        type="text"
                        value={datosBanco.banco}
                        onChange={(e) => setDatosBanco({ ...datosBanco, banco: e.target.value })}
                        placeholder="Ej. BBVA / Banco Azteca"
                        required
                        className="w-full px-3.5 py-2 bg-[#ebf7f3] border border-emerald-800/15 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Número de Tarjeta / CLABE</label>
                      <input
                        type="text"
                        value={datosBanco.numeroCuenta}
                        onChange={(e) => setDatosBanco({ ...datosBanco, numeroCuenta: e.target.value })}
                        placeholder="Ej. 2343 4567 8765 1234"
                        required
                        className="w-full px-3.5 py-2 bg-[#ebf7f3] border border-emerald-800/15 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Nombre del Titular</label>
                      <input
                        type="text"
                        value={datosBanco.titular}
                        onChange={(e) => setDatosBanco({ ...datosBanco, titular: e.target.value })}
                        placeholder="Ej. Marcos Antonio Lopez Garcia"
                        required
                        className="w-full px-3.5 py-2 bg-[#ebf7f3] border border-emerald-800/15 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-bold"
                      />
                    </div>
                  </div>

                  <div className="pt-0.5">
                    <button
                      type="submit"
                      className="neon-btn-violet text-white font-extrabold px-4 py-2 rounded-xl text-xs transition cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <span>Guardar Datos Bancarios</span>
                      <span>💾</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </section>
      </div>

      {confirmarCerrarCaja && (
        <div
          onClick={() => setConfirmarCerrarCaja(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="neon-amber-card bg-[#0e1b26] rounded-2xl max-w-md w-full p-6 space-y-4 text-slate-100"
          >
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Confirmar Acción
              </span>
              <h3 className="text-base font-black text-white">Cerrar Día / Caja</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                ¿Cerrar caja / cerrar día? Las ventas del turno se reiniciarán a{' '}
                <strong className="text-amber-300">$0.00</strong> y tu restaurante aparecerá como{' '}
                <strong className="text-rose-300">CERRADO</strong> para los clientes hasta que inicies ventas de nuevo.
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmarCerrarCaja(false)}
                className="flex-1 bg-[#172836] hover:bg-[#1f3446] text-slate-200 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cambiandoCaja}
                onClick={() => ejecutarCambioCaja(false)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                Sí, Cerrar Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarEliminarPlatillo && (
        <div
          onClick={() => setConfirmarEliminarPlatillo(null)}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="neon-amber-card bg-[#0e1b26] rounded-2xl max-w-sm w-full p-6 space-y-4 text-slate-100"
          >
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                Confirmar Acción
              </span>
              <h3 className="text-base font-black text-white">Eliminar Platillo</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                ¿Eliminar <strong className="text-white">{confirmarEliminarPlatillo.nombre}</strong> del menú?
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmarEliminarPlatillo(null)}
                className="flex-1 bg-[#172836] hover:bg-[#1f3446] text-slate-200 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminarProducto}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PanelRestaurante;