import { useState, useEffect, useRef } from 'react';
import api from './ApiClient';

function PanelRestaurante({ comercioId = 1, nombreComercio = "Mi Negocio", correoNegocio = "" }) {
  const idReal = (comercioId && typeof comercioId === 'number' && comercioId < 1000000) ? comercioId : 1;

  const [tituloNegocio, setTituloNegocio] = useState(nombreComercio || "Mi Negocio");
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const [nuevaAlertaPedido, setNuevaAlertaPedido] = useState(false);
  const [ultimoConteoPedidos, setUltimoConteoPedidos] = useState(0);

  const [editandoId, setEditandoId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', precio: '', disponible: true });

  const [datosBanco, setDatosBanco] = useState({
    banco: '',
    numeroCuenta: '',
    titular: ''
  });

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
    const buscarNombreEnLista = (lista) => {
      if (!Array.isArray(lista)) return '';
      const correoBuscado = String(correoNegocio || '').toLowerCase().trim();
      const match = lista.find(
        c =>
          Number(c?.id ?? c?.Id ?? c?.comercioId ?? c?.ComercioId) === Number(idReal) ||
          (correoBuscado &&
            String(c?.correoDuenio || c?.CorreoDuenio || c?.correo || c?.Correo || '').toLowerCase().trim() ===
              correoBuscado)
      );
      return match?.nombreComercio || match?.NombreComercio || '';
    };

    const resolverNombreRealNegocio = async () => {
      try {
        const cacheApi = JSON.parse(localStorage.getItem('cache_comercios_api') || '[]');
        const dirOffline = JSON.parse(localStorage.getItem('directorio_offline') || '[]');
        const locales = JSON.parse(localStorage.getItem('comercios_registrados') || '[]');
        const nombreLocal =
          buscarNombreEnLista(cacheApi) ||
          buscarNombreEnLista(dirOffline) ||
          buscarNombreEnLista(locales);

        if (nombreLocal) {
          setTituloNegocio(nombreLocal);
        }

        const resComercio = await api.get(`/comercios/${idReal}`, { timeout: 2500 });
        const dataComercio = resComercio?.data;
        const nombreApi = dataComercio?.nombreComercio || dataComercio?.NombreComercio;
        if (nombreApi) {
          setTituloNegocio(nombreApi);
          return;
        }
      } catch {
        // Si falla el endpoint directo, busca en la lista completa /comercios
      }

      try {
        const resLista = await api.get('/comercios', { timeout: 2500 });
        const nombreDesdeLista = buscarNombreEnLista(resLista?.data);
        if (nombreDesdeLista) {
          setTituloNegocio(nombreDesdeLista);
        }
      } catch {
        // Conserva el nombre local o el recibido por props
      }
    };

    resolverNombreRealNegocio();
  }, [idReal, correoNegocio]);

  useEffect(() => {
    configCargadaRef.current = false;
    const bancoGuardado = localStorage.getItem(`banco_${idReal}`);
    if (bancoGuardado) {
      setDatosBanco(JSON.parse(bancoGuardado));
    }
  }, [idReal]);

  const guardarDatosBanco = (e) => {
    e.preventDefault();
    localStorage.setItem(`banco_${idReal}`, JSON.stringify(datosBanco));
    mostrarMensaje("🏦 Datos bancarios actualizados correctamente para tus clientes.");
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

  const handleToggleCaja = async (abrir) => {
    if (!abrir) {
      const confirmar = window.confirm(
        "¿Cerrar caja / cerrar día? Las ventas del turno se reiniciarán a $0.00 y tu restaurante aparecerá como CERRADO para los clientes hasta que inicies ventas de nuevo."
      );
      if (!confirmar) return;
    }

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
        await api.put(`/productos/${editandoId}`, { ...formData, id: editandoId, tenantId: idReal, precio: parseFloat(formData.precio) });
        setMensaje("Platillo actualizado exitosamente.");
        setEditandoId(null);
      } else {
        await api.post('/productos', { ...formData, tenantId: idReal, precio: parseFloat(formData.precio) });
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
    setFormData({ nombre: prod.nombre, descripcion: prod.descripcion || '', precio: prod.precio, disponible: prod.disponible });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setFormData({ nombre: '', descripcion: '', precio: '', disponible: true });
  };

  const handleEliminarProducto = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar '${nombre}' del menú?`)) return;
    try {
      await api.delete(`/productos/${id}`);
      cargarDatosRestaurante();
    } catch {
      setError("No se pudo eliminar el producto.");
    }
  };

  const cambiarEstadoPedido = async (idPedido, nuevoEstado) => {
    try {
      await api.put(`/pedidos/estado/${idPedido}`, { estado: nuevoEstado });
      cargarDatosRestaurante();
    } catch {
      setError("No se pudo actualizar el estado del pedido.");
    }
  };

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

  const productosVendidosMap = {};
  pedidosCompletados.forEach(pedido => {
    pedido.detalles?.forEach(det => {
      if (!productosVendidosMap[det.nombreProducto]) {
        productosVendidosMap[det.nombreProducto] = { cantidad: 0, totalVendido: 0 };
      }
      productosVendidosMap[det.nombreProducto].cantidad += det.cantidad;
      productosVendidosMap[det.nombreProducto].totalVendido += (det.precio * det.cantidad);
    });
  });

  const listaProductosVendidos = Object.keys(productosVendidosMap).map(nombre => ({
    nombre,
    cantidad: productosVendidosMap[nombre].cantidad,
    totalVendido: productosVendidosMap[nombre].totalVendido
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-5 relative text-slate-100">

      {nuevaAlertaPedido && (
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

      {/* Encabezado Negocio con División Ondulada / Curva Dorada (estilo image_3612db.jpg) */}
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-amber-400/80 bg-[#0d2a32] flex flex-col sm:flex-row justify-between items-stretch sm:items-center min-h-[124px]"
        style={{
          boxShadow:
            '0 0 24px rgba(245, 158, 11, 0.28), 0 14px 30px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.14)'
        }}
      >
        {/* Curva ondulada dorada a la derecha */}
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
              GESTIÓN DE OPERACIONES
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

      {/* Perfil del Restaurante: Logo, Horarios, Tiempo de Preparación y Envío */}
      <div className="neon-amber-card bg-[#0e1b26] p-5 sm:p-6 rounded-2xl space-y-4">
        <div>
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <span className="icon-3d-pod w-8 h-8 rounded-xl flex items-center justify-center text-base">🏪</span>
            <span>Perfil, Horarios, Tiempo y Envío</span>
          </h3>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            Esta información aparecerá en tu tarjeta y menú para que los clientes sepan cómo y cuándo pedir.
          </p>
        </div>

        <form onSubmit={handleGuardarConfiguracion} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#070e14] p-4 rounded-xl border border-white/10">
            <div className="w-16 h-16 rounded-full bg-[#0e1b26] border-2 border-amber-400/60 flex items-center justify-center overflow-hidden shrink-0">
              {configRestaurante.logoUrl ? (
                <img src={configRestaurante.logoUrl} alt="Logo del restaurante" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🍔</span>
              )}
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="block text-[11px] font-bold text-slate-200">🖼️ Logo / Foto de Perfil del Restaurante</label>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="text-[11px] text-slate-300 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-amber-500 file:text-slate-950 cursor-pointer"
                />
                {configRestaurante.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setConfigRestaurante((prev) => ({ ...prev, logoUrl: '' }))}
                    className="text-[11px] text-red-300 hover:text-red-200 font-bold px-2.5 py-1 rounded-lg bg-red-950/40 border border-red-400/30 transition cursor-pointer"
                  >
                    Quitar logo
                  </button>
                )}
              </div>
              {procesandoLogo && <p className="text-[10px] text-amber-300 font-semibold animate-pulse">⏳ Optimizando logo...</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">🕒 Horarios de Atención</label>
              <input
                type="text"
                value={configRestaurante.horarioAtencion}
                onChange={(e) => setConfigRestaurante({ ...configRestaurante, horarioAtencion: e.target.value })}
                placeholder="Ej. Lun - Dom: 9:00 AM - 10:00 PM"
                required
                className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">⏱️ Tiempo Aproximado de Preparación</label>
              <input
                type="text"
                value={configRestaurante.tiempoPreparacion}
                onChange={(e) => setConfigRestaurante({ ...configRestaurante, tiempoPreparacion: e.target.value })}
                placeholder="Ej. 25-40 min"
                required
                className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {['15-25 min', '25-40 min', '40-60 min'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setConfigRestaurante({ ...configRestaurante, tiempoPreparacion: preset })}
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-[#122332] hover:bg-[#193044] text-amber-200 border border-amber-400/25 transition cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#070e14] p-4 rounded-xl border border-white/10 space-y-3">
            <label className="block text-[11px] font-bold text-slate-300">🛵 Modalidad y Costo de Envío</label>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setConfigRestaurante({ ...configRestaurante, envioGratis: true, costoEnvio: '0' })}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                  configRestaurante.envioGratis
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60'
                    : 'bg-[#0e1b26] text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                🛵 Envío Gratis
              </button>
              <button
                type="button"
                onClick={() => setConfigRestaurante({ ...configRestaurante, envioGratis: false })}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                  !configRestaurante.envioGratis
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/60'
                    : 'bg-[#0e1b26] text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                💵 Envío con Costo
              </button>
            </div>

            {!configRestaurante.envioGratis && (
              <div className="max-w-xs">
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Costo de Envío ($ MXN)</label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={configRestaurante.costoEnvio}
                  onChange={(e) => setConfigRestaurante({ ...configRestaurante, costoEnvio: e.target.value })}
                  placeholder="Ej. 25.00"
                  required
                  className="w-full px-3.5 py-2 bg-[#0e1b26] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={guardandoConfig || procesandoLogo}
            className="neon-btn-orange text-white font-black px-5 py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
          >
            {guardandoConfig ? 'Guardando...' : 'Guardar Perfil del Restaurante 💾'}
          </button>
        </form>
      </div>

      {/* Tarjeta Verde Agua Claro: Configuración de Cuenta para Transferencias */}
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

      {/* Comandas y Pedidos en Tiempo Real en Verde Agua Claro */}
      <div
        className="bg-[#d7eee7] text-[#0f172a] p-5 sm:p-6 rounded-2xl border-2 border-emerald-300/80 space-y-4"
        style={{ boxShadow: '0 0 22px rgba(16, 185, 129, 0.22), 0 14px 30px rgba(0, 0, 0, 0.6)' }}
      >
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-emerald-900/15 pb-3">
          <h3 className="text-sm sm:text-base font-black text-[#0f172a] flex items-center gap-2">
            <span>🕒</span>
            <span>Comandas y Pedidos en Tiempo Real</span>
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

          {/* Columna Recibidos */}
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
                      <p className="text-emerald-700 font-bold truncate">📍 {ped.direccionCliente || "Sin dirección"}</p>
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

          {/* Columna En Preparación */}
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
              pedidosEnPreparacion.map(ped => (
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
                    <p className="text-emerald-700 font-bold truncate">📍 {ped.direccionCliente || "Sin dirección"}</p>
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
                    onClick={() => cambiarEstadoPedido(ped.id, 'HACIA_DOMICILIO')}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black py-1.5 rounded-full transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                  >
                    Enviar a Domicilio 🛵
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Columna Hacia el Domicilio */}
          <div
            className="bg-[#123c33] text-white p-3.5 rounded-2xl border-2 border-emerald-400/65 space-y-2.5 min-w-0"
            style={{ boxShadow: '0 0 16px rgba(16, 185, 129, 0.22)' }}
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/15">
              <span className="font-black text-emerald-200 text-xs flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
                <span>Hacia el Domicilio</span>
              </span>
              <span className="bg-emerald-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black shadow-[0_0_10px_rgba(52,211,153,0.6)]">
                {pedidosHaciaDomicilio.length}
              </span>
            </div>

            {pedidosHaciaDomicilio.length === 0 ? (
              <p className="text-[11px] text-emerald-100/70 text-center py-6 font-medium">Sin pedidos en este estado</p>
            ) : (
              pedidosHaciaDomicilio.map(ped => (
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
                    <p className="text-emerald-700 font-bold truncate">📍 {ped.direccionCliente || "Sin dirección"}</p>
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
              ))
            )}
          </div>

        </div>
      </div>

      {/* Desglose de Ventas del Día */}
      <div className="neon-amber-card bg-[#0e1b26] p-5 sm:p-6 rounded-2xl space-y-3.5">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <span className="icon-3d-pod w-8 h-8 rounded-xl flex items-center justify-center text-base">📊</span>
          <span>Desglose de Ventas del Día por Producto</span>
        </h3>
        {listaProductosVendidos.length === 0 ? (
          <div className="bg-[#070e14] p-6 rounded-xl text-center border border-dashed border-white/15">
            <p className="text-xs text-slate-400 font-medium">Aún no hay ventas completadas hoy.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Producto / Platillo</th>
                  <th className="py-2.5 px-3 text-center">Cantidad Vendida</th>
                  <th className="py-2.5 px-3 text-right">Total Generado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-xs font-medium">
                {listaProductosVendidos.map((item, index) => (
                  <tr key={index} className="hover:bg-white/5 transition">
                    <td className="py-2.5 px-3 font-bold text-white">🍔 {item.nombre}</td>
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

      {/* Formulario Registrar / Editar Platillo */}
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

      {/* Menú Publicado Actual */}
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
                    onClick={() => handleEliminarProducto(prod.id, prod.nombre)}
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
  );
}

export default PanelRestaurante;
