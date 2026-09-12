# Condiciones comerciales del proveedor, con vigencias

Cierra el pendiente P3 del Blueprint 05: *`Proveedor` → historial/versión de condiciones comerciales (plazo de pago, descuentos). Útil para trazar por qué cambió una condición pactada.*

## Qué faltaba

`AuditoriaMaestro` ya registraba **que** el plazo cambió, con el valor anterior y quién lo tocó. Lo que no podía contestar es lo que el ítem pedía:

- **qué plazo regía cuando se recibió esta factura** — la auditoría guarda el momento de la edición, no la vigencia de lo pactado;
- **por qué se pactó así** — un diff de campos no lleva motivo.

## El modelo

```prisma
model CondicionComercialProveedor {
  condicionPagoDias Int
  vigenteDesde      DateTime
  vigenteHasta      DateTime?  // null = vigente
  motivo            String     // obligatorio
}
```

**Los rangos son semiabiertos**: `[vigenteDesde, vigenteHasta)`. Abrir una versión nueva cierra la anterior **en la misma fecha**, sin restar un día ni dejar huecos. Cerrar en "desde menos un día" obliga a razonar sobre medianoches y zonas horarias para nada, y deja la puerta abierta a que una factura caiga entre dos condiciones.

**El motivo es obligatorio.** El ítem pedía poder trazar *por qué* cambió una condición, y una fecha sin motivo no lo contesta.

**`Proveedor.condicionPagoDias` sigue existiendo** como el valor vigente que lee el resto del sistema. El historial no lo reemplaza: responde qué regía cuándo. Registrar una condición actualiza el maestro en la misma transacción, así que no pueden divergir.

## No se puede reescribir el pasado

Una versión nueva no puede empezar **antes** que la vigente. Permitirlo reescribiría el plazo bajo el que ya se recibieron facturas, que es justo lo que este historial viene a impedir.

Un error se corrige registrando la condición correcta desde hoy, y el motivo deja constancia de que fue una corrección. Sí se admite empezar en la **misma** fecha que la vigente: eso es corregir lo que se acaba de pactar, no alterar un período cerrado.

## El maestro dejó de tener el plazo editable

El selector de "condición habitual" en la ficha del proveedor pasó a ser de solo lectura, con un texto que remite al panel de condiciones.

Dos caminos para cambiar el mismo valor, uno de los cuales no deja historial, vacían la función: bastaría con editar el maestro para que la trazabilidad desapareciera sin que nada avisara. Una prueba de la suite falla si el campo editable vuelve al formulario.

## Antes del primer registro no hay condición, y eso no es "contado"

`condicionVigenteEn()` devuelve `null` para una fecha anterior al primer registro. Cero días es una condición pactada; la ausencia de una es otra cosa, y quien lo muestre debe decir "sin condición registrada".

## Verificación

**10 pruebas** (229 en total). Las puras: resolución por fecha; **el día del cambio ya rige la nueva** (ninguna factura cae en dos condiciones ni en ninguna); `null` antes del primer registro; la vigente es la única abierta; un solapamiento heredado no devuelve una respuesta ambigua; y el rechazo de vigencias retroactivas, plazos no enteros o negativos, y motivos vacíos.

Sobre base efímera: registrar una condición cierra la anterior sin huecos, y borrar el proveedor se lleva su historial.

**Dos guardias**: que el campo editable no vuelva al maestro, y que la acción valide el proveedor contra la compañía activa y deje el maestro sincronizado.

**Navegador** — render real de la ficha:

| Plazo | Rige desde | Hasta | Motivo |
|---|---|---|---|
| 45 días | 1 jun. 2026 | **Vigente** | Negociación por volumen anual |
| 30 días | 1 ene. 2026 | 1 jun. 2026 | Condición inicial pactada |

El cierre de la primera cae exactamente donde empieza la segunda. El maestro muestra "Crédito 45 días" en solo lectura con el aviso de dónde se cambia.

**Alcance de lo verificado**: la tabla y el formulario se comprobaron renderizados; el camino de escritura quedó cubierto por las pruebas y la guardia estructural, no por un envío completo desde el navegador — el panel de vista previa estaba oculto y React difiere el procesamiento del envío en esa condición.

## Lo que no incluye

- **Solo el plazo de pago.** El diccionario mencionaba también descuentos pactados, pero el sistema no tiene hoy un descuento por proveedor que versionar: `DescuentoCanal` es de clientes. Agregar un campo que nada usa no serviría de nada; cuando exista el descuento de compra, se versiona en esta misma tabla.
- **No recalcula vencimientos ya emitidos.** Una cuenta por pagar conserva la fecha con la que se creó; el historial explica bajo qué condición se hizo, no la corrige.
