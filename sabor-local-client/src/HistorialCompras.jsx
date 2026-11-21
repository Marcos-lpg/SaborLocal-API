import { useEffect, useState } from "react";
import api from "./ApiClient";

export default function HistorialCompras({ comercios = [], onSeleccionarRestaurante, onVolver }) {
  const [historial, setHistorial] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const cargarHistorial = async () => {
      setCargando(true);
      setErrorMsg("");

      const telefonoGuardado = (localStorage.getItem("clienteTelefono") || "").trim();

      const obtenerHistorialLocal = () => {
        const posiblesClaves = ["historial_compras", "mis_pedidos", "pedidos_cliente", "pedidos"];
        for (const clave of posiblesClaves) {
          const raw = localStorage.getItem(clave);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((p, i) => ({
                pedidoId: p.pedidoId || p.id || p.codigo || `local-${i}`,
                tenantId: p.tenantId || p.comercioId || p.restauranteId || p.idComercio || 2,
                nombreComercio: p.nombreComercio || p.comercioNombre || p.restaurante || "Comercio",
                total: p.total ?? p.montoTotal ?? 0,
                fechaCreacion: p.fechaCreacion || p.fecha || new Date().toISOString(),
                estado: p.estado || "Registrado",
                direccionComercio: p.direccionComercio || p.direccion || "",
                telefonoComercio: p.telefonoComercio || p.telefono || ""
              }));
            }
          } catch {
            // Ignorar JSON mal formado
          }
        }
        return [];
      };

      try {
        const params = telefonoGuardado ? { telefono: telefonoGuardado } : {};
        const res = await api.get("/pedidos/mi-historial", { params });
        const listaApi = Array.isArray(res.data) ? res.data : [];

        if (listaApi.length > 0) {
          setHistorial(listaApi);
        } else {
          setHistorial(obtenerHistorialLocal());
        }
      } catch (err) {
        console.warn("No se pudo cargar historial desde API, usando respaldo local:", err?.message);
        const locales = obtenerHistorialLocal();
        setHistorial(locales);
        if (locales.length === 0 && !telefonoGuardado) {
          setErrorMsg("");
        }
      } finally {
        setCargando(false);
      }
    };

    cargarHistorial();
  }, []);

  const historialFiltrado = historial.filter((item) =>
    (item.nombreComercio || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const abrirPerfilRestaurante = (item) => {
    const encontrado = comercios.find((c) => c.id === item.tenantId);
    if (encontrado) {
      onSeleccionarRestaurante(encontrado);
    } else {
      onSeleccionarRestaurante({
        id: item.tenantId,
        nombreComercio: item.nombreComercio,
        direccion: item.direccionComercio,
        telefono: item.telefonoComercio
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onVolver}
          className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-2 bg-[#121826] px-4 py-3 rounded-2xl border border-slate-800 transition"
        >
          ← Volver al listado de comercios
        </button>
      </div>

      <div className="bg-[#121826] border border-slate-800 rounded-3xl p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-black text-white">🧾 Mi Historial de Compras</h2>
          <p className="text-xs text-slate-400 mt-1">
            Revisa dónde pediste recientemente y entra directo al perfil del restaurante.
          </p>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar restaurante en tu historial..."
          className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {cargando ? (
        <div className="bg-[#121826] border border-slate-800 rounded-3xl p-8 text-center text-xs text-slate-400">
          Cargando historial...
        </div>
      ) : errorMsg ? (
        <div className="bg-[#121826] border border-red-900/50 rounded-3xl p-8 text-center text-xs text-red-400">
          {errorMsg}
        </div>
      ) : historialFiltrado.length === 0 ? (
        <div className="bg-[#121826] border border-slate-800 rounded-3xl p-8 text-center space-y-2">
          <p className="text-sm font-bold text-white">No hay compras registradas todavía</p>
          <p className="text-xs text-slate-400">
            Cuando realices un pedido, aparecerá aquí para que puedas volver al restaurante fácilmente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {historialFiltrado.map((item, idx) => (
            <div
              key={item.pedidoId || idx}
              className="bg-[#121826] border border-slate-800 rounded-3xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-black text-white">{item.nombreComercio}</h3>
                  <span className="text-sm font-black text-emerald-400">
                    ${Number(item.total || 0).toFixed(2)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  {new Date(item.fechaCreacion).toLocaleString("es-MX")} • {item.estado}
                </p>

                {item.direccionComercio && (
                  <p className="text-xs text-slate-400">📍 {item.direccionComercio}</p>
                )}
                {item.telefonoComercio && (
                  <p className="text-xs text-slate-400">📞 {item.telefonoComercio}</p>
                )}
              </div>

              <button
                onClick={() => abrirPerfilRestaurante(item)}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-4 rounded-2xl text-xs transition cursor-pointer"
              >
                Ir al perfil del restaurante →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}