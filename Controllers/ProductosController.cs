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

        public ProductosController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/productos (Lista todos los platillos)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Producto>>> GetProductos()
        {
            return await _context.Productos.ToListAsync();
        }

        // GET: api/productos/comercio/5 (Filtrado por TenantId para la arquitectura multi-tenant)
        [HttpGet("comercio/{tenantId}")]
        public async Task<ActionResult<IEnumerable<Producto>>> GetProductosPorComercio(int tenantId)
        {
            return await _context.Productos
                .Where(p => p.TenantId == tenantId)
                .OrderByDescending(p => p.Id)
                .ToListAsync();
        }

        // POST: api/productos (Agrega un nuevo platillo al menú)
        [HttpPost]
        public async Task<ActionResult<Producto>> PostProducto(Producto producto)
        {
            if (producto.TenantId <= 0)
            {
                return BadRequest("El TenantId del comercio es obligatorio.");
            }

            _context.Productos.Add(producto);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProductosPorComercio), new { tenantId = producto.TenantId }, producto);
        }

        // PUT: api/productos/5 (Actualiza nombre, precio o disponibilidad)
        [HttpPut("{id}")]
        public async Task<IActionResult> PutProducto(int id, Producto producto)
        {
            if (id != producto.Id)
            {
                return BadRequest("El ID del producto no coincide.");
            }

            _context.Entry(producto).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await _context.Productos.AnyAsync(p => p.Id == id))
                {
                    return NotFound("El producto no existe.");
                }
                throw;
            }

            return Ok(new { mensaje = "Producto actualizado correctamente." });
        }

        // DELETE: api/productos/5 (Elimina platillo del menú)
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProducto(int id)
        {
            var producto = await _context.Productos.FindAsync(id);
            if (producto == null)
            {
                return NotFound("El producto no existe.");
            }

            _context.Productos.Remove(producto);
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Producto eliminado del menú." });
        }
    }
}