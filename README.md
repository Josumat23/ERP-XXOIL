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
| **Producción** | Fórmulas versionadas (sin edición: cada cambio es versión nueva) → órdenes de producción / lotes granel (consumen insumos, registran merma y costo) → control de calidad → envasados (consumen granel + envases, producen stock y calculan costo unitario) |
| **Logística** | Órdenes de compra a proveedores, recepciones (parciales o totales) que alimentan el kardex y recalculan el costo promedio ponderado, guías de remisión imprimibles (formato SUNAT: transportista, placa, conductor, peso) |
| **Comercial** | Zonas, vendedores (con básico / solo comisión, tasa individual), clientes, pedidos con detalle, facturas (número SUNAT, contado/15/30 días), cobros, notas de crédito (revierten comisión proporcional), comisiones, hojas de ruta de vendedores con registro de resultados |
| **Finanzas** | Cuentas por cobrar (facturas pendientes con antigüedad de vencimiento), cuentas por pagar con pagos a proveedores, libro de caja (los cobros y pagos generan movimientos automáticos, admite manuales), reporte de costos y márgenes por presentación, estado de resultados mensual (ventas netas − costo de ventas − comisiones − gastos de caja) con costo congelado al facturar |
| **Contabilidad** | Plan de cuentas (codificación PCGE), controles contables (mapa transacción → cuenta), asientos automáticos por cada venta/cobro/NC/anulación/compra/pago (best-effort: sin cuentas configuradas la operación sigue, solo sin asiento), asientos manuales cuadrados, reversos inmutables y balance de comprobación mensual |
| **Configuración del Sistema** | Empresa (membrete + IGV), usuarios, series de documentos SUNAT con correlativo sugerido, almacenes y zonas, unidades de medida, grupos de seguridad (referencia), calendario fiscal con cierre de períodos que bloquea la contabilización |
| **Configuración** | Usuarios y roles (Administrador, Almacén, Producción, Ventas) |

**Impresión**: factura, orden de compra, guía de remisión y hoja de ruta tienen botón
"Imprimir / PDF" (usa la impresión del navegador; "Guardar como PDF" genera el archivo).

**Costos**: los insumos llevan costo promedio ponderado (se recalcula en cada recepción
de compra); cada lote granel registra el costo de sus insumos y su costo por kg (la merma
encarece el kg); cada envasado calcula costo unitario (granel + envases/etiquetas) y
actualiza el costo promedio de la presentación, del que sale el margen de venta.

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
2. Crear el archivo `.env` (no se sube al repositorio):
   ```bash
   echo 'DATABASE_URL="file:./dev.db"' > .env
   ```
3. Generar el cliente de Prisma y la base de datos (solo la primera vez o
   tras clonar el repo — `npm install` no lo hace automáticamente):
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   npx prisma db seed
   ```
4. (Opcional) Cargar datos de prueba — clientes, compras, producción, ventas
   y cobros de los últimos 6 meses — para ver el sistema funcionando de
   punta a punta y los gráficos del panel con información real:
   ```bash
   npm run seed:demo
   ```
5. Levantar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
6. Abrir [http://localhost:3000](http://localhost:3000).

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

1. **Compras**: Logística → Órdenes de compra → Nueva orden. Al llegar la mercadería,
   registrar la **recepción** (entra al kardex, recalcula el costo promedio y genera la
   cuenta por pagar). Los pagos se registran en Finanzas → Cuentas por pagar.
2. **Producción etapa 1**: Producción → Lotes granel → Nuevo lote (elige fórmula y kg
   objetivo; descuenta insumos por kardex y registra su costo). Al terminar la cocción,
   registrar kg producidos (la merma y el costo por kg se calculan solos).
3. **Calidad**: Producción → Control de calidad → aprobar o rechazar el lote.
4. **Producción etapa 2**: Producción → Envasados → Nuevo envasado (consume granel
   aprobado + envases/etiquetas, genera stock y costo unitario de la presentación).
5. **Venta**: Comercial → Pedidos → Nuevo pedido → desde el detalle, **Facturar**
   (registra el número emitido en SUNAT, descuenta stock, genera comisión). Para el
   despacho, crear la **guía de remisión** desde Logística (se autocompleta con la factura).
6. **Cobranza**: Comercial → Facturas → detalle → registrar cobros (entran solos al libro
   de caja). Notas de crédito y anulaciones revierten comisiones automáticamente.
7. **Campo**: Comercial → Hojas de ruta → planificar visitas del vendedor, imprimir la
   hoja, y al final del día cerrar la ruta con los resultados.

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
