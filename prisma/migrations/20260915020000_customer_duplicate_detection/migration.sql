-- Detección de clientes duplicados.
--
-- El índice único sobre `ruc` ya impide el duplicado EXACTO. El que se cuela
-- es el otro: el mismo contribuyente cargado como «20123456789» y como
-- «20-123456789». Importa porque el cliente es la llave de casi todo — un
-- duplicado parte en dos el historial de crédito, el saldo de cascos y la
-- cobranza, y cada mitad parece estar al día.
--
-- `documentoNormalizado` guarda el documento sin separadores y en mayúscula,
-- con índice único por compañía: la BASE rechaza el duplicado disfrazado, no
-- depende de que alguien se acuerde de comparar.
--
-- El orden importa. Primero la columna, después el relleno y recién al final
-- el índice: si el índice fuera primero, el UPDATE fallaría a la mitad dejando
-- unas filas normalizadas y otras no.
--
-- Si la migración falla al crear el índice, es porque ya existen dos clientes
-- que son el mismo contribuyente. Eso NO se resuelve solo: hay que decidir a
-- mano cuál sobrevive y a dónde va su historial. Fallar es la respuesta
-- correcta; fusionarlos por cuenta propia sería peor.
--
-- SQLite no tiene expresiones regulares, así que el relleno quita los
-- separadores que realmente aparecen — espacio, guion, punto y barra. La
-- normalización completa la hace la aplicación de aquí en adelante.

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "documentoNormalizado" TEXT;

-- CreateIndex

-- Relleno: el documento que cada cliente ya tenía, sin separadores.
UPDATE "clientes"
SET "documentoNormalizado" = NULLIF(
  UPPER(REPLACE(REPLACE(REPLACE(REPLACE("ruc", ' ', ''), '-', ''), '.', ''), '/', '')),
  ''
)
WHERE "ruc" IS NOT NULL;

CREATE UNIQUE INDEX "clientes_empresaId_documentoNormalizado_key" ON "clientes"("empresaId", "documentoNormalizado");
