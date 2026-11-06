using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

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
        [Column(TypeName = "decimal(18,2)")]
        public decimal Precio { get; set; }

        public string Categoria { get; set; } = "General";

        public bool Disponible { get; set; } = true;
    }
}