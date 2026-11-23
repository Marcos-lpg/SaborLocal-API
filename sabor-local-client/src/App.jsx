import { useState, useEffect } from 'react';
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
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [avisoReconectado, setAvisoReconectado] = useState(false);

  // Estado de Autenticación y Roles: null (invitado/login), 'CLIENTE', 'NEGOCIO', 'SUPERADMIN'
  const [sesion, setSesion] = useState(() => {
    try {
      const porPestana = sessionStorage.getItem('saborlocal_sesion_tab');
      if (porPestana) return JSON.parse(porPestana);
      if (!navigator.onLine) {
        const respaldoOffline = localStorage.getItem('saborlocal_sesion_offline');
        return respaldoOffline ? JSON.parse(respaldoOffline) : null;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [vistaAuth, setVistaAuth] = useState('login'); // 'login', 'elegir-registro', 'reg-cliente', 'reg-negocio'

  const [vistaActual, setVistaActual] = useState(() => {
    try {
      const porPestana = sessionStorage.getItem('saborlocal_sesion_tab');
      const guardada = porPestana || (!navigator.onLine ? localStorage.getItem('saborlocal_sesion_offline') : null);
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

  // Campos de login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [cargandoLogin, setCargandoLogin] = useState(false);

  useEffect(() => {
    let timerReconexion;
    const manejarOnline = () => {
      setEnLinea(true);
      setAvisoReconectado(true);
      clearTimeout(timerReconexion);
      timerReconexion = setTimeout(() => {
        setAvisoReconectado(false);
      }, 4500);
    };
    const manejarOffline = () => {
      setEnLinea(false);
      setAvisoReconectado(false);
      clearTimeout(timerReconexion);
    };

    window.addEventListener('online', manejarOnline);
    window.addEventListener('offline', manejarOffline);

    return () => {
      window.removeEventListener('online', manejarOnline);
      window.removeEventListener('offline', manejarOffline);
      clearTimeout(timerReconexion);
    };
  }, []);

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
      if (Array.isArray(apiCache) && apiCache.length > 0) {
        return apiCache;
      }
      return Array.isArray(dirOffline) ? dirOffline : [];
    } catch {
      return [];
    }
  };

  const cargarComercios = () => {
    const respaldoLocal = obtenerComerciosOffline();

    if (!navigator.onLine) {
      if (respaldoLocal.length > 0) {
        setRestaurants(respaldoLocal);
        setError(null);
      } else {
        setError("Sin conexión y sin comercios guardados previamente en este dispositivo.");
      }
      setLoading(false);
      return;
    }

    api.get('/comercios')
      .then(response => {
        const lista = response.data || [];
        setRestaurants(lista);
        try {
          localStorage.setItem('cache_comercios_api', JSON.stringify(lista));
        } catch (e) {
          console.error('Error al guardar comercios en caché:', e);
        }
        setError(null);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error al conectar con la API:", err);
        if (respaldoLocal.length > 0) {
          setRestaurants(respaldoLocal);
          setError(null);
        } else {
          setError("No se pudo conectar con el servidor local o la ruta de la API.");
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    cargarComercios();
    const intervalo = setInterval(() => {
      if (navigator.onLine) {
        cargarComercios();
      }
    }, 4000);
    return () => clearInterval(intervalo);
  }, [enLinea]);

  const activarSesionUsuario = (usuario, correoIngresado = '') => {
    if (!usuario) return false;

    const rolRaw = String(usuario.rol || usuario.Rol || '').toUpperCase().trim();
    const correoRaw = String(usuario.correo || usuario.Correo || correoIngresado || '').toLowerCase().trim();

    // 1. Super Admin
    if (rolRaw.includes('SUPERADMIN') || rolRaw === 'SUPER_ADMIN') {
      setSesion({
        rol: 'SUPERADMIN',
        nombre: usuario.nombre || usuario.Nombre || 'Super Administrador'
      });
      setVistaActual('superadmin');
      return true;
    }

    // 2. Negocio / Restaurante (solo si explícitamente es negocio/restaurante o tiene comercioId/ADMIN_RESTAURANT)
    if (
      rolRaw.includes('NEGOCIO') ||
      rolRaw.includes('RESTAURANT') ||
      rolRaw.includes('COMERCIO') ||
      usuario.comercioId ||
      usuario.ComercioId
    ) {
      setSesion({
        rol: 'NEGOCIO',
        nombre: usuario.nombreComercio || usuario.NombreComercio || usuario.nombre || usuario.Nombre || 'Mi Restaurante',
        comercioId: usuario.comercioId || usuario.ComercioId || usuario.id || usuario.Id || 1
      });
      setVistaActual('restaurante');
      return true;
    }

    // 3. Cliente (o cualquier usuario normal sin comercioId que no sea superadmin)
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

    // 4. Si el rol es ADMIN genérico sin comercio, mandarlo a SUPERADMIN
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

    // 1. Super Admin directo por correo/contraseña
    if ((emailLower.includes('admin') || emailLower.includes('superadmin')) && loginPassword === 'Admin123*') {
      setSesion({ rol: 'SUPERADMIN', nombre: 'Super Administrador' });
      setVistaActual('superadmin');
      setCargandoLogin(false);
      return;
    }

    // 2. Intentar validar en Backend API
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
      if (activarSesionUsuario(usuarioBackend, emailLower)) {
        setCargandoLogin(false);
        return;
      }
    } catch (err) {
      // Si el backend responde 401/403 o no hay red, revisamos respaldo local antes de bloquear
      console.warn("Login backend no disponible o rechazado, probando respaldo local:", err?.message);
    }

    // 3. Respaldo en localStorage: Negocios
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
        comercioId: comercioEnLocal.id || 1
      });
      setVistaActual('restaurante');
      setCargandoLogin(false);
      return;
    }

    // 4. Respaldo en localStorage: Clientes
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

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans selection:bg-purple-500 selection:text-white pb-20 relative overflow-x-hidden">

      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="bg-[#0b0f19]/90 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          <div
            onClick={() => { if (!sesion || sesion.rol === 'CLIENTE') setVistaActual('home'); }}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div className="w-11 h-11 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-purple-500/20 group-hover:scale-105 transition text-white">
              🍔
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Sabor Local <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-extrabold uppercase">Candelaria</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                {sesion ? `Rol Activo: ${sesion.rol}` : 'Plataforma Multi-Tenant'}
              </p>
            </div>
          </div>

          <div>
            {sesion ? (
              <div className="flex items-center gap-2.5 bg-[#121826] p-1.5 px-3 rounded-2xl border border-slate-800 shadow-inner">
                <span className="text-xs text-slate-300 font-bold hidden sm:inline">👤 {sesion.nombre}</span>

                {sesion.rol === 'CLIENTE' && (
                  <>
                    <button
                      onClick={() => setVistaActual('home')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        vistaActual === 'home'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      🍽️ Explorar Comercios
                    </button>

                    <button
                      onClick={() => setVistaActual('historial')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        vistaActual === 'historial'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      🧾 Mi Historial
                    </button>
                  </>
                )}

                {sesion.rol === 'NEGOCIO' && (
                  <button
                    onClick={() => setVistaActual('restaurante')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
                  >
                    👨‍🍳 Mi Panel de Negocio
                  </button>
                )}

                {sesion.rol === 'SUPERADMIN' && (
                  <button
                    onClick={() => setVistaActual('superadmin')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-700 to-indigo-800 text-white shadow-md"
                  >
                    🛡️ Gobernanza Super Admin
                  </button>
                )}

                <button
                  onClick={cerrarSesion}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 transition"
                  title="Cerrar Sesión"
                >
                  Salir 🚪
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[#121826] p-1.5 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setVistaAuth('login')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    vistaAuth === 'login' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🔐 Iniciar Sesión
                </button>
                <button
                  onClick={() => setVistaAuth('elegir-registro')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    vistaAuth !== 'login' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📝 Registrarse
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-8 relative z-10">

        {!enLinea && (
          <div className="mb-6 bg-amber-500/15 border border-amber-500/40 text-amber-200 px-5 py-3.5 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {sesion?.rol === 'NEGOCIO' || sesion?.rol === 'SUPERADMIN' ? (
              <span>
                📡 <strong>Sin conexión</strong>
              </span>
            ) : (
              <span>
                📡 <strong>Sin conexión a internet:</strong> Puedes consultar comercios y menús guardados. Los pedidos y actualizaciones en tiempo real se restablecerán hasta que vuelva la conexión.
              </span>
            )}
            <span className="font-bold text-amber-300 whitespace-nowrap">Modo Offline</span>
          </div>
        )}

        {enLinea && avisoReconectado && (
          <div className="mb-6 bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 px-5 py-3.5 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {sesion?.rol === 'NEGOCIO' || sesion?.rol === 'SUPERADMIN' ? (
              <span>
                🟢 <strong>De nuevo en línea</strong>
              </span>
            ) : (
              <span>
                🟢 <strong>De nuevo en línea:</strong> La conexión a internet se ha restablecido.
              </span>
            )}
            <span className="font-bold text-emerald-300 whitespace-nowrap">En Línea</span>
          </div>
        )}

        {!sesion ? (
          <div className="max-w-md mx-auto py-8">

            {vistaAuth === 'login' && (
              <div className="bg-[#121826] p-8 rounded-3xl shadow-2xl border border-slate-800 space-y-6">
                <div className="text-center space-y-2">
                  <span className="text-3xl">🔐</span>
                  <h2 className="text-2xl font-black text-white">Iniciar Sesión</h2>
                  <p className="text-xs text-slate-400">Ingresa a tu cuenta verificada en Sabor Local.</p>
                </div>

                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-2xl text-center text-xs font-semibold">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Correo Electrónico Registrado</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="ej. tu_correo@mail.com"
                      required
                      className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                      className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={cargandoLogin}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-lg shadow-purple-600/30 transition"
                  >
                    {cargandoLogin ? "Verificando..." : "Entrar a la Plataforma 🚀"}
                  </button>
                </form>

                <div className="text-center pt-2 border-t border-slate-800">
                  <p className="text-xs text-slate-400">
                    ¿No tienes cuenta?{' '}
                    <button onClick={() => setVistaAuth('elegir-registro')} className="text-purple-400 font-bold hover:underline">
                      Regístrate aquí
                    </button>
                  </p>
                </div>
              </div>
            )}

            {vistaAuth === 'elegir-registro' && (
              <div className="bg-[#121826] p-8 rounded-3xl shadow-2xl border border-slate-800 space-y-6 text-center">
                <div className="space-y-2">
                  <span className="text-3xl">📝</span>
                  <h2 className="text-2xl font-black text-white">¿Cómo deseas registrarte?</h2>
                  <p className="text-xs text-slate-400">Elige el tipo de cuenta que quieres crear en Sabor Local.</p>
                </div>

                <div className="space-y-4 pt-2">
                  <button
                    onClick={() => setVistaAuth('reg-cliente')}
                    className="w-full bg-slate-800 hover:bg-purple-950/40 border border-slate-700 hover:border-purple-500/50 p-5 rounded-2xl text-left transition flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="font-extrabold text-white text-sm group-hover:text-purple-400">👤 Registrar Usuario / Cliente</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Quiero explorar menús y pedir comida a domicilio.</p>
                    </div>
                    <span className="text-purple-400">→</span>
                  </button>

                  <button
                    onClick={() => setVistaAuth('reg-negocio')}
                    className="w-full bg-slate-800 hover:bg-purple-950/40 border border-slate-700 hover:border-purple-500/50 p-5 rounded-2xl text-left transition flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="font-extrabold text-white text-sm group-hover:text-purple-400">🏪 Registrar mi Negocio</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Tengo un restaurante y quiero vender en la app.</p>
                    </div>
                    <span className="text-purple-400">→</span>
                  </button>
                </div>

                <button
                  onClick={() => setVistaAuth('login')}
                  className="text-xs text-slate-400 hover:text-white underline pt-2 block mx-auto"
                >
                  ← Volver al Iniciar Sesión
                </button>
              </div>
            )}

            {vistaAuth === 'reg-cliente' && (
              <div className="space-y-4">
                <RegistroCliente
                  onRegistroExitoso={() => setVistaAuth('login')}
                  onVolver={() => setVistaAuth('elegir-registro')}
                />
              </div>
            )}

            {vistaAuth === 'reg-negocio' && (
              <div className="space-y-4">
                <RegistroRestaurante onRegistroExitoso={() => { cargarComercios(); setVistaAuth('login'); }} />
                <div className="text-center">
                  <button onClick={() => setVistaAuth('elegir-registro')} className="text-xs text-slate-400 hover:text-white underline">
                    ← Volver al opciones de registro
                  </button>
                </div>
              </div>
            )}

          </div>
        ) : (

          <>
            {sesion.rol === 'SUPERADMIN' && <PanelSuperAdmin />}

            {sesion.rol === 'NEGOCIO' && (
              <PanelRestaurante comercioId={sesion.comercioId || 1} nombreComercio={sesion.nombre || "Mi Restaurante"} />
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
                />
              ) : vistaActual === 'clientemenu' && comercioSeleccionado ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setVistaActual('home')}
                    className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-2 bg-[#121826] px-4 py-3 rounded-2xl border border-slate-800 w-fit transition shadow-lg"
                  >
                    ← Volver al listado de comercios
                  </button>
                  <ClienteVista comercio={comercioSeleccionado} />
                </div>
              ) : (
                <div className="space-y-8">

                  <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-950 via-[#121826] to-purple-950 p-8 sm:p-12 shadow-2xl border border-purple-500/20 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="space-y-3 max-w-xl z-10">
                      <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full">
                        ✨ Red Gastronómica Exclusiva
                      </span>
                      <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-md">
                        La mejor comida de Candelaria a tu alcance.
                      </h2>
                      <p className="text-slate-400 text-xs sm:text-sm font-medium">
                        Pide directamente a tus restaurantes locales favoritos con menús digitales en tiempo real.
                      </p>
                    </div>

                    <div className="w-full md:w-80 z-10">
                      <input
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="🔍 Buscar negocio o categoría..."
                        className="w-full px-4 py-3.5 bg-[#0b0f19] text-white rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xl text-xs placeholder:text-slate-400 border border-slate-800"
                      />
                    </div>
                  </div>

                  {loading && restaurants.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-8">Cargando comercios...</p>
                  ) : error && restaurants.length === 0 ? (
                    <p className="text-center text-xs text-amber-300 py-8">{error}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {restaurantesFiltrados.map((resto) => (
                        <div
                          key={resto.id}
                          onClick={() => { setComercioSeleccionado(resto); setVistaActual('clientemenu'); }}
                          className="bg-[#121826] rounded-3xl overflow-hidden border border-slate-800 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1.5 shadow-2xl cursor-pointer group flex flex-col justify-between"
                        >
                          <div>
                            <div className="h-28 bg-gradient-to-br from-purple-950/60 via-slate-900 to-[#121826] p-4 flex justify-between items-start relative overflow-hidden border-b border-slate-800">
                              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-3 py-1 rounded-full uppercase">
                                {enLinea ? 'ABIERTO' : 'GUARDADO'}
                              </span>
                              <span className="bg-[#0b0f19] text-purple-300 text-[11px] font-bold px-3 py-1 rounded-full border border-slate-800">
                                📍 Candelaria
                              </span>
                            </div>
                            <div className="p-6 space-y-2.5">
                              <h3 className="text-lg font-black text-white group-hover:text-purple-400 transition">
                                {resto.nombreComercio}
                              </h3>
                              {resto.categoria && (
                                <span className="bg-purple-500/20 text-purple-300 text-[11px] px-2.5 py-0.5 rounded-lg font-bold inline-block">
                                  🏷️ {resto.categoria}
                                </span>
                              )}
                              <p className="text-xs text-slate-400">📍 {resto.direccion || "Candelaria, Campeche"}</p>
                            </div>
                          </div>
                          <div className="p-6 pt-0">
                            <div className="w-full bg-slate-800 group-hover:bg-purple-600 text-slate-200 group-hover:text-white font-bold py-3 rounded-2xl transition text-xs text-center border border-slate-700">
                              {enLinea ? 'Ver Menú y Comprar →' : 'Ver Menú Guardado →'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )
            )}
          </>
        )}

      </main>

      <footer className="border-t border-slate-800 bg-[#0b0f19] mt-20 py-8 text-center text-xs text-slate-500 font-medium">
        <p>© 2026 Sabor Local — Sistema Multi-Tenant de Grado Profesional para Candelaria, Campeche.</p>
      </footer>
    </div>
  );
}

export default App;