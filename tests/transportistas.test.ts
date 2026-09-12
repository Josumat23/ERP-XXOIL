import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  datosDeTransportista,
  normalizarPlaca,
  rucValido,
  validarConductor,
  validarTransportista,
  validarVehiculo,
} from "@/lib/transportistas";

// Maestro de transportistas contratados. No reemplaza los campos de texto de
// la guía: los alimenta. Lo que ya se imprimió no se reescribe.

test("sin transportista elegido no se borra lo que alguien escribió", () => {
  // Objeto VACÍO, no dos null: al esparcirlo en un update, las claves ausentes
  // dejan intactas las columnas. Con null se perdería el transportista escrito
  // a mano, que es el respaldo de las guías que el maestro no cubre. Mismo
  // criterio que `nombresDeUbigeo`.
  assert.deepEqual(datosDeTransportista(null), {});
  assert.deepEqual(datosDeTransportista({ razonSocial: "Fletes SAC", ruc: "20111111111" }), {
    transportista: "Fletes SAC",
    transportistaRuc: "20111111111",
  });
  // Un transportista sin RUC sí lo propaga como null: es lo que dice su ficha.
  assert.deepEqual(datosDeTransportista({ razonSocial: "Puntual", ruc: null }), {
    transportista: "Puntual",
    transportistaRuc: null,
  });
});

test("el RUC es opcional pero, si está, son 11 dígitos", () => {
  assert.equal(rucValido(""), true);
  assert.equal(rucValido("20111111111"), true);
  assert.equal(rucValido("2011111111"), false);
  assert.equal(rucValido("201111111111"), false);
  assert.equal(rucValido("2011111111A"), false);
});

test("la placa se normaliza y no se le exige un formato", () => {
  // Las placas peruanas cambiaron de formato varias veces y un vehículo
  // extranjero en tránsito tiene el suyo: se exige que diga algo, no que
  // calce con un patrón.
  assert.equal(normalizarPlaca("  abc-123 "), "ABC-123");
  assert.equal(validarVehiculo("abc-123"), null);
  assert.equal(validarVehiculo("XX 9999"), null);
  assert.match(validarVehiculo("   ") ?? "", /obligatoria/);
  assert.match(validarVehiculo("x".repeat(21)) ?? "", /20/);
});

test("el conductor necesita nombre y un DNI de 8 dígitos", () => {
  // El DNI viaja en el XML de la guía.
  assert.equal(validarConductor({ nombres: "Juan Pérez", dni: "12345678" }), null);
  assert.match(validarConductor({ nombres: "", dni: "12345678" }) ?? "", /nombre/);
  assert.match(validarConductor({ nombres: "Juan", dni: "1234567" }) ?? "", /8 dígitos/);
});

test("la razón social es obligatoria y el RUC se valida", () => {
  const base = { razonSocial: "Transportes Lima SAC", ruc: "", registroMtc: "" };
  assert.equal(validarTransportista(base), null);
  assert.match(validarTransportista({ ...base, razonSocial: " " }) ?? "", /razón social/);
  assert.match(validarTransportista({ ...base, ruc: "123" }) ?? "", /11 dígitos/);
});

