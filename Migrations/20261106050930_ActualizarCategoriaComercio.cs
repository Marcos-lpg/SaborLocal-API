using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaborLocal.API.Migrations
{
    /// <inheritdoc />
    public partial class ActualizarCategoriaComercio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DireccionCliente",
                table: "Pedidos",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Categoria",
                table: "Comercios",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Contrasena",
                table: "Comercios",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CorreoDuenio",
                table: "Comercios",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NombreDuenio",
                table: "Comercios",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TelefonoComercio",
                table: "Comercios",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DireccionCliente",
                table: "Pedidos");

            migrationBuilder.DropColumn(
                name: "Categoria",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "Contrasena",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "CorreoDuenio",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "NombreDuenio",
                table: "Comercios");

            migrationBuilder.DropColumn(
                name: "TelefonoComercio",
                table: "Comercios");
        }
    }
}
