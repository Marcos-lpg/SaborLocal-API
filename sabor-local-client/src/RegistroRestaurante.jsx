
import { useState, useEffect, useRef } from 'react';
import api from './ApiClient';
import VerificacionCodigo from './VerificacionCodigo';

function RegistroRestaurante({ onRegistroExitoso }) {
  const [formData, setFormData] = useState({
    nombreComercio: '',
    categoria: '',
    direccion: '',
    telefonoComercio: '',
    metodosPago: '',
    nombreDuenio: '',
    correoDuenio: '',
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
    if (name === 'telefonoComercio') {
      const soloNumeros = value.replace(/\D/g, '').slice(0, 10);
      setFormData({ ...formData, telefonoComercio: soloNumeros });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleContinuarAVerificacion = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.correoDuenio.trim()) {
      setError("Por favor ingresa un correo electrónico válido.");
      return;
    }

    if (formData.telefonoComercio.length !== 10) {
      setError("El teléfono del comercio debe tener exactamente 10 dígitos numéricos.");
      return;
    }

    setPasoVerificacion(true);
  };

  const completarRegistroNegocio = async () => {
    const emailLower = formData.correoDuenio.toLowerCase().trim();

    try {
      const payloadDto = {
        nombreComercio: formData.nombreComercio.trim(),
        categoria: formData.categoria.trim() || "Comida General",
        direccion: formData.direccion.trim(),
        telefonoComercio: formData.telefonoComercio.trim(),
        metodosPago: formData.metodosPago.trim() || "Efectivo, Transferencia",
        nombreDuenio: formData.nombreDuenio.trim(),
        correoDuenio: emailLower,
        contrasena: formData.contrasena
      };

      await api.post('/comercios/solicitud', payloadDto);

      mostrarNotificacion(
        "¡Correo verificado con éxito! Solicitud de negocio enviada al Super Administrador.",
        "exito"
      );

      setTimeout(() => {
        if (onRegistroExitoso) onRegistroExitoso();
      }, 1200);
    } catch (err) {
      console.error("Error al registrar el comercio en la API:", err);
      const mensajeError =
        err.response?.data?.mensaje ||
        err.response?.data ||
        "Hubo un error al registrar el negocio en el servidor.";
      setError(typeof mensajeError === 'string' ? mensajeError : "Error al registrar el negocio.");
      setPasoVerificacion(false);
    }
  };

  if (pasoVerificacion) {
    return (
      <VerificacionCodigo
        correo={formData.correoDuenio}
        tipoRegistro="Negocio / Restaurante"
        onVerificado={completarRegistroNegocio}
        onCancelar={() => setPasoVerificacion(false)}
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto my-10 neon-amber-card bg-[#0e1b26] p-8 rounded-3xl text-slate-100">
      {notificacion && (
        <div className="mb-5 bg-emerald-500/15 border border-emerald-400/50 text-emerald-200 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-[0_0_14px_rgba(16,185,129,0.25)]">
          <span>🎉 {notificacion.mensaje}</span>
          <button
            type="button"
            onClick={() => setNotificacion(null)}
            className="text-emerald-100 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <div className="text-center space-y-2 mb-8">
        <div className="icon-3d-pod w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto">
          🏪
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">Registro de Restaurante</h2>
        <p className="text-xs text-slate-400 font-medium">
          Integra tu comercio a la red gastronómica de Sabor Local Candelaria
        </p>
      </div>

      {error && (
        <div className="bg-red-500/15 border border-red-400/50 text-red-200 p-3.5 rounded-2xl text-center text-xs font-semibold mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleContinuarAVerificacion} autoComplete="off" className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Nombre del Comercio</label>
            <input
              type="text"
              name="nombreComercio"
              value={formData.nombreComercio}
              onChange={handleChange}
              autoComplete="off"
              required
              placeholder="Ej. Carnitas El Tao Tao"
              className="w-full px-4 py-3 bg-[#070e14] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Categoría (Libre)</label>
            <input
              type="text"
              name="categoria"
              value={formData.categoria}
              onChange={handleChange}
              autoComplete="off"
              placeholder="Ej. Carnitas / Antojitos"
              className="w-full px-4 py-3 bg-[#070e14] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Dirección del Local</label>
          <input
            type="text"
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
            autoComplete="off"
            required
            placeholder="Ej. Calle 8 Guanajuato, Candelaria"
            className="w-full px-4 py-3 bg-[#070e14] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-medium"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Teléfono del Comercio (10 dígitos)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              name="telefonoComercio"
              value={formData.telefonoComercio}
              onChange={handleChange}
              autoComplete="off"
              required
              placeholder="Ej. 9821165370"
              className="w-full px-4 py-3 bg-[#070e14] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Métodos de Pago</label>
            <input
              type="text"
              name="metodosPago"
              value={formData.metodosPago}
              onChange={handleChange}
              autoComplete="off"
              placeholder="Ej. Efectivo, Transferencia"
              className="w-full px-4 py-3 bg-[#070e14] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-medium"
            />
          </div>
        </div>

        <div className="border-t border-white/10 pt-4 mt-2">
          <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-4">Credenciales del Dueño</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Nombre del Dueño</label>
              <input
                type="text"
                name="nombreDuenio"
                value={formData.nombreDuenio}
                onChange={handleChange}
                autoComplete="off"
                required
                placeholder="Ej. Marcos Antonio"
                className="w-full px-4 py-3 bg-[#070e14] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Correo Electrónico (Para OTP)</label>
                <input
                  type="email"
                  name="correoDuenio"
                  value={formData.correoDuenio}
                  onChange={handleChange}
                  autoComplete="off"
                  required
                  placeholder="tucorreo@gmail.com"
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
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="neon-btn-orange w-full text-white font-black py-3.5 rounded-2xl text-xs transition duration-300 mt-4 cursor-pointer"
        >
          Enviar Solicitud y Verificar Correo ✉️
        </button>
      </form>
    </div>
  );
}

export default RegistroRestaurante;
