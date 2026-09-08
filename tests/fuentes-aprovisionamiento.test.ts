import assert from "node:assert/strict";
import { test } from "node:test";
import { seleccionarFuenteAprovisionamiento, type FuenteAcuerdo } from "@/lib/fuentesAprovisionamiento";

const base: FuenteAcuerdo = {
  acuerdoId: "acuerdo-1",
  acuerdoLineaId: "linea-1",
  proveedorId: "proveedor-1",
  proveedorNombre: "Proveedor Uno",
  precioUnitario: 10,
  moneda: "PEN",
  tipoCambio: 1,
  saldo: 100,
};

test("selecciona la fuente vigente con menor costo normalizado a PEN", () => {
  const resultado = seleccionarFuenteAprovisionamiento(20, [
    base,
    { ...base, acuerdoId: "acuerdo-usd", acuerdoLineaId: "linea-usd", moneda: "USD", precioUnitario: 2, tipoCambio: 3.5 },
  ]);
  assert.equal(resultado?.acuerdoId, "acuerdo-usd");
});

test("descarta acuerdos cuyo saldo no cubre toda la necesidad", () => {
  const resultado = seleccionarFuenteAprovisionamiento(20, [
    { ...base, acuerdoId: "barato-sin-saldo", precioUnitario: 1, saldo: 19.99 },
    { ...base, acuerdoId: "con-saldo", acuerdoLineaId: "linea-2", precioUnitario: 12 },
  ]);
  assert.equal(resultado?.acuerdoId, "con-saldo");
});

test("no selecciona una fuente para cantidades inválidas o sin cobertura", () => {
  assert.equal(seleccionarFuenteAprovisionamiento(0, [base]), null);
  assert.equal(seleccionarFuenteAprovisionamiento(101, [base]), null);
});
