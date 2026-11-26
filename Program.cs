using Microsoft.EntityFrameworkCore;
using SaborLocal.API.Data;

var builder = WebApplication.CreateBuilder(args);

// Configuración de PostgreSQL
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// 1. Configurar CORS para permitir peticiones desde el frontend (React en puerto 5173)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy => policy.AllowAnyOrigin()
                        .AllowAnyMethod()
                        .AllowAnyHeader());
});

builder.Services.AddControllers();

// Agregamos el generador de Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Aplicar migraciones pendientes automáticamente al iniciar (con respaldo seguro si las tablas ya existían sin historial)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Aviso al ejecutar Migrate(): {ex.Message}");
        try
        {
            db.Database.ExecuteSqlRaw(@"
                ALTER TABLE ""Comercios""
                    ADD COLUMN IF NOT EXISTS ""EstaAbierto"" boolean NOT NULL DEFAULT true,
                    ADD COLUMN IF NOT EXISTS ""UltimoCierreCaja"" timestamp with time zone NULL,
                    ADD COLUMN IF NOT EXISTS ""HorarioAtencion"" text NOT NULL DEFAULT 'Lun - Dom: 9:00 AM - 10:00 PM',
                    ADD COLUMN IF NOT EXISTS ""TiempoPreparacion"" text NOT NULL DEFAULT '25-40 min',
                    ADD COLUMN IF NOT EXISTS ""EnvioGratis"" boolean NOT NULL DEFAULT true,
                    ADD COLUMN IF NOT EXISTS ""CostoEnvio"" numeric(18,2) NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS ""LogoUrl"" text NULL,
                    ADD COLUMN IF NOT EXISTS ""CalificacionPromedio"" double precision NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS ""TotalCalificaciones"" integer NOT NULL DEFAULT 0;
                ALTER TABLE ""Pedidos""
                    ADD COLUMN IF NOT EXISTS ""FechaCompletado"" timestamp with time zone NULL,
                    ADD COLUMN IF NOT EXISTS ""Calificacion"" integer NULL,
                    ADD COLUMN IF NOT EXISTS ""ComentarioCalificacion"" text NULL;
            ");
        }
        catch (Exception sqlEx)
        {
            Console.WriteLine($"Aviso al asegurar columnas SQL: {sqlEx.Message}");
        }
    }
}

// 2. Activar la política de CORS (debe ir antes de UseAuthorization y MapControllers)
app.UseCors("AllowReactApp");

// Activamos la interfaz gráfica de Swagger en desarrollo
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(); 
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();