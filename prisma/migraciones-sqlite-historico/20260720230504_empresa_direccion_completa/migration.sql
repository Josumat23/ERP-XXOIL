-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_configuracion_empresa" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT '1',
    "razonSocial" TEXT NOT NULL DEFAULT 'Mi Empresa S.A.C.',
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "direccion" TEXT,
    "direccion2" TEXT,
    "ciudad" TEXT,
    "distrito" TEXT,
    "provincia" TEXT,
    "departamento" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Perú',
    "telefono" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "sitioWeb" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tasaIgv" DECIMAL NOT NULL DEFAULT 18,
    "actualizadoEn" DATETIME NOT NULL
);
INSERT INTO "new_configuracion_empresa" ("actualizadoEn", "ciudad", "direccion", "email", "id", "moneda", "nombreComercial", "razonSocial", "ruc", "sitioWeb", "tasaIgv", "telefono") SELECT "actualizadoEn", "ciudad", "direccion", "email", "id", "moneda", "nombreComercial", "razonSocial", "ruc", "sitioWeb", "tasaIgv", "telefono" FROM "configuracion_empresa";
DROP TABLE "configuracion_empresa";
ALTER TABLE "new_configuracion_empresa" RENAME TO "configuracion_empresa";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
