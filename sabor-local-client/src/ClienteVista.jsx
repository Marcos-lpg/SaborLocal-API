import { useState, useEffect, useRef } from 'react';
import api from './ApiClient';

function ClienteVista({
  comercio,
  servidorActivo = true,
  onPerderConexion = () => {},
  onRecuperarConexion = () => {},
  onCalificacionGuardada
}) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const [carrito, setCarrito] = useState(() => leerCarritoGuardado(comercio?.id));
  const [modalCheckout, setModalCheckout] = useState(false);
  const comercioCargadoRef = useRef(comercio?.id);

  const enLinea = Boolean(servidorActivo) && navigator.onLine;
  const estaAbierto = comercio?.estaAbierto !== false;
  const envioGratis = comercio?.envioGratis !== false || !(Number(comercio?.costoEnvio) > 0);
  const costoEnvio = envioGratis ? 0 : Number(comercio?.costoEnvio || 0);

  const [nombreCliente, setNombreCliente] = useState(() => {
    try {
      const s = sessionStorage.getItem('saborlocal_sesion_tab') || localStorage.getItem('saborlocal_sesion_offline');
      return s ? (JSON.parse(s)?.nombre || '') : '';
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
  const [datosBancoRestaurante, setDatosBancoRestaurante] = useState(null);
  const [mensajeRevision, setMensajeRevision] = useState(false);

  const [pedidoEnviado, setPedidoEnviado] = useState(false);
  const [misPedidos, setMisPedidos] = useState([]);
  const [calificacionesForm, setCalificacionesForm] = useState({});
  const [hoverEstrella, setHoverEstrella] = useState({});
  const [enviandoCalificacionId, setEnviandoCalificacionId] = useState(null);
  const [pedidosCalificadosLocal, setPedidosCalificadosLocal] = useState({});

  useEffect(() => {
    if (comercio?.id && comercioCargadoRef.current !== comercio.id) {
      comercioCargadoRef.current = comercio.id;
      setCarrito(leerCarritoGuardado(comercio.id));
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
      const sinDuplicado = directorioActual.filter(c => c.id !== datosComercio.id);
      localStorage.setItem('directorio_offline', JSON.stringify([ficha, ...sinDuplicado]));
    } catch (e) {
      console.error('Error al guardar en caché local:', e);
    }
  };

  useEffect(() => {
    const bancoResto = localStorage.getItem(`banco_${comercio.id}`) ||
                       localStorage.getItem(`banco_1`) ||
                       localStorage.getItem('banco_Noche buena');

    if (bancoResto) {
      setDatosBancoRestaurante(JSON.parse(bancoResto));
    } else {
      setDatosBancoRestaurante({
        banco: "Azteca",
        numeroCuenta: "4212 1212 3421 2345",
        titular: "Marcos Lopez"
      });
    }

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

  useEffect(() => {
    const verificarEstatusPedidos = async () => {
      if (!telefonoCliente || !enLinea) return;
      try {
        const res = await api.get('/pedidos', {
          timeout: 1800,
          headers: { 'Cache-Control': 'no-cache' }
        });
        onRecuperarConexion();
        const mios = (res.data || []).filter(p =>
          p.telefonoCliente === telefonoCliente &&
          p.tenantId === comercio.id &&
          p.estado !== 'CANCELADO' &&
          (p.estado !== 'COMPLETADO' || !p.calificacion || pedidosCalificadosLocal[p.id])
        );
        setMisPedidos(mios);
      } catch {
        onPerderConexion();
      }
    };

    verificarEstatusPedidos();
    const interval = setInterval(verificarEstatusPedidos, 4000);
    return () => clearInterval(interval);
  }, [telefonoCliente, comercio.id, enLinea, pedidosCalificadosLocal]);

  const enviarCalificacion = async (pedidoId) => {
    const form = calificacionesForm[pedidoId] || { estrellas: 0, comentario: '' };
    if (!form.estrellas || form.estrellas < 1 || form.estrellas > 5) {
      alert("Por favor selecciona de 1 a 5 estrellas para calificar al restaurante.");
      return;
    }

    setEnviandoCalificacionId(pedidoId);
    try {
      await api.put(`/pedidos/${pedidoId}/calificar`, {
        calificacion: form.estrellas,
        comentario: form.comentario || ''
      });

      setPedidosCalificadosLocal(prev => ({ ...prev, [pedidoId]: form.estrellas }));
      setMisPedidos(prev =>
        prev.map(p => (p.id === pedidoId ? { ...p, calificacion: form.estrellas, comentarioCalificacion: form.comentario } : p))
      );

      if (onCalificacionGuardada) {
        onCalificacionGuardada();
      }
    } catch (err) {
      console.error("Error al enviar calificación:", err);
      alert("No se pudo enviar tu calificación. Intenta nuevamente.");
    } finally {
      setEnviandoCalificacionId(null);
    }
  };

  const agregarAlCarrito = (producto) => {
    if (enLinea && !estaAbierto) {
      alert("Este restaurante se encuentra cerrado en este momento.");
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

  const cambiarCantidad = (id, delta) => {
    setCarrito(carrito.map(item => {
      if (item.id === id) {
        const nuevaCantidad = item.cantidad + delta;
        return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const vaciarCarrito = () => {
    setCarrito([]);
    if (comercio?.id) {
      localStorage.removeItem(obtenerClaveCarrito(comercio.id));
    }
  };

  const calcularSubtotal = () => {
    return carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0);
  };

  const calcularTotal = () => {
    const subtotal = calcularSubtotal();
    const total = subtotal + (carrito.length > 0 ? costoEnvio : 0);
    return total.toFixed(2);
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
      const nuevoRegistro = {
        pedidoId: dataApi?.id || dataApi?.pedidoId || `ORD-${Date.now()}`,
        tenantId: comercio.id,
        nombreComercio: comercio.nombreComercio,
        direccionComercio: comercio.direccion || '',
        telefonoComercio: comercio.telefono || comercio.telefonoComercio || '',
        total: pedidoPayload.total,
        estado: dataApi?.estado || pedidoPayload.estado || 'RECIBIDO',
        fechaCreacion: new Date().toISOString()
      };
      const previos = JSON.parse(localStorage.getItem('mis_pedidos') || '[]');
      localStorage.setItem('mis_pedidos', JSON.stringify([nuevoRegistro, ...previos]));
    } catch (e) {
      console.error(e);
    }
  };

  const realizarPedido = async (e) => {
    e.preventDefault();
    if (!enLinea) {
      alert("Sin conexión con el servidor. Los pedidos en línea se restablecerán hasta que vuelva la conexión.");
      return;
    }
    if (!estaAbierto) {
      alert("Este restaurante acaba de cerrar sus ventas por hoy.");
      return;
    }

    if (!nombreCliente || !telefonoCliente || !direccionCliente) {
      alert("Por favor completa tu nombre, teléfono y dirección de entrega.");
      return;
    }

    if (metodoPago === 'Transferencia Bancaria') {
      if (cargandoImagen) {
        alert("La imagen se está procesando. Espera un segundo por favor.");
        return;
      }
      if (!comprobanteBase64) {
        alert("Por favor selecciona la imagen de tu comprobante de transferencia.");
        return;
      }
    }

    setPedidoEnviado(true);

    if (metodoPago === 'Transferencia Bancaria') {
      setMensajeRevision(true);
    }

    const pedidoPayload = {
      tenantId: comercio.id,
      clienteNombre: nombreCliente,
      telefonoCliente: telefonoCliente,
      direccionCliente: direccionCliente,
      metodoPago: metodoPago,
      cambioPara: cambioPara || "Exacto",
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
        setPedidoEnviado(false);
        setMensajeRevision(false);
        vaciarCarrito();
        setNombreCliente('');
        setDireccionCliente('');
        setCambioPara('');
        setComprobanteBase64('');
        setNombreArchivo('');
        alert("¡Pedido realizado con éxito! El restaurante ya lo recibió en su panel.");
      }, 2500);

    } catch (err) {
      console.error("Error al enviar el pedido:", err);
      onPerderConexion();
      alert("Hubo un error al procesar tu pedido o se detuvo el servidor. Los pedidos en línea se restablecerán cuando vuelva la conexión.");
      setPedidoEnviado(false);
      setMensajeRevision(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10 text-slate-100">

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

      {/* Encabezado Neón del Comercio */}
      <div className="neon-amber-card rounded-2xl bg-gradient-to-r from-[#0f202d] via-[#132938] to-[#0f202d] p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {!enLinea ? (
              <span className="inline-block bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
                🟡 GUARDADO
              </span>
            ) : estaAbierto ? (
              <span className="inline-block bg-emerald-500 text-white px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.65)]">
                🟢 ABIERTO
              </span>
            ) : (
              <span className="inline-block bg-red-600 text-white px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(220,38,38,0.55)]">
                🔴 CERRADO
              </span>
            )}
            <span className="inline-flex items-center gap-1 bg-[#070e14] border border-amber-400/35 text-amber-300 px-2.5 py-0.5 rounded-full text-[11px] font-black">
              <span>⭐</span>
              <span>
                {Number(comercio.totalCalificaciones || 0) > 0
                  ? `${Number(comercio.calificacionPromedio || 0).toFixed(1)} (${comercio.totalCalificaciones})`
                  : 'Sin calificaciones'}
              </span>
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight drop-shadow-xs">
            {comercio.nombreComercio}
          </h2>
          <div className="flex flex-wrap gap-3 text-xs text-slate-300 font-medium">
            <span>📍 {comercio.direccion || "Candelaria, Campeche"}</span>
            <span>📞 {comercio.telefono || comercio.telefonoComercio || "Sin teléfono"}</span>
            <span>🕒 {comercio.horarioAtencion || "Lun - Dom: 9:00 AM - 10:00 PM"}</span>
            <span className="bg-[#070e14] px-2.5 py-0.5 rounded-lg border border-white/15 font-bold">
              ⏱️ {comercio.tiempoPreparacion || "25-40 min"}
            </span>
            <span className={`px-2.5 py-0.5 rounded-lg border font-bold ${
              envioGratis
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                : 'bg-orange-500/15 text-orange-300 border-orange-400/35'
            }`}>
              🛵 {envioGratis ? 'Envío gratis' : `Envío $${costoEnvio.toFixed(2)} MXN`}
            </span>
            {comercio.categoria && <span>🍔 {comercio.categoria}</span>}
          </div>
        </div>

        <div className="icon-3d-pod w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-4xl shrink-0 border-2 border-amber-400/60">
          {comercio.logoUrl ? (
            <img src={comercio.logoUrl} alt={`Logo ${comercio.nombreComercio}`} className="w-full h-full object-cover" />
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
              Puedes consultar el menú y horarios ({comercio.horarioAtencion || "Lun - Dom: 9:00 AM - 10:00 PM"}). Los pedidos se habilitarán cuando inicie sus ventas.
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
            {misPedidos.map(p => {
              const formCalif = calificacionesForm[p.id] || { estrellas: 0, comentario: '' };
              const estrellaHover = hoverEstrella[p.id] || 0;
              const yaCalificado = Boolean(p.calificacion || pedidosCalificadosLocal[p.id]);
              const califFinal = p.calificacion || pedidosCalificadosLocal[p.id];

              return (
                <div key={p.id} className="bg-[#070e14] p-3.5 rounded-xl border border-white/10 space-y-2.5">
                  <div className="flex justify-between items-center text-xs gap-2">
                    <span className="font-extrabold text-white">ORD-{p.id}</span>
                    <span className={`px-2 py-0.5 rounded-md font-extrabold text-[9px] border ${
                      p.estado === 'COMPLETADO'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-400/35'
                    }`}>
                      {p.estado === 'COMPLETADO' ? '✅ ¡Pedido Completado!' : p.estado}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Total: <span className="font-black text-amber-400">${p.total?.toFixed(2)} MXN</span>
                  </p>

                  {p.estado === 'COMPLETADO' && (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      {yaCalificado ? (
                        <div className="bg-emerald-500/15 border border-emerald-400/35 rounded-xl p-2.5 text-[11px] text-emerald-300 font-bold flex items-center justify-between">
                          <span>🎉 ¡Gracias por calificar!</span>
                          <span className="text-amber-300">
                            {'★'.repeat(califFinal)}{'☆'.repeat(5 - califFinal)} ({califFinal}/5)
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
                                  onMouseEnter={() => setHoverEstrella(prev => ({ ...prev, [p.id]: num }))}
                                  onMouseLeave={() => setHoverEstrella(prev => ({ ...prev, [p.id]: 0 }))}
                                  onClick={() =>
                                    setCalificacionesForm(prev => ({
                                      ...prev,
                                      [p.id]: { ...(prev[p.id] || {}), estrellas: num }
                                    }))
                                  }
                                  className={`text-2xl transition transform hover:scale-110 cursor-pointer ${
                                    activo ? 'text-amber-400' : 'text-slate-600'
                                  }`}
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
                          <input
                            type="text"
                            value={formCalif.comentario || ''}
                            onChange={(e) =>
                              setCalificacionesForm(prev => ({
                                ...prev,
                                [p.id]: { ...(prev[p.id] || {}), comentario: e.target.value }
                              }))
                            }
                            placeholder="Comentario opcional sobre tu pedido..."
                            className="w-full px-3 py-1.5 bg-[#070e14] border border-white/15 rounded-xl text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <button
                            type="button"
                            disabled={enviandoCalificacionId === p.id || !formCalif.estrellas}
                            onClick={() => enviarCalificacion(p.id)}
                            className="neon-btn-orange w-full disabled:opacity-40 text-white font-black py-1.5 rounded-full text-[11px] transition cursor-pointer"
                          >
                            {enviandoCalificacionId === p.id ? 'Enviando calificación...' : 'Enviar Calificación ⭐'}
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

      {/* Grid Principal: Menú con Pod 3D + Carrito Neón */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-3.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">■</span>
              <span>Menú del Día y Platillos</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-200 bg-[#132534] border border-cyan-400/30 px-3 py-0.5 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.18)]">
              {productos.length} opciones disponibles
            </span>
          </div>

          {loading ? (
            <div className="neon-amber-card bg-[#0e1b26] p-12 rounded-2xl text-center space-y-2">
              <div className="animate-spin text-3xl">🍔</div>
              <p className="text-slate-400 text-xs font-semibold">Cargando platillos...</p>
            </div>
          ) : error && productos.length === 0 ? (
            <div className="neon-amber-card bg-[#0e1b26] p-8 rounded-2xl text-center space-y-1.5">
              <p className="text-3xl">📡</p>
              <h4 className="text-xs font-black text-white">Sin datos guardados</h4>
              <p className="text-slate-400 text-xs">{error}</p>
            </div>
          ) : productos.length === 0 ? (
            <div className="neon-amber-card bg-[#0e1b26] p-8 rounded-2xl text-center space-y-1.5">
              <p className="text-3xl">🍽️</p>
              <h4 className="text-xs font-black text-white">Menú en preparación</h4>
              <p className="text-slate-400 text-xs">Este establecimiento aún no ha publicado platillos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {productos.map((prod) => (
                <div
                  key={prod.id}
                  className="neon-amber-card bg-gradient-to-b from-[#152736] to-[#0c1822] rounded-2xl p-4 transition flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="icon-3d-pod relative h-32 w-full rounded-xl overflow-hidden flex items-center justify-center">
                      <span className={`absolute top-2 left-2 z-10 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${
                        !enLinea ? 'bg-amber-500 text-slate-950' : estaAbierto ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]' : 'bg-red-600'
                      }`}>
                        {!enLinea ? 'GUARDADO' : estaAbierto ? 'ABIERTO' : 'CERRADO'}
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
                      onClick={() => agregarAlCarrito(prod)}
                      disabled={enLinea && !estaAbierto}
                      className={`text-[11px] font-black px-3.5 py-1.5 rounded-full transition ${
                        enLinea && !estaAbierto
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'neon-btn-orange text-white cursor-pointer'
                      }`}
                    >
                      {enLinea && !estaAbierto ? 'Cerrado' : 'Agregar +'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Carrito Lateral Neón */}
        <div className="neon-amber-card bg-[#0e1b26] rounded-2xl sticky top-24 overflow-hidden">
          <div className="neon-btn-orange px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <span>Tu Pedido Actual</span>
              <span className="bg-black/30 text-amber-100 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {carrito.reduce((acc, item) => acc + item.cantidad, 0)} items
              </span>
            </h3>
            {carrito.length > 0 && (
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
            {carrito.length === 0 ? (
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
                    onClick={() => setModalCheckout(true)}
                    disabled={!enLinea || !estaAbierto}
                    className={`w-full font-black py-2.5 rounded-full transition text-xs flex items-center justify-center gap-2 ${
                      enLinea && estaAbierto
                        ? 'neon-btn-orange text-white cursor-pointer'
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

      {modalCheckout && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="neon-amber-card bg-[#0e1b26] rounded-2xl max-w-md w-full p-6 relative text-slate-100">
            <div className="text-center mb-4">
              <div className="icon-3d-pod w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-1">
                🛍️
              </div>
              <h3 className="text-lg font-black text-white">Finalizar Pedido</h3>
              <p className="text-xs text-slate-400">Ordenando en {comercio.nombreComercio}.</p>
            </div>

            {pedidoEnviado ? (
              <div className="py-8 text-center space-y-2.5">
                <div className="animate-spin text-3xl">🍔</div>
                <p className="font-bold text-xs text-amber-400">
                  {mensajeRevision ? "🛡️ Tu comprobante está en revisión (aprox. 8 min)..." : "Enviando orden al restaurante..."}
                </p>
              </div>
            ) : (
              <form onSubmit={realizarPedido} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Tu Nombre Completo</label>
                  <input type="text" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} required placeholder="Ej. Juan Pérez" className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Teléfono de Contacto</label>
                  <input type="tel" value={telefonoCliente} onChange={(e) => setTelefonoCliente(e.target.value)} required placeholder="Ej. 9381234567" className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Dirección de Entrega</label>
                  <input type="text" value={direccionCliente} onChange={(e) => setDireccionCliente(e.target.value)} required placeholder="Ej. Calle 10 x 21 y 23, Col. Centro" className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Método de Pago</label>
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  </select>
                </div>

                {metodoPago === 'Transferencia Bancaria' && (
                  <div className="bg-[#070e14] p-3.5 rounded-xl border border-white/10 space-y-2.5">
                    <div className="text-[11px] space-y-0.5">
                      <p className="font-extrabold text-amber-400">🏦 Datos para Transferencia:</p>
                      <p className="text-slate-300">Banco: <strong className="text-white">{datosBancoRestaurante?.banco || "Azteca"}</strong></p>
                      <p className="text-slate-300">Cuenta/CLABE: <strong className="text-white">{datosBancoRestaurante?.numeroCuenta || "4212 1212 3421 2345"}</strong></p>
                      <p className="text-slate-300">Titular: <strong className="text-white">{datosBancoRestaurante?.titular || "Marcos Lopez"}</strong></p>
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
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">¿Pagas con cuánto? (Cambio)</label>
                    <input type="text" value={cambioPara} onChange={(e) => setCambioPara(e.target.value)} placeholder="Ej. Billete de $200" className="w-full px-3.5 py-2 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                )}

                <div className="flex gap-2.5 pt-1.5">
                  <button type="button" onClick={() => setModalCheckout(false)} className="flex-1 bg-[#172836] hover:bg-[#1f3446] text-slate-200 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer">Cancelar</button>
                  <button
                    type="submit"
                    disabled={!enLinea || !estaAbierto}
                    className={`flex-1 font-black py-2.5 rounded-xl text-xs transition ${
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
