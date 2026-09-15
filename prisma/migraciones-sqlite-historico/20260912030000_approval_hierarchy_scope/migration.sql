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
    "registroHidrocarburosOsinergmin" TEXT,
    "registroHidrocarburosVigencia" DATETIME,
    "tasaRecargoMora" DECIMAL NOT NULL DEFAULT 0,
    "tarifaHoraManoObra" DECIMAL NOT NULL DEFAULT 0,
    "montoAprobacionCompras" DECIMAL NOT NULL DEFAULT 5000,
    "montoAprobacionPagos" DECIMAL NOT NULL DEFAULT 5000,
    "tasaDescuentoCxC" DECIMAL NOT NULL DEFAULT 9,
    "tasaCreditoCortoPlazo" DECIMAL NOT NULL DEFAULT 9,
    "limiteCreditoCortoPlazo" DECIMAL NOT NULL DEFAULT 100000,
    "tasaCreditoLargoPlazo" DECIMAL NOT NULL DEFAULT 10,
    "oseProveedor" TEXT NOT NULL DEFAULT 'SIMULADO',
    "oseToken" TEXT,
    "sunatCertificadoBase64" TEXT,
    "sunatCertificadoPassword" TEXT,
    "sunatUsuarioSol" TEXT,
    "sunatClaveSol" TEXT,
    "alcanceAprobacionJerarquia" TEXT NOT NULL DEFAULT 'CADENA_MANDO',
    "actualizadoEn" DATETIME NOT NULL
);
INSERT INTO "new_configuracion_empresa" ("actualizadoEn", "ciudad", "codigoPostal", "departamento", "direccion", "direccion2", "distrito", "email", "fax", "id", "limiteCreditoCortoPlazo", "moneda", "montoAprobacionCompras", "montoAprobacionPagos", "nombreComercial", "oseProveedor", "oseToken", "pais", "provincia", "razonSocial", "registroHidrocarburosOsinergmin", "registroHidrocarburosVigencia", "ruc", "sitioWeb", "sunatCertificadoBase64", "sunatCertificadoPassword", "sunatClaveSol", "sunatUsuarioSol", "tarifaHoraManoObra", "tasaCreditoCortoPlazo", "tasaCreditoLargoPlazo", "tasaDescuentoCxC", "tasaIgv", "tasaRecargoMora", "telefono") SELECT "actualizadoEn", "ciudad", "codigoPostal", "departamento", "direccion", "direccion2", "distrito", "email", "fax", "id", "limiteCreditoCortoPlazo", "moneda", "montoAprobacionCompras", "montoAprobacionPagos", "nombreComercial", "oseProveedor", "oseToken", "pais", "provincia", "razonSocial", "registroHidrocarburosOsinergmin", "registroHidrocarburosVigencia", "ruc", "sitioWeb", "sunatCertificadoBase64", "sunatCertificadoPassword", "sunatClaveSol", "sunatUsuarioSol", "tarifaHoraManoObra", "tasaCreditoCortoPlazo", "tasaCreditoLargoPlazo", "tasaDescuentoCxC", "tasaIgv", "tasaRecargoMora", "telefono" FROM "configuracion_empresa";
DROP TABLE "configuracion_empresa";
ALTER TABLE "new_configuracion_empresa" RENAME TO "configuracion_empresa";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

