# Qué declara un producto: API, ACEA, JASO y las homologaciones

Un distribuidor de lubricantes no pregunta "¿qué aceite es?". Pregunta **"¿cumple API CK-4?"**, "¿sirve donde piden ACEA E9?", "¿está homologado por Mercedes-Benz?". Esa respuesta vive en el maestro de producto o no existe.

Hasta ahora vivía en `Producto.notasTecnicas`, texto libre. Servía para que una persona lo leyera y para nada más: no se puede filtrar, no se puede responder "qué productos cubren ACEA E9", y el certificado de análisis no la mencionaba.

## La distinción que el texto libre borra

**Cumplir** y estar **homologado** no son lo mismo, y el rubro los distingue:

| | Quién lo afirma | Lleva número | Se puede verificar |
| --- | --- | --- | --- |
| **Cumple** | el fabricante, bajo su responsabilidad | no | no |
| **Homologado** | el organismo que la otorgó | sí, con vigencia | sí, contra su lista |

«Cumple los requisitos de API CK-4» y «MB-Approval 228.31 n.º XXXXX» son afirmaciones de peso distinto. Aplanarlas en un campo de texto —que es lo que pasa cuando no hay estructura— deja que un documento afirme una aprobación que nadie otorgó.

El sistema aporta la distinción. **Cuál corresponde a cada producto lo declara el negocio**, porque no hay forma de deducirlo.

## Lo que se construyó

`EspecificacionTecnica` es el catálogo de normas que la empresa maneja: organismo (API, ACEA, JASO, SAE, ISO, NLGI, OEM, OTRO), código y —solo para OEM— quién la emite.

`EspecificacionProducto` es lo que cada producto declara sobre cada una: el tipo, y cuando es homologación, su número y su vigencia.

Reglas, todas sobre la coherencia de la declaración y ninguna sobre qué debe cumplir un producto:

- **Una homologación sin número se rechaza.** No es una regla legal inventada: sin número, quien lee el documento no puede verificarla contra la lista del organismo. El mensaje ofrece la salida — declararla como «cumple».
- **Una homologación sin vigencia también.** Sin ella no se sabe si sigue en pie.
- **No se carga una homologación ya vencida.**
- **Un «cumple» con número de aprobación se rechaza, no se limpia en silencio.** Si alguien cargó un número, lo más probable es que se haya equivocado de tipo, no de campo; borrarlo callado perdería el dato y la intención.
- **Un código OEM exige su emisor.** «228.31» no dice nada sin «Mercedes-Benz», y el certificado lo imprimiría igual de mudo. «API CK-4» se lee solo.

### El catálogo nace vacío, a propósito

Qué códigos existen y cuáles siguen vigentes es conocimiento del rubro que cambia —API CK-4 reemplazó a CJ-4—, y sembrar una lista sería declarar por XXOIL qué dice cumplir. Es el mismo criterio del checklist de cierre de período: el sistema aporta el mecanismo, no el contenido. **Una prueba de la suite falla si algún seed empieza a sembrarlo.**

Lo que sí es estable son los organismos: API, ACEA, JASO, SAE, ISO y NLGI existen y seguirán existiendo. Ese enum sí viene cargado.

## La conexión: el certificado de análisis

Un campo que nada consume es un campo muerto. Las especificaciones se imprimen en el **certificado de análisis**, que es el documento que el cliente industrial recibe y lee.

Dos decisiones de honestidad en ese documento:

**Van en su propio bloque, con su propia leyenda.** Mezclarlas con la tabla de mediciones haría creer que el lote se ensayó contra API CK-4, cuando lo que se midió es lo que el plan de inspección dice. El certificado aclara: *«Corresponden al producto y no a los ensayos de este lote».*

**Una homologación vencida no se imprime.** El documento se emite hoy: afirmar hoy una aprobación que dejó de regir es afirmar algo que no es cierto, y quien lo reciba no la encontrará en la lista del organismo. No se bloquea ni se borra nada — la declaración sigue en la ficha del producto, marcada **VENCIDA** en rojo, para que alguien cargue la renovación. Lo único que ocurre es que el certificado deja de afirmarla.

## Dónde se equivocan los ERP genéricos

SAP resuelve esto con clasificación (características de lote/material, CT04): un mecanismo genérico donde «API CK-4» termina siendo el valor de una característica de texto. Funciona para almacenar y es malo para lo demás — no distingue una declaración propia de una aprobación de tercero, no tiene vigencia, y no hay nada que impida imprimir una homologación caducada en un documento que va al cliente.

No es un descuido de SAP: es que el problema no es genérico de manufactura, es del rubro. Un fabricante de lubricantes vive de esas siglas.

## Verificación en navegador (`erp_dev`)

1. Catálogo vacío al entrar, con el texto que explica por qué.
2. **API CK-4** cargada desde la pantalla.
3. **OEM sin emisor**: se quitó del formulario el campo `emisor` y se envió igual —un POST fabricado—; el servidor lo rechazó con *«Para una especificación OEM indique quién la emite…»*.
4. En la ficha de GR-CHASIS: **API CK-4 · Cumple · —**, **ACEA E9 · Homologado n.º APR-E9 · 31 ene. 2028**, y **Mercedes-Benz 228.31 · Homologado n.º APR-228.31 · 30 jun. 2026 — VENCIDA** en rojo. El emisor va delante del código, como corresponde a un OEM.
5. En el certificado de LG-00004: se imprimen **API CK-4 (Cumple)** y **ACEA E9 (Homologado n.º APR-E9)**; la 228.31 **no aparece**, con la leyenda que separa las especificaciones de los ensayos.

`tests/especificaciones-producto.test.ts`: 19 pruebas. Se verificó que las guardias detectan la reintroducción del defecto — sembrando el catálogo en `seed.ts` y quitando el filtro de vencidas del certificado, fallan con *«prisma/seed.ts está sembrando el catálogo de especificaciones»* e *«imprimiría homologaciones vencidas»*.

**Declarado sin adorno**: la declaración de las dos homologaciones se cargó directo en `erp_dev`, no por pantalla. El selector de tipo es un `<select>` controlado por React y el navegador de la sesión no puede dispararle un `onChange` de confianza — es una limitación de la herramienta de verificación, no del formulario: el mismo formulario sí se usó por pantalla para declarar API CK-4 como «cumple», y el `useActionState` respondió con los mensajes del servidor en los dos casos.

## Un defecto propio, encontrado al verificar

Con las tres especificaciones ya declaradas, la pantalla decía *«No hay especificaciones activas en el catálogo todavía. Cárguelas en…»* — y sí las había: estaban todas declaradas. El mensaje mandaba a cargar algo que ya estaba cargado. Ahora distingue las dos situaciones.

## Lo que queda fuera

- **Equivalencias con productos de la competencia** («¿cuál es tu equivalente al Mobil Delvac 1340?»). Es media venta en este rubro y no existe. Se apoya en esta estructura: una equivalencia se justifica contra especificaciones, no contra un nombre.
- **El aviso de vencimiento solo está en la ficha del producto.** `homologacionesPorVencer()` marca en ámbar las que vencen dentro de 90 días —renovar una homologación toma meses, y avisar el día del vencimiento es avisar tarde—, pero no llega al semáforo del panel general ni a ningún reporte. Quien no abra la ficha no se entera.
- **`notasTecnicas` se conserva** y no se migró: su contenido es texto de redacción libre que no siempre son especificaciones, y convertirlo automáticamente habría inventado declaraciones.
