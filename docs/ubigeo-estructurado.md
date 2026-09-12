# Ubigeo estructurado en Cliente, Proveedor y Almacén

Cierra dos de los pendientes del Blueprint 05: *`Cliente` → `ubigeoId` (FK estructurada)* y *`Proveedor` → `departamento`/`provincia`/`distrito`/`ubigeoId`*.

## El punto de partida

El catálogo oficial de SUNAT ya existía —`model Ubigeo`, **1834 distritos**, sembrado desde `prisma/data/ubigeos.json`— pero **solo lo usaba `GuiaRemision`**, para los ubigeos de partida y llegada del XML.

Mientras tanto:

- `Cliente` y `Almacen` guardaban `departamento`/`provincia`/`distrito` como **texto libre**, con la escritura que cada quien eligiera;
- `Proveedor` no guardaba ubicación **en absoluto**, solo una línea de `direccion`. La inconsistencia entre maestros que el Blueprint 05 venía señalando desde el 2026-08-06.

## Lo que se hizo

`ubigeoId` como clave foránea opcional hacia el catálogo, en los tres maestros, con un selector en cascada departamento → provincia → distrito.

**A `Proveedor` se le dio solo el FK, no la terna de texto libre.** El diccionario pedía los cuatro campos, pero copiar la terna sería reproducir la inconsistencia en vez de cerrarla: el FK ya da la ubicación, y mejor.

**Los campos de texto libre de `Cliente` y `Almacen` no se borran.** Guardan lo que el usuario escribió, incluidas direcciones que no corresponden a ningún distrito peruano (un cliente en Chile), y son el respaldo de las filas que el backfill no logre emparejar. Cuando hay ubigeo elegido, sus nombres mandan y el texto se mantiene sincronizado — los documentos impresos y los reportes siguen leyéndolo.

### El detalle que evita perder datos

```ts
export function nombresDeUbigeo(ubigeo: UbigeoSeleccionado | null) {
  if (!ubigeo) return {};   // ← objeto vacío, NO tres null
  return { departamento: ..., provincia: ..., distrito: ... };
}
```

Devolver `{}` y no `{departamento: null, ...}` es deliberado: al esparcirlo en un `update`, las claves ausentes dejan intactas las columnas. Con `null` se borraría la dirección que el usuario había escrito a mano antes de que existiera el catálogo. Cubierto por prueba.

### El id se valida siempre

`ubigeoId` llega en un formulario. `resolverUbigeoEnTransaccion()` lo busca en el catálogo dentro de la misma transacción que guarda el maestro; si no existe, se trata como si no se hubiera elegido ninguno. **Nunca se persiste el id crudo**, porque ese código termina en el XML que se le manda a SUNAT.

## El selector

1834 distritos como lista plana de objetos pesan cientos de KB en cada pantalla con formulario de dirección. `arbolUbigeos()` los agrupa por departamento y provincia, con el distrito reducido a un par `[id, nombre]`, y el componente cliente hace la cascada sin volver al servidor en cada paso.

El catálogo es una tabla de referencia que no cambia mientras corre el proceso, así que se arma una sola vez por proceso. **Un catálogo vacío no se cachea**: sembrarlo después surte efecto sin reiniciar el servidor, y mientras tanto el selector lo dice en pantalla en vez de quedar mudo.

Los tipos y las funciones puras viven en `src/lib/ubigeos.ts`, sin `server-only` ni Prisma, para que el componente cliente tome los tipos de ahí y la suite pruebe la lógica sin levantar el cliente de base. Lo que consulta la base está aparte, en `src/lib/ubigeosCatalogo.ts`.

## Backfill

La migración empareja el texto libre existente contra el catálogo, **solo cuando la combinación resuelve a un único ubigeo**. Una fila que no empareje se queda con su texto y sin `ubigeoId`: es preferible dejarla sin emparejar que asignarle un distrito equivocado.

Límite conocido: la comparación es literal salvo mayúsculas. Los nombres del catálogo vienen sin tildes, así que "Huanuco" empareja y "Huánuco" no. Lo que no empareje se corrige eligiendo el distrito en pantalla.

Probado sobre una copia de la base de demostración: `Lima / Lima / Comas` emparejó con el ubigeo **150110**, y una dirección chilena (`Región Metropolitana / Santiago / Providencia`) quedó correctamente sin emparejar, con su texto intacto.

## El catálogo dejó de ser opcional

`prisma/seed-ubigeos.ts` existía pero **nadie lo ejecutaba**: no estaba en `package.json` ni en el seed principal ni en el de demostración. Una instalación nueva habría tenido los tres selectores vacíos, sin ningún error que lo delatara — el mismo defecto de clase que ya apareció con el almacén de tipo `PLANTA` que el seed no creaba.

Ahora el seed principal lo carga (idempotente), existe `npm run seed:ubigeos` para cargarlo a mano, y una prueba exige ambas cosas.

## Verificación

**6 pruebas** (200 en total): un id inexistente no se guarda; los nombres se derivan del ubigeo; sin ubigeo no se borra la dirección escrita; los tres maestros guardan su FK manteniendo el texto sincronizado; una fila extranjera conserva su texto sin ubigeo; y dos guardias — el seed carga el catálogo, y los tres `actions.ts` validan el id contra él.

**Navegador**: el selector muestra los 25 departamentos y encadena correctamente (AMAZONAS → CHACHAPOYAS → BALSAS, con el campo oculto llevando el id del distrito). Un proveedor guardado desde la pantalla quedó con el ubigeo **040103 — Arequipa / Arequipa / Cayma**; un proveedor enviado con un id inventado se guardó con `ubigeoId` en `null`, sin clave foránea falsa.

## Lo que queda pendiente

- ~~**`ConfiguracionEmpresa`** (la dirección fiscal del emisor)~~ — **cerrado el 2026-09-12**: también usa el catálogo. De paso se descubrió que `sunatUbl.ts` ya aceptaba el ubigeo del emisor pero nadie se lo pasaba, así que el XML salía sin ese nodo. Con esto, los cuatro lugares donde el sistema guarda una dirección peruana usan el catálogo oficial. Véase `docs/ubigeo-emisor.md`.
- **El backfill no normaliza tildes.** Con el volumen actual, corregir a mano lo que no empareje es más barato y más seguro que adivinar.
