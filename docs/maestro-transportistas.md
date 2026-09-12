# Maestro de transportistas

Construido el **2026-09-13**, al confirmar el negocio que la distribución **no** es 100% flota propia: tiene flota, terceriza y además contrata para despacho.

## Lo que había

`GuiaRemision` ya podía documentar transporte por tercero —lleva modalidad, transportista, su RUC, placa y DNI del conductor— pero **sueltos, retipeados en cada emisión**. El mismo transportista escrito de cinco maneras distintas, sin forma de saber cuánto se le despachó ni de validar su RUC contra nada.

## Lo que se hizo

`Transportista` por compañía, con sus **vehículos** y **conductores**. La guía lo elige de una lista en vez de escribirlo.

**La flota propia no vive en este maestro**: es `Equipo`, que además lleva su historial de mantenimiento. Duplicarla aquí crearía dos verdades sobre el mismo camión, y hay una prueba que falla si alguien le agrega un vínculo a `Equipo`. La guía conserva las dos vías —`equipoId` para el vehículo propio, `transportistaId` para el contratado— porque son cosas distintas.

## Lo que no se toca

**Los campos de texto de la guía se conservan.** Guardan lo que se imprimió y son el respaldo de las guías que el maestro todavía no cubre. Es el mismo criterio que se usó con el ubigeo y la dirección escrita a mano, y por la misma razón: `datosDeTransportista(null)` devuelve un objeto **vacío**, no dos `null`, para que al esparcirlo en un `update` las claves ausentes dejen intactas las columnas.

**Un transportista puntual se sigue escribiendo a mano.** El selector tiene «Otro — escribirlo a mano», y las listas de placas y conductores tienen «Otra…» / «Otro…». Un maestro que obligue a darse de alta antes de emitir una guía urgente se saltea el día que hay prisa.

## Lo que no se confía del navegador

El id del transportista llega del formulario, y **la razón social y el RUC se releen de la ficha** dentro de la acción, acotados a la compañía activa. Nunca se persiste lo que el formulario diga de ellos: ese texto se imprime en la guía y se declara ante SUNAT, así que aceptar un id válido con una razón social inventada sería exactamente el agujero. Hay una guardia estructural sobre esto.

Lo mismo con los vehículos y conductores: cuelgan de un `transportistaId` que llega del navegador, y las tres acciones lo releen acotado a la compañía antes de escribir. Las bajas se acotan por la relación (`where: { id, transportista: { empresaId } }`), no por el id suelto.

## Detalles del modelo

**El RUC es único por compañía, pero opcional.** Varios transportistas pueden no tenerlo sin chocar entre sí, porque SQLite y PostgreSQL tratan cada `NULL` como distinto en un índice único. Así se puede registrar una ficha antes de tener el dato — y el sistema avisa al emitir: en transporte público el RUC es obligatorio, con un mensaje que dice dónde completarlo.

**El registro del MTC es referencia informativa.** Se guarda; el sistema no valida su vigencia ni bloquea por él, porque eso exige consultar al MTC y nadie lo pidió.

**La placa no tiene formato fijo.** Las placas peruanas cambiaron de formato varias veces y un vehículo extranjero en tránsito tiene el suyo: se exige que diga algo, no que calce con un patrón. Sí se normaliza a mayúsculas.

**Las bajas son lógicas, no borrados.** Un vehículo o un conductor pueden figurar en guías ya emitidas, y esas guías no se reescriben. La FK de la guía hacia el transportista es `Restrict` por lo mismo.

## El relleno de las guías existentes

La migración deduce **solo lo que el dato realmente dice**:

- **Transportistas**: uno por cada RUC distinto ya usado en guías, con la razón social recuperada de cualquier guía que la tuviera. Verificado: dos guías del mismo RUC, una sin razón social, producen **un** transportista con el nombre correcto.
- **Vehículos**: las placas que ya viajaron con ese transportista.
- **Conductores**: **no se rellenan.** La guía guarda el DNI pero no el nombre, y inventarle uno ensuciaría el maestro. Se registran a mano la próxima vez que se use uno.
- Una guía **sin RUC de transportista** se queda como está: es transporte propio, o un dato que nunca se capturó. Verificado que su placa no se cuela al maestro.

## Verificación

**11 pruebas** (315 en total): la derivación que no borra lo escrito a mano, el RUC opcional de 11 dígitos, la placa sin formato fijo, el DNI de 8, varios transportistas sin RUC conviviendo, el mismo RUC en dos compañías, el borrado en cascada de vehículos y conductores, y tres guardias — que la guía derive de la ficha, que las acciones validen la compañía, y que el maestro no absorba la flota propia.

El relleno se probó aparte, sobre una base con guías reales, antes de darlo por bueno.

**En navegador**: se creó `TRA-00001` con RUC y registro MTC (auditado como `CREAR`), se le agregó un vehículo —placa `abc-123` normalizada a `ABC-123`— y un conductor. En la guía, elegir el transportista **hizo desaparecer los campos libres de razón social y RUC**, mostró «Se declarará como Transportes Andinos S.A.C. (RUC 20512345678)» y **preseleccionó** su placa y su conductor. La guía emitida quedó con `transportistaId` apuntando al maestro y con la razón social y el RUC tomados de la ficha.

## Lo que este ciclo no hace

**No hay licitación de flete.** Contratar no es licitar: nadie pidió comparar tarifas por tramo antes de asignar. Si hiciera falta, la pieza a reutilizar es el RFQ de compras, que ya exige dos ofertas y una justificación escrita.

**No se valida el RUC contra SUNAT** ni el registro contra el MTC. Son consultas a servicios externos que exigen credenciales y una decisión sobre qué hacer cuando el servicio no responde.
