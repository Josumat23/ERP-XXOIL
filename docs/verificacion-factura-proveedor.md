# Verificación de factura de proveedor

La recepción compara cantidad y precio facturados con la OC y lo efectivamente recibido. Una diferencia de precio superior al 5% deja la cuenta por pagar en estado `BLOQUEADA`.

## Control de pago

- Ni el pago individual ni las propuestas de pago pueden usar una factura bloqueada.
- Un pago pendiente creado anteriormente tampoco puede aprobarse mientras persista el bloqueo.
- Gerencia o Administración puede aceptar la diferencia por excepción con justificación obligatoria.
- Quien registró la recepción/factura no puede liberar su propia excepción.
- Se conservan actor, fecha y motivo de la liberación.