async function montarEmpresa(sufijo: string) {
  const empresaId = `empresa-tra-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  return empresaId;
}

test("varios transportistas pueden no tener RUC sin chocar entre sí", async () => {
  // El índice único es (empresaId, ruc): SQLite y PostgreSQL tratan cada NULL
  // como distinto, así que el maestro admite fichas sin RUC — que es como
  // nacen las que se registran antes de tener el dato.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = await montarEmpresa(sufijo);

  await prisma.transportista.create({
    data: { empresaId, codigo: "TRA-00001", razonSocial: "Sin RUC uno" },
  });
  await prisma.transportista.create({
    data: { empresaId, codigo: "TRA-00002", razonSocial: "Sin RUC dos" },
  });
  assert.equal(await prisma.transportista.count({ where: { empresaId, ruc: null } }), 2);

  // Con RUC sí es único dentro de la compañía.
  await prisma.transportista.create({
    data: { empresaId, codigo: "TRA-00003", razonSocial: "Con RUC", ruc: "20111111111" },
  });
  await assert.rejects(
    prisma.transportista.create({
      data: { empresaId, codigo: "TRA-00004", razonSocial: "Repetido", ruc: "20111111111" },
    })
  );
});

test("el mismo RUC puede existir en otra compañía", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const unaId = await montarEmpresa(`a-${sufijo}`);
  const otraId = await montarEmpresa(`b-${sufijo}`);
  const datos = { codigo: "TRA-00001", razonSocial: "Fletes del Sur", ruc: "20999999999" };
  await prisma.transportista.create({ data: { empresaId: unaId, ...datos } });
  await prisma.transportista.create({ data: { empresaId: otraId, ...datos } });
  assert.equal(await prisma.transportista.count({ where: { ruc: "20999999999" } }), 2);
});

test("borrar el transportista se lleva sus vehículos y conductores", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = await montarEmpresa(sufijo);
  const t = await prisma.transportista.create({
    data: {
      empresaId,
      codigo: "TRA-00001",
      razonSocial: "Fletes",
      vehiculos: { create: [{ placa: "ABC-123" }] },
      conductores: { create: [{ nombres: "Juan", dni: "12345678" }] },
    },
  });
  await prisma.transportista.delete({ where: { id: t.id } });
  assert.equal(await prisma.transportistaVehiculo.count({ where: { transportistaId: t.id } }), 0);
  assert.equal(await prisma.transportistaConductor.count({ where: { transportistaId: t.id } }), 0);
});

// --- Guardias estructurales -------------------------------------------------

test("la guía deriva el transportista de la ficha, no del formulario", async () => {
  // Ese texto se imprime en la guía y se declara ante SUNAT: si saliera del
  // FormData, bastaría con mandar un id válido y una razón social inventada.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/guias-remision/actions.ts"),
    "utf8"
  );
  assert.match(
    acciones,
    /transportista\.findFirst\(\{\s*where: \{ id: transportistaId, empresaId: empresaIdGuia, activo: true \}/,
    "la ficha se relee acotada a la compañía activa"
  );
  assert.match(acciones, /transportista = ficha\.razonSocial;/);
  assert.match(acciones, /transportistaRuc = ficha\.ruc;/);
});

test("las acciones del maestro validan la compañía antes de colgar nada", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/logistica/transportistas/actions.ts"),
    "utf8"
  );
  // Vehículos y conductores cuelgan de un id que llega del navegador.
  for (const fn of ["agregarVehiculo", "agregarConductor"]) {
    const bloque = acciones.slice(acciones.indexOf(`export async function ${fn}`));
    assert.match(
      bloque.slice(0, bloque.indexOf("revalidatePath")),
      /transportistaDeLaEmpresa\(transportistaId, empresaId\)/,
      `${fn} no valida la compañía`
    );
  }
  // Y las bajas se acotan por la relación, no por el id suelto.
  assert.match(acciones, /where: \{ id, transportista: \{ empresaId \} \}/);
});

test("el maestro no absorbe la flota propia", async () => {
  // La flota propia es `Equipo`, que lleva su historial de mantenimiento.
  // Duplicarla aquí crearía dos verdades sobre el mismo camión.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  // Sin comentarios: el que explica esta decisión nombra a `Equipo`, y una
  // guardia que se dispara con su propia explicación no sirve de nada.
  const modelo = esquema
    .slice(esquema.indexOf("model Transportista {"), esquema.indexOf("model TransportistaVehiculo"))
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(modelo, /equipoId|Equipo/);
  // La guía conserva las dos vías: equipo propio y transportista contratado.
  const guia = esquema.slice(
    esquema.indexOf("model GuiaRemision {"),
    esquema.indexOf("model GuiaRemisionDetalle")
  );
  assert.match(guia, /equipoId\s+String\?/);
  assert.match(guia, /transportistaId\s+String\?/);
});
