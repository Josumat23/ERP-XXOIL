import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  creacionRequiereAprobacion,
  decidirCambioLimiteCredito,
} from "@/lib/aprobacionCredito";
import { evaluarCredito } from "@/lib/credito";

// Aumentar el límite de crédito de un cliente es exposición financiera nueva.
// Con el control encendido el límite NO cambia hasta que alguien lo aprueba:
// aplicar primero y aprobar después vaciaría el control.

test("sin umbral configurado, el límite se edita directo", () => {
  // El comportamiento que ya existía. Encender el control es una decisión de
  // política de crédito, y el sistema no elige una por su cuenta.
  const decision = decidirCambioLimiteCredito(1000, 900_000, null);
  assert.equal(decision.requiereAprobacion, false);
  assert.equal(creacionRequiereAprobacion(900_000, null), false);
});

test("bajar o mantener el límite nunca requiere aprobación", () => {
  // Pedir permiso para bajar un límite solo lograría que nadie los baje.
  assert.equal(decidirCambioLimiteCredito(50_000, 10_000, 20_000).requiereAprobacion, false);
  assert.equal(decidirCambioLimiteCredito(50_000, 50_000, 20_000).requiereAprobacion, false);
});

test("el umbral mira el límite resultante, no cuánto subió", () => {
  // Subir 100 soles queda bajo el umbral; subir hasta pasarlo, no. La
  // exposición es el límite que queda, no la variación.
  assert.equal(decidirCambioLimiteCredito(1_000, 1_100, 20_000).requiereAprobacion, false);
  assert.equal(decidirCambioLimiteCredito(19_900, 20_100, 20_000).requiereAprobacion, true);
  // Justo en el umbral todavía no: el umbral es el máximo permitido sin
  // aprobación, igual que en compras.
  assert.equal(decidirCambioLimiteCredito(1_000, 20_000, 20_000).requiereAprobacion, false);
});

test("el límite 0 es SIN CRÉDITO, y bajar a 0 es la mayor reducción", () => {
  // Hasta el 2026-09-14 el 0 significaba «sin límite», así que el valor con el
  // que nacía todo cliente era el más permisivo del sistema. Ahora es lo
  // contrario: 0 es solo contado.
  assert.equal(decidirCambioLimiteCredito(5_000, 0, 20_000).requiereAprobacion, false);
  // Y un alta con 0 nunca necesita que nadie la apruebe: es el estado seguro
  // con el que debe nacer un cliente. Antes el control lo BLOQUEABA, de modo
  // que el vendedor estaba obligado a escribir algún número positivo.
  assert.equal(creacionRequiereAprobacion(0, 20_000), false);
  assert.equal(creacionRequiereAprobacion(20_000, 20_000), false);
  assert.equal(creacionRequiereAprobacion(20_001, 20_000), true);
});

test("sin tope es null, no un número", () => {
  // El estado heredado de los clientes que existían antes del cambio.
  // Ponerle un techo a quien no tenía ninguno reduce la exposición.
  assert.equal(decidirCambioLimiteCredito(null, 900_000, 20_000).requiereAprobacion, false);
  assert.equal(decidirCambioLimiteCredito(null, 0, 20_000).requiereAprobacion, false);
});

test("un cliente sin crédito no puede facturar a crédito ni un sol", () => {
  // La consecuencia que importa, y la que antes no ocurría.
  assert.equal(evaluarCredito(0, 1, 0).excede, true);
  assert.equal(evaluarCredito(0, 0.01, 0).excede, true);
  // Sin tope heredado: nunca excede, que es como operaba hasta el cambio.
  assert.equal(evaluarCredito(999_999, 999_999, null).excede, false);
  // Con techo real, la aritmética de siempre.
  assert.equal(evaluarCredito(800, 300, 1000).excede, true);
  assert.equal(evaluarCredito(700, 300, 1000).excede, false);
});

