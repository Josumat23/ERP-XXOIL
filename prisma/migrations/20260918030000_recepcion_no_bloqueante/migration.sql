-- La inspección de entrada deja de retener el material.
--
-- Decisión del negocio (2026-09-17): todo insumo se compra y puede ir directo a
-- producción, pase o no por laboratorio. Hasta ahora, marcar un insumo como
-- «requiere inspección» era un BLOQUEO duro y sin alternativa: la recepción no
-- ingresaba el stock, así que la planta veía la materia prima en el almacén y
-- no la podía usar hasta que calidad la mirara.
--
-- Es el bloqueo más caro del sistema, y estaba puesto sin que nadie lo
-- decidiera. Ahora es el mismo control de tres niveles que ya rige la
-- calibración, y nace en ADVIERTE.
--
-- El enum se renombra porque pasa a gobernar dos controles distintos —la
-- calibración al liberar un lote y la inspección de lo que entra— y mantener
-- dos enumeraciones idénticas es garantizar que diverjan.

-- RenameEnum
ALTER TYPE "NivelControlCalibracion" RENAME TO "NivelControl";

-- AlterTable
ALTER TABLE "configuracion_empresa"
  ADD COLUMN "nivelInspeccionRecepcion" "NivelControl" NOT NULL DEFAULT 'ADVIERTE';

-- AlterTable
--
-- Marca que el material entró al stock en la recepción, sin esperar a calidad.
-- Las inspecciones ya existentes quedan en `false`, que es la verdad: se
-- crearon cuando la recepción retenía el material, y su aprobación sigue
-- siendo la que lo ingresa.
ALTER TABLE "inspecciones_compra"
  ADD COLUMN "stockIngresadoEnRecepcion" BOOLEAN NOT NULL DEFAULT false;
