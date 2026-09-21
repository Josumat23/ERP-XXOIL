# A quiénes hay que avisar

La pantalla de recall contestaba «cuántos clientes» y «qué lotes». Para saber **a quién llamar** había que entrar lote por lote, anotar los clientes y juntar los repetidos a mano. Con tres lotes son tres pantallas y una hoja aparte, el día que menos tiempo hay.

Peor: el enlace «ver a quiénes» mandaba a `?loteId=X` a secas, así que mirar un lote **hacía perder el alcance del material** y había que volver a armar la consulta desde el selector.

## Un renglón por cliente

| Columna | Para qué |
| --- | --- |
| Cliente | Enlaza a su ficha |
| Unidades | Ordena la lista: se empieza a llamar por quien más tiene |
| Qué tiene | Los envases con su presentación y cantidad, para que sepa qué buscar en su almacén |
| Documentos | Pedidos y facturas: es como el cliente ubica la entrega |
| A quién llamar | El contacto de despacho, con sus canales |

Se agrupa por **id de cliente, no por razón social**. Dos clientes pueden llamarse igual, y juntarlos por el nombre mandaría a uno el aviso del otro y dejaría al segundo sin avisar. En el camino se corrigió lo mismo en `resumenDespacho()`, que contaba «clientes distintos» por nombre: dos homónimos figuraban como uno, y el recall decía que alcanzaba a menos gente de la que alcanza.

El mismo envase entregado dos veces se suma en un renglón, no se repite. Una guía facturada en varias facturas se abre en números sueltos, para que cada uno se pueda buscar.

## El alcance se dice con todas las letras

Con un lote **y** un material elegidos hay dos listas de clientes en la misma pantalla, con números distintos: la del lote arriba y esta abajo. Sin decir cuál es cuál, quien lee elige a cuál creerle — el mismo defecto que ya apareció con el encabezado del recall y con el estado vacío de la búsqueda.

Ahora la lista encabeza con su alcance:

> Alcance de esta lista: **MP-ACEITE-BASE · lote del proveedor PROV-NB-77, 2 recepciones**. 5 clientes tienen 178 unidades, ordenados por cuánto tiene cada uno.
>
> La tabla de arriba es del lote LG-00001 solamente; esta cubre todo lo fabricado con el material.

Y el enlace «ver a quiénes» lleva el material consigo (`&recepcionId=…&porLoteProveedor=1`), así que entrar a un lote ya no hace perder la consulta.

## Un lote alcanzado está comprometido entero

Se listan **todas** las unidades de cada lote alcanzado, no una parte proporcional al insumo sospechoso: la grasa no se des-mezcla. Es la misma regla que ya usaba el resumen de «clientes alcanzados»; acá queda dicha en la pantalla.

## El contacto: lo que hay, sin inventar un propósito

El maestro de clientes declara contactos por propósito —pedidos, facturación, cobranza, despacho—. **No hay un propósito «calidad» ni «recall», y no se inventa uno** — el negocio confirmó el 2026-09-21 que no se agregue. Se usa el de **despacho**, que es quien atiende la mercadería, y `contactoPara()` cae en el contacto principal si nadie está designado para eso. Si tampoco hay contacto, se muestran el teléfono y el correo de la empresa, marcados como lo que son. Si no hay nada, lo dice en ámbar en vez de dejar la celda en blanco.

Los ids de cliente salen de la cadena comercial, que ya está acotada a la compañía, pero la consulta de contactos **vuelve a filtrar por empresa**: confiar en el camino no es comprobarlo.

## Es una consulta, y solo eso

No registra a quién se avisó ni marca nada como notificado. Cómo se comunica un recall, quién lo firma y qué se le pide al cliente son decisiones del negocio que nadie tomó, y no se inventan desde una pantalla. Hay una guarda que comprueba que esta página **no escribe en la base** — y está escrita sobre el código, no sobre el texto, porque la primera versión se disparaba con su propio comentario.

## Los contactos que no estaban cargados

Los clientes sembrados no tenían ni un contacto, así que la columna solo podía mostrar el teléfono de la empresa. `npm run seed:trazabilidad` carga ahora uno de despacho por cliente.

Las personas son **inventadas**, igual que las marcas de la competencia en `seed-calidad.ts`: un sembrador viaja con el repositorio y termina en demos y capturas, y poner ahí el nombre y el celular de alguien real es publicar el dato de un tercero. Los números arrancan en 9 como los celulares peruanos y no corresponden a ninguna línea asignada.

Solo toca clientes **sin ningún contacto**: el que alguien cargó a mano no se reemplaza. Sigue siendo idempotente.

## Verificación en navegador (`erp_dev`)

| Alcance | Qué muestra |
| --- | --- |
| Lote del proveedor PROV-NB-77 (2 recepciones) | 5 clientes, 178 unidades — que es 4 + 120 + 54, los tres lotes alcanzados |
| Lote LG-00001 solo | 5 clientes, 120 unidades — coincide con su propia tabla |

Con contactos sembrados: «Elena Vargas Ríos — Supervisora de despacho · 900000103 · elena@cli-00003.ejemplo.pe · 955112233». Antes de sembrarlos: «Sin contacto designado» y el teléfono de la empresa. Sin errores en consola.

`tests/a-quienes-hay-que-avisar.test.ts`: 18 pruebas. Las dos guardas de pantalla —el alcance declarado y el enlace que lo conserva— se verificaron quitando el cambio: se ponen en rojo.
