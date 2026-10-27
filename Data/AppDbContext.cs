using Microsoft.EntityFrameworkCore;
using SaborLocal.API.Models;

namespace SaborLocal.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Comercio> Comercios { get; set; }
        public DbSet<Producto> Productos { get; set; }
    }
}