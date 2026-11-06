using System.ComponentModel.DataAnnotations;

namespace SaborLocal.API.Models
{
    public class Comercio
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string NombreComercio { get; set; } = string.Empty;

        public string Categoria { get; set; } = string.Empty;

        [Required]
        public string TelefonoComercio { get; set; } = string.Empty;

        // Propiedad Telefono con get y set para que el controlador pueda leer y escribir
        public string Telefono
        {
            get => TelefonoComercio;
            set => TelefonoComercio = value;
        }

        public string Direccion { get; set; } = string.Empty;

        public string MetodosPago { get; set; } = "Efectivo, Transferencia";

        [Required]
        public string NombreDuenio { get; set; } = string.Empty;

        [Required]
        public string CorreoDuenio { get; set; } = string.Empty;

        [Required]
        public string Contrasena { get; set; } = string.Empty;

        public string Estado { get; set; } = "PENDIENTE"; // PENDIENTE, APROBADO, SUSPENDIDO

        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    }
}