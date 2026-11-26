import { useState, useEffect } from 'react';
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
    const bancoGuardado = localStorage.getItem(`banco_${idReal}`);
    if (bancoGuardado) {
      setDatosBanco(JSON.parse(bancoGuardado));
    }
  }, [idReal]);

  const guardarDatosBanco = (e) => {
    e.preventDefault();
    localStorage.setItem(`banco_${idReal}`, JSON.stringify(datosBanco));
    setMensaje("🏦 Datos bancarios actualizados correctamente para tus clientes.");
    setTimeout(() => setMensaje(null), 4000);
  };

  const cargarDatosRestaurante = async () => {
    try {
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

      const resPedidos = await api.get('/pedidos');
      const listaPedidos = resPedidos.data || [];

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
  const pedidosCompletados = pedidos.filter(p => p.estado === 'COMPLETADO');

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
          <div className="icon-3d-pod w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0">
            👨‍🍳
          </div>
          <div>
            <h2 className="text-2xl sm:text-[28px] font-black text-white leading-tight drop-shadow-xs">
              {tituloNegocio}
            </h2>
            <p className="text-[11px] text-amber-200/85 font-extrabold uppercase tracking-wider mt-0.5">
              GESTIÓN DE OPERACIONES
            </p>
          </div>
        </div>

        <div className="relative z-10 px-4 sm:pr-6 py-3 sm:py-0 flex items-center justify-end">
          <div
            className="bg-[#1b1914]/95 border-2 border-amber-300 px-5 py-2.5 rounded-2xl text-center w-full sm:w-auto min-w-[180px]"
            style={{ boxShadow: '0 0 24px rgba(251, 191, 36, 0.65), 0 8px 18px rgba(0, 0, 0, 0.55)' }}
          >
            <p className="text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <span>💰</span>
              <span>VENTAS DEL DÍA</span>
            </p>
            <p className="text-xl sm:text-2xl font-black text-white leading-tight mt-0.5">
              ${ventasDelDiaTotal.toFixed(2)}{' '}
              <span className="text-[10px] font-extrabold text-amber-200">MXN</span>
            </p>
            <p className="text-[10px] text-amber-100/90 font-semibold mt-0.5">
              {pedidosCompletados.length} órdenes completadas
            </p>
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
