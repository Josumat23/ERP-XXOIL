import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  ESTADOS_REGISTRABLES,
  ETIQUETA_ESTADO_AVISO,
  situacionDelAviso,
  validarRespuesta,
} from "@/lib/gestionCobranza";

// `AvisoCobranza` era un log de avisos emitidos: se sabía a quién se le había
// escrito y nunca qué había contestado. El seguimiento registra la respuesta;
// el incumplimiento de un compromiso se DERIVA, no se guarda.

test("el compromiso se incumple recién al día siguiente", () => {
  const aviso = { estado: "COMPROMISO_PAGO" as const, compromisoPagoEn: new Date(2026, 8, 20) };
  // Quien se comprometió para hoy tiene todo el día: a las nueve de la mañana
  // del mismo día no se le puede acusar de incumplir.
  assert.equal(situacionDelAviso(aviso, new Date(2026, 8, 20, 9)), "COMPROMISO_PAGO");
  assert.equal(situacionDelAviso(aviso, new Date(2026, 8, 20, 23, 59)), "COMPROMISO_PAGO");
  assert.equal(situacionDelAviso(aviso, new Date(2026, 8, 21, 0, 1)), "COMPROMISO_INCUMPLIDO");
  // Antes de la fecha, nada que reclamar.
  assert.equal(situacionDelAviso(aviso, new Date(2026, 8, 15)), "COMPROMISO_PAGO");
});

test("los demás estados se muestran tal como se registraron", () => {
  const hoy = new Date(2026, 8, 21);
  assert.equal(situacionDelAviso({ estado: "PENDIENTE", compromisoPagoEn: null }, hoy), "PENDIENTE");
  assert.equal(situacionDelAviso({ estado: "EN_DISPUTA", compromisoPagoEn: null }, hoy), "EN_DISPUTA");
  assert.equal(situacionDelAviso({ estado: "SIN_RESPUESTA", compromisoPagoEn: null }, hoy), "SIN_RESPUESTA");
  // Un COMPROMISO_PAGO sin fecha no puede derivar incumplimiento — pero la
  // validación no deja guardarlo así.
  assert.equal(situacionDelAviso({ estado: "COMPROMISO_PAGO", compromisoPagoEn: null }, hoy), "COMPROMISO_PAGO");
});

/** El error, exigiendo que lo haya: `validarRespuesta` devuelve `null` si pasa. */
function errorDe(estado: string, fecha: Date | null, detalle: string): string {
  const error = validarRespuesta(estado, fecha, detalle);
  assert.ok(error, `se esperaba un rechazo para ${estado}`);
  return error;
}

test("un compromiso sin fecha no es un compromiso", () => {
  assert.match(errorDe("COMPROMISO_PAGO", null, ""), /fecha comprometida/);
  assert.equal(validarRespuesta("COMPROMISO_PAGO", new Date(2026, 8, 30), ""), null);
  // Una disputa sin detalle no le sirve a quien tenga que resolverla.
  assert.match(errorDe("EN_DISPUTA", null, ""), /objeta/);
  assert.equal(validarRespuesta("EN_DISPUTA", null, "Cobran 2 baldes y llegó 1"), null);
  // Un estado que no existe no se guarda.
  assert.match(errorDe("INCOBRABLE", null, ""), /Seleccione/);
  assert.match(errorDe("SIN_RESPUESTA", null, "x".repeat(501)), /500 caracteres/);
});

test("cada estado registrable tiene etiqueta, y los derivados no son elegibles", () => {
  for (const estado of ESTADOS_REGISTRABLES) {
    assert.ok(ETIQUETA_ESTADO_AVISO[estado], `falta etiqueta de ${estado}`);
  }
  // COMPROMISO_INCUMPLIDO se deriva: ofrecerlo en el select permitiría declarar
  // a mano algo que el sistema sabe por su cuenta.
  assert.ok(!ESTADOS_REGISTRABLES.includes("COMPROMISO_INCUMPLIDO" as never));
});

test("los avisos ya emitidos quedan en PENDIENTE, que es lo que son", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-cob-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  const cliente = await prisma.cliente.create({
    data: { empresaId, codigo: `CLI-${sufijo}`, razonSocial: "Cliente moroso" },
  });
  const vendedor = await prisma.vendedor.create({
    data: { empresaId, nombre: "Vendedor", tipo: "SOLO_COMISION", tasaComision: 1 },
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
      fechaEmision: new Date(2026, 0, 1),
      fechaVencimiento: new Date(2026, 0, 15),
      subtotal: 1000,
      igv: 180,
      total: 1180,
      saldo: 1180,
      condicionPago: "DIAS_30",
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });

  const aviso = await prisma.avisoCobranza.create({
    data: {
      empresaId,
      clienteId: cliente.id,
      facturaId: factura.id,
      nivel: 2,
      diasVencidos: 20,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  assert.equal(aviso.estado, "PENDIENTE");
  assert.equal(aviso.compromisoPagoEn, null);
  assert.equal(aviso.respondidoPorNombre, null);

  // Registrar la respuesta deja quién y cuándo, no solo qué.
  const respondido = await prisma.avisoCobranza.update({
    where: { id: aviso.id },
    data: {
      estado: "COMPROMISO_PAGO",
      compromisoPagoEn: new Date(2026, 1, 10),
      respondidoEn: new Date(),
      respondidoPorId: "u-cobranza",
      respondidoPorNombre: "Cobranza",
    },
  });
  assert.equal(respondido.estado, "COMPROMISO_PAGO");
  assert.equal(respondido.respondidoPorNombre, "Cobranza");

  // Y la situación sale de la fecha comprometida, no de lo guardado en la fila.
  assert.equal(respondido.estado, "COMPROMISO_PAGO");
  assert.equal(situacionDelAviso(respondido, new Date(2026, 1, 20)), "COMPROMISO_INCUMPLIDO");
  assert.ok(factura.saldo.toNumber() > 0, "la factura del caso sigue debiendo");
});

// --- Guardias estructurales -------------------------------------------------

test("la situación derivada no se persiste", async () => {
  // Si algún día se guardara, se quedaría vieja apenas cambie el saldo o el
  // día, y la bandeja acusaría incumplimientos que ya no existen.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model AvisoCobranza"),
    esquema.indexOf("model AvisoCobranza") + 2000
  );
  assert.doesNotMatch(modelo, /incumplid/i, "el incumplimiento se deriva, no se guarda");
});

test("registrar la respuesta valida la compañía activa", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/finanzas/cobranza/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("export async function registrarRespuestaAviso"),
    acciones.indexOf("export async function alternarBloqueoCliente")
  );
  assert.ok(bloque.length > 0, "no se encontró la acción");
  // El id del aviso llega del navegador.
  assert.match(bloque, /where: \{ id: avisoId, empresaId \}/);
  assert.match(bloque, /actualizado\.count !== 1/);
  // Y el estado pasa por la validación en vez de ir crudo a la base.
  assert.match(bloque, /validarRespuesta\(/);
});
