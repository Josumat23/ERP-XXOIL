# Datos fiscales declarados

Bloque 2 del maestro, construido **en los términos acordados**: todo lo que sigue se carga a mano desde la ficha RUC, porque **no hay servicio de SUNAT conectado**. El sistema no valida ni refresca nada.

Decirlo no es una excusa: es lo que cambia el diseño.

## Lo que importa no es el dato, es cuán viejo es

Un estado de RUC cacheado y nunca refrescado deja de ser un dato y pasa a ser **una afirmación falsa**. «Activo» visto ayer y «activo» visto en 2019 son cosas distintas, y una ficha que los muestra igual miente.

Por eso el estado y la condición **no se guardan solos**: van con `rucConsultadoEn` y `rucFuenteConsulta`, y la validación rechaza declarar uno sin el otro. Sin fecha y sin origen, el dato no se puede juzgar.

## Los avisos

`avisosFiscales` responde «¿qué habría que mirar antes de facturarle?»:

| Aviso | Cuándo |
| --- | --- |
| Sin consulta | Tiene RUC y nadie lo miró nunca |
| Consulta vieja | Pasaron más de 180 días |
| Estado no activo | Baja, suspensión — el comprobante puede ser observado |
| No ubicable | No habido o no hallado |

**Avisan, no bloquean.** El dato es manual: frenar una venta por una consulta que alguien no actualizó castigaría al vendedor por una tarea administrativa ajena. Y un cliente puede figurar «no hallado» y seguir comprando al contado sin problema.

**Se devuelven todos, no el primero.** Que la consulta esté vieja no quita que el estado que registra ya sea malo — son dos problemas y se nombran los dos.

A quien no tiene RUC no se le aplica ninguno: a una persona con DNI no le corresponde un estado de contribuyente.

## Los 180 días

No salen de ninguna norma. Es un criterio operativo: medio año es suficiente para no pedir una consulta por cada venta, y poco para que un cliente dado de baja pase inadvertido una campaña entera.

Está como constante con nombre y en la primera pantalla del archivo, justamente para que se pueda discutir y cambiar.

## Lo que se guarda y no hace nada — dicho en voz alta

`agenteRetencion`, `agentePercepcion`, `buenContribuyente` y `afectacionTributaria` **no alteran ningún cálculo.**

Las tasas y los supuestos de retención y percepción son normativos, y el negocio todavía no confirmó su régimen. Hacer que esas marcas cambien un comprobante sería inventar una regla tributaria. Hoy son información para quien emite, y nada más.

**Una guardia lo sostiene:** una prueba recorre las acciones de pedidos, las de facturas y el módulo de moneda, y falla si alguno menciona esos campos. Si algún día se conectan, va a ser una decisión explícita y no un descuido.

## El tipo de contribuyente se transcribe, no se clasifica

«SOCIEDAD ANONIMA CERRADA», «PERSONA NATURAL CON NEGOCIO»: es la lista de SUNAT, no una del sistema. Se copia lo que dice la ficha en vez de mapearla a categorías propias que después habría que mantener sincronizadas con las suyas.

## Los estados son los de SUNAT

`EstadoRuc` (activo, suspensión temporal, baja provisional, baja definitiva, baja de oficio) y `CondicionRuc` (habido, no habido, no hallado, pendiente) son **dos cosas distintas** y SUNAT las distingue: el estado dice si el RUC está vigente; la condición, si al contribuyente se lo puede ubicar en su domicilio.

Meterlas en un solo campo —el error fácil— haría imposible registrar un RUC activo cuyo titular está no habido, que es justamente el caso que conviene ver antes de dar crédito.

## Lo que sigue faltando del bloque

**La validación real contra SUNAT.** Necesita un servicio y credenciales. Cuando existan, lo que hay que construir está acotado: una consulta que rellene estos mismos campos y actualice `rucConsultadoEn`. El modelo ya está preparado para eso; lo que no se hizo fue fingir que ya ocurre.
