-- Ubigeo estructurado para la direccion fiscal del EMISOR.
--
-- Es la direccion que va impresa en los documentos y la que viaja en el XML
-- de facturacion electronica, donde SUNAT espera el codigo de 6 digitos y no
-- el nombre del distrito. El constructor UBL ya aceptaba emisor.ubigeo, pero
-- nadie se lo pasaba: el XML lo omitia.
--
-- Mismo criterio que Cliente, Proveedor y Almacen: el texto libre se conserva
-- y el backfill solo empareja cuando resuelve a un unico distrito.

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
    "ubigeoId" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Perú',
    "telefono" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "sitioWeb" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tasaIgv" DECIMAL NOT NULL DEFAULT 18,
    "representanteLegal" TEXT,
    "representanteLegalDocumento" TEXT,
    "regimenTributario" TEXT,
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
    CONSTRAINT "configuracion_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "configuracion_empresa_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_configuracion_empresa" ("actualizadoEn", "alcanceAprobacionJerarquia", "ciudad", "codigoPostal", "departamento", "direccion", "direccion2", "distrito", "email", "empresaId", "fax", "id", "limiteCreditoCortoPlazo", "moneda", "montoAprobacionCompras", "montoAprobacionPagos", "nombreComercial", "oseProveedor", "oseToken", "pais", "provincia", "razonSocial", "regimenTributario", "registroHidrocarburosOsinergmin", "registroHidrocarburosVigencia", "representanteLegal", "representanteLegalDocumento", "ruc", "sitioWeb", "sunatCertificadoBase64", "sunatCertificadoPassword", "sunatClaveSol", "sunatUsuarioSol", "tarifaHoraManoObra", "tasaCreditoCortoPlazo", "tasaCreditoLargoPlazo", "tasaDescuentoCxC", "tasaIgv", "tasaRecargoMora", "telefono") SELECT "actualizadoEn", "alcanceAprobacionJerarquia", "ciudad", "codigoPostal", "departamento", "direccion", "direccion2", "distrito", "email", "empresaId", "fax", "id", "limiteCreditoCortoPlazo", "moneda", "montoAprobacionCompras", "montoAprobacionPagos", "nombreComercial", "oseProveedor", "oseToken", "pais", "provincia", "razonSocial", "regimenTributario", "registroHidrocarburosOsinergmin", "registroHidrocarburosVigencia", "representanteLegal", "representanteLegalDocumento", "ruc", "sitioWeb", "sunatCertificadoBase64", "sunatCertificadoPassword", "sunatClaveSol", "sunatUsuarioSol", "tarifaHoraManoObra", "tasaCreditoCortoPlazo", "tasaCreditoLargoPlazo", "tasaDescuentoCxC", "tasaIgv", "tasaRecargoMora", "telefono" FROM "configuracion_empresa";
DROP TABLE "configuracion_empresa";
ALTER TABLE "new_configuracion_empresa" RENAME TO "configuracion_empresa";
CREATE UNIQUE INDEX "configuracion_empresa_empresaId_key" ON "configuracion_empresa"("empresaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Backfill conservador, igual que el de los otros maestros: solo cuando la
-- combinacion resuelve a un unico ubigeo. Lo que no empareje se corrige
-- eligiendo el distrito en pantalla.
UPDATE "configuracion_empresa"
SET "ubigeoId" = (
  SELECT u."id" FROM "ubigeos" u
  WHERE UPPER(u."departamento") = UPPER("configuracion_empresa"."departamento")
    AND UPPER(u."provincia")    = UPPER("configuracion_empresa"."provincia")
    AND UPPER(u."distrito")     = UPPER("configuracion_empresa"."distrito")
)
WHERE "ubigeoId" IS NULL
  AND "departamento" IS NOT NULL AND "provincia" IS NOT NULL AND "distrito" IS NOT NULL
  AND (
    SELECT COUNT(*) FROM "ubigeos" u
    WHERE UPPER(u."departamento") = UPPER("configuracion_empresa"."departamento")
      AND UPPER(u."provincia")    = UPPER("configuracion_empresa"."provincia")
      AND UPPER(u."distrito")     = UPPER("configuracion_empresa"."distrito")
  ) = 1;
