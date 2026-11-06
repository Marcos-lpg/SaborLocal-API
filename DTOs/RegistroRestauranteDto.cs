using System.ComponentModel.DataAnnotations;

namespace SaborLocal.API.DTOs
{
    public class RegistroRestauranteDto
    {
        // Datos del Restaurante
        [Required]
        public string NombreComercio { get; set; } = string.Empty;

        public string Direccion { get; set; } = string.Empty;

        [Required]
        public string TelefonoComercio { get; set; } = string.Empty;

        public string MetodosPago { get; set; } = string.Empty;

        // Datos del Dueño (Administrador del Restaurante)
        [Required]
        public string NombreDuenio { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string CorreoDuenio { get; set; } = string.Empty;

        [Required]
        public string Contrasena { get; set; } = string.Empty;
    }
}