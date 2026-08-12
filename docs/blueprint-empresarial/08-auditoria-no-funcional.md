# 08 — Auditoría no funcional

> **Actualización 2026-08-12:** el hallazgo de autorización de envío SUNAT ya está corregido: las dos acciones exigen rol y permiso. Las filas históricas se conservan como evidencia del estado al corte original. Ver Blueprint 11.

**Metodología**: lectura directa de `src/lib/auth.ts`, `src/lib/permisos.ts`, `src/lib/prisma.ts`, `src/lib/inventario.ts`, `src/lib/correlativos.ts`, `src/lib/contabilidad.ts`, `src/lib/monitoreo/*`, `server.ts`, `next.config.ts`, `tsconfig.json`, `package.json`, `Dockerfile`, `docker-compose.yml`, y muestreo de 8+ `actions.ts` de módulos distintos, más `git status` para verificar el estado real de los archivos `.bak`. Toda cita es verbatim de código al 2026-08-06.

---

## Seguridad

### Autenticación

| Elemento | Evidencia | Estado |
|---|---|---|
| Hash de contraseña | `src/lib/auth.ts:10-22` — `crypto.scryptSync` nativo de Node, sal aleatoria de 16 bytes por registro, comparación en tiempo constante (`timingSafeEqual`) | **Verificado completo** — algoritmo razonable, sin dependencia de librería externa |
| Creación/validación de sesión | `crearSesion` (`auth.ts:24-36`) — token de 32 bytes aleatorios, cookie `httpOnly: true`, `sameSite: "lax"` | **Parcial** |
| Expiración de sesión | `obtenerUsuario` (`auth.ts:48-59`) valida `expiraEn` **en cada request**, no solo al login — usado en `src/app/(app)/layout.tsx:9`, envuelve toda la app | **Verificado completo** |
| Flag `secure` en la cookie de sesión | Búsqueda de `secure` en todo el repo: **no aparece** en la configuración de la cookie | **Ausente** — en producción sobre HTTP simple, la cookie de sesión viajaría sin cifrado de transporte garantizado |
| Protección CSRF | Búsqueda de "csrf"/"CSRF": 0 resultados. Único control relacionado: `next.config.ts:8-13`, `experimental.serverActions.allowedOrigins` limitado a `["*.app.github.dev", "localhost:3000"]` — configurado para desarrollo/Codespaces, no como allowlist de producción documentada | **Ausente** como control explícito |
| Rate limiting / bloqueo de cuenta tras intentos fallidos | Sin contador de intentos, sin `intentosFallidos`/`bloqueadoHasta` en `model Usuario` | **Ausente** |
| Complejidad de contraseña | Solo longitud mínima de 8 caracteres, verificada ad hoc en `configuracion/usuarios/actions.ts:29,56` — sin regla centralizada, sin mayúscula/dígito/símbolo obligatorio | **Parcial** |
| Middleware de borde (Next.js `middleware.ts`) | No existe — toda la protección de acceso vive dentro de cada `layout.tsx`/`page.tsx`/`actions.ts` individualmente | **Ausente como capa centralizada**, aunque el efecto neto está mayormente cubierto módulo por módulo (ver Autorización) |

### Autorización (RBAC)

| Elemento | Evidencia | Estado |
|---|---|---|
| Puerta primaria por rol | `requerirRol()` (`auth.ts:62-71`) — rechaza si el rol del usuario no está en la lista permitida (ADMIN siempre pasa) | **Verificado completo** |
| Segunda capa por grupo de seguridad | `puedeRealizar()` (`src/lib/permisos.ts`, 28 líneas) — solo puede **restringir** una acción dentro de lo que el rol ya permite, nunca ampliarla (comentario propio del archivo) | **Verificado completo**, por diseño |
| Aplicación real en servidor (no solo UI oculta) | Confirmado por conteo: `requerirRol` se invoca **207 veces en 51 de 54** archivos `actions.ts` bajo `src/app/(app)/**` | **Verificado completo** para la gran mayoría del sistema |
| Excepción — 3 archivos sin `requerirRol` | `adjuntos/actions.ts`, `contactos/actions.ts`, `direcciones/actions.ts` — solo verifican sesión (`obtenerUsuario()`), sin restricción de rol; cualquier usuario autenticado de cualquier rol puede adjuntar/eliminar archivos o contactos/direcciones | **Gap real, de alcance acotado** (entidades de apoyo, no financieras) |
| **Gap crítico de autorización** | `enviarComprobanteFactura` y `enviarComprobanteNotaCredito` (`comercial/facturas/actions.ts:26-63, 68-113`) **no llaman `obtenerUsuario()` ni `requerirRol()`** — a diferencia de cada otra función exportada en ese mismo archivo. Están conectadas a un botón real de la UI ("Reenviar a SUNAT", `comercial/facturas/[id]/page.tsx:195-205`). Sin `middleware.ts`, nada a nivel de framework impide que esta función se invoque sin sesión válida. | **Ausente — hallazgo crítico, funcionalidad financiera/regulatoria (envío de comprobantes a SUNAT) sin control de acceso alguno** |

