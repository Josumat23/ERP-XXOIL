# Paso 5 — Disparadores de negocio para retomar Fase 3+ (diferida)

**Fecha:** 2026-08-04
**Propósito:** el diagnóstico de 17 catálogos SAP (`02-cruce-rf/`) y su roadmap (`03-plan-priorizado-y-hoja-de-ruta.md`) quedaron cerrados en este punto — Fase 1 y Fase 2 completas, y de Fase 3+ solo se construyó lo que ya tenía datos o necesidad real detrás (ver sección 3.4 de `03-plan-priorizado-y-hoja-de-ruta.md`). Los tres ítems que quedan (11, 12, 13) no se construyeron porque hacerlo ahora sería inventar reglas de negocio que nadie pidió. Este documento existe para que, cuando el disparador real aparezca, no haya que rehacer el análisis de cero: basta con traer este archivo a la conversación y decir "pasó esto" — construir la mejora correspondiente arranca directo desde acá.

**Cómo usar este documento en el futuro:** cuando ocurra cualquiera de los disparadores listados abajo, pégale este archivo (o la sección relevante) a Claude junto con los detalles concretos del caso real (qué cliente, qué monto, qué exige exactamente). No hace falta releer todo el diagnóstico SAP de 2026-08 — el contexto de arquitectura y las decisiones de diseño ya tomadas están resumidas acá.

---

## 11. Comercio exterior

**Qué es:** exportación real — DUA, incoterms, facturación a clientes extranjeros, documentación aduanera.

**Disparador concreto (cualquiera de estos):**
- Un cliente extranjero hace un pedido real (no solo consulta).
- Se necesita emitir una factura de exportación o un DUA para un envío específico.
- Ya se negoció un incoterm (FOB, CIF, EXW, etc.) con un cliente o proveedor real.

**Estado de la base para arrancar cuando toque:**
- `Cliente`/`Proveedor` ya tienen "profundidad internacional" (país, tipo de documento fiscal no solo RUC) — fundación de multi-empresa/internacional, Fase 1, ver `TipoDocumentoFiscal` en `prisma/schema.prisma`.
- `TipoCambio` ya existe (usado hoy para compras en USD) — reutilizable para facturación en moneda extranjera.
- `Factura`/`ComprobanteElectronico` (adapter SUNAT/OSE) son el punto de partida — habría que evaluar si una factura de exportación usa el mismo modelo con campos adicionales (incoterm, aduana, DUA) o uno paralelo.
- **No asumir el formato exacto de DUA ni de factura de exportación sin confirmarlo con el caso real** — igual que se hizo con el archivo de pago BBVA (no se fabricó el formato sin la plantilla oficial).

## 12. RR.HH./SST formal (Reclutamiento, desarrollo de personal, salud ocupacional, gestión ambiental)

**Qué es:** procesos formales de RR.HH. más allá de la ficha de empleado y vacaciones que ya existen — reclutamiento, capacitación/desarrollo, comité de seguridad y salud en el trabajo, gestión ambiental.

**Disparador concreto (cualquiera de estos):**
- Contratan a alguien dedicado a RR.HH. o a seguridad ocupacional (hoy no existe esa área dedicada).
- **Disparador legal, no solo de crecimiento:** la Ley 29783 (Perú, Ley de Seguridad y Salud en el Trabajo) exige un Comité de Seguridad y Salud en el Trabajo a partir de 20 trabajadores — si el headcount de XXOil llega a ese umbral, es obligatorio, no opcional. El reporte `/rrhh/headcount` (construido en Fase 2) ya permite ver el conteo actual de trabajadores activos por área — es el lugar natural para vigilar cuándo se acerca a 20.
- Empiezan a necesitar registrar capacitaciones o incidentes de forma formal porque una auditoría externa o un cliente grande lo exige.

**Estado de la base para arrancar cuando toque:**
- `Empleado` y `SolicitudVacaciones` ya existen (RRHH básico, Fase 1 del historial general).
- `Insumo.esPeligroso`/`claseGhs` (EHS, Fase 2) ya clasifica sustancias peligrosas — un módulo de SST formal debería enlazarse a este catálogo (ej. capacitación obligatoria para manipular insumos peligrosos), no duplicarlo.
- `Adjunto` (DMS genérico) ya sirve para adjuntar certificados/constancias de capacitación sin modelo nuevo.

## 13. Certificados de análisis automáticos

**Qué es:** emitir un certificado de análisis/conformidad de lote (viscosidad, punto de inflamación, grado NLGI medido, etc.) para clientes industriales/mineros que lo exigen como requisito de compra.

**Disparador concreto:**
- Un cliente industrial/minero específico pide un certificado con parámetros concretos como condición de compra — **se necesita saber exactamente qué parámetros exige ese cliente antes de construir nada** (viscosidad a qué temperatura, con qué método de ensayo, qué tolerancias). Fabricar un formato sin ese dato sería inventar un certificado que ese cliente después podría rechazar igual.

**Estado de la base — la brecha real, verificada en código (2026-08-04):**
- `ControlCalidad` (control de calidad interno de cada lote) hoy solo captura `resultado` (APROBADO/RECHAZADO) + `causaId`/`causaRaiz`/`accionCorrectiva` (solo si fue rechazado). **No captura valores medidos por parámetro.**
- `Producto` sí tiene `gradoNlgi` y `viscosidad` — pero son las especificaciones/target del producto, no lo medido en un lote específico.
- **Para construir esto de verdad hace falta, como mínimo:**
  1. Definir con XXOil (o con el cliente que lo exige) la lista de parámetros a medir por lote (ej. viscosidad a 40°C, punto de inflamación, grado NLGI, contenido de agua, etc.) y sus unidades/tolerancias.
  2. Agregar captura de esos valores medidos a `ControlCalidad` (o un modelo `ResultadoAnalisisLote` nuevo, uno-a-muchos con `LoteGranel`, cada fila = un parámetro + valor medido + valor especificado + si pasó o no).
  3. Recién ahí tiene sentido el certificado imprimible — es la última pieza, no la primera.
- `LoteGranel` ya tiene trazabilidad completa (recall, envasados, clientes que recibieron cada lote) — la parte de "a quién le llegó este lote" ya está resuelta, solo falta la parte de "qué se midió".
