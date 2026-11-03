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

        // GET: api/pedidos (Lista todos los pedidos)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidos()
        {
            return await _context.Pedidos.ToListAsync();
        }

        // GET: api/pedidos/comercio/1 (Lista solo los pedidos de un restaurante específico)
        [HttpGet("comercio/{tenantId}")]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidosPorComercio(int tenantId)
        {
            return await _context.Pedidos
                .Where(p => p.TenantId == tenantId)
                .ToListAsync();
        }

        // POST: api/pedidos (Registra un nuevo pedido)
        [HttpPost]
        public async Task<ActionResult<Pedido>> PostPedido(Pedido pedido)
        {
            pedido.FechaCreacion = DateTime.UtcNow;
            pedido.Estado = "PENDIENTE";

            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPedidos), new { id = pedido.Id }, pedido);
        }
    }
}