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

## Limitación

La base demo se siembra con los mismos datos de demostración del proyecto, con **una sola compañía**. El aislamiento multiempresa sigue verificado por consultas en la suite, no a ojo en pantalla: para eso haría falta un segundo juego de datos y un recorrido cambiando la compañía activa.
