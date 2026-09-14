-- Contactos múltiples por cliente.
--
-- Había UNO solo, en dos campos sueltos del cliente (`contactoNombre`,
-- `contactoTelefono`). En un distribuidor, quien aprueba el pedido no es quien
-- recibe la factura ni quien atiende al camión; con un solo casillero, el que
-- quedaba escrito era el último que llamó.
--
-- `esPrincipal` es `true` en el principal y NULL en el resto — nunca `false`.
-- Como los NULL no chocan entre sí en un índice único, UNIQUE(clienteId,
-- esPrincipal) convierte «uno solo» en una regla de la base.

-- CreateTable
CREATE TABLE "contactos_cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "clienteId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT,
    "cargo" TEXT,
    "area" TEXT,
    "telefono" TEXT,
    "anexo" TEXT,
    "celular" TEXT,
    "email" TEXT,
    "paraPedidos" BOOLEAN NOT NULL DEFAULT false,
    "paraFacturacion" BOOLEAN NOT NULL DEFAULT false,
    "paraCobranza" BOOLEAN NOT NULL DEFAULT false,
    "paraDespacho" BOOLEAN NOT NULL DEFAULT false,
    "esPrincipal" BOOLEAN,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contactos_cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "contactos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "contactos_cliente_clienteId_activo_idx" ON "contactos_cliente"("clienteId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "contactos_cliente_clienteId_esPrincipal_key" ON "contactos_cliente"("clienteId", "esPrincipal");


-- El contacto que cada cliente ya tenía pasa a ser su contacto principal.
-- Nadie pierde el nombre y el teléfono que cargó.
INSERT INTO "contactos_cliente" (
  "id", "empresaId", "clienteId", "nombres", "telefono", "email",
  "paraPedidos", "paraFacturacion", "paraCobranza", "paraDespacho",
  "esPrincipal", "activo", "creadoEn"
)
SELECT
  'con-ppal-' || "id", "empresaId", "id", "contactoNombre", "contactoTelefono", "email",
  1, 0, 0, 0,
  1, 1, CURRENT_TIMESTAMP
FROM "clientes"
WHERE "contactoNombre" IS NOT NULL AND TRIM("contactoNombre") <> '';
