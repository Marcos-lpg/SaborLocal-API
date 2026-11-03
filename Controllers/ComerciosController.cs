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

        // Inyectamos el DbContext para conectar con la base de datos PostgreSQL
        public ComerciosController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/comercios (Lista todos los comercios registrados)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Comercio>>> GetComercios()
        {
            return await _context.Comercios.ToListAsync();
        }

        // POST: api/comercios (Registra un nuevo comercio/restaurante)
        [HttpPost]
        public async Task<ActionResult<Comercio>> PostComercio(Comercio comercio)
        {
            comercio.FechaCreacion = DateTime.UtcNow;
            comercio.Estado = "PENDIENTE"; // Estado inicial por el módulo de gobernanza

            _context.Comercios.Add(comercio);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetComercios), new { id = comercio.Id }, comercio);
        }
    }
}