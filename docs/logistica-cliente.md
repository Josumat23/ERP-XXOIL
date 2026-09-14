# Cuándo, cómo y desde dónde se le entrega

Bloque 7 del maestro. La decisión que lo ordena todo es **qué va en el cliente y qué va en la dirección**, y no es arbitraria.

## La ventana horaria es del lugar, no del cliente

Una misma minera recibe en su planta de martes a jueves, de 8 a 12, con inducción de seguridad y sin camión de tres ejes; y en su almacén de puerto, todos los días, sin restricción.

Poner la ventana en el cliente obligaría a elegir una de las dos. Así que van en `DireccionCliente`:

- `ventanaInicioMin` / `ventanaFinMin`
- siete columnas `recibeLunes` … `recibeDomingo`
- `requisitosEntrega` — lo que el transportista necesita saber **antes de salir**
- `restriccionesVehiculares`
- el responsable de recepción ya estaba: `contactoNombre` y `contactoTelefono` de esa dirección

Y en `Cliente` queda lo que sí es suyo: `almacenDespachoId`, `transportistaPreferidoId` y `frecuenciaReparto`.

Una prueba estructural comprueba las dos mitades, incluida la de que **la ventana no esté duplicada en el cliente**.

## Decisiones que no son obvias

**La hora se guarda como número de minutos desde medianoche, no como texto.** `"08:30"` ordenado como cadena pone las 9 antes que las 10, y la ventana existe justamente para compararla.

**Una ventana que cruza medianoche se expresa con `fin < inicio`.** Es el turno noche de una mina, y `dentroDeVentana` lo resuelve como la unión de `[inicio, 24h)` y `[0, fin)`. El borde inicial entra y el final no, como cualquier rango medio abierto.

**Inicio igual a fin se rechaza.** ¿Cero minutos o veinticuatro horas? Es ambiguo, y elegir por quien carga es peor que pedirle que lo diga.

**Media ventana también se rechaza.** «Recibe desde las 8» sin hora de cierre no permite decidir si un camión llega a tiempo.

**Siete columnas y no una lista separada por comas**, para poder preguntar «quién recibe los martes» sin parsear nada.

**El domingo es 7, no 0.** `Date.getDay()` devuelve 0 para domingo; confundirlo lo deja fuera de cualquier comparación ISO, y hay una prueba con fechas reales que lo fija.

**Una hora que no es una hora se rechaza.** El formulario manda texto: «media mañana» llega como `NaN`, que no es mayor ni menor que nada y pasaría una comparación de rango sin que nadie lo note.

**La ventana solo se exige en las direcciones de entrega.** Pedirla en un domicilio fiscal sería pedir un dato que nadie tiene.

## El almacén de despacho se propone, no se impone

Al elegir el cliente en un pedido, su centro de despacho habitual queda preseleccionado — y sigue siendo editable, porque un despacho puntual puede salir de otra planta. Lo mismo con el transportista preferido: es la preferencia, no una exclusividad, y nada impide licitar el flete igual.

Sin esto, los campos habrían sido decorativos: datos que se cargan y nadie usa.

## Los cascos dejan de contarse a mano

El esquema lo decía junto a `Insumo.esRetornable`:

> El control de cascos pendientes por cliente es manual por ahora (no hay todavía un módulo de seguimiento automático).

La ficha del cliente muestra ahora, por tipo de envase, cuántos tiene en su poder y cuánto depósito representan.

**No se guarda en el maestro.** El negocio lo pidió expresamente para saldos, facturas y pagos: se calculan desde los movimientos. Un número anotado se desincroniza; uno calculado no puede. Hay una guardia que falla si alguien agrega un `cascosPendientes` al cliente.

Dos detalles del cálculo:

- **Un saldo negativo se muestra, no se recorta a cero.** Significa que se registraron más devoluciones que entregas: es un error de carga que hay que ver, no esconder. La pantalla lo marca en rojo y dice qué revisar.
- **El depósito comprometido no cobra por saldos negativos.** Un error de carga no es un crédito a favor del cliente.
