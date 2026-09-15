-- Ubigeo estructurado en Cliente, Proveedor y Almacen.
--
-- El catalogo oficial de SUNAT (model Ubigeo, 1834 distritos) ya existia pero
-- solo lo usaba GuiaRemision para el XML. Cliente y Almacen guardaban
-- departamento/provincia/distrito como texto libre, y Proveedor no guardaba
-- ubicacion en absoluto: la inconsistencia entre maestros que el Blueprint 05
-- viene senalando.
--
-- Los campos de texto libre NO se borran. Guardan lo que el usuario escribio,
-- incluidas direcciones que no corresponden a ningun ubigeo peruano, y son el
-- respaldo de las filas que el backfill de abajo no logre emparejar.
--
-- A Proveedor se le da solo el FK y no la terna de texto: copiar la terna
-- seria reproducir la inconsistencia en vez de cerrarla.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_almacenes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "tipo" TEXT NOT NULL DEFAULT 'ALMACEN_DISTRIBUCION',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "direccion2" TEXT,
    "ciudad" TEXT,
    "distrito" TEXT,
    "provincia" TEXT,
    "departamento" TEXT,
    "ubigeoId" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Perú',
    "encargado" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "almacenes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "almacenes_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_almacenes" ("activo", "ciudad", "codigo", "codigoPostal", "creadoEn", "departamento", "direccion", "direccion2", "distrito", "empresaId", "encargado", "id", "nombre", "pais", "provincia", "tipo") SELECT "activo", "ciudad", "codigo", "codigoPostal", "creadoEn", "departamento", "direccion", "direccion2", "distrito", "empresaId", "encargado", "id", "nombre", "pais", "provincia", "tipo" FROM "almacenes";
DROP TABLE "almacenes";
ALTER TABLE "new_almacenes" RENAME TO "almacenes";
CREATE UNIQUE INDEX "almacenes_empresaId_codigo_key" ON "almacenes"("empresaId", "codigo");
CREATE TABLE "new_clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "tipoDocumentoFiscal" TEXT NOT NULL DEFAULT 'RUC',
    "canal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "ubigeoId" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "zonaId" TEXT,
    "vendedorId" TEXT,
    "limiteCredito" DECIMAL NOT NULL DEFAULT 0,
    "condicionPagoDefecto" TEXT NOT NULL DEFAULT 'CONTADO',
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "bloqueadoCobranza" BOOLEAN NOT NULL DEFAULT false,
    "bloqueadoCobranzaEn" DATETIME,
    "bloqueadoCobranzaPor" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "clientes_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clientes" ("activo", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "id", "limiteCredito", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "vendedorId", "zonaId") SELECT "activo", "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "id", "limiteCredito", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "vendedorId", "zonaId" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");
CREATE UNIQUE INDEX "clientes_empresaId_codigo_key" ON "clientes"("empresaId", "codigo");
CREATE TABLE "new_proveedores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT,
    "tipoDocumentoFiscal" TEXT NOT NULL DEFAULT 'RUC',
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "ubigeoId" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "cuentaBancaria" TEXT,
    "banco" TEXT,
    "numeroCuenta" TEXT,
    "cci" TEXT,
    "swift" TEXT,
    "iban" TEXT,
    "condicionPagoDias" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proveedores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "proveedores_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_proveedores" ("activo", "banco", "cci", "condicionPagoDias", "contactoNombre", "contactoTelefono", "creadoEn", "cuentaBancaria", "direccion", "email", "empresaId", "iban", "id", "notas", "numeroCuenta", "pais", "razonSocial", "ruc", "swift", "telefono", "tipoDocumentoFiscal") SELECT "activo", "banco", "cci", "condicionPagoDias", "contactoNombre", "contactoTelefono", "creadoEn", "cuentaBancaria", "direccion", "email", "empresaId", "iban", "id", "notas", "numeroCuenta", "pais", "razonSocial", "ruc", "swift", "telefono", "tipoDocumentoFiscal" FROM "proveedores";
DROP TABLE "proveedores";
ALTER TABLE "new_proveedores" RENAME TO "proveedores";
CREATE UNIQUE INDEX "proveedores_empresaId_ruc_key" ON "proveedores"("empresaId", "ruc");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Backfill conservador. Empareja por nombre en mayusculas contra el catalogo,
-- y SOLO cuando la combinacion departamento+provincia+distrito resuelve a un
-- unico ubigeo. Una fila que no empareje se queda con su texto libre y sin
-- ubigeoId: prefiero dejarla sin emparejar que asignarle un distrito
-- equivocado, porque el ubigeo termina en el XML que se le manda a SUNAT.
--
-- Limite conocido: la comparacion es literal salvo mayusculas. Los nombres del
-- catalogo vienen sin tildes, asi que "Huanuco" empareja y "Huánuco" no. Lo
-- que no empareja se corrige eligiendo el distrito en pantalla.
UPDATE "clientes"
SET "ubigeoId" = (
  SELECT u."id" FROM "ubigeos" u
  WHERE UPPER(u."departamento") = UPPER("clientes"."departamento")
    AND UPPER(u."provincia")    = UPPER("clientes"."provincia")
    AND UPPER(u."distrito")     = UPPER("clientes"."distrito")
)
WHERE "ubigeoId" IS NULL
  AND "departamento" IS NOT NULL AND "provincia" IS NOT NULL AND "distrito" IS NOT NULL
  AND (
    SELECT COUNT(*) FROM "ubigeos" u
    WHERE UPPER(u."departamento") = UPPER("clientes"."departamento")
      AND UPPER(u."provincia")    = UPPER("clientes"."provincia")
      AND UPPER(u."distrito")     = UPPER("clientes"."distrito")
  ) = 1;

UPDATE "almacenes"
SET "ubigeoId" = (
  SELECT u."id" FROM "ubigeos" u
  WHERE UPPER(u."departamento") = UPPER("almacenes"."departamento")
    AND UPPER(u."provincia")    = UPPER("almacenes"."provincia")
    AND UPPER(u."distrito")     = UPPER("almacenes"."distrito")
)
WHERE "ubigeoId" IS NULL
  AND "departamento" IS NOT NULL AND "provincia" IS NOT NULL AND "distrito" IS NOT NULL
  AND (
    SELECT COUNT(*) FROM "ubigeos" u
    WHERE UPPER(u."departamento") = UPPER("almacenes"."departamento")
      AND UPPER(u."provincia")    = UPPER("almacenes"."provincia")
      AND UPPER(u."distrito")     = UPPER("almacenes"."distrito")
  ) = 1;
