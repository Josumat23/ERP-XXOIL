# De la ficha de competencia al renglón de la cotización

Las equivalencias existían y se justificaban contra especificaciones, pero no servían en el momento en que hacen falta. Para contestar «¿tienen algo equivalente al Delvac 1340?» había que abrir la ficha de competencia, encontrar el producto, volver a la cotización, buscar el SKU y su precio: cuatro pantallas para una pregunta que llega por teléfono.

## El salto que faltaba

No es cosmético. La equivalencia apunta a un **producto**; se cotiza una **presentación**. Saber que la Grasa Chasis reemplaza al Delvac 1340 no dice **qué SKU** ofrecer, **a qué precio**, ni **si hay con qué cumplir**.

Esa es la distancia que una tabla de sinónimos no cruza ni teniendo la fila escrita.

## Lo que se construyó

`/comercial/equivalentes` — **Buscar equivalente**, en el menú de Ventas. Se elige el producto que el cliente pidió y la pantalla responde con:

- nuestros productos declarados equivalentes, ordenados por lo que cubren y, entre iguales, por lo que se puede entregar;
- **qué cubre y qué no**, con lo faltante nombrado, más el motivo que se escribió al declararla;
- cada presentación con su **precio** y su **disponible** — stock menos lo comprometido en pedidos, porque ofrecer stock reservado es prometer dos veces la misma unidad;
- un enlace **Cotizar este** que abre la cotización con esa línea ya cargada al precio de lista.

La cobertura **se recalcula acá, no se lee la guardada**. Es lo que hace que una homologación vencida se vea en el momento de ofrecer y no solo en la ficha: si el sistema mostrara el número del día en que se declaró, seguiría ofreciendo una equivalencia que dejó de sostenerse.

### Nada se esconde

Una cobertura parcial se muestra igual, con lo que le falta a la vista. Un producto **sin stock** también: decir «no tenemos» es peor que decir «lo tenemos, sin stock hoy», y ocultarlo llevaría a que el cliente se lo compre al competidor.

Y cuando nadie declaró una equivalencia, la respuesta es **«no hay»**. No se inventa un reemplazo por parecido de nombre ni por categoría.

## Dos correcciones que salieron de verificar

**El buscador empezó dentro del formulario de cotización.** Al probarlo apareció el problema: la búsqueda es un `GET`, así que enviarla recargaba la pantalla y **borraba lo que el vendedor ya hubiera escrito**. Se movió a su propia pantalla, que además es donde corresponde: la pregunta llega muchas veces por teléfono, sin que haya todavía una cotización que empezar.

**El «Cotizar este» no precargaba nada.** El formulario inicializa sus líneas con `useState`, y `useState` no se reinicializa en una navegación de cliente: React conservaba el estado anterior. Se resolvió con un `key` derivado de la presentación, que fuerza el remonte — y hay una prueba que falla si alguien lo quita, porque el enlace volvería a ser un enlace que no hace nada.

Las dos las encontró la verificación en navegador, no el compilador ni la suite.

## Verificación en navegador (`erp_dev`)

1. **Buscar equivalente** → *Mobil Delvac 1340* (con su fuente: «Ficha tecnica Mobil, rev. 2026-03»).
2. Responde **GR-CHASIS — Grasa Chasis**, *cubre 2 de 3*, **no cubre: Mercedes-Benz 228.31** — la homologación que venció, propagada hasta la pantalla de venta.
3. Sus tres presentaciones con precio y disponible: Balde 35 lb S/ 210 (22), Cilindro 400 lb S/ 2 100 (3), Pote 1 lb S/ 12.50 (126).
4. **Cotizar este** → la cotización abre con la línea en *Grasa Chasis — Balde 35 lb* a **210**. Solo falta cantidad y cliente.

`tests/equivalente-al-cotizar.test.ts`: 14 pruebas, incluida una que recorre la cadena completa contra filas reales —especificación → producto → equivalencia → presentación → disponible— y comprueba que 40 en stock con 15 comprometidos dan **25** para prometer.

## Lo que queda fuera

- **El pedido no lo tiene.** Solo la cotización. Un pedido que nace sin pasar por cotización no ofrece el buscador.
- **No hay registro de qué se pidió originalmente.** La cotización guarda nuestra presentación, no que el cliente había pedido un Delvac 1340. Saber contra qué producto de la competencia se gana y se pierde sería un dato comercial valioso, y hoy se pierde.
- **El aviso sigue siendo pasivo.** Una equivalencia que se degradó se ve en rojo para quien abre la pantalla; nada avisa al vendedor que ayer ofrecía algo que hoy cubre menos.
