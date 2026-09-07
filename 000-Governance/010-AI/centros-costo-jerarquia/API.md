# API — Jerarquía de centros de costo

- `crearCentroCosto` acepta `parentId` opcional y verifica que pertenezca a la compañía activa.
- `guardarPadreCentroCosto(centroId, estado, formData)` valida existencia, compañía y ausencia de ciclos antes de actualizar.
- `src/lib/jerarquiaCentrosCosto.ts` ofrece recorrido, detección de ciclos y suma de subárbol como funciones puras testeables.
