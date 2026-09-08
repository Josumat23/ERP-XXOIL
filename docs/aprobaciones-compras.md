# Liberación multinivel de compras

## Alcance

Administración configura niveles secuenciales por monto en PEN y rol responsable. Al crear una OC se congela la ruta aplicable; cambiar la configuración no altera documentos existentes.

## Controles

- El creador de la OC no puede aprobarla ni rechazarla.
- En RFQ, solicitante y adjudicador deben ser personas distintas; el adjudicador queda como creador de la OC y tampoco puede aprobarla.
- Solo se resuelve el primer paso pendiente. Un nivel de Administrador no puede ser resuelto por Gerencia.
- El rechazo exige motivo, detiene toda la liberación y conserva actor y fecha.
- La recepción continúa bloqueada mientras la aprobación global esté pendiente o rechazada.
- Órdenes históricas sin pasos conservan el flujo anterior.
