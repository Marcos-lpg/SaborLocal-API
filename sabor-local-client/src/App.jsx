import { useState, useEffect, useRef } from 'react';
import api from './ApiClient';
import RegistroRestaurante from './RegistroRestaurante';
import RegistroCliente from './RegistroCliente';
import PanelSuperAdmin from './PanelSuperAdmin';
import PanelRestaurante from './PanelRestaurante';
import ClienteVista from './ClienteVista';
import HistorialCompras from './HistorialCompras';

function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enLinea, setEnLinea] = useState(true);
  const [avisoReconectado, setAvisoReconectado] = useState(false);

  const estadoPrevioRef = useRef(true);
  const timerReconexionRef = useRef(null);
  const chequeoEnCursoRef = useRef(false);

  const [sesion, setSesion] = useState(() => {
    try {
      const porPestana = sessionStorage.getItem('saborlocal_sesion_tab');
      if (porPestana) return JSON.parse(porPestana);
      const respaldoOffline = localStorage.getItem('saborlocal_sesion_offline');
      return respaldoOffline ? JSON.parse(respaldoOffline) : null;
    } catch {
      return null;
    }
  });
  const [vistaAuth, setVistaAuth] = useState('login');

  const [vistaActual, setVistaActual] = useState(() => {
    try {
      const porPestana = sessionStorage.getItem('saborlocal_sesion_tab');
      const guardada = porPestana || localStorage.getItem('saborlocal_sesion_offline');
      if (!guardada) return 'home';
      const parsed = JSON.parse(guardada);
      if (parsed?.rol === 'SUPERADMIN') return 'superadmin';
      if (parsed?.rol === 'NEGOCIO') return 'restaurante';
      return 'home';
    } catch {
      return 'home';
    }
  });
  const [comercioSeleccionado, setComercioSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [cargandoLogin, setCargandoLogin] = useState(false);

  const actualizarEstadoConexion = (conectadoAlServidor) => {
    const estadoReal = Boolean(conectadoAlServidor) && navigator.onLine;
    if (estadoReal) {
      if (!estadoPrevioRef.current) {
        setAvisoReconectado(true);
        clearTimeout(timerReconexionRef.current);
        timerReconexionRef.current = setTimeout(() => {
          setAvisoReconectado(false);
        }, 4500);
      }
      estadoPrevioRef.current = true;
      setEnLinea(true);
    } else {
      estadoPrevioRef.current = false;
      setEnLinea(false);
      setAvisoReconectado(false);
      clearTimeout(timerReconexionRef.current);
    }
  };

  useEffect(() => {
    try {
      if (sesion) {
        const json = JSON.stringify(sesion);
        sessionStorage.setItem('saborlocal_sesion_tab', json);
        localStorage.setItem('saborlocal_sesion_offline', json);
      } else {
        sessionStorage.removeItem('saborlocal_sesion_tab');
      }
    } catch (e) {
      console.error('Error al persistir sesión:', e);
    }
  }, [sesion]);

  const obtenerComerciosOffline = () => {
    try {
      const apiCache = JSON.parse(localStorage.getItem('cache_comercios_api') || '[]');
      const dirOffline = JSON.parse(localStorage.getItem('directorio_offline') || '[]');
      const locales = JSON.parse(localStorage.getItem('comercios_registrados') || '[]');
      const combinados = [
        ...(Array.isArray(apiCache) ? apiCache : []),
        ...(Array.isArray(dirOffline) ? dirOffline : []),
        ...(Array.isArray(locales) ? locales : [])
      ];
      const mapa = new Map();
      combinados.forEach((item, idx) => {
        const key = item?.id ?? item?.Id ?? item?.correoDuenio ?? item?.CorreoDuenio ?? `idx-${idx}`;
        if (!mapa.has(key)) {
          mapa.set(key, item);
        }
      });
      return Array.from(mapa.values());
    } catch {
      return [];
    }
  };

  const resolverNombreComercio = (usuario = {}, correoRaw = '', listaExtra = []) => {
    const directo = usuario?.nombreComercio || usuario?.NombreComercio;
    if (directo && String(directo).trim()) {
      return String(directo).trim();
    }

    const idCandidato = usuario?.comercioId ?? usuario?.ComercioId ?? usuario?.id ?? usuario?.Id;
    const correoCandidato = String(
      usuario?.correo || usuario?.Correo || usuario?.correoDuenio || usuario?.CorreoDuenio || correoRaw || ''
    ).toLowerCase().trim();

    const catalogo = [
      ...(Array.isArray(listaExtra) ? listaExtra : []),
      ...(Array.isArray(restaurants) ? restaurants : []),
      ...obtenerComerciosOffline()
    ];

    const encontrado = catalogo.find(c => {
      const mismoId =
        idCandidato !== undefined &&
        idCandidato !== null &&
        Number(c?.id ?? c?.Id ?? c?.comercioId ?? c?.ComercioId) === Number(idCandidato);
      const mismoCorreo =
        correoCandidato &&
        String(c?.correoDuenio || c?.CorreoDuenio || c?.correo || c?.Correo || '').toLowerCase().trim() ===
          correoCandidato;
      return mismoId || mismoCorreo;
    });

    return (
      encontrado?.nombreComercio ||
      encontrado?.NombreComercio ||
      usuario?.nombre ||
      usuario?.Nombre ||
      'Mi Restaurante'
    );
  };

  const cargarComercios = async () => {
    if (chequeoEnCursoRef.current) return;
    chequeoEnCursoRef.current = true;

    const respaldoLocal = obtenerComerciosOffline();

    const aplicarModoSinConexion = (mensajeSinDatos) => {
      actualizarEstadoConexion(false);
      if (respaldoLocal.length > 0) {
        setRestaurants(respaldoLocal);
        setError(null);
      } else {
        setError(mensajeSinDatos);
      }
      setLoading(false);
    };

    try {
      if (!navigator.onLine) {
        aplicarModoSinConexion("Sin conexión y sin comercios guardados previamente en este dispositivo.");
        return;
      }

      const baseUrlApi = (api?.defaults?.baseURL || 'http://localhost:5037/api').replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      let lista = [];
      try {
        const resFetch = await fetch(`${baseUrlApi}/comercios`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!resFetch.ok) {
          throw new Error(`HTTP ${resFetch.status}`);
        }
        const dataFetch = await resFetch.json();
        lista = Array.isArray(dataFetch) ? dataFetch : [];
      } catch {
        clearTimeout(timeoutId);
        throw new Error('Backend no disponible');
      }

      actualizarEstadoConexion(true);
      setRestaurants(lista);
      try {
        localStorage.setItem('cache_comercios_api', JSON.stringify(lista));
      } catch (e) {
        console.error('Error al guardar comercios en caché:', e);
      }
      setError(null);
      setLoading(false);
    } catch {
      aplicarModoSinConexion("Servidor detenido y sin comercios guardados previamente en este dispositivo.");
    } finally {
      chequeoEnCursoRef.current = false;
    }
  };

  useEffect(() => {
    const manejarOfflineNavegador = () => actualizarEstadoConexion(false);
    const manejarOnlineNavegador = () => cargarComercios();
    const manejarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        cargarComercios();
      }
    };

    window.addEventListener('offline', manejarOfflineNavegador);
    window.addEventListener('online', manejarOnlineNavegador);
    window.addEventListener('focus', manejarOnlineNavegador);
    document.addEventListener('visibilitychange', manejarVisibilidad);

    cargarComercios();
    const intervalo = setInterval(() => {
      cargarComercios();
    }, 2000);

    return () => {
      window.removeEventListener('offline', manejarOfflineNavegador);
      window.removeEventListener('online', manejarOnlineNavegador);
      window.removeEventListener('focus', manejarOnlineNavegador);
      document.removeEventListener('visibilitychange', manejarVisibilidad);
      clearInterval(intervalo);
      clearTimeout(timerReconexionRef.current);
    };
  }, []);

  useEffect(() => {
    if (sesion?.rol !== 'NEGOCIO') return;
    const nombreResuelto = resolverNombreComercio(
      {
        comercioId: sesion.comercioId,
        correo: sesion.correo,
        nombre: sesion.nombre
      },
      sesion.correo || ''
    );
    if (nombreResuelto && nombreResuelto !== sesion.nombre) {
      setSesion(prev => ({
        ...prev,
        nombre: nombreResuelto
      }));
    }
  }, [sesion, restaurants]);

  const activarSesionUsuario = async (usuario, correoIngresado = '') => {
    if (!usuario) return false;

    const rolRaw = String(usuario.rol || usuario.Rol || '').toUpperCase().trim();
    const correoRaw = String(usuario.correo || usuario.Correo || correoIngresado || '').toLowerCase().trim();

    if (rolRaw.includes('SUPERADMIN') || rolRaw === 'SUPER_ADMIN') {
      setSesion({
        rol: 'SUPERADMIN',
        nombre: usuario.nombre || usuario.Nombre || 'Super Administrador'
      });
      setVistaActual('superadmin');
      return true;
    }

    if (
      rolRaw.includes('NEGOCIO') ||
      rolRaw.includes('RESTAURANT') ||
      rolRaw.includes('COMERCIO') ||
      usuario.comercioId ||
      usuario.ComercioId
    ) {
      let listaFresca = restaurants;
      if (!listaFresca || listaFresca.length === 0) {
        try {
          const resCom = await api.get('/comercios', { timeout: 2500 });
          if (Array.isArray(resCom?.data)) {
            listaFresca = resCom.data;
            setRestaurants(resCom.data);
            localStorage.setItem('cache_comercios_api', JSON.stringify(resCom.data));
          }
        } catch {
          listaFresca = obtenerComerciosOffline();
        }
      }

      const idNegocio = usuario.comercioId || usuario.ComercioId || usuario.id || usuario.Id || 1;
      const match = listaFresca.find(
        c =>
          Number(c?.id ?? c?.Id ?? c?.comercioId ?? c?.ComercioId) === Number(idNegocio) ||
          (correoRaw &&
            String(c?.correoDuenio || c?.CorreoDuenio || c?.correo || c?.Correo || '').toLowerCase().trim() ===
              correoRaw)
      );

      const nombreRealNegocio = resolverNombreComercio(usuario, correoRaw, listaFresca);

      setSesion({
        rol: 'NEGOCIO',
        nombre: nombreRealNegocio,
        correo: correoRaw,
        comercioId: match?.id ?? match?.Id ?? idNegocio
      });
      setVistaActual('restaurante');
      return true;
    }

    if (rolRaw.includes('CLIENTE') || rolRaw === 'USER' || rolRaw === 'USUARIO' || rolRaw === '') {
      const tel = usuario.telefono || usuario.Telefono;
      if (tel) {
        localStorage.setItem('clienteTelefono', tel);
      }
      setSesion({
        rol: 'CLIENTE',
        nombre: usuario.nombreCompleto || usuario.NombreCompleto || usuario.nombre || usuario.Nombre || correoRaw || 'Cliente',
        telefono: tel || ''
      });
      setVistaActual('home');
      return true;
    }

    if (rolRaw.includes('ADMIN')) {
      setSesion({
        rol: 'SUPERADMIN',
        nombre: usuario.nombre || usuario.Nombre || 'Administrador'
      });
      setVistaActual('superadmin');
      return true;
    }

    return false;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setCargandoLogin(true);

    const emailLower = loginEmail.toLowerCase().trim();

    if ((emailLower.includes('admin') || emailLower.includes('superadmin')) && loginPassword === 'Admin123*') {
      setSesion({ rol: 'SUPERADMIN', nombre: 'Super Administrador' });
      setVistaActual('superadmin');
      setCargandoLogin(false);
      return;
    }

    try {
      const response = await api.post('/auth/login', {
        correo: emailLower,
        contrasena: loginPassword
      });

      const data = response.data || {};
      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      const usuarioBackend = data.usuario || data.user || data;
      if (await activarSesionUsuario(usuarioBackend, emailLower)) {
        setCargandoLogin(false);
        return;
      }
    } catch (err) {
      console.warn("Login backend no disponible o rechazado, probando respaldo local:", err?.message);
    }

    const comerciosLocales = JSON.parse(localStorage.getItem('comercios_registrados') || '[]');
    const comercioEnLocal = comerciosLocales.find(
      c => (c.correoDuenio || c.correo || '').toLowerCase().trim() === emailLower
    );

    if (comercioEnLocal) {
      if (comercioEnLocal.contrasena !== loginPassword) {
        setLoginError("❌ Contraseña incorrecta para este negocio.");
        setCargandoLogin(false);
        return;
      }
      setSesion({
        rol: 'NEGOCIO',
        nombre: comercioEnLocal.nombreComercio || 'Mi Restaurante',
        correo: emailLower,
        comercioId: comercioEnLocal.id || 1
      });
      setVistaActual('restaurante');
      setCargandoLogin(false);
      return;
    }

    const clientesVerificados = JSON.parse(localStorage.getItem('clientes_verificados') || '[]');
    const clienteEncontrado = clientesVerificados.find(
      cli => (cli.correo || '').toLowerCase().trim() === emailLower
    );

    if (clienteEncontrado) {
      if (clienteEncontrado.contrasena !== loginPassword) {
        setLoginError("❌ Contraseña incorrecta.");
        setCargandoLogin(false);
        return;
      }
      if (clienteEncontrado.telefono) {
        localStorage.setItem('clienteTelefono', clienteEncontrado.telefono);
      }
      setSesion({
        rol: 'CLIENTE',
        nombre: clienteEncontrado.nombreCompleto || 'Cliente',
        telefono: clienteEncontrado.telefono || ''
      });
      setVistaActual('home');
      setCargandoLogin(false);
      return;
    }

    setLoginError("❌ Acceso denegado: Este correo no está registrado o la contraseña es incorrecta.");
    setCargandoLogin(false);
  };

  const cerrarSesion = () => {
    setSesion(null);
    sessionStorage.removeItem('saborlocal_sesion_tab');
    localStorage.removeItem('saborlocal_sesion_offline');
    localStorage.removeItem('saborlocal_sesion');
    setVistaAuth('login');
    setVistaActual('home');
    setComercioSeleccionado(null);
    setLoginEmail('');
    setLoginPassword('');
    setLoginError(null);
  };

  const restaurantesFiltrados = restaurants.filter(r =>
    r.nombreComercio?.toLowerCase().includes(busqueda.toLowerCase()) ||
    r.categoria?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const esAdmin = sesion?.rol === 'SUPERADMIN';

  return (
    <div className="min-h-screen bg-[#070e14] text-slate-100 font-sans pb-14 relative overflow-x-hidden">

      {/* Barra Superior Neón Oscura */}
      <header
        className="bg-gradient-to-r from-[#0b1620] via-[#10202e] to-[#0b1620] border-b border-amber-400/25 sticky top-0 z-50"
        style={{ boxShadow: '0 6px 24px rgba(0, 0, 0, 0.65), 0 1px 0 rgba(251, 191, 36, 0.2)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">

          {/* Logo Sabor Local 3D + Insignia CANDELARIA / ROL */}
          <div className="flex items-center gap-2.5">
            <div
              onClick={() => { if (!sesion || sesion.rol === 'CLIENTE') setVistaActual('home'); }}
              className="neon-btn-orange px-3.5 py-1.5 rounded-xl border border-amber-200/45 cursor-pointer select-none leading-none transition"
            >
              <span className="block text-sm sm:text-base font-black tracking-tight text-white drop-shadow-xs">
                Sabor
              </span>
              <span className="block text-sm sm:text-base font-black tracking-tight text-amber-100 -mt-0.5 drop-shadow-xs">
                Local
              </span>
            </div>

            <div
              className="bg-[#122332] border border-cyan-400/45 px-3 py-1 rounded-xl flex flex-col justify-center"
              style={{ boxShadow: '0 0 12px rgba(34, 211, 238, 0.2)' }}
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 leading-tight">
                CANDELARIA
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-cyan-300 leading-tight">
                {sesion ? sesion.rol : 'INVITADO'}
              </span>
            </div>
          </div>

          {/* Controles Derecha con Resplandor Neón */}
          <div className="flex items-center gap-2 flex-wrap">
            {sesion ? (
              <>
                <span className="icon-3d-pod px-3 py-1.5 rounded-xl text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <span className="text-amber-300 text-sm">👤</span>
                  <span>{sesion.rol === 'SUPERADMIN' ? 'Super Administrador' : sesion.nombre}</span>
                </span>

                {sesion.rol === 'CLIENTE' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setVistaActual('home')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                        vistaActual === 'home' || vistaActual === 'clientemenu'
                          ? 'neon-btn-orange text-white'
                          : 'bg-[#122332] hover:bg-[#193044] text-slate-200 border border-white/15'
                      }`}
                    >
                      <span className="text-sm">🍔</span>
                      <span>Explorar Comercios</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVistaActual('historial')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                        vistaActual === 'historial'
                          ? 'neon-btn-orange text-white'
                          : 'bg-[#122332] hover:bg-[#193044] text-slate-200 border border-white/15'
                      }`}
                    >
                      <span className="text-sm">🧾</span>
                      <span>Mi Historial</span>
                    </button>
                  </>
                )}

                {sesion.rol === 'NEGOCIO' && (
                  <button
                    type="button"
                    onClick={() => setVistaActual('restaurante')}
                    className="neon-btn-orange px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="text-sm">👨‍🍳</span>
                    <span>Mi Panel de Negocio</span>
                  </button>
                )}

                {sesion.rol === 'SUPERADMIN' && (
                  <button
                    type="button"
                    onClick={() => setVistaActual('superadmin')}
                    className="neon-btn-violet px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
                    <span>Gobernanza Super Admin</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#dc2626] to-[#991b1b] hover:from-[#ef4444] hover:to-[#b91c1c] text-white border border-red-300/30 transition cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                >
                  Salir ✕
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 bg-[#122332] p-1 rounded-xl border border-white/15">
                <button
                  type="button"
                  onClick={() => setVistaAuth('login')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    vistaAuth === 'login'
                      ? 'neon-btn-orange text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => setVistaAuth('elegir-registro')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    vistaAuth !== 'login'
                      ? 'neon-btn-orange text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Registrarse
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Franja Superior Neón Terracota / Dorada */}
      <div
        className="h-2 w-full bg-gradient-to-r from-[#ea580c] via-[#f59e0b] to-[#ea580c]"
        style={{ boxShadow: '0 0 16px rgba(245, 158, 11, 0.5)' }}
      />

      {/* Contenido Principal */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 relative z-10">

        {!enLinea && (
          <div className="mb-4 bg-amber-500/15 border border-amber-400/50 text-amber-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <span>
              📡 <strong>Sin conexión:</strong> Mostrando datos guardados en este dispositivo.
            </span>
            <span className="font-extrabold uppercase text-[10px] bg-amber-500/25 px-2 py-0.5 rounded-md">
              Modo Offline
            </span>
          </div>
        )}

        {enLinea && avisoReconectado && (
          <div className="mb-4 bg-emerald-500/15 border border-emerald-400/50 text-emerald-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
            <span>
              🟢 <strong>De nuevo en línea:</strong> Conexión restablecida.
            </span>
            <span className="font-extrabold uppercase text-[10px] bg-emerald-500/25 px-2 py-0.5 rounded-md">
              En Línea
            </span>
          </div>
        )}

        {!sesion ? (
          <div className="max-w-md mx-auto py-8">

            {vistaAuth === 'login' && (
              <div className="neon-amber-card bg-[#0e1b26] p-7 rounded-2xl space-y-5">
                <div className="text-center space-y-1">
                  <div className="icon-3d-pod w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-2">
                    🔐
                  </div>
                  <h2 className="text-xl font-black text-white">Iniciar Sesión</h2>
                  <p className="text-xs text-slate-400">Ingresa a tu cuenta verificada en Sabor Local.</p>
                </div>

                {loginError && (
                  <div className="bg-red-500/15 border border-red-400/35 text-red-200 p-3 rounded-xl text-center text-xs font-semibold">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="ej. tu_correo@mail.com"
                      required
                      className="w-full px-3.5 py-2.5 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3.5 py-2.5 bg-[#070e14] border border-white/15 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={cargandoLogin}
                    className="neon-btn-orange w-full text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    {cargandoLogin ? "Verificando..." : "Entrar a la Plataforma"}
                  </button>
                </form>

                <div className="text-center pt-2 border-t border-white/10">
                  <p className="text-xs text-slate-400">
                    ¿No tienes cuenta?{' '}
                    <button type="button" onClick={() => setVistaAuth('elegir-registro')} className="text-amber-400 font-bold hover:underline cursor-pointer">
                      Regístrate aquí
                    </button>
                  </p>
                </div>
              </div>
            )}

            {vistaAuth === 'elegir-registro' && (
              <div className="neon-amber-card bg-[#0e1b26] p-7 rounded-2xl space-y-5 text-center">
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-white">¿Cómo deseas registrarte?</h2>
                  <p className="text-xs text-slate-400">Elige el tipo de cuenta que quieres crear en Sabor Local.</p>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setVistaAuth('reg-cliente')}
                    className="w-full bg-[#070e14] hover:bg-[#142534] border border-amber-400/25 p-3.5 rounded-xl text-left transition flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="icon-3d-pod w-10 h-10 rounded-xl flex items-center justify-center text-lg">👤</span>
                      <div>
                        <h4 className="font-bold text-white text-xs">Registrar Usuario / Cliente</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">Explorar menús y pedir comida a domicilio.</p>
                      </div>
                    </div>
                    <span className="text-amber-400 font-bold text-xs">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVistaAuth('reg-negocio')}
                    className="w-full bg-[#070e14] hover:bg-[#142534] border border-amber-400/25 p-3.5 rounded-xl text-left transition flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="icon-3d-pod w-10 h-10 rounded-xl flex items-center justify-center text-lg">🏪</span>
                      <div>
                        <h4 className="font-bold text-white text-xs">Registrar mi Negocio</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">Administrar comandas, menú y ventas.</p>
                      </div>
                    </div>
                    <span className="text-amber-400 font-bold text-xs">→</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setVistaAuth('login')}
                  className="text-xs text-slate-400 hover:text-white underline block mx-auto cursor-pointer"
                >
                  ← Volver al Iniciar Sesión
                </button>
              </div>
            )}

            {vistaAuth === 'reg-cliente' && (
              <div className="space-y-3">
                <RegistroCliente
                  onRegistroExitoso={() => setVistaAuth('login')}
                  onVolver={() => setVistaAuth('elegir-registro')}
                />
              </div>
            )}

            {vistaAuth === 'reg-negocio' && (
              <div className="space-y-3">
                <RegistroRestaurante onRegistroExitoso={() => { cargarComercios(); setVistaAuth('login'); }} />
                <div className="text-center">
                  <button type="button" onClick={() => setVistaAuth('elegir-registro')} className="text-xs text-slate-400 hover:text-white underline cursor-pointer">
                    ← Volver a opciones de registro
                  </button>
                </div>
              </div>
            )}

          </div>
        ) : (

          <>
            {sesion.rol === 'SUPERADMIN' && <PanelSuperAdmin />}

            {sesion.rol === 'NEGOCIO' && (
              <PanelRestaurante
                comercioId={sesion.comercioId || 1}
                nombreComercio={sesion.nombre || "Mi Negocio"}
                correoNegocio={sesion.correo || ''}
              />
            )}

            {sesion.rol === 'CLIENTE' && (
              vistaActual === 'historial' ? (
                <HistorialCompras
                  comercios={restaurants}
                  onSeleccionarRestaurante={(resto) => {
                    setComercioSeleccionado(resto);
                    setVistaActual('clientemenu');
                  }}
                  onVolver={() => setVistaActual('home')}
                  onCalificacionGuardada={cargarComercios}
                />
              ) : vistaActual === 'clientemenu' && comercioSeleccionado ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setVistaActual('home')}
                    className="icon-3d-pod text-xs font-extrabold text-amber-200 hover:text-white flex items-center gap-1.5 px-4 py-2 rounded-xl w-fit transition cursor-pointer"
                  >
                    ← Volver a comercios
                  </button>
                  <ClienteVista
                    comercio={restaurants.find(r => r.id === comercioSeleccionado.id) || comercioSeleccionado}
                    servidorActivo={enLinea}
                    onPerderConexion={() => actualizarEstadoConexion(false)}
                    onRecuperarConexion={() => cargarComercios()}
                    onCalificacionGuardada={cargarComercios}
                  />
                </div>
              ) : (
                <div className="space-y-5">

                  {/* Banner Neón Vibrante Cálido-Púrpura con Iconos 3D, Hamburguesa y Buscador Neón */}
                  <div
                    className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#e11d48] via-[#f59e0b] to-[#7c3aed] p-6 sm:p-8 border-2 border-amber-300/50"
                    style={{
                      boxShadow:
                        '0 0 28px rgba(249, 115, 22, 0.35), 0 0 40px rgba(124, 58, 237, 0.28), 0 16px 36px rgba(0, 0, 0, 0.65)'
                    }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(255,255,255,0.25),transparent_55%)]" />

                    {/* Elementos decorativos 3D */}
                    <span className="hidden sm:flex icon-3d-pod w-10 h-10 rounded-2xl items-center justify-center absolute top-3 left-[36%] text-xl select-none">
                      🥑
                    </span>
                    <span className="hidden sm:flex icon-3d-pod w-10 h-10 rounded-2xl items-center justify-center absolute bottom-3 left-[48%] text-xl select-none">
                      🥑
                    </span>
                    <span className="hidden sm:flex icon-3d-pod w-10 h-10 rounded-2xl items-center justify-center absolute top-3 right-6 text-xl select-none">
                      🌮
                    </span>
                    <span className="hidden sm:flex icon-3d-pod w-10 h-10 rounded-2xl items-center justify-center absolute bottom-3 right-5 text-xl select-none">
                      🌮
                    </span>

                    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                      <div className="max-w-md space-y-2 text-center lg:text-left">
                        <h2 className="hero-headline-3d text-3xl sm:text-4xl font-black tracking-tight text-amber-100 leading-[1.08]">
                          La mejor comida de Candelaria a tu alcance
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-white drop-shadow-xs">
                          Pide directamente a tus restaurantes locales favoritos en tiempo real.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-3 w-full lg:w-auto">
                        <div className="icon-3d-pod w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0">
                          <img
                            src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80"
                            alt="Hamburguesa Candelaria"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="neon-search-bar w-full sm:w-72 rounded-full px-4 py-2.5 flex items-center gap-2.5">
                          <span className="text-cyan-300 text-xs drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]">🔍</span>
                          <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar negocio o categoría..."
                            className="w-full bg-transparent text-xs text-white placeholder:text-sky-200/80 focus:outline-none font-semibold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tarjetas de Comercios Neón */}
                  {loading && restaurants.length === 0 ? (
                    <p className="text-center text-xs text-slate-300 py-8">Cargando comercios...</p>
                  ) : error && restaurants.length === 0 ? (
                    <p className="text-center text-xs text-amber-300 py-8">{error}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {restaurantesFiltrados.map((resto) => {
                        const abierto = resto.estaAbierto !== false;
                        const envioGratis = resto.envioGratis !== false || !(Number(resto.costoEnvio) > 0);
                        const costoEnvio = Number(resto.costoEnvio || 0);
                        const promedio = Number(resto.calificacionPromedio || 0);
                        const totalResenas = Number(resto.totalCalificaciones || 0);

                        return (
                          <div
                            key={resto.id}
                            onClick={() => { setComercioSeleccionado(resto); setVistaActual('clientemenu'); }}
                            className="neon-amber-card bg-gradient-to-b from-[#152736] to-[#0c1822] rounded-2xl p-4 transition cursor-pointer flex flex-col justify-between gap-3.5 group"
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                {enLinea ? (
                                  <span className={`text-white text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wide ${
                                    abierto
                                      ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.65)]'
                                      : 'bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.55)]'
                                  }`}>
                                    {abierto ? '🟢 ABIERTO' : '🔴 CERRADO'}
                                  </span>
                                ) : (
                                  <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wide">
                                    GUARDADO
                                  </span>
                                )}
                                <span className="bg-[#070e14] text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-400/35">
                                  ⭐ {totalResenas > 0 ? `${promedio.toFixed(1)} (${totalResenas})` : 'Nuevo'}
                                </span>
                              </div>

                              <div className="icon-3d-pod h-32 w-full rounded-xl overflow-hidden relative">
                                <img
                                  src={
                                    resto.imagenUrl ||
                                    resto.fotoUrl ||
                                    "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80"
                                  }
                                  alt={resto.nombreComercio}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <span className="absolute top-2 right-2 bg-[#070e14]/85 text-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-400/30">
                                  📍 {resto.categoria || 'Candelaria'}
                                </span>
                              </div>

                              <div className="flex items-end gap-3 -mt-7 px-1 relative z-10">
                                <div className="w-14 h-14 rounded-full bg-[#070e14] border-2 border-amber-400/80 shadow-xl overflow-hidden flex items-center justify-center shrink-0">
                                  {resto.logoUrl ? (
                                    <img src={resto.logoUrl} alt={`Logo ${resto.nombreComercio}`} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-2xl">🍔</span>
                                  )}
                                </div>
                                <div className="pt-6 min-w-0">
                                  <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition truncate">
                                    {resto.nombreComercio}
                                  </h3>
                                  <p className="text-[11px] text-amber-200/85 font-semibold truncate">
                                    🍔 {resto.categoria || 'Comida Local'}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-1 text-[11px] text-slate-300">
                                <p className="truncate">📍 {resto.direccion || "Calle 8 Guanajuato entre 29 y 31"}</p>
                                <p className="truncate text-amber-100/90 font-semibold">
                                  🕒 {resto.horarioAtencion || "Lun - Dom: 9:00 AM - 10:00 PM"}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] font-extrabold">
                                <span className="bg-[#070e14] text-slate-200 border border-white/15 px-2.5 py-1 rounded-full">
                                  ⏱️ {resto.tiempoPreparacion || "25-40 min"}
                                </span>
                                <span className={`px-2.5 py-1 rounded-full border ${
                                  envioGratis
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                                    : 'bg-orange-500/15 text-orange-300 border-orange-400/35'
                                }`}>
                                  🛵 {envioGratis ? 'Envío gratis' : `Envío $${costoEnvio.toFixed(2)}`}
                                </span>
                              </div>
                            </div>

                            <div className="pt-1">
                              <span className="neon-btn-orange w-full inline-flex items-center justify-center gap-1.5 text-white text-xs font-black py-2.5 rounded-full transition">
                                {!enLinea ? 'Ver Menú Guardado →' : abierto ? 'Ver Menú →' : 'Cerrado (Ver Menú) →'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )
            )}
          </>
        )}

      </main>

      {/* Footer Cálido con Glow */}
      <footer className="max-w-5xl mx-auto px-4 sm:px-6 mt-10">
        <div
          className="bg-[#f5e7c9] text-[#292524] px-5 py-3 rounded-2xl border border-amber-300 flex flex-wrap items-center justify-between gap-3 text-[11px] font-bold"
          style={{ boxShadow: '0 0 20px rgba(251, 191, 36, 0.25), 0 8px 20px rgba(0, 0, 0, 0.45)' }}
        >
          <p>
            © 2026 Sabor Local - Sistema Multi-Tenant de Grado Profesional para Candelaria, Campeche.
          </p>
          {esAdmin && (
            <span className="uppercase tracking-wider text-amber-900 font-black">Gobernanza Central</span>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;
