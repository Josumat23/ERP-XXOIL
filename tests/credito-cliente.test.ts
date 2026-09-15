import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  comportamientoPago,
  creditoDisponible,
  diasVencidosConTolerancia,
  estadoCredito,
  validarPerfilCredito,
} from "@/lib/creditoCliente";

// Lo que se guarda es lo que una persona decide; lo que se calcula sale de los
// movimientos.

test("el estado de crédito se deriva y no agrega una tercera bandera", () => {
  // Una columna más que hay que mantener en sintonía con las otras dos es
  // justamente cómo tres banderas terminan contradiciéndose.
  assert.equal(
    estadoCredito({ bloqueadoCobranza: false, requiereAprobacionCredito: false }),
    "HABILITADO"
  );
  assert.equal(
    estadoCredito({ bloqueadoCobranza: false, requiereAprobacionCredito: true }),
    "SUJETO_A_APROBACION"
  );
  assert.equal(
    estadoCredito({ bloqueadoCobranza: true, requiereAprobacionCredito: false }),
    "BLOQUEADO"
  );
  // Con los dos, manda el bloqueo: no está "sujeto a aprobación", está frenado.
  assert.equal(
    estadoCredito({ bloqueadoCobranza: true, requiereAprobacionCredito: true }),
    "BLOQUEADO"
  );
});

test("clasificar como riesgo alto exige motivo; bajo y medio no", () => {
  const base = { motivoNivelRiesgo: "", toleranciaVencimientoDias: null };
  assert.equal(
    validarPerfilCredito({ ...base, nivelRiesgo: "ALTO" }),
    "RIESGO_ALTO_SIN_MOTIVO"
  );
  assert.equal(
    validarPerfilCredito({ ...base, nivelRiesgo: "ALTO", motivoNivelRiesgo: "Dos protestos" }),
    null
  );
  assert.equal(validarPerfilCredito({ ...base, nivelRiesgo: "BAJO" }), null);
  assert.equal(validarPerfilCredito({ ...base, nivelRiesgo: "MEDIO" }), null);
  assert.equal(validarPerfilCredito({ ...base, nivelRiesgo: null }), null);
});

test("la tolerancia se valida como días enteros y acotados", () => {
  const base = { nivelRiesgo: null, motivoNivelRiesgo: "" };
  assert.equal(validarPerfilCredito({ ...base, toleranciaVencimientoDias: 0 }), null);
  assert.equal(validarPerfilCredito({ ...base, toleranciaVencimientoDias: 5 }), null);
  assert.equal(validarPerfilCredito({ ...base, toleranciaVencimientoDias: 90 }), null);
  assert.equal(
    validarPerfilCredito({ ...base, toleranciaVencimientoDias: -1 }),
    "TOLERANCIA_INVALIDA"
  );
  assert.equal(
    validarPerfilCredito({ ...base, toleranciaVencimientoDias: 2.5 }),
    "TOLERANCIA_INVALIDA"
  );
  // Más de 90 días apaga la cobranza en la práctica: si es lo que se quiere,
  // corresponde revisar la condición de pago.
  assert.equal(
    validarPerfilCredito({ ...base, toleranciaVencimientoDias: 91 }),
    "TOLERANCIA_EXCESIVA"
  );
});

test("la tolerancia corre el reloj, no lo apaga", () => {
  assert.equal(diasVencidosConTolerancia(20, 5), 15);
  assert.equal(diasVencidosConTolerancia(3, 5), 0, "dentro de la gracia no está vencida");
  assert.equal(diasVencidosConTolerancia(20, null), 20, "sin tolerancia rige la política");
  assert.equal(diasVencidosConTolerancia(0, 5), 0);
});

test("sin techo no hay disponible que mostrar", () => {
  // "Disponible" no significa nada sin límite, y devolver un número grande
  // invitaría a compararlo.
  assert.equal(creditoDisponible(null, 5000), null);
  assert.equal(creditoDisponible(10000, 4000), 6000);
  // Puede ser negativo: ya se pasó del tope, y esconderlo sería peor.
  assert.equal(creditoDisponible(10000, 12000), -2000);
  // Sin crédito: cualquier deuda ya es exceso.
  assert.equal(creditoDisponible(0, 500), -500);
});

