# Aislamiento multiempresa de fórmulas y lotes

Las fórmulas y órdenes de producción operan exclusivamente dentro de la empresa activa.

- Listados, detalles, formularios y recall filtran fórmulas y lotes por compañía.
- Los selectores muestran únicamente productos, insumos, centros de trabajo, equipos y lotes de reproceso de la empresa activa.
- Crear o activar una fórmula valida nuevamente todas sus relaciones en el servidor.
- Crear, liberar, cancelar, ajustar o finalizar un lote exige que el lote y sus materiales pertenezcan a la empresa activa.
- Las operaciones de la ruta validan indirectamente la compañía mediante su lote y directamente la pertenencia del equipo seleccionado.
- Las altas de fórmulas y lotes escriben `empresaId` explícitamente.

Los registros hijos sin `empresaId` propio quedan aislados mediante su relación obligatoria con la fórmula o el lote correspondiente.
