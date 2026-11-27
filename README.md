# 🍔 Sabor Local — Candelaria

Plataforma Web Multi-Tenant de grado profesional desarrollada para la gestión, administración y pedidos de comida en comercios locales de Candelaria, Campeche.

## 🚀 Tecnologías Utilizadas

* **Backend:** C# .NET 8 Web API, Entity Framework Core, LINQ, JWT.
* **Base de Datos:** PostgreSQL con migraciones automáticas.
* **Frontend:** React.js, Tailwind CSS, Vite.
* **Servicios de Correo:** Brevo API (para validación de cuentas por correo electrónico).

## 👥 Roles del Sistema

1. **Super Administrador:** Gobernanza central, aprobación o suspensión de comercios en tiempo real, gestión total de tenants y control de la red gastronómica.
2. **Administrador de Restaurante:** Panel de control de operaciones para gestionar menús, cambiar estados de comandas y configurar cuentas de transferencia.
3. **Cliente / Usuario:** Catálogo interactivo de restaurantes aprobados con sincronización en tiempo real, carrito de compras y seguimiento de pedidos activos.

## ⚙️ Características Principales
* Sincronización en tiempo real mediante sondeo optimizado en intervalos cortos para reflejar altas, aprobaciones y suspensiones sin recargar la página.
* Arquitectura Multi-Tenant orientada al comercio local de Candelaria.
* Seguridad estricta en autenticación y validación de correos.

---
© 2026 — (UTECAN).
