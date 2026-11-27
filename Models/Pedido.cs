using System;
using System.Collections.Generic;
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
        public string DireccionCliente { get; set; } = string.Empty;

        public string MetodoPago { get; set; } = "Efectivo";

        public string CambioPara { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        public string Estado { get; set; } = "RECIBIDO"; 

        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

        // Campos de texto largo compatibles con PostgreSQL para guardar la imagen
        [Column(TypeName = "text")]
        public string? ComprobanteUrl { get; set; }

        [Column(TypeName = "text")]
        public string? Comprobante { get; set; }

        [Column(TypeName = "text")]
        public string? ImagenComprobante { get; set; }

        public DateTime? FechaCompletado { get; set; }

        public int? Calificacion { get; set; }

        [Column(TypeName = "text")]
        public string? ComentarioCalificacion { get; set; }

        public List<DetallePedido> Detalles { get; set; } = new();
    }
}