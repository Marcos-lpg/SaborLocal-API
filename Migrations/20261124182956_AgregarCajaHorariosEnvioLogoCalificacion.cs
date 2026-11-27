using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaborLocal.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarCajaHorariosEnvioLogoCalificacion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Calificacion",
                table: "Pedidos",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ComentarioCalificacion",
                table: "Pedidos",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaCompletado",
                table: "Pedidos",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "CalificacionPromedio",
                table: "Comercios",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<decimal>(
                name: "CostoEnvio",
                table: "Comercios",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "EnvioGratis",
                table: "Comercios",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "EstaAbierto",
                table: "Comercios",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "HorarioAtencion",
                table: "Comercios",
                type: "text",
                nullable: false,
                defaultValue: "Lun - Dom: 9:00 AM - 10:00 PM");

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                table: "Comercios",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TiempoPreparacion",
                table: "Comercios",
                type: "text",
                nullable: false,
                defaultValue: "25-40 min");

            migrationBuilder.AddColumn<int>(
                name: "TotalCalificaciones",
                table: "Comercios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "UltimoCierreCaja",
                table: "Comercios",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Calificacion",
                table: "Pedidos");

            migrationBuilder.DropColumn(
                name: "ComentarioCalificacion",
                table: "Pedidos");

            migrationBuilder.DropColumn(
                name: "FechaCompletado",
                table: "Pedidos");

            migrationBuilder.DropColumn(
                name: "CalificacionPromedio",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "CostoEnvio",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "EnvioGratis",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "EstaAbierto",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "HorarioAtencion",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "TiempoPreparacion",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "TotalCalificaciones",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "UltimoCierreCaja",
                table: "Comercios");
        }
    }
}