### Aislamiento multi-tenant

Ver Blueprint 03 §1 para el detalle completo. Confirmado por muestreo de 8 módulos: **solo `Cliente` y `Proveedor` filtran realmente por `empresaId`**; `caja`, `lotes`, `usuarios`, `productos`, `ajustes`, `órdenes de compra` y `planilla` **nunca leen ni filtran `empresaId` en sus queries** — no es que esté "hardcodeado a '1'", es que simplemente no se referencia, así que una segunda compañía real mezclaría datos de inventario, facturación, planilla y contabilidad con la primera sin ningún aviso. **Estado: parcial, documentado honestamente en el propio esquema** (`prisma/schema.prisma:2863-2872`).

---

## Arquitectura y concurrencia

| Elemento | Evidencia | Estado |
|---|---|---|
| Transacciones en operaciones críticas | **66 sitios** de `prisma.$transaction` en todo el código. Los 16 puntos de llamada a `registrarMovimiento()` (kardex) pasan todos el cliente transaccional `tx`, ninguno pasa el cliente sin transacción — confirmado por grep exhaustivo | **Verificado completo** para el patrón específicamente buscado |
| Numeración correlativa (`src/lib/correlativos.ts`) | Patrón "leer máximo → incrementar", diseñado para llamarse siempre dentro de `tx` (comentario propio del archivo). **Sin `@@unique` de respaldo** en los campos `codigo`/`numero` de la mayoría de modelos muestreados — la protección depende enteramente de la disciplina de siempre pasar `tx`, no de una restricción de base de datos | **Parcial** — funciona hoy porque SQLite serializa escrituras a nivel de archivo, pero es una protección implícita, no explícita |
| Bloqueo optimista (campo `version`) | Búsqueda en modelos muestreados (`Usuario`, `LoteGranel`, `Factura`, `OrdenCompra`, `Insumo`): **no existe** | **Ausente** |
| Motor contable transaccional | `postearAsiento`/`postearCobro`/`postearNotaCredito`/`postearAnulacionFactura`/`postearRecepcionCompra`/`postearDevolucionCompra` — todos reciben `tx` y se invocan dentro de la misma transacción que la mutación de negocio (ej. `registrarCobro`, `comercial/facturas/actions.ts:147-195`) | **Verificado completo** |

**Riesgo material identificado**: toda la seguridad de concurrencia hoy descansa en que **SQLite serializa escrituras a nivel de archivo con un solo proceso escritor**. Esta es una protección real pero **implícita** — si se migra a PostgreSQL (camino ya documentado en `README.md:112-118`) sin agregar bloqueo optimista explícito o restricciones `@@unique` en los campos de numeración correlativa, el mismo código podría producir números duplicados o condiciones de carrera bajo escritura concurrente real multi-proceso. **Esto es exactamente el escenario esperado al escalar a varias plantas con más usuarios concurrentes.**

---

## Base de datos

| Elemento | Evidencia | Estado |
|---|---|---|
| Motor actual | SQLite vía `@prisma/adapter-better-sqlite3` (`src/lib/prisma.ts`, adaptador nativo síncrono, un solo proceso/conexión) | **Verificado completo**, apropiado para el tamaño actual, **no apropiado para el tamaño objetivo del encargo** |
| Modo WAL / tuning de concurrencia | Búsqueda de `journal_mode`/`PRAGMA`/`WAL`/`busy_timeout`: sin configuración de aplicación encontrada | **Ausente** |
| Índices | **9 declaraciones `@@index`** en 104 modelos — la mayoría de las búsquedas dependen de `@id`/`@@unique` (83 restricciones únicas compuestas por `empresaId`), no de índices dedicados a patrones de consulta reales | **Parcial** — suficiente hoy, insuficiente sin revisión a alto volumen de reportes/consultas |
| Camino de migración a PostgreSQL | Documentado explícitamente en `README.md:112-118` (cambiar provider, adaptador, `DATABASE_URL`) | **Solo documentación** — no implementado, no probado |

---

## Testing

**Ausente por completo.** Sin `jest`/`vitest`/`playwright`/`mocha` en `package.json`, sin archivos `*.test.ts`/`*.spec.ts` en todo el repositorio, sin script `test` en `package.json`. **Cero pruebas automatizadas para una aplicación con 66 transacciones críticas de integridad financiera y de inventario.**

---

## CI/CD y empaquetado

| Elemento | Evidencia | Estado |
|---|---|---|
| Pipeline de CI (build/lint/test en cada PR) | No existe `.github/workflows/` | **Ausente** |
| Contenedor Docker | `Dockerfile` de 3 etapas (deps/builder/runner), `docker-compose.yml` con volumen nombrado para persistencia SQLite | **Verificado completo** para empaquetado de un solo servicio |
| Servicio de base de datos separado, proxy reverso/TLS, backup automatizado en `docker-compose.yml` | No existen | **Ausente** |
| Monitoreo en tiempo real | Real, pero de infraestructura de host (CPU/RAM/disco/salud de BD vía `SELECT 1`), restringido a rol ADMIN en dos capas (WebSocket + página), actualizado cada 2s solo mientras hay clientes conectados (`src/lib/monitoreo/metricas.ts`, `server.ts`) | **Verificado completo**, alcance limitado a métricas de host — **no es observabilidad de aplicación (APM), no mide errores de negocio ni latencia por endpoint** |

