# Verificación en navegador con base desechable

Hasta ahora no había forma de revisar la aplicación en el navegador sin apuntar el servidor de desarrollo a `dev.db`, que es una base protegida. El resultado práctico: un tramo largo de cambios se entregó con TypeScript, lint, suite y build en verde, pero sin que nadie hubiera mirado una sola pantalla.

## Cómo se levanta

```bash
npm run dev:demo            # reutiliza la base demo si existe
npm run dev:demo -- --reset # la recrea desde cero
```

`scripts/dev-demo.mjs` crea la base en `.demo/` (fuera del control de versiones), le aplica todas las migraciones, la siembra con `prisma/seed.ts` y `prisma/seed-demo.ts`, y recién entonces arranca el servidor apuntando ahí.

Dos protecciones deliberadas:

- **Ignora cualquier `DATABASE_URL` del entorno** y define la suya. Una variable heredada no puede redirigirlo a una base que no es la suya.
- **Solo puede escribir dentro de `.demo/`**, verificado antes de tocar nada.

Usuario inicial: `admin` / `cambiar123`.

También queda como configuración `erp-demo` en `.claude/launch.json`.

## Qué encontró la primera pasada

Tres defectos que **ninguna de las 152 pruebas, ni TypeScript, ni el lint, ni el build detectaban**. Vale registrarlos porque son de clases distintas.

### 1. Una instalación nueva no tenía ninguna planta

`prisma/seed.ts` creaba el almacén "Planta de producción" sin `tipo`, así que quedaba como `ALMACEN_DISTRIBUCION`.

La consecuencia inmediata era visible: el selector de planta de las ubicaciones técnicas salía vacío y no se podía crear una raíz. La consecuencia grave era invisible: `horasDisponiblesEnRango` solo suma plantas, así que **la capacidad de Proyecciones habría sido cero** aunque hubiera calendario configurado.

El razonamiento que falló: la migración que introdujo `Almacen.tipo` marcó como `PLANTA` a los almacenes que ya tenían `CalendarioProduccion`, y de ahí se concluyó que el cambio era neutro. Es cierto para una base **existente**. Una base **nueva** no pasa por ese relleno.

### 2. `ETIQUETA_TIPO_ALMACEN` vivía en un módulo cliente

La pantalla de almacenes mostraba `PLANTA · undefined` y los contadores por rol no se renderizaban.

Es una trampa del App Router: si un Server Component importa un **valor** desde un módulo `"use client"`, recibe una referencia de cliente en lugar del objeto, y acceder a sus propiedades devuelve `undefined`. Sin error de TypeScript, sin fallo de lint, sin fallo de build.

El mapa se movió a `src/lib/tiposAlmacen.ts`, un módulo neutro. No sirve `src/lib/almacenes.ts`: ése importa Prisma, y al intentarlo el bundler arrastró `better-sqlite3` al navegador — lo que confirma por qué el módulo tiene que ser aparte.

### 3. Ninguna prueba cubría esa clase de error

Se agregaron dos guardias:

- `la semilla deja al menos una planta que pueda producir`.
- `ningún Server Component importa constantes desde un módulo cliente`: recorre los `page.tsx` sin `"use client"`, busca importaciones relativas de nombres en MAYÚSCULAS —constantes, no componentes ni tipos— y falla si el módulo de origen es cliente. Verificada revirtiendo el arreglo: la prueba falla.

## Qué se recorrió

| Pantalla | Resultado |
| --- | --- |
| Ubicaciones técnicas | Raíz con planta y una línea hija; la ruta `PLANTA-1 › LINEA-A` aparece en el selector, el árbol indenta la hija, y el selector "Mover" excluye a la propia rama |
| Posiciones organizativas | Alta correcta; contadores "Posiciones activas: 1 / Vacantes hoy: 1" e insignia **Vacante** |
| Almacenes y zonas | Contadores por rol y el rol de cada almacén (tras el arreglo) |
| Aprobaciones de compras | Selector de planta y columna "Alcance" |
| Bandeja de aprobaciones | Carga acotada a la compañía activa |

