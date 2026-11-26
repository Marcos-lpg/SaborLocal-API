using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaborLocal.API.Data;
using SaborLocal.API.Models;

namespace SaborLocal.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ComerciosController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ComerciosController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/comercios (ESTRICTO: Los clientes SOLO ven los comercios APROBADOS)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Comercio>>> GetComerciosAprobados()
        {
            return await _context.Comercios
                .Where(c => c.Estado != null && c.Estado.ToUpper() == "APROBADO")
                .ToListAsync();
        }

        // GET: api/comercios/admin/todos (Para el panel del Super Administrador: muestra todos)
        [HttpGet("admin/todos")]
        public async Task<ActionResult<IEnumerable<Comercio>>> GetTodosLosComerciosAdmin()
        {
            return await _context.Comercios.ToListAsync();
        }

        // GET: api/comercios/5 (Obtiene el detalle actualizado de un comercio específico)
        [HttpGet("{id}")]
        public async Task<ActionResult<Comercio>> GetComercioPorId(int id)
        {
            var comercio = await _context.Comercios.FindAsync(id);
            if (comercio == null)
            {
                return NotFound("Comercio no encontrado.");
            }
            return comercio;
        }

        // POST: api/comercios/solicitud (Registro completo con Categoria libre en estado PENDIENTE)
        [HttpPost("solicitud")]
        public async Task<IActionResult> RegistrarSolicitud([FromBody] RegistroRestauranteDto dto)
        {
            try
            {
                if (await _context.Usuarios.AnyAsync(u => u.Correo == dto.CorreoDuenio))
                {
                    return BadRequest("El correo electrónico del dueño ya se encuentra registrado.");
                }

                var nuevoComercio = new Comercio
                {
                    NombreComercio = dto.NombreComercio,
                    Categoria = string.IsNullOrEmpty(dto.Categoria) ? "Comida General" : dto.Categoria,
                    Direccion = dto.Direccion,
                    Telefono = dto.TelefonoComercio,
                    MetodosPago = string.IsNullOrEmpty(dto.MetodosPago) ? "Efectivo, Transferencia" : dto.MetodosPago,
                    Estado = "PENDIENTE",
                    FechaCreacion = DateTime.UtcNow
                };

                _context.Comercios.Add(nuevoComercio);
                await _context.SaveChangesAsync();

                var nuevoUsuario = new Usuario
                {
                    Nombre = dto.NombreDuenio,
                    Correo = dto.CorreoDuenio,
                    Telefono = dto.TelefonoComercio,
                    ContrasenaHash = dto.Contrasena,
                    Rol = "ADMIN_RESTAURANTE",
                    ComercioId = nuevoComercio.Id
                };

                _context.Usuarios.Add(nuevoUsuario);
                await _context.SaveChangesAsync();

                return Ok(new { mensaje = "Solicitud enviada con éxito. En espera de validación del Super Administrador." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno al procesar la solicitud: {ex.Message}");
            }
        }

        // PUT: api/comercios/estado/5 (Actualiza a APROBADO, SUSPENDIDO, etc.)
        [HttpPut("estado/{id}")]
        public async Task<IActionResult> ActualizarEstadoComercio(int id, [FromBody] EstadoDto dto)
        {
            var comercio = await _context.Comercios.FindAsync(id);
            if (comercio == null)
            {
                return NotFound("Comercio no encontrado.");
            }

            comercio.Estado = dto.Estado;
            _context.Entry(comercio).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = $"Estado actualizado a {dto.Estado} exitosamente." });
        }

        // PUT: api/comercios/5/caja (Abrir o cerrar caja / iniciar ventas o cerrar día)
        [HttpPut("{id}/caja")]
        public async Task<IActionResult> ActualizarEstadoCaja(int id, [FromBody] CajaDto dto)
        {
            var comercio = await _context.Comercios.FindAsync(id);
            if (comercio == null)
            {
                return NotFound("Comercio no encontrado.");
            }

            comercio.EstaAbierto = dto.EstaAbierto;
            if (!dto.EstaAbierto)
            {
                comercio.UltimoCierreCaja = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = dto.EstaAbierto
                    ? "Ventas iniciadas. Tu restaurante ahora aparece Abierto para los clientes."
                    : "Caja cerrada. Tu restaurante ahora aparece Cerrado y las ventas del turno se reiniciaron.",
                estaAbierto = comercio.EstaAbierto,
                ultimoCierreCaja = comercio.UltimoCierreCaja
            });
        }

        // PUT: api/comercios/5/configuracion (Actualiza horario, tiempo de preparación, envío y logo)
        [HttpPut("{id}/configuracion")]
        public async Task<IActionResult> ActualizarConfiguracionComercio(int id, [FromBody] ConfiguracionComercioDto dto)
        {
            var comercio = await _context.Comercios.FindAsync(id);
            if (comercio == null)
            {
                return NotFound("Comercio no encontrado.");
            }

            if (dto.CostoEnvio < 0)
            {
                return BadRequest("El costo de envío no puede ser negativo.");
            }

            if (dto.HorarioAtencion != null)
            {
                comercio.HorarioAtencion = dto.HorarioAtencion.Trim();
            }

            if (dto.TiempoPreparacion != null)
            {
                comercio.TiempoPreparacion = dto.TiempoPreparacion.Trim();
            }

            comercio.EnvioGratis = dto.EnvioGratis;
            comercio.CostoEnvio = dto.EnvioGratis ? 0m : dto.CostoEnvio;

            if (dto.LogoUrl != null)
            {
                comercio.LogoUrl = string.IsNullOrWhiteSpace(dto.LogoUrl) ? null : dto.LogoUrl;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = "Configuración del restaurante actualizada correctamente.",
                comercio
            });
        }

        // DELETE: api/comercios/5 (Elimina comercio y sus usuarios asociados)
        [HttpDelete("{id}")]
        public async Task<IActionResult> EliminarComercio(int id)
        {
            var comercio = await _context.Comercios.FindAsync(id);
            if (comercio == null)
            {
                return NotFound("Comercio no encontrado.");
            }

            var usuariosAsociados = await _context.Usuarios.Where(u => u.ComercioId == id).ToListAsync();
            _context.Usuarios.RemoveRange(usuariosAsociados);

            _context.Comercios.Remove(comercio);
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Comercio eliminado correctamente." });
        }
    }

    // DTOs auxiliares
    public class RegistroRestauranteDto
    {
        public string NombreComercio { get; set; } = string.Empty;
        public string Categoria { get; set; } = string.Empty; // 👈 Corregido el signo de dos puntos por el igual
        public string Direccion { get; set; } = string.Empty;
        public string TelefonoComercio { get; set; } = string.Empty;
        public string MetodosPago { get; set; } = string.Empty;
        public string NombreDuenio { get; set; } = string.Empty;
        public string CorreoDuenio { get; set; } = string.Empty;
        public string Contrasena { get; set; } = string.Empty;
    }

    public class EstadoDto
    {
        public string Estado { get; set; } = string.Empty;
    }

    public class CajaDto
    {
        public bool EstaAbierto { get; set; }
    }

    public class ConfiguracionComercioDto
    {
        public string? HorarioAtencion { get; set; }
        public string? TiempoPreparacion { get; set; }
        public bool EnvioGratis { get; set; } = true;
        public decimal CostoEnvio { get; set; } = 0m;
        public string? LogoUrl { get; set; }
    }
}