import { useState, useEffect } from 'react';
import api from './ApiClient';

function ClienteVista({ comercio }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [modalCheckout, setModalCheckout] = useState(false);

  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
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
      try {
        const res = await api.get(`/productos/comercio/${comercio.id}`);
        if (res.data && res.data.length > 0) {
          setProductos(res.data);
        } else {
          const resGeneral = await api.get('/productos');
          const filtrados = resGeneral.data.filter(p => 
            p.tenantId === comercio.id || p.tenantId === 1 || !p.tenantId
          );
          setProductos(filtrados);
        }
        setError(null);
      } catch (err) {
        try {
          const resGeneral = await api.get('/productos');
          setProductos(resGeneral.data);
        } catch (e) {
          setError("No se pudo cargar el menú de este comercio.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (comercio?.id) {
      cargarProductosDelComercio();
    }
  }, [comercio]);

  // CORRECCIÓN: Los pedidos activos se mantienen visibles hasta que su estado sea COMPLETADO o CANCELADO
  useEffect(() => {
    const verificarEstatusPedidos = async () => {
      if (!telefonoCliente) return;
      try {
        const res = await api.get('/pedidos');
        const mios = (res.data || []).filter(p => 
          p.telefonoCliente === telefonoCliente && 
          p.tenantId === comercio.id &&
          p.estado !== 'COMPLETADO' &&
          p.estado !== 'CANCELADO'
        );
        setMisPedidos(mios);
      } catch (e) {
        console.error("Error al verificar estatus:", e);
      }
    };

    const interval = setInterval(verificarEstatusPedidos, 4000);
    return () => clearInterval(interval);
  }, [telefonoCliente, comercio.id]);

  const agregarAlCarrito = (producto) => {
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

  const calcularTotal = () => {
    return carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0).toFixed(2);
  };

  // Compresor inteligente de imagen para que quepa perfecto en la base de datos de C#/.NET
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
          const MAX_WIDTH = 400; // Ancho máximo optimizado para comprobantes
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

          // Comprimimos a JPEG con calidad 0.7 para reducir el peso drásticamente
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
      console.log("Enviando pedido con comprobante comprimido...", pedidoPayload);

      const res = await api.post('/pedidos', pedidoPayload);
      guardarEnHistorial(pedidoPayload, res?.data);

      setTimeout(() => {
        setModalCheckout(false);
        setPedidoEnviado(false);
        setMensajeRevision(false);
        setCarrito([]);
        setNombreCliente('');
        setDireccionCliente('');
        setCambioPara('');
        setComprobanteBase64('');
        setNombreArchivo('');
        alert("¡Pedido realizado con éxito! El restaurante ya lo recibió en su panel.");
      }, 2500);

    } catch (err) {
      console.error("Error al enviar el pedido:", err);
      guardarEnHistorial(pedidoPayload, null);
      alert("Hubo un error al procesar tu pedido. Inténtalo de nuevo.");
      setPedidoEnviado(false);
      setMensajeRevision(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 text-slate-100">
      
      {/* HERO BANNER */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#121826] via-slate-900 to-[#121826] text-white shadow-2xl p-8 sm:p-10 border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none text-9xl flex items-center pr-10 select-none">
          🍔
        </div>
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            🟢 Establecimiento Abierto y Verificado
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{comercio.nombreComercio}</h2>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400 font-medium pt-1">
            <span className="flex items-center gap-1.5">📍 {comercio.direccion || "Candelaria, Campeche"}</span>
            <span className="flex items-center gap-1.5">📞 {comercio.telefono || comercio.telefonoComercio || "Sin teléfono"}</span>
            <span className="bg-orange-500/20 text-orange-400 px-3 py-0.5 rounded-lg border border-orange-500/30 font-bold">
              🏷️ {comercio.categoria || "Especialidades de la Casa"}
            </span>
          </div>
        </div>
      </div>

      {misPedidos.length > 0 && (
        <div className="bg-[#121826] border border-orange-500/30 p-6 rounded-3xl shadow-2xl space-y-4">
          <h3 className="text-sm font-black text-orange-400 flex items-center gap-2">
            <span>🔔</span> Estado de tus Pedidos Activos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {misPedidos.map(p => (
              <div key={p.id} className="bg-[#0b0f19] p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-white">ORD-{p.id}</span>
                  <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                    p.estado === 'RECIBIDO' || p.estado === 'PENDIENTE' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    p.estado === 'EN_PREPARACION' || p.estado === 'PREPARANDO' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse' :
                    p.estado === 'HACIA_DOMICILIO' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-bounce' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {p.estado === 'RECIBIDO' || p.estado === 'PENDIENTE' ? '🟡 Pedido Recibido (Revisando comprobante)' :
                     p.estado === 'EN_PREPARACION' || p.estado === 'PREPARANDO' ? '👨‍🍳 ¡Comida en Preparación!' :
                     p.estado === 'HACIA_DOMICILIO' ? '🚀 ¡En camino a tu domicilio!' : p.estado}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">Total: <span className="font-black text-orange-400">${p.total?.toFixed(2)} MXN</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <span>📜</span> Menú del Día y Platillos
            </h3>
            <span className="text-xs font-bold text-slate-400">{productos.length} opciones disponibles</span>
          </div>

          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="animate-spin text-3xl">🍔</div>
              <p className="text-slate-400 text-xs font-semibold">Cargando platillos deliciosos...</p>
            </div>
          ) : productos.length === 0 ? (
            <div className="bg-[#121826] p-12 rounded-3xl text-center border border-slate-800 shadow-2xl space-y-2">
              <p className="text-3xl">🍽️</p>
              <h4 className="text-base font-bold text-white">Menú en preparación</h4>
              <p className="text-slate-400 text-xs">Este establecimiento aún no ha publicado platillos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {productos.map((prod) => (
                <div key={prod.id} className="bg-[#121826] rounded-3xl p-5 border border-slate-800 hover:border-orange-500/50 shadow-2xl transition duration-300 flex flex-col justify-between group">
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-white text-base group-hover:text-orange-400 transition">{prod.nombre}</h4>
                    <p className="text-xs text-slate-400 font-medium line-clamp-2">{prod.descripcion || "Elaborado con ingredientes frescos de la región."}</p>
                  </div>
                  <div className="flex justify-between items-center mt-5 pt-3 border-t border-slate-800">
                    <span className="text-base font-black text-orange-400">${prod.precio.toFixed(2)} <span className="text-[10px] text-slate-500">MXN</span></span>
                    <button onClick={() => agregarAlCarrito(prod)} className="bg-slate-800 group-hover:bg-orange-600 text-slate-200 group-hover:text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition duration-300 shadow-md flex items-center gap-1.5 border border-slate-700">
                      <span>Agregar</span><span>+</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CARRITO */}
        <div className="bg-[#121826] p-6 rounded-3xl shadow-2xl border border-slate-800 sticky top-28 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white flex items-center gap-2"><span>🛒</span> Tu Pedido Actual</h3>
            <span className="bg-orange-500/20 text-orange-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-orange-500/30">{carrito.reduce((acc, item) => acc + item.cantidad, 0)} items</span>
          </div>

          {carrito.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-3xl">🛒</p>
              <p className="text-slate-400 text-xs font-semibold">Tu carrito está vacío.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="divide-y divide-slate-800 max-h-60 overflow-y-auto space-y-3 pr-1">
                {carrito.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0 flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <h5 className="font-bold text-white">{item.nombre}</h5>
                      <p className="text-orange-400 font-extrabold">${(item.precio * item.cantidad).toFixed(2)} MXN</p>
                    </div>
                    <div className="flex items-center gap-2 bg-[#0b0f19] rounded-xl p-1 border border-slate-800">
                      <button onClick={() => cambiarCantidad(item.id, -1)} className="w-6 h-6 flex items-center justify-center font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition">-</button>
                      <span className="font-bold w-4 text-center text-white">{item.cantidad}</span>
                      <button onClick={() => cambiarCantidad(item.id, 1)} className="w-6 h-6 flex items-center justify-center font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-4">
                <div className="flex justify-between items-center text-lg font-black text-white">
                  <span>Total a pagar:</span>
                  <span className="text-orange-400">${calcularTotal()} <span className="text-xs font-semibold text-slate-500">MXN</span></span>
                </div>
                <button onClick={() => setModalCheckout(true)} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold py-3.5 rounded-2xl transition duration-300 shadow-lg shadow-emerald-600/25 text-xs flex items-center justify-center gap-2">
                  <span>Proceder al Pago</span><span>🚀</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CHECKOUT */}
      {modalCheckout && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#121826] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-800 relative text-slate-100">
            <div className="text-center mb-6">
              <span className="text-3xl">🛍️</span>
              <h3 className="text-xl font-black text-white mt-2">Finalizar Pedido</h3>
              <p className="text-xs text-slate-400 font-medium">Estás a un paso de ordenar en {comercio.nombreComercio}.</p>
            </div>

            {pedidoEnviado ? (
              <div className="py-10 text-center space-y-3">
                <div className="animate-spin text-4xl">🍔</div>
                <p className="font-bold text-xs text-orange-400">
                  {mensajeRevision ? "🛡️ Tu comprobante está en revisión. Puede tardar aprox. 8 minutos en validarse..." : "Enviando orden al restaurante..."}
                </p>
              </div>
            ) : (
              <form onSubmit={realizarPedido} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tu Nombre Completo</label>
                  <input type="text" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} required placeholder="Ej. Juan Pérez" className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono de Contacto</label>
                  <input type="tel" value={telefonoCliente} onChange={(e) => setTelefonoCliente(e.target.value)} required placeholder="Ej. 9381234567" className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Dirección de Entrega (Domicilio)</label>
                  <input type="text" value={direccionCliente} onChange={(e) => setDireccionCliente(e.target.value)} required placeholder="Ej. Calle 10 x 21 y 23, Col. Centro" className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Método de Pago</label>
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition font-medium">
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  </select>
                </div>

                {metodoPago === 'Transferencia Bancaria' && (
                  <div className="bg-[#0b0f19] p-4 rounded-2xl border border-orange-500/30 space-y-3">
                    <div className="text-xs space-y-1">
                      <p className="font-extrabold text-orange-400">🏦 Datos para Depositar / Transferir:</p>
                      <p className="text-slate-300">Banco: <span className="font-bold text-white">{datosBancoRestaurante?.banco || "Azteca"}</span></p>
                      <p className="text-slate-300">Cuenta/CLABE: <span className="font-bold text-white">{datosBancoRestaurante?.numeroCuenta || "4212 1212 3421 2345"}</span></p>
                      <p className="text-slate-300">Titular: <span className="font-bold text-white">{datosBancoRestaurante?.titular || "Marcos Lopez"}</span></p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">📤 Subir Comprobante (Captura)</label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleArchivoChange} 
                        required 
                        className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer" 
                      />
                      {cargandoImagen && <p className="text-[11px] text-amber-400 mt-1 font-semibold animate-pulse">⏳ Comprimiendo imagen...</p>}
                      {nombreArchivo && !cargandoImagen && <p className="text-[11px] text-emerald-400 mt-1 font-semibold">✓ Comprobante listo y optimizado: {nombreArchivo}</p>}
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-2.5 rounded-xl text-[11px] font-semibold text-center leading-relaxed">
                      🛡️ Tu comprobante se está revisando (puede tardar aprox. 8 minutos en lo que se valida la transferencia).
                    </div>
                  </div>
                )}

                {metodoPago === 'Efectivo' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">¿Pagas con cuánto? (Cambio)</label>
                    <input type="text" value={cambioPara} onChange={(e) => setCambioPara(e.target.value)} placeholder="Ej. Billete de $200" className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition" />
                  </div>
                )}

                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setModalCheckout(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3.5 rounded-2xl text-xs transition">Cancelar</button>
                  <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl text-xs shadow-lg transition">Confirmar Pedido</button>
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