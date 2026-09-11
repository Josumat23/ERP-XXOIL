-- La configuracion de la sociedad pasa de una fila unica (id fijo "1") a una
-- fila por compania. La fila existente conserva su id y queda ligada a la
-- compania principal via empresaId = '1', que es el valor que ya tenian todas
-- las tablas antes del trabajo de aislamiento.
--
-- Primero se asegura la compania principal. asegurarEmpresaPrincipal() la crea
-- en tiempo de ejecucion leyendo justamente esta fila, pero ahora la fila la
-- referencia: si la migracion corriera antes de ese arranque, la clave foranea
-- quedaria colgando y el primer UPDATE de la configuracion fallaria. Este
-- INSERT es idempotente (OR IGNORE sobre la clave primaria) y hace lo mismo.
INSERT OR IGNORE INTO "empresas" ("id", "razonSocial", "ruc", "pais", "monedaFuncional", "esPrincipal", "activa", "creadoEn")
SELECT '1', "razonSocial", "ruc", 'Peru', 'PEN', true, true, CURRENT_TIMESTAMP
FROM "configuracion_empresa" LIMIT 1;
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_configuracion_empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
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
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "configuracion_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_configuracion_empresa" ("actualizadoEn", "alcanceAprobacionJerarquia", "ciudad", "codigoPostal", "departamento", "direccion", "direccion2", "distrito", "email", "fax", "id", "limiteCreditoCortoPlazo", "moneda", "montoAprobacionCompras", "montoAprobacionPagos", "nombreComercial", "oseProveedor", "oseToken", "pais", "provincia", "razonSocial", "registroHidrocarburosOsinergmin", "registroHidrocarburosVigencia", "ruc", "sitioWeb", "sunatCertificadoBase64", "sunatCertificadoPassword", "sunatClaveSol", "sunatUsuarioSol", "tarifaHoraManoObra", "tasaCreditoCortoPlazo", "tasaCreditoLargoPlazo", "tasaDescuentoCxC", "tasaIgv", "tasaRecargoMora", "telefono") SELECT "actualizadoEn", "alcanceAprobacionJerarquia", "ciudad", "codigoPostal", "departamento", "direccion", "direccion2", "distrito", "email", "fax", "id", "limiteCreditoCortoPlazo", "moneda", "montoAprobacionCompras", "montoAprobacionPagos", "nombreComercial", "oseProveedor", "oseToken", "pais", "provincia", "razonSocial", "registroHidrocarburosOsinergmin", "registroHidrocarburosVigencia", "ruc", "sitioWeb", "sunatCertificadoBase64", "sunatCertificadoPassword", "sunatClaveSol", "sunatUsuarioSol", "tarifaHoraManoObra", "tasaCreditoCortoPlazo", "tasaCreditoLargoPlazo", "tasaDescuentoCxC", "tasaIgv", "tasaRecargoMora", "telefono" FROM "configuracion_empresa";
DROP TABLE "configuracion_empresa";
ALTER TABLE "new_configuracion_empresa" RENAME TO "configuracion_empresa";
CREATE UNIQUE INDEX "configuracion_empresa_empresaId_key" ON "configuracion_empresa"("empresaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- El cerrojo de la numeracion correlativa se mudaba sobre la fila unica de
-- configuracion_empresa. Con una fila por compania esa tabla ya no sirve de
-- punto fijo, asi que el cerrojo pasa a tabla propia: no guarda dato de
-- negocio, solo existe para serializar la generacion de correlativos.
CREATE TABLE "cerrojo_correlativo" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT '1',
    "actualizadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
