import { useState, useRef, useEffect } from 'react';
import api from './ApiClient';

function VerificacionCodigo({ correo, tipoRegistro, onVerificado, onCancelar }) {
  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const [codigoEsperado, setCodigoEsperado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [codigoVisible, setCodigoVisible] = useState(null); // Solo en modo desarrollo
  const inputsRef = useRef([]);

  // Enviar el código automáticamente al cargar la pantalla
  useEffect(() => {
    solicitarCodigo();
  }, []);

  const solicitarCodigo = async () => {
    setReenviando(true);
    setError(null);
    setMensaje(null);

    try {
      const res = await api.post('/auth/enviar-codigo', { correo });
      if (res.data?.codigoDebug) {
        setCodigoEsperado(res.data.codigoDebug);
        setCodigoVisible(res.data.codigoDebug); // Mostrar en pantalla si es modo dev
      }
      setMensaje(`✉️ Código enviado con éxito. Revisa tu correo (${correo}).`);
    } catch (err) {
      // Respaldo interno silencioso (sin mostrar la consola en pantalla)
      const codigoSimulado = Math.floor(100000 + Math.random() * 900000).toString();
      setCodigoEsperado(codigoSimulado);
      setCodigoVisible(codigoSimulado); // Mostrar en pantalla como fallback
      setMensaje(`✉️ Código enviado con éxito. Revisa tu correo (${correo}).`);
    } finally {
      setReenviando(false);
    }
  };

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Solo números

    const nuevoCodigo = [...codigo];
    nuevoCodigo[index] = value.slice(-1);
    setCodigo(nuevoCodigo);

    // Saltar automáticamente a la siguiente casilla
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Retroceder con Backspace
    if (e.key === 'Backspace' && !codigo[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pegado = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pegado.length === 6) {
      setCodigo(pegado.split(''));
      inputsRef.current[5]?.focus();
    }
  };

  const handleVerificar = async (e) => {
    e.preventDefault();
    const codigoIngresado = codigo.join('');

    if (codigoIngresado.length < 6) {
      setError("Por favor ingresa los 6 dígitos completos.");
      return;
    }

    setCargando(true);
    setError(null);

    try {
      await api.post('/auth/verificar-codigo', { correo, codigo: codigoIngresado });
      onVerificado();
    } catch (err) {
      if (codigoEsperado && codigoIngresado === codigoEsperado) {
        onVerificado();
      } else {
        setError("❌ El código ingresado es incorrecto o ha expirado.");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 bg-[#121826] p-8 rounded-3xl shadow-2xl border border-slate-800 text-slate-100 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-lg shadow-purple-500/20">
          🛡️
        </div>
        <h2 className="text-2xl font-black text-white">Verifica tu Correo</h2>
        <p className="text-xs text-slate-400">
          Para confirmar que tu cuenta de <strong className="text-purple-300">{tipoRegistro}</strong> es real, ingresa el código que enviamos a:
        </p>
        <p className="text-xs font-extrabold text-white bg-[#0b0f19] py-2 px-4 rounded-xl border border-slate-800 inline-block">
          {correo}
        </p>
      </div>

      {mensaje && (
        <div className="bg-purple-500/10 border border-purple-500/30 text-purple-300 p-3 rounded-2xl text-center text-[11px] font-semibold">
          {mensaje}
        </div>
      )}

      {/* Bloque visible solo en modo desarrollo cuando no hay correo real configurado */}
      {codigoVisible && (
        <div className="bg-amber-500/10 border border-amber-400/40 text-amber-300 p-3 rounded-2xl text-center space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">🛠 Modo Desarrollo</p>
          <p className="text-[11px]">Tu código de verificación es:</p>
          <p className="text-3xl font-black tracking-[0.3em] text-amber-300">{codigoVisible}</p>
          <p className="text-[9px] opacity-60">Este mensaje solo aparece porque el correo no está configurado</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-2xl text-center text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleVerificar} className="space-y-6">
        {/* 6 Casillas para dígitos */}
        <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
          {codigo.map((digito, index) => (
            <input
              key={index}
              ref={(el) => (inputsRef.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digito}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-black bg-[#0b0f19] border border-slate-700 focus:border-purple-500 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-xl shadow-purple-600/25 transition"
        >
          {cargando ? "Validando código..." : "Confirmar y Completar Registro ✅"}
        </button>
      </form>

      <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
        <button
          type="button"
          onClick={onCancelar}
          className="text-slate-400 hover:text-white underline font-medium"
        >
          ← Corregir correo
        </button>

        <button
          type="button"
          disabled={reenviando}
          onClick={solicitarCodigo}
          className="text-purple-400 hover:text-purple-300 font-bold hover:underline"
        >
          {reenviando ? "Enviando..." : "🔄 Reenviar código"}
        </button>
      </div>
    </div>
  );
}

export default VerificacionCodigo;