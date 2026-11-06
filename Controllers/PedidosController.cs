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

        // GET: api/pedidos (Lista todos los pedidos con sus productos)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidos()
        {
            return await _context.Pedidos
                .Include(p => p.Detalles)
                .OrderByDescending(p => p.FechaCreacion)
                .ToListAsync();
        }

        // GET: api/pedidos/comercio/1 (Lista pedidos de un restaurante específico)
        [HttpGet("comercio/{tenantId}")]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidosPorComercio(int tenantId)
        {
            return await _context.Pedidos
                .Include(p => p.Detalles)
                .Where(p => p.TenantId == tenantId)
                .OrderByDescending(p => p.FechaCreacion)
                .ToListAsync();
        }

        // POST: api/pedidos (Registra un nuevo pedido enviado por un cliente)
        [HttpPost]
        public async Task<ActionResult<Pedido>> PostPedido(Pedido pedido)
        {
            pedido.FechaCreacion = DateTime.UtcNow;
            pedido.Estado = "PENDIENTE";

            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPedidosPorComercio), new { tenantId = pedido.TenantId }, pedido);
        }

        // PUT: api/pedidos/estado/5 (Actualiza el estatus: PENDIENTE -> EN_PROCESO -> COMPLETADO)
        [HttpPut("estado/{id}")]
        public async Task<IActionResult> ActualizarEstadoPedido(int id, [FromBody] CambiarEstadoDto dto)
        {
            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null)
            {
                return NotFound("Pedido no encontrado.");
            }

            pedido.Estado = dto.Estado;
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Estado del pedido actualizado." });
        }
    }

    public class CambiarEstadoDto
    {
        public string Estado { get; set; } = string.Empty;
    }
}