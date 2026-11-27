import { useState } from 'react';
import api from './ApiClient';

function Login({ onLoginExitoso, onIrARegistro }) {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const emailLower = correo.toLowerCase().trim();

    try {
      const response = await api.post('/auth/login', { correo: emailLower, contrasena });
      const { token, usuario } = response.data;
      localStorage.setItem('token', token);
      onLoginExitoso(usuario);
    } catch (err) {
      // 1. Super Admin de respaldo
      if (emailLower.includes('admin') && contrasena === 'Admin123*') {
        onLoginExitoso({ rol: 'SUPERADMIN', nombre: 'Super Admin', correo });
        return;
      }

      // 2. Validar Negocios guardados localmente
      const comerciosLocales = JSON.parse(localStorage.getItem('comercios_registrados') || '[]');
      const comercioEncontrado = comerciosLocales.find(c => c.correoDuenio === emailLower);

      if (comercioEncontrado) {
        if (comercioEncontrado.contrasena !== contrasena) {
          setError("❌ Contraseña incorrecta para este negocio.");
          setCargando(false);
          return;
        }
        onLoginExitoso({ 
          rol: 'NEGOCIO', 
          nombre: comercioEncontrado.nombreComercio || 'Mi Restaurante', 
          comercioId: comercioEncontrado.id || 1, 
          correo 
        });
        return;
      }

      // 3. Validar Clientes verificados por OTP
      const clientesVerificados = JSON.parse(localStorage.getItem('clientes_verificados') || '[]');
      const clienteEncontrado = clientesVerificados.find(cli => cli.correo === emailLower);

      if (clienteEncontrado) {
        if (clienteEncontrado.contrasena !== contrasena) {
          setError("❌ Contraseña incorrecta.");
          setCargando(false);
          return;
        }
        onLoginExitoso({ 
          rol: 'CLIENTE', 
          nombre: clienteEncontrado.nombreCompleto || 'Cliente', 
          correo 
        });
      } else {
        setError("❌ Acceso denegado: Este correo no está registrado o no ha verificado su código de 6 dígitos.");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-[#121826] p-8 rounded-3xl shadow-2xl border border-slate-800 text-slate-100">
      <div className="text-center space-y-2 mb-6">
        <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-lg shadow-purple-500/20">
          🔐
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">Iniciar Sesión</h2>
        <p className="text-xs text-slate-400 font-medium">
          Accede a tu cuenta verificada de Sabor Local Candelaria
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-2xl text-center text-xs font-semibold mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Correo Electrónico Verificado</label>
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
            placeholder="ejemplo@correo.com"
            className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Contraseña</label>
          <input
            type="password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition font-medium"
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-xl shadow-purple-600/25 transition duration-300 mt-2"
        >
          {cargando ? "Verificando..." : "Entrar a la Plataforma 🚀"}
        </button>
      </form>

      <div className="text-center pt-6 border-t border-slate-800/80 mt-6">
        <p className="text-xs text-slate-400">
          ¿Aún no tienes cuenta?{' '}
          <button
            type="button"
            onClick={onIrARegistro}
            className="text-purple-400 font-extrabold hover:underline transition"
          >
            Regístrate aquí
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;