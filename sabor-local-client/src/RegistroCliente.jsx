import { useState, useEffect, useRef } from 'react';
import api from './ApiClient';
import VerificacionCodigo from './VerificacionCodigo';

function RegistroCliente({ onRegistroExitoso, onVolver }) {
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    telefono: '',
    correo: '',
    contrasena: ''
  });

  const [pasoVerificacion, setPasoVerificacion] = useState(false);
  const [error, setError] = useState(null);
  const [notificacion, setNotificacion] = useState(null);
  const timerNotiRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(timerNotiRef.current);
  }, []);

  const mostrarNotificacion = (mensaje, tipo = 'exito') => {
    setNotificacion({ mensaje, tipo });
    clearTimeout(timerNotiRef.current);
    timerNotiRef.current = setTimeout(() => {
      setNotificacion(null);
    }, 4500);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'telefono') {
      const soloNumeros = value.replace(/\D/g, '').slice(0, 10);
      setFormData({ ...formData, telefono: soloNumeros });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleContinuarAVerificacion = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.correo.trim()) {
      setError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (formData.telefono.length !== 10) {
      setError('El teléfono móvil debe tener exactamente 10 dígitos numéricos.');
      return;
    }

    setPasoVerificacion(true);
  };

  const completarRegistroCliente = async () => {
    const emailLower = formData.correo.toLowerCase().trim();
    const nombreLimpio = formData.nombreCompleto.trim();
    const telefonoLimpio = formData.telefono.trim();

    try {
      await api.post('/auth/registro-cliente', {
        ...formData,
        nombreCompleto: nombreLimpio,
        telefono: telefonoLimpio
      });
    } catch {
      // Registrando localmente si el backend no responde en ese momento
    }

    const clientesVerificados = JSON.parse(localStorage.getItem('clientes_verificados') || '[]');
    const existe = clientesVerificados.some((c) => c.correo === emailLower);
    if (!existe) {
      clientesVerificados.push({
        correo: emailLower,
        nombreCompleto: nombreLimpio,
        telefono: telefonoLimpio,
        contrasena: formData.contrasena
      });
      localStorage.setItem('clientes_verificados', JSON.stringify(clientesVerificados));
    }

    mostrarNotificacion(
      '¡Correo verificado con éxito! Cuenta de cliente creada. Ya puedes iniciar sesión.',
      'exito'
    );

    setTimeout(() => {
      if (onRegistroExitoso) onRegistroExitoso();
    }, 1200);
  };

  if (pasoVerificacion) {
    return (
      <VerificacionCodigo
        correo={formData.correo}
        tipoRegistro="Cliente"
        onVerificado={completarRegistroCliente}
        onCancelar={() => setPasoVerificacion(false)}
      />
    );
  }

  return (
    <div className="max-w-md mx-auto my-10 neon-amber-card bg-[#0e1b26] p-8 rounded-3xl text-slate-100 relative">
      {notificacion && (
        <div className="mb-4 bg-emerald-500/15 border border-emerald-400/50 text-emerald-200 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-[0_0_14px_rgba(16,185,129,0.25)]">
          <span>✅ {notificacion.mensaje}</span>
          <button
            type="button"
            onClick={() => setNotificacion(null)}
            className="text-emerald-100 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <div className="text-center space-y-2 mb-6">
        <div className="icon-3d-pod w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto">
          👤
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">Registro de Cliente</h2>
        <p className="text-xs text-slate-400 font-medium">
          Verificaremos tu correo real con un código de seguridad de 6 dígitos
        </p>
      </div>

      {error && (
        <div className="bg-red-500/15 border border-red-400/50 text-red-200 p-3.5 rounded-2xl text-center text-xs font-semibold mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleContinuarAVerificacion} autoComplete="off" className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Nombre Completo</label>
          <input
            type="text"
            name="nombreCompleto"
            value={formData.nombreCompleto}
            onChange={handleChange}
            autoComplete="off"
            required
            placeholder="Ej. Juan Pérez"
            className="w-full px-4 py-3 bg-[#070e14] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Teléfono Móvil (10 dígitos)</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            autoComplete="off"
            required
            placeholder="Ej. 9381234567"
            className="w-full px-4 py-3 bg-[#070e14] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Correo Electrónico (Real)</label>
          <input
            type="email"
            name="correo"
            value={formData.correo}
            onChange={handleChange}
            autoComplete="off"
            required
            placeholder="tu_correo@gmail.com"
            className="w-full px-4 py-3 bg-[#070e14] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Contraseña</label>
          <input
            type="password"
            name="contrasena"
            value={formData.contrasena}
            onChange={handleChange}
            autoComplete="new-password"
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 bg-[#070e14] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-medium"
          />
        </div>

        <button
          type="submit"
          className="neon-btn-orange w-full text-white font-black py-3.5 rounded-2xl text-xs transition duration-300 mt-2 cursor-pointer"
        >
          Continuar y Verificar Correo →
        </button>
      </form>

      <div className="text-center pt-6 border-t border-white/10 mt-6">
        <button
          type="button"
          onClick={onVolver}
          className="text-xs text-amber-300 hover:text-amber-200 font-bold underline transition cursor-pointer"
        >
          ← Volver a opciones de registro
        </button>
      </div>
    </div>
  );
}

export default RegistroCliente;
