# Decimal de Prisma cruzando hacia componentes cliente

Corrige un defecto detectado al verificar otro ciclo en el navegador: React avisaba en consola que un `Decimal` de Prisma cruzaba de un Server Component a un componente `"use client"`.

```
Only plain objects can be passed to Client Components from Server Components.
Decimal objects are not supported.
  {id: ..., nombre: ..., tasaComision: Decimal, ...}
                         ^^^^^^^
```

## Por qué pasa, y por qué TypeScript no lo detiene

El formulario declara el tipo mínimo que necesita:

```ts
type Opcion = { id: string; nombre: string };
```

Y la página le pasa la fila completa de Prisma. **TypeScript lo acepta**: el chequeo de propiedades en exceso solo aplica a literales de objeto, no a un array que viene de una variable. Así que una fila con veinte columnas —incluidas las `Decimal`— pasa como `Opcion[]` sin una sola queja del compilador.

El aviso solo aparece en tiempo de ejecución, en la consola del servidor y del navegador, y solo en desarrollo.

## Cómo se buscó

El barrido estático daba **141 páginas sospechosas** —cualquier página que consulte un modelo con columnas `Decimal` sin `select` y renderice algún componente cliente—, pero la enorme mayoría son falsos positivos: `BotonImprimir` no recibe datos, y muchas páginas usan lo consultado solo para render del servidor.

Arreglar 141 archivos a ciegas habría sido un cambio grande, riesgoso y sin foco. En vez de eso se midió: se levantó la demo y se visitaron **28 pantallas**, recogiendo los avisos reales del servidor.

**Resultado: dos instancias.**

| Dónde | Qué cruzaba |
|---|---|
| `comercial/clientes/{nuevo,[id]}` | `Vendedor.tasaComision` |
| `produccion/mantenimiento/nuevo` | `Equipo.contadorActual` |

Las demás páginas que pasan estos modelos ya mapeaban a la forma mínima antes de entregarla — `guias-remision/nueva`, `lotes/[id]`, `proyectos/[id]` y `mantenimiento/avisos` lo hacían bien.

## El arreglo

`select` explícito en la consulta, con los campos que el formulario realmente usa. Además de quitar el aviso, deja de mandar al navegador columnas que no le importan a nadie.

No se cambió el tipo de los formularios ni se agregó una capa de mapeo: el problema es que la consulta traía de más, y ahí es donde se corrige.

## Verificación

Se repitió la medición sobre una base de demostración nueva, recorriendo 18 pantallas que cubren los dos casos corregidos y los que ya estaban bien: **cero avisos**.

## Por qué no hay guardia automática

Una prueba estructural que detecte este defecto tendría que seguir el dato desde la consulta hasta la prop de un componente cliente, atravesando `map`, desestructuraciones y variables intermedias. Las versiones simples de esa regla dan los 141 falsos positivos de arriba, y una guardia que grita en 139 casos sanos se desactiva sola a la semana.

La detección empírica —levantar la demo y leer los avisos— es barata, exacta y ya está incorporada al recorrido de verificación en navegador que cada ciclo hace igual. Es el método que encontró estas dos.
