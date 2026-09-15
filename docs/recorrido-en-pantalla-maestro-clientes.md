# El recorrido en pantalla, y lo que encontró

Once ciclos del maestro de clientes se entregaron con TypeScript, lint, 524 pruebas, build y CI en verde, **sin que nadie mirara una pantalla**. Este documento es el recorrido y su resultado.

## Cómo se hizo

El servidor de desarrollo se levantó contra `local.db`, y las pantallas se recorrieron **con una sesión real**: la que el negocio abrió para esto, cuyo registro seguía vigente en la base. Cada ruta se pidió con esa cookie y se revisó el HTML que el servidor devuelve de verdad, no una aproximación.

Se recorrieron **las 101 rutas** de la navegación.

## El resultado

**100 de 101 pantallas: HTTP 200, sin un solo error.** Todo lo construido en estos ciclos renderiza como corresponde:

- La ficha del cliente muestra sus direcciones con el resumen de días —`Lun, Mar, Mié, Jue, Vie, Sáb`, sin domingo, que es el valor por defecto correcto—, el panel de contactos, y el de crédito con «Cupo disponible: sin tope declarado».
- El comportamiento de pago se calcula de verdad desde los cobros: «De 2 facturas canceladas, pagó 0 fuera de plazo».
- El formulario de pedido trae el campo de procedencia de la dirección y la advertencia de que el destino se guarda como está escrito.

## El defecto que encontró

**El filtro de estado de la lista de clientes estaba roto.**

```ts
...(estado === "activo" ? { activo: true } : estado === "inactivo" ? { activo: false } : {}),
```

`activo` es la columna que se reemplazó por `estado` el 2026-09-14. Elegir cualquier opción del filtro producía:

```
Unknown argument `activo`. Available options are marked with ?.
```

Y el desplegable ofrecía dos estados cuando el modelo tiene tres: un cliente BLOQUEADO no era alcanzable por ninguna opción.

## Por qué no lo vio nada

**TypeScript no puede verlo.** La comprobación de propiedades de más no atraviesa un spread de un objeto condicional: `...(cond ? { activo: true } : {})` compila sin queja aunque `activo` no exista en `ClienteWhereInput`. Es un agujero conocido del lenguaje, no un descuido de la configuración.

Y ninguna prueba lo cubría porque **ninguna prueba abre una pantalla con un filtro puesto**. La suite ejerce funciones puras y la base; el defecto vivía en el tramo entre una y otra.

Lint, 524 pruebas, build y CI, todos en verde.

## La guardia, y sus dos versiones fallidas

La prueba nueva recorre `src/`, encuentra cada consulta a `Cliente` y falla si su `where` menciona `activo`.

Llegar ahí costó dos intentos equivocados, y los dos merecen quedar anotados:

1. **Miraba 400 caracteres desde la llamada.** Marcó seis consultas — todas falsos positivos: eran las consultas *vecinas* del mismo `Promise.all`, que filtran `zona`, `vendedor` o `presentacion` por su propio `activo`, que sí existe.

2. **Miraba solo el primer nivel del `where`.** Sin falsos positivos, pero **no atrapaba el defecto original**: en `...(cond ? { activo: true } : {})` el campo queda un nivel más adentro. Se descubrió reintroduciendo el defecto a propósito — la guardia pasó.

La versión final equilibra los paréntesis de la llamada, aísla su `where` y busca a cualquier profundidad. `include` y `select` quedan fuera del corte, porque ahí sí puede haber relaciones con ese campo. Verificada reintroduciendo el defecto: falla nombrando archivo y línea.

## Lo que el recorrido no pudo hacer

El panel del navegador integrado autentica y carga la navegación, pero su `<main>` se queda en el *fallback* de Suspense y no llega a pintar el contenido. Es una limitación del panel con el streaming de componentes de servidor, no de la aplicación: el mismo servidor devuelve el HTML completo a una petición normal.

Por eso **las interacciones no se ejercieron**: guardar una dirección, marcar un contacto como principal, tomar un pedido con orden de compra exigida. Lo verificado es lo que el servidor renderiza para una sesión real, que es donde vivía el defecto — pero no es lo mismo que hacer clic.
