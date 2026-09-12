import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  calcularImporte,
  esTipoManual,
  validarNotaDebitoManual,
} from "@/lib/notaDebitoManual";

// Notas de débito emitidas a mano: aumento de valor (02) y penalidad (03).
//
// La asimetría con la de mora es lo que hay que proteger: el recargo por mora
// YA aumentó el saldo y YA posteó cuando se aplicó, así que su nota solo lo
// documenta. Estas dos no existían hasta emitirse, así que SÍ cargan.

test("solo los tipos 02 y 03 se emiten a mano", () => {
  assert.equal(esTipoManual("AUMENTO_VALOR"), true);
  assert.equal(esTipoManual("PENALIDAD_OTROS"), true);
  // El 01 nace de un recargo aplicado, no de este formulario.
  assert.equal(esTipoManual("INTERES_MORA"), false);
  assert.equal(esTipoManual("CUALQUIER_COSA"), false);
});

test("el IGV se calcula solo si el concepto se declaró afecto", () => {
  const afecto = calcularImporte(100, true, 18);
  assert.deepEqual(afecto, { baseImponible: 100, igv: 18, total: 118 });

  const noAfecto = calcularImporte(100, false, 18);
  assert.deepEqual(noAfecto, { baseImponible: 100, igv: 0, total: 100 });

  // Redondeo a dos decimales, como el resto de los importes del sistema.
  assert.deepEqual(calcularImporte(33.333, true, 18), {
    baseImponible: 33.33,
    igv: 6,
    total: 39.33,
  });
});

test("la afectación al IGV no tiene valor por defecto", () => {
  // Si se pudiera omitir, la casilla premarcada decidiría por el contador un
  // criterio tributario que no es el mismo para un ajuste de precio que para
  // una penalidad.
  const base = { tipoNota: "PENALIDAD_OTROS", baseImponible: 100, motivo: "Incumplimiento" };
  assert.match(
    validarNotaDebitoManual({ ...base, afectoIgvDeclarado: null }) ?? "",
    /afecto al IGV/
  );
  assert.match(
    validarNotaDebitoManual({ ...base, afectoIgvDeclarado: "" }) ?? "",
    /afecto al IGV/
  );
  assert.equal(validarNotaDebitoManual({ ...base, afectoIgvDeclarado: "NO" }), null);
  assert.equal(validarNotaDebitoManual({ ...base, afectoIgvDeclarado: "SI" }), null);
});

test("una nota sin motivo o sin importe no se emite", () => {
  const base = { tipoNota: "AUMENTO_VALOR", baseImponible: 100, motivo: "Ajuste", afectoIgvDeclarado: "SI" };
  assert.match(validarNotaDebitoManual({ ...base, motivo: "   " }) ?? "", /motivo/);
  assert.match(validarNotaDebitoManual({ ...base, baseImponible: 0 }) ?? "", /mayor a 0/);
  assert.match(validarNotaDebitoManual({ ...base, baseImponible: -5 }) ?? "", /mayor a 0/);
  assert.match(validarNotaDebitoManual({ ...base, baseImponible: NaN }) ?? "", /mayor a 0/);
  assert.match(validarNotaDebitoManual({ ...base, tipoNota: "INTERES_MORA" }) ?? "", /tipo/);
  assert.match(validarNotaDebitoManual({ ...base, motivo: "x".repeat(501) }) ?? "", /500/);
});

