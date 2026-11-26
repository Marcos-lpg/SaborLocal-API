import { useState, useEffect } from 'react';
import api from './ApiClient';

function PanelSuperAdmin() {
  const [comercios, setComercios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastNoti, setToastNoti] = useState(null);

  const cargarComerciosAdmin = async () => {
    try {
      const res = await api.get('/comercios/admin/todos');
      setComercios(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch {
      try {
        const resAlt = await api.get('/comercios');
        setComercios(Array.isArray(resAlt.data) ? resAlt.data : []);
        setError(null);
      } catch {
        setError("No se pudieron cargar las solicitudes de comercios.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarComerciosAdmin();
    const intervalo = setInterval(() => {
      cargarComerciosAdmin();
    }, 3000);
    return () => clearInterval(intervalo);
  }, []);

  const cambiarEstadoComercio = async (id, nuevoEstado) => {
    try {
      await api.put(`/comercios/estado/${id}`, { estado: nuevoEstado });
      setToastNoti(`Comercio actualizado a: ${nuevoEstado}`);
      setTimeout(() => setToastNoti(null), 3000);
      cargarComerciosAdmin();
    } catch {
      alert("No se pudo actualizar el estado del comercio.");
    }
  };

  const eliminarComercio = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar permanentemente a '${nombre}'?`)) return;
    try {
      await api.delete(`/comercios/${id}`);
      setToastNoti(`Comercio '${nombre}' eliminado.`);
      setTimeout(() => setToastNoti(null), 3000);
      cargarComerciosAdmin();
    } catch {
      alert("No se pudo eliminar el comercio.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 relative text-slate-100">

      {toastNoti && (
        <div className="bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 z-50 shadow-[0_0_16px_rgba(16,185,129,0.3)]">
          <span>🛡️</span>
          <span className="font-bold">{toastNoti}</span>
        </div>
      )}

      {/* Banner Índigo / Violeta con Curva Ondulada Dorada (estilo image_3612f6.png) */}
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-violet-400/65 bg-[#231d52] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-h-[128px]"
        style={{
          boxShadow:
            '0 0 26px rgba(139, 92, 246, 0.35), 0 14px 32px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.14)'
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
            <linearGradient id="goldWaveAdmin" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#edd08e" />
              <stop offset="52%" stopColor="#dcb466" />
              <stop offset="100%" stopColor="#c39644" />
            </linearGradient>
          </defs>
          <path
            d="M 118 0 C 52 34, 90 76, 38 106 C 14 120, 6 132, 0 140 L 360 140 L 360 0 Z"
            fill="url(#goldWaveAdmin)"
          />
        </svg>

        <div className="relative z-10 max-w-xl px-6 sm:px-8 py-5 space-y-1.5">
          <span className="inline-block bg-[#19143d] text-amber-200 border border-amber-300/45 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
            GOBERNANZA CENTRAL
          </span>
          <h2 className="text-2xl sm:text-[28px] font-black tracking-tight text-white leading-tight drop-shadow-xs">
            Administración Multi-Tenant de Candelaria
          </h2>
          <p className="text-xs text-indigo-100/85 font-medium">
            Supervisión, validación de solicitudes y control de comercios.
          </p>
        </div>

        <div className="relative z-10 px-6 sm:pr-7 pb-4 sm:pb-0 flex items-center gap-2.5 shrink-0">
          <span
            className="hidden md:inline-flex items-center gap-1.5 bg-[#261f59] text-white border border-violet-300/40 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold shadow-md"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
            <span>Gobernanza Super Admin</span>
          </span>

          <div className="icon-3d-pod w-16 h-16 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80"
              alt="Comercio Candelaria"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="text-2xl select-none">🍔</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/15 border border-red-400/50 text-red-200 p-3.5 rounded-xl text-center text-xs font-bold">
          {error}
        </div>
      )}

      {/* Tarjeta Crema Cálido / Dorada "Solicitudes y Comercios Registrados" */}
      <div
        className="bg-[#f3e5c6] text-[#1c1917] p-5 sm:p-6 rounded-2xl border-2 border-amber-300/80 space-y-4"
        style={{ boxShadow: '0 0 22px rgba(251, 191, 36, 0.25), 0 14px 32px rgba(0, 0, 0, 0.6)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-900/15 pb-3">
          <h3 className="text-sm sm:text-base font-black text-[#18181b] flex items-center gap-2">
            <span className="text-rose-600 text-base">📋</span>
            <span>Solicitudes y Comercios Registrados</span>
          </h3>
          <span className="text-[11px] font-extrabold text-[#292524] bg-white/85 px-3 py-0.5 rounded-full border border-amber-300 shadow-2xs">
            {comercios.length} registros
          </span>
        </div>

        {loading ? (
          <p className="text-center text-[#57534e] py-8 text-xs font-semibold">Cargando registros...</p>
        ) : comercios.length === 0 ? (
          <p className="text-center text-[#57534e] py-8 text-xs font-semibold">No hay comercios registrados en el sistema.</p>
        ) : (
          <div className="overflow-x-auto bg-[#fbf4e4] rounded-xl border border-amber-900/15 shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-900/15 bg-[#efe0bf] text-[10px] font-black text-[#57534e] uppercase tracking-wider">
                  <th className="py-3 px-3">TENANT ID</th>
                  <th className="py-3 px-3">NOMBRE COMERCIO</th>
                  <th className="py-3 px-3">CATEGORÍA</th>
                  <th className="py-3 px-3">TELÉFONO</th>
                  <th className="py-3 px-3">ESTADO</th>
                  <th className="py-3 px-3 text-right">ACCIÓN MANUAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-900/10 text-xs font-semibold">
                {comercios.map((com) => (
                  <tr key={com.id} className="hover:bg-[#f7ebd2] transition align-middle">
                    <td className="py-3.5 px-3 font-mono text-[11px] text-[#57534e] whitespace-nowrap">
                      rest_{com.id < 10 ? `0${com.id}` : com.id}
                    </td>
                    <td className="py-3.5 px-3 font-black text-[#18181b] text-xs whitespace-nowrap">
                      {com.nombreComercio}
                    </td>
                    <td className="py-3.5 px-3 text-[#44403c] text-xs whitespace-nowrap">
                      {com.categoria || "Comida General"}
                    </td>
                    <td className="py-3.5 px-3 text-[#292524] font-bold text-xs whitespace-nowrap">
                      {com.telefonoComercio || com.telefono || "S/N"}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`inline-block text-[10px] px-3 py-0.5 rounded-full font-black uppercase ${
                        com.estado === 'APROBADO' ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.55)]' :
                        com.estado === 'SUSPENDIDO' ? 'bg-amber-400 text-slate-950 border border-amber-500' : 'bg-slate-200 text-slate-800 border border-slate-300'
                      }`}>
                        {com.estado || 'PENDIENTE'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                        {com.estado !== 'APROBADO' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoComercio(com.id, 'APROBADO')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-full text-[10px] transition cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                          >
                            Aprobar ✓
                          </button>
                        )}

                        {com.estado === 'APROBADO' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoComercio(com.id, 'SUSPENDIDO')}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-black px-3 py-1 rounded-full text-[10px] transition cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.55)]"
                          >
                            Suspender
                          </button>
                        )}

                        {com.estado === 'SUSPENDIDO' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstadoComercio(com.id, 'APROBADO')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-full text-[10px] transition cursor-pointer"
                          >
                            Reactivar 🔄
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => eliminarComercio(com.id, com.nombreComercio)}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded-full text-[10px] transition cursor-pointer inline-flex items-center gap-1 shadow-[0_0_12px_rgba(220,38,38,0.45)]"
                        >
                          <span>Eliminar</span>
                          <span>✕</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PanelSuperAdmin;
