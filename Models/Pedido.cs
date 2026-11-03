using System.ComponentModel.DataAnnotations;

namespace SaborLocal.API.Models
{
    public class Pedido
    {
        [Key]
        public int Id { get; set; }

        // Aislamiento multi-tenant para saber a qué comercio pertenece el pedido
        [Required]
        public int TenantId { get; set; }

        [Required]
        public string ClienteNombre { get; set; } = string.Empty;

        [Required]
        public decimal Total { get; set; }

        public string Estado { get; set; } = "PENDIENTE"; // PENDIENTE, PREPARANDO, COMPLETADO

        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    }
}