const dia = (d: number) => new Date(2026, 8, d);

test("el comportamiento de pago sale del historial, no de una fórmula", () => {
  const c = comportamientoPago([
    { fechaVencimiento: dia(1), canceladaEn: dia(1) }, // puntual
    { fechaVencimiento: dia(2), canceladaEn: dia(12) }, // 10 días tarde
    { fechaVencimiento: dia(3), canceladaEn: dia(8) }, // 5 días tarde
  ]);
  assert.equal(c.cerradas, 3);
  assert.equal(c.pagadasTarde, 2);
  assert.equal(c.diasAtrasoMaximo, 10);
  // Promedio sobre TODAS las cerradas: (0 + 10 + 5) / 3.
  assert.equal(c.diasAtrasoPromedio, 5);
});

test("una factura pendiente no mejora el promedio de quien no paga", () => {
  // Contarla como "0 días de atraso" premiaría justamente al moroso.
  const c = comportamientoPago([
    { fechaVencimiento: dia(1), canceladaEn: dia(21) }, // 20 días tarde
    { fechaVencimiento: dia(2), canceladaEn: null }, // sigue sin pagar
  ]);
  assert.equal(c.cerradas, 1);
  assert.equal(c.diasAtrasoPromedio, 20);
});

test("pagar antes del vencimiento no cuenta como atraso negativo", () => {
  const c = comportamientoPago([{ fechaVencimiento: dia(10), canceladaEn: dia(3) }]);
  assert.equal(c.diasAtrasoPromedio, 0);
  assert.equal(c.pagadasTarde, 0);
});

test("sin facturas cerradas no se inventa un historial", () => {
  const c = comportamientoPago([{ fechaVencimiento: dia(1), canceladaEn: null }]);
  assert.deepEqual(c, {
    cerradas: 0,
    pagadasTarde: 0,
    diasAtrasoPromedio: 0,
    diasAtrasoMaximo: 0,
  });
});

// --- Guardias estructurales -------------------------------------------------

test("no se agregó un diasCredito paralelo a la condición de pago", async () => {
  // `CondicionPago` ya expresa los días y está embebida en pedidos, facturas y
  // aprobaciones: un campo paralelo serían dos fuentes de verdad.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const cliente = esquema.slice(
    esquema.indexOf("model Cliente {"),
    esquema.indexOf("model Cotizacion {")
  );
  assert.ok(cliente.length > 500, "el corte quedó vacío");
  assert.ok(!/diasCredito/.test(cliente));
  assert.match(cliente, /condicionPagoDefecto\s+CondicionPago/);
});

test("el estado de crédito no se guarda como columna", async () => {
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const cliente = esquema.slice(
    esquema.indexOf("model Cliente {"),
    esquema.indexOf("model Cotizacion {")
  );
  assert.ok(!/estadoCredito\s+\w/.test(cliente), "estadoCredito debe derivarse, no guardarse");
  assert.match(cliente, /requiereAprobacionCredito\s+Boolean/);
});

test("sujeto a aprobación manda el pedido a la bandeja aunque haya cupo", async () => {
  // Si no, la bandera sería decorativa: un dato que se carga y nadie usa.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/pedidos/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /requiereAprobacionCredito/);
});

test("la cobranza aplica la tolerancia del cliente, no solo la política", async () => {
  // Si la gracia no llegara al cálculo, el campo del maestro sería decorativo
  // y el cliente con tolerancia recibiría el mismo aviso que el resto.
  const pagina = await readFile(
    resolve(process.cwd(), "src/app/(app)/finanzas/cobranza/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /diasVencidosConTolerancia\(/);
  assert.match(pagina, /f\.cliente\.toleranciaVencimientoDias/);
  // Y se calcula en un solo lugar: dos cálculos distintos en la misma pantalla
  // es cómo la tabla y el resumen terminan diciendo cosas diferentes.
  assert.match(pagina, /const diasPorFactura = new Map\(/);
  assert.doesNotMatch(pagina, /const dias = diasVencidos\(/);
});
