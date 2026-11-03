using Microsoft.EntityFrameworkCore;
using SaborLocal.API.Data;

var builder = WebApplication.CreateBuilder(args);

// Configuración de PostgreSQL
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();

// 1. Agregamos el generador de Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// 2. Activamos la interfaz gráfica de Swagger en desarrollo
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(); // Esto es lo que dibuja la página web interactiva
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();