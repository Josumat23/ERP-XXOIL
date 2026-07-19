# ERP Grasas y Lubricantes

Sistema de gestión integral para empresa fabricante de grasas y lubricantes (Perú).
Interfaz en español, moneda en soles (PEN).

**Stack**: Next.js (App Router) + TypeScript + Tailwind CSS + Prisma + SQLite
(listo para migrar a PostgreSQL en la nube).

## Módulos

| Módulo | Contenido |
| --- | --- |
| **Catálogo** | Categorías, productos, presentaciones/SKU (contenido kg, precio, stock), insumos (materia prima, envases, etiquetas), proveedores |
| **Inventario** | Kardex inmutable con saldos (nunca se edita ni borra historia), ajustes con motivo obligatorio y auditoría, alertas de stock mínimo |
| **Producción** | Fórmulas versionadas (sin edición: cada cambio es versión nueva) → lotes granel (consumen insumos, registran merma) → control de calidad → envasados (consumen granel + envases y producen stock) |
| **Comercial** | Zonas, vendedores (con básico / solo comisión, tasa individual), clientes, pedidos con detalle, facturas (número SUNAT, contado/15/30 días), cobros, notas de crédito (revierten comisión proporcional), comisiones |
| **Configuración** | Usuarios y roles (Administrador, Almacén, Producción, Ventas) |

## Principios de diseño

- **La historia nunca se edita ni se borra**: kardex, facturas y comisiones solo se
  compensan con movimientos nuevos (ajustes, notas de crédito, reversiones).
- **Auditoría**: toda regularización guarda quién, cuándo y por qué.
- **Roles**: el operario registra producción pero no ajusta inventario; los ajustes
  son de Almacén/Administrador; comercial es de Ventas/Administrador.
- **Campos semilla** para el futuro: `empresaId`, `moneda` (hoy PEN), `pais` (hoy Perú).
- **El stock solo se mueve por kardex**: producción, ventas, anulaciones y ajustes;
  jamás editando el número a mano.

## Cómo levantar el proyecto

1. Instalar dependencias (solo la primera vez):
   ```bash
   npm install
   ```
2. Levantar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abrir [http://localhost:3000](http://localhost:3000).

> Nota: los scripts `dev` y `build` usan webpack (`--webpack`) porque Turbopack
> falla al procesar CSS en este entorno Windows/OneDrive.

### Usuarios iniciales

| Usuario | Rol | Contraseña |
| --- | --- | --- |
| `admin` | Administrador | `cambiar123` |
| `almacen` | Almacén | `cambiar123` |
| `operario` | Producción | `cambiar123` |
| `ventas` | Ventas | `cambiar123` |

Cambie las contraseñas desde **Configuración → Usuarios** (sesión de admin).

## Flujo de trabajo típico

1. **Producción etapa 1**: Producción → Lotes granel → Nuevo lote (elige fórmula y kg
   objetivo; descuenta insumos por kardex). Al terminar la cocción, registrar kg
   producidos (la merma se calcula sola).
2. **Calidad**: Producción → Control de calidad → aprobar o rechazar el lote.
3. **Producción etapa 2**: Producción → Envasados → Nuevo envasado (consume granel
   aprobado + envases/etiquetas, genera stock de la presentación).
4. **Venta**: Comercial → Pedidos → Nuevo pedido → desde el detalle, **Facturar**
   (registra el número emitido en SUNAT, descuenta stock, genera comisión).
5. **Cobranza**: Comercial → Facturas → detalle → registrar cobros. Notas de crédito
   y anulaciones revierten comisiones automáticamente.

## Comandos útiles de base de datos

- `npx prisma studio` — explorador visual de la base de datos.
- `npx prisma migrate dev --name <nombre>` — nueva migración tras cambiar `prisma/schema.prisma`.
- `npx prisma db seed` — re-ejecutar el sembrado (es idempotente).

## Migrar a PostgreSQL más adelante

1. Cambiar `provider = "sqlite"` a `provider = "postgresql"` en `prisma/schema.prisma`.
2. Cambiar el adaptador en `src/lib/prisma.ts` y `prisma/seed.ts` de
   `@prisma/adapter-better-sqlite3` a `@prisma/adapter-pg` (`npm i @prisma/adapter-pg`).
3. Configurar `DATABASE_URL` con la cadena de conexión de PostgreSQL.
4. Correr `npx prisma migrate deploy` y `npx prisma db seed`.
