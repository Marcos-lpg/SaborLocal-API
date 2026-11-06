using System.ComponentModel.DataAnnotations;

namespace SaborLocal.API.Models
{
    public class Usuario
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Nombre { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Correo { get; set; } = string.Empty;

        [Required]
        public string Telefono { get; set; } = string.Empty;

        [Required]
        public string ContrasenaHash { get; set; } = string.Empty;

        // Roles permitidos: "SUPER_ADMIN", "ADMIN_RESTAURANTE", "CLIENTE"
        [Required]
        public string Rol { get; set; } = "CLIENTE";

        // Id del comercio asociado (solo si es ADMIN_RESTAURANTE)
        public int? ComercioId { get; set; }

        public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;
    }
}