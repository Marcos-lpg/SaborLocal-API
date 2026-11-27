using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

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

        // Control de caja y visibilidad en tiempo real
        public bool EstaAbierto { get; set; } = true;

        public DateTime? UltimoCierreCaja { get; set; }

        // Información operativa visible para el cliente
        public string HorarioAtencion { get; set; } = "Lun - Dom: 9:00 AM - 10:00 PM";

        public string TiempoPreparacion { get; set; } = "25-40 min";

        public bool EnvioGratis { get; set; } = true;

        [Column(TypeName = "decimal(18,2)")]
        public decimal CostoEnvio { get; set; } = 0m;

        // Logo / foto de perfil del restaurante
        [Column(TypeName = "text")]
        public string? LogoUrl { get; set; }

        // Métricas de calificación
        public double CalificacionPromedio { get; set; } = 0;

        public int TotalCalificaciones { get; set; } = 0;
    }
}