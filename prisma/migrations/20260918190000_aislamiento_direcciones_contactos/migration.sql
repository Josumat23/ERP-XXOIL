-- Direcciones y contactos genéricos entran al aislamiento multiempresa.
--
-- Eran los DOS ÚNICOS modelos polimórficos sin `empresaId` —`Adjunto` ya la
-- tenía—, así que quedaban fuera del aislamiento que rige en todo lo demás.
-- En la práctica se acotaban por la entidad a la que cuelgan (el cliente, el
-- proveedor o el empleado sí llevan compañía), pero la fila en sí no se podía
-- filtrar ni contar por compañía, y cualquier consulta nueva nacía sin red.
--
-- Estaba anotado desde el 2026-09-14 como «pendiente de decisión propia». La
-- decisión no hacía falta: agregar la compañía preserva la funcionalidad tal
-- como está y cierra el hueco. Retirar el modelo de Proveedores y Empleados
-- —lo que se hizo con Clientes— sí sería una decisión de producto, porque
-- habría que inventar qué significa una dirección tipada para cada uno.
--
-- La columna se agrega NULLABLE, se rellena desde la entidad padre y recién
-- entonces se vuelve obligatoria. En esta instalación las dos tablas están
-- VACÍAS —comprobado en `erp_dev` y en la base demo—, así que el relleno no
-- toca nada; se escribe igual porque una migración tiene que ser correcta en
-- cualquier base, no solo en la que se probó.
--
-- Una fila huérfana —cuya entidad ya no existe— no se puede asignar a ninguna
-- compañía y se BORRA: dejarla obligaría a inventarle un dueño, y una
-- dirección que no cuelga de nadie no la puede ver ni corregir nadie.

-- AlterTable
ALTER TABLE "direcciones" ADD COLUMN "empresaId" TEXT;
ALTER TABLE "contactos" ADD COLUMN "empresaId" TEXT;

-- Relleno desde la entidad padre, por cada tipo polimórfico.
UPDATE "direcciones" d SET "empresaId" = c."empresaId"
  FROM "clientes" c WHERE d."entidadTipo" = 'Cliente' AND d."entidadId" = c."id";
UPDATE "direcciones" d SET "empresaId" = p."empresaId"
  FROM "proveedores" p WHERE d."entidadTipo" = 'Proveedor' AND d."entidadId" = p."id";
UPDATE "direcciones" d SET "empresaId" = e."empresaId"
  FROM "empleados" e WHERE d."entidadTipo" = 'Empleado' AND d."entidadId" = e."id";

UPDATE "contactos" c SET "empresaId" = cl."empresaId"
  FROM "clientes" cl WHERE c."entidadTipo" = 'Cliente' AND c."entidadId" = cl."id";
UPDATE "contactos" c SET "empresaId" = p."empresaId"
  FROM "proveedores" p WHERE c."entidadTipo" = 'Proveedor' AND c."entidadId" = p."id";
UPDATE "contactos" c SET "empresaId" = e."empresaId"
  FROM "empleados" e WHERE c."entidadTipo" = 'Empleado' AND c."entidadId" = e."id";

-- Huérfanas: sin entidad padre no hay compañía que asignarles.
DELETE FROM "direcciones" WHERE "empresaId" IS NULL;
DELETE FROM "contactos" WHERE "empresaId" IS NULL;

-- Ahora sí, obligatoria.
ALTER TABLE "direcciones" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "contactos" ALTER COLUMN "empresaId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "direcciones_empresaId_entidadTipo_entidadId_idx"
  ON "direcciones"("empresaId", "entidadTipo", "entidadId");
CREATE INDEX "contactos_empresaId_entidadTipo_entidadId_idx"
  ON "contactos"("empresaId", "entidadTipo", "entidadId");