async function montarCliente(sufijo: string, limiteCredito: number, umbral: number | null) {
  const empresaId = `empresa-lc-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  await prisma.configuracionEmpresa.create({
    data: { empresaId, razonSocial: empresaId, montoAprobacionCredito: umbral },
  });
  const cliente = await prisma.cliente.create({
    data: { empresaId, codigo: `CLI-${sufijo}`, razonSocial: "Cliente", limiteCredito },
  });
  return { empresaId, cliente };
}

test("aprobar la solicitud es lo que mueve el límite", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { empresaId, cliente } = await montarCliente(sufijo, 10_000, 20_000);

  const solicitud = await prisma.solicitudCambioCredito.create({
    data: {
      empresaId,
      clienteId: cliente.id,
      limiteAnterior: 10_000,
      limiteSolicitado: 80_000,
      motivo: "Tres años sin atrasos y carta fianza recibida",
      solicitadoPorId: "u-ventas",
      solicitadoPorNombre: "Ventas",
    },
  });

  // Mientras está pendiente el cliente conserva su límite.
  const durante = await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
  assert.equal(durante.limiteCredito?.toNumber(), 10_000);

  // El cierre optimista: la segunda resolución no encuentra nada que cerrar.
  const primera = await prisma.solicitudCambioCredito.updateMany({
    where: { id: solicitud.id, empresaId, estado: "PENDIENTE" },
    data: { estado: "APROBADA", resueltoPorId: "u-gerencia", resueltoPorNombre: "Gerencia", resueltoEn: new Date() },
  });
  assert.equal(primera.count, 1);
  const segunda = await prisma.solicitudCambioCredito.updateMany({
    where: { id: solicitud.id, empresaId, estado: "PENDIENTE" },
    data: { estado: "RECHAZADA" },
  });
  assert.equal(segunda.count, 0, "una solicitud resuelta no se vuelve a resolver");

  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { limiteCredito: solicitud.limiteSolicitado },
  });
  const despues = await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
  assert.equal(despues.limiteCredito?.toNumber(), 80_000);
});

test("borrar el cliente se lleva sus solicitudes", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { empresaId, cliente } = await montarCliente(sufijo, 5_000, 10_000);
  await prisma.solicitudCambioCredito.create({
    data: {
      empresaId,
      clienteId: cliente.id,
      limiteAnterior: 5_000,
      limiteSolicitado: 50_000,
      motivo: "Campaña de verano",
      solicitadoPorId: "u",
      solicitadoPorNombre: "u",
    },
  });
  await prisma.cliente.delete({ where: { id: cliente.id } });
  assert.equal(await prisma.solicitudCambioCredito.count({ where: { empresaId } }), 0);
});

test("el umbral nace apagado y no cambia el comportamiento existente", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-lc0-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const config = await prisma.configuracionEmpresa.create({
    data: { empresaId, razonSocial: empresaId },
  });
  assert.equal(config.montoAprobacionCredito, null);
});

// --- Guardias estructurales -------------------------------------------------

test("la acción decide sobre el límite guardado, no sobre el del formulario", async () => {
  // Si la decisión se tomara con el límite que manda el navegador, bastaría con
  // declarar uno anterior alto para saltarse la aprobación.
  const fuente = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/clientes/actions.ts"),
    "utf8"
  );
  const bloque = fuente.slice(fuente.indexOf("export async function actualizarCliente"));
  assert.match(
    bloque,
    /decidirCambioLimiteCredito\(\s*antes\.limiteCredito\?\.toNumber\(\) \?\? null,/,
    "el límite anterior debe leerse del registro, no del FormData"
  );
  // Y el límite no se aplica mientras la solicitud está pendiente.
  assert.match(bloque, /limiteCredito: decision\.requiereAprobacion \? antes\.limiteCredito/);
});

test("resolver una solicitud valida compañía y segregación de funciones", async () => {
  const fuente = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/clientes/actions.ts"),
    "utf8"
  );
  const bloque = fuente.slice(
    fuente.indexOf("async function resolverSolicitudCredito"),
    fuente.indexOf("export async function alternarActivoCliente")
  );
  assert.ok(bloque.length > 0, "no se encontró el resolutor");
  assert.match(bloque, /requerirRol\(\["GERENCIA"\]\)/);
  assert.match(bloque, /puedeResolverSolicitud\(solicitud\.solicitadoPorId, auth\.usuario\.id\)/);
  // El id llega del navegador: la solicitud se busca acotada a la compañía, y
  // el cliente sale de la solicitud, nunca de otro id del formulario.
  assert.match(bloque, /solicitudCambioCredito\.findFirst\(\{ where: \{ id, empresaId \} \}\)/);
  assert.match(bloque, /cliente\.findFirst\(\{ where: \{ id: solicitud\.clienteId, empresaId \} \}\)/);
  assert.match(bloque, /cerrada\.count !== 1/, "hace falta el cierre optimista");
});
