using System.ComponentModel.DataAnnotations;

namespace SaborLocal.API.Models
{
    public class Comercio
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public string NombreComercio { get; set; } = string.Empty;
        
        public string Direccion { get; set; } = string.Empty;
        
        public string Telefono { get; set; } = string.Empty;
        
        public string MetodosPago { get; set; } = string.Empty;
        
        public string Estado { get; set; } = "PENDIENTE";
        
        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    }
}