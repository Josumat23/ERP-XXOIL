# Numeración de documentos por compañía

Corrige un defecto real del trabajo multiempresa, **encontrado al chocar contra él** mientras se verificaba otra cosa en el navegador: crear un cliente en la compañía principal fallaba con *"Ya existe un cliente con el documento null"*.

## Qué pasaba

Trece de los diecinueve generadores de `src/lib/correlativos.ts` leían el **máximo global**, sin filtrar por compañía:

```ts
const ultimo = await tx.cliente.findFirst({ orderBy: { codigo: "desc" } });
return siguiente("CLI", ultimo?.codigo ?? null);
```

Con una sola sociedad eso funciona perfecto. Con dos rompe de dos maneras:

**1. El alta falla.** La segunda compañía de demostración tiene un cliente sembrado como `CLI-SUR-001`. Ordenado descendente, ese es el máximo global. `parseInt("SUR-001")` da `NaN`, el contador reinicia en 1, y `CLI-00001` ya existía en la compañía principal: violación de índice único. El usuario solo veía un mensaje sobre un documento duplicado que no tenía nada que ver.

**2. La numeración de una compañía continúa la de la otra.** Aun cuando todo parsea, la compañía B empieza en `PED-00021` porque A lleva veinte pedidos. Su serie nace con huecos, y de paso filtra hacia afuera cuántos documentos lleva emitidos la otra sociedad.

Además, los dos generadores de número de asiento contable —el del motor automático en `contabilidad.ts` y el de los asientos manuales— tenían el mismo problema: los libros de una sociedad continuaban la numeración de la otra.

## La otra mitad: los índices únicos también eran globales

Filtrar los generadores por compañía no alcanzaba. **Quince documentos numerados tenían su número con índice único global**, no compuesto:

```prisma
numero String @unique  // PED-00001
```

Con eso, dos sociedades no pueden tener cada una su `PED-00001` — la segunda choca contra el número que ya usó la primera. La suite lo demostró de inmediato al hacer la numeración por compañía: el asiento de la segunda empresa falló contra `asientos_contables_numero_key`.

Los quince pasan a `@@unique([empresaId, numero])`, que es el patrón que `Cliente`, `Empleado` y `Proyecto` ya usaban:

`LoteGranel` · `ReclamoCliente` · `Envasado` · `Cotizacion` · `Pedido` · `Factura` · `NotaCredito` · `DevolucionCliente` · `OrdenCompra` · `RecepcionCompra` · `GuiaRemision` · `HojaRuta` · `AsientoContable` · `OrdenInterna` · `OrdenMantenimiento`

Para **Factura** y **GuiaRemision** el cambio además es lo correcto en términos fiscales: son números SUNAT por serie y por emisor, y dos RUC distintos pueden legítimamente tener cada uno su `F001-00000123`.

`Ubigeo.codigo` se queda único global a propósito: es un catálogo compartido, no un documento de una compañía.

## `OrdenMantenimiento` gana `empresaId`

Era el único de los quince sin compañía propia: colgaba solo del equipo, y el panel general ya tenía que filtrarlo con un `where: { equipo: { empresaId } }`. Para que su serie sea por compañía necesita la columna, igual que los otros 79 modelos del grafo. La migración la rellena desde el equipo de cada orden.

## `empresaId` es obligatorio, sin valor por defecto

Los diecinueve generadores lo exigen. Un valor por defecto haría que un llamador distraído volviera a numerar contra la compañía principal sin ningún error visible — exactamente la fuga que este ciclo cierra. Al quitarlo, TypeScript señaló los **veinticinco** puntos de llamada que había que revisar, incluidos once del seed de demostración.

## Verificación

**6 pruebas nuevas** (194 en total), sobre base efímera con dos compañías:

- **la reproducción exacta del fallo**: con `CLI-SUR-001` en la otra compañía, el siguiente código es `CLI-00002` y el cliente se crea de verdad;
- cada compañía lleva su serie sin huecos ni continuidad ajena;
- el mismo número puede existir en dos compañías a la vez, y sigue prohibido repetirlo dentro de una;
- el índice único compuesto permite lo primero y bloquea lo segundo.

**2 guardias estructurales**: una lee `correlativos.ts` y falla si algún generador no filtra por compañía o si alguien le pone valor por defecto a `empresaId`; otra exige lo mismo en las dos copias del número de asiento. Sin ellas, un generador nuevo reintroduce el defecto en silencio: funciona perfecto con una compañía y solo falla el día que se abre la segunda.

**Navegador**, con las dos compañías pobladas:

| | Antes | Después |
|---|---|---|
| Cliente nuevo en la compañía principal | falla: *"Ya existe un cliente con el documento null"* | **CLI-00006** |
| Cliente nuevo en la segunda compañía | continuaría la serie de la primera | **CLI-00001**, su propia serie |

Los dos `CLI-00001` conviven en la base, cada uno en su compañía.

## Lo que no cambia

- **El cerrojo sigue siendo global.** `reservarCorrelativo()` toma una fila fija para serializar la generación entre transacciones concurrentes. Serializa más de lo estrictamente necesario ahora que las series son independientes, pero una fila fija es lo que hace el mecanismo simple y portable a PostgreSQL; con el volumen de esta operación la contención no es un problema.
- **El reinicio en 1 ante un código no parseable sigue ahí**, ahora acotado a la propia compañía. Solo puede ocurrir con datos irregulares insertados a mano, y el índice único lo detiene — que es precisamente lo que hizo visible este defecto en vez de dejarlo duplicar.
- **La numeración existente no se renumera.** La migración solo cambia índices; ningún documento ya emitido cambia de número.
