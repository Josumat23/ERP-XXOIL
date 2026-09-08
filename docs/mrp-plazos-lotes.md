# Plazos y tamaños de lote en MRP

Cada insumo permite configurar tres parámetros de aprovisionamiento: plazo de entrega en días calendario, cantidad mínima de compra y múltiplo de compra.

El motor calcula primero la necesidad neta contra consumo, stock mínimo, stock físico y reservas de producción. Si hay faltante, eleva la propuesta a la compra mínima y la redondea hacia arriba al siguiente múltiplo. Un valor cero desactiva la restricción correspondiente.

La pantalla MRP muestra tanto la necesidad neta como la cantidad final propuesta y calcula la fecha estimada desde el día en que se consulta. Al generar la orden sugerida, la fecha queda copiada a `fechaEntregaEsperada` en cada línea.

Los parámetros viven en el maestro de insumos y sus cambios quedan incluidos en la auditoría de maestros existente.
