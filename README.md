# ERP Grasas y Lubricantes

Sistema de gestión para empresa fabricante de grasas y lubricantes (Perú).

**Stack**: Next.js (App Router) + TypeScript + Tailwind CSS + Prisma + SQLite (listo para migrar a PostgreSQL en la nube).

## Módulo actual: Catálogo

- Categorías (datos semilla)
- Productos
- Presentaciones (SKU: pote, balde, cilindro — contenido en kg, precio, stock)
- Insumos (materia prima, envases, etiquetas)
- Proveedores (datos semilla)

## Cómo levantar el proyecto

1. Instalar dependencias (solo la primera vez):
   ```bash
   npm install
   ```
2. Levantar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

La base de datos SQLite (`dev.db`) ya está creada y sembrada con datos de ejemplo (Grasa Chasis, Grasa de Litio, categorías, un proveedor e insumos).

## Comandos útiles de base de datos

- `npx prisma studio` — explorador visual de la base de datos.
- `npx prisma migrate dev --name <nombre>` — crear una nueva migración tras modificar `prisma/schema.prisma`.
- `npx prisma db seed` — volver a ejecutar el sembrado de datos de ejemplo.

## Migrar a PostgreSQL más adelante

Cuando se despliegue en la nube, basta con:
1. Cambiar `provider = "sqlite"` a `provider = "postgresql"` en `prisma/schema.prisma`.
2. Cambiar el adaptador en `src/lib/prisma.ts` (y `prisma/seed.ts`) de `@prisma/adapter-better-sqlite3` a `@prisma/adapter-pg`.
3. Configurar `DATABASE_URL` con la cadena de conexión de PostgreSQL.
4. Correr `npx prisma migrate deploy`.
