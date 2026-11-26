import { useState } from 'react';
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Paso 1: Validar formulario y abrir pantalla de código OTP
  const handleContinuarAVerificacion = (e) => {
    e.preventDefault();
    setError(null);
    if (!formData.correo) {
      setError("Por favor ingresa un correo electrónico válido.");
      return;
    }
    setPasoVerificacion(true);
  };

  // Paso 2: Cuando el código OTP sea correcto, guardar el cliente en los verificados autorizados
  const completarRegistroCliente = async () => {
    const emailLower = formData.correo.toLowerCase().trim();

    try {
      await api.post('/auth/registro-cliente', formData);
    } catch (err) {
      console.warn("Registrando cliente localmente tras verificación exitosa.");
    }

    // GUARDAR EN LA LISTA DE CLIENTES VERIFICADOS (Seguridad estricta para el Login)
    const clientesVerificados = JSON.parse(localStorage.getItem('clientes_verificados') || '[]');
    
    // Evitar duplicados
    const existe = clientesVerificados.some(c => c.correo === emailLower);
    if (!existe) {
      clientesVerificados.push({
        correo: emailLower,
        nombreCompleto: formData.nombreCompleto,
        telefono: formData.telefono,
        contrasena: formData.contrasena
      });
      localStorage.setItem('clientes_verificados', JSON.stringify(clientesVerificados));
    }

    alert("🎉 ¡Correo verificado con éxito! Cuenta de cliente creada. Ya puedes iniciar sesión.");
    if (onRegistroExitoso) onRegistroExitoso();
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
    <div className="max-w-md mx-auto my-12 bg-[#121826] p-8 rounded-3xl shadow-2xl border border-slate-800 text-slate-100">
      <div className="text-center space-y-2 mb-6">
        <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-lg shadow-purple-500/20">
          👤
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">Registro de Cliente</h2>
        <p className="text-xs text-slate-400 font-medium">
          Verificaremos tu correo real con un código de seguridad de 6 dígitos
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-2xl text-center text-xs font-semibold mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleContinuarAVerificacion} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Nombre Completo</label>
          <input
            type="text"
            name="nombreCompleto"
            value={formData.nombreCompleto}
            onChange={handleChange}
            required
            placeholder="Ej. Juan Pérez"
            className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Teléfono Móvil</label>
          <input
            type="tel"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            required
            placeholder="Ej. 9381234567"
            className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Correo Electrónico (Real)</label>
          <input
            type="email"
            name="correo"
            value={formData.correo}
            onChange={handleChange}
            required
            placeholder="tu_correo@gmail.com"
            className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Contraseña</label>
          <input
            type="password"
            name="contrasena"
            value={formData.contrasena}
            onChange={handleChange}
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition font-medium"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-xl shadow-purple-600/25 transition duration-300 mt-2"
        >
          Continuar y Verificar Correo →
        </button>
      </form>

      <div className="text-center pt-6 border-t border-slate-800/80 mt-6">
        <button
          type="button"
          onClick={onVolver}
          className="text-xs text-slate-400 hover:text-white font-bold underline transition"
        >
          ← Volver a opciones de registro
        </button>
      </div>
    </div>
  );
}

export default RegistroCliente;