# Datos de la entidad legal del emisor

Cierra el pendiente del Blueprint 05 sobre `Empresa`: *`direccionFiscal`, `representanteLegal`, `regimenTributario`*.

## Qué faltaba de verdad

El diccionario pedía tres campos. Al mirarlos contra el código quedan dos:

- **`direccionFiscal` ya existe.** `ConfiguracionEmpresa` tiene `direccion`, `direccion2`, `ciudad`, `distrito`, `provincia`, `departamento`, `codigoPostal` y `pais` — y desde el ciclo anterior, una fila por compañía. Esa es la dirección fiscal del emisor y es la que sale impresa en los documentos.
- **`representanteLegal` y `regimenTributario` no existían.** Son los que se agregan, más el documento de identidad del representante, que sin él el nombre no sirve para un documento formal.

## Son informativos, y eso es una decisión explícita

Los tres campos **no gobiernan ningún cálculo ni bloquean ninguna operación**. Es el mismo criterio con el que ya estaba el registro de hidrocarburos de OSINERGMIN.

En particular, **el régimen tributario no cambia la tasa de IGV ni infiere obligación alguna**. Derivar obligaciones tributarias a partir del régimen es una decisión que corresponde a un contador, no al código: qué declara cada régimen, con qué periodicidad y bajo qué topes es criterio profesional, y este sistema no lo inventa. El campo existe para que el dato quede registrado junto al resto de la ficha de la sociedad.

Una prueba de la suite lo vigila: falla si aparece un `if`, un `switch` o un ternario que compare `regimenTributario`. Leerlo, mostrarlo y guardarlo está permitido; ramificar sobre él, no.

## El régimen es catálogo, no texto libre

```prisma
enum RegimenTributario {
  NRUS     // Nuevo Régimen Único Simplificado
  RER      // Régimen Especial de Renta
  RMT      // Régimen MYPE Tributario
  GENERAL  // Régimen General
}
```

Los cuatro regímenes del Impuesto a la Renta empresarial vigentes en Perú. Como catálogo, el dato queda estructurado y comparable; como texto libre, cada quien escribiría "MYPE", "RMT" o "Mype Tributario" y no serviría para nada.

El valor llega de un `<select>` del navegador: la acción lo valida contra el enum y, si viene algo fuera de la lista, guarda "sin especificar" en vez de persistir lo que le manden.

Las etiquetas viven en `src/lib/regimenTributario.ts`, sin importar Prisma, porque las consume un componente `"use client"`. Una constante compartida entre un módulo cliente y un Server Component es un defecto que ya apareció antes en este repo —`PLANTA · undefined`— y que una prueba de la suite vigila.

## Verificación

**3 pruebas** (203 en total): los tres campos nacen vacíos y se guardan; el régimen es un catálogo cerrado también en base (un valor inventado es rechazado por el motor); las etiquetas cubren exactamente los cuatro regímenes del esquema, ni uno más ni uno menos; y la guardia de que el régimen no decide nada.

**Navegador**: los tres campos aparecen en Configuración → Empresa con el catálogo completo. Guardados en la compañía principal (`María Quispe Rojas`, `09876543`, `RMT`), **la tasa de IGV siguió en 18** — el régimen no la tocó — y la segunda compañía conservó su propio IGV de 10 con los tres campos vacíos.

## Lo que sigue sin existir

La **dirección fiscal estructurada con ubigeo** para el emisor: `ConfiguracionEmpresa` sigue con distrito/provincia/departamento de texto libre, mientras que `Cliente`, `Proveedor` y `Almacen` ya eligen del catálogo SUNAT. No entra aquí porque esa dirección alimenta el XML de facturación electrónica y merece su propio ciclo, con su propia verificación contra el comprobante emitido.