async function montarFactura(sufijo: string) {
  const empresaId = `empresa-ndm-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const cliente = await prisma.cliente.create({
    data: { empresaId, codigo: `CLI-${sufijo}`, razonSocial: "Cliente" },
  });
  const vendedor = await prisma.vendedor.create({
    data: { empresaId, nombre: "V", tipo: "SOLO_COMISION", tasaComision: 1 },
  });
  const pedido = await prisma.pedido.create({
    data: {
      empresaId,
      numero: `PED-${sufijo}`,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      total: 1180,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const factura = await prisma.factura.create({
    data: {
      empresaId,
      numero: `F001-${sufijo}`,
      pedidoId: pedido.id,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      condicionPago: "CONTADO",
      fechaVencimiento: new Date(),
      subtotal: 1000,
      igv: 180,
      total: 1180,
      saldo: 1180,
      saldoFuncional: 1180,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  return { empresaId, factura };
}

test("una nota emitida a mano no necesita recargo, y varias pueden no tenerlo", async () => {
  // El índice único sobre `recargoMoraId` sigue existiendo: SQLite trata cada
  // NULL como distinto, así que muchas notas manuales conviven mientras un
  // recargo sigue admitiendo una sola.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { empresaId, factura } = await montarFactura(sufijo);

  for (const n of [1, 2]) {
    await prisma.notaDebito.create({
      data: {
        empresaId,
        numero: `ND-${sufijo}-${n}`,
        facturaId: factura.id,
        baseImponible: 100,
        igv: 18,
        afectoIgv: true,
        monto: 118,
        montoFuncional: 118,
        motivo: "Ajuste de precio",
        tipoNota: "AUMENTO_VALOR",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
  }

  const notas = await prisma.notaDebito.findMany({ where: { empresaId } });
  assert.equal(notas.length, 2);
  assert.ok(notas.every((n) => n.recargoMoraId === null));
});

test("la penalidad puede declararse no afecta al IGV", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { empresaId, factura } = await montarFactura(sufijo);

  const nota = await prisma.notaDebito.create({
    data: {
      empresaId,
      numero: `ND-${sufijo}`,
      facturaId: factura.id,
      baseImponible: 500,
      igv: 0,
      afectoIgv: false,
      monto: 500,
      montoFuncional: 500,
      motivo: "Penalidad por incumplimiento de plazo",
      tipoNota: "PENALIDAD_OTROS",
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  assert.equal(nota.afectoIgv, false);
  assert.equal(nota.igv.toNumber(), 0);
  assert.equal(nota.monto.toNumber(), 500);
});

// --- Guardias estructurales -------------------------------------------------

test("la nota de mora sigue sin cargar nada; la manual sí carga", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/facturas/actions.ts"),
    "utf8"
  );
  const sinComentarios = (texto: string) => texto.replace(/^\s*\/\/.*$/gm, "");

  const mora = sinComentarios(
    acciones.slice(
      acciones.indexOf("export async function emitirNotaDebitoMora"),
      acciones.indexOf("export async function emitirNotaDebitoManual")
    )
  );
  assert.ok(mora.length > 0, "no se encontró la acción de mora");
  assert.doesNotMatch(mora, /postearAsiento|postearNotaDebito/, "la de mora no postea");
  assert.doesNotMatch(mora, /saldo:\s*\{\s*increment/, "la de mora no toca el saldo");

  const manual = sinComentarios(
    acciones.slice(acciones.indexOf("export async function emitirNotaDebitoManual"))
  );
  assert.ok(manual.length > 0, "no se encontró la acción manual");
  assert.match(manual, /postearNotaDebito\(/, "la manual sí postea");
  assert.match(manual, /saldo:\s*\{\s*increment/, "la manual sí aumenta el saldo");
  // El id llega del navegador y el reclamo optimista protege el saldo leído.
  assert.match(manual, /factura\.findFirst\(\{ where: \{ id: facturaId, empresaId \} \}\)/);
  assert.match(manual, /actualizada\.count !== 1/);
});

test("la penalidad tiene cuenta propia y el seed la siembra", async () => {
  // El mismo defecto de clase que el catálogo de ubigeos que nadie ejecutaba:
  // la migración solo alcanza a los planes que ya existen, así que una
  // instalación nueva depende del seed.
  const seed = await readFile(resolve(process.cwd(), "prisma/seed.ts"), "utf8");
  assert.match(seed, /\["INGRESO_PENALIDAD", "7599"\]/);
  assert.match(seed, /codigo: "7599"/);

  const contabilidad = await readFile(resolve(process.cwd(), "src/lib/contabilidad.ts"), "utf8");
  // Una penalidad no es venta ni interés por mora.
  const bloque = contabilidad.slice(contabilidad.indexOf("export async function postearNotaDebito"));
  assert.match(bloque, /INGRESO_PENALIDAD/);
  assert.doesNotMatch(bloque.slice(0, bloque.indexOf("}")), /INGRESO_MORA/);
});

test("cada clave de control que se postea está sembrada", async () => {
  // Generaliza el defecto anterior: una clave usada en un asiento pero no
  // sembrada deja la operación sin asiento y solo se nota cuadrando libros.
  const contabilidad = await readFile(resolve(process.cwd(), "src/lib/contabilidad.ts"), "utf8");
  const seed = await readFile(resolve(process.cwd(), "prisma/seed.ts"), "utf8");

  const usadas = new Set(
    [...contabilidad.matchAll(/clave:\s*"([A-Z_]+)"/g)].map((m) => m[1])
  );
  assert.ok(usadas.size > 10, "no se encontraron claves de control");

  const sembradas = new Set(
    [...seed.matchAll(/\["([A-Z_]+)",\s*"\d+"\]/g)].map((m) => m[1])
  );

  // Deuda preexistente, ajena a este ciclo y detectada por esta misma guardia:
  // las cinco claves de planilla se postean pero nunca se sembraron, así que en
  // una instalación nueva los asientos de planilla no salen y solo queda la
  // incidencia contable. Se dejan anotadas en vez de arreglarse aquí —elegir
  // sus cuentas del PCGE es trabajo del módulo de planilla, no del de notas de
  // débito— y la guardia sigue fallando ante cualquier clave nueva.
  const DEUDA_CONOCIDA = new Set([
    "GASTO_PERSONAL",
    "ONP_AFP_POR_PAGAR",
    "ESSALUD_POR_PAGAR",
    "SUELDOS_POR_PAGAR",
    "CTS_POR_PAGAR",
  ]);

  const faltantes = [...usadas]
    .filter((clave) => !sembradas.has(clave))
    .filter((clave) => !DEUDA_CONOCIDA.has(clave));
  assert.deepEqual(faltantes, [], `claves usadas en asientos pero no sembradas: ${faltantes}`);

  // Y si alguna de la deuda conocida se siembra, hay que sacarla de la lista:
  // una excepción que sobrevive a su causa termina tapando el próximo caso.
  const yaResueltas = [...DEUDA_CONOCIDA].filter((clave) => sembradas.has(clave));
  assert.deepEqual(yaResueltas, [], `ya están sembradas, quítelas de DEUDA_CONOCIDA: ${yaResueltas}`);
});
