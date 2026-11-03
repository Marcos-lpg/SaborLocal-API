using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaborLocal.API.Data;
using SaborLocal.API.Models;

namespace SaborLocal.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductosController : ControllerBase
    {
        private readonly AppDbContext _context;

        // Inyectamos el DbContext para conectar con PostgreSQL
        public ProductosController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/productos (Lista todos los platillos de todos los comercios)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Producto>>> GetProductos()
        {
            return await _context.Productos.ToListAsync();
        }

        // GET: api/productos/comercio/5 (Lista solo los platillos de un restaurante específico)
        // GET: api/productos/comercio/5 (Lista solo los platillos de un restaurante específico)
        [HttpGet("comercio/{tenantId}")]
        public async Task<ActionResult<IEnumerable<Producto>>> GetProductosPorComercio(int tenantId)
        {
            return await _context.Productos
                .Where(p => p.TenantId == tenantId)
                .ToListAsync();
        }

        // POST: api/productos (Agrega un nuevo platillo al menú de un comercio)
        [HttpPost]
        public async Task<ActionResult<Producto>> PostProducto(Producto producto)
        {
            _context.Productos.Add(producto);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProductos), new { id = producto.Id }, producto);
        }
    }
}