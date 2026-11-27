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

        [HttpGet("comercio/{tenantId}")]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidosPorComercio(int tenantId)
        {
            return await _context.Pedidos
                .Include(p => p.Detalles)
                .OrderByDescending(p => p.FechaCreacion)
                .ToListAsync();
        }

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
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Estado del pedido actualizado." });
        }
    }

    public class CambiarEstadoDto
    {
        public string Estado { get; set; } = string.Empty;
        public string? RepartidorNombre { get; set; }
    }
}