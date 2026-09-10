# Aislamiento multiempresa de mantenimiento y variaciones

Mantenimiento y el análisis de variaciones de producción operan dentro de la empresa activa.

- Listados, detalles, avisos, confiabilidad y formularios filtran equipos, órdenes, centros de costo, repuestos y lotes por compañía.
- Crear una orden valida el equipo, el aviso y el centro de costo en el servidor.
- Iniciar, completar o cancelar exige que la orden pertenezca a un equipo de la empresa activa.
- Los repuestos consumidos deben pertenecer a la misma compañía.
- Los egresos de caja y posteos contables conservan el `empresaId` del equipo intervenido.
- Las variaciones de producción agregan únicamente lotes de la empresa activa.

`OrdenMantenimiento` no duplica `empresaId`; su ámbito se resuelve mediante la relación obligatoria con `Equipo`.
