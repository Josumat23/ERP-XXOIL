import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  buscarPosiblesDuplicados,
  claveNombre,
  mensajePosiblesDuplicados,
  normalizarDocumento,
  similitud,
  UMBRAL_SIMILITUD,
} from "@/lib/duplicadosCliente";

// El índice único de RUC ya impedía el duplicado exacto. El que se cuela es el
// mismo contribuyente con otra puntuación, o la misma empresa con la razón
// social escrita distinto. Importa porque el cliente es la llave de casi todo:
// un duplicado parte en dos el historial de crédito, el saldo de cascos y la
// cobranza, y cada mitad parece estar al día.

test("el documento se normaliza a solo letras y dígitos", () => {
  assert.equal(normalizarDocumento("20-123.456 789"), "20123456789");
  assert.equal(normalizarDocumento("20123456789"), "20123456789");
  assert.equal(normalizarDocumento("  20/123/456/789  "), "20123456789");
  assert.equal(normalizarDocumento("ce-12345"), "CE12345");
  assert.equal(normalizarDocumento(null), null);
  assert.equal(normalizarDocumento(""), null);
  // Un documento que era solo puntuación no es un documento.
  assert.equal(normalizarDocumento("---"), null);
});

test("la razón social se compara sin tildes, puntuación ni forma jurídica", () => {
  assert.equal(
    claveNombre("Ferretería San Martín S.R.L."),
    claveNombre("FERRETERIA SAN MARTIN SRL")
  );
  assert.equal(claveNombre("Lubricantes del Sur S.A.C."), "LUBRICANTES DEL SUR");
  assert.equal(claveNombre("  Doble   espacio  "), "DOBLE ESPACIO");
});

test("la forma jurídica se quita solo al final", () => {
  // «SA» en medio puede ser parte del nombre; borrarlo ahí convertiría dos
  // empresas distintas en la misma.
  assert.equal(claveNombre("SA MOTORS EIRL"), "SA MOTORS");
  assert.notEqual(claveNombre("SA MOTORS EIRL"), claveNombre("MOTORS EIRL"));
});

test("la similitud va de 0 a 1", () => {
  assert.equal(similitud("ABC", "ABC"), 1);
  assert.equal(similitud("", ""), 1);
  assert.ok(similitud("FERRETERIA SAN MARTIN", "FERRETERIA SAN MARTINN") > 0.9);
  assert.ok(similitud("GRIFO NORTE", "GRIFO SUR") < UMBRAL_SIMILITUD);
});

const existente = (id: string, codigo: string, razonSocial: string, doc: string | null, dir: string | null = null) => ({
  id,
  codigo,
  razonSocial,
  documentoNormalizado: doc,
  direccion: dir,
});

test("el mismo documento se detecta aunque venga con otra puntuación", () => {
  const hallazgos = buscarPosiblesDuplicados(
    {
      razonSocial: "Nombre totalmente distinto",
      documentoNormalizado: normalizarDocumento("20-123-456-789"),
      direccion: null,
    },
    [existente("a", "CLI-1", "Ferretería SAC", "20123456789")]
  );
  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0].motivo, "MISMO_DOCUMENTO");
});

test("el nombre parecido se detecta aunque el documento sea otro", () => {
  const hallazgos = buscarPosiblesDuplicados(
    {
      razonSocial: "FERRETERIA SAN MARTIN SRL",
      documentoNormalizado: "20999999999",
      direccion: null,
    },
    [existente("a", "CLI-1", "Ferretería San Martín S.R.L.", "20123456789")]
  );
  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0].motivo, "NOMBRE_PARECIDO");
});

test("dos clientes con nombres realmente distintos no se avisan", () => {
  // Un aviso que salta siempre se ignora siempre.
  const hallazgos = buscarPosiblesDuplicados(
    { razonSocial: "Grifo Norte", documentoNormalizado: "20999999999", direccion: null },
    [existente("a", "CLI-1", "Grifo Sur", "20123456789")]
  );
  assert.deepEqual(hallazgos, []);
});

test("la dirección sola no avisa: refuerza un nombre que ya se parece", () => {
  // En una galería conviven decenas de clientes en la misma puerta.
  const mismaPuerta = [existente("a", "CLI-1", "Comercial Alfa", "20123456789", "Jr. Cusco 120")];
  assert.deepEqual(
    buscarPosiblesDuplicados(
      { razonSocial: "Comercial Beta", documentoNormalizado: null, direccion: "Jr. Cusco 120" },
      mismaPuerta
    ),
    [],
    "mismo domicilio y nombres distintos no es un duplicado"
  );

  const hallazgos = buscarPosiblesDuplicados(
    { razonSocial: "COMERCIAL ALFA", documentoNormalizado: null, direccion: "JR CUSCO 120" },
    mismaPuerta
  );
  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0].motivo, "NOMBRE_Y_DIRECCION");
});

