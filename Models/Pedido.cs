using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SaborLocal.API.Models
{
    public class Pedido
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int TenantId { get; set; }

        [Required]
        public string ClienteNombre { get; set; } = string.Empty;

        [Required]
        public string TelefonoCliente { get; set; } = string.Empty;

        [Required]
        public string DireccionCliente { get; set; } = string.Empty; // 👈 Campo nuevo para la dirección

        public string MetodoPago { get; set; } = "Efectivo";

        public string CambioPara { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        // Estados adaptados al flujo Kanban: RECIBIDO, EN_PREPARACION, HACIA_DOMICILIO, COMPLETADO
        public string Estado { get; set; } = "RECIBIDO"; 

        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

        public List<DetallePedido> Detalles { get; set; } = new();
    }
}