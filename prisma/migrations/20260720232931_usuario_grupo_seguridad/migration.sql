-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "grupoSeguridadId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuarios_grupoSeguridadId_fkey" FOREIGN KEY ("grupoSeguridadId") REFERENCES "grupos_seguridad" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_usuarios" ("activo", "creadoEn", "empresaId", "id", "nombre", "passwordHash", "rol", "usuario") SELECT "activo", "creadoEn", "empresaId", "id", "nombre", "passwordHash", "rol", "usuario" FROM "usuarios";
DROP TABLE "usuarios";
ALTER TABLE "new_usuarios" RENAME TO "usuarios";
CREATE UNIQUE INDEX "usuarios_empresaId_usuario_key" ON "usuarios"("empresaId", "usuario");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
