using System.ComponentModel.DataAnnotations;

namespace SaborLocal.API.Models
{
    public class Producto
    {
        [Key]
        public int Id { get; set; }

        // Clave para el aislamiento multi-tenant del restaurante
        [Required]
        public int TenantId { get; set; } 

        [Required]
        public string Nombre { get; set; } = string.Empty;

        public string Descripcion { get; set; } = string.Empty;

        [Required]
        public decimal Precio { get; set; }

        public bool Disponible { get; set; } = true;
    }
}