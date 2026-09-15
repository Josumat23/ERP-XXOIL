-- Logística del cliente.
--
-- Qué va en el cliente y qué va en la dirección no es arbitrario: la ventana
-- horaria, los días de recepción, los requisitos de entrega y las
-- restricciones vehiculares son propiedades DEL LUGAR, no del cliente. Una
-- misma minera recibe en su planta de martes a jueves de 8 a 12 con inducción
-- de seguridad, y en su almacén de puerto todos los días sin restricción.
--
-- La ventana se guarda en minutos desde medianoche, no como texto: «08:30»
-- ordenado como cadena pone las 9 antes que las 10. Una ventana que cruza
-- medianoche se expresa con fin < inicio, que es el turno noche de una mina.
--
-- Los días arrancan en true salvo el domingo: es el reparto normal de una
-- distribuidora, y lo que no se declara no debería impedir despachar.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "ruc" TEXT,
    "tipoDocumentoFiscal" TEXT NOT NULL DEFAULT 'RUC',
    "tipoPersona" TEXT,
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
    "almacenDespachoId" TEXT,
    "transportistaPreferidoId" TEXT,
    "frecuenciaReparto" TEXT,
    "limiteCredito" DECIMAL DEFAULT 0,
    "condicionPagoDefecto" TEXT NOT NULL DEFAULT 'CONTADO',
    "notas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "motivoEstado" TEXT,
    "estadoDesde" DATETIME,
    "estadoPorId" TEXT,
    "estadoPorNombre" TEXT,
    "bloqueadoCobranza" BOOLEAN NOT NULL DEFAULT false,
    "bloqueadoCobranzaEn" DATETIME,
    "bloqueadoCobranzaPor" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "clientes_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_almacenDespachoId_fkey" FOREIGN KEY ("almacenDespachoId") REFERENCES "almacenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_transportistaPreferidoId_fkey" FOREIGN KEY ("transportistaPreferidoId") REFERENCES "transportistas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clientes" ("bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "estado", "estadoDesde", "estadoPorId", "estadoPorNombre", "id", "limiteCredito", "motivoEstado", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "tipoPersona", "ubigeoId", "vendedorId", "zonaId") SELECT "bloqueadoCobranza", "bloqueadoCobranzaEn", "bloqueadoCobranzaPor", "canal", "codigo", "condicionPagoDefecto", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "email", "empresaId", "estado", "estadoDesde", "estadoPorId", "estadoPorNombre", "id", "limiteCredito", "motivoEstado", "nombreComercial", "notas", "pais", "provincia", "razonSocial", "ruc", "telefono", "tipoDocumentoFiscal", "tipoPersona", "ubigeoId", "vendedorId", "zonaId" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_empresaId_ruc_key" ON "clientes"("empresaId", "ruc");
CREATE UNIQUE INDEX "clientes_empresaId_codigo_key" ON "clientes"("empresaId", "codigo");
CREATE TABLE "new_direcciones_cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "principalDe" TEXT,
    "etiqueta" TEXT,
    "direccion" TEXT NOT NULL,
    "referencia" TEXT,
    "ubigeoId" TEXT,
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "codigoPostal" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Peru',
    "ventanaInicioMin" INTEGER,
    "ventanaFinMin" INTEGER,
    "recibeLunes" BOOLEAN NOT NULL DEFAULT true,
    "recibeMartes" BOOLEAN NOT NULL DEFAULT true,
    "recibeMiercoles" BOOLEAN NOT NULL DEFAULT true,
    "recibeJueves" BOOLEAN NOT NULL DEFAULT true,
    "recibeViernes" BOOLEAN NOT NULL DEFAULT true,
    "recibeSabado" BOOLEAN NOT NULL DEFAULT true,
    "recibeDomingo" BOOLEAN NOT NULL DEFAULT false,
    "requisitosEntrega" TEXT,
    "restriccionesVehiculares" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "latitud" DECIMAL,
    "longitud" DECIMAL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "direcciones_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "direcciones_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "direcciones_cliente_ubigeoId_fkey" FOREIGN KEY ("ubigeoId") REFERENCES "ubigeos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_direcciones_cliente" ("activa", "clienteId", "codigoPostal", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "empresaId", "etiqueta", "id", "latitud", "longitud", "notas", "pais", "principalDe", "provincia", "referencia", "tipo", "ubigeoId") SELECT "activa", "clienteId", "codigoPostal", "contactoNombre", "contactoTelefono", "creadoEn", "departamento", "direccion", "distrito", "empresaId", "etiqueta", "id", "latitud", "longitud", "notas", "pais", "principalDe", "provincia", "referencia", "tipo", "ubigeoId" FROM "direcciones_cliente";
DROP TABLE "direcciones_cliente";
ALTER TABLE "new_direcciones_cliente" RENAME TO "direcciones_cliente";
CREATE INDEX "direcciones_cliente_clienteId_tipo_idx" ON "direcciones_cliente"("clienteId", "tipo");
CREATE UNIQUE INDEX "direcciones_cliente_clienteId_principalDe_key" ON "direcciones_cliente"("clienteId", "principalDe");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
