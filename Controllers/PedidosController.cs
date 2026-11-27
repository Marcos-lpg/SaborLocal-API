using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaborLocal.API.Data;
using SaborLocal.API.Models;

namespace SaborLocal.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PedidosController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PedidosController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidos()
        {
            return await _context.Pedidos
                .Include(p => p.Detalles)
                .OrderByDescending(p => p.FechaCreacion)
                .ToListAsync();
        }

        // GET: api/pedidos/comercio/1 (Lista los pedidos filtrados por comercio)
        [HttpGet("comercio/{tenantId}")]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidosPorComercio(int tenantId)
        {
            return await _context.Pedidos
                .Include(p => p.Detalles)
                .Where(p => tenantId <= 0 || p.TenantId == tenantId)
                .OrderByDescending(p => p.FechaCreacion)
                .ToListAsync();
        }

        // GET: api/pedidos/mi-historial?telefono=9381234567
        [HttpGet("mi-historial")]
        public async Task<IActionResult> GetMiHistorial([FromQuery] string? telefono)
        {
            var query = _context.Pedidos.AsQueryable();
            if (!string.IsNullOrWhiteSpace(telefono))
            {
                var telLimpio = telefono.Trim();
                query = query.Where(p => p.TelefonoCliente == telLimpio);
            }

            var pedidos = await query
                .Include(p => p.Detalles)
                .OrderByDescending(p => p.FechaCreacion)
                .ToListAsync();

            var comercios = await _context.Comercios
                .ToDictionaryAsync(c => c.Id);

            var historial = pedidos.Select(p =>
            {
                comercios.TryGetValue(p.TenantId, out var com);
                return new
                {
                    pedidoId = p.Id,
                    tenantId = p.TenantId,
                    nombreComercio = com?.NombreComercio ?? "Restaurante",
                    direccionComercio = com?.Direccion ?? "",
                    telefonoComercio = com?.TelefonoComercio ?? "",
                    total = p.Total,
                    estado = p.Estado,
                    fechaCreacion = p.FechaCreacion,
                    fechaCompletado = p.FechaCompletado,
                    calificacion = p.Calificacion,
                    comentarioCalificacion = p.ComentarioCalificacion,
                    detalles = p.Detalles
                };
            });

            return Ok(historial);
        }

        // POST: api/pedidos (Registra un nuevo pedido enviado por un cliente)
        [HttpPost]
        public async Task<ActionResult<Pedido>> PostPedido(Pedido pedido)
        {
            pedido.FechaCreacion = DateTime.UtcNow;

            if (string.IsNullOrEmpty(pedido.Estado))
            {
                pedido.Estado = "RECIBIDO";
            }

            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPedidosPorComercio), new { tenantId = pedido.TenantId }, pedido);
        }

        [HttpPut("estado/{id}")]
        public async Task<IActionResult> ActualizarEstadoPedido(int id, [FromBody] CambiarEstadoDto dto)
        {
            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null)
            {
                return NotFound("Pedido no encontrado.");
            }

            pedido.Estado = dto.Estado;
            if (string.Equals(dto.Estado, "COMPLETADO", StringComparison.OrdinalIgnoreCase) && pedido.FechaCompletado == null)
            {
                pedido.FechaCompletado = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Estado del pedido actualizado." });
        }

        // PUT: api/pedidos/5/calificar (Guarda la calificación de 1 a 5 estrellas y actualiza promedio del restaurante)
        [HttpPut("{id}/calificar")]
        public async Task<IActionResult> CalificarPedido(int id, [FromBody] CalificarPedidoDto dto)
        {
            if (dto == null || dto.Calificacion < 1 || dto.Calificacion > 5)
            {
                return BadRequest("La calificación debe estar entre 1 y 5 estrellas.");
            }

            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null)
            {
                return NotFound("Pedido no encontrado.");
            }

            if (!string.Equals(pedido.Estado, "COMPLETADO", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("Solo puedes calificar pedidos que ya hayan sido completados.");
            }

            pedido.Calificacion = dto.Calificacion;
            pedido.ComentarioCalificacion = string.IsNullOrWhiteSpace(dto.Comentario) ? null : dto.Comentario.Trim();
            await _context.SaveChangesAsync();

            var calificaciones = await _context.Pedidos
                .Where(p => p.TenantId == pedido.TenantId && p.Calificacion != null)
                .Select(p => p.Calificacion!.Value)
                .ToListAsync();

            var comercio = await _context.Comercios.FindAsync(pedido.TenantId);
            if (comercio != null)
            {
                comercio.TotalCalificaciones = calificaciones.Count;
                comercio.CalificacionPromedio = calificaciones.Count > 0
                    ? Math.Round(calificaciones.Average(), 1)
                    : 0;
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                mensaje = "¡Gracias por tu calificación!",
                calificacion = pedido.Calificacion,
                calificacionPromedio = comercio?.CalificacionPromedio ?? 0,
                totalCalificaciones = comercio?.TotalCalificaciones ?? 0
            });
        }
    }

    public class CambiarEstadoDto
    {
        public string Estado { get; set; } = string.Empty;
        public string? RepartidorNombre { get; set; }
    }

    public class CalificarPedidoDto
    {
        public int Calificacion { get; set; }
        public string? Comentario { get; set; }
    }
}