test("los hallazgos se ordenan por cuán seguro es el indicio", () => {
  const hallazgos = buscarPosiblesDuplicados(
    {
      razonSocial: "Comercial Andina",
      documentoNormalizado: "20123456789",
      direccion: "Av. Siempre Viva 100",
    },
    [
      existente("n", "CLI-2", "Comercial Andina", "20999999999", "Av. Siempre Viva 100"),
      existente("d", "CLI-1", "Nombre distinto", "20123456789"),
    ]
  );
  assert.deepEqual(
    hallazgos.map((h) => h.motivo),
    ["MISMO_DOCUMENTO", "NOMBRE_Y_DIRECCION"]
  );
});

test("un cliente sin documento no colisiona con otro sin documento", () => {
  const hallazgos = buscarPosiblesDuplicados(
    { razonSocial: "Cliente de mostrador", documentoNormalizado: null, direccion: null },
    [existente("a", "CLI-1", "Otro de mostrador", null)]
  );
  assert.deepEqual(hallazgos, []);
});

test("el mensaje nombra a los candidatos y dice qué está en juego", () => {
  const mensaje = mensajePosiblesDuplicados([
    { cliente: existente("a", "CLI-7", "Ferretería SAC", "20123456789"), motivo: "MISMO_DOCUMENTO", similitud: 1 },
  ]);
  assert.match(mensaje, /CLI-7/);
  assert.match(mensaje, /Ferretería SAC/);
  assert.match(mensaje, /mismo documento/);
  assert.match(mensaje, /historial de crédito/);
});

test("la base rechaza el mismo documento con otra puntuación", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-dup-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  await prisma.cliente.create({
    data: {
      empresaId,
      codigo: `CLI-A-${sufijo}`,
      razonSocial: "Ferretería SAC",
      ruc: `20${sufijo.padEnd(9, "0").slice(0, 9)}`,
      documentoNormalizado: `20${sufijo.padEnd(9, "0").slice(0, 9)}`,
    },
  });
  await assert.rejects(
    prisma.cliente.create({
      data: {
        empresaId,
        codigo: `CLI-B-${sufijo}`,
        razonSocial: "La misma con otro nombre",
        // El `ruc` literal es distinto —lleva guiones— así que el índice viejo
        // no lo vería. El normalizado sí.
        ruc: `20-${sufijo.padEnd(9, "0").slice(0, 9)}`,
        documentoNormalizado: `20${sufijo.padEnd(9, "0").slice(0, 9)}`,
      },
    }),
    "el documento normalizado repetido debe chocar en la base"
  );

  // Y varios sin documento conviven: los NULL no chocan entre sí.
  for (const nombre of ["Mostrador 1", "Mostrador 2", "Mostrador 3"]) {
    await prisma.cliente.create({
      data: { empresaId, codigo: `CLI-${nombre}-${sufijo}`, razonSocial: nombre },
    });
  }
  assert.equal(
    await prisma.cliente.count({ where: { empresaId, documentoNormalizado: null } }),
    3
  );
});

// --- Guardias estructurales -------------------------------------------------

test("el alta busca duplicados antes de crear y se puede confirmar", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/clientes/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /buscarPosiblesDuplicados\(/);
  // La confirmación explícita existe: hay clientes que de verdad se parecen.
  assert.match(acciones, /confirmarDuplicado/);
  // Y el documento se guarda normalizado, que es lo que protege el índice.
  assert.match(acciones, /documentoNormalizado: normalizarDocumento\(ruc\)/);
});

test("la migración rellena antes de crear el índice", async () => {
  // Si el índice fuera primero, el UPDATE fallaría a la mitad dejando unas
  // filas normalizadas y otras no.
  const sql = await readFile(
    resolve(
      process.cwd(),
      "prisma/migraciones-sqlite-historico/20260915020000_customer_duplicate_detection/migration.sql"
    ),
    "utf8"
  );
  const posAlter = sql.indexOf("ADD COLUMN");
  const posUpdate = sql.indexOf('UPDATE "clientes"');
  const posIndice = sql.indexOf("CREATE UNIQUE INDEX");
  assert.ok(posAlter !== -1 && posUpdate !== -1 && posIndice !== -1);
  assert.ok(posAlter < posUpdate, "la columna va antes del relleno");
  assert.ok(posUpdate < posIndice, "el relleno va antes del índice");
});
