# Determinación automática de fuente de aprovisionamiento

El MRP evalúa los acuerdos de suministro activos y vigentes que contienen cada material requerido. Solo considera una línea contractual cuando su saldo cubre íntegramente la cantidad propuesta.

Entre las alternativas elegibles selecciona el menor costo normalizado a PEN. Para acuerdos en USD aplica el tipo de cambio pactado en el propio acuerdo. Si ningún acuerdo cubre la necesidad, conserva el proveedor predeterminado y el costo maestro del insumo.

Las propuestas se agrupan por acuerdo y proveedor. Al generar la orden de compra, el servidor vuelve a validar empresa, vigencia, proveedor, moneda, precio y saldo; incrementa la cantidad liberada y crea la OC con sus referencias contractuales dentro de una misma transacción. Una concurrencia que cambie el saldo cancela toda la operación. Cuando se consume el total del acuerdo, este pasa a cerrado.

Esta regla evita dividir automáticamente una necesidad entre contratos: una división puede implicar condiciones logísticas no modeladas y requiere decisión del comprador.
