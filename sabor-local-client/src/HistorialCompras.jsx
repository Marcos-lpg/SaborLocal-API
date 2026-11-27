import { useState, useEffect, useRef } from 'react';
import api from './ApiClient';

const formatearEstadoHistorial = (estadoRaw) => {
  const st = String(estadoRaw || 'RECIBIDO').toUpperCase().trim();
  if (st === 'RECIBIDO' || st === 'PENDIENTE') return 'Recibido';
  if (st === 'EN_PREPARACION' || st === 'PREPARANDO') return 'En preparación';
  if (st === 'HACIA_DOMICILIO') return 'Hacia tu domicilio';
  if (st === 'COMPLETADO' || st === 'ENTREGADO') return 'Completado';
  if (st === 'CANCELADO') return 'Cancelado';
  return estadoRaw || 'Recibido';
};

function HistorialCompras({ comercios = [], onSeleccionarRestaurante, onVolver, onCalificacionGuardada }) {
  const [historial, setHistorial] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [pedidoDetalle, setPedidoDetalle] = useState(null);
  const [calificacionesForm, setCalificacionesForm] = useState({});
  const [enviandoId, setEnviandoId] = useState(null);

  const comerciosRef = useRef(comercios);
  comerciosRef.current = comercios;

  const historialRef = useRef([]);
  const cargandoRef = useRef(false);

  const consolidarPorRestaurante = (lista) => {
    const porComercio = new Map();

    const ordenados = [...lista].sort(
      (a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0)
    );

    ordenados.forEach((item) => {
      const comercioKey = String(
        item.tenantId ??
          item.comercioId ??
          item.restauranteId ??
          item.idComercio ??
          (item.nombreComercio || '').trim().toLowerCase()
      );

      if (!comercioKey) return;

      const existente = porComercio.get(comercioKey);
      if (!existente) {
        porComercio.set(comercioKey, item);
      } else {
        const fechaActual = new Date(item.fechaCreacion || 0).getTime();
        const fechaGuardada = new Date(existente.fechaCreacion || 0).getTime();
        if (fechaActual >= fechaGuardada) {
          porComercio.set(comercioKey, item);
        }
      }
    });

    return Array.from(porComercio.values()).sort(
      (a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0)
    );
  };

  const construirFirmaHistorial = (lista) => {
    return JSON.stringify(
      (lista || []).map((item) => ({
        tenantId: item.tenantId,
        idVisual: item.idVisual,
        estado: item.estado,
        total: Number(item.total || 0),
        fechaCreacion: item.fechaCreacion,
        nombreComercio: item.nombreComercio
      }))
    );
  };

  const aplicarHistorialSiCambio = (nuevaLista) => {
    const firmaAnterior = construirFirmaHistorial(historialRef.current);
    const firmaNueva = construirFirmaHistorial(nuevaLista);
    if (firmaAnterior !== firmaNueva) {
      historialRef.current = nuevaLista;
      setHistorial(nuevaLista);
      try {
        localStorage.setItem('mis_pedidos', JSON.stringify(nuevaLista));
      } catch {
        // Ignorar error de almacenamiento
      }
    }
  };

  const cargarHistorial = async ({ mostrarCargando = false } = {}) => {
    if (cargandoRef.current) return;
    cargandoRef.current = true;

    if (mostrarCargando) {
      setLoading(true);
    }
    setErrorMsg('');

    const telefonoGuardado = (localStorage.getItem('clienteTelefono') || '').trim();
    const catalogoComercios = comerciosRef.current || [];

    const obtenerLocales = () => {
      const posiblesClaves = ['mis_pedidos', 'historial_compras', 'pedidos_cliente', 'pedidos'];
      for (const clave of posiblesClaves) {
        try {
          const raw = localStorage.getItem(clave);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch {
          // Ignorar JSON mal formado
        }
      }
      return [];
    };

    const locales = obtenerLocales();

    try {
      let apiPedidos = [];
      try {
        const resMiHistorial = await api.get('/pedidos/mi-historial', {
          params: telefonoGuardado ? { telefono: telefonoGuardado } : {},
          timeout: 2200
        });
        apiPedidos = Array.isArray(resMiHistorial.data) ? resMiHistorial.data : [];
      } catch {
        const res = await api.get('/pedidos', { timeout: 2200 });
        const todos = Array.isArray(res.data) ? res.data : [];
        apiPedidos = telefonoGuardado
          ? todos.filter((p) => p.telefonoCliente === telefonoGuardado)
          : [];
      }

      const mapaPedidos = new Map();

      locales.forEach((loc, idx) => {
        const key = loc.pedidoId || loc.id || loc.codigo || `local-${idx}`;
        mapaPedidos.set(String(key), {
          ...loc,
          pedidoId: loc.pedidoId || loc.id || loc.codigo || `ORD-${idx + 1}`,
          idVisual: loc.pedidoId || loc.id || loc.codigo || `ORD-${idx + 1}`,
          tenantId: loc.tenantId || loc.comercioId || loc.restauranteId || loc.idComercio || 1,
          nombreComercio: loc.nombreComercio || loc.comercioNombre || loc.restaurante || 'Comercio',
          total: loc.total ?? loc.montoTotal ?? 0,
          fechaCreacion: loc.fechaCreacion || loc.fecha || new Date().toISOString(),
          estado: loc.estado || 'RECIBIDO',
          direccionComercio: loc.direccionComercio || loc.direccion || 'Candelaria, Campeche',
          telefonoComercio: loc.telefonoComercio || loc.telefono || 'Sin teléfono',
          detalles: loc.detalles || []
        });
      });

      apiPedidos.forEach((p, idx) => {
        const rawId = p.pedidoId || p.id || idx + 1;
        const key = String(rawId);
        const previo = mapaPedidos.get(key) || {};
        const restoInfo = catalogoComercios.find((c) => Number(c.id) === Number(p.tenantId)) || {};
        mapaPedidos.set(key, {
          ...previo,
          pedidoId: rawId,
          idVisual:
            String(rawId).startsWith('ORD-') || String(rawId).startsWith('local-')
              ? String(rawId)
              : `ORD-${rawId}`,
          tenantId: p.tenantId || previo.tenantId || 1,
          nombreComercio:
            p.nombreComercio ||
            previo.nombreComercio ||
            restoInfo.nombreComercio ||
            `Restaurante #${p.tenantId || 1}`,
          direccionComercio:
            p.direccionComercio ||
            previo.direccionComercio ||
            restoInfo.direccion ||
            'Candelaria, Campeche',
          telefonoComercio:
            p.telefonoComercio ||
            previo.telefonoComercio ||
            restoInfo.telefono ||
            restoInfo.telefonoComercio ||
            'Sin teléfono',
          total: p.total ?? previo.total ?? 0,
          estado: p.estado || previo.estado || 'RECIBIDO',
          fechaCreacion: p.fechaCreacion || previo.fechaCreacion || new Date().toISOString(),
          calificacion: p.calificacion ?? previo.calificacion ?? null,
          comentarioCalificacion: p.comentarioCalificacion ?? previo.comentarioCalificacion ?? '',
          detalles: p.detalles || previo.detalles || []
        });
      });

      const listaConsolidada = consolidarPorRestaurante(Array.from(mapaPedidos.values()));
      aplicarHistorialSiCambio(listaConsolidada);
    } catch {
      const listaLocal = locales.map((loc, idx) => {
        const rawId = loc.pedidoId || loc.id || loc.codigo || `ORD-${idx + 1}`;
        return {
          ...loc,
          pedidoId: rawId,
          idVisual: rawId,
          tenantId: loc.tenantId || loc.comercioId || loc.restauranteId || loc.idComercio || 1,
          nombreComercio: loc.nombreComercio || loc.comercioNombre || loc.restaurante || 'Comercio',
          total: loc.total ?? loc.montoTotal ?? 0,
          fechaCreacion: loc.fechaCreacion || loc.fecha || new Date().toISOString(),
          estado: loc.estado || 'RECIBIDO',
          direccionComercio: loc.direccionComercio || loc.direccion || 'Candelaria, Campeche',
          telefonoComercio: loc.telefonoComercio || loc.telefono || 'Sin teléfono',
          detalles: loc.detalles || []
        };
      });
      aplicarHistorialSiCambio(consolidarPorRestaurante(listaLocal));
    } finally {
      cargandoRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarHistorial({ mostrarCargando: true });
    const intervalo = setInterval(() => {
      cargarHistorial({ mostrarCargando: false });
    }, 5000);

    return () => clearInterval(intervalo);
  }, []);

  const enviarCalificacionHistorial = async (pedidoId) => {
    const estrellas = calificacionesForm[pedidoId]?.estrellas || 0;
    const comentario = calificacionesForm[pedidoId]?.comentario || '';
    if (!estrellas) {
      alert('Selecciona de 1 a 5 estrellas.');
      return;
    }

    setEnviandoId(pedidoId);
    try {
      await api.put(`/pedidos/${pedidoId}/calificar`, {
        calificacion: estrellas,
        comentario
      });
      setHistorial((prev) =>
        prev.map((item) =>
          item.pedidoId === pedidoId
            ? { ...item, calificacion: estrellas, comentarioCalificacion: comentario }
            : item
        )
      );
      if (onCalificacionGuardada) onCalificacionGuardada();
    } catch (err) {
      console.error('Error al calificar desde historial:', err);
      alert('No se pudo guardar tu calificación en el servidor.');
    } finally {
      setEnviandoId(null);
    }
  };

  const historialFiltrado = historial.filter((item) =>
    (item.nombreComercio || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const abrirRestauranteDesdePedido = (item) => {
    const comercioEncontrado = (comerciosRef.current || []).find(
      (c) => Number(c.id) === Number(item.tenantId)
    );
    const objetoComercio = comercioEncontrado || {
      id: item.tenantId || 1,
      nombreComercio: item.nombreComercio || 'Restaurante Local',
      direccion: item.direccionComercio || 'Candelaria, Campeche',
      telefono: item.telefonoComercio || 'Sin teléfono',
      categoria: 'Candelaria'
    };

    if (onSeleccionarRestaurante) {
      onSeleccionarRestaurante(objetoComercio);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10 text-slate-100">
      <div className="neon-amber-card bg-gradient-to-r from-[#0d1f2a] via-[#122836] to-[#0d1f2a] px-5 sm:px-6 py-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3.5">
          <div className="icon-3d-pod w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0">
            🧾
          </div>
          <div className="space-y-0.5">
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-xs">
              Mi Historial de Compras
            </h2>
            <p className="text-xs text-slate-300 font-medium">
              Consulta los restaurantes donde has comprado, revisa su información o vuelve a pedir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => cargarHistorial({ mostrarCargando: false })}
            className="text-xs bg-[#122332] hover:bg-[#193044] text-slate-200 px-3.5 py-2 rounded-xl font-bold transition border border-white/15 cursor-pointer"
          >
            🔄 Actualizar
          </button>
          {onVolver && (
            <button
              type="button"
              onClick={onVolver}
              className="neon-btn-orange text-xs text-white px-4 py-2 rounded-xl font-black transition cursor-pointer"
            >
              ← Explorar Comercios
            </button>
          )}
        </div>
      </div>

      <div className="neon-search-bar rounded-full px-4 py-2.5 flex items-center gap-2.5">
        <span className="text-cyan-300 text-xs drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]">🔍</span>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar restaurante en tu historial..."
          className="w-full bg-transparent text-xs text-white placeholder:text-sky-200/80 focus:outline-none font-semibold"
        />
      </div>

      {loading ? (
        <div className="neon-amber-card bg-[#0e1b26] p-10 rounded-2xl text-center space-y-2">
          <div className="animate-spin text-2xl">🧾</div>
          <p className="text-xs text-slate-400 font-semibold">Cargando tu historial de pedidos...</p>
        </div>
      ) : errorMsg ? (
        <div className="neon-amber-card bg-[#0e1b26] border-red-400/40 p-8 rounded-2xl text-center text-xs text-red-200 font-bold">
          {errorMsg}
        </div>
      ) : historialFiltrado.length === 0 ? (
        <div className="neon-amber-card bg-[#0e1b26] p-10 rounded-2xl text-center space-y-2.5">
          <div className="icon-3d-pod w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-3xl">
            🛍️
          </div>
          <h3 className="text-sm font-black text-white">No hay compras registradas todavía</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Cuando realices un pedido en cualquier restaurante de Sabor Local, aparecerá aquí con sus datos y opciones para volver a ordenar.
          </p>
          {onVolver && (
            <button
              type="button"
              onClick={onVolver}
              className="neon-btn-orange mt-2 text-white text-xs font-black px-4 py-2 rounded-full transition cursor-pointer"
            >
              Ir a ver restaurantes
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {historialFiltrado.map((item) => {
            const estadoUpper = String(item.estado || 'RECIBIDO').toUpperCase().trim();
            const estadoTexto = formatearEstadoHistorial(item.estado);

            return (
              <div
                key={`comercio-${item.tenantId}-${item.idVisual}`}
                className="neon-amber-card bg-gradient-to-b from-[#152736] to-[#0c1822] p-5 rounded-2xl flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-amber-200 bg-[#070e14] border border-white/15 px-2.5 py-0.5 rounded-full">
                      {item.idVisual}
                    </span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-md font-extrabold ${
                        estadoUpper === 'COMPLETADO' || estadoUpper === 'ENTREGADO'
                          ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.6)]'
                          : estadoUpper === 'CANCELADO'
                          ? 'bg-red-600 text-white'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-400/35'
                      }`}
                    >
                      {estadoTexto}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-white leading-snug">
                      🏪 {item.nombreComercio}
                    </h3>
                    <p className="text-[11px] text-slate-300 mt-1">
                      📍 {item.direccionComercio || 'Candelaria, Campeche'}
                    </p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      📞 {item.telefonoComercio || 'Sin teléfono'}
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-2.5 border-t border-white/10 text-xs gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">
                      📅{' '}
                      {new Date(item.fechaCreacion).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="text-sm font-black text-amber-400 whitespace-nowrap">
                      ${Number(item.total || 0).toFixed(2)} MXN
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPedidoDetalle(item)}
                    className="flex-1 bg-[#122332] hover:bg-[#193044] text-slate-200 font-bold py-2 px-3 rounded-xl text-xs transition border border-white/15 cursor-pointer"
                  >
                    Ver Detalles
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirRestauranteDesdePedido(item)}
                    className="neon-btn-orange flex-1 text-white font-black py-2 px-3 rounded-full text-xs transition cursor-pointer"
                  >
                    Ir al Restaurante →
                  </button>
                </div>

                {item.estado === 'COMPLETADO' && typeof item.pedidoId === 'number' && (
                  <div className="pt-1">
                    {item.calificacion ? (
                      <div className="bg-emerald-500/15 border border-emerald-400/35 rounded-xl px-3 py-2 text-[11px] text-emerald-300 font-bold flex items-center justify-between">
                        <span>Tu calificación:</span>
                        <span className="text-amber-300">
                          {'★'.repeat(item.calificacion)}{'☆'.repeat(5 - item.calificacion)} ({item.calificacion}/5)
                        </span>
                      </div>
                    ) : (
                      <div className="bg-[#070e14] border border-amber-400/35 rounded-xl p-3 space-y-2">
                        <p className="text-[11px] font-black text-amber-200">⭐ Califica este pedido:</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() =>
                                setCalificacionesForm((prev) => ({
                                  ...prev,
                                  [item.pedidoId]: { ...(prev[item.pedidoId] || {}), estrellas: num }
                                }))
                              }
                              className={`text-xl cursor-pointer transition hover:scale-110 ${
                                num <= (calificacionesForm[item.pedidoId]?.estrellas || 0)
                                  ? 'text-amber-400'
                                  : 'text-slate-600'
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={enviandoId === item.pedidoId || !(calificacionesForm[item.pedidoId]?.estrellas)}
                          onClick={() => enviarCalificacionHistorial(item.pedidoId)}
                          className="neon-btn-orange w-full disabled:opacity-40 text-white font-black py-1.5 rounded-full text-[11px] transition cursor-pointer"
                        >
                          {enviandoId === item.pedidoId ? 'Enviando...' : 'Enviar Calificación ⭐'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pedidoDetalle && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="neon-amber-card bg-[#0e1b26] rounded-2xl max-w-md w-full p-6 space-y-4 text-slate-100">
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-300">{pedidoDetalle.idVisual}</span>
                <h3 className="text-base font-black text-white mt-0.5">{pedidoDetalle.nombreComercio}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPedidoDetalle(null)}
                className="w-7 h-7 rounded-full bg-[#172836] hover:bg-[#1f3446] text-slate-200 font-bold text-xs flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#070e14] p-3.5 rounded-xl border border-white/10 space-y-1 text-xs">
              <p className="text-slate-300">
                <strong className="text-white">Estado:</strong> {formatearEstadoHistorial(pedidoDetalle.estado)}
              </p>
              <p className="text-slate-300">
                <strong className="text-white">Dirección del local:</strong> {pedidoDetalle.direccionComercio || 'Candelaria, Campeche'}
              </p>
              <p className="text-slate-300">
                <strong className="text-white">Teléfono:</strong> {pedidoDetalle.telefonoComercio || 'Sin teléfono'}
              </p>
            </div>

            {pedidoDetalle.detalles && pedidoDetalle.detalles.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-extrabold text-white">Platillos ordenados:</p>
                <div className="bg-[#070e14] p-3 rounded-xl border border-white/10 space-y-1 text-xs">
                  {pedidoDetalle.detalles.map((d, i) => (
                    <div key={i} className="flex justify-between text-slate-200 font-medium">
                      <span>{d.cantidad}x {d.nombreProducto}</span>
                      <span className="font-bold text-amber-400">${((d.precio || 0) * (d.cantidad || 1)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-xs font-bold text-slate-400">Total pagado</span>
              <span className="text-base font-black text-amber-400">
                ${Number(pedidoDetalle.total || 0).toFixed(2)} MXN
              </span>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPedidoDetalle(null)}
                className="flex-1 bg-[#172836] hover:bg-[#1f3446] text-slate-200 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pedidoDetalle;
                  setPedidoDetalle(null);
                  abrirRestauranteDesdePedido(target);
                }}
                className="neon-btn-orange flex-1 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Volver a Pedir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistorialCompras;
