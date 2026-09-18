# RRHH estaba construido y vacío

Un barrido de las pantallas del sistema —sesión de admin creada a mano, las 178 rutas pedidas por HTTP— encontró que **138 pantallas estáticas y 24 de detalle responden sin un solo error**, y que **15 pantallas de detalle no se pueden ni abrir porque no hay un registro que mirar**.

RRHH era una de ellas, y de las peores: cero empleados, cero posiciones, cero planillas. Siete pantallas construidas sin nada que mostrar. Quien estrena el sistema no concluye «faltan datos»: concluye que el módulo no funciona.

## La planilla no se escribe a mano

El módulo tiene su propio motor: `generarPlanillaMensual()` calcula la remuneración, los aportes, los descuentos de pensión, la retención de quinta categoría y **contabiliza el asiento**.

Escribir los importes en el sembrador sería una segunda implementación del cálculo, y la que quedara vieja sería la del sembrador: los números de la demo dirían una cosa mientras la pantalla dice otra. El sembrador carga los **insumos** —personas, sueldos, sistema de pensión, parámetros— y llama al motor.

El resultado, con los datos de prueba:

| Empleado | Básico | Asig. familiar | Pensión | 5ta cat. | Neto |
| --- | --- | --- | --- | --- | --- |
| Ricardo Salinas (AFP Integra) | 9 500.00 | 0.00 | −1 262.55 | −981.00 | 7 256.45 |
| Hernán Ticona (ONP, con hijos) | 2 100.00 | **102.50** | −286.33 | 0.00 | 1 916.17 |
| Diego Arrieta (ONP) | 1 900.00 | 0.00 | −247.00 | 0.00 | 1 653.00 |

Los 102.50 de asignación familiar son el 10 % de la RMV, y los salen del motor, no del sembrador. Igual la pensión: 13 % en ONP, y en AFP el aporte más comisión más prima.

## Sobre los valores legales

La planilla peruana se calcula con **RMV, UIT y tasas de AFP**. Son valores que fija el Estado y cambian.

Van en el sembrador como **datos de prueba para que el cálculo corra**, no como una afirmación de cuánto valen hoy. El sembrador lo imprime al terminar, para que nadie los herede sin verlos:

> **ATENCIÓN — los parámetros de planilla son DATOS DE PRUEBA:** RMV 1025, UIT 5350 y las tasas de AFP están puestos para que el cálculo corra, NO son una afirmación de cuánto valen hoy. Antes de cualquier planilla con dinero real, cárguelos en «RRHH → Planilla → Parámetros».

Las tasas de **EsSalud (9 %) y ONP (13 %) no se inventan acá**: son los valores por omisión que ya trae el esquema. Hay una guarda que comprueba que el sembrador no las fije.

## Las personas son inventadas

Igual que las marcas de la competencia en `seed-calidad.ts` y los contactos en `seed-trazabilidad.ts`. Un sembrador viaja con el repositorio y termina en demos y capturas; poner ahí el nombre, el DNI o el sueldo de alguien real es publicar el dato de un tercero.

Los DNI siguen el formato de ocho dígitos pero **empiezan por `00`**, que no se asigna. Una prueba lo comprueba uno por uno.

## La plantilla cuenta una historia

Nueve personas de una planta de grasas chica, y cada una está por algo:

| Caso | Para qué |
| --- | --- |
| Un activo **sin sistema de pensión** declarado | El propio módulo documenta que queda excluido de la corrida con una advertencia visible —«nunca se asume ONP/AFP por defecto en un cálculo con dinero real»—. Sin un caso así, esa advertencia no se ve nunca |
| Uno por **locación de servicios** | No entra en planilla por definición |
| Uno **cesado** | Rotación y headcount dejan de ser una línea plana |
| Uno con **asignación familiar** | Es un concepto que se suma aparte del básico |
| **Jefaturas declaradas** | El organigrama tiene forma de árbol |
| Una **posición vacante** | El organigrama sale de las posiciones, no de las personas: una posición puede quedar vacía y seguir existiendo, que es para lo que sirve tenerlas aparte |

En la pantalla de la planilla eso se lee así:

> **1 empleado(s) activo(s) excluido(s) de esta corrida** — No tienen sistema de pensión (o AFP) configurado. Complételo en su ficha y regenere la planilla si corresponde: Álvaro Pizarro Rondón.

## De paso, los centros de costo

El costo del personal tiene que pesar en el centro correcto, así que el sembrador carga tres —Planta, Administración, Comercial— y asigna cada empleado al suyo. Eso destraba además `/finanzas/centros-costo` y su ficha, otra de las 15 pantallas sin datos.

## Verificación

Las dieciséis pantallas del alcance responden 200 y muestran sus datos:

`/rrhh/empleados` · su ficha · `/rrhh/posiciones` · `/rrhh/organigrama` · `/rrhh/headcount` · `/rrhh/vacaciones` · `/rrhh/asistencia` (+ indicadores y turnos) · `/rrhh/planilla` · sus parámetros · el período · la boleta · `/finanzas/centros-costo` · su ficha · `/finanzas/asientos`

Comprobado además con `npm run semillas:desde-cero`, que siembra una base efímera y verifica los casos ejecutando las consultas de las pantallas: planilla 8/2026 con 6 boletas, un activo sin pensión, una posición vacante, jefaturas y un cesado. El sembrador se corre dos veces para comprobar que la segunda no escribe nada.

`tests/datos-de-prueba-rrhh.test.ts`: 8 pruebas.

## Lo que queda sin datos

De las 15 pantallas que el barrido encontró vacías, este ciclo destraba RRHH (7) y centros de costo (1). Siguen sin un registro: guías de remisión, cotizaciones, hojas de ruta, proyectos, no conformidades, tanques, conteos de inventario, centros de trabajo, RFQ, acuerdos de suministro, órdenes internas y conciliaciones bancarias.

Las guías de remisión son el caso con más consecuencia: `seed-demo.ts` asigna lotes a las ventas **solo por la factura** (23 filas) y nunca por la guía (0), así que la rama de trazabilidad por guía no la ejercita ningún dato — está probada a mano en `tests/reclamo-al-lote.test.ts` y nada más. Sembrarla mueve el momento de la salida de stock del facturar al despachar, y equivocarse ahí ensucia kardex, valorización y rentabilidad sin que nada lo avise. Queda anotado, no hecho.