## Segunda pasada: el criterio de aceptación del ítem 0.2

El roadmap exigía para el ítem 0.2: *crear una segunda Empresa, cambiar la compañía activa, y confirmar que ningún dato de la compañía 1 es visible ni editable desde la compañía 2*. Se ejecutó sobre la base demo.

Con la segunda compañía activa quedaron vacías, como corresponde: almacenes (contadores por rol en 0), ubicaciones técnicas, posiciones organizativas, clientes, usuarios y plan de cuentas. Al volver a la primera, todos los datos reaparecieron — la prueba no vale si solo se ven ceros porque algo se rompió.

### La fuga que encontró

**El panel general no filtraba por compañía en ninguna de sus 21 consultas.** Con la segunda compañía activa seguía mostrando S/ 287.50 de ventas, S/ 566.40 de cuentas por cobrar, S/ 108.69 de comisiones y S/ 35,714.21 de inventario: todo de la primera.

Es la pantalla más visible del sistema y la que más datos financieros junta en un solo lugar, y no tenía ni una sola referencia a la compañía. Por eso se le escapó a los dos barridos anteriores: el de `actions.ts` solo miraba acciones, y la guardia de pantallas busca las que usan la compañía *de origen* del usuario — ésta no usaba ninguna.

Dos de las 21 consultas no llevan `empresaId` propio y se acotan por relación: `asientoDetalle` a través de su asiento, y `ordenMantenimiento` a través de su equipo.

### El banner que mentía

La pantalla de compañías anunciaba al operador que solo Clientes y Proveedores filtraban de verdad por compañía, y que el resto del sistema operaba contra la principal. Dejó de ser cierto al cerrar el ítem 0.2. Un aviso falso sobre aislamiento de datos es peor que un documento desactualizado, porque el operador decide en base a él. Se reemplazó por lo que sí importa saber: una compañía nueva empieza vacía y hay que darla de alta en Configuración antes de operarla.

### Guardias agregadas

- `el panel general acota todas sus consultas a la compañía activa`: parte el bloque `Promise.all` por cada `prisma.` y exige el filtro en cada trozo. Verificada quitando un filtro: falla.
- `la pantalla de compañías no anuncia un alcance que ya no es cierto`.

## Tercera pasada: dos compañías, ambas con datos

Con una compañía vacía solo se detecta *"la consulta no filtra"*. El error más silencioso es el otro: *"la consulta filtra por la compañía equivocada"*, que con una compañía vacía se ve idéntico a funcionar bien.

`prisma/seed-segunda-empresa.ts` puebla una segunda compañía con datos propios y **deliberadamente reconocibles**, para que una cifra cruzada salte a la vista:

| Dato | Compañía 1 | Compañía 2 |
| --- | --- | --- |
| Ventas del mes | S/ 287.50 (2 facturas) | **S/ 1,234.56** (1 factura) |
| Cuentas por cobrar | S/ 566.40 | **S/ 1,456.78** |
| Comisiones por pagar | S/ 108.69 | S/ 0.00 |
| Valor de inventario | S/ 35,714.21 | **S/ 8,000.00** |

Se siembra automáticamente con `npm run dev:demo`; se omite con `--sin-segunda-empresa`, y es idempotente.

### Resultado

El panel general de cada compañía mostró **exactamente sus propias cifras**: ni las de la otra, ni ceros. Clientes listó solo *Minera del Sur S.A.* y Facturas solo *F999-00000001*, sin rastro de los 5 clientes ni las 20 facturas de la primera. Y al volver a la compañía 1, sus cifras seguían intactas — la segunda no la contaminó.

Esto es lo que faltaba para dar el criterio de aceptación del ítem 0.2 por ejercido de verdad: no solo que cada compañía no vea a la otra, sino que cada una vea **lo suyo**.
