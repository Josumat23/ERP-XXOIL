-- Politica de escalamiento de cobranza.
--
-- Tabla nueva, sin filas. Mientras una compania no tenga la suya, no hay
-- escalamiento y la pantalla de cobranza funciona igual que antes: el nivel se
-- sugiere por antiguedad y lo decide una persona. Cuando escalar es politica
-- de cobranza, y el sistema no elige una por su cuenta.
--
-- diasSinRespuesta y diasGraciaCompromiso nacen nulos a proposito: definir la
-- politica no enciende esas dos reglas, cada una se activa por separado.

CREATE TABLE "politicas_cobranza" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "diasNivel2" INTEGER NOT NULL DEFAULT 15,
    "diasNivel3" INTEGER NOT NULL DEFAULT 30,
    "diasSinRespuesta" INTEGER,
    "diasGraciaCompromiso" INTEGER,
    "pausarEnDisputa" BOOLEAN NOT NULL DEFAULT true,
    "actualizadoEn" DATETIME NOT NULL,
    "actualizadoPorId" TEXT NOT NULL,
    "actualizadoPorNombre" TEXT NOT NULL,
    CONSTRAINT "politicas_cobranza_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "politicas_cobranza_empresaId_key" ON "politicas_cobranza"("empresaId");
