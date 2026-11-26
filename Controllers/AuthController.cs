using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaborLocal.API.Data;
using SaborLocal.API.Models;
using System.Text;
using System.Text.Json;

namespace SaborLocalAPI.Controllers
{
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private static readonly Dictionary<string, string> CodigosTemp = new();
        private static readonly HttpClient httpClient = new HttpClient();

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("enviar-codigo")]
        public async Task<IActionResult> EnviarCodigo([FromBody] EmailDto model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Correo))
                return BadRequest(new { error = "El correo es obligatorio." });

            try
            {
                string codigo = new Random().Next(100000, 999999).ToString();
                string emailLimpio = model.Correo.ToLower().Trim();
                CodigosTemp[emailLimpio] = codigo;

                // Leemos la API Key y el correo remitente desde appsettings.json
                string apiKey = _configuration["EmailSettings:ApiKey"] ?? _configuration["BrevoApiKey"] ?? "";
                string senderEmail = _configuration["EmailSettings:SenderEmail"] ?? "982116537alopez@gmail.com";

                // Si no hay API Key real configurada, modo desarrollo: devolver código directamente
                if (string.IsNullOrEmpty(apiKey) || apiKey.Contains("TU_API_KEY"))
                {
                    Console.WriteLine($"[DEV MODE] Código OTP para {emailLimpio}: {codigo}");
                    return Ok(new
                    {
                        mensaje = $"Código enviado con éxito a {emailLimpio}.",
                        codigoDebug = codigo,  // Frontend lo usa para verificar sin correo real
                        modoDesarrollo = true
                    });
                }

                // Estructura del correo que se enviará alfanuméricamente al correo ingresado en el registro
                var payload = new
                {
                    sender = new { name = "Sabor Local", email = senderEmail },
                    to = new[] { new { email = emailLimpio } },
                    subject = $"Tu código de verificación de Sabor Local es {codigo}",
                    htmlContent = $@"
                        <div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; margin: auto;'>
                            <h2 style='color: #7c3aed; text-align: center;'>Sabor Local</h2>
                            <p>Hola,</p>
                            <p>Has solicitado registrarte en la plataforma. Utiliza el siguiente código de verificación de 6 dígitos:</p>
                            <div style='text-align: center; margin: 30px 0;'>
                                <span style='font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f1f5f9; padding: 12px 24px; border-radius: 8px; color: #0f172a;'>{codigo}</span>
                            </div>
                            <p style='color: #64748b; font-size: 12px; text-align: center;'>Si no solicitaste este código, puedes ignorar este mensaje.</p>
                        </div>"
                };

                string jsonContent = JsonSerializer.Serialize(payload);

                using (var requestMessage = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email"))
                {
                    requestMessage.Content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
                    requestMessage.Headers.Add("api-key", apiKey);
                    requestMessage.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));

                    HttpResponseMessage response = await httpClient.SendAsync(requestMessage);

                    if (response.IsSuccessStatusCode)
                    {
                        return Ok(new { mensaje = $"Código enviado con éxito a {emailLimpio}." });
                    }
                    else
                    {
                        string errorResponse = await response.Content.ReadAsStringAsync();
                        Console.WriteLine($"--- ERROR DE BREVO ---: {errorResponse}");
                        return StatusCode(500, new { error = "Brevo rechazó el envío del correo: " + errorResponse });
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--- EXCEPCIÓN INTERNA ---: {ex.Message}");
                return StatusCode(500, new { error = "Error de servidor al enviar correo: " + ex.Message });
            }
        }

        [HttpPost("verificar-codigo")]
        public IActionResult VerificarCodigo([FromBody] VerificacionDto model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Correo) || string.IsNullOrWhiteSpace(model.Codigo))
                return BadRequest(new { error = "Datos incompletos." });

            string emailLimpio = model.Correo.ToLower().Trim();

            if (CodigosTemp.TryGetValue(emailLimpio, out var codigoGuardado))
            {
                if (codigoGuardado == model.Codigo.Trim())
                {
                    CodigosTemp.Remove(emailLimpio);
                    return Ok(new { verificado = true, mensaje = "Correo verificado correctamente." });
                }
            }
            return BadRequest(new { error = "El código es incorrecto o ya expiró." });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Correo) || string.IsNullOrWhiteSpace(model.Contrasena))
                return BadRequest(new { error = "Correo y contraseña requeridos." });

            string emailLimpio = model.Correo.ToLower().Trim();

            var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Correo == emailLimpio);
            if (usuario != null)
            {
                if (usuario.ContrasenaHash != model.Contrasena)
                {
                    return Unauthorized(new { error = "Contraseña incorrecta." });
                }
                return Ok(new { token = "jwt-token-valido", usuario = new { rol = usuario.Rol, nombre = usuario.Nombre, correo = usuario.Correo, telefono = usuario.Telefono, comercioId = usuario.ComercioId } });
            }

            return Unauthorized(new { error = "Usuario no encontrado." });
        }
    }

    public class EmailDto { public string Correo { get; set; } = string.Empty; }
    public class VerificacionDto { public string Correo { get; set; } = string.Empty; public string Codigo { get; set; } = string.Empty; }
    public class LoginDto { public string Correo { get; set; } = string.Empty; public string Contrasena { get; set; } = string.Empty; }
}