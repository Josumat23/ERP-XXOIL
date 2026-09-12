-- Nota de debito, acotada al recargo por mora.
--
-- El recargo ya aumenta el saldo de la factura y ya genera su asiento cuando
-- se aplica. La nota de debito es el COMPROBANTE de ese recargo, no un
-- segundo cobro: emitirla no toca saldo ni contabilidad.
--
-- Cuelga de un RecargoMora con relacion 1 a 1. Los enums de serie y de
-- comprobante electronico ganan NOTA_DEBITO; los valores existentes no
-- cambian.

CREATE TABLE "notas_debito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL DEFAULT '1',
    "numero" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "recargoMoraId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL NOT NULL DEFAULT 1,
    "montoFuncional" DECIMAL NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "tipoNota" TEXT NOT NULL DEFAULT 'INTERES_MORA',
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    CONSTRAINT "notas_debito_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notas_debito_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notas_debito_recargoMoraId_fkey" FOREIGN KEY ("recargoMoraId") REFERENCES "recargos_mora" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "notas_debito_recargoMoraId_key" ON "notas_debito"("recargoMoraId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_debito_empresaId_numero_key" ON "notas_debito"("empresaId", "numero");