---

## Dependencias

Lista completa verificada (`package.json`, 47 líneas): `@prisma/client ^7.8.0`, `@prisma/adapter-better-sqlite3 ^7.8.0`, `next 16.2.10`, `react/react-dom 19.2.4`, `node-forge ^1.4.0`, `xml-crypto ^6.1.2`, `jszip ^3.10.1`, `ws ^8.18.0`, `tsx ^4.23.1`. Sin librería de logging estructurado, sin librería de rate limiting, sin librería de testing. Hallazgo positivo: `package.json` restringe explícitamente los scripts nativos post-instalación a 6 paquetes concretos (`allowScripts`) — control de cadena de suministro real, no una lista abierta. **Producción corre vía `tsx` (transpilación en caliente), no JS pre-compilado** — válido operacionalmente, pero a revisar para el perfil de rendimiento a escala.

---

## Manejo de errores y logging

| Elemento | Evidencia | Estado |
|---|---|---|
| Manejo de error en acciones de servidor | Patrón consistente `try/catch` devolviendo `e.message` al cliente (mensajes de negocio en español, no trazas crudas) | **Verificado completo**, consistente |
| Logging estructurado | Solo **2 llamadas a `console.error`** en todo `src/` (`facturacionElectronica.ts:419`, `server.ts:54`) | **Ausente** como práctica sistemática |
| Boundary de error centralizado (`error.tsx`/`global-error.tsx`) | No existe ninguno bajo `src/app/` | **Ausente** |
| Observabilidad (Sentry/OpenTelemetry/APM) | Ninguna dependencia ni integración encontrada | **Ausente** |

---

## Backup y recuperación ante desastres

**Ausente.** Los archivos `dev.db.bak-2026-07-29` y `dev.db.bak-2026-08-01` visibles en `git status` son copias manuales locales — **no están cubiertas por `.gitignore`** (que solo ignora `/dev.db` exacto, no el patrón `*.bak-*`), **no están commiteadas**, y **ningún script o job en el repositorio las genera** (búsqueda exhaustiva sin resultados). No hay sección de backup/DR en `README.md`, `docs/gobernanza/` ni `000-Governance/`. `docker-compose.yml` persiste el archivo SQLite en un volumen Docker nombrado, sin servicio de snapshot/backup asociado. Las migraciones de Prisma (28 carpetas) dan versionado de esquema hacia adelante, pero sin scripts de reversión (`down migration`) — revertir un cambio de esquema en producción requeriría trabajo manual.

**Esto es, junto con la falta de pruebas automatizadas y la ausencia de aislamiento multi-tenant real, uno de los tres riesgos más serios para operar a la escala objetivo.**

---

## Configuración de build y tipado

| Elemento | Evidencia | Estado |
|---|---|---|
| `tsconfig.json` | `strict: true`, sin overrides que lo relajen | **Verificado completo** |
| `next.config.ts` | Sin `ignoreBuildErrors`, sin `ignoreDuringBuilds`, sin `reactStrictMode: false` | **Verificado completo** — el build falla de verdad ante errores de tipo/lint, no los enmascara |

---

## Resumen de los 3 riesgos no funcionales más serios para escalar a fabricante grande multi-planta

1. **Base de datos de un solo escritor (SQLite) sin bloqueo optimista explícito ni restricciones únicas en la numeración correlativa** — la integridad de concurrencia hoy depende implícitamente del serializado de escritura de SQLite. Migrar a PostgreSQL (ya documentado como plan) sin agregar controles explícitos de concurrencia expondría exactamente el tipo de condición de carrera que más usuarios concurrentes en varias plantas haría probable, no solo teórica.
2. **Aislamiento multi-tenant real solo en 2 de ~60 entidades con `empresaId`** — confirmado por muestreo de 8 módulos distintos (caja, lotes, usuarios, productos, ajustes, órdenes de compra, planilla, más los 2 que sí filtran). Una segunda compañía real mezclaría datos financieros, de inventario y de planilla sin aviso.
3. **Cero pruebas automatizadas + cero CI + sin backup/DR documentado o implementado** — para un sistema con 66 transacciones críticas de integridad financiera, no hay red de seguridad de regresión ni forma documentada de recuperarse de un incidente de datos en producción.

Hallazgo adicional de alta severidad puntual (no estructural, pero de corrección inmediata): **el envío de comprobantes electrónicos a SUNAT (`enviarComprobanteFactura`/`enviarComprobanteNotaCredito`) no tiene ningún control de autenticación ni autorización**, a diferencia de cada otra función del mismo archivo — corrección de bajo esfuerzo y alta prioridad (ver Blueprint 09).
