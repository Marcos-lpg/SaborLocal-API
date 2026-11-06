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

        // GET: api/comercios (Los clientes solo ven los comercios APROBADOS)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Comercio>>> GetComerciosAprobados()
        {
            return await _context.Comercios
                .Where(c => c.Estado == "APROBADO")
                .ToListAsync();
        }

        // GET: api/comercios/admin/todos (Para el panel del Super Administrador: muestra todos)
        [HttpGet("admin/todos")]
        public async Task<ActionResult<IEnumerable<Comercio>>> GetTodosLosComerciosAdmin()
        {
            return await _context.Comercios.ToListAsync();
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
                    Categoria = string.IsNullOrEmpty(dto.Categoria) ? "Comida General" : dto.Categoria, // 👈 Categoría libre
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
        public string Categoria { get; set; } = string.Empty; // 👈 Captura la categoría escrita por el dueño
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